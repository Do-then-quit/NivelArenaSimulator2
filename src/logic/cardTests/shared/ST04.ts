/**
 * ST04 Wave Starter Unified Tests
 */

import { UnifiedTestCase, UnifiedTestModule, Phase } from './types';

const tests: UnifiedTestCase[] = [
    {
        testId: 'ST04-001',
        name: '도로시 리더 각성 + 상대턴 버프',
        description: '레벨 4 각성, 상대 턴에 자신 유닛 +1000.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.leaderLevel = 3;
            p1.levelZone = getCard('ST04-001');
            p1.levelZone.isAwakened = false;
            p1.unitZones[0].unit = getCard('ST04-005');
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.LEVEL_UP;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.nextPhase();
            const basePower = p1.unitZones[0].unit?.power || 0;
            engine.state.turnPlayerIndex = 1;
            const buffedPower = engine.getUnitPower(p1.unitZones[0], p1);
            return [
                { pass: p1.levelZone?.isAwakened === true, message: '리더 각성' },
                { pass: buffedPower === basePower + 1000, message: `상대턴 +1000 (${buffedPower})` }
            ];
        }
    },
    {
        testId: 'ST04-005',
        name: '메어리 엔트리 드로우',
        description: '배치 시 1장 드로우.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 5;
            p1.hand = [getCard('ST04-005')];
            p1.deck = [getCard('ST04-002'), getCard('ST04-004')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const before = p1.hand.length;
            engine.playUnit(0, 0);
            return [
                { pass: p1.hand.length === before, message: `엔트리 드로우 순증 0 (${p1.hand.length})` }
            ];
        }
    },
    {
        testId: 'ST04-006',
        name: '노아 디펜더 +3000 전투 결과',
        description: '방어 시 +3000으로 상대한테 유리한 교환.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.state.turnPlayerIndex = 1;
            engine.state.phase = Phase.ATTACK;
            p1.unitZones[0].unit = getCard('ST04-006');
            p2.unitZones[0].unit = getCard('ST04-004');
            p2.unitZones[0].unit!.power = 4000;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.attack(0);
            engine.resolveBlock(true);
            return [
                { pass: p1.unitZones[0].unit !== null, message: '디펜더 생존' },
                { pass: p2.unitZones[0].unit === null, message: '공격 유닛 트래시' }
            ];
        }
    },
    {
        testId: 'ST04-010',
        name: '헬름 패시브 가디언 +2000',
        description: '가디언 키워드 유닛만 +2000.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('ST04-010');
            p1.unitZones[1].unit = getCard('ST04-003');
            p1.unitZones[2].unit = getCard('ST04-005');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const guardianBase = p1.unitZones[1].unit?.power || 0;
            const normalBase = p1.unitZones[2].unit?.power || 0;
            const guardianPower = engine.getUnitPower(p1.unitZones[1], p1);
            const normalPower = engine.getUnitPower(p1.unitZones[2], p1);
            return [
                { pass: guardianPower === guardianBase + 2000, message: `가디언 +2000 (${guardianPower})` },
                { pass: normalPower === normalBase, message: `비가디언 유지 (${normalPower})` }
            ];
        }
    },
    {
        testId: 'ST04-014',
        name: '너싱 2드로우',
        description: '스킬 사용 시 2장 드로우.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 5;
            p1.hand = [getCard('ST04-014')];
            p1.deck = [getCard('ST04-002'), getCard('ST04-004'), getCard('ST04-009')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playSkill(0);
            return [
                { pass: p1.hand.length === 2, message: `2장 드로우 (${p1.hand.length})` }
            ];
        }
    },
    {
        testId: 'ST04-003',
        name: '마리안 가디언 방벽[1]',
        description: '인접 레인 가디언 블록 시 패 1장 코스트.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.ATTACK;
            p1.unitZones[1].unit = getCard('ST04-004');
            p2.unitZones[0].unit = getCard('ST04-003');
            p2.hand = [getCard('ST04-002')];
        },
        verify: (engine) => {
            const p2 = engine.state.players[1];
            engine.attack(1);
            const blockAction = engine
                .getLegalActions(p2.id)
                .find(a => a.type === 'RESOLVE_BLOCK' && a.shouldBlock && a.blockerZoneIndex === 0) as any;
            if (blockAction) engine.step(blockAction);
            if (engine.state.interactionMode === 'SELECT_COST') {
                engine.selectCostForPlayerId(0, p2.id);
            }
            return [
                { pass: p2.trash.length >= 1, message: '방벽 코스트 지불' }
            ];
        }
    },
    {
        testId: 'ST04-008',
        name: '루드밀라 가디언 방벽[2]',
        description: '인접 레인 가디언 블록 시 패 2장 코스트.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.ATTACK;
            p1.unitZones[1].unit = getCard('ST04-004');
            p2.unitZones[0].unit = getCard('ST04-008');
            p2.hand = [getCard('ST04-002'), getCard('ST04-004')];
        },
        verify: (engine) => {
            const p2 = engine.state.players[1];
            engine.attack(1);
            const blockAction = engine
                .getLegalActions(p2.id)
                .find(a => a.type === 'RESOLVE_BLOCK' && a.shouldBlock && a.blockerZoneIndex === 0) as any;
            if (blockAction) engine.step(blockAction);
            if (engine.state.interactionMode === 'SELECT_COST') {
                engine.selectCostForPlayerId(0, p2.id);
                if (engine.state.interactionMode === 'SELECT_COST') {
                    engine.selectCostForPlayerId(0, p2.id);
                }
            }
            return [
                { pass: p2.trash.length >= 2, message: '방벽 코스트 2장 지불' }
            ];
        }
    },
    {
        testId: 'ST04-011',
        name: '도로시(유닛) 가디언 방벽[3]',
        description: '인접 레인 가디언 블록 시 패 3장 코스트.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.ATTACK;
            p1.unitZones[1].unit = getCard('ST04-004');
            p2.unitZones[0].unit = getCard('ST04-011');
            p2.hand = [getCard('ST04-002'), getCard('ST04-004'), getCard('ST04-005')];
        },
        verify: (engine) => {
            const p2 = engine.state.players[1];
            engine.attack(1);
            const blockAction = engine
                .getLegalActions(p2.id)
                .find(a => a.type === 'RESOLVE_BLOCK' && a.shouldBlock && a.blockerZoneIndex === 0) as any;
            if (blockAction) engine.step(blockAction);
            if (engine.state.interactionMode === 'SELECT_COST') {
                engine.selectCostForPlayerId(0, p2.id);
                if (engine.state.interactionMode === 'SELECT_COST') engine.selectCostForPlayerId(0, p2.id);
                if (engine.state.interactionMode === 'SELECT_COST') engine.selectCostForPlayerId(0, p2.id);
            }
            return [
                { pass: p2.trash.length >= 3, message: '방벽 코스트 3장 지불' }
            ];
        }
    },
    {
        testId: 'ST04-012',
        name: '선배의 응원 가디언 +2000',
        description: '가디언 유닛 1장 선택 +2000(OPP_TURN_END).',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 5;
            p1.hand = [getCard('ST04-012')];
            p1.unitZones[0].unit = getCard('ST04-003');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const before = engine.getUnitPower(p1.unitZones[0], p1);
            engine.playSkill(0);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectTarget(0, false);
            }
            const after = engine.getUnitPower(p1.unitZones[0], p1);
            return [
                { pass: after === before + 2000, message: `+2000 (${after})` }
            ];
        }
    },
    {
        testId: 'ST04-013',
        name: '약오르죠? 가디언 히트+1',
        description: '가디언 유닛 1장 선택, 턴 종료까지 히트+1.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 5;
            p1.hand = [getCard('ST04-013')];
            p1.unitZones[0].unit = getCard('ST04-003');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const before = engine.getUnitHit(p1.unitZones[0], p1);
            engine.playSkill(0);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectTarget(0, false);
            }
            const after = engine.getUnitHit(p1.unitZones[0], p1);
            return [
                { pass: after === before + 1, message: `히트+1 (${after})` }
            ];
        }
    },
    {
        testId: 'ST04-013-Trigger',
        name: '약오르죠? 트리거 1드로우',
        description: '대미지 트리거 시 1드로우 후 셀프 트래시.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.deck = [getCard('ST04-002'), getCard('ST04-013')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.dealDamage(p1, 1);
            return [
                { pass: p1.hand.some(c => c.id.startsWith('ST04-002')), message: '트리거 드로우' },
                { pass: p1.damage.every(c => !c.id.startsWith('ST04-013')), message: '트리거 카드 대미지존 이탈' }
            ];
        }
    },
    {
        testId: 'ST04-007',
        name: '앨리스 돌파[4코 이상]',
        description: '4코 이상 유닛은 방어 불가.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            engine.state.phase = Phase.ATTACK;
            p1.unitZones[0].unit = getCard('ST04-007');
            p2.unitZones[0].unit = getCard('ST04-009');
            p2.unitZones[0].unit!.cost = 5;
            p2.deck = [getCard('ST04-002'), getCard('ST04-004')];
        },
        verify: (engine) => {
            const p2 = engine.opponentPlayer;
            engine.attack(0);
            return [
                { pass: p2.damage.length >= 1, message: '돌파로 직접 대미지' },
                { pass: p2.unitZones[0].unit !== null, message: '방어 미참여 유닛 유지' }
            ];
        }
    },
    {
        testId: 'ST04-007-Trigger',
        name: '앨리스 트리거 패복귀',
        description: '대미지 트리거 시 패로 복귀.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.deck = [getCard('ST04-007')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.dealDamage(p1, 1);
            return [
                { pass: p1.hand.some(c => c.id.startsWith('ST04-007')), message: '패 복귀' }
            ];
        }
    },
    {
        testId: 'ST04-015',
        name: '실낙원 부여 돌파(ALL)',
        description: '가디언 대상에게 완전 돌파 부여.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.leaderLevel = 6;
            p1.hand = [getCard('ST04-015')];
            p1.unitZones[0].unit = getCard('ST04-003');
            p1.unitZones[0].unit!.power = 4000;
            p2.unitZones[0].unit = getCard('ST04-009');
            p2.deck = [getCard('ST04-002'), getCard('ST04-004')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p2 = engine.opponentPlayer;
            engine.playSkill(0);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectTarget(0, false);
            }
            engine.state.phase = Phase.ATTACK;
            engine.attack(0);
            return [
                { pass: p2.damage.length >= 1, message: '부여 돌파로 직접 대미지' }
            ];
        }
    },
    {
        testId: 'ST04-015-Trigger',
        name: '실낙원 트리거 최저코 유닛+아이템 패복귀',
        description: '최저 코스트 상대 유닛과 장착 아이템을 패로 되돌림.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.deck = [getCard('ST04-015')];
            p2.unitZones[0].unit = getCard('ST04-002');
            p2.unitZones[0].unit!.cost = 1;
            p2.unitZones[0].items = [getCard('ST04-016')];
            p2.unitZones[1].unit = getCard('ST04-009');
            p2.unitZones[1].unit!.cost = 5;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            engine.dealDamage(p1, 1);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectTarget(0, true);
            }
            return [
                { pass: p2.unitZones[0].unit === null, message: '최저코 유닛 이탈' },
                { pass: p2.hand.some(c => c.id.startsWith('ST04-016')), message: '장착 아이템 패 복귀' },
                { pass: p2.unitZones[1].unit !== null, message: '고코 유닛 유지' }
            ];
        }
    },
    {
        testId: 'ST04-016',
        name: '케블라 자켓 디펜더 +2000',
        description: '아이템 장착 유닛이 방어 시 +2000.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.state.turnPlayerIndex = 1;
            engine.state.phase = Phase.ATTACK;
            p1.unitZones[0].unit = getCard('ST04-004');
            p1.unitZones[0].unit!.power = 3000;
            p1.unitZones[0].items = [getCard('ST04-016')];
            p2.unitZones[0].unit = getCard('ST04-009');
            p2.unitZones[0].unit!.power = 4500;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.attack(0);
            engine.resolveBlock(true);
            return [
                { pass: p1.unitZones[0].unit !== null, message: '아이템 디펜더 생존' },
                { pass: p2.unitZones[0].unit === null, message: '상대 공격 유닛 트래시' }
            ];
        }
    },
    {
        testId: 'ST04-017',
        name: '레어 메탈 글러브 장착조건 디펜더',
        description: '디펜더 없는 유닛에는 장착 실패.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 5;
            p1.hand = [getCard('ST04-017')];
            p1.unitZones[0].unit = getCard('ST04-005');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playItem(0, 0);
            return [
                { pass: p1.hand.length === 1, message: '장착조건 미충족으로 실패' },
                { pass: p1.unitZones[0].items.length === 0, message: '아이템 미장착' }
            ];
        }
    },
    {
        testId: 'ST04-017-Active',
        name: '레어 메탈 글러브 액티브메인 드로우',
        description: '디펜더 유닛 장착 후 액티브메인으로 1드로우.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 5;
            p1.unitZones[0].unit = getCard('ST04-006');
            p1.unitZones[0].items = [getCard('ST04-017')];
            p1.deck = [getCard('ST04-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const before = p1.hand.length;
            engine.activateEffect(0, 1, 'ITEM', 0);
            return [
                { pass: p1.hand.length === before + 1, message: '아이템 액티브 1드로우' }
            ];
        }
    }
];

export const ST04Module: UnifiedTestModule = {
    packId: 'ST04',
    displayName: 'ST04 파도 스타터',
    tests
};

export default tests;
