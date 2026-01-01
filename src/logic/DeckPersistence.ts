export interface SavedDeck {
    id: string;
    name: string;
    leaderId: string | null;
    cardIds: string[];
}

export class DeckPersistence {
    static STORAGE_KEY = 'nivelarena_decks';

    static saveDeck(deck: SavedDeck): void {
        const decks = this.getAllDecks();
        const index = decks.findIndex(d => d.id === deck.id);

        if (index >= 0) {
            decks[index] = deck;
        } else {
            decks.push(deck);
        }

        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(decks));
    }

    static getDeck(id: string): SavedDeck | null {
        const decks = this.getAllDecks();
        return decks.find(d => d.id === id) || null;
    }

    static getAllDecks(): SavedDeck[] {
        const raw = localStorage.getItem(this.STORAGE_KEY);
        if (!raw) return [];
        try {
            return JSON.parse(raw);
        } catch (e) {
            console.error('Failed to parse decks from localStorage', e);
            return [];
        }
    }

    static deleteDeck(id: string): void {
        const decks = this.getAllDecks();
        const filtered = decks.filter(d => d.id !== id);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
    }
}
