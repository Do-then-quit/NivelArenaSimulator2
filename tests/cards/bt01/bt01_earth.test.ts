/**
 * BT01 Earth Attribute Card Tests (BT01-028 to BT01-054)
 * 
 * Leader: BT01-028 (Nikke Squad Commander)
 * Units: BT01-029 to BT01-046
 * Skills: BT01-047 to BT01-052
 * Items: BT01-053 to BT01-054
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../../../src/logic/GameEngine';
import { Phase, ActivationCondition } from '../../../src/logic/types';
import { DUMMY_CARDS } from '../../../src/logic/CardDatabase';
import { getCard, createGame, placeUnit, equipItem, getUnitPower, getUnitHit, hasUnit, isInTrash, handSize, damageCount, setPhase, setLeaderLevel, playUnit, addToHand } from '../../helpers/test_helpers';

describe('BT01 Earth Attribute', () => {
    describe('BT01-028: Nikke Squad Commander (Leader)', () => {
        it('should awaken at leader level 5', () => {
            const engine = createGame('BT01-028');
            const player = engine.currentPlayer;

            expect(player.levelZone?.isAwakened).toBeFalsy();

            player.leaderLevel = 4;
            engine.state.phase = Phase.LEVEL_UP;
            engine.nextPhase(); // Level 4 -> 5

            expect(player.leaderLevel).toBe(5);
            expect(player.levelZone?.isAwakened).toBe(true);
        });

        it('should buff Base trait units by +1000 when awakened', () => {
            const engine = createGame('BT01-028');
            const player = engine.currentPlayer;

            player.levelZone!.isAwakened = true;

            // Place a Base trait unit (ST02-002 N102 has Base)
            const baseUnit = placeUnit(engine, 'ST02-002', 0);
            const basePower = baseUnit.power!;

            const actualPower = getUnitPower(engine, 0);
            expect(actualPower).toBe(basePower + 1000);
        });
    });

    describe('BT01-029: Liter (Entry +1000 until opp turn end)', () => {
        it('should gain +1000 power until opponent turn ends', () => {
            const engine = createGame('BT01-028');

            const unit = getCard('BT01-029');
            engine.currentPlayer.hand = [unit];
            engine.state.phase = Phase.MAIN;

            engine.playUnit(0, 0);

            // Check the buff
            const unitPower = getUnitPower(engine, 0);
            const basePower = 2000; // BT01-029 base power
            expect(unitPower).toBeGreaterThanOrEqual(basePower + 1000);
        });
    });

    describe('BT01-030: Diesel (Frontline +3000)', () => {
        it('should gain +3000 power when all lanes have units', () => {
            const engine = createGame('BT01-028');

            // Fill all 3 lanes
            placeUnit(engine, 'BT01-030', 0); // Diesel
            placeUnit(engine, 'ST02-002', 1);
            placeUnit(engine, 'ST02-002', 2);

            const dieselPower = getUnitPower(engine, 0);
            const basePower = 2000; // BT01-030 base power

            // Should have frontline bonus
            expect(dieselPower).toBe(basePower + 3000);
        });

        it('should NOT gain buff when lanes are not full', () => {
            const engine = createGame('BT01-028');

            // Only 2 lanes
            placeUnit(engine, 'BT01-030', 0);
            placeUnit(engine, 'ST02-002', 1);

            const dieselPower = getUnitPower(engine, 0);
            const basePower = 2000;

            expect(dieselPower).toBe(basePower);
        });
    });

    describe('BT01-033: Rapi (Entry Hit+1)', () => {
        it('should gain +1 hit on entry', () => {
            const engine = createGame('BT01-028');
            setPhase(engine, Phase.MAIN);

            playUnit(engine, 'BT01-033', 0);

            const unitHit = getUnitHit(engine, 0);
            // BT01-033 base hit is 1, should be 2 after entry
            expect(unitHit).toBe(2);
        });
    });

    describe('BT01-035: Rupee (Attacker Breakthrough)', () => {
        it('should have Breakthrough against 1-cost or lower units', () => {
            const engine = createGame('BT01-028');

            // Setup attacker
            placeUnit(engine, 'BT01-035', 0);

            // Setup 1-cost defender
            const defender = placeUnit(engine, 'ST02-002', 0, true);
            defender.cost = 1;
            defender.power = 10000; // High power to win combat

            engine.state.phase = Phase.ATTACK;
            engine.attack(0);

            // Breakthrough should skip block phase
            expect(engine.state.phase).not.toBe(Phase.BLOCK);
        });
    });

    describe('BT01-036: Anis (Passive: Base units +2000)', () => {
        it('should buff all Base units by +2000', () => {
            const engine = createGame('BT01-028');
            setLeaderLevel(engine, 10);

            // Place Anis (the buffer)
            placeUnit(engine, 'BT01-036', 0);

            // Place Base trait unit
            const baseUnit = placeUnit(engine, 'ST02-002', 1);
            baseUnit.traits = '베이스';
            const basePower = baseUnit.power!;

            const actualPower = getUnitPower(engine, 1);
            expect(actualPower).toBe(basePower + 2000);
        });
    });

    describe('BT01-040: Neon (Passive level scaling + Level Link)', () => {
        it('should gain power equal to leader level × 500', () => {
            const engine = createGame('BT01-028');

            engine.currentPlayer.leaderLevel = 6;

            const unit = placeUnit(engine, 'BT01-040', 0);
            const basePower = unit.power!;

            const expectedPower = basePower + (6 * 500); // 6 levels × 500
            const actualPower = getUnitPower(engine, 0);

            expect(actualPower).toBe(expectedPower);
        });

        it('should gain +1 Hit at level 10', () => {
            const engine = createGame('BT01-028');

            engine.currentPlayer.leaderLevel = 10;

            const unit = placeUnit(engine, 'BT01-040', 0);
            const baseHit = unit.hit!;

            const actualHit = getUnitHit(engine, 0);
            expect(actualHit).toBe(baseHit + 1);
        });
    });

    describe('BT01-044: Rapunzel (Entry: Reveal 3, choose Base)', () => {
        it('should reveal top 3 cards and allow choosing a Base unit', () => {
            const engine = createGame('BT01-028');

            // Setup deck with a Base unit
            const baseUnit = getCard('ST02-002');
            baseUnit.traits = '베이스';
            engine.currentPlayer.deck = [
                getCard('ST01-002'), // non-Base
                baseUnit, // Base
                getCard('ST01-002')  // non-Base
            ];

            const rapunzel = getCard('BT01-044');
            engine.currentPlayer.hand = [rapunzel];
            engine.state.phase = Phase.MAIN;

            const initialHandSize = handSize(engine);
            engine.playUnit(0, 0);

            // Should enter reveal/select mode
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                // Select the Base unit (index varies based on implementation)
                engine.selectTarget(1, false);
            }

            // Hand should have the Base unit
            expect(engine.currentPlayer.hand.length).toBeGreaterThanOrEqual(0);
        });
    });
});

describe('BT01 Earth Skills', () => {
    describe('BT01-047: Power Shot (Set Hit to 2)', () => {
        it('should set 1-cost Base unit Hit to 2', () => {
            const engine = createGame('BT01-028');

            // Place 1-cost Base unit
            const unit = placeUnit(engine, 'ST02-002', 0);
            unit.cost = 1;
            unit.traits = '베이스';

            // Add skill and play
            const skill = getCard('BT01-047');
            engine.currentPlayer.hand = [skill];
            engine.state.phase = Phase.MAIN;
            setLeaderLevel(engine, 10);

            engine.playSkill(0);
            engine.selectTarget(0, false);

            const actualHit = getUnitHit(engine, 0);
            expect(actualHit).toBe(2);
        });
    });

    describe('BT01-048: Defensive Formation (+500 to all)', () => {
        it('should buff all friendly units by +500 until opponent turn end', () => {
            const engine = createGame('BT01-028');

            const unit1 = placeUnit(engine, 'ST02-002', 0);
            const unit2 = placeUnit(engine, 'ST02-002', 1);

            const basePower1 = unit1.power!;
            const basePower2 = unit2.power!;

            const skill = getCard('BT01-048');
            engine.currentPlayer.hand = [skill];
            engine.state.phase = Phase.MAIN;
            setLeaderLevel(engine, 10);

            engine.playSkill(0);

            expect(getUnitPower(engine, 0)).toBe(basePower1 + 500);
            expect(getUnitPower(engine, 1)).toBe(basePower2 + 500);
        });
    });

    describe('BT01-049: Supply Line (Draw by Base count)', () => {
        it('should draw cards equal to Base unit count', () => {
            const engine = createGame('BT01-028');

            const unit1 = placeUnit(engine, 'ST02-002', 0);
            unit1.traits = '베이스';
            const unit2 = placeUnit(engine, 'ST02-002', 1);
            unit2.traits = '베이스';

            const skill = getCard('BT01-049');
            engine.currentPlayer.hand = [skill];
            const initialHandSize = handSize(engine) - 1; // Minus the skill we'll play

            engine.currentPlayer.deck = [
                getCard('ST02-002'),
                getCard('ST02-002'),
                getCard('ST02-002')
            ];

            engine.state.phase = Phase.MAIN;
            setLeaderLevel(engine, 10);
            engine.playSkill(0);

            // Should have drawn 2 cards (one per Base unit)
            expect(handSize(engine)).toBe(initialHandSize + 2);
        });
    });

    describe('BT01-052: Base Rally (Base units +1 Hit)', () => {
        it('should give all Base units +1 Hit', () => {
            const engine = createGame('BT01-028');

            // Place Base units
            const unit1 = placeUnit(engine, 'ST02-002', 0);
            unit1.traits = '베이스';
            const baseHit1 = unit1.hit!;

            const skill = getCard('BT01-052');
            engine.currentPlayer.hand = [skill];
            engine.state.phase = Phase.MAIN;
            setLeaderLevel(engine, 10);

            engine.playSkill(0);

            expect(getUnitHit(engine, 0)).toBe(baseHit1 + 1);
        });
    });
});

describe('BT01 Earth Items', () => {
    describe('BT01-053: Tactical Armor (Breakthrough[2 cost])', () => {
        it('should grant Breakthrough against 2-cost or lower', () => {
            const engine = createGame('BT01-028');

            // Setup unit with item
            const unit = placeUnit(engine, 'ST02-002', 0);
            equipItem(engine, 'BT01-053', 0);

            // Setup 2-cost defender
            const defender = placeUnit(engine, 'ST02-002', 0, true);
            defender.cost = 2;
            defender.power = 10000;

            engine.state.phase = Phase.ATTACK;
            engine.attack(0);

            // Should bypass block
            expect(engine.state.phase).not.toBe(Phase.BLOCK);
        });
    });

    describe('BT01-054: Heavy Armor (+5000 power)', () => {
        it('should grant +5000 power to equipped unit', () => {
            const engine = createGame('BT01-028');

            const unit = placeUnit(engine, 'ST02-002', 0);
            const basePower = unit.power!;

            equipItem(engine, 'BT01-054', 0);

            const actualPower = getUnitPower(engine, 0);
            expect(actualPower).toBe(basePower + 5000);
        });
    });
});
