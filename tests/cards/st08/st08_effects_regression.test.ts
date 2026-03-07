import { describe, expect, it } from 'vitest';
import { DUMMY_CARDS } from '../../../src/logic/CardDatabase';
import { GameEngine } from '../../../src/logic/GameEngine';
import { Card, Phase } from '../../../src/logic/types';

function getCard(id: string): Card {
    const card = DUMMY_CARDS.find(entry => entry.id === id);
    if (!card) throw new Error(`Card ${id} not found`);
    return JSON.parse(JSON.stringify(card));
}

function createEngine(seed: number): GameEngine {
    const deck1 = Array.from({ length: 30 }, () => getCard('ST01-002'));
    const deck2 = Array.from({ length: 30 }, () => getCard('ST01-002'));
    const engine = new GameEngine('P1', 'P2', deck1, deck2, getCard('ST01-001'), getCard('ST01-001'), { seed });
    engine.state.turnPlayerIndex = 0;
    engine.state.phase = Phase.MAIN;
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

describe('ST08 Effects Regression', () => {
    it('ST08-002 credit exit selects exactly one hand card to trash', () => {
        const engine = createEngine(108002);
        const p1 = engine.state.players[0];

        p1.unitZones[0].unit = getCard('ST08-002');
        p1.hand = [getCard('ST01-002'), getCard('ST01-011')];

        engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');

        const handTargets = engine.getLegalActions(p1.id).filter((action: any) => action.type === 'SELECT_HAND_TARGET');
        expect(handTargets).toHaveLength(2);

        const pick = findAction(engine, p1.id, 'SELECT_HAND_TARGET', (action: any) => p1.hand[action.handIndex]?.id === 'ST01-002');
        expect(pick).toBeDefined();
        if (pick) expect(engine.step(pick)).toBe(true);

        expect(p1.trash.some(card => card.id === 'ST08-002')).toBe(true);
        expect(p1.trash.some(card => card.id === 'ST01-002')).toBe(true);
        expect(p1.hand).toHaveLength(1);
    });

    it('ST08-003 escape sends attached items to trash when unit returns to deck bottom', () => {
        const engine = createEngine(108003);
        const p1 = engine.state.players[0];

        p1.unitZones[0].unit = getCard('ST08-003');
        p1.unitZones[0].items = [getCard('ST07-017')];
        p1.leaderLevel = 2;
        engine.state.phase = Phase.DRAW;

        engine.nextPhase();

        expect(engine.state.phase).toBe(Phase.MAIN);
        expect(p1.unitZones[0].unit).toBeNull();
        expect(p1.trash.some(card => card.id === 'ST07-017')).toBe(true);
        expect(p1.deck[0]?.id).toBe('ST08-003');
        expect(p1.leaderLevel).toBe(3);
    });

    it('ST08-008 raises leader level and remains in skill zone', () => {
        const engine = createEngine(108008);
        const p1 = engine.state.players[0];

        p1.leaderLevel = 4;
        p1.hand = [getCard('ST08-008')];

        engine.playSkill(0);

        expect(p1.leaderLevel).toBe(5);
        expect(p1.skillZone.map(card => card.id)).toContain('ST08-008');
    });

    it('ST08-009 trashes a non-unit reveal instead of deploying', () => {
        const engine = createEngine(108009);
        const p1 = engine.state.players[0];

        p1.hand = [getCard('ST08-009')];
        p1.deck = [getCard('ST08-008')];

        engine.playSkill(0);

        expect(engine.state.interactionMode).toBe('NORMAL');
        expect(p1.unitZones.every(zone => zone.unit === null)).toBe(true);
        expect(p1.trash.some(card => card.id === 'ST08-008')).toBe(true);
    });

    it('ST08-010 item passively grants +1000 power to the equipped unit', () => {
        const engine = createEngine(108010);
        const p1 = engine.state.players[0];

        p1.unitZones[0].unit = getCard('ST08-003');
        p1.hand = [getCard('ST08-010')];

        const before = engine.getUnitPower(p1.unitZones[0], p1);
        engine.playItem(0, 0);
        const after = engine.getUnitPower(p1.unitZones[0], p1);

        expect(after).toBe(before + 1000);
        expect(p1.unitZones[0].items.some(card => card.id === 'ST08-010')).toBe(true);
    });

    it('ST08-011 and ST08-012 attacker buffs change combat outcomes against their intended breakpoints', () => {
        const justina = createEngine(108011);
        const p1a = justina.state.players[0];
        const p2a = justina.state.players[1];

        p1a.unitZones[0].unit = getCard('ST08-011');
        p2a.unitZones[0].unit = getCard('ST10-008');
        justina.state.phase = Phase.ATTACK;
        justina.attack(0);
        const block011 = findAction(justina, p2a.id, 'RESOLVE_BLOCK', (action: any) => action.shouldBlock && action.blockerZoneIndex === 0);
        if (block011) expect(justina.step(block011)).toBe(true);

        expect(p1a.unitZones[0].unit).not.toBeNull();
        expect(p2a.unitZones[0].unit).toBeNull();

        const eva = createEngine(108012);
        const p1b = eva.state.players[0];
        const p2b = eva.state.players[1];

        p1b.unitZones[0].unit = getCard('ST08-012');
        p2b.unitZones[0].unit = getCard('ST11-002');
        eva.state.phase = Phase.ATTACK;
        eva.attack(0);
        const block012 = findAction(eva, p2b.id, 'RESOLVE_BLOCK', (action: any) => action.shouldBlock && action.blockerZoneIndex === 0);
        if (block012) expect(eva.step(block012)).toBe(true);

        expect(p1b.unitZones[0].unit).not.toBeNull();
        expect(p2b.unitZones[0].unit).toBeNull();
    });

    it('ST08-001 awakening can hand priority to the opponent for the optional draw', () => {
        const engine = createEngine(108101);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.levelZone = getCard('ST08-001');
        p1.leaderLevel = 7;
        p1.skillZone = [getCard('ST08-015')];
        p2.deck = [getCard('ST01-002')];

        engine.checkAwakening(0);

        expect(p1.levelZone?.isAwakened).toBe(true);
        expect(engine.state.interactionMode).toBe('SELECT_OPTIONAL');
        expect(engine.state.interactionOwnerPlayerId).toBe(p2.id);

        const confirm = findAction(engine, p2.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
        expect(confirm).toBeDefined();
        if (confirm) expect(engine.step(confirm)).toBe(true);

        expect(p2.hand.some(card => card.id === 'ST01-002')).toBe(true);
    });

    it('ST08-004 deploys a hand unit to an empty zone and prevents that unit from attacking this turn', () => {
        const engine = createEngine(108104);
        const p1 = engine.state.players[0];

        p1.leaderLevel = 4;
        p1.unitZones[0].unit = getCard('ST08-004');
        p1.hand = [getCard('ST01-002')];

        engine.activateEffect(0, 0, 'UNIT');

        const pickHand = findAction(engine, p1.id, 'SELECT_HAND_TARGET', (action: any) => p1.hand[action.handIndex]?.id === 'ST01-002');
        expect(pickHand).toBeDefined();
        if (pickHand) expect(engine.step(pickHand)).toBe(true);

        const pickZone = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) => action.targetPlayerId === p1.id && action.zoneIndex === 1);
        expect(pickZone).toBeDefined();
        if (pickZone) expect(engine.step(pickZone)).toBe(true);

        expect(p1.unitZones[1].unit?.id).toBe('ST01-002');

        engine.state.phase = Phase.ATTACK;
        const canAttack = engine.getLegalActions(p1.id).some((action: any) => action.type === 'ATTACK' && action.attackerZoneIndex === 1);
        expect(canAttack).toBe(false);
    });

    it('ST08-013 credit exit needs exactly two selected hand cards before resolving', () => {
        const engine = createEngine(108113);
        const p1 = engine.state.players[0];

        p1.unitZones[0].unit = getCard('ST08-013');
        p1.hand = [getCard('ST01-002'), getCard('ST01-011'), getCard('ST07-017')];

        engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');

        const handTargets = engine.getLegalActions(p1.id).filter((action: any) => action.type === 'SELECT_HAND_TARGET');
        expect(handTargets).toHaveLength(3);

        const first = findAction(engine, p1.id, 'SELECT_HAND_TARGET', (action: any) => p1.hand[action.handIndex]?.id === 'ST01-002');
        const second = findAction(engine, p1.id, 'SELECT_HAND_TARGET', (action: any) => p1.hand[action.handIndex]?.id === 'ST01-011');
        expect(first).toBeDefined();
        expect(second).toBeDefined();
        if (first) expect(engine.step(first)).toBe(true);
        if (second) expect(engine.step(second)).toBe(true);

        const confirm = findAction(engine, p1.id, 'CONFIRM_TARGETS');
        expect(confirm).toBeDefined();
        if (confirm) expect(engine.step(confirm)).toBe(true);

        expect(p1.trash.some(card => card.id === 'ST01-002')).toBe(true);
        expect(p1.trash.some(card => card.id === 'ST01-011')).toBe(true);
        expect(p1.hand).toHaveLength(1);
    });

    it('ST08-015 only recovers 2-cost non-trigger skills when the buff target has attacker', () => {
        const engine = createEngine(108115);
        const p1 = engine.state.players[0];

        p1.unitZones[0].unit = getCard('ST08-011');
        p1.hand = [getCard('ST08-015')];
        p1.trash = [getCard('ST08-009'), getCard('ST08-004')];

        const before = engine.getUnitPower(p1.unitZones[0], p1);
        engine.playSkill(0);

        const pickUnit = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) => action.targetPlayerId === p1.id && action.zoneIndex === 0);
        expect(pickUnit).toBeDefined();
        if (pickUnit) expect(engine.step(pickUnit)).toBe(true);

        const validRecover = findAction(engine, p1.id, 'SELECT_TRASH_TARGET', (action: any) => p1.trash[action.trashIndex]?.id === 'ST08-009');
        const invalidRecover = findAction(engine, p1.id, 'SELECT_TRASH_TARGET', (action: any) => p1.trash[action.trashIndex]?.id === 'ST08-004');
        expect(validRecover).toBeDefined();
        expect(invalidRecover).toBeUndefined();
        if (validRecover) expect(engine.step(validRecover)).toBe(true);

        expect(engine.getUnitPower(p1.unitZones[0], p1)).toBe(before + 2000);
        expect(p1.hand.some(card => card.id === 'ST08-009')).toBe(true);
    });

    it('ST08-006 escape reveals 3 cards, deploys the chosen unit, and trashes the rest', () => {
        const engine = createEngine(108206);
        const p1 = engine.state.players[0];

        p1.unitZones[0].unit = getCard('ST08-006');
        p1.leaderLevel = 8;
        p1.deck = [getCard('ST08-015'), getCard('ST08-008'), getCard('ST01-002')];
        engine.state.phase = Phase.DRAW;

        engine.nextPhase();

        const pickRevealed = findAction(engine, p1.id, 'SELECT_REVEALED_TARGET', (action: any) => engine.state.revealedCards[action.revealedIndex]?.id === 'ST01-002');
        expect(pickRevealed).toBeDefined();
        if (pickRevealed) expect(engine.step(pickRevealed)).toBe(true);

        const pickZone = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) => action.targetPlayerId === p1.id && action.zoneIndex === 0);
        expect(pickZone).toBeDefined();
        if (pickZone) expect(engine.step(pickZone)).toBe(true);

        expect(p1.deck[0]?.id).toBe('ST08-006');
        expect(p1.unitZones[0].unit?.id).toBe('ST01-002');
        expect(p1.unitZones[0].unit?.turnCostOverride?.cost).toBe(0);
        expect(engine.getUnitPower(p1.unitZones[0], p1)).toBe(8000);
        expect(engine.getUnitHit(p1.unitZones[0], p1)).toBe(2);
        expect(p1.trash.some(card => card.id === 'ST08-015')).toBe(true);
        expect(p1.trash.some(card => card.id === 'ST08-008')).toBe(true);
    });

    it('ST08-006 trigger can either trash itself or stay in damage and level up', () => {
        const confirmEngine = createEngine(108261);
        const p1a = confirmEngine.state.players[0];
        p1a.deck = [getCard('ST08-006')];

        confirmEngine.dealDamage(p1a, 1);
        const confirm = findAction(confirmEngine, p1a.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
        expect(confirm).toBeDefined();
        if (confirm) expect(confirmEngine.step(confirm)).toBe(true);
        expect(p1a.trash.some(card => card.id === 'ST08-006')).toBe(true);
        expect(p1a.damage.some(card => card.id === 'ST08-006')).toBe(false);

        const skipEngine = createEngine(108262);
        const p1b = skipEngine.state.players[0];
        p1b.deck = [getCard('ST08-006')];
        p1b.leaderLevel = 4;

        skipEngine.dealDamage(p1b, 1);
        const skip = findAction(skipEngine, p1b.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === false);
        expect(skip).toBeDefined();
        if (skip) expect(skipEngine.step(skip)).toBe(true);
        expect(p1b.leaderLevel).toBe(5);
        expect(p1b.damage.some(card => card.id === 'ST08-006')).toBe(true);
    });

    it('ST08-007 escape sets a temporary reaction that punishes low-power hand deployments', () => {
        const engine = createEngine(108207);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.unitZones[0].unit = getCard('ST08-007');
        p1.deck = [getCard('ST01-002')];
        p2.hand = [getCard('ST01-002')];
        p2.deck = [getCard('ST08-015')];
        engine.state.phase = Phase.DRAW;

        engine.nextPhase();
        engine.state.turnPlayerIndex = 1;
        engine.state.phase = Phase.MAIN;
        engine.playUnit(0, 0);

        expect(p1.deck[0]?.id).toBe('ST08-007');
        expect(p1.hand.some(card => card.id === 'ST01-002')).toBe(true);
        expect(p2.damage).toHaveLength(1);
    });

    it('ST08-014 passive updates with hand size and active grants an extra attack only in attack phase', () => {
        const passiveEngine = createEngine(108214);
        const p1 = passiveEngine.state.players[0];
        p1.unitZones[0].unit = getCard('ST08-014');
        p1.hand = [getCard('ST01-002'), getCard('ST01-011'), getCard('ST08-015')];

        expect(passiveEngine.getUnitPower(p1.unitZones[0], p1)).toBe(8000);
        p1.hand.pop();
        expect(passiveEngine.getUnitPower(p1.unitZones[0], p1)).toBe(9000);

        const activeEngine = createEngine(108215);
        const p1a = activeEngine.state.players[0];
        p1a.unitZones[0].unit = getCard('ST08-014');
        p1a.hand = [];
        activeEngine.state.phase = Phase.ATTACK;

        activeEngine.activateEffect(0, 1, 'UNIT');
        expect(p1a.unitZones[0].extraAttackAllowance).toBeGreaterThanOrEqual(1);
    });

    it('ST08-016 trashes all skills in its skill zone, can deal damage at 3+, and locks itself for the turn', () => {
        const engine = createEngine(108216);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.hand = [getCard('ST08-016'), getCard('ST08-016')];
        p1.skillZone = [getCard('ST08-008'), getCard('ST08-009')];

        engine.playSkill(0);

        expect(p1.skillZone).toHaveLength(0);
        expect(p1.trash.filter(card => ['ST08-008', 'ST08-009', 'ST08-016'].includes(card.id))).toHaveLength(3);
        expect(p2.damage).toHaveLength(1);
        expect(p1.lockedSkillIdsUntilTurnEnd['ST08-016']).toBe(true);

        const replayAction = engine.getLegalActions(p1.id).find((action: any) => action.type === 'PLAY_SKILL' && p1.hand[action.handIndex]?.id === 'ST08-016');
        expect(replayAction).toBeUndefined();
    });

    it('ST08-017 attacker item uses hand-size difference to debuff the encounter unit during combat', () => {
        const engine = createEngine(108217);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.unitZones[0].unit = getCard('ST08-004');
        p1.unitZones[0].items = [getCard('ST08-017')];
        p1.hand = [getCard('ST01-002'), getCard('ST01-011'), getCard('ST08-015')];
        p2.hand = [getCard('ST01-002')];
        p2.unitZones[0].unit = getCard('ST08-006');
        engine.state.phase = Phase.ATTACK;

        engine.attack(0);
        const block = findAction(engine, p2.id, 'RESOLVE_BLOCK', (action: any) => action.shouldBlock && action.blockerZoneIndex === 0);
        expect(block).toBeDefined();
        if (block) expect(engine.step(block)).toBe(true);

        expect(p1.unitZones[0].unit).not.toBeNull();
        expect(p2.unitZones[0].unit).toBeNull();
    });
});
