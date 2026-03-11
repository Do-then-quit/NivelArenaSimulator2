import { DUMMY_CARDS } from '../../logic/CardDatabase';
import { DeckPersistence } from '../../logic/DeckPersistence';
import { createQuickPlayLoadout } from '../../logic/ai/QuickPlayDeckFactory';
import { getBotModelLabel } from '../../logic/ai/BotRegistry';
import { getDeckBuilderCards } from '../../logic/DeckBuilderCardPool';
import { DeckBuilderUI } from '../../DeckBuilderUI';
import { SetupUI } from '../../SetupUI';
import {
    uiState,
    Screen,
    HUMAN_VS_BASELINE_CONFIG,
    HUMAN_VS_HUMAN_CONFIG,
} from '../appState';
import { getDefaultViewConfig, hasBotPlayer } from '../gameLoop';

export function renderMenu() {
    uiState.app.innerHTML = `
        <div class="main-menu">
            <h1>NivelArena</h1>
            <div class="menu-buttons">
                <button id="custom-sim-btn" class="primary-btn">Custom Simulation (PvP)</button>
                <button id="deck-builder-btn" class="secondary-btn">Deck Builder</button>
                <button id="advanced-menu-btn" class="secondary-btn" type="button" aria-expanded="false" aria-controls="advanced-menu-actions">Advanced</button>
                <div id="advanced-menu-actions" class="advanced-menu-actions" hidden>
                    <button id="start-game-btn" class="primary-btn">Quick Play (ST01 vs ST01)</button>
                    <button id="start-vs-bot-btn" class="primary-btn">Quick Play vs Baseline Bot</button>
                    <button id="custom-vs-bot-btn" class="primary-btn">Custom vs Baseline Bot</button>
                    <button id="online-room-btn" class="primary-btn">Online Match (Room Code)</button>
                    <button id="bot-replay-btn" class="primary-btn">Simulate Bot vs Bot (Replay)</button>
                    <button id="card-test-btn" class="secondary-btn menu-card-test-btn">Card Logic Verification</button>
                </div>
            </div>
        </div>
    `;

    const advancedMenuButton = document.getElementById('advanced-menu-btn') as HTMLButtonElement | null;
    const advancedMenuActions = document.getElementById('advanced-menu-actions') as HTMLDivElement | null;

    advancedMenuButton?.addEventListener('click', () => {
        if (!advancedMenuActions) return;
        advancedMenuActions.hidden = !advancedMenuActions.hidden;
        advancedMenuButton.setAttribute('aria-expanded', advancedMenuActions.hidden ? 'false' : 'true');
    });

    document.getElementById('start-game-btn')?.addEventListener('click', () => {
        const seed = Date.now();
        const { deck1, deck2, leader1, leader2 } = createQuickPlayLoadout(seed);
        uiState.startGame?.(deck1, deck2, leader1, leader2);
    });

    document.getElementById('start-vs-bot-btn')?.addEventListener('click', () => {
        const seed = Date.now();
        const { deck1, deck2, leader1, leader2 } = createQuickPlayLoadout(seed);
        const revealBotHand = window.confirm('Show Baseline Bot hand?\n\nOK: Show hand\nCancel: Hide hand');
        uiState.startGame?.(deck1, deck2, leader1, leader2, HUMAN_VS_BASELINE_CONFIG, { revealBotHand });
    });

    document.getElementById('custom-sim-btn')?.addEventListener('click', () => {
        uiState.pendingSetupConfig = HUMAN_VS_HUMAN_CONFIG;
        uiState.pendingMatchViewConfig = getDefaultViewConfig(HUMAN_VS_HUMAN_CONFIG);
        uiState.currentScreen = Screen.SETUP;
        uiState.render?.();
    });

    document.getElementById('custom-vs-bot-btn')?.addEventListener('click', () => {
        uiState.pendingSetupConfig = HUMAN_VS_BASELINE_CONFIG;
        uiState.pendingMatchViewConfig = getDefaultViewConfig(HUMAN_VS_BASELINE_CONFIG);
        uiState.currentScreen = Screen.SETUP;
        uiState.render?.();
    });

    document.getElementById('online-room-btn')?.addEventListener('click', () => {
        uiState.currentScreen = Screen.ONLINE_ROOM;
        uiState.render?.();
    });

    document.getElementById('bot-replay-btn')?.addEventListener('click', () => {
        const savedDecks = DeckPersistence.getAllDecks();
        uiState.botReplaySetupState = {
            ...uiState.botReplaySetupState,
            player1DeckId: savedDecks[0]?.id ?? null,
            player2DeckId: savedDecks[1]?.id ?? savedDecks[0]?.id ?? null,
            randomSeed: Date.now(),
            running: false,
            progressSteps: 0,
            statusText: '',
        };
        uiState.currentScreen = Screen.BOT_REPLAY_SETUP;
        uiState.render?.();
    });

    document.getElementById('deck-builder-btn')?.addEventListener('click', () => {
        uiState.deckBuilderReturnScreen = Screen.MENU;
        uiState.currentScreen = Screen.DECK_BUILDER;
        uiState.render?.();
    });

    document.getElementById('card-test-btn')?.addEventListener('click', () => {
        uiState.currentScreen = Screen.TEST;
        uiState.render?.();
    });
}

export function renderDeckBuilder() {
    const dbUI = new DeckBuilderUI(
        getDeckBuilderCards(DUMMY_CARDS),
        uiState.app,
        uiState.hoverPreview,
        () => {
            uiState.currentScreen = uiState.deckBuilderReturnScreen;
            uiState.render?.();
        },
    );
    dbUI.render();
}

export function renderSetup() {
    const setupUI = new SetupUI(
        uiState.app,
        DUMMY_CARDS,
        (deck1, deck2, leader1, leader2, options) => {
            uiState.startGame?.(deck1, deck2, leader1, leader2, uiState.pendingSetupConfig, {
                revealBotHand: options.revealBotHand,
            });
        },
        () => {
            uiState.currentScreen = Screen.MENU;
            uiState.render?.();
        },
        {
            showBotHandVisibilityOption: hasBotPlayer(uiState.pendingSetupConfig),
            defaultRevealBotHand: uiState.pendingMatchViewConfig.revealBotHand,
        },
    );
    setupUI.render();

    const title = uiState.app.querySelector('.setup-screen h1');
    if (title) {
        const p2BotLabel = uiState.pendingSetupConfig.player2BotId
            ? getBotModelLabel(uiState.pendingSetupConfig.player2BotId)
            : 'Bot';
        title.textContent = uiState.pendingSetupConfig.player2Control === 'BOT'
            ? `Simulation Setup (vs ${p2BotLabel})`
            : 'Simulation Setup';
    }

    const playerHeaders = uiState.app.querySelectorAll('.player-setup h3');
    const p2Header = playerHeaders.item(1) as HTMLElement | null;
    if (p2Header) {
        const p2BotLabel = uiState.pendingSetupConfig.player2BotId
            ? getBotModelLabel(uiState.pendingSetupConfig.player2BotId)
            : 'Bot';
        p2Header.textContent = uiState.pendingSetupConfig.player2Control === 'BOT'
            ? `Player 2 (${p2BotLabel})`
            : 'Player 2';
    }
}
