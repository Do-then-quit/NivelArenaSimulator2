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
                <button id="start-game-btn" data-testid="menu-quick-play-btn" class="primary-btn">빠른 대전 (ST01 미러전)</button>
                <button id="start-vs-bot-btn" data-testid="menu-quick-play-bot-btn" class="primary-btn">빠른 대전 vs 베이스라인 봇</button>
                <button id="custom-sim-btn" data-testid="menu-custom-sim-btn" class="primary-btn">커스텀 시뮬레이션 (PvP)</button>
                <button id="custom-vs-bot-btn" data-testid="menu-custom-vs-bot-btn" class="primary-btn">커스텀 시뮬레이션 vs 베이스라인 봇</button>
                <button id="online-room-btn" data-testid="menu-online-room-btn" class="primary-btn">온라인 대전 (룸 코드)</button>
                <button id="bot-replay-btn" data-testid="menu-bot-replay-btn" class="primary-btn">봇 vs 봇 리플레이</button>
                <button id="deck-builder-btn" data-testid="menu-deck-builder-btn" class="secondary-btn">덱 빌더</button>
                <button id="card-test-btn" data-testid="menu-card-test-btn" class="secondary-btn" style="margin-top: 10px; background: #6c5ce7;">카드 로직 검증</button>
            </div>
        </div>
    `;

    document.getElementById('start-game-btn')?.addEventListener('click', () => {
        const seed = Date.now();
        const { deck1, deck2, leader1, leader2 } = createQuickPlayLoadout(seed);
        uiState.startGame?.(deck1, deck2, leader1, leader2);
    });

    document.getElementById('start-vs-bot-btn')?.addEventListener('click', () => {
        const seed = Date.now();
        const { deck1, deck2, leader1, leader2 } = createQuickPlayLoadout(seed);
        const revealBotHand = window.confirm('베이스라인 봇의 패를 공개할까요?\n\n확인: 공개\n취소: 비공개');
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
            : '봇';
        title.textContent = uiState.pendingSetupConfig.player2Control === 'BOT'
            ? `시뮬레이션 설정 (vs ${p2BotLabel})`
            : '시뮬레이션 설정';
    }

    const playerHeaders = uiState.app.querySelectorAll('.player-setup h3');
    const p2Header = playerHeaders.item(1) as HTMLElement | null;
    if (p2Header) {
        const p2BotLabel = uiState.pendingSetupConfig.player2BotId
            ? getBotModelLabel(uiState.pendingSetupConfig.player2BotId)
            : '봇';
        p2Header.textContent = uiState.pendingSetupConfig.player2Control === 'BOT'
            ? `플레이어 2 (${p2BotLabel})`
            : '플레이어 2';
    }
}
