import { DeckBuilderLogic } from './logic/DeckBuilderLogic';
import { Attribute, Card, CardType } from './logic/types';
import { HoverPreview } from './HoverPreview';
import { DeckPersistence } from './logic/DeckPersistence';
import { DECK_BUILDER_ALLOWED_PACKS } from './logic/DeckBuilderCardPool';

export class DeckBuilderUI {
    private logic: DeckBuilderLogic;
    private container: HTMLElement;
    private hoverPreview: HoverPreview;
    private onBack: () => void;

    constructor(
        cards: Card[],
        container: HTMLElement,
        hoverPreview: HoverPreview,
        onBack: () => void
    ) {
        this.logic = new DeckBuilderLogic(cards);
        this.container = container;
        this.hoverPreview = hoverPreview;
        this.onBack = onBack;

        // Try to load last saved deck or first one
        const savedDecks = DeckPersistence.getAllDecks();
        if (savedDecks.length > 0) {
            const lastDeck = savedDecks[0];
            const deckCards = lastDeck.cardIds.map(id => cards.find(c => c.id === id)).filter((c): c is Card => !!c);
            const leader = cards.find(c => c.id === lastDeck.leaderId);
            this.logic.loadDeck(deckCards, leader);
        }
    }

    render() {
        const packOptions = DECK_BUILDER_ALLOWED_PACKS
            .map(pack => `<option value="${pack}">${pack}</option>`)
            .join('');

        this.container.innerHTML = `
            <div class="deck-builder">
                <div class="deck-builder-header">
                    <button id="db-back" class="secondary-btn">Back to Menu</button>
                    <h1>Deck Builder</h1>
                </div>

                <div class="db-main">
                    <div class="db-sidebar">
                        <h2>Saved Decks</h2>
                        <div id="db-saved-list" class="db-saved-list">
                            <!-- Saved decks will be listed here -->
                        </div>
                        <button id="db-new-deck" class="secondary-btn" style="width: 100%; margin-top: 10px;">+ New Deck</button>
                    </div>

                    <div class="db-library">
                        <div class="db-controls">
                            <input type="text" id="db-search" placeholder="Search by name...">
                            <select id="db-filter-pack">
                                <option value="">All Packs</option>
                                ${packOptions}
                            </select>
                            <select id="db-filter-type">
                                <option value="">All Types</option>
                                <option value="LEADER">Leader</option>
                                <option value="UNIT">Unit</option>
                                <option value="SKILL">Skill</option>
                                <option value="ITEM">Item</option>
                            </select>
                            <select id="db-filter-attribute">
                                <option value="">All Attributes</option>
                                <option value="FIRE">화염</option>
                                <option value="EARTH">대지</option>
                                <option value="STORM">폭풍</option>
                                <option value="WATER">파도</option>
                                <option value="LIGHTNING">번개</option>
                                <option value="NONE">없음</option>
                            </select>
                        </div>
                        <div class="db-card-grid" id="db-card-grid">
                            <!-- Cards will be rendered here -->
                        </div>
                    </div>

                    <div class="db-current-deck">
                        <div class="db-current-deck-header">
                            <input type="text" id="db-deck-name" placeholder="Deck Name" class="db-input db-deck-name-input" value="My Custom Deck">
                            <button id="db-save" class="primary-btn db-save-btn">Save Deck</button>
                        </div>
                        <div class="db-current-deck-count">Deck Cards: <span id="db-deck-count">0</span>/40</div>
                        <div id="db-validation-warnings" class="validation-warnings"></div>
                        <div class="db-leader-slot" id="db-leader-slot">
                            <!-- Leader card here -->
                        </div>
                        <div class="db-deck-list" id="db-deck-list">
                            <!-- Deck cards list here -->
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.attachListeners();
        this.updateLibrary();
        this.updateDeckView();
        this.updateSavedList();
    }

    private attachListeners() {
        document.getElementById('db-back')?.addEventListener('click', () => this.onBack());

        document.getElementById('db-search')?.addEventListener('input', (e) => {
            this.logic.setFilters({ searchText: (e.target as HTMLInputElement).value });
            this.updateLibrary();
        });

        document.getElementById('db-filter-pack')?.addEventListener('change', (e) => {
            this.logic.setFilters({ pack: (e.target as HTMLSelectElement).value });
            this.updateLibrary();
        });

        document.getElementById('db-filter-type')?.addEventListener('change', (e) => {
            this.logic.setFilters({ type: (e.target as HTMLSelectElement).value as CardType });
            this.updateLibrary();
        });

        document.getElementById('db-filter-attribute')?.addEventListener('change', (e) => {
            const value = (e.target as HTMLSelectElement).value;
            this.logic.setFilters({ attribute: value ? (value as Attribute) : undefined });
            this.updateLibrary();
        });

        document.getElementById('db-save')?.addEventListener('click', () => {
            const deck = this.logic.getCurrentDeck();
            const leader = this.logic.getLeader();
            const nameInput = document.getElementById('db-deck-name') as HTMLInputElement;
            const name = nameInput?.value || 'Untitled Deck';

            if (deck.length > 0 || leader) {
                DeckPersistence.saveDeck({
                    id: 'deck-' + Date.now(),
                    name: name,
                    leaderId: leader?.id || null,
                    cardIds: deck.map(c => c.id)
                });
                alert('Deck saved!');
                this.updateSavedList();
            }
        });

        document.getElementById('db-new-deck')?.addEventListener('click', () => {
            if (confirm('Create a new deck? Current unsaved changes will be lost.')) {
                this.logic.resetDeck();
                (document.getElementById('db-deck-name') as HTMLInputElement).value = 'My Custom Deck';
                this.updateDeckView();
                this.updateLibrary();
            }
        });
    }

    private updateSavedList() {
        const listContainer = document.getElementById('db-saved-list');
        if (!listContainer) return;

        const decks = DeckPersistence.getAllDecks();
        listContainer.innerHTML = decks.map(deck => `
            <div class="saved-deck-item">
                <span class="deck-name">${deck.name}</span>
                <div class="deck-item-actions">
                    <button class="load-deck-btn" data-id="${deck.id}">Load</button>
                    <button class="delete-deck-btn" data-id="${deck.id}">Del</button>
                </div>
            </div>
        `).join('') || '<div class="no-decks">No saved decks</div>';

        listContainer.querySelectorAll('.load-deck-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = (btn as HTMLElement).dataset.id!;
                const saved = DeckPersistence.getDeck(id);
                if (saved) {
                    const deckCards = saved.cardIds.map(cid => this.logic.getFilteredCards().find(c => c.id === cid)).filter((c): c is Card => !!c);
                    const leader = this.logic.getFilteredCards().find(c => c.id === saved.leaderId);
                    this.logic.loadDeck(deckCards, leader);
                    (document.getElementById('db-deck-name') as HTMLInputElement).value = saved.name;
                    this.updateDeckView();
                    this.updateLibrary();
                }
            });
        });

        listContainer.querySelectorAll('.delete-deck-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = (btn as HTMLElement).dataset.id!;
                if (confirm('Delete this deck?')) {
                    DeckPersistence.deleteDeck(id);
                    this.updateSavedList();
                }
            });
        });
    }

    private updateLibrary() {
        const grid = document.getElementById('db-card-grid');
        if (!grid) return;

        const filtered = this.logic.getFilteredCards();
        grid.innerHTML = filtered.map(card => `
            <div class="db-card-item" data-id="${card.id}" role="button" tabindex="0">
                ${this.renderCardMini(card)}
                <div class="db-card-count">${this.logic.getCardCountInDeck(card.id)}</div>
            </div>
        `).join('');

        // Attach library listeners
        grid.querySelectorAll('.db-card-item').forEach(item => {
            const addCardFromLibrary = () => {
                const id = (item as HTMLElement).dataset.id!;
                const card = filtered.find(c => c.id === id);
                if (card?.type === CardType.LEADER) {
                    this.logic.setLeader(id);
                } else {
                    this.logic.addCardToDeck(id);
                }
                this.updateDeckView();
                this.updateLibrary();
            };

            item.addEventListener('mouseenter', (e) => {
                const id = (item as HTMLElement).dataset.id!;
                const card = filtered.find(c => c.id === id);
                if (card) this.hoverPreview.show(card, (e as MouseEvent).clientX, (e as MouseEvent).clientY);
            });
            item.addEventListener('mousemove', (e) => {
                this.hoverPreview.move((e as MouseEvent).clientX, (e as MouseEvent).clientY);
            });
            item.addEventListener('mouseleave', () => this.hoverPreview.hide());
            item.addEventListener('click', () => addCardFromLibrary());
            item.addEventListener('keydown', (e: Event) => {
                const keyboardEvent = e as KeyboardEvent;
                if (keyboardEvent.key !== 'Enter' && keyboardEvent.key !== ' ') return;
                keyboardEvent.preventDefault();
                addCardFromLibrary();
            });
        });
    }

    private updateDeckView() {
        const deckList = document.getElementById('db-deck-list');
        const leaderSlot = document.getElementById('db-leader-slot');
        const countDisplay = document.getElementById('db-deck-count');
        const warnings = document.getElementById('db-validation-warnings');

        if (countDisplay) countDisplay.innerText = this.logic.getCurrentDeck().length.toString();

        const validation = this.logic.validateDeck();
        if (warnings) {
            warnings.innerHTML = validation.errors.map(err => `<div class="warning">${err}</div>`).join('');
        }

        if (leaderSlot) {
            const leader = this.logic.getLeader();
            leaderSlot.innerHTML = leader ? `
                <div class="leader-preview">
                    <span>LEADER: ${leader.name}</span>
                    <button class="remove-leader-btn">X</button>
                </div>
            ` : 'No Leader Selected';

            leaderSlot.querySelector('.remove-leader-btn')?.addEventListener('click', () => {
                this.logic.setLeader(null);
                this.updateDeckView();
                this.updateLibrary();
            });
        }

        if (deckList) {
            const deck = this.logic.getCurrentDeck();
            // Group by ID for cleaner list
            const grouped: Record<string, { card: Card, count: number }> = {};
            deck.forEach(c => {
                if (!grouped[c.id]) grouped[c.id] = { card: c, count: 0 };
                grouped[c.id].count++;
            });

            deckList.innerHTML = Object.values(grouped).map(({ card, count }) => `
                <div class="deck-list-item">
                    <span>${card.name} x${count}</span>
                    <button class="remove-btn" data-id="${card.id}">-</button>
                </div>
            `).join('');

            deckList.querySelectorAll('.remove-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = (btn as HTMLElement).dataset.id!;
                    this.logic.removeCardFromDeck(id);
                    this.updateDeckView();
                    this.updateLibrary();
                });
            });
        }
    }

    private renderCardMini(card: Card) {
        return `
            <div class="db-card-mini">
                <img src="${card.imageUrl}" class="card-image" alt="${card.name}">
            </div>
            <div class="db-card-title" title="${card.name}">${card.name}</div>
        `;
    }
}
