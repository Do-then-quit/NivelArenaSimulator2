import { Card } from './logic/types';
import { DeckPersistence, SavedDeck } from './logic/DeckPersistence';

export interface SetupStartOptions {
    revealBotHand: boolean;
}

export interface SetupUIOptions {
    showBotHandVisibilityOption?: boolean;
    defaultRevealBotHand?: boolean;
}

export class SetupUI {
    private container: HTMLElement;
    private cards: Card[];
    private onStart: (deck1: Card[], deck2: Card[], leader1: Card, leader2: Card, options: SetupStartOptions) => void;
    private onBack: () => void;
    private uiOptions: Required<SetupUIOptions>;
    private selectedDeck1: SavedDeck | null = null;
    private selectedDeck2: SavedDeck | null = null;
    private revealBotHand: boolean;

    constructor(
        container: HTMLElement,
        cards: Card[],
        onStart: (deck1: Card[], deck2: Card[], leader1: Card, leader2: Card, options: SetupStartOptions) => void,
        onBack: () => void,
        options: SetupUIOptions = {}
    ) {
        this.container = container;
        this.cards = cards;
        this.onStart = onStart;
        this.onBack = onBack;
        this.uiOptions = {
            showBotHandVisibilityOption: options.showBotHandVisibilityOption ?? false,
            defaultRevealBotHand: options.defaultRevealBotHand ?? true,
        };
        this.revealBotHand = this.uiOptions.defaultRevealBotHand;

        const allDecks = DeckPersistence.getAllDecks();
        if (allDecks.length > 0) {
            this.selectedDeck1 = allDecks[0];
            this.selectedDeck2 = allDecks[0];
        }
    }

    render() {
        const allDecks = DeckPersistence.getAllDecks();

        this.container.innerHTML = `
            <div class="setup-screen">
                <h1>Simulation Setup</h1>
                <div class="setup-main">
                    <div class="player-setup">
                        <h3>Player 1</h3>
                        <div class="deck-select">
                            <label>Selected Deck:</label>
                            <select id="p1-deck-select">
                                ${allDecks.map(d => `<option value="${d.id}" ${this.selectedDeck1?.id === d.id ? 'selected' : ''}>${d.name}</option>`).join('')}
                                ${allDecks.length === 0 ? '<option value="">No Decks Saved</option>' : ''}
                            </select>
                        </div>
                        <div id="p1-deck-preview" class="deck-preview-small"></div>
                    </div>

                    <div class="vs-divider">VS</div>

                    <div class="player-setup">
                        <h3>Player 2</h3>
                        <div class="deck-select">
                            <label>Selected Deck:</label>
                            <select id="p2-deck-select">
                                ${allDecks.map(d => `<option value="${d.id}" ${this.selectedDeck2?.id === d.id ? 'selected' : ''}>${d.name}</option>`).join('')}
                                ${allDecks.length === 0 ? '<option value="">No Decks Saved</option>' : ''}
                            </select>
                        </div>
                        <div id="p2-deck-preview" class="deck-preview-small"></div>
                    </div>
                </div>

                ${this.uiOptions.showBotHandVisibilityOption ? `
                    <div class="setup-extra-options">
                        <h3>Baseline Bot Hand Visibility</h3>
                        <label class="setup-radio-option">
                            <input type="radio" name="bot-hand-visibility" value="hide" ${this.revealBotHand ? '' : 'checked'}>
                            <span>Hide Bot Hand (Recommended)</span>
                        </label>
                        <label class="setup-radio-option">
                            <input type="radio" name="bot-hand-visibility" value="show" ${this.revealBotHand ? 'checked' : ''}>
                            <span>Show Bot Hand</span>
                        </label>
                    </div>
                ` : ''}

                <div class="setup-actions">
                    <button id="setup-back" class="secondary-btn">Back to Menu</button>
                    <button id="setup-start" class="primary-btn" ${allDecks.length === 0 ? 'disabled' : ''}>Start Simulation</button>
                </div>
            </div>
        `;

        this.attachListeners();
        this.updatePreviews();
    }

    private attachListeners() {
        document.getElementById('setup-back')?.addEventListener('click', () => this.onBack());

        const p1Select = document.getElementById('p1-deck-select') as HTMLSelectElement;
        p1Select?.addEventListener('change', () => {
            this.selectedDeck1 = DeckPersistence.getDeck(p1Select.value);
            this.updatePreviews();
        });

        const p2Select = document.getElementById('p2-deck-select') as HTMLSelectElement;
        p2Select?.addEventListener('change', () => {
            this.selectedDeck2 = DeckPersistence.getDeck(p2Select.value);
            this.updatePreviews();
        });

        if (this.uiOptions.showBotHandVisibilityOption) {
            document.querySelectorAll<HTMLInputElement>('input[name="bot-hand-visibility"]').forEach(radio => {
                radio.addEventListener('change', () => {
                    this.revealBotHand = radio.value === 'show';
                });
            });
        }

        document.getElementById('setup-start')?.addEventListener('click', () => {
            if (!this.selectedDeck1 || !this.selectedDeck2) {
                alert('Please select decks for both players!');
                return;
            }

            const getDeckCards = (saved: SavedDeck) => {
                return saved.cardIds.map(id => this.cards.find(c => c.id === id)).filter((c): c is Card => !!c);
            };

            const deck1 = getDeckCards(this.selectedDeck1);
            const deck2 = getDeckCards(this.selectedDeck2);
            const leader1 = this.cards.find(c => c.id === this.selectedDeck1?.leaderId);
            const leader2 = this.cards.find(c => c.id === this.selectedDeck2?.leaderId);

            if (!leader1 || !leader2) {
                alert('Both decks must have a leader!');
                return;
            }

            this.onStart(deck1, deck2, leader1, leader2, {
                revealBotHand: this.revealBotHand,
            });
        });
    }

    private updatePreviews() {
        const updatePreview = (deck: SavedDeck | null, containerId: string) => {
            const container = document.getElementById(containerId);
            if (!container) return;

            if (!deck) {
                container.innerHTML = 'No deck selected';
                return;
            }

            const leader = this.cards.find(c => c.id === deck.leaderId);
            container.innerHTML = `
                <div class="preview-info">
                    <strong>Leader:</strong> ${leader?.name || 'None'}
                </div>
                <div class="preview-info">
                    <strong>Cards:</strong> ${deck.cardIds.length}/40
                </div>
            `;
        };

        updatePreview(this.selectedDeck1, 'p1-deck-preview');
        updatePreview(this.selectedDeck2, 'p2-deck-preview');
    }
}
