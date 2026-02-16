/**
 * ST05 Lightning Starter Unified Tests
 */

import { UnifiedTestCase, UnifiedTestModule, Phase } from './types';

const tests: UnifiedTestCase[] = [
    {
        testId: 'ST05-001',
        name: '프리바티 리더 각성 + 암드 유닛 버프',
        description: '레벨 5 각성 후 암드 유닛 +1000.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.leaderLevel = 4;
            p1.levelZone = getCard('ST05-001');
            p1.levelZone.isAwakened = false;
            p1.unitZones[0].unit = getCard('ST05-005');
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.LEVEL_UP;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.nextPhase();
            const base = p1.unitZones[0].unit?.power || 0;
            const buffed = engine.getUnitPower(p1.unitZones[0], p1);
            return [
                { pass: p1.levelZone?.isAwakened === true, message: '리더 각성' },
                { pass: buffed === base + 1000, message: `암드 유닛 +1000 (${buffed})` }
            ];
        }
    },
    {
        testId: 'ST05-003',
        name: '슈가 엔트리 드로우 후 1버림',
        description: '드로우 1, 손패 1장 트래시.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 5;
            p1.hand = [getCard('ST05-003'), getCard('ST05-002')];
            p1.deck = [getCard('ST05-004'), getCard('ST05-009')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playUnit(0, 0);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectHandTarget(0, false);
            }
            return [
                { pass: p1.hand.length === 1, message: `엔트리 후 손패 1장 (${p1.hand.length})` },
                { pass: p1.trash.length >= 1, message: '손패 트래시 처리' }
            ];
        }
    },
    {
        testId: 'ST05-005',
        name: '맥스웰 암드 +1000',
        description: '아이템 장착 시 +1000.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('ST05-005');
            p1.unitZones[0].items = [];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const base = engine.getUnitPower(p1.unitZones[0], p1);
            p1.unitZones[0].items = [getCard('ST05-015')];
            const actual = engine.getUnitPower(p1.unitZones[0], p1);
            return [
                { pass: actual === base + 2500, message: `장착 후 합계 +2500 (${actual})` }
            ];
        }
    },
    {
        testId: 'ST05-006',
        name: '크라운 엔트리 2코 아이템 서치',
        description: '덱에서 2코 아이템 1장 수동 선택 후 패로.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 5;
            p1.hand = [getCard('ST05-006')];
            p1.deck = [getCard('ST05-015'), getCard('ST05-016')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playUnit(0, 0);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                const index = engine.state.revealedCards.findIndex(card => card.id.startsWith('ST05-016'));
                if (index >= 0) {
                    engine.selectRevealedTarget(index);
                }
            }
            return [
                { pass: p1.hand.some(c => c.id.startsWith('ST05-016')), message: '2코 아이템 서치 성공' }
            ];
        }
    },
    {
        testId: 'ST05-006-Trigger',
        name: '크라운 트리거 1코 이하 아이템 서치',
        description: '대미지 트리거로 1코 이하 아이템 서치 + 셀프 트래시.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.deck = [getCard('ST05-015'), getCard('ST05-006')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.dealDamage(p1, 1);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectRevealedTarget(0);
            }
            return [
                { pass: p1.hand.some(c => c.id.startsWith('ST05-015')), message: '1코 이하 아이템 서치' },
                { pass: p1.damage.every(c => !c.id.startsWith('ST05-006')), message: '트리거 카드 대미지존 이탈' }
            ];
        }
    },
    {
        testId: 'ST05-007',
        name: '소다 장착 아이템 수 비례 +파워',
        description: '아이템 2장 장착 시 +2000.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('ST05-007');
            p1.unitZones[0].items = [getCard('ST05-015')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const oneItemPower = engine.getUnitPower(p1.unitZones[0], p1);
            p1.unitZones[0].items.push(getCard('ST05-017'));
            const twoItemPower = engine.getUnitPower(p1.unitZones[0], p1);
            return [
                { pass: twoItemPower === oneItemPower + 3500, message: `두 번째 장착 증가량 +3500 (${twoItemPower})` }
            ];
        }
    },
    {
        testId: 'ST05-008',
        name: '리타 패시브 암드 유닛 +1000',
        description: '암드 키워드 유닛 전체 +1000.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('ST05-008');
            p1.unitZones[1].unit = getCard('ST05-005');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const base = p1.unitZones[1].unit?.power || 0;
            const actual = engine.getUnitPower(p1.unitZones[1], p1);
            return [
                { pass: actual === base + 1000, message: `암드 대상 +1000 (${actual})` }
            ];
        }
    },
    {
        testId: 'ST05-010',
        name: '센티 암드 +2000',
        description: '아이템 장착 시 +2000.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('ST05-010');
            p1.unitZones[0].items = [];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const base = engine.getUnitPower(p1.unitZones[0], p1);
            p1.unitZones[0].items = [getCard('ST05-015')];
            const actual = engine.getUnitPower(p1.unitZones[0], p1);
            return [
                { pass: actual === base + 3500, message: `장착 후 합계 +3500 (${actual})` }
            ];
        }
    },
    {
        testId: 'ST05-011',
        name: '프리바티 암드 어태커 상대 패버림',
        description: '아이템 장착 공격 시 상대 손패 1장 버림.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard('ST05-011');
            p1.unitZones[0].items = [getCard('ST05-015')];
            p2.hand = [getCard('ST05-002'), getCard('ST05-004')];
            p2.unitZones[0].unit = getCard('ST05-009');
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p2 = engine.opponentPlayer;
            const before = p2.hand.length;
            engine.attack(0);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectHandTarget(0, true);
            }
            return [
                { pass: p2.hand.length === before - 1, message: '어태커 패버림 발동' }
            ];
        }
    },
    {
        testId: 'ST05-011-Trigger',
        name: '프리바티 트리거 패복귀',
        description: '대미지 트리거 시 패로 복귀.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.deck = [getCard('ST05-011')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.dealDamage(p1, 1);
            return [
                { pass: p1.hand.some(c => c.id.startsWith('ST05-011')), message: '패 복귀' }
            ];
        }
    },
    {
        testId: 'ST05-012',
        name: '현장검토 트래시 아이템 회수',
        description: '트래시 아이템 1장 회수.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 5;
            p1.hand = [getCard('ST05-012')];
            p1.trash = [getCard('ST05-015')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playSkill(0);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectTrashTarget(0);
            }
            return [
                { pass: p1.hand.some(c => c.id.startsWith('ST05-015')), message: '아이템 회수' }
            ];
        }
    },
    {
        testId: 'ST05-012-Trigger',
        name: '현장검토 트리거 1코 이하 아이템 서치',
        description: '트리거로 덱에서 1코 이하 아이템 서치.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.deck = [getCard('ST05-015'), getCard('ST05-012')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.dealDamage(p1, 1);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectRevealedTarget(0);
            }
            return [
                { pass: p1.hand.some(c => c.id.startsWith('ST05-015')), message: '1코 이하 아이템 서치' }
            ];
        }
    },
    {
        testId: 'ST05-013',
        name: '리타 부스트 장착 아이템 수만큼 드로우',
        description: '대상 유닛의 1코 이상 아이템 수만큼 드로우.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 10;
            p1.hand = [getCard('ST05-013')];
            p1.deck = [getCard('ST05-002'), getCard('ST05-004'), getCard('ST05-009')];
            p1.unitZones[0].unit = getCard('ST05-002');
            p1.unitZones[0].items = [getCard('ST05-015'), getCard('ST05-017')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playSkill(0);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectTarget(0, false);
            }
            return [
                { pass: p1.hand.length === 2, message: `2드로우 (${p1.hand.length})` }
            ];
        }
    },
    {
        testId: 'ST05-014',
        name: '원 포 올 2장착 유닛 희생 후 상대 트래시',
        description: '2개 이상 장착 유닛 희생 후 상대 유닛 트래시.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.leaderLevel = 10;
            p1.hand = [getCard('ST05-014')];
            p1.unitZones[0].unit = getCard('ST05-002');
            p1.unitZones[0].items = [getCard('ST05-015'), getCard('ST05-017')];
            p2.unitZones[1].unit = getCard('ST05-009');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            engine.playSkill(0);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectTarget(0, false);
            }
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectTarget(1, true);
            }
            return [
                { pass: p1.unitZones[0].unit === null, message: '자신 유닛 희생' },
                { pass: p2.unitZones[1].unit === null, message: '상대 유닛 트래시' }
            ];
        }
    },
    {
        testId: 'ST05-015',
        name: '케블라 게이터 +1500',
        description: '장착 유닛 파워 +1500.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('ST05-002');
            p1.unitZones[0].items = [getCard('ST05-015')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const base = p1.unitZones[0].unit?.power || 0;
            const actual = engine.getUnitPower(p1.unitZones[0], p1);
            return [
                { pass: actual === base + 1500, message: `+1500 (${actual})` }
            ];
        }
    },
    {
        testId: 'ST05-016',
        name: '레어 메탈 건틀렛 장착조건 암드',
        description: '암드 유닛에만 장착 가능, 장착 시 히트+1.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 5;
            p1.hand = [getCard('ST05-016')];
            p1.unitZones[0].unit = getCard('ST05-005');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const beforeHit = engine.getUnitHit(p1.unitZones[0], p1);
            engine.playItem(0, 0);
            const afterHit = engine.getUnitHit(p1.unitZones[0], p1);
            return [
                { pass: p1.unitZones[0].items.length === 1, message: '암드 장착 성공' },
                { pass: afterHit === beforeHit + 1, message: `히트+1 (${afterHit})` }
            ];
        }
    },
    {
        testId: 'ST05-016-EquipFail',
        name: '레어 메탈 건틀렛 비암드 장착 실패',
        description: '암드 키워드 없는 유닛에는 장착 실패.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 5;
            p1.hand = [getCard('ST05-016')];
            p1.unitZones[0].unit = getCard('ST05-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playItem(0, 0);
            return [
                { pass: p1.hand.length === 1, message: '비암드 장착 실패' },
                { pass: p1.unitZones[0].items.length === 0, message: '아이템 미장착' }
            ];
        }
    },
    {
        testId: 'ST05-017',
        name: '레어 메탈 게이터 +2500',
        description: '장착 유닛 파워 +2500.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('ST05-002');
            p1.unitZones[0].items = [getCard('ST05-017')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const base = p1.unitZones[0].unit?.power || 0;
            const actual = engine.getUnitPower(p1.unitZones[0], p1);
            return [
                { pass: actual === base + 2500, message: `+2500 (${actual})` }
            ];
        }
    }
];

export const ST05Module: UnifiedTestModule = {
    packId: 'ST05',
    displayName: 'ST05 번개 스타터',
    tests
};

export default tests;
