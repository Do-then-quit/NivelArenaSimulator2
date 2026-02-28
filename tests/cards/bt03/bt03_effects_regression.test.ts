import { describe, expect, it } from 'vitest';
import { DUMMY_CARDS } from '../../../src/logic/CardDatabase';
import { GameEngine } from '../../../src/logic/GameEngine';
import { RuleValidator } from '../../../src/logic/RuleValidator';
import { ActivationCondition, Card, Phase } from '../../../src/logic/types';

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

function zoneHit(engine: GameEngine, player: any, zoneIndex: number): number {
    const zone = player.unitZones[zoneIndex];
    if (!zone?.unit) return 0;
    return engine.getUnitHit(zone, player);
}

function advanceUntil(engine: GameEngine, predicate: () => boolean, maxSteps = 24) {
    for (let i = 0; i < maxSteps; i++) {
        if (predicate()) return;
        const next = findAction(engine, engine.currentPlayer.id, 'NEXT_PHASE');
        expect(next).toBeDefined();
        if (!next) return;
        expect(engine.step(next)).toBe(true);
    }
    throw new Error('advanceUntil exceeded maxSteps');
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

    it('BT03-024 uses current effective hit total (including buffs) of other friendly units', () => {
        const engine = createEngine(30008);
        const p1 = engine.state.players[0];

        p1.unitZones[0].unit = getCard('BT03-024');
        p1.unitZones[1].unit = getCard('ST01-002');
        p1.unitZones[2].unit = getCard('ST01-002');
        p1.unitZones[1].buffs.push({
            id: 'BT03_024_TEST_HIT_BUFF',
            type: 'HIT',
            value: 2,
            duration: 'TURN_END',
        } as any);

        const base = p1.unitZones[0].unit?.power || 0;
        const withBuffTotalHit = zoneHit(engine, p1, 1) + zoneHit(engine, p1, 2);
        expect(zonePower(engine, p1, 0)).toBe(base + withBuffTotalHit * 1000);

        p1.unitZones[1].buffs = [];
        const withoutBuffTotalHit = zoneHit(engine, p1, 1) + zoneHit(engine, p1, 2);
        expect(zonePower(engine, p1, 0)).toBe(base + withoutBuffTotalHit * 1000);
    });

    it('BT03-025 branch is mutually exclusive (level up OR draw)', () => {
        const lowLevelEngine = createEngine(30009);
        const p1Low = lowLevelEngine.state.players[0];
        p1Low.leaderLevel = 9;
        p1Low.hand = [getCard('BT03-025')];
        p1Low.deck = [getCard('ST01-002')];
        lowLevelEngine.playUnit(0, 0);
        expect(p1Low.leaderLevel).toBe(10);
        expect(p1Low.hand.some(card => card.id.startsWith('ST01-002'))).toBe(false);

        const highLevelEngine = createEngine(30010);
        const p1High = highLevelEngine.state.players[0];
        p1High.leaderLevel = 10;
        p1High.hand = [getCard('BT03-025')];
        p1High.deck = [getCard('ST01-002')];
        highLevelEngine.playUnit(0, 0);
        expect(p1High.leaderLevel).toBe(10);
        expect(p1High.hand.some(card => card.id.startsWith('ST01-002'))).toBe(true);
    });

    it('BT03-027 threshold boundary works at 3499/3500', () => {
        const belowEngine = createEngine(30011);
        const p1Below = belowEngine.state.players[0];
        const p2Below = belowEngine.state.players[1];
        p1Below.unitZones[0].unit = getCard('BT03-027');
        p2Below.unitZones[0].unit = getCard('ST01-011');
        if (p2Below.unitZones[0].unit) p2Below.unitZones[0].unit.power = 3501;
        belowEngine.activateEffect(0, 0);
        const belowGranted = p1Below.unitZones[0].temporaryEffects.some(effect =>
            effect.activation === 'ATTACKER' && String(effect.description || '').includes('관통[1]')
        );
        expect(belowGranted).toBe(false);

        const atEngine = createEngine(30012);
        const p1At = atEngine.state.players[0];
        const p2At = atEngine.state.players[1];
        p1At.unitZones[0].unit = getCard('BT03-027');
        p2At.unitZones[0].unit = getCard('ST01-011');
        if (p2At.unitZones[0].unit) p2At.unitZones[0].unit.power = 3500;
        atEngine.activateEffect(0, 0);
        const atGranted = p1At.unitZones[0].temporaryEffects.some(effect =>
            effect.activation === 'ATTACKER' && String(effect.description || '').includes('관통[1]')
        );
        expect(atGranted).toBe(true);
    });

    it('BT03-030 draw threshold triggers only when low-cost unit count is at least 3', () => {
        const twoUnitEngine = createEngine(30013);
        const p1Two = twoUnitEngine.state.players[0];
        p1Two.hand = [getCard('BT03-030')];
        p1Two.deck = [getCard('ST01-002')];
        p1Two.unitZones[0].unit = getCard('BT03-019');
        p1Two.unitZones[1].unit = getCard('ST01-002');
        twoUnitEngine.playSkill(0);
        expect(p1Two.hand.some(card => card.id.startsWith('ST01-002'))).toBe(false);
        expect(zoneHit(twoUnitEngine, p1Two, 0)).toBe((p1Two.unitZones[0].unit?.hit || 0) + 1);
        expect(zoneHit(twoUnitEngine, p1Two, 1)).toBe((p1Two.unitZones[1].unit?.hit || 0) + 1);

        const threeUnitEngine = createEngine(30014);
        const p1Three = threeUnitEngine.state.players[0];
        p1Three.hand = [getCard('BT03-030')];
        p1Three.deck = [getCard('ST01-002')];
        p1Three.unitZones[0].unit = getCard('BT03-019');
        p1Three.unitZones[1].unit = getCard('ST01-002');
        p1Three.unitZones[2].unit = getCard('BT03-020');
        threeUnitEngine.playSkill(0);
        expect(p1Three.hand.some(card => card.id.startsWith('ST01-002'))).toBe(true);
    });

    it('BT03-032 bonus hit threshold triggers only when low-cost unit count is at least 3', () => {
        const twoUnitEngine = createEngine(30015);
        const p1Two = twoUnitEngine.state.players[0];
        p1Two.hand = [getCard('BT03-032')];
        p1Two.unitZones[0].unit = getCard('BT03-019');
        p1Two.unitZones[1].unit = getCard('ST01-002');
        const twoPower0Before = zonePower(twoUnitEngine, p1Two, 0);
        const twoPower1Before = zonePower(twoUnitEngine, p1Two, 1);
        const twoHit0Before = zoneHit(twoUnitEngine, p1Two, 0);
        const twoHit1Before = zoneHit(twoUnitEngine, p1Two, 1);
        twoUnitEngine.playSkill(0);
        expect(zoneHit(twoUnitEngine, p1Two, 0)).toBe(twoHit0Before);
        expect(zoneHit(twoUnitEngine, p1Two, 1)).toBe(twoHit1Before);
        expect(zonePower(twoUnitEngine, p1Two, 0)).toBe(twoPower0Before + 5000);
        expect(zonePower(twoUnitEngine, p1Two, 1)).toBe(twoPower1Before + 5000);

        const threeUnitEngine = createEngine(30016);
        const p1Three = threeUnitEngine.state.players[0];
        p1Three.hand = [getCard('BT03-032')];
        p1Three.unitZones[0].unit = getCard('BT03-019');
        p1Three.unitZones[1].unit = getCard('ST01-002');
        p1Three.unitZones[2].unit = getCard('BT03-020');
        const threeHit0Before = zoneHit(threeUnitEngine, p1Three, 0);
        const threeHit1Before = zoneHit(threeUnitEngine, p1Three, 1);
        const threeHit2Before = zoneHit(threeUnitEngine, p1Three, 2);
        threeUnitEngine.playSkill(0);
        expect(zoneHit(threeUnitEngine, p1Three, 0)).toBe(threeHit0Before + 1);
        expect(zoneHit(threeUnitEngine, p1Three, 1)).toBe(threeHit1Before + 1);
        expect(zoneHit(threeUnitEngine, p1Three, 2)).toBe(threeHit2Before + 1);
    });

    it('BT03-031 handles no-encounter/equal/greater/less power comparisons correctly', () => {
        const noEncounter = createEngine(30017);
        const p1No = noEncounter.state.players[0];
        p1No.hand = [getCard('BT03-031')];
        p1No.unitZones[0].unit = getCard('ST01-002');
        noEncounter.playSkill(0);
        const pickNo = findAction(noEncounter, p1No.id, 'SELECT_ZONE_TARGET', (action: any) => action.targetPlayerId === p1No.id && action.zoneIndex === 0);
        expect(pickNo).toBeDefined();
        if (pickNo) expect(noEncounter.step(pickNo)).toBe(true);
        expect(noEncounter.state.players[1].unitZones[0].unit).toBeNull();

        const equal = createEngine(30018);
        const p1Eq = equal.state.players[0];
        const p2Eq = equal.state.players[1];
        p1Eq.hand = [getCard('BT03-031')];
        p1Eq.unitZones[0].unit = getCard('ST01-002');
        p2Eq.unitZones[0].unit = getCard('ST01-002');
        if (p1Eq.unitZones[0].unit) p1Eq.unitZones[0].unit.power = 5000;
        if (p2Eq.unitZones[0].unit) p2Eq.unitZones[0].unit.power = 5000;
        equal.playSkill(0);
        const pickEq = findAction(equal, p1Eq.id, 'SELECT_ZONE_TARGET', (action: any) => action.targetPlayerId === p1Eq.id && action.zoneIndex === 0);
        expect(pickEq).toBeDefined();
        if (pickEq) expect(equal.step(pickEq)).toBe(true);
        expect(p2Eq.unitZones[0].unit).not.toBeNull();

        const greater = createEngine(30019);
        const p1Gt = greater.state.players[0];
        const p2Gt = greater.state.players[1];
        p1Gt.hand = [getCard('BT03-031')];
        p1Gt.unitZones[0].unit = getCard('ST01-002');
        p2Gt.unitZones[0].unit = getCard('ST01-002');
        if (p1Gt.unitZones[0].unit) p1Gt.unitZones[0].unit.power = 6000;
        if (p2Gt.unitZones[0].unit) p2Gt.unitZones[0].unit.power = 5000;
        greater.playSkill(0);
        const pickGt = findAction(greater, p1Gt.id, 'SELECT_ZONE_TARGET', (action: any) => action.targetPlayerId === p1Gt.id && action.zoneIndex === 0);
        expect(pickGt).toBeDefined();
        if (pickGt) expect(greater.step(pickGt)).toBe(true);
        expect(p2Gt.unitZones[0].unit).toBeNull();

        const less = createEngine(30020);
        const p1Lt = less.state.players[0];
        const p2Lt = less.state.players[1];
        p1Lt.hand = [getCard('BT03-031')];
        p1Lt.unitZones[0].unit = getCard('ST01-002');
        p2Lt.unitZones[0].unit = getCard('ST01-002');
        if (p1Lt.unitZones[0].unit) p1Lt.unitZones[0].unit.power = 4000;
        if (p2Lt.unitZones[0].unit) p2Lt.unitZones[0].unit.power = 5000;
        less.playSkill(0);
        const pickLt = findAction(less, p1Lt.id, 'SELECT_ZONE_TARGET', (action: any) => action.targetPlayerId === p1Lt.id && action.zoneIndex === 0);
        expect(pickLt).toBeDefined();
        if (pickLt) expect(less.step(pickLt)).toBe(true);
        expect(p2Lt.unitZones[0].unit).not.toBeNull();
    });

    it('BT03-033 size bonus stacks per equipped copy and affects canPlayUnit validation', () => {
        const engine = createEngine(30021);
        const p1 = engine.state.players[0];
        p1.leaderLevel = 5;
        p1.unitZones[0].unit = getCard('BT03-025');
        p1.hand = [getCard('BT03-026')];

        const beforeSize = engine.getPlayerSize(p1);
        expect(beforeSize).toBe(5);
        expect(RuleValidator.canPlayUnit(engine, p1, 0, 1).valid).toBe(false);

        p1.unitZones[0].items = [
            getCard('BT03-033'),
            getCard('BT03-033'),
            getCard('BT03-033'),
            getCard('BT03-033'),
            getCard('BT03-033'),
            getCard('BT03-033'),
        ];

        const afterSize = engine.getPlayerSize(p1);
        expect(afterSize).toBe(11);
        expect(RuleValidator.canPlayUnit(engine, p1, 0, 1).valid).toBe(true);
    });

    it('BT03-040 triggers discard-to-4 only for non-trigger effect draws', () => {
        const nonTrigger = createEngine(30022);
        const p1Non = nonTrigger.state.players[0];
        const p2Non = nonTrigger.state.players[1];
        p1Non.unitZones[0].unit = getCard('BT03-040');
        p2Non.hand = [
            getCard('ST01-002'),
            getCard('ST01-002'),
            getCard('ST01-002'),
            getCard('ST01-002'),
            getCard('ST01-002'),
        ];
        p2Non.deck = [getCard('ST01-002')];

        nonTrigger.drawCard(1, 1, {
            reason: 'EFFECT',
            sourceActivation: 'ACTIVE' as any,
            sourcePlayerId: p2Non.id,
            sourceCardId: 'BT03_040_NON_TRIGGER',
        });

        expect(nonTrigger.state.interactionMode).toBe('SELECT_TARGET');
        expect(nonTrigger.state.pendingEffect?.actionType).toBe('BT03_040_OPP_SELECT_HAND_TO_TRASH');
        const discardCandidates = nonTrigger
            .getLegalActions(p2Non.id)
            .filter(action => action.type === 'SELECT_HAND_TARGET' && (action as any).targetPlayerId === p2Non.id) as Array<any>;
        expect(discardCandidates.length).toBeGreaterThanOrEqual(2);
        expect(nonTrigger.step(discardCandidates[0])).toBe(true);
        expect(nonTrigger.step(discardCandidates[1])).toBe(true);
        const confirm = findAction(nonTrigger, p2Non.id, 'CONFIRM_TARGETS');
        expect(confirm).toBeDefined();
        if (confirm) expect(nonTrigger.step(confirm)).toBe(true);
        expect(p2Non.hand.length).toBe(4);

        const triggerDraw = createEngine(30023);
        const p1Trig = triggerDraw.state.players[0];
        const p2Trig = triggerDraw.state.players[1];
        p1Trig.unitZones[0].unit = getCard('BT03-040');
        p2Trig.hand = [
            getCard('ST01-002'),
            getCard('ST01-002'),
            getCard('ST01-002'),
            getCard('ST01-002'),
            getCard('ST01-002'),
        ];
        p2Trig.deck = [getCard('ST01-002')];

        triggerDraw.drawCard(1, 1, {
            reason: 'EFFECT',
            sourceActivation: 'DAMAGE_TRIGGER' as any,
            sourcePlayerId: p2Trig.id,
            sourceCardId: 'BT03_040_TRIGGER',
        });

        expect(triggerDraw.state.pendingEffect).toBeNull();
        expect(triggerDraw.state.interactionMode).toBe('NORMAL');
        expect(p2Trig.hand.length).toBe(6);
    });

    it('BT03-041 guardian sacrifice cost gates blocking and revive buff expires at end of owner turn', () => {
        const cannotBlock = createEngine(30024);
        const p1No = cannotBlock.state.players[0];
        const p2No = cannotBlock.state.players[1];
        cannotBlock.state.phase = Phase.ATTACK;
        p1No.unitZones[1].unit = getCard('ST01-011');
        p2No.unitZones[0].unit = getCard('BT03-041');
        cannotBlock.attack(1);
        const noBlockActions = cannotBlock
            .getLegalActions(p2No.id)
            .filter(action => action.type === 'RESOLVE_BLOCK' && (action as any).shouldBlock === true) as Array<any>;
        expect(noBlockActions.length).toBe(0);

        const canBlock = createEngine(30025);
        const p1Yes = canBlock.state.players[0];
        const p2Yes = canBlock.state.players[1];
        canBlock.state.phase = Phase.ATTACK;
        p1Yes.unitZones[1].unit = getCard('ST01-011');
        p2Yes.unitZones[0].unit = getCard('BT03-041');
        p2Yes.unitZones[1].unit = getCard('ST01-002');
        p2Yes.unitZones[2].unit = getCard('ST01-002');
        canBlock.attack(1);
        const declareBlock = findAction(canBlock, p2Yes.id, 'RESOLVE_BLOCK', (action: any) =>
            action.shouldBlock === true && action.blockerZoneIndex === 0
        );
        expect(declareBlock).toBeDefined();
        if (declareBlock) expect(canBlock.step(declareBlock)).toBe(true);
        expect(canBlock.state.pendingEffect?.actionType).toBe('GUARDIAN_BLOCK_UNIT_COST');

        const selectSacrifice = findAction(canBlock, p2Yes.id, 'SELECT_ZONE_TARGET', (action: any) =>
            action.targetPlayerId === p2Yes.id && action.zoneIndex === 2
        );
        expect(selectSacrifice).toBeDefined();
        if (selectSacrifice) expect(canBlock.step(selectSacrifice)).toBe(true);
        expect(canBlock.state.combatBlocked).toBe(true);
        expect(canBlock.state.pendingBlockerZoneIndex).toBe(0);
        expect(p2Yes.unitZones[2].unit).toBeNull();
        expect(p2Yes.trash.some(card => card.id.startsWith('ST01-002'))).toBe(true);

        const revive = createEngine(30026);
        const p1Revive = revive.state.players[0];
        revive.state.turnPlayerIndex = 1; // opponent turn
        revive.state.phase = Phase.ATTACK;
        p1Revive.unitZones[0].unit = getCard('BT03-041');
        p1Revive.hand = [getCard('BT03-038')];
        revive.destroyUnit(p1Revive, p1Revive.unitZones[0], undefined, 'EFFECT');

        const confirmRevive = findAction(revive, p1Revive.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
        expect(confirmRevive).toBeDefined();
        if (confirmRevive) expect(revive.step(confirmRevive)).toBe(true);
        const pickHandExit = findAction(revive, p1Revive.id, 'SELECT_REVEALED_TARGET');
        expect(pickHandExit).toBeDefined();
        if (pickHandExit) expect(revive.step(pickHandExit)).toBe(true);
        const pickEmpty = findAction(revive, p1Revive.id, 'SELECT_ZONE_TARGET', (action: any) =>
            action.targetPlayerId === p1Revive.id && action.zoneIndex === 1
        );
        expect(pickEmpty).toBeDefined();
        if (pickEmpty) expect(revive.step(pickEmpty)).toBe(true);

        expect(p1Revive.unitZones[1].unit?.id.startsWith('BT03-041')).toBe(true);
        const revivedPower = zonePower(revive, p1Revive, 1);
        const basePower = p1Revive.unitZones[1].unit?.power || 0;
        expect(revivedPower).toBe(basePower + 2500);

        // End opponent turn then owner turn: buff should expire at end of owner's turn.
        revive.state.phase = Phase.END;
        revive.nextPhase();
        revive.state.phase = Phase.END;
        revive.nextPhase();
        expect(zonePower(revive, p1Revive, 1)).toBe(basePower);
    });

    it('BT03-042 reflects same-turn opponent hand trash-by-effect count', () => {
        const engine = createEngine(30027);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];
        p1.unitZones[0].unit = getCard('BT03-042');
        p2.hand = [getCard('ST01-002')];

        const before = zonePower(engine, p1, 0);
        const [trashed] = p2.hand.splice(0, 1);
        p2.trash.push(trashed);
        engine.notifyHandTrashed(p2, [trashed], { flags: { handTrashByEffect: true } });
        const after = zonePower(engine, p1, 0);
        expect(after).toBe(before + 2500);
    });

    it('BT03-049 uses selected unit current effective power snapshot then trashes selected unit', () => {
        const engine = createEngine(30028);
        const p1 = engine.state.players[0];
        p1.hand = [getCard('BT03-049')];
        p1.unitZones[0].unit = getCard('BT03-024');
        p1.unitZones[1].unit = getCard('ST01-002');
        p1.unitZones[2].unit = getCard('ST01-002');
        p1.unitZones[0].buffs.push({
            id: 'BT03_049_SNAPSHOT',
            type: 'POWER',
            value: 1000,
            duration: 'TURN_END',
        } as any);

        const expectedSnapshot = zonePower(engine, p1, 0);
        const before1 = zonePower(engine, p1, 1);
        const before2 = zonePower(engine, p1, 2);

        engine.playSkill(0);
        const select = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) =>
            action.targetPlayerId === p1.id && action.zoneIndex === 0
        );
        expect(select).toBeDefined();
        if (select) expect(engine.step(select)).toBe(true);

        expect(p1.unitZones[0].unit).toBeNull();
        expect(zonePower(engine, p1, 1)).toBe(before1 + expectedSnapshot);
        expect(zonePower(engine, p1, 2)).toBe(before2 + expectedSnapshot);
    });

    it('BT03-051 supports multi-exit prompt selection and copied exit effect triggers', () => {
        const engine = createEngine(30029);
        const p1 = engine.state.players[0];
        p1.leaderLevel = 8;
        p1.hand = [getCard('BT03-051')];
        p1.unitZones[0].unit = getCard('ST01-002');
        p1.unitZones[1].unit = getCard('BT03-036');
        p1.unitZones[1].temporaryEffects.push({
            activation: 'EXIT',
            description: '테스트 엑시트: 리더 레벨+1',
            action: { type: 'GAIN_LEVEL', params: { value: 1 } },
            duration: 'TURN_END',
        } as any);

        engine.playItem(0, 0);
        engine.activateEffect(0, 0, 'ITEM', 0);
        const selectTarget = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) =>
            action.targetPlayerId === p1.id && action.zoneIndex === 1
        );
        expect(selectTarget).toBeDefined();
        if (selectTarget) expect(engine.step(selectTarget)).toBe(true);

        expect(engine.state.pendingEffect?.actionType).toBe('BT03_051_SELECT_EXIT_EFFECT_TO_GAIN');
        const selectExitOption = findAction(engine, p1.id, 'SELECT_REVEALED_TARGET', (action: any) => action.revealedIndex === 1)
            || findAction(engine, p1.id, 'SELECT_REVEALED_TARGET');
        expect(selectExitOption).toBeDefined();
        if (selectExitOption) expect(engine.step(selectExitOption)).toBe(true);

        const gained = p1.unitZones[0].temporaryEffects.some(effect =>
            effect.activation === 'EXIT' && String(effect.description || '').includes('리더 레벨+1')
        );
        expect(gained).toBe(true);

        const beforeLevel = p1.leaderLevel;
        engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
        expect(p1.leaderLevel).toBe(beforeLevel + 1);
    });

    it('BT03-052 chains skill-zone cost(3) trash -> entry unit select -> entry effect select', () => {
        const engine = createEngine(30100);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.levelZone = getCard('BT03-052');
        if (p1.levelZone) p1.levelZone.isAwakened = true;
        p1.skillZone = [getCard('BT03-063')];
        p1.unitZones[0].unit = getCard('BT03-053');
        p1.deck = [getCard('ST01-002')];
        p2.deck = [getCard('ST01-002')];
        engine.state.phase = Phase.MAIN;

        engine.activateEffect(0, 1, 'LEADER');
        expect(engine.state.pendingEffect?.actionType).toBe('BT03_052_SELECT_SKILL_ZONE_COST3_TO_TRASH');

        const pickSkill = findAction(engine, p1.id, 'SELECT_REVEALED_TARGET');
        expect(pickSkill).toBeDefined();
        if (pickSkill) expect(engine.step(pickSkill)).toBe(true);
        expect(p1.skillZone.length).toBe(0);
        expect(p1.trash.some(card => card.id.startsWith('BT03-063'))).toBe(true);

        const pickEntryUnit = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) =>
            action.targetPlayerId === p1.id && action.zoneIndex === 0
        );
        expect(pickEntryUnit).toBeDefined();
        if (pickEntryUnit) expect(engine.step(pickEntryUnit)).toBe(true);
        expect(engine.state.pendingEffect?.actionType).toBe('BT06_SELECT_ENTRY_EFFECT');

        const pickEntryEffect = findAction(engine, p1.id, 'SELECT_REVEALED_TARGET');
        expect(pickEntryEffect).toBeDefined();
        if (pickEntryEffect) expect(engine.step(pickEntryEffect)).toBe(true);
        expect(p1.hand.some(card => card.id.startsWith('ST01-002'))).toBe(true);
        expect(p2.hand.some(card => card.id.startsWith('ST01-002'))).toBe(true);
    });

    it('BT03-054 handles skill/non-skill top-card branch and reveals trashed skill for optional cast', () => {
        const skillBranch = createEngine(30101);
        const p1Skill = skillBranch.state.players[0];
        const p2Skill = skillBranch.state.players[1];
        p1Skill.hand = [getCard('BT03-054')];
        p1Skill.deck = [getCard('BT03-063')];
        p2Skill.unitZones[0].unit = getCard('ST01-011');
        skillBranch.playUnit(0, 0);

        const pickActions = skillBranch
            .getLegalActions(p1Skill.id)
            .filter(action => action.type === 'SELECT_REVEALED_TARGET') as Array<any>;
        expect(pickActions.length).toBe(1);
        expect(skillBranch.state.pendingEffect?.actionType).toBe('BT06_SELECT_TRASHED_SKILL_TO_CAST');
        expect(skillBranch.state.revealedCards[pickActions[0]?.revealedIndex]?.id).toMatch(/^BT03-063/);

        const skipCast = findAction(skillBranch, p1Skill.id, 'CONFIRM_TARGETS');
        expect(skipCast).toBeDefined();
        if (skipCast) expect(skillBranch.step(skipCast)).toBe(true);
        const lockedWhenSkipped = p2Skill.unitZones[0].temporaryEffects.some(effect =>
            typeof effect?.action?.params?.cannotAttackUntilTurnCount === 'number'
        );
        expect(lockedWhenSkipped).toBe(false);
        expect(p1Skill.trash.some(card => card.id.startsWith('BT03-063'))).toBe(true);

        const nonSkillBranch = createEngine(30102);
        const p1Non = nonSkillBranch.state.players[0];
        const p2Non = nonSkillBranch.state.players[1];
        p1Non.hand = [getCard('BT03-054')];
        p1Non.deck = [getCard('ST01-002'), getCard('ST01-002')];
        p2Non.deck = [getCard('ST01-002')];
        nonSkillBranch.playUnit(0, 0);
        expect(p1Non.hand.some(card => card.id.startsWith('ST01-002'))).toBe(true);
        expect(p2Non.hand.some(card => card.id.startsWith('ST01-002'))).toBe(true);
    });

    it('BT03-057 resolves both branches: match discard prevents damage, otherwise damage by discarded hit', () => {
        const noMatch = createEngine(30103);
        const p1No = noMatch.state.players[0];
        const p2No = noMatch.state.players[1];
        p1No.unitZones[0].unit = getCard('BT03-057');
        p1No.hand = [getCard('BT03-060')];
        p2No.hand = [getCard('BT03-053')];
        p2No.deck = [getCard('ST01-002'), getCard('ST01-002'), getCard('BT03-053')];
        const noMatchBefore = p2No.damage.length;
        noMatch.activateEffect(0, 0);
        const pickSelfDiscard = findAction(noMatch, p1No.id, 'SELECT_HAND_TARGET', (action: any) => action.targetPlayerId === p1No.id);
        expect(pickSelfDiscard).toBeDefined();
        if (pickSelfDiscard) expect(noMatch.step(pickSelfDiscard)).toBe(true);
        const discardedForDamage = p1No.trash.find(card => card.id.startsWith('BT03-060'));
        const expectedDamage = Math.max(0, discardedForDamage?.hit || 0);
        expect(p2No.damage.length).toBe(noMatchBefore + expectedDamage);

        const withMatch = createEngine(30104);
        const p1Match = withMatch.state.players[0];
        const p2Match = withMatch.state.players[1];
        p1Match.unitZones[0].unit = getCard('BT03-057');
        p1Match.hand = [getCard('BT03-060')];
        p2Match.hand = [getCard('BT03-060')];
        p2Match.deck = [getCard('ST01-002'), getCard('ST01-002'), getCard('BT03-053')];
        const withMatchBefore = p2Match.damage.length;
        withMatch.activateEffect(0, 0);
        const pickSelf = findAction(withMatch, p1Match.id, 'SELECT_HAND_TARGET', (action: any) => action.targetPlayerId === p1Match.id);
        expect(pickSelf).toBeDefined();
        if (pickSelf) expect(withMatch.step(pickSelf)).toBe(true);
        expect(withMatch.state.pendingEffect?.actionType).toBe('BT03_057_OPP_SELECT_MATCH_OR_SKIP');

        const pickOppMatch = findAction(withMatch, p2Match.id, 'SELECT_HAND_TARGET', (action: any) => action.targetPlayerId === p2Match.id);
        expect(pickOppMatch).toBeDefined();
        if (pickOppMatch) expect(withMatch.step(pickOppMatch)).toBe(true);
        const confirmOpp = findAction(withMatch, p2Match.id, 'CONFIRM_TARGETS');
        expect(confirmOpp).toBeDefined();
        if (confirmOpp) expect(withMatch.step(confirmOpp)).toBe(true);

        expect(p2Match.damage.length).toBe(withMatchBefore);
        expect(p2Match.trash.some(card => card.id.startsWith('BT03-060'))).toBe(true);
    });

    it('BT03-058 draws once per each opponent attack declaration', () => {
        const engine = createEngine(30105);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];
        engine.state.turnPlayerIndex = 1;
        engine.state.phase = Phase.ATTACK;
        p1.unitZones[2].unit = getCard('BT03-058');
        p1.deck = Array.from({ length: 20 }, () => getCard('ST01-002'));
        p2.unitZones[0].unit = getCard('ST01-011');

        const before = p1.hand.length;
        engine.attack(0);
        p2.unitZones[0].hasAttacked = false;
        p2.unitZones[0].attackCountThisTurn = 0;
        p2.unitZones[0].isExhausted = false;
        engine.state.phase = Phase.ATTACK;
        engine.attack(0);
        expect(p1.hand.length).toBe(before + 2);
    });

    it('BT03-059 applies global cost>=5 placement lock to all lanes until opponent turn end', () => {
        const engine = createEngine(30106);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];
        p1.hand = [getCard('BT03-059'), getCard('ST01-002'), getCard('ST01-002')];
        p2.hand = [getCard('BT03-060'), getCard('BT03-053')];
        engine.state.phase = Phase.MAIN;

        engine.playUnit(0, 0);
        const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
        expect(confirm).toBeDefined();
        if (confirm) expect(engine.step(confirm)).toBe(true);
        const payA = findAction(engine, p1.id, 'SELECT_COST_HAND');
        expect(payA).toBeDefined();
        if (payA) expect(engine.step(payA)).toBe(true);
        const payB = findAction(engine, p1.id, 'SELECT_COST_HAND');
        expect(payB).toBeDefined();
        if (payB) expect(engine.step(payB)).toBe(true);

        expect(RuleValidator.canPlayUnit(engine, p2, 0, 0).valid).toBe(false);
        expect(RuleValidator.canPlayUnit(engine, p2, 0, 1).valid).toBe(false);
        expect(RuleValidator.canPlayUnit(engine, p2, 0, 2).valid).toBe(false);
        expect(RuleValidator.canPlayUnit(engine, p2, 1, 1).valid).toBe(true);

        engine.state.phase = Phase.END;
        engine.nextPhase(); // p1 end -> p2 turn
        engine.state.phase = Phase.END;
        engine.nextPhase(); // p2 end -> p1 turn (lock expired)
        engine.state.phase = Phase.MAIN;
        expect(RuleValidator.canPlayUnit(engine, p2, 0, 1).valid).toBe(true);
    });

    it('BT03-060 entry both locks self attack this turn and deals hand-diff damage', () => {
        const engine = createEngine(30107);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];
        p1.hand = [getCard('BT03-060')];
        p2.hand = [
            getCard('ST01-002'),
            getCard('ST01-002'),
            getCard('ST01-002'),
            getCard('ST01-002'),
            getCard('ST01-002'),
            getCard('ST01-002'),
            getCard('ST01-002'),
        ];

        const before = p2.damage.length;
        engine.playUnit(0, 0);
        expect(p2.damage.length).toBe(before + 2);
        engine.state.phase = Phase.ATTACK;
        expect(RuleValidator.canAttack(engine, p1, 0).valid).toBe(false);
    });

    it('BT03-062 casts selected skill from skill-zone without moving it out of skill-zone', () => {
        const engine = createEngine(30108);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.hand = [getCard('BT03-062'), getCard('ST01-002')];
        p1.skillZone = [getCard('BT03-063')];
        p2.unitZones[0].unit = getCard('ST01-011');
        engine.state.phase = Phase.MAIN;

        engine.playUnit(0, 0);
        const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
        expect(confirm).toBeDefined();
        if (confirm) expect(engine.step(confirm)).toBe(true);
        const payCost = findAction(engine, p1.id, 'SELECT_COST_HAND');
        expect(payCost).toBeDefined();
        if (payCost) expect(engine.step(payCost)).toBe(true);
        const pickSkill = findAction(engine, p1.id, 'SELECT_REVEALED_TARGET');
        expect(pickSkill).toBeDefined();
        if (pickSkill) expect(engine.step(pickSkill)).toBe(true);
        const pickTarget = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) =>
            action.targetPlayerId === p2.id && action.zoneIndex === 0
        );
        expect(pickTarget).toBeDefined();
        if (pickTarget) expect(engine.step(pickTarget)).toBe(true);

        expect(p1.skillZone.some(card => card.id.startsWith('BT03-063'))).toBe(true);
        const locked = p2.unitZones[0].temporaryEffects.some(effect =>
            typeof effect?.action?.params?.cannotAttackUntilTurnCount === 'number'
        );
        expect(locked).toBe(true);
    });

    it('BT03-064 returns encounter only when discard count is exactly selected defender current hit', () => {
        const success = createEngine(30109);
        const p1Success = success.state.players[0];
        const p2Success = success.state.players[1];
        p1Success.hand = [getCard('BT03-064'), getCard('ST01-002'), getCard('ST01-002')];
        p1Success.unitZones[0].unit = getCard('BT03-061'); // hit 2
        p2Success.unitZones[0].unit = getCard('ST01-011');
        success.playSkill(0);
        const pickDefender = findAction(success, p1Success.id, 'SELECT_ZONE_TARGET', (action: any) => action.targetPlayerId === p1Success.id && action.zoneIndex === 0);
        expect(pickDefender).toBeDefined();
        if (pickDefender) expect(success.step(pickDefender)).toBe(true);
        const confirm = findAction(success, p1Success.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
        expect(confirm).toBeDefined();
        if (confirm) expect(success.step(confirm)).toBe(true);
        const handChoices = success.getLegalActions(p1Success.id).filter(action => action.type === 'SELECT_HAND_TARGET') as Array<any>;
        expect(handChoices.length).toBeGreaterThanOrEqual(2);
        expect(success.step(handChoices[0])).toBe(true);
        expect(success.step(handChoices[1])).toBe(true);
        const confirmDiscard = findAction(success, p1Success.id, 'CONFIRM_TARGETS');
        expect(confirmDiscard).toBeDefined();
        if (confirmDiscard) expect(success.step(confirmDiscard)).toBe(true);
        expect(p2Success.unitZones[0].unit).toBeNull();
        expect(p2Success.hand.some(card => card.id.startsWith('ST01-011'))).toBe(true);

        const fail = createEngine(30110);
        const p1Fail = fail.state.players[0];
        const p2Fail = fail.state.players[1];
        p1Fail.hand = [getCard('BT03-064'), getCard('ST01-002')];
        p1Fail.unitZones[0].unit = getCard('BT03-061'); // requires 2, only 1 payable
        p2Fail.unitZones[0].unit = getCard('ST01-011');
        fail.playSkill(0);
        const pickDefenderFail = findAction(fail, p1Fail.id, 'SELECT_ZONE_TARGET', (action: any) => action.targetPlayerId === p1Fail.id && action.zoneIndex === 0);
        expect(pickDefenderFail).toBeDefined();
        if (pickDefenderFail) expect(fail.step(pickDefenderFail)).toBe(true);
        const confirmFail = findAction(fail, p1Fail.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
        expect(confirmFail).toBeDefined();
        if (confirmFail) expect(fail.step(confirmFail)).toBe(true);
        const noHandPrompt = fail.getLegalActions(p1Fail.id).filter(action => action.type === 'SELECT_HAND_TARGET');
        expect(noHandPrompt.length).toBe(0);
        expect(p2Fail.unitZones[0].unit).not.toBeNull();
    });

    it('BT03-065 draws by friendly entry count and entry-lock expires after opponent turn end', () => {
        const engine = createEngine(30111);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];
        p1.hand = [getCard('BT03-065')];
        p1.deck = [getCard('ST01-002'), getCard('ST01-002')];
        p1.unitZones[0].unit = getCard('BT03-053');
        p1.unitZones[1].unit = getCard('BT03-055');
        p1.unitZones[2].unit = getCard('ST01-002');
        engine.playSkill(0);
        expect(p1.hand.filter(card => card.id.startsWith('ST01-002')).length).toBeGreaterThanOrEqual(2);

        const lockUntil = (p2.lockedActivationsUntilTurnCount as any)[ActivationCondition.ENTRY];
        expect(typeof lockUntil).toBe('number');
        expect(lockUntil).toBe(engine.state.turnCount + 1);

        engine.state.phase = Phase.END;
        engine.nextPhase(); // p1 end -> p2 turn
        p2.hand = [getCard('BT03-053')];
        p2.deck = [getCard('ST01-002')];
        engine.state.phase = Phase.MAIN;
        engine.playUnit(0, 0);
        expect(p2.hand.some(card => card.id.startsWith('ST01-002'))).toBe(false); // entry locked

        engine.state.phase = Phase.END;
        engine.nextPhase(); // p2 end -> p1 turn
        engine.state.phase = Phase.END;
        engine.nextPhase(); // p1 end -> p2 turn (expired)
        p2.hand = [getCard('BT03-053')];
        p2.deck = [getCard('ST01-002')];
        engine.state.phase = Phase.MAIN;
        engine.playUnit(0, 1);
        expect(p2.hand.some(card => card.id.startsWith('ST01-002'))).toBe(true); // entry unlocked
    });

    it('BT03-066 only resolves discard-to-six when hand is 7+, then scales damage by discarded count', () => {
        const noOp = createEngine(30112);
        const p1No = noOp.state.players[0];
        const p2No = noOp.state.players[1];
        p1No.hand = [
            getCard('BT03-066'),
            getCard('ST01-002'),
            getCard('ST01-002'),
            getCard('ST01-002'),
            getCard('ST01-002'),
            getCard('ST01-002'),
        ];
        const noOpBefore = p2No.damage.length;
        noOp.playSkill(0);
        expect(noOp.state.pendingEffect).toBeNull();
        expect(p2No.damage.length).toBe(noOpBefore);

        const active = createEngine(30113);
        const p1Act = active.state.players[0];
        const p2Act = active.state.players[1];
        p1Act.hand = [
            getCard('BT03-066'),
            getCard('ST01-002'),
            getCard('ST01-002'),
            getCard('ST01-002'),
            getCard('ST01-002'),
            getCard('ST01-002'),
            getCard('ST01-002'),
            getCard('ST01-002'),
        ];
        const actBefore = p2Act.damage.length;
        active.playSkill(0);
        const selectDiscard = findAction(active, p1Act.id, 'SELECT_HAND_TARGET', (action: any) => action.targetPlayerId === p1Act.id);
        expect(selectDiscard).toBeDefined();
        if (selectDiscard) expect(active.step(selectDiscard)).toBe(true);
        expect(p1Act.hand.length).toBe(6);
        expect(p2Act.damage.length).toBe(actBefore + 1);
    });

    it('BT03-067 revives trashed equipped unit to selected empty zone', () => {
        const engine = createEngine(30114);
        const p1 = engine.state.players[0];
        p1.hand = [getCard('BT03-067'), getCard('ST01-002')];
        p1.unitZones[0].unit = getCard('ST01-011');
        engine.state.phase = Phase.MAIN;

        engine.playItem(0, 0);
        engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
        const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
        expect(confirm).toBeDefined();
        if (confirm) expect(engine.step(confirm)).toBe(true);
        const payCost = findAction(engine, p1.id, 'SELECT_COST_HAND');
        expect(payCost).toBeDefined();
        if (payCost) expect(engine.step(payCost)).toBe(true);
        const pickZone = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) =>
            action.targetPlayerId === p1.id && action.zoneIndex === 1
        ) || findAction(engine, p1.id, 'SELECT_ZONE_TARGET');
        expect(pickZone).toBeDefined();
        if (pickZone) expect(engine.step(pickZone)).toBe(true);

        expect(p1.unitZones[1].unit?.id.startsWith('ST01-011') || p1.unitZones[2].unit?.id.startsWith('ST01-011')).toBe(true);
    });

    it('BT03-068 enforces defender equip condition and grants +3000 power when equipped', () => {
        const valid = createEngine(30115);
        const p1Valid = valid.state.players[0];
        p1Valid.hand = [getCard('BT03-068')];
        p1Valid.unitZones[0].unit = getCard('BT03-056');
        const before = zonePower(valid, p1Valid, 0);
        valid.playItem(0, 0);
        expect(zonePower(valid, p1Valid, 0)).toBe(before + 3000);

        const invalid = createEngine(30116);
        const p1Invalid = invalid.state.players[0];
        p1Invalid.hand = [getCard('BT03-068')];
        p1Invalid.unitZones[0].unit = getCard('ST01-002');
        expect(RuleValidator.canPlayItem(invalid, p1Invalid, 0, 0).valid).toBe(false);
    });

    it('BT03-069 trashes top 3 and draws only when at least one trashed card is ITEM', () => {
        const withItem = createEngine(30117);
        const p1With = withItem.state.players[0];
        p1With.levelZone = getCard('BT03-069');
        if (p1With.levelZone) p1With.levelZone.isAwakened = true;
        p1With.deck = [getCard('ST01-002'), getCard('BT03-083'), getCard('ST01-002'), getCard('ST01-002')];
        const withBefore = p1With.hand.length;
        withItem.activateEffect(0, 1, 'LEADER');
        expect(p1With.trash.length).toBe(3);
        expect(p1With.hand.length).toBe(withBefore + 1);

        const withoutItem = createEngine(30118);
        const p1Without = withoutItem.state.players[0];
        p1Without.levelZone = getCard('BT03-069');
        if (p1Without.levelZone) p1Without.levelZone.isAwakened = true;
        p1Without.deck = [getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002')];
        const withoutBefore = p1Without.hand.length;
        withoutItem.activateEffect(0, 1, 'LEADER');
        expect(p1Without.trash.length).toBe(3);
        expect(p1Without.hand.length).toBe(withoutBefore);
    });

    it('BT03-073 trigger discards 2 from current hand (not only from newly drawn cards)', () => {
        const engine = createEngine(30130);
        const p1 = engine.state.players[0];
        p1.deck = [getCard('ST01-002'), getCard('ST01-002'), getCard('BT03-073')];

        const handBefore = p1.hand.length; // default 5
        engine.dealDamage(p1, 1);
        expect(engine.state.pendingEffect?.validTargets).toBe('MY_HAND');

        const first = findAction(engine, p1.id, 'SELECT_HAND_TARGET', (action: any) => action.targetPlayerId === p1.id);
        expect(first).toBeDefined();
        if (first) expect(engine.step(first)).toBe(true);
        const second = findAction(engine, p1.id, 'SELECT_HAND_TARGET', (action: any) =>
            action.targetPlayerId === p1.id && action.handIndex !== (first as any)?.handIndex
        ) || findAction(engine, p1.id, 'SELECT_HAND_TARGET', (action: any) => action.targetPlayerId === p1.id);
        expect(second).toBeDefined();
        if (second) expect(engine.step(second)).toBe(true);
        const confirm = findAction(engine, p1.id, 'CONFIRM_TARGETS');
        if (confirm) expect(engine.step(confirm)).toBe(true);

        expect(p1.trash.some(card => card.id.startsWith('BT03-073'))).toBe(true);
        expect(p1.hand.length).toBe(handBefore);
    });

    it('BT03-077 blocks external equip, prevents duplicate names, and applies turn 0-cost override on active equip', () => {
        const externalBlock = createEngine(30119);
        const p1Block = externalBlock.state.players[0];
        p1Block.unitZones[0].unit = getCard('BT03-077');
        p1Block.hand = [getCard('ST01-016')];
        expect(RuleValidator.canPlayItem(externalBlock, p1Block, 0, 0).valid).toBe(false);

        const activeEquip = createEngine(30120);
        const p1Active = activeEquip.state.players[0];
        p1Active.unitZones[0].unit = getCard('BT03-077');
        p1Active.trash = [getCard('ST01-016'), getCard('ST01-016')];
        activeEquip.activateEffect(0, 1);

        const firstPick = findAction(activeEquip, p1Active.id, 'SELECT_REVEALED_TARGET', (action: any) => action.revealedIndex === 0)
            || findAction(activeEquip, p1Active.id, 'SELECT_REVEALED_TARGET');
        expect(firstPick).toBeDefined();
        if (firstPick) expect(activeEquip.step(firstPick)).toBe(true);
        const secondPick = findAction(activeEquip, p1Active.id, 'SELECT_REVEALED_TARGET', (action: any) =>
            action.revealedIndex !== (firstPick as any)?.revealedIndex
        ) || findAction(activeEquip, p1Active.id, 'SELECT_REVEALED_TARGET');
        expect(secondPick).toBeDefined();
        if (secondPick) expect(activeEquip.step(secondPick)).toBe(true);
        const confirm = findAction(activeEquip, p1Active.id, 'CONFIRM_TARGETS');
        expect(confirm).toBeDefined();
        if (confirm) expect(activeEquip.step(confirm)).toBe(true);

        const equippedSameNameCount = p1Active.unitZones[0].items.filter(item => item.name === '레어 메탈 부츠').length;
        expect(equippedSameNameCount).toBe(1);
        expect(p1Active.unitZones[0].items.every((item: any) =>
            item.turnCostOverride?.cost === 0 && item.turnCostOverride?.turnCount === activeEquip.state.turnCount
        )).toBe(true);
    });

    it('BT03-077 active equips ignoring conditions, then trashes unmet items after resolve; 0-cost expires and reapplies on next use', () => {
        const engine = createEngine(30131);
        const p1 = engine.state.players[0];
        p1.leaderLevel = 10;
        p1.damage = [];
        p1.unitZones[0].unit = getCard('BT03-077');
        p1.trash = [getCard('BT03-068'), getCard('BT03-084')];
        p1.hand = [getCard('ST01-008')]; // cost 4
        engine.state.phase = Phase.MAIN;

        engine.activateEffect(0, 1);
        const pickA = findAction(engine, p1.id, 'SELECT_REVEALED_TARGET', (action: any) => action.revealedIndex === 0)
            || findAction(engine, p1.id, 'SELECT_REVEALED_TARGET');
        expect(pickA).toBeDefined();
        if (pickA) expect(engine.step(pickA)).toBe(true);
        const pickB = findAction(engine, p1.id, 'SELECT_REVEALED_TARGET', (action: any) => action.revealedIndex === 1)
            || findAction(engine, p1.id, 'SELECT_REVEALED_TARGET', (action: any) =>
                action.revealedIndex !== (pickA as any)?.revealedIndex
            );
        expect(pickB).toBeDefined();
        if (pickB) expect(engine.step(pickB)).toBe(true);
        const confirm = findAction(engine, p1.id, 'CONFIRM_TARGETS');
        expect(confirm).toBeDefined();
        if (confirm) expect(engine.step(confirm)).toBe(true);

        const equippedIds = p1.unitZones[0].items.map((item: any) => item.id);
        expect(equippedIds.some((id: string) => id.startsWith('BT03-084'))).toBe(true);
        expect(equippedIds.some((id: string) => id.startsWith('BT03-068'))).toBe(false);
        expect(p1.trash.some(card => card.id.startsWith('BT03-068'))).toBe(true);
        expect(p1.unitZones[0].items.every((item: any) =>
            item.turnCostOverride?.cost === 0 && item.turnCostOverride?.turnCount === engine.state.turnCount
        )).toBe(true);

        expect(RuleValidator.canPlayUnit(engine, p1, 0, 1).valid).toBe(true);
        const firstOverrideTurn = engine.state.turnCount;

        advanceUntil(
            engine,
            () => engine.currentPlayer.id === p1.id && engine.state.phase === Phase.MAIN && engine.state.turnCount > firstOverrideTurn,
            32
        );

        expect(RuleValidator.canPlayUnit(engine, p1, 0, 1).valid).toBe(false);
        const equippedItem = p1.unitZones[0].items.find(item => item.id.startsWith('BT03-084')) as any;
        expect(equippedItem.turnCostOverride?.turnCount).toBe(firstOverrideTurn);

        engine.activateEffect(0, 1);
        const pickAgain = findAction(engine, p1.id, 'SELECT_REVEALED_TARGET');
        expect(pickAgain).toBeDefined();
        if (pickAgain) expect(engine.step(pickAgain)).toBe(true);
        const confirmAgain = findAction(engine, p1.id, 'CONFIRM_TARGETS');
        if (confirmAgain) expect(engine.step(confirmAgain)).toBe(true);

        const equippedAfterReapply = p1.unitZones[0].items.find(item => item.id.startsWith('BT03-084')) as any;
        expect(equippedAfterReapply).toBeDefined();
        expect(equippedAfterReapply.turnCostOverride?.cost).toBe(0);
        expect(equippedAfterReapply.turnCostOverride?.turnCount).toBe(engine.state.turnCount);
    });

    it('BT03-078 replacement applies to BATTLE/EFFECT only, not RULE destruction', () => {
        const ruleDestroy = createEngine(30121);
        const p1Rule = ruleDestroy.state.players[0];
        p1Rule.unitZones[0].unit = getCard('BT03-078');
        p1Rule.unitZones[0].items = [getCard('ST01-016')];
        p1Rule.trash = [getCard('ST01-017')];
        ruleDestroy.destroyUnit(p1Rule, p1Rule.unitZones[0], undefined, 'RULE');
        expect(ruleDestroy.state.pendingEffect).toBeNull();
        expect(p1Rule.trash.some(card => card.id.startsWith('BT03-078'))).toBe(true);

        const effectDestroy = createEngine(30122);
        const p1Effect = effectDestroy.state.players[0];
        p1Effect.unitZones[0].unit = getCard('BT03-078');
        p1Effect.unitZones[0].items = [getCard('ST01-016')];
        p1Effect.trash = [getCard('ST01-017')];
        effectDestroy.destroyUnit(p1Effect, p1Effect.unitZones[0], undefined, 'EFFECT');
        expect(effectDestroy.state.pendingEffect?.actionType).toBe('DESTRUCTION_REPLACEMENT');
        const confirm = findAction(effectDestroy, p1Effect.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
        expect(confirm).toBeDefined();
        if (confirm) expect(effectDestroy.step(confirm)).toBe(true);
        const pickTrash = findAction(effectDestroy, p1Effect.id, 'SELECT_TRASH_TARGET');
        expect(pickTrash).toBeDefined();
        if (pickTrash) expect(effectDestroy.step(pickTrash)).toBe(true);
        expect(p1Effect.hand.some(card => card.id.startsWith('BT03-078'))).toBe(true);
        expect(p1Effect.hand.some(card => card.id.startsWith('ST01-016'))).toBe(true);
    });

    it('BT03-079 enforces exact 8-item payment before allowing confirm', () => {
        const insufficient = createEngine(30123);
        const p1Insufficient = insufficient.state.players[0];
        p1Insufficient.hand = [getCard('BT03-079'), getCard('BT03-067'), getCard('BT03-083'), getCard('BT03-084')];
        p1Insufficient.trash = [getCard('BT03-068'), getCard('ST01-016'), getCard('ST01-017')]; // total 6 items
        insufficient.playUnit(0, 0);
        expect(insufficient.state.pendingEffect).toBeNull();

        const exact = createEngine(30124);
        const p1Exact = exact.state.players[0];
        p1Exact.leaderLevel = 20;
        p1Exact.hand = [getCard('BT03-079'), getCard('BT03-067'), getCard('BT03-083'), getCard('BT03-084'), getCard('BT03-068')];
        p1Exact.trash = [getCard('ST01-016'), getCard('ST01-017'), getCard('BT03-016'), getCard('BT03-017')];
        exact.playUnit(0, 0);

        const selectedIndexes = new Set<number>();
        for (let i = 0; i < 7; i++) {
            const pick = findAction(exact, p1Exact.id, 'SELECT_REVEALED_TARGET', (action: any) => !selectedIndexes.has(action.revealedIndex));
            expect(pick).toBeDefined();
            if (!pick) break;
            selectedIndexes.add((pick as any).revealedIndex);
            expect(exact.step(pick)).toBe(true);
        }
        expect(findAction(exact, p1Exact.id, 'CONFIRM_TARGETS')).toBeUndefined();

        const eighth = findAction(exact, p1Exact.id, 'SELECT_REVEALED_TARGET', (action: any) => !selectedIndexes.has(action.revealedIndex));
        expect(eighth).toBeDefined();
        if (eighth) expect(exact.step(eighth)).toBe(true);
        const confirm = findAction(exact, p1Exact.id, 'CONFIRM_TARGETS');
        expect(confirm).toBeDefined();
    });

    it('BT03-080 draws once per equip event even when multiple items are equipped in one event', () => {
        const engine = createEngine(30125);
        const p1 = engine.state.players[0];
        p1.leaderLevel = 20;
        p1.hand = [getCard('BT03-080')];
        p1.deck = [getCard('ST01-002'), getCard('ST01-002')];
        p1.unitZones[0].unit = getCard('BT03-077');
        p1.trash = [getCard('BT03-083'), getCard('BT03-084')];

        engine.playSkill(0);
        const selectTarget = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) =>
            action.targetPlayerId === p1.id && action.zoneIndex === 0
        );
        expect(selectTarget).toBeDefined();
        if (selectTarget) expect(engine.step(selectTarget)).toBe(true);

        engine.activateEffect(0, 1);
        const firstPick = findAction(engine, p1.id, 'SELECT_REVEALED_TARGET', (action: any) => action.revealedIndex === 0)
            || findAction(engine, p1.id, 'SELECT_REVEALED_TARGET');
        expect(firstPick).toBeDefined();
        if (firstPick) expect(engine.step(firstPick)).toBe(true);
        const secondPick = findAction(engine, p1.id, 'SELECT_REVEALED_TARGET', (action: any) =>
            action.revealedIndex !== (firstPick as any)?.revealedIndex
        ) || findAction(engine, p1.id, 'SELECT_REVEALED_TARGET');
        expect(secondPick).toBeDefined();
        if (secondPick) expect(engine.step(secondPick)).toBe(true);
        const confirm = findAction(engine, p1.id, 'CONFIRM_TARGETS');
        expect(confirm).toBeDefined();
        if (confirm) expect(engine.step(confirm)).toBe(true);

        expect(p1.hand.filter(card => card.id.startsWith('ST01-002')).length).toBe(1);
    });

    it('BT03-082 copies selected equipped item effects to other friendly units only, and copied effects expire at turn end', () => {
        const engine = createEngine(30126);
        const p1 = engine.state.players[0];
        p1.leaderLevel = 20;
        p1.hand = [getCard('BT03-082')];
        p1.unitZones[0].unit = getCard('ST01-002');
        p1.unitZones[0].items = [getCard('BT03-067')];
        p1.unitZones[1].unit = getCard('ST01-002');
        p1.unitZones[2].unit = getCard('ST01-002');

        engine.playSkill(0);
        const pickUnit = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) =>
            action.targetPlayerId === p1.id && action.zoneIndex === 0
        );
        expect(pickUnit).toBeDefined();
        if (pickUnit) expect(engine.step(pickUnit)).toBe(true);
        const pickItem = findAction(engine, p1.id, 'SELECT_REVEALED_TARGET');
        expect(pickItem).toBeDefined();
        if (pickItem) expect(engine.step(pickItem)).toBe(true);

        const copiedExitNow =
            p1.unitZones[1].temporaryEffects.filter(effect => effect.activation === 'EXIT').length +
            p1.unitZones[2].temporaryEffects.filter(effect => effect.activation === 'EXIT').length;
        expect(copiedExitNow).toBeGreaterThan(0);
        expect(p1.unitZones[0].temporaryEffects.filter(effect => effect.activation === 'EXIT').length).toBe(0);

        engine.state.phase = Phase.END;
        engine.nextPhase();
        const copiedExitAfterTurnEnd =
            p1.unitZones[1].temporaryEffects.filter(effect => effect.activation === 'EXIT').length +
            p1.unitZones[2].temporaryEffects.filter(effect => effect.activation === 'EXIT').length;
        expect(copiedExitAfterTurnEnd).toBe(0);
    });

    it('BT03-084 buff duration persists through opponent turn and expires at opponent turn end', () => {
        const engine = createEngine(30127);
        const p1 = engine.state.players[0];
        p1.hand = [getCard('BT03-084')];
        p1.unitZones[0].unit = getCard('ST01-002');
        p1.deck = [getCard('ST01-002'), getCard('BT03-083'), getCard('ST01-002')];

        engine.playItem(0, 0);
        const base = zonePower(engine, p1, 0);
        engine.activateEffect(0, 1, 'ITEM', 0);
        expect(zonePower(engine, p1, 0)).toBe(base + 3000);

        engine.state.phase = Phase.END;
        engine.nextPhase(); // p1 end -> p2 turn
        expect(zonePower(engine, p1, 0)).toBe(base + 3000);

        engine.state.phase = Phase.END;
        engine.nextPhase(); // p2 end -> p1 turn
        expect(zonePower(engine, p1, 0)).toBe(base);
    });

    it('BT03-085 destroys encounter only when opponent does not discard exactly current hit', () => {
        const success = createEngine(30128);
        const p1Success = success.state.players[0];
        const p2Success = success.state.players[1];
        p1Success.hand = [getCard('BT03-085'), getCard('ST01-002')];
        p1Success.unitZones[0].unit = getCard('BT03-005'); // hit 1
        p2Success.unitZones[0].unit = getCard('ST01-011');
        p2Success.hand = [getCard('ST01-002')];
        success.playItem(0, 0);
        success.state.phase = Phase.ATTACK;
        success.attack(0);
        const confirmSuccess = findAction(success, p1Success.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
        expect(confirmSuccess).toBeDefined();
        if (confirmSuccess) expect(success.step(confirmSuccess)).toBe(true);
        const pickSelfSuccess = findAction(success, p1Success.id, 'SELECT_HAND_TARGET', (action: any) => action.targetPlayerId === p1Success.id);
        expect(pickSelfSuccess).toBeDefined();
        if (pickSelfSuccess) expect(success.step(pickSelfSuccess)).toBe(true);
        const pickOpp = findAction(success, p2Success.id, 'SELECT_HAND_TARGET', (action: any) => action.targetPlayerId === p2Success.id);
        expect(pickOpp).toBeDefined();
        if (pickOpp) expect(success.step(pickOpp)).toBe(true);
        // 선택만으로 즉시 트래시되지 않고, 확정 전까지는 손패에 남아 있어야 한다.
        expect(p2Success.hand.length).toBe(1);
        const confirmOpp = findAction(success, p2Success.id, 'CONFIRM_TARGETS');
        expect(confirmOpp).toBeDefined();
        if (confirmOpp) expect(success.step(confirmOpp)).toBe(true);
        expect(p2Success.unitZones[0].unit).not.toBeNull();

        const fail = createEngine(30129);
        const p1Fail = fail.state.players[0];
        const p2Fail = fail.state.players[1];
        p1Fail.hand = [getCard('BT03-085'), getCard('ST01-002')];
        p1Fail.unitZones[0].unit = getCard('BT03-005'); // hit 1
        p2Fail.unitZones[0].unit = getCard('ST01-011');
        p2Fail.hand = [getCard('ST01-002')];
        fail.playItem(0, 0);
        fail.state.phase = Phase.ATTACK;
        fail.attack(0);
        const confirmFail = findAction(fail, p1Fail.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
        expect(confirmFail).toBeDefined();
        if (confirmFail) expect(fail.step(confirmFail)).toBe(true);
        const pickSelfFail = findAction(fail, p1Fail.id, 'SELECT_HAND_TARGET', (action: any) => action.targetPlayerId === p1Fail.id);
        expect(pickSelfFail).toBeDefined();
        if (pickSelfFail) expect(fail.step(pickSelfFail)).toBe(true);
        const skipOpp = findAction(fail, p2Fail.id, 'CONFIRM_TARGETS');
        expect(skipOpp).toBeDefined();
        if (skipOpp) expect(fail.step(skipOpp)).toBe(true);
        expect(p2Fail.unitZones[0].unit).toBeNull();
    });
});
