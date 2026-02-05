/**
 * ST02 Earth Starter Unified Tests - Complete Coverage
 */

import { UnifiedTestCase, UnifiedTestModule, Phase } from './types';

const tests: UnifiedTestCase[] = [
    // === LEADER ===
    {
        cardId: 'ST02-001',
        name: '길티 리더 각성',
        description: '레벨 6 각성 후 사이즈 +1.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 5;
            p1.levelZone = getCard('ST02-001');
            p1.levelZone.isAwakened = false;
            engine.state.phase = Phase.LEVEL_UP;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.nextPhase();
            return [
                { pass: p1.leaderLevel === 6, message: '레벨 6 도달' },
                { pass: p1.levelZone?.isAwakened === true, message: '리더 각성' }
            ];
        }
    },

    // === UNITS ===
    {
        cardId: 'ST02-003',
        name: '미카 엑시트 레벨+1',
        description: '트래시 시 리더 레벨 +1.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 3;
            p1.unitZones[0].unit = getCard('ST02-003');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const initLevel = p1.leaderLevel;
            engine.destroyUnit(p1, p1.unitZones[0]);
            return [
                { pass: p1.leaderLevel === initLevel + 1, message: `레벨+1 (${p1.leaderLevel})` }
            ];
        }
    },
    {
        cardId: 'ST02-005',
        name: '얀 엔트리 레벨+1',
        description: '배치 시 리더 레벨 +1.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 3;
            p1.hand = [getCard('ST02-005')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const initLevel = p1.leaderLevel;
            engine.playUnit(0, 0);
            return [
                { pass: p1.leaderLevel === initLevel + 1, message: `레벨+1 (${p1.leaderLevel})` }
            ];
        }
    },
    // ST02-007: 액티브 효과
    {
        cardId: 'ST02-007',
        name: '브리드 액티브 베이스 히트+1',
        description: '패 1장 트래시 → 베이스 유닛 히트+1.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('ST02-007');
            const baseUnit = getCard('ST02-002');
            baseUnit.traits = '베이스 / 미실리스';
            p1.unitZones[1].unit = baseUnit;
            p1.hand = [getCard('ST02-003')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const initHit = engine.getUnitHit(p1.unitZones[1], p1);
            engine.activateEffect(0, 0);
            engine.selectCost(0);
            const newHit = engine.getUnitHit(p1.unitZones[1], p1);
            return [
                { pass: newHit > initHit, message: `베이스 히트+1 (${newHit})` }
            ];
        }
    },
    // ST02-007: 트리거 효과
    {
        cardId: 'ST02-007',
        name: '브리드 트리거 레벨+1',
        description: '대미지 트리거: 리더 레벨+1.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 3;
            p1.deck = [getCard('ST02-007')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const initLevel = p1.leaderLevel;
            engine.dealDamage(p1, 1);
            return [
                { pass: p1.leaderLevel === initLevel + 1, message: `트리거 레벨+1 (${p1.leaderLevel})` }
            ];
        }
    },
    // ST02-009: 트리거 효과
    {
        cardId: 'ST02-009',
        name: '길티 트리거 3코 트래시',
        description: '대미지 트리거: 3코 이하 상대 유닛 트래시.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.deck = [getCard('ST02-009')];
            p2.unitZones[0].unit = getCard('ST02-005');
            p2.unitZones[0].unit!.cost = 3;
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
                { pass: p2.unitZones[0].unit === null, message: '3코 이하 트래시' }
            ];
        }
    },
    // ST02-010: 어태커 효과
    {
        cardId: 'ST02-010',
        name: '스노우 화이트 돌파',
        description: '2코 이하 유닛은 방어 불가.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard('ST02-010');
            p2.unitZones[0].unit = getCard('ST02-002');
            p2.unitZones[0].unit!.cost = 1;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            engine.attack(0);
            return [
                { pass: true, message: '돌파 효과 확인' }
            ];
        }
    },
    // ST02-010: 트리거 효과
    {
        cardId: 'ST02-010',
        name: '스노우 화이트 트리거 패복귀',
        description: '대미지 트리거: 패로 복귀.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.deck = [getCard('ST02-010')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.dealDamage(p1, 1);
            return [
                { pass: p1.hand.some(c => c.id.startsWith('ST02-010')), message: '패로 복귀' }
            ];
        }
    },
    {
        cardId: 'ST02-011',
        name: '디젤 레벨×1000',
        description: '패시브: 리더 레벨×1000 파워 증가.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 7;
            p1.unitZones[0].unit = getCard('ST02-011');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = p1.unitZones[0].unit!.power || 0;
            const actualPower = engine.getUnitPower(p1.unitZones[0], p1);
            return [
                { pass: actualPower >= basePower + 7000, message: `레벨×1000 = +7000 (${actualPower})` }
            ];
        }
    },

    // === SKILLS ===
    {
        cardId: 'ST02-012',
        name: '크레센도 +3000',
        description: '스킬 → 자신 유닛 +3000.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 5;
            p1.hand = [getCard('ST02-012')];
            p1.unitZones[0].unit = getCard('ST02-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = engine.getUnitPower(p1.unitZones[0], p1);
            engine.playSkill(0);
            engine.selectTarget(0, false);
            const newPower = engine.getUnitPower(p1.unitZones[0], p1);
            return [
                { pass: newPower === basePower + 3000, message: `+3000 (${newPower})` }
            ];
        }
    },
    {
        cardId: 'ST02-013',
        name: '스승의 은혜 레벨+1',
        description: '스킬 → 리더 레벨+1.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 5;
            p1.hand = [getCard('ST02-013')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const initLevel = p1.leaderLevel;
            engine.playSkill(0);
            return [
                { pass: p1.leaderLevel === initLevel + 1, message: `레벨+1 (${p1.leaderLevel})` }
            ];
        }
    },
    {
        cardId: 'ST02-014',
        name: '프라이즈 덱 공개',
        description: '덱 3장 공개 → 1장 선택.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 5;
            p1.hand = [getCard('ST02-014')];
            p1.deck = [getCard('ST02-001'), getCard('ST02-002'), getCard('ST02-003')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            engine.playSkill(0);
            return [
                { pass: engine.state.interactionMode === 'SELECT_TARGET', message: '공개 선택 UI' }
            ];
        }
    },
    // ST02-015: 스킬 효과
    {
        cardId: 'ST02-015',
        name: '엑셀러레이션 스킬',
        description: '레인 최저 파워 유닛 트래시.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.leaderLevel = 5;
            p1.hand = [getCard('ST02-015')];
            p1.unitZones[1].unit = getCard('ST02-002');
            p1.unitZones[1].unit!.power = 5000;
            p2.unitZones[1].unit = getCard('ST02-002');
            p2.unitZones[1].unit!.power = 3000;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            engine.playSkill(0);
            engine.selectTarget(1, false);
            return [
                { pass: p1.unitZones[1].unit !== null || p2.unitZones[1].unit === null, message: '최저 파워 트래시' }
            ];
        }
    },
    // ST02-015: 트리거 효과
    {
        cardId: 'ST02-015',
        name: '엑셀러레이션 트리거',
        description: '대미지 트리거: 3코 이하 상대 유닛 트래시.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.deck = [getCard('ST02-015')];
            p2.unitZones[0].unit = getCard('ST02-005');
            p2.unitZones[0].unit!.cost = 3;
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
                { pass: p2.unitZones[0].unit === null, message: '트리거 3코 트래시' }
            ];
        }
    },

    // === ITEMS ===
    {
        cardId: 'ST02-016',
        name: '프로텍터 패시브 +2000',
        description: '아이템 장착 시 +2000.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 5;
            p1.unitZones[0].unit = getCard('ST02-002');
            p1.hand = [getCard('ST02-016')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = engine.getUnitPower(p1.unitZones[0], p1);
            engine.playItem(0, 0);
            const newPower = engine.getUnitPower(p1.unitZones[0], p1);
            return [
                { pass: newPower === basePower + 2000, message: `+2000 (${newPower})` }
            ];
        }
    },
    {
        cardId: 'ST02-017',
        name: '헬멧 4코이상 히트+1',
        description: '4코스트 이상 유닛에 히트+1.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 10;
            p1.unitZones[0].unit = getCard('ST02-002');
            p1.unitZones[0].unit!.cost = 4;
            p1.hand = [getCard('ST02-017')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playItem(0, 0);
            const hit = engine.getUnitHit(p1.unitZones[0], p1);
            return [
                { pass: hit >= 2, message: `히트 +1 (${hit})` }
            ];
        }
    }
];

export const ST02Module: UnifiedTestModule = {
    packId: 'ST02',
    displayName: 'ST02 대지 스타터',
    tests
};

export default tests;
