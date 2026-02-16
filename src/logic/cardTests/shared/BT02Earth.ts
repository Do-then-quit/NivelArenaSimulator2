import { UnifiedTestCase, UnifiedTestModule, Phase } from './types';
import { RuleValidator } from '../../RuleValidator';
import { GameEngine } from '../../GameEngine';

function setBt02TestSize(engine: GameEngine): void {
    engine.state.players.forEach(player => {
        player.leaderLevel = 10;
    });
}

const tests: UnifiedTestCase[] = [
    {
        cardId: 'BT02-010',
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
        cardId: 'BT02-016',
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
        cardId: 'BT02-018',
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
