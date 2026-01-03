import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../src/logic/GameEngine';
import { Card, CardType, ActivationCondition } from '../src/logic/types';

describe('BT01-072 Modernia: Second Affection (Golden Sample - Dynamic Effect Granting)', () => {
    let game: GameEngine;
    let modernia: Card;
    let genericUnit: Card;

    beforeEach(() => {
        // Mock Modernia Card
        modernia = {
            id: 'BT01-072',
            name: 'Modernia',
            type: CardType.UNIT,
            cost: 7,
            power: 7000,
            hit: 3,
            effects: [
                {
                    activation: ActivationCondition.PASSIVE,
                    description: "Passive: All other friendly units gain 'Exit: Draw 1'",
                    targets: {
                        scope: 'MY_FIELD', 
                        filters: [
                            { type: 'EXCLUDE_SELF' }
                        ],
                        selectMode: 'ALL',
                        type: 'UNIT'
                    },
                    action: {
                        type: 'GRANT_EFFECT',
                        params: {
                            effect: {
                                activation: ActivationCondition.EXIT,
                                description: "Granted: Exit: Draw 1",
                                action: {
                                    type: 'DRAW',
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

        // Ensure deck has enough cards so initial draw doesn't empty it completely
        const deck1 = Array(10).fill(null).map((_, i) => ({ ...genericUnit, id: `G1-${i}` }));
        const deck2 = Array(10).fill(null).map((_, i) => ({ ...genericUnit, id: `G2-${i}` }));
        const leader = { id: 'L001', name: 'Leader', type: CardType.LEADER, cost: 0, power: 0, hit: 0 } as any;

        game = new GameEngine('Player1', 'Player2', deck1, deck2, leader, leader);
    });

    it('should grant "Exit: Draw 1" to other friendly units when Modernia is on the field', () => {
        const player = game.currentPlayer;
        
        // 1. Setup Board
        // Place Modernia in Zone 0
        player.unitZones[0].unit = modernia;
        // Place Generic Unit in Zone 1
        player.unitZones[1].unit = genericUnit;

        const initialHandSize = player.hand.length;

        // 2. Destroy Generic Unit
        // We simulate destruction (Combat or Effect). destroyUnit is the standard way.
        game.destroyUnit(player, player.unitZones[1]);

        // 3. Assert Draw
        // Should have drawn 1 card due to the granted effect
        expect(player.hand.length).toBe(initialHandSize + 1);
    });

    it('should NOT grant effect to itself', () => {
        const player = game.currentPlayer;
        
        // Place Modernia in Zone 0
        player.unitZones[0].unit = modernia;

        const initialHandSize = player.hand.length;

        // Destroy Modernia
        game.destroyUnit(player, player.unitZones[0]);

        // Should NOT draw (unless it had another effect, but here it shouldn't)
        expect(player.hand.length).toBe(initialHandSize);
    });

    it('should NOT grant effect if Modernia is not on the field', () => {
        const player = game.currentPlayer;
        
        // Place ONLY Generic Unit
        player.unitZones[1].unit = genericUnit;

        const initialHandSize = player.hand.length;

        // Destroy Generic Unit
        game.destroyUnit(player, player.unitZones[1]);

        // Should NOT draw
        expect(player.hand.length).toBe(initialHandSize);
    });
});
