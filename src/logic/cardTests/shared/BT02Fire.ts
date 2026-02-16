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
        cardId: 'BT02-001',
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
            return [
                { pass: buffed >= base + 1500, message: `어태커 +1500 적용 (${buffed})` },
            ];
        },
    },
    {
        cardId: 'BT02-006',
        name: '트래시 2코 이하 유닛 회수',
        description: '엔트리로 2코 이하 유닛 1장 회수.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setBt02TestSize(engine);
            p1.hand = [getCard('BT02-006')];
            p1.trash = [getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playUnit(0, 0);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectTrashTarget(0, p1.id);
            }
            return [
                { pass: p1.hand.some(card => card.id.startsWith('ST01-002')), message: '트래시 유닛 회수 성공' },
            ];
        },
    },
    {
        cardId: 'BT02-009',
        name: '아이템 장착조건 3코스트 이하',
        description: '4코 유닛에는 장착 불가, 3코 이하 유닛에는 장착 가능.',
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

            return [
                { pass: invalid === false, message: '4코 유닛 장착 불가' },
                { pass: valid === true, message: '3코 유닛 장착 가능' },
            ];
        },
    },
];

export const BT02FireModule: UnifiedTestModule = {
    packId: 'BT02',
    displayName: 'BT02 Fire Unified',
    tests,
};
