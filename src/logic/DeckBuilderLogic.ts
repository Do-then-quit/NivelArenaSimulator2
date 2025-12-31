import { Card, CardType, Attribute } from './types';

export interface FilterOptions {
    searchText?: string;
    pack?: string;
    type?: CardType;
    attribute?: Attribute;
}

export class DeckBuilderLogic {
    private cards: Card[];
    private filters: FilterOptions = {};
    private currentDeck: Card[] = [];

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
}
