import { GameEngine } from '../logic/GameEngine';
import { PlayerState } from '../logic/types';
import { uiState } from './appState';

export type UiPlayerRef = 'current' | 'opponent';

function getOnlineLocalPlayerId(): string | null {
    if (uiState.onlineSession.room?.phase !== 'IN_GAME') return null;
    return uiState.onlineSession.localEnginePlayerId;
}

export function getBottomPlayer(engine: GameEngine): PlayerState {
    const localPlayerId = getOnlineLocalPlayerId();
    if (!localPlayerId) return engine.currentPlayer;
    return engine.state.players.find(player => player.id === localPlayerId) ?? engine.currentPlayer;
}

export function getTopPlayer(engine: GameEngine): PlayerState {
    const bottomPlayer = getBottomPlayer(engine);
    return engine.state.players.find(player => player.id !== bottomPlayer.id) ?? engine.opponentPlayer;
}

export function getUiPlayer(engine: GameEngine, ref: UiPlayerRef): PlayerState {
    return ref === 'current' ? getBottomPlayer(engine) : getTopPlayer(engine);
}

export function getUiPlayerRefForPlayerId(engine: GameEngine, playerId: string): UiPlayerRef {
    return getBottomPlayer(engine).id === playerId ? 'current' : 'opponent';
}
