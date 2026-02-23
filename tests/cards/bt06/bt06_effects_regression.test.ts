import { describe, expect, it } from 'vitest';
import { DUMMY_CARDS } from '../../../src/logic/CardDatabase';
import { GameEngine } from '../../../src/logic/GameEngine';
import {
    ActivationCondition,
    Attribute,
    Card,
    CardType,
    Effect,
    Phase,
} from '../../../src/logic/types';

function getCard(id: string): Card {
    const card = DUMMY_CARDS.find(c => c.id === id);
    if (!card) throw new Error(`Card ${id} not found`);
    return JSON.parse(JSON.stringify(card));
}

function createEngine(seed: number): GameEngine {
    const deck1 = Array.from({ length: 30 }, () => getCard('ST01-002'));
    const deck2 = Array.from({ length: 30 }, () => getCard('ST01-002'));
    const engine = new GameEngine('P1', 'P2', deck1, deck2, getCard('BT06-001'), getCard('ST01-001'), { seed });
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

function advanceUntil(engine: GameEngine, predicate: () => boolean, maxSteps = 24) {
    let guard = 0;
    while (!predicate() && guard < maxSteps) {
        engine.nextPhase();
        guard += 1;
    }
    expect(predicate()).toBe(true);
}

function zonePower(engine: GameEngine, player: any, zoneIndex: number): number {
    const zone = player.unitZones[zoneIndex];
    if (!zone?.unit) return 0;
    return engine.getUnitPower(zone, player);
}

describe('BT06 Effects Regression', () => {
    it('BT06-001 selects a friendly unit, then selects one [ACTIVE:ATTACK] effect to execute', () => {
        const engine = createEngine(60001);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.levelZone = getCard('BT06-001');
        if (p1.levelZone) p1.levelZone.isAwakened = true;
        p1.leaderLevel = 6;
        p1.unitZones[0].unit = getCard('BT06-004');
        p1.skillZone = [getCard('ST10-015')];
        p2.unitZones[0].unit = getCard('ST01-011');
        engine.state.phase = Phase.ATTACK;

        const beforeOppPower = zonePower(engine, p2, 0);
        engine.activateEffect(0, 1, 'LEADER');

        const selectUnit = findAction(
            engine,
            p1.id,
            'SELECT_ZONE_TARGET',
            action => action.targetPlayerId === p1.id && action.zoneIndex === 0
        );
        expect(selectUnit).toBeDefined();
        if (selectUnit) expect(engine.step(selectUnit)).toBe(true);

        const selectRevealed = findAction(
            engine,
            p1.id,
            'SELECT_REVEALED_TARGET',
            action => action.revealedIndex === 0
        );
        expect(selectRevealed).toBeDefined();
        if (selectRevealed) expect(engine.step(selectRevealed)).toBe(true);

        const selectOpp = findAction(
            engine,
            p1.id,
            'SELECT_ZONE_TARGET',
            action => action.targetPlayerId === p2.id && action.zoneIndex === 0
        );
        expect(selectOpp).toBeDefined();
        if (selectOpp) expect(engine.step(selectOpp)).toBe(true);

        expect(zonePower(engine, p2, 0)).toBe(beforeOppPower - 1500);
        expect(engine.state.revealedCards.length).toBe(0);
    });

    it('BT06-001 uses only the selected option when target unit has multiple [ACTIVE:ATTACK] effects', () => {
        const engine = createEngine(60002);
        const p1 = engine.state.players[0];

        const multiActiveUnit: Card = {
            ...getCard('ST10-005'),
            id: 'BT06-TST-001',
            name: 'BT06 테스트 유닛',
            type: CardType.UNIT,
            attribute: Attribute.FIRE,
            effects: [
                {
                    activation: ActivationCondition.ACTIVE,
                    description: '테스트 액티브:어택 1',
                    condition: { type: 'CONTEXT_FLAG', value: 'PHASE_ATTACK' },
                    targets: { scope: 'SELF', type: 'UNIT', count: 1, selectMode: 'ALL' },
                    action: { type: 'BUFF_POWER', params: { value: 1000 } },
                    duration: 'TURN_END',
                },
                {
                    activation: ActivationCondition.ACTIVE,
                    description: '테스트 액티브:어택 2',
                    condition: { type: 'CONTEXT_FLAG', value: 'PHASE_ATTACK' },
                    targets: { scope: 'SELF', type: 'UNIT', count: 1, selectMode: 'ALL' },
                    action: { type: 'BUFF_POWER', params: { value: 2000 } },
                    duration: 'TURN_END',
                },
            ] as Effect[],
        };

        p1.levelZone = getCard('BT06-001');
        if (p1.levelZone) p1.levelZone.isAwakened = true;
        p1.leaderLevel = 6;
        p1.unitZones[0].unit = multiActiveUnit;
        engine.state.phase = Phase.ATTACK;

        const beforeSelfPower = zonePower(engine, p1, 0);
        engine.activateEffect(0, 1, 'LEADER');

        const selectUnit = findAction(
            engine,
            p1.id,
            'SELECT_ZONE_TARGET',
            action => action.targetPlayerId === p1.id && action.zoneIndex === 0
        );
        expect(selectUnit).toBeDefined();
        if (selectUnit) expect(engine.step(selectUnit)).toBe(true);

        const revealedActions = engine
            .getLegalActions(p1.id)
            .filter(action => action.type === 'SELECT_REVEALED_TARGET') as Array<any>;
        expect(revealedActions.length).toBe(2);

        const pickSecond = revealedActions.find(action => action.revealedIndex === 1);
        expect(pickSecond).toBeDefined();
        if (pickSecond) expect(engine.step(pickSecond)).toBe(true);

        const powerBuffSum = p1.unitZones[0].buffs
            .filter((buff: any) => buff.type === 'POWER')
            .reduce((sum: number, buff: any) => sum + buff.value, 0);

        expect(zonePower(engine, p1, 0)).toBe(beforeSelfPower + 2000);
        expect(powerBuffSum).toBe(2000);
    });

    it('BT06-005 executes follow-up only when skill selection is confirmed and keeps non-selected skill-zone cards in place', () => {
        const engine = createEngine(60003);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.hand = [getCard('BT06-005')];
        p1.skillZone = [getCard('ST10-015'), getCard('ST10-016')];
        p1.leaderLevel = 12;
        p2.unitZones[0].unit = getCard('ST01-011');
        engine.state.phase = Phase.MAIN;

        const beforeOppPower = zonePower(engine, p2, 0);
        engine.playUnit(0, 0);

        const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', action => action.confirm === true);
        expect(confirm).toBeDefined();
        if (confirm) expect(engine.step(confirm)).toBe(true);

        const pickSecondSkill = findAction(
            engine,
            p1.id,
            'SELECT_REVEALED_TARGET',
            action => action.revealedIndex === 1
        );
        expect(pickSecondSkill).toBeDefined();
        if (pickSecondSkill) expect(engine.step(pickSecondSkill)).toBe(true);

        const firstSkill = p1.skillZone[0] as any;
        const secondSkill = p1.skillZone[1] as any;

        expect(zonePower(engine, p2, 0)).toBe(beforeOppPower - 3000);
        expect(p1.skillZone.length).toBe(2);
        expect(p1.skillZone[0].id.startsWith('ST10-015')).toBe(true);
        expect(p1.skillZone[1].id.startsWith('ST10-016')).toBe(true);
        expect(firstSkill.turnCostOverride).toBeUndefined();
        expect(secondSkill.turnCostOverride?.cost).toBe(0);
        expect(secondSkill.turnCostOverride?.turnCount).toBe(engine.state.turnCount);
        expect(p1.trash.some(card => card.id.startsWith('ST10-015') || card.id.startsWith('ST10-016'))).toBe(false);
        expect(p1.deck.some(card => card.id.startsWith('ST10-015') || card.id.startsWith('ST10-016'))).toBe(false);
    });

    it('BT06-005 skip path does not apply follow-up debuff or zero-cost override', () => {
        const engine = createEngine(60004);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.hand = [getCard('BT06-005')];
        p1.skillZone = [getCard('ST10-015')];
        p2.unitZones[0].unit = getCard('ST01-011');
        engine.state.phase = Phase.MAIN;

        const beforeOppPower = zonePower(engine, p2, 0);
        engine.playUnit(0, 0);

        const skip = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', action => action.confirm === false);
        expect(skip).toBeDefined();
        if (skip) expect(engine.step(skip)).toBe(true);

        expect(zonePower(engine, p2, 0)).toBe(beforeOppPower);
        expect((p1.skillZone[0] as any).turnCostOverride).toBeUndefined();
    });

    it('BT06-011 executes draw only when skill selection is confirmed', () => {
        const engine = createEngine(60005);
        const p1 = engine.state.players[0];

        p1.hand = [getCard('BT06-011')];
        p1.skillZone = [getCard('ST10-015')];
        p1.deck = [getCard('ST01-002')];
        engine.state.phase = Phase.MAIN;

        const handBefore = p1.hand.length;
        engine.playUnit(0, 0);

        const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', action => action.confirm === true);
        expect(confirm).toBeDefined();
        if (confirm) expect(engine.step(confirm)).toBe(true);

        const pick = findAction(engine, p1.id, 'SELECT_REVEALED_TARGET', action => action.revealedIndex === 0);
        expect(pick).toBeDefined();
        if (pick) expect(engine.step(pick)).toBe(true);

        expect(p1.hand.length).toBe(handBefore);
        expect(p1.hand.some(card => card.id.startsWith('ST01-002'))).toBe(true);
        expect((p1.skillZone[0] as any).turnCostOverride?.cost).toBe(0);
    });

    it('BT06-011 skip path does not draw and does not apply zero-cost override', () => {
        const engine = createEngine(60006);
        const p1 = engine.state.players[0];

        p1.hand = [getCard('BT06-011')];
        p1.skillZone = [getCard('ST10-015')];
        p1.deck = [getCard('ST01-002')];
        engine.state.phase = Phase.MAIN;

        const handBefore = p1.hand.length;
        const deckBefore = p1.deck.length;
        engine.playUnit(0, 0);

        const skip = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', action => action.confirm === false);
        expect(skip).toBeDefined();
        if (skip) expect(engine.step(skip)).toBe(true);

        expect(p1.hand.length).toBe(handBefore - 1);
        expect(p1.deck.length).toBe(deckBefore);
        expect((p1.skillZone[0] as any).turnCostOverride).toBeUndefined();
    });

    it('BT06-011 selected skill gets 0-cost override for this turn only (play legality reflects and expires)', () => {
        const engine = createEngine(60007);
        const p1 = engine.state.players[0];

        p1.hand = [getCard('BT06-011'), getCard('ST10-016')];
        p1.skillZone = [getCard('ST10-015')];
        p1.deck = [getCard('ST01-002')];
        p1.leaderLevel = 8;
        engine.state.phase = Phase.MAIN;

        engine.playUnit(0, 0);

        const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', action => action.confirm === true);
        expect(confirm).toBeDefined();
        if (confirm) expect(engine.step(confirm)).toBe(true);

        const pick = findAction(engine, p1.id, 'SELECT_REVEALED_TARGET', action => action.revealedIndex === 0);
        expect(pick).toBeDefined();
        if (pick) expect(engine.step(pick)).toBe(true);

        const overrideTurn = engine.state.turnCount;
        const canPlayThisTurn = engine
            .getLegalActions(p1.id)
            .some(action => action.type === 'PLAY_SKILL' && p1.hand[action.handIndex]?.id.startsWith('ST10-016'));
        expect(canPlayThisTurn).toBe(true);

        advanceUntil(
            engine,
            () => engine.currentPlayer.id === p1.id && engine.state.phase === Phase.MAIN && engine.state.turnCount > overrideTurn,
            30
        );

        const canPlayNextTurn = engine
            .getLegalActions(p1.id)
            .some(action => action.type === 'PLAY_SKILL' && p1.hand[action.handIndex]?.id.startsWith('ST10-016'));
        expect(canPlayNextTurn).toBe(false);
    });

    it('PENETRATION/PLUNDER buffs honor battle-scoped duration and do not persist after combat ends', () => {
        const penetrationEngine = createEngine(60008);
        const p1a = penetrationEngine.state.players[0];
        const p2a = penetrationEngine.state.players[1];

        p1a.unitZones[0].unit = getCard('BT06-009');
        p1a.unitZones[1].unit = getCard('ST10-005');
        p2a.unitZones[0].unit = getCard('ST10-005');
        penetrationEngine.incrementTurnUnitAttackCount(p1a.id);
        penetrationEngine.state.phase = Phase.ATTACK;

        const damageBeforePenetration = p2a.damage.length;
        penetrationEngine.attack(0);

        const pickAlly = findAction(
            penetrationEngine,
            p1a.id,
            'SELECT_ZONE_TARGET',
            action => action.targetPlayerId === p1a.id && action.zoneIndex === 1
        );
        expect(pickAlly).toBeDefined();
        if (pickAlly) expect(penetrationEngine.step(pickAlly)).toBe(true);

        const blockPenetration = findAction(
            penetrationEngine,
            p2a.id,
            'RESOLVE_BLOCK',
            action => action.shouldBlock === true && action.blockerZoneIndex === 0
        );
        expect(blockPenetration).toBeDefined();
        if (blockPenetration) expect(penetrationEngine.step(blockPenetration)).toBe(true);

        expect(p2a.damage.length).toBe(damageBeforePenetration + 1);
        expect(p1a.unitZones[0].buffs.some((buff: any) => buff.type === 'PENETRATION')).toBe(false);

        const plunderEngine = createEngine(60009);
        const p1b = plunderEngine.state.players[0];
        const p2b = plunderEngine.state.players[1];

        p1b.unitZones[0].unit = getCard('BT01-006');
        p1b.deck = [getCard('ST01-002')];
        p1b.hand = [];
        p2b.unitZones[0].unit = getCard('ST10-005');
        plunderEngine.state.phase = Phase.ATTACK;

        const handBeforePlunder = p1b.hand.length;
        plunderEngine.attack(0);

        const blockPlunder = findAction(
            plunderEngine,
            p2b.id,
            'RESOLVE_BLOCK',
            action => action.shouldBlock === true && action.blockerZoneIndex === 0
        );
        expect(blockPlunder).toBeDefined();
        if (blockPlunder) expect(plunderEngine.step(blockPlunder)).toBe(true);

        expect(p1b.hand.length).toBe(handBeforePlunder + 1);
        expect(p1b.unitZones[0].buffs.some((buff: any) => buff.type === 'PLUNDER')).toBe(false);
    });
});
