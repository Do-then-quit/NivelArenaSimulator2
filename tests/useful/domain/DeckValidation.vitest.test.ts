import { describe, it, expect, beforeEach } from 'vitest';
import { DeckBuilderLogic } from '../../../src/logic/DeckBuilderLogic';
import { DUMMY_CARDS } from '../../../src/logic/CardDatabase';
import { CardType } from '../../../src/logic/types';

describe('DeckValidation', () => {
    let logic: DeckBuilderLogic;

    beforeEach(() => {
        logic = new DeckBuilderLogic(DUMMY_CARDS);
    });

    it('should validate deck size (must be 40)', () => {
        const unit = DUMMY_CARDS.find(c => c.type === CardType.UNIT)!;
        
        // Add 39 cards
        for (let i = 0; i < 39; i++) logic.addCardToDeck(unit.id);
        expect(logic.validateDeck().valid).toBe(false);
        expect(logic.validateDeck().errors).toContain('Deck must contain exactly 40 cards.');

        // Add 40th card
        logic.addCardToDeck(unit.id);
        // Note: This test assumes we haven't implemented max copy check yet or we ignore it for this specific test case, 
        // but strictly validation should fail on max copies too. 
        // To isolate, let's pretend we add 40 unique cards if possible, or expect multiple errors.
        
        // Let's use different cards to avoid max copy error if possible, 
        // or just check for the ABSENCE of the size error.
        
        const errors = logic.validateDeck().errors;
        expect(errors).not.toContain('Deck must contain exactly 40 cards.');
    });

    it('should validate max copies (max 3)', () => {
        const unit = DUMMY_CARDS.find(c => c.type === CardType.UNIT)!;
        
        // Add 3 copies
        for (let i = 0; i < 3; i++) logic.addCardToDeck(unit.id);
        expect(logic.validateDeck().errors.some(e => e.includes('Max 3 copies'))).toBe(false);

        // Add 4th copy
        logic.addCardToDeck(unit.id);
        expect(logic.validateDeck().errors.some(e => e.includes('Max 3 copies'))).toBe(true);
    });

    it('should validate leader presence', () => {
        // No leader set
        expect(logic.validateDeck().errors).toContain('Deck must have a Leader.');

        // Set leader
        const leader = DUMMY_CARDS.find(c => c.type === CardType.LEADER)!;
        logic.setLeader(leader.id);
        expect(logic.validateDeck().errors).not.toContain('Deck must have a Leader.');
    });
});
