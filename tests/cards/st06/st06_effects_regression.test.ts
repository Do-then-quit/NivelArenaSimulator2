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
    const engine = new GameEngine('P1', 'P2', deck1, deck2, getCard('ST06-001'), getCard('ST01-001'), { seed });
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

function advanceUntil(engine: GameEngine, predicate: () => boolean, maxSteps = 20) {
    let guard = 0;
    while (!predicate() && guard < maxSteps) {
        engine.nextPhase();
        guard += 1;
    }
    expect(predicate()).toBe(true);
}

describe('ST06 Effects Regression', () => {
    it('Scenario 1: 계승자/과거혹은미래 패시브 누적(+0/+1000/+2000)', () => {
        const engine = createEngine(61001);
        const p1 = engine.state.players[0];

        p1.unitZones[0].unit = getCard('ST06-004');
        const base = engine.getUnitPower(p1.unitZones[0], p1);
        expect(base).toBe(500);

        p1.unitZones[1].unit = getCard('ST06-006'); // 계승자
        const plusOne = engine.getUnitPower(p1.unitZones[0], p1);
        expect(plusOne).toBe(1500);

        p1.unitZones[2].unit = getCard('ST06-007'); // 과거 혹은 미래
        const plusTwo = engine.getUnitPower(p1.unitZones[0], p1);
        expect(plusTwo).toBe(2500);
    });

    it('Scenario 2: ST06-011 선택 지불 성공 시 디버프 값이 현재 파워 합과 일치', () => {
        const engine = createEngine(61002);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.unitZones[0].unit = getCard('ST06-011'); // 1000
        p1.unitZones[1].unit = getCard('ST06-009'); // 5000
        p1.hand = [getCard('ST01-002'), getCard('ST01-002')];

        const target = getCard('ST06-012');
        target.power = 9000;
        target.hit = 2;
        p2.unitZones[0].unit = target;

        engine.state.phase = Phase.ATTACK;
        const expectedDebuff = engine.getUnitPower(p1.unitZones[0], p1) + engine.getUnitPower(p1.unitZones[1], p1);
        const before = engine.getUnitPower(p2.unitZones[0], p2);

        engine.attack(0);
        const pickTarget = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', action => action.targetPlayerId === p2.id && action.zoneIndex === 0);
        expect(pickTarget).toBeDefined();
        if (pickTarget) expect(engine.step(pickTarget)).toBe(true);

        const confirmOptional = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', action => action.confirm === true);
        expect(confirmOptional).toBeDefined();
        if (confirmOptional) expect(engine.step(confirmOptional)).toBe(true);

        const handActions = engine.getLegalActions(p1.id).filter(action => action.type === 'SELECT_HAND_TARGET').slice(0, 2);
        expect(handActions.length).toBe(2);
        handActions.forEach(action => expect(engine.step(action as any)).toBe(true));
        const confirm = findAction(engine, p1.id, 'CONFIRM_TARGETS');
        if (confirm) expect(engine.step(confirm)).toBe(true);

        const block = findAction(engine, p2.id, 'RESOLVE_BLOCK', action => action.shouldBlock && action.blockerZoneIndex === 0);
        if (block) expect(engine.step(block)).toBe(true);

        expect(p2.unitZones[0].unit).not.toBeNull();
        const after = engine.getUnitPower(p2.unitZones[0], p2);
        expect(after).toBe(before - expectedDebuff);
    });

    it('Scenario 3: ST06-011 선택 지불 거절 시 디버프 미적용', () => {
        const engine = createEngine(61003);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.unitZones[0].unit = getCard('ST06-011');
        p1.hand = [getCard('ST01-002'), getCard('ST01-002')];

        const target = getCard('ST06-012');
        target.power = 9000;
        target.hit = 2;
        p2.unitZones[0].unit = target;

        engine.state.phase = Phase.ATTACK;
        const before = engine.getUnitPower(p2.unitZones[0], p2);

        engine.attack(0);
        const pickTarget = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', action => action.targetPlayerId === p2.id && action.zoneIndex === 0);
        expect(pickTarget).toBeDefined();
        if (pickTarget) expect(engine.step(pickTarget)).toBe(true);

        const declineOptional = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', action => action.confirm === false);
        expect(declineOptional).toBeDefined();
        if (declineOptional) expect(engine.step(declineOptional)).toBe(true);

        const block = findAction(engine, p2.id, 'RESOLVE_BLOCK', action => action.shouldBlock && action.blockerZoneIndex === 0);
        if (block) expect(engine.step(block)).toBe(true);

        expect(p2.unitZones[0].unit).not.toBeNull();
        const after = engine.getUnitPower(p2.unitZones[0], p2);
        expect(after).toBe(before);
    });

    it('Scenario 4: 자신의 턴 종료까지 디버프는 상대 턴 종료에 남고 자신의 턴 종료에 해제', () => {
        const engine = createEngine(61004);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.deck = [getCard('ST06-014')];
        p2.unitZones[0].unit = getCard('ST06-009');
        const basePower = engine.getUnitPower(p2.unitZones[0], p2);

        engine.dealDamage(p1, 1);
        const pickTarget = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', action => action.targetPlayerId === p2.id && action.zoneIndex === 0);
        expect(pickTarget).toBeDefined();
        if (pickTarget) expect(engine.step(pickTarget)).toBe(true);

        const afterApply = engine.getUnitPower(p2.unitZones[0], p2);
        expect(afterApply).toBe(basePower - 3000);

        advanceUntil(
            engine,
            () => engine.currentPlayer.id === p2.id && engine.state.phase === Phase.LEVEL_UP,
            14,
        );
        const afterP1TurnEnd = engine.getUnitPower(p2.unitZones[0], p2);
        expect(afterP1TurnEnd).toBe(basePower - 3000);

        advanceUntil(
            engine,
            () => engine.currentPlayer.id === p1.id && engine.state.phase === Phase.LEVEL_UP,
            14,
        );
        const afterP2TurnEnd = engine.getUnitPower(p2.unitZones[0], p2);
        expect(afterP2TurnEnd).toBe(basePower);
    });

    it('Scenario 5: 성약 잠금 중 성약 스킬 재발동 불가, 턴 넘어가면 해제', () => {
        const engine = createEngine(61005);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.hand = [getCard('ST06-013'), getCard('ST06-015')];
        p1.unitZones[0].unit = getCard('ST06-006');
        p2.unitZones[0].unit = getCard('ST06-009');
        p1.deck = [getCard('ST01-002')];

        engine.playSkill(0);
        const pickDebuff = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', action => action.targetPlayerId === p2.id && action.zoneIndex === 0);
        if (pickDebuff) expect(engine.step(pickDebuff)).toBe(true);
        const pickCostTarget = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', action => action.targetPlayerId === p1.id && action.zoneIndex === 0);
        if (pickCostTarget) expect(engine.step(pickCostTarget)).toBe(true);

        const lockedNow = engine
            .getLegalActions(p1.id)
            .some(action => action.type === 'PLAY_SKILL' && p1.hand[action.handIndex]?.id.startsWith('ST06-015'));
        expect(lockedNow).toBe(false);

        const baselineTurnCount = engine.state.turnCount;
        advanceUntil(
            engine,
            () =>
                engine.state.turnCount > baselineTurnCount &&
                engine.currentPlayer.id === p1.id &&
                engine.state.phase === Phase.MAIN,
            20,
        );

        const st06_015Index = p1.hand.findIndex(card => card.id.startsWith('ST06-015'));
        expect(st06_015Index).toBeGreaterThanOrEqual(0);
        const unlockedNextTurn = RuleValidator.canPlaySkill(engine, p1, st06_015Index);
        expect(unlockedNextTurn.valid, unlockedNextTurn.reason).toBe(true);
    });

    it('Scenario 6: ST06-014 회수 총코스트 제한이 대미지존 카드 수를 넘지 않음', () => {
        const engine = createEngine(61006);
        const p1 = engine.state.players[0];

        p1.hand = [getCard('ST06-014')];
        p1.damage = [getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002')]; // limit 3
        p1.trash = [
            getCard('ST06-005'), // cost 2
            getCard('ST06-002'), // cost 1
            getCard('ST06-013'), // cost 3
        ];

        engine.playSkill(0);

        const firstPick = findAction(
            engine,
            p1.id,
            'SELECT_TRASH_TARGET',
            action => p1.trash[action.trashIndex]?.id.startsWith('ST06-005'),
        );
        expect(firstPick).toBeDefined();
        if (firstPick) expect(engine.step(firstPick)).toBe(true);

        const afterFirstSelectable = engine
            .getLegalActions(p1.id)
            .filter(action => action.type === 'SELECT_TRASH_TARGET')
            .map(action => p1.trash[(action as any).trashIndex]?.id);

        expect(afterFirstSelectable.some(id => id?.startsWith('ST06-013'))).toBe(false);
        expect(afterFirstSelectable.some(id => id?.startsWith('ST06-002'))).toBe(true);

        const secondPick = findAction(
            engine,
            p1.id,
            'SELECT_TRASH_TARGET',
            action => p1.trash[action.trashIndex]?.id.startsWith('ST06-002'),
        );
        if (secondPick) expect(engine.step(secondPick)).toBe(true);

        const confirm = findAction(engine, p1.id, 'CONFIRM_TARGETS');
        if (confirm) expect(engine.step(confirm)).toBe(true);

        const recoveredIds = p1.hand.map(card => card.id);
        expect(recoveredIds.some(id => id.startsWith('ST06-005'))).toBe(true);
        expect(recoveredIds.some(id => id.startsWith('ST06-002'))).toBe(true);
    });

    it('Scenario 7: ST06-017은 장착 유닛 코스트보다 낮은 유닛만 회수 가능', () => {
        const engine = createEngine(61007);
        const p1 = engine.state.players[0];

        p1.unitZones[0].unit = getCard('ST06-009'); // cost 4
        p1.unitZones[0].items = [getCard('ST06-017')];
        p1.trash = [
            getCard('ST06-005'), // cost 2
            getCard('ST06-010'), // cost 4
            getCard('ST06-012'), // cost 7
        ];

        engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');

        const selectableIds = engine
            .getLegalActions(p1.id)
            .filter(action => action.type === 'SELECT_TRASH_TARGET')
            .map(action => p1.trash[(action as any).trashIndex]?.id);

        expect(selectableIds.some(id => id?.startsWith('ST06-005'))).toBe(true);
        expect(selectableIds.some(id => id?.startsWith('ST06-010'))).toBe(false);
        expect(selectableIds.some(id => id?.startsWith('ST06-012'))).toBe(false);
    });

    it('Scenario 8: ST06-006 엔트리로 대상 유닛의 엔트리 효과 선택 발동 가능', () => {
        const engine = createEngine(61008);
        const p1 = engine.state.players[0];

        p1.hand = [getCard('ST06-006')];
        p1.unitZones[1].unit = getCard('ST06-004');
        p1.unitZones[2].unit = getCard('ST06-009');
        p1.leaderLevel = 10;

        engine.playUnit(0, 0);

        const pickSource = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', action => action.zoneIndex === 1 && action.targetPlayerId === p1.id);
        expect(pickSource).toBeDefined();
        if (pickSource) expect(engine.step(pickSource)).toBe(true);

        expect(engine.state.pendingEffect?.actionType).toBe('BT06_SELECT_ENTRY_EFFECT');
        const pickEntryEffect = findAction(engine, p1.id, 'SELECT_REVEALED_TARGET');
        expect(pickEntryEffect).toBeDefined();
        if (pickEntryEffect) expect(engine.step(pickEntryEffect)).toBe(true);

        const pickGrantedTarget = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', action => action.zoneIndex === 2 && action.targetPlayerId === p1.id);
        expect(pickGrantedTarget).toBeDefined();
        if (pickGrantedTarget) expect(engine.step(pickGrantedTarget)).toBe(true);

        const granted = p1.unitZones[2].temporaryEffects.some(effect => effect.description.includes('파워+3000'));
        expect(granted).toBe(true);
    });
});
