/**
 * ST01 Fire Starter Unified Tests - Complete Coverage
 */

import { UnifiedTestCase, UnifiedTestModule, Phase } from './types';

const tests: UnifiedTestCase[] = [
    // === LEADER ===
    {
        cardId: 'ST01-001',
        name: '라피 리더 각성',
        description: '레벨 5 각성 후 자신 유닛 +1000.',
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
        name: '누아르 엔트리 -3000',
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
            return [
                { pass: p2.unitZones[0].unit === null || newPower < basePower, message: '조우 유닛 -3000' }
            ];
        }
    },
    {
        cardId: 'ST01-007',
        name: '바이퍼 어태커 +1000',
        description: '공격 시 파워 +1000.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('ST01-007');
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
        cardId: 'ST01-008',
        name: '블랑 패시브 어태커 +1000',
        description: '어태커 키워드 유닛에 +1000.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('ST01-008');
            p1.unitZones[1].unit = getCard('ST01-003');
            p1.unitZones[2].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const bestiBase = p1.unitZones[1].unit!.power || 0;
            const neonBase = p1.unitZones[2].unit!.power || 0;
            const bestiPower = engine.getUnitPower(p1.unitZones[1], p1);
            const neonPower = engine.getUnitPower(p1.unitZones[2], p1);
            return [
                { pass: bestiPower >= bestiBase + 1000, message: `어태커 +1000 (${bestiPower})` },
                { pass: neonPower === neonBase, message: `일반 버프 없음 (${neonPower})` }
            ];
        }
    },
    // ST01-010: 액티브 효과
    {
        cardId: 'ST01-010',
        name: '아니스 액티브 -3000',
        description: '패 1장 덱으로 → 조우 유닛 -3000.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard('ST01-010');
            p1.hand = [getCard('ST01-002')];
            p2.unitZones[0].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p2 = engine.opponentPlayer;
            const basePower = engine.getUnitPower(p2.unitZones[0], p2);
            engine.activateEffect(0, 0);
            engine.selectCost(0);
            const newPower = engine.getUnitPower(p2.unitZones[0], p2);
            return [
                { pass: newPower === basePower - 3000 || p2.unitZones[0].unit === null, message: '조우 -3000' }
            ];
        }
    },
    // ST01-010: 트리거 효과
    {
        cardId: 'ST01-010-Trigger',
        name: '아니스 트리거 -5000',
        description: '대미지 트리거: 상대 유닛 -5000.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.deck = [getCard('ST01-010')];
            p2.unitZones[0].unit = getCard('ST01-009');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            const basePower = engine.getUnitPower(p2.unitZones[0], p2);
            engine.dealDamage(p1, 1);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectTarget(0, true);
            }
            const newPower = engine.getUnitPower(p2.unitZones[0], p2);
            return [
                { pass: newPower === basePower - 5000 || p2.unitZones[0].unit === null, message: '트리거 -5000' }
            ];
        }
    },
    // ST01-011: 관통
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
    // ST01-011: 트리거 패복귀
    {
        cardId: 'ST01-011-Trigger',
        name: '라피 트리거 패복귀',
        description: '대미지 트리거: 패로 복귀.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.deck = [getCard('ST01-011')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.dealDamage(p1, 1);
            return [
                { pass: p1.hand.some(c => c.id.startsWith('ST01-011')), message: '패로 복귀' },
                { pass: p1.damage.length === 0, message: '대미지 없음' }
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
    // ST01-013: 스킬 효과
    {
        cardId: 'ST01-013',
        name: '전력 보강 스킬',
        description: '트래시에서 2코 이하 유닛 회수.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 5;
            p1.hand = [getCard('ST01-013')];
            const unit = getCard('ST01-002');
            unit.cost = 1;
            p1.trash = [unit];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playSkill(0);
            engine.selectTrashTarget(0);
            return [
                { pass: p1.hand.some(c => c.id.startsWith('ST01-002')), message: '유닛 회수됨' }
            ];
        }
    },
    // ST01-013: 트리거 효과
    {
        cardId: 'ST01-013-Trigger',
        name: '전력 보강 트리거',
        description: '대미지 트리거: 2코 이하 유닛 회수.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.deck = [getCard('ST01-013')];
            const unit = getCard('ST01-002');
            unit.cost = 1;
            p1.trash = [unit];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.dealDamage(p1, 1);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectTrashTarget(0);
            }
            return [
                { pass: p1.hand.some(c => c.id.startsWith('ST01-002')), message: '트리거 회수' }
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
    // ST01-015: 스킬 효과
    {
        cardId: 'ST01-015',
        name: '미사일 스킬 -5000',
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
                { pass: newPower === basePower - 5000 || p2.unitZones[0].unit === null, message: '-5000' }
            ];
        }
    },
    // ST01-015: 트리거 효과
    {
        cardId: 'ST01-015-Trigger',
        name: '미사일 트리거 -5000',
        description: '대미지 트리거: 상대 유닛 -5000.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.deck = [getCard('ST01-015')];
            p2.unitZones[0].unit = getCard('ST01-009');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            const basePower = engine.getUnitPower(p2.unitZones[0], p2);
            engine.dealDamage(p1, 1);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectTarget(0, true);
            }
            const newPower = engine.getUnitPower(p2.unitZones[0], p2);
            return [
                { pass: newPower === basePower - 5000 || p2.unitZones[0].unit === null, message: '트리거 -5000' }
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
    },
    {
        cardId: 'ST01-017',
        name: '글러브 약탈[1]',
        description: '공격으로 유닛 트래시 시 드로우 1.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.leaderLevel = 5;
            p1.unitZones[0].unit = getCard('ST01-002');
            p1.unitZones[0].unit!.power = 6000;
            p1.unitZones[0].items = [getCard('ST01-017')];
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
                { pass: p1.hand.length >= initHand + 1, message: `약탈 드로우 (${p1.hand.length})` }
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
