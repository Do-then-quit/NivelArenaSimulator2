import { UnifiedTestCase, UnifiedTestModule, Phase } from './types';
import { GameEngine } from '../../GameEngine';

function setBt02TestSize(engine: GameEngine): void {
    engine.state.players.forEach(player => {
        player.leaderLevel = 10;
    });
}

const tests: UnifiedTestCase[] = [
    {
        cardId: 'BT02-020',
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
        cardId: 'BT02-022',
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
        cardId: 'BT02-026',
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
];

export const BT02StormModule: UnifiedTestModule = {
    packId: 'BT02',
    displayName: 'BT02 Storm Unified',
    tests,
};
