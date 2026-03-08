/**
 * ST09 Tropical Dimension Unified Tests
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

function createCreditEntryScenario(cardId: string, name: string, drawCardId: string, effectIndex = 0): UnifiedTestCase {
    return {
        testId: `${cardId}-Entry`,
        name,
        description: '크레딧 엔트리 드로우를 확인한다.',
        coversEffectIndices: [effectIndex],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.leaderLevel = 10;
            p1.hand = [getCard(cardId)];
            p1.deck = [getCard(drawCardId)];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.playUnit(0, 0);
            return [
                { pass: p1.unitZones[0].unit?.id.startsWith(cardId) === true, message: '유닛 배치 성공' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith(drawCardId)), message: '크레딧 드로우 성공' },
            ];
        },
    };
}

function createCreditExitScenario(cardId: string, name: string, discardCardId: string, effectIndex = 1): UnifiedTestCase {
    return {
        testId: `${cardId}-Exit`,
        name,
        description: '크레딧 엑시트 손패 트래시를 확인한다.',
        coversEffectIndices: [effectIndex],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard(cardId);
            p1.hand = [getCard(discardCardId), getCard('ST01-011')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
            const pick = findAction(
                engine,
                p1.id,
                'SELECT_HAND_TARGET',
                (action: any) => p1.hand[action.handIndex]?.id.startsWith(discardCardId),
            );
            if (pick) engine.step(pick);
            return [
                { pass: !!pick, message: '트래시할 손패 선택 가능' },
                { pass: p1.trash.some((card: Card) => card.id.startsWith(cardId)), message: '본체 트래시 이동' },
                { pass: p1.trash.some((card: Card) => card.id.startsWith(discardCardId)), message: '손패 트래시 성공' },
            ];
        },
    };
}

function createEscapeDrawScenario(cardId: string, name: string, drawCardId: string, effectIndex: number): UnifiedTestCase {
    return {
        testId: `${cardId}-Escape`,
        name,
        description: '이스케이프로 자신을 덱 맨 아래에 놓고 드로우한다.',
        coversEffectIndices: [effectIndex],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard(cardId);
            p1.deck = [getCard(drawCardId)];
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.DRAW;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.nextPhase();
            return [
                { pass: engine.state.phase === Phase.MAIN, message: '메인 페이즈 진입' },
                { pass: p1.unitZones[0].unit === null, message: '이스케이프로 필드 이탈' },
                { pass: p1.deck[0]?.id.startsWith(cardId) === true, message: '본체가 덱 맨 아래로 이동' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith(drawCardId)), message: '이스케이프 드로우 성공' },
            ];
        },
    };
}

function createTriggerReturnScenario(cardId: string, name: string, effectIndex: number): UnifiedTestCase {
    return {
        testId: `${cardId}-TriggerReturn`,
        name,
        description: '대미지 트리거로 자신을 패에 넣는다.',
        coversEffectIndices: [effectIndex],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.deck = [getCard(cardId)];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.dealDamage(p1, 1);
            return [
                { pass: p1.hand.some((card: Card) => card.id.startsWith(cardId)), message: '대미지 트리거로 패 복귀' },
                { pass: p1.damage.every((card: Card) => !card.id.startsWith(cardId)), message: '대미지 존에서 제거' },
            ];
        },
    };
}

function createExitDrawScenario(cardId: string, name: string, drawCount: number, effectIndex = 0): UnifiedTestCase {
    return {
        testId: `${cardId}-ExitDraw`,
        name,
        description: '엑시트 드로우를 확인한다.',
        coversEffectIndices: [effectIndex],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard(cardId);
            p1.deck = Array.from({ length: drawCount }, () => getCard('ST01-002'));
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const handBefore = p1.hand.length;
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
            return [
                { pass: p1.trash.some((card: Card) => card.id.startsWith(cardId)), message: '본체 트래시 이동' },
                { pass: p1.hand.length === handBefore + drawCount, message: `엑시트 ${drawCount}드로우 성공` },
            ];
        },
    };
}

const tests: UnifiedTestCase[] = [
    {
        testId: 'ST09-001-Awaken',
        name: '트로피컬 디멘션 아비게일 각성 + 상대 선택 드로우',
        description: '리더 레벨 5에서 각성하고 오프속성 카드가 있으면 상대가 1드로우를 선택할 수 있다.',
        coversEffectIndices: [0, 1],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.levelZone = getCard('ST09-001');
            if (p1.levelZone) p1.levelZone.isAwakened = false;
            p1.leaderLevel = 4;
            p1.unitZones[0].unit = getCard('ST01-002');
            p2.deck = [getCard('ST01-011')];
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.LEVEL_UP;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            const handBefore = p2.hand.length;
            engine.nextPhase();
            const confirm = findAction(engine, p2.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
            if (confirm) engine.step(confirm);
            return [
                { pass: p1.levelZone?.isAwakened === true, message: '리더 각성 성공' },
                { pass: !!confirm, message: '상대 선택 드로우 창 생성' },
                { pass: p2.hand.length === handBefore + 1, message: '상대 1드로우 성공' },
            ];
        },
    },
    {
        testId: 'ST09-001-Active',
        name: '트로피컬 디멘션 아비게일 각성 액티브 이스케이프 부여',
        description: '대상 유닛에게 다음 자신의 턴 종료까지 이스케이프 1대미지 효과를 부여한다.',
        coversEffectIndices: [2],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.levelZone = getCard('ST09-001');
            if (p1.levelZone) p1.levelZone.isAwakened = true;
            p1.leaderLevel = 5;
            p1.unitZones[0].unit = getCard('ST01-002');
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.activateEffect(0, 2, 'LEADER');
            const pick = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) => action.targetPlayerId === p1.id && action.zoneIndex === 0);
            if (pick) engine.step(pick);
            const granted = p1.unitZones[0].temporaryEffects.some((effect: any) =>
                effect.activation === 'ESCAPE' && String(effect.description).includes('상대에게 1대미지'),
            );
            return [
                { pass: !!pick, message: '대상 유닛 선택 가능' },
                { pass: granted, message: '이스케이프 효과 부여 성공' },
            ];
        },
    },
    createCreditEntryScenario('ST09-002', '선샤인 마린 일레븐 크레딧 엔트리 1드로우', 'ST01-002'),
    createCreditExitScenario('ST09-002', '선샤인 마린 일레븐 크레딧 엑시트 1버림', 'ST01-002'),
    createEscapeDrawScenario('ST09-002', '선샤인 마린 일레븐 이스케이프 1드로우', 'ST01-011', 2),
    {
        testId: 'ST09-003-Mix',
        name: '한여름의 축제 펠릭스 믹스 침투 부여',
        description: '오프속성 카드가 있으면 자신 유닛이 침투[1]을 얻는다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard('ST09-003');
            p1.skillZone = [getCard('ST09-016')];
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const handBefore = p1.hand.length;
            engine.attack(0);
            return [
                { pass: p1.hand.length === handBefore + 1, message: '침투[1] 드로우 성공' },
            ];
        },
    },
    {
        testId: 'ST09-003-Defender',
        name: '한여름의 축제 펠릭스 디펜더 파워+3000',
        description: '방어 시 전투 종료까지 파워+3000을 얻는다.',
        coversEffectIndices: [1],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.unitZones[0].unit = getCard('ST09-003');
            p2.unitZones[0].unit = getCard('ST10-008');
            engine.state.turnPlayerIndex = 1;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.attack(0);
            const block = findAction(engine, p1.id, 'RESOLVE_BLOCK', (action: any) => action.shouldBlock && action.blockerZoneIndex === 0);
            if (block) engine.step(block);
            return [
                { pass: !!block, message: '조우 방어 선택 가능' },
                { pass: p1.unitZones[0].unit !== null, message: '디펜더 버프로 생존' },
                { pass: p2.unitZones[0].unit === null, message: '공격 유닛 전투 트래시' },
            ];
        },
    },
    {
        testId: 'ST09-004',
        name: '한여름의 꿈 바냐 믹스 침투[2]',
        description: '오프속성 카드가 있으면 침투[2]로 카드 2장을 드로우한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard('ST09-004');
            p1.skillZone = [getCard('ST09-016')];
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const handBefore = p1.hand.length;
            engine.attack(0);
            return [
                { pass: p1.hand.length === handBefore + 2, message: '침투[2] 드로우 성공' },
            ];
        },
    },
    {
        testId: 'ST09-005-End',
        name: '해변가 키아라 턴 종료 패 7장 조정 후 대미지',
        description: '턴 종료 시 8장 이상 손패를 7장으로 줄이고 트래시한 수만큼 대미지를 준다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard('ST09-005');
            p1.hand = Array.from({ length: 8 }, () => getCard('ST01-002'));
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.END;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            const damageBefore = p2.damage.length;
            engine.nextPhase();
            const nextPick = findAction(engine, p1.id, 'SELECT_HAND_TARGET');
            if (nextPick) engine.step(nextPick);
            return [
                { pass: p1.hand.length === 7, message: '손패 7장 조정 성공' },
                { pass: p2.damage.length === damageBefore + 1, message: '트래시한 수만큼 1대미지' },
                { pass: !!nextPick, message: '버릴 카드 선택 창 생성' },
            ];
        },
    },
    createEscapeDrawScenario('ST09-005', '해변가 키아라 이스케이프 1드로우', 'ST01-002', 1),
    {
        testId: 'ST09-006-Passive',
        name: '트로피컬 디멘션 아비게일 다른 아군 덱 맨 아래 이동 반응',
        description: '다른 자신 유닛이 덱 맨 아래로 가면 그 유닛의 히트만큼 대미지를 준다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard('ST09-006');
            p1.unitZones[1].unit = getCard('ST09-002');
            p1.deck = [getCard('ST01-002')];
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.DRAW;
        },
        verify: (engine, getCard) => {
            const p2 = engine.state.players[1];
            const expectedDamage = getCard('ST09-002').hit || 0;
            const damageBefore = p2.damage.length;
            engine.nextPhase();
            return [
                { pass: p2.damage.length === damageBefore + expectedDamage, message: `히트만큼 ${expectedDamage}대미지` },
            ];
        },
    },
    createTriggerReturnScenario('ST09-006', '트로피컬 디멘션 아비게일 트리거 패 복귀', 1),
    {
        testId: 'ST09-007',
        name: '몽환 나비 효과 대미지 드로우 + 자기 잠금',
        description: '이 턴 효과 대미지를 줄 때마다 1드로우하고 자신을 잠근다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.hand = [getCard('ST09-007')];
            p1.deck = [getCard('ST01-002')];
            p1.leaderLevel = 10;
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            const damageBefore = p2.damage.length;
            engine.playSkill(0);
            const handAfterPlay = p1.hand.length;
            engine.effectManager.executeEffect(
                {
                    activation: 'ACTIVE' as any,
                    description: '테스트 효과 대미지',
                    action: { type: 'DAMAGE', params: { value: 1 } },
                } as any,
                {
                    sourceCard: getCard('ST09-016'),
                    player: p1,
                    opponent: p2,
                    machine: engine,
                } as any,
                [],
            );
            return [
                { pass: p1.lockedSkillIdsUntilTurnEnd['ST09-007'] === true, message: '몽환 나비 잠금 적용' },
                { pass: p2.damage.length === damageBefore + 1, message: '효과 대미지 성공' },
                { pass: p1.hand.length === handAfterPlay + 1, message: '효과 대미지 반응 1드로우' },
            ];
        },
    },
    {
        testId: 'ST09-008-Active',
        name: '제대로 그려볼까 액티브 밀5 후 스킬 발동',
        description: '덱 위 5장을 트래시하고 그중 스킬 1장을 골라 발동한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.hand = [getCard('ST09-008')];
            p1.deck = [
                getCard('ST01-002'),
                getCard('ST01-002'),
                getCard('ST01-002'),
                getCard('ST01-002'),
                getCard('ST09-007'),
            ];
            p1.leaderLevel = 10;
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.playSkill(0);
            const pick = findAction(
                engine,
                p1.id,
                'SELECT_REVEALED_TARGET',
                (action: any) => engine.state.revealedCards[action.revealedIndex]?.id.startsWith('ST09-007'),
            );
            if (pick) engine.step(pick);
            return [
                { pass: !!pick, message: '트래시한 스킬 선택 가능' },
                { pass: p1.lockedSkillIdsUntilTurnEnd['ST09-007'] === true, message: '선택한 스킬 효과 발동' },
                { pass: p1.trash.filter((card: Card) => card.id.startsWith('ST01-002')).length >= 4, message: '덱 위 4장 이상 트래시' },
            ];
        },
    },
    {
        testId: 'ST09-008-Trigger',
        name: '제대로 그려볼까 트리거 자가 트래시 + 공개 스킬 패 유지',
        description: '트리거로 자신을 트래시하고 공개한 스킬을 선택하지 않으면 패에 넣는다.',
        coversEffectIndices: [1, 2],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.deck = [getCard('ST09-007'), getCard('ST09-008')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.dealDamage(p1, 1);
            const confirmSkip = findAction(engine, p1.id, 'CONFIRM_TARGETS');
            if (confirmSkip) engine.step(confirmSkip);
            return [
                { pass: p1.trash.some((card: Card) => card.id.startsWith('ST09-008')), message: '트리거로 본체 트래시' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith('ST09-007')), message: '공개한 스킬을 패에 유지' },
            ];
        },
    },
    {
        testId: 'ST09-009',
        name: '만년한파 장착 어태커 침투[1]',
        description: '장착 유닛이 침투[1]을 얻어 공격 미방어 시 1드로우한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.hand = [getCard('ST09-009')];
            p1.unitZones[0].unit = getCard('ST01-002');
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.playItem(0, 0);
            const handAfterEquip = p1.hand.length;
            engine.state.phase = Phase.ATTACK;
            engine.attack(0);
            return [
                { pass: p1.hand.length === handAfterEquip + 1, message: '장착 침투[1] 드로우 성공' },
            ];
        },
    },
    {
        testId: 'ST09-010',
        name: '구원받지 못한 이안 엑시트 히트+1',
        description: '엑시트 시 자신 유닛 1장의 히트를 턴 종료까지 1 올린다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard('ST09-010');
            p1.unitZones[1].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const before = engine.getUnitHit(p1.unitZones[1], p1);
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
            const pick = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) => action.targetPlayerId === p1.id && action.zoneIndex === 1);
            if (pick) engine.step(pick);
            return [
                { pass: !!pick, message: '버프 대상 선택 가능' },
                { pass: engine.getUnitHit(p1.unitZones[1], p1) === before + 1, message: '히트+1 적용' },
            ];
        },
    },
    createExitDrawScenario('ST09-011', '고스트헌터 혜진 엑시트 1드로우', 1),
    {
        testId: 'ST09-012-Entry',
        name: '프리즌 브레이크 캐시 엔트리 양쪽 트래시',
        description: '다른 자신 유닛과 그 코스트 이하 상대 유닛을 함께 트래시한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.leaderLevel = 10;
            p1.hand = [getCard('ST09-012')];
            p1.unitZones[1].unit = getCard('ST09-005');
            p2.unitZones[0].unit = getCard('ST01-002');
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.playUnit(0, 0);
            const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
            if (confirm) engine.step(confirm);
            const pickFriendly = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) => action.targetPlayerId === p1.id && action.zoneIndex === 1);
            if (pickFriendly) engine.step(pickFriendly);
            const pickOpponent = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) => action.targetPlayerId === p2.id && action.zoneIndex === 0);
            if (pickOpponent) engine.step(pickOpponent);
            return [
                { pass: !!confirm, message: '엔트리 선택 효과 확인' },
                { pass: !!pickFriendly && !!pickOpponent, message: '양쪽 대상 선택 성공' },
                { pass: p1.unitZones[1].unit === null, message: '다른 자신 유닛 트래시' },
                { pass: p2.unitZones[0].unit === null, message: '상대 유닛 트래시' },
            ];
        },
    },
    {
        testId: 'ST09-012-Exit',
        name: '프리즌 브레이크 캐시 엑시트 2코 이하 파괴',
        description: '엑시트 시 2코스트 이하 유닛을 선택해 트래시한다.',
        coversEffectIndices: [1],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.unitZones[0].unit = getCard('ST09-012');
            p2.unitZones[0].unit = getCard('ST01-002');
            p2.unitZones[1].unit = getCard('ST09-005');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
            const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
            if (confirm) engine.step(confirm);
            const pickLowCost = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) => action.targetPlayerId === p2.id && action.zoneIndex === 0);
            if (pickLowCost) engine.step(pickLowCost);
            return [
                { pass: !!pickLowCost, message: '2코 이하 대상 선택 가능' },
                { pass: p2.unitZones[0].unit === null, message: '2코 이하 유닛 트래시' },
                { pass: p2.unitZones[1].unit !== null, message: '고코스트 유닛 유지' },
            ];
        },
    },
    {
        testId: 'ST09-012-Trigger',
        name: '프리즌 브레이크 캐시 트리거 엑시트 차용',
        description: '트리거로 자신을 트래시한 뒤 트래시의 [엑시트] 유닛 효과를 발동하고 그 카드를 덱 맨 아래로 보낸다.',
        coversEffectIndices: [2, 3],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.deck = [getCard('ST09-012')];
            p1.trash = [getCard('ST09-010')];
            p1.unitZones[1].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.dealDamage(p1, 1);
            const pickTrash = findAction(
                engine,
                p1.id,
                'SELECT_TRASH_TARGET',
                (action: any) => p1.trash[action.trashIndex]?.id.startsWith('ST09-010'),
            );
            if (pickTrash) engine.step(pickTrash);
            const pickTarget = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) => action.targetPlayerId === p1.id && action.zoneIndex === 1);
            if (pickTarget) engine.step(pickTarget);
            return [
                { pass: p1.trash.some((card: Card) => card.id.startsWith('ST09-012')), message: '본체 트리거 자가 트래시' },
                { pass: engine.getUnitHit(p1.unitZones[1], p1) >= 2, message: '차용한 엑시트 효과 발동' },
                { pass: p1.deck[0]?.id.startsWith('ST09-010') === true, message: '차용 대상 덱 맨 아래 이동' },
            ];
        },
    },
    {
        testId: 'ST09-013-Passive',
        name: '매지컬 래빗 엠마 효과 파괴 반응 대미지',
        description: '효과로 유닛이 트래시되면 패 1장을 버리고 상대에게 대미지를 준다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard('ST09-013');
            p1.unitZones[1].unit = getCard('ST01-002');
            p1.hand = [getCard('ST01-011')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            const damageBefore = p2.damage.length;
            engine.destroyUnit(p1, p1.unitZones[1], undefined, 'EFFECT');
            const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
            if (confirm) engine.step(confirm);
            const payCost = findAction(engine, p1.id, 'SELECT_COST_HAND');
            if (payCost) engine.step(payCost);
            return [
                { pass: !!confirm && !!payCost, message: '선택 및 패 코스트 지불 성공' },
                { pass: p2.damage.length === damageBefore + 1, message: '효과 파괴 반응 1대미지' },
                { pass: p1.trash.some((card: Card) => card.id.startsWith('ST01-011')), message: '패 1장 트래시' },
            ];
        },
    },
    createTriggerReturnScenario('ST09-013', '매지컬 래빗 엠마 트리거 패 복귀', 1),
    {
        testId: 'ST09-014-Entry',
        name: '고스트헌터 유키 엔트리 드로우 + 조우 유닛 파괴',
        description: '크레딧 엔트리 드로우 후 조우 유닛의 히트만큼 패를 버리고 조우 유닛을 트래시한다.',
        coversEffectIndices: [0, 2],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.leaderLevel = 10;
            p1.hand = [getCard('ST09-014'), getCard('ST01-002')];
            p1.deck = [getCard('ST01-011')];
            p2.unitZones[0].unit = getCard('ST10-005');
            engine.state.turnPlayerIndex = 0;
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
                { pass: p1.hand.some((card: Card) => card.id.startsWith('ST01-011')), message: '크레딧 드로우 성공' },
                { pass: !!confirm && !!payCost, message: '조우 유닛 파괴 비용 지불 성공' },
                { pass: p2.unitZones[0].unit === null, message: '조우 유닛 트래시' },
            ];
        },
    },
    createCreditExitScenario('ST09-014', '고스트헌터 유키 크레딧 엑시트 1버림', 'ST01-002'),
    {
        testId: 'ST09-015',
        name: '과거는 중요하지 않아 자신 유닛 + 낮은 코스트 상대 유닛 트래시',
        description: '자신 유닛 1장과 더 낮은 코스트의 상대 유닛 1장을 선택해 모두 트래시한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.hand = [getCard('ST09-015')];
            p1.unitZones[0].unit = getCard('ST09-005');
            p2.unitZones[0].unit = getCard('ST01-002');
            p1.leaderLevel = 10;
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.playSkill(0);
            const pickFriendly = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) => action.targetPlayerId === p1.id && action.zoneIndex === 0);
            if (pickFriendly) engine.step(pickFriendly);
            const pickOpponent = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) => action.targetPlayerId === p2.id && action.zoneIndex === 0);
            if (pickOpponent) engine.step(pickOpponent);
            return [
                { pass: !!pickFriendly && !!pickOpponent, message: '쌍대상 선택 성공' },
                { pass: p1.unitZones[0].unit === null, message: '자신 유닛 트래시' },
                { pass: p2.unitZones[0].unit === null, message: '상대 유닛 트래시' },
            ];
        },
    },
    {
        testId: 'ST09-016',
        name: '운명의 인도 자신 유닛 트래시 후 대미지 + 조건부 드로우',
        description: '자신 유닛을 트래시하고 1대미지, 오프속성 카드가 있으면 1드로우한다.',
        coversEffectIndices: [0, 1, 2],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.hand = [getCard('ST09-016')];
            p1.unitZones[0].unit = getCard('ST01-002');
            p1.unitZones[1].unit = getCard('ST09-005');
            p1.deck = [getCard('ST01-011')];
            p1.leaderLevel = 10;
            p2.damage = [];
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            const damageBefore = p2.damage.length;
            engine.playSkill(0);
            const handAfterPlay = p1.hand.length;
            const pickSelf = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) => action.targetPlayerId === p1.id && action.zoneIndex === 0);
            if (pickSelf) engine.step(pickSelf);
            const confirmDraw = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
            if (confirmDraw) engine.step(confirmDraw);
            return [
                { pass: !!pickSelf, message: '트래시할 자신 유닛 선택 가능' },
                { pass: p1.unitZones[0].unit === null, message: '선택한 자신 유닛 트래시' },
                { pass: p2.damage.length === damageBefore + 1, message: '상대 1대미지' },
                { pass: p1.hand.length === handAfterPlay + 1, message: '조건부 1드로우 성공' },
            ];
        },
    },
    createExitDrawScenario('ST09-017', '생사부 엑시트 2드로우', 2),
];

export const ST09Module: UnifiedTestModule = {
    packId: 'ST09',
    displayName: 'ST09 Tropical Dimension',
    tests,
};
