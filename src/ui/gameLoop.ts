import { GameEngine } from '../logic/GameEngine';
import { canAutoAdvancePhase } from '../logic/AutoPhaseAdvance';
import { uiState, MatchControlConfig, MatchViewConfig, Screen } from './appState';

export function clearBotStepTimer() {
    if (uiState.botStepTimer !== null) {
        window.clearTimeout(uiState.botStepTimer);
        uiState.botStepTimer = null;
    }
}

export function clearAutoPhaseAdvanceTimer() {
    if (uiState.autoPhaseAdvanceTimer !== null) {
        window.clearTimeout(uiState.autoPhaseAdvanceTimer);
        uiState.autoPhaseAdvanceTimer = null;
    }
}

export function getActionOwnerPlayerId(engine: GameEngine): string {
    return engine.state.interactionOwnerPlayerId ?? engine.currentPlayer.id;
}

export function isBotControlledPlayer(playerId: string): boolean {
    if (uiState.replaySession?.playerBotModelById[playerId]) return true;
    return uiState.botByPlayerId.has(playerId);
}

export function hasBotPlayer(controlConfig: MatchControlConfig): boolean {
    return controlConfig.player1Control === 'BOT' || controlConfig.player2Control === 'BOT';
}

export function getDefaultViewConfig(controlConfig: MatchControlConfig): MatchViewConfig {
    return {
        revealBotHand: !hasBotPlayer(controlConfig),
    };
}

export function shouldRevealHandForPlayer(playerId: string): boolean {
    if (uiState.activeMatchViewConfig.revealBotHand) return true;
    return !isBotControlledPlayer(playerId);
}

export function canLocalHumanInput(): boolean {
    if (!uiState.game || uiState.game.state.winner) return false;
    if (uiState.replaySession) return false;
    const actorId = getActionOwnerPlayerId(uiState.game);
    return !isBotControlledPlayer(actorId);
}

export function shouldAutoAdvancePhase(engine: GameEngine): boolean {
    const actorId = getActionOwnerPlayerId(engine);
    const hasNextPhaseAction = engine.getLegalActions(actorId).some(action => action.type === 'NEXT_PHASE');

    return canAutoAdvancePhase({
        phase: engine.state.phase,
        interactionMode: engine.state.interactionMode,
        isLocalHumanInput: canLocalHumanInput(),
        hasNextPhaseAction,
    });
}

export function getBotLabelForPlayerId(playerId: string): string {
    if (uiState.replaySession?.playerBotLabelById[playerId]) {
        return uiState.replaySession.playerBotLabelById[playerId];
    }
    return uiState.botLabelByPlayerId.get(playerId) ?? 'Bot';
}

export function runBotStep() {
    if (!uiState.game || uiState.currentScreen !== Screen.GAME || uiState.game.state.winner || uiState.replaySession) return;

    const actorId = getActionOwnerPlayerId(uiState.game);
    const bot = uiState.botByPlayerId.get(actorId);
    if (!bot) return;

    const action = bot.chooseAction(uiState.game, actorId);
    if (!action) {
        console.warn(`[Bot] No legal action for actor: ${actorId}`);
        return;
    }

    const ok = uiState.game.step(action);
    if (!ok) {
        console.warn(`[Bot] Invalid action from actor ${actorId}: ${JSON.stringify(action)}`);
        return;
    }

    uiState.render?.();
}

export function scheduleBotStep(delayMs: number = 220) {
    clearBotStepTimer();

    if (!uiState.game || uiState.currentScreen !== Screen.GAME || uiState.game.state.winner || uiState.replaySession) return;
    const actorId = getActionOwnerPlayerId(uiState.game);
    if (!isBotControlledPlayer(actorId)) return;

    uiState.botStepTimer = window.setTimeout(() => {
        uiState.botStepTimer = null;
        runBotStep();
    }, delayMs);
}

export function scheduleAutoPhaseAdvance(delayMs: number = 80) {
    clearAutoPhaseAdvanceTimer();

    if (!uiState.game || uiState.currentScreen !== Screen.GAME || uiState.game.state.winner || uiState.replaySession) return;
    if (!shouldAutoAdvancePhase(uiState.game)) return;

    uiState.autoPhaseAdvanceTimer = window.setTimeout(() => {
        uiState.autoPhaseAdvanceTimer = null;
        if (!uiState.game || uiState.currentScreen !== Screen.GAME || uiState.game.state.winner || uiState.replaySession) return;
        if (!shouldAutoAdvancePhase(uiState.game)) return;
        uiState.game.nextPhase();
        uiState.render?.();
    }, delayMs);
}
