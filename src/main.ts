import './style.css';
import { GameEngine } from './logic/GameEngine';
import { Card } from './logic/types';
import {
    createBotForModel,
    getBotModelLabel,
} from './logic/ai/BotRegistry';
import { DebugManager } from './logic/DebugManager';
import {
    HUMAN_VS_HUMAN_CONFIG,
    MatchControlConfig,
    MatchViewConfig,
    Screen,
    uiState,
} from './ui/appState';
import {
    clearAutoPhaseAdvanceTimer,
    clearBotStepTimer,
    getDefaultViewConfig,
} from './ui/gameLoop';
import { handleGameHotkeys, handleVerificationHotkeys } from './ui/hotkeys';
import { applyPhaseThemeClass, renderGame } from './ui/screens/gameView';
import { renderMenu, renderDeckBuilder, renderSetup } from './ui/screens/menu';
import { renderOnlineRoom } from './ui/screens/onlineRoom';
import { renderBotReplaySetup } from './ui/screens/replaySetup';
import { clearPlaybackLogHistory, clearPlaybackRuntimeState, enqueuePlaybackBeats } from './ui/playbackOrchestrator';
import { resetCardMotionRegistry } from './ui/playbackMotion';

function startGame(
    deck1: Card[],
    deck2: Card[],
    leader1: Card,
    leader2: Card,
    controlConfig: MatchControlConfig = HUMAN_VS_HUMAN_CONFIG,
    viewConfig?: MatchViewConfig,
) {
    clearBotStepTimer();
    clearPlaybackRuntimeState();
    resetCardMotionRegistry();
    clearPlaybackLogHistory();
    uiState.gameLogFeed.clear();
    uiState.gameLogView.manualOverride = false;
    uiState.gameLogView.autoCollapsed = false;
    uiState.gameLogView.expanded = true;
    uiState.replaySession = null;
    uiState.verificationSession = null;
    uiState.verificationPanelCollapsed = false;
    uiState.mobileGameView.logSheetOpen = false;
    uiState.mobileGameView.selectedHandIndex = null;
    uiState.activeMatchConfig = controlConfig;
    uiState.activeMatchViewConfig = {
        ...getDefaultViewConfig(controlConfig),
        ...viewConfig,
    };
    uiState.playback.enabled = controlConfig.player1Control === 'HUMAN' || controlConfig.player2Control === 'HUMAN';
    uiState.playback.queueBusy = false;
    uiState.playback.modalGateUntilMs = 0;
    uiState.playback.toasts = [];
    uiState.playback.logEntries = [];
    uiState.playback.activePulseTargets = [];
    uiState.playback.activeMotionBeatId = null;
    uiState.playback.activeMotionPresentation = null;
    uiState.game = new GameEngine('Player 1', 'Player 2', deck1, deck2, leader1, leader2, {
        enableMulligan: true,
        enableUiTrace: uiState.playback.enabled,
    });
    uiState.game.drainUiTraceEvents();
    uiState.botByPlayerId.clear();
    uiState.botLabelByPlayerId.clear();
    const [player1, player2] = uiState.game.state.players;
    if (controlConfig.player1Control === 'BOT') {
        const botId = controlConfig.player1BotId ?? 'baseline';
        uiState.botByPlayerId.set(player1.id, createBotForModel(botId, `${getBotModelLabel(botId)}-P1`));
        uiState.botLabelByPlayerId.set(player1.id, getBotModelLabel(botId));
    }
    if (controlConfig.player2Control === 'BOT') {
        const botId = controlConfig.player2BotId ?? 'baseline';
        uiState.botByPlayerId.set(player2.id, createBotForModel(botId, `${getBotModelLabel(botId)}-P2`));
        uiState.botLabelByPlayerId.set(player2.id, getBotModelLabel(botId));
    }

    (window as any).debug = new DebugManager(uiState.game, render);
    uiState.currentScreen = Screen.GAME;
    uiState.gameLogFeed.pushUiLog(`새 매치 시작: ${controlConfig.label}`, 'SYSTEM');
    render();
}

function getVerificationOrderedTestIds(testId: string, orderedTestIds: string[]): string[] {
    const uniqueOrderedTestIds = Array.from(new Set(orderedTestIds.filter(Boolean)));
    if (uniqueOrderedTestIds.length === 0) {
        return [testId];
    }
    if (uniqueOrderedTestIds.includes(testId)) {
        return uniqueOrderedTestIds;
    }
    return [testId, ...uniqueOrderedTestIds];
}

function startVerificationScenario(testId: string, orderedTestIds: string[]) {
    const resolvedOrderedTestIds = getVerificationOrderedTestIds(testId, orderedTestIds);
    const currentIndex = resolvedOrderedTestIds.indexOf(testId);
    const { engine, instructions } = uiState.cardTester.setupScenario(testId);
    clearBotStepTimer();
    clearPlaybackRuntimeState();
    resetCardMotionRegistry();
    clearPlaybackLogHistory();
    uiState.gameLogFeed.clear();
    uiState.gameLogView.manualOverride = false;
    uiState.gameLogView.autoCollapsed = false;
    uiState.gameLogView.expanded = true;
    uiState.botByPlayerId.clear();
    uiState.botLabelByPlayerId.clear();
    uiState.replaySession = null;
    uiState.activeMatchConfig = HUMAN_VS_HUMAN_CONFIG;
    uiState.activeMatchViewConfig = getDefaultViewConfig(HUMAN_VS_HUMAN_CONFIG);
    uiState.playback.enabled = false;
    uiState.playback.queueBusy = false;
    uiState.playback.modalGateUntilMs = 0;
    uiState.playback.toasts = [];
    uiState.playback.logEntries = [];
    uiState.playback.activePulseTargets = [];
    uiState.playback.activeMotionBeatId = null;
    uiState.playback.activeMotionPresentation = null;
    uiState.game = engine;
    uiState.verificationPanelCollapsed = false;
    uiState.mobileGameView.logSheetOpen = false;
    uiState.mobileGameView.selectedHandIndex = null;
    uiState.verificationSession = {
        orderedTestIds: resolvedOrderedTestIds,
        currentIndex,
        currentTestId: testId,
        currentInstructions: instructions || 'No instructions provided.',
    };
    (window as any).debug = new DebugManager(uiState.game, render);
    uiState.currentScreen = Screen.GAME;
    uiState.gameLogFeed.pushUiLog(`검증 시나리오 시작: ${testId}`, 'SYSTEM');
    render();
}

function goToNextVerificationTest() {
    if (!uiState.verificationSession) return;
    const nextIndex = uiState.verificationSession.currentIndex + 1;
    if (nextIndex >= uiState.verificationSession.orderedTestIds.length) return;
    const nextTestId = uiState.verificationSession.orderedTestIds[nextIndex];
    startVerificationScenario(nextTestId, uiState.verificationSession.orderedTestIds);
}

function returnToVerificationScreen() {
    if (!uiState.verificationSession) return;
    uiState.currentScreen = Screen.TEST;
    render();
}

function renderTestScreen() {
    const packs = uiState.cardTester.getAvailablePacks();
    const allPacksSelected = packs.length > 0 && packs.every(pack => uiState.selectedPacks.has(pack));

    uiState.app.innerHTML = `
        <div class="test-screen" style="padding: 20px; color: white; max-width: 800px; margin: 0 auto;">
            <h1>Card Logic Verification</h1>

            <div style="background: rgba(255, 255, 255, 0.1); padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px;">
                    <h3 style="margin: 0;">Select Packs to Test</h3>
                    <button id="toggle-pack-selection-btn" class="secondary-btn" style="padding: 6px 10px; font-size: 0.85rem;">
                        ${allPacksSelected ? 'Deselect All' : 'Select All'}
                    </button>
                </div>
                <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                    ${packs.map(pack => `
                        <label style="display: flex; align-items: center; gap: 5px; cursor: pointer; background: rgba(0,0,0,0.3); padding: 5px 10px; border-radius: 4px;">
                            <input type="checkbox" class="pack-filter-checkbox" value="${pack}" ${uiState.selectedPacks.has(pack) ? 'checked' : ''} style="cursor: pointer;">
                            <span>${pack}</span>
                        </label>
                    `).join('')}
                </div>
            </div>

            <div style="display: flex; gap: 10px; margin-bottom: 20px;">
                <button id="back-menu-btn" class="secondary-btn">Back to Menu</button>
                <button id="run-selected-tests-btn" class="primary-btn" ${uiState.testRunning ? 'disabled' : ''}>
                    ${uiState.testRunning ? 'Running Tests...' : 'Run Selected Tests'}
                </button>
            </div>

            <div id="test-results" style="margin-top: 20px;">
                ${uiState.testResults.length === 0 ? '<p>No tests run yet. Select packs and click "Run Selected Tests".</p>' : ''}
                ${uiState.testResults.map(r => `
                    <div class="test-result ${r.success ? 'pass' : 'fail'}" style="margin-bottom: 10px; padding: 10px; border-left: 5px solid ${r.success ? '#00b894' : '#d63031'}; background: rgba(0,0,0,0.3); border-radius: 4px;">
                        <div style="display:flex; justify-content:space-between; align-items: center; font-weight:bold;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <span style="font-size: 1.1em;">${r.testId}</span>
                                <button class="play-test-btn small-btn" data-testid="${r.testId}" style="font-size: 0.8rem; padding: 2px 8px; background: #0984e3; border: none; border-radius: 4px; color: white; cursor: pointer;">Play</button>
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
        uiState.currentScreen = Screen.MENU;
        render();
    });

    document.getElementById('toggle-pack-selection-btn')?.addEventListener('click', () => {
        if (allPacksSelected) {
            uiState.selectedPacks.clear();
        } else {
            packs.forEach(pack => uiState.selectedPacks.add(pack));
        }
        render();
    });

    document.querySelectorAll('.pack-filter-checkbox').forEach(box => {
        box.addEventListener('change', (e) => {
            const target = e.target as HTMLInputElement;
            if (target.checked) {
                uiState.selectedPacks.add(target.value);
            } else {
                uiState.selectedPacks.delete(target.value);
            }
        });
    });

    document.getElementById('run-selected-tests-btn')?.addEventListener('click', async () => {
        if (uiState.testRunning) return;
        if (uiState.selectedPacks.size === 0) {
            alert('Please select at least one pack.');
            return;
        }

        uiState.testRunning = true;
        uiState.testResults = [];
        render();

        const cardsToTest: string[] = [];
        uiState.selectedPacks.forEach(packId => {
            const tests = uiState.cardTester.getTestsForPack(packId);
            cardsToTest.push(...tests);
        });

        for (const id of cardsToTest) {
            const result = await uiState.cardTester.runTest(id);
            uiState.testResults.push(result);
            render();
            await new Promise(r => setTimeout(r, 50));
        }

        uiState.testRunning = false;
        render();
    });

    document.querySelectorAll('.play-test-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const testId = (e.target as HTMLElement).dataset.testid!;
            const orderedTestIds = uiState.testResults.map((result: { testId: string }) => result.testId);
            startVerificationScenario(testId, orderedTestIds);
        });
    });
}

function render() {
    uiState.hoverPreview.hide();
    uiState.trashHoverOverlay?.hide();
    document.body.classList.toggle('game-screen', uiState.currentScreen === Screen.GAME);
    document.body.classList.toggle('deck-builder-screen', uiState.currentScreen === Screen.DECK_BUILDER);

    if (uiState.currentScreen === Screen.GAME && uiState.game) {
        uiState.gameLogFeed.startConsoleCapture(() => (
            uiState.currentScreen === Screen.GAME ? uiState.game : null
        ));
    } else {
        uiState.gameLogFeed.stopConsoleCapture();
    }

    if (uiState.currentScreen !== Screen.GAME) {
        clearBotStepTimer();
        clearAutoPhaseAdvanceTimer();
        clearPlaybackRuntimeState();
        applyPhaseThemeClass(null);
        uiState.mobileGameView.logSheetOpen = false;
        uiState.mobileGameView.selectedHandIndex = null;
    }

    if (uiState.currentScreen === Screen.MENU) {
        renderMenu();
    } else if (uiState.currentScreen === Screen.DECK_BUILDER) {
        renderDeckBuilder();
    } else if (uiState.currentScreen === Screen.SETUP) {
        renderSetup();
    } else if (uiState.currentScreen === Screen.ONLINE_ROOM) {
        renderOnlineRoom();
    } else if (uiState.currentScreen === Screen.BOT_REPLAY_SETUP) {
        renderBotReplaySetup();
    } else if (uiState.currentScreen === Screen.GAME && uiState.game) {
        renderGame();
    } else if (uiState.currentScreen === Screen.TEST) {
        renderTestScreen();
    }
}

uiState.render = render;
uiState.startGame = startGame;
uiState.startVerificationScenario = startVerificationScenario;
uiState.goToNextVerificationTest = goToNextVerificationTest;
uiState.returnToVerificationScreen = returnToVerificationScreen;

(window as any).__NA_TEST__ = {
    uiState,
    Screen,
    render,
    startGame,
    startVerificationScenario,
    enqueuePlaybackBeats,
};

window.addEventListener('keydown', handleVerificationHotkeys);
window.addEventListener('keydown', handleGameHotkeys);

render();
