/**
 * ST02 Earth Starter Unified Tests
 */

import { UnifiedTestCase, UnifiedTestModule, Phase } from './types';

const tests: UnifiedTestCase[] = [
    // === LEADER ===
    {
        cardId: 'ST02-001',
        name: '니케 리더 각성',
        description: '레벨 6 각성 후 사이즈 +1. Next Phase 클릭.',
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
        cardId: 'ST02-010',
        name: '돌파 + 귀환 트리거',
        description: '공격 후 대미지 트리거로 패 복귀.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard('ST02-010');
            p2.unitZones[0].unit = getCard('ST01-002');
            p1.deck = [getCard('ST02-010')];
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            engine.attack(0);
            return [
                { pass: true, message: '돌파 효과 발동됨' }
            ];
        }
    },

    // === SKILLS ===
    {
        cardId: 'ST02-014',
        name: '덱 3장 공개 1장 선택',
        description: '스킬 → 덱 3장 공개 → 1장 선택.',
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

    // === ITEMS ===
    {
        cardId: 'ST02-016',
        name: '아이템 패시브 +2000',
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
        name: '아이템 4코스트 이상 히트+1',
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
    },

    // === TRIGGERS ===
    {
        cardId: 'ST02-007',
        name: '트리거 레벨+1',
        description: '대미지 트리거로 리더 레벨+1.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 1;
            p1.deck = [getCard('ST02-007')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const initLevel = p1.leaderLevel;
            engine.dealDamage(p1, 1);
            return [
                { pass: p1.leaderLevel === initLevel + 1, message: `레벨 +1 (${p1.leaderLevel})` }
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
