import { UnifiedTestCase, UnifiedTestModule, Phase } from './types';
import { GameEngine } from '../../GameEngine';

function setBt02TestSize(engine: GameEngine): void {
    engine.state.players.forEach(player => {
        player.leaderLevel = 10;
    });
}

const tests: UnifiedTestCase[] = [
    {
        cardId: 'BT02-058',
        name: '대미지 아이템↔손패 교환',
        description: '엑시트로 대미지존 아이템을 패로, 패 1장을 대미지존으로 이동.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.unitZones[0].unit = getCard('BT02-058');
            p1.damage = [getCard('BT02-078')];
            p1.hand = [getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                const damageAction = engine.getLegalActions(p1.id).find(a => a.type === 'SELECT_DAMAGE_TARGET');
                if (damageAction && damageAction.type === 'SELECT_DAMAGE_TARGET') {
                    engine.selectDamageTargetByPlayerId(damageAction.damageIndex, damageAction.targetPlayerId);
                }
            }
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                const handAction = engine.getLegalActions(p1.id).find(a => a.type === 'SELECT_HAND_TARGET');
                if (handAction && handAction.type === 'SELECT_HAND_TARGET') {
                    engine.selectHandTargetByPlayerId(handAction.handIndex, handAction.targetPlayerId);
                }
            }
            return [
                { pass: p1.hand.some(card => card.id.startsWith('BT02-078')), message: '대미지존 아이템 패 이동' },
                { pass: p1.damage.some(card => card.id.startsWith('ST01-002')), message: '손패 카드 대미지존 이동' },
            ];
        },
    },
    {
        cardId: 'BT02-068',
        name: '상단2 공개 후 1회수/나머지 덱하단',
        description: '아이템 1장 회수 후 남은 카드 덱하단 이동.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.hand = [getCard('BT02-068')];
            p1.deck = [getCard('ST01-002'), getCard('BT02-078')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playUnit(0, 0);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                const action = engine.getLegalActions(p1.id).find(a => a.type === 'SELECT_REVEALED_TARGET');
                if (action && action.type === 'SELECT_REVEALED_TARGET') {
                    engine.selectRevealedTarget(action.revealedIndex);
                }
            }
            return [
                { pass: p1.hand.some(card => card.id.startsWith('BT02-078')), message: '아이템 1장 패 회수' },
                { pass: p1.deck[0]?.id?.startsWith('ST01-002') === true, message: '남은 카드 덱하단 배치' },
            ];
        },
    },
    {
        cardId: 'BT02-069',
        name: '전투/효과 파괴 대체',
        description: '장착 아이템 트래시로 유닛 생존.',
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
                { pass: p1.unitZones[0].unit?.id.startsWith('BT02-069') === true, message: '파괴 대체 후 생존' },
                { pass: p1.trash.some(card => card.id.startsWith('BT02-078')), message: '장착 아이템 트래시' },
            ];
        },
    },
    {
        cardId: 'BT02-081',
        name: '아이템 파괴 대체(히트만큼 손패 트래시)',
        description: '아이템 대체를 선택하면 유닛이 생존한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.unitZones[0].unit = getCard('BT02-003');
            p1.unitZones[0].items = [getCard('BT02-081')];
            p1.hand = [getCard('ST01-002')];
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
            if (engine.state.interactionMode === 'SELECT_OPTIONAL') {
                engine.resolveOptionalEffect(true);
            }
            if (engine.state.interactionMode === 'SELECT_COST') {
                engine.selectCostForPlayerId(0, p1.id);
            }
            return [
                { pass: p1.unitZones[0].unit?.id.startsWith('BT02-003') === true, message: '대체 성공 후 유닛 생존' },
                { pass: p1.trash.some(card => card.id.startsWith('ST01-002')), message: '손패 코스트 지불' },
            ];
        },
    },
];

export const BT02LightningModule: UnifiedTestModule = {
    packId: 'BT02',
    displayName: 'BT02 Lightning Unified',
    tests,
};
