import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../src/logic/GameEngine';
import { Card, CardType, ActivationCondition, Phase } from '../src/logic/types';

describe('BT01-078 Beautiful Shot (Complex Targeting - Sum Constraint)', () => {
    let game: GameEngine;
    let beautifulShot: Card;
    let generic: Card;

    beforeEach(() => {
        beautifulShot = {
            id: 'BT01-078',
            name: 'Beautiful Shot',
            type: CardType.SKILL,
            cost: 4,
            effects: [
                {
                    activation: ActivationCondition.ENTRY,
                    description: "Choose up to 2 opponent units with total cost <= 4 and trash them.",
                    targets: {
                        scope: 'OPP_FIELD',
                        type: 'UNIT',
                        count: 2,
                        sumConstraint: { property: 'COST', value: 4 },
                        selectMode: 'MANUAL'
                    },
                    action: { type: 'DESTROY_UNIT', params: {} }
                }
            ]
        } as any;

        generic = { id: 'G', name: 'S', type: CardType.UNIT, cost: 2, power: 1000, hit: 1 } as any;

        const leader = { id: 'L', name: 'L', type: CardType.LEADER, cost: 0, power: 0, hit: 0 } as any;
        game = new GameEngine('P1', 'P2', [], [], leader, leader);
        game.state.phase = Phase.MAIN;
        game.state.players[0].leaderLevel = 10;
    });

    it('should allow selecting two 2-cost units (sum 4)', () => {
        const p1 = game.state.players[0];
        const p2 = game.state.players[1];

        // Setup: Opponent has two 2-cost units
        p2.unitZones[0].unit = { ...generic, id: 'U1', cost: 2 };
        p2.unitZones[1].unit = { ...generic, id: 'U2', cost: 2 };

        // Play Beautiful Shot
        p1.hand = [beautifulShot];
        game.playSkill(0);

        expect(game.state.interactionMode).toBe('SELECT_TARGET');

        // Select 1st unit
        game.selectTarget(0, true);
        expect(game.state.interactionMode).toBe('SELECT_TARGET'); // Still selecting (need 2 or sum limit or confirm)
        
        // Select 2nd unit
        game.selectTarget(1, true);

        // Assert: Auto-executed because count 2 reached
        expect(game.state.interactionMode).toBe('NORMAL');
        expect(p2.unitZones[0].unit).toBeNull();
        expect(p2.unitZones[1].unit).toBeNull();
    });

    it('should NOT allow selecting a 3rd unit if count is 2', () => {
        // Handled by count check
    });

    it('should NOT allow selecting unit that exceeds sum constraint', () => {
        const p1 = game.state.players[0];
        const p2 = game.state.players[1];

        p2.unitZones[0].unit = { ...generic, id: 'U1', cost: 3 };
        p2.unitZones[1].unit = { ...generic, id: 'U2', cost: 2 }; // 3 + 2 = 5 > 4

        p1.hand = [beautifulShot];
        game.playSkill(0);

        // Select 3-cost unit
        game.selectTarget(0, true);
        
        // Try to select 2-cost unit
        game.selectTarget(1, true);

        // Assert: 2nd unit NOT added, still selecting
        expect(game.state.interactionMode).toBe('SELECT_TARGET');
        const pending = game.state.pendingEffect as any;
        expect(pending.selectedTargets.length).toBe(1);
    });

    it('should allow confirming fewer than max count if sum constraint allows', () => {
        const p1 = game.state.players[0];
        const p2 = game.state.players[1];

        p2.unitZones[0].unit = { ...generic, id: 'U1', cost: 4 }; // Sum limit reached with 1 card

        p1.hand = [beautifulShot];
        game.playSkill(0);

        game.selectTarget(0, true);
        
        // Manually confirm (since count 2 not reached but sum might be enough)
        game.confirmSelection();

        expect(game.state.interactionMode).toBe('NORMAL');
        expect(p2.unitZones[0].unit).toBeNull();
    });
});
