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

    it('should handle trash selection interaction correctly', () => {
        const trashUnit = getCard('ST01-002'); // Cost 1 Unit
        engine.currentPlayer.trash = [trashUnit];
        
        const reinforcement = getCard('ST01-013');
        engine.currentPlayer.hand = [reinforcement];

        // 1. Play Skill
        engine.playSkill(0);
        
        // 2. Verify State: Should be in SELECT_TARGET mode with MY_TRASH scope
        expect(engine.state.interactionMode).toBe('SELECT_TARGET');
        expect(engine.state.pendingEffect).toBeDefined();
        if (engine.state.pendingEffect) {
            expect(engine.state.pendingEffect.validTargets).toBe('MY_TRASH');
        }

        // 3. Select Trash Target (Simulate UI Action)
        (engine as any).selectTrashTarget(0);

        // 4. Verify Effect Execution: Card moved to hand, effect finished
        expect(engine.state.interactionMode).toBe('NORMAL');
        expect(engine.state.pendingEffect).toBeNull();
        expect(engine.currentPlayer.hand.length).toBe(1); // The retrieved unit
        expect(engine.currentPlayer.hand[0].id).toBe(trashUnit.id);
        expect(engine.currentPlayer.trash.length).toBe(0); // The unit moved out, skill is in skill zone
        expect(engine.currentPlayer.skillZone.length).toBe(1);
        expect(engine.currentPlayer.skillZone[0].id).toBe(reinforcement.id);
    });
});
