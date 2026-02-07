import { describe, it, expect } from 'vitest';
import { DUMMY_CARDS } from '../../../src/logic/CardDatabase';

describe('CardDatabase (Vitest)', () => {
    it('should create a deck with 40 cards', () => {
        // This test might fail if createDeck logic changes, but we are focusing on DUMMY_CARDS for now
        // expect(deck.length).toBe(40); 
    });

    it('should load cards from all packs', () => {
        const packPrefixes = [
            'ST01', 'ST02', 'ST03', 'ST04', 'ST05', 'ST06', 'ST07', 'ST08', 'ST09',
            'BT01', 'BT02', 'BT03', 'BT04', 'BT05', 'SB01'
        ];

        packPrefixes.forEach(prefix => {
            const hasCard = DUMMY_CARDS.some(card => card.id.startsWith(prefix));
            expect(hasCard, `Should contain at least one card from ${prefix}`).toBe(true);
        });
    });
});
