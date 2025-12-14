import './style.css'
import { GameEngine } from './logic/GameEngine';
import { createDeck, DUMMY_CARDS } from './logic/CardDatabase';
import { Phase, Card, CardType } from './logic/types';

const deck1 = createDeck();
const deck2 = createDeck();
const leader1 = DUMMY_CARDS[0];
const leader2 = DUMMY_CARDS[0];

const game = new GameEngine('Player 1', 'Player 2', deck1, deck2, leader1, leader2);

const app = document.querySelector<HTMLDivElement>('#app')!;

function render() {
    const currentPlayer = game.currentPlayer;
    const opponent = game.opponentPlayer;

    // Helper to determine if a zone is a valid drop target
    const isMainPhase = game.state.phase === Phase.MAIN;

    app.innerHTML = `
    <div class="game-container">
      <div class="header">
        <h1>NivelArena Simulator</h1>
        <div class="status-bar">
          <span>Turn: ${game.state.turnCount}</span>
          <span>Phase: ${game.state.phase}</span>
          <span>Turn Player: ${currentPlayer.name}</span>
        </div>
        <button id="next-phase" ${game.state.phase === Phase.BLOCK ? 'disabled' : ''}>Next Phase</button>
      </div>

      <!-- Opponent Area (Top) -->
      <div class="player-area opponent">
        <div class="hand-zone">Hand: ${opponent.hand.length} cards</div>
        <div class="field-row">
            <div class="zone deck-zone">Deck: ${opponent.deck.length}</div>
            <div class="zone trash-zone">Trash: ${opponent.trash.length}</div>
            <div class="zone level-zone">Lv: ${opponent.leaderLevel}</div>
            <div class="zone damage-zone">Dmg: ${opponent.damage.length}</div>
        </div>
        <div class="field-row units">
            ${opponent.unitZones.map((z, i) => {
        // Correctly highlight the blocker zone based on pending attacker
        const isBlockingTarget = game.state.phase === Phase.BLOCK && (2 - (game.state.pendingAttackerIndex ?? -1)) === i;
        return `
                <div class="zone unit-zone ${isBlockingTarget ? 'blocking-target' : ''}" data-player="opponent" data-index="${i}">
                    ${z.unit ? renderCard(z.unit) : 'Empty'}
                    ${z.unit ? `<div class="stats">${z.unit.power} / ${z.unit.hit}</div>` : ''}
                    ${isBlockingTarget ? `
                        <div class="block-controls">
                            <button class="block-btn">Block</button>
                            <button class="pass-btn">Pass</button>
                        </div>
                    ` : ''}
                </div>
            `}).join('')}
        </div>
      </div>

      <hr/>

      <!-- Current Player Area (Bottom) -->
      <div class="player-area current">
        <div class="field-row units">
            ${currentPlayer.unitZones.map((z, i) => `
                <div class="zone unit-zone interactive drop-zone" data-player="current" data-index="${i}">
                    ${z.unit ? renderCard(z.unit) : 'Empty'}
                    ${z.unit ? `<div class="stats">${z.unit.power} / ${z.unit.hit}</div>` : ''}
                    ${z.unit && game.state.phase === Phase.ATTACK && !z.hasAttacked ? '<button class="attack-btn">Attack</button>' : ''}
                </div>
            `).join('')}
        </div>
        <div class="field-row">
            <div class="zone deck-zone">Deck: ${currentPlayer.deck.length}</div>
            <div class="zone trash-zone">Trash: ${currentPlayer.trash.length}</div>
            <div class="zone level-zone">Lv: ${currentPlayer.leaderLevel}</div>
            <div class="zone damage-zone">Dmg: ${currentPlayer.damage.length}</div>
        </div>
        <div class="hand-zone interactive">
            ${currentPlayer.hand.map((c, i) => `
                <div class="card-in-hand" draggable="${isMainPhase}" data-index="${i}">
                    ${renderCard(c)}
                </div>
            `).join('')}
        </div>
      </div>
    </div>
  `;

    attachListeners();
}

function renderCard(card: Card) {
    const isUnit = card.type === CardType.UNIT;
    return `
        <div class="card ${card.attribute.toLowerCase()}">
            <div class="card-top">
                <span class="card-cost">${card.cost}</span>
                <span class="card-type-icon">${card.type[0]}</span>
            </div>
            <div class="card-name">${card.name}</div>
            <div class="card-text">${card.text || ''}</div>
            ${isUnit ? `
                <div class="card-stats-row">
                    <span class="stat-power">P:${card.power}</span>
                    <span class="stat-hit">H:${card.hit}</span>
                </div>
            ` : ''}
        </div>
    `;
}

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
                event.dataTransfer.setData('text/plain', (card as HTMLElement).dataset.index!);
                event.dataTransfer.effectAllowed = 'move';
            }
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
            zone.classList.add('drag-over');
        });

        zone.addEventListener('dragleave', () => {
            zone.classList.remove('drag-over');
        });

        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('drag-over');
            const event = e as DragEvent;
            if (event.dataTransfer) {
                const cardIndex = parseInt(event.dataTransfer.getData('text/plain'));
                const zoneIndex = parseInt((zone as HTMLElement).dataset.index!);

                if (!isNaN(cardIndex) && !isNaN(zoneIndex)) {
                    game.playUnit(cardIndex, zoneIndex);
                    render();
                }
            }
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
}

render();
