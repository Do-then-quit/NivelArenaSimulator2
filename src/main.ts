import './style.css'
import { GameEngine } from './logic/GameEngine';
import { createDeck, DUMMY_CARDS } from './logic/CardDatabase';
import { Phase, Card, CardType } from './logic/types';

import { DebugManager } from './logic/DebugManager';
import { HoverPreview } from './HoverPreview';
import { DeckBuilderUI } from './DeckBuilderUI';

import { SetupUI } from './SetupUI';

enum Screen {
    MENU,
    DECK_BUILDER,
    SETUP,
    GAME
}

let currentScreen: Screen = Screen.MENU;
let game: GameEngine | null = null;
const hoverPreview = new HoverPreview();
const app = document.querySelector<HTMLDivElement>('#app')!;

function renderMenu() {
    app.innerHTML = `
        <div class="main-menu">
            <h1>NivelArena</h1>
            <div class="menu-buttons">
                <button id="start-game-btn" class="primary-btn">Quick Play (ST01 vs ST01)</button>
                <button id="custom-sim-btn" class="primary-btn">Custom Simulation</button>
                <button id="deck-builder-btn" class="secondary-btn">Deck Builder</button>
            </div>
        </div>
    `;

    document.getElementById('start-game-btn')?.addEventListener('click', () => {
        const deck1 = createDeck();
        const deck2 = createDeck();
        const leader1 = DUMMY_CARDS.find(c => c.id === 'ST01-001') || DUMMY_CARDS[0];
        const leader2 = DUMMY_CARDS.find(c => c.id === 'ST01-001') || DUMMY_CARDS[0];
        startGame(deck1, deck2, leader1, leader2);
    });

    document.getElementById('custom-sim-btn')?.addEventListener('click', () => {
        currentScreen = Screen.SETUP;
        render();
    });

    document.getElementById('deck-builder-btn')?.addEventListener('click', () => {
        currentScreen = Screen.DECK_BUILDER;
        render();
    });
}

function startGame(deck1: Card[], deck2: Card[], leader1: Card, leader2: Card) {
    game = new GameEngine('Player 1', 'Player 2', deck1, deck2, leader1, leader2);
    // Initialize Debug System
    (window as any).debug = new DebugManager(game, render);
    currentScreen = Screen.GAME;
    render();
}

function renderDeckBuilder() {
    const dbUI = new DeckBuilderUI(
        DUMMY_CARDS,
        app,
        hoverPreview,
        (deck, leader) => {
            // After building a deck, we can offer to start a game or go back
            // For simplicity, let's keep the one-player play behavior as a quick test
            const deck2 = createDeck();
            const leader2 = DUMMY_CARDS.find(c => c.id === 'ST01-001') || DUMMY_CARDS[0];
            startGame(deck, deck2, leader, leader2);
        },
        () => {
            currentScreen = Screen.MENU;
            render();
        }
    );
    dbUI.render();
}

function renderSetup() {
    const setupUI = new SetupUI(
        app,
        DUMMY_CARDS,
        (deck1, deck2, leader1, leader2) => {
            startGame(deck1, deck2, leader1, leader2);
        },
        () => {
            currentScreen = Screen.MENU;
            render();
        }
    );
    setupUI.render();
}

function render() {
    if (currentScreen === Screen.MENU) {
        renderMenu();
    } else if (currentScreen === Screen.DECK_BUILDER) {
        renderDeckBuilder();
    } else if (currentScreen === Screen.SETUP) {
        renderSetup();
    } else if (currentScreen === Screen.GAME && game) {
        renderGame();
    }
}

function renderGame() {
    if (!game) return;
    const currentPlayer = game.currentPlayer;
    const opponent = game.opponentPlayer;


    // Helper to determine if a zone is a valid drop target
    const isMainPhase = game.state.phase === Phase.MAIN;

    app.innerHTML = `
    <div class="game-container">
      <div class="header">
        <h1>NivelArena</h1>
        ${game.state.interactionMode === 'SELECT_TARGET' ? `
            <div style="background: #e17055; color: white; padding: 10px; border-radius: 4px; animation: pulse 1s infinite;">
                SELECT TARGET FOR SKILL
            </div>
        ` : ''}
        ${game.state.interactionMode === 'SELECT_COST' ? `
            <div style="background: #0984e3; color: white; padding: 10px; border-radius: 4px; animation: pulse 1s infinite;">
                SELECT CARD TO TRASH (COST)
            </div>
        ` : ''}
        <button id="db-back-to-menu" class="secondary-btn" style="position: absolute; top: 10px; left: 10px;">Menu</button>
      </div>

      ${renderPlayer(opponent, true, isMainPhase)}
      ${renderPlayer(currentPlayer, false, isMainPhase)}

      <div class="game-controls">
        <div class="status-bar">
          <div class="status-item"><span>Turn</span> <strong>${game.state.turnCount}</strong></div>
          <div class="status-item"><span>Phase</span> <strong>${game.state.phase}</strong></div>
          <div class="status-item"><span>Active</span> <strong>${game.currentPlayer.name}</strong></div>
        </div>
        <button id="next-phase" class="primary-btn" ${game.state.phase === Phase.BLOCK || game.state.interactionMode !== 'NORMAL' ? 'disabled' : ''}>Next Phase</button>
      </div>

      <div class="hand-zone">
          ${currentPlayer.hand.map((c, i) => `
              <div class="card-in-hand ${game.state.interactionMode === 'SELECT_COST' ? 'cost-candidate' : ''}" draggable="${isMainPhase && game.state.interactionMode === 'NORMAL'}" data-index="${i}">
                  ${renderCard(c)}
              </div>
          `).join('')}
      </div>

      <div class="opponent-hand-zone">
          ${opponent.hand.map((c, i) => `
              <div class="card-in-hand" data-index="${i}">
                  ${renderCard(c)}
              </div>
          `).join('')}
      </div>


      ${renderOptionalEffectModal()}
      ${renderTrashModal()}
    </div>
  `;

    attachListeners();
}

function renderOptionalEffectModal() {
    if (!game) return '';
    if (game.state.interactionMode !== 'SELECT_OPTIONAL') return '';
    const pending = game.state.pendingEffect as any;
    if (!pending) return '';

    // Attempt to get description from full effect if available
    const description = pending._fullEffect ? pending._fullEffect.description : 'Activate optional effect?';

    return `
        <div class="modal-overlay">
            <div class="modal-content">
                <h3>Optional Effect</h3>
                <p>${description}</p>
                <div class="modal-actions">
                    <button id="opt-confirm" class="primary-btn">Activate</button>
                    <button id="opt-skip" class="secondary-btn">Skip</button>
                </div>
            </div>
        </div>
    `;
}

function renderTrashModal() {
    if (!game) return '';
    if (game.state.interactionMode !== 'SELECT_TARGET') return '';
    const pending = game.state.pendingEffect as any;
    if (!pending || pending.validTargets !== 'MY_TRASH') return '';

    // Use the effect source player's trash, not the current turn player's trash
    // This is important for trigger effects that activate on opponent's turn
    const sourcePlayer = game.state.players.find(p => p.id === pending.sourcePlayerId);
    if (!sourcePlayer) return '';
    const trash = sourcePlayer.trash;

    return `
        <div class="modal-overlay">
            <div class="trash-modal">
                <h3>Select a card from Trash</h3>
                <div class="trash-grid">
                    ${trash.map((c, i) => `
                        <div class="trash-card-item" data-index="${i}">
                            ${renderCard(c)}
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

function renderPlayer(player: any, isOpponent: boolean, isMainPhase: boolean) {
    if (!game) return '';
    return `
      <div class="player-area ${isOpponent ? 'opponent' : 'current'}">
        <!-- Level Zone (1) -->
        <div class="level-zone">
            <!-- Leader Card Slot -->
            <div class="leader-slot">
                ${player.levelZone ? renderCard(player.levelZone, true) : ''}
            </div>

            ${Array.from({ length: 10 }, (_, i) => 10 - i).map(lv => `
                <div class="level-indicator ${player.leaderLevel >= lv ? 'active' : ''}">${lv}</div>
            `).join('')}
            <div class="level-indicator" style="color: #fff; font-size: 0.6rem;">LVL</div>
        </div>

        <!-- Main Field (2, 3, 4) -->
        <div class="field-center">
            <!-- Unit Zones (3) -->
            <div class="units-container">
                ${player.unitZones.map((z: any, i: number) => {
        const blockerZoneIndex = (game!.state.pendingAttackerIndex ?? -1);
        const isBlockingTarget = game!.state.phase === Phase.BLOCK && isOpponent && blockerZoneIndex === i;
        return `
                    <div class="zone unit-zone ${!isOpponent ? 'interactive drop-zone' : ''} ${isBlockingTarget ? 'blocking-target' : ''}" data-player="${isOpponent ? 'opponent' : 'current'}" data-index="${i}">
                        ${z.unit ? renderCard(z.unit, false, game!.getUnitPower(z, player), game!.getUnitHit(z, player)) : '<span style="color: rgba(255,255,255,0.1); font-size: 0.8rem; font-weight: bold;">UNIT</span>'}
                        
                        <!-- Items -->
                        ${z.items.length > 0 ? `
                            <div class="attached-items">
                                ${z.items.map((item: Card) => `
                                    <div class="mini-item-card">
                                        <img src="${item.imageUrl}" alt="${item.name}">
                                    </div>
                                `).join('')}
                            </div>
                            <div class="item-tooltip">
                                ${z.items.map((item: Card) => `
                                    <div style="display: flex; gap: 10px; margin-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;">
                                        <div class="tooltip-card-preview">
                                            <img src="${item.imageUrl}" style="width:100%; height:100%; object-fit:cover;">
                                        </div>
                                        <div class="tooltip-info">
                                            <div class="tooltip-item-name">${item.name}</div>
                                            <div class="tooltip-item-text">${item.text}</div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}

                        ${z.unit && !isOpponent && game!.state.phase === Phase.ATTACK && !z.hasAttacked ? '<button class="attack-btn">Attack</button>' : ''}
                        ${z.unit && !isOpponent && game!.state.phase === Phase.MAIN && !z.hasActivatedEffectThisTurn && z.unit.effects?.some((e: any) => e.activation === 'ACTIVE') ? '<button class="active-btn">Active</button>' : ''}
                        ${isBlockingTarget ? `
                            <div class="block-controls">
                                <button class="block-btn">Block</button>
                                <button class="pass-btn">Pass</button>
                            </div>
                        ` : ''}
                        ${z.unit ? `<div class="stats">${game!.getUnitPower(z, player)} / ${game!.getUnitHit(z, player)}</div>` : ''}
                    </div>
                `}).join('')}
            </div>

            <!-- Bottom Field (2, 4) -->
            <div class="bottom-center">
                <div class="damage-zone">
                    ${player.damage.map((c: any) => renderCard(c, true)).join('')}
                    ${player.damage.length === 0 ? '<span style="color: rgba(255,255,255,0.1); align-self: center; width: 100%; text-align: center; font-weight: bold;">DAMAGE ZONE</span>' : ''}
                </div>
                <div class="skill-zone ${!isOpponent && isMainPhase ? 'interactive drop-zone-skill' : ''}">
                    ${player.skillZone.map((c: any) => renderCard(c, true)).join('')}
                    ${player.skillZone.length === 0 ? '<span style="color: rgba(255,255,255,0.1); font-weight: bold; width: 100%; text-align: center;">SKILL</span>' : ''}
                </div>
            </div>
        </div>

        <!-- Right Side (5, 6) -->
        <div class="field-right">
            <div class="deck-zone">
                <div class="deck-count">${player.deck.length}</div>
                <div style="font-size: 0.6rem; color: #a0aec0; font-weight: bold;">DECK</div>
            </div>
            <div class="trash-zone">
                ${player.trash.length > 0 ? renderCard(player.trash[player.trash.length - 1], true) : '<span style="color: rgba(255,255,255,0.1); font-size: 0.7rem; font-weight: bold;">TRASH</span>'}
            </div>
        </div>
      </div>
    `;
}

function renderCard(card: Card, isSmall: boolean = false, calculatedPower?: number, calculatedHit?: number) {
    const isUnit = card.type === CardType.UNIT;
    const power = calculatedPower !== undefined ? calculatedPower : card.power;
    const hit = calculatedHit !== undefined ? calculatedHit : card.hit;

    return `
        <div class="card ${card.attribute.toLowerCase()} ${isSmall ? 'small-card' : ''} ${card.isAwakened ? 'awakened' : ''}">
            ${card.imageUrl ? `<img src="${card.imageUrl}" class="card-image" alt="${card.name}">` : ''}
            <div class="card-overlay">
                <div class="card-cost">${card.cost}</div>
                <div class="card-name">${card.name}</div>
                ${isUnit && !isSmall ? `
                    <div class="card-stats-row">
                        <span class="stat-power" ${calculatedPower !== undefined && calculatedPower !== card.power ? 'style="color:#4ecdc4; font-weight:bold;"' : ''}>P:${power}</span>
                        <span class="stat-hit" ${calculatedHit !== undefined && calculatedHit !== card.hit ? 'style="color:#ff6b6b; font-weight:bold;"' : ''}>H:${hit}</span>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

let draggedCardIndex: number | null = null;

function attachListeners() {
    if (!game) return;

    document.getElementById('db-back-to-menu')?.addEventListener('click', () => {
        currentScreen = Screen.MENU;
        render();
    });

    document.getElementById('next-phase')?.addEventListener('click', () => {
        game!.nextPhase();
        render();
    });

    // Drag and Drop Listeners
    const cards = document.querySelectorAll('.card-in-hand');
    cards.forEach(card => {
        card.addEventListener('dragstart', (e) => {
            const event = e as DragEvent;
            if (event.dataTransfer) {
                const index = parseInt((card as HTMLElement).dataset.index!);
                draggedCardIndex = index;
                event.dataTransfer.setData('text/plain', index.toString());
                event.dataTransfer.effectAllowed = 'move';
            }
        });
        card.addEventListener('dragend', () => {
            draggedCardIndex = null;
            document.querySelectorAll('.zone').forEach(z => z.classList.remove('valid-target', 'invalid-target'));
        });

        // Hover Preview Listeners
        card.addEventListener('mouseenter', (e) => {
            const index = parseInt((card as HTMLElement).dataset.index!);
            const cardObj = game!.currentPlayer.hand[index];
            const mouseEvent = e as MouseEvent;
            hoverPreview.show(cardObj, mouseEvent.clientX, mouseEvent.clientY);
        });

        card.addEventListener('mousemove', (e) => {
            const mouseEvent = e as MouseEvent;
            const index = parseInt((card as HTMLElement).dataset.index!);
            const cardObj = game!.currentPlayer.hand[index];
            hoverPreview.show(cardObj, mouseEvent.clientX, mouseEvent.clientY);
        });

        card.addEventListener('mouseleave', () => {
            hoverPreview.hide();
        });
    });

    const dropZones = document.querySelectorAll('.drop-zone');
    dropZones.forEach(zone => {
        zone.addEventListener('dragover', (e) => {
            e.preventDefault(); // Necessary to allow dropping
            const event = e as DragEvent;
            if (event.dataTransfer) {
                event.dataTransfer.dropEffect = 'move';
            }

            if (draggedCardIndex !== null) {
                const zoneIndex = parseInt((zone as HTMLElement).dataset.index!);
                const card = game!.currentPlayer.hand[draggedCardIndex];

                let isValid = false;
                if (card.type === CardType.UNIT) {
                    isValid = RuleValidator.canPlayUnit(game!, game!.currentPlayer, draggedCardIndex, zoneIndex).valid;
                } else if (card.type === CardType.ITEM) {
                    isValid = RuleValidator.canPlayItem(game!, game!.currentPlayer, draggedCardIndex, zoneIndex).valid;
                }

                zone.classList.add(isValid ? 'valid-target' : 'invalid-target');
            }

            zone.classList.add('drag-over');
        });

        zone.addEventListener('dragleave', () => {
            zone.classList.remove('drag-over', 'valid-target', 'invalid-target');
        });

        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('drag-over');
            const event = e as DragEvent;
            if (event.dataTransfer) {
                const cardIndex = parseInt(event.dataTransfer.getData('text/plain'));
                const zoneIndex = parseInt((zone as HTMLElement).dataset.index!);

                if (!isNaN(cardIndex) && !isNaN(zoneIndex)) {
                    const card = game!.currentPlayer.hand[cardIndex];
                    if (card.type === CardType.UNIT) {
                        game!.playUnit(cardIndex, zoneIndex);
                    } else if (card.type === CardType.ITEM) {
                        game!.playItem(cardIndex, zoneIndex);
                    }
                    render();
                }
            }
        });
    });


    // Skill Zone Drop Listener
    const skillZones = document.querySelectorAll('.drop-zone-skill');
    skillZones.forEach(zone => {
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            const event = e as DragEvent;
            if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';

            if (draggedCardIndex !== null) {
                const card = game!.currentPlayer.hand[draggedCardIndex];
                const isValid = RuleValidator.canPlaySkill(game!, game!.currentPlayer, draggedCardIndex).valid;
                zone.classList.add(isValid ? 'valid-target' : 'invalid-target');
            }

            zone.classList.add('drag-over');
        });

        zone.addEventListener('dragleave', () => {
            zone.classList.remove('drag-over', 'valid-target', 'invalid-target');
        });

        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('drag-over');
            const event = e as DragEvent;
            if (event.dataTransfer) {
                const cardIndex = parseInt(event.dataTransfer.getData('text/plain'));
                if (!isNaN(cardIndex)) {
                    game!.playSkill(cardIndex);
                    render();
                }
            }
        });
    });


    // Unit Zone Hover Listeners
    const unitZones = document.querySelectorAll('.unit-zone');
    unitZones.forEach(zone => {
        zone.addEventListener('mouseenter', (e) => {
            const el = zone as HTMLElement;
            const isOpponent = el.dataset.player === 'opponent';
            const index = parseInt(el.dataset.index!);
            const player = isOpponent ? game!.opponentPlayer : game!.currentPlayer;
            const unit = player.unitZones[index].unit;

            if (unit) {
                const mouseEvent = e as MouseEvent;
                hoverPreview.show(unit, mouseEvent.clientX, mouseEvent.clientY);
            }
        });

        zone.addEventListener('mousemove', (e) => {
            const el = zone as HTMLElement;
            const isOpponent = el.dataset.player === 'opponent';
            const index = parseInt(el.dataset.index!);
            const player = isOpponent ? game!.opponentPlayer : game!.currentPlayer;
            const unit = player.unitZones[index].unit;

            if (unit) {
                const mouseEvent = e as MouseEvent;
                hoverPreview.show(unit, mouseEvent.clientX, mouseEvent.clientY);
            }
        });

        zone.addEventListener('mouseleave', () => {
            hoverPreview.hide();
        });
    });

    document.querySelectorAll('.attack-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const zoneIndex = parseInt((btn.closest('.unit-zone') as HTMLElement).dataset.index!);
            game!.attack(zoneIndex);
            render();
        });
    });

    document.querySelectorAll('.block-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            game!.resolveBlock(true);
            render();
        });
    });

    document.querySelectorAll('.pass-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            game!.resolveBlock(false);
            render();
        });
    });


    document.querySelectorAll('.active-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const zoneIndex = parseInt((btn.closest('.unit-zone') as HTMLElement).dataset.index!);
            const zone = game!.currentPlayer.unitZones[zoneIndex];
            const effectIndex = zone.unit?.effects?.findIndex(e => e.activation === 'ACTIVE') ?? -1;

            if (effectIndex !== -1) {
                game!.activateEffect(zoneIndex, effectIndex);
                render();
            }
        });
    });

    // Cost Selection Listener
    if (game.state.interactionMode === 'SELECT_COST') {
        const handCards = document.querySelectorAll('.hand-zone .card-in-hand');
        const pending = game.state.pendingEffect as any;
        const costFilter = pending?._fullEffect?.cost?.cardTypeFilter;

        handCards.forEach((card, i) => {
            const el = card as HTMLElement;
            const handCard = game!.currentPlayer.hand[i];

            // Check if this card matches the required type for cost payment
            const isValidCostCard = !costFilter || handCard.type === costFilter;

            if (isValidCostCard) {
                el.style.cursor = 'pointer';
                el.style.boxShadow = '0 0 10px #0984e3';
                el.addEventListener('click', (_e) => {
                    const index = parseInt(el.dataset.index!);
                    game!.selectCost(index);
                    render();
                });
            } else {
                // Dim invalid cards
                el.style.opacity = '0.4';
                el.style.cursor = 'not-allowed';
            }
        });
    }

    // Zone Selection Listener (for Skills)
    if (game.state.interactionMode === 'SELECT_TARGET') {
        const units = document.querySelectorAll('.unit-zone');
        units.forEach(u => {
            u.addEventListener('click', (_e) => {
                const el = u as HTMLElement;
                const zoneIndex = parseInt(el.dataset.index!);
                const isOpponent = el.dataset.player === 'opponent';
                game!.selectTarget(zoneIndex, isOpponent);
                render();
            });
            // Add visual cue
            (u as HTMLElement).style.cursor = 'crosshair';
            (u as HTMLElement).style.boxShadow = '0 0 10px #ffeaa7';
        });
    }

    // Trash Selection Listener
    if (game.state.interactionMode === 'SELECT_TARGET') {
        const pending = game.state.pendingEffect as any;
        if (pending && pending.validTargets === 'MY_TRASH') {
            document.querySelectorAll('.trash-card-item').forEach(item => {
                item.addEventListener('click', () => {
                    const index = parseInt((item as HTMLElement).dataset.index!);
                    game!.selectTrashTarget(index);
                    render();
                });

                // Hover preview for trash cards too
                item.addEventListener('mouseenter', (e) => {
                    const index = parseInt((item as HTMLElement).dataset.index!);
                    // Use the effect source player's trash for preview
                    const sourcePlayer = game!.state.players.find(p => p.id === pending.sourcePlayerId);
                    if (!sourcePlayer) return;
                    const card = sourcePlayer.trash[index];
                    const mouseEvent = e as MouseEvent;
                    hoverPreview.show(card, mouseEvent.clientX, mouseEvent.clientY);
                });
                item.addEventListener('mouseleave', () => hoverPreview.hide());
            });
        }

        // Hand Selection Listener
        if (pending && (pending.validTargets === 'OPP_HAND' || pending.validTargets === 'MY_HAND')) {
            const sourceIsMe = pending.sourcePlayerId === game!.currentPlayer.id;

            // Effective Target relative to ME (the client user)
            // If Source is Me: MY_HAND -> My Hand, OPP_HAND -> Opponent Hand
            // If Source is Opponent: MY_HAND -> Opponent Hand (Their Hand), OPP_HAND -> My Hand (Their Opponent's Hand)

            let targetIsOpponentHand = false;

            if (sourceIsMe) {
                if (pending.validTargets === 'OPP_HAND') targetIsOpponentHand = true;
            } else {
                // Source is Opponent
                if (pending.validTargets === 'MY_HAND') targetIsOpponentHand = true; // They target "My Hand" = Their Hand = Opponent Hand for me
                // if OPP_HAND -> They target "Opponent Hand" = Me -> My Hand (targetIsOpponentHand = false)
            }

            // Select appropriate cards
            const handSelector = targetIsOpponentHand ? '.opponent-hand-zone .card-in-hand' : '.hand-zone .card-in-hand';
            const handCards = document.querySelectorAll(handSelector);

            handCards.forEach(card => {
                const el = card as HTMLElement;
                // Add visual cue
                el.style.cursor = 'crosshair';
                el.style.boxShadow = '0 0 10px #ffeaa7';
                el.style.border = '2px solid #e17055';

                el.addEventListener('click', () => {
                    const index = parseInt(el.dataset.index!);
                    // We need to pass if we are clicking Opponent's hand or My Hand
                    game!.selectHandTarget(index, targetIsOpponentHand);
                    render();
                });
            });
        }
    }

    // Optional Effect Listeners
    if (game.state.interactionMode === 'SELECT_OPTIONAL') {
        document.getElementById('opt-confirm')?.addEventListener('click', () => {
            game!.resolveOptionalEffect(true);
            render();
        });
        document.getElementById('opt-skip')?.addEventListener('click', () => {
            game!.resolveOptionalEffect(false);
            render();
        });
    }

}

const debugManager = new DebugManager(game, render);
window.debug = debugManager;

render();
