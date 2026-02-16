/**
 * BT01 Storm Attribute Unified Tests (BT01-055 to BT01-081)
 */

import { UnifiedTestCase, UnifiedTestModule, Phase } from './types';

const tests: UnifiedTestCase[] = [
    // === LEADER ===
    {
        testId: 'BT01-055 Awaken',
        name: 'Awaken at level 5',
        description: 'Leader should awaken when level reaches 5.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 4;
            p1.levelZone = getCard('BT01-055');
            p1.levelZone.isAwakened = false;
            engine.state.phase = Phase.LEVEL_UP;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.nextPhase();
            return [
                { pass: p1.leaderLevel === 5, message: 'Leader reached level 5' },
                { pass: p1.levelZone?.isAwakened === true, message: 'Leader awakened' }
            ];
        }
    },
    {
        testId: 'BT01-055 UnitTrashedDrawOnce',
        name: 'Awakened leader draws once per turn on 5+ cost trash',
        description: 'Awakened passive should draw when friendly 5+ cost unit is trashed, once per turn.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 10;
            p1.levelZone = getCard('BT01-055');
            p1.levelZone.isAwakened = true;

            const unitA = getCard('ST01-002');
            unitA.cost = 5;
            p1.unitZones[0].unit = unitA;

            const unitB = getCard('ST01-002');
            unitB.cost = 5;
            p1.unitZones[1].unit = unitB;

            p1.deck = [getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const handBefore = p1.hand.length;
            engine.destroyUnit(p1, p1.unitZones[0]);
            engine.destroyUnit(p1, p1.unitZones[1]);
            return [
                { pass: p1.hand.length === handBefore + 1, message: `Drew exactly once (${p1.hand.length})` }
            ];
        }
    },

    // === UNITS ===
    {
        testId: 'BT01-056',
        name: 'Exit target -2000',
        description: 'On exit, choose an opponent unit and apply -2000 power.',
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
                { pass: newPower === basePower - 2000, message: `Opponent unit -2000 (${newPower})` }
            ];
        }
    },
    {
        testId: 'BT01-058',
        name: 'Defender terminate attack',
        description: 'Defender should terminate attack and trash itself.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
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
                { pass: p2.unitZones[0].unit === null, message: 'Defender trashed itself' },
                { pass: p1.unitZones[0].unit !== null, message: 'Attacker survived' }
            ];
        }
    },
    {
        testId: 'BT01-060 PassiveAttackCost',
        name: 'Attack requires discard cost',
        description: 'Attacking with this unit should require discarding 1 card from hand.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT01-060');
            p1.hand = [getCard('ST01-002')];
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const handBefore = p1.hand.length;
            const trashBefore = p1.trash.length;

            engine.attack(0);
            const enteredCostMode = engine.state.interactionMode === 'SELECT_COST';
            if (enteredCostMode) {
                engine.selectCost(0);
            }

            return [
                { pass: enteredCostMode, message: 'Entered attack cost selection mode' },
                { pass: p1.hand.length === handBefore - 1, message: `Hand -1 after paying cost (${p1.hand.length})` },
                { pass: p1.trash.length === trashBefore + 1, message: `Trash +1 after paying cost (${p1.trash.length})` },
                { pass: p1.unitZones[0].hasAttacked === true, message: 'Attack resumed and completed' }
            ];
        }
    },
    {
        testId: 'BT01-061 ActiveSacrificeToBuff',
        name: 'Active: sacrifice one, buff one +2000',
        description: 'Select 2 friendly units, sacrifice one and give +2000 to the other.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT01-061');
            p1.unitZones[1].unit = getCard('ST01-002');
            p1.unitZones[2].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const buffBefore = engine.getUnitPower(p1.unitZones[2], p1);
            const trashBefore = p1.trash.length;

            engine.activateEffect(0, 0);
            const enteredTargetMode = engine.state.interactionMode === 'SELECT_TARGET';
            if (enteredTargetMode) {
                engine.selectTarget(1, false);
                engine.selectTarget(2, false);
                engine.confirmTargets();
            }

            const buffAfter = engine.getUnitPower(p1.unitZones[2], p1);
            return [
                { pass: enteredTargetMode, message: 'Entered target selection mode' },
                { pass: p1.unitZones[1].unit === null, message: 'Selected sacrifice target trashed' },
                { pass: buffAfter === buffBefore + 2000, message: `Other target gained +2000 (${buffAfter})` },
                { pass: p1.trash.length === trashBefore + 1, message: `Trash +1 from sacrifice (${p1.trash.length})` }
            ];
        }
    },
    {
        testId: 'BT01-063',
        name: 'Passive mutual-destruction units +2000',
        description: 'Units with Mutual Destruction keyword/effect should gain +2000 power.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT01-063');
            p1.unitZones[1].unit = getCard('ST03-007');
            p1.unitZones[2].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const mutualRaw = p1.unitZones[1].unit!.power || 0;
            const normalRaw = p1.unitZones[2].unit!.power || 0;
            const mutualPower = engine.getUnitPower(p1.unitZones[1], p1);
            const normalPower = engine.getUnitPower(p1.unitZones[2], p1);
            return [
                { pass: mutualPower === mutualRaw + 2000, message: `Mutual unit +2000 (${mutualPower})` },
                { pass: normalPower === normalRaw, message: `Normal unit unchanged (${normalPower})` }
            ];
        }
    },
    {
        testId: 'BT01-064 EntryOptionalDestroyEncounter',
        name: 'Entry optional: discard 2 then destroy encounter',
        description: 'Confirm optional effect, pay 2 discard cost, and destroy encounter unit.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.leaderLevel = 10;
            p1.hand = [getCard('BT01-064'), getCard('ST01-002'), getCard('ST01-002')];
            p2.unitZones[0].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            const handBefore = p1.hand.length;
            engine.playUnit(0, 0);

            if (engine.state.interactionMode === 'SELECT_OPTIONAL') {
                engine.resolveOptionalEffect(true);
            }
            if (engine.state.interactionMode === 'SELECT_COST') {
                engine.selectCost(0);
            }
            if (engine.state.interactionMode === 'SELECT_COST') {
                engine.selectCost(0);
            }

            return [
                { pass: p2.unitZones[0].unit === null, message: 'Encounter unit destroyed' },
                { pass: p1.hand.length === handBefore - 3, message: `Played card + paid 2 discard cost (${p1.hand.length})` }
            ];
        }
    },
    {
        testId: 'BT01-065 PassiveAttackCost',
        name: 'Attack requires discard cost',
        description: 'Attacking with this unit should require discarding 1 card from hand.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[1].unit = getCard('BT01-065');
            p1.hand = [getCard('ST01-002')];
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const handBefore = p1.hand.length;
            const trashBefore = p1.trash.length;

            engine.attack(1);
            const enteredCostMode = engine.state.interactionMode === 'SELECT_COST';
            if (enteredCostMode) {
                engine.selectCost(0);
            }

            return [
                { pass: enteredCostMode, message: 'Entered attack cost selection mode' },
                { pass: p1.hand.length === handBefore - 1, message: `Hand -1 after paying cost (${p1.hand.length})` },
                { pass: p1.trash.length === trashBefore + 1, message: `Trash +1 after paying cost (${p1.trash.length})` },
                { pass: p1.unitZones[1].hasAttacked === true, message: 'Attack resumed and completed' }
            ];
        }
    },
    {
        testId: 'BT01-066',
        name: 'Exit: opponent discards 1 when hand>=3',
        description: 'On exit, if opponent has 3+ cards, discard 1 selected card from opponent hand.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard('BT01-066');
            p2.hand = [getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            const oppHandBefore = p2.hand.length;
            const oppTrashBefore = p2.trash.length;
            engine.destroyUnit(p1, p1.unitZones[0]);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectHandTarget(0, true);
            }
            return [
                { pass: p2.hand.length === oppHandBefore - 1, message: `Opponent hand -1 (${p2.hand.length})` },
                { pass: p2.trash.length === oppTrashBefore + 1, message: `Opponent trash +1 (${p2.trash.length})` }
            ];
        }
    },
    {
        testId: 'BT01-067',
        name: 'Exit mutual destruction',
        description: 'If destroyed by equal/lower cost attacker, destroy attacker too.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            const attacker = getCard('ST01-002');
            attacker.cost = 3;
            attacker.power = 10000;
            p1.unitZones[0].unit = attacker;

            const defender = getCard('BT01-067');
            defender.cost = 4;
            defender.power = 1000;
            p2.unitZones[0].unit = defender;

            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            engine.attack(0);
            engine.resolveBlock(true);
            return [
                { pass: p2.unitZones[0].unit === null, message: 'Defender destroyed in combat' },
                { pass: p1.unitZones[0].unit === null, message: 'Attacker destroyed by mutual destruction' }
            ];
        }
    },
    {
        testId: 'BT01-068',
        name: 'Exit: draw 2 then discard 1',
        description: 'On exit, draw 2 and discard 1 selected drawn card.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT01-068');
            p1.deck = [getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const handBefore = p1.hand.length;
            const trashBefore = p1.trash.length;
            engine.destroyUnit(p1, p1.unitZones[0]);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectRevealedTarget(0);
            }
            return [
                { pass: p1.hand.length === handBefore + 1, message: `Net hand +1 after draw2-discard1 (${p1.hand.length})` },
                { pass: p1.trash.length === trashBefore + 2, message: `Unit + discarded card moved to trash (${p1.trash.length})` }
            ];
        }
    },
    {
        testId: 'BT01-069',
        name: 'Entry destroy encounter if cost<=2',
        description: 'Destroys encounter unit only when its cost is 2 or lower.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.leaderLevel = 10;
            p1.hand = [getCard('BT01-069')];
            const encounter = getCard('ST01-002');
            encounter.cost = 2;
            p2.unitZones[0].unit = encounter;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p2 = engine.opponentPlayer;
            engine.playUnit(0, 0);
            return [
                { pass: p2.unitZones[0].unit === null, message: 'Encounter cost<=2 destroyed' }
            ];
        }
    },
    {
        testId: 'BT01-070',
        name: 'Defender terminate attack',
        description: 'Defender should terminate attack and trash itself.',
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
                { pass: p2.unitZones[0].unit === null, message: 'Defender trashed itself' },
                { pass: p1.unitZones[0].unit !== null, message: 'Attacker survived' }
            ];
        }
    },
    {
        testId: 'BT01-071 EntryDestroyOwnAndDraw',
        name: 'Entry: destroy 1 friendly unit and draw 1',
        description: 'On entry, destroy selected friendly unit and draw 1 card.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 10;
            p1.hand = [getCard('BT01-071')];
            p1.unitZones[1].unit = getCard('ST01-002');
            p1.deck = [getCard('ST01-002'), getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const handBefore = p1.hand.length;
            engine.playUnit(0, 0);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectTarget(1, false);
            }
            return [
                { pass: p1.unitZones[1].unit === null, message: 'Selected friendly unit destroyed' },
                { pass: p1.hand.length === handBefore, message: `Net hand unchanged (-1 + draw1) (${p1.hand.length})` }
            ];
        }
    },
    {
        testId: 'BT01-071 TriggerReturnHand',
        name: 'Damage trigger: return this card to hand',
        description: 'When revealed by damage, this card should move to hand.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.deck = [getCard('ST01-002'), getCard('BT01-071')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.dealDamage(p1, 1);
            return [
                { pass: p1.hand.some(card => card.id === 'BT01-071'), message: 'Card returned to hand' },
                { pass: p1.damage.every(card => card.id !== 'BT01-071'), message: 'Card removed from damage zone' }
            ];
        }
    },
    {
        testId: 'BT01-072 PassiveGrantExitDraw',
        name: 'Passive grants exit draw to other friendly units',
        description: 'While this unit is on field, other friendly unit should draw 1 on exit.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT01-072');
            p1.unitZones[1].unit = getCard('ST01-002');
            p1.deck = [getCard('ST01-002'), getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const handBefore = p1.hand.length;
            engine.destroyUnit(p1, p1.unitZones[1]);
            return [
                { pass: p1.unitZones[1].unit === null, message: 'Other friendly unit destroyed' },
                { pass: p1.hand.length === handBefore + 1, message: `Drew 1 from granted EXIT effect (${p1.hand.length})` }
            ];
        }
    },
    {
        testId: 'BT01-073 EntryDestroyEncounter',
        name: 'Entry optional: discard higher-cost unit to destroy encounter',
        description: 'Confirm optional effect, discard higher-cost unit, then destroy encounter unit.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.leaderLevel = 10;
            const highCostUnit = getCard('ST03-011');
            highCostUnit.cost = 7;
            p1.hand = [getCard('BT01-073'), highCostUnit];

            const encounter = getCard('ST01-002');
            encounter.cost = 3;
            p2.unitZones[0].unit = encounter;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            const handBefore = p1.hand.length;
            engine.playUnit(0, 0);

            if (engine.state.interactionMode === 'SELECT_OPTIONAL') {
                engine.resolveOptionalEffect(true);
            }
            if (engine.state.interactionMode === 'SELECT_COST') {
                engine.selectCost(0);
            }

            return [
                { pass: p2.unitZones[0].unit === null, message: 'Encounter unit destroyed' },
                { pass: p1.hand.length === handBefore - 2, message: `Played unit + paid discard cost (${p1.hand.length})` }
            ];
        }
    },
    {
        testId: 'BT01-073 TriggerDiscard',
        name: 'Damage trigger: opponent discards 1 if hand>=3',
        description: 'When triggered from damage, opponent discards 1 and this card moves from damage zone to trash.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.deck = [getCard('ST01-002'), getCard('BT01-073')];
            p2.hand = [getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            const oppHandBefore = p2.hand.length;
            engine.dealDamage(p1, 1);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectHandTarget(0, true);
            }
            return [
                { pass: p2.hand.length === oppHandBefore - 1, message: `Opponent hand -1 (${p2.hand.length})` },
                { pass: p1.damage.every(card => card.id !== 'BT01-073'), message: 'Card removed from damage zone' },
                { pass: p1.trash.some(card => card.id === 'BT01-073'), message: 'Card moved to trash by trigger self-trash' }
            ];
        }
    },

    // === SKILLS ===
    {
        testId: 'BT01-074 ActiveDestroyOwnAndDrawByHit',
        name: 'Active: destroy own unit and draw by hit',
        description: 'On skill use, destroy one friendly unit and draw cards equal to that unit hit.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 10;
            p1.hand = [getCard('BT01-074')];
            const target = getCard('ST01-002');
            target.hit = 2;
            p1.unitZones[1].unit = target;
            p1.deck = [getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const handBefore = p1.hand.length;
            const deckBefore = p1.deck.length;
            engine.playSkill(0);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectTarget(1, false);
            }
            return [
                { pass: p1.unitZones[1].unit === null, message: 'Selected friendly unit destroyed' },
                { pass: p1.hand.length === handBefore + 1, message: `Net hand +1 (play -1, draw +2) (${p1.hand.length})` },
                { pass: p1.deck.length === deckBefore - 2, message: `Deck -2 from draw by hit (${p1.deck.length})` }
            ];
        }
    },
    {
        testId: 'BT01-074 TriggerReturnHand',
        name: 'Damage trigger: return this card to hand',
        description: 'When revealed by damage, this card should move to hand.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.deck = [getCard('ST01-002'), getCard('BT01-074')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.dealDamage(p1, 1);
            return [
                { pass: p1.hand.some(card => card.id === 'BT01-074'), message: 'Card returned to hand' },
                { pass: p1.damage.every(card => card.id !== 'BT01-074'), message: 'Card removed from damage zone' }
            ];
        }
    },
    {
        testId: 'BT01-075 ActiveCostHandling',
        name: 'Active requires discard cost',
        description: 'Playing this skill should enter discard-cost selection and consume 1 hand card.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.leaderLevel = 10;
            p1.hand = [getCard('BT01-075'), getCard('ST01-002')];
            p2.unitZones[0].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const handBefore = p1.hand.length;
            const trashBefore = p1.trash.length;
            engine.playSkill(0);
            const enteredCostMode = engine.state.interactionMode === 'SELECT_COST';
            if (enteredCostMode) {
                engine.selectCost(0);
            }
            return [
                { pass: enteredCostMode, message: 'Entered cost selection mode' },
                { pass: p1.hand.length === handBefore - 2, message: `Skill played + 1 discard (${p1.hand.length})` },
                { pass: p1.trash.length === trashBefore + 1, message: `Discarded cost card to trash (${p1.trash.length})` }
            ];
        }
    },
    {
        testId: 'BT01-076',
        name: 'Active buff mutual-destruction unit +4500',
        description: 'Select one mutual-destruction unit and give it +4500 power.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 10;
            p1.unitZones[0].unit = getCard('ST03-007');
            p1.hand = [getCard('BT01-076')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = engine.getUnitPower(p1.unitZones[0], p1);
            engine.playSkill(0);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectTarget(0, false);
            }
            const newPower = engine.getUnitPower(p1.unitZones[0], p1);
            return [
                { pass: newPower === basePower + 4500, message: `Selected unit +4500 (${newPower})` }
            ];
        }
    },
    {
        testId: 'BT01-077 ActiveDestroyWithHitCost',
        name: 'Active: pay hand equal to target hit, then destroy target',
        description: 'Select a unit, pay hand cost equal to its hit, then destroy that unit.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.leaderLevel = 10;
            p1.hand = [getCard('BT01-077'), getCard('ST01-002'), getCard('ST01-002')];

            const target = getCard('ST01-002');
            target.hit = 2;
            p2.unitZones[0].unit = target;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            const handBefore = p1.hand.length;
            const trashBefore = p1.trash.length;

            engine.playSkill(0);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectTarget(0, true);
            }

            const enteredCostMode = engine.state.interactionMode === 'SELECT_COST';
            if (enteredCostMode) {
                engine.selectCost(0);
            }
            if (engine.state.interactionMode === 'SELECT_COST') {
                engine.selectCost(0);
            }

            return [
                { pass: enteredCostMode, message: 'Entered cost selection mode after target selection' },
                { pass: p2.unitZones[0].unit === null, message: 'Target unit destroyed after paying cost' },
                { pass: p1.hand.length === handBefore - 3, message: `Played skill + paid 2 hand cost (${p1.hand.length})` },
                { pass: p1.trash.length === trashBefore + 2, message: `Two cards trashed for hit cost (${p1.trash.length})` }
            ];
        }
    },
    {
        testId: 'BT01-078 ActiveDestroyTargets',
        name: 'Active destroys selected opponent units',
        description: 'Select up to 2 opponent units and destroy them.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.leaderLevel = 10;
            p1.hand = [getCard('BT01-078')];

            const opp0 = getCard('ST01-002');
            opp0.cost = 2;
            p2.unitZones[0].unit = opp0;

            const opp1 = getCard('ST01-002');
            opp1.cost = 2;
            p2.unitZones[1].unit = opp1;

            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p2 = engine.opponentPlayer;
            engine.playSkill(0);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectTarget(0, true);
                engine.selectTarget(1, true);
                engine.confirmTargets();
            }
            return [
                { pass: p2.unitZones[0].unit === null, message: 'Opponent unit 0 destroyed' },
                { pass: p2.unitZones[1].unit === null, message: 'Opponent unit 1 destroyed' }
            ];
        }
    },
    {
        testId: 'BT01-078 TriggerRecoverExit',
        name: 'Damage trigger recovers 1 exit unit from trash',
        description: 'When revealed by damage, recover one exit unit from your trash to hand.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.deck = [getCard('ST01-002'), getCard('BT01-078')];
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
                { pass: p1.hand.some(card => card.id === 'BT01-056'), message: 'Recovered one exit unit to hand' }
            ];
        }
    },
    {
        testId: 'BT01-079',
        name: 'Recover up to 2 cost<=2 exit units from trash',
        description: 'Select 2 valid trash targets and move them to hand.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 10;
            p1.hand = [getCard('BT01-079')];

            const t1 = getCard('BT01-056');
            t1.cost = 1;
            const t2 = getCard('BT01-056');
            t2.cost = 1;
            p1.trash = [t1, t2];

            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const handBefore = p1.hand.length;
            const trashBefore = p1.trash.length;
            engine.playSkill(0);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectTrashTarget(0);
                engine.selectTrashTarget(1);
                engine.confirmTargets();
            }
            return [
                { pass: p1.hand.length === handBefore + 1, message: `Net hand +1 (play -1, recover +2) (${p1.hand.length})` },
                { pass: p1.trash.length === trashBefore - 2, message: `Trash -2 (${p1.trash.length})` }
            ];
        }
    },

    // === ITEMS ===
    {
        testId: 'BT01-080',
        name: 'Item exit: draw 2',
        description: 'When equipped unit is destroyed, draw 2 cards.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('ST01-002');
            p1.unitZones[0].items = [getCard('BT01-080')];
            p1.deck = [getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const handBefore = p1.hand.length;
            engine.destroyUnit(p1, p1.unitZones[0]);
            return [
                { pass: p1.hand.length === handBefore + 2, message: `Drew 2 cards (${p1.hand.length})` }
            ];
        }
    },
    {
        testId: 'BT01-081',
        name: 'Item exit: return unit from trash at turn end',
        description: 'Destroyed equipped unit should return to hand at turn end; item remains in trash.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('ST01-002');
            p1.unitZones[0].items = [getCard('BT01-081')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const unitCard = p1.unitZones[0].unit;
            const itemCard = p1.unitZones[0].items[0];

            engine.destroyUnit(p1, p1.unitZones[0]);

            const unitInTrash = !!unitCard && p1.trash.includes(unitCard);
            const itemInTrash = !!itemCard && p1.trash.includes(itemCard);

            engine.state.phase = Phase.END;
            engine.nextPhase();

            const unitInHand = !!unitCard && p1.hand.includes(unitCard);
            const itemInHand = !!itemCard && p1.hand.includes(itemCard);
            const itemStillInTrash = !!itemCard && p1.trash.includes(itemCard);

            return [
                { pass: unitInTrash && itemInTrash, message: 'Unit and item moved to trash on destroy' },
                { pass: unitInHand, message: 'Unit returned to hand at turn end' },
                { pass: !itemInHand && itemStillInTrash, message: 'Item stayed in trash' }
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

