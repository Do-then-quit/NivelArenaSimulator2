import { UnifiedTestCase, UnifiedTestModule, Phase } from './types';
import { GameEngine } from '../../GameEngine';

function setBt02TestSize(engine: GameEngine): void {
    engine.state.players.forEach(player => {
        player.leaderLevel = 10;
    });
}

const tests: UnifiedTestCase[] = [
    {
        cardId: 'BT02-045',
        name: '손패 트래시 이벤트 턴당 1회',
        description: '효과로 손패 트래시 시 1드로우, 같은 턴 중복 미발동.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.unitZones[0].unit = getCard('BT02-045');
            p1.hand = [getCard('ST01-002'), getCard('ST01-002')];
            p1.deck = [getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002')];
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

            return [
                { pass: mid === before, message: '첫 트리거로 드로우 1장 반영' },
                { pass: p1.hand.length === mid - 1, message: '동일 턴 2회차는 추가 드로우 없음' },
            ];
        },
    },
    {
        cardId: 'BT02-049',
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
        cardId: 'BT02-050',
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
];

export const BT02WaterModule: UnifiedTestModule = {
    packId: 'BT02',
    displayName: 'BT02 Water Unified',
    tests,
};
