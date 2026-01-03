import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../src/logic/GameEngine';
import { Card, CardType, ActivationCondition, Phase } from '../src/logic/types';

describe('BT01 Termination (종결) Mechanic', () => {
    let game: GameEngine;
    let maiden: Card; // Defender: Termination
    let attacker: Card;

    beforeEach(() => {
        maiden = {
            id: 'BT01-058',
            name: 'Maiden',
            type: CardType.UNIT,
            cost: 1,
            power: 3500,
            hit: 1,
            effects: [
                {
                    activation: ActivationCondition.DEFENDER,
                    description: "Defender: Termination (Immediately end this attack and trash this unit)",
                    action: { type: 'TERMINATE_ATTACK', params: {} }
                }
            ]
        } as any;

        attacker = { id: 'A', name: 'Attacker', type: CardType.UNIT, cost: 2, power: 5000, hit: 1 } as any;

        const leader = { id: 'L', name: 'L', type: CardType.LEADER, cost: 0, power: 0, hit: 0 } as any;
        game = new GameEngine('P1', 'P2', [], [], leader, leader);
    });

    it('should terminate attack immediately when Maiden defends', () => {
        const p1 = game.state.players[0];
        const p2 = game.state.players[1];

        // Setup: P1 Attacker vs P2 Maiden
        p1.unitZones[0].unit = attacker;
        p2.unitZones[0].unit = maiden;

        game.state.turnPlayerIndex = 0;
        game.state.phase = Phase.ATTACK;

        // 1. Attack
        game.attack(0);
        expect(game.state.phase).toBe(Phase.BLOCK);

        // 2. Resolve Block (P2 chooses to block)
        game.resolveBlock(true);

        // Assert: 
        // - Maiden is trashed
        // - Attacker is still on field (not dead from combat)
        // - Opponent (P2) took NO damage
        // - Phase back to ATTACK
        expect(p2.unitZones[0].unit).toBeNull();
        expect(p1.unitZones[0].unit).not.toBeNull();
        expect(p2.damage.length).toBe(0);
        expect(game.state.phase).toBe(Phase.ATTACK);
    });
});
