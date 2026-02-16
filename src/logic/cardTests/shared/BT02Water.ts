import { UnifiedTestCase, UnifiedTestModule, Phase } from './types';
import { RuleValidator } from '../../RuleValidator';
import { GameEngine } from '../../GameEngine';
import { resolveInteractionLoop, setBt02TestSize } from './BT02TestUtils';

function advanceToOwnLevelUp(engine: GameEngine, playerId: string): void {
    let guard = 0;
    while (!(engine.currentPlayer.id === playerId && engine.state.phase === Phase.LEVEL_UP) && guard < 14) {
        engine.nextPhase();
        guard += 1;
    }
}

const tests: UnifiedTestCase[] = [
    {
        testId: 'BT02-028',
        name: '리더 각성(레벨5) + 가디언 버프',
        description: '레벨 5에서 각성하고 각성면 패시브가 가디언에게 적용된다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 4;
            p1.levelZone = getCard('BT02-028');
            p1.levelZone.isAwakened = false;
            p1.unitZones[0].unit = getCard('BT02-030'); // 가디언
            engine.state.phase = Phase.LEVEL_UP;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.nextPhase();
            const base = p1.unitZones[0].unit?.power || 0;
            const buffed = engine.getUnitPower(p1.unitZones[0], p1);
            return [
                { pass: p1.levelZone?.isAwakened === true, message: '리더 각성 성공' },
                { pass: buffed === base + 1000, message: `가디언 +1000 (${buffed})` },
            ];
        },
    },
    {
        testId: 'BT02-029',
        name: '디펜더 +2000 전투',
        description: '방어 시 +2000으로 전투 우위를 만든다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setBt02TestSize(engine);
            p1.unitZones[0].unit = getCard('ST01-002');
            p1.unitZones[0].unit!.power = 3000;
            p2.unitZones[0].unit = getCard('BT02-029');
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            engine.attack(0);
            engine.resolveBlock(true, 0);
            return [
                { pass: p2.unitZones[0].unit !== null, message: '디펜더 유닛 생존' },
                { pass: p1.unitZones[0].unit === null, message: '공격 유닛 트래시' },
            ];
        },
    },
    {
        testId: 'BT02-030',
        name: '가디언 방벽[1]',
        description: '인접 레인 방어 시 패 1장 코스트를 지불한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setBt02TestSize(engine);
            p1.unitZones[1].unit = getCard('ST01-002');
            p2.unitZones[0].unit = getCard('BT02-030');
            p2.hand = [getCard('ST01-002')];
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p2 = engine.opponentPlayer;
            engine.attack(1);
            const block = engine.getLegalActions(p2.id).find(
                action => action.type === 'RESOLVE_BLOCK' && action.shouldBlock && action.blockerZoneIndex === 0
            );
            if (block) engine.step(block);
            if (engine.state.interactionMode === 'SELECT_COST') {
                engine.selectCostForPlayerId(0, p2.id);
            }
            return [
                { pass: p2.trash.length >= 1, message: '방벽 코스트 1장 지불' },
            ];
        },
    },
    {
        testId: 'BT02-031',
        name: '디펜더 +2000 전투',
        description: '방어 시 +2000 적용으로 전투 생존을 확인한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setBt02TestSize(engine);
            p1.unitZones[0].unit = getCard('ST01-002');
            p1.unitZones[0].unit!.power = 4000;
            p2.unitZones[0].unit = getCard('BT02-031');
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            engine.attack(0);
            engine.resolveBlock(true, 0);
            return [
                { pass: p2.unitZones[0].unit !== null, message: '디펜더 유닛 생존' },
                { pass: p1.unitZones[0].unit === null, message: '공격 유닛 트래시' },
            ];
        },
    },
    {
        testId: 'BT02-032',
        name: '돌파[6코스트 이상] 방어 제한',
        description: '6코스트 이상 조우 유닛은 방어할 수 없고, 인접 가디언은 방어 가능.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setBt02TestSize(engine);
            p1.unitZones[1].unit = getCard('BT02-032');
            p2.unitZones[1].unit = getCard('ST01-011'); // cost 7
            p2.unitZones[0].unit = getCard('BT02-030'); // 가디언
            p2.hand = [getCard('ST01-002')];
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p2 = engine.opponentPlayer;
            engine.attack(1);
            const legal = engine.getLegalActions(p2.id).filter(action => action.type === 'RESOLVE_BLOCK');
            const canEncounterBlock = legal.some(action => action.type === 'RESOLVE_BLOCK' && action.shouldBlock && action.blockerZoneIndex === 1);
            const canGuardianBlock = legal.some(action => action.type === 'RESOLVE_BLOCK' && action.shouldBlock && action.blockerZoneIndex === 0);
            return [
                { pass: canEncounterBlock === false, message: '6코 이상 조우 유닛 방어 불가' },
                { pass: canGuardianBlock === true, message: '인접 가디언 방어 가능' },
            ];
        },
    },
    {
        testId: 'BT02-034',
        name: '가디언 방벽[1]',
        description: '인접 레인 방어 시 패 1장 코스트를 지불한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setBt02TestSize(engine);
            p1.unitZones[1].unit = getCard('ST01-002');
            p2.unitZones[0].unit = getCard('BT02-034');
            p2.hand = [getCard('ST01-002')];
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p2 = engine.opponentPlayer;
            engine.attack(1);
            const block = engine.getLegalActions(p2.id).find(
                action => action.type === 'RESOLVE_BLOCK' && action.shouldBlock && action.blockerZoneIndex === 0
            );
            if (block) engine.step(block);
            if (engine.state.interactionMode === 'SELECT_COST') {
                engine.selectCostForPlayerId(0, p2.id);
            }
            return [
                { pass: p2.trash.length >= 1, message: '방벽 코스트 1장 지불' },
            ];
        },
    },
    {
        testId: 'BT02-035',
        name: '어태커 침투[1]',
        description: '방어되지 않은 공격이면 카드를 1장 드로우한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.unitZones[0].unit = getCard('BT02-035');
            p1.deck = [getCard('ST01-002'), getCard('ST01-002')];
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const before = p1.hand.length;
            engine.attack(0);
            engine.resolveBlock(false);
            return [
                { pass: p1.hand.length >= before + 1, message: '침투 드로우 발동' },
            ];
        },
    },
    {
        testId: 'BT02-036',
        name: '엔트리 가디언 히트+1',
        description: '엔트리로 가디언 유닛 1장을 선택해 히트를 올린다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.hand = [getCard('BT02-036')];
            p1.unitZones[1].unit = getCard('BT02-030');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const baseHit = engine.getUnitHit(p1.unitZones[1], p1);
            engine.playUnit(0, 0);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                const target = engine.getLegalActions(p1.id).find(action => action.type === 'SELECT_ZONE_TARGET' && action.zoneIndex === 1);
                if (target) engine.step(target);
            }
            const buffedHit = engine.getUnitHit(p1.unitZones[1], p1);
            return [
                { pass: buffedHit === baseHit + 1, message: `가디언 히트+1 (${buffedHit})` },
            ];
        },
    },
    {
        testId: 'BT02-036-Trigger',
        name: '트리거 효과: 최저 코스트 유닛+아이템 패복귀',
        description: '대미지 트리거로 최저 코스트 상대 유닛과 장착 아이템을 패로 돌린다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setBt02TestSize(engine);
            p1.deck = [getCard('ST01-002'), getCard('BT02-036')];
            p2.unitZones[0].unit = getCard('ST01-002'); // low cost
            p2.unitZones[0].items = [getCard('BT02-079')];
            p2.unitZones[1].unit = getCard('ST01-011'); // high cost
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            engine.dealDamage(p1, 1);
            resolveInteractionLoop(engine);
            return [
                { pass: p2.unitZones[0].unit === null, message: '최저 코스트 유닛 필드 이탈' },
                { pass: p2.hand.some(card => card.id.startsWith('BT02-079')), message: '장착 아이템 패 복귀' },
            ];
        },
    },
    {
        testId: 'BT02-038',
        name: '패시브 디펜더 전원 +2000',
        description: '디펜더 키워드를 가진 아군 유닛만 +2000을 받는다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.unitZones[0].unit = getCard('BT02-038');
            p1.unitZones[1].unit = getCard('BT02-029'); // 디펜더
            p1.unitZones[2].unit = getCard('BT02-003'); // 비디펜더
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const defenderBase = p1.unitZones[1].unit?.power || 0;
            const normalBase = p1.unitZones[2].unit?.power || 0;
            const defenderPower = engine.getUnitPower(p1.unitZones[1], p1);
            const normalPower = engine.getUnitPower(p1.unitZones[2], p1);
            return [
                { pass: defenderPower === defenderBase + 2000, message: `디펜더 +2000 (${defenderPower})` },
                { pass: normalPower === normalBase, message: '비디펜더는 변화 없음' },
            ];
        },
    },
    {
        testId: 'BT02-039',
        name: '엔트리 +2000 (상대 턴 종료까지)',
        description: '엔트리 버프는 상대 턴 종료 시 해제된다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setBt02TestSize(engine);
            p1.hand = [getCard('BT02-039')];
            p1.deck = Array.from({ length: 8 }, () => getCard('ST01-002'));
            p2.deck = Array.from({ length: 8 }, () => getCard('ST01-002'));
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playUnit(0, 0);
            const base = p1.unitZones[0].unit?.power || 0;
            const buffed = engine.getUnitPower(p1.unitZones[0], p1);
            advanceToOwnLevelUp(engine, p1.id);
            const afterOppTurnEnd = p1.unitZones[0].unit ? engine.getUnitPower(p1.unitZones[0], p1) : 0;
            return [
                { pass: buffed >= base + 2000, message: `엔트리 +2000 (${buffed})` },
                { pass: afterOppTurnEnd === base, message: '상대 턴 종료 후 버프 해제' },
            ];
        },
    },
    {
        testId: 'BT02-040',
        name: '엔트리 1드로우',
        description: '유닛 배치 시 1장 드로우한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.hand = [getCard('BT02-040')];
            p1.deck = [getCard('ST01-002'), getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const before = p1.hand.length;
            engine.playUnit(0, 0);
            return [
                { pass: p1.hand.length === before, message: `엔트리 드로우 순증 0 (${p1.hand.length})` },
            ];
        },
    },
    {
        testId: 'BT02-041',
        name: '손패 5장 조건 돌파',
        description: '손패 5장 이상일 때 공격 시 돌파[6코스트 이상]를 얻는다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setBt02TestSize(engine);
            p1.unitZones[1].unit = getCard('BT02-041');
            p1.hand = [getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002')];
            p2.unitZones[1].unit = getCard('ST01-011'); // cost 7
            p2.unitZones[0].unit = getCard('BT02-030');
            p2.hand = [getCard('ST01-002')];
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p2 = engine.opponentPlayer;
            engine.attack(1);
            const legal = engine.getLegalActions(p2.id).filter(action => action.type === 'RESOLVE_BLOCK');
            const canEncounterBlock = legal.some(action => action.type === 'RESOLVE_BLOCK' && action.shouldBlock && action.blockerZoneIndex === 1);
            return [
                { pass: canEncounterBlock === false, message: '손패 조건 충족 시 고코스트 조우 방어 불가' },
            ];
        },
    },
    {
        testId: 'BT02-041-Trigger',
        name: '트리거 효과: 자기 트래시 + 1드로우',
        description: '대미지 트리거 시 자기 자신은 트래시되고 1장을 드로우한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.deck = [getCard('ST01-002'), getCard('BT02-041')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const beforeHand = p1.hand.length;
            engine.dealDamage(p1, 1);
            return [
                { pass: p1.trash.some(card => card.id.startsWith('BT02-041')), message: '트리거 카드 자기 트래시' },
                { pass: p1.hand.length === beforeHand + 1, message: '추가 1드로우 적용' },
            ];
        },
    },
    {
        testId: 'BT02-042',
        name: '엔트리 비트리거 스킬 덱탑 이동',
        description: '트래시의 비트리거 스킬을 덱 맨 위로 이동한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.hand = [getCard('BT02-042')];
            p1.trash = [getCard('ST04-012')];
            p1.deck = [getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playUnit(0, 0);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectTrashTarget(0, p1.id);
            }
            const top = p1.deck[p1.deck.length - 1];
            return [
                { pass: top?.id?.startsWith('ST04-012') === true, message: '비트리거 스킬 덱탑 이동 성공' },
            ];
        },
    },
    {
        testId: 'BT02-042-Trigger',
        name: '트리거 효과: 패 복귀',
        description: '대미지 트리거 시 해당 카드가 패로 복귀한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.deck = [getCard('ST01-002'), getCard('BT02-042')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.dealDamage(p1, 1);
            return [
                { pass: p1.hand.some(card => card.id.startsWith('BT02-042')), message: '트리거 패 복귀 성공' },
            ];
        },
    },
    {
        testId: 'BT02-043',
        name: '디펜더 +4000 전투',
        description: '방어 시 +4000 적용으로 공격 유닛을 이긴다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setBt02TestSize(engine);
            p1.unitZones[0].unit = getCard('ST01-002');
            p1.unitZones[0].unit!.power = 6500;
            p2.unitZones[0].unit = getCard('BT02-043');
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            engine.attack(0);
            engine.resolveBlock(true, 0);
            return [
                { pass: p2.unitZones[0].unit !== null, message: '디펜더 유닛 생존' },
                { pass: p1.unitZones[0].unit === null, message: '공격 유닛 트래시' },
            ];
        },
    },
    {
        testId: 'BT02-043-Trigger',
        name: '트리거 효과: 최저 코스트 유닛+아이템 패복귀',
        description: '최저 코스트 상대 유닛과 장착 아이템을 패로 되돌린다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setBt02TestSize(engine);
            p1.deck = [getCard('ST01-002'), getCard('BT02-043')];
            p2.unitZones[0].unit = getCard('ST01-002');
            p2.unitZones[0].items = [getCard('BT02-079')];
            p2.unitZones[1].unit = getCard('ST01-011');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            engine.dealDamage(p1, 1);
            resolveInteractionLoop(engine);
            return [
                { pass: p2.unitZones[0].unit === null, message: '최저 코스트 유닛 필드 이탈' },
                { pass: p2.hand.some(card => card.id.startsWith('BT02-079')), message: '장착 아이템 패 복귀' },
            ];
        },
    },
    {
        testId: 'BT02-045',
        name: '손패 트래시 이벤트 턴당 1회',
        description: '효과로 손패 트래시 시 1드로우, 같은 턴 중복 미발동, 다음 턴 리셋.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setBt02TestSize(engine);
            p1.unitZones[0].unit = getCard('BT02-045');
            p1.hand = [getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002')];
            p1.deck = [getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002')];
            p2.deck = Array.from({ length: 6 }, () => getCard('ST01-002'));
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const before = p1.hand.length;
            const cardA = p1.hand.shift()!;
            p1.trash.push(cardA);
            engine.notifyHandTrashed(p1, [cardA], { flags: { handTrashByEffect: true } });

            const mid = p1.hand.length;
            const cardB = p1.hand.shift()!;
            p1.trash.push(cardB);
            engine.notifyHandTrashed(p1, [cardB], { flags: { handTrashByEffect: true } });
            const afterSecond = p1.hand.length;

            advanceToOwnLevelUp(engine, p1.id);
            const cardC = p1.hand.shift()!;
            p1.trash.push(cardC);
            engine.notifyHandTrashed(p1, [cardC], { flags: { handTrashByEffect: true } });
            const afterNextTurnTrigger = p1.hand.length;

            return [
                { pass: mid === before, message: '첫 트리거로 1드로우 반영' },
                { pass: afterSecond === mid - 1, message: '동일 턴 2회차 추가 드로우 없음' },
                { pass: afterNextTurnTrigger === afterSecond, message: '다음 턴에 1회 제한 리셋' },
            ];
        },
    },
    {
        testId: 'BT02-046',
        name: '방벽[3] + 상대 3코 이상 광전사 부여',
        description: '패시브로 상대 고코스트 유닛이 광전사 제약을 받는다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            setBt02TestSize(engine);
            p1.unitZones[0].unit = getCard('BT02-046');
            p2.unitZones[0].unit = getCard('BT02-013'); // cost 4
            p2.unitZones[1].unit = getCard('ST01-002'); // cost 2
            engine.state.turnPlayerIndex = 1;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p2 = engine.currentPlayer;
            const cannotEndPhase = RuleValidator.canEndPhase(engine, p2).valid;
            p2.unitZones[0].hasAttacked = true;
            const canEndAfterBerserkAttack = RuleValidator.canEndPhase(engine, p2).valid;
            return [
                { pass: cannotEndPhase === false, message: '광전사 유닛 미공격 상태에서 페이즈 종료 불가' },
                { pass: canEndAfterBerserkAttack === true, message: '광전사 유닛 공격 처리 후 페이즈 종료 가능' },
            ];
        },
    },
    {
        testId: 'BT02-046-Trigger',
        name: '트리거 효과: 패 복귀',
        description: '대미지 트리거 시 패로 복귀한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.deck = [getCard('ST01-002'), getCard('BT02-046')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.dealDamage(p1, 1);
            return [
                { pass: p1.hand.some(card => card.id.startsWith('BT02-046')), message: '트리거 패 복귀 성공' },
            ];
        },
    },
    {
        testId: 'BT02-047',
        name: '디펜더 대상 +3500',
        description: '디펜더 유닛 1장을 선택해 +3500을 부여한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.hand = [getCard('BT02-047')];
            p1.unitZones[0].unit = getCard('BT02-029');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const before = engine.getUnitPower(p1.unitZones[0], p1);
            engine.playSkill(0);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectZoneTargetByPlayerId(0, p1.id);
            }
            const after = engine.getUnitPower(p1.unitZones[0], p1);
            return [
                { pass: after === before + 3500, message: `디펜더 +3500 (${after})` },
            ];
        },
    },
    {
        testId: 'BT02-048',
        name: '가디언 파워 전이',
        description: '가디언 1장과 비가디언 1장을 선택해 비가디언에 파워를 전이한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.hand = [getCard('BT02-048')];
            p1.unitZones[0].unit = getCard('BT02-030'); // 가디언
            p1.unitZones[1].unit = getCard('BT02-003'); // 비가디언
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const guardianPower = engine.getUnitPower(p1.unitZones[0], p1);
            const before = engine.getUnitPower(p1.unitZones[1], p1);
            engine.playSkill(0);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                const first = engine.getLegalActions(p1.id).find(action => action.type === 'SELECT_ZONE_TARGET' && action.zoneIndex === 0);
                if (first) engine.step(first);
                const second = engine.getLegalActions(p1.id).find(action => action.type === 'SELECT_ZONE_TARGET' && action.zoneIndex === 1);
                if (second) engine.step(second);
                const confirm = engine.getLegalActions(p1.id).find(action => action.type === 'CONFIRM_TARGETS');
                if (confirm) engine.step(confirm);
            }
            const after = engine.getUnitPower(p1.unitZones[1], p1);
            return [
                { pass: after >= before + guardianPower, message: `비가디언 파워 전이 (${after})` },
            ];
        },
    },
    {
        testId: 'BT02-049',
        name: '디펜더 2장 선택 후 공격불가 잠금',
        description: '디펜더 2장 선택, 1대미지, 선택 유닛 2장 공격불가.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setBt02TestSize(engine);
            p1.hand = [getCard('BT02-049')];
            p1.unitZones[0].unit = getCard('BT02-029');
            p1.unitZones[1].unit = getCard('BT02-031');
            p2.deck = [getCard('ST01-002'), getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            const before = p2.damage.length;
            engine.playSkill(0);

            if (engine.state.interactionMode === 'SELECT_TARGET') {
                const picks = engine.getLegalActions(p1.id).filter(a => a.type === 'SELECT_ZONE_TARGET');
                const first = picks.find(a => a.type === 'SELECT_ZONE_TARGET' && a.zoneIndex === 0);
                if (first && first.type === 'SELECT_ZONE_TARGET') {
                    engine.selectZoneTargetByPlayerId(first.zoneIndex, first.targetPlayerId);
                }
                const second = engine.getLegalActions(p1.id).find(a => a.type === 'SELECT_ZONE_TARGET' && a.zoneIndex === 1);
                if (second && second.type === 'SELECT_ZONE_TARGET') {
                    engine.selectZoneTargetByPlayerId(second.zoneIndex, second.targetPlayerId);
                }
                if (engine.getLegalActions(p1.id).some(a => a.type === 'CONFIRM_TARGETS')) {
                    engine.confirmTargets();
                }
            }

            return [
                { pass: p2.damage.length === before + 1, message: '상대 1대미지' },
                { pass: p1.unitZones[0].hasAttacked && p1.unitZones[1].hasAttacked, message: '선택된 디펜더 공격 잠금 적용' },
            ];
        },
    },
    {
        testId: 'BT02-050',
        name: '손패 5장 이상 추가 히트',
        description: '가디언 대상 +2000, 손패 5장 이상이면 추가 히트+1.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.hand = [getCard('BT02-050'), getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002')];
            p1.unitZones[0].unit = getCard('BT02-030');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const baseHit = engine.getUnitHit(p1.unitZones[0], p1);
            engine.playSkill(0);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectZoneTargetByPlayerId(0, p1.id);
            }
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectZoneTargetByPlayerId(0, p1.id);
            }
            const newHit = engine.getUnitHit(p1.unitZones[0], p1);
            return [
                { pass: newHit >= baseHit + 1, message: '조건부 히트+1 적용' },
            ];
        },
    },
    {
        testId: 'BT02-051',
        name: '손패 2장 코스트 후 1대미지',
        description: '코스트 2장을 트래시하면 상대에게 1대미지를 준다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setBt02TestSize(engine);
            p1.hand = [getCard('BT02-051'), getCard('ST01-002'), getCard('ST01-002')];
            p2.deck = [getCard('ST01-002'), getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            const beforeDamage = p2.damage.length;
            const beforeTrash = p1.trash.length;
            engine.playSkill(0);
            if (engine.state.interactionMode === 'SELECT_COST') {
                engine.selectCostForPlayerId(0, p1.id);
                if (engine.state.interactionMode === 'SELECT_COST') {
                    engine.selectCostForPlayerId(0, p1.id);
                }
            }
            return [
                { pass: p2.damage.length === beforeDamage + 1, message: '상대 1대미지 적용' },
                { pass: p1.trash.length >= beforeTrash + 2, message: '손패 2장 코스트 지불' },
            ];
        },
    },
    {
        testId: 'BT02-052',
        name: '장착조건 3코 이하 + 파워+1000',
        description: '3코 이하는 장착 가능하고 파워가 오른다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.hand = [getCard('BT02-052')];
            p1.unitZones[0].unit = getCard('BT02-013'); // cost 4
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const invalid = RuleValidator.canPlayItem(engine, p1, 0, 0).valid;
            p1.unitZones[0].unit = getCard('BT02-003'); // cost 3
            const valid = RuleValidator.canPlayItem(engine, p1, 0, 0).valid;
            const before = engine.getUnitPower(p1.unitZones[0], p1);
            if (valid) engine.playItem(0, 0);
            const after = engine.getUnitPower(p1.unitZones[0], p1);
            return [
                { pass: invalid === false, message: '4코 유닛 장착 불가' },
                { pass: valid === true, message: '3코 유닛 장착 가능' },
                { pass: after >= before + 1000, message: `장착 파워+1000 (${after})` },
            ];
        },
    },
    {
        testId: 'BT02-053',
        name: '장착조건 가디언 + 파워+2000',
        description: '가디언 유닛만 장착 가능하고 파워가 오른다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.hand = [getCard('BT02-053')];
            p1.unitZones[0].unit = getCard('BT02-003'); // 비가디언
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const invalid = RuleValidator.canPlayItem(engine, p1, 0, 0).valid;
            p1.unitZones[0].unit = getCard('BT02-030'); // 가디언
            const valid = RuleValidator.canPlayItem(engine, p1, 0, 0).valid;
            const before = engine.getUnitPower(p1.unitZones[0], p1);
            if (valid) engine.playItem(0, 0);
            const after = engine.getUnitPower(p1.unitZones[0], p1);
            return [
                { pass: invalid === false, message: '비가디언 장착 불가' },
                { pass: valid === true, message: '가디언 장착 가능' },
                { pass: after >= before + 2000, message: `장착 파워+2000 (${after})` },
            ];
        },
    },
    {
        testId: 'BT02-054',
        name: '장착조건 4코 이상 + 침투',
        description: '4코 이상 유닛 장착 시 침투 드로우를 얻는다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.hand = [getCard('BT02-054')];
            p1.unitZones[0].unit = getCard('BT02-003'); // cost 3
            p1.deck = [getCard('ST01-002'), getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const invalid = RuleValidator.canPlayItem(engine, p1, 0, 0).valid;
            p1.unitZones[0].unit = getCard('BT02-013'); // cost 4
            const valid = RuleValidator.canPlayItem(engine, p1, 0, 0).valid;
            if (valid) engine.playItem(0, 0);
            const before = p1.hand.length;
            engine.state.phase = Phase.ATTACK;
            engine.attack(0);
            engine.resolveBlock(false);
            return [
                { pass: invalid === false, message: '3코 유닛 장착 불가' },
                { pass: valid === true, message: '4코 유닛 장착 가능' },
                { pass: p1.hand.length >= before + 1, message: '침투 드로우 발동' },
            ];
        },
    },
];

export const BT02WaterModule: UnifiedTestModule = {
    packId: 'BT02',
    displayName: 'BT02 Water Unified',
    tests,
};
