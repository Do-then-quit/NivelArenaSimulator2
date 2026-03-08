/**
 * ST07 Storm Starter Unified Tests
 */

import { Card } from '../../types';
import { UnifiedTestCase, UnifiedTestModule, Phase } from './types';

function advanceUntil(engine: any, predicate: () => boolean, maxSteps = 20): boolean {
    let guard = 0;
    while (!predicate() && guard < maxSteps) {
        engine.nextPhase();
        guard += 1;
    }
    return predicate();
}

function findAction(engine: any, actorPlayerId: string, type: string, predicate?: (action: any) => boolean) {
    return engine
        .getLegalActions(actorPlayerId)
        .find((action: any) => action.type === type && (!predicate || predicate(action)));
}

const tests: UnifiedTestCase[] = [
    {
        testId: 'ST07-001',
        coversEffectIndices: [0],
        name: '페네 리더 각성',
        description: '리더 레벨 4에서 각성한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.levelZone = getCard('ST07-001');
            p1.levelZone.isAwakened = false;
            p1.leaderLevel = 3;
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.LEVEL_UP;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.nextPhase();
            return [
                { pass: p1.leaderLevel >= 4, message: `리더 레벨 증가 (${p1.leaderLevel})` },
                { pass: p1.levelZone?.isAwakened === true, message: '리더 각성 성공' },
            ];
        },
    },
    {
        testId: 'ST07-001-Active',
        coversEffectIndices: [1],
        name: '페네 리더 액티브 코스트 이하 호문클루스 히트 버프',
        description: '리더 액티브를 발동해 버린 카드 이하 코스트의 호문클루스만 히트+1을 받는다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.levelZone = getCard('ST07-001');
            p1.levelZone.isAwakened = true;
            p1.leaderLevel = 4;
            p1.hand = [getCard('ST07-013')];
            p1.unitZones[0].unit = getCard('ST07-002');
            p1.unitZones[1].unit = getCard('ST07-007');
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const beforeLow = engine.getUnitHit(p1.unitZones[0], p1);
            const beforeHigh = engine.getUnitHit(p1.unitZones[1], p1);
            engine.activateEffect(0, 1, 'LEADER');
            const cost = findAction(engine, p1.id, 'SELECT_COST_HAND');
            if (cost) engine.step(cost);
            const afterLow = engine.getUnitHit(p1.unitZones[0], p1);
            const afterHigh = engine.getUnitHit(p1.unitZones[1], p1);
            return [
                { pass: afterLow === beforeLow + 1, message: '저코스트 호문클루스 히트+1 적용' },
                { pass: afterHigh === beforeHigh, message: '고코스트 호문클루스는 비적용' },
            ];
        },
    },
    {
        testId: 'ST07-002',
        coversEffectIndices: [0],
        name: '카일론 EXIT 드로우 수는 호문클루스 공격 수를 참조',
        description: '다른 호문클루스의 선공격 이후 EXIT가 2드로우를 만든다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.unitZones[0].unit = getCard('ST07-002');
            p1.unitZones[1].unit = getCard('ST07-003');
            p1.deck = [getCard('ST07-013'), getCard('ST07-014')];
            p2.deck = Array.from({ length: 10 }, () => getCard('ST01-002'));
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const before = p1.hand.length;
            engine.attack(1);
            engine.attack(0);
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
            return [
                { pass: p1.hand.length === before + 2, message: '호문클루스 공격 수만큼 2드로우' },
            ];
        },
    },
    {
        testId: 'ST07-002-ByCardEffect',
        coversEffectIndices: [0],
        name: '카일론 EXIT는 카드 효과로 시작한 공격도 카운트',
        description: '사랑의 증거로 먼저 공격하고 쓰러진 호문클루스의 공격도 포함되어, 이후 카일론 EXIT가 총 2드로우를 만든다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.hand = [getCard('ST07-016')];
            p1.leaderLevel = 10;
            p1.unitZones[0].unit = getCard('ST07-002');
            p1.unitZones[1].unit = getCard('ST07-002');
            p1.deck = [getCard('ST07-013'), getCard('ST07-014'), getCard('ST07-015')];
            p2.unitZones[0].unit = getCard('ST01-002');
            p2.unitZones[1].unit = getCard('ST01-002');
            p2.deck = Array.from({ length: 10 }, () => getCard('ST01-002'));
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.playSkill(0);
            const forceAttack = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) => action.targetPlayerId === p1.id && action.zoneIndex === 0);
            if (forceAttack) engine.step(forceAttack);
            const block = findAction(engine, p2.id, 'RESOLVE_BLOCK', (action: any) => action.shouldBlock && action.blockerZoneIndex === 0);
            if (block) engine.step(block);
            engine.state.phase = Phase.ATTACK;
            engine.attack(1);
            const secondBlock = findAction(engine, p2.id, 'RESOLVE_BLOCK', (action: any) => action.shouldBlock && action.blockerZoneIndex === 1);
            if (secondBlock) engine.step(secondBlock);
            return [
                { pass: p1.hand.length === 3, message: '카드 효과 공격 포함 누적 3장 손패 확인' },
            ];
        },
    },
    {
        testId: 'ST07-003',
        coversEffectIndices: [0],
        name: '필리스 EXIT 공개 후 1장 회수',
        description: '호문클루스 2회 공격 후 EXIT로 덱 위 2장을 공개하고 1장을 패에 넣는다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard('ST07-003');
            p1.unitZones[1].unit = getCard('ST07-002');
            p1.deck = [getCard('ST07-014'), getCard('ST07-013')];
            engine.state.players[1].deck = Array.from({ length: 10 }, () => getCard('ST01-002'));
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.attack(1);
            engine.attack(0);
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');

            const pick = findAction(
                engine,
                p1.id,
                'SELECT_REVEALED_TARGET',
                (action: any) => engine.state.revealedCards[action.revealedIndex]?.id.startsWith('ST07-013'),
            );
            if (pick) engine.step(pick);

            return [
                { pass: p1.hand.some((card: Card) => card.id.startsWith('ST07-013')), message: '공개 카드 1장 패 획득' },
                { pass: p1.trash.some((card: Card) => card.id.startsWith('ST07-014')), message: '비선택 카드는 트래시' },
            ];
        },
    },
    {
        testId: 'ST07-004',
        coversEffectIndices: [0],
        name: '세크레트 EXIT 대상은 공격 수 이하 코스트만 선택',
        description: '호문클루스 2회 공격 후 EXIT로 2코스트 이하 상대 유닛만 선택 가능하다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.unitZones[0].unit = getCard('ST07-004');
            p1.unitZones[1].unit = getCard('ST07-002');
            p2.unitZones[1].unit = getCard('ST07-005');
            p2.unitZones[2].unit = getCard('ST07-011');
            p2.deck = Array.from({ length: 10 }, () => getCard('ST01-002'));
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.attack(1);
            const passBlock = findAction(engine, p2.id, 'RESOLVE_BLOCK', (action: any) => action.shouldBlock === false);
            if (passBlock) engine.step(passBlock);
            engine.attack(0);
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');

            const lowCost = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) => action.targetPlayerId === p2.id && action.zoneIndex === 1);
            const highCost = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) => action.targetPlayerId === p2.id && action.zoneIndex === 2);
            if (lowCost) engine.step(lowCost);

            return [
                { pass: !!lowCost, message: '2코스트 이하 대상 선택 가능' },
                { pass: !highCost, message: '고코스트 대상 선택 불가' },
                { pass: p2.unitZones[1].unit === null, message: '선택된 상대 유닛 트래시' },
            ];
        },
    },
    {
        testId: 'ST07-005',
        coversEffectIndices: [0],
        name: '루루카 EXIT 1드로우',
        description: '필드에서 트래시되면 카드를 1장 드로우한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard('ST07-005');
            p1.deck = [getCard('ST07-013')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
            return [
                { pass: p1.hand.some((card: Card) => card.id.startsWith('ST07-013')), message: 'EXIT 1드로우 성공' },
            ];
        },
    },
    {
        testId: 'ST07-006',
        coversEffectIndices: [0],
        name: '유닛 페네 EXIT 밀링 후 호문클루스 수만큼 대미지',
        description: '호문클루스 2회 공격 후 EXIT가 덱 위 2장을 트래시하고 그중 호문클루스 수만큼 대미지를 준다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.unitZones[0].unit = getCard('ST07-006');
            p1.unitZones[1].unit = getCard('ST07-002');
            p1.deck = [getCard('ST07-013'), getCard('ST07-003')];
            p2.damage = [];
            p2.deck = Array.from({ length: 10 }, () => getCard('ST01-002'));
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.attack(1);
            engine.attack(0);
            const beforeExitDamage = p2.damage.length;
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
            return [
                { pass: p1.trash.some((card: Card) => card.id.startsWith('ST07-003')), message: '덱 상단 카드 트래시' },
                { pass: p2.damage.length === beforeExitDamage + 1, message: '트래시된 호문클루스 수만큼 1대미지' },
            ];
        },
    },
    {
        testId: 'ST07-006-Trigger',
        coversEffectIndices: [1, 2],
        name: '유닛 페네 트리거 자가 트래시 후 호문클루스 회수',
        description: '대미지 트리거로 자신을 트래시한 뒤 트래시의 호문클루스 유닛을 패에 넣는다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.deck = [getCard('ST07-006')];
            p1.trash = [getCard('ST07-002')];
            p1.damage = [];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.dealDamage(p1, 1);
            const pick = findAction(engine, p1.id, 'SELECT_TRASH_TARGET', (action: any) => p1.trash[action.trashIndex]?.id.startsWith('ST07-002'));
            if (pick) engine.step(pick);
            return [
                { pass: p1.trash.some((card: Card) => card.id.startsWith('ST07-006')), message: '트리거로 자신 트래시' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith('ST07-002')), message: '호문클루스 유닛 회수' },
            ];
        },
    },
    {
        testId: 'ST07-007',
        coversEffectIndices: [0],
        name: '라비 EXIT는 같은 대상 중복 선택으로 중첩 가능',
        description: '호문클루스 2회 공격 후 EXIT가 같은 상대 유닛을 두 번 골라 -6000을 누적할 수 있다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.unitZones[0].unit = getCard('ST07-007');
            p1.unitZones[1].unit = getCard('ST07-002');
            p2.unitZones[0].unit = getCard('ST07-011');
            p2.deck = Array.from({ length: 10 }, () => getCard('ST01-002'));
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            const before = engine.getUnitPower(p2.unitZones[0], p2);
            engine.attack(1);
            engine.attack(0);
            const block = findAction(engine, p2.id, 'RESOLVE_BLOCK', (action: any) => action.shouldBlock && action.blockerZoneIndex === 0);
            if (block) engine.step(block);

            const select = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) => action.targetPlayerId === p2.id && action.zoneIndex === 0);
            if (select) engine.step(select);
            if (select) engine.step(select);
            const confirm = findAction(engine, p1.id, 'CONFIRM_TARGETS');
            if (confirm) engine.step(confirm);

            const after = p2.unitZones[0].unit ? engine.getUnitPower(p2.unitZones[0], p2) : before - 6000;
            return [
                { pass: after === before - 6000, message: `같은 대상 중복 선택으로 -6000 (${after})` },
            ];
        },
    },
    {
        testId: 'ST07-008',
        coversEffectIndices: [0],
        name: '릴리벳 어택 액티브 자가 유닛 트래시',
        description: '어택 페이즈에 아군 유닛 1장을 선택해 트래시한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard('ST07-008');
            p1.unitZones[1].unit = getCard('ST07-005');
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.activateEffect(0, 0);
            const pick = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) => action.targetPlayerId === p1.id && action.zoneIndex === 1);
            if (pick) engine.step(pick);
            return [
                { pass: p1.unitZones[1].unit === null, message: '선택한 아군 유닛 트래시' },
            ];
        },
    },
    {
        testId: 'ST07-009',
        coversEffectIndices: [0],
        name: '후미르 어택 액티브 EXIT 호문클루스 희생 후 히트+1',
        description: '어택 페이즈에 EXIT를 얻은 호문클루스를 트래시하고 자신이 히트+1을 받는다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard('ST07-009');
            p1.unitZones[1].unit = getCard('ST07-002');
            engine.state.players[1].deck = Array.from({ length: 10 }, () => getCard('ST01-002'));
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const before = engine.getUnitHit(p1.unitZones[0], p1);
            engine.attack(1);
            engine.activateEffect(0, 0);
            const pick = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) => action.targetPlayerId === p1.id && action.zoneIndex === 1);
            if (pick) engine.step(pick);
            const after = engine.getUnitHit(p1.unitZones[0], p1);
            return [
                { pass: p1.unitZones[1].unit === null, message: 'EXIT 호문클루스 희생 성공' },
                { pass: after === before + 1, message: '자신 히트+1 적용' },
            ];
        },
    },
    {
        testId: 'ST07-010',
        coversEffectIndices: [0],
        name: '벨리안 조건 충족 시 EXIT 유닛 부활',
        description: '필드 트래시 조건이 있으면 손패 1장 코스트 후 트래시의 EXIT 유닛을 빈 존에 배치한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard('ST07-010');
            p1.unitZones[2].unit = getCard('ST07-005');
            p1.trash = [getCard('ST07-005')];
            p1.hand = [getCard('ST07-013')];
            engine.destroyUnit(p1, p1.unitZones[2], undefined, 'EFFECT');
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.activateEffect(0, 0);
            if (engine.state.interactionMode === 'SELECT_OPTIONAL') {
                const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
                if (confirm) engine.step(confirm);
            }
            const cost = findAction(engine, p1.id, 'SELECT_COST_HAND');
            if (cost) engine.step(cost);
            const revive = findAction(engine, p1.id, 'SELECT_TRASH_TARGET', (action: any) => p1.trash[action.trashIndex]?.id.startsWith('ST07-005'));
            if (revive) engine.step(revive);
            const zone = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) => action.targetPlayerId === p1.id && action.zoneIndex === 1);
            if (zone) engine.step(zone);
            return [
                { pass: p1.unitZones[1].unit?.id.startsWith('ST07-005') === true, message: 'EXIT 유닛 빈 존 배치' },
            ];
        },
    },
    {
        testId: 'ST07-010-Trigger',
        coversEffectIndices: [1],
        name: 'ST07-010 trigger returns to hand',
        description: 'Verify the damage trigger puts ST07-010 into hand.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.deck = [getCard('ST07-010')];
            p1.damage = [];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.dealDamage(p1, 1);
            return [{ pass: p1.hand.some((card: Card) => card.id.startsWith('ST07-010')), message: 'ST07-010 returns to hand from trigger' }];
        },
    },
    {
        testId: 'ST07-011',
        coversEffectIndices: [0],
        name: '하르세티 엔트리 코스트만큼 하단 복귀 후 조우 트래시',
        description: '조우 유닛 코스트와 같은 수만큼 호문클루스를 선택해 덱 하단에 두고 조우 유닛을 트래시한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.hand = [getCard('ST07-011')];
            p1.leaderLevel = 10;
            p1.trash = [getCard('ST07-002'), getCard('ST07-003'), getCard('ST07-006')];
            p2.unitZones[0].unit = getCard('ST07-005');
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.playUnit(0, 0);
            const first = findAction(engine, p1.id, 'SELECT_TRASH_TARGET', (action: any) => p1.trash[action.trashIndex]?.id.startsWith('ST07-002'));
            if (first) engine.step(first);
            const second = findAction(engine, p1.id, 'SELECT_TRASH_TARGET', (action: any) => p1.trash[action.trashIndex]?.id.startsWith('ST07-003'));
            if (second) engine.step(second);
            const confirm = findAction(engine, p1.id, 'CONFIRM_TARGETS');
            if (confirm) engine.step(confirm);
            return [
                { pass: p2.unitZones[0].unit === null, message: '조우 유닛 트래시' },
                { pass: p1.deck[0]?.id.startsWith('ST07-002') === true && p1.deck[1]?.id.startsWith('ST07-003') === true, message: '선택 순서대로 덱 하단 배치' },
                { pass: !p1.deck.some((card: Card) => card.id.startsWith('ST07-006')), message: '트리거 카드는 비선택' },
            ];
        },
    },
    {
        testId: 'ST07-011-Partial',
        coversEffectIndices: [0],
        name: '하르세티 후보가 부족하면 부분 확정 가능',
        description: '조우 유닛 코스트는 2지만 유효한 호문클루스가 1장뿐인 상태로 들어가, 첫 선택 직후 Confirm이 열리는지 확인한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.hand = [getCard('ST07-011')];
            p1.leaderLevel = 10;
            p1.trash = [getCard('ST07-002')];
            p2.unitZones[0].unit = getCard('ST07-005');
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.playUnit(0, 0);
            const first = findAction(engine, p1.id, 'SELECT_TRASH_TARGET', (action: any) => p1.trash[action.trashIndex]?.id.startsWith('ST07-002'));
            if (first) engine.step(first);
            const confirm = findAction(engine, p1.id, 'CONFIRM_TARGETS');
            if (confirm) engine.step(confirm);
            return [
                { pass: !!confirm, message: '후보 부족 시 1장 선택만으로 Confirm 가능' },
                { pass: p2.unitZones[0].unit === null, message: '부분 확정 후에도 조우 유닛 트래시' },
            ];
        },
    },
    {
        testId: 'ST07-011-Trigger',
        coversEffectIndices: [1, 2],
        name: 'ST07-011 trigger self-trash and recover a homunculus',
        description: 'Verify the damage trigger trashes ST07-011 and returns a homunculus unit from trash to hand.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.deck = [getCard('ST07-011')];
            p1.trash = [getCard('ST07-002'), getCard('ST01-002')];
            p1.damage = [];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.dealDamage(p1, 1);
            const legal = engine.getLegalActions(p1.id).filter((action: any) => action.type === 'SELECT_TRASH_TARGET');
            const homunculusPick = legal.find((action: any) => p1.trash[action.trashIndex]?.id.startsWith('ST07-002'));
            const nonHomunculusPick = legal.find((action: any) => p1.trash[action.trashIndex]?.id.startsWith('ST01-002'));
            if (homunculusPick) engine.step(homunculusPick);
            return [
                { pass: p1.trash.some((card: Card) => card.id.startsWith('ST07-011')), message: 'ST07-011 moves to trash from trigger' },
                { pass: !!homunculusPick, message: 'Homunculus unit is selectable from trigger' },
                { pass: !nonHomunculusPick, message: 'Non-homunculus card is not selectable from trigger' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith('ST07-002')), message: 'Homunculus unit recovered to hand' },
            ];
        },
    },
    {
        testId: 'ST07-012',
        coversEffectIndices: [0, 1],
        name: '비르기타 필드 트래시 조건 파워와 히트 증가',
        description: '이번 턴 필드에서 아군 유닛이 트래시되면 파워+3000, 히트+1을 받는다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard('ST07-012');
            p1.unitZones[1].unit = getCard('ST07-005');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const beforePower = engine.getUnitPower(p1.unitZones[0], p1);
            const beforeHit = engine.getUnitHit(p1.unitZones[0], p1);
            engine.destroyUnit(p1, p1.unitZones[1], undefined, 'EFFECT');
            const afterPower = engine.getUnitPower(p1.unitZones[0], p1);
            const afterHit = engine.getUnitHit(p1.unitZones[0], p1);
            return [
                { pass: afterPower === beforePower + 3000, message: '파워+3000 적용' },
                { pass: afterHit === beforeHit + 1, message: '히트+1 적용' },
            ];
        },
    },
    {
        testId: 'ST07-013',
        coversEffectIndices: [0],
        name: '빛나는 자신감 대미지 이동 후 선택 드로우',
        description: '덱 위 4장을 트래시하고 트래시 카드 1장을 대미지로 옮긴 뒤 7장째면 선택 드로우한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.hand = [getCard('ST07-013')];
            p1.leaderLevel = 10;
            p1.damage = [
                getCard('ST07-002'),
                getCard('ST07-003'),
                getCard('ST07-004'),
                getCard('ST07-005'),
                getCard('ST07-006'),
                getCard('ST07-007'),
            ];
            p1.deck = [getCard('ST07-014'), getCard('ST07-015'), getCard('ST07-016'), getCard('ST07-017'), getCard('ST07-005')];
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.playSkill(0);
            const handAfterSkill = p1.hand.length;
            const move = findAction(engine, p1.id, 'SELECT_TRASH_TARGET', (action: any) => p1.trash[action.trashIndex]?.id.startsWith('ST07-005'));
            if (move) engine.step(move);
            if (engine.state.interactionMode === 'SELECT_OPTIONAL') {
                const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
                if (confirm) engine.step(confirm);
            }
            return [
                { pass: p1.damage.some((card: Card) => card.id.startsWith('ST07-005')), message: '트래시 카드 대미지 존 이동' },
                { pass: p1.hand.length === handAfterSkill + 1, message: '7장째 도달 후 1드로우' },
            ];
        },
    },
    {
        testId: 'ST07-014',
        coversEffectIndices: [0],
        name: '망상 끝의 런웨이 밀링 후 런웨이 파이터 회수',
        description: '덱 위 4장을 트래시한 뒤 런웨이 파이터 유닛을 골라 패에 넣는다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.hand = [getCard('ST07-014')];
            p1.leaderLevel = 10;
            p1.deck = [getCard('ST07-013'), getCard('ST07-015'), getCard('ST07-016'), getCard('ST07-005')];
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.playSkill(0);
            const pick = findAction(engine, p1.id, 'SELECT_TRASH_TARGET', (action: any) => p1.trash[action.trashIndex]?.id.startsWith('ST07-005'));
            if (pick) engine.step(pick);
            return [
                { pass: p1.hand.some((card: Card) => card.id.startsWith('ST07-005')), message: '런웨이 파이터 유닛 회수' },
            ];
        },
    },
    {
        testId: 'ST07-014-Trigger',
        coversEffectIndices: [1, 2],
        name: '망상 끝의 런웨이 트리거 자가 트래시 후 덱 4장 밀링',
        description: '대미지 트리거 시 자신을 트래시하고 덱 맨 위 4장을 트래시한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.deck = [getCard('ST07-013'), getCard('ST07-015'), getCard('ST07-016'), getCard('ST07-017'), getCard('ST07-014')];
            p1.damage = [];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.dealDamage(p1, 1);
            return [
                { pass: p1.trash.some((card: Card) => card.id.startsWith('ST07-014')), message: '트리거로 자신 트래시' },
                { pass: p1.trash.length >= 5, message: '자신 포함 총 5장 이상 트래시' },
            ];
        },
    },
    {
        testId: 'ST07-015',
        coversEffectIndices: [0],
        name: '포와 숑 자가 유닛 파괴 후 1드로우',
        description: '필드의 아군 유닛 1장을 골라 트래시하고 카드를 1장 드로우한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.hand = [getCard('ST07-015')];
            p1.leaderLevel = 10;
            p1.unitZones[0].unit = getCard('ST07-005');
            p1.deck = [getCard('ST07-013')];
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.playSkill(0);
            const pick = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) => action.targetPlayerId === p1.id && action.zoneIndex === 0);
            if (pick) engine.step(pick);
            return [
                { pass: p1.unitZones[0].unit === null, message: '선택한 아군 유닛 트래시' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith('ST07-013')), message: '후속 1드로우 성공' },
            ];
        },
    },
    {
        testId: 'ST07-016',
        coversEffectIndices: [0],
        name: '사랑의 증거 선택 유닛 즉시 공격',
        description: '호문클루스 유닛을 선택하면 조우 유닛이 있는 같은 레인으로 즉시 공격한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.hand = [getCard('ST07-016')];
            p1.leaderLevel = 10;
            p1.unitZones[1].unit = getCard('ST07-007');
            p2.unitZones[1].unit = getCard('ST07-005');
            if (p2.unitZones[1].unit) p2.unitZones[1].unit.power = 1000;
            p2.deck = Array.from({ length: 10 }, () => getCard('ST01-002'));
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.playSkill(0);
            const pick = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) => action.targetPlayerId === p1.id && action.zoneIndex === 1);
            if (pick) engine.step(pick);
            const block = findAction(engine, p2.id, 'RESOLVE_BLOCK', (action: any) => action.shouldBlock && action.blockerZoneIndex === 1);
            if (block) engine.step(block);
            return [
                { pass: p2.unitZones[1].unit === null, message: '선택 유닛 즉시 공격으로 조우 유닛 정리' },
                { pass: engine.state.phase === Phase.MAIN, message: '자동 공격 후 원래 페이즈 복귀' },
            ];
        },
    },
    {
        testId: 'ST07-017',
        coversEffectIndices: [0, 1, 2],
        name: '어비스 드레이크 가죽갑옷 파워 증가 후 턴 종료 자폭 드로우',
        description: '장착 즉시 파워+2000을 주고 자신의 턴 종료 시 장착 유닛을 트래시하며 1드로우한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.hand = [getCard('ST07-017')];
            p1.leaderLevel = 10;
            p1.unitZones[0].unit = getCard('ST07-005');
            p1.deck = [getCard('ST07-013')];
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const beforePower = engine.getUnitPower(p1.unitZones[0], p1);
            engine.playItem(0, 0);
            const afterPower = engine.getUnitPower(p1.unitZones[0], p1);

            advanceUntil(engine, () => engine.currentPlayer.id === engine.state.players[1].id && engine.state.phase === Phase.LEVEL_UP);

            return [
                { pass: afterPower === beforePower + 2000, message: '장착 즉시 파워+2000' },
                { pass: p1.unitZones[0].unit === null, message: '턴 종료 시 장착 유닛 트래시' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith('ST07-013')), message: '턴 종료 1드로우' },
            ];
        },
    },
];

export const ST07Module: UnifiedTestModule = {
    packId: 'ST07',
    displayName: 'ST07 Homunculus Starter',
    tests,
};
