/**
 * BT01 Fire Attribute Card Tests (BT01-001 to BT01-027)
 * 
 * Leader: BT01-001 (Red Hood)
 * Units: BT01-002 to BT01-019
 * Skills: BT01-020 to BT01-025
 * Items: BT01-026 to BT01-027
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../../../src/logic/GameEngine';
import { Phase, ActivationCondition } from '../../../src/logic/types';
import { DUMMY_CARDS } from '../../../src/logic/CardDatabase';
import { getCard, createGame, placeUnit, equipItem, getUnitPower, getUnitHit, hasUnit, isInTrash, handSize, damageCount, setPhase, setLeaderLevel, playUnit, addToHand } from '../../helpers/test_helpers';

describe('BT01 Fire Attribute', () => {
    describe('BT01-001: Red Hood (Leader)', () => {
        it('should awaken at leader level 6', () => {
            const engine = createGame('BT01-001');
            const player = engine.currentPlayer;

            expect(player.levelZone?.isAwakened).toBeFalsy();

            // Set level to 5 and trigger level up
            player.leaderLevel = 5;
            engine.state.phase = Phase.LEVEL_UP;
            engine.nextPhase(); // Level 5 -> 6, triggers awakening

            expect(player.leaderLevel).toBe(6);
            expect(player.levelZone?.isAwakened).toBe(true);
        });

        it('should buff Attacker units by +2000 when awakened on your turn', () => {
            const engine = createGame('BT01-001');
            const player = engine.currentPlayer;

            // Awaken the leader
            player.levelZone!.isAwakened = true;

            // Place a unit with Attacker keyword
            const attackerUnit = placeUnit(engine, 'BT01-002', 0); // BT01-002 has Attacker

            // BT01-002 base power is 1500
            const basePower = attackerUnit.power!;
            const actualPower = getUnitPower(engine, 0);

            // Should have +2000 from awakened leader passive
            expect(actualPower).toBe(basePower + 2000);
        });

        it('should NOT buff units without Attacker keyword', () => {
            const engine = createGame('BT01-001');
            const player = engine.currentPlayer;

            player.levelZone!.isAwakened = true;

            // Place a vanilla unit (no Attacker)
            const vanillaUnit = placeUnit(engine, 'ST01-002', 0); // Neon has no Attacker effect

            const basePower = vanillaUnit.power!;
            const actualPower = getUnitPower(engine, 0);

            // Should NOT get the +2000 buff
            expect(actualPower).toBe(basePower);
        });
    });

    describe('BT01-002: Liter (Attacker +2000)', () => {
        it('should gain +2000 power when attacking', () => {
            const engine = createGame('BT01-001');
            const unit = placeUnit(engine, 'BT01-002', 0);
            engine.state.phase = Phase.ATTACK;

            const basePower = unit.power!;
            engine.attack(0);

            const attackPower = getUnitPower(engine, 0);
            // Base + Attacker effect + Leader passive (if awakened)
            expect(attackPower).toBeGreaterThanOrEqual(basePower + 2000);
        });
    });

    describe('BT01-004: Ruby (Attacker Penetration[1])', () => {
        it('should deal 1 penetration damage through block', () => {
            const engine = createGame('BT01-001');

            // Setup attacker with penetration
            const attacker = placeUnit(engine, 'BT01-004', 0);
            attacker.power = 5000;

            // Setup defender
            const defender = placeUnit(engine, 'ST01-002', 0, true);
            defender.power = 3000;

            const initialDamage = damageCount(engine, true);

            engine.state.phase = Phase.ATTACK;
            engine.attack(0);
            engine.resolveBlock(true);

            // Defender should be destroyed
            expect(hasUnit(engine, 0, true)).toBe(false);

            // Should have dealt 1 penetration damage
            const finalDamage = damageCount(engine, true);
            expect(finalDamage).toBe(initialDamage + 1);
        });
    });

    describe('BT01-006: Garnet (Attacker +2000, Plunder[1])', () => {
        it('should gain +2000 power and have plunder when attacking', () => {
            const engine = createGame('BT01-001');
            const unit = placeUnit(engine, 'BT01-006', 0);
            engine.state.phase = Phase.ATTACK;

            const basePower = unit.power!;
            engine.attack(0);

            const attackPower = getUnitPower(engine, 0);
            expect(attackPower).toBeGreaterThanOrEqual(basePower + 2000);

            // Check plunder value
            const plunderValue = (engine as any).getPlunderValue(engine.currentPlayer.unitZones[0]);
            expect(plunderValue).toBeGreaterThanOrEqual(1);
        });
    });

    describe('BT01-008: Maxwell (Passive buff to Penetration units)', () => {
        it('should buff units with Attacker and Penetration by +1500', () => {
            const engine = createGame('BT01-001');

            // Place Maxwell
            placeUnit(engine, 'BT01-008', 0);

            // Place a unit with Penetration (BT01-004 has Attacker: Penetration[1])
            const ruby = placeUnit(engine, 'BT01-004', 1);
            const basePower = ruby.power!;

            // Ruby should get +1500 from Maxwell's passive
            const actualPower = getUnitPower(engine, 1);
            expect(actualPower).toBe(basePower + 1500);
        });
    });

    describe('BT01-015: Viper (Entry -4000 to encounter)', () => {
        it('should reduce encounter unit power by 4000 on entry', () => {
            const engine = createGame('BT01-001');

            // Place opponent unit with high power
            const oppUnit = placeUnit(engine, 'ST01-002', 0, true);
            oppUnit.power = 5000;

            // Play Viper
            playUnit(engine, 'BT01-015', 0);

            // Opponent's power should be reduced by 4000
            const oppPower = getUnitPower(engine, 0, true);
            expect(oppPower).toBe(1000);
        });
    });

    describe('BT01-019: Scarlet (Entry grants Penetration to all units)', () => {
        it('should grant Attacker: Penetration[1] to all friendly units', () => {
            const engine = createGame('BT01-001');

            // Place units on field first
            placeUnit(engine, 'ST01-002', 1); // Vanilla unit

            // Play Scarlet
            playUnit(engine, 'BT01-019', 0);

            // Set attacker power to win battle
            const attacker = engine.currentPlayer.unitZones[1].unit!;
            attacker.power = 5000;

            // Attack with the vanilla unit
            engine.currentPlayer.unitZones[1].hasAttacked = false;
            engine.state.phase = Phase.ATTACK;

            // Set up opponent for block
            const defender = placeUnit(engine, 'ST01-002', 1, true);
            defender.power = 1000;

            const initialDamage = damageCount(engine, true);

            engine.attack(1);
            engine.resolveBlock(true);

            // Should have penetration damage
            const finalDamage = damageCount(engine, true);
            expect(finalDamage).toBeGreaterThan(initialDamage);
        });
    });
});

describe('BT01 Fire Skills', () => {
    describe('BT01-020: Flame Assault (Grant Penetration)', () => {
        it('should grant Penetration to selected Attacker unit', () => {
            const engine = createGame('BT01-001');

            // Place unit with Attacker
            placeUnit(engine, 'BT01-002', 0);

            // Set leader level to ensure size limit is not hit
            setLeaderLevel(engine, 10);

            // Add skill to hand
            const skill = getCard('BT01-020');
            engine.currentPlayer.hand = [skill];
            engine.state.phase = Phase.MAIN;

            engine.playSkill(0);

            // Should be in target selection mode
            expect(engine.state.interactionMode).toBe('SELECT_TARGET');

            // Select the unit
            engine.selectTarget(0, false);

            // Verify effect was granted - attack and check penetration
            engine.currentPlayer.unitZones[0].hasAttacked = false;
            engine.state.phase = Phase.ATTACK;

            const defender = placeUnit(engine, 'ST01-002', 0, true);
            defender.power = 1000;

            const initialDamage = damageCount(engine, true);
            engine.attack(0);
            engine.resolveBlock(true);

            const finalDamage = damageCount(engine, true);
            expect(finalDamage).toBeGreaterThan(initialDamage);
        });
    });

    describe('BT01-021: Fire Storm (All enemies -1000)', () => {
        it('should reduce all opponent units power by 1000', () => {
            const engine = createGame('BT01-001');

            // Place multiple opponent units
            const opp1 = placeUnit(engine, 'ST01-002', 0, true);
            const opp2 = placeUnit(engine, 'ST01-002', 1, true);

            const basePower1 = opp1.power!;
            const basePower2 = getUnitPower(engine, 1, true);

            // Set leader level
            setLeaderLevel(engine, 10);

            // Play skill
            const skill = getCard('BT01-021');
            engine.currentPlayer.hand = [skill];
            engine.state.phase = Phase.MAIN;

            engine.playSkill(0);

            // Check power reduction
            expect(getUnitPower(engine, 0, true)).toBe(basePower1 - 1000);
            expect(getUnitPower(engine, 1, true)).toBe(basePower2 - 1000);
        });
    });

    describe('BT01-023: Battle Cry (Attacker units +2500)', () => {
        it('should buff all Attacker units by 2500', () => {
            const engine = createGame('BT01-001');

            // Place Attacker units
            const attacker = placeUnit(engine, 'BT01-002', 0);
            const basePower = getUnitPower(engine, 0);

            // Set leader level
            setLeaderLevel(engine, 10);

            // Play skill
            const skill = getCard('BT01-023');
            engine.currentPlayer.hand = [skill];
            engine.state.phase = Phase.MAIN;

            engine.playSkill(0);

            // Check power buff
            expect(getUnitPower(engine, 0)).toBe(basePower + 2500);
        });
    });

    describe('BT01-025: Tactical Retreat (Recover Attacker from trash)', () => {
        it('should move an Attacker unit from trash to hand', () => {
            const engine = createGame('BT01-001');

            // Put Attacker unit in trash
            const unit = getCard('BT01-002');
            engine.currentPlayer.trash = [unit];

            // Set leader level
            setLeaderLevel(engine, 10);

            // Play skill
            const skill = getCard('BT01-025');
            engine.currentPlayer.hand = [skill];
            engine.state.phase = Phase.MAIN;

            engine.playSkill(0);

            // Should be in target selection
            expect(engine.state.interactionMode).toBe('SELECT_TARGET');

            // Select the unit from trash
            engine.selectTrashTarget(0);

            // Unit should now be in hand
            expect(engine.currentPlayer.hand.some(c => c.id === 'BT01-002')).toBe(true);
            expect(engine.currentPlayer.trash.some(c => c.id === 'BT01-002')).toBe(false);
        });
    });
});

describe('BT01 Fire Items', () => {
    describe('BT01-026: Goddessium Glove (Penetration[1])', () => {
        it('should grant Penetration[1] to equipped unit', () => {
            const engine = createGame('BT01-001');

            // Place unit and equip item
            const unit = placeUnit(engine, 'ST01-002', 0);
            unit.power = 5000;
            equipItem(engine, 'BT01-026', 0);

            // Place defender
            const defender = placeUnit(engine, 'ST01-002', 0, true);
            defender.power = 1000;

            const initialDamage = damageCount(engine, true);

            engine.state.phase = Phase.ATTACK;
            engine.attack(0);
            engine.resolveBlock(true);

            // Should deal penetration damage
            const finalDamage = damageCount(engine, true);
            expect(finalDamage).toBe(initialDamage + 1);
        });
    });

    describe('BT01-027: Crimson Blade (+2000, Plunder[1])', () => {
        it('should grant +2000 power and Plunder[1] when attacking', () => {
            const engine = createGame('BT01-001');

            // Place unit and equip item
            const unit = placeUnit(engine, 'ST01-002', 0);
            const basePower = unit.power!;
            equipItem(engine, 'BT01-027', 0);

            engine.state.phase = Phase.ATTACK;
            engine.attack(0);

            // Check power buff
            const attackPower = getUnitPower(engine, 0);
            expect(attackPower).toBeGreaterThanOrEqual(basePower + 2000);

            // Check plunder
            const plunderValue = (engine as any).getPlunderValue(engine.currentPlayer.unitZones[0]);
            expect(plunderValue).toBeGreaterThanOrEqual(1);
        });
    });
});
