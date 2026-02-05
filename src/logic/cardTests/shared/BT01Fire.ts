/**
 * BT01 Fire Attribute Unified Tests (BT01-001 to BT01-027)
 * 
 * These tests can be run by both vitest and CardTester UI.
 */

import { UnifiedTestCase, UnifiedTestModule, Phase } from './types';

const tests: UnifiedTestCase[] = [
    // === LEADER ===
    {
        cardId: 'BT01-001',
        name: '레드 후드 각성',
        description: '레벨 5에서 레벨업 시 각성. Next Phase 버튼 클릭.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 5;
            p1.levelZone = getCard('BT01-001');
            p1.levelZone.isAwakened = false;
            p1.unitZones[0].unit = getCard('BT01-002');
            engine.state.phase = Phase.LEVEL_UP;
        },
        verify: (engine) => {
            engine.nextPhase();
            const p1 = engine.currentPlayer;
            return [
                { pass: p1.leaderLevel === 6, message: '레벨 6 도달' },
                { pass: p1.levelZone?.isAwakened === true, message: '리더 각성됨' }
            ];
        }
    },
    {
        cardId: 'BT01-001',
        name: '어태커 버프',
        description: '각성 후 어태커 유닛 +2000 파워 확인.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.levelZone = getCard('BT01-001');
            p1.levelZone.isAwakened = true;
            p1.unitZones[0].unit = getCard('BT01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const power = engine.getUnitPower(p1.unitZones[0], p1);
            const basePower = p1.unitZones[0].unit!.power || 0;
            return [
                { pass: power >= basePower + 2000, message: `어태커 +2000 (${power})` }
            ];
        }
    },

    // === UNITS ===
    {
        cardId: 'BT01-002',
        name: '어태커 +2000',
        description: '공격 시 파워 +2000. Attack 버튼으로 공격.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT01-002');
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = p1.unitZones[0].unit!.power || 0;
            engine.attack(0);
            const attackPower = engine.getUnitPower(p1.unitZones[0], p1);
            return [
                { pass: attackPower >= basePower + 2000, message: `어태커 +2000 (${attackPower})` }
            ];
        }
    },
    {
        cardId: 'BT01-004',
        name: '관통[1]',
        description: '공격 → 방어 후 관통 대미지 1 확인.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard('BT01-004');
            p1.unitZones[0].unit!.power = 5000;
            p2.unitZones[0].unit = getCard('ST01-002');
            p2.unitZones[0].unit!.power = 3000;
            p2.deck = [getCard('ST01-002'), getCard('ST01-002')];
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p2 = engine.opponentPlayer;
            engine.attack(0);
            engine.resolveBlock(true);
            return [
                { pass: p2.damage.length >= 1, message: `관통 대미지 ${p2.damage.length}` }
            ];
        }
    },
    {
        cardId: 'BT01-006',
        name: '약탈[1]',
        description: '상대 유닛 트래시 후 카드 1장 드로우.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard('BT01-006');
            p1.unitZones[0].unit!.power = 5000;
            p2.unitZones[0].unit = getCard('ST01-002');
            p2.unitZones[0].unit!.power = 3000;
            p1.deck = [getCard('ST01-002'), getCard('ST01-002')];
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const initHand = p1.hand.length;
            engine.attack(0);
            engine.resolveBlock(true);
            return [
                { pass: p1.hand.length >= initHand + 1, message: `드로우 +1 (패 ${p1.hand.length})` }
            ];
        }
    },
    {
        cardId: 'BT01-011',
        name: '액티브 -1500',
        description: '유닛 클릭 → Activate 버튼 → 상대 유닛 선택.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.leaderLevel = 5;
            p1.unitZones[0].unit = getCard('BT01-011');
            p2.unitZones[0].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p2 = engine.opponentPlayer;
            const basePower = engine.getUnitPower(p2.unitZones[0], p2);
            engine.activateEffect(0, 0);
            engine.selectTarget(0, true);
            const newPower = engine.getUnitPower(p2.unitZones[0], p2);
            return [
                { pass: newPower === basePower - 1500, message: `파워 -1500 (${newPower})` }
            ];
        }
    },

    // === SKILLS ===
    {
        cardId: 'BT01-021',
        name: '전체 -1000',
        description: '스킬 사용 → 상대 전체 -1000.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.leaderLevel = 10;
            p2.unitZones[0].unit = getCard('ST01-002');
            p2.unitZones[1].unit = getCard('ST01-002');
            p1.hand = [getCard('BT01-021')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p2 = engine.opponentPlayer;
            const base0 = engine.getUnitPower(p2.unitZones[0], p2);
            const base1 = engine.getUnitPower(p2.unitZones[1], p2);
            engine.playSkill(0);
            const new0 = engine.getUnitPower(p2.unitZones[0], p2);
            const new1 = engine.getUnitPower(p2.unitZones[1], p2);
            return [
                { pass: new0 === base0 - 1000, message: `유닛0 -1000 (${new0})` },
                { pass: new1 === base1 - 1000, message: `유닛1 -1000 (${new1})` }
            ];
        }
    },

    // === ITEMS ===
    {
        cardId: 'BT01-026',
        name: '아이템 관통[1]',
        description: '아이템 장착 유닛 공격 → 관통 대미지.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.leaderLevel = 5;
            p1.unitZones[0].unit = getCard('ST01-002');
            p1.unitZones[0].unit!.power = 5000;
            p1.unitZones[0].items = [getCard('BT01-026')];
            p2.unitZones[0].unit = getCard('ST01-002');
            p2.unitZones[0].unit!.power = 3000;
            p2.deck = [getCard('ST01-002'), getCard('ST01-002')];
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p2 = engine.opponentPlayer;
            engine.attack(0);
            engine.resolveBlock(true);
            return [
                { pass: p2.damage.length >= 1, message: `관통 대미지 ${p2.damage.length}` }
            ];
        }
    }
];

export const BT01FireModule: UnifiedTestModule = {
    packId: 'BT01화염',
    displayName: 'BT01 화염 (Fire)',
    tests
};

export default tests;
