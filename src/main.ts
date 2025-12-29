import './style.css'
import { GameEngine } from './logic/GameEngine';
import { createDeck, DUMMY_CARDS } from './logic/CardDatabase';
import { Phase, Card, CardType } from './logic/types';
import { RuleValidator } from './logic/RuleValidator'; // Imported RuleValidator

import { DebugManager } from './logic/DebugManager';
import { HoverPreview } from './HoverPreview';

const deck1 = createDeck();
const deck2 = createDeck();
const leader1 = DUMMY_CARDS[0];
const leader2 = DUMMY_CARDS[0];

const game = new GameEngine('Player 1', 'Player 2', deck1, deck2, leader1, leader2);
const hoverPreview = new HoverPreview();

// Debug System
declare global {
    interface Window {
        debug: DebugManager;
    }
}

const app = document.querySelector<HTMLDivElement>('#app')!;

function render() {
    // Determine active states for UI feedback
    const turnPlayerIndex = game.state.turnPlayerIndex;
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
        <div class="game-controls-header">
             <div class="status-item"><span>Turn</span> <strong>${game.state.turnCount}</strong></div>
             <div class="status-item"><span>Phase</span> <strong>${game.state.phase}</strong></div>
             <button id="next-phase" class="primary-btn small-btn" ${game.state.phase === Phase.BLOCK || game.state.interactionMode !== 'NORMAL' ? 'disabled' : ''}>Next Phase</button>
        </div>
      </div>

      <div class="board-layout">
          ${renderPlayer(0)}
          ${renderPlayer(1)}
      </div>

      ${renderTrashModal()}
    </div>
  `;

    attachListeners();
}

function renderPlayer(playerIndex: number) {
    const player = game.state.players[playerIndex];
    const isTurnPlayer = game.state.turnPlayerIndex === playerIndex;
    const isMainPhase = game.state.phase === Phase.MAIN;
    // We only allow interaction with the Turn Player's zones usually,
    // but drag targets might be on either side depending on the action (e.g. attacking).
    // For DROPPING cards from hand, it must be Turn Player's own zone.

    // Determine if this player's unit zones are valid drop targets for playing cards
    const canDropUnit = isTurnPlayer && isMainPhase && game.state.interactionMode === 'NORMAL';

    return `
      <div class="player-area ${isTurnPlayer ? 'active-turn' : ''}" data-player-index="${playerIndex}">
        <div class="player-header">
            <h2>${player.name} ${isTurnPlayer ? '(Active)' : ''}</h2>
            <div class="resources-row">
                 <div class="deck-indicator">Deck: ${player.deck.length}</div>
                 <div class="trash-indicator">Trash: ${player.trash.length}</div>
                 <div class="damage-zone-mini">
                    <span>Damage:</span>
                    ${player.damage.map(c => `
                        <div class="mini-card-slice" style="background-color: #f56565;"></div>
                    `).join('')}
                    <span style="margin-left:5px; font-weight:bold;">${player.damage.length}/10</span>
                 </div>
            </div>
        </div>

        <!-- Upper Section: Special Zones -->
        <div class="upper-zones">
             <!-- Skill Zone -->
             <div class="skill-zone ${canDropUnit ? 'drop-zone-skill' : ''}" data-player-index="${playerIndex}">
                ${player.skillZone.length > 0 ? player.skillZone.map(c => renderCard(c, true)).join('')
            : '<div class="empty-zone-label">Skill Zone</div>'}
             </div>
             
             <!-- Level/Leader Zone -->
             <div class="level-zone-horizontal">
                <div class="leader-slot">
                    ${player.levelZone ? renderCard(player.levelZone, true) : ''}
                </div>
                <div class="level-tracker">
                    <div class="level-val">LVL ${player.leaderLevel}</div>
                    <div class="level-bars">
                        ${Array.from({ length: 10 }, (_, i) => `
                            <div class="level-pip ${player.leaderLevel > i ? 'active' : ''}"></div>
                        `).join('')}
                    </div>
                </div>
             </div>
        </div>

        <!-- Main Field: Unit Zones -->
        <div class="field-row">
             ${player.unitZones.map((z: any, i: number) => {
                const blockerZoneIndex = (game.state.pendingAttackerIndex ?? -1);
                // Highlight blocking target on the defending player's side
                const isBlockingTarget = game.state.phase === Phase.BLOCK && !isTurnPlayer && blockerZoneIndex === i;

                return `
                    <div class="zone unit-zone ${canDropUnit ? 'drop-zone' : ''} ${isBlockingTarget ? 'blocking-target' : ''}" 
                         data-player-index="${playerIndex}" data-index="${i}">
                        
                        ${z.unit ? renderCard(z.unit, false, game.getUnitPower(z, player), game.getUnitHit(z, player))
                        : '<div class="empty-zone-label">UNIT</div>'}
                        
                        <!-- Attachments -->
                        ${z.items.length > 0 ? `
                             <div class="attached-items-indicator">${z.items.length} Items</div>
                        ` : ''}

                        <!-- Actions -->
                        ${z.unit && isTurnPlayer && game.state.phase === Phase.ATTACK && !z.hasAttacked ? '<button class="attack-btn">Attack</button>' : ''}
                        ${z.unit && isTurnPlayer && game.state.phase === Phase.MAIN && !z.hasActivatedEffectThisTurn && z.unit.effects?.some((e: any) => e.activation === 'ACTIVE') ? '<button class="active-btn">Active</button>' : ''}
                        
                        ${isBlockingTarget ? `
                            <div class="block-controls-overlay">
                                <button class="block-btn">Block</button>
                                <button class="pass-btn">Pass</button>
                            </div>
                        ` : ''}
                    </div>
                `
            }).join('')}
        </div>

        <!-- Hand Zone (Always visible for now, or just for Turn Player?) -->
        <!-- User wants side-by-side, so let's show both hands at the bottom of their respective columns -->
        <div class="hand-zone-container">
            <h3>Hand (${player.hand.length})</h3>
            <div class="hand-grid">
                ${player.hand.map((c, i) => `
                    <div class="card-in-hand ${game.state.interactionMode === 'SELECT_COST' && isTurnPlayer ? 'cost-candidate' : ''}" 
                         draggable="${isTurnPlayer && isMainPhase && game.state.interactionMode === 'NORMAL'}" 
                         data-player-index="${playerIndex}"
                         data-index="${i}">
                        ${renderCard(c, true)} 
                    </div>
                `).join('')}
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

function renderTrashModal() {
    if (game.state.interactionMode !== 'SELECT_TARGET') return '';
    const pending = game.state.pendingEffect as any;
    if (!pending || pending.validTargets !== 'MY_TRASH') return '';

    const trash = game.currentPlayer.trash;
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

let draggedCardIndex: number | null = null;
let draggedPlayerIndex: number | null = null;

function attachListeners() {
    document.getElementById('next-phase')?.addEventListener('click', () => {
        game.nextPhase();
        render();
    });

    // Drag and Drop Listeners
    const cards = document.querySelectorAll('.card-in-hand');
    cards.forEach(card => {
        card.addEventListener('dragstart', (e) => {
            const event = e as DragEvent;
            if (event.dataTransfer) {
                const index = parseInt((card as HTMLElement).dataset.index!);
                const pIndex = parseInt((card as HTMLElement).dataset.playerIndex!);

                // Only allow dragging if it's that player's turn
                if (pIndex !== game.state.turnPlayerIndex) {
                    e.preventDefault();
                    return;
                }

                draggedCardIndex = index;
                draggedPlayerIndex = pIndex;
                event.dataTransfer.setData('text/plain', JSON.stringify({ cardIndex: index, playerIndex: pIndex }));
                event.dataTransfer.effectAllowed = 'move';
            }
        });
        card.addEventListener('dragend', () => {
            draggedCardIndex = null;
            draggedPlayerIndex = null;
            document.querySelectorAll('.zone').forEach(z => z.classList.remove('valid-target', 'invalid-target'));
        });

        // Hover
        card.addEventListener('mouseenter', (e) => {
            const index = parseInt((card as HTMLElement).dataset.index!);
            const pIndex = parseInt((card as HTMLElement).dataset.playerIndex!);
            const cardObj = game.state.players[pIndex].hand[index];
            const mouseEvent = e as MouseEvent;
            hoverPreview.show(cardObj, mouseEvent.clientX, mouseEvent.clientY);
        });
        card.addEventListener('mouseleave', () => hoverPreview.hide());
        card.addEventListener('mousemove', (e) => {
            const index = parseInt((card as HTMLElement).dataset.index!);
            const pIndex = parseInt((card as HTMLElement).dataset.playerIndex!);
            const cardObj = game.state.players[pIndex].hand[index];
            const mouseEvent = e as MouseEvent;
            hoverPreview.show(cardObj, mouseEvent.clientX, mouseEvent.clientY);
        });
    });

    // Unit Drops
    const dropZones = document.querySelectorAll('.drop-zone');
    dropZones.forEach(zone => {
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            const event = e as DragEvent;
            if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';

            const zonePlayerIndex = parseInt((zone as HTMLElement).dataset.playerIndex!);

            if (draggedCardIndex !== null && draggedPlayerIndex === zonePlayerIndex) {
                const zoneIndex = parseInt((zone as HTMLElement).dataset.index!);
                const card = game.currentPlayer.hand[draggedCardIndex];

                let isValid = false;
                if (card.type === CardType.UNIT) {
                    isValid = RuleValidator.canPlayUnit(game, game.currentPlayer, draggedCardIndex, zoneIndex).valid;
                } else if (card.type === CardType.ITEM) {
                    isValid = RuleValidator.canPlayItem(game, game.currentPlayer, draggedCardIndex, zoneIndex).valid;
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
                const data = JSON.parse(event.dataTransfer.getData('text/plain'));
                const cardIndex = data.cardIndex;
                const pIndex = data.playerIndex;
                const zoneIndex = parseInt((zone as HTMLElement).dataset.index!);
                const zonePlayerIndex = parseInt((zone as HTMLElement).dataset.playerIndex!);

                if (pIndex === zonePlayerIndex && pIndex === game.state.turnPlayerIndex) {
                    const card = game.currentPlayer.hand[cardIndex];
                    if (card.type === CardType.UNIT) {
                        game.playUnit(cardIndex, zoneIndex);
                    } else if (card.type === CardType.ITEM) {
                        game.playItem(cardIndex, zoneIndex);
                    }
                    render();
                }
            }
        });
    });

    // Skill Drops
    const skillZones = document.querySelectorAll('.drop-zone-skill');
    skillZones.forEach(zone => {
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            const zonePlayerIndex = parseInt((zone as HTMLElement).dataset.playerIndex!);
            if (draggedCardIndex !== null && draggedPlayerIndex === zonePlayerIndex) {
                const isValid = RuleValidator.canPlaySkill(game, game.currentPlayer, draggedCardIndex).valid;
                zone.classList.add(isValid ? 'valid-target' : 'invalid-target');
            }
            zone.classList.add('drag-over');
        });

        zone.addEventListener('dragleave', () => zone.classList.remove('drag-over', 'valid-target', 'invalid-target'));

        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('drag-over');
            const event = e as DragEvent;
            if (event.dataTransfer) {
                const data = JSON.parse(event.dataTransfer.getData('text/plain'));
                const cardIndex = data.cardIndex;
                const pIndex = data.playerIndex;
                const zonePlayerIndex = parseInt((zone as HTMLElement).dataset.playerIndex!);

                if (pIndex === zonePlayerIndex && pIndex === game.state.turnPlayerIndex) {
                    game.playSkill(cardIndex);
                    render();
                }
            }
        });
    });

    // Interaction Listeners (Attack, Block, etc.)
    document.querySelectorAll('.attack-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const zoneIndex = parseInt((btn.closest('.unit-zone') as HTMLElement).dataset.index!);
            game.attack(zoneIndex);
            render();
        });
    });

    document.querySelectorAll('.block-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            game.resolveBlock(true);
            render();
        });
    });

    document.querySelectorAll('.pass-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            game.resolveBlock(false);
            render();
        });
    });

    document.querySelectorAll('.active-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Using dataset player-index to confirm ownership if needed, but only current player has btn rendered
            const zoneIndex = parseInt((btn.closest('.unit-zone') as HTMLElement).dataset.index!);
            const zone = game.currentPlayer.unitZones[zoneIndex];
            const effectIndex = zone.unit?.effects?.findIndex(e => e.activation === 'ACTIVE') ?? -1;

            if (effectIndex !== -1) {
                game.activateEffect(zoneIndex, effectIndex);
                render();
            }
        });
    });

    // Selection Modes
    if (game.state.interactionMode === 'SELECT_COST') {
        // Allow selecting from current player's hand
        const handCards = document.querySelectorAll(`.card-in-hand[data-player-index="${game.state.turnPlayerIndex}"]`);
        handCards.forEach(card => {
            card.addEventListener('click', (_e) => {
                const index = parseInt((card as HTMLElement).dataset.index!);
                game.selectCost(index);
                render();
            });
        });
    }

    if (game.state.interactionMode === 'SELECT_TARGET') {
        const units = document.querySelectorAll('.unit-zone');
        units.forEach(u => {
            u.addEventListener('click', (_e) => {
                const el = u as HTMLElement;
                const zoneIndex = parseInt(el.dataset.index!);
                const zonePlayerIndex = parseInt(el.dataset.playerIndex!);
                const isOpponentZone = zonePlayerIndex !== game.state.turnPlayerIndex;

                game.selectTarget(zoneIndex, isOpponentZone);
                render();
            });
            (u as HTMLElement).style.cursor = 'crosshair';
        });
    }

    // Hover previews for units on field
    document.querySelectorAll('.unit-zone').forEach(zone => {
        zone.addEventListener('mouseenter', (e) => {
            const el = zone as HTMLElement;
            const pIndex = parseInt(el.dataset.playerIndex!);
            const zIndex = parseInt(el.dataset.index!);
            const unit = game.state.players[pIndex].unitZones[zIndex].unit;
            if (unit) {
                const mouseEvent = e as MouseEvent;
                hoverPreview.show(unit, mouseEvent.clientX, mouseEvent.clientY);
            }
        });
        zone.addEventListener('mouseleave', () => hoverPreview.hide());
    });
}

const debugManager = new DebugManager(game, render);
window.debug = debugManager;

render();
