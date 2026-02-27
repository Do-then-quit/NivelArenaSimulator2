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

    it('BT06-001 borrowed [ACTIVE:ATTACK] does not consume the unit activation chance (leader first)', () => {
        const engine = createEngine(60022);
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

        const selectBorrowedEffect = findAction(
            engine,
            p1.id,
            'SELECT_REVEALED_TARGET',
            action => action.revealedIndex === 0
        );
        expect(selectBorrowedEffect).toBeDefined();
        if (selectBorrowedEffect) expect(engine.step(selectBorrowedEffect)).toBe(true);

        const selectOppForBorrowed = findAction(
            engine,
            p1.id,
            'SELECT_ZONE_TARGET',
            action => action.targetPlayerId === p2.id && action.zoneIndex === 0
        );
        expect(selectOppForBorrowed).toBeDefined();
        if (selectOppForBorrowed) expect(engine.step(selectOppForBorrowed)).toBe(true);

        const unitActiveAction = findAction(
            engine,
            p1.id,
            'ACTIVATE_EFFECT',
            action => action.sourceType === 'UNIT' && action.zoneIndex === 0 && action.effectIndex === 0
        );
        expect(unitActiveAction).toBeDefined();
        if (unitActiveAction) expect(engine.step(unitActiveAction)).toBe(true);

        const selectOppForUnit = findAction(
            engine,
            p1.id,
            'SELECT_ZONE_TARGET',
            action => action.targetPlayerId === p2.id && action.zoneIndex === 0
        );
        expect(selectOppForUnit).toBeDefined();
        if (selectOppForUnit) expect(engine.step(selectOppForUnit)).toBe(true);

        expect(zonePower(engine, p2, 0)).toBe(beforeOppPower - 3000);
    });

    it('BT06-001 can borrow an [ACTIVE:ATTACK] already used by that unit (unit first)', () => {
        const engine = createEngine(60023);
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

        const firstUnitActivation = findAction(
            engine,
            p1.id,
            'ACTIVATE_EFFECT',
            action => action.sourceType === 'UNIT' && action.zoneIndex === 0 && action.effectIndex === 0
        );
        expect(firstUnitActivation).toBeDefined();
        if (firstUnitActivation) expect(engine.step(firstUnitActivation)).toBe(true);

        const selectOppForUnit = findAction(
            engine,
            p1.id,
            'SELECT_ZONE_TARGET',
            action => action.targetPlayerId === p2.id && action.zoneIndex === 0
        );
        expect(selectOppForUnit).toBeDefined();
        if (selectOppForUnit) expect(engine.step(selectOppForUnit)).toBe(true);

        const secondUnitActivation = findAction(
            engine,
            p1.id,
            'ACTIVATE_EFFECT',
            action => action.sourceType === 'UNIT' && action.zoneIndex === 0 && action.effectIndex === 0
        );
        expect(secondUnitActivation).toBeUndefined();

        engine.activateEffect(0, 1, 'LEADER');

        const selectUnit = findAction(
            engine,
            p1.id,
            'SELECT_ZONE_TARGET',
            action => action.targetPlayerId === p1.id && action.zoneIndex === 0
        );
        expect(selectUnit).toBeDefined();
        if (selectUnit) expect(engine.step(selectUnit)).toBe(true);

        const selectBorrowedEffect = findAction(
            engine,
            p1.id,
            'SELECT_REVEALED_TARGET',
            action => action.revealedIndex === 0
        );
        expect(selectBorrowedEffect).toBeDefined();
        if (selectBorrowedEffect) expect(engine.step(selectBorrowedEffect)).toBe(true);

        const selectOppForBorrowed = findAction(
            engine,
            p1.id,
            'SELECT_ZONE_TARGET',
            action => action.targetPlayerId === p2.id && action.zoneIndex === 0
        );
        expect(selectOppForBorrowed).toBeDefined();
        if (selectOppForBorrowed) expect(engine.step(selectOppForBorrowed)).toBe(true);

        expect(zonePower(engine, p2, 0)).toBe(beforeOppPower - 3000);
    });

    it('BT06-001 leader [ACTIVE:ATTACK] remains once per turn', () => {
        const engine = createEngine(60024);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.levelZone = getCard('BT06-001');
        if (p1.levelZone) p1.levelZone.isAwakened = true;
        p1.leaderLevel = 6;
        p1.unitZones[0].unit = getCard('BT06-004');
        p1.skillZone = [getCard('ST10-015')];
        p2.unitZones[0].unit = getCard('ST01-011');
        engine.state.phase = Phase.ATTACK;

        const firstLeaderActivation = findAction(
            engine,
            p1.id,
            'ACTIVATE_EFFECT',
            action => action.sourceType === 'LEADER' && action.effectIndex === 1
        );
        expect(firstLeaderActivation).toBeDefined();
        if (firstLeaderActivation) expect(engine.step(firstLeaderActivation)).toBe(true);

        const selectUnit = findAction(
            engine,
            p1.id,
            'SELECT_ZONE_TARGET',
            action => action.targetPlayerId === p1.id && action.zoneIndex === 0
        );
        expect(selectUnit).toBeDefined();
        if (selectUnit) expect(engine.step(selectUnit)).toBe(true);

        const selectBorrowedEffect = findAction(
            engine,
            p1.id,
            'SELECT_REVEALED_TARGET',
            action => action.revealedIndex === 0
        );
        expect(selectBorrowedEffect).toBeDefined();
        if (selectBorrowedEffect) expect(engine.step(selectBorrowedEffect)).toBe(true);

        const selectOppForBorrowed = findAction(
            engine,
            p1.id,
            'SELECT_ZONE_TARGET',
            action => action.targetPlayerId === p2.id && action.zoneIndex === 0
        );
        expect(selectOppForBorrowed).toBeDefined();
        if (selectOppForBorrowed) expect(engine.step(selectOppForBorrowed)).toBe(true);

        const secondLeaderActivation = findAction(
            engine,
            p1.id,
            'ACTIVATE_EFFECT',
            action => action.sourceType === 'LEADER' && action.effectIndex === 1
        );
        expect(secondLeaderActivation).toBeUndefined();
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

    it('BT06-015 passive buffs only friendly [CHAIN] units', () => {
        const engine = createEngine(60010);
        const p1 = engine.state.players[0];

        p1.unitZones[0].unit = getCard('BT06-015');
        p1.unitZones[1].unit = getCard('BT06-014');
        p1.unitZones[2].unit = getCard('ST10-005');

        const chainBase = p1.unitZones[1].unit?.power || 0;
        const nonChainBase = p1.unitZones[2].unit?.power || 0;

        expect(zonePower(engine, p1, 1)).toBe(chainBase + 1500);
        expect(zonePower(engine, p1, 2)).toBe(nonChainBase);
    });

    it('BT06-016 entry debuffs encounter and attacker buffs other friendly units', () => {
        const engine = createEngine(60011);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.hand = [getCard('BT06-016')];
        p1.unitZones[1].unit = getCard('ST10-005');
        p2.unitZones[0].unit = getCard('ST01-011');

        const encounterBefore = zonePower(engine, p2, 0);
        const allyBefore = zonePower(engine, p1, 1);

        engine.playUnit(0, 0);
        expect(zonePower(engine, p2, 0)).toBe(encounterBefore - 2000);

        engine.state.phase = Phase.ATTACK;
        engine.attack(0);
        expect(zonePower(engine, p1, 1)).toBe(allyBefore + 2000);
    });

    it('BT06-019 chain3 grants plunder[2] and draws 2 on combat trash', () => {
        const engine = createEngine(60012);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.unitZones[0].unit = getCard('BT06-019');
        p1.deck = [getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002')];
        p1.hand = [];
        p2.unitZones[0].unit = getCard('ST10-005');

        engine.incrementTurnUnitAttackCount(p1.id);
        engine.incrementTurnUnitAttackCount(p1.id);
        engine.state.phase = Phase.ATTACK;

        const handBefore = p1.hand.length;
        engine.attack(0);

        const block = findAction(
            engine,
            p2.id,
            'RESOLVE_BLOCK',
            action => action.shouldBlock === true && action.blockerZoneIndex === 0
        );
        expect(block).toBeDefined();
        if (block) expect(engine.step(block)).toBe(true);

        expect(p1.hand.length).toBe(handBefore + 2);
    });

    it('BT06-020 draws 1 only when encounter is actually trashed', () => {
        const engine = createEngine(60013);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.unitZones[0].unit = getCard('BT06-020');
        p1.deck = [getCard('ST01-002')];
        p1.hand = [];
        p2.unitZones[0].unit = getCard('ST01-002');

        engine.incrementTurnUnitAttackCount(p1.id);
        engine.state.phase = Phase.ATTACK;

        const handBefore = p1.hand.length;
        engine.attack(0);

        expect(p2.unitZones[0].unit).toBeNull();
        expect(p1.hand.length).toBe(handBefore + 1);
    });

    it('BT06-020 does not draw when destruction replacement keeps encounter alive', () => {
        const engine = createEngine(60014);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.unitZones[0].unit = getCard('BT06-020');
        p1.deck = [getCard('ST01-002')];
        p1.hand = [];

        p2.unitZones[0].unit = getCard('BT02-069');
        p2.unitZones[0].items = [getCard('ST11-017')];
        if (p2.unitZones[0].unit) p2.unitZones[0].unit.power = 3000;

        engine.incrementTurnUnitAttackCount(p1.id);
        engine.state.phase = Phase.ATTACK;

        const handBefore = p1.hand.length;
        engine.attack(0);

        const replace = findAction(
            engine,
            p2.id,
            'RESOLVE_OPTIONAL',
            action => action.confirm === true
        );
        expect(replace).toBeDefined();
        if (replace) expect(engine.step(replace)).toBe(true);

        // Replacement can still be followed by RULE trash if power remains <= 0.
        // The assertion here focuses on "no draw unless actually trashed by this effect resolution".
        expect(p1.hand.length).toBe(handBefore);
    });

    it('BT06-022 entry draws by actual trashed count only (replacement survivor not counted)', () => {
        const engine = createEngine(60015);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.hand = [getCard('BT06-022')];
        p1.deck = [getCard('ST01-002'), getCard('ST01-002')];

        p2.unitZones[0].unit = getCard('BT02-069');
        p2.unitZones[0].items = [getCard('ST11-017')];
        if (p2.unitZones[0].unit) p2.unitZones[0].unit.power = 2000;

        p2.unitZones[1].unit = getCard('ST01-002');
        if (p2.unitZones[1].unit) p2.unitZones[1].unit.power = 2000;

        const handBefore = p1.hand.length;
        engine.playUnit(0, 0);

        const replace = findAction(
            engine,
            p2.id,
            'RESOLVE_OPTIONAL',
            action => action.confirm === true
        );
        expect(replace).toBeDefined();
        if (replace) expect(engine.step(replace)).toBe(true);

        expect(p2.unitZones[1].unit).toBeNull();
        expect(p1.hand.length).toBe(handBefore);
    });

    it('BT06-022 entry draws by number of multiple trashed units', () => {
        const engine = createEngine(60016);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.hand = [getCard('BT06-022')];
        p1.deck = [getCard('ST01-002'), getCard('ST01-002')];

        p2.unitZones[0].unit = getCard('ST01-002');
        p2.unitZones[1].unit = getCard('ST01-002');
        if (p2.unitZones[0].unit) p2.unitZones[0].unit.power = 2000;
        if (p2.unitZones[1].unit) p2.unitZones[1].unit.power = 2000;

        const handBefore = p1.hand.length;
        engine.playUnit(0, 0);

        expect(p2.unitZones[0].unit).toBeNull();
        expect(p2.unitZones[1].unit).toBeNull();
        expect(p1.hand.length).toBe(handBefore + 1);
    });

    it('BT06-023 optional path: confirm draws 3 after discarding hand, skip leaves hand consumed only by play', () => {
        const confirmEngine = createEngine(60017);
        const p1a = confirmEngine.state.players[0];

        p1a.hand = [getCard('BT06-023'), getCard('ST01-002'), getCard('ST01-002')];
        p1a.deck = [getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002')];

        confirmEngine.playUnit(0, 0);
        const confirm = findAction(confirmEngine, p1a.id, 'RESOLVE_OPTIONAL', action => action.confirm === true);
        expect(confirm).toBeDefined();
        if (confirm) expect(confirmEngine.step(confirm)).toBe(true);

        expect(p1a.hand.length).toBe(3);

        const skipEngine = createEngine(60018);
        const p1b = skipEngine.state.players[0];

        p1b.hand = [getCard('BT06-023'), getCard('ST01-002'), getCard('ST01-002')];
        p1b.deck = [getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002')];

        skipEngine.playUnit(0, 0);
        const skip = findAction(skipEngine, p1b.id, 'RESOLVE_OPTIONAL', action => action.confirm === false);
        expect(skip).toBeDefined();
        if (skip) expect(skipEngine.step(skip)).toBe(true);

        expect(p1b.hand.length).toBe(2);
        expect(p1b.deck.length).toBe(3);
    });

    it('BT06-024/025 triggers return the card from damage to hand', () => {
        const e24 = createEngine(60019);
        const p124 = e24.state.players[0];
        p124.deck = [getCard('BT06-024')];
        e24.dealDamage(p124, 1);
        expect(p124.hand.some(card => card.id.startsWith('BT06-024'))).toBe(true);
        expect(p124.damage.some(card => card.id.startsWith('BT06-024'))).toBe(false);

        const e25 = createEngine(60020);
        const p125 = e25.state.players[0];
        p125.deck = [getCard('BT06-025')];
        e25.dealDamage(p125, 1);
        expect(p125.hand.some(card => card.id.startsWith('BT06-025'))).toBe(true);
        expect(p125.damage.some(card => card.id.startsWith('BT06-025'))).toBe(false);
    });

    it('BT06-027 reveals top 2, takes exactly one UNIT to hand, trashes the rest', () => {
        const engine = createEngine(60021);
        const p1 = engine.state.players[0];

        p1.hand = [getCard('BT06-027')];
        p1.deck = [getCard('ST10-015'), getCard('ST01-002')];

        engine.playSkill(0);

        const pickUnit = findAction(
            engine,
            p1.id,
            'SELECT_REVEALED_TARGET',
            action => (engine.state.revealedCards[action.revealedIndex]?.id || '').startsWith('ST01-002')
        );
        expect(pickUnit).toBeDefined();
        if (pickUnit) expect(engine.step(pickUnit)).toBe(true);

        expect(p1.hand.some(card => card.id.startsWith('ST01-002'))).toBe(true);
        expect(p1.trash.some(card => card.id.startsWith('ST10-015'))).toBe(true);
    });

    it('BT06-029 keeps selected hand cards and refills to 3 cards', () => {
        const engine = createEngine(60025);
        const p1 = engine.state.players[0];

        p1.hand = [getCard('BT06-029'), getCard('ST10-015'), getCard('ST01-002'), getCard('ST01-002')];
        p1.deck = [getCard('ST01-002'), getCard('ST01-002')];
        engine.state.phase = Phase.MAIN;

        engine.playSkill(0);

        const keep = findAction(
            engine,
            p1.id,
            'SELECT_HAND_TARGET',
            action => p1.hand[action.handIndex]?.id.startsWith('ST10-015')
        );
        expect(keep).toBeDefined();
        if (keep) expect(engine.step(keep)).toBe(true);

        const confirm = findAction(engine, p1.id, 'CONFIRM_TARGETS');
        expect(confirm).toBeDefined();
        if (confirm) expect(engine.step(confirm)).toBe(true);

        expect(p1.hand.length).toBe(3);
        expect(p1.hand.some(card => card.id.startsWith('ST10-015'))).toBe(true);
        expect(p1.trash.length).toBeGreaterThanOrEqual(2);
    });

    it('BT06-031 enforces non-trigger and power<=5000 trash filtering', () => {
        const engine = createEngine(60026);
        const p1 = engine.state.players[0];

        p1.hand = [getCard('BT06-031')];
        p1.trash = [getCard('ST01-002'), getCard('BT06-006'), getCard('BT06-010')];
        engine.state.phase = Phase.MAIN;

        engine.playSkill(0);

        const legal = engine.getLegalActions(p1.id).filter(action => action.type === 'SELECT_TRASH_TARGET') as any[];
        const selectableIds = legal.map(action => p1.trash[action.trashIndex]?.id);

        expect(selectableIds.some(id => id?.startsWith('ST01-002'))).toBe(true);
        expect(selectableIds.some(id => id?.startsWith('BT06-006'))).toBe(false);
        expect(selectableIds.some(id => id?.startsWith('BT06-010'))).toBe(false);
    });

    it('BT06-034 auto-attacks by effect and still allows the unit to attack in ATTACK phase', () => {
        const engine = createEngine(60027);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.hand = [getCard('BT06-034')];
        p1.unitZones[0].unit = getCard('BT06-002');
        p2.unitZones[0].unit = getCard('ST10-005');
        engine.state.phase = Phase.MAIN;

        engine.playSkill(0);

        const pick = findAction(
            engine,
            p1.id,
            'SELECT_ZONE_TARGET',
            action => action.targetPlayerId === p1.id && action.zoneIndex === 0
        );
        expect(pick).toBeDefined();
        if (pick) expect(engine.step(pick)).toBe(true);

        const noBlock = findAction(
            engine,
            p2.id,
            'RESOLVE_BLOCK',
            action => action.shouldBlock === false
        );
        const resolveBlock = noBlock ?? findAction(engine, p2.id, 'RESOLVE_BLOCK');
        expect(resolveBlock).toBeDefined();
        if (resolveBlock) expect(engine.step(resolveBlock)).toBe(true);

        expect(engine.state.combatStep).toBe('NONE');
        expect(engine.state.phase).toBe(Phase.MAIN);
        expect(p1.unitZones[0].attackCountThisTurn).toBe(0);
        expect(p1.unitZones[0].hasAttacked).toBe(false);

        engine.nextPhase();
        expect(engine.state.phase).toBe(Phase.ATTACK);
        const attackAgain = findAction(
            engine,
            p1.id,
            'ATTACK',
            action => action.attackerZoneIndex === 0
        );
        expect(attackAgain).toBeDefined();
    });

    it('BT06-036 locks opponent EXIT activations until end of turn and unlocks after turn passes', () => {
        const engine = createEngine(60028);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.hand = [getCard('BT06-036')];
        p2.hand = [];
        p2.trash = [getCard('ST01-002')];
        p2.unitZones[0].unit = getCard('ST01-011');
        p2.unitZones[1].unit = getCard('ST10-005');
        p2.unitZones[1].items = [getCard('BT06-042')];
        engine.state.phase = Phase.MAIN;

        engine.playSkill(0);
        const pick = findAction(
            engine,
            p1.id,
            'SELECT_ZONE_TARGET',
            action => action.targetPlayerId === p2.id && action.zoneIndex === 0
        );
        expect(pick).toBeDefined();
        if (pick) expect(engine.step(pick)).toBe(true);

        expect(p2.lockedActivationsUntilTurnEnd?.[ActivationCondition.EXIT]).toBe(true);

        engine.destroyUnit(p2, p2.unitZones[1], undefined, 'EFFECT');
        expect(p2.hand.some(card => card.id.startsWith('ST01-002'))).toBe(false);

        advanceUntil(
            engine,
            () => engine.currentPlayer.id === p2.id && engine.state.phase === Phase.MAIN,
            30
        );
        expect(p2.lockedActivationsUntilTurnEnd?.[ActivationCondition.EXIT]).not.toBe(true);
    });

    it('BT06-038 supports partial target selection up to 2 units', () => {
        const engine = createEngine(60029);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.hand = [getCard('BT06-038')];
        p2.unitZones[0].unit = getCard('ST01-011');
        p2.unitZones[1].unit = getCard('ST01-011');
        engine.state.phase = Phase.MAIN;

        const before0 = zonePower(engine, p2, 0);
        const before1 = zonePower(engine, p2, 1);

        engine.playSkill(0);

        const pick0 = findAction(
            engine,
            p1.id,
            'SELECT_ZONE_TARGET',
            action => action.targetPlayerId === p2.id && action.zoneIndex === 0
        );
        expect(pick0).toBeDefined();
        if (pick0) expect(engine.step(pick0)).toBe(true);

        const confirm = findAction(engine, p1.id, 'CONFIRM_TARGETS');
        expect(confirm).toBeDefined();
        if (confirm) expect(engine.step(confirm)).toBe(true);

        expect(zonePower(engine, p2, 0)).toBe(before0 - 3000);
        expect(zonePower(engine, p2, 1)).toBe(before1);
    });

    it('BT06-039 supports zero discard and scales with discarded count', () => {
        const zeroEngine = createEngine(60030);
        const p1a = zeroEngine.state.players[0];
        const p2a = zeroEngine.state.players[1];

        p1a.hand = [getCard('BT06-039'), getCard('ST01-002'), getCard('ST01-002')];
        p2a.unitZones[0].unit = getCard('ST01-011');
        zeroEngine.state.phase = Phase.MAIN;

        const beforeZero = zonePower(zeroEngine, p2a, 0);
        zeroEngine.playSkill(0);
        const pickZero = findAction(
            zeroEngine,
            p1a.id,
            'SELECT_ZONE_TARGET',
            action => action.targetPlayerId === p2a.id && action.zoneIndex === 0
        );
        expect(pickZero).toBeDefined();
        if (pickZero) expect(zeroEngine.step(pickZero)).toBe(true);
        const confirmZero = findAction(zeroEngine, p1a.id, 'CONFIRM_TARGETS');
        expect(confirmZero).toBeDefined();
        if (confirmZero) expect(zeroEngine.step(confirmZero)).toBe(true);
        expect(zonePower(zeroEngine, p2a, 0)).toBe(beforeZero);

        const multiEngine = createEngine(60031);
        const p1b = multiEngine.state.players[0];
        const p2b = multiEngine.state.players[1];

        p1b.hand = [getCard('BT06-039'), getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002')];
        p2b.unitZones[0].unit = getCard('ST01-011');
        multiEngine.state.phase = Phase.MAIN;

        const beforeMulti = zonePower(multiEngine, p2b, 0);
        multiEngine.playSkill(0);
        const pickMulti = findAction(
            multiEngine,
            p1b.id,
            'SELECT_ZONE_TARGET',
            action => action.targetPlayerId === p2b.id && action.zoneIndex === 0
        );
        expect(pickMulti).toBeDefined();
        if (pickMulti) expect(multiEngine.step(pickMulti)).toBe(true);

        const handActions = multiEngine.getLegalActions(p1b.id).filter(action => action.type === 'SELECT_HAND_TARGET') as any[];
        expect(handActions.length).toBeGreaterThanOrEqual(2);
        expect(multiEngine.step(handActions[0])).toBe(true);
        expect(multiEngine.step(handActions[1])).toBe(true);
        const confirmMulti = findAction(multiEngine, p1b.id, 'CONFIRM_TARGETS');
        expect(confirmMulti).toBeDefined();
        if (confirmMulti) expect(multiEngine.step(confirmMulti)).toBe(true);

        expect(zonePower(multiEngine, p2b, 0)).toBe(beforeMulti - 6000);
    });

    it('BT06-041 optional follow-up can be skipped or confirmed, and item target is limited to source-equipped copies', () => {
        const confirmEngine = createEngine(60032);
        const p1a = confirmEngine.state.players[0];
        const p2a = confirmEngine.state.players[1];

        p1a.hand = [getCard('BT06-041'), getCard('BT06-041')];
        p1a.deck = [getCard('ST01-002'), getCard('ST01-002')];
        p1a.unitZones[0].unit = getCard('ST10-005');
        p1a.unitZones[1].unit = getCard('ST10-005');
        p2a.unitZones[0].unit = getCard('ST01-002');
        if (p2a.unitZones[0].unit) p2a.unitZones[0].unit.power = 1000;
        confirmEngine.state.phase = Phase.MAIN;

        confirmEngine.playItem(0, 0);
        confirmEngine.playItem(0, 1);
        confirmEngine.state.phase = Phase.ATTACK;
        confirmEngine.attack(0);

        const confirm = findAction(confirmEngine, p1a.id, 'RESOLVE_OPTIONAL', action => action.confirm === true);
        expect(confirm).toBeDefined();
        if (confirm) expect(confirmEngine.step(confirm)).toBe(true);

        const itemActions = confirmEngine.getLegalActions(p1a.id).filter(action => action.type === 'SELECT_ITEM_TARGET') as any[];
        expect(itemActions.length).toBeGreaterThan(0);
        expect(itemActions.every(action => action.zoneIndex === 0)).toBe(true);
        expect(confirmEngine.step(itemActions[0])).toBe(true);

        expect(p1a.hand.length).toBe(2);
        expect(p1a.unitZones[0].items.length).toBe(0);
        expect(p1a.unitZones[1].items.length).toBe(1);

        const skipEngine = createEngine(60033);
        const p1b = skipEngine.state.players[0];
        const p2b = skipEngine.state.players[1];

        p1b.hand = [getCard('BT06-041')];
        p1b.deck = [getCard('ST01-002'), getCard('ST01-002')];
        p1b.unitZones[0].unit = getCard('ST10-005');
        p2b.unitZones[0].unit = getCard('ST01-002');
        if (p2b.unitZones[0].unit) p2b.unitZones[0].unit.power = 1000;
        skipEngine.state.phase = Phase.MAIN;

        skipEngine.playItem(0, 0);
        skipEngine.state.phase = Phase.ATTACK;
        skipEngine.attack(0);

        const skip = findAction(skipEngine, p1b.id, 'RESOLVE_OPTIONAL', action => action.confirm === false);
        expect(skip).toBeDefined();
        if (skip) expect(skipEngine.step(skip)).toBe(true);

        expect(p1b.hand.length).toBe(0);
        expect(p1b.unitZones[0].items.length).toBe(1);
    });

    it('BT06-042 EXIT target excludes self id and recovers <=2 cost card', () => {
        const engine = createEngine(60034);
        const p1 = engine.state.players[0];

        p1.hand = [getCard('BT06-042')];
        p1.trash = [getCard('ST01-002')];
        p1.unitZones[0].unit = getCard('ST10-005');
        engine.state.phase = Phase.MAIN;

        engine.playItem(0, 0);
        engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');

        const legal = engine.getLegalActions(p1.id).filter(action => action.type === 'SELECT_TRASH_TARGET') as any[];
        const selectableIds = legal.map(action => p1.trash[action.trashIndex]?.id);

        expect(selectableIds.some(id => id?.startsWith('ST01-002'))).toBe(true);
        expect(selectableIds.some(id => id?.startsWith('BT06-042'))).toBe(false);

        const pick = legal.find(action => p1.trash[action.trashIndex]?.id.startsWith('ST01-002'));
        expect(pick).toBeDefined();
        if (pick) expect(engine.step(pick)).toBe(true);

        expect(p1.hand.some(card => card.id.startsWith('ST01-002'))).toBe(true);
    });

    it('BT06-043 can cast a trashed skill effect or skip the cast choice', () => {
        const castEngine = createEngine(60035);
        const p1Cast = castEngine.state.players[0];

        p1Cast.levelZone = getCard('BT06-043');
        if (p1Cast.levelZone) p1Cast.levelZone.isAwakened = true;
        p1Cast.leaderLevel = 5;
        p1Cast.deck = [getCard('ST01-002'), getCard('ST01-002'), getCard('ST11-014')];
        castEngine.state.phase = Phase.MAIN;

        const beforeCastHand = p1Cast.hand.length;
        castEngine.activateEffect(0, 1, 'LEADER');
        const pick = findAction(
            castEngine,
            p1Cast.id,
            'SELECT_REVEALED_TARGET',
            action => (castEngine.state.revealedCards[action.revealedIndex]?.id || '').startsWith('ST11-014')
        );
        expect(pick).toBeDefined();
        if (pick) expect(castEngine.step(pick)).toBe(true);
        expect(p1Cast.hand.length).toBe(beforeCastHand + 2);

        const skipEngine = createEngine(60036);
        const p1Skip = skipEngine.state.players[0];

        p1Skip.levelZone = getCard('BT06-043');
        if (p1Skip.levelZone) p1Skip.levelZone.isAwakened = true;
        p1Skip.leaderLevel = 5;
        p1Skip.deck = [getCard('ST01-002'), getCard('ST01-002'), getCard('ST11-014')];
        skipEngine.state.phase = Phase.MAIN;

        const beforeSkipHand = p1Skip.hand.length;
        skipEngine.activateEffect(0, 1, 'LEADER');
        const confirmSkip = findAction(
            skipEngine,
            p1Skip.id,
            'CONFIRM_TARGETS'
        );
        expect(confirmSkip).toBeDefined();
        if (confirmSkip) expect(skipEngine.step(confirmSkip)).toBe(true);
        expect(p1Skip.hand.length).toBe(beforeSkipHand);
        expect(skipEngine.state.revealedCards.length).toBe(0);
    });

    it('BT06-046 granted DEFENDER(+2000) lasts until opponent turn end then expires', () => {
        const engine = createEngine(60037);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.unitZones[0].unit = getCard('BT06-046');
        p1.unitZones[1].unit = getCard('ST01-002');
        engine.state.phase = Phase.MAIN;

        engine.activateEffect(0, 0);
        const pick = findAction(
            engine,
            p1.id,
            'SELECT_ZONE_TARGET',
            action => action.targetPlayerId === p1.id && action.zoneIndex === 1
        );
        expect(pick).toBeDefined();
        if (pick) expect(engine.step(pick)).toBe(true);

        const grantedNow = p1.unitZones[1].temporaryEffects.some(effect =>
            effect.activation === ActivationCondition.DEFENDER &&
            effect.duration === 'OPP_TURN_END'
        );
        expect(grantedNow).toBe(true);

        advanceUntil(
            engine,
            () => engine.currentPlayer.id === p2.id && engine.state.phase === Phase.ATTACK,
            40
        );
        const stillGranted = p1.unitZones[1].temporaryEffects.some(effect => effect.activation === ActivationCondition.DEFENDER);
        expect(stillGranted).toBe(true);

        advanceUntil(
            engine,
            () => engine.currentPlayer.id === p1.id && engine.state.phase === Phase.MAIN,
            70
        );
        const removed = p1.unitZones[1].temporaryEffects.some(effect => effect.activation === ActivationCondition.DEFENDER);
        expect(removed).toBe(false);
    });

    it('BT06-048 passive removes ATTACK legal action from the unit', () => {
        const engine = createEngine(60038);
        const p1 = engine.state.players[0];

        p1.unitZones[0].unit = getCard('BT06-048');
        engine.state.phase = Phase.ATTACK;

        const canAttack = engine.getLegalActions(p1.id).some(action =>
            action.type === 'ATTACK' && action.attackerZoneIndex === 0
        );
        expect(canAttack).toBe(false);
    });

    it('BT06-051 lock blocks attack through opponent turn and is released after that turn ends', () => {
        const engine = createEngine(60039);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.hand = [getCard('BT06-051')];
        p1.leaderLevel = 10;
        p2.unitZones[0].unit = getCard('ST01-002');
        engine.state.phase = Phase.MAIN;

        engine.playUnit(0, 0);
        const lockedUntil = p2.unitZones[0].temporaryEffects.find(effect =>
            typeof effect?.action?.params?.cannotAttackUntilTurnCount === 'number'
        )?.action?.params?.cannotAttackUntilTurnCount as number | undefined;
        expect(typeof lockedUntil).toBe('number');

        advanceUntil(
            engine,
            () => engine.currentPlayer.id === p2.id && engine.state.phase === Phase.ATTACK,
            40
        );
        const canAttackWhileLocked = engine.getLegalActions(p2.id).some(action =>
            action.type === 'ATTACK' && action.attackerZoneIndex === 0
        );
        expect(canAttackWhileLocked).toBe(false);

        advanceUntil(
            engine,
            () =>
                engine.currentPlayer.id === p2.id &&
                engine.state.phase === Phase.ATTACK &&
                typeof lockedUntil === 'number' &&
                engine.state.turnCount > lockedUntil,
            90
        );
        const canAttackAfterRelease = engine.getLegalActions(p2.id).some(action =>
            action.type === 'ATTACK' && action.attackerZoneIndex === 0
        );
        expect(canAttackAfterRelease).toBe(true);
    });

    it('BT06-053 zero-cost selection is filtered to <=3 cost skills in skill zone', () => {
        const engine = createEngine(60040);
        const p1 = engine.state.players[0];

        p1.hand = [getCard('BT06-053')];
        p1.skillZone = [getCard('ST11-014'), getCard('ST10-015')];
        p1.leaderLevel = 10;
        engine.state.phase = Phase.MAIN;

        engine.playUnit(0, 0);
        const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', action => action.confirm === true);
        expect(confirm).toBeDefined();
        if (confirm) expect(engine.step(confirm)).toBe(true);

        expect(engine.state.revealedCards.length).toBe(1);
        const pick = findAction(engine, p1.id, 'SELECT_REVEALED_TARGET');
        expect(pick).toBeDefined();
        if (pick) expect(engine.step(pick)).toBe(true);

        const lowCost = p1.skillZone.find(card => card.id.startsWith('ST11-014')) as any;
        const highCost = p1.skillZone.find(card => card.id.startsWith('ST10-015')) as any;
        expect(lowCost?.turnCostOverride?.cost).toBe(0);
        expect(lowCost?.turnCostOverride?.turnCount).toBe(engine.state.turnCount);
        expect(highCost?.turnCostOverride).toBeUndefined();
    });

    it('BT06-054 DRAWN passive triggers on opponent non-trigger effect draw once per turn and resets next turn', () => {
        const engine = createEngine(60041);
        const p1 = engine.state.players[0];

        p1.unitZones[0].unit = getCard('BT06-054');
        p1.deck = Array.from({ length: 10 }, () => getCard('ST01-002'));
        engine.state.phase = Phase.MAIN;

        const before = p1.hand.length;

        engine.drawCard(1, 1, { reason: 'EFFECT', sourceActivation: ActivationCondition.ACTIVE });
        expect(p1.hand.length).toBe(before + 1);

        engine.drawCard(1, 1, { reason: 'EFFECT', sourceActivation: ActivationCondition.ACTIVE });
        expect(p1.hand.length).toBe(before + 1);

        advanceUntil(
            engine,
            () => engine.currentPlayer.id === engine.state.players[1].id && engine.state.phase === Phase.MAIN,
            40
        );

        engine.drawCard(1, 1, { reason: 'EFFECT', sourceActivation: ActivationCondition.ACTIVE });
        expect(p1.hand.length).toBe(before + 2);
    });

    it('BT06-054 DRAWN passive does not trigger on rule draw or trigger-effect draw', () => {
        const engine = createEngine(60042);
        const p1 = engine.state.players[0];

        p1.unitZones[0].unit = getCard('BT06-054');
        p1.deck = Array.from({ length: 10 }, () => getCard('ST01-002'));
        engine.state.phase = Phase.MAIN;

        const before = p1.hand.length;

        engine.drawCard(1, 1);
        engine.drawCard(1, 1, { reason: 'EFFECT', sourceActivation: ActivationCondition.DAMAGE_TRIGGER });

        expect(p1.hand.length).toBe(before);
    });

    it('BT06-056 selects 2 defenders, deals 1 damage, and locks those units from attacking this turn', () => {
        const engine = createEngine(60043);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.unitZones[0].unit = getCard('BT06-056');
        p1.skillZone = [getCard('ST11-014')];
        p1.unitZones[1].unit = getCard('BT06-050');
        p1.unitZones[2].unit = getCard('BT06-048');
        p2.damage = [];
        engine.state.phase = Phase.MAIN;

        engine.activateEffect(0, 0);

        const pick1 = findAction(
            engine,
            p1.id,
            'SELECT_ZONE_TARGET',
            action => action.targetPlayerId === p1.id && action.zoneIndex === 1
        );
        const pick2 = findAction(
            engine,
            p1.id,
            'SELECT_ZONE_TARGET',
            action => action.targetPlayerId === p1.id && action.zoneIndex === 2
        );
        expect(pick1).toBeDefined();
        expect(pick2).toBeDefined();
        if (pick1) expect(engine.step(pick1)).toBe(true);
        if (pick2) expect(engine.step(pick2)).toBe(true);

        const confirm = findAction(engine, p1.id, 'CONFIRM_TARGETS');
        expect(confirm).toBeDefined();
        if (confirm) expect(engine.step(confirm)).toBe(true);

        expect(p2.damage.length).toBe(1);

        engine.state.phase = Phase.ATTACK;
        const canAttack1 = engine.getLegalActions(p1.id).some(action =>
            action.type === 'ATTACK' && action.attackerZoneIndex === 1
        );
        const canAttack2 = engine.getLegalActions(p1.id).some(action =>
            action.type === 'ATTACK' && action.attackerZoneIndex === 2
        );
        expect(canAttack1).toBe(false);
        expect(canAttack2).toBe(false);
    });

    it('BT06-062 confirm clears revealed prompt state and resolves once', () => {
        const engine = createEngine(60044);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        const skillA = getCard('ST11-014');
        skillA.id = 'BT06-062-R-A';
        skillA.name = 'BT06-062 R A';
        const skillB = getCard('ST10-015');
        skillB.id = 'BT06-062-R-B';
        skillB.name = 'BT06-062 R B';
        const skillC = getCard('ST11-013');
        skillC.id = 'BT06-062-R-C';
        skillC.name = 'BT06-062 R C';

        p1.unitZones[0].unit = getCard('BT06-062');
        p1.skillZone = [getCard('ST10-015'), getCard('ST11-014')];
        p1.trash = [skillA, skillB, skillC];
        p1.deck = [getCard('ST01-002')];
        p2.damage = [];
        engine.state.phase = Phase.MAIN;

        engine.activateEffect(0, 1);
        expect(engine.state.revealedCards.length).toBe(3);

        const pickA = findAction(
            engine,
            p1.id,
            'SELECT_REVEALED_TARGET',
            action => engine.state.revealedCards[action.revealedIndex]?.id === 'BT06-062-R-A'
        );
        const pickB = findAction(
            engine,
            p1.id,
            'SELECT_REVEALED_TARGET',
            action => engine.state.revealedCards[action.revealedIndex]?.id === 'BT06-062-R-B'
        );
        const pickC = findAction(
            engine,
            p1.id,
            'SELECT_REVEALED_TARGET',
            action => engine.state.revealedCards[action.revealedIndex]?.id === 'BT06-062-R-C'
        );
        expect(pickA).toBeDefined();
        expect(pickB).toBeDefined();
        expect(pickC).toBeDefined();
        if (pickA) expect(engine.step(pickA)).toBe(true);
        if (pickB) expect(engine.step(pickB)).toBe(true);
        if (pickC) expect(engine.step(pickC)).toBe(true);

        const confirm = findAction(engine, p1.id, 'CONFIRM_TARGETS');
        expect(confirm).toBeDefined();
        if (confirm) expect(engine.step(confirm)).toBe(true);

        expect(p2.damage.length).toBe(2);
        expect(engine.state.revealedCards.length).toBe(0);
        expect(engine.state.interactionMode).toBe('NORMAL');
        expect(engine.state.pendingEffect).toBeNull();
    });

});
