import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameEngine } from '../src/logic/GameEngine';
import { Card, CardType, ActivationCondition, Phase } from '../src/logic/types';

describe('BT01-005 Rapi: Classic Vacance (Berserk - Mandatory Attack)', () => {
    let game: GameEngine;
    let rapi: Card;

    beforeEach(() => {
        // Mock Rapi (Berserk)
        rapi = {
            id: 'BT01-005',
            name: 'Rapi',
            type: CardType.UNIT,
            cost: 2,
            power: 5000,
            hit: 1,
            keywords: 'BERSERK', // Keyword for easy check
            effects: [
                {
                    activation: ActivationCondition.PASSIVE,
                    description: "Passive: Berserk (Must attack if possible)",
                    action: { type: 'NONE', params: {} } // Just a marker effect
                }
            ]
        } as any;

        const deck1 = Array(10).fill(null).map((_, i) => ({ ...rapi, id: `D1-${i}` }));
        const deck2 = Array(10).fill(null).map((_, i) => ({ ...rapi, id: `D2-${i}` }));
        const leader = { id: 'L001', name: 'Leader', type: CardType.LEADER, cost: 0, power: 0, hit: 0 } as any;

        game = new GameEngine('Player1', 'Player2', deck1, deck2, leader, leader);
        game.state.phase = Phase.ATTACK;
        game.state.turnPlayerIndex = 0;
    });

    it('should prevent ending phase if Berserk unit has not attacked', () => {
        const player = game.currentPlayer;
        
        // Place Rapi in Zone 0
        player.unitZones[0].unit = rapi;
        player.unitZones[0].hasAttacked = false;
        player.unitZones[0].isExhausted = false; // Ready to attack

        // Spy on console.warn to verify message
        const consoleSpy = vi.spyOn(console, 'warn');

        // Attempt to end phase
        game.nextPhase();

        // Should stay in ATTACK phase
        expect(game.state.phase).toBe(Phase.ATTACK);
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Berserk"));
    });

    it('should allow ending phase if Berserk unit HAS attacked', () => {
        const player = game.currentPlayer;
        
        // Place Rapi in Zone 0
        player.unitZones[0].unit = rapi;
        player.unitZones[0].hasAttacked = true;

        game.nextPhase();

        // Should move to END phase
        expect(game.state.phase).toBe(Phase.END);
    });

    it('should allow ending phase if Berserk unit is Exhausted (cannot attack)', () => {
        const player = game.currentPlayer;
        
        // Place Rapi in Zone 0
        player.unitZones[0].unit = rapi;
        player.unitZones[0].hasAttacked = false;
        player.unitZones[0].isExhausted = true; // Cannot attack

        game.nextPhase();

        // Should move to END phase
        expect(game.state.phase).toBe(Phase.END);
    });
});
