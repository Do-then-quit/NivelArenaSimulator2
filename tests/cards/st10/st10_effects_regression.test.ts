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
    const engine = new GameEngine('P1', 'P2', deck1, deck2, getCard('ST10-001'), getCard('ST01-001'), { seed });
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

describe('ST10 Effects Regression', () => {
    it('ST10-002 optional entry discard then draw', () => {
        const engine = createEngine(10001);
        const p1 = engine.state.players[0];

        p1.hand = [getCard('ST10-002'), getCard('ST01-002')];
        p1.deck = [getCard('ST10-005')];
        engine.state.phase = Phase.MAIN;

        engine.playUnit(0, 0);
        expect(engine.state.interactionMode).toBe('SELECT_OPTIONAL');

        const optionalConfirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', action => action.confirm === true);
        expect(optionalConfirm).toBeDefined();
        if (optionalConfirm) expect(engine.step(optionalConfirm)).toBe(true);

        const costAction = findAction(engine, p1.id, 'SELECT_COST_HAND');
        expect(costAction).toBeDefined();
        if (costAction) expect(engine.step(costAction)).toBe(true);

        expect(p1.hand.length).toBe(1);
        expect(p1.trash.some(card => card.id.startsWith('ST01-002'))).toBe(true);
        expect(p1.hand.some(card => card.id.startsWith('ST10-005'))).toBe(true);
    });

    it('ST10-003 self-trashes at battle end', () => {
        const engine = createEngine(10002);
        const p1 = engine.state.players[0];

        p1.unitZones[0].unit = getCard('ST10-003');
        engine.state.phase = Phase.ATTACK;

        engine.attack(0);

        expect(p1.unitZones[0].unit).toBeNull();
        expect(p1.trash.some(card => card.id.startsWith('ST10-003'))).toBe(true);
    });

    it('ST10-003 entry auto-attacks when encounter exists', () => {
        const engine = createEngine(10010);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.hand = [getCard('ST10-003')];
        p2.unitZones[0].unit = getCard('ST10-005');
        engine.state.phase = Phase.MAIN;

        engine.playUnit(0, 0);

        expect(p1.unitZones[0].hasAttacked).toBe(true);
        expect(engine.state.combatStep === 'DEFENSE_DECLARATION' || engine.state.phase === Phase.BLOCK || engine.state.phase === Phase.ATTACK).toBe(true);
    });

    it('ST10-004 reveals top 3, takes a chain unit, trashes the rest', () => {
        const engine = createEngine(10003);
        const p1 = engine.state.players[0];

        p1.hand = [getCard('ST10-004')];
        p1.deck = [
            getCard('ST01-002'),
            getCard('ST10-005'),
            getCard('ST10-006'),
        ];
        engine.state.phase = Phase.MAIN;

        engine.playUnit(0, 0);
        expect(engine.state.interactionMode).toBe('SELECT_TARGET');

        const pickChain = findAction(
            engine,
            p1.id,
            'SELECT_REVEALED_TARGET',
            action => engine.state.revealedCards[action.revealedIndex]?.id.startsWith('ST10-006')
        );
        expect(pickChain).toBeDefined();
        if (pickChain) expect(engine.step(pickChain)).toBe(true);

        expect(p1.hand.some(card => card.id.startsWith('ST10-006'))).toBe(true);
        expect(p1.trash.some(card => card.id.startsWith('ST10-005'))).toBe(true);
        expect(p1.trash.some(card => card.id.startsWith('ST01-002'))).toBe(true);
    });

    it('ST10-001 leader active can grant one extra attack', () => {
        const engine = createEngine(10004);
        const p1 = engine.state.players[0];

        p1.levelZone = getCard('ST10-001');
        if (p1.levelZone) p1.levelZone.isAwakened = true;
        p1.leaderLevel = 5;
        p1.unitZones[0].unit = getCard('ST10-005');
        p1.hand = [getCard('ST01-002')];
        p1.unitZones[1].unit = getCard('ST10-005');
        engine.state.phase = Phase.ATTACK;

        const activateLeader = findAction(
            engine,
            p1.id,
            'ACTIVATE_EFFECT',
            action => action.type === 'ACTIVATE_EFFECT' && action.sourceType === 'LEADER'
        );
        expect(activateLeader).toBeDefined();
        if (activateLeader) expect(engine.step(activateLeader)).toBe(true);

        const costAction = findAction(engine, p1.id, 'SELECT_COST_HAND');
        expect(costAction).toBeDefined();
        if (costAction) expect(engine.step(costAction)).toBe(true);

        const targetLane0 = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', action => action.zoneIndex === 0);
        expect(targetLane0).toBeDefined();
        if (targetLane0) expect(engine.step(targetLane0)).toBe(true);

        engine.attack(0);
        const canAttackAgain = engine
            .getLegalActions(p1.id)
            .some(action => action.type === 'ATTACK' && action.attackerZoneIndex === 0);
        expect(canAttackAgain).toBe(true);

        engine.attack(0);
        const canAttackThird = engine
            .getLegalActions(p1.id)
            .some(action => action.type === 'ATTACK' && action.attackerZoneIndex === 0);
        expect(canAttackThird).toBe(false);
    });

    it('ST10-006 chain condition reads +1 from ST10-017 reference bonus', () => {
        const engine = createEngine(10005);
        const p1 = engine.state.players[0];

        p1.unitZones[0].unit = getCard('ST10-006');
        p1.unitZones[0].items = [getCard('ST10-017')];
        engine.state.phase = Phase.ATTACK;

        engine.attack(0);

        const plunderBuff = p1.unitZones[0].buffs.find(buff => buff.type === 'PLUNDER');
        expect(plunderBuff?.value).toBe(1);
    });

    it('ST10-008 applies encounter -3000 on second attack of the turn', () => {
        const engine = createEngine(10006);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.unitZones[0].unit = getCard('ST10-005');
        p1.unitZones[1].unit = getCard('ST10-008');
        p2.unitZones[1].unit = getCard('ST10-005');
        engine.state.phase = Phase.ATTACK;

        engine.attack(0);

        const before = engine.getUnitPower(p2.unitZones[1], p2);
        engine.attack(1);
        const encounterZone = p2.unitZones[1];
        const after = engine.getUnitPower(encounterZone, p2);

        expect(encounterZone.unit === null || after === before - 3000).toBe(true);
    });

    it('ST10-013 can optionally trash own unit after enemy debuff', () => {
        const engine = createEngine(10007);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.hand = [getCard('ST10-013')];
        p1.unitZones[0].unit = getCard('ST10-005');
        p2.unitZones[0].unit = getCard('ST10-005');
        engine.state.phase = Phase.MAIN;

        const beforeOppPower = engine.getUnitPower(p2.unitZones[0], p2);
        engine.playSkill(0);

        const pickOpp0 = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', action => action.zoneIndex === 0 && action.targetPlayerId === p2.id);
        expect(pickOpp0).toBeDefined();
        if (pickOpp0) expect(engine.step(pickOpp0)).toBe(true);

        expect(engine.state.interactionMode).toBe('SELECT_OPTIONAL');
        const optionalConfirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', action => action.confirm === true);
        expect(optionalConfirm).toBeDefined();
        if (optionalConfirm) expect(engine.step(optionalConfirm)).toBe(true);

        const pickOwn0 = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', action => action.zoneIndex === 0 && action.targetPlayerId === p1.id);
        expect(pickOwn0).toBeDefined();
        if (pickOwn0) expect(engine.step(pickOwn0)).toBe(true);

        expect(p1.unitZones[0].unit).toBeNull();
        expect(engine.getUnitPower(p2.unitZones[0], p2)).toBe(beforeOppPower - 1000);
    });

    it('ST10-014 main effect enforces hand-size total cost and excludes self-id', () => {
        const engine = createEngine(10008);
        const p1 = engine.state.players[0];

        p1.hand = [getCard('ST10-014'), getCard('ST01-002')]; // After play: hand size becomes 1.
        p1.trash = [getCard('ST10-014'), getCard('ST01-002'), getCard('ST10-006')];
        engine.state.phase = Phase.MAIN;

        engine.playSkill(0);
        expect(engine.state.interactionMode).toBe('SELECT_TARGET');

        const legal = engine.getLegalActions(p1.id).filter(action => action.type === 'SELECT_TRASH_TARGET') as Array<{
            type: 'SELECT_TRASH_TARGET';
            actorPlayerId: string;
            targetPlayerId: string;
            trashIndex: number;
        }>;
        const selectableIds = legal.map(action => p1.trash[action.trashIndex]?.id);

        expect(selectableIds.some(id => id?.startsWith('ST01-002'))).toBe(true);
        expect(selectableIds.some(id => id?.startsWith('ST10-014'))).toBe(false);
        expect(selectableIds.some(id => id?.startsWith('ST10-006'))).toBe(false);

        const pickCost1 = legal.find(action => p1.trash[action.trashIndex]?.id.startsWith('ST01-002'));
        expect(pickCost1).toBeDefined();
        if (pickCost1) expect(engine.step(pickCost1)).toBe(true);

        const confirm = findAction(engine, p1.id, 'CONFIRM_TARGETS');
        expect(confirm).toBeDefined();
        if (confirm) expect(engine.step(confirm)).toBe(true);

        expect(p1.hand.some(card => card.id.startsWith('ST01-002'))).toBe(true);
    });

    it('ST10-016 locks same skill id for turn and granted effect destroys encounter', () => {
        const engine = createEngine(10009);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.hand = [getCard('ST10-016'), getCard('ST10-016')];
        p1.unitZones[0].unit = getCard('ST10-005');
        p2.unitZones[0].unit = getCard('ST10-005');
        engine.state.phase = Phase.MAIN;

        engine.playSkill(0);
        const pickOwn0 = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', action => action.zoneIndex === 0 && action.targetPlayerId === p1.id);
        expect(pickOwn0).toBeDefined();
        if (pickOwn0) expect(engine.step(pickOwn0)).toBe(true);

        const canPlaySecondCopy = engine
            .getLegalActions(p1.id)
            .some(action => action.type === 'PLAY_SKILL' && p1.hand[action.handIndex]?.id.startsWith('ST10-016'));
        expect(canPlaySecondCopy).toBe(false);

        engine.state.phase = Phase.ATTACK;
        engine.attack(0);
        expect(p2.unitZones[0].unit).toBeNull();
    });
});
