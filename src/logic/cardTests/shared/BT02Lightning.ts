import { UnifiedTestCase, UnifiedTestModule, Phase } from './types';
import { RuleValidator } from '../../RuleValidator';
import { GameEngine } from '../../GameEngine';
import { setBt02TestSize } from './BT02TestUtils';

function advanceToOwnLevelUp(engine: GameEngine, playerId: string): void {
    let guard = 0;
    while (!(engine.currentPlayer.id === playerId && engine.state.phase === Phase.LEVEL_UP) && guard < 14) {
        engine.nextPhase();
        guard += 1;
    }
}

const tests: UnifiedTestCase[] = [
    {
        testId: 'BT02-055',
        name: '리더 각성(레벨6) + 장착 유닛 버프',
        description: '레벨 6에서 각성하고 아이템 장착 유닛만 +1500을 받는다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 5;
            p1.levelZone = getCard('BT02-055');
            p1.levelZone.isAwakened = false;
            p1.unitZones[0].unit = getCard('ST01-002');
            p1.unitZones[0].items = [getCard('BT02-078')];
            p1.unitZones[1].unit = getCard('ST01-002');
            engine.state.phase = Phase.LEVEL_UP;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.nextPhase();
            const zone0Base = p1.unitZones[0].unit?.power || 0;
            const zone1Base = p1.unitZones[1].unit?.power || 0;
            const zone0Buffed = engine.getUnitPower(p1.unitZones[0], p1);
            const zone1Buffed = engine.getUnitPower(p1.unitZones[1], p1);
            return [
                { pass: p1.levelZone?.isAwakened === true, message: '리더 각성 성공' },
                { pass: zone0Buffed === zone0Base + 1500, message: `장착 유닛 +1500 (${zone0Buffed})` },
                { pass: zone1Buffed === zone1Base, message: '비장착 유닛 버프 없음' },
            ];
        },
    },
    {
        testId: 'BT02-056',
        name: '엑시트 1코 아이템 회수',
        description: '엑시트 시 트래시의 1코스트 아이템만 타겟 가능하다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.unitZones[0].unit = getCard('BT02-056');
            p1.trash = [getCard('BT02-079'), getCard('BT02-080'), getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
            const actions = engine.getLegalActions(p1.id).filter(action => action.type === 'SELECT_TRASH_TARGET');
            const canPickCost1 = actions.some(action => action.type === 'SELECT_TRASH_TARGET' && p1.trash[action.trashIndex]?.id.startsWith('BT02-079'));
            const canPickCost2 = actions.some(action => action.type === 'SELECT_TRASH_TARGET' && p1.trash[action.trashIndex]?.id.startsWith('BT02-080'));
            const canPickUnit = actions.some(action => action.type === 'SELECT_TRASH_TARGET' && p1.trash[action.trashIndex]?.id.startsWith('ST01-002'));
            const target = actions.find(action => action.type === 'SELECT_TRASH_TARGET' && p1.trash[action.trashIndex]?.id.startsWith('BT02-079'));
            if (target) engine.step(target);
            return [
                { pass: canPickCost1 === true, message: '1코 아이템 타겟 가능' },
                { pass: canPickCost2 === false, message: '2코 아이템 타겟 불가' },
                { pass: canPickUnit === false, message: '유닛 타겟 불가' },
                { pass: p1.hand.some(card => card.id.startsWith('BT02-079')), message: '1코 아이템 회수 성공' },
            ];
        },
    },
    {
        testId: 'BT02-057',
        name: '암드 파워 스케일 + 3장 이상 어태커 드로우',
        description: '장착 수만큼 파워가 오르고 3장 이상 장착 시 공격 시 드로우한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setBt02TestSize(engine);
            p1.unitZones[0].unit = getCard('BT02-057');
            p1.unitZones[0].items = [getCard('BT02-078'), getCard('BT02-078'), getCard('BT02-081')];
            p1.deck = [getCard('ST01-002'), getCard('ST01-002')];
            p2.unitZones[0].unit = getCard('ST01-002');
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const base = p1.unitZones[0].unit?.power || 0;
            const scaled = engine.getUnitPower(p1.unitZones[0], p1);
            const beforeHand = p1.hand.length;
            engine.attack(0);
            return [
                { pass: scaled === base + 6000, message: `장착 3장으로 파워+6000 (${scaled})` },
                { pass: p1.hand.length === beforeHand + 1, message: '장착 3장 조건 어태커 1드로우' },
            ];
        },
    },
    {
        testId: 'BT02-057',
        name: '장착 2장 이하일 때 어태커 드로우 없음',
        description: '장착 수 조건 미충족이면 공격 시 드로우가 발생하지 않는다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setBt02TestSize(engine);
            p1.unitZones[0].unit = getCard('BT02-057');
            p1.unitZones[0].items = [getCard('BT02-078'), getCard('BT02-079')];
            p1.deck = [getCard('ST01-002'), getCard('ST01-002')];
            p2.unitZones[0].unit = getCard('ST01-002');
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const beforeHand = p1.hand.length;
            engine.attack(0);
            return [
                { pass: p1.hand.length === beforeHand, message: '장착 2장 조건 미충족 드로우 없음' },
            ];
        },
    },
    {
        testId: 'BT02-057-Trigger',
        name: '트리거 효과: draw2/discard2 + 자기 트래시',
        description: '트리거 시 자기 트래시 후 2드로우 2디스카드를 수행한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.hand = [getCard('ST01-002'), getCard('ST01-002')];
            p1.deck = [getCard('ST01-002'), getCard('ST01-002'), getCard('BT02-057')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const beforeHand = p1.hand.length;
            engine.dealDamage(p1, 1);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                const first = engine.getLegalActions(p1.id).find(action => action.type === 'SELECT_HAND_TARGET');
                if (first && first.type === 'SELECT_HAND_TARGET') {
                    engine.step(first);
                }
                const second = engine.getLegalActions(p1.id).find(
                    action => action.type === 'SELECT_HAND_TARGET' && (!first || action.handIndex !== first.handIndex)
                );
                if (second && second.type === 'SELECT_HAND_TARGET') {
                    engine.step(second);
                }
                const confirm = engine.getLegalActions(p1.id).find(action => action.type === 'CONFIRM_TARGETS');
                if (confirm) engine.step(confirm);
            }
            return [
                { pass: p1.trash.some(card => card.id.startsWith('BT02-057')), message: '트리거 카드 자기 트래시' },
                { pass: p1.hand.length === beforeHand, message: 'draw2 후 discard2로 손패 순증 0' },
            ];
        },
    },
    {
        testId: 'BT02-058',
        name: '대미지 아이템↔손패 교환 2단계',
        description: '엑시트로 대미지존 아이템을 패로, 패 1장을 대미지존으로 이동.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.unitZones[0].unit = getCard('BT02-058');
            p1.damage = [getCard('ST01-002'), getCard('BT02-078')];
            p1.hand = [getCard('ST01-002'), getCard('BT02-079')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');

            const damageActions = engine.getLegalActions(p1.id).filter(action => action.type === 'SELECT_DAMAGE_TARGET');
            const canPickItem = damageActions.some(action => action.type === 'SELECT_DAMAGE_TARGET' && p1.damage[action.damageIndex]?.id.startsWith('BT02-078'));
            const canPickUnit = damageActions.some(action => action.type === 'SELECT_DAMAGE_TARGET' && p1.damage[action.damageIndex]?.id.startsWith('ST01-002'));
            const damagePick = damageActions.find(action => action.type === 'SELECT_DAMAGE_TARGET' && p1.damage[action.damageIndex]?.id.startsWith('BT02-078'));
            if (damagePick) engine.step(damagePick);

            const handActions = engine.getLegalActions(p1.id).filter(action => action.type === 'SELECT_HAND_TARGET');
            const handPick = handActions.find(action => action.type === 'SELECT_HAND_TARGET' && p1.hand[action.handIndex]?.id.startsWith('ST01-002'));
            if (handPick) engine.step(handPick);

            return [
                { pass: canPickItem === true, message: '대미지존 아이템 타겟 가능' },
                { pass: canPickUnit === false, message: '대미지존 비아이템 타겟 불가' },
                { pass: p1.hand.some(card => card.id.startsWith('BT02-078')), message: '아이템 패 회수 성공' },
                { pass: p1.damage.some(card => card.id.startsWith('ST01-002')), message: '손패 카드 대미지존 이동 성공' },
            ];
        },
    },
    {
        testId: 'BT02-059',
        name: '엔트리 선택 시 아이템 패복귀',
        description: '엔트리 선택 시 장착 아이템 1장을 패로 되돌린다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.hand = [getCard('BT02-059')];
            p1.unitZones[0].unit = getCard('ST01-002');
            p1.unitZones[0].items = [getCard('BT02-079')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playUnit(0, 1);
            if (engine.state.interactionMode === 'SELECT_OPTIONAL') {
                engine.resolveOptionalEffect(true);
            }
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                const target = engine.getLegalActions(p1.id).find(action => action.type === 'SELECT_ITEM_TARGET' && action.zoneIndex === 0);
                if (target && target.type === 'SELECT_ITEM_TARGET') {
                    engine.selectItemTargetByPlayerId(target.zoneIndex, target.itemIndex, target.targetPlayerId);
                }
            }
            return [
                { pass: p1.unitZones[0].items.length === 0, message: '장착 아이템 필드 이탈' },
                { pass: p1.hand.some(card => card.id.startsWith('BT02-079')), message: '아이템 패 복귀 성공' },
            ];
        },
    },
    {
        testId: 'BT02-059',
        name: '엔트리 미선택 시 불발',
        description: '옵션 효과를 거절하면 장착 아이템은 그대로 유지된다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.hand = [getCard('BT02-059')];
            p1.unitZones[0].unit = getCard('ST01-002');
            p1.unitZones[0].items = [getCard('BT02-079')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playUnit(0, 1);
            if (engine.state.interactionMode === 'SELECT_OPTIONAL') {
                engine.resolveOptionalEffect(false);
            }
            return [
                { pass: p1.unitZones[0].items.length === 1, message: '거절 시 아이템 유지' },
                { pass: p1.hand.every(card => !card.id.startsWith('BT02-079')), message: '아이템 패 이동 없음' },
            ];
        },
    },
    {
        testId: 'BT02-060',
        name: '장착 유닛 수 비례 파워 + 조건부 히트',
        description: '자신 필드 장착 유닛 수로 파워 상승, 3체 이상이면 히트+1.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.unitZones[0].unit = getCard('BT02-060');
            p1.unitZones[1].unit = getCard('ST01-002');
            p1.unitZones[2].unit = getCard('ST01-002');
            p1.unitZones[0].items = [getCard('BT02-078')];
            p1.unitZones[1].items = [getCard('BT02-079')];
            p1.unitZones[2].items = [getCard('BT02-080')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = p1.unitZones[0].unit?.power || 0;
            const baseHit = p1.unitZones[0].unit?.hit || 0;
            const buffedPower = engine.getUnitPower(p1.unitZones[0], p1);
            const buffedHit = engine.getUnitHit(p1.unitZones[0], p1);
            return [
                { pass: buffedPower === basePower + 6000, message: `장착 유닛 3체로 파워+6000 (${buffedPower})` },
                { pass: buffedHit === baseHit + 1, message: `장착 유닛 3체 조건 히트+1 (${buffedHit})` },
            ];
        },
    },
    {
        testId: 'BT02-060',
        name: '장착 유닛 2체 이하 히트 미증가',
        description: '장착 유닛 수가 3 미만이면 히트 +1 효과가 발동하지 않는다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.unitZones[0].unit = getCard('BT02-060');
            p1.unitZones[1].unit = getCard('ST01-002');
            p1.unitZones[0].items = [getCard('BT02-078')];
            p1.unitZones[1].items = [getCard('BT02-079')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const baseHit = p1.unitZones[0].unit?.hit || 0;
            const buffedHit = engine.getUnitHit(p1.unitZones[0], p1);
            return [
                { pass: buffedHit === baseHit, message: '장착 유닛 2체 조건 미충족으로 히트 변화 없음' },
            ];
        },
    },
    {
        testId: 'BT02-062',
        name: '장착 시 관통[1] 적용',
        description: '아이템 장착 상태에서 전투 승리 시 관통 대미지가 들어간다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setBt02TestSize(engine);
            p1.unitZones[0].unit = getCard('BT02-062');
            p1.unitZones[0].items = [getCard('BT02-078')];
            p2.unitZones[0].unit = getCard('ST01-002');
            p2.deck = [getCard('ST01-002'), getCard('ST01-002')];
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p2 = engine.opponentPlayer;
            const before = p2.damage.length;
            engine.attack(0);
            engine.resolveBlock(true, 0);
            return [
                { pass: p2.unitZones[0].unit === null, message: '전투로 수비 유닛 트래시' },
                { pass: p2.damage.length === before + 1, message: '관통[1] 대미지 적용' },
            ];
        },
    },
    {
        testId: 'BT02-062',
        name: '미장착 시 관통 미발동',
        description: '아이템 미장착 상태에서는 관통 대미지가 발생하지 않는다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setBt02TestSize(engine);
            p1.unitZones[0].unit = getCard('BT02-062');
            p2.unitZones[0].unit = getCard('ST01-002');
            p2.deck = [getCard('ST01-002'), getCard('ST01-002')];
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p2 = engine.opponentPlayer;
            const before = p2.damage.length;
            engine.attack(0);
            engine.resolveBlock(true, 0);
            return [
                { pass: p2.damage.length === before, message: '관통 대미지 없음' },
            ];
        },
    },
    {
        testId: 'BT02-063',
        name: '엔트리 조우 히트 코스트 지불 후 파괴',
        description: '옵션을 수락하고 아이템 코스트를 지불하면 조우 유닛을 파괴한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setBt02TestSize(engine);
            p1.hand = [getCard('BT02-063'), getCard('BT02-078'), getCard('BT02-079')];
            p2.unitZones[0].unit = getCard('BT02-067'); // hit 2
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            const beforeTrash = p1.trash.length;
            engine.playUnit(0, 0);

            if (engine.state.interactionMode === 'SELECT_OPTIONAL') {
                engine.resolveOptionalEffect(true);
            }

            if (engine.state.interactionMode === 'SELECT_COST') {
                const firstCost = engine.getLegalActions(p1.id).find(action => action.type === 'SELECT_COST_HAND');
                if (firstCost && firstCost.type === 'SELECT_COST_HAND') engine.step(firstCost);
                const secondCost = engine.getLegalActions(p1.id).find(action => action.type === 'SELECT_COST_HAND');
                if (secondCost && secondCost.type === 'SELECT_COST_HAND') engine.step(secondCost);
            }

            return [
                { pass: p2.unitZones[0].unit === null, message: '코스트 지불 후 조우 유닛 파괴' },
                { pass: p1.trash.length >= beforeTrash + 2, message: '아이템 2장 코스트 지불' },
            ];
        },
    },
    {
        testId: 'BT02-063',
        name: '코스트 부족 시 조우 파괴 불가',
        description: '옵션을 수락해도 손패 아이템 코스트가 부족하면 파괴되지 않는다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setBt02TestSize(engine);
            p1.hand = [getCard('BT02-063'), getCard('BT02-078')];
            p2.unitZones[0].unit = getCard('ST01-011'); // hit 2
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p2 = engine.opponentPlayer;
            engine.playUnit(0, 0);
            if (engine.state.interactionMode === 'SELECT_OPTIONAL') {
                engine.resolveOptionalEffect(true);
            }
            return [
                { pass: p2.unitZones[0].unit !== null, message: '코스트 부족으로 조우 유닛 생존' },
                { pass: engine.state.interactionMode !== 'SELECT_COST', message: '코스트 선택 단계 미진입' },
            ];
        },
    },
    {
        testId: 'BT02-063-Trigger',
        name: '트리거 효과: 1코 이하 아이템 서치',
        description: '트리거로 자기 트래시 후 덱에서 1코 이하 아이템을 서치한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.deck = [getCard('BT02-080'), getCard('BT02-079'), getCard('BT02-063')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.dealDamage(p1, 1);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                const legal = engine.getLegalActions(p1.id).filter(action => action.type === 'SELECT_REVEALED_TARGET');
                const canPickCost1 = legal.some(action => action.type === 'SELECT_REVEALED_TARGET' && engine.state.revealedCards[action.revealedIndex]?.id.startsWith('BT02-079'));
                const canPickCost2 = legal.some(action => action.type === 'SELECT_REVEALED_TARGET' && engine.state.revealedCards[action.revealedIndex]?.id.startsWith('BT02-080'));
                const pick = legal.find(action => action.type === 'SELECT_REVEALED_TARGET' && engine.state.revealedCards[action.revealedIndex]?.id.startsWith('BT02-079'));
                if (pick) engine.step(pick);
                return [
                    { pass: canPickCost1 === true, message: '1코 아이템 서치 대상 포함' },
                    { pass: canPickCost2 === false, message: '2코 아이템 서치 대상 제외' },
                    { pass: p1.trash.some(card => card.id.startsWith('BT02-063')), message: '트리거 카드 자기 트래시' },
                    { pass: p1.hand.some(card => card.id.startsWith('BT02-079')), message: '1코 아이템 서치 성공' },
                ];
            }
            return [{ pass: false, message: '리빌 타겟 선택 단계 진입 실패' }];
        },
    },
    {
        testId: 'BT02-065',
        name: '유니크 장착 시 +2500',
        description: '유니크 아이템 장착 유닛만 +2500을 받는다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.unitZones[0].unit = getCard('BT02-065');
            p1.unitZones[0].items = [getCard('BT02-078')]; // unique
            p1.unitZones[1].unit = getCard('BT02-065');
            p1.unitZones[1].items = [getCard('BT02-079')]; // non-unique
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const zone0Base = p1.unitZones[0].unit?.power || 0;
            const zone1Base = p1.unitZones[1].unit?.power || 0;
            const zone0Power = engine.getUnitPower(p1.unitZones[0], p1);
            const zone1Power = engine.getUnitPower(p1.unitZones[1], p1);
            return [
                { pass: zone0Power === zone0Base + 2500, message: `유니크 장착 +2500 (${zone0Power})` },
                { pass: zone1Power === zone1Base, message: '비유니크 장착 시 추가 버프 없음' },
            ];
        },
    },
    {
        testId: 'BT02-066',
        name: '전투/효과 트래시 시 선택 회수',
        description: '효과 트래시 시 옵션 수락하면 장착 아이템을 패로 되돌린다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.unitZones[0].unit = getCard('BT02-066');
            p1.unitZones[0].items = [getCard('BT02-079')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
            if (engine.state.interactionMode === 'SELECT_OPTIONAL') {
                engine.resolveOptionalEffect(true);
            }
            return [
                { pass: p1.hand.some(card => card.id.startsWith('BT02-079')), message: '장착 아이템 패 복귀 성공' },
            ];
        },
    },
    {
        testId: 'BT02-066',
        name: '옵션 거절 시 아이템 미회수',
        description: '트래시 시 옵션을 거절하면 장착 아이템은 트래시에 남는다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.unitZones[0].unit = getCard('BT02-066');
            p1.unitZones[0].items = [getCard('BT02-079')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'BATTLE');
            if (engine.state.interactionMode === 'SELECT_OPTIONAL') {
                engine.resolveOptionalEffect(false);
            }
            return [
                { pass: p1.hand.every(card => !card.id.startsWith('BT02-079')), message: '옵션 거절 시 패 복귀 없음' },
                { pass: p1.trash.some(card => card.id.startsWith('BT02-079')), message: '아이템은 트래시에 유지' },
            ];
        },
    },
    {
        testId: 'BT02-067',
        name: '유니크+아이템수 조건 돌파',
        description: '조건 충족 시 방어 불가(돌파)가 적용된다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setBt02TestSize(engine);
            p1.unitZones[0].unit = getCard('BT02-067');
            p1.unitZones[0].items = [getCard('BT02-078'), getCard('BT02-079')]; // unique + 2 items
            p2.unitZones[0].unit = getCard('BT02-067'); // hit 2
            p2.unitZones[1].unit = getCard('BT02-030');
            p2.hand = [getCard('ST01-002')];
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p2 = engine.opponentPlayer;
            engine.attack(0);
            const blocks = engine.getLegalActions(p2.id).filter(action => action.type === 'RESOLVE_BLOCK' && action.shouldBlock);
            return [
                { pass: blocks.length === 0, message: '조건 충족으로 방어 선택지 없음(돌파 적용)' },
            ];
        },
    },
    {
        testId: 'BT02-067',
        name: '조건 미충족 시 돌파 미적용',
        description: '유니크/아이템 수 조건 미충족이면 방어가 가능해야 한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setBt02TestSize(engine);
            p1.unitZones[0].unit = getCard('BT02-067');
            p1.unitZones[0].items = [getCard('BT02-078')]; // unique but count 1
            p2.unitZones[0].unit = getCard('ST01-011'); // hit 2
            p2.hand = [getCard('ST01-002')];
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p2 = engine.opponentPlayer;
            engine.attack(0);
            const blocks = engine.getLegalActions(p2.id).filter(action => action.type === 'RESOLVE_BLOCK' && action.shouldBlock);
            return [
                { pass: blocks.length >= 1, message: '조건 미충족 시 방어 가능' },
            ];
        },
    },
    {
        testId: 'BT02-067-Trigger',
        name: '트리거 효과: 패 복귀',
        description: '대미지 트리거 시 해당 카드가 패로 복귀한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.deck = [getCard('ST01-002'), getCard('BT02-067')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.dealDamage(p1, 1);
            return [
                { pass: p1.hand.some(card => card.id.startsWith('BT02-067')), message: '트리거 패 복귀 성공' },
            ];
        },
    },
    {
        testId: 'BT02-068',
        name: '상단2 공개 후 아이템 1회수',
        description: '아이템만 선택 가능하며 남은 카드는 덱 하단으로 간다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.hand = [getCard('BT02-068')];
            p1.deck = [getCard('ST01-002'), getCard('BT02-079')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playUnit(0, 0);
            const legal = engine.getLegalActions(p1.id).filter(action => action.type === 'SELECT_REVEALED_TARGET');
            const hasItemPick = legal.some(action => action.type === 'SELECT_REVEALED_TARGET' && engine.state.revealedCards[action.revealedIndex]?.id.startsWith('BT02-079'));
            const hasNonItemPick = legal.some(action => action.type === 'SELECT_REVEALED_TARGET' && engine.state.revealedCards[action.revealedIndex]?.id.startsWith('ST01-002'));
            const pick = legal.find(action => action.type === 'SELECT_REVEALED_TARGET');
            if (pick) engine.step(pick);
            return [
                { pass: hasItemPick === true, message: '아이템 카드 선택 가능' },
                { pass: hasNonItemPick === false, message: '비아이템 선택 불가' },
                { pass: p1.hand.some(card => card.id.startsWith('BT02-079')), message: '아이템 패 회수 성공' },
                { pass: p1.deck[0]?.id?.startsWith('ST01-002') === true, message: '남은 카드 덱 하단 이동' },
            ];
        },
    },
    {
        testId: 'BT02-069',
        name: '파괴 대체 수락',
        description: '장착 아이템 트래시를 수락하면 유닛이 생존한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.unitZones[0].unit = getCard('BT02-069');
            p1.unitZones[0].items = [getCard('BT02-078')];
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'BATTLE');
            if (engine.state.interactionMode === 'SELECT_OPTIONAL') {
                engine.resolveOptionalEffect(true);
            }
            return [
                { pass: p1.unitZones[0].unit?.id.startsWith('BT02-069') === true, message: '대체 성공 후 유닛 생존' },
                { pass: p1.trash.some(card => card.id.startsWith('BT02-078')), message: '장착 아이템 트래시' },
            ];
        },
    },
    {
        testId: 'BT02-069',
        name: '파괴 대체 거절',
        description: '대체를 거절하면 유닛은 정상적으로 트래시된다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.unitZones[0].unit = getCard('BT02-069');
            p1.unitZones[0].items = [getCard('BT02-078')];
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'BATTLE');
            if (engine.state.interactionMode === 'SELECT_OPTIONAL') {
                engine.resolveOptionalEffect(false);
            }
            return [
                { pass: p1.unitZones[0].unit === null, message: '대체 거절 시 유닛 트래시' },
            ];
        },
    },
    {
        testId: 'BT02-071',
        name: '엔트리 아이템 3장 바닥 후 조우 파괴',
        description: '옵션 수락 시 트래시 아이템 3장을 덱 하단으로 보내고 조우를 파괴한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setBt02TestSize(engine);
            p1.hand = [getCard('BT02-071')];
            p1.trash = [getCard('BT02-078'), getCard('BT02-079'), getCard('BT02-080')];
            p2.unitZones[0].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            engine.playUnit(0, 0);

            if (engine.state.interactionMode === 'SELECT_OPTIONAL') {
                engine.resolveOptionalEffect(true);
            }

            if (engine.state.interactionMode === 'SELECT_TARGET') {
                const picks = engine.getLegalActions(p1.id).filter(action => action.type === 'SELECT_TRASH_TARGET');
                picks.slice(0, 3).forEach(action => engine.step(action));
                const confirm = engine.getLegalActions(p1.id).find(action => action.type === 'CONFIRM_TARGETS');
                if (confirm) engine.step(confirm);
            }

            const remainingItemsInTrash = p1.trash.filter(
                card => card.id.startsWith('BT02-078') || card.id.startsWith('BT02-079') || card.id.startsWith('BT02-080')
            ).length;

            return [
                { pass: p2.unitZones[0].unit === null, message: '조우 유닛 파괴 성공' },
                { pass: remainingItemsInTrash === 0, message: '아이템 3장 트래시에서 이동' },
                { pass: p1.deck.filter(card => card.id.startsWith('BT02-078') || card.id.startsWith('BT02-079') || card.id.startsWith('BT02-080')).length >= 3, message: '아이템 3장 덱 하단 이동' },
            ];
        },
    },
    {
        testId: 'BT02-071',
        name: '엔트리 옵션 거절 시 불발',
        description: '옵션을 거절하면 트래시 이동과 조우 파괴가 일어나지 않는다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setBt02TestSize(engine);
            p1.hand = [getCard('BT02-071')];
            p1.trash = [getCard('BT02-078'), getCard('BT02-079'), getCard('BT02-080')];
            p2.unitZones[0].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            engine.playUnit(0, 0);
            if (engine.state.interactionMode === 'SELECT_OPTIONAL') {
                engine.resolveOptionalEffect(false);
            }
            return [
                { pass: p2.unitZones[0].unit !== null, message: '옵션 거절 시 조우 유닛 생존' },
                { pass: p1.trash.length === 3, message: '트래시 아이템 이동 없음' },
            ];
        },
    },
    {
        testId: 'BT02-071-Trigger',
        name: '트리거 효과: 패 복귀',
        description: '대미지 트리거 시 해당 카드가 패로 복귀한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.deck = [getCard('ST01-002'), getCard('BT02-071')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.dealDamage(p1, 1);
            return [
                { pass: p1.hand.some(card => card.id.startsWith('BT02-071')), message: '트리거 패 복귀 성공' },
            ];
        },
    },
    {
        testId: 'BT02-072',
        name: '장착 시 히트+1',
        description: '아이템 장착 유닛만 히트가 1 증가한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.unitZones[0].unit = getCard('BT02-072');
            p1.unitZones[0].items = [getCard('BT02-078')];
            p1.unitZones[1].unit = getCard('BT02-072');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const hitWithItem = engine.getUnitHit(p1.unitZones[0], p1);
            const hitWithoutItem = engine.getUnitHit(p1.unitZones[1], p1);
            const base = p1.unitZones[0].unit?.hit || 0;
            return [
                { pass: hitWithItem === base + 1, message: `장착 시 히트+1 (${hitWithItem})` },
                { pass: hitWithoutItem === base, message: '미장착 시 히트 변화 없음' },
            ];
        },
    },
    {
        testId: 'BT02-073',
        name: '스킬 대미지↔손패 교환 2단계',
        description: '대미지존 아이템을 패로 이동한 뒤 손패 1장을 대미지존으로 보낸다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.hand = [getCard('BT02-073'), getCard('ST01-002')];
            p1.damage = [getCard('ST01-002'), getCard('BT02-078')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playSkill(0);

            const damageActions = engine.getLegalActions(p1.id).filter(action => action.type === 'SELECT_DAMAGE_TARGET');
            const canPickItem = damageActions.some(action => action.type === 'SELECT_DAMAGE_TARGET' && p1.damage[action.damageIndex]?.id.startsWith('BT02-078'));
            const canPickUnit = damageActions.some(action => action.type === 'SELECT_DAMAGE_TARGET' && p1.damage[action.damageIndex]?.id.startsWith('ST01-002'));
            const damagePick = damageActions.find(action => action.type === 'SELECT_DAMAGE_TARGET' && p1.damage[action.damageIndex]?.id.startsWith('BT02-078'));
            if (damagePick) engine.step(damagePick);

            const handPick = engine.getLegalActions(p1.id).find(action => action.type === 'SELECT_HAND_TARGET' && p1.hand[action.handIndex]?.id.startsWith('ST01-002'));
            if (handPick) engine.step(handPick);

            return [
                { pass: canPickItem === true, message: '대미지존 아이템 타겟 가능' },
                { pass: canPickUnit === false, message: '대미지존 비아이템 타겟 불가' },
                { pass: p1.hand.some(card => card.id.startsWith('BT02-078')), message: '대미지존 아이템 패 이동 성공' },
                { pass: p1.damage.some(card => card.id.startsWith('ST01-002')), message: '손패 카드 대미지존 이동 성공' },
            ];
        },
    },
    {
        testId: 'BT02-074',
        name: '액티브 유니크 아이템 서치',
        description: '스킬 사용 시 유니크 아이템만 서치 대상으로 노출된다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.hand = [getCard('BT02-074')];
            p1.deck = [getCard('BT02-080'), getCard('BT02-078'), getCard('BT02-079')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playSkill(0);
            const legal = engine.getLegalActions(p1.id).filter(action => action.type === 'SELECT_REVEALED_TARGET');
            const canPickUnique = legal.some(action => action.type === 'SELECT_REVEALED_TARGET' && engine.state.revealedCards[action.revealedIndex]?.id.startsWith('BT02-078'));
            const canPickNonUnique = legal.some(action => action.type === 'SELECT_REVEALED_TARGET' && engine.state.revealedCards[action.revealedIndex]?.id.startsWith('BT02-079'));
            const pick = legal.find(action => action.type === 'SELECT_REVEALED_TARGET' && engine.state.revealedCards[action.revealedIndex]?.id.startsWith('BT02-078'));
            if (pick) engine.step(pick);
            return [
                { pass: canPickUnique === true, message: '유니크 아이템 선택 가능' },
                { pass: canPickNonUnique === false, message: '비유니크 아이템 선택 불가' },
                { pass: p1.hand.some(card => card.id.startsWith('BT02-078')), message: '유니크 아이템 서치 성공' },
            ];
        },
    },
    {
        testId: 'BT02-074-Trigger',
        name: '트리거 효과: 1코 이하 아이템 서치',
        description: '트리거 시 자기 트래시 후 1코 이하 아이템만 서치한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.deck = [getCard('BT02-080'), getCard('BT02-079'), getCard('BT02-074')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.dealDamage(p1, 1);
            const legal = engine.getLegalActions(p1.id).filter(action => action.type === 'SELECT_REVEALED_TARGET');
            const canPickCost1 = legal.some(action => action.type === 'SELECT_REVEALED_TARGET' && engine.state.revealedCards[action.revealedIndex]?.id.startsWith('BT02-079'));
            const canPickCost2 = legal.some(action => action.type === 'SELECT_REVEALED_TARGET' && engine.state.revealedCards[action.revealedIndex]?.id.startsWith('BT02-080'));
            const pick = legal.find(action => action.type === 'SELECT_REVEALED_TARGET' && engine.state.revealedCards[action.revealedIndex]?.id.startsWith('BT02-079'));
            if (pick) engine.step(pick);
            return [
                { pass: canPickCost1 === true, message: '1코 아이템 선택 가능' },
                { pass: canPickCost2 === false, message: '2코 아이템 선택 불가' },
                { pass: p1.trash.some(card => card.id.startsWith('BT02-074')), message: '트리거 카드 자기 트래시' },
                { pass: p1.hand.some(card => card.id.startsWith('BT02-079')), message: '1코 아이템 서치 성공' },
            ];
        },
    },
    {
        testId: 'BT02-075',
        name: '필드 아이템 덱 바닥 이동',
        description: '필드 아이템만 선택할 수 있고, 선택한 아이템은 주인 덱 바닥으로 이동한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setBt02TestSize(engine);
            p1.hand = [getCard('BT02-075')];
            p1.unitZones[0].unit = getCard('BT02-003');
            p1.unitZones[0].items = [getCard('BT02-079')];
            p2.unitZones[0].unit = getCard('BT02-003');
            p2.unitZones[0].items = [getCard('BT02-078')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            engine.playSkill(0);
            const legal = engine.getLegalActions(p1.id);
            const itemTargets = legal.filter(action => action.type === 'SELECT_ITEM_TARGET');
            const zoneTargets = legal.filter(action => action.type === 'SELECT_ZONE_TARGET');
            const target = itemTargets.find(action => action.type === 'SELECT_ITEM_TARGET' && action.targetPlayerId === p2.id);
            if (target && target.type === 'SELECT_ITEM_TARGET') {
                engine.selectItemTargetByPlayerId(target.zoneIndex, target.itemIndex, target.targetPlayerId);
            }
            return [
                { pass: itemTargets.length >= 1, message: '아이템 타겟 선택지 존재' },
                { pass: zoneTargets.length === 0, message: '유닛 타겟 선택지 없음' },
                { pass: p2.unitZones[0].items.length === 0, message: '선택 아이템 필드에서 제거' },
                { pass: p2.deck[0]?.id?.startsWith('BT02-078') === true, message: '아이템 주인 덱 바닥 이동' },
            ];
        },
    },
    {
        testId: 'BT02-076',
        name: '트래시 1코 이하 아이템 회수',
        description: '트래시에서 1코 이하 아이템만 회수 대상으로 선택할 수 있다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.hand = [getCard('BT02-076')];
            p1.trash = [getCard('BT02-079'), getCard('BT02-080'), getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playSkill(0);
            const legal = engine.getLegalActions(p1.id).filter(action => action.type === 'SELECT_TRASH_TARGET');
            const canPickCost1 = legal.some(action => action.type === 'SELECT_TRASH_TARGET' && p1.trash[action.trashIndex]?.id.startsWith('BT02-079'));
            const canPickCost2 = legal.some(action => action.type === 'SELECT_TRASH_TARGET' && p1.trash[action.trashIndex]?.id.startsWith('BT02-080'));
            const canPickUnit = legal.some(action => action.type === 'SELECT_TRASH_TARGET' && p1.trash[action.trashIndex]?.id.startsWith('ST01-002'));
            const pick = legal.find(action => action.type === 'SELECT_TRASH_TARGET' && p1.trash[action.trashIndex]?.id.startsWith('BT02-079'));
            if (pick) engine.step(pick);
            return [
                { pass: canPickCost1 === true, message: '1코 아이템 선택 가능' },
                { pass: canPickCost2 === false, message: '2코 아이템 선택 불가' },
                { pass: canPickUnit === false, message: '유닛 선택 불가' },
                { pass: p1.hand.some(card => card.id.startsWith('BT02-079')), message: '1코 아이템 회수 성공' },
            ];
        },
    },
    {
        testId: 'BT02-077',
        name: '상단5 공개 최대2회수 + 하단 정렬',
        description: '아이템 최대 2장 선택 후, 남은 카드를 덱 하단 정렬 단계로 넘긴다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.hand = [getCard('BT02-077')];
            p1.deck = [
                getCard('ST01-002'),
                getCard('BT02-078'),
                getCard('ST01-002'),
                getCard('BT02-079'),
                getCard('ST01-002'),
            ];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playSkill(0);
            const pickActions = engine.getLegalActions(p1.id).filter(action => action.type === 'SELECT_REVEALED_TARGET');
            const firstPick = pickActions[0];
            if (firstPick && firstPick.type === 'SELECT_REVEALED_TARGET') engine.step(firstPick);

            const confirmPick = engine.getLegalActions(p1.id).find(action => action.type === 'CONFIRM_TARGETS');
            if (confirmPick) engine.step(confirmPick);

            const enteredOrderStage = engine.state.pendingEffect?.actionType === 'ORDER_REVEALED_BOTTOM';

            if (enteredOrderStage) {
                const orderActions = engine.getLegalActions(p1.id).filter(action => action.type === 'SELECT_REVEALED_TARGET');
                orderActions.forEach(action => engine.step(action));
                const confirmOrder = engine.getLegalActions(p1.id).find(action => action.type === 'CONFIRM_TARGETS');
                if (confirmOrder) engine.step(confirmOrder);
            }

            return [
                { pass: enteredOrderStage === true, message: '2단계 하단 정렬 단계 진입' },
                { pass: p1.hand.some(card => card.id.startsWith('BT02-078') || card.id.startsWith('BT02-079')), message: '아이템 최소 1장 회수' },
                { pass: engine.state.revealedCards.length === 0, message: '리빌 카드 정리 완료' },
            ];
        },
    },
    {
        testId: 'BT02-079',
        name: '어태커 +2000',
        description: '장착 유닛이 공격할 때 파워 +2000을 얻고 전투 후 해제된다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setBt02TestSize(engine);
            p1.hand = [getCard('BT02-079')];
            p1.unitZones[0].unit = getCard('ST01-002');
            p2.unitZones[0].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playItem(0, 0);
            const base = p1.unitZones[0].unit?.power || 0;
            engine.state.phase = Phase.ATTACK;
            engine.attack(0);
            const buffed = engine.getUnitPower(p1.unitZones[0], p1);
            engine.resolveBlock(true, 0);
            const afterBattle = p1.unitZones[0].unit ? engine.getUnitPower(p1.unitZones[0], p1) : 0;
            return [
                { pass: buffed >= base + 2000, message: `어태커 +2000 적용 (${buffed})` },
                { pass: afterBattle === base, message: '전투 후 임시 파워 해제' },
            ];
        },
    },
    {
        testId: 'BT02-080',
        name: '장착조건 암드 + 파워+3000',
        description: '암드 유닛만 장착 가능하며 장착 시 파워가 증가한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.hand = [getCard('BT02-080')];
            p1.unitZones[0].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const invalid = RuleValidator.canPlayItem(engine, p1, 0, 0).valid;

            p1.unitZones[0].unit = getCard('BT02-067'); // armored
            const valid = RuleValidator.canPlayItem(engine, p1, 0, 0).valid;
            const before = engine.getUnitPower(p1.unitZones[0], p1);
            if (valid) engine.playItem(0, 0);
            const after = engine.getUnitPower(p1.unitZones[0], p1);

            return [
                { pass: invalid === false, message: '비암드 유닛 장착 불가' },
                { pass: valid === true, message: '암드 유닛 장착 가능' },
                { pass: after === before + 3000, message: `장착 파워+3000 (${after})` },
            ];
        },
    },
    {
        testId: 'BT02-081',
        name: '파괴 대체 수락 시 히트만큼 손패 트래시',
        description: '대체를 수락하면 유닛이 생존하고 히트만큼 손패를 코스트로 지불한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.unitZones[0].unit = getCard('BT02-067'); // hit 2
            p1.unitZones[0].items = [getCard('BT02-081')];
            p1.hand = [getCard('ST01-002'), getCard('ST01-002')];
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const beforeTrash = p1.trash.length;
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
            if (engine.state.interactionMode === 'SELECT_OPTIONAL') {
                engine.resolveOptionalEffect(true);
            }
            if (engine.state.interactionMode === 'SELECT_COST') {
                const first = engine.getLegalActions(p1.id).find(action => action.type === 'SELECT_COST_HAND');
                if (first && first.type === 'SELECT_COST_HAND') engine.step(first);
                const second = engine.getLegalActions(p1.id).find(action => action.type === 'SELECT_COST_HAND');
                if (second && second.type === 'SELECT_COST_HAND') engine.step(second);
            }
            return [
                { pass: p1.unitZones[0].unit?.id.startsWith('BT02-067') === true, message: '대체 성공 후 유닛 생존' },
                { pass: p1.trash.length >= beforeTrash + 2, message: '히트(2)만큼 손패 코스트 지불' },
            ];
        },
    },
    {
        testId: 'BT02-081',
        name: '파괴 대체 턴당 1회 제한',
        description: '같은 턴 두 번째 파괴에는 대체가 적용되지 않는다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.unitZones[0].unit = getCard('BT02-003'); // hit 1
            p1.unitZones[0].items = [getCard('BT02-081')];
            p1.hand = [getCard('ST01-002'), getCard('ST01-002')];
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'BATTLE');
            if (engine.state.interactionMode === 'SELECT_OPTIONAL') {
                engine.resolveOptionalEffect(true);
            }
            if (engine.state.interactionMode === 'SELECT_COST') {
                const first = engine.getLegalActions(p1.id).find(action => action.type === 'SELECT_COST_HAND');
                if (first && first.type === 'SELECT_COST_HAND') engine.step(first);
            }

            const survivedFirst = p1.unitZones[0].unit !== null;
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
            const hadSecondPrompt = engine.state.interactionMode === 'SELECT_OPTIONAL';
            if (engine.state.interactionMode === 'SELECT_OPTIONAL') {
                engine.resolveOptionalEffect(true);
            }

            return [
                { pass: survivedFirst === true, message: '첫 파괴 대체 성공' },
                { pass: hadSecondPrompt === false, message: '같은 턴 두 번째 대체 선택창 없음' },
                { pass: p1.unitZones[0].unit === null, message: '같은 턴 두 번째 파괴는 정상 트래시' },
            ];
        },
    },
    {
        testId: 'BT02-081',
        name: '다음 턴 파괴 대체 리셋',
        description: '턴이 바뀌면 파괴 대체를 다시 사용할 수 있다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setBt02TestSize(engine);
            p1.unitZones[0].unit = getCard('BT02-003'); // hit 1
            p1.unitZones[0].items = [getCard('BT02-081')];
            p1.hand = [getCard('ST01-002'), getCard('ST01-002')];
            p1.deck = Array.from({ length: 8 }, () => getCard('ST01-002'));
            p2.deck = Array.from({ length: 8 }, () => getCard('ST01-002'));
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;

            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
            if (engine.state.interactionMode === 'SELECT_OPTIONAL') {
                engine.resolveOptionalEffect(true);
            }
            if (engine.state.interactionMode === 'SELECT_COST') {
                const first = engine.getLegalActions(p1.id).find(action => action.type === 'SELECT_COST_HAND');
                if (first && first.type === 'SELECT_COST_HAND') engine.step(first);
            }

            advanceToOwnLevelUp(engine, p1.id);
            engine.state.phase = Phase.ATTACK;

            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
            const promptedAgain = engine.state.interactionMode === 'SELECT_OPTIONAL';
            if (engine.state.interactionMode === 'SELECT_OPTIONAL') {
                engine.resolveOptionalEffect(true);
            }
            if (engine.state.interactionMode === 'SELECT_COST') {
                const first = engine.getLegalActions(p1.id).find(action => action.type === 'SELECT_COST_HAND');
                if (first && first.type === 'SELECT_COST_HAND') engine.step(first);
            }

            return [
                { pass: promptedAgain === true, message: '다음 턴에 파괴 대체 선택창 재등장' },
                { pass: p1.unitZones[0].unit !== null, message: '다음 턴 대체 재사용 성공' },
            ];
        },
    },
];

export const BT02LightningModule: UnifiedTestModule = {
    packId: 'BT02',
    displayName: 'BT02 Lightning Unified',
    tests,
};
