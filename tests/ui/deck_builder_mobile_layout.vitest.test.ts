import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    DeckBuilderUI,
    shouldUseDeckBuilderMobilePortraitLayout,
} from '../../src/DeckBuilderUI';
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

function renderDeckBuilder() {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const hoverPreview = new HoverPreview();
    const ui = new DeckBuilderUI(TEST_CARDS, container, hoverPreview, vi.fn());
    ui.render();
    return { container };
}

describe('deck builder mobile layout', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        localStorage.clear();
        vi.restoreAllMocks();
        setFinePointerSupport(false);
    });

    it('detects mobile portrait layout for phone/tablet portrait only', () => {
        expect(shouldUseDeckBuilderMobilePortraitLayout({ viewportWidth: 390, viewportHeight: 844 })).toBe(true);
        expect(shouldUseDeckBuilderMobilePortraitLayout({ viewportWidth: 1200, viewportHeight: 1600 })).toBe(true);
        expect(shouldUseDeckBuilderMobilePortraitLayout({ viewportWidth: 1210, viewportHeight: 1800 })).toBe(false);
        expect(shouldUseDeckBuilderMobilePortraitLayout({ viewportWidth: 1024, viewportHeight: 768 })).toBe(false);
    });

    it('renders mobile tabs/sheets in portrait viewport and keeps panel contracts', () => {
        setViewport(900, 1280);
        const { container } = renderDeckBuilder();

        expect(container.querySelector('.deck-builder.mobile-portrait')).toBeTruthy();
        expect(container.querySelector('#db-mobile-tab-library')).toBeTruthy();
        expect(container.querySelector('#db-mobile-tab-deck')).toBeTruthy();
        expect(container.querySelector('#db-open-saved-sheet')).toBeTruthy();
        expect(container.querySelector('#db-open-filter-sheet')).toBeTruthy();
        expect(container.querySelector('#db-saved-sheet')).toBeTruthy();
        expect(container.querySelector('#db-filter-sheet')).toBeTruthy();
        expect(container.querySelector('[data-db-mobile-tab="library"]')).toBeTruthy();
        expect(container.querySelector('[data-db-mobile-tab="deck"]')).toBeTruthy();
    });

    it('keeps desktop controls when not mobile portrait', () => {
        setViewport(1366, 900);
        const { container } = renderDeckBuilder();

        expect(container.querySelector('.deck-builder.mobile-portrait')).toBeNull();
        expect(container.querySelector('#db-mobile-tab-library')).toBeNull();
        expect(container.querySelector('#db-open-saved-sheet')).toBeNull();
        expect(container.querySelector('#db-filter-pack')).toBeTruthy();
        expect(container.querySelector('#db-filter-type')).toBeTruthy();
        expect(container.querySelector('#db-filter-attribute')).toBeTruthy();
        expect(container.querySelector('.db-sidebar')).toBeTruthy();
    });
});
