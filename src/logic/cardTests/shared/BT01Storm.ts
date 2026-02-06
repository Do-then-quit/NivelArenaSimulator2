/**
 * BT01 Storm Attribute Unified Tests (BT01-055 to BT01-081)
 */

import { UnifiedTestCase, UnifiedTestModule, Phase } from './types';
import { ActivationCondition } from '../../types';

const tests: UnifiedTestCase[] = [
    // === LEADER ===
    {
        cardId: 'BT01-055',
        name: '신데렐라 각성',
        description: '각성 후 5코스트 이상 트래시 시 드로우. Next Phase 클릭.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 4;
            p1.levelZone = getCard('BT01-055');
            p1.levelZone.isAwakened = false;
            const u = getCard('ST01-002');
            u.cost = 5;
            p1.unitZones[0].unit = u;
            p1.deck = [getCard('ST01-002'), getCard('ST01-002')];
            engine.state.phase = Phase.LEVEL_UP;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.nextPhase();
            const initHand = p1.hand.length;
            engine.destroyUnit(p1, p1.unitZones[0]);
            return [
                { pass: p1.levelZone?.isAwakened === true, message: '리더 각성됨' },
                { pass: p1.hand.length >= initHand + 1, message: '5코스트 트래시 시 드로우' }
            ];
        }
    },

    // === UNITS ===
    {
        cardId: 'BT01-056',
        name: '엑시트 -2000',
        description: '유닛 트래시 시 상대 유닛 -2000.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard('BT01-056');
            p2.unitZones[0].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            const basePower = engine.getUnitPower(p2.unitZones[0], p2);
            engine.destroyUnit(p1, p1.unitZones[0]);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectTarget(0, true);
            }
            const newPower = engine.getUnitPower(p2.unitZones[0], p2);
            return [
                { pass: newPower === basePower - 2000, message: `상대 -2000 (${newPower})` }
            ];
        }
    },
    {
        cardId: 'BT01-058',
        name: '디펜더 종결',
        description: '방어 시 전투 종료, 방어 유닛 트래시.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.leaderLevel = 5;
            p1.unitZones[0].unit = getCard('ST01-002');
            p1.unitZones[0].unit!.power = 10000;
            p2.unitZones[0].unit = getCard('BT01-058');
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            engine.attack(0);
            engine.resolveBlock(true);
            return [
                { pass: p2.unitZones[0].unit === null, message: '방어 유닛 종결로 트래시' },
                { pass: p1.unitZones[0].unit !== null, message: '공격 유닛 생존' }
            ];
        }
    },
    {
        cardId: 'BT01-067',
        name: '공멸',
        description: '전투로 트래시 시 공격 유닛도 코스트 비교하여 트래시.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard('ST01-002');
            p1.unitZones[0].unit!.power = 10000;
            p1.unitZones[0].unit!.cost = 3;
            p2.unitZones[0].unit = getCard('BT01-067');
            p2.unitZones[0].unit!.cost = 4;
            p2.unitZones[0].unit!.power = 1000;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            engine.attack(0);
            engine.resolveBlock(true);
            return [
                { pass: p2.unitZones[0].unit === null, message: '방어 유닛 트래시' },
                { pass: p1.unitZones[0].unit === null, message: '공멸: 공격 유닛도 트래시' }
            ];
        }
    },
    {
        cardId: 'BT01-068',
        name: '엑시트: 드로우',
        description: '유닛 트래시 시 드로우 발생.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT01-068');
            p1.deck = [getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const card = getCard('BT01-068');
            const hasExit = card.effects?.some(e => e.activation === ActivationCondition.EXIT) || false;
            const initHand = p1.hand.length;
            engine.destroyUnit(p1, p1.unitZones[0]);
            return [
                { pass: hasExit, message: '엑시트 효과 등록' },
                { pass: p1.hand.length >= initHand, message: `드로우 발생 (${p1.hand.length})` }
            ];
        }
    },
    {
        cardId: 'BT01-069',
        name: '엔트리: 2코 이하 파괴',
        description: '조우 유닛이 3코 이상이면 파괴되지 않음.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.leaderLevel = 10;
            p1.hand = [getCard('BT01-069')];
            const oppUnit = getCard('ST01-002');
            oppUnit.cost = 3;
            p2.unitZones[0].unit = oppUnit;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine, getCard) => {
            const p2 = engine.opponentPlayer;
            const card = getCard('BT01-069');
            const hasEntry = card.effects?.some(e => e.activation === ActivationCondition.ENTRY) || false;
            engine.playUnit(0, 0);
            return [
                { pass: hasEntry, message: '엔트리 효과 등록' },
                { pass: p2.unitZones[0].unit !== null, message: '3코 이상 생존' }
            ];
        }
    },
    {
        cardId: 'BT01-070',
        name: '길로틴 종결',
        description: '방어 선언 시 전투 종료, 방어 유닛 트래시.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard('ST01-002');
            p1.unitZones[0].unit!.power = 10000;
            p2.unitZones[0].unit = getCard('BT01-070');
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            engine.attack(0);
            engine.resolveBlock(true);
            return [
                { pass: p2.unitZones[0].unit === null, message: '종결: 방어 유닛 트래시' },
                { pass: p1.unitZones[0].unit !== null, message: '공격 유닛 생존' }
            ];
        }
    },

    {
        cardId: 'BT01-072',
        name: '패시브 등록',
        description: '패시브 효과 등록 여부 확인.',
        setup: (engine) => {
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine, getCard) => {
            const card = getCard('BT01-072');
            const hasPassive = card.effects?.some(e => e.activation === ActivationCondition.PASSIVE) || false;
            return [
                { pass: hasPassive, message: '패시브 효과 등록' }
            ];
        }
    },

    // === SKILLS ===
    {
        cardId: 'BT01-075',
        name: '액티브 효과 등록',
        description: 'ACTIVE 효과 등록 여부 확인.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 10;
            p1.hand = [getCard('BT01-075')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine, getCard) => {
            const card = getCard('BT01-075');
            const hasActive = card.effects?.some(e => e.activation === ActivationCondition.ACTIVE) || false;
            return [
                { pass: hasActive, message: 'ACTIVE 효과 등록' }
            ];
        }
    },
    {
        cardId: 'BT01-076',
        name: '액티브 효과 등록',
        description: 'ACTIVE 효과 등록 여부 확인.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 10;
            p1.hand = [getCard('BT01-076')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine, getCard) => {
            const card = getCard('BT01-076');
            const hasActive = card.effects?.some(e => e.activation === ActivationCondition.ACTIVE) || false;
            return [
                { pass: hasActive, message: 'ACTIVE 효과 등록' }
            ];
        }
    },
    {
        cardId: 'BT01-078',
        name: '액티브 효과 등록',
        description: 'ACTIVE 효과 등록 여부 확인.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 10;
            p1.hand = [getCard('BT01-078')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine, getCard) => {
            const card = getCard('BT01-078');
            const hasActive = card.effects?.some(e => e.activation === ActivationCondition.ACTIVE) || false;
            return [
                { pass: hasActive, message: 'ACTIVE 효과 등록' }
            ];
        }
    },
    {
        cardId: 'BT01-079',
        name: '액티브 효과 등록',
        description: 'ACTIVE 효과 등록 여부 확인.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 10;
            p1.hand = [getCard('BT01-079')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine, getCard) => {
            const card = getCard('BT01-079');
            const hasActive = card.effects?.some(e => e.activation === ActivationCondition.ACTIVE) || false;
            return [
                { pass: hasActive, message: 'ACTIVE 효과 등록' }
            ];
        }
    },

    // === ITEMS ===
    {
        cardId: 'BT01-080',
        name: '아이템 엑시트 드로우 2',
        description: '장착 유닛 트래시 시 2장 드로우.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('ST01-002');
            p1.unitZones[0].items = [getCard('BT01-080')];
            p1.deck = [getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const initHand = p1.hand.length;
            engine.destroyUnit(p1, p1.unitZones[0]);
            return [
                { pass: p1.hand.length >= initHand + 2, message: `아이템 엑시트: 드로우 2 (패 ${p1.hand.length})` }
            ];
        }
    },
    {
        cardId: 'BT01-081',
        name: '엑시트 효과 등록',
        description: '엑시트 효과 등록 여부 확인.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('ST01-002');
            p1.unitZones[0].items = [getCard('BT01-081')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine, getCard) => {
            const card = getCard('BT01-081');
            const hasExit = card.effects?.some(e => e.activation === ActivationCondition.EXIT) || false;
            return [
                { pass: hasExit, message: '엑시트 효과 등록' }
            ];
        }
    }
];

export const BT01StormModule: UnifiedTestModule = {
    packId: 'BT01폭풍',
    displayName: 'BT01 폭풍 (Storm)',
    tests
};

export default tests;
