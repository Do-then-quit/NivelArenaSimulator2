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
});
