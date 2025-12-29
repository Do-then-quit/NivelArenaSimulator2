import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../src/logic/GameEngine';
import { Card, Phase, CardType } from '../src/logic/types';
import { DUMMY_CARDS } from '../src/logic/CardDatabase';
import { RuleValidator } from '../src/logic/RuleValidator';

function getCard(id: string): Card {
    const card = DUMMY_CARDS.find(c => c.id === id);
    if (!card) throw new Error(`Card ${id} not found`);
    return JSON.parse(JSON.stringify(card));
}

describe('ST01-013 Reinforcement Bug Reproduction', () => {
    let engine: GameEngine;

    beforeEach(() => {
        const leader1 = getCard('ST01-001');
        const leader2 = getCard('ST01-001');
        const deck1 = Array(40).fill(0).map((_, i) => ({...getCard('ST01-002'), id: `P1_C${i}`}));
        const deck2 = Array(40).fill(0).map((_, i) => ({...getCard('ST01-002'), id: `P2_C${i}`}));
        engine = new GameEngine('P1', 'P2', deck1, deck2, leader1, leader2);
        
        // Setup initial state
        engine.state.phase = Phase.MAIN;
        engine.currentPlayer.leaderLevel = 10;
    });

    it('should allow playing ST01-013 when a valid unit is in the trash', () => {
        const trashUnit = getCard('ST01-002'); // Cost 1 Unit
        engine.currentPlayer.trash = [trashUnit];
        
        const reinforcement = getCard('ST01-013');
        engine.currentPlayer.hand = [reinforcement];

        const validation = RuleValidator.canPlaySkill(engine, engine.currentPlayer, 0);
        
        // This is expected to fail currently with "No valid targets for effect"
        expect(validation.valid).toBe(true);
        expect(validation.reason).toBeUndefined();
    });

    it('should NOT allow playing ST01-013 when NO valid unit is in the trash', () => {
        engine.currentPlayer.trash = []; // Empty trash
        
        const reinforcement = getCard('ST01-013');
        engine.currentPlayer.hand = [reinforcement];

        const validation = RuleValidator.canPlaySkill(engine, engine.currentPlayer, 0);
        
        expect(validation.valid).toBe(false);
        expect(validation.reason).toBe("No valid targets for effect");
    });
    
    it('should NOT allow playing ST01-013 when only high cost units are in the trash', () => {
        const highCostUnit = getCard('ST01-009'); // Emma, Cost 5
        engine.currentPlayer.trash = [highCostUnit];
        
        const reinforcement = getCard('ST01-013');
        engine.currentPlayer.hand = [reinforcement];

        const validation = RuleValidator.canPlaySkill(engine, engine.currentPlayer, 0);
        
        expect(validation.valid).toBe(false);
        expect(validation.reason).toBe("No valid targets for effect");
    });
});
