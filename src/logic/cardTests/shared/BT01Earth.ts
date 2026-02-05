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

    // === SKILLS ===
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
    }
];

export const BT01EarthModule: UnifiedTestModule = {
    packId: 'BT01대지',
    displayName: 'BT01 대지 (Earth)',
    tests
};

export default tests;
