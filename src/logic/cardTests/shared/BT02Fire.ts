import { UnifiedTestCase, UnifiedTestModule, Phase } from './types';
import { RuleValidator } from '../../RuleValidator';
import { resolveInteractionLoop, setBt02TestSize } from './BT02TestUtils';

const tests: UnifiedTestCase[] = [
    {
        testId: 'BT02-001',
        name: '엔트리 어태커 +1500',
        description: '엔트리 후 공격 시 +1500 적용 확인.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setBt02TestSize(engine);
            p1.hand = [getCard('BT02-001')];
            p2.unitZones[0].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playUnit(0, 0);
            const base = p1.unitZones[0].unit?.power || 0;
            engine.state.phase = Phase.ATTACK;
            engine.attack(0);
            const buffed = engine.getUnitPower(p1.unitZones[0], p1);
            engine.resolveBlock(true, 0);
            const afterBattle = p1.unitZones[0].unit ? engine.getUnitPower(p1.unitZones[0], p1) : 0;
            return [
                { pass: buffed >= base + 1500, message: `어태커 +1500 적용 (${buffed})` },
                { pass: afterBattle === base, message: `전투 종료 후 임시 파워 해제 (${afterBattle})` },
            ];
        },
    },
    {
        testId: 'BT02-002',
        name: '엔트리 아군 전원 어태커 +500 부여',
        description: '엔트리 후 아군 전원에게 어태커 파워 증가 부여.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setBt02TestSize(engine);
            p1.hand = [getCard('BT02-002')];
            p1.unitZones[1].unit = getCard('ST01-002');
            p2.unitZones[1].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playUnit(0, 0);
            const base = p1.unitZones[1].unit?.power || 0;
            engine.state.phase = Phase.ATTACK;
            engine.attack(1);
            const buffed = engine.getUnitPower(p1.unitZones[1], p1);
            return [
                { pass: buffed >= base + 500, message: `아군 어태커 +500 (${buffed})` },
            ];
        },
    },
    {
        testId: 'BT02-003',
        name: '듀얼리스트 + 어태커 +4000',
        description: '공격 시 듀얼리스트로 가디언 방어가 제한되고 파워가 증가한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setBt02TestSize(engine);
            p1.unitZones[0].unit = getCard('BT02-003');
            p2.unitZones[0].unit = getCard('ST01-002');
            p2.unitZones[1].unit = getCard('BT02-030');
            p2.hand = [getCard('ST01-002')];
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            const base = p1.unitZones[0].unit?.power || 0;
            engine.attack(0);
            const buffed = engine.getUnitPower(p1.unitZones[0], p1);
            const legal = engine.getLegalActions(p2.id).filter(action => action.type === 'RESOLVE_BLOCK');
            const hasEncounterBlock = legal.some(action => action.type === 'RESOLVE_BLOCK' && action.shouldBlock && action.blockerZoneIndex === 0);
            const hasGuardianBlock = legal.some(action => action.type === 'RESOLVE_BLOCK' && action.shouldBlock && action.blockerZoneIndex === 1);
            return [
                { pass: buffed >= base + 4000, message: `어태커 +4000 (${buffed})` },
                { pass: hasEncounterBlock, message: '조우 레인 방어 가능' },
                { pass: hasGuardianBlock === false, message: '듀얼리스트로 가디언 방어 제한' },
            ];
        },
    },
    {
        testId: 'BT02-003-Trigger',
        name: '트리거 효과: 패 복귀',
        description: '대미지 트리거 시 해당 카드가 패로 복귀한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.deck = [getCard('ST01-002'), getCard('BT02-003')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.dealDamage(p1, 1);
            return [
                { pass: p1.hand.some(card => card.id.startsWith('BT02-003')), message: '트리거 패 복귀 성공' },
                { pass: p1.damage.every(card => !card.id.startsWith('BT02-003')), message: '대미지 존에서 제거됨' },
            ];
        },
    },
    {
        testId: 'BT02-005',
        name: '어태커 +3000',
        description: '공격 시 파워 +3000 적용 확인.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setBt02TestSize(engine);
            p1.unitZones[0].unit = getCard('BT02-005');
            p2.unitZones[0].unit = getCard('ST01-002');
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const base = p1.unitZones[0].unit?.power || 0;
            engine.attack(0);
            const buffed = engine.getUnitPower(p1.unitZones[0], p1);
            return [
                { pass: buffed >= base + 3000, message: `어태커 +3000 (${buffed})` },
            ];
        },
    },
    {
        testId: 'BT02-006',
        name: '트래시 2코 이하 유닛 회수',
        description: '엔트리로 2코 이하 유닛 1장 회수.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.hand = [getCard('BT02-006')];
            p1.trash = [getCard('ST01-002'), getCard('BT02-013')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playUnit(0, 0);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                const legal = engine.getLegalActions(p1.id).filter(action => action.type === 'SELECT_TRASH_TARGET');
                const lowCost = legal.some(action => action.type === 'SELECT_TRASH_TARGET' && p1.trash[action.trashIndex]?.id.startsWith('ST01-002'));
                const highCost = legal.some(action => action.type === 'SELECT_TRASH_TARGET' && p1.trash[action.trashIndex]?.id.startsWith('BT02-013'));
                if (legal[0] && legal[0].type === 'SELECT_TRASH_TARGET') {
                    engine.step(legal[0]);
                }
                return [
                    { pass: lowCost === true, message: '2코 이하 카드 타겟 가능' },
                    { pass: highCost === false, message: '3코 이상 카드 타겟 불가' },
                    { pass: p1.hand.some(card => card.id.startsWith('ST01-002')), message: '트래시 유닛 회수 성공' },
                ];
            }
            return [{ pass: false, message: '타겟 선택 상태 진입 실패' }];
        },
    },
    {
        testId: 'BT02-007',
        name: '스킬 아군 전원 약탈 부여',
        description: '약탈 부여 후 전투 트래시 시 드로우 발생.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setBt02TestSize(engine);
            p1.hand = [getCard('BT02-007')];
            p1.deck = [getCard('ST01-002'), getCard('ST01-002')];
            p1.unitZones[0].unit = getCard('ST01-002');
            p2.unitZones[0].unit = getCard('ST01-002');
            if (p1.unitZones[0].unit) p1.unitZones[0].unit.power = 6000;
            if (p2.unitZones[0].unit) p2.unitZones[0].unit.power = 1000;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playSkill(0);
            const before = p1.hand.length;
            engine.state.phase = Phase.ATTACK;
            engine.attack(0);
            engine.resolveBlock(true, 0);
            return [
                { pass: p1.hand.length >= before + 1, message: `약탈 드로우 반영 (${p1.hand.length})` },
            ];
        },
    },
    {
        testId: 'BT02-008',
        name: '트래시 7코 이상 유닛 회수',
        description: '스킬로 7코 이상 유닛만 선택 가능.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.hand = [getCard('BT02-008')];
            p1.trash = [getCard('ST01-002'), getCard('ST01-011')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playSkill(0);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                const legal = engine.getLegalActions(p1.id).filter(action => action.type === 'SELECT_TRASH_TARGET');
                const hasLow = legal.some(action => action.type === 'SELECT_TRASH_TARGET' && p1.trash[action.trashIndex]?.id.startsWith('ST01-002'));
                const hasHigh = legal.some(action => action.type === 'SELECT_TRASH_TARGET' && p1.trash[action.trashIndex]?.id.startsWith('ST01-011'));
                const highAction = legal.find(action => action.type === 'SELECT_TRASH_TARGET' && p1.trash[action.trashIndex]?.id.startsWith('ST01-011'));
                if (highAction) {
                    engine.step(highAction);
                }
                return [
                    { pass: hasHigh, message: '7코 이상 타겟 가능' },
                    { pass: hasLow === false, message: '7코 미만 타겟 불가' },
                    { pass: p1.hand.some(card => card.id.startsWith('ST01-011')), message: '고코스트 유닛 회수 성공' },
                ];
            }
            return [{ pass: false, message: '타겟 선택 상태 진입 실패' }];
        },
    },
    {
        testId: 'BT02-009',
        name: '아이템 장착조건 3코스트 이하',
        description: '4코 유닛에는 장착 불가, 3코 이하 유닛에는 장착 가능, 장착 시 파워 증가.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.hand = [getCard('BT02-009')];
            p1.unitZones[0].unit = getCard('BT02-013'); // cost 4
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const invalid = RuleValidator.canPlayItem(engine, p1, 0, 0).valid;

            p1.unitZones[0].unit = getCard('BT02-003'); // cost 3
            const valid = RuleValidator.canPlayItem(engine, p1, 0, 0).valid;
            const basePower = engine.getUnitPower(p1.unitZones[0], p1);
            if (valid) {
                engine.playItem(0, 0);
            }
            const buffedPower = engine.getUnitPower(p1.unitZones[0], p1);

            return [
                { pass: invalid === false, message: '4코 유닛 장착 불가' },
                { pass: valid === true, message: '3코 유닛 장착 가능' },
                { pass: buffedPower >= basePower + 4000, message: `장착 파워+4000 적용 (${buffedPower})` },
            ];
        },
    },
    {
        testId: 'BT02-009-Trigger',
        name: '트리거 효과: 자기 트래시 + 2코 이하 유닛 회수',
        description: '대미지 트리거 발동 시 자기 트래시 후 트래시 유닛을 회수.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.deck = [getCard('ST01-002'), getCard('BT02-009')];
            p1.trash = [getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.dealDamage(p1, 1);
            resolveInteractionLoop(engine);
            return [
                { pass: p1.trash.some(card => card.id.startsWith('BT02-009')), message: '트리거 카드 자기 트래시' },
                { pass: p1.hand.some(card => card.id.startsWith('ST01-002')), message: '2코 이하 유닛 회수 성공' },
            ];
        },
    },
];

export const BT02FireModule: UnifiedTestModule = {
    packId: 'BT02',
    displayName: 'BT02 Fire Unified',
    tests,
};
