/**
 * ST01 Fire Starter Unified Tests
 */

import { UnifiedTestCase, UnifiedTestModule, Phase } from './types';

const tests: UnifiedTestCase[] = [
    // === LEADER ===
    {
        cardId: 'ST01-001',
        name: '라피 리더 각성',
        description: '레벨 5 각성 후 자신 유닛 +1000. Next Phase 클릭.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 4;
            p1.levelZone = getCard('ST01-001');
            p1.levelZone.isAwakened = false;
            p1.unitZones[0].unit = getCard('ST01-002');
            engine.state.phase = Phase.LEVEL_UP;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = p1.unitZones[0].unit!.power || 0;
            engine.nextPhase();
            return [
                { pass: p1.leaderLevel === 5, message: '레벨 5 도달' },
                { pass: p1.levelZone?.isAwakened === true, message: '리더 각성' },
                { pass: engine.getUnitPower(p1.unitZones[0], p1) >= basePower + 1000, message: '유닛 +1000' }
            ];
        }
    },

    // === UNITS ===
    {
        cardId: 'ST01-003',
        name: '베스티 어태커 +1000',
        description: '공격 시 파워 +1000.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard('ST01-003');
            p2.unitZones[0].unit = getCard('ST01-002');
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = p1.unitZones[0].unit!.power || 0;
            engine.attack(0);
            return [
                { pass: engine.getUnitPower(p1.unitZones[0], p1) >= basePower + 1000, message: '어태커 +1000' }
            ];
        }
    },
    {
        cardId: 'ST01-005',
        name: '노이즈 어태커 +2000',
        description: '공격 시 파워 +2000.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('ST01-005');
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = p1.unitZones[0].unit!.power || 0;
            engine.attack(0);
            return [
                { pass: engine.getUnitPower(p1.unitZones[0], p1) >= basePower + 2000, message: '어태커 +2000' }
            ];
        }
    },
    {
        cardId: 'ST01-006',
        name: '느와르 엔트리 -3000',
        description: '배치 시 조우 유닛 -3000.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.leaderLevel = 5;
            p1.hand = [getCard('ST01-006')];
            p2.unitZones[0].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p2 = engine.opponentPlayer;
            const basePower = engine.getUnitPower(p2.unitZones[0], p2);
            engine.playUnit(0, 0);
            const newPower = engine.getUnitPower(p2.unitZones[0], p2);
            // 3000 base - 3000 = 0, unit destroyed
            return [
                { pass: p2.unitZones[0].unit === null || newPower < basePower, message: '조우 유닛 -3000 또는 트래시' }
            ];
        }
    },
    {
        cardId: 'ST01-008',
        name: '블랑 패시브 어태커 +1000',
        description: '어태커 키워드 유닛에 +1000.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('ST01-008'); // Blanc
            p1.unitZones[1].unit = getCard('ST01-003'); // Besti (Attacker)
            p1.unitZones[2].unit = getCard('ST01-002'); // Neon (No Attacker)
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const bestiBase = p1.unitZones[1].unit!.power || 0;
            const neonBase = p1.unitZones[2].unit!.power || 0;
            const bestiPower = engine.getUnitPower(p1.unitZones[1], p1);
            const neonPower = engine.getUnitPower(p1.unitZones[2], p1);
            return [
                { pass: bestiPower >= bestiBase + 1000, message: `베스티 +1000 (${bestiPower})` },
                { pass: neonPower === neonBase, message: `네온 버프 없음 (${neonPower})` }
            ];
        }
    },
    {
        cardId: 'ST01-011',
        name: '라피 유닛 관통',
        description: '공격 → 방어 후 관통 대미지.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.leaderLevel = 5;
            p1.unitZones[0].unit = getCard('ST01-011');
            p1.unitZones[0].unit!.power = 6000;
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

    // === SKILLS ===
    {
        cardId: 'ST01-012',
        name: '약점 간파 -2000',
        description: '스킬 → 상대 유닛 -2000.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.leaderLevel = 5;
            p1.hand = [getCard('ST01-012')];
            p2.unitZones[0].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p2 = engine.opponentPlayer;
            const basePower = engine.getUnitPower(p2.unitZones[0], p2);
            engine.playSkill(0);
            engine.selectTarget(0, true);
            const newPower = engine.getUnitPower(p2.unitZones[0], p2);
            return [
                { pass: newPower === basePower - 2000, message: `-2000 (${newPower})` }
            ];
        }
    },
    {
        cardId: 'ST01-014',
        name: '화력뿐이야 전체 +2000',
        description: '스킬 → 자신 유닛 전체 +2000.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 5;
            p1.hand = [getCard('ST01-014')];
            p1.unitZones[0].unit = getCard('ST01-002');
            p1.unitZones[1].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const base0 = engine.getUnitPower(p1.unitZones[0], p1);
            const base1 = engine.getUnitPower(p1.unitZones[1], p1);
            engine.playSkill(0);
            const new0 = engine.getUnitPower(p1.unitZones[0], p1);
            const new1 = engine.getUnitPower(p1.unitZones[1], p1);
            return [
                { pass: new0 === base0 + 2000, message: `유닛0 +2000 (${new0})` },
                { pass: new1 === base1 + 2000, message: `유닛1 +2000 (${new1})` }
            ];
        }
    },
    {
        cardId: 'ST01-015',
        name: '미사일 -5000',
        description: '스킬 → 상대 유닛 -5000.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.leaderLevel = 5;
            p1.hand = [getCard('ST01-015')];
            p2.unitZones[0].unit = getCard('ST01-009');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p2 = engine.opponentPlayer;
            const basePower = engine.getUnitPower(p2.unitZones[0], p2);
            engine.playSkill(0);
            engine.selectTarget(0, true);
            const newPower = engine.getUnitPower(p2.unitZones[0], p2);
            return [
                { pass: newPower === basePower - 5000 || p2.unitZones[0].unit === null, message: `-5000 또는 트래시` }
            ];
        }
    },

    // === ITEMS ===
    {
        cardId: 'ST01-016',
        name: '부츠 어태커 +2000',
        description: '아이템 장착 → 공격 시 +2000.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 5;
            p1.unitZones[0].unit = getCard('ST01-002');
            p1.unitZones[0].items = [getCard('ST01-016')];
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = p1.unitZones[0].unit!.power || 0;
            engine.attack(0);
            return [
                { pass: engine.getUnitPower(p1.unitZones[0], p1) >= basePower + 2000, message: '아이템 +2000' }
            ];
        }
    }
];

export const ST01Module: UnifiedTestModule = {
    packId: 'ST01',
    displayName: 'ST01 화염 스타터',
    tests
};

export default tests;
