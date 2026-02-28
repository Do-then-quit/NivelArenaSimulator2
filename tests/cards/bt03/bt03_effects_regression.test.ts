import { describe, expect, it } from 'vitest';
import { DUMMY_CARDS } from '../../../src/logic/CardDatabase';
import { GameEngine } from '../../../src/logic/GameEngine';
import { RuleValidator } from '../../../src/logic/RuleValidator';
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

function zoneHit(engine: GameEngine, player: any, zoneIndex: number): number {
    const zone = player.unitZones[zoneIndex];
    if (!zone?.unit) return 0;
    return engine.getUnitHit(zone, player);
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
});
