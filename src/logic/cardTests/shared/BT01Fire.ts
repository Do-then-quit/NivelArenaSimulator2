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
        name: '레드 후드 각성 + 어태커 버프',
        description: '레벨 5에서 레벨업 시 각성. Next Phase 버튼 클릭. 각성 후 어태커 유닛 +2000 파워 확인.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 5;
            p1.levelZone = getCard('BT01-001');
            p1.levelZone.isAwakened = false;
            p1.unitZones[0].unit = getCard('BT01-002');
            p1.unitZones[1].unit = getCard('ST01-002');
            engine.state.phase = Phase.LEVEL_UP;
        },
        verify: (engine) => {
            engine.nextPhase();
            const p1 = engine.currentPlayer;
            const attackerPower = engine.getUnitPower(p1.unitZones[0], p1);
            const attackerBase = p1.unitZones[0].unit!.power || 0;
            const normalPower = engine.getUnitPower(p1.unitZones[1], p1);
            const normalBase = p1.unitZones[1].unit!.power || 0;
            return [
                { pass: p1.leaderLevel === 6, message: '레벨 6 도달' },
                { pass: p1.levelZone?.isAwakened === true, message: '리더 각성됨' },

                { pass: attackerPower >= attackerBase + 2000, message: `어태커 +2000 (${attackerPower})` },
                { pass: normalPower === normalBase, message: `비어태커 버프 없음 (${normalPower})` }
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
        cardId: 'BT01-008',
        name: '관통 유닛 +1500',
        description: '패시브: 관통 유닛 파워 +1500.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT01-008');
            p1.unitZones[1].unit = getCard('BT01-004');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = p1.unitZones[1].unit!.power || 0;
            const actualPower = engine.getUnitPower(p1.unitZones[1], p1);
            return [
                { pass: actualPower >= basePower + 1500, message: `관통 유닛 +1500 (${actualPower})` }
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
    {
        cardId: 'BT01-017',
        name: '엔트리: 조우 유닛 파워 1000',
        description: '배치 시 조우 유닛 파워를 1000으로 설정.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.leaderLevel = 7;
            p1.hand = [getCard('BT01-017')];
            const oppUnit = getCard('ST01-002');
            oppUnit.power = 7000;
            p2.unitZones[0].unit = oppUnit;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p2 = engine.opponentPlayer;
            engine.playUnit(0, 0);
            const newPower = engine.getUnitPower(p2.unitZones[0], p2);
            return [
                { pass: newPower === 1000, message: `파워 1000 (${newPower})` }
            ];
        }
    },
    {
        cardId: 'BT01-019',
        name: '엔트리: 관통 부여',
        description: '배치 시 자신 유닛 전체에 관통 부여.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 9;
            const p2 = engine.opponentPlayer;
            p1.hand = [getCard('BT01-019')];
            p1.unitZones[1].unit = getCard('ST01-002');
            p1.unitZones[1].unit!.power = 5000;
            p2.unitZones[1].unit = getCard('ST01-002');
            p2.unitZones[1].unit!.power = 1000;
            p2.deck = [getCard('ST01-002'), getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p2 = engine.opponentPlayer;
            engine.playUnit(0, 0);
            const initDamage = p2.damage.length;
            engine.state.phase = Phase.ATTACK;
            engine.attack(1);
            engine.resolveBlock(true);
            return [
                { pass: p2.damage.length > initDamage, message: `관통 대미지 (${p2.damage.length})` }
            ];
        }
    },

    // === SKILLS ===
    {
        cardId: 'BT01-020',
        name: '관통 부여',
        description: '스킬 사용 → 어태커 유닛에 관통 부여.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.leaderLevel = 10;
            p1.unitZones[0].unit = getCard('BT01-002');
            p1.unitZones[0].unit!.power = 5000;
            p1.hand = [getCard('BT01-020')];
            p2.unitZones[0].unit = getCard('ST01-002');
            p2.unitZones[0].unit!.power = 3000;
            p2.deck = [getCard('ST01-002'), getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p2 = engine.opponentPlayer;
            engine.playSkill(0);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectTarget(0, false);
            }
            const initDamage = p2.damage.length;
            engine.state.phase = Phase.ATTACK;
            engine.attack(0);
            engine.resolveBlock(true);
            return [
                { pass: p2.damage.length > initDamage, message: `관통 대미지 (${p2.damage.length})` }
            ];
        }
    },
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

    {
        cardId: 'BT01-023',
        name: '어태커 +2500',
        description: '스킬 사용 → 어태커 유닛 +2500.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 10;
            p1.unitZones[0].unit = getCard('BT01-002');
            p1.hand = [getCard('BT01-023')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = engine.getUnitPower(p1.unitZones[0], p1);
            engine.playSkill(0);
            const newPower = engine.getUnitPower(p1.unitZones[0], p1);
            return [
                { pass: newPower === basePower + 2500, message: `어태커 +2500 (${newPower})` }
            ];
        }
    },
    {
        cardId: 'BT01-025',
        name: '어태커 회수',
        description: '스킬 사용 → 트래시 어태커 유닛 1장 패로.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 10;
            p1.trash = [getCard('BT01-002')];
            p1.hand = [getCard('BT01-025')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playSkill(0);
            engine.selectTrashTarget(0);
            return [
                { pass: p1.hand.some(c => c.id === 'BT01-002'), message: '어태커 회수됨' }
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
    },
    {
        cardId: 'BT01-027',
        name: '아이템 +2000, 약탈[1]',
        description: '장착 유닛 공격 시 +2000, 유닛 트래시 시 드로우.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.leaderLevel = 5;
            p1.unitZones[0].unit = getCard('ST01-002');
            p1.unitZones[0].unit!.power = 5000;
            p1.unitZones[0].items = [getCard('BT01-027')];
            p2.unitZones[0].unit = getCard('ST01-002');
            p2.unitZones[0].unit!.power = 3000;
            p1.deck = [getCard('ST01-002'), getCard('ST01-002')];
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = p1.unitZones[0].unit!.power || 0;
            const initHand = p1.hand.length;
            engine.attack(0);
            engine.resolveBlock(true);
            const attackPower = engine.getUnitPower(p1.unitZones[0], p1);
            return [
                { pass: attackPower >= basePower + 2000, message: `+2000 (${attackPower})` },
                { pass: p1.hand.length >= initHand + 1, message: `약탈 드로우 (${p1.hand.length})` }
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
