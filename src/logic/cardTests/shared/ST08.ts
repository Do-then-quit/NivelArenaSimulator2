/**
 * ST08 Anniversary Starter Unified Tests
 */

import { UnifiedTestCase, UnifiedTestModule, Phase } from './types';
import { Card } from '../../types';

function findAction(engine: any, actorPlayerId: string, type: string, predicate?: (action: any) => boolean) {
    return engine
        .getLegalActions(actorPlayerId)
        .find((action: any) => action.type === type && (!predicate || predicate(action)));
}

const tests: UnifiedTestCase[] = [
    {
        testId: 'ST08-002-Entry',
        name: '문제아 니키 크레딧 엔트리 1드로우',
        description: '크레딧으로 배치 시 덱에서 1장 드로우한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.leaderLevel = 10;
            p1.hand = [getCard('ST08-002')];
            p1.deck = [getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.playUnit(0, 0);
            return [
                { pass: p1.unitZones[0].unit?.id.startsWith('ST08-002') === true, message: '유닛 배치 성공' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith('ST01-002')), message: '크레딧 1드로우 성공' },
            ];
        },
    },
    {
        testId: 'ST08-002-Exit',
        name: '문제아 니키 크레딧 엑시트 1버림',
        description: '필드에서 트래시되면 손패 1장을 선택해 트래시한다.',
        coversEffectIndices: [1],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard('ST08-002');
            p1.hand = [getCard('ST01-002'), getCard('ST01-011')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
            const pick = findAction(engine, p1.id, 'SELECT_HAND_TARGET', (action: any) => p1.hand[action.handIndex]?.id.startsWith('ST01-002'));
            if (pick) engine.step(pick);
            return [
                { pass: !!pick, message: '버릴 손패 1장 선택 가능' },
                { pass: p1.trash.some((card: Card) => card.id.startsWith('ST08-002')), message: '본체 트래시 이동' },
                { pass: p1.trash.some((card: Card) => card.id.startsWith('ST01-002')), message: '손패 1장 트래시 성공' },
            ];
        },
    },
    {
        testId: 'ST08-003',
        name: '레니 이스케이프 레벨업',
        description: '메인 시작 시 자신을 덱 맨 아래로 돌리고 리더 레벨을 1 올린다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard('ST08-003');
            p1.leaderLevel = 3;
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.DRAW;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.nextPhase();
            return [
                { pass: engine.state.phase === Phase.MAIN, message: '메인 페이즈 진입' },
                { pass: p1.unitZones[0].unit === null, message: '이스케이프로 필드 이탈' },
                { pass: p1.deck[0]?.id.startsWith('ST08-003') === true, message: '덱 맨 아래로 이동' },
                { pass: p1.leaderLevel === 4, message: `리더 레벨 +1 (${p1.leaderLevel})` },
            ];
        },
    },
    {
        testId: 'ST08-005-Entry',
        name: '학생회장 엘레나 크레딧 엔트리 1드로우',
        description: '크레딧으로 배치 시 덱에서 1장 드로우한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.leaderLevel = 10;
            p1.hand = [getCard('ST08-005')];
            p1.deck = [getCard('ST01-011')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.playUnit(0, 0);
            return [
                { pass: p1.unitZones[0].unit?.id.startsWith('ST08-005') === true, message: '유닛 배치 성공' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith('ST01-011')), message: '크레딧 1드로우 성공' },
            ];
        },
    },
    {
        testId: 'ST08-005-Exit',
        name: '학생회장 엘레나 크레딧 엑시트 1버림',
        description: '필드에서 트래시되면 손패 1장을 선택해 트래시한다.',
        coversEffectIndices: [1],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard('ST08-005');
            p1.hand = [getCard('ST01-002'), getCard('ST01-011')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
            const pick = findAction(engine, p1.id, 'SELECT_HAND_TARGET', (action: any) => p1.hand[action.handIndex]?.id.startsWith('ST01-011'));
            if (pick) engine.step(pick);
            return [
                { pass: !!pick, message: '버릴 손패 1장 선택 가능' },
                { pass: p1.trash.some((card: Card) => card.id.startsWith('ST08-005')), message: '본체 트래시 이동' },
                { pass: p1.trash.some((card: Card) => card.id.startsWith('ST01-011')), message: '손패 1장 트래시 성공' },
            ];
        },
    },
    {
        testId: 'ST08-008',
        name: '가르쳐 드리죠 리더 레벨 +1',
        description: '스킬 사용 시 자신의 리더 레벨이 1 오른다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.leaderLevel = 4;
            p1.hand = [getCard('ST08-008')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.playSkill(0);
            return [
                { pass: p1.skillZone.some((card: Card) => card.id.startsWith('ST08-008')), message: '스킬 존 발동 성공' },
                { pass: p1.leaderLevel === 5, message: `리더 레벨 +1 (${p1.leaderLevel})` },
            ];
        },
    },
    {
        testId: 'ST08-009',
        name: '같이 한잔하겠어 공개 후 빈 존 배치',
        description: '덱 맨 위 유닛을 공개하면 빈 유닛 존에 사이즈를 무시하고 배치한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.leaderLevel = 10;
            p1.hand = [getCard('ST08-009')];
            p1.deck = [getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.playSkill(0);
            const pickZone = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) => action.targetPlayerId === p1.id && action.zoneIndex === 0);
            if (pickZone) engine.step(pickZone);
            return [
                { pass: !!pickZone, message: '빈 유닛 존 선택 가능' },
                { pass: p1.unitZones[0].unit?.id.startsWith('ST01-002') === true, message: '공개 유닛 배치 성공' },
                { pass: p1.skillZone.some((card: Card) => card.id.startsWith('ST08-009')), message: '스킬 존 유지' },
            ];
        },
    },
    {
        testId: 'ST08-010',
        name: '뿅망치 장착 파워 +1000',
        description: '장착한 유닛이 아이템 기본 효과로 파워+1000을 얻는다.',
        coversEffectIndices: [0, 1],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.leaderLevel = 10;
            p1.unitZones[0].unit = getCard('ST08-003');
            p1.hand = [getCard('ST08-010')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const before = engine.getUnitPower(p1.unitZones[0], p1);
            engine.playItem(0, 0);
            const after = engine.getUnitPower(p1.unitZones[0], p1);
            return [
                { pass: p1.unitZones[0].items.some((card: Card) => card.id.startsWith('ST08-010')), message: '아이템 장착 성공' },
                { pass: after === before + 1000, message: `장착 파워 +1000 (${after})` },
            ];
        },
    },
    {
        testId: 'ST08-011-Entry',
        name: '유스티나 크레딧 엔트리 1드로우',
        description: '크레딧으로 배치 시 덱에서 1장 드로우한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.leaderLevel = 10;
            p1.hand = [getCard('ST08-011')];
            p1.deck = [getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.playUnit(0, 0);
            return [
                { pass: p1.unitZones[0].unit?.id.startsWith('ST08-011') === true, message: '유닛 배치 성공' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith('ST01-002')), message: '크레딧 1드로우 성공' },
            ];
        },
    },
    {
        testId: 'ST08-011-Exit',
        name: '유스티나 크레딧 엑시트 1버림',
        description: '필드에서 트래시되면 손패 1장을 선택해 트래시한다.',
        coversEffectIndices: [1],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard('ST08-011');
            p1.hand = [getCard('ST01-002'), getCard('ST01-011')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
            const pick = findAction(engine, p1.id, 'SELECT_HAND_TARGET', (action: any) => p1.hand[action.handIndex]?.id.startsWith('ST01-011'));
            if (pick) engine.step(pick);
            return [
                { pass: !!pick, message: '버릴 손패 1장 선택 가능' },
                { pass: p1.trash.some((card: Card) => card.id.startsWith('ST08-011')), message: '본체 트래시 이동' },
                { pass: p1.trash.some((card: Card) => card.id.startsWith('ST01-011')), message: '손패 1장 트래시 성공' },
            ];
        },
    },
    {
        testId: 'ST08-011-Attacker',
        name: '유스티나 어태커 +2000',
        description: '공격 시 +2000을 얻어 3000 조우를 이긴다.',
        coversEffectIndices: [2],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.unitZones[0].unit = getCard('ST08-011');
            p2.unitZones[0].unit = getCard('ST10-008');
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.attack(0);
            const block = findAction(engine, p2.id, 'RESOLVE_BLOCK', (action: any) => action.shouldBlock && action.blockerZoneIndex === 0);
            if (block) engine.step(block);
            return [
                { pass: p1.unitZones[0].unit !== null, message: '공격 유닛 생존' },
                { pass: p2.unitZones[0].unit === null, message: '조우 유닛 트래시' },
            ];
        },
    },
    {
        testId: 'ST08-012-Entry',
        name: '발렌타인 이바 크레딧 엔트리 1드로우',
        description: '크레딧으로 배치 시 덱에서 1장 드로우한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.leaderLevel = 10;
            p1.hand = [getCard('ST08-012')];
            p1.deck = [getCard('ST01-011')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.playUnit(0, 0);
            return [
                { pass: p1.unitZones[0].unit?.id.startsWith('ST08-012') === true, message: '유닛 배치 성공' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith('ST01-011')), message: '크레딧 1드로우 성공' },
            ];
        },
    },
    {
        testId: 'ST08-012-Exit',
        name: '발렌타인 이바 크레딧 엑시트 1버림',
        description: '필드에서 트래시되면 손패 1장을 선택해 트래시한다.',
        coversEffectIndices: [1],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard('ST08-012');
            p1.hand = [getCard('ST01-002'), getCard('ST01-011')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
            const pick = findAction(engine, p1.id, 'SELECT_HAND_TARGET', (action: any) => p1.hand[action.handIndex]?.id.startsWith('ST01-002'));
            if (pick) engine.step(pick);
            return [
                { pass: !!pick, message: '버릴 손패 1장 선택 가능' },
                { pass: p1.trash.some((card: Card) => card.id.startsWith('ST08-012')), message: '본체 트래시 이동' },
                { pass: p1.trash.some((card: Card) => card.id.startsWith('ST01-002')), message: '손패 1장 트래시 성공' },
            ];
        },
    },
    {
        testId: 'ST08-012-Attacker',
        name: '발렌타인 이바 어태커 +3000',
        description: '공격 시 +3000을 얻어 4500 조우를 이긴다.',
        coversEffectIndices: [2],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.unitZones[0].unit = getCard('ST08-012');
            p2.unitZones[0].unit = getCard('ST11-002');
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.attack(0);
            const block = findAction(engine, p2.id, 'RESOLVE_BLOCK', (action: any) => action.shouldBlock && action.blockerZoneIndex === 0);
            if (block) engine.step(block);
            return [
                { pass: p1.unitZones[0].unit !== null, message: '공격 유닛 생존' },
                { pass: p2.unitZones[0].unit === null, message: '조우 유닛 트래시' },
            ];
        },
    },
    {
        testId: 'ST08-001-Awaken',
        name: '1st Anniversary 수아 각성',
        description: '리더 레벨 7 이상이면 리더가 각성한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.levelZone = getCard('ST08-001');
            p1.leaderLevel = 7;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.checkAwakening(0);
            return [
                { pass: p1.levelZone?.id === 'ST08-001', message: 'ST08 리더 세팅' },
                { pass: p1.levelZone?.isAwakened === true, message: '리더 각성 성공' },
            ];
        },
    },
    {
        testId: 'ST08-001-AwakenDraw',
        name: '1st Anniversary 수아 각성 후 상대 선택 드로우',
        description: '비대지 카드가 있으면 상대가 1드로우 여부를 선택할 수 있다.',
        coversEffectIndices: [1],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.levelZone = getCard('ST08-001');
            p1.leaderLevel = 7;
            p1.skillZone = [getCard('ST08-015')];
            p2.deck = [getCard('ST01-002')];
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.checkAwakening(0);
            const confirm = findAction(engine, p2.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
            if (confirm) engine.step(confirm);
            return [
                { pass: p1.levelZone?.isAwakened === true, message: '리더 각성 유지' },
                { pass: !!confirm, message: '상대 드로우 선택 가능' },
                { pass: p2.hand.some((card: Card) => card.id === 'ST01-002'), message: '상대 1드로우 성공' },
            ];
        },
    },
    {
        testId: 'ST08-001-Active',
        name: '1st Anniversary 수아 각성면 공개 배치',
        description: '패 1장을 트래시하고 덱 맨 위 유닛을 빈 존에 배치한다.',
        coversEffectIndices: [2],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.levelZone = getCard('ST08-001');
            p1.levelZone.isAwakened = true;
            p1.leaderLevel = 7;
            p1.hand = [getCard('ST08-015')];
            p1.deck = [getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const active = findAction(engine, p1.id, 'ACTIVATE_EFFECT', (action: any) =>
                action.sourceType === 'LEADER' &&
                action.effectIndex === 2
            );
            if (active) engine.step(active);
            const payCost = findAction(engine, p1.id, 'SELECT_COST_HAND', (action: any) => p1.hand[action.handIndex]?.id === 'ST08-015');
            if (payCost) engine.step(payCost);
            const pickZone = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) =>
                action.targetPlayerId === p1.id &&
                action.zoneIndex === 0
            );
            if (pickZone) engine.step(pickZone);
            return [
                { pass: !!active, message: '리더 각성면 액티브 사용 가능' },
                { pass: !!payCost, message: '패 1장 코스트 지불 선택 가능' },
                { pass: !!pickZone, message: '빈 유닛 존 선택 가능' },
                { pass: p1.trash.some((card: Card) => card.id === 'ST08-015'), message: '패 코스트 트래시 성공' },
                { pass: p1.unitZones[0].unit?.id === 'ST01-002', message: '덱 맨 위 유닛 배치 성공' },
            ];
        },
    },
    {
        testId: 'ST08-004-Active',
        name: '불꽃놀이 아야 액티브 메인 손패 배치',
        description: '손패 유닛을 빈 존에 배치하고 그 턴에는 공격할 수 없게 만든다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.leaderLevel = 4;
            p1.unitZones[0].unit = getCard('ST08-004');
            p1.hand = [getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const active = findAction(engine, p1.id, 'ACTIVATE_EFFECT', (action: any) =>
                action.zoneIndex === 0 &&
                action.sourceType === 'UNIT' &&
                action.effectIndex === 0
            );
            if (active) engine.step(active);
            const pickHand = findAction(engine, p1.id, 'SELECT_HAND_TARGET', (action: any) => p1.hand[action.handIndex]?.id === 'ST01-002');
            if (pickHand) engine.step(pickHand);
            const pickZone = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) =>
                action.targetPlayerId === p1.id &&
                action.zoneIndex === 1
            );
            if (pickZone) engine.step(pickZone);
            engine.nextPhase();
            const canAttack = engine.getLegalActions(p1.id).some((action: any) => action.type === 'ATTACK' && action.attackerZoneIndex === 1);
            return [
                { pass: !!active, message: '아야 액티브 사용 가능' },
                { pass: !!pickHand, message: '손패 유닛 선택 가능' },
                { pass: !!pickZone, message: '빈 유닛 존 선택 가능' },
                { pass: p1.unitZones[1].unit?.id === 'ST01-002', message: '손패 유닛 배치 성공' },
                { pass: canAttack === false, message: '이번 턴 공격 불가 적용' },
            ];
        },
    },
    {
        testId: 'ST08-004-Trigger',
        name: '불꽃놀이 아야 트리거 패 회수',
        description: '대미지 트리거로 공개되면 자신 패로 들어온다.',
        coversEffectIndices: [1],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.deck = [getCard('ST08-004')];
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.dealDamage(p1, 1);
            return [
                { pass: p1.hand.some((card: Card) => card.id === 'ST08-004'), message: '트리거로 패 회수 성공' },
                { pass: p1.damage.every((card: Card) => card.id !== 'ST08-004'), message: '대미지 존에서 이동 완료' },
            ];
        },
    },
    {
        testId: 'ST08-013-Entry',
        name: '작전 교관 라우라 크레딧 엔트리 2드로우',
        description: '크레딧으로 배치 시 덱에서 2장 드로우한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.leaderLevel = 10;
            p1.hand = [getCard('ST08-013')];
            p1.deck = [getCard('ST01-002'), getCard('ST01-011')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.playUnit(0, 0);
            return [
                { pass: p1.unitZones[0].unit?.id === 'ST08-013', message: '유닛 배치 성공' },
                { pass: p1.hand.some((card: Card) => card.id === 'ST01-002'), message: '첫 번째 드로우 성공' },
                { pass: p1.hand.some((card: Card) => card.id === 'ST01-011'), message: '두 번째 드로우 성공' },
            ];
        },
    },
    {
        testId: 'ST08-013-Exit',
        name: '작전 교관 라우라 크레딧 엑시트 2버림',
        description: '필드에서 트래시되면 손패 2장을 골라 트래시한다.',
        coversEffectIndices: [1],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard('ST08-013');
            p1.hand = [getCard('ST01-002'), getCard('ST01-011'), getCard('ST07-017')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
            const first = findAction(engine, p1.id, 'SELECT_HAND_TARGET', (action: any) => p1.hand[action.handIndex]?.id === 'ST01-002');
            if (first) engine.step(first);
            const second = findAction(engine, p1.id, 'SELECT_HAND_TARGET', (action: any) => p1.hand[action.handIndex]?.id === 'ST01-011');
            if (second) engine.step(second);
            const confirm = findAction(engine, p1.id, 'CONFIRM_TARGETS');
            if (confirm) engine.step(confirm);
            return [
                { pass: !!first && !!second, message: '손패 2장 선택 가능' },
                { pass: !!confirm, message: '2장 선택 후 확인 가능' },
                { pass: p1.trash.some((card: Card) => card.id === 'ST08-013'), message: '본체 트래시 이동' },
                { pass: p1.trash.some((card: Card) => card.id === 'ST01-002'), message: '첫 번째 손패 트래시 성공' },
                { pass: p1.trash.some((card: Card) => card.id === 'ST01-011'), message: '두 번째 손패 트래시 성공' },
            ];
        },
    },
    {
        testId: 'ST08-013-Attacker',
        name: '작전 교관 라우라 어태커 +4000',
        description: '공격 시 +4000을 얻어 5000 조우를 이긴다.',
        coversEffectIndices: [2],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.unitZones[0].unit = getCard('ST08-013');
            p2.unitZones[0].unit = getCard('ST08-006');
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.attack(0);
            const block = findAction(engine, p2.id, 'RESOLVE_BLOCK', (action: any) => action.shouldBlock && action.blockerZoneIndex === 0);
            if (block) engine.step(block);
            return [
                { pass: p1.unitZones[0].unit !== null, message: '공격 유닛 생존' },
                { pass: p2.unitZones[0].unit === null, message: '조우 유닛 트래시' },
            ];
        },
    },
    {
        testId: 'ST08-015',
        name: '전체 주목! 어태커 버프 후 트래시 스킬 회수',
        description: '자신 유닛에 +2000을 주고 어태커면 2코스트 비트리거 스킬을 패로 회수한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.leaderLevel = 10;
            p1.unitZones[0].unit = getCard('ST08-011');
            p1.hand = [getCard('ST08-015')];
            p1.trash = [getCard('ST08-009'), getCard('ST08-004')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const before = engine.getUnitPower(p1.unitZones[0], p1);
            engine.playSkill(0);
            const pickUnit = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) =>
                action.targetPlayerId === p1.id &&
                action.zoneIndex === 0
            );
            if (pickUnit) engine.step(pickUnit);
            const recover = findAction(engine, p1.id, 'SELECT_TRASH_TARGET', (action: any) => p1.trash[action.trashIndex]?.id === 'ST08-009');
            if (recover) engine.step(recover);
            const invalidRecover = findAction(engine, p1.id, 'SELECT_TRASH_TARGET', (action: any) => p1.trash[action.trashIndex]?.id === 'ST08-004');
            const after = engine.getUnitPower(p1.unitZones[0], p1);
            return [
                { pass: !!pickUnit, message: '버프할 아군 유닛 선택 가능' },
                { pass: !!recover, message: '회수할 2코스트 비트리거 스킬 선택 가능' },
                { pass: !invalidRecover, message: '트리거 스킬은 회수 대상 제외' },
                { pass: after === before + 2000, message: `파워 +2000 적용 (${after})` },
                { pass: p1.hand.some((card: Card) => card.id === 'ST08-009'), message: '트래시 스킬 패 회수 성공' },
            ];
        },
    },
    {
        testId: 'ST08-006-Passive',
        name: '1st Anniversary 수아 레벨링크 6 다른 아군 +2000',
        description: '리더 레벨 6 이상이면 다른 모든 아군 유닛만 +2000을 얻는다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.leaderLevel = 6;
            p1.unitZones[0].unit = getCard('ST08-006');
            p1.unitZones[1].unit = getCard('ST08-011');
            p1.unitZones[2].unit = getCard('ST08-012');
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            return [
                { pass: engine.getUnitPower(p1.unitZones[0], p1) === 5000, message: '자신은 버프 제외' },
                { pass: engine.getUnitPower(p1.unitZones[1], p1) === 3500, message: '다른 아군 1 +2000 적용' },
                { pass: engine.getUnitPower(p1.unitZones[2], p1) === 4000, message: '다른 아군 2 +2000 적용' },
            ];
        },
    },
    {
        testId: 'ST08-006-Escape',
        name: '1st Anniversary 수아 레벨링크 8 이스케이프 공개 배치',
        description: '자신을 덱 맨 아래로 돌린 뒤 3장을 공개해 유닛을 배치하고 0코스트/+5000/+1히트를 준다.',
        coversEffectIndices: [1],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard('ST08-006');
            p1.leaderLevel = 8;
            p1.deck = [getCard('ST08-015'), getCard('ST08-008'), getCard('ST01-002')];
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.DRAW;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.nextPhase();
            const pickRevealed = findAction(engine, p1.id, 'SELECT_REVEALED_TARGET', (action: any) =>
                engine.state.revealedCards[action.revealedIndex]?.id === 'ST01-002'
            );
            if (pickRevealed) engine.step(pickRevealed);
            const pickZone = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) =>
                action.targetPlayerId === p1.id &&
                action.zoneIndex === 0
            );
            if (pickZone) engine.step(pickZone);
            return [
                { pass: p1.deck[0]?.id === 'ST08-006', message: '본체가 덱 맨 아래로 이동' },
                { pass: !!pickRevealed && !!pickZone, message: '공개 카드와 빈 존 선택 가능' },
                { pass: p1.unitZones[0].unit?.id === 'ST01-002', message: '공개 유닛 배치 성공' },
                { pass: p1.unitZones[0].unit?.turnCostOverride?.cost === 0, message: '턴 한정 0코스트 적용' },
                { pass: engine.getUnitPower(p1.unitZones[0], p1) === 8000, message: '파워 +5000 적용' },
                { pass: engine.getUnitHit(p1.unitZones[0], p1) === 2, message: '히트 +1 적용' },
                { pass: p1.trash.some((card: Card) => card.id === 'ST08-015') && p1.trash.some((card: Card) => card.id === 'ST08-008'), message: '선택하지 않은 공개 카드는 트래시' },
            ];
        },
    },
    {
        testId: 'ST08-006-TriggerTrash',
        name: '1st Anniversary 수아 트리거 선택 트래시',
        description: '트리거에서 확인을 선택하면 이 카드가 대미지 존에서 트래시로 이동한다.',
        coversEffectIndices: [2],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.deck = [getCard('ST08-006')];
            p1.leaderLevel = 3;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.dealDamage(p1, 1);
            const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
            if (confirm) engine.step(confirm);
            return [
                { pass: !!confirm, message: '트리거 선택창 확인 가능' },
                { pass: p1.trash.some((card: Card) => card.id === 'ST08-006'), message: '대미지 존에서 트래시 이동' },
                { pass: p1.damage.every((card: Card) => card.id !== 'ST08-006'), message: '대미지 존에서 제거 완료' },
                { pass: p1.leaderLevel === 3, message: '리더 레벨은 유지' },
            ];
        },
    },
    {
        testId: 'ST08-006-TriggerLevel',
        name: '1st Anniversary 수아 트리거 스킵 레벨업',
        description: '트리거에서 취소를 선택하면 카드는 대미지 존에 남고 리더 레벨이 1 오른다.',
        coversEffectIndices: [3],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.deck = [getCard('ST08-006')];
            p1.leaderLevel = 3;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.dealDamage(p1, 1);
            const skip = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === false);
            if (skip) engine.step(skip);
            return [
                { pass: !!skip, message: '트리거 스킵 선택 가능' },
                { pass: p1.leaderLevel === 4, message: '리더 레벨 +1 적용' },
                { pass: p1.damage.some((card: Card) => card.id === 'ST08-006'), message: '카드는 대미지 존 유지' },
            ];
        },
    },
    {
        testId: 'ST08-007',
        name: '요밀로 이스케이프 후 상대 손패 유닛 배치 반응',
        description: '이스케이프 후 상대가 손패에서 파워 4000 이하 유닛을 배치하면 1드로우와 1대미지를 준다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.unitZones[0].unit = getCard('ST08-007');
            p1.deck = [getCard('ST01-002')];
            p1.leaderLevel = 10;
            p2.hand = [getCard('ST01-002')];
            p2.deck = [getCard('ST08-015')];
            p2.leaderLevel = 10;
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.DRAW;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.nextPhase();
            engine.state.turnPlayerIndex = 1;
            engine.state.phase = Phase.MAIN;
            engine.playUnit(0, 0);
            return [
                { pass: p1.unitZones[0].unit === null, message: '이스케이프로 본체 이탈' },
                { pass: p1.deck[0]?.id === 'ST08-007', message: '본체가 덱 맨 아래 이동' },
                { pass: p1.hand.some((card: Card) => card.id === 'ST01-002'), message: '반응 1드로우 성공' },
                { pass: p2.damage.length === 1, message: '상대에게 1대미지 성공' },
                { pass: p2.unitZones[0].unit?.id === 'ST01-002', message: '상대 손패 유닛 배치 자체는 유지' },
            ];
        },
    },
    {
        testId: 'ST08-014-Passive',
        name: '타락의 유열 샬럿 패 장수 연동 파워 감소',
        description: '자신의 패가 줄어들수록 동적으로 파워 감소량이 줄어든다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard('ST08-014');
            p1.hand = [getCard('ST01-002'), getCard('ST01-011'), getCard('ST08-015')];
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const withThree = engine.getUnitPower(p1.unitZones[0], p1);
            p1.hand.pop();
            const withTwo = engine.getUnitPower(p1.unitZones[0], p1);
            return [
                { pass: withThree === 8000, message: '패 3장일 때 8000' },
                { pass: withTwo === 9000, message: '패 2장일 때 9000으로 동적 갱신' },
            ];
        },
    },
    {
        testId: 'ST08-014-Active',
        name: '타락의 유열 샬럿 액티브 어택 추가 공격',
        description: '파워가 11000 이상이면 어택 페이즈 중 추가 공격 1회를 얻는다.',
        coversEffectIndices: [1],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard('ST08-014');
            p1.hand = [];
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const active = findAction(engine, p1.id, 'ACTIVATE_EFFECT', (action: any) =>
                action.zoneIndex === 0 &&
                action.sourceType === 'UNIT' &&
                action.effectIndex === 1
            );
            if (active) engine.step(active);
            return [
                { pass: !!active, message: '어택 페이즈 액티브 사용 가능' },
                { pass: (p1.unitZones[0].extraAttackAllowance || 0) >= 1, message: '추가 공격 1회 부여' },
            ];
        },
    },
    {
        testId: 'ST08-014-Trigger',
        name: '타락의 유열 샬럿 트리거 패 회수',
        description: '대미지 트리거로 공개되면 자신 패로 들어온다.',
        coversEffectIndices: [2],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.deck = [getCard('ST08-014')];
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.dealDamage(p1, 1);
            return [
                { pass: p1.hand.some((card: Card) => card.id === 'ST08-014'), message: '트리거 패 회수 성공' },
                { pass: p1.damage.every((card: Card) => card.id !== 'ST08-014'), message: '대미지 존에서 이동 완료' },
            ];
        },
    },
    {
        testId: 'ST08-016-Active',
        name: '타락의 유열 속으로 스킬 존 전부 트래시 후 1대미지',
        description: '스킬 존 3장을 모두 트래시하고 상대에게 1대미지를 준다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.leaderLevel = 10;
            p1.skillZone = [getCard('ST08-008'), getCard('ST08-009')];
            p1.hand = [getCard('ST08-016')];
            p1.deck = [getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.playSkill(0);
            return [
                { pass: p1.skillZone.length === 0, message: '자신 스킬 존 전부 트래시' },
                { pass: p1.trash.filter((card: Card) => ['ST08-008', 'ST08-009', 'ST08-016'].includes(card.id)).length === 3, message: '트래시된 스킬 3장 확인' },
                { pass: p2.damage.length === 1, message: '상대 1대미지 성공' },
            ];
        },
    },
    {
        testId: 'ST08-016-Lock',
        name: '타락의 유열 속으로 동일 스킬 턴 종료까지 잠금',
        description: '발동 후 같은 이름의 스킬을 같은 턴에 다시 사용할 수 없다.',
        coversEffectIndices: [1],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.leaderLevel = 10;
            p1.hand = [getCard('ST08-016'), getCard('ST08-016')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.playSkill(0);
            const replayAction = engine.getLegalActions(p1.id).find((action: any) =>
                action.type === 'PLAY_SKILL' &&
                p1.hand[action.handIndex]?.id === 'ST08-016'
            );
            return [
                { pass: p1.lockedSkillIdsUntilTurnEnd['ST08-016'] === true, message: '동일 스킬 잠금 적용' },
                { pass: !replayAction, message: '남은 동일 스킬 재발동 불가' },
            ];
        },
    },
    {
        testId: 'ST08-016-Trigger',
        name: '타락의 유열 속으로 트리거 패 회수',
        description: '대미지 트리거로 공개되면 자신 패로 들어온다.',
        coversEffectIndices: [2],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.deck = [getCard('ST08-016')];
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.dealDamage(p1, 1);
            return [
                { pass: p1.hand.some((card: Card) => card.id === 'ST08-016'), message: '트리거 패 회수 성공' },
                { pass: p1.damage.every((card: Card) => card.id !== 'ST08-016'), message: '대미지 존에서 이동 완료' },
            ];
        },
    },
    {
        testId: 'ST08-017-Equip',
        name: '더 썬 장착 조건 없음',
        description: '조건 없이 아군 유닛에 장착할 수 있다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.leaderLevel = 10;
            p1.unitZones[0].unit = getCard('ST08-004');
            p1.hand = [getCard('ST08-017')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.playItem(0, 0);
            return [
                { pass: p1.unitZones[0].items.some((card: Card) => card.id === 'ST08-017'), message: '아이템 장착 성공' },
            ];
        },
    },
    {
        testId: 'ST08-017-Attacker',
        name: '더 썬 어태커 패 차이만큼 조우 디버프',
        description: '손패 장수 차이가 2면 조우 유닛이 -2000 되어 전투 결과가 뒤집힌다.',
        coversEffectIndices: [1],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.unitZones[0].unit = getCard('ST08-004');
            p1.unitZones[0].items = [getCard('ST08-017')];
            p1.hand = [getCard('ST01-002'), getCard('ST01-011'), getCard('ST08-015')];
            p2.hand = [getCard('ST01-002')];
            p2.unitZones[0].unit = getCard('ST08-006');
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.attack(0);
            const block = findAction(engine, p2.id, 'RESOLVE_BLOCK', (action: any) => action.shouldBlock && action.blockerZoneIndex === 0);
            if (block) engine.step(block);
            return [
                { pass: p1.unitZones[0].unit !== null, message: '공격 유닛 생존' },
                { pass: p2.unitZones[0].unit === null, message: '조우 유닛 디버프 후 트래시' },
            ];
        },
    },
];

export const ST08Module: UnifiedTestModule = {
    packId: 'ST08',
    displayName: 'ST08 애니버서리 스타터',
    tests,
};
