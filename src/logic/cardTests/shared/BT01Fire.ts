/**
 * BT01 Fire Attribute Unified Tests (BT01-001 to BT01-027)
 */

import { UnifiedTestCase, UnifiedTestModule, Phase } from './types';

const tests: UnifiedTestCase[] = [
    // === LEADER ===
    {
        cardId: 'BT01-001',
        name: 'Awaken at level 6',
        description: 'Set leader level to 5 and advance phase.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 5;
            p1.levelZone = getCard('BT01-001');
            p1.levelZone.isAwakened = false;
            engine.state.phase = Phase.LEVEL_UP;
        },
        verify: (engine) => {
            engine.nextPhase();
            const p1 = engine.currentPlayer;
            return [
                { pass: p1.leaderLevel === 6, message: 'Leader level is 6' },
                { pass: p1.levelZone?.isAwakened === true, message: 'Leader awakened' }
            ];
        }
    },
    {
        cardId: 'BT01-001-Buff',
        name: 'Awakened leader buffs Attacker units',
        description: 'Awakened leader gives +2000 to Attacker units on your turn.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.levelZone = getCard('BT01-001');
            p1.levelZone.isAwakened = true;
            p1.unitZones[0].unit = getCard('BT01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = p1.unitZones[0].unit!.power || 0;
            const actual = engine.getUnitPower(p1.unitZones[0], p1);
            return [
                { pass: actual >= basePower + 2000, message: `+2000 applied (${actual})` }
            ];
        }
    },

    // === UNITS ===
    {
        cardId: 'BT01-002',
        name: 'Attacker +2000',
        description: 'Attack to gain +2000 power.',
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
                { pass: attackPower >= basePower + 2000, message: `Attack power ${attackPower}` }
            ];
        }
    },
    {
        cardId: 'BT01-004',
        name: 'Penetration[1]',
        description: 'Block and deal 1 damage through block.',
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
            const before = p2.damage.length;
            engine.attack(0);
            engine.resolveBlock(true);
            return [
                { pass: p2.damage.length === before + 1, message: 'Penetration damage applied' }
            ];
        }
    },
    {
        cardId: 'BT01-005',
        name: 'Berserk keyword present',
        description: 'Check Berserk passive effect is registered.',
        setup: () => undefined,
        verify: (_engine, getCard) => {
            const card = getCard('BT01-005');
            const hasEffect = (card.effects || []).some(e => e.action.type === 'NONE');
            return [
                { pass: hasEffect, message: 'Berserk effect present' }
            ];
        }
    },
    {
        cardId: 'BT01-006',
        name: 'Attacker +2000 and Plunder[1]',
        description: 'Attack and destroy to draw 1.',
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
            const basePower = p1.unitZones[0].unit!.power || 0;
            const initHand = p1.hand.length;
            engine.attack(0);
            engine.resolveBlock(true);
            const attackPower = engine.getUnitPower(p1.unitZones[0], p1);
            return [
                { pass: attackPower >= basePower + 2000, message: `Attack power ${attackPower}` },
                { pass: p1.hand.length >= initHand + 1, message: `Plunder draw (${p1.hand.length})` }
            ];
        }
    },
    {
        cardId: 'BT01-006-Trigger',
        name: 'Trigger: trash self and -5000',
        description: 'Damage trigger trashes self and debuffs a unit.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.deck = [getCard('BT01-006')];
            p2.unitZones[0].unit = getCard('ST01-002');
            p2.unitZones[0].unit!.power = 6000;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            engine.dealDamage(p1, 1);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectTarget(0, true);
            }
            const newPower = engine.getUnitPower(p2.unitZones[0], p2);
            const trashed = p1.trash.some(c => c.id === 'BT01-006');
            return [
                { pass: newPower === 1000, message: `Debuffed to ${newPower}` },
                { pass: trashed, message: 'Trigger card trashed' }
            ];
        }
    },
    {
        cardId: 'BT01-008',
        name: 'Passive +1500 to Attacker+Penetration',
        description: 'Buffs units that have Attacker and Penetration.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT01-008');
            p1.unitZones[1].unit = getCard('BT01-004');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = p1.unitZones[1].unit!.power || 0;
            const actual = engine.getUnitPower(p1.unitZones[1], p1);
            return [
                { pass: actual === basePower + 1500, message: `Buffed to ${actual}` }
            ];
        }
    },
    {
        cardId: 'BT01-009',
        name: 'Attacker +1000',
        description: 'Attack to gain +1000 power.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT01-009');
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = p1.unitZones[0].unit!.power || 0;
            engine.attack(0);
            const attackPower = engine.getUnitPower(p1.unitZones[0], p1);
            return [
                { pass: attackPower >= basePower + 1000, message: `Attack power ${attackPower}` }
            ];
        }
    },
    {
        cardId: 'BT01-011',
        name: 'Active: -1500 to enemy',
        description: 'Activate to debuff an opponent unit.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
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
                { pass: newPower === basePower - 1500, message: `Debuffed to ${newPower}` }
            ];
        }
    },
    {
        cardId: 'BT01-012',
        name: 'Entry: grant attacker +1000',
        description: 'Grant Attacker +1000 to friendly units this turn.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 10;
            p1.unitZones[0].unit = getCard('ST01-002');
            p1.hand = [getCard('BT01-012')];
            engine.state.phase = Phase.MAIN;
            engine.playUnit(0, 1);
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = p1.unitZones[0].unit!.power || 0;
            engine.attack(0);
            const attackPower = engine.getUnitPower(p1.unitZones[0], p1);
            return [
                { pass: attackPower >= basePower + 1000, message: `Attack power ${attackPower}` }
            ];
        }
    },
    {
        cardId: 'BT01-013',
        name: 'Attacker +1000',
        description: 'Attack to gain +1000 power.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT01-013');
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = p1.unitZones[0].unit!.power || 0;
            engine.attack(0);
            const attackPower = engine.getUnitPower(p1.unitZones[0], p1);
            return [
                { pass: attackPower >= basePower + 1000, message: `Attack power ${attackPower}` }
            ];
        }
    },
    {
        cardId: 'BT01-014-Passive',
        name: 'Berserk keyword present',
        description: 'Check Berserk passive effect is registered.',
        setup: () => undefined,
        verify: (_engine, getCard) => {
            const card = getCard('BT01-014');
            const hasEffect = (card.effects || []).some(e => e.action.type === 'NONE');
            return [
                { pass: hasEffect, message: 'Berserk effect present' }
            ];
        }
    },
    {
        cardId: 'BT01-014-Trigger',
        name: 'Trigger: return cost<=2 from trash',
        description: 'Damage trigger returns a low-cost unit and trashes self.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.deck = [getCard('BT01-014')];
            const low = getCard('ST01-002');
            low.cost = 1;
            p1.trash = [low];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.dealDamage(p1, 1);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectTrashTarget(0);
            }
            const recovered = p1.hand.some(c => c.id === 'ST01-002');
            const trashed = p1.trash.some(c => c.id === 'BT01-014');
            return [
                { pass: recovered, message: 'Recovered unit to hand' },
                { pass: trashed, message: 'Trigger card trashed' }
            ];
        }
    },
    {
        cardId: 'BT01-015',
        name: 'Entry: -4000 to encounter',
        description: 'Debuff encounter unit by 4000 on entry.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p2.unitZones[0].unit = getCard('ST01-002');
            p2.unitZones[0].unit!.power = 6000;
            p1.hand = [getCard('BT01-015')];
            p1.leaderLevel = 10;
            engine.state.phase = Phase.MAIN;
            engine.playUnit(0, 0);
        },
        verify: (engine) => {
            const p2 = engine.opponentPlayer;
            const power = engine.getUnitPower(p2.unitZones[0], p2);
            return [
                { pass: power === 2000, message: `Debuffed to ${power}` }
            ];
        }
    },
    {
        cardId: 'BT01-016',
        name: 'Attacker +2000',
        description: 'Attack to gain +2000 power.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT01-016');
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = p1.unitZones[0].unit!.power || 0;
            engine.attack(0);
            const attackPower = engine.getUnitPower(p1.unitZones[0], p1);
            return [
                { pass: attackPower >= basePower + 2000, message: `Attack power ${attackPower}` }
            ];
        }
    },
    {
        cardId: 'BT01-017',
        name: 'Entry: set encounter power to 1000',
        description: 'Set encounter unit power to 1000 on entry.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p2.unitZones[0].unit = getCard('ST01-002');
            p2.unitZones[0].unit!.power = 5000;
            p1.hand = [getCard('BT01-017')];
            p1.leaderLevel = 10;
            engine.state.phase = Phase.MAIN;
            engine.playUnit(0, 0);
        },
        verify: (engine) => {
            const p2 = engine.opponentPlayer;
            const power = engine.getUnitPower(p2.unitZones[0], p2);
            return [
                { pass: power === 1000, message: `Power set to ${power}` }
            ];
        }
    },
    {
        cardId: 'BT01-018',
        name: 'Passive +2000 to Attacker units',
        description: 'Buffs Attacker units by +2000.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT01-018');
            p1.unitZones[1].unit = getCard('BT01-002');
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
        cardId: 'BT01-019',
        name: 'Entry: grant Penetration to all units',
        description: 'Grant Penetration[1] to all friendly units this turn.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard('ST01-002');
            p1.unitZones[0].unit!.power = 5000;
            p2.unitZones[0].unit = getCard('ST01-002');
            p2.unitZones[0].unit!.power = 3000;
            p2.deck = [getCard('ST01-002'), getCard('ST01-002')];
            p1.hand = [getCard('BT01-019')];
            p1.leaderLevel = 10;
            engine.state.phase = Phase.MAIN;
            engine.playUnit(0, 1);
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p2 = engine.opponentPlayer;
            const before = p2.damage.length;
            engine.attack(0);
            engine.resolveBlock(true);
            return [
                { pass: p2.damage.length === before + 1, message: 'Penetration damage applied' }
            ];
        }
    },
    {
        cardId: 'BT01-019-Trigger',
        name: 'Trigger: return to hand',
        description: 'Damage trigger returns the card to hand.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.deck = [getCard('BT01-019')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.dealDamage(p1, 1);
            const inHand = p1.hand.some(c => c.id === 'BT01-019');
            return [
                { pass: inHand, message: 'Returned to hand' },
                { pass: p1.damage.length === 0, message: 'Damage cleared' }
            ];
        }
    },

    // === SKILLS ===
    {
        cardId: 'BT01-020',
        name: 'Skill: grant Penetration',
        description: 'Grant Penetration[1] to selected Attacker unit.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT01-002');
            p1.hand = [getCard('BT01-020')];
            p1.leaderLevel = 10;
            engine.state.phase = Phase.MAIN;
            engine.playSkill(0);
            engine.selectTarget(0, false);
            engine.state.phase = Phase.ATTACK;
            const p2 = engine.opponentPlayer;
            p2.unitZones[0].unit = getCard('ST01-002');
            p2.unitZones[0].unit!.power = 3000;
            p2.deck = [getCard('ST01-002')];
        },
        verify: (engine) => {
            const p2 = engine.opponentPlayer;
            const before = p2.damage.length;
            engine.attack(0);
            engine.resolveBlock(true);
            return [
                { pass: p2.damage.length === before + 1, message: 'Penetration damage applied' }
            ];
        }
    },
    {
        cardId: 'BT01-021',
        name: 'Skill: all enemies -1000',
        description: 'Reduce all opponent units by 1000.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p2.unitZones[0].unit = getCard('ST01-002');
            p2.unitZones[1].unit = getCard('ST01-002');
            p1.hand = [getCard('BT01-021')];
            p1.leaderLevel = 10;
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
                { pass: new0 === base0 - 1000, message: `Unit0 ${new0}` },
                { pass: new1 === base1 - 1000, message: `Unit1 ${new1}` }
            ];
        }
    },
    {
        cardId: 'BT01-022',
        name: 'Skill: select 2 enemies -2000',
        description: 'Select two opponent units and reduce by 2000.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p2.unitZones[0].unit = getCard('ST01-002');
            p2.unitZones[1].unit = getCard('ST01-002');
            p1.hand = [getCard('BT01-022')];
            p1.leaderLevel = 10;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p2 = engine.opponentPlayer;
            const base0 = engine.getUnitPower(p2.unitZones[0], p2);
            const base1 = engine.getUnitPower(p2.unitZones[1], p2);
            engine.playSkill(0);
            engine.selectTarget(0, true);
            engine.selectTarget(1, true);
            engine.confirmTargets();
            const new0 = engine.getUnitPower(p2.unitZones[0], p2);
            const new1 = engine.getUnitPower(p2.unitZones[1], p2);
            return [
                { pass: new0 === base0 - 2000, message: `Unit0 ${new0}` },
                { pass: new1 === base1 - 2000, message: `Unit1 ${new1}` }
            ];
        }
    },
    {
        cardId: 'BT01-023',
        name: 'Skill: Attacker units +2500',
        description: 'Buff all Attacker units by 2500.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT01-002');
            p1.hand = [getCard('BT01-023')];
            p1.leaderLevel = 10;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const base = engine.getUnitPower(p1.unitZones[0], p1);
            engine.playSkill(0);
            const boosted = engine.getUnitPower(p1.unitZones[0], p1);
            return [
                { pass: boosted === base + 2500, message: `Buffed to ${boosted}` }
            ];
        }
    },
    {
        cardId: 'BT01-024',
        name: 'Skill: -3000 and draw if trashed',
        description: 'Debuff target; draw if it is trashed.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p2.unitZones[0].unit = getCard('ST01-002');
            p2.unitZones[0].unit!.power = 2000;
            p1.hand = [getCard('BT01-024')];
            p1.leaderLevel = 10;
            p1.deck = [getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playSkill(0);
            engine.selectTarget(0, true);
            const drawn = p1.hand.length === 1;
            const destroyed = engine.opponentPlayer.unitZones[0].unit === null;
            return [
                { pass: drawn, message: 'Drew 1 card' },
                { pass: destroyed, message: 'Target destroyed' }
            ];
        }
    },
    {
        cardId: 'BT01-025',
        name: 'Skill: recover Attacker from trash',
        description: 'Move Attacker unit from trash to hand.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.trash = [getCard('BT01-002')];
            p1.hand = [getCard('BT01-025')];
            p1.leaderLevel = 10;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playSkill(0);
            engine.selectTrashTarget(0);
            const moved = p1.hand.some(c => c.id === 'BT01-002');
            return [
                { pass: moved, message: 'Recovered from trash' }
            ];
        }
    },

    // === ITEMS ===
    {
        cardId: 'BT01-026',
        name: 'Item: Penetration[1]',
        description: 'Penetration damage on attack.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard('ST01-002');
            p1.unitZones[0].unit!.power = 5000;
            p1.unitZones[0].items = [getCard('BT01-026')];
            p2.unitZones[0].unit = getCard('ST01-002');
            p2.unitZones[0].unit!.power = 3000;
            p2.deck = [getCard('ST01-002')];
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p2 = engine.opponentPlayer;
            const before = p2.damage.length;
            engine.attack(0);
            engine.resolveBlock(true);
            return [
                { pass: p2.damage.length === before + 1, message: 'Penetration damage applied' }
            ];
        }
    },
    {
        cardId: 'BT01-026-Trigger',
        name: 'Item trigger: return to hand',
        description: 'Damage trigger returns the item to hand.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.deck = [getCard('BT01-026')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.dealDamage(p1, 1);
            const inHand = p1.hand.some(c => c.id === 'BT01-026');
            return [
                { pass: inHand, message: 'Returned to hand' }
            ];
        }
    },
    {
        cardId: 'BT01-027',
        name: 'Item: +2000 and Plunder[1]',
        description: 'Attack to gain +2000 and draw on kill.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard('ST01-002');
            p1.unitZones[0].unit!.power = 5000;
            p1.unitZones[0].items = [getCard('BT01-027')];
            p2.unitZones[0].unit = getCard('ST01-002');
            p2.unitZones[0].unit!.power = 3000;
            p1.deck = [getCard('ST01-002')];
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
                { pass: attackPower >= basePower + 2000, message: `Attack power ${attackPower}` },
                { pass: p1.hand.length >= initHand + 1, message: 'Plunder draw' }
            ];
        }
    }
];

export const BT01FireModule: UnifiedTestModule = {
    packId: 'BT01?붿뿼',
    displayName: 'BT01 ?붿뿼 (Fire)',
    tests
};

export default tests;
