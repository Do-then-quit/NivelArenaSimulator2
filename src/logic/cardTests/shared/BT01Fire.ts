/**
 * BT01 Fire Attribute Unified Tests (BT01-001 to BT01-027)
 * 
 * These tests can be run by both vitest and CardTester UI.
 */

import { UnifiedTestCase, UnifiedTestModule, Phase } from './types';

const tests: UnifiedTestCase[] = [
    // === LEADER ===
    {
        testId: 'BT01-001 Awaken',
        name: '레드 후드 각성',
        description: '레벨업 시 각성(레벨 6) 확인.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 5;
            p1.levelZone = getCard('BT01-001');
            p1.levelZone.isAwakened = false;
            engine.state.phase = Phase.LEVEL_UP;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.nextPhase();
            return [
                { pass: p1.leaderLevel === 6, message: '레벨 6 도달' },
                { pass: p1.levelZone?.isAwakened === true, message: '리더 각성됨' }
            ];
        }
    },
    {
        testId: 'BT01-001 Passive',
        name: '레드 후드 각성면 패시브',
        description: '각성면 패시브: 아군 어태커 유닛 +2000.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 6;
            p1.levelZone = getCard('BT01-001');
            p1.levelZone.isAwakened = true;
            p1.unitZones[0].unit = getCard('BT01-002');
            p1.unitZones[1].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const attackerPower = engine.getUnitPower(p1.unitZones[0], p1);
            const attackerBase = p1.unitZones[0].unit!.power || 0;
            const normalPower = engine.getUnitPower(p1.unitZones[1], p1);
            const normalBase = p1.unitZones[1].unit!.power || 0;
            return [
                { pass: attackerPower >= attackerBase + 2000, message: `어태커 +2000 (${attackerPower})` },
                { pass: normalPower === normalBase, message: `비어태커 버프 없음 (${normalPower})` }
            ];
        }
    },


    // === UNITS ===
    {
        testId: 'BT01-002',
        name: '어태커 +2000',
        description: '공격 시 파워 +2000. Attack 버튼으로 공격.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard('BT01-002');
            p2.unitZones[0].unit = getCard('ST01-002');
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
        testId: 'BT01-004',
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
        testId: 'BT01-005',
        name: '광전사',
        description: '광전사(강제 공격) 패시브 효과 등록 확인.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT01-005');
            engine.state.phase = Phase.MAIN;
        },
        verify: (_engine, getCard) => {
            const card = getCard('BT01-005');
            const hasBerserk = card.effects?.some(e => e.action?.params?.keyword === 'BERSERK') || false;
            return [
                { pass: hasBerserk, message: '광전사 효과 등록' }
            ];
        }
    },
    {
        testId: 'BT01-006 AttackerPower',
        name: '아니스: 어태커 +2000',
        description: '어태커 효과로 공격 시 +2000.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard('BT01-006');
            p2.unitZones[0].unit = getCard('ST01-002');
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
        testId: 'BT01-006 AttackerPlunder',
        name: '아니스: 약탈[1]',
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
        testId: 'BT01-006 TriggerTrashSelf',
        name: '아니스 트리거: 자기 자신 트래시',
        description: '대미지 트리거 발동 시 이 카드가 damage zone에서 트래시로 이동.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.deck = [getCard('ST01-002'), getCard('BT01-006')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.dealDamage(p1, 1);
            return [
                { pass: p1.trash.some(c => c.id === 'BT01-006'), message: 'BT01-006 트래시 이동' },
                { pass: p1.damage.every(c => c.id !== 'BT01-006'), message: 'damage zone에서 제거됨' }
            ];
        }
    },
    {
        testId: 'BT01-006 TriggerMinus5000',
        name: '아니스 트리거: 상대 유닛 -5000',
        description: '트리거로 상대 유닛 1체를 선택해 -5000.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.deck = [getCard('ST01-002'), getCard('BT01-006')];
            p2.unitZones[0].unit = getCard('ST01-002');
            p2.unitZones[0].unit!.power = 7000;
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
                { pass: newPower === basePower - 5000, message: `상대 -5000 (${newPower})` }
            ];
        }
    },
    {
        testId: 'BT01-008',
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
        testId: 'BT01-009',
        name: '어태커 +1000',
        description: '공격 시 파워 +1000.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard('BT01-009');
            p2.unitZones[0].unit = getCard('ST01-002');
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = p1.unitZones[0].unit!.power || 0;
            engine.attack(0);
            const attackPower = engine.getUnitPower(p1.unitZones[0], p1);
            return [
                { pass: attackPower >= basePower + 1000, message: `어태커 +1000 (${attackPower})` }
            ];
        }
    },
    {
        testId: 'BT01-011',
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
        testId: 'BT01-012',
        name: '엔트리: 아군에 어태커 +1000 부여',
        description: '배치 후 아군 유닛 공격 시 +1000 적용 확인.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.leaderLevel = 5;
            p1.hand = [getCard('BT01-012')];
            p1.unitZones[1].unit = getCard('ST01-002');
            p2.unitZones[1].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = p1.unitZones[1].unit!.power || 0;
            engine.playUnit(0, 0);
            engine.state.phase = Phase.ATTACK;
            engine.attack(1);
            const attackPower = engine.getUnitPower(p1.unitZones[1], p1);
            return [
                { pass: attackPower >= basePower + 1000, message: `부여 효과 +1000 (${attackPower})` }
            ];
        }
    },
    {
        testId: 'BT01-013',
        name: '어태커 +1000',
        description: '공격 시 파워 +1000.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard('BT01-013');
            p2.unitZones[0].unit = getCard('ST01-002');
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = p1.unitZones[0].unit!.power || 0;
            engine.attack(0);
            const attackPower = engine.getUnitPower(p1.unitZones[0], p1);
            return [
                { pass: attackPower >= basePower + 1000, message: `어태커 +1000 (${attackPower})` }
            ];
        }
    },
    {
        testId: 'BT01-014 Passive',
        name: '홍련: 광전사 패시브',
        description: '광전사 패시브 효과 등록 확인.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT01-014');
            engine.state.phase = Phase.MAIN;
        },
        verify: (_engine, getCard) => {
            const card = getCard('BT01-014');
            const hasBerserk = card.effects?.some(e => e.action?.params?.keyword === 'BERSERK') || false;
            return [
                { pass: hasBerserk, message: '광전사 효과 등록' }
            ];
        }
    },
    {
        testId: 'BT01-014 TriggerTrashSelf',
        name: '홍련 트리거: 자기 자신 트래시',
        description: '대미지 트리거 발동 시 이 카드가 damage zone에서 트래시로 이동.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.deck = [getCard('ST01-002'), getCard('BT01-014')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.dealDamage(p1, 1);
            return [
                { pass: p1.trash.some(c => c.id === 'BT01-014'), message: 'BT01-014 트래시 이동' },
                { pass: p1.damage.every(c => c.id !== 'BT01-014'), message: 'damage zone에서 제거됨' }
            ];
        }
    },
    {
        testId: 'BT01-014 TriggerRecover',
        name: '홍련 트리거: 2코 이하 유닛 회수',
        description: '트리거로 트래시의 2코 이하 유닛 1장 회수.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.trash = [getCard('ST01-002')];
            p1.deck = [getCard('ST01-002'), getCard('BT01-014')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const handBefore = p1.hand.length;
            engine.dealDamage(p1, 1);
            const recoverIdx = p1.trash.findIndex(c => c.id === 'ST01-002');
            if (engine.state.interactionMode === 'SELECT_TARGET' && recoverIdx >= 0) {
                engine.selectTrashTarget(recoverIdx);
            }
            return [
                { pass: p1.hand.length >= handBefore + 1, message: `트래시 유닛 회수 (${p1.hand.length})` }
            ];
        }
    },
    {
        testId: 'BT01-015',
        name: '엔트리: 조우 유닛 -4000',
        description: '배치 시 조우 유닛 파워 -4000.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.leaderLevel = 6;
            p1.hand = [getCard('BT01-015')];
            p2.unitZones[0].unit = getCard('ST01-002');
            p2.unitZones[0].unit!.power = 7000;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p2 = engine.opponentPlayer;
            const basePower = engine.getUnitPower(p2.unitZones[0], p2);
            engine.playUnit(0, 0);
            const newPower = engine.getUnitPower(p2.unitZones[0], p2);
            return [
                { pass: newPower === basePower - 4000, message: `조우 -4000 (${newPower})` }
            ];
        }
    },
    {
        testId: 'BT01-016',
        name: '어태커 +2000',
        description: '공격 시 파워 +2000.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard('BT01-016');
            p2.unitZones[0].unit = getCard('ST01-002');
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
        testId: 'BT01-017',
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
        testId: 'BT01-018',
        name: '패시브: 어태커 유닛 +2000',
        description: '필드의 아군 어태커 유닛 전체 +2000.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT01-018');
            p1.unitZones[1].unit = getCard('BT01-004');
            p1.unitZones[2].unit = getCard('BT01-003');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const attackerBase = p1.unitZones[1].unit!.power || 0;
            const normalBase = p1.unitZones[2].unit!.power || 0;
            const attackerPower = engine.getUnitPower(p1.unitZones[1], p1);
            const normalPower = engine.getUnitPower(p1.unitZones[2], p1);
            return [
                { pass: attackerPower >= attackerBase + 2000, message: `어태커 +2000 (${attackerPower})` },
                { pass: normalPower === normalBase, message: `비어태커 버프 없음 (${normalPower})` }
            ];
        }
    },
    {
        testId: 'BT01-019 EntryPenetration',
        name: '레드 후드 엔트리: 관통 부여',
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
    {
        testId: 'BT01-019 TriggerReturnHand',
        name: '레드 후드 트리거: 패 복귀',
        description: '대미지 트리거 발동 시 이 카드가 패로 돌아온다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.deck = [getCard('ST01-002'), getCard('BT01-019')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.dealDamage(p1, 1);
            return [
                { pass: p1.hand.some(c => c.id === 'BT01-019'), message: 'BT01-019 패 복귀' },
                { pass: p1.damage.every(c => c.id !== 'BT01-019'), message: 'damage zone에서 제거됨' }
            ];
        }
    },

    // === SKILLS ===
    {
        testId: 'BT01-020',
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
        testId: 'BT01-021',
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
        testId: 'BT01-022',
        name: '상대 2체 -2000',
        description: '스킬 사용 후 상대 유닛 최대 2장 선택해 -2000.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.leaderLevel = 10;
            p1.hand = [getCard('BT01-022')];
            p2.unitZones[0].unit = getCard('ST01-002');
            p2.unitZones[1].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p2 = engine.opponentPlayer;
            const base0 = engine.getUnitPower(p2.unitZones[0], p2);
            const base1 = engine.getUnitPower(p2.unitZones[1], p2);
            engine.playSkill(0);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectTarget(0, true);
                engine.selectTarget(1, true);
                engine.confirmTargets();
            }
            const new0 = engine.getUnitPower(p2.unitZones[0], p2);
            const new1 = engine.getUnitPower(p2.unitZones[1], p2);
            return [
                { pass: new0 === base0 - 2000, message: `유닛0 -2000 (${new0})` },
                { pass: new1 === base1 - 2000, message: `유닛1 -2000 (${new1})` }
            ];
        }
    },

    {
        testId: 'BT01-023',
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
        testId: 'BT01-024',
        name: '-3000 후 트래시 시 1드로우',
        description: '스킬로 상대 1체 -3000, 트래시되면 1드로우.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.leaderLevel = 10;
            p1.hand = [getCard('BT01-024')];
            p1.deck = [getCard('ST01-002'), getCard('ST01-002')];
            p2.unitZones[0].unit = getCard('ST01-002');
            p2.unitZones[0].unit!.power = 3000;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            const handBefore = p1.hand.length;
            const deckBefore = p1.deck.length;
            engine.playSkill(0);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectTarget(0, true);
            }
            return [
                { pass: p2.unitZones[0].unit === null, message: '대상 유닛 트래시' },
                { pass: p1.deck.length === deckBefore - 1, message: `드로우 발생 (덱 ${p1.deck.length})` },
                { pass: p1.hand.length === handBefore, message: `패 수 복구 (${p1.hand.length})` }
            ];
        }
    },
    {
        testId: 'BT01-025',
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
        testId: 'BT01-026 AttackerPenetration',
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
        testId: 'BT01-026 TriggerReturnHand',
        name: '아이템 트리거: 패 복귀',
        description: '대미지 트리거 발동 시 이 카드가 패로 돌아온다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.deck = [getCard('ST01-002'), getCard('BT01-026')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.dealDamage(p1, 1);
            return [
                { pass: p1.hand.some(c => c.id === 'BT01-026'), message: 'BT01-026 패 복귀' },
                { pass: p1.damage.every(c => c.id !== 'BT01-026'), message: 'damage zone에서 제거됨' }
            ];
        }
    },
    {
        testId: 'BT01-027 AttackerPower',
        name: '아이템: 어태커 +2000',
        description: '장착 유닛 공격 시 +2000.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.leaderLevel = 5;
            p1.unitZones[0].unit = getCard('ST01-002');
            p1.unitZones[0].unit!.power = 5000;
            p1.unitZones[0].items = [getCard('BT01-027')];
            p2.unitZones[0].unit = getCard('ST01-002');
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = p1.unitZones[0].unit!.power || 0;
            engine.attack(0);
            const attackPower = engine.getUnitPower(p1.unitZones[0], p1);
            return [
                { pass: attackPower >= basePower + 2000, message: `+2000 (${attackPower})` }
            ];
        }
    },
    {
        testId: 'BT01-027 AttackerPlunder',
        name: '아이템: 약탈[1]',
        description: '장착 유닛이 상대 유닛 트래시 시 드로우 1.',
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
            const initHand = p1.hand.length;
            engine.attack(0);
            engine.resolveBlock(true);
            return [
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
