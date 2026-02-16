import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeckBuilderUI } from '../../../src/DeckBuilderUI';
import { HoverPreview } from '../../../src/HoverPreview';
import { Attribute, Card, CardType } from '../../../src/logic/types';

const TEST_CARDS: Card[] = [
    {
        id: 'ST01-001',
        name: 'Fire Leader',
        type: CardType.LEADER,
        attribute: Attribute.FIRE,
        cost: 0,
        text: '',
        imageUrl: '/assets/cards/ST01-001.jpg',
    },
    {
        id: 'ST01-002',
        name: 'Fire Unit',
        type: CardType.UNIT,
        attribute: Attribute.FIRE,
        cost: 1,
        power: 3000,
        hit: 1,
        text: '',
        imageUrl: '/assets/cards/ST01-002.jpg',
    },
    {
        id: 'ST02-002',
        name: 'Earth Unit',
        type: CardType.UNIT,
        attribute: Attribute.EARTH,
        cost: 1,
        power: 3000,
        hit: 1,
        text: '',
        imageUrl: '/assets/cards/ST02-002.jpg',
    },
    {
        id: 'BT02-010',
        name: 'Water Unit',
        type: CardType.UNIT,
        attribute: Attribute.WATER,
        cost: 2,
        power: 4000,
        hit: 1,
        text: '',
        imageUrl: '/assets/cards/BT02-010.jpg',
    },
];

function renderDeckBuilder() {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const hoverPreview = new HoverPreview();
    const onBack = vi.fn();

    const ui = new DeckBuilderUI(TEST_CARDS, container, hoverPreview, onBack);
    ui.render();

    return { container, hoverPreview };
}

describe('DeckBuilderUI', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        localStorage.clear();
        vi.restoreAllMocks();
    });

    it('does not render add buttons in library cards', () => {
        const { container } = renderDeckBuilder();
        expect(container.querySelector('.add-to-deck-btn')).toBeNull();
    });

    it('removes play button and shows deck name input in current deck header', () => {
        const { container } = renderDeckBuilder();
        expect(container.querySelector('#db-play')).toBeNull();
        const deckHeader = container.querySelector('.db-current-deck-header') as HTMLElement;
        expect(deckHeader.querySelector('#db-deck-name')).toBeTruthy();
        expect(deckHeader.querySelector('#db-save')).toBeTruthy();
    });

    it('adds a non-leader card to deck when card item is clicked', () => {
        const { container } = renderDeckBuilder();
        const cardItem = container.querySelector('.db-card-item[data-id="ST01-002"]') as HTMLElement;

        cardItem.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        const deckList = container.querySelector('#db-deck-list') as HTMLElement;
        const libraryCount = container.querySelector('.db-card-item[data-id="ST01-002"] .db-card-count') as HTMLElement;
        expect(libraryCount.textContent?.trim()).toBe('1');
        expect(deckList.textContent).toContain('Fire Unit');
    });

    it('sets leader when leader card is clicked', () => {
        const { container } = renderDeckBuilder();
        const leaderItem = container.querySelector('.db-card-item[data-id="ST01-001"]') as HTMLElement;

        leaderItem.click();

        const leaderSlot = container.querySelector('#db-leader-slot') as HTMLElement;
        expect(leaderSlot.textContent).toContain('LEADER: Fire Leader');
    });

    it('filters cards by selected attribute', () => {
        const { container } = renderDeckBuilder();
        const attributeFilter = container.querySelector('#db-filter-attribute') as HTMLSelectElement;

        attributeFilter.value = 'EARTH';
        attributeFilter.dispatchEvent(new Event('change'));

        const visibleCards = Array.from(container.querySelectorAll('.db-card-item')) as HTMLElement[];
        expect(visibleCards.length).toBe(1);
        expect(visibleCards[0].dataset.id).toBe('ST02-002');
    });

    it('keeps hover preview mouseenter/mouseleave behavior', () => {
        const { container, hoverPreview } = renderDeckBuilder();
        const showSpy = vi.spyOn(hoverPreview, 'show');
        const hideSpy = vi.spyOn(hoverPreview, 'hide');
        const item = container.querySelector('.db-card-item[data-id="ST01-002"]') as HTMLElement;

        item.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, clientX: 120, clientY: 180 }));
        item.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));

        expect(showSpy).toHaveBeenCalledTimes(1);
        expect(hideSpy).toHaveBeenCalledTimes(1);
    });
});
