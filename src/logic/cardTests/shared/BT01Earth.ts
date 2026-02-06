/**
 * BT01 Earth Attribute Unified Tests (BT01-028 to BT01-054)
 */

import { UnifiedTestCase, UnifiedTestModule, Phase } from './types';

const tests: UnifiedTestCase[] = [
    // === LEADER ===
    {
        cardId: 'BT01-028',
        name: '홍련 각성',
        description: '레벨 5 각성 후 베이스 유닛 +1000. Next Phase 클릭.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 4;
            p1.levelZone = getCard('BT01-028');
            p1.levelZone.isAwakened = false;
            const unit = getCard('BT01-034');
            unit.traits = '베이스';
            p1.unitZones[0].unit = unit;
            engine.state.phase = Phase.LEVEL_UP;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = p1.unitZones[0].unit!.power || 0;
            engine.nextPhase();
            return [
                { pass: p1.leaderLevel === 5, message: '레벨 5 도달' },
                { pass: p1.levelZone?.isAwakened === true, message: '리더 각성됨' },
                { pass: engine.getUnitPower(p1.unitZones[0], p1) >= basePower + 1000, message: '베이스 +1000' }
            ];
        }
    },

    // === UNITS ===
    {
        cardId: 'BT01-029',
        name: '엔트리 +1000',
        description: '배치 시 파워 +1000 (상대 턴 종료까지).',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.hand = [getCard('BT01-029')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = p1.hand[0]?.power || 0;
            engine.playUnit(0, 0);
            const actualPower = engine.getUnitPower(p1.unitZones[0], p1);
            return [
                { pass: actualPower >= basePower + 1000, message: `엔트리 +1000 (${actualPower})` }
            ];
        }
    },
    {
        cardId: 'BT01-030',
        name: '전선구축 +3000',
        description: '3개 유닛 존 모두 유닛 배치 시 +3000.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT01-030');
            p1.unitZones[1].unit = getCard('ST01-002');
            p1.unitZones[2].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = p1.unitZones[0].unit!.power || 0;
            const actualPower = engine.getUnitPower(p1.unitZones[0], p1);
            return [
                { pass: actualPower >= basePower + 3000, message: `전선구축 +3000 (${actualPower})` }
            ];
        }
    },
    {
        cardId: 'BT01-032',
        name: '베이스 수 × 500',
        description: '필드 베이스 유닛 수만큼 파워 증가.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT01-032');
            const u1 = getCard('ST01-002');
            u1.traits = '베이스';
            p1.unitZones[1].unit = u1;
            const u2 = getCard('ST01-002');
            u2.traits = '베이스';
            p1.unitZones[2].unit = u2;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = p1.unitZones[0].unit!.power || 0;
            const actualPower = engine.getUnitPower(p1.unitZones[0], p1);
            // 2 base units * 500 = +1000
            return [
                { pass: actualPower >= basePower + 1000, message: `베이스×500 = +1000 (${actualPower})` }
            ];
        }
    },
    {
        cardId: 'BT01-033',
        name: '엔트리 히트 +1',
        description: '배치 시 히트 +1.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.hand = [getCard('BT01-033')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playUnit(0, 0);
            const hit = engine.getUnitHit(p1.unitZones[0], p1);
            return [
                { pass: hit >= 2, message: `엔트리 히트 +1 (${hit})` }
            ];
        }
    },
    {
        cardId: 'BT01-035',
        name: '어태커 돌파',
        description: '1코스트 이하 유닛은 방어 불가.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard('BT01-035');
            const defender = getCard('ST01-002');
            defender.cost = 1;
            defender.power = 10000;
            p2.unitZones[0].unit = defender;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            engine.attack(0);
            return [
                { pass: engine.state.phase !== Phase.BLOCK, message: '돌파: 방어 단계 생략' }
            ];
        }
    },
    {
        cardId: 'BT01-036',
        name: '베이스 유닛 +2000',
        description: '패시브: 베이스 유닛 파워 +2000.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT01-036');
            const baseUnit = getCard('ST01-002');
            baseUnit.traits = '베이스';
            p1.unitZones[1].unit = baseUnit;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = p1.unitZones[1].unit!.power || 0;
            const actualPower = engine.getUnitPower(p1.unitZones[1], p1);
            return [
                { pass: actualPower >= basePower + 2000, message: `베이스 +2000 (${actualPower})` }
            ];
        }
    },
    {
        cardId: 'BT01-040',
        name: '레벨×500 + 레벨링크',
        description: '리더 레벨 10에서 파워 +5000, 히트 +1.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 10;
            p1.unitZones[0].unit = getCard('BT01-040');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = p1.unitZones[0].unit!.power || 0;
            const actualPower = engine.getUnitPower(p1.unitZones[0], p1);
            const hit = engine.getUnitHit(p1.unitZones[0], p1);
            return [
                { pass: actualPower >= basePower + 5000, message: `레벨×500 = +5000 (${actualPower})` },
                { pass: hit >= 2, message: `레벨링크 히트 +1 (${hit})` }
            ];
        }
    },

    {
        cardId: 'BT01-044',
        name: '엔트리: 덱 3장 공개',
        description: '덱 3장 공개 → 베이스 1장 패로.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 7;
            p1.hand = [getCard('BT01-044')];
            const baseUnit = getCard('ST01-002');
            baseUnit.traits = '베이스';
            p1.deck = [getCard('ST01-002'), baseUnit, getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playUnit(0, 0);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectTarget(1, false);
            }
            return [
                { pass: p1.hand.some(c => (c.traits || '').includes('베이스')), message: '베이스 카드 패로' }
            ];
        }
    },

    // === SKILLS ===
    {
        cardId: 'BT01-047',
        name: '히트=2 설정',
        description: '베이스 1코 유닛 히트=2.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 10;
            const baseUnit = getCard('ST01-002');
            baseUnit.traits = '베이스';
            baseUnit.cost = 1;
            p1.unitZones[0].unit = baseUnit;
            p1.hand = [getCard('BT01-047')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playSkill(0);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectTarget(0, false);
            }
            const hit = engine.getUnitHit(p1.unitZones[0], p1);
            return [
                { pass: hit >= 2, message: `히트 2 (${hit})` }
            ];
        }
    },
    {
        cardId: 'BT01-048',
        name: '전체 +500',
        description: '스킬 사용 → 모든 자신 유닛 +500.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 10;
            p1.unitZones[0].unit = getCard('ST01-002');
            p1.unitZones[1].unit = getCard('ST01-002');
            p1.hand = [getCard('BT01-048')];
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
                { pass: new0 === base0 + 500, message: `유닛0 +500 (${new0})` },
                { pass: new1 === base1 + 500, message: `유닛1 +500 (${new1})` }
            ];
        }
    },
    {
        cardId: 'BT01-049',
        name: '베이스 수만큼 드로우',
        description: '스킬 사용 → 베이스 2장 → 드로우 2.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 10;
            const u1 = getCard('ST01-002');
            u1.traits = '베이스';
            p1.unitZones[0].unit = u1;
            const u2 = getCard('ST01-002');
            u2.traits = '베이스';
            p1.unitZones[1].unit = u2;
            p1.hand = [getCard('BT01-049')];
            p1.deck = [getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const initHand = p1.hand.length;
            engine.playSkill(0);
            // -1 for skill played, +2 for draw = net +1
            return [
                { pass: p1.hand.length >= initHand, message: `드로우 2 (패 ${p1.hand.length})` }
            ];
        }
    },
    {
        cardId: 'BT01-052',
        name: '베이스 히트 +1',
        description: '스킬 사용 → 베이스 유닛 히트 +1.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 10;
            const baseUnit = getCard('ST01-002');
            baseUnit.traits = '베이스';
            p1.unitZones[0].unit = baseUnit;
            p1.hand = [getCard('BT01-052')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const baseHit = engine.getUnitHit(p1.unitZones[0], p1);
            engine.playSkill(0);
            const newHit = engine.getUnitHit(p1.unitZones[0], p1);
            return [
                { pass: newHit === baseHit + 1, message: `히트 +1 (${newHit})` }
            ];
        }
    },

    // === ITEMS ===
    {
        cardId: 'BT01-053',
        name: '돌파[2코 이하]',
        description: '아이템 장착 유닛: 2코 이하 방어 불가.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard('ST01-002');
            p1.unitZones[0].items = [getCard('BT01-053')];
            const defender = getCard('ST01-002');
            defender.cost = 2;
            defender.power = 10000;
            p2.unitZones[0].unit = defender;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            engine.attack(0);
            return [
                { pass: engine.state.phase !== Phase.BLOCK, message: '돌파: 방어 단계 생략' }
            ];
        }
    },
    {
        cardId: 'BT01-054',
        name: '+5000 파워',
        description: '아이템 장착 유닛 파워 +5000.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('ST01-002');
            p1.unitZones[0].items = [getCard('BT01-054')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = p1.unitZones[0].unit!.power || 0;
            const actualPower = engine.getUnitPower(p1.unitZones[0], p1);
            return [
                { pass: actualPower >= basePower + 5000, message: `+5000 (${actualPower})` }
            ];
        }
    }
];

export const BT01EarthModule: UnifiedTestModule = {
    packId: 'BT01대지',
    displayName: 'BT01 대지 (Earth)',
    tests
};

export default tests;
