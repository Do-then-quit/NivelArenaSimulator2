/**
 * BT01 Storm Attribute Unified Tests (BT01-055 to BT01-081)
 */

import { UnifiedTestCase, UnifiedTestModule, Phase } from './types';
import { ActivationCondition } from '../../types';

const tests: UnifiedTestCase[] = [
    // === LEADER ===
    {
        cardId: 'BT01-055',
        name: 'Awaken at level 5',
        description: 'Set leader level to 4 and advance phase.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 4;
            p1.levelZone = getCard('BT01-055');
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
        cardId: 'BT01-055-Trigger',
        name: 'Draw when 5+ cost unit trashed',
        description: 'Awakened leader draws when a 5+ cost unit is trashed.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.levelZone = getCard('BT01-055');
            p1.levelZone.isAwakened = true;
            p1.unitZones[0].unit = getCard('ST03-002');
            p1.unitZones[0].unit!.cost = 5;
            p1.deck = [getCard('ST03-002'), getCard('ST03-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const before = p1.hand.length;
            engine.destroyUnit(p1, p1.unitZones[0]);
            return [
                { pass: p1.hand.length === before + 1, message: 'Drew 1 card' }
            ];
        }
    },

    // === UNITS ===
    {
        cardId: 'BT01-056',
        name: 'Exit: -2000 to enemy',
        description: 'Debuff opponent unit on exit.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard('BT01-056');
            p2.unitZones[0].unit = getCard('ST03-002');
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
                { pass: newPower === basePower - 2000, message: `Debuffed to ${newPower}` }
            ];
        }
    },
    {
        cardId: 'BT01-058',
        name: 'Defender: terminate attack',
        description: 'Terminate attack on defense.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p2.unitZones[0].unit = getCard('BT01-058');
            p1.unitZones[0].unit = getCard('ST03-002');
            p1.unitZones[0].unit!.power = 10000;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            engine.attack(0);
            engine.resolveBlock(true);
            return [
                { pass: engine.opponentPlayer.unitZones[0].unit === null, message: 'Defender destroyed' },
                { pass: engine.currentPlayer.unitZones[0].unit !== null, message: 'Attacker survived' }
            ];
        }
    },
    {
        cardId: 'BT01-060',
        name: 'Attack cost: trash 1 from hand',
        description: 'Attack requires discarding 1 card.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT01-060');
            p1.hand = [getCard('ST03-002')];
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const beforeTrash = p1.trash.length;
            engine.attack(0);
            const inCost = engine.state.interactionMode === 'SELECT_COST';
            engine.selectCost(0);
            return [
                { pass: inCost, message: 'Cost selection triggered' },
                { pass: p1.trash.length === beforeTrash + 1, message: 'Card trashed for cost' }
            ];
        }
    },
    {
        cardId: 'BT01-061',
        name: 'Active: sacrifice to buff +2000',
        description: 'Trash one unit to buff another +2000.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT01-061');
            p1.unitZones[1].unit = getCard('ST03-002');
            p1.unitZones[2].unit = getCard('ST03-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = engine.getUnitPower(p1.unitZones[2], p1);
            engine.activateEffect(0, 0);
            engine.selectTarget(1, false); // sacrifice
            engine.selectTarget(2, false); // buff
            engine.confirmTargets();
            const boosted = engine.getUnitPower(p1.unitZones[2], p1);
            return [
                { pass: p1.unitZones[1].unit === null, message: 'Sacrificed unit' },
                { pass: boosted === basePower + 2000, message: `Buffed to ${boosted}` }
            ];
        }
    },
    {
        cardId: 'BT01-063',
        name: 'Passive +2000 to Mutual Destruction units',
        description: 'Buff units with Mutual Destruction keyword.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT01-063');
            p1.unitZones[1].unit = getCard('BT01-067');
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
        cardId: 'BT01-064',
        name: 'Entry: optional trash 2 to destroy encounter',
        description: 'Confirm optional, pay 2 cards, destroy encounter.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p2.unitZones[0].unit = getCard('ST03-002');
            p1.hand = [getCard('BT01-064'), getCard('ST03-002'), getCard('ST03-002')];
            p1.leaderLevel = 10;
            engine.state.phase = Phase.MAIN;
            engine.playUnit(0, 0);
        },
        verify: (engine) => {
            engine.resolveOptionalEffect(true);
            engine.selectCost(0);
            engine.selectCost(0);
            return [
                { pass: engine.opponentPlayer.unitZones[0].unit === null, message: 'Encounter destroyed' }
            ];
        }
    },
    {
        cardId: 'BT01-065',
        name: 'Attack cost: trash 1 from hand',
        description: 'Attack requires discarding 1 card.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT01-065');
            p1.hand = [getCard('ST03-002')];
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const beforeTrash = p1.trash.length;
            engine.attack(0);
            const inCost = engine.state.interactionMode === 'SELECT_COST';
            engine.selectCost(0);
            return [
                { pass: inCost, message: 'Cost selection triggered' },
                { pass: p1.trash.length === beforeTrash + 1, message: 'Card trashed for cost' }
            ];
        }
    },
    {
        cardId: 'BT01-066',
        name: 'Exit: discard if opponent has 3+ cards',
        description: 'Discard 1 from opponent hand on exit.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard('BT01-066');
            p2.hand = [getCard('ST03-002'), getCard('ST03-002'), getCard('ST03-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p2 = engine.opponentPlayer;
            engine.destroyUnit(engine.currentPlayer, engine.currentPlayer.unitZones[0]);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectHandTarget(0, true);
            }
            return [
                { pass: p2.hand.length === 2, message: `Opponent hand ${p2.hand.length}` }
            ];
        }
    },
    {
        cardId: 'BT01-067',
        name: 'Exit: mutual destruction',
        description: 'Destroy attacker if cost is equal or lower.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p2.unitZones[0].unit = getCard('BT01-067');
            p2.unitZones[0].unit!.cost = 3;
            p1.unitZones[0].unit = getCard('ST03-002');
            p1.unitZones[0].unit!.cost = 3;
            p1.unitZones[0].unit!.power = 5000;
            p2.unitZones[0].unit!.power = 1000;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            engine.attack(0);
            engine.resolveBlock(true);
            return [
                { pass: engine.currentPlayer.unitZones[0].unit === null, message: 'Attacker destroyed' },
                { pass: engine.opponentPlayer.unitZones[0].unit === null, message: 'Defender destroyed' }
            ];
        }
    },
    {
        cardId: 'BT01-068',
        name: 'Exit: draw 2 then discard 1',
        description: 'Draw 2, discard 1 from drawn.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT01-068');
            p1.deck = [getCard('ST03-002'), getCard('ST03-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const before = p1.hand.length;
            engine.destroyUnit(p1, p1.unitZones[0]);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectRevealedTarget(0);
            }
            return [
                { pass: p1.hand.length === before + 1, message: `Hand size ${p1.hand.length}` }
            ];
        }
    },
    {
        cardId: 'BT01-069',
        name: 'Entry: destroy encounter cost<=2',
        description: 'Destroy encounter if its cost is 2 or lower.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p2.unitZones[0].unit = getCard('ST03-002');
            p2.unitZones[0].unit!.cost = 2;
            p1.hand = [getCard('BT01-069')];
            p1.leaderLevel = 10;
            engine.state.phase = Phase.MAIN;
            engine.playUnit(0, 0);
        },
        verify: (engine) => [
            { pass: engine.opponentPlayer.unitZones[0].unit === null, message: 'Encounter destroyed' }
        ]
    },
    {
        cardId: 'BT01-069-Fail',
        name: 'Entry: does not destroy cost>=3',
        description: 'Encounter survives if cost is 3 or higher.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p2.unitZones[0].unit = getCard('ST03-002');
            p2.unitZones[0].unit!.cost = 3;
            p1.hand = [getCard('BT01-069')];
            p1.leaderLevel = 10;
            engine.state.phase = Phase.MAIN;
            engine.playUnit(0, 0);
        },
        verify: (engine) => [
            { pass: engine.opponentPlayer.unitZones[0].unit !== null, message: 'Encounter survived' }
        ]
    },
    {
        cardId: 'BT01-070',
        name: 'Defender: terminate attack',
        description: 'Terminate attack on defense.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p2.unitZones[0].unit = getCard('BT01-070');
            p1.unitZones[0].unit = getCard('ST03-002');
            p1.unitZones[0].unit!.power = 10000;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            engine.attack(0);
            engine.resolveBlock(true);
            return [
                { pass: engine.opponentPlayer.unitZones[0].unit === null, message: 'Defender destroyed' },
                { pass: engine.currentPlayer.unitZones[0].unit !== null, message: 'Attacker survived' }
            ];
        }
    },
    {
        cardId: 'BT01-071',
        name: 'Entry: destroy own unit and draw 1',
        description: 'Destroy a friendly unit and draw 1.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[1].unit = getCard('ST03-002');
            p1.hand = [getCard('BT01-071')];
            p1.leaderLevel = 10;
            p1.deck = [getCard('ST03-002')];
            engine.state.phase = Phase.MAIN;
            engine.playUnit(0, 0);
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const before = p1.hand.length;
            engine.selectTarget(1, false);
            return [
                { pass: p1.unitZones[1].unit === null, message: 'Unit destroyed' },
                { pass: p1.hand.length === before + 1, message: 'Drew 1 card' }
            ];
        }
    },
    {
        cardId: 'BT01-071-Trigger',
        name: 'Trigger: return to hand',
        description: 'Damage trigger returns the card to hand.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.deck = [getCard('BT01-071')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.dealDamage(p1, 1);
            return [
                { pass: p1.hand.some(c => c.id === 'BT01-071'), message: 'Returned to hand' }
            ];
        }
    },
    {
        cardId: 'BT01-072',
        name: 'Passive: grant exit draw to others',
        description: 'Other units draw 1 when they exit.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT01-072');
            p1.unitZones[1].unit = getCard('ST03-002');
            p1.deck = [getCard('ST03-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const before = p1.hand.length;
            engine.effectManager.processEffects(ActivationCondition.PASSIVE, {
                sourceCard: p1.unitZones[0].unit!,
                player: p1,
                opponent: engine.opponentPlayer,
                unitZone: p1.unitZones[0],
                machine: engine
            });
            engine.destroyUnit(p1, p1.unitZones[1]);
            return [
                { pass: p1.hand.length === before + 1, message: 'Drew 1 card' }
            ];
        }
    },
    {
        cardId: 'BT01-073',
        name: 'Entry: trash higher-cost unit to destroy encounter',
        description: 'Discard a higher-cost unit to destroy encounter.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p2.unitZones[0].unit = getCard('ST03-002');
            p2.unitZones[0].unit!.cost = 2;
            const low = getCard('ST03-002');
            low.cost = 2;
            const high = getCard('ST03-002');
            high.cost = 3;
            p1.hand = [getCard('BT01-073'), low, high];
            p1.leaderLevel = 10;
            engine.state.phase = Phase.MAIN;
            engine.playUnit(0, 0);
        },
        verify: (engine) => {
            engine.resolveOptionalEffect(true);
            const p1 = engine.currentPlayer;
            const handBefore = p1.hand.length;
            // Attempt invalid payment (cost 2)
            engine.selectCost(0);
            const stillCost = engine.state.interactionMode === 'SELECT_COST';
            const handAfterInvalid = p1.hand.length;
            // Pay valid cost (cost 3)
            engine.selectCost(1);
            return [
                { pass: stillCost, message: 'Invalid cost rejected' },
                { pass: handAfterInvalid === handBefore, message: 'Hand unchanged after invalid cost' },
                { pass: engine.opponentPlayer.unitZones[0].unit === null, message: 'Encounter destroyed' }
            ];
        }
    },
    {
        cardId: 'BT01-073-Trigger',
        name: 'Trigger: discard if opponent has 3+ cards',
        description: 'Damage trigger discards from opponent hand.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.deck = [getCard('BT01-073')];
            p2.hand = [getCard('ST03-002'), getCard('ST03-002'), getCard('ST03-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p2 = engine.opponentPlayer;
            engine.dealDamage(engine.currentPlayer, 1);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectHandTarget(0, true);
            }
            return [
                { pass: p2.hand.length === 2, message: `Opponent hand ${p2.hand.length}` }
            ];
        }
    },
    {
        cardId: 'BT01-074',
        name: 'Entry: destroy own unit and draw by hit',
        description: 'Destroy a friendly unit and draw cards equal to its hit.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const target = getCard('ST03-002');
            target.hit = 2;
            p1.unitZones[1].unit = target;
            p1.hand = [getCard('BT01-074')];
            p1.leaderLevel = 10;
            p1.deck = [getCard('ST03-002'), getCard('ST03-002')];
            engine.state.phase = Phase.MAIN;
            engine.playUnit(0, 0);
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const before = p1.hand.length;
            engine.selectTarget(1, false);
            return [
                { pass: p1.unitZones[1].unit === null, message: 'Unit destroyed' },
                { pass: p1.hand.length === before + 2, message: 'Drew 2 cards' }
            ];
        }
    },
    {
        cardId: 'BT01-074-Trigger',
        name: 'Trigger: return to hand',
        description: 'Damage trigger returns the card to hand.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.deck = [getCard('BT01-074')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.dealDamage(p1, 1);
            return [
                { pass: p1.hand.some(c => c.id === 'BT01-074'), message: 'Returned to hand' }
            ];
        }
    },

    // === SKILLS ===
    {
        cardId: 'BT01-075',
        name: 'Skill: destroy unit with equal cost',
        description: 'Trash 1 card; destroy unit with the same cost.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            const costCard = getCard('ST03-002');
            costCard.cost = 2;
            const target = getCard('ST03-002');
            target.cost = 2;
            p2.unitZones[0].unit = target;
            p1.hand = [getCard('BT01-075'), costCard];
            p1.leaderLevel = 10;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            engine.playSkill(0);
            engine.selectCost(0);
            engine.selectTarget(0, true);
            return [
                { pass: engine.opponentPlayer.unitZones[0].unit === null, message: 'Target destroyed' }
            ];
        }
    },
    {
        cardId: 'BT01-076',
        name: 'Skill: +4500 to Mutual Destruction unit',
        description: 'Buff a Mutual Destruction unit by +4500.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT01-067');
            p1.hand = [getCard('BT01-076')];
            p1.leaderLevel = 10;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const base = engine.getUnitPower(p1.unitZones[0], p1);
            engine.playSkill(0);
            engine.selectTarget(0, false);
            const boosted = engine.getUnitPower(p1.unitZones[0], p1);
            return [
                { pass: boosted === base + 4500, message: `Buffed to ${boosted}` }
            ];
        }
    },
    {
        cardId: 'BT01-077',
        name: 'Skill: destroy unit with hit-cost',
        description: 'Pay hand cost equal to target hit to destroy it.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p2.unitZones[0].unit = getCard('ST03-002');
            p2.unitZones[0].unit!.hit = 1;
            p1.hand = [getCard('BT01-077'), getCard('ST03-002')];
            p1.leaderLevel = 10;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            engine.playSkill(0);
            engine.selectTarget(0, true);
            const inCost = engine.state.interactionMode === 'SELECT_COST';
            engine.selectCost(0);
            return [
                { pass: inCost, message: 'Cost selection triggered' },
                { pass: engine.opponentPlayer.unitZones[0].unit === null, message: 'Target destroyed' }
            ];
        }
    },
    {
        cardId: 'BT01-078',
        name: 'Skill: destroy up to 2 with total cost<=4',
        description: 'Select units up to total cost 4.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            const u0 = getCard('ST03-002');
            u0.cost = 3;
            const u1 = getCard('ST03-002');
            u1.cost = 2;
            const u2 = getCard('ST03-002');
            u2.cost = 1;
            p2.unitZones[0].unit = u0;
            p2.unitZones[1].unit = u1;
            p2.unitZones[2].unit = u2;
            p1.hand = [getCard('BT01-078')];
            p1.leaderLevel = 10;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            engine.playSkill(0);
            engine.selectTarget(0, true); // cost 3
            const pending = engine.state.pendingEffect as any;
            const before = pending.selectedTargets.length;
            engine.selectTarget(1, true); // cost 2 (should be rejected)
            const afterInvalid = pending.selectedTargets.length;
            engine.selectTarget(2, true); // cost 1 (allowed, total 4)
            engine.confirmTargets();
            return [
                { pass: before === afterInvalid, message: 'Total cost limit enforced' },
                { pass: engine.opponentPlayer.unitZones[0].unit === null, message: 'Cost 3 unit destroyed' },
                { pass: engine.opponentPlayer.unitZones[2].unit === null, message: 'Cost 1 unit destroyed' },
                { pass: engine.opponentPlayer.unitZones[1].unit !== null, message: 'Cost 2 unit survived' }
            ];
        }
    },
    {
        cardId: 'BT01-078-Trigger',
        name: 'Trigger: recover Exit unit from trash',
        description: 'Damage trigger recovers an Exit unit.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.deck = [getCard('BT01-078')];
            p1.trash = [getCard('BT01-056')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.dealDamage(p1, 1);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectTrashTarget(0);
            }
            return [
                { pass: p1.hand.some(c => c.id === 'BT01-056'), message: 'Recovered from trash' }
            ];
        }
    },
    {
        cardId: 'BT01-079',
        name: 'Skill: recover 2 Exit units cost<=2',
        description: 'Move two Exit units from trash to hand.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const a = getCard('BT01-056');
            a.cost = 2;
            const b = getCard('BT01-068');
            b.cost = 2;
            p1.trash = [a, b];
            p1.hand = [getCard('BT01-079')];
            p1.leaderLevel = 10;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playSkill(0);
            engine.selectTrashTarget(0);
            engine.selectTrashTarget(1);
            engine.confirmTargets();
            const hasA = p1.hand.some(c => c.id === 'BT01-056');
            const hasB = p1.hand.some(c => c.id === 'BT01-068');
            return [
                { pass: hasA && hasB, message: 'Recovered two units' }
            ];
        }
    },

    // === ITEMS ===
    {
        cardId: 'BT01-080',
        name: 'Item: draw 2 on exit',
        description: 'Draw 2 when equipped unit exits.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('ST03-002');
            p1.unitZones[0].items = [getCard('BT01-080')];
            p1.deck = [getCard('ST03-002'), getCard('ST03-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const before = p1.hand.length;
            engine.destroyUnit(p1, p1.unitZones[0]);
            return [
                { pass: p1.hand.length === before + 2, message: 'Drew 2 cards' }
            ];
        }
    },
    {
        cardId: 'BT01-081',
        name: 'Item: return from trash at turn end',
        description: 'Return item to hand at end of turn.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('ST03-002');
            p1.unitZones[0].items = [getCard('BT01-081')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.destroyUnit(p1, p1.unitZones[0]);
            engine.state.phase = Phase.END;
            engine.nextPhase();
            const returned = p1.hand.some(c => c.id === 'BT01-081');
            return [
                { pass: returned, message: 'Item returned to hand' }
            ];
        }
    }
];

export const BT01StormModule: UnifiedTestModule = {
    packId: 'BT01??뭾',
    displayName: 'BT01 ??뭾 (Storm)',
    tests
};

export default tests;
