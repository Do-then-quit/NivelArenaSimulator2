import './style.css'
import { GameEngine } from './logic/GameEngine';
import { createDeck, DUMMY_CARDS } from './logic/CardDatabase';
import { Phase, Card, CardType } from './logic/types';

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
    </div>
  `;

    attachListeners();
}

function renderPlayer(player: any, isOpponent: boolean, isMainPhase: boolean) {
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
        const blockerZoneIndex = (game.state.pendingAttackerIndex ?? -1);
        const isBlockingTarget = game.state.phase === Phase.BLOCK && isOpponent && blockerZoneIndex === i;
        return `
                    <div class="zone unit-zone ${!isOpponent ? 'interactive drop-zone' : ''} ${isBlockingTarget ? 'blocking-target' : ''}" data-player="${isOpponent ? 'opponent' : 'current'}" data-index="${i}">
                        ${z.unit ? renderCard(z.unit, false, game.getUnitPower(z, player), game.getUnitHit(z, player)) : '<span style="color: rgba(255,255,255,0.1); font-size: 0.8rem; font-weight: bold;">UNIT</span>'}
                        
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

                        ${z.unit && !isOpponent && game.state.phase === Phase.ATTACK && !z.hasAttacked ? '<button class="attack-btn">Attack</button>' : ''}
                        ${z.unit && !isOpponent && game.state.phase === Phase.MAIN && !z.hasActivatedEffectThisTurn && z.unit.effects?.some((e: any) => e.activation === 'ACTIVE') ? '<button class="active-btn">Active</button>' : ''}
                        ${isBlockingTarget ? `
                            <div class="block-controls">
                                <button class="block-btn">Block</button>
                                <button class="pass-btn">Pass</button>
                            </div>
                        ` : ''}
                        ${z.unit ? `<div class="stats">${game.getUnitPower(z, player)} / ${game.getUnitHit(z, player)}</div>` : ''}
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
            const cardObj = game.currentPlayer.hand[index];
            const mouseEvent = e as MouseEvent;
            hoverPreview.show(cardObj, mouseEvent.clientX, mouseEvent.clientY);
        });

        card.addEventListener('mousemove', (e) => {
            const mouseEvent = e as MouseEvent;
            // We need a way to update position without full redraw/re-show if possible
            // but for now, just calling show again is fine as it updates position
            const index = parseInt((card as HTMLElement).dataset.index!);
            const cardObj = game.currentPlayer.hand[index];
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
                const cardIndex = parseInt(event.dataTransfer.getData('text/plain'));
                const zoneIndex = parseInt((zone as HTMLElement).dataset.index!);

                if (!isNaN(cardIndex) && !isNaN(zoneIndex)) {
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


    // Skill Zone Drop Listener
    const skillZones = document.querySelectorAll('.drop-zone-skill');
    skillZones.forEach(zone => {
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            const event = e as DragEvent;
            if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
            
            if (draggedCardIndex !== null) {
                const card = game.currentPlayer.hand[draggedCardIndex];
                const isValid = RuleValidator.canPlaySkill(game, game.currentPlayer, draggedCardIndex).valid;
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
                    game.playSkill(cardIndex);
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
            const player = isOpponent ? game.opponentPlayer : game.currentPlayer;
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
            const player = isOpponent ? game.opponentPlayer : game.currentPlayer;
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
            const zoneIndex = parseInt((btn.closest('.unit-zone') as HTMLElement).dataset.index!);
            // Assuming we activate the first ACTIVE effect for simplicity in MVP
            // ST02-007 has only one ACTIVE effect.
            const zone = game.currentPlayer.unitZones[zoneIndex];
            const effectIndex = zone.unit?.effects?.findIndex(e => e.activation === 'ACTIVE') ?? -1;
            
            if (effectIndex !== -1) {
                game.activateEffect(zoneIndex, effectIndex);
                render();
            }
        });
    });

    // Cost Selection Listener
    if (game.state.interactionMode === 'SELECT_COST') {
        const handCards = document.querySelectorAll('.card-in-hand');
        handCards.forEach(card => {
            card.addEventListener('click', (_e) => {
                const index = parseInt((card as HTMLElement).dataset.index!);
                game.selectCost(index);
                render();
            });
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
                // Validation (Simple UI check, handled in logic too)
                game.selectTarget(zoneIndex, isOpponent);
                render();
            });
            // Add visual cue
            (u as HTMLElement).style.cursor = 'crosshair';
            (u as HTMLElement).style.boxShadow = '0 0 10px #ffeaa7';
        });
    }
}

const debugManager = new DebugManager(game, render);
window.debug = debugManager;

render();
