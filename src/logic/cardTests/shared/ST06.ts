/**
 * ST06 Fire Starter Unified Tests
 */

import { UnifiedTestCase, UnifiedTestModule, Phase } from './types';
import { Card } from '../../types';

function findAction(engine: any, actorPlayerId: string, type: string, predicate?: (action: any) => boolean) {
    return engine
        .getLegalActions(actorPlayerId)
        .find((action: any) => action.type === type && (!predicate || predicate(action)));
}

function pickAndConfirmMultiTargets(engine: any, actorPlayerId: string, selector: (action: any) => boolean, maxPick = 99) {
    const picks = engine
        .getLegalActions(actorPlayerId)
        .filter((action: any) => selector(action))
        .slice(0, maxPick);
    picks.forEach((action: any) => engine.step(action));
    const confirm = findAction(engine, actorPlayerId, 'CONFIRM_TARGETS');
    if (confirm) engine.step(confirm);
}

const tests: UnifiedTestCase[] = [
    {
        testId: 'ST06-001',
        name: '리나크 리더 각성 및 각성면 액티브',
        description: '레벨 5 각성 후 0코스트 아군 유닛에 파워/히트를 부여한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.levelZone = getCard('ST06-001');
            p1.levelZone.isAwakened = false;
            p1.leaderLevel = 4;
            const zeroCost = getCard('ST06-004');
            zeroCost.cost = 0;
            p1.unitZones[0].unit = zeroCost;
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.LEVEL_UP;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.nextPhase();
            const awakened = p1.levelZone?.isAwakened === true;

            engine.state.phase = Phase.MAIN;
            const beforePower = engine.getUnitPower(p1.unitZones[0], p1);
            const beforeHit = engine.getUnitHit(p1.unitZones[0], p1);
            engine.activateEffect(0, 1, 'LEADER');
            const target = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) => action.zoneIndex === 0);
            if (target) engine.step(target);
            const afterPower = engine.getUnitPower(p1.unitZones[0], p1);
            const afterHit = engine.getUnitHit(p1.unitZones[0], p1);

            return [
                { pass: awakened, message: '리더 각성 성공' },
                { pass: afterPower === beforePower + 2000, message: '파워 +2000 부여' },
                { pass: afterHit === beforeHit + 1, message: '히트 +1 부여' },
            ];
        },
    },
    {
        testId: 'ST06-002',
        name: '소악마 루아 엔트리 다른 아군 +3000',
        description: '엔트리로 다른 자신 유닛 1장을 선택해 +3000을 부여한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.hand = [getCard('ST06-002')];
            p1.unitZones[1].unit = getCard('ST06-009');
            p1.leaderLevel = 10;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const before = engine.getUnitPower(p1.unitZones[1], p1);
            engine.playUnit(0, 0);
            const target = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) => action.zoneIndex === 1);
            if (target) engine.step(target);
            const after = engine.getUnitPower(p1.unitZones[1], p1);
            return [{ pass: after === before + 3000, message: '다른 아군 +3000 적용' }];
        },
    },
    {
        testId: 'ST06-003',
        name: '실크 엔트리 성약 카드 탐색',
        description: '덱 상위 5장 공개 후 성약 카드 1장을 패에 넣고 나머지 트래시.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.hand = [getCard('ST06-003')];
            p1.deck = [
                getCard('ST01-002'),
                getCard('ST06-009'),
                getCard('ST06-013'),
                getCard('ST06-014'),
                getCard('ST06-015'),
            ];
            p1.leaderLevel = 10;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.playUnit(0, 0);
            const pick = findAction(
                engine,
                p1.id,
                'SELECT_REVEALED_TARGET',
                (action: any) => engine.state.revealedCards[action.revealedIndex]?.id.startsWith('ST06-013'),
            );
            if (pick) engine.step(pick);
            return [
                { pass: p1.hand.some((card: Card) => card.id.startsWith('ST06-013')), message: '성약 카드 패 획득' },
                { pass: p1.trash.length >= 3, message: '비선택 카드 트래시' },
            ];
        },
    },
    {
        testId: 'ST06-004',
        name: '유나 패시브 중첩',
        description: '다른 계승자/과거혹은미래 아군 수만큼 파워가 증가한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard('ST06-004');
            p1.unitZones[1].unit = getCard('ST06-006');
            p1.unitZones[2].unit = getCard('ST06-007');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const power = engine.getUnitPower(p1.unitZones[0], p1);
            return [{ pass: power === 2500, message: `패시브 누적 파워 확인 (${power})` }];
        },
    },
    {
        testId: 'ST06-005',
        name: '데스티나 엔트리 계승자 탐색',
        description: '덱 상위 3장 공개 후 계승자 카드 1장을 패에 넣는다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.hand = [getCard('ST06-005')];
            p1.deck = [getCard('ST01-002'), getCard('ST06-006'), getCard('ST06-009')];
            p1.leaderLevel = 10;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.playUnit(0, 0);
            const pick = findAction(
                engine,
                p1.id,
                'SELECT_REVEALED_TARGET',
                (action: any) => engine.state.revealedCards[action.revealedIndex]?.id.startsWith('ST06-006'),
            );
            if (pick) engine.step(pick);
            return [{ pass: p1.hand.some((card: Card) => card.id.startsWith('ST06-006')), message: '계승자 카드 패 획득' }];
        },
    },
    {
        testId: 'ST06-006',
        name: '이세리아 엔트리로 다른 유닛 엔트리 선택 발동',
        description: '다른 계승자 유닛의 엔트리 효과를 선택해 발동할 수 있다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.hand = [getCard('ST06-006')];
            p1.unitZones[1].unit = getCard('ST06-004');
            p1.unitZones[2].unit = getCard('ST06-009');
            p1.leaderLevel = 10;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.playUnit(0, 0);

            const pickSource = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) => action.zoneIndex === 1);
            if (pickSource) engine.step(pickSource);

            const pickEntryEffect = findAction(engine, p1.id, 'SELECT_REVEALED_TARGET');
            if (pickEntryEffect) engine.step(pickEntryEffect);

            const pickEntryTarget = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) => action.zoneIndex === 2);
            if (pickEntryTarget) engine.step(pickEntryTarget);

            const granted = p1.unitZones[2].temporaryEffects.some((effect: any) => effect.description.includes('파워+3000'));
            return [{ pass: granted, message: '대상 유닛 엔트리 효과 선택 발동 성공' }];
        },
    },
    {
        testId: 'ST06-007',
        name: '심판자 키세 패시브 스킬존 조건 +5000',
        description: '스킬존에 카드가 1장 이상이면 파워+5000.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard('ST06-007');
            p1.skillZone = [getCard('ST06-013')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const power = engine.getUnitPower(p1.unitZones[0], p1);
            return [{ pass: power === 8000, message: `스킬존 조건 +5000 확인 (${power})` }];
        },
    },
    {
        testId: 'ST06-008',
        name: '리나크 엔트리 듀얼리스트/파워 효과 부여',
        description: '다른 아군에게 턴 종료까지 듀얼리스트와 어태커 +2000을 부여한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.hand = [getCard('ST06-008')];
            p1.unitZones[1].unit = getCard('ST06-009');
            p1.leaderLevel = 10;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.playUnit(0, 0);
            const target = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) => action.zoneIndex === 1);
            if (target) engine.step(target);

            const hasDualist = p1.unitZones[1].temporaryEffects.some((effect: any) => effect.description.includes('듀얼리스트'));
            const hasPowerGrant = p1.unitZones[1].temporaryEffects.some((effect: any) => effect.description.includes('파워+2000'));
            return [
                { pass: hasDualist, message: '듀얼리스트 부여' },
                { pass: hasPowerGrant, message: '어태커 +2000 부여' },
            ];
        },
    },
    {
        testId: 'ST06-008-Trigger',
        name: '리나크 트리거 패 복귀',
        description: '대미지 트리거로 이 카드를 패에 넣는다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.deck = [getCard('ST06-008')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.dealDamage(p1, 1);
            return [{ pass: p1.hand.some((card: Card) => card.id.startsWith('ST06-008')), message: '트리거 패 복귀' }];
        },
    },
    {
        testId: 'ST06-009',
        name: '구원자 아딘 어태커 +2000',
        description: '어태커 +2000으로 동일 코스트 상대로 우위를 가진다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.unitZones[0].unit = getCard('ST06-009');
            p2.unitZones[0].unit = getCard('ST06-009');
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
        testId: 'ST06-010',
        name: '기원의 라스 엔트리 선택 코스트 후 관통 부여',
        description: '패 1장 트래시 선택 지불 시 다른 아군에게 관통을 부여한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.hand = [getCard('ST06-010'), getCard('ST01-002')];
            p1.unitZones[1].unit = getCard('ST06-009');
            p1.leaderLevel = 10;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.playUnit(0, 0);

            const optionalConfirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
            if (optionalConfirm) engine.step(optionalConfirm);

            const costAction = findAction(engine, p1.id, 'SELECT_COST_HAND');
            if (costAction) engine.step(costAction);

            const target = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) => action.zoneIndex === 1);
            if (target) engine.step(target);

            const granted = p1.unitZones[1].temporaryEffects.some((effect: any) => effect.description.includes('관통'));
            return [{ pass: granted, message: '관통 효과 부여 성공' }];
        },
    },
    {
        testId: 'ST06-011',
        name: '심판자 키세 선택 지불 시 파워 합 디버프',
        description: '어태커 효과로 선택 지불 시 상대 대상 유닛 파워를 감소시킨다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.unitZones[0].unit = getCard('ST06-011');
            p1.hand = [getCard('ST01-002'), getCard('ST01-002')];
            p2.unitZones[0].unit = getCard('ST06-009');
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            const before = engine.getUnitPower(p2.unitZones[0], p2);

            engine.attack(0);
            const target = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) => action.targetPlayerId === p2.id && action.zoneIndex === 0);
            if (target) engine.step(target);

            const optionalConfirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
            if (optionalConfirm) engine.step(optionalConfirm);

            pickAndConfirmMultiTargets(engine, p1.id, (action: any) => action.type === 'SELECT_HAND_TARGET', 2);

            const block = findAction(engine, p2.id, 'RESOLVE_BLOCK', (action: any) => action.shouldBlock && action.blockerZoneIndex === 0);
            if (block) engine.step(block);

            const after = p2.unitZones[0].unit ? engine.getUnitPower(p2.unitZones[0], p2) : before;
            return [{ pass: p2.unitZones[0].unit === null || after <= before - 1000, message: '선택 지불 후 파워 감소 반영' }];
        },
    },
    {
        testId: 'ST06-012',
        name: '빛의 루엘 액티브 메인 스킬 트래시 디버프',
        description: '손패 스킬을 최대 2장 트래시해 조우 유닛 파워를 감소시킨다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.unitZones[0].unit = getCard('ST06-012');
            p1.hand = [getCard('ST06-013'), getCard('ST06-014')];
            p2.unitZones[0].unit = getCard('ST06-009');
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            const before = engine.getUnitPower(p2.unitZones[0], p2);
            engine.activateEffect(0, 0);
            pickAndConfirmMultiTargets(engine, p1.id, (action: any) => action.type === 'SELECT_HAND_TARGET', 2);
            const after = p2.unitZones[0].unit ? engine.getUnitPower(p2.unitZones[0], p2) : before - 6000;

            return [
                { pass: p1.trash.filter((card: Card) => card.type === 'SKILL').length >= 2, message: '스킬 2장 트래시' },
                { pass: p2.unitZones[0].unit === null || after === before - 6000, message: '조우 유닛 디버프 반영' },
            ];
        },
    },
    {
        testId: 'ST06-012-Trigger',
        name: '빛의 루엘 트리거 계승자 유닛 회수',
        description: '대미지 트리거로 자신의 트래시에서 계승자 유닛 1장을 패에 넣는다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.deck = [getCard('ST06-012')];
            p1.trash = [getCard('ST06-006'), getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.dealDamage(p1, 1);

            const legal = engine.getLegalActions(p1.id).filter((action: any) => action.type === 'SELECT_TRASH_TARGET') as Array<any>;
            const selectableIds = legal.map((action: any) => p1.trash[action.trashIndex]?.id);
            const canPickSuccessor = selectableIds.some((id: string | undefined) => id?.startsWith('ST06-006'));
            const canPickNonSuccessor = selectableIds.some((id: string | undefined) => id?.startsWith('ST01-002'));

            const pick = legal.find((action: any) => p1.trash[action.trashIndex]?.id.startsWith('ST06-006'));
            if (pick) engine.step(pick);

            return [
                { pass: canPickSuccessor, message: '계승자 유닛 선택 가능' },
                { pass: !canPickNonSuccessor, message: '비계승자 유닛 선택 불가' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith('ST06-006')), message: '계승자 유닛 회수 성공' },
            ];
        },
    },
    {
        testId: 'ST06-013',
        name: '이계의 머시너리 성약 잠금/0코스트/드로우',
        description: '성약 스킬 잠금, 필드 디버프, 계승자 0코스트, 1드로우를 처리한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.hand = [getCard('ST06-013'), getCard('ST06-015')];
            p1.unitZones[0].unit = getCard('ST06-006');
            p2.unitZones[0].unit = getCard('ST06-009');
            p1.deck = [getCard('ST01-002')];
            p1.leaderLevel = 10;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.playSkill(0);

            const debuffTarget = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) => action.targetPlayerId === p2.id && action.zoneIndex === 0);
            if (debuffTarget) engine.step(debuffTarget);
            const costTarget = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) => action.targetPlayerId === p1.id && action.zoneIndex === 0);
            if (costTarget) engine.step(costTarget);

            const canPlaySecondCovenantSkill = engine
                .getLegalActions(p1.id)
                .some((action: any) => action.type === 'PLAY_SKILL' && p1.hand[action.handIndex]?.id.startsWith('ST06-015'));

            return [
                { pass: p1.unitZones[0].unit?.turnCostOverride?.cost === 0, message: '계승자 유닛 0코스트 적용' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith('ST01-002')), message: '1드로우 반영' },
                { pass: !canPlaySecondCovenantSkill, message: '성약 잠금 적용' },
            ];
        },
    },
    {
        testId: 'ST06-014',
        name: '찬란한 영원 대미지 기반 코스트 상한 회수',
        description: '대미지 수를 넘지 않는 총코스트만큼만 트래시 카드를 회수한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.hand = [getCard('ST06-014')];
            p1.damage = [getCard('ST01-002'), getCard('ST01-002')];
            p1.trash = [getCard('ST01-002'), getCard('ST06-013'), getCard('ST06-005')];
            p1.leaderLevel = 10;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.playSkill(0);

            const legal = engine.getLegalActions(p1.id).filter((action: any) => action.type === 'SELECT_TRASH_TARGET');
            const selectableIds = legal.map((action: any) => p1.trash[action.trashIndex]?.id);
            const canPickHighCost = selectableIds.some((id: string | undefined) => id?.startsWith('ST06-013'));

            const pickLowCost = legal.find((action: any) => p1.trash[action.trashIndex]?.id.startsWith('ST06-005'));
            if (pickLowCost) engine.step(pickLowCost);
            const confirm = findAction(engine, p1.id, 'CONFIRM_TARGETS');
            if (confirm) engine.step(confirm);

            return [
                { pass: !canPickHighCost, message: '대미지 수 초과 코스트 카드 선택 불가' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith('ST06-005')), message: '허용 코스트 카드 회수 성공' },
            ];
        },
    },
    {
        testId: 'ST06-015',
        name: '은밀한 손길 조건부 트래시 + 0코스트 + 드로우',
        description: '조건 충족 시 상대 유닛 트래시, 계승자 0코스트, 1드로우를 수행한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.hand = [getCard('ST06-015')];
            p1.unitZones[0].unit = getCard('ST06-009');
            p1.unitZones[1].unit = getCard('ST06-006');
            p2.unitZones[0].unit = getCard('ST06-010');
            p1.damage = [getCard('ST01-002'), getCard('ST01-002')];
            p1.deck = [getCard('ST01-002')];
            p1.leaderLevel = 10;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.playSkill(0);

            const destroyTarget = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) => action.targetPlayerId === p2.id && action.zoneIndex === 0);
            if (destroyTarget) engine.step(destroyTarget);
            const costTarget = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) => action.targetPlayerId === p1.id && action.zoneIndex === 1);
            if (costTarget) engine.step(costTarget);

            return [
                { pass: p2.unitZones[0].unit === null, message: '조건 충족 시 상대 유닛 트래시' },
                { pass: p1.unitZones[1].unit?.turnCostOverride?.cost === 0, message: '계승자 0코스트 적용' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith('ST01-002')), message: '1드로우 반영' },
            ];
        },
    },
    {
        testId: 'ST06-016',
        name: '사랑해, 기억해, 영원히 추가 공격 + 0코스트 + 드로우',
        description: '조우 유닛이 있는 아군에게 추가 공격과 +2000을 부여하고 계승자 0코스트/드로우를 처리한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.hand = [getCard('ST06-016')];
            p1.unitZones[0].unit = getCard('ST06-009');
            p1.unitZones[1].unit = getCard('ST06-006');
            p2.unitZones[0].unit = getCard('ST06-009');
            p1.damage = [getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002')];
            p1.deck = [getCard('ST01-002')];
            p1.leaderLevel = 10;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const beforePower = p1.unitZones[0].unit?.power || 0;
            engine.playSkill(0);

            const firstTarget = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) => action.targetPlayerId === p1.id && action.zoneIndex === 0);
            if (firstTarget) engine.step(firstTarget);
            const secondTarget = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) => action.targetPlayerId === p1.id && action.zoneIndex === 1);
            if (secondTarget) engine.step(secondTarget);

            const power = engine.getUnitPower(p1.unitZones[0], p1);
            return [
                { pass: (p1.unitZones[0].extraAttackAllowance || 0) >= 1, message: '추가 공격 1회 부여' },
                { pass: power === beforePower + 2000, message: '파워 +2000 반영' },
                { pass: p1.unitZones[1].unit?.turnCostOverride?.cost === 0, message: '계승자 0코스트 적용' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith('ST01-002')), message: '1드로우 반영' },
            ];
        },
    },
    {
        testId: 'ST06-017',
        name: '흑요석 반지 엑시트 저코스트 유닛 회수',
        description: '장착 유닛보다 코스트가 낮은 유닛만 트래시에서 패로 회수 가능.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard('ST06-009'); // cost 4
            p1.unitZones[0].items = [getCard('ST06-017')];
            p1.trash = [getCard('ST06-005'), getCard('ST06-010')]; // 2, 4
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');

            const legal = engine.getLegalActions(p1.id).filter((action: any) => action.type === 'SELECT_TRASH_TARGET');
            const selectableIds = legal.map((action: any) => p1.trash[action.trashIndex]?.id);
            const canPickCost2 = selectableIds.some((id: string | undefined) => id?.startsWith('ST06-005'));
            const canPickCost4 = selectableIds.some((id: string | undefined) => id?.startsWith('ST06-010'));

            const pickLow = legal.find((action: any) => p1.trash[action.trashIndex]?.id.startsWith('ST06-005'));
            if (pickLow) engine.step(pickLow);

            return [
                { pass: canPickCost2, message: '낮은 코스트 유닛 선택 가능' },
                { pass: !canPickCost4, message: '동일/높은 코스트 유닛 선택 불가' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith('ST06-005')), message: '선택한 저코스트 유닛 회수 성공' },
            ];
        },
    },
];

export const ST06Module: UnifiedTestModule = {
    packId: 'ST06',
    displayName: 'ST06 Fire Starter',
    tests,
};
