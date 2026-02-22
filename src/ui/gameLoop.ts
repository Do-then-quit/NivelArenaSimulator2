import { GameEngine } from '../logic/GameEngine';
import { canAutoAdvancePhase } from '../logic/AutoPhaseAdvance';
import { uiState, MatchControlConfig, MatchViewConfig, Screen } from './appState';
import { EngineAction } from '../logic/types';

function formatActionForLog(action: EngineAction): string {
    switch (action.type) {
        case 'PLAY_UNIT':
            return `PLAY_UNIT(h:${action.handIndex}, z:${action.zoneIndex})`;
        case 'PLAY_ITEM':
            return `PLAY_ITEM(h:${action.handIndex}, z:${action.zoneIndex})`;
        case 'PLAY_SKILL':
            return `PLAY_SKILL(h:${action.handIndex})`;
        case 'ACTIVATE_EFFECT':
            return `ACTIVATE_EFFECT(z:${action.zoneIndex}, e:${action.effectIndex})`;
        case 'ATTACK':
            return `ATTACK(z:${action.attackerZoneIndex})`;
        case 'RESOLVE_BLOCK':
            return `RESOLVE_BLOCK(${action.shouldBlock ? 'Y' : 'N'})`;
        case 'RESOLVE_MULLIGAN':
            return `RESOLVE_MULLIGAN(${action.shouldMulligan ? 'Y' : 'N'})`;
        case 'SELECT_COST_HAND':
            return `SELECT_COST_HAND(h:${action.handIndex})`;
        case 'RESOLVE_OPTIONAL':
            return `RESOLVE_OPTIONAL(${action.confirm ? 'Y' : 'N'})`;
        case 'SELECT_ZONE_TARGET':
            return `SELECT_ZONE_TARGET(${action.targetPlayerId}, z:${action.zoneIndex})`;
        case 'SELECT_HAND_TARGET':
            return `SELECT_HAND_TARGET(${action.targetPlayerId}, h:${action.handIndex})`;
        case 'SELECT_TRASH_TARGET':
            return `SELECT_TRASH_TARGET(${action.targetPlayerId}, t:${action.trashIndex})`;
        case 'SELECT_DAMAGE_TARGET':
            return `SELECT_DAMAGE_TARGET(${action.targetPlayerId}, d:${action.damageIndex})`;
        case 'SELECT_ITEM_TARGET':
            return `SELECT_ITEM_TARGET(${action.targetPlayerId}, z:${action.zoneIndex}, i:${action.itemIndex})`;
        case 'SELECT_REVEALED_TARGET':
            return `SELECT_REVEALED_TARGET(r:${action.revealedIndex})`;
        case 'CONFIRM_TARGETS':
            return 'CONFIRM_TARGETS';
        case 'NEXT_PHASE':
            return 'NEXT_PHASE';
    }
}

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
        uiState.gameLogFeed.pushUiLog(`[Bot] no legal action for actor ${actorId}`, 'SYSTEM', 'WARN');
        return;
    }

    const actor = uiState.game.state.players.find(player => player.id === actorId);
    const ok = uiState.game.step(action);
    if (!ok) {
        console.warn(`[Bot] Invalid action from actor ${actorId}: ${JSON.stringify(action)}`);
        uiState.gameLogFeed.pushUiLog(
            `[Bot] invalid action ${formatActionForLog(action)} by ${actor?.name ?? actorId}`,
            'SYSTEM',
            'WARN',
        );
        return;
    }

    uiState.gameLogFeed.pushUiLog(
        `[Bot] ${actor?.name ?? actorId}: ${formatActionForLog(action)}`,
        'ACTION',
    );
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
        const beforePhase = uiState.game.state.phase;
        uiState.game.nextPhase();
        const afterPhase = uiState.game.state.phase;
        uiState.gameLogFeed.pushUiLog(
            `[Auto] NEXT_PHASE: ${beforePhase} -> ${afterPhase}`,
            'ACTION',
        );
        uiState.render?.();
    }, delayMs);
}
