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

    it('SB01-007 allows choosing not to deploy and trashes revealed card', () => {
        const engine = createEngine(2010071);
        const p1 = engine.state.players[0];

        p1.unitZones[0].unit = getCard('SB01-007');
        p1.hand = [getCard('ST01-002')];
        p1.deck = [getCard('ST11-006')];

        engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');

        expect(engine.state.interactionMode).toBe('SELECT_OPTIONAL');
        const skip = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === false);
        expect(skip).toBeDefined();
        if (skip) expect(engine.step(skip)).toBe(true);

        expect(engine.state.revealedCards.length).toBe(0);
        expect(p1.unitZones.some(zone => zone.unit?.id === 'ST11-006')).toBe(false);
        expect(p1.trash.some(card => card.id === 'ST11-006')).toBe(true);
        expect(p1.deck.filter(card => card.id === 'ST11-006').length).toBe(0);
    });

    it('SB01-007 optional selection opens before revealed-cards modal', () => {
        const engine = createEngine(2010073);
        const p1 = engine.state.players[0];

        p1.unitZones[0].unit = getCard('SB01-007');
        p1.hand = [getCard('ST01-002')];
        p1.deck = [getCard('ST11-006')];

        engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');

        expect(engine.state.interactionMode).toBe('SELECT_OPTIONAL');
        expect(engine.state.revealedCards).toHaveLength(0);
    });

    it('SB01-007 treats confirmed no-selection in revealed modal as decline', () => {
        const engine = createEngine(2010074);
        const p1 = engine.state.players[0];

        p1.unitZones[0].unit = getCard('SB01-007');
        p1.hand = [getCard('ST01-002')];
        p1.deck = [getCard('ST11-006')];

        engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');

        const chooseDeploy = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
        expect(chooseDeploy).toBeDefined();
        if (chooseDeploy) expect(engine.step(chooseDeploy)).toBe(true);

        expect(engine.state.interactionMode).toBe('SELECT_TARGET');
        expect(engine.state.revealedCards.map(card => card.id)).toEqual(['ST11-006']);
        const confirmNoSelection = findAction(engine, p1.id, 'CONFIRM_TARGETS');
        expect(confirmNoSelection).toBeDefined();
        if (confirmNoSelection) expect(engine.step(confirmNoSelection)).toBe(true);

        expect(engine.state.revealedCards).toHaveLength(0);
        expect(p1.unitZones.some(zone => zone.unit?.id === 'ST11-006')).toBe(false);
        expect(p1.trash.some(card => card.id === 'ST11-006')).toBe(true);
        expect(p1.hand.some(card => card.id === 'ST01-002')).toBe(true);
    });

    it('SB01-007 deploy path requires selected hand discard and selected empty lane', () => {
        const engine = createEngine(2010072);
        const p1 = engine.state.players[0];

        p1.unitZones[0].unit = getCard('SB01-007');
        p1.unitZones[2].unit = getCard('ST11-006');
        p1.hand = [getCard('ST01-002'), getCard('SB01-004')];
        p1.deck = [getCard('ST11-006')];

        engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');

        const chooseDeploy = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
        expect(chooseDeploy).toBeDefined();
        if (chooseDeploy) expect(engine.step(chooseDeploy)).toBe(true);

        expect(engine.state.interactionMode).toBe('SELECT_TARGET');
        expect(engine.state.revealedCards.map(card => card.id)).toEqual(['ST11-006']);
        const revealedCard = findAction(engine, p1.id, 'SELECT_REVEALED_TARGET', (action: any) =>
            engine.state.revealedCards[action.revealedIndex]?.id === 'ST11-006',
        );
        expect(revealedCard).toBeDefined();
        if (revealedCard) expect(engine.step(revealedCard)).toBe(true);

        const confirmDeploy = findAction(engine, p1.id, 'CONFIRM_TARGETS');
        expect(confirmDeploy).toBeDefined();
        if (confirmDeploy) expect(engine.step(confirmDeploy)).toBe(true);

        const discard = findAction(engine, p1.id, 'SELECT_HAND_TARGET', (action: any) =>
            p1.hand[action.handIndex]?.id === 'ST01-002',
        );
        expect(discard).toBeDefined();
        if (discard) expect(engine.step(discard)).toBe(true);

        const laneActions = engine.getLegalActions(p1.id).filter(action => action.type === 'SELECT_ZONE_TARGET') as any[];
        expect(laneActions.length).toBeGreaterThan(0);
        laneActions.forEach(action => {
            expect(p1.unitZones[action.zoneIndex].unit).toBeNull();
            expect(action.targetPlayerId).toBe(p1.id);
        });

        const chooseLane1 = laneActions.find(action => action.zoneIndex === 1);
        expect(chooseLane1).toBeDefined();
        if (chooseLane1) expect(engine.step(chooseLane1)).toBe(true);

        expect(p1.trash.some(card => card.id === 'ST01-002')).toBe(true);
        expect(p1.unitZones[1].unit?.id).toBe('ST11-006');
        expect((p1.unitZones[1].unit as any)?.turnCostOverride?.cost).toBe(0);
        expect((p1.unitZones[1].unit as any)?.turnCostOverride?.turnCount).toBe(engine.state.turnCount);
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

    it('SB01-008 grants effect-trash EXIT redeploy to friendly cost<=3 units', () => {
        const engine = createEngine(201008);
        const p1 = engine.state.players[0];

        p1.unitZones[0].unit = getCard('SB01-008');
        p1.unitZones[1].unit = getCard('ST11-006');
        p1.unitZones[2].unit = getCard('ST01-002');
        p1.hand = [getCard('ST01-002')];

        engine.destroyUnit(p1, p1.unitZones[1], undefined, 'EFFECT');

        expect(engine.state.interactionMode).toBe('SELECT_OPTIONAL');
        const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
        expect(confirm).toBeDefined();
        if (confirm) expect(engine.step(confirm)).toBe(true);

        expect(engine.state.interactionMode).toBe('SELECT_COST');
        const pay = findAction(engine, p1.id, 'SELECT_COST_HAND');
        expect(pay).toBeDefined();
        if (pay) expect(engine.step(pay)).toBe(true);

        expect(p1.unitZones[1].unit?.id).toBe('ST11-006');
        expect(p1.trash.some(card => card.id === 'ST11-006')).toBe(false);
        expect(p1.trash.some(card => card.id === 'ST01-002')).toBe(true);
    });

    it('SB01-008 granted EXIT does not trigger when trashed by battle', () => {
        const engine = createEngine(2010081);
        const p1 = engine.state.players[0];

        p1.unitZones[0].unit = getCard('SB01-008');
        p1.unitZones[1].unit = getCard('ST11-006');
        p1.unitZones[2].unit = getCard('ST01-002');
        p1.hand = [getCard('ST01-002')];

        engine.destroyUnit(p1, p1.unitZones[1], undefined, 'BATTLE');

        expect(engine.state.interactionMode).toBe('NORMAL');
        const hasOptional = engine
            .getLegalActions(p1.id)
            .some(action => action.type === 'RESOLVE_OPTIONAL');
        expect(hasOptional).toBe(false);
        expect(p1.unitZones[1].unit).toBeNull();
        expect(p1.trash.some(card => card.id === 'ST11-006')).toBe(true);
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

    it('SB01-005 marked EXIT moves marked unit from its trash to its damage', () => {
        const engine = createEngine(201005);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.hand = [getCard('SB01-005')];
        p1.deck = [getCard('ST01-002')];
        p1.unitZones[1].unit = getCard('ST10-005');
        p1.unitZones[2].unit = getCard('SB01-002');
        p2.unitZones[0].unit = getCard('ST11-006');

        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.MAIN;

        engine.playSkill(0);
        const pickOpp = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) =>
            action.targetPlayerId === p2.id && action.zoneIndex === 0,
        );
        expect(pickOpp).toBeDefined();
        if (pickOpp) expect(engine.step(pickOpp)).toBe(true);

        if (engine.state.interactionMode === 'SELECT_OPTIONAL') {
            const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
            expect(confirm).toBeDefined();
            if (confirm) expect(engine.step(confirm)).toBe(true);
        }

        expect(p1.trash.some(card => card.id === 'SB01-005')).toBe(true);

        engine.destroyUnit(p2, p2.unitZones[0], undefined, 'BATTLE');

        expect(p2.trash.some(card => card.id === 'ST11-006')).toBe(false);
        expect(p2.damage.some(card => card.id === 'ST11-006')).toBe(true);
    });
});
