import { DUMMY_CARDS } from '../../../src/logic/CardDatabase';
import { GameEngine } from '../../../src/logic/GameEngine';
import { Card, PlayerState } from '../../../src/logic/types';

export function getCard(id: string): Card {
    const card = DUMMY_CARDS.find((entry) => entry.id === id);
    if (!card) {
        throw new Error(`Card not found: ${id}`);
    }
    return JSON.parse(JSON.stringify(card));
}

export function createEngine(seed: number = 20260303): GameEngine {
    const leader1 = getCard('ST01-001');
    const leader2 = getCard('ST01-001');
    const deck1 = Array.from({ length: 30 }, () => getCard('ST01-002'));
    const deck2 = Array.from({ length: 30 }, () => getCard('ST01-002'));

    return new GameEngine('P1', 'P2', deck1, deck2, leader1, leader2, {
        enableMulligan: false,
        seed,
    });
}

export function zonePower(engine: GameEngine, player: PlayerState, zoneIndex: number): number {
    const zone = player.unitZones[zoneIndex];
    if (!zone?.unit) return 0;
    return engine.getUnitPower(zone, player);
}

export function findAction<TAction = any>(
    engine: GameEngine,
    actorPlayerId: string,
    type: string,
    predicate?: (action: any) => boolean,
): TAction | undefined {
    return engine
        .getLegalActions(actorPlayerId)
        .find((action: any) => action.type === type && (!predicate || predicate(action))) as TAction | undefined;
}

export function setupUiDom(): void {
    document.body.innerHTML = '<div id="app"></div>';
    Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        writable: true,
        value: 1920,
    });
    Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        writable: true,
        value: 1080,
    });
}

export async function setupUiHarness(engine: GameEngine) {
    const { uiState, Screen } = await import('../../../src/ui/appState');
    const { renderGame } = await import('../../../src/ui/screens/gameView');

    uiState.currentScreen = Screen.GAME;
    uiState.game = engine;
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
    uiState.playback.logEntries = [];
    uiState.playback.activePulseTargets = [];
    uiState.gameLogView.manualOverride = true;
    uiState.gameLogView.expanded = true;
    uiState.gameLogView.autoCollapsed = false;

    uiState.render = () => {
        renderGame();
    };

    renderGame();

    return {
        uiState,
        renderGame,
    };
}

export function requireElement<T extends Element>(selector: string): T {
    const element = document.querySelector(selector) as T | null;
    if (!element) {
        throw new Error(`Element not found: ${selector}`);
    }
    return element;
}

export function clickConfirmTargets(): void {
    const button = (
        document.getElementById('confirm-targets-btn')
        ?? document.getElementById('confirm-targets-modal-btn')
    ) as HTMLButtonElement | null;
    if (!button) {
        throw new Error('Confirm targets button not found');
    }
    button.click();
}

export function clickOptional(confirm: boolean): void {
    const buttonId = confirm ? 'opt-confirm' : 'opt-skip';
    const button = document.getElementById(buttonId) as HTMLButtonElement | null;
    if (!button) {
        throw new Error(`Optional button not found: ${buttonId}`);
    }
    button.click();
}
