import type { EngineAction } from '../logic/types';

export type OnlineRole = 'HOST' | 'GUEST';
export type PlayerSlot = 'P1' | 'P2';
export type RoomPhase = 'LOBBY' | 'IN_GAME';

export interface DeckSubmission {
    deckId: string | null;
    deckName: string;
    leaderId: string;
    cardIds: string[];
    revision: number;
}

export interface DeckSummary {
    deckName: string;
    leaderId: string;
    cardCount: number;
    valid: boolean;
    revision: number;
}

export interface RoomPlayerView {
    clientId: string;
    slot: PlayerSlot;
    name: string;
    connected: boolean;
    ready: boolean;
    deckSummary: DeckSummary | null;
}

export interface RoomView {
    roomCode: string;
    phase: RoomPhase;
    hostClientId: string;
    players: RoomPlayerView[];
    matchSessionId: string | null;
}

export interface OnlineSessionState {
    connected: boolean;
    room: RoomView | null;
    role: OnlineRole | null;
    localClientId: string | null;
    localSlot: PlayerSlot | null;
    localEnginePlayerId: string | null;
    pendingRequestId: string | null;
}

export type MatchEndReason = 'winner' | 'desync' | 'disconnect';

export type OnlineServerErrorCode =
    | 'ROOM_NOT_FOUND'
    | 'ROOM_FULL'
    | 'INVALID_ROOM_CODE'
    | 'MISSING_DECK'
    | 'DECK_INVALID'
    | 'NOT_IN_ROOM'
    | 'NOT_HOST'
    | 'INVALID_SESSION'
    | 'INVALID_ACTION'
    | 'INTERNAL_ERROR';

export type ClientToServerMessage =
    | { type: 'CREATE_ROOM'; playerName: string }
    | { type: 'JOIN_ROOM'; roomCode: string; playerName: string }
    | { type: 'LEAVE_ROOM' }
    | { type: 'UPDATE_DECK'; deck: DeckSubmission }
    | { type: 'SET_READY'; ready: boolean }
    | { type: 'GAME_INIT'; sessionId: string; seed: number; p1: DeckSubmission; p2: DeckSubmission; playerIdBySlot: Record<PlayerSlot, string> }
    | { type: 'ACTION_REQUEST'; sessionId: string; requestId: string; action: EngineAction }
    | { type: 'ACTION_COMMIT'; sessionId: string; seq: number; action: EngineAction; stateHash: string }
    | { type: 'MATCH_END'; sessionId: string; reason: MatchEndReason; winnerPlayerId?: string };

export type ServerToClientMessage =
    | { type: 'WELCOME'; clientId: string }
    | { type: 'ROOM_STATE'; room: RoomView }
    | { type: 'ROOM_ERROR'; code: OnlineServerErrorCode; message: string }
    | { type: 'MATCH_START_AUTH'; roomCode: string; p1: DeckSubmission; p2: DeckSubmission }
    | { type: 'GAME_INIT'; sessionId: string; seed: number; p1: DeckSubmission; p2: DeckSubmission; playerIdBySlot: Record<PlayerSlot, string> }
    | { type: 'ACTION_REQUEST_FORWARD'; sessionId: string; fromClientId: string; requestId: string; action: EngineAction }
    | { type: 'ACTION_COMMIT_BROADCAST'; sessionId: string; seq: number; action: EngineAction; stateHash: string }
    | { type: 'MATCH_ENDED'; sessionId: string; reason: MatchEndReason; winnerPlayerId?: string }
    | { type: 'ROOM_CLOSED'; reason: 'HOST_LEFT' };
