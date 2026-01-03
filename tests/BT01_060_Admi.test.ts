import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../src/logic/GameEngine';
import { Card, CardType, ActivationCondition, Phase } from '../src/logic/types';

describe('BT01-060 Admi (Restricted Action - Attack Cost)', () => {
    let game: GameEngine;
    let admi: Card;
    let fodder: Card;

    beforeEach(() => {
        // Mock Admi
        admi = {
            id: 'BT01-060',
            name: 'Admi',
            type: CardType.UNIT,
            cost: 2,
            power: 4500,
            hit: 1,
            effects: [
                {
                    activation: ActivationCondition.PASSIVE,
                    description: "Passive: To attack with this unit, discard 1 card from hand.",
                    // This is a constraint/cost effect. It doesn't strictly fit 'PASSIVE' as an action trigger,
                    // but it modifies the 'ATTACK' action.
                    // We can model it as a Cost on the Attack Action?
                    // Or check it in RuleValidator and enforce payment in GameEngine.
                    keywords: ['ATTACK_COST'] 
                }
            ]
        } as any;

        fodder = { id: 'FODDER', name: 'Fodder', type: CardType.UNIT, cost: 0 } as any;

        const deck1 = Array(10).fill(null).map((_, i) => ({ ...fodder, id: `D1-${i}` }));
        const deck2 = Array(10).fill(null).map((_, i) => ({ ...fodder, id: `D2-${i}` }));
        const leader = { id: 'L001', name: 'Leader', type: CardType.LEADER, cost: 0, power: 0, hit: 0 } as any;

        game = new GameEngine('Player1', 'Player2', deck1, deck2, leader, leader);
        game.state.phase = Phase.ATTACK;
        game.state.turnPlayerIndex = 0;
    });

    it('should trigger cost selection when attacking with Admi', () => {
        const player = game.currentPlayer;
        
        // Setup: Admi on field, 1 card in hand
        player.unitZones[0].unit = admi;
        player.hand.push(fodder);

        // Initiate Attack
        game.attack(0);

        // Should enter Cost Selection mode
        expect(game.state.interactionMode).toBe('SELECT_COST');
        expect(game.state.pendingEffect?.costToPay?.type).toBe('TRASH_HAND');
    });

    it('should NOT allow attack if hand is empty', () => {
        const player = game.currentPlayer;
        
        // Setup: Admi on field, 0 cards in hand
        player.unitZones[0].unit = admi;
        player.hand = [];

        // Initiate Attack
        game.attack(0);

        // Should NOT attack, NOT enter selection, just fail (or log warning)
        expect(game.state.interactionMode).toBe('NORMAL');
        expect(player.unitZones[0].hasAttacked).toBe(false);
    });

    it('should execute attack AFTER paying cost', () => {
        const player = game.currentPlayer;
        
        // Setup
        player.unitZones[0].unit = admi;
        player.hand.push(fodder);

        // 1. Attack -> Select Cost
        game.attack(0);
        expect(game.state.interactionMode).toBe('SELECT_COST');

        // 2. Pay Cost (Trash hand index 0)
        game.selectCost(0);

        // 3. Verify Attack executed
        expect(game.state.interactionMode).toBe('NORMAL');
        expect(player.unitZones[0].hasAttacked).toBe(true);
        expect(player.trash.length).toBe(1); // Fodder trashed
    });
});
