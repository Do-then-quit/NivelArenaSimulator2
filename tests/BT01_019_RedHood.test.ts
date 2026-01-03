import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../src/logic/GameEngine';
import { Card, CardType, ActivationCondition, Phase } from '../src/logic/types';

describe('BT01-019 Red Hood: Unit (Dynamic Granting - Temporary)', () => {
    let game: GameEngine;
    let redHood: Card;
    let genericUnit: Card;

    beforeEach(() => {
        // Mock Red Hood
        redHood = {
            id: 'BT01-019',
            name: 'Red Hood',
            type: CardType.UNIT,
            cost: 8,
            power: 7000,
            hit: 3,
            effects: [
                {
                    activation: ActivationCondition.ENTRY,
                    description: "Entry: All friendly units gain 'Attacker: Penetration[1]' until end of turn.",
                    targets: {
                        scope: 'MY_FIELD',
                        type: 'UNIT',
                        selectMode: 'ALL'
                    },
                    action: {
                        type: 'GRANT_EFFECT',
                        params: {
                            duration: 'TURN_END',
                            effect: {
                                activation: ActivationCondition.ATTACKER,
                                description: "Granted: Penetration[1]",
                                action: {
                                    type: 'PENETRATION',
                                    params: { value: 1 }
                                }
                            }
                        }
                    }
                }
            ]
        } as any;

        // Mock Generic Unit
        genericUnit = {
            id: 'GENERIC-001',
            name: 'Soldier',
            type: CardType.UNIT,
            cost: 2,
            power: 3000,
            hit: 1,
            effects: []
        } as any;

        const deck1 = Array(10).fill(null).map((_, i) => ({ ...genericUnit, id: `G1-${i}` }));
        const deck2 = Array(10).fill(null).map((_, i) => ({ ...genericUnit, id: `G2-${i}` }));
        const leader = { id: 'L001', name: 'Leader', type: CardType.LEADER, cost: 0, power: 0, hit: 0 } as any;

        game = new GameEngine('Player1', 'Player2', deck1, deck2, leader, leader);
        
        // Force MAIN Phase and adequate Level for all tests
        game.state.phase = Phase.MAIN;
        game.state.players[0].leaderLevel = 10; // Ensure enough level/cost
    });

    it('should grant "Attacker: Penetration[1]" to all units upon Entry', () => {
        const player = game.currentPlayer;
        
        // Setup Board: Generic Unit in Zone 1
        player.unitZones[1].unit = genericUnit;
        
        // Add Red Hood to Hand
        player.hand.push(redHood);

        // Play Red Hood to Zone 0
        game.playUnit(player.hand.indexOf(redHood), 0);

        // Check if Generic Unit has the granted effect
        const zone1 = player.unitZones[1];
        expect(zone1.grantedEffects).toBeDefined();
        expect(zone1.grantedEffects?.length).toBe(1);
        expect(zone1.grantedEffects?.[0].description).toContain("Penetration");
    });

    it('should trigger the granted effect during attack', () => {
        const player = game.currentPlayer;
        const opponent = game.opponentPlayer;

        // Setup Board
        player.unitZones[1].unit = genericUnit;
        player.hand.push(redHood);
        
        // Play Red Hood
        game.playUnit(player.hand.indexOf(redHood), 0);

        // Advance to Attack Phase
        game.state.phase = Phase.ATTACK;

        // Attack with Generic Unit (Zone 1) -> Direct Attack to Opponent
        const initialOppDamage = opponent.damage.length;
        
        // Mock Penetration action to verify it runs
        // Penetration logic usually adds damage to opponent.
        // But Penetration only triggers on Kill? 
        // Wait, standard Penetration keyword is "Deal damage equal to Hit/Value to opponent when killing unit".
        // The card text says "Attacker: Penetration[1]". 
        // If attacking directly, Penetration does nothing.
        // We need an opponent unit to kill.
        
        // Add Opponent Unit
        opponent.unitZones[1].unit = { ...genericUnit, power: 1000, id: 'OPP-001' } as any; // Weaker unit

        game.attack(1); // Generic (3000) attacks Opp (1000)

        // Combat resolves immediately (no block phase if force attack? or block phase skipped if no blocker? Logic is tricky)
        // If opponent has unit, we go to BLOCK phase.
        expect(game.state.phase).toBe(Phase.BLOCK);
        
        // Opponent blocks (forced or choice)
        game.resolveBlock(true); // Block with the unit

        // Combat: 3000 vs 1000. Opponent dies.
        // Penetration[1] should trigger.
        // Normal damage (Hit 1) + Penetration (1) = Total ??
        // No, Penetration deals damage to PLAYER.
        
        // Opponent should have:
        // 1. Trashed unit (Combat)
        // 2. Taken 1 damage (Penetration)
        expect(opponent.unitZones[1].unit).toBeNull();
        expect(opponent.damage.length).toBe(initialOppDamage + 1);
    });

    it('should remove the granted effect at Turn End', () => {
        const player = game.currentPlayer;
        
        // Setup
        player.unitZones[1].unit = genericUnit;
        player.hand.push(redHood);
        game.playUnit(player.hand.indexOf(redHood), 0);

        const zone1 = player.unitZones[1];
        expect(zone1.grantedEffects?.length).toBe(1);

        // End Phase -> End Turn
        game.state.phase = Phase.ATTACK; // Skip to Attack
        game.nextPhase(); // To End
        // nextPhase calls endPhase() which clears buffs

        expect(zone1.grantedEffects?.length).toBe(0);
    });
});
