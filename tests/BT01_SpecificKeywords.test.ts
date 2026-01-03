import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../src/logic/GameEngine';
import { Card, CardType, ActivationCondition, Phase } from '../src/logic/types';

describe('BT01 Specific Keywords (Frontline Construction & Level Link)', () => {
    let game: GameEngine;
    let mica: Card; // Frontline: Power+3000
    let rupee: Card; // Level Link 10: Hit+1
    let generic: Card;

    beforeEach(() => {
        mica = {
            id: 'BT01-030',
            name: 'Mica',
            type: CardType.UNIT,
            cost: 1,
            power: 2000,
            hit: 1,
            effects: [
                {
                    activation: ActivationCondition.PASSIVE,
                    description: "Passive: Frontline Construction [Power+3000] (If all unit zones have units, Power+3000)",
                    condition: { type: 'FRONTLINE_CONSTRUCTION', value: {} },
                    action: { type: 'BUFF_POWER', params: { value: 3000 } }
                }
            ]
        } as any;

        rupee = {
            id: 'BT01-040',
            name: 'Rupee',
            type: CardType.UNIT,
            cost: 4,
            power: 4000,
            hit: 2,
            effects: [
                {
                    activation: ActivationCondition.PASSIVE,
                    description: "Passive: Level Link [10: Hit+1]",
                    condition: { type: 'LEADER_LEVEL', value: 10 },
                    action: { type: 'BUFF_HIT', params: { value: 1 } }
                }
            ]
        } as any;

        generic = { id: 'G', name: 'Soldier', type: CardType.UNIT, cost: 1, power: 1000, hit: 1 } as any;

        const leader = { id: 'L', name: 'L', type: CardType.LEADER, cost: 0, power: 0, hit: 0 } as any;
        game = new GameEngine('P1', 'P2', [], [], leader, leader);
    });

    it('should apply Frontline Construction bonus only when all zones are filled', () => {
        const player = game.currentPlayer;
        player.unitZones[0].unit = mica;
        
        // Initial: Only 1 zone filled -> No bonus
        expect(game.getUnitPower(player.unitZones[0], player)).toBe(2000);

        // Fill 2nd zone
        player.unitZones[1].unit = generic;
        expect(game.getUnitPower(player.unitZones[0], player)).toBe(2000);

        // Fill 3rd zone (Full Frontline)
        player.unitZones[2].unit = generic;
        expect(game.getUnitPower(player.unitZones[0], player)).toBe(5000); // 2000 + 3000

        // Remove one
        player.unitZones[1].unit = null;
        expect(game.getUnitPower(player.unitZones[0], player)).toBe(2000);
    });

    it('should apply Level Link bonus based on leader level', () => {
        const player = game.currentPlayer;
        player.unitZones[0].unit = rupee;
        
        // Initial: Level 1 -> No bonus
        player.leaderLevel = 1;
        expect(game.getUnitHit(player.unitZones[0], player)).toBe(2);

        // Level 9 -> No bonus
        player.leaderLevel = 9;
        expect(game.getUnitHit(player.unitZones[0], player)).toBe(2);

        // Level 10 -> Hit+1
        player.leaderLevel = 10;
        expect(game.getUnitHit(player.unitZones[0], player)).toBe(3);
    });
});
