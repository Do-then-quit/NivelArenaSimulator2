import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeckBuilderUI } from '../../src/DeckBuilderUI';
import { HoverPreview } from '../../src/HoverPreview';
import { Attribute, Card, CardType } from '../../src/logic/types';

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
        text: '[Burst] test',
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
        id: 'ST07-002',
        name: 'ST07 Unit',
        type: CardType.UNIT,
        attribute: Attribute.WATER,
        cost: 2,
        power: 4000,
        hit: 1,
        text: '',
        imageUrl: '/assets/cards/ST07-002.jpg',
    },
    {
        id: 'ST09-002',
        name: 'ST09 Unit',
        type: CardType.UNIT,
        attribute: Attribute.LIGHTNING,
        cost: 2,
        power: 4000,
        hit: 1,
        text: '',
        imageUrl: '/assets/cards/ST09-002.jpg',
    },
    {
        id: 'BT05-001',
        name: 'Storm BT05 Unit',
        type: CardType.UNIT,
        attribute: Attribute.STORM,
        cost: 2,
        power: 4000,
        hit: 1,
        text: '',
        imageUrl: '/assets/cards/BT05-001.jpg',
    },
];

function setViewport(width: number, height: number) {
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
    Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: height });
}

function setFinePointerSupport(enabled: boolean) {
    Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
            matches: enabled && query.includes('hover: hover') && query.includes('pointer: fine'),
            media: query,
            onchange: null,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            addListener: vi.fn(),
            removeListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })),
    });
}

function dispatchPointerEvent(
    target: Element,
    type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
    extras: Record<string, unknown>,
) {
    const event = new Event(type, { bubbles: true, cancelable: true }) as any;
    Object.assign(event, extras);
    target.dispatchEvent(event);
}

function renderDeckBuilder() {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const hoverPreview = new HoverPreview();
    const ui = new DeckBuilderUI(TEST_CARDS, container, hoverPreview, vi.fn());
    ui.render();
    return { container, hoverPreview };
}

function getLibraryCount(container: HTMLElement, cardId: string): string {
    return (container.querySelector(`.db-card-item[data-id="${cardId}"] .db-card-count`) as HTMLElement).textContent?.trim() ?? '';
}

describe('deck builder mobile interactions', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        localStorage.clear();
        vi.restoreAllMocks();
        setViewport(900, 1280);
        setFinePointerSupport(false);
        vi.stubGlobal('alert', vi.fn());
        vi.stubGlobal('confirm', vi.fn(() => true));
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    it('adds cards on tap and supports +/- quantity controls in current deck tab', () => {
        const { container } = renderDeckBuilder();
        const libraryCard = container.querySelector('.db-card-item[data-id="ST01-002"]') as HTMLElement;
        libraryCard.click();
        libraryCard.click();

        (container.querySelector('#db-mobile-tab-deck') as HTMLButtonElement).click();

        const deckCount = container.querySelector('#db-deck-count') as HTMLElement;
        expect(deckCount.textContent?.trim()).toBe('2');

        (container.querySelector('.deck-qty-decrease[data-id="ST01-002"]') as HTMLButtonElement).click();
        expect((container.querySelector('#db-deck-count') as HTMLElement).textContent?.trim()).toBe('1');

        (container.querySelector('.deck-qty-increase[data-id="ST01-002"]') as HTMLButtonElement).click();
        expect((container.querySelector('#db-deck-count') as HTMLElement).textContent?.trim()).toBe('2');
    });

    it('shows preview only on long-press and suppresses next click once', () => {
        vi.useFakeTimers();
        const { container, hoverPreview } = renderDeckBuilder();
        const showSpy = vi.spyOn(hoverPreview, 'show');
        const hideSpy = vi.spyOn(hoverPreview, 'hide');
        const libraryCard = container.querySelector('.db-card-item[data-id="ST01-002"]') as HTMLElement;

        expect(getLibraryCount(container, 'ST01-002')).toBe('0');

        dispatchPointerEvent(libraryCard, 'pointerdown', { pointerId: 11, pointerType: 'touch', clientX: 150, clientY: 280 });
        vi.advanceTimersByTime(360);
        expect(showSpy).toHaveBeenCalledTimes(1);

        dispatchPointerEvent(libraryCard, 'pointerup', { pointerId: 11, pointerType: 'touch', clientX: 150, clientY: 280 });
        expect(hideSpy).toHaveBeenCalled();

        libraryCard.click();
        expect(getLibraryCount(container, 'ST01-002')).toBe('0');

        libraryCard.click();
        expect(getLibraryCount(container, 'ST01-002')).toBe('1');
    });

    it('blocks context menu for library and current-deck cards in mobile portrait', () => {
        const { container } = renderDeckBuilder();
        const libraryCard = container.querySelector('.db-card-item[data-id="ST01-002"]') as HTMLElement;

        const libraryContextEvent = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
        libraryCard.dispatchEvent(libraryContextEvent);
        expect(libraryContextEvent.defaultPrevented).toBe(true);

        libraryCard.click();
        (container.querySelector('#db-mobile-tab-deck') as HTMLButtonElement).click();
        const deckCard = container.querySelector('.deck-list-card[data-id="ST01-002"]') as HTMLElement;
        const deckContextEvent = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
        deckCard.dispatchEvent(deckContextEvent);
        expect(deckContextEvent.defaultPrevented).toBe(true);
    });

    it('opens mobile filter sheet and applies filter to library cards', () => {
        const { container } = renderDeckBuilder();

        (container.querySelector('#db-open-filter-sheet') as HTMLButtonElement).click();
        expect(container.querySelector('#db-filter-sheet')?.classList.contains('open')).toBe(true);

        const packSelect = container.querySelector('#db-filter-pack-mobile') as HTMLSelectElement;
        packSelect.value = 'ST02';
        packSelect.dispatchEvent(new Event('change'));

        const visibleCards = Array.from(container.querySelectorAll('.db-card-item')) as HTMLElement[];
        expect(visibleCards).toHaveLength(1);
        expect(visibleCards[0].dataset.id).toBe('ST02-002');

        (container.querySelector('#db-filter-sheet-backdrop') as HTMLElement).click();
        expect(container.querySelector('#db-filter-sheet')?.classList.contains('open')).toBe(false);
    });

    it('shows BT05, ST07, and ST09 in the mobile pack filter and filters correctly', () => {
        const { container } = renderDeckBuilder();

        (container.querySelector('#db-open-filter-sheet') as HTMLButtonElement).click();
        const packSelect = container.querySelector('#db-filter-pack-mobile') as HTMLSelectElement;
        const optionValues = Array.from(packSelect.options).map(option => option.value);
        expect(optionValues).toContain('BT05');
        expect(optionValues).toContain('ST07');
        expect(optionValues).toContain('ST09');

        packSelect.value = 'ST09';
        packSelect.dispatchEvent(new Event('change'));

        const visibleCards = Array.from(container.querySelectorAll('.db-card-item')) as HTMLElement[];
        expect(visibleCards).toHaveLength(1);
        expect(visibleCards[0].dataset.id).toBe('ST09-002');
    });

    it('loads saved deck correctly even when active filter excludes its cards', () => {
        const { container } = renderDeckBuilder();

        const fireUnitCard = container.querySelector('.db-card-item[data-id="ST01-002"]') as HTMLElement;
        fireUnitCard.click();
        (container.querySelector('#db-mobile-tab-deck') as HTMLButtonElement).click();
        const deckNameInput = container.querySelector('#db-deck-name') as HTMLInputElement;
        deckNameInput.value = 'Saved Fire Deck';
        deckNameInput.dispatchEvent(new Event('input'));
        (container.querySelector('#db-save-mobile') as HTMLButtonElement).click();

        (container.querySelector('#db-open-filter-sheet') as HTMLButtonElement).click();
        const packSelect = container.querySelector('#db-filter-pack-mobile') as HTMLSelectElement;
        packSelect.value = 'ST02';
        packSelect.dispatchEvent(new Event('change'));
        (container.querySelector('#db-filter-sheet-backdrop') as HTMLElement).click();

        (container.querySelector('#db-open-saved-sheet') as HTMLButtonElement).click();
        (container.querySelector('#db-new-deck-mobile') as HTMLButtonElement).click();
        expect((container.querySelector('#db-deck-count') as HTMLElement).textContent?.trim()).toBe('0');

        (container.querySelector('#db-open-saved-sheet') as HTMLButtonElement).click();
        (container.querySelector('#db-saved-list-mobile .load-deck-btn') as HTMLButtonElement).click();

        expect((container.querySelector('#db-deck-count') as HTMLElement).textContent?.trim()).toBe('1');
        expect(container.querySelector('#db-deck-list')?.textContent).toContain('Fire Unit');
    });
});
