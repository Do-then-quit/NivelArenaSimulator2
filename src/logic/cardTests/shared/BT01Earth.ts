/**
 * BT01 Earth Attribute Unified Tests (BT01-028 to BT01-054)
 */

import { UnifiedTestCase, UnifiedTestModule, Phase } from './types';

const tests: UnifiedTestCase[] = [
    // === LEADER ===
    {
        cardId: 'BT01-028',
        name: 'Awaken at level 5',
        description: 'Set leader level to 4 and advance phase.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 4;
            p1.levelZone = getCard('BT01-028');
            p1.levelZone.isAwakened = false;
            engine.state.phase = Phase.LEVEL_UP;
        },
        verify: (engine) => {
            engine.nextPhase();
            const p1 = engine.currentPlayer;
            return [
                { pass: p1.leaderLevel === 5, message: 'Leader level is 5' },
                { pass: p1.levelZone?.isAwakened === true, message: 'Leader awakened' }
            ];
        }
    },
    {
        cardId: 'BT01-028-Buff',
        name: 'Awakened leader buffs Base units',
        description: 'Awakened leader gives +1000 to Base units.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.levelZone = getCard('BT01-028');
            p1.levelZone.isAwakened = true;
            p1.unitZones[0].unit = getCard('ST02-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = p1.unitZones[0].unit!.power || 0;
            const actual = engine.getUnitPower(p1.unitZones[0], p1);
            return [
                { pass: actual === basePower + 1000, message: `Buffed to ${actual}` }
            ];
        }
    },

    // === UNITS ===
    {
        cardId: 'BT01-029',
        name: 'Entry +1000 until opponent turn end',
        description: 'Entry buff +1000.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.hand = [getCard('BT01-029')];
            p1.leaderLevel = 10;
            engine.state.phase = Phase.MAIN;
            engine.playUnit(0, 0);
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = p1.unitZones[0].unit!.power || 0;
            const actual = engine.getUnitPower(p1.unitZones[0], p1);
            return [
                { pass: actual >= basePower + 1000, message: `Buffed to ${actual}` }
            ];
        }
    },
    {
        cardId: 'BT01-030',
        name: 'Frontline +3000',
        description: 'Gain +3000 when all lanes are filled.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT01-030');
            p1.unitZones[1].unit = getCard('ST02-002');
            p1.unitZones[2].unit = getCard('ST02-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = p1.unitZones[0].unit!.power || 0;
            const actual = engine.getUnitPower(p1.unitZones[0], p1);
            return [
                { pass: actual === basePower + 3000, message: `Frontline buff ${actual}` }
            ];
        }
    },
    {
        cardId: 'BT01-030-NoFrontline',
        name: 'Frontline inactive without 3 units',
        description: 'No buff when a lane is empty.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT01-030');
            p1.unitZones[1].unit = getCard('ST02-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = p1.unitZones[0].unit!.power || 0;
            const actual = engine.getUnitPower(p1.unitZones[0], p1);
            return [
                { pass: actual === basePower, message: `No frontline buff (${actual})` }
            ];
        }
    },
    {
        cardId: 'BT01-032',
        name: 'Passive +500 per Base unit',
        description: 'Power scales with Base unit count.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT01-032');
            p1.unitZones[1].unit = getCard('ST02-002');
            p1.unitZones[2].unit = getCard('ST02-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = p1.unitZones[0].unit!.power || 0;
            const actual = engine.getUnitPower(p1.unitZones[0], p1);
            return [
                { pass: actual >= basePower + 1000, message: `Scaled power ${actual}` }
            ];
        }
    },
    {
        cardId: 'BT01-033',
        name: 'Entry +1 hit',
        description: 'Hit increases by 1 on entry.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.hand = [getCard('BT01-033')];
            p1.leaderLevel = 10;
            engine.state.phase = Phase.MAIN;
            engine.playUnit(0, 0);
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const baseHit = p1.unitZones[0].unit!.hit || 0;
            const actual = engine.getUnitHit(p1.unitZones[0], p1);
            return [
                { pass: actual === baseHit + 1, message: `Hit ${actual}` }
            ];
        }
    },
    {
        cardId: 'BT01-034-Trigger',
        name: 'Trigger: return to hand',
        description: 'Damage trigger returns the card to hand.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.deck = [getCard('BT01-034')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.dealDamage(p1, 1);
            return [
                { pass: p1.hand.some(c => c.id === 'BT01-034'), message: 'Returned to hand' },
                { pass: p1.damage.length === 0, message: 'Damage cleared' }
            ];
        }
    },
    {
        cardId: 'BT01-035',
        name: 'Breakthrough vs cost<=1',
        description: 'Breakthrough skips block against low-cost defenders.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard('BT01-035');
            p2.unitZones[0].unit = getCard('ST02-002');
            p2.unitZones[0].unit!.cost = 1;
            p2.unitZones[0].unit!.power = 10000;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            engine.attack(0);
            return [
                { pass: engine.state.phase !== Phase.BLOCK, message: 'Block skipped' }
            ];
        }
    },
    {
        cardId: 'BT01-036',
        name: 'Passive +2000 to Base units',
        description: 'Buff all Base units by +2000.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT01-036');
            p1.unitZones[1].unit = getCard('ST02-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = p1.unitZones[1].unit!.power || 0;
            const actual = engine.getUnitPower(p1.unitZones[1], p1);
            return [
                { pass: actual === basePower + 2000, message: `Buffed to ${actual}` }
            ];
        }
    },
    {
        cardId: 'BT01-037',
        name: 'Frontline +1 hit',
        description: 'Hit increases by 1 when all lanes filled.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT01-037');
            p1.unitZones[1].unit = getCard('ST02-002');
            p1.unitZones[2].unit = getCard('ST02-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const baseHit = p1.unitZones[0].unit!.hit || 0;
            const actual = engine.getUnitHit(p1.unitZones[0], p1);
            return [
                { pass: actual === baseHit + 1, message: `Hit ${actual}` }
            ];
        }
    },
    {
        cardId: 'BT01-038',
        name: 'Active: trash 1 to buff +4000',
        description: 'Pay 1 hand to buff a unit by +4000.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT01-038');
            p1.unitZones[1].unit = getCard('ST02-002');
            p1.hand = [getCard('ST02-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = engine.getUnitPower(p1.unitZones[1], p1);
            engine.activateEffect(0, 0);
            engine.selectCost(0);
            engine.selectTarget(1, false);
            const boosted = engine.getUnitPower(p1.unitZones[1], p1);
            return [
                { pass: boosted === basePower + 4000, message: `Buffed to ${boosted}` }
            ];
        }
    },
    {
        cardId: 'BT01-039',
        name: 'Entry +3000 until opponent turn end',
        description: 'Entry buff +3000.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.hand = [getCard('BT01-039')];
            p1.leaderLevel = 10;
            engine.state.phase = Phase.MAIN;
            engine.playUnit(0, 0);
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = p1.unitZones[0].unit!.power || 0;
            const actual = engine.getUnitPower(p1.unitZones[0], p1);
            return [
                { pass: actual >= basePower + 3000, message: `Buffed to ${actual}` }
            ];
        }
    },
    {
        cardId: 'BT01-040',
        name: 'Power scales with leader level',
        description: 'Gain 500 power per leader level.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 6;
            p1.unitZones[0].unit = getCard('BT01-040');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = p1.unitZones[0].unit!.power || 0;
            const actual = engine.getUnitPower(p1.unitZones[0], p1);
            return [
                { pass: actual === basePower + 3000, message: `Scaled to ${actual}` }
            ];
        }
    },
    {
        cardId: 'BT01-040-Link',
        name: 'Level link hit +1 at level 10',
        description: 'Gain +1 hit at leader level 10.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 10;
            p1.unitZones[0].unit = getCard('BT01-040');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const baseHit = p1.unitZones[0].unit!.hit || 0;
            const actual = engine.getUnitHit(p1.unitZones[0], p1);
            return [
                { pass: actual === baseHit + 1, message: `Hit ${actual}` }
            ];
        }
    },
    {
        cardId: 'BT01-041',
        name: 'Entry: buff a friendly unit +2000',
        description: 'Select a friendly unit to buff by 2000.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[1].unit = getCard('ST02-002');
            p1.hand = [getCard('BT01-041')];
            p1.leaderLevel = 10;
            engine.state.phase = Phase.MAIN;
            engine.playUnit(0, 0);
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = engine.getUnitPower(p1.unitZones[1], p1);
            engine.selectTarget(1, false);
            const boosted = engine.getUnitPower(p1.unitZones[1], p1);
            return [
                { pass: boosted === basePower + 2000, message: `Buffed to ${boosted}` }
            ];
        }
    },
    {
        cardId: 'BT01-044',
        name: 'Entry: reveal 3 and take Base',
        description: 'Choose a Base unit from top 3.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const base = getCard('ST02-002');
            p1.deck = [getCard('ST01-002'), base, getCard('ST01-002')];
            p1.hand = [getCard('BT01-044')];
            p1.leaderLevel = 10;
            engine.state.phase = Phase.MAIN;
            engine.playUnit(0, 0);
        },
        verify: (engine) => {
            const idx = engine.state.revealedCards.findIndex(c => c.traits?.includes('베이스'));
            if (idx >= 0) {
                engine.selectRevealedTarget(idx);
            }
            const p1 = engine.currentPlayer;
            const hasBase = p1.hand.some(c => c.traits?.includes('베이스'));
            return [
                { pass: hasBase, message: 'Base unit taken to hand' }
            ];
        }
    },
    {
        cardId: 'BT01-044-Trigger',
        name: 'Trigger: gain level and trash self',
        description: 'Damage trigger increases leader level and trashes self.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 3;
            p1.deck = [getCard('BT01-044')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.dealDamage(p1, 1);
            return [
                { pass: p1.leaderLevel === 4, message: `Leader level ${p1.leaderLevel}` },
                { pass: p1.trash.some(c => c.id === 'BT01-044'), message: 'Trigger card trashed' }
            ];
        }
    },
    {
        cardId: 'BT01-045',
        name: 'Passive +2000 to cost 1 units',
        description: 'Buff cost 1 units by +2000.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT01-045');
            p1.unitZones[1].unit = getCard('ST02-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = p1.unitZones[1].unit!.power || 0;
            const actual = engine.getUnitPower(p1.unitZones[1], p1);
            return [
                { pass: actual === basePower + 2000, message: `Buffed to ${actual}` }
            ];
        }
    },
    {
        cardId: 'BT01-046',
        name: 'Entry: grant Breakthrough[3]',
        description: 'Grant Breakthrough[3] to a Base unit.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard('ST02-002');
            p1.unitZones[0].unit!.power = 6000;
            p2.unitZones[0].unit = getCard('ST02-002');
            p2.unitZones[0].unit!.cost = 3;
            p2.unitZones[0].unit!.power = 10000;
            p1.hand = [getCard('BT01-046')];
            p1.leaderLevel = 10;
            engine.state.phase = Phase.MAIN;
            engine.playUnit(0, 1);
            engine.selectTarget(0, false);
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            engine.attack(0);
            return [
                { pass: engine.state.phase !== Phase.BLOCK, message: 'Breakthrough applied' }
            ];
        }
    },
    {
        cardId: 'BT01-046-Trigger',
        name: 'Trigger: return to hand',
        description: 'Damage trigger returns the card to hand.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.deck = [getCard('BT01-046')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.dealDamage(p1, 1);
            return [
                { pass: p1.hand.some(c => c.id === 'BT01-046'), message: 'Returned to hand' }
            ];
        }
    },

    // === SKILLS ===
    {
        cardId: 'BT01-047',
        name: 'Skill: set hit to 2',
        description: 'Set hit to 2 on 1-cost Base unit.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const unit = getCard('ST02-002');
            unit.cost = 1;
            p1.unitZones[0].unit = unit;
            p1.hand = [getCard('BT01-047')];
            p1.leaderLevel = 10;
            engine.state.phase = Phase.MAIN;
            engine.playSkill(0);
            engine.selectTarget(0, false);
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const actual = engine.getUnitHit(p1.unitZones[0], p1);
            return [
                { pass: actual === 2, message: `Hit set to ${actual}` }
            ];
        }
    },
    {
        cardId: 'BT01-048',
        name: 'Skill: +500 to all units',
        description: 'Buff all friendly units by +500.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('ST02-002');
            p1.unitZones[1].unit = getCard('ST02-002');
            p1.hand = [getCard('BT01-048')];
            p1.leaderLevel = 10;
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
                { pass: new0 === base0 + 500, message: `Unit0 ${new0}` },
                { pass: new1 === base1 + 500, message: `Unit1 ${new1}` }
            ];
        }
    },
    {
        cardId: 'BT01-049',
        name: 'Skill: draw by Base count',
        description: 'Draw cards equal to Base unit count.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('ST02-002');
            p1.unitZones[1].unit = getCard('ST02-002');
            p1.hand = [getCard('BT01-049')];
            p1.leaderLevel = 10;
            p1.deck = [getCard('ST02-002'), getCard('ST02-002'), getCard('ST02-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const before = p1.hand.length;
            engine.playSkill(0);
            return [
                { pass: p1.hand.length === before + 1, message: `Hand size ${p1.hand.length}` }
            ];
        }
    },
    {
        cardId: 'BT01-050',
        name: 'Skill: frontline +1500',
        description: 'All friendly units +1500 when frontline is full.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('ST02-002');
            p1.unitZones[1].unit = getCard('ST02-002');
            p1.unitZones[2].unit = getCard('ST02-002');
            p1.hand = [getCard('BT01-050')];
            p1.leaderLevel = 10;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const base = engine.getUnitPower(p1.unitZones[0], p1);
            engine.playSkill(0);
            const boosted = engine.getUnitPower(p1.unitZones[0], p1);
            return [
                { pass: boosted === base + 1500, message: `Buffed to ${boosted}` }
            ];
        }
    },
    {
        cardId: 'BT01-051',
        name: 'Skill: reveal 3 take cost<=3',
        description: 'Take all revealed cards with cost <= 3.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const c1 = getCard('ST02-002');
            c1.cost = 2;
            const c2 = getCard('ST01-002');
            c2.cost = 4;
            const c3 = getCard('ST01-002');
            c3.cost = 3;
            p1.deck = [c1, c2, c3];
            p1.hand = [getCard('BT01-051')];
            p1.leaderLevel = 10;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const before = p1.hand.length;
            engine.playSkill(0);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.confirmTargets();
            }
            return [
                { pass: p1.hand.length === before + 1, message: `Hand size ${p1.hand.length}` }
            ];
        }
    },
    {
        cardId: 'BT01-051-Trigger',
        name: 'Trigger: destroy cost<=3 and trash self',
        description: 'Damage trigger destroys a cost<=3 unit and trashes self.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.deck = [getCard('BT01-051')];
            p2.unitZones[0].unit = getCard('ST02-002');
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
                { pass: p2.unitZones[0].unit === null, message: 'Opponent unit destroyed' },
                { pass: p1.trash.some(c => c.id === 'BT01-051'), message: 'Trigger card trashed' }
            ];
        }
    },
    {
        cardId: 'BT01-052',
        name: 'Skill: Base units +1 hit',
        description: 'Give Base units +1 hit.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('ST02-002');
            p1.hand = [getCard('BT01-052')];
            p1.leaderLevel = 10;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const baseHit = p1.unitZones[0].unit!.hit || 0;
            engine.playSkill(0);
            const actual = engine.getUnitHit(p1.unitZones[0], p1);
            return [
                { pass: actual === baseHit + 1, message: `Hit ${actual}` }
            ];
        }
    },

    // === ITEMS ===
    {
        cardId: 'BT01-053',
        name: 'Item: Breakthrough vs cost<=2',
        description: 'Skip block against cost 2 or lower.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard('ST02-002');
            p1.unitZones[0].items = [getCard('BT01-053')];
            p2.unitZones[0].unit = getCard('ST02-002');
            p2.unitZones[0].unit!.cost = 2;
            p2.unitZones[0].unit!.power = 10000;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            engine.attack(0);
            return [
                { pass: engine.state.phase !== Phase.BLOCK, message: 'Block skipped' }
            ];
        }
    },
    {
        cardId: 'BT01-054',
        name: 'Item: +5000 power',
        description: 'Gain +5000 power while equipped.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('ST02-002');
            p1.unitZones[0].items = [getCard('BT01-054')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = p1.unitZones[0].unit!.power || 0;
            const actual = engine.getUnitPower(p1.unitZones[0], p1);
            return [
                { pass: actual === basePower + 5000, message: `Buffed to ${actual}` }
            ];
        }
    }
];

export const BT01EarthModule: UnifiedTestModule = {
    packId: 'BT01?吏',
    displayName: 'BT01 ?吏 (Earth)',
    tests
};

export default tests;
