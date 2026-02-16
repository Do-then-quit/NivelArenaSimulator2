import { UnifiedTestCase, UnifiedTestModule, Phase } from './types';
import { RuleValidator } from '../../RuleValidator';
import { setBt02TestSize } from './BT02TestUtils';

const tests: UnifiedTestCase[] = [
    {
        testId: 'BT02-010',
        name: '상단 1장 베이스 회수',
        description: '엔트리로 공개한 베이스 유닛을 패로 회수.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.hand = [getCard('BT02-010')];
            p1.deck = [getCard('ST01-002'), getCard('BT01-031')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playUnit(0, 0);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectRevealedTarget(0);
            }
            return [
                { pass: p1.hand.some(card => card.id.startsWith('BT01-031')), message: '베이스 유닛 회수 성공' },
            ];
        },
    },
    {
        testId: 'BT02-011-Trigger',
        name: '트리거 효과: 자기 트래시 + 리더 레벨+1',
        description: '대미지 트리거로 자기 자신은 트래시되고 리더 레벨이 1 오른다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.leaderLevel = 4;
            p1.deck = [getCard('ST01-002'), getCard('BT02-011')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const beforeLevel = p1.leaderLevel;
            engine.dealDamage(p1, 1);
            return [
                { pass: p1.leaderLevel === beforeLevel + 1, message: `리더 레벨 +1 (${p1.leaderLevel})` },
                { pass: p1.trash.some(card => card.id.startsWith('BT02-011')), message: '트리거 카드 트래시 이동' },
                { pass: p1.damage.every(card => !card.id.startsWith('BT02-011')), message: '대미지 존에서 제거됨' },
            ];
        },
    },
    {
        testId: 'BT02-012',
        name: '패시브 베이스 수 비례 히트 증가',
        description: '베이스 유닛 수에 비례해 베이스 유닛 히트가 증가한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.unitZones[0].unit = getCard('BT02-012');
            p1.unitZones[1].unit = getCard('BT01-031'); // 베이스
            p1.unitZones[2].unit = getCard('BT02-014'); // 베이스
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const baseHit = p1.unitZones[0].unit?.hit || 0;
            const buffedHit = engine.getUnitHit(p1.unitZones[0], p1);
            return [
                { pass: buffedHit >= baseHit + 1, message: `베이스 수 비례 자기 히트 증가 (${buffedHit})` },
            ];
        },
    },
    {
        testId: 'BT02-012-Trigger',
        name: '트리거 효과: 패 복귀',
        description: '대미지 트리거로 해당 카드가 패로 복귀한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.deck = [getCard('ST01-002'), getCard('BT02-012')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.dealDamage(p1, 1);
            return [
                { pass: p1.hand.some(card => card.id.startsWith('BT02-012')), message: '트리거 패 복귀 성공' },
                { pass: p1.damage.every(card => !card.id.startsWith('BT02-012')), message: '대미지 존에서 제거됨' },
            ];
        },
    },
    {
        testId: 'BT02-013',
        name: '엔트리 단일 아군 +2000',
        description: '엔트리 시 아군 유닛 1장을 선택해 파워를 올린다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.hand = [getCard('BT02-013')];
            p1.unitZones[1].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = engine.getUnitPower(p1.unitZones[1], p1);
            engine.playUnit(0, 0);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                const target = engine.getLegalActions(p1.id).find(action => action.type === 'SELECT_ZONE_TARGET' && action.zoneIndex === 1);
                if (target) {
                    engine.step(target);
                }
            }
            const buffedPower = engine.getUnitPower(p1.unitZones[1], p1);
            return [
                { pass: buffedPower >= basePower + 2000, message: `선택 아군 +2000 (${buffedPower})` },
            ];
        },
    },
    {
        testId: 'BT02-015',
        name: '전선구축 조건 리더 레벨+1',
        description: '전선구축일 때만 리더 레벨+1이 적용된다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.leaderLevel = 5;
            p1.hand = [getCard('BT02-015')];
            p1.unitZones[0].unit = getCard('ST01-002');
            p1.unitZones[1].unit = getCard('ST01-002');
            p1.unitZones[2].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const before = p1.leaderLevel;
            engine.playSkill(0);
            const afterFrontline = p1.leaderLevel;

            p1.hand = [getCard('BT02-015')];
            p1.unitZones[2].unit = null;
            const beforeNoFrontline = p1.leaderLevel;
            engine.playSkill(0);
            const afterNoFrontline = p1.leaderLevel;

            return [
                { pass: afterFrontline === before + 1, message: '전선구축 조건 충족 시 레벨+1' },
                { pass: afterNoFrontline === beforeNoFrontline, message: '전선구축 미충족 시 불발' },
            ];
        },
    },
    {
        testId: 'BT02-016',
        name: '필드 아이템 파괴 타깃 선택',
        description: '스킬로 필드 아이템 1장을 선택해 트래시.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setBt02TestSize(engine);
            p1.hand = [getCard('BT02-016')];
            p1.unitZones[0].unit = getCard('BT02-003');
            p1.unitZones[0].items = [getCard('BT02-078')];
            p2.unitZones[0].unit = getCard('BT02-003');
            p2.unitZones[0].items = [getCard('BT02-079')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            engine.playSkill(0);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                const action = engine.getLegalActions(p1.id).find(a => a.type === 'SELECT_ITEM_TARGET' && a.targetPlayerId === p2.id);
                if (action && action.type === 'SELECT_ITEM_TARGET') {
                    engine.selectItemTargetByPlayerId(action.zoneIndex, action.itemIndex, action.targetPlayerId);
                }
            }
            return [
                { pass: p2.unitZones[0].items.length === 0, message: '상대 아이템 파괴 완료' },
            ];
        },
    },
    {
        testId: 'BT02-017',
        name: '베이스 전원 +1500 (상대 턴 종료까지)',
        description: '베이스 유닛만 버프되고, 상대 턴 종료 후 버프가 해제된다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setBt02TestSize(engine);
            p1.hand = [getCard('BT02-017')];
            p1.unitZones[0].unit = getCard('BT01-031'); // 베이스
            p1.unitZones[1].unit = getCard('BT02-003'); // 비베이스
            p1.deck = Array.from({ length: 8 }, () => getCard('ST01-002'));
            p2.deck = Array.from({ length: 8 }, () => getCard('ST01-002'));
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = p1.unitZones[0].unit?.power || 0;
            const nonBasePower = p1.unitZones[1].unit?.power || 0;

            engine.playSkill(0);
            const buffedBase = engine.getUnitPower(p1.unitZones[0], p1);
            const buffedNonBase = engine.getUnitPower(p1.unitZones[1], p1);

            let guard = 0;
            while (!(engine.currentPlayer.id === p1.id && engine.state.phase === Phase.LEVEL_UP) && guard < 12) {
                engine.nextPhase();
                guard += 1;
            }
            const afterOppTurnEnd = engine.getUnitPower(p1.unitZones[0], p1);

            return [
                { pass: buffedBase >= basePower + 1500, message: `베이스 +1500 적용 (${buffedBase})` },
                { pass: buffedNonBase === nonBasePower, message: '비베이스 버프 미적용' },
                { pass: afterOppTurnEnd === basePower, message: `상대 턴 종료 후 버프 해제 (${afterOppTurnEnd})` },
            ];
        },
    },
    {
        testId: 'BT02-018',
        name: '장착조건 베이스 + 히트+1',
        description: '베이스 유닛에만 장착 가능하고 장착 시 히트 증가.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.hand = [getCard('BT02-018')];
            p1.unitZones[0].unit = getCard('BT01-031');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const valid = RuleValidator.canPlayItem(engine, p1, 0, 0).valid;
            const baseHit = engine.getUnitHit(p1.unitZones[0], p1);
            if (valid) {
                engine.playItem(0, 0);
            }
            const buffHit = engine.getUnitHit(p1.unitZones[0], p1);

            p1.hand = [getCard('BT02-018')];
            p1.unitZones[1].unit = getCard('BT02-013');
            const invalid = RuleValidator.canPlayItem(engine, p1, 0, 1).valid;

            return [
                { pass: valid === true, message: '베이스 유닛 장착 가능' },
                { pass: buffHit === baseHit + 1, message: `히트+1 적용 (${buffHit})` },
                { pass: invalid === false, message: '비베이스 유닛 장착 불가' },
            ];
        },
    },
];

export const BT02EarthModule: UnifiedTestModule = {
    packId: 'BT02',
    displayName: 'BT02 Earth Unified',
    tests,
};
