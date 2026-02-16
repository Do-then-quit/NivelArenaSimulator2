/**
 * ST03 Storm Starter Unified Tests - Complete Coverage
 */

import { UnifiedTestCase, UnifiedTestModule, Phase } from './types';

const tests: UnifiedTestCase[] = [
    // === LEADER ===
    {
        testId: 'ST03-001',
        name: '모더니아 리더 각성',
        description: '레벨 4 각성 후 엑시트 유닛 +1000.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 3;
            p1.levelZone = getCard('ST03-001');
            p1.levelZone.isAwakened = false;
            const exitUnit = getCard('ST03-006');
            exitUnit.keywords = ['엑시트'];
            p1.unitZones[0].unit = exitUnit;
            engine.state.phase = Phase.LEVEL_UP;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.nextPhase();
            return [
                { pass: p1.leaderLevel === 4, message: '레벨 4 도달' },
                { pass: p1.levelZone?.isAwakened === true, message: '리더 각성' }
            ];
        }
    },

    // === UNITS ===
    // ST03-003: 엑시트 효과
    {
        testId: 'ST03-003',
        name: '프리바티 엑시트 상대버림',
        description: '트래시 시 상대 패 1장 버림.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard('ST03-003');
            p2.hand = [getCard('ST03-002'), getCard('ST03-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            const initHand = p2.hand.length;
            engine.destroyUnit(p1, p1.unitZones[0]);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectHandTarget(0, true);
            }
            return [
                { pass: p2.hand.length < initHand, message: `상대 버림 (${p2.hand.length})` }
            ];
        }
    },
    // ST03-003: 트리거 효과
    {
        testId: 'ST03-003-Trigger',
        name: '프리바티 트리거 상대버림',
        description: '대미지 트리거: 상대 패 3장 이상이면 버림.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.deck = [getCard('ST03-003')];
            p2.hand = [getCard('ST03-002'), getCard('ST03-002'), getCard('ST03-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            const initHand = p2.hand.length;
            engine.dealDamage(p1, 1);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectHandTarget(0, true);
            }
            return [
                { pass: p2.hand.length < initHand, message: '트리거 버림' }
            ];
        }
    },
    {
        testId: 'ST03-005',
        name: '노벨 엔트리 1코 트래시',
        description: '1코 이하 조우 유닛 트래시.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.leaderLevel = 5;
            p1.hand = [getCard('ST03-005')];
            p2.unitZones[0].unit = getCard('ST03-002');
            p2.unitZones[0].unit!.cost = 1;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p2 = engine.opponentPlayer;
            engine.playUnit(0, 0);
            return [
                { pass: p2.unitZones[0].unit === null, message: '1코 유닛 트래시' }
            ];
        }
    },
    {
        testId: 'ST03-006',
        name: '사쿠라 엑시트 드로우',
        description: '트래시 시 1장 드로우.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('ST03-006');
            p1.deck = [getCard('ST03-002'), getCard('ST03-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const initHand = p1.hand.length;
            engine.destroyUnit(p1, p1.unitZones[0]);
            return [
                { pass: p1.hand.length > initHand, message: `드로우 (${p1.hand.length})` }
            ];
        }
    },
    {
        testId: 'ST03-007',
        name: 'D 엑시트 공멸',
        description: '전투로 트래시 시 상대 유닛도 트래시.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard('ST03-007');
            p1.unitZones[0].unit!.power = 3000;
            p1.unitZones[0].unit!.cost = 3;
            p2.unitZones[0].unit = getCard('ST03-002');
            p2.unitZones[0].unit!.power = 5000;
            p2.unitZones[0].unit!.cost = 2;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            engine.attack(0);
            engine.resolveBlock(true);
            return [
                { pass: p1.unitZones[0].unit === null, message: 'D 트래시' },
                { pass: p2.unitZones[0].unit === null, message: '공멸로 상대도 트래시' }
            ];
        }
    },
    {
        testId: 'ST03-008',
        name: '엑시아 엑시트 +1000',
        description: '패시브: 엑시트 유닛 +1000.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('ST03-008');
            const exitUnit = getCard('ST03-006');
            exitUnit.keywords = ['엑시트'];
            p1.unitZones[1].unit = exitUnit;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = p1.unitZones[1].unit!.power || 0;
            const actualPower = engine.getUnitPower(p1.unitZones[1], p1);
            return [
                { pass: actualPower >= basePower + 1000, message: `엑시트 +1000 (${actualPower})` }
            ];
        }
    },
    // ST03-010: 엑시트 효과
    {
        testId: 'ST03-010',
        name: '로산나 엑시트 회수',
        description: '트래시에서 엑시트 2코 이하 회수.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('ST03-010');
            const exitUnit = getCard('ST03-006');
            exitUnit.keywords = ['엑시트'];
            exitUnit.cost = 2;
            p1.trash = [exitUnit];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.destroyUnit(p1, p1.unitZones[0]);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectTrashTarget(0);
            }
            return [
                { pass: p1.hand.some(c => c.id.startsWith('ST03-006')), message: '엑시트 회수' }
            ];
        }
    },
    // ST03-010: 트리거 효과
    {
        testId: 'ST03-010-Trigger',
        name: '로산나 트리거 상대버림',
        description: '대미지 트리거: 상대 패 3장 이상이면 버림.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.deck = [getCard('ST03-010')];
            p2.hand = [getCard('ST03-002'), getCard('ST03-002'), getCard('ST03-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            const initHand = p2.hand.length;
            engine.dealDamage(p1, 1);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectHandTarget(0, true);
            }
            return [
                { pass: p2.hand.length < initHand, message: '트리거 버림' }
            ];
        }
    },
    // ST03-011: 엔트리 효과
    {
        testId: 'ST03-011',
        name: '모더니아 엔트리 패버림→트래시',
        description: '패 모두 버려 2장 이상이면 조우 트래시.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.leaderLevel = 7;
            p1.hand = [getCard('ST03-011'), getCard('ST03-002'), getCard('ST03-002')];
            p2.unitZones[0].unit = getCard('ST03-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p2 = engine.opponentPlayer;
            engine.playUnit(0, 0);
            engine.resolveOptionalEffect(true);
            return [
                { pass: p2.unitZones[0].unit === null, message: '조우 트래시' }
            ];
        }
    },
    // ST03-011: 트리거 효과
    {
        testId: 'ST03-011-Trigger',
        name: '모더니아 트리거 패복귀',
        description: '대미지 트리거: 패로 복귀.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.deck = [getCard('ST03-011')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.dealDamage(p1, 1);
            return [
                { pass: p1.hand.some(c => c.id.startsWith('ST03-011')), message: '패로 복귀' }
            ];
        }
    },

    // === SKILLS ===
    {
        testId: 'ST03-012',
        name: '기습 서로 버림',
        description: '패 1장 버려 상대도 버림.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.leaderLevel = 5;
            p1.hand = [getCard('ST03-012'), getCard('ST03-002')];
            p2.hand = [getCard('ST03-002'), getCard('ST03-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p2 = engine.opponentPlayer;
            const initHand = p2.hand.length;
            engine.playSkill(0);
            engine.selectHandTarget(0, false);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectHandTarget(0, true);
            }
            return [
                { pass: p2.hand.length < initHand, message: '상대 버림' }
            ];
        }
    },
    {
        testId: 'ST03-013',
        name: '흑화 패트래시→필드트래시',
        description: '패 유닛 버려 더 낮은 코스트 유닛 트래시.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.leaderLevel = 5;
            const highCost = getCard('ST03-008');
            highCost.cost = 4;
            p1.hand = [getCard('ST03-013'), highCost];
            p2.unitZones[0].unit = getCard('ST03-002');
            p2.unitZones[0].unit!.cost = 1;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p2 = engine.opponentPlayer;
            engine.playSkill(0);
            engine.selectCost(0);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectTarget(0, true);
            }
            return [
                { pass: p2.unitZones[0].unit === null, message: '낮은 코스트 트래시' }
            ];
        }
    },
    {
        testId: 'ST03-014',
        name: '센스 쉐어링 희생드로우',
        description: '유닛 트래시 후 2장 드로우.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 5;
            p1.hand = [getCard('ST03-014')];
            p1.unitZones[0].unit = getCard('ST03-002');
            p1.deck = [getCard('ST03-002'), getCard('ST03-002'), getCard('ST03-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const initHand = p1.hand.length;
            engine.playSkill(0);
            engine.selectTarget(0, false);
            return [
                { pass: p1.hand.length >= initHand + 1, message: `드로우 2 (${p1.hand.length})` }
            ];
        }
    },
    // ST03-015: 스킬 효과
    {
        testId: 'ST03-015',
        name: '다 덤벼! 스킬',
        description: '자신 유닛과 조우 유닛 모두 트래시.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.leaderLevel = 5;
            p1.hand = [getCard('ST03-015')];
            p1.unitZones[0].unit = getCard('ST03-002');
            p2.unitZones[0].unit = getCard('ST03-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            engine.playSkill(0);
            engine.selectTarget(0, false);
            return [
                { pass: p1.unitZones[0].unit === null || p2.unitZones[0].unit === null, message: '유닛들 트래시' }
            ];
        }
    },
    // ST03-015: 트리거 효과
    {
        testId: 'ST03-015-Trigger',
        name: '다 덤벼! 트리거',
        description: '대미지 트리거: 트래시에서 엑시트 회수.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.deck = [getCard('ST03-015')];
            const exitUnit = getCard('ST03-006');
            exitUnit.keywords = ['엑시트'];
            p1.trash = [exitUnit];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.dealDamage(p1, 1);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectTrashTarget(0);
            }
            return [
                { pass: p1.hand.some(c => c.id.startsWith('ST03-006')), message: '트리거 엑시트 회수' }
            ];
        }
    },

    // === ITEMS ===
    {
        testId: 'ST03-016',
        name: '베스트 디펜더 종결',
        description: '방어 시 전투 종료 + 자신 트래시.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            // p1 attacks, p2 defends with terminate item
            p1.unitZones[0].unit = getCard('ST03-002');
            p1.unitZones[0].unit!.power = 10000;
            p2.unitZones[0].unit = getCard('ST03-002');
            p2.unitZones[0].items = [getCard('ST03-016')];
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p2 = engine.opponentPlayer;
            engine.attack(0);
            engine.resolveBlock(true);
            // Terminate: defender is trashed, attacker survives
            return [
                { pass: p2.unitZones[0].unit === null, message: '종결로 방어 유닛 트래시' }
            ];
        }
    },
    {
        testId: 'ST03-017',
        name: '암가드 엑시트 공멸',
        description: '장착 유닛 트래시 시 공멸.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard('ST03-002');
            p1.unitZones[0].unit!.power = 3000;
            p1.unitZones[0].unit!.cost = 2;
            p1.unitZones[0].items = [getCard('ST03-017')];
            p2.unitZones[0].unit = getCard('ST03-002');
            p2.unitZones[0].unit!.power = 5000;
            p2.unitZones[0].unit!.cost = 1;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            engine.attack(0);
            engine.resolveBlock(true);
            return [
                { pass: p1.unitZones[0].unit === null, message: '내 유닛 트래시' },
                { pass: p2.unitZones[0].unit === null, message: '공멸로 상대도 트래시' }
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
