import './style.css'
import { GameEngine } from './logic/GameEngine';
import { createDeck, DUMMY_CARDS } from './logic/CardDatabase';
import { Phase, Card, CardType } from './logic/types';
import { RuleValidator } from './logic/RuleValidator';
import { BaselineBot } from './logic/ai/BaselineBot';

import { DebugManager } from './logic/DebugManager';
import { HoverPreview } from './HoverPreview';
import { TrashHoverOverlay } from './TrashHoverOverlay';
import { DeckBuilderUI } from './DeckBuilderUI';

import { SetupUI } from './SetupUI';
import { CardTester } from './logic/CardTester';

enum Screen {
    MENU,
    DECK_BUILDER,
    SETUP,
    GAME,
    TEST
}

let currentScreen: Screen = Screen.MENU;
let game: GameEngine | null = null;
const hoverPreview = new HoverPreview();
const trashHoverOverlay = new TrashHoverOverlay(hoverPreview);
const app = document.querySelector<HTMLDivElement>('#app')!;
const cardTester = new CardTester();
let testResults: any[] = [];
let testRunning = false;

type PlayerControlMode = 'HUMAN' | 'BASELINE_BOT';

interface MatchControlConfig {
    label: string;
    player1Control: PlayerControlMode;
    player2Control: PlayerControlMode;
}

const HUMAN_VS_HUMAN_CONFIG: MatchControlConfig = {
    label: 'HUMAN vs HUMAN',
    player1Control: 'HUMAN',
    player2Control: 'HUMAN',
};

const HUMAN_VS_BASELINE_CONFIG: MatchControlConfig = {
    label: 'HUMAN vs BASELINE BOT',
    player1Control: 'HUMAN',
    player2Control: 'BASELINE_BOT',
};

let pendingSetupConfig: MatchControlConfig = HUMAN_VS_HUMAN_CONFIG;
let activeMatchConfig: MatchControlConfig = HUMAN_VS_HUMAN_CONFIG;
const botByPlayerId = new Map<string, BaselineBot>();
let botStepTimer: number | null = null;

function clearBotStepTimer() {
    if (botStepTimer !== null) {
        window.clearTimeout(botStepTimer);
        botStepTimer = null;
    }
}

function getActionOwnerPlayerId(engine: GameEngine): string {
    return engine.state.interactionOwnerPlayerId ?? engine.currentPlayer.id;
}

function isBotControlledPlayer(playerId: string): boolean {
    return botByPlayerId.has(playerId);
}

function canLocalHumanInput(): boolean {
    if (!game || game.state.winner) return false;
    const actorId = getActionOwnerPlayerId(game);
    return !isBotControlledPlayer(actorId);
}

function runBotStep() {
    if (!game || currentScreen !== Screen.GAME || game.state.winner) return;

    const actorId = getActionOwnerPlayerId(game);
    const bot = botByPlayerId.get(actorId);
    if (!bot) return;

    const action = bot.chooseAction(game, actorId);
    if (!action) {
        console.warn(`[BaselineBot] No legal action for actor: ${actorId}`);
        return;
    }

    const ok = game.step(action);
    if (!ok) {
        console.warn(`[BaselineBot] Invalid action from actor ${actorId}: ${JSON.stringify(action)}`);
        return;
    }

    render();
}

function scheduleBotStep(delayMs: number = 220) {
    clearBotStepTimer();

    if (!game || currentScreen !== Screen.GAME || game.state.winner) return;
    const actorId = getActionOwnerPlayerId(game);
    if (!isBotControlledPlayer(actorId)) return;

    botStepTimer = window.setTimeout(() => {
        botStepTimer = null;
        runBotStep();
    }, delayMs);
}

function renderMenu() {
    app.innerHTML = `
        <div class="main-menu">
            <h1>NivelArena</h1>
            <div class="menu-buttons">
                <button id="start-game-btn" class="primary-btn">Quick Play (ST01 vs ST01)</button>
                <button id="start-vs-bot-btn" class="primary-btn">Quick Play vs Baseline Bot</button>
                <button id="custom-sim-btn" class="primary-btn">Custom Simulation (PvP)</button>
                <button id="custom-vs-bot-btn" class="primary-btn">Custom vs Baseline Bot</button>
                <button id="deck-builder-btn" class="secondary-btn">Deck Builder</button>
                <button id="card-test-btn" class="secondary-btn" style="margin-top: 10px; background: #6c5ce7;">Card Tests (ST01 & ST02)</button>
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

    document.getElementById('start-vs-bot-btn')?.addEventListener('click', () => {
        const deck1 = createDeck();
        const deck2 = createDeck();
        const leader1 = DUMMY_CARDS.find(c => c.id === 'ST01-001') || DUMMY_CARDS[0];
        const leader2 = DUMMY_CARDS.find(c => c.id === 'ST01-001') || DUMMY_CARDS[0];
        startGame(deck1, deck2, leader1, leader2, HUMAN_VS_BASELINE_CONFIG);
    });


    document.getElementById('custom-sim-btn')?.addEventListener('click', () => {
        pendingSetupConfig = HUMAN_VS_HUMAN_CONFIG;
        currentScreen = Screen.SETUP;
        render();
    });

    document.getElementById('custom-vs-bot-btn')?.addEventListener('click', () => {
        pendingSetupConfig = HUMAN_VS_BASELINE_CONFIG;
        currentScreen = Screen.SETUP;
        render();
    });

    document.getElementById('deck-builder-btn')?.addEventListener('click', () => {
        currentScreen = Screen.DECK_BUILDER;
        render();
    });

    document.getElementById('card-test-btn')?.addEventListener('click', () => {
        currentScreen = Screen.TEST;
        render();
    });
}

function startGame(
    deck1: Card[],
    deck2: Card[],
    leader1: Card,
    leader2: Card,
    controlConfig: MatchControlConfig = HUMAN_VS_HUMAN_CONFIG
) {
    clearBotStepTimer();
    activeMatchConfig = controlConfig;
    game = new GameEngine('Player 1', 'Player 2', deck1, deck2, leader1, leader2);
    botByPlayerId.clear();
    const [player1, player2] = game.state.players;
    if (controlConfig.player1Control === 'BASELINE_BOT') {
        botByPlayerId.set(player1.id, new BaselineBot('BaselineBot-P1'));
    }
    if (controlConfig.player2Control === 'BASELINE_BOT') {
        botByPlayerId.set(player2.id, new BaselineBot('BaselineBot-P2'));
    }

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
            startGame(deck1, deck2, leader1, leader2, pendingSetupConfig);
        },
        () => {
            currentScreen = Screen.MENU;
            render();
        }
    );
    setupUI.render();

    const title = app.querySelector('.setup-screen h1');
    if (title) {
        title.textContent = pendingSetupConfig.player2Control === 'BASELINE_BOT'
            ? 'Simulation Setup (vs Baseline Bot)'
            : 'Simulation Setup';
    }

    const playerHeaders = app.querySelectorAll('.player-setup h3');
    const p2Header = playerHeaders.item(1) as HTMLElement | null;
    if (p2Header) {
        p2Header.textContent = pendingSetupConfig.player2Control === 'BASELINE_BOT'
            ? 'Player 2 (Baseline Bot)'
            : 'Player 2';
    }
}

// Track selected packs
let selectedPacks: Set<string> = new Set();
// Initialize selectedPacks with all available packs on first load
if (selectedPacks.size === 0) {
    const packs = cardTester.getAvailablePacks();
    packs.forEach(p => selectedPacks.add(p));
}

function renderTestScreen() {
    const packs = cardTester.getAvailablePacks();

    app.innerHTML = `
        <div class="test-screen" style="padding: 20px; color: white; max-width: 800px; margin: 0 auto;">
            <h1>Card Logic Verification</h1>
            
            <div style="background: rgba(255, 255, 255, 0.1); padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <h3 style="margin-top: 0; margin-bottom: 10px;">Select Packs to Test</h3>
                <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                    ${packs.map(pack => `
                        <label style="display: flex; align-items: center; gap: 5px; cursor: pointer; background: rgba(0,0,0,0.3); padding: 5px 10px; border-radius: 4px;">
                            <input type="checkbox" class="pack-filter-checkbox" value="${pack}" ${selectedPacks.has(pack) ? 'checked' : ''} style="cursor: pointer;">
                            <span>${pack}</span>
                        </label>
                    `).join('')}
                </div>
            </div>

            <div style="display: flex; gap: 10px; margin-bottom: 20px;">
                <button id="back-menu-btn" class="secondary-btn">Back to Menu</button>
                <button id="run-selected-tests-btn" class="primary-btn" ${testRunning ? 'disabled' : ''}>
                    ${testRunning ? 'Running Tests...' : 'Run Selected Tests'}
                </button>
            </div>
            
            <div id="test-results" style="margin-top: 20px;">
                ${testResults.length === 0 ? '<p>No tests run yet. Select packs and click "Run Selected Tests".</p>' : ''}
                ${testResults.map(r => `
                    <div class="test-result ${r.success ? 'pass' : 'fail'}" style="margin-bottom: 10px; padding: 10px; border-left: 5px solid ${r.success ? '#00b894' : '#d63031'}; background: rgba(0,0,0,0.3); border-radius: 4px;">
                        <div style="display:flex; justify-content:space-between; align-items: center; font-weight:bold;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <span style="font-size: 1.1em;">${r.cardId}</span>
                                <button class="play-test-btn small-btn" data-cardid="${r.cardId}" style="font-size: 0.8rem; padding: 2px 8px; background: #0984e3; border: none; border-radius: 4px; color: white; cursor: pointer;">Play</button>
                            </div>
                            <span style="color: ${r.success ? '#00b894' : '#d63031'}">${r.success ? 'PASS' : 'FAIL'}</span>
                        </div>
                        ${!r.success && r.error ? `<div style="color: #ff7675; margin-top:5px; background: rgba(214, 48, 49, 0.1); padding: 5px;">Error: ${r.error}</div>` : ''}
                        <details style="margin-top: 5px;">
                            <summary style="cursor: pointer; color: #a0aec0;">Show Logs</summary>
                            <pre style="font-size: 0.8rem; color: #b2bec3; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 4px; overflow-x: auto; margin-top: 5px;">${r.logs.join('\n')}</pre>
                        </details>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    document.getElementById('back-menu-btn')?.addEventListener('click', () => {
        currentScreen = Screen.MENU;
        render();
    });

    // Checkbox Listeners
    document.querySelectorAll('.pack-filter-checkbox').forEach(box => {
        box.addEventListener('change', (e) => {
            const target = e.target as HTMLInputElement;
            if (target.checked) {
                selectedPacks.add(target.value);
            } else {
                selectedPacks.delete(target.value);
            }
        });
    });

    document.getElementById('run-selected-tests-btn')?.addEventListener('click', async () => {
        if (testRunning) return;
        if (selectedPacks.size === 0) {
            alert('Please select at least one pack.');
            return;
        }

        testRunning = true;
        testResults = [];
        render();

        // Dynamically get tests for selected packs
        const cardsToTest: string[] = [];
        selectedPacks.forEach(packId => {
            const tests = cardTester.getTestsForPack(packId);
            cardsToTest.push(...tests);
        });

        for (const id of cardsToTest) {
            const result = await cardTester.runTest(id);
            testResults.push(result);
            render(); // Live update
            await new Promise(r => setTimeout(r, 50)); // Small delay for visual
        }

        testRunning = false;
        render();
    });

    document.querySelectorAll('.play-test-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const cardId = (e.target as HTMLElement).dataset.cardid!;
            const { engine, instructions } = cardTester.setupScenario(cardId);
            clearBotStepTimer();
            botByPlayerId.clear();
            activeMatchConfig = HUMAN_VS_HUMAN_CONFIG;
            game = engine;
            (window as any).debug = new DebugManager(game, render);
            currentScreen = Screen.GAME;
            alert(`Scenario Started: ${cardId}\n\n${instructions}`);
            render();
        });
    });
}

function render() {
    if (currentScreen !== Screen.GAME) {
        clearBotStepTimer();
    }

    if (currentScreen === Screen.MENU) {
        renderMenu();
    } else if (currentScreen === Screen.DECK_BUILDER) {
        renderDeckBuilder();
    } else if (currentScreen === Screen.SETUP) {
        renderSetup();
    } else if (currentScreen === Screen.GAME && game) {
        renderGame();
    } else if (currentScreen === Screen.TEST) {
        renderTestScreen();
    }
}

function renderGame() {
    if (!game) return;
    const currentPlayer = game.currentPlayer;
    const opponent = game.opponentPlayer;
    const inputOwnerId = getActionOwnerPlayerId(game);
    const inputOwner = game.state.players.find(player => player.id === inputOwnerId) ?? null;
    const localHumanCanInput = canLocalHumanInput();
    const inputOwnerControl = inputOwner && isBotControlledPlayer(inputOwner.id) ? 'Baseline Bot' : 'Human';


    // Helper to determine if a zone is a valid drop target
    const isMainPhase = game.state.phase === Phase.MAIN;

    app.innerHTML = `
    <div class="game-container">
      <div class="header">
        <h1>NivelArena</h1>
        ${game.state.interactionMode === 'SELECT_TARGET' ? (() => {
            const pending = game!.state.pendingEffect as any;
            const maxCount = pending?.targetSchema?.count || 0;
            const currentCount = pending.selectedTargets?.length || 0;
            // Disable only if it's manual selection and we haven't reached the count
            const canConfirm = maxCount === 0 || currentCount === maxCount || pending?.targetSchema?.selectMode === 'ALL';

            return `
            <div style="background: #e17055; color: white; padding: 10px; border-radius: 4px; display: flex; align-items: center; gap: 15px;">
                <span style="animation: pulse 1s infinite;">SELECT TARGETS (${currentCount}/${maxCount === 0 ? 'All' : maxCount})</span>
                <button id="confirm-targets-btn" class="primary-btn" ${canConfirm ? '' : 'disabled'} style="background: ${canConfirm ? '#2ecc71' : '#636e72'}; border: none; padding: 5px 15px;">Confirm</button>
            </div>
            `;
        })() : ''}
        ${game.state.interactionMode === 'SELECT_COST' ? `
            <div style="background: #0984e3; color: white; padding: 10px; border-radius: 4px; animation: pulse 1s infinite;">
                SELECT CARD TO TRASH (COST)
            </div>
        ` : ''}
        <button id="db-back-to-menu" class="secondary-btn" style="position: absolute; top: 10px; left: 10px;">Menu</button>
      </div>

      <div class="opponent-hand-zone">
          ${opponent.hand.map((c, i) => {
            const pending = game!.state.pendingEffect as any;
            const isTargetCandidate = game!.state.interactionMode === 'SELECT_TARGET' &&
                pending &&
                game!.isPendingCardTarget(c);
            return `
              <div class="card-in-hand ${isTargetCandidate ? 'target-candidate' : ''}" data-index="${i}">
                  ${renderCard(c)}
              </div>
          `}).join('')}
      </div>

      ${renderPlayer(opponent, true, isMainPhase)}
      
      <div class="game-divider"></div>

      ${renderPlayer(currentPlayer, false, isMainPhase)}

      <div class="hand-zone">
          ${currentPlayer.hand.map((c, i) => {
                const isCostCandidate = game!.state.interactionMode === 'SELECT_COST';
                const pending = game!.state.pendingEffect as any;
                const isTargetCandidate = game!.state.interactionMode === 'SELECT_TARGET' &&
                    pending &&
                    game!.isPendingCardTarget(c);

                return `
              <div class="card-in-hand ${isCostCandidate ? 'cost-candidate' : ''} ${isTargetCandidate ? 'target-candidate' : ''}" draggable="${isMainPhase && game!.state.interactionMode === 'NORMAL' && localHumanCanInput}" data-index="${i}">
                  ${renderCard(c)}
              </div>
          `}).join('')}
      </div>

      <div class="game-controls">
        <div class="status-bar">
          <div class="status-item"><span>Turn</span> <strong>${game.state.turnCount}</strong></div>
          <div class="status-item"><span>Phase</span> <strong>${game.state.phase}</strong></div>
          <div class="status-item"><span>Active</span> <strong>${game.currentPlayer.name}</strong></div>
          <div class="status-item"><span>Mode</span> <strong>${activeMatchConfig.label}</strong></div>
          <div class="status-item"><span>Input</span> <strong>${inputOwner?.name ?? 'N/A'} (${inputOwnerControl})</strong></div>
        </div>
        <button id="next-phase" class="primary-btn" ${game.state.phase === Phase.BLOCK || game.state.interactionMode !== 'NORMAL' || !localHumanCanInput ? 'disabled' : ''}>Next Phase</button>
      </div>

      ${renderOptionalEffectModal()}
      ${renderTrashModal()}
      ${renderRevealedCardsModal()}
      ${renderGameOverModal()}
    </div>
  `;

    attachListeners();
    scheduleBotStep();
}

function renderOptionalEffectModal() {
    if (!game) return '';
    if (game.state.interactionMode !== 'SELECT_OPTIONAL') return '';
    const pending = game.state.pendingEffect as any;
    if (!pending) return '';

    // Attempt to get description from full effect if available
    const description = pending.effectDescription ?? 'Activate optional effect?';

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
                    ${trash.map((c, i) => {
        const isSelected = pending.selectedTargets?.includes(c);
        return `
                        <div class="trash-card-item ${isSelected ? 'selected-target' : ''}" data-index="${i}">
                            ${renderCard(c)}
                        </div>
                    `}).join('')}
                </div>
            </div>
        </div>
    `;
}

function renderRevealedCardsModal() {
    if (!game) return '';
    if (game.state.revealedCards.length === 0) return '';

    const pending = game.state.pendingEffect as any;
    const isSelecting = game.state.interactionMode === 'SELECT_TARGET' && pending?.validTargets === 'REVEALED';
    const isTakeAll = pending?.actionType === 'TAKE_ALL_REVEALED';
    const filter = pending?.targetSchema?.filters?.[0];

    return `
        <div class="modal-overlay">
            <div class="trash-modal">
                <h3>Revealed Cards</h3>
                <p style="text-align: center; color: #a0aec0; margin-bottom: 20px;">
                    ${isTakeAll ? 'Cards matching the filter will be added to hand' : (isSelecting ? 'Select a card to add to hand' : 'Cards revealed by effect')}
                </p>
                <div class="trash-grid">
                    ${game.state.revealedCards.map((c, i) => {
        const isSelected = isSelecting && !isTakeAll && pending.selectedTargets?.includes(c);

        let matchesFilter = true;
        if (isTakeAll && filter) {
            if (filter.type === 'COST_LIMIT' && c.cost > filter.value) matchesFilter = false;
            if (filter.type === 'HAS_TRAIT' && !c.traits?.includes(filter.value)) matchesFilter = false;
        }

        return `
                        <div class="revealed-card-item ${isSelected ? 'selected-target' : ''} ${!matchesFilter ? 'grayscale' : ''}" data-index="${i}" style="${isSelecting && !isTakeAll ? 'cursor: pointer;' : ''}">
                            ${renderCard(c)}
                        </div>
                    `}).join('')}
                </div>
            </div>
        </div>
    `;
}

function renderGameOverModal() {
    const engine = game;
    if (!engine || !engine.state.winner) return '';

    const [player1, player2] = engine.state.players;
    const winner = engine.state.players.find(player => player.id === engine.state.winner) ?? player1;
    const loser = winner.id === player1.id ? player2 : player1;

    const winnerUnits = winner.unitZones.filter(zone => !!zone.unit).length;
    const loserUnits = loser.unitZones.filter(zone => !!zone.unit).length;

    const outcomeReason = loser.damage.length >= 10
        ? 'Defeat Condition: Damage Zone reached 10 cards'
        : loser.deck.length === 0
            ? 'Defeat Condition: Deck ran out during draw/damage processing'
            : 'Defeat Condition met by game rules';

    return `
        <div class="modal-overlay game-over-overlay">
            <div class="game-over-modal">
                <h2>Game Over</h2>
                <p class="game-over-winner">${winner.name} Wins</p>
                <p class="game-over-reason">${outcomeReason}</p>

                <div class="game-over-score">
                    Damage Score: ${player1.name} ${player1.damage.length} : ${player2.damage.length} ${player2.name}
                </div>

                <div class="game-over-stats">
                    <div class="game-over-row game-over-head">
                        <span>Stat</span>
                        <span>${winner.name}</span>
                        <span>${loser.name}</span>
                    </div>
                    <div class="game-over-row">
                        <span>Leader Level</span>
                        <span>${winner.leaderLevel}</span>
                        <span>${loser.leaderLevel}</span>
                    </div>
                    <div class="game-over-row">
                        <span>Damage</span>
                        <span>${winner.damage.length}</span>
                        <span>${loser.damage.length}</span>
                    </div>
                    <div class="game-over-row">
                        <span>Deck</span>
                        <span>${winner.deck.length}</span>
                        <span>${loser.deck.length}</span>
                    </div>
                    <div class="game-over-row">
                        <span>Hand</span>
                        <span>${winner.hand.length}</span>
                        <span>${loser.hand.length}</span>
                    </div>
                    <div class="game-over-row">
                        <span>Trash</span>
                        <span>${winner.trash.length}</span>
                        <span>${loser.trash.length}</span>
                    </div>
                    <div class="game-over-row">
                        <span>Units on Field</span>
                        <span>${winnerUnits}</span>
                        <span>${loserUnits}</span>
                    </div>
                </div>

                <div class="game-over-meta">
                    Final Turn: ${engine.state.turnCount} / Final Phase: ${engine.state.phase}
                </div>

                <div class="modal-actions">
                    <button id="game-over-menu-btn" class="primary-btn">Back to Main Menu</button>
                </div>
            </div>
        </div>
    `;
}

function renderPlayer(player: any, isOpponent: boolean, isMainPhase: boolean) {
    if (!game) return '';
    const localHumanCanInput = canLocalHumanInput();
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
        const isSelected = game!.state.pendingEffect?.selectedTargets?.includes(z);

        return `
                    <div class="zone unit-zone ${!isOpponent && localHumanCanInput ? 'interactive drop-zone' : ''} ${isBlockingTarget ? 'blocking-target' : ''} ${isSelected ? 'selected-target' : ''}" data-player="${isOpponent ? 'opponent' : 'current'}" data-index="${i}">
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

                        ${z.unit && !isOpponent && localHumanCanInput && game!.state.phase === Phase.ATTACK && !z.hasAttacked ? '<button class="attack-btn">Attack</button>' : ''}
                        ${z.unit && !isOpponent && localHumanCanInput && (game!.state.phase === Phase.MAIN || game!.state.phase === Phase.ATTACK) && z.unit.effects?.some((e: any, idx: number) => {
                            const isActivatableInPhase =
                                (e.activation === 'ACTIVE' && (game!.state.phase === Phase.MAIN || game!.state.phase === Phase.ATTACK)) ||
                                (e.activation === 'ACTIVE_MAIN' && game!.state.phase === Phase.MAIN);
                            if (!isActivatableInPhase) return false;
                            const key = `${z.unit!.id}_${e.id || idx}`;
                            return !z.activatedEffectKeys?.[key];
                        }) ? '<button class="active-btn">Active</button>' : ''}
                        ${isBlockingTarget && localHumanCanInput ? `
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
                <div class="skill-zone ${!isOpponent && isMainPhase && localHumanCanInput ? 'interactive drop-zone-skill' : ''}">
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
            <div class="trash-zone" data-player="${isOpponent ? 'opponent' : 'current'}">
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
    const localHumanCanInput = canLocalHumanInput();

    document.getElementById('db-back-to-menu')?.addEventListener('click', () => {
        clearBotStepTimer();
        game = null;
        currentScreen = Screen.MENU;
        render();
    });

    document.getElementById('game-over-menu-btn')?.addEventListener('click', () => {
        clearBotStepTimer();
        game = null;
        currentScreen = Screen.MENU;
        render();
    });

    document.getElementById('next-phase')?.addEventListener('click', () => {
        if (!canLocalHumanInput()) return;
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
            const isOpponent = card.closest('.opponent-hand-zone') !== null;
            const cardObj = isOpponent ? game!.opponentPlayer.hand[index] : game!.currentPlayer.hand[index];
            const mouseEvent = e as MouseEvent;
            hoverPreview.show(cardObj, mouseEvent.clientX, mouseEvent.clientY);
        });

        card.addEventListener('mousemove', (e) => {
            const mouseEvent = e as MouseEvent;
            const index = parseInt((card as HTMLElement).dataset.index!);
            const isOpponent = card.closest('.opponent-hand-zone') !== null;
            const cardObj = isOpponent ? game!.opponentPlayer.hand[index] : game!.currentPlayer.hand[index];
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
            if (!canLocalHumanInput()) return;
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
            if (!canLocalHumanInput()) return;
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
            if (!canLocalHumanInput()) return;
            const zoneIndex = parseInt((btn.closest('.unit-zone') as HTMLElement).dataset.index!);
            game!.attack(zoneIndex);
            render();
        });
    });

    document.querySelectorAll('.block-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!canLocalHumanInput()) return;
            game!.resolveBlock(true);
            render();
        });
    });

    document.querySelectorAll('.pass-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!canLocalHumanInput()) return;
            game!.resolveBlock(false);
            render();
        });
    });


    document.querySelectorAll('.active-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!canLocalHumanInput()) return;
            const zoneIndex = parseInt((btn.closest('.unit-zone') as HTMLElement).dataset.index!);
            const zone = game!.currentPlayer.unitZones[zoneIndex];
            const effectIndex = zone.unit?.effects?.findIndex(e => e.activation === 'ACTIVE' || e.activation === 'ACTIVE_MAIN') ?? -1;

            if (effectIndex !== -1) {
                game!.activateEffect(zoneIndex, effectIndex);
                render();
            }
        });
    });

    // Cost Selection Listener
    if (game.state.interactionMode === 'SELECT_COST' && localHumanCanInput) {
        const pending = game.state.pendingEffect as any;
        const payerPlayer = game.state.players.find(player => player.id === pending?.sourcePlayerId);
        const costFilter = pending?.costCardTypeFilter;
        if (payerPlayer) {
            const handSelector = payerPlayer.id === game.currentPlayer.id
                ? '.hand-zone .card-in-hand'
                : '.opponent-hand-zone .card-in-hand';
            const handCards = document.querySelectorAll(handSelector);

            handCards.forEach((card, i) => {
                const el = card as HTMLElement;
                const handCard = payerPlayer.hand[i];
                if (!handCard) return;

                const isValidCostCard = !costFilter || handCard.type === costFilter;

                if (isValidCostCard) {
                    el.style.cursor = 'pointer';
                    el.style.boxShadow = '0 0 10px #0984e3';
                    el.addEventListener('click', () => {
                        if (!canLocalHumanInput()) return;
                        const index = parseInt(el.dataset.index!);
                        game!.selectCostForPlayerId(index, payerPlayer.id);
                        render();
                    });
                } else {
                    el.style.opacity = '0.4';
                    el.style.cursor = 'not-allowed';
                }
            });
        }
    }

    // Zone Selection Listener (for Skills)
    if (game.state.interactionMode === 'SELECT_TARGET' && localHumanCanInput) {
        const pending = game.state.pendingEffect as any;
        const actorId = getActionOwnerPlayerId(game);
        const legalActions = game.getLegalActions(actorId);
        const zoneTargetActions =
            legalActions.filter(action => action.type === 'SELECT_ZONE_TARGET') as Array<{ targetPlayerId: string; zoneIndex: number }>;

        const validZoneKeySet = new Set(zoneTargetActions.map(action => `${action.targetPlayerId}:${action.zoneIndex}`));

        const units = document.querySelectorAll('.unit-zone');
        units.forEach(u => {
            const el = u as HTMLElement;
            const zoneIndex = parseInt(el.dataset.index!);
            const isOpponent = el.dataset.player === 'opponent';
            const targetPlayerId = isOpponent ? game!.opponentPlayer.id : game!.currentPlayer.id;
            const zoneKey = `${targetPlayerId}:${zoneIndex}`;
            const canSelectZone = zoneTargetActions.length === 0 || validZoneKeySet.has(zoneKey);
            if (!canSelectZone) return;

            el.addEventListener('click', () => {
                if (!canLocalHumanInput()) return;
                game!.selectZoneTargetByPlayerId(zoneIndex, targetPlayerId);
                render();
            });
            el.style.cursor = 'crosshair';
            el.style.boxShadow = '0 0 10px #ffeaa7';
        });

        // Trash Selection Listener
        if (pending && pending.validTargets === 'MY_TRASH') {
            const trashTargetActions =
                legalActions.filter(action => action.type === 'SELECT_TRASH_TARGET') as Array<{ targetPlayerId: string; trashIndex: number }>;
            const validTrashKeys = new Set(trashTargetActions.map(action => `${action.targetPlayerId}:${action.trashIndex}`));

            document.querySelectorAll('.trash-card-item').forEach(item => {
                const index = parseInt((item as HTMLElement).dataset.index!);
                const key = `${pending.sourcePlayerId}:${index}`;
                if (trashTargetActions.length > 0 && !validTrashKeys.has(key)) return;

                item.addEventListener('click', () => {
                    if (!canLocalHumanInput()) return;
                    game!.selectTrashTarget(index, pending.sourcePlayerId);
                    render();
                });

                // Hover preview for trash cards too
                item.addEventListener('mouseenter', (e) => {
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
        const handTargetActions =
            legalActions.filter(action => action.type === 'SELECT_HAND_TARGET') as Array<{ targetPlayerId: string; handIndex: number }>;
        if (handTargetActions.length > 0) {
            const targetMap = new Map<string, Set<number>>();
            handTargetActions.forEach(action => {
                const set = targetMap.get(action.targetPlayerId) ?? new Set<number>();
                set.add(action.handIndex);
                targetMap.set(action.targetPlayerId, set);
            });

            targetMap.forEach((allowedIndexes, targetPlayerId) => {
                const handSelector = targetPlayerId === game!.currentPlayer.id
                    ? '.hand-zone .card-in-hand'
                    : '.opponent-hand-zone .card-in-hand';
                const handCards = document.querySelectorAll(handSelector);

                handCards.forEach(card => {
                    const el = card as HTMLElement;
                    const index = parseInt(el.dataset.index!);
                    if (!allowedIndexes.has(index)) return;

                    el.style.cursor = 'crosshair';
                    el.style.boxShadow = '0 0 10px #ffeaa7';
                    el.style.border = '2px solid #e17055';

                    el.addEventListener('click', () => {
                        if (!canLocalHumanInput()) return;
                        game!.selectHandTargetByPlayerId(index, targetPlayerId);
                        render();
                    });
                });
            });
        }

        document.querySelectorAll('.revealed-card-item').forEach(item => {
            if (pending && pending.validTargets === 'REVEALED') {
                item.addEventListener('click', () => {
                    if (!canLocalHumanInput()) return;
                    const index = parseInt((item as HTMLElement).dataset.index!);
                    game!.selectRevealedTarget(index);
                    render();
                });
            }

            // Hover preview
            item.addEventListener('mouseenter', (e) => {
                const index = parseInt((item as HTMLElement).dataset.index!);
                const card = game!.state.revealedCards[index];
                const mouseEvent = e as MouseEvent;
                hoverPreview.show(card, mouseEvent.clientX, mouseEvent.clientY);
            });
            item.addEventListener('mouseleave', () => hoverPreview.hide());
        });

        document.getElementById('confirm-targets-btn')?.addEventListener('click', () => {
            if (!canLocalHumanInput()) return;
            game!.confirmTargets();
            render();
        });
    }

    // Optional Effect Listeners
    if (game.state.interactionMode === 'SELECT_OPTIONAL' && localHumanCanInput) {
        document.getElementById('opt-confirm')?.addEventListener('click', () => {
            if (!canLocalHumanInput()) return;
            game!.resolveOptionalEffect(true);
            render();
        });
        document.getElementById('opt-skip')?.addEventListener('click', () => {
            if (!canLocalHumanInput()) return;
            game!.resolveOptionalEffect(false);
            render();
        });
    }

    // Leader Card Hover Listeners
    document.querySelectorAll('.leader-slot .card').forEach(card => {
        card.addEventListener('mouseenter', (e) => {
            const isOpponent = card.closest('.opponent') !== null;
            const player = isOpponent ? game!.opponentPlayer : game!.currentPlayer;
            if (player.levelZone) {
                const mouseEvent = e as MouseEvent;
                hoverPreview.show(player.levelZone, mouseEvent.clientX, mouseEvent.clientY);
            }
        });
        card.addEventListener('mousemove', (e) => {
            const mouseEvent = e as MouseEvent;
            const isOpponent = card.closest('.opponent') !== null;
            const player = isOpponent ? game!.opponentPlayer : game!.currentPlayer;
            if (player.levelZone) {
                hoverPreview.show(player.levelZone, mouseEvent.clientX, mouseEvent.clientY);
            }
        });
        card.addEventListener('mouseleave', () => {
            hoverPreview.hide();
        });
    });

    // Trash Zone Hover Listeners
    document.querySelectorAll('.trash-zone').forEach(zone => {
        zone.addEventListener('mouseenter', () => {
            const el = zone as HTMLElement;
            const isOpponent = el.dataset.player === 'opponent';
            const player = isOpponent ? game!.opponentPlayer : game!.currentPlayer;

            // Pass the renderCard function to the overlay
            // We use the hoisted renderCard function from the bottom of this file
            trashHoverOverlay.show(player.trash, el, isOpponent, renderCard);
        });

        zone.addEventListener('mouseleave', () => {
            trashHoverOverlay.scheduleHide();
        });
    });

    // Damage Zone Hover Listeners
    document.querySelectorAll('.damage-zone').forEach(zone => {
        const isOpponent = zone.closest('.opponent') !== null;
        const player = isOpponent ? game!.opponentPlayer : game!.currentPlayer;

        zone.querySelectorAll('.card').forEach((cardEl, index) => {
            cardEl.addEventListener('mouseenter', (e) => {
                const card = player.damage[index];
                if (card) {
                    const mouseEvent = e as MouseEvent;
                    hoverPreview.show(card, mouseEvent.clientX, mouseEvent.clientY);
                }
            });
            cardEl.addEventListener('mousemove', (e) => {
                const mouseEvent = e as MouseEvent;
                const card = player.damage[index];
                if (card) {
                    hoverPreview.show(card, mouseEvent.clientX, mouseEvent.clientY);
                }
            });
            cardEl.addEventListener('mouseleave', () => {
                hoverPreview.hide();
            });
        });
    });

}

const debugManager = new DebugManager(game!, render);
(window as any).debug = debugManager;

render();
