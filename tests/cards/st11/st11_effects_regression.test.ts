import { describe, expect, it } from 'vitest';
import { DUMMY_CARDS } from '../../../src/logic/CardDatabase';
import { GameEngine } from '../../../src/logic/GameEngine';
import { Card, Phase } from '../../../src/logic/types';

function getCard(id: string): Card {
    const card = DUMMY_CARDS.find(c => c.id === id);
    if (!card) throw new Error(`Card ${id} not found`);
    return JSON.parse(JSON.stringify(card));
}

function createEngine(seed: number): GameEngine {
    const deck1 = Array.from({ length: 30 }, () => getCard('ST01-002'));
    const deck2 = Array.from({ length: 30 }, () => getCard('ST01-002'));
    const engine = new GameEngine('P1', 'P2', deck1, deck2, getCard('ST11-001'), getCard('ST01-001'), { seed });
    engine.state.turnPlayerIndex = 0;
    engine.state.phase = Phase.MAIN;
    engine.state.winner = null;
    engine.state.players[0].leaderLevel = 10;
    engine.state.players[1].leaderLevel = 10;
    return engine;
}

function findAction(
    engine: GameEngine,
    actorPlayerId: string,
    type: string,
    predicate?: (action: any) => boolean
) {
    const actions = engine.getLegalActions(actorPlayerId);
    return actions.find(action => action.type === type && (!predicate || predicate(action)));
}

function advanceUntil(engine: GameEngine, predicate: () => boolean, maxSteps = 20) {
    let guard = 0;
    while (!predicate() && guard < maxSteps) {
        engine.nextPhase();
        guard += 1;
    }
    expect(predicate()).toBe(true);
}

describe('ST11 Effects Regression', () => {
    it('ST11-001 active filter allows only skills with cost lower than skill-zone count', () => {
        const engine = createEngine(11001);
        const p1 = engine.state.players[0];

        p1.levelZone = getCard('ST11-001');
        if (p1.levelZone) p1.levelZone.isAwakened = true;
        p1.skillZone = [getCard('ST11-013'), getCard('ST11-014')];
        p1.trash = [getCard('ST11-013'), getCard('ST11-014')];
        engine.state.phase = Phase.MAIN;

        engine.activateEffect(0, 1, 'LEADER');
        expect(engine.state.interactionMode).toBe('SELECT_TARGET');

        const legal = engine.getLegalActions(p1.id).filter(action => action.type === 'SELECT_TRASH_TARGET') as Array<any>;
        const selectableIds = legal.map(action => p1.trash[action.trashIndex]?.id);

        expect(selectableIds.some(id => id?.startsWith('ST11-013'))).toBe(true);
        expect(selectableIds.some(id => id?.startsWith('ST11-014'))).toBe(false);
    });

    it('ST11-002 passive prevents attacking', () => {
        const engine = createEngine(11002);
        const p1 = engine.state.players[0];

        p1.unitZones[0].unit = getCard('ST11-002');
        engine.state.phase = Phase.ATTACK;

        const canAttack = engine
            .getLegalActions(p1.id)
            .some(action => action.type === 'ATTACK' && action.attackerZoneIndex === 0);
        expect(canAttack).toBe(false);
    });

    it('ST11-010 targets only hit<=1 enemy and locked unit cannot attack on opponent turn', () => {
        const engine = createEngine(11003);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.unitZones[0].unit = getCard('ST11-010');
        p1.skillZone = [getCard('ST11-013')];
        p2.unitZones[0].unit = getCard('ST11-006'); // hit 1
        p2.unitZones[1].unit = getCard('ST11-012'); // hit 2
        engine.state.phase = Phase.MAIN;

        engine.activateEffect(0, 0);
        expect(engine.state.interactionMode).toBe('SELECT_TARGET');

        const legal = engine.getLegalActions(p1.id).filter(action => action.type === 'SELECT_ZONE_TARGET') as Array<any>;
        const targetLanes = legal.filter(action => action.targetPlayerId === p2.id).map(action => action.zoneIndex).sort((a, b) => a - b);
        expect(targetLanes).toEqual([0]);

        const pickLane0 = legal.find(action => action.targetPlayerId === p2.id && action.zoneIndex === 0);
        expect(pickLane0).toBeDefined();
        if (pickLane0) expect(engine.step(pickLane0)).toBe(true);

        advanceUntil(engine, () => engine.currentPlayer.id === p2.id && engine.state.phase === Phase.ATTACK, 20);
        const canLockedUnitAttack = engine
            .getLegalActions(p2.id)
            .some(action => action.type === 'ATTACK' && action.attackerZoneIndex === 0);
        expect(canLockedUnitAttack).toBe(false);
    });

    it('ST11-009 granted defender effect lasts through own turn end and expires after opponent turn end', () => {
        const engine = createEngine(11004);
        const p1 = engine.state.players[0];

        p1.unitZones[0].unit = getCard('ST11-009');
        p1.unitZones[1].unit = getCard('ST11-006');
        p1.skillZone = [getCard('ST11-013')];
        engine.state.phase = Phase.MAIN;

        engine.activateEffect(0, 1);
        const granted = p1.unitZones[1].temporaryEffects.some(effect => effect.activation === 'DEFENDER' && effect.duration === 'OPP_TURN_END');
        expect(granted).toBe(true);

        advanceUntil(engine, () => engine.currentPlayer.id === engine.state.players[1].id && engine.state.phase === Phase.LEVEL_UP, 14);
        const stillGranted = p1.unitZones[1].temporaryEffects.some(effect => effect.activation === 'DEFENDER');
        expect(stillGranted).toBe(true);

        advanceUntil(engine, () => engine.currentPlayer.id === p1.id && engine.state.phase === Phase.LEVEL_UP, 14);
        const removed = p1.unitZones[1].temporaryEffects.some(effect => effect.activation === 'DEFENDER');
        expect(removed).toBe(false);
    });

    it('ST11-011 +2000 buff persists until opponent turn end', () => {
        const engine = createEngine(11005);
        const p1 = engine.state.players[0];

        p1.unitZones[0].unit = getCard('ST11-011');
        p1.unitZones[1].unit = getCard('ST11-006');
        p1.skillZone = [getCard('ST11-013')];
        engine.state.phase = Phase.MAIN;

        const base = p1.unitZones[1].unit?.power || 0;
        engine.activateEffect(0, 1);
        expect(engine.getUnitPower(p1.unitZones[1], p1)).toBe(base + 2000);

        advanceUntil(engine, () => engine.currentPlayer.id === engine.state.players[1].id && engine.state.phase === Phase.LEVEL_UP, 14);
        expect(engine.getUnitPower(p1.unitZones[1], p1)).toBe(base + 2000);

        advanceUntil(engine, () => engine.currentPlayer.id === p1.id && engine.state.phase === Phase.LEVEL_UP, 14);
        expect(engine.getUnitPower(p1.unitZones[1], p1)).toBe(base);
    });

    it('ST11-012 trigger trashes self then returns lowest-cost enemy unit and items to hand', () => {
        const engine = createEngine(11006);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.deck = [getCard('ST11-012')];
        p2.unitZones[0].unit = getCard('ST11-006'); // low cost
        p2.unitZones[0].items = [getCard('ST11-017')];
        p2.unitZones[1].unit = getCard('ST11-011'); // high cost
        engine.state.phase = Phase.MAIN;

        engine.dealDamage(p1, 1);
        expect(engine.state.interactionMode).toBe('SELECT_TARGET');
        const pickLowCost = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) => action.targetPlayerId === p2.id && action.zoneIndex === 0);
        expect(pickLowCost).toBeDefined();
        if (pickLowCost) expect(engine.step(pickLowCost)).toBe(true);

        expect(p1.damage.every(card => !card.id.startsWith('ST11-012'))).toBe(true);
        expect(p1.trash.some(card => card.id.startsWith('ST11-012'))).toBe(true);
        expect(p2.unitZones[0].unit).toBeNull();
        expect(p2.hand.some(card => card.id.startsWith('ST11-006'))).toBe(true);
        expect(p2.hand.some(card => card.id.startsWith('ST11-017'))).toBe(true);
        expect(p2.unitZones[1].unit?.id.startsWith('ST11-011')).toBe(true);
    });

    it('ST11-016 granted cannotBlock prevents encounter block this turn', () => {
        const engine = createEngine(11007);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.hand = [getCard('ST11-016')];
        p1.unitZones[0].unit = getCard('ST11-006');
        p2.unitZones[0].unit = getCard('ST11-005');
        engine.state.phase = Phase.MAIN;

        const beforeDamage = p2.damage.length;
        engine.playSkill(0);
        const pickOpp0 = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) => action.targetPlayerId === p2.id && action.zoneIndex === 0);
        expect(pickOpp0).toBeDefined();
        if (pickOpp0) expect(engine.step(pickOpp0)).toBe(true);

        engine.state.phase = Phase.ATTACK;
        engine.attack(0);

        expect(p2.damage.length).toBe(beforeDamage + 1);
        expect(p2.unitZones[0].unit).not.toBeNull();
        expect(engine.state.phase).toBe(Phase.ATTACK);
    });

    it('ST11-017 active draw is symmetric for self and opponent', () => {
        const engine = createEngine(11008);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.hand = [getCard('ST11-017')];
        p1.unitZones[0].unit = getCard('ST11-006');
        p1.deck = [getCard('ST01-002')];
        p2.hand = [];
        p2.deck = [getCard('ST01-002')];
        engine.state.phase = Phase.MAIN;

        engine.playItem(0, 0);
        engine.activateEffect(0, 0, 'ITEM', 0);

        expect(p1.hand.length).toBe(1);
        expect(p2.hand.length).toBe(1);
    });

    it('ST11-017 trigger trashes self and returns lowest-cost enemy unit with items', () => {
        const engine = createEngine(11009);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.deck = [getCard('ST11-017')];
        p2.unitZones[0].unit = getCard('ST11-006'); // low cost
        p2.unitZones[0].items = [getCard('ST11-017')];
        p2.unitZones[1].unit = getCard('ST11-011'); // high cost
        engine.state.phase = Phase.MAIN;

        engine.dealDamage(p1, 1);
        expect(engine.state.interactionMode).toBe('SELECT_TARGET');
        const pickLow = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) => action.targetPlayerId === p2.id && action.zoneIndex === 0);
        expect(pickLow).toBeDefined();
        if (pickLow) expect(engine.step(pickLow)).toBe(true);

        expect(p1.damage.every(card => !card.id.startsWith('ST11-017'))).toBe(true);
        expect(p1.trash.some(card => card.id.startsWith('ST11-017'))).toBe(true);
        expect(p2.unitZones[0].unit).toBeNull();
        expect(p2.hand.some(card => card.id.startsWith('ST11-006'))).toBe(true);
        expect(p2.hand.some(card => card.id.startsWith('ST11-017'))).toBe(true);
    });
});
