import { describe, it, expect, beforeEach } from 'vitest';
import { DeckPersistence, SavedDeck } from '../../../src/logic/DeckPersistence';

describe('DeckPersistence', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('should save and load a deck', () => {
        const deck: SavedDeck = {
            id: 'deck-1',
            name: 'My Custom Deck',
            cardIds: ['ST01-001', 'ST01-002']
        };

        DeckPersistence.saveDeck(deck);
        const loaded = DeckPersistence.getDeck('deck-1');

        expect(loaded).toEqual(deck);
    });

    it('should get all saved decks', () => {
        const deck1: SavedDeck = { id: 'd1', name: 'Deck 1', cardIds: [] };
        const deck2: SavedDeck = { id: 'd2', name: 'Deck 2', cardIds: [] };

        DeckPersistence.saveDeck(deck1);
        DeckPersistence.saveDeck(deck2);

        const all = DeckPersistence.getAllDecks();
        expect(all.length).toBe(2);
        expect(all).toEqual(expect.arrayContaining([deck1, deck2]));
    });

    it('should delete a deck', () => {
        const deck: SavedDeck = { id: 'd1', name: 'Delete Me', cardIds: [] };
        DeckPersistence.saveDeck(deck);
        
        DeckPersistence.deleteDeck('d1');
        const loaded = DeckPersistence.getDeck('d1');
        
        expect(loaded).toBeNull();
    });

    it('should update an existing deck', () => {
        const deck: SavedDeck = { id: 'd1', name: 'Original', cardIds: [] };
        DeckPersistence.saveDeck(deck);

        const updated: SavedDeck = { ...deck, name: 'Updated' };
        DeckPersistence.saveDeck(updated);

        const loaded = DeckPersistence.getDeck('d1');
        expect(loaded?.name).toBe('Updated');
    });
});
