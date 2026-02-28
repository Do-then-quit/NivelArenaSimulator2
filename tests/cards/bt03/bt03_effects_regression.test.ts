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
    const engine = new GameEngine('P1', 'P2', deck1, deck2, getCard('BT03-001'), getCard('ST01-001'), { seed });
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
    predicate?: (action: any) => boolean,
) {
    return engine
        .getLegalActions(actorPlayerId)
        .find(action => action.type === type && (!predicate || predicate(action)));
}

function zonePower(engine: GameEngine, player: any, zoneIndex: number): number {
    const zone = player.unitZones[zoneIndex];
    if (!zone?.unit) return 0;
    return engine.getUnitPower(zone, player);
}

describe('BT03 Effects Regression', () => {
    it('BT03-006 entry optional trashes one skill-zone card then draws 1', () => {
        const engine = createEngine(30001);
        const p1 = engine.state.players[0];

        p1.hand = [getCard('BT03-006')];
        p1.skillZone = [getCard('ST10-015')];
        p1.deck = [getCard('ST01-002')];

        engine.playUnit(0, 0);

        const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
        expect(confirm).toBeDefined();
        if (confirm) expect(engine.step(confirm)).toBe(true);

        const pickSkill = findAction(engine, p1.id, 'SELECT_REVEALED_TARGET');
        expect(pickSkill).toBeDefined();
        if (pickSkill) expect(engine.step(pickSkill)).toBe(true);

        expect(p1.skillZone.length).toBe(0);
        expect(p1.trash.some(card => card.id.startsWith('ST10-015'))).toBe(true);
        expect(p1.hand.some(card => card.id.startsWith('ST01-002'))).toBe(true);
    });

    it('BT03-008 active:main only allows cost<=2 skills for trash and grants penetration[1]', () => {
        const engine = createEngine(30002);
        const p1 = engine.state.players[0];

        p1.unitZones[0].unit = getCard('BT03-008');
        p1.skillZone = [getCard('BT03-012'), getCard('ST10-015')];
        engine.state.phase = Phase.MAIN;

        engine.activateEffect(0, 0);

        const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
        expect(confirm).toBeDefined();
        if (confirm) expect(engine.step(confirm)).toBe(true);

        const options = engine.getLegalActions(p1.id).filter(action => action.type === 'SELECT_REVEALED_TARGET') as Array<any>;
        expect(options.length).toBe(1);

        const pickSkill = options[0];
        expect(engine.step(pickSkill)).toBe(true);

        expect(p1.skillZone.every(card => !card.id.startsWith('BT03-012'))).toBe(true);
        const granted = p1.unitZones[0].temporaryEffects.some(effect =>
            effect.activation === 'ATTACKER' && String(effect.description || '').includes('관통[1]')
        );
        expect(granted).toBe(true);
    });

    it('BT03-011 active:main resolves two-step prompt (trash skill-zone skill -> recover lower-cost trash card)', () => {
        const engine = createEngine(30003);
        const p1 = engine.state.players[0];

        p1.unitZones[0].unit = getCard('BT03-011');
        p1.skillZone = [getCard('ST10-016')];
        p1.trash = [getCard('ST01-002')];
        engine.state.phase = Phase.MAIN;

        engine.activateEffect(0, 0);

        const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
        expect(confirm).toBeDefined();
        if (confirm) expect(engine.step(confirm)).toBe(true);

        const pickSkill = findAction(engine, p1.id, 'SELECT_REVEALED_TARGET');
        expect(pickSkill).toBeDefined();
        if (pickSkill) expect(engine.step(pickSkill)).toBe(true);

        const pickRecovered = findAction(engine, p1.id, 'SELECT_REVEALED_TARGET');
        expect(pickRecovered).toBeDefined();
        if (pickRecovered) expect(engine.step(pickRecovered)).toBe(true);

        expect(p1.hand.some(card => card.id.startsWith('ST01-002'))).toBe(true);
        expect(engine.state.interactionMode).toBe('NORMAL');
        expect(engine.state.revealedCards.length).toBe(0);
    });

    it('BT03-009 attacker uses discard count scaling with valuePerCard=2500', () => {
        const engine = createEngine(30004);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.unitZones[0].unit = getCard('BT03-009');
        p1.hand = [getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002')];
        p2.unitZones[0].unit = getCard('ST01-011');
        if (p2.unitZones[0].unit) p2.unitZones[0].unit.power = 12000;
        engine.state.phase = Phase.ATTACK;

        const before = zonePower(engine, p2, 0);
        engine.attack(0);

        const handTargets = engine.getLegalActions(p1.id).filter(action => action.type === 'SELECT_HAND_TARGET') as Array<any>;
        expect(handTargets.length).toBeGreaterThanOrEqual(2);
        expect(engine.step(handTargets[0])).toBe(true);
        expect(engine.step(handTargets[1])).toBe(true);

        const confirm = findAction(engine, p1.id, 'CONFIRM_TARGETS');
        expect(confirm).toBeDefined();
        if (confirm) expect(engine.step(confirm)).toBe(true);

        const after = p2.unitZones[0].unit ? zonePower(engine, p2, 0) : 0;
        expect(p1.hand.length).toBe(1);
        expect(p2.unitZones[0].unit === null || after === before - 5000).toBe(true);
    });

    it('BT03-015 uses discarded unit power as debuff amount', () => {
        const engine = createEngine(30005);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.hand = [getCard('BT03-015'), getCard('ST01-011')];
        p2.unitZones[0].unit = getCard('ST01-011');
        engine.state.phase = Phase.MAIN;

        const before = zonePower(engine, p2, 0);
        engine.playSkill(0);

        const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
        expect(confirm).toBeDefined();
        if (confirm) expect(engine.step(confirm)).toBe(true);

        const pickTarget = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) => action.targetPlayerId === p2.id && action.zoneIndex === 0);
        expect(pickTarget).toBeDefined();
        if (pickTarget) expect(engine.step(pickTarget)).toBe(true);

        const payCost = findAction(engine, p1.id, 'SELECT_COST_HAND');
        expect(payCost).toBeDefined();
        if (payCost) expect(engine.step(payCost)).toBe(true);

        const costCard = p1.trash.find(card => card.id.startsWith('ST01-011'));
        const expectedDebuff = costCard?.power || 0;
        const after = p2.unitZones[0].unit ? zonePower(engine, p2, 0) : 0;
        expect(p2.unitZones[0].unit === null || after === before - expectedDebuff).toBe(true);
    });

    it('BT03-016 follow-up optional can trash equipped visor and draw 2', () => {
        const engine = createEngine(30006);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.hand = [getCard('BT03-016')];
        p1.unitZones[0].unit = getCard('BT03-005');
        p1.deck = [getCard('ST01-002'), getCard('ST01-002')];
        p2.unitZones[0].unit = getCard('ST01-002');
        if (p2.unitZones[0].unit) p2.unitZones[0].unit.power = 1000;

        engine.playItem(0, 0);
        engine.state.phase = Phase.ATTACK;
        engine.attack(0);

        const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
        expect(confirm).toBeDefined();
        if (confirm) expect(engine.step(confirm)).toBe(true);

        const selectItem = findAction(engine, p1.id, 'SELECT_ITEM_TARGET', (action: any) => action.targetPlayerId === p1.id && action.zoneIndex === 0);
        expect(selectItem).toBeDefined();
        if (selectItem) expect(engine.step(selectItem)).toBe(true);

        expect(p1.unitZones[0].items.length).toBe(0);
        expect(p1.trash.some(card => card.id.startsWith('BT03-016'))).toBe(true);
        expect(p1.hand.length).toBeGreaterThanOrEqual(2);
    });

    it('BT03-017 active:main optional discard then sets opponent power to 3000', () => {
        const engine = createEngine(30007);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.hand = [getCard('BT03-017'), getCard('ST01-002')];
        p1.unitZones[0].unit = getCard('BT03-005');
        p2.unitZones[0].unit = getCard('ST01-011');

        engine.playItem(0, 0);
        engine.activateEffect(0, 1, 'ITEM', 0);

        const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
        expect(confirm).toBeDefined();
        if (confirm) expect(engine.step(confirm)).toBe(true);

        const pickTarget = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) => action.targetPlayerId === p2.id && action.zoneIndex === 0);
        expect(pickTarget).toBeDefined();
        if (pickTarget) expect(engine.step(pickTarget)).toBe(true);

        const payCost = findAction(engine, p1.id, 'SELECT_COST_HAND');
        expect(payCost).toBeDefined();
        if (payCost) expect(engine.step(payCost)).toBe(true);

        expect(p2.unitZones[0].unit).not.toBeNull();
        expect(zonePower(engine, p2, 0)).toBe(3000);
    });
});
