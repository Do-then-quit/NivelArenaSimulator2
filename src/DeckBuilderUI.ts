import { DeckBuilderLogic } from './logic/DeckBuilderLogic';
import { Card, CardType, Attribute } from './logic/types';
import { HoverPreview } from './HoverPreview';
import { DeckPersistence } from './logic/DeckPersistence';

export class DeckBuilderUI {
    private logic: DeckBuilderLogic;
    private container: HTMLElement;
    private hoverPreview: HoverPreview;
    private onPlay: (deck: Card[], leader: Card) => void;
    private onBack: () => void;

    constructor(
        cards: Card[],
        container: HTMLElement,
        hoverPreview: HoverPreview,
        onPlay: (deck: Card[], leader: Card) => void,
        onBack: () => void
    ) {
        this.logic = new DeckBuilderLogic(cards);
        this.container = container;
        this.hoverPreview = hoverPreview;
        this.onPlay = onPlay;
        this.onBack = onBack;

        // Try to load last saved deck
        const savedDecks = DeckPersistence.getAllDecks();
        if (savedDecks.length > 0) {
            const lastDeck = savedDecks[savedDecks.length - 1];
            const deckCards = lastDeck.cardIds.map(id => cards.find(c => c.id === id)).filter((c): c is Card => !!c);
            this.logic.loadDeck(deckCards);
            // Leader might need to be stored separately or identified in cardIds
            // For now let's assume first leader found or store in metadata if we update SavedDeck
        }
    }

    render() {
        this.container.innerHTML = `
            <div class="deck-builder">
                <div class=\"deck-builder-header\">
                    <button id=\"db-back\" class=\"secondary-btn\">Back to Menu</button>
                    <h1>Deck Builder</h1>
                    <div class=\"db-actions\">
                        <button id=\"db-save\" class=\"primary-btn\">Save Deck</button>
                        <button id=\"db-play\" class=\"primary-btn\">Play with this Deck</button>
                    </div>
                </div>

                <div class=\"db-main\">
                    <div class=\"db-library\">
                        <div class=\"db-controls\">
                            <input type=\"text\" id=\"db-search\" placeholder=\"Search by name...\">
                            <select id=\"db-filter-pack\">
                                <option value=\"\">All Packs</option>
                                <option value=\"ST01\">ST01</option>
                                <option value=\"ST02\">ST02</option>
                                <option value=\"BT01\">BT01</option>
                            </select>
                            <select id=\"db-filter-type\">
                                <option value=\"\">All Types</option>
                                <option value=\"LEADER\">Leader</option>
                                <option value=\"UNIT\">Unit</option>
                                <option value=\"SKILL\">Skill</option>
                                <option value=\"ITEM\">Item</option>
                            </select>
                        </div>
                        <div class=\"db-card-grid\" id=\"db-card-grid\">
                            <!-- Cards will be rendered here -->
                        </div>
                    </div>

                    <div class=\"db-current-deck\">
                        <h2>Current Deck (<span id=\"db-deck-count\">0</span>/40)</h2>
                        <div id=\"db-validation-warnings\" class=\"validation-warnings\"></div>
                        <div class=\"db-leader-slot\" id=\"db-leader-slot\">
                            <!-- Leader card here -->
                        </div>
                        <div class=\"db-deck-list\" id=\"db-deck-list\">
                            <!-- Deck cards list here -->
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.attachListeners();
        this.updateLibrary();
        this.updateDeckView();
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

        document.getElementById('db-save')?.addEventListener('click', () => {
            const deck = this.logic.getCurrentDeck();
            const leader = this.logic.getLeader();
            if (deck.length > 0) {
                DeckPersistence.saveDeck({
                    id: 'custom-deck-' + Date.now(),
                    name: 'My Custom Deck',
                    cardIds: deck.map(c => c.id)
                    // Note: Need to handle leader persistence explicitly in a real impl
                });
                alert('Deck saved!');
            }
        });

        document.getElementById('db-play')?.addEventListener('click', () => {
            const validation = this.logic.validateDeck();
            if (!validation.valid) {
                if (!confirm(`Deck is invalid:\n${validation.errors.join('\n')}\n\nPlay anyway?`)) {
                    return;
                }
            }
            const leader = this.logic.getLeader();
            if (!leader) {
                alert('Please select a Leader first!');
                return;
            }
            this.onPlay(this.logic.getCurrentDeck(), leader);
        });
    }

    private updateLibrary() {
        const grid = document.getElementById('db-card-grid');
        if (!grid) return;

        const filtered = this.logic.getFilteredCards();
        grid.innerHTML = filtered.map(card => `
            <div class="db-card-item" data-id="${card.id}">
                ${this.renderCardMini(card)}
                <div class="db-card-overlay">
                    <button class="add-to-deck-btn" data-id="${card.id}">Add</button>
                </div>
                <div class="db-card-count">${this.logic.getCardCountInDeck(card.id)}</div>
            </div>
        `).join('');

        // Attach library listeners
        grid.querySelectorAll('.db-card-item').forEach(item => {
            item.addEventListener('mouseenter', (e) => {
                const id = (item as HTMLElement).dataset.id!;
                const card = filtered.find(c => c.id === id);
                if (card) this.hoverPreview.show(card, (e as MouseEvent).clientX, (e as MouseEvent).clientY);
            });
            item.addEventListener('mouseleave', () => this.hoverPreview.hide());
            
            item.querySelector('.add-to-deck-btn')?.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = (item as HTMLElement).dataset.id!;
                const card = filtered.find(c => c.id === id);
                if (card?.type === CardType.LEADER) {
                    this.logic.setLeader(id);
                } else {
                    this.logic.addCardToDeck(id);
                }
                this.updateDeckView();
                this.updateLibrary(); // Update counts
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
                // Logic needs a removeLeader or setLeader(null)
                // this.logic.setLeader(null); 
                this.updateDeckView();
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
            <div class="card mini ${card.attribute.toLowerCase()}">
                <img src="${card.imageUrl}" class="card-image">
                <div class="card-overlay">
                    <div class="card-name">${card.name}</div>
                </div>
            </div>
        `;
    }
}
