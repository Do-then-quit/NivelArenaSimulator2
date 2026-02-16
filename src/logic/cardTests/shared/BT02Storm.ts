import { UnifiedTestCase, UnifiedTestModule, Phase } from './types';
import { resolveInteractionLoop, setBt02TestSize } from './BT02TestUtils';

const tests: UnifiedTestCase[] = [
    {
        testId: 'BT02-019',
        name: '엑시트 아군 히트+1',
        description: '트래시될 때 아군 유닛 1장의 히트를 올린다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.unitZones[0].unit = getCard('BT02-019');
            p1.unitZones[1].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const baseHit = engine.getUnitHit(p1.unitZones[1], p1);
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                const target = engine.getLegalActions(p1.id).find(action => action.type === 'SELECT_ZONE_TARGET' && action.zoneIndex === 1);
                if (target) engine.step(target);
            }
            const buffedHit = engine.getUnitHit(p1.unitZones[1], p1);
            return [
                { pass: buffedHit === baseHit + 1, message: `엑시트 히트+1 적용 (${buffedHit})` },
            ];
        },
    },
    {
        testId: 'BT02-020',
        name: '효과 트래시 시 파워+1000',
        description: '다른 유닛이 효과로 트래시될 때 파워+1000.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.unitZones[0].unit = getCard('BT02-020');
            p1.unitZones[1].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const base = engine.getUnitPower(p1.unitZones[0], p1);
            engine.destroyUnit(p1, p1.unitZones[1], undefined, 'EFFECT');
            const buffed = engine.getUnitPower(p1.unitZones[0], p1);
            return [
                { pass: buffed === base + 1000, message: `파워+1000 적용 (${buffed})` },
            ];
        },
    },
    {
        testId: 'BT02-021',
        name: '디펜더 종결',
        description: '방어 선언 즉시 공격을 종료하고 스스로 트래시된다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setBt02TestSize(engine);
            p1.unitZones[0].unit = getCard('ST01-002');
            p1.unitZones[0].unit!.power = 10000;
            p2.unitZones[0].unit = getCard('BT02-021');
            p2.deck = [getCard('ST01-002'), getCard('ST01-002')];
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            const beforeDamage = p2.damage.length;
            engine.attack(0);
            engine.resolveBlock(true, 0);
            return [
                { pass: p2.unitZones[0].unit === null, message: '종결 처리 후 디펜더 트래시' },
                { pass: p1.unitZones[0].unit !== null, message: '공격 유닛 생존' },
                { pass: p2.damage.length === beforeDamage, message: '공격 종료로 플레이어 대미지 없음' },
            ];
        },
    },
    {
        testId: 'BT02-022',
        name: '효과 트래시 2장 조건 1대미지',
        description: '이번 턴 효과로 트래시된 아군 2장 이상이면 1대미지.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setBt02TestSize(engine);
            p1.unitZones[0].unit = getCard('BT02-022');
            p1.unitZones[1].unit = getCard('ST01-002');
            p1.unitZones[2].unit = getCard('ST01-002');
            p2.deck = [getCard('ST01-002'), getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            const before = p2.damage.length;
            engine.destroyUnit(p1, p1.unitZones[1], undefined, 'EFFECT');
            engine.destroyUnit(p1, p1.unitZones[2], undefined, 'EFFECT');
            engine.activateEffect(0, 0);
            return [
                { pass: p2.damage.length === before + 1, message: '조건 달성 후 1대미지 성공' },
            ];
        },
    },
    {
        testId: 'BT02-024',
        name: '엑시트 공멸',
        description: '전투로 트래시되면 조건에 맞는 상대 유닛도 트래시한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setBt02TestSize(engine);
            const attacker = getCard('ST01-002');
            attacker.cost = 3;
            attacker.power = 10000;
            p1.unitZones[0].unit = attacker;

            const defender = getCard('BT02-024');
            defender.cost = 7;
            defender.power = 1000;
            p2.unitZones[0].unit = defender;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            engine.attack(0);
            engine.resolveBlock(true, 0);
            return [
                { pass: p2.unitZones[0].unit === null, message: '공멸 대상 유닛 전투 트래시' },
                { pass: p1.unitZones[0].unit === null, message: '엑시트 공멸로 공격 유닛 트래시' },
            ];
        },
    },
    {
        testId: 'BT02-025',
        name: '스킬: 엑시트 2코 이하 회수',
        description: '스킬로 엑시트 + 2코 이하 유닛만 회수 가능.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.hand = [getCard('BT02-025')];
            p1.trash = [getCard('BT02-019'), getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playSkill(0);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                const legal = engine.getLegalActions(p1.id).filter(action => action.type === 'SELECT_TRASH_TARGET');
                const hasExitCard = legal.some(action => action.type === 'SELECT_TRASH_TARGET' && p1.trash[action.trashIndex]?.id.startsWith('BT02-019'));
                const hasNonExit = legal.some(action => action.type === 'SELECT_TRASH_TARGET' && p1.trash[action.trashIndex]?.id.startsWith('ST01-002'));
                const pick = legal.find(action => action.type === 'SELECT_TRASH_TARGET' && p1.trash[action.trashIndex]?.id.startsWith('BT02-019'));
                if (pick) engine.step(pick);
                return [
                    { pass: hasExitCard, message: '엑시트 2코 이하 타겟 가능' },
                    { pass: hasNonExit === false, message: '비엑시트 카드 타겟 불가' },
                    { pass: p1.hand.some(card => card.id.startsWith('BT02-019')), message: '엑시트 유닛 회수 성공' },
                ];
            }
            return [{ pass: false, message: '타겟 선택 상태 진입 실패' }];
        },
    },
    {
        testId: 'BT02-025-Trigger',
        name: '트리거 효과: 엑시트 유닛 회수',
        description: '대미지 트리거로 자기 트래시 후 엑시트 유닛을 회수한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.deck = [getCard('ST01-002'), getCard('BT02-025')];
            p1.trash = [getCard('BT02-019')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.dealDamage(p1, 1);
            resolveInteractionLoop(engine);
            return [
                { pass: p1.trash.some(card => card.id.startsWith('BT02-025')), message: '트리거 카드 자기 트래시' },
                { pass: p1.hand.some(card => card.id.startsWith('BT02-019')), message: '엑시트 유닛 회수 성공' },
            ];
        },
    },
    {
        testId: 'BT02-026',
        name: '패 유닛 트래시 후 히트만큼 드로우',
        description: '코스트로 버린 유닛의 히트만큼 드로우.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.hand = [getCard('BT02-026'), getCard('BT02-023')]; // BT02-023 hit=2
            p1.deck = [getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const before = p1.hand.length;
            const costCardHit = p1.hand[1]?.hit || 0;
            engine.playSkill(0);
            if (engine.state.interactionMode === 'SELECT_COST') {
                // remaining hand index 0 is BT02-023 after skill play
                engine.selectCostForPlayerId(0, p1.id);
            }
            return [
                {
                    pass: p1.hand.length === before - 2 + costCardHit,
                    message: `히트 비례 드로우 반영 (예상 ${before - 2 + costCardHit}, 실제 ${p1.hand.length})`
                },
            ];
        },
    },
    {
        testId: 'BT02-027',
        name: '장착 +4000 및 상대턴 종료 파괴',
        description: '장착 시 +4000, 상대 턴 종료 시 유닛이 트래시된다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setBt02TestSize(engine);
            p1.hand = [getCard('BT02-027')];
            p1.unitZones[0].unit = getCard('ST01-002');
            p1.deck = Array.from({ length: 8 }, () => getCard('ST01-002'));
            p2.deck = Array.from({ length: 8 }, () => getCard('ST01-002'));
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = engine.getUnitPower(p1.unitZones[0], p1);
            engine.playItem(0, 0);
            const buffed = engine.getUnitPower(p1.unitZones[0], p1);

            let guard = 0;
            while (!(engine.currentPlayer.id === p1.id && engine.state.phase === Phase.LEVEL_UP) && guard < 12) {
                engine.nextPhase();
                guard += 1;
            }

            return [
                { pass: buffed >= basePower + 4000, message: `장착 파워+4000 (${buffed})` },
                { pass: p1.unitZones[0].unit === null, message: '상대 턴 종료 시 유닛 파괴' },
            ];
        },
    },
];

export const BT02StormModule: UnifiedTestModule = {
    packId: 'BT02',
    displayName: 'BT02 Storm Unified',
    tests,
};
