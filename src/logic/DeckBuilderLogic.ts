import { Card, CardType, Attribute } from './types';

export interface FilterOptions {
    searchText?: string;
    pack?: string;
    type?: CardType;
    attribute?: Attribute;
}

export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

export class DeckBuilderLogic {
    private cards: Card[];
    private filters: FilterOptions = {};
    private currentDeck: Card[] = [];
    private currentLeader: Card | null = null;

    constructor(cards: Card[]) {
        this.cards = cards;
    }

    setFilters(filters: FilterOptions) {
        this.filters = { ...this.filters, ...filters };
    }

    getFilteredCards(): Card[] {
        return this.cards.filter(card => {
            if (this.filters.searchText && !card.name.toLowerCase().includes(this.filters.searchText.toLowerCase())) {
                return false;
            }
            if (this.filters.pack && !card.id.startsWith(this.filters.pack)) {
                return false;
            }
            if (this.filters.type && card.type !== this.filters.type) {
                return false;
            }
            if (this.filters.attribute && card.attribute !== this.filters.attribute) {
                return false;
            }
            return true;
        });
    }

    addCardToDeck(cardId: string) {
        const card = this.cards.find(c => c.id === cardId);
        if (card) {
            this.currentDeck.push({ ...card });
        }
    }

    removeCardFromDeck(cardId: string) {
        const index = this.currentDeck.findIndex(c => c.id === cardId);
        if (index >= 0) {
            this.currentDeck.splice(index, 1);
        }
    }

    getCurrentDeck(): Card[] {
        return [...this.currentDeck];
    }

    getCardCountInDeck(cardId: string): number {
        return this.currentDeck.filter(c => c.id === cardId).length;
    }

    loadDeck(cards: Card[]) {
        this.currentDeck = [...cards];
    }

    setLeader(cardId: string) {
        const card = this.cards.find(c => c.id === cardId);
        if (card && card.type === CardType.LEADER) {
            this.currentLeader = { ...card };
        }
    }

    getLeader(): Card | null {
        return this.currentLeader;
    }

    validateDeck(): ValidationResult {
        const errors: string[] = [];
        
        if (!this.currentLeader) {
            errors.push('Deck must have a Leader.');
        }

        if (this.currentDeck.length !== 40) {
            errors.push('Deck must contain exactly 40 cards.');
        }

        const counts: Record<string, number> = {};
        for (const card of this.currentDeck) {
            counts[card.id] = (counts[card.id] || 0) + 1;
        }

        for (const [id, count] of Object.entries(counts)) {
            if (count > 3) {
                // Get card name if possible, otherwise use ID
                const cardName = this.currentDeck.find(c => c.id === id)?.name || id;
                errors.push(`Max 3 copies allowed for card ${cardName} (ID: ${id}).`);
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
}
