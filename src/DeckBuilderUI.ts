import { DeckBuilderLogic } from './logic/DeckBuilderLogic';
import { Attribute, Card, CardType } from './logic/types';
import { HoverPreview } from './HoverPreview';
import { DeckPersistence, SavedDeck } from './logic/DeckPersistence';
import { DECK_BUILDER_ALLOWED_PACKS } from './logic/DeckBuilderCardPool';

const MOBILE_PORTRAIT_WIDTH_THRESHOLD = 1200;
const TOUCH_LONG_PRESS_MS = 350;
const TOUCH_LONG_PRESS_MOVE_THRESHOLD_PX = 16;
const DEFAULT_DECK_NAME = 'My Custom Deck';
const MOBILE_CONTEXT_MENU_BLOCK_SELECTORS = [
    '.db-card-item',
    '.db-card-mini',
    '.db-card-mini .card-image',
    '.deck-list-card',
    '.db-deck-item-mini',
    '.db-deck-item-mini .card-image',
    '.db-leader-preview-card',
    '.db-leader-preview-card .card-image',
    '#db-saved-sheet',
    '#db-filter-sheet',
];

type MobileDeckBuilderTab = 'library' | 'deck';

interface DeckFilterState {
    searchText: string;
    pack: string;
    type: '' | CardType;
    attribute: '' | Attribute;
}

const TYPE_FILTER_OPTIONS: Array<{ value: '' | CardType; label: string }> = [
    { value: '', label: 'All Types' },
    { value: CardType.LEADER, label: 'Leader' },
    { value: CardType.UNIT, label: 'Unit' },
    { value: CardType.SKILL, label: 'Skill' },
    { value: CardType.ITEM, label: 'Item' },
];

const ATTRIBUTE_FILTER_OPTIONS: Array<{ value: '' | Attribute; label: string }> = [
    { value: '', label: 'All Attributes' },
    { value: Attribute.FIRE, label: '화염' },
    { value: Attribute.EARTH, label: '대지' },
    { value: Attribute.STORM, label: '폭풍' },
    { value: Attribute.WATER, label: '파도' },
    { value: Attribute.LIGHTNING, label: '번개' },
    { value: Attribute.NONE, label: '없음' },
];

export interface DeckBuilderMobileLayoutInput {
    viewportWidth: number;
    viewportHeight: number;
    widthThreshold?: number;
}

export function shouldUseDeckBuilderMobilePortraitLayout(input: DeckBuilderMobileLayoutInput): boolean {
    const widthThreshold = input.widthThreshold ?? MOBILE_PORTRAIT_WIDTH_THRESHOLD;
    if (input.viewportWidth <= 0 || input.viewportHeight <= 0) return false;
    const isPortrait = input.viewportHeight > input.viewportWidth;
    return isPortrait && input.viewportWidth <= widthThreshold;
}

function supportsHoverAndFinePointer(): boolean {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
    try {
        return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    } catch {
        return true;
    }
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export class DeckBuilderUI {
    private logic: DeckBuilderLogic;
    private readonly allCards: Card[];
    private readonly cardsById: Map<string, Card>;
    private container: HTMLElement;
    private hoverPreview: HoverPreview;
    private onBack: () => void;
    private deckName: string = DEFAULT_DECK_NAME;
    private filterState: DeckFilterState = {
        searchText: '',
        pack: '',
        type: '',
        attribute: '',
    };
    private mobileActiveTab: MobileDeckBuilderTab = 'library';
    private mobileSavedSheetOpen = false;
    private mobileFilterSheetOpen = false;
    private isMobilePortraitLayout = false;
    private static mobileContextMenuGuardBound = false;

    constructor(
        cards: Card[],
        container: HTMLElement,
        hoverPreview: HoverPreview,
        onBack: () => void,
    ) {
        this.logic = new DeckBuilderLogic(cards);
        this.allCards = cards;
        this.cardsById = new Map(cards.map(card => [card.id, card]));
        this.container = container;
        this.hoverPreview = hoverPreview;
        this.onBack = onBack;

        const savedDecks = DeckPersistence.getAllDecks();
        if (savedDecks.length > 0) {
            this.applySavedDeck(savedDecks[0]);
        }

        this.ensureMobileContextMenuGuard();
    }

    render() {
        this.hoverPreview.hide();
        this.isMobilePortraitLayout = shouldUseDeckBuilderMobilePortraitLayout({
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
        });

        if (!this.isMobilePortraitLayout) {
            this.mobileSavedSheetOpen = false;
            this.mobileFilterSheetOpen = false;
            this.mobileActiveTab = 'library';
        }

        this.applyCurrentFilters();

        const packOptions = this.renderPackOptions(this.filterState.pack);
        const typeOptions = this.renderTypeOptions(this.filterState.type);
        const attributeOptions = this.renderAttributeOptions(this.filterState.attribute);

        const mobileLibraryPanelClass = this.isMobilePortraitLayout
            ? (this.mobileActiveTab === 'library' ? 'mobile-panel-active' : 'mobile-panel-hidden')
            : '';
        const mobileDeckPanelClass = this.isMobilePortraitLayout
            ? (this.mobileActiveTab === 'deck' ? 'mobile-panel-active' : 'mobile-panel-hidden')
            : '';

        this.container.innerHTML = `
            <div class="deck-builder ${this.isMobilePortraitLayout ? 'mobile-portrait' : ''}">
                <div class="deck-builder-header">
                    <button id="db-back" class="secondary-btn">Back</button>
                    <h1>Deck Builder</h1>
                    ${this.isMobilePortraitLayout ? `
                        <div class="db-mobile-header-actions">
                            <button id="db-open-saved-sheet" class="secondary-btn small-btn">Saved</button>
                            <button id="db-open-filter-sheet" class="secondary-btn small-btn">Filters</button>
                        </div>
                    ` : ''}
                </div>

                ${this.isMobilePortraitLayout ? `
                    <div class="db-mobile-tabs">
                        <button
                            id="db-mobile-tab-library"
                            class="secondary-btn small-btn ${this.mobileActiveTab === 'library' ? 'active' : ''}"
                        >라이브러리</button>
                        <button
                            id="db-mobile-tab-deck"
                            class="secondary-btn small-btn ${this.mobileActiveTab === 'deck' ? 'active' : ''}"
                        >현재덱</button>
                    </div>
                ` : ''}

                <div class="db-main">
                    <aside class="db-sidebar">
                        <h2>Saved Decks</h2>
                        <div id="db-saved-list" class="db-saved-list"></div>
                        <button id="db-new-deck" class="secondary-btn db-new-deck-btn">+ New Deck</button>
                    </aside>

                    <section class="db-library ${mobileLibraryPanelClass}" data-db-mobile-tab="library">
                        <div class="db-controls">
                            <input type="text" id="db-search" placeholder="Search by name..." value="${escapeHtml(this.filterState.searchText)}">
                            ${this.isMobilePortraitLayout ? '' : `
                                <select id="db-filter-pack">${packOptions}</select>
                                <select id="db-filter-type">${typeOptions}</select>
                                <select id="db-filter-attribute">${attributeOptions}</select>
                            `}
                        </div>
                        <div class="db-card-grid" id="db-card-grid"></div>
                    </section>

                    <section class="db-current-deck ${mobileDeckPanelClass}" data-db-mobile-tab="deck">
                        <div class="db-current-deck-header">
                            <input
                                type="text"
                                id="db-deck-name"
                                placeholder="Deck Name"
                                class="db-input db-deck-name-input"
                                value="${escapeHtml(this.deckName)}"
                            >
                            ${this.isMobilePortraitLayout ? '' : '<button id="db-save" class="primary-btn db-save-btn">Save Deck</button>'}
                        </div>
                        <div class="db-current-deck-count">Deck Cards: <span id="db-deck-count">0</span>/40</div>
                        <div id="db-validation-warnings" class="validation-warnings"></div>
                        <div class="db-leader-slot" id="db-leader-slot"></div>
                        <div class="db-deck-list" id="db-deck-list"></div>
                        ${this.isMobilePortraitLayout ? `
                            <div class="db-mobile-sticky-actions">
                                <button id="db-save-mobile" class="primary-btn">Save Deck</button>
                            </div>
                        ` : ''}
                    </section>
                </div>

                ${this.isMobilePortraitLayout ? `
                    <div id="db-saved-sheet-backdrop" class="db-sheet-backdrop ${this.mobileSavedSheetOpen ? 'open' : ''}"></div>
                    <aside id="db-saved-sheet" class="db-mobile-sheet ${this.mobileSavedSheetOpen ? 'open' : ''}">
                        <div class="db-mobile-sheet-header">
                            <h3>Saved Decks</h3>
                            <button id="db-close-saved-sheet" class="secondary-btn small-btn">닫기</button>
                        </div>
                        <div id="db-saved-list-mobile" class="db-saved-list"></div>
                        <button id="db-new-deck-mobile" class="secondary-btn db-new-deck-btn">+ New Deck</button>
                    </aside>

                    <div id="db-filter-sheet-backdrop" class="db-sheet-backdrop ${this.mobileFilterSheetOpen ? 'open' : ''}"></div>
                    <aside id="db-filter-sheet" class="db-mobile-sheet ${this.mobileFilterSheetOpen ? 'open' : ''}">
                        <div class="db-mobile-sheet-header">
                            <h3>Filters</h3>
                            <button id="db-close-filter-sheet" class="secondary-btn small-btn">닫기</button>
                        </div>
                        <div class="db-mobile-filter-controls">
                            <label>
                                Pack
                                <select id="db-filter-pack-mobile">${packOptions}</select>
                            </label>
                            <label>
                                Type
                                <select id="db-filter-type-mobile">${typeOptions}</select>
                            </label>
                            <label>
                                Attribute
                                <select id="db-filter-attribute-mobile">${attributeOptions}</select>
                            </label>
                            <button id="db-filter-reset-mobile" class="secondary-btn">필터 초기화</button>
                        </div>
                    </aside>
                ` : ''}
            </div>
        `;

        this.attachListeners();
        this.updateLibrary();
        this.updateDeckView();
        this.updateSavedList();
    }

    private ensureMobileContextMenuGuard() {
        if (DeckBuilderUI.mobileContextMenuGuardBound) return;
        document.addEventListener('contextmenu', (event) => {
            const target = event.target as HTMLElement | null;
            if (!target) return;
            const root = target.closest('.deck-builder');
            if (!root || !root.classList.contains('mobile-portrait')) return;
            if (supportsHoverAndFinePointer()) return;
            if (!MOBILE_CONTEXT_MENU_BLOCK_SELECTORS.some(selector => target.closest(selector))) return;
            event.preventDefault();
        }, true);
        DeckBuilderUI.mobileContextMenuGuardBound = true;
    }

    private renderPackOptions(selectedValue: string): string {
        const allOption = `<option value="" ${selectedValue === '' ? 'selected' : ''}>All Packs</option>`;
        const options = DECK_BUILDER_ALLOWED_PACKS
            .map(pack => `<option value="${pack}" ${selectedValue === pack ? 'selected' : ''}>${pack}</option>`)
            .join('');
        return `${allOption}${options}`;
    }

    private renderTypeOptions(selectedValue: '' | CardType): string {
        return TYPE_FILTER_OPTIONS
            .map(option => `<option value="${option.value}" ${selectedValue === option.value ? 'selected' : ''}>${option.label}</option>`)
            .join('');
    }

    private renderAttributeOptions(selectedValue: '' | Attribute): string {
        return ATTRIBUTE_FILTER_OPTIONS
            .map(option => `<option value="${option.value}" ${selectedValue === option.value ? 'selected' : ''}>${option.label}</option>`)
            .join('');
    }

    private attachListeners() {
        document.getElementById('db-back')?.addEventListener('click', () => this.onBack());

        const deckNameInput = document.getElementById('db-deck-name') as HTMLInputElement | null;
        deckNameInput?.addEventListener('input', () => {
            this.deckName = deckNameInput.value;
        });

        const saveDeck = () => {
            this.saveCurrentDeck();
        };
        document.getElementById('db-save')?.addEventListener('click', saveDeck);
        document.getElementById('db-save-mobile')?.addEventListener('click', saveDeck);

        const createNewDeck = () => {
            this.createNewDeck();
        };
        document.getElementById('db-new-deck')?.addEventListener('click', createNewDeck);
        document.getElementById('db-new-deck-mobile')?.addEventListener('click', createNewDeck);

        const searchInput = document.getElementById('db-search') as HTMLInputElement | null;
        searchInput?.addEventListener('input', () => {
            this.filterState.searchText = searchInput.value;
            this.applyCurrentFilters();
            this.updateLibrary();
            this.updateSavedList();
        });

        const bindFilterSelect = (
            id: string,
            setter: (nextValue: string) => void,
        ) => {
            const select = document.getElementById(id) as HTMLSelectElement | null;
            if (!select) return;
            select.addEventListener('change', () => {
                setter(select.value);
                this.applyCurrentFilters();
                this.updateLibrary();
                this.updateSavedList();
            });
        };

        bindFilterSelect('db-filter-pack', (nextValue) => {
            this.filterState.pack = nextValue;
        });
        bindFilterSelect('db-filter-type', (nextValue) => {
            this.filterState.type = nextValue as '' | CardType;
        });
        bindFilterSelect('db-filter-attribute', (nextValue) => {
            this.filterState.attribute = nextValue as '' | Attribute;
        });
        bindFilterSelect('db-filter-pack-mobile', (nextValue) => {
            this.filterState.pack = nextValue;
        });
        bindFilterSelect('db-filter-type-mobile', (nextValue) => {
            this.filterState.type = nextValue as '' | CardType;
        });
        bindFilterSelect('db-filter-attribute-mobile', (nextValue) => {
            this.filterState.attribute = nextValue as '' | Attribute;
        });

        document.getElementById('db-filter-reset-mobile')?.addEventListener('click', () => {
            this.filterState.pack = '';
            this.filterState.type = '';
            this.filterState.attribute = '';
            this.applyCurrentFilters();
            this.render();
        });

        document.getElementById('db-open-saved-sheet')?.addEventListener('click', () => {
            this.mobileSavedSheetOpen = true;
            this.mobileFilterSheetOpen = false;
            this.render();
        });
        document.getElementById('db-open-filter-sheet')?.addEventListener('click', () => {
            this.mobileFilterSheetOpen = true;
            this.mobileSavedSheetOpen = false;
            this.render();
        });
        document.getElementById('db-close-saved-sheet')?.addEventListener('click', () => {
            this.mobileSavedSheetOpen = false;
            this.render();
        });
        document.getElementById('db-close-filter-sheet')?.addEventListener('click', () => {
            this.mobileFilterSheetOpen = false;
            this.render();
        });
        document.getElementById('db-saved-sheet-backdrop')?.addEventListener('click', () => {
            this.mobileSavedSheetOpen = false;
            this.render();
        });
        document.getElementById('db-filter-sheet-backdrop')?.addEventListener('click', () => {
            this.mobileFilterSheetOpen = false;
            this.render();
        });

        document.getElementById('db-mobile-tab-library')?.addEventListener('click', () => {
            this.mobileActiveTab = 'library';
            this.render();
        });
        document.getElementById('db-mobile-tab-deck')?.addEventListener('click', () => {
            this.mobileActiveTab = 'deck';
            this.render();
        });
    }

    private applyCurrentFilters() {
        this.logic.setFilters({
            searchText: this.filterState.searchText.trim() || undefined,
            pack: this.filterState.pack || undefined,
            type: this.filterState.type || undefined,
            attribute: this.filterState.attribute || undefined,
        });
    }

    private saveCurrentDeck() {
        const deck = this.logic.getCurrentDeck();
        const leader = this.logic.getLeader();
        const normalizedName = this.deckName.trim() || 'Untitled Deck';
        this.deckName = normalizedName;

        if (deck.length === 0 && !leader) return;

        DeckPersistence.saveDeck({
            id: `deck-${Date.now()}`,
            name: normalizedName,
            leaderId: leader?.id || null,
            cardIds: deck.map(card => card.id),
        });

        alert('Deck saved!');
        this.updateSavedList();
        this.render();
    }

    private createNewDeck() {
        if (!confirm('Create a new deck? Current unsaved changes will be lost.')) return;
        this.logic.resetDeck();
        this.deckName = DEFAULT_DECK_NAME;
        this.mobileSavedSheetOpen = false;
        this.mobileFilterSheetOpen = false;
        this.mobileActiveTab = 'library';
        this.render();
    }

    private applySavedDeck(saved: SavedDeck) {
        const deckCards = saved.cardIds
            .map(cardId => this.cardsById.get(cardId))
            .filter((card): card is Card => !!card);
        const leader = saved.leaderId ? (this.cardsById.get(saved.leaderId) ?? undefined) : undefined;
        this.logic.loadDeck(deckCards, leader);
        this.deckName = saved.name || DEFAULT_DECK_NAME;
    }

    private updateSavedList() {
        const containers = [
            document.getElementById('db-saved-list'),
            document.getElementById('db-saved-list-mobile'),
        ].filter((container): container is HTMLElement => !!container);

        if (containers.length === 0) return;

        const decks = DeckPersistence.getAllDecks();
        const listHtml = decks.map(deck => `
            <div class="saved-deck-item">
                <span class="deck-name" title="${escapeHtml(deck.name)}">${escapeHtml(deck.name)}</span>
                <div class="deck-item-actions">
                    <button class="load-deck-btn" data-id="${deck.id}">Load</button>
                    <button class="delete-deck-btn" data-id="${deck.id}">Del</button>
                </div>
            </div>
        `).join('') || '<div class="no-decks">No saved decks</div>';

        containers.forEach((container) => {
            container.innerHTML = listHtml;

            container.querySelectorAll('.load-deck-btn').forEach(button => {
                button.addEventListener('click', () => {
                    const id = (button as HTMLElement).dataset.id;
                    if (!id) return;
                    const saved = DeckPersistence.getDeck(id);
                    if (!saved) return;
                    this.applySavedDeck(saved);
                    if (this.isMobilePortraitLayout) {
                        this.mobileActiveTab = 'deck';
                        this.mobileSavedSheetOpen = false;
                    }
                    this.render();
                });
            });

            container.querySelectorAll('.delete-deck-btn').forEach(button => {
                button.addEventListener('click', (event) => {
                    event.stopPropagation();
                    const id = (button as HTMLElement).dataset.id;
                    if (!id) return;
                    if (!confirm('Delete this deck?')) return;
                    DeckPersistence.deleteDeck(id);
                    this.updateSavedList();
                });
            });
        });
    }

    private updateLibrary() {
        const grid = document.getElementById('db-card-grid');
        if (!grid) return;

        const filtered = this.logic.getFilteredCards();
        if (filtered.length === 0) {
            grid.innerHTML = '<div class="db-library-empty">조건에 맞는 카드가 없습니다.</div>';
            return;
        }

        grid.innerHTML = filtered.map(card => `
            <div class="db-card-item" data-id="${card.id}" role="button" tabindex="0">
                ${this.renderCardMini(card)}
                <div class="db-card-count">${this.logic.getCardCountInDeck(card.id)}</div>
            </div>
        `).join('');

        const supportsMouseHoverPreview = supportsHoverAndFinePointer();

        grid.querySelectorAll('.db-card-item').forEach(item => {
            const addCardFromLibrary = () => {
                const id = (item as HTMLElement).dataset.id;
                if (!id) return;
                const card = this.cardsById.get(id);
                if (!card) return;

                if (card.type === CardType.LEADER) {
                    this.logic.setLeader(card.id);
                } else {
                    this.logic.addCardToDeck(card.id);
                }

                this.updateDeckView();
                this.updateLibrary();
            };

            if (supportsMouseHoverPreview) {
                item.addEventListener('mouseenter', (event) => {
                    const id = (item as HTMLElement).dataset.id;
                    if (!id) return;
                    const card = this.cardsById.get(id);
                    if (!card) return;
                    const mouseEvent = event as MouseEvent;
                    this.hoverPreview.show(card, mouseEvent.clientX, mouseEvent.clientY);
                });
                item.addEventListener('mousemove', (event) => {
                    const mouseEvent = event as MouseEvent;
                    this.hoverPreview.move(mouseEvent.clientX, mouseEvent.clientY);
                });
                item.addEventListener('mouseleave', () => {
                    this.hoverPreview.hide();
                });
            }

            item.addEventListener('click', () => addCardFromLibrary());
            item.addEventListener('keydown', (event: Event) => {
                const keyboardEvent = event as KeyboardEvent;
                if (keyboardEvent.key !== 'Enter' && keyboardEvent.key !== ' ') return;
                keyboardEvent.preventDefault();
                addCardFromLibrary();
            });
        });

        this.bindTouchLongPressPreview(
            Array.from(grid.querySelectorAll('.db-card-item')) as HTMLElement[],
            (element) => {
                const id = element.dataset.id;
                return id ? (this.cardsById.get(id) ?? null) : null;
            },
        );
    }

    private updateDeckView() {
        const deckList = document.getElementById('db-deck-list');
        const leaderSlot = document.getElementById('db-leader-slot');
        const countDisplay = document.getElementById('db-deck-count');
        const warnings = document.getElementById('db-validation-warnings');

        if (countDisplay) {
            countDisplay.textContent = String(this.logic.getCurrentDeck().length);
        }

        const validation = this.logic.validateDeck();
        if (warnings) {
            warnings.innerHTML = validation.errors
                .map(err => `<div class="warning">${escapeHtml(err)}</div>`)
                .join('');
        }

        if (leaderSlot) {
            const leader = this.logic.getLeader();
            leaderSlot.innerHTML = leader ? `
                <div class="leader-preview">
                    <button class="db-leader-preview-card" type="button" data-id="${leader.id}">
                        ${this.renderDeckItemMini(leader)}
                    </button>
                    <div class="leader-preview-info">
                        <span class="leader-label">LEADER</span>
                        <span class="leader-name">${escapeHtml(leader.name)}</span>
                    </div>
                    <button class="remove-leader-btn" type="button">X</button>
                </div>
            ` : '<div class="leader-empty">No Leader Selected</div>';

            leaderSlot.querySelector('.remove-leader-btn')?.addEventListener('click', () => {
                this.logic.setLeader(null);
                this.updateDeckView();
                this.updateLibrary();
            });

            const leaderPreviewButton = leaderSlot.querySelector('.db-leader-preview-card') as HTMLElement | null;
            if (leaderPreviewButton) {
                if (supportsHoverAndFinePointer()) {
                    leaderPreviewButton.addEventListener('mouseenter', (event) => {
                        const id = leaderPreviewButton.dataset.id;
                        if (!id) return;
                        const card = this.cardsById.get(id);
                        if (!card) return;
                        const mouseEvent = event as MouseEvent;
                        this.hoverPreview.show(card, mouseEvent.clientX, mouseEvent.clientY);
                    });
                    leaderPreviewButton.addEventListener('mousemove', (event) => {
                        const mouseEvent = event as MouseEvent;
                        this.hoverPreview.move(mouseEvent.clientX, mouseEvent.clientY);
                    });
                    leaderPreviewButton.addEventListener('mouseleave', () => this.hoverPreview.hide());
                }
                this.bindTouchLongPressPreview([leaderPreviewButton], (element) => {
                    const id = element.dataset.id;
                    return id ? (this.cardsById.get(id) ?? null) : null;
                });
            }
        }

        if (!deckList) return;

        const grouped = new Map<string, { card: Card; count: number }>();
        this.logic.getCurrentDeck().forEach(card => {
            const existing = grouped.get(card.id);
            if (existing) {
                existing.count += 1;
                return;
            }
            grouped.set(card.id, { card, count: 1 });
        });

        if (grouped.size === 0) {
            deckList.innerHTML = '<div class="db-deck-empty">덱이 비어 있습니다. 라이브러리에서 카드를 추가하세요.</div>';
            return;
        }

        deckList.innerHTML = Array.from(grouped.values()).map(({ card, count }) => `
            <div class="deck-list-item" data-id="${card.id}">
                <button class="deck-list-card" type="button" data-id="${card.id}">
                    ${this.renderDeckItemMini(card)}
                    <span class="deck-list-name" title="${escapeHtml(card.name)}">${escapeHtml(card.name)}</span>
                </button>
                <div class="deck-list-stepper">
                    <button class="deck-qty-btn deck-qty-decrease" type="button" data-id="${card.id}" aria-label="remove ${escapeHtml(card.name)}">-</button>
                    <span class="deck-qty-count">${count}</span>
                    <button class="deck-qty-btn deck-qty-increase" type="button" data-id="${card.id}" aria-label="add ${escapeHtml(card.name)}">+</button>
                </div>
            </div>
        `).join('');

        deckList.querySelectorAll('.deck-qty-decrease').forEach(button => {
            button.addEventListener('click', () => {
                const id = (button as HTMLElement).dataset.id;
                if (!id) return;
                this.logic.removeCardFromDeck(id);
                this.updateDeckView();
                this.updateLibrary();
            });
        });

        deckList.querySelectorAll('.deck-qty-increase').forEach(button => {
            button.addEventListener('click', () => {
                const id = (button as HTMLElement).dataset.id;
                if (!id) return;
                this.logic.addCardToDeck(id);
                this.updateDeckView();
                this.updateLibrary();
            });
        });

        const supportsMouseHoverPreview = supportsHoverAndFinePointer();
        deckList.querySelectorAll('.deck-list-card').forEach(button => {
            const cardButton = button as HTMLElement;
            if (supportsMouseHoverPreview) {
                cardButton.addEventListener('mouseenter', (event) => {
                    const id = cardButton.dataset.id;
                    if (!id) return;
                    const card = this.cardsById.get(id);
                    if (!card) return;
                    const mouseEvent = event as MouseEvent;
                    this.hoverPreview.show(card, mouseEvent.clientX, mouseEvent.clientY);
                });
                cardButton.addEventListener('mousemove', (event) => {
                    const mouseEvent = event as MouseEvent;
                    this.hoverPreview.move(mouseEvent.clientX, mouseEvent.clientY);
                });
                cardButton.addEventListener('mouseleave', () => this.hoverPreview.hide());
            }
        });

        this.bindTouchLongPressPreview(
            Array.from(deckList.querySelectorAll('.deck-list-card')) as HTMLElement[],
            (element) => {
                const id = element.dataset.id;
                return id ? (this.cardsById.get(id) ?? null) : null;
            },
        );
    }

    private bindTouchLongPressPreview(
        elements: Iterable<HTMLElement>,
        resolveCard: (el: HTMLElement) => Card | null,
    ) {
        const suppressClickElements = new WeakSet<HTMLElement>();

        for (const element of elements) {
            let pressTimer: number | null = null;
            let longPressActive = false;
            let pointerId: number | null = null;
            let originX = 0;
            let originY = 0;

            const clearPressTimer = () => {
                if (pressTimer !== null) {
                    window.clearTimeout(pressTimer);
                    pressTimer = null;
                }
            };

            const cancelLongPress = (consumeClick: boolean) => {
                clearPressTimer();
                if (longPressActive) {
                    this.hoverPreview.hide();
                    if (consumeClick) {
                        suppressClickElements.add(element);
                    }
                }
                longPressActive = false;
                pointerId = null;
            };

            element.addEventListener('pointerdown', (event: PointerEvent) => {
                if (event.pointerType === 'mouse') return;
                const card = resolveCard(element);
                if (!card) return;

                pointerId = event.pointerId;
                originX = event.clientX;
                originY = event.clientY;
                longPressActive = false;
                clearPressTimer();
                pressTimer = window.setTimeout(() => {
                    longPressActive = true;
                    this.hoverPreview.show(card, originX, originY);
                }, TOUCH_LONG_PRESS_MS);
            });

            element.addEventListener('pointermove', (event: PointerEvent) => {
                if (pointerId === null || event.pointerId !== pointerId || event.pointerType === 'mouse') return;

                if (!longPressActive) {
                    const movedX = event.clientX - originX;
                    const movedY = event.clientY - originY;
                    if (Math.hypot(movedX, movedY) > TOUCH_LONG_PRESS_MOVE_THRESHOLD_PX) {
                        cancelLongPress(false);
                    }
                    return;
                }

                const card = resolveCard(element);
                if (!card) return;
                this.hoverPreview.show(card, event.clientX, event.clientY);
            });

            element.addEventListener('pointerup', (event: PointerEvent) => {
                if (pointerId === null || event.pointerId !== pointerId || event.pointerType === 'mouse') return;
                cancelLongPress(true);
            });
            element.addEventListener('pointercancel', () => cancelLongPress(false));
            element.addEventListener('pointerleave', () => {
                if (longPressActive) {
                    this.hoverPreview.hide();
                }
            });
            element.addEventListener('click', (event: MouseEvent) => {
                if (!suppressClickElements.has(element)) return;
                suppressClickElements.delete(element);
                event.preventDefault();
                event.stopPropagation();
            }, true);
        }
    }

    private renderCardMini(card: Card) {
        return `
            <div class="db-card-mini">
                <img src="${card.imageUrl || ''}" class="card-image" alt="${escapeHtml(card.name)}">
            </div>
            <div class="db-card-title" title="${escapeHtml(card.name)}">${escapeHtml(card.name)}</div>
        `;
    }

    private renderDeckItemMini(card: Card) {
        return `
            <div class="db-deck-item-mini">
                <img src="${card.imageUrl || ''}" class="card-image" alt="${escapeHtml(card.name)}">
            </div>
        `;
    }
}
