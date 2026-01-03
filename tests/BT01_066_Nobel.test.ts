import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../src/logic/GameEngine';
import { Card, CardType, ActivationCondition, Phase } from '../src/logic/types';

describe('BT01-066 Nobel (Opponent Interaction - Forced Discard)', () => {
    let game: GameEngine;
    let nobel: Card;
    let fodder: Card;

    beforeEach(() => {
        nobel = {
            id: 'BT01-066',
            name: 'Nobel',
            type: CardType.UNIT,
            cost: 4,
            power: 4000,
            hit: 2,
            effects: [
                {
                    activation: ActivationCondition.EXIT,
                    description: "Exit: Opponent discards 1 if hand >= 3",
                    condition: { type: 'OPPONENT_HAND_COUNT', value: 3 },
                    targets: {
                        scope: 'OPP_HAND',
                        type: 'CARD',
                        selectMode: 'MANUAL',
                        count: 1
                    },
                    action: {
                        type: 'DISCARD',
                        params: { target: 'OPPONENT' }
                    }
                }
            ]
        } as any;

        fodder = { id: 'FODDER', name: 'Fodder', type: CardType.UNIT, cost: 0 } as any;

        const leader = { id: 'L', name: 'L', type: CardType.LEADER, cost: 0, power: 0, hit: 0 } as any;
        game = new GameEngine('P1', 'P2', [], [], leader, leader);
        game.state.phase = Phase.MAIN;
    });

    it('should force opponent to discard if they have 3+ cards when Nobel is trashed', () => {
        const p1 = game.state.players[0];
        const p2 = game.state.players[1];

        // Setup: Nobel on P1 Field
        p1.unitZones[0].unit = nobel;

        // Setup: P2 has 3 cards in hand
        p2.hand = [
            { ...fodder, id: 'C1' },
            { ...fodder, id: 'C2' },
            { ...fodder, id: 'C3' }
        ];

        // Trash Nobel (to trigger Exit)
        game.destroyUnit(p1, p1.unitZones[0]);

        // Assert: Interaction Mode is SELECT_TARGET
        expect(game.state.interactionMode).toBe('SELECT_TARGET');
        
        // Assert: Selector is P2
        expect(game.state.pendingEffect?.selectorPlayerId).toBe(p2.id);
        expect(game.state.pendingEffect?.validTargets).toBe('OPP_HAND');

        // Execute Discard: P2 selects their hand index 0
        game.selectHandTarget(0, true); // isOpponentHand=true from P1 perspective

        // Assert: Hand reduced, Mode Normal
        expect(p2.hand.length).toBe(2);
        expect(game.state.interactionMode).toBe('NORMAL');
    });

    it('should NOT trigger if opponent has less than 3 cards', () => {
        const p1 = game.state.players[0];
        const p2 = game.state.players[1];

        p1.unitZones[0].unit = nobel;
        p2.hand = [{ ...fodder, id: 'C1' }]; // Only 1 card

        game.destroyUnit(p1, p1.unitZones[0]);

        // Assert: Mode stays Normal
        expect(game.state.interactionMode).toBe('NORMAL');
        expect(p2.hand.length).toBe(1);
    });
});
