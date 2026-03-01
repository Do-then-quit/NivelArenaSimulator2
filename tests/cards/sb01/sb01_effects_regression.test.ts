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
    const engine = new GameEngine('P1', 'P2', deck1, deck2, getCard('ST01-001'), getCard('ST01-001'), { seed });
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
        .find((action: any) => action.type === type && (!predicate || predicate(action)));
}

function advanceUntil(engine: GameEngine, predicate: () => boolean, maxSteps = 30) {
    let guard = 0;
    while (!predicate() && guard < maxSteps) {
        engine.nextPhase();
        guard += 1;
    }
    expect(predicate()).toBe(true);
}

describe('SB01 Effects Regression', () => {
    it('loads SB01 effects for all 25 cards', () => {
        const uniqueIds = Array.from(new Set(DUMMY_CARDS.map(card => card.id).filter(id => id.startsWith('SB01-')))).sort();
        expect(uniqueIds).toHaveLength(25);
        uniqueIds.forEach(id => {
            const card = getCard(id);
            expect(Array.isArray(card.effects)).toBe(true);
            expect((card.effects || []).length).toBeGreaterThan(0);
        });
    });

    it('SB01-009 lane lock blocks <=4 cost and allows >4 cost in that lane', () => {
        const engine = createEngine(201009);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p2.unitZones[1].unit = getCard('SB01-009');
        p2.leaderLevel = 6;

        p1.hand = [getCard('SB01-021'), getCard('SB01-003')];
        engine.state.phase = Phase.MAIN;

        const legal = engine.getLegalActions(p1.id).filter(action => action.type === 'PLAY_UNIT') as any[];
        const canPlayLowInLockedLane = legal.some(action => action.handIndex === 0 && action.zoneIndex === 1);
        const canPlayHighInLockedLane = legal.some(action => action.handIndex === 1 && action.zoneIndex === 1);

        expect(canPlayLowInLockedLane).toBe(false);
        expect(canPlayHighInLockedLane).toBe(true);
    });

    it('SB01-010 forces block hand discard by hit difference', () => {
        const engine = createEngine(201010);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.leaderLevel = 8;
        p1.unitZones[0].unit = getCard('SB01-010');
        p2.unitZones[0].unit = getCard('ST11-005');
        p2.hand = [getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002')];

        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.ATTACK;
        engine.attack(0);

        const block = findAction(engine, p2.id, 'RESOLVE_BLOCK', (action: any) => action.shouldBlock && action.blockerZoneIndex === 0);
        expect(block).toBeDefined();
        if (block) expect(engine.step(block)).toBe(true);

        expect(engine.state.interactionMode).toBe('SELECT_COST');
        expect(engine.state.pendingEffect?.actionType).toBe('SB01_010_BLOCK_HAND_COST');

        let safety = 0;
        while (engine.state.interactionMode === 'SELECT_COST' && safety < 5) {
            const pay = findAction(engine, p2.id, 'SELECT_COST_HAND');
            expect(pay).toBeDefined();
            if (pay) expect(engine.step(pay)).toBe(true);
            safety += 1;
        }

        expect(p2.trash.length).toBeGreaterThanOrEqual(2);
    });

    it('SB01-017 defender optional lock prevents attacker in next owner turn', () => {
        const engine = createEngine(201017);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.unitZones[0].unit = getCard('ST10-005');
        p2.unitZones[1].unit = getCard('SB01-017');
        p2.hand = [getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002')];

        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.ATTACK;
        engine.attack(0);

        const guardianBlock = findAction(engine, p2.id, 'RESOLVE_BLOCK', (action: any) => action.shouldBlock && action.blockerZoneIndex === 1);
        expect(guardianBlock).toBeDefined();
        if (guardianBlock) expect(engine.step(guardianBlock)).toBe(true);

        expect(engine.state.interactionMode).toBe('SELECT_COST');
        expect(engine.state.pendingEffect?.actionType).toBe('GUARDIAN_BLOCK_COST');
        const payBarrier = findAction(engine, p2.id, 'SELECT_COST_HAND');
        expect(payBarrier).toBeDefined();
        if (payBarrier) expect(engine.step(payBarrier)).toBe(true);

        if (engine.state.interactionMode === 'SELECT_OPTIONAL') {
            const confirm =
                findAction(engine, p2.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true) ||
                findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
            expect(confirm).toBeDefined();
            if (confirm) expect(engine.step(confirm)).toBe(true);
        }
        if (engine.state.interactionMode === 'SELECT_COST') {
            const payOptional = findAction(engine, p2.id, 'SELECT_COST_HAND') || findAction(engine, p1.id, 'SELECT_COST_HAND');
            expect(payOptional).toBeDefined();
            if (payOptional) expect(engine.step(payOptional)).toBe(true);
        }

        advanceUntil(engine, () => engine.currentPlayer.id === p1.id && engine.state.phase === Phase.ATTACK, 40);
        const canAttack = engine
            .getLegalActions(p1.id)
            .some((action: any) => action.type === 'ATTACK' && action.attackerZoneIndex === 0);

        expect(canAttack).toBe(false);
    });

    it('SB01-019 passive granted defender effects trigger damage and draw', () => {
        const engine = createEngine(201019);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.unitZones[0].unit = getCard('SB01-019');
        p1.unitZones[0].buffs.push({
            id: 'sb01-019-power-buff',
            type: 'POWER',
            value: 1000,
            duration: 'PERMANENT',
        } as any);
        p1.unitZones[1].unit = getCard('ST11-005');
        p1.deck = [getCard('ST01-002')];

        p2.unitZones[1].unit = getCard('ST10-005');

        const beforeDamage = p2.damage.length;
        const beforeHand = p1.hand.length;

        engine.state.turnPlayerIndex = 1;
        engine.state.phase = Phase.ATTACK;
        engine.attack(1);

        const block = findAction(engine, p1.id, 'RESOLVE_BLOCK', (action: any) => action.shouldBlock && action.blockerZoneIndex === 1);
        expect(block).toBeDefined();
        if (block) expect(engine.step(block)).toBe(true);

        expect(p2.damage.length).toBe(beforeDamage + 1);
        expect(p1.hand.length).toBe(beforeHand + 1);
    });

    it('SB01-020 replacement can discard 1 to prevent destruction', () => {
        const engine = createEngine(201020);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.unitZones[0].unit = getCard('SB01-020');
        p1.unitZones[0].buffs.push({
            id: 'sb01-020-power-buff',
            type: 'POWER',
            value: 1000,
            duration: 'PERMANENT',
        } as any);
        p1.hand = [getCard('ST01-002')];

        p2.unitZones[0].unit = getCard('ST10-005');

        engine.destroyUnit(p1, p1.unitZones[0], p2.unitZones[0].unit!, 'EFFECT');

        expect(engine.state.interactionMode).toBe('SELECT_OPTIONAL');
        const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
        expect(confirm).toBeDefined();
        if (confirm) expect(engine.step(confirm)).toBe(true);

        expect(engine.state.interactionMode).toBe('SELECT_COST');
        const pay = findAction(engine, p1.id, 'SELECT_COST_HAND');
        expect(pay).toBeDefined();
        if (pay) expect(engine.step(pay)).toBe(true);

        expect(p1.unitZones[0].unit?.id).toBe('SB01-020');
        expect(p1.trash.some(card => card.id === 'SB01-020')).toBe(false);
    });

    it('SB01-022 aura grants armed ON_KILL discard to opponent', () => {
        const engine = createEngine(201022);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.unitZones[0].unit = getCard('SB01-022');
        p1.unitZones[1].unit = getCard('ST10-011');
        p1.unitZones[1].items = [getCard('ST10-017')];

        p2.unitZones[1].unit = getCard('ST11-006');
        p2.hand = [getCard('ST01-002'), getCard('ST01-002')];

        const beforeHand = p2.hand.length;
        const beforeTrash = p2.trash.length;

        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.ATTACK;
        engine.attack(1);

        const block = findAction(engine, p2.id, 'RESOLVE_BLOCK', (action: any) => action.shouldBlock && action.blockerZoneIndex === 1);
        expect(block).toBeDefined();
        if (block) expect(engine.step(block)).toBe(true);

        if (engine.state.interactionMode === 'SELECT_TARGET') {
            const pick = findAction(engine, p2.id, 'SELECT_HAND_TARGET');
            expect(pick).toBeDefined();
            if (pick) expect(engine.step(pick)).toBe(true);
        }

        expect(p2.hand.length).toBe(beforeHand - 1);
        expect(p2.trash.length).toBeGreaterThanOrEqual(beforeTrash + 1);
    });

    it('SB01-025 enforces minimum one selection before confirm', () => {
        const engine = createEngine(201025);
        const p1 = engine.state.players[0];

        p1.hand = [getCard('SB01-025'), getCard('ST10-017'), getCard('ST10-017')];
        p1.deck = [getCard('ST01-002'), getCard('ST01-002')];

        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.MAIN;
        engine.playSkill(0);

        expect(engine.state.interactionMode).toBe('SELECT_TARGET');

        const canConfirmWithoutSelection = engine
            .getLegalActions(p1.id)
            .some(action => action.type === 'CONFIRM_TARGETS');
        expect(canConfirmWithoutSelection).toBe(false);

        const pickItem = findAction(engine, p1.id, 'SELECT_HAND_TARGET', (action: any) => p1.hand[action.handIndex]?.type === 'ITEM');
        expect(pickItem).toBeDefined();
        if (pickItem) expect(engine.step(pickItem)).toBe(true);

        const canConfirmAfterSelection = engine
            .getLegalActions(p1.id)
            .some(action => action.type === 'CONFIRM_TARGETS');
        expect(canConfirmAfterSelection).toBe(true);
    });
});
