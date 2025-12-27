import { describe, it, expect } from 'vitest';
import { createDeck } from '../src/logic/CardDatabase';

describe('CardDatabase (Vitest)', () => {
    it('should create a deck with 40 cards', () => {
        const deck = createDeck();
        expect(deck.length).toBe(40);
    });
});
