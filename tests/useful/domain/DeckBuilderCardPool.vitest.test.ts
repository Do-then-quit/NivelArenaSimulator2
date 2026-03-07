import { describe, it, expect } from 'vitest';
import { DUMMY_CARDS } from '../../../src/logic/CardDatabase';
import { DECK_BUILDER_ALLOWED_PACKS, getDeckBuilderCards } from '../../../src/logic/DeckBuilderCardPool';

describe('DeckBuilderCardPool', () => {
    it('uses the expected pack allow list', () => {
        expect(DECK_BUILDER_ALLOWED_PACKS).toEqual(['ST01', 'ST02', 'ST03', 'ST04', 'ST05', 'ST06', 'ST10', 'ST11', 'BT01', 'BT02', 'BT03', 'BT04', 'BT06', 'SB01']);
    });

    it('returns only cards from allowed pack prefixes', () => {
        const cards = getDeckBuilderCards(DUMMY_CARDS);
        expect(cards.length).toBeGreaterThan(0);
        expect(cards.every(card => DECK_BUILDER_ALLOWED_PACKS.some(pack => card.id.startsWith(`${pack}-`)))).toBe(true);
    });

    it('includes BT04 cards after pack implementation is complete', () => {
        const cards = getDeckBuilderCards(DUMMY_CARDS);
        expect(cards.some(card => card.id.startsWith('BT04-'))).toBe(true);
    });

    it('includes ST05, ST06, ST10, ST11, BT02, BT03, BT04, BT06, and SB01 cards', () => {
        const cards = getDeckBuilderCards(DUMMY_CARDS);
        expect(cards.some(card => card.id.startsWith('ST05-'))).toBe(true);
        expect(cards.some(card => card.id.startsWith('ST06-'))).toBe(true);
        expect(cards.some(card => card.id.startsWith('ST10-'))).toBe(true);
        expect(cards.some(card => card.id.startsWith('ST11-'))).toBe(true);
        expect(cards.some(card => card.id.startsWith('BT02-'))).toBe(true);
        expect(cards.some(card => card.id.startsWith('BT03-'))).toBe(true);
        expect(cards.some(card => card.id.startsWith('BT04-'))).toBe(true);
        expect(cards.some(card => card.id.startsWith('BT06-'))).toBe(true);
        expect(cards.some(card => card.id.startsWith('SB01-'))).toBe(true);
    });
});
