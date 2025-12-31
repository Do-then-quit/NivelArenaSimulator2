import { describe, it, expect, beforeEach } from 'vitest';
import { DeckBuilderLogic, FilterOptions } from '../src/logic/DeckBuilderLogic';
import { DUMMY_CARDS } from '../src/logic/CardDatabase';
import { CardType, Attribute } from '../src/logic/types';

describe('DeckBuilderLogic', () => {
    let logic: DeckBuilderLogic;

    beforeEach(() => {
        logic = new DeckBuilderLogic(DUMMY_CARDS);
    });

    it('should initially show all cards (as filteredCards)', () => {
        expect(logic.getFilteredCards().length).toBe(DUMMY_CARDS.length);
    });

    it('should filter by search text', () => {
        const filter: FilterOptions = { searchText: '라피' }; // Rapi in Korean
        logic.setFilters(filter);
        const filtered = logic.getFilteredCards();
        expect(filtered.every(c => c.name.includes('라피'))).toBe(true);
        expect(filtered.length).toBeLessThan(DUMMY_CARDS.length);
    });

    it('should filter by pack', () => {
        const filter: FilterOptions = { pack: 'ST01' };
        logic.setFilters(filter);
        const filtered = logic.getFilteredCards();
        expect(filtered.every(c => c.id.startsWith('ST01'))).toBe(true);
    });

    it('should filter by card type', () => {
        const filter: FilterOptions = { type: CardType.LEADER };
        logic.setFilters(filter);
        const filtered = logic.getFilteredCards();
        expect(filtered.every(c => c.type === CardType.LEADER)).toBe(true);
    });

    it('should filter by attribute', () => {
        const filter: FilterOptions = { attribute: Attribute.FIRE };
        logic.setFilters(filter);
        const filtered = logic.getFilteredCards();
        expect(filtered.every(c => c.attribute === Attribute.FIRE)).toBe(true);
    });

    it('should manage current deck', () => {
        const card = DUMMY_CARDS.find(c => c.type === CardType.UNIT)!;
        
        logic.addCardToDeck(card.id);
        expect(logic.getCurrentDeck().length).toBe(1);
        expect(logic.getCurrentDeck()[0].id).toBe(card.id);

        logic.removeCardFromDeck(card.id);
        expect(logic.getCurrentDeck().length).toBe(0);
    });

    it('should allow multiple copies in deck', () => {
        const card = DUMMY_CARDS.find(c => c.type === CardType.UNIT)!;
        
        logic.addCardToDeck(card.id);
        logic.addCardToDeck(card.id);
        
        expect(logic.getCurrentDeck().length).toBe(2);
        expect(logic.getCardCountInDeck(card.id)).toBe(2);
    });
});
