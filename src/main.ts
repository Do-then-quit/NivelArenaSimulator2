import './style.css'
import { GameEngine } from './logic/GameEngine';
import { createDeck, DUMMY_CARDS } from './logic/CardDatabase';
import { Phase, Card, CardType } from './logic/types';
import { RuleValidator } from './logic/RuleValidator';
import { createQuickPlayLoadout } from './logic/ai/QuickPlayDeckFactory';
import { DeckPersistence, SavedDeck } from './logic/DeckPersistence';
import {
    BotModelId,
    BotLike,
    createBotForModel,
    getAvailableBotModels,
    getBotModelLabel,
} from './logic/ai/BotRegistry';
import {
    BotReplayActionLog,
    BotReplayDeckLoadout,
    BotReplaySimulationResult,
    createRandomLegalLoadout,
    createReplayPlaybackEngine,
    runBotVsBotReplaySimulation,
} from './logic/ai/BotVsBotReplay';
import { materializeDeckForMatch } from '../scripts/ai/deck_pool';

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
    BOT_REPLAY_SETUP,
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

type PlayerControlMode = 'HUMAN' | 'BOT';
type ReplayDeckMode = 'CUSTOM' | 'RANDOM';

interface MatchControlConfig {
    label: string;
    player1Control: PlayerControlMode;
    player2Control: PlayerControlMode;
    player1BotId?: BotModelId;
    player2BotId?: BotModelId;
}

interface MatchViewConfig {
    revealBotHand: boolean;
}

const HUMAN_VS_HUMAN_CONFIG: MatchControlConfig = {
    label: 'HUMAN vs HUMAN',
    player1Control: 'HUMAN',
    player2Control: 'HUMAN',
};

const HUMAN_VS_BASELINE_CONFIG: MatchControlConfig = {
    label: 'HUMAN vs BASELINE BOT',
    player1Control: 'HUMAN',
    player2Control: 'BOT',
    player2BotId: 'baseline',
};

let pendingSetupConfig: MatchControlConfig = HUMAN_VS_HUMAN_CONFIG;
let activeMatchConfig: MatchControlConfig = HUMAN_VS_HUMAN_CONFIG;
let pendingMatchViewConfig: MatchViewConfig = { revealBotHand: true };
let activeMatchViewConfig: MatchViewConfig = { revealBotHand: true };
const botByPlayerId = new Map<string, BotLike>();
const botLabelByPlayerId = new Map<string, string>();
let botStepTimer: number | null = null;
const availableBotModels = getAvailableBotModels();

interface BotReplaySetupState {
    player1BotId: BotModelId;
    player2BotId: BotModelId;
    deckMode: ReplayDeckMode;
    player1DeckId: string | null;
    player2DeckId: string | null;
    randomSeed: number;
    randomMirrorDeck: boolean;
    maxSteps: number;
    running: boolean;
    progressSteps: number;
    statusText: string;
}

interface BotReplaySession {
    loadout: BotReplayDeckLoadout;
    result: BotReplaySimulationResult;
    actions: BotReplayActionLog[];
    currentActionIndex: number;
    player1BotId: BotModelId;
    player2BotId: BotModelId;
    playerBotModelById: Record<string, BotModelId>;
    playerBotLabelById: Record<string, string>;
}

let botReplaySetupState: BotReplaySetupState = {
    player1BotId: 'baseline',
    player2BotId: 'strong-v1',
    deckMode: 'RANDOM',
    player1DeckId: null,
    player2DeckId: null,
    randomSeed: Date.now(),
    randomMirrorDeck: false,
    maxSteps: 2400,
    running: false,
    progressSteps: 0,
    statusText: '',
};

let replaySession: BotReplaySession | null = null;

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
    if (replaySession?.playerBotModelById[playerId]) return true;
    return botByPlayerId.has(playerId);
}

function hasBotPlayer(controlConfig: MatchControlConfig): boolean {
    return controlConfig.player1Control === 'BOT' || controlConfig.player2Control === 'BOT';
}

function getDefaultViewConfig(controlConfig: MatchControlConfig): MatchViewConfig {
    return {
        revealBotHand: !hasBotPlayer(controlConfig),
    };
}

function shouldRevealHandForPlayer(playerId: string): boolean {
    if (activeMatchViewConfig.revealBotHand) return true;
    return !isBotControlledPlayer(playerId);
}

function canLocalHumanInput(): boolean {
    if (!game || game.state.winner) return false;
    if (replaySession) return false;
    const actorId = getActionOwnerPlayerId(game);
    return !isBotControlledPlayer(actorId);
}

function getBotLabelForPlayerId(playerId: string): string {
    if (replaySession?.playerBotLabelById[playerId]) {
        return replaySession.playerBotLabelById[playerId];
    }
    return botLabelByPlayerId.get(playerId) ?? 'Bot';
}

function runBotStep() {
    if (!game || currentScreen !== Screen.GAME || game.state.winner || replaySession) return;

    const actorId = getActionOwnerPlayerId(game);
    const bot = botByPlayerId.get(actorId);
    if (!bot) return;

    const action = bot.chooseAction(game, actorId);
    if (!action) {
        console.warn(`[Bot] No legal action for actor: ${actorId}`);
        return;
    }

    const ok = game.step(action);
    if (!ok) {
        console.warn(`[Bot] Invalid action from actor ${actorId}: ${JSON.stringify(action)}`);
        return;
    }

    render();
}

function scheduleBotStep(delayMs: number = 220) {
    clearBotStepTimer();

    if (!game || currentScreen !== Screen.GAME || game.state.winner || replaySession) return;
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
                <button id="bot-replay-btn" class="primary-btn">Simulate Bot vs Bot (Replay)</button>
                <button id="deck-builder-btn" class="secondary-btn">Deck Builder</button>
                <button id="card-test-btn" class="secondary-btn" style="margin-top: 10px; background: #6c5ce7;">Card Logic Verification</button>
            </div>
        </div>
    `;

    document.getElementById('start-game-btn')?.addEventListener('click', () => {
        const seed = Date.now();
        const { deck1, deck2, leader1, leader2 } = createQuickPlayLoadout(seed);
        startGame(deck1, deck2, leader1, leader2);
    });

    document.getElementById('start-vs-bot-btn')?.addEventListener('click', () => {
        const seed = Date.now();
        const { deck1, deck2, leader1, leader2 } = createQuickPlayLoadout(seed);
        const revealBotHand = window.confirm('Show Baseline Bot hand?\n\nOK: Show hand\nCancel: Hide hand');
        startGame(deck1, deck2, leader1, leader2, HUMAN_VS_BASELINE_CONFIG, { revealBotHand });
    });


    document.getElementById('custom-sim-btn')?.addEventListener('click', () => {
        pendingSetupConfig = HUMAN_VS_HUMAN_CONFIG;
        pendingMatchViewConfig = getDefaultViewConfig(HUMAN_VS_HUMAN_CONFIG);
        currentScreen = Screen.SETUP;
        render();
    });

    document.getElementById('custom-vs-bot-btn')?.addEventListener('click', () => {
        pendingSetupConfig = HUMAN_VS_BASELINE_CONFIG;
        pendingMatchViewConfig = getDefaultViewConfig(HUMAN_VS_BASELINE_CONFIG);
        currentScreen = Screen.SETUP;
        render();
    });

    document.getElementById('bot-replay-btn')?.addEventListener('click', () => {
        const savedDecks = DeckPersistence.getAllDecks();
        botReplaySetupState = {
            ...botReplaySetupState,
            player1DeckId: savedDecks[0]?.id ?? null,
            player2DeckId: savedDecks[1]?.id ?? savedDecks[0]?.id ?? null,
            randomSeed: Date.now(),
            running: false,
            progressSteps: 0,
            statusText: '',
        };
        currentScreen = Screen.BOT_REPLAY_SETUP;
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
    controlConfig: MatchControlConfig = HUMAN_VS_HUMAN_CONFIG,
    viewConfig?: MatchViewConfig
) {
    clearBotStepTimer();
    replaySession = null;
    activeMatchConfig = controlConfig;
    activeMatchViewConfig = {
        ...getDefaultViewConfig(controlConfig),
        ...viewConfig,
    };
    game = new GameEngine('Player 1', 'Player 2', deck1, deck2, leader1, leader2, { enableMulligan: true });
    botByPlayerId.clear();
    botLabelByPlayerId.clear();
    const [player1, player2] = game.state.players;
    if (controlConfig.player1Control === 'BOT') {
        const botId = controlConfig.player1BotId ?? 'baseline';
        botByPlayerId.set(player1.id, createBotForModel(botId, `${getBotModelLabel(botId)}-P1`));
        botLabelByPlayerId.set(player1.id, getBotModelLabel(botId));
    }
    if (controlConfig.player2Control === 'BOT') {
        const botId = controlConfig.player2BotId ?? 'baseline';
        botByPlayerId.set(player2.id, createBotForModel(botId, `${getBotModelLabel(botId)}-P2`));
        botLabelByPlayerId.set(player2.id, getBotModelLabel(botId));
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
        (deck1, deck2, leader1, leader2, options) => {
            startGame(deck1, deck2, leader1, leader2, pendingSetupConfig, {
                revealBotHand: options.revealBotHand,
            });
        },
        () => {
            currentScreen = Screen.MENU;
            render();
        },
        {
            showBotHandVisibilityOption: hasBotPlayer(pendingSetupConfig),
            defaultRevealBotHand: pendingMatchViewConfig.revealBotHand,
        }
    );
    setupUI.render();

    const title = app.querySelector('.setup-screen h1');
    if (title) {
        const p2BotLabel = pendingSetupConfig.player2BotId ? getBotModelLabel(pendingSetupConfig.player2BotId) : 'Bot';
        title.textContent = pendingSetupConfig.player2Control === 'BOT'
            ? `Simulation Setup (vs ${p2BotLabel})`
            : 'Simulation Setup';
    }

    const playerHeaders = app.querySelectorAll('.player-setup h3');
    const p2Header = playerHeaders.item(1) as HTMLElement | null;
    if (p2Header) {
        const p2BotLabel = pendingSetupConfig.player2BotId ? getBotModelLabel(pendingSetupConfig.player2BotId) : 'Bot';
        p2Header.textContent = pendingSetupConfig.player2Control === 'BOT'
            ? `Player 2 (${p2BotLabel})`
            : 'Player 2';
    }
}

function parsePositiveInt(value: string, fallback: number): number {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return parsed;
}

function resolveSavedDeckCards(savedDeck: SavedDeck): Card[] {
    return savedDeck.cardIds
        .map(cardId => DUMMY_CARDS.find(card => card.id === cardId))
        .filter((card): card is Card => !!card);
}

function resolveCustomReplayLoadout(seed: number, player1DeckId: string | null, player2DeckId: string | null): BotReplayDeckLoadout | null {
    const savedDecks = DeckPersistence.getAllDecks();
    if (savedDecks.length === 0) {
        alert('No saved decks found. Create decks in Deck Builder first.');
        return null;
    }

    const savedDeck1 = savedDecks.find(deck => deck.id === player1DeckId) ?? null;
    const savedDeck2 = savedDecks.find(deck => deck.id === player2DeckId) ?? null;
    if (!savedDeck1 || !savedDeck2) {
        alert('Please select valid saved decks for both players.');
        return null;
    }

    const leader1Template = savedDeck1.leaderId ? DUMMY_CARDS.find(card => card.id === savedDeck1.leaderId) ?? null : null;
    const leader2Template = savedDeck2.leaderId ? DUMMY_CARDS.find(card => card.id === savedDeck2.leaderId) ?? null : null;
    if (!leader1Template || !leader2Template || leader1Template.type !== CardType.LEADER || leader2Template.type !== CardType.LEADER) {
        alert('Both custom decks must have a valid leader.');
        return null;
    }

    const deck1Source = resolveSavedDeckCards(savedDeck1);
    const deck2Source = resolveSavedDeckCards(savedDeck2);
    if (deck1Source.length !== savedDeck1.cardIds.length || deck2Source.length !== savedDeck2.cardIds.length) {
        alert('Some cards from selected decks could not be resolved from current card database.');
        return null;
    }

    const leader1: Card = { ...leader1Template, id: `${leader1Template.id}_L_${seed}_1` };
    const leader2: Card = { ...leader2Template, id: `${leader2Template.id}_L_${seed}_2` };
    const deck1 = materializeDeckForMatch(deck1Source, seed + 901, 'CUSTOM_P1');
    const deck2 = materializeDeckForMatch(deck2Source, seed + 902, 'CUSTOM_P2');

    return {
        seed,
        leader1,
        leader2,
        deck1,
        deck2,
        description: `Custom decks: ${savedDeck1.name} vs ${savedDeck2.name}`,
    };
}

function renderBotReplaySetup() {
    const savedDecks = DeckPersistence.getAllDecks();
    const usingCustomDecks = botReplaySetupState.deckMode === 'CUSTOM';

    if (!botReplaySetupState.player1DeckId && savedDecks[0]) {
        botReplaySetupState.player1DeckId = savedDecks[0].id;
    }
    if (!botReplaySetupState.player2DeckId) {
        botReplaySetupState.player2DeckId = savedDecks[1]?.id ?? savedDecks[0]?.id ?? null;
    }

    app.innerHTML = `
        <div class="setup-screen bot-replay-setup">
            <h1>Bot vs Bot Replay Setup</h1>
            <div class="setup-main">
                <div class="player-setup">
                    <h3>Player 1 Bot</h3>
                    <div class="deck-select">
                        <label>Bot Model:</label>
                        <select id="bot-replay-p1-model" ${botReplaySetupState.running ? 'disabled' : ''}>
                            ${availableBotModels.map(bot => `<option value="${bot.id}" ${botReplaySetupState.player1BotId === bot.id ? 'selected' : ''}>${bot.label}</option>`).join('')}
                        </select>
                    </div>
                    <div class="deck-preview-small">
                        <div class="preview-info"><strong>Model:</strong> ${getBotModelLabel(botReplaySetupState.player1BotId)}</div>
                    </div>
                </div>
                <div class="vs-divider">VS</div>
                <div class="player-setup">
                    <h3>Player 2 Bot</h3>
                    <div class="deck-select">
                        <label>Bot Model:</label>
                        <select id="bot-replay-p2-model" ${botReplaySetupState.running ? 'disabled' : ''}>
                            ${availableBotModels.map(bot => `<option value="${bot.id}" ${botReplaySetupState.player2BotId === bot.id ? 'selected' : ''}>${bot.label}</option>`).join('')}
                        </select>
                    </div>
                    <div class="deck-preview-small">
                        <div class="preview-info"><strong>Model:</strong> ${getBotModelLabel(botReplaySetupState.player2BotId)}</div>
                    </div>
                </div>
            </div>

            <div class="setup-extra-options">
                <h3>Deck Source</h3>
                <label class="setup-radio-option">
                    <input type="radio" name="replay-deck-mode" value="CUSTOM" ${usingCustomDecks ? 'checked' : ''} ${botReplaySetupState.running ? 'disabled' : ''}>
                    <span>Saved Custom Decks</span>
                </label>
                <label class="setup-radio-option">
                    <input type="radio" name="replay-deck-mode" value="RANDOM" ${usingCustomDecks ? '' : 'checked'} ${botReplaySetupState.running ? 'disabled' : ''}>
                    <span>Random Legal Deck Generator</span>
                </label>

                <div class="bot-replay-options-grid">
                    ${usingCustomDecks ? `
                        <div class="deck-select">
                            <label>Player 1 Deck:</label>
                            <select id="bot-replay-p1-deck" ${savedDecks.length === 0 || botReplaySetupState.running ? 'disabled' : ''}>
                                ${savedDecks.map(deck => `<option value="${deck.id}" ${botReplaySetupState.player1DeckId === deck.id ? 'selected' : ''}>${deck.name}</option>`).join('')}
                                ${savedDecks.length === 0 ? '<option value="">No saved decks</option>' : ''}
                            </select>
                        </div>
                        <div class="deck-select">
                            <label>Player 2 Deck:</label>
                            <select id="bot-replay-p2-deck" ${savedDecks.length === 0 || botReplaySetupState.running ? 'disabled' : ''}>
                                ${savedDecks.map(deck => `<option value="${deck.id}" ${botReplaySetupState.player2DeckId === deck.id ? 'selected' : ''}>${deck.name}</option>`).join('')}
                                ${savedDecks.length === 0 ? '<option value="">No saved decks</option>' : ''}
                            </select>
                        </div>
                    ` : `
                        <div class="deck-select">
                            <label>Random Seed:</label>
                            <input id="bot-replay-seed" type="number" value="${botReplaySetupState.randomSeed}" ${botReplaySetupState.running ? 'disabled' : ''} />
                        </div>
                        <label class="setup-radio-option bot-replay-inline">
                            <input id="bot-replay-mirror" type="checkbox" ${botReplaySetupState.randomMirrorDeck ? 'checked' : ''} ${botReplaySetupState.running ? 'disabled' : ''}>
                            <span>Use Same Random Deck for Both Bots (Mirror)</span>
                        </label>
                    `}
                </div>

                <div class="deck-select">
                    <label>Simulation Max Steps:</label>
                    <input id="bot-replay-max-steps" type="number" min="50" value="${botReplaySetupState.maxSteps}" ${botReplaySetupState.running ? 'disabled' : ''} />
                </div>
            </div>

            ${botReplaySetupState.running ? `<div class="bot-replay-running">Simulating... steps=${botReplaySetupState.progressSteps}${botReplaySetupState.statusText ? ` (${botReplaySetupState.statusText})` : ''}</div>` : ''}

            <div class="setup-actions">
                <button id="bot-replay-back" class="secondary-btn" ${botReplaySetupState.running ? 'disabled' : ''}>Back to Menu</button>
                <button id="bot-replay-start" class="primary-btn" ${(botReplaySetupState.running || (usingCustomDecks && savedDecks.length === 0)) ? 'disabled' : ''}>Run 1 Game & Prepare Replay</button>
            </div>
        </div>
    `;

    document.getElementById('bot-replay-back')?.addEventListener('click', () => {
        if (botReplaySetupState.running) return;
        currentScreen = Screen.MENU;
        render();
    });

    document.getElementById('bot-replay-p1-model')?.addEventListener('change', (event) => {
        const target = event.target as HTMLSelectElement;
        botReplaySetupState.player1BotId = target.value as BotModelId;
    });

    document.getElementById('bot-replay-p2-model')?.addEventListener('change', (event) => {
        const target = event.target as HTMLSelectElement;
        botReplaySetupState.player2BotId = target.value as BotModelId;
    });

    document.querySelectorAll<HTMLInputElement>('input[name="replay-deck-mode"]').forEach(radio => {
        radio.addEventListener('change', () => {
            botReplaySetupState.deckMode = radio.value as ReplayDeckMode;
            renderBotReplaySetup();
        });
    });

    document.getElementById('bot-replay-p1-deck')?.addEventListener('change', (event) => {
        const target = event.target as HTMLSelectElement;
        botReplaySetupState.player1DeckId = target.value || null;
    });

    document.getElementById('bot-replay-p2-deck')?.addEventListener('change', (event) => {
        const target = event.target as HTMLSelectElement;
        botReplaySetupState.player2DeckId = target.value || null;
    });

    document.getElementById('bot-replay-seed')?.addEventListener('change', (event) => {
        const target = event.target as HTMLInputElement;
        botReplaySetupState.randomSeed = parsePositiveInt(target.value, Date.now());
    });

    document.getElementById('bot-replay-mirror')?.addEventListener('change', (event) => {
        const target = event.target as HTMLInputElement;
        botReplaySetupState.randomMirrorDeck = target.checked;
    });

    document.getElementById('bot-replay-max-steps')?.addEventListener('change', (event) => {
        const target = event.target as HTMLInputElement;
        botReplaySetupState.maxSteps = parsePositiveInt(target.value, 2400);
    });

    document.getElementById('bot-replay-start')?.addEventListener('click', () => {
        if (botReplaySetupState.running) return;
        void startBotReplayFromSetup();
    });
}

function initializeReplaySession(
    loadout: BotReplayDeckLoadout,
    result: BotReplaySimulationResult,
    player1BotId: BotModelId,
    player2BotId: BotModelId,
) {
    const playbackEngine = createReplayPlaybackEngine(loadout, true);
    const [player1, player2] = playbackEngine.state.players;

    replaySession = {
        loadout,
        result,
        actions: result.actions,
        currentActionIndex: 0,
        player1BotId,
        player2BotId,
        playerBotModelById: {
            [player1.id]: player1BotId,
            [player2.id]: player2BotId,
        },
        playerBotLabelById: {
            [player1.id]: getBotModelLabel(player1BotId),
            [player2.id]: getBotModelLabel(player2BotId),
        },
    };

    clearBotStepTimer();
    botByPlayerId.clear();
    botLabelByPlayerId.clear();
    activeMatchConfig = {
        label: `${getBotModelLabel(player1BotId)} vs ${getBotModelLabel(player2BotId)} Replay`,
        player1Control: 'BOT',
        player2Control: 'BOT',
        player1BotId,
        player2BotId,
    };
    activeMatchViewConfig = { revealBotHand: true };
    game = playbackEngine;

    (window as any).debug = new DebugManager(playbackEngine, render);
    currentScreen = Screen.GAME;
    render();
}

async function startBotReplayFromSetup() {
    const seed = parsePositiveInt(String(botReplaySetupState.randomSeed), Date.now());
    const maxSteps = Math.max(50, parsePositiveInt(String(botReplaySetupState.maxSteps), 2400));
    const player1BotId = botReplaySetupState.player1BotId;
    const player2BotId = botReplaySetupState.player2BotId;

    let loadout: BotReplayDeckLoadout | null = null;
    if (botReplaySetupState.deckMode === 'RANDOM') {
        loadout = createRandomLegalLoadout(seed, botReplaySetupState.randomMirrorDeck);
    } else {
        loadout = resolveCustomReplayLoadout(seed, botReplaySetupState.player1DeckId, botReplaySetupState.player2DeckId);
    }

    if (!loadout) return;

    botReplaySetupState = {
        ...botReplaySetupState,
        running: true,
        progressSteps: 0,
        statusText: `seed=${loadout.seed}`,
        randomSeed: loadout.seed,
        maxSteps,
    };
    renderBotReplaySetup();

    try {
        const result = await runBotVsBotReplaySimulation({
            seed: loadout.seed,
            maxSteps,
            enableMulligan: true,
            player1BotId,
            player2BotId,
            loadout,
            onProgress: (steps) => {
                if (currentScreen !== Screen.BOT_REPLAY_SETUP) return;
                if (steps % 20 !== 0) return;
                botReplaySetupState = {
                    ...botReplaySetupState,
                    progressSteps: steps,
                    statusText: `seed=${loadout.seed}, maxSteps=${maxSteps}`,
                };
                renderBotReplaySetup();
            },
        });

        initializeReplaySession(loadout, result, player1BotId, player2BotId);
    } catch (error) {
        console.error(error);
        alert(`Bot replay simulation failed: ${(error as Error).message}`);
        if (currentScreen === Screen.BOT_REPLAY_SETUP) {
            botReplaySetupState = {
                ...botReplaySetupState,
                running: false,
            };
            renderBotReplaySetup();
        }
        return;
    }
}

function stepReplayForward() {
    if (!replaySession || !game) return;
    if (replaySession.currentActionIndex >= replaySession.actions.length) return;

    const entry = replaySession.actions[replaySession.currentActionIndex];
    const ok = game.step(entry.action);
    if (!ok) {
        alert(`Replay desync at step ${entry.step}: ${entry.summary}`);
        return;
    }

    replaySession.currentActionIndex += 1;
    render();
}

function restartReplayFromBeginning() {
    if (!replaySession) return;
    initializeReplaySession(
        replaySession.loadout,
        replaySession.result,
        replaySession.player1BotId,
        replaySession.player2BotId,
    );
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
            botLabelByPlayerId.clear();
            replaySession = null;
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
    } else if (currentScreen === Screen.BOT_REPLAY_SETUP) {
        renderBotReplaySetup();
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
    const revealCurrentPlayerHand = shouldRevealHandForPlayer(currentPlayer.id);
    const revealOpponentHand = shouldRevealHandForPlayer(opponent.id);
    const inputOwnerId = getActionOwnerPlayerId(game);
    const inputOwner = game.state.players.find(player => player.id === inputOwnerId) ?? null;
    const localHumanCanInput = canLocalHumanInput();
    const inputOwnerLegalActions = game.getLegalActions(inputOwnerId);
    const inputOwnerControl = inputOwner
        ? (isBotControlledPlayer(inputOwner.id) ? getBotLabelForPlayerId(inputOwner.id) : 'Human')
        : 'N/A';


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
            const actorId = getActionOwnerPlayerId(game!);
            const canConfirm = game!.getLegalActions(actorId).some(action => action.type === 'CONFIRM_TARGETS');
            const sacrificeHint = pending?.actionType === 'SACRIFICE_TO_BUFF'
                ? (currentCount === 0
                    ? 'Step 1/2: Select the unit to trash.'
                    : currentCount === 1
                        ? 'Step 2/2: Select the unit to receive +2000 power.'
                        : 'Selection complete. Confirm to resolve.')
                : '';

            return `
            <div style="background: #e17055; color: white; padding: 10px; border-radius: 4px; display: flex; align-items: center; gap: 15px;">
                <span style="animation: pulse 1s infinite;">SELECT TARGETS (${currentCount}/${maxCount === 0 ? 'All' : maxCount})</span>
                ${sacrificeHint ? `<span style="font-size: 0.85rem; opacity: 0.9;">${sacrificeHint}</span>` : ''}
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
              <div class="card-in-hand ${isTargetCandidate ? 'target-candidate' : ''} ${revealOpponentHand ? '' : 'concealed-hand'}" data-index="${i}" data-hand-revealed="${revealOpponentHand ? '1' : '0'}">
                  ${revealOpponentHand ? renderCard(c) : renderHiddenHandCard(false)}
              </div>
          `}).join('')}
      </div>

      ${renderPlayer(opponent, true, isMainPhase, inputOwnerLegalActions)}
      
      <div class="game-divider"></div>

      ${renderPlayer(currentPlayer, false, isMainPhase, inputOwnerLegalActions)}

      <div class="hand-zone">
          ${currentPlayer.hand.map((c, i) => {
                const isCostCandidate = game!.state.interactionMode === 'SELECT_COST';
                const pending = game!.state.pendingEffect as any;
                const isTargetCandidate = game!.state.interactionMode === 'SELECT_TARGET' &&
                    pending &&
                    game!.isPendingCardTarget(c);

                return `
              <div class="card-in-hand ${isCostCandidate ? 'cost-candidate' : ''} ${isTargetCandidate ? 'target-candidate' : ''} ${revealCurrentPlayerHand ? '' : 'concealed-hand'}" draggable="${isMainPhase && game!.state.interactionMode === 'NORMAL' && localHumanCanInput}" data-index="${i}" data-hand-revealed="${revealCurrentPlayerHand ? '1' : '0'}">
                  ${revealCurrentPlayerHand ? renderCard(c) : renderHiddenHandCard(false)}
              </div>
          `}).join('')}
      </div>

      <div class="game-controls">
        <div class="status-bar">
          <div class="status-item"><span>Turn</span> <strong>${game.state.turnCount}</strong></div>
          <div class="status-item"><span>Phase</span> <strong>${game.state.phase}</strong></div>
          <div class="status-item"><span>Active</span> <strong>${game.currentPlayer.name}</strong></div>
          <div class="status-item"><span>Mode</span> <strong>${activeMatchConfig.label}</strong></div>
          <div class="status-item"><span>Bot Hand</span> <strong>${activeMatchViewConfig.revealBotHand ? 'Shown' : 'Hidden'}</strong></div>
          <div class="status-item"><span>Input</span> <strong>${inputOwner?.name ?? 'N/A'} (${inputOwnerControl})</strong></div>
        </div>
        ${renderGameControlButtons(localHumanCanInput)}
      </div>

      ${renderOptionalEffectModal()}
      ${renderMulliganModal()}
      ${renderTrashModal()}
      ${renderRevealedCardsModal()}
      ${renderGameOverModal()}
      ${renderReplayOverlayControls()}
    </div>
  `;

    attachListeners();
    scheduleBotStep();
}

function getReplayTerminationLabel(reason: string): string {
    switch (reason) {
        case 'winner':
            return 'Winner reached';
        case 'max_steps':
            return 'Stopped by max steps';
        case 'no_action':
            return 'Stopped: bot had no legal action';
        case 'invalid_action':
            return 'Stopped: invalid action';
        default:
            return reason;
    }
}

function renderGameControlButtons(localHumanCanInput: boolean): string {
    if (!replaySession || !game) {
        return `<button id="next-phase" class="primary-btn" ${game?.state.phase === Phase.BLOCK || game?.state.interactionMode !== 'NORMAL' || !localHumanCanInput ? 'disabled' : ''}>Next Phase</button>`;
    }

    const replay = replaySession;
    const consumed = replay.currentActionIndex;
    const total = replay.actions.length;
    const lastAction = consumed > 0 ? replay.actions[consumed - 1].summary : 'Not started';
    const nextAction = consumed < total ? replay.actions[consumed].summary : 'Replay complete';
    const winnerName = replay.result.winnerId
        ? game.state.players.find(player => player.id === replay.result.winnerId)?.name ?? 'Winner'
        : 'None';
    const disabledNext = consumed >= total ? 'disabled' : '';

    return `
        <div class="replay-controls">
            <div class="replay-status">
                <div><strong>Replay:</strong> ${consumed} / ${total}</div>
                <div><strong>Last:</strong> ${lastAction}</div>
                <div><strong>Next:</strong> ${nextAction}</div>
                <div><strong>Result:</strong> ${getReplayTerminationLabel(replay.result.terminationReason)} / Winner: ${winnerName}</div>
            </div>
            <div class="replay-actions">
                <button id="replay-restart" class="secondary-btn">Restart Replay</button>
                <button id="replay-next-action" class="primary-btn" ${disabledNext}>Next Action</button>
            </div>
        </div>
    `;
}

function renderReplayOverlayControls(): string {
    if (!replaySession) return '';

    const consumed = replaySession.currentActionIndex;
    const total = replaySession.actions.length;
    const disabledNext = consumed >= total ? 'disabled' : '';

    return `
        <div class="replay-overlay-controls">
            <button id="replay-overlay-restart" class="secondary-btn">Restart Replay</button>
            <button id="replay-overlay-next-action" class="primary-btn" ${disabledNext}>Next Action</button>
        </div>
    `;
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

function renderMulliganModal() {
    if (!game) return '';
    if (game.state.interactionMode !== 'SELECT_MULLIGAN') return '';

    const actorId = getActionOwnerPlayerId(game);
    const actor = game.state.players.find(player => player.id === actorId);
    if (!actor) return '';

    const localHumanCanInput = canLocalHumanInput();
    const revealActorHand = shouldRevealHandForPlayer(actor.id);
    const waitingLabel = isBotControlledPlayer(actor.id)
        ? `${getBotLabelForPlayerId(actor.id)} is deciding...`
        : 'Waiting for input...';

    return `
        <div class="modal-overlay mulligan-overlay">
            <div class="mulligan-modal">
                <h3>Mulligan</h3>
                <p class="mulligan-desc">
                    ${actor.name} can choose one time: keep this opening hand or redraw all 5 cards.
                </p>
                <div class="mulligan-hand-preview">
                    ${actor.hand.map(card => revealActorHand ? renderCard(card, true) : renderHiddenHandCard(true)).join('')}
                </div>
                <div class="mulligan-actions">
                    <button id="mulligan-keep-btn" class="primary-btn" ${localHumanCanInput ? '' : 'disabled'} style="background:#636e72;">Keep Hand</button>
                    <button id="mulligan-redraw-btn" class="primary-btn" ${localHumanCanInput ? '' : 'disabled'}>Full Mulligan</button>
                </div>
                ${!localHumanCanInput ? `<p class="mulligan-waiting">${waitingLabel}</p>` : ''}
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

function renderPlayer(player: any, isOpponent: boolean, isMainPhase: boolean, legalActions: any[]) {
    if (!game) return '';
    const localHumanCanInput = canLocalHumanInput();
    const blockResolveActions = (legalActions || []).filter((action: any) => action.type === 'RESOLVE_BLOCK');
    const blockableZoneSet = new Set<number>(
        blockResolveActions
            .filter((action: any) => action.shouldBlock && typeof action.blockerZoneIndex === 'number')
            .map((action: any) => action.blockerZoneIndex)
    );
    const hasBlockPassAction = blockResolveActions.some((action: any) => action.shouldBlock === false);
    const activatableEffectActions = (legalActions || []).filter((action: any) => action.type === 'ACTIVATE_EFFECT');
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
        const pendingAttackerLaneIndex = game!.state.pendingAttackerIndex ?? -1;
        const isEncounterLane = game!.state.phase === Phase.BLOCK && isOpponent && pendingAttackerLaneIndex === i;
        const canBlockWithThisZone = game!.state.phase === Phase.BLOCK && isOpponent && blockableZoneSet.has(i);
        const showPassControl = game!.state.phase === Phase.BLOCK && isOpponent && hasBlockPassAction && isEncounterLane;
        const isBlockingTarget = isEncounterLane || canBlockWithThisZone;
        const zoneHasActivatableEffect = !isOpponent && activatableEffectActions.some((action: any) => action.zoneIndex === i);
        const isSelected = game!.state.pendingEffect?.selectedTargets?.includes(z);

        return `
                    <div class="zone unit-zone ${!isOpponent && localHumanCanInput ? 'interactive drop-zone' : ''} ${isBlockingTarget ? 'blocking-target' : ''} ${isSelected ? 'selected-target' : ''}" data-player="${isOpponent ? 'opponent' : 'current'}" data-index="${i}">
                        ${z.unit ? renderCard(z.unit, false, game!.getUnitPower(z, player), game!.getUnitHit(z, player)) : '<span style="color: rgba(255,255,255,0.1); font-size: 0.8rem; font-weight: bold;">UNIT</span>'}
                        
                        <!-- Items -->
                        ${z.items.length > 0 ? `
                            <div class="attached-items">
                                ${z.items.map((item: Card, itemIndex: number) => {
            const isItemSelected = game!.state.pendingEffect?.selectedTargets?.includes(item);
            return `
                                    <div class="mini-item-card ${isItemSelected ? 'selected-target' : ''}" data-player="${isOpponent ? 'opponent' : 'current'}" data-zone-index="${i}" data-item-index="${itemIndex}">
                                        <img src="${item.imageUrl}" alt="${item.name}">
                                    </div>
                                `;
        }).join('')}
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
                        ${!isOpponent && localHumanCanInput && zoneHasActivatableEffect ? '<button class="active-btn">Active</button>' : ''}
                        ${(canBlockWithThisZone || showPassControl) && localHumanCanInput ? `
                            <div class="block-controls">
                                ${canBlockWithThisZone ? `<button class="block-btn" data-blocker-zone-index="${i}">Block</button>` : ''}
                                ${showPassControl ? '<button class="pass-btn">Pass</button>' : ''}
                            </div>
                        ` : ''}
                        ${z.unit ? `<div class="stats">${game!.getUnitPower(z, player)} / ${game!.getUnitHit(z, player)}</div>` : ''}
                    </div>
                `}).join('')}
            </div>

            <!-- Bottom Field (2, 4) -->
            <div class="bottom-center">
                <div class="damage-zone">
                    ${player.damage.map((c: any, damageIndex: number) => {
        const isDamageSelected = game!.state.pendingEffect?.selectedTargets?.includes(c);
        return `<div class="damage-card-item ${isDamageSelected ? 'selected-target' : ''}" data-player="${isOpponent ? 'opponent' : 'current'}" data-index="${damageIndex}">${renderCard(c, true)}</div>`;
    }).join('')}
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

function renderHiddenHandCard(isSmall: boolean = false) {
    return `
        <div class="card card-back ${isSmall ? 'small-card' : ''}">
            <div class="card-back-pattern"></div>
            <div class="card-back-label">HIDDEN</div>
        </div>
    `;
}

let draggedCardIndex: number | null = null;

function attachListeners() {
    if (!game) return;
    const localHumanCanInput = canLocalHumanInput();

    document.getElementById('db-back-to-menu')?.addEventListener('click', () => {
        clearBotStepTimer();
        replaySession = null;
        game = null;
        currentScreen = Screen.MENU;
        render();
    });

    document.getElementById('game-over-menu-btn')?.addEventListener('click', () => {
        clearBotStepTimer();
        replaySession = null;
        game = null;
        currentScreen = Screen.MENU;
        render();
    });

    document.getElementById('replay-next-action')?.addEventListener('click', () => {
        stepReplayForward();
    });

    document.getElementById('replay-restart')?.addEventListener('click', () => {
        restartReplayFromBeginning();
    });

    document.getElementById('replay-overlay-next-action')?.addEventListener('click', () => {
        stepReplayForward();
    });

    document.getElementById('replay-overlay-restart')?.addEventListener('click', () => {
        restartReplayFromBeginning();
    });

    document.getElementById('next-phase')?.addEventListener('click', () => {
        if (!canLocalHumanInput()) return;
        game!.nextPhase();
        render();
    });

    if (game.state.interactionMode === 'SELECT_MULLIGAN' && localHumanCanInput) {
        const actorPlayerId = getActionOwnerPlayerId(game);
        document.getElementById('mulligan-keep-btn')?.addEventListener('click', () => {
            if (!canLocalHumanInput()) return;
            const ok = game!.step({ type: 'RESOLVE_MULLIGAN', actorPlayerId, shouldMulligan: false });
            if (!ok) return;
            render();
        });
        document.getElementById('mulligan-redraw-btn')?.addEventListener('click', () => {
            if (!canLocalHumanInput()) return;
            const ok = game!.step({ type: 'RESOLVE_MULLIGAN', actorPlayerId, shouldMulligan: true });
            if (!ok) return;
            render();
        });
    }

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
            const el = card as HTMLElement;
            const isRevealed = el.dataset.handRevealed === '1';
            if (!isRevealed) return;
            const index = parseInt((card as HTMLElement).dataset.index!);
            const isOpponent = card.closest('.opponent-hand-zone') !== null;
            const cardObj = isOpponent ? game!.opponentPlayer.hand[index] : game!.currentPlayer.hand[index];
            const mouseEvent = e as MouseEvent;
            hoverPreview.show(cardObj, mouseEvent.clientX, mouseEvent.clientY);
        });

        card.addEventListener('mousemove', (e) => {
            const el = card as HTMLElement;
            const isRevealed = el.dataset.handRevealed === '1';
            if (!isRevealed) return;
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
            const blockerZoneIndexRaw = (btn as HTMLElement).dataset.blockerZoneIndex;
            const blockerZoneIndex = blockerZoneIndexRaw !== undefined ? parseInt(blockerZoneIndexRaw, 10) : undefined;
            game!.resolveBlock(true, Number.isNaN(blockerZoneIndex) ? undefined : blockerZoneIndex);
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
            const actorId = getActionOwnerPlayerId(game!);
            const activateActions = game!.getLegalActions(actorId).filter((action: any) =>
                action.type === 'ACTIVATE_EFFECT' && action.zoneIndex === zoneIndex
            ) as any[];
            const preferredAction =
                activateActions.find((action: any) => action.sourceType !== 'ITEM') ??
                activateActions[0];

            if (preferredAction) {
                game!.step(preferredAction);
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
            const canSelectZone = zoneTargetActions.length > 0 && validZoneKeySet.has(zoneKey);
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

        const damageTargetActions =
            legalActions.filter(action => action.type === 'SELECT_DAMAGE_TARGET') as Array<{ targetPlayerId: string; damageIndex: number }>;
        if (damageTargetActions.length > 0) {
            const targetMap = new Map<string, Set<number>>();
            damageTargetActions.forEach(action => {
                const set = targetMap.get(action.targetPlayerId) ?? new Set<number>();
                set.add(action.damageIndex);
                targetMap.set(action.targetPlayerId, set);
            });

            targetMap.forEach((allowedIndexes, targetPlayerId) => {
                const selector = targetPlayerId === game!.currentPlayer.id
                    ? '.current .damage-zone .damage-card-item'
                    : '.opponent .damage-zone .damage-card-item';
                document.querySelectorAll(selector).forEach(item => {
                    const el = item as HTMLElement;
                    const index = parseInt(el.dataset.index!);
                    if (!allowedIndexes.has(index)) return;

                    el.style.cursor = 'crosshair';
                    el.style.boxShadow = '0 0 10px #ffeaa7';
                    el.addEventListener('click', () => {
                        if (!canLocalHumanInput()) return;
                        game!.selectDamageTargetByPlayerId(index, targetPlayerId);
                        render();
                    });
                });
            });
        }

        const itemTargetActions =
            legalActions.filter(action => action.type === 'SELECT_ITEM_TARGET') as Array<{ targetPlayerId: string; zoneIndex: number; itemIndex: number }>;
        if (itemTargetActions.length > 0) {
            const validItemKeys = new Set(itemTargetActions.map(action => `${action.targetPlayerId}:${action.zoneIndex}:${action.itemIndex}`));
            document.querySelectorAll('.mini-item-card').forEach(item => {
                const el = item as HTMLElement;
                const zoneIndex = parseInt(el.dataset.zoneIndex || '-1');
                const itemIndex = parseInt(el.dataset.itemIndex || '-1');
                const playerRef = el.dataset.player === 'opponent' ? game!.opponentPlayer.id : game!.currentPlayer.id;
                const key = `${playerRef}:${zoneIndex}:${itemIndex}`;
                if (!validItemKeys.has(key)) return;

                el.style.cursor = 'crosshair';
                el.style.boxShadow = '0 0 10px #ffeaa7';
                el.style.border = '2px solid #e17055';
                el.addEventListener('click', () => {
                    if (!canLocalHumanInput()) return;
                    game!.selectItemTargetByPlayerId(zoneIndex, itemIndex, playerRef);
                    render();
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

        zone.querySelectorAll('.damage-card-item').forEach(cardEl => {
            const index = parseInt((cardEl as HTMLElement).dataset.index || '-1');
            if (index < 0) return;
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
