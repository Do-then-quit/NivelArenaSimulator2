/**
 * BT05 Unified Tests
 */

import { Card, Phase } from '../../types';
import { UnifiedTestCase, UnifiedTestModule } from './types';

function findAction(
    engine: any,
    actorPlayerId: string,
    type: string,
    predicate?: (action: any) => boolean,
) {
    return engine
        .getLegalActions(actorPlayerId)
        .find((action: any) => action.type === type && (!predicate || predicate(action)));
}

const tests: UnifiedTestCase[] = [
    {
        testId: 'BT05-023-Escape',
        name: '이스케이프: 손패를 버리고 낮은 파워 상대를 트래시한 뒤 자신을 덱 맨 아래로 이동',
        description: 'BT05-023의 이스케이프 코스트/타깃/덱 맨 아래 이동을 확인한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.unitZones[0].unit = getCard('BT05-023');
            p1.hand = [getCard('ST01-011')];
            p2.unitZones[0].unit = getCard('ST01-002');
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.DRAW;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.nextPhase();
            const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
            if (confirm) engine.step(confirm);
            const payCost = findAction(engine, p1.id, 'SELECT_COST_HAND');
            if (payCost) engine.step(payCost);
            const pickTarget = findAction(
                engine,
                p1.id,
                'SELECT_ZONE_TARGET',
                (action: any) => action.targetPlayerId === p2.id && action.zoneIndex === 0,
            );
            if (pickTarget) engine.step(pickTarget);
            return [
                { pass: !!confirm && !!payCost && !!pickTarget, message: '선택/코스트/대상 지정 성공' },
                { pass: p2.unitZones[0].unit === null, message: '상대 유닛 트래시 성공' },
                { pass: p1.unitZones[0].unit === null, message: '본체 필드 이탈 성공' },
                { pass: p1.deck[0]?.id.startsWith('BT05-023') === true, message: '본체 덱 맨 아래 이동 성공' },
                { pass: p1.trash.some((card: Card) => card.id.startsWith('ST01-011')), message: '손패 코스트 트래시 성공' },
            ];
        },
    },
    {
        testId: 'BT05-051-Entry',
        name: '엔트리: 조우 유닛 귀환 후 자신의 히트를 1로 설정',
        description: 'BT05-051의 코스트 지불 후 조우 유닛 귀환과 히트 설정을 확인한다.',
        coversEffectIndices: [0, 1],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.leaderLevel = 10;
            p1.hand = [getCard('BT05-051'), getCard('ST01-011')];
            p2.unitZones[0].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.playUnit(0, 0);
            const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
            if (confirm) engine.step(confirm);
            const payCost = findAction(engine, p1.id, 'SELECT_COST_HAND');
            if (payCost) engine.step(payCost);
            return [
                { pass: !!confirm && !!payCost, message: '옵션 선택 및 코스트 지불 성공' },
                { pass: p2.unitZones[0].unit === null, message: '조우 유닛 필드 이탈' },
                { pass: p2.hand.some((card: Card) => card.id.startsWith('ST01-002')), message: '조우 유닛 패 복귀 성공' },
                { pass: engine.getUnitHit(p1.unitZones[0], p1) === 1, message: '자신의 히트가 1로 설정됨' },
            ];
        },
    },
    {
        testId: 'BT05-055-Entry',
        name: '믹스 엔트리: 이스케이프 유닛을 덱 맨 아래로 보내고 1대미지',
        description: 'BT05-055의 엔트리 선택 효과를 확인한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.leaderLevel = 10;
            p1.hand = [getCard('BT05-055')];
            p1.unitZones[0].unit = getCard('BT05-048');
            p1.unitZones[2].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            const damageBefore = p2.damage.length;
            engine.playUnit(0, 1);
            const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
            if (confirm) engine.step(confirm);
            const pickTarget = findAction(
                engine,
                p1.id,
                'SELECT_ZONE_TARGET',
                (action: any) => action.targetPlayerId === p1.id && action.zoneIndex === 0,
            );
            if (pickTarget) engine.step(pickTarget);
            return [
                { pass: !!confirm && !!pickTarget, message: '옵션 선택 및 대상 지정 성공' },
                { pass: p1.unitZones[0].unit === null, message: '대상 유닛 필드 이탈' },
                { pass: p1.deck[0]?.id.startsWith('BT05-048') === true, message: '대상 유닛 덱 맨 아래 이동 성공' },
                { pass: p2.damage.length === damageBefore + 1, message: '이스케이프 보너스 1대미지 성공' },
            ];
        },
    },
    {
        testId: 'BT05-063-Leader',
        name: '각성면 액티브: 손패를 버리고 다른 이름의 아이템 장착',
        description: 'BT05-063의 디스카드 후 트래시 아이템 장착을 확인한다.',
        coversEffectIndices: [2],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.levelZone = getCard('BT05-063');
            if (p1.levelZone) p1.levelZone.isAwakened = true;
            p1.leaderLevel = 5;
            p1.hand = [getCard('ST01-011')];
            p1.trash = [getCard('BT05-081')];
            p1.unitZones[0].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.activateEffect(0, 2, 'LEADER');
            const pickHand = findAction(engine, p1.id, 'SELECT_HAND_TARGET', (action: any) => p1.hand[action.handIndex]?.id.startsWith('ST01-011'));
            if (pickHand) engine.step(pickHand);
            const pickItem = findAction(
                engine,
                p1.id,
                'SELECT_REVEALED_TARGET',
                (action: any) => engine.state.revealedCards[action.revealedIndex]?.id.startsWith('BT05-081'),
            );
            if (pickItem) engine.step(pickItem);
            const pickZone = findAction(
                engine,
                p1.id,
                'SELECT_ZONE_TARGET',
                (action: any) => action.targetPlayerId === p1.id && action.zoneIndex === 0,
            );
            if (pickZone) engine.step(pickZone);
            return [
                { pass: !!pickHand && !!pickItem && !!pickZone, message: '패/아이템/장착 대상 선택 성공' },
                { pass: p1.trash.some((card: Card) => card.id.startsWith('ST01-011')), message: '패 코스트 트래시 성공' },
                { pass: p1.unitZones[0].items.some((item: Card) => item.id.startsWith('BT05-081')), message: '트래시 아이템 장착 성공' },
            ];
        },
    },
    {
        testId: 'BT05-072-Entry',
        name: '엔트리: 상단 3장 공개 후 선택 카드만 트래시',
        description: 'BT05-072의 공개/선택 트래시/남은 카드 셔플 복귀를 확인한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.leaderLevel = 10;
            p1.hand = [getCard('BT05-072')];
            p1.deck = [getCard('ST01-011'), getCard('BT05-081'), getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.playUnit(0, 0);
            const pickItem = findAction(
                engine,
                p1.id,
                'SELECT_REVEALED_TARGET',
                (action: any) => engine.state.revealedCards[action.revealedIndex]?.id.startsWith('BT05-081'),
            );
            if (pickItem) engine.step(pickItem);
            const pickUnit = findAction(
                engine,
                p1.id,
                'SELECT_REVEALED_TARGET',
                (action: any) => engine.state.revealedCards[action.revealedIndex]?.id.startsWith('ST01-002'),
            );
            if (pickUnit) engine.step(pickUnit);
            const confirm = findAction(engine, p1.id, 'CONFIRM_TARGETS');
            if (confirm) engine.step(confirm);
            return [
                { pass: !!pickItem && !!pickUnit && !!confirm, message: '공개 카드 다중 선택 및 확정 성공' },
                { pass: p1.trash.some((card: Card) => card.id.startsWith('BT05-081')), message: '선택한 아이템 트래시 성공' },
                { pass: p1.trash.some((card: Card) => card.id.startsWith('ST01-002')), message: '선택한 유닛 트래시 성공' },
                { pass: p1.trash.every((card: Card) => !card.id.startsWith('ST01-011')), message: '미선택 카드는 트래시되지 않음' },
                { pass: engine.state.revealedCards.length === 0, message: '공개 카드 정리 완료' },
            ];
        },
    },
    {
        testId: 'BT05-077-Active',
        name: '액티브: 트래시 아이템 장착 후 믹스면 자신을 트래시',
        description: 'BT05-077의 장착과 자가 트래시를 확인한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.leaderLevel = 10;
            p1.hand = [getCard('BT05-077')];
            p1.unitZones[0].unit = getCard('ST01-002');
            p1.trash = [getCard('BT05-081')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.playSkill(0);
            const pickItem = findAction(
                engine,
                p1.id,
                'SELECT_REVEALED_TARGET',
                (action: any) => engine.state.revealedCards[action.revealedIndex]?.id.startsWith('BT05-081'),
            );
            if (pickItem) engine.step(pickItem);
            const pickZone = findAction(
                engine,
                p1.id,
                'SELECT_ZONE_TARGET',
                (action: any) => action.targetPlayerId === p1.id && action.zoneIndex === 0,
            );
            if (pickZone) engine.step(pickZone);
            return [
                { pass: !!pickItem && !!pickZone, message: '아이템 및 장착 대상 선택 성공' },
                { pass: p1.unitZones[0].items.some((item: Card) => item.id.startsWith('BT05-081')), message: '아이템 장착 성공' },
                { pass: p1.trash.some((card: Card) => card.id.startsWith('BT05-077')), message: '믹스 조건 자가 트래시 성공' },
                { pass: p1.skillZone.every((card: Card) => !card.id.startsWith('BT05-077')), message: '스킬 존에서 제거됨' },
            ];
        },
    },
];

export const BT05Module: UnifiedTestModule = {
    packId: 'BT05',
    displayName: 'BT05 Unified Tests',
    tests,
};
