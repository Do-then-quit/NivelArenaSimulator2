/**
 * ST03 Storm Starter Unified Tests  
 */

import { UnifiedTestCase, UnifiedTestModule, Phase } from './types';

const tests: UnifiedTestCase[] = [
    // === LEADER ===
    {
        cardId: 'ST03-001',
        name: '미하라 리더 각성',
        description: '레벨 4 각성 후 엑시트 유닛 +1000. Next Phase 클릭.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 3;
            p1.levelZone = getCard('ST03-001');
            p1.levelZone.isAwakened = false;
            p1.unitZones[0].unit = getCard('ST03-006'); // Has Exit
            engine.state.phase = Phase.LEVEL_UP;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = p1.unitZones[0].unit!.power || 0;
            engine.nextPhase();
            return [
                { pass: p1.leaderLevel === 4, message: '레벨 4 도달' },
                { pass: p1.levelZone?.isAwakened === true, message: '리더 각성' },
                { pass: engine.getUnitPower(p1.unitZones[0], p1) >= basePower + 1000, message: '엑시트 유닛 +1000' }
            ];
        }
    },

    // === UNITS ===
    {
        cardId: 'ST03-006',
        name: '엑시트 드로우 1',
        description: '유닛 트래시 시 1장 드로우.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard('ST03-006');
            p2.unitZones[0].unit = getCard('ST01-009');
            p1.deck = [getCard('ST01-002'), getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const initHand = p1.hand.length;
            engine.destroyUnit(p1, p1.unitZones[0]);
            return [
                { pass: p1.hand.length >= initHand + 1, message: `엑시트 드로우 1 (${p1.hand.length})` }
            ];
        }
    },
    {
        cardId: 'ST03-008',
        name: '패시브 엑시트 유닛 +1000',
        description: '필드 엑시트 유닛에 +1000.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('ST03-008'); // Passive source
            p1.unitZones[1].unit = getCard('ST03-006'); // Has Exit
            p1.unitZones[2].unit = getCard('ST01-002'); // No Exit
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const exitBase = p1.unitZones[1].unit!.power || 0;
            const noExitBase = p1.unitZones[2].unit!.power || 0;
            const exitPower = engine.getUnitPower(p1.unitZones[1], p1);
            const noExitPower = engine.getUnitPower(p1.unitZones[2], p1);
            return [
                { pass: exitPower >= exitBase + 1000, message: `엑시트 +1000 (${exitPower})` },
                { pass: noExitPower === noExitBase, message: `일반 유닛 버프 없음 (${noExitPower})` }
            ];
        }
    },

    // === SKILLS ===
    {
        cardId: 'ST03-014',
        name: '내 유닛 트래시 → 드로우 2',
        description: '스킬 → 자신 유닛 트래시 → 2장 드로우.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 5;
            p1.hand = [getCard('ST03-014')];
            p1.unitZones[0].unit = getCard('ST01-002');
            p1.deck = [getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playSkill(0);
            engine.selectTarget(0, false);
            return [
                { pass: p1.unitZones[0].unit === null, message: '유닛 트래시됨' },
                { pass: p1.hand.length >= 2, message: `드로우 2 (패 ${p1.hand.length})` }
            ];
        }
    },
    {
        cardId: 'ST03-015',
        name: '내 유닛 + 조우 유닛 트래시',
        description: '스킬 → 내 유닛과 조우 유닛 모두 트래시.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.leaderLevel = 5;
            p1.hand = [getCard('ST03-015')];
            p1.unitZones[0].unit = getCard('ST01-002');
            p2.unitZones[0].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            engine.playSkill(0);
            engine.selectTarget(0, false);
            return [
                { pass: p1.unitZones[0].unit === null, message: '내 유닛 트래시' },
                { pass: p2.unitZones[0].unit === null, message: '조우 유닛 트래시' }
            ];
        }
    },

    // === ITEMS ===
    {
        cardId: 'ST03-016',
        name: '아이템 +3000 종결',
        description: '방어 시 전투 종료.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.leaderLevel = 5;
            p1.unitZones[0].unit = getCard('ST01-002');
            p1.unitZones[0].items = [getCard('ST03-016')];
            p2.unitZones[0].unit = getCard('ST01-011');
            p2.unitZones[0].unit!.power = 10000;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = p1.unitZones[0].unit!.power || 0;
            const actualPower = engine.getUnitPower(p1.unitZones[0], p1);
            return [
                { pass: actualPower >= basePower + 3000, message: `+3000 (${actualPower})` }
            ];
        }
    }
];

export const ST03Module: UnifiedTestModule = {
    packId: 'ST03',
    displayName: 'ST03 폭풍 스타터',
    tests
};

export default tests;
