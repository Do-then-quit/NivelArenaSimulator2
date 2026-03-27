import { setupUiDom } from './ui_click_harness';

export interface RenderGameViewOptions {
    gameLogExpanded?: boolean;
    manualOverride?: boolean;
    autoCollapsed?: boolean;
}

export async function renderGameViewWithMockGame(game: any, options: RenderGameViewOptions = {}) {
    setupUiDom();

    const { uiState, Screen } = await import('../../../src/ui/appState');
    const { renderGame } = await import('../../../src/ui/screens/gameView');

    uiState.currentScreen = Screen.GAME;
    uiState.game = game;
    uiState.replaySession = null;
    uiState.verificationSession = null;
    uiState.onlineSession.room = null;
    uiState.onlineSession.role = null;
    uiState.onlineSession.localEnginePlayerId = null;
    uiState.onlineSession.localSlot = null;
    uiState.botByPlayerId.clear();
    uiState.botLabelByPlayerId.clear();
    uiState.playback.enabled = false;
    uiState.playback.queueBusy = false;
    uiState.playback.modalGateUntilMs = 0;
    uiState.playback.toasts = [];
    uiState.playback.activePulseTargets = [];
    uiState.gameLogView.manualOverride = options.manualOverride ?? true;
    uiState.gameLogView.expanded = options.gameLogExpanded ?? true;
    uiState.gameLogView.autoCollapsed = options.autoCollapsed ?? false;
    uiState.render = () => {
        renderGame();
    };

    renderGame();

    return {
        uiState,
        renderGame,
    };
}
