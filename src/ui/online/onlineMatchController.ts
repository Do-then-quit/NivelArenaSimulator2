import { DebugManager } from '../../logic/DebugManager';
import { Card, EngineAction } from '../../logic/types';
import { DUMMY_CARDS } from '../../logic/CardDatabase';
import { DeckPersistence } from '../../logic/DeckPersistence';
import { GameEngine } from '../../logic/GameEngine';
import {
    HUMAN_VS_HUMAN_CONFIG,
    Screen,
    uiState,
} from '../appState';
import { clearAutoPhaseAdvanceTimer, clearBotStepTimer } from '../gameLoop';
import { OnlineClient } from './OnlineClient';
import { computeStateHash } from './hash';
import {
    ClientToServerMessage,
    DeckSubmission,
    MatchEndReason,
    PlayerSlot,
    RoomView,
    ServerToClientMessage,
} from '../../shared/onlineProtocol';

const ONLINE_LABEL = 'ONLINE ROOM';

const cardById = new Map<string, Card>(DUMMY_CARDS.map(card => [card.id, card]));

let onlineClient: OnlineClient | null = null;
let pendingMessages: ClientToServerMessage[] = [];
let activeSessionId: string | null = null;
let nextCommitSeq = 0;
let lastAppliedCommitSeq = 0;
let currentPlayerIdBySlot: Record<PlayerSlot, string> | null = null;
let localDeckRevision = 0;
let localSelectedDeckId: string | null = null;

function getOnlineWsUrl(): string {
    const configured = (import.meta as any).env?.VITE_ONLINE_WS_URL as string | undefined;
    return configured || 'ws://localhost:8787';
}

function sanitizePlayerName(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) return 'Player';
    return trimmed.slice(0, 20);
}

function makeSessionId(): string {
    return `session_${Date.now().toString(36)}_${Math.floor(Math.random() * 1_000_000).toString(36)}`;
}

function makeRequestId(): string {
    return `req_${Date.now().toString(36)}_${Math.floor(Math.random() * 1_000_000).toString(36)}`;
}

function toMatchControlLabel() {
    return {
        ...HUMAN_VS_HUMAN_CONFIG,
        label: ONLINE_LABEL,
    };
}

function connectClientIfNeeded(): OnlineClient {
    if (onlineClient) {
        onlineClient.connect();
        return onlineClient;
    }

    const client = new OnlineClient(getOnlineWsUrl());
    onlineClient = client;

    client.onOpen(() => {
        uiState.onlineSession.connected = true;
        flushPendingMessages();
        uiState.render?.();
    });

    client.onClose(() => {
        uiState.onlineSession.connected = false;
        uiState.render?.();
    });

    client.onError((error) => {
        uiState.gameLogFeed.pushUiLog(`[Online] ${error}`, 'SYSTEM', 'WARN');
        uiState.render?.();
    });

    client.onMessage((message) => {
        handleServerMessage(message);
    });

    client.connect();
    return client;
}

function resetMatchRuntimeState() {
    activeSessionId = null;
    nextCommitSeq = 0;
    lastAppliedCommitSeq = 0;
    currentPlayerIdBySlot = null;
    uiState.onlineSession.localEnginePlayerId = null;
    uiState.onlineSession.pendingRequestId = null;
}

function resetOnlineState(): void {
    resetMatchRuntimeState();
    uiState.onlineSession.room = null;
    uiState.onlineSession.role = null;
    uiState.onlineSession.localClientId = null;
    uiState.onlineSession.localSlot = null;
    localDeckRevision = 0;
    localSelectedDeckId = null;
}

function queueOrSend(message: ClientToServerMessage): void {
    const client = connectClientIfNeeded();
    if (!client.send(message)) {
        pendingMessages.push(message);
    }
}

function flushPendingMessages(): void {
    if (!onlineClient || !onlineClient.isConnected()) return;
    if (pendingMessages.length === 0) return;
    const queue = [...pendingMessages];
    pendingMessages = [];
    queue.forEach(message => {
        if (!onlineClient!.send(message)) {
            pendingMessages.push(message);
        }
    });
}

function isDeckSubmissionValid(deck: DeckSubmission): boolean {
    if (!deck.leaderId) return false;
    if (deck.cardIds.length !== 40) return false;
    return true;
}

function cloneCard(card: Card): Card {
    return JSON.parse(JSON.stringify(card));
}

function hydrateDeckSubmission(deck: DeckSubmission): { deckCards: Card[]; leader: Card } | null {
    if (!isDeckSubmissionValid(deck)) return null;
    const leaderTemplate = cardById.get(deck.leaderId);
    if (!leaderTemplate) return null;

    const deckCards: Card[] = [];
    for (const cardId of deck.cardIds) {
        const template = cardById.get(cardId);
        if (!template) return null;
        deckCards.push(cloneCard(template));
    }

    return {
        deckCards,
        leader: cloneCard(leaderTemplate),
    };
}

function replaceMappedId(value: string | null, from: Map<string, string>): string | null {
    if (!value) return value;
    return from.get(value) ?? value;
}

function remapRecordKeys<T>(record: Record<string, T>, from: Map<string, string>): Record<string, T> {
    const next: Record<string, T> = {};
    Object.entries(record).forEach(([key, value]) => {
        const mapped = from.get(key) ?? key;
        next[mapped] = value;
    });
    return next;
}

function normalizeEnginePlayerIds(engine: GameEngine, playerIdBySlot: Record<PlayerSlot, string>): void {
    const oldP1Id = engine.state.players[0].id;
    const oldP2Id = engine.state.players[1].id;
    const replacements = new Map<string, string>([
        [oldP1Id, playerIdBySlot.P1],
        [oldP2Id, playerIdBySlot.P2],
    ]);

    engine.state.players[0].id = playerIdBySlot.P1;
    engine.state.players[1].id = playerIdBySlot.P2;

    engine.state.interactionOwnerPlayerId = replaceMappedId(engine.state.interactionOwnerPlayerId, replacements);
    engine.state.winner = replaceMappedId(engine.state.winner, replacements);

    if (engine.state.mulliganState) {
        engine.state.mulliganState.pendingPlayerIds = engine.state.mulliganState.pendingPlayerIds
            .map(playerId => replacements.get(playerId) ?? playerId);
        engine.state.mulliganState.completedPlayerIds = engine.state.mulliganState.completedPlayerIds
            .map(playerId => replacements.get(playerId) ?? playerId);
    }

    engine.state.mulliganResultByPlayerId = remapRecordKeys(engine.state.mulliganResultByPlayerId, replacements);

    if (engine.state.pendingEffect) {
        engine.state.pendingEffect.sourcePlayerId = replacements.get(engine.state.pendingEffect.sourcePlayerId)
            ?? engine.state.pendingEffect.sourcePlayerId;
        if (engine.state.pendingEffect.controllerPlayerId) {
            engine.state.pendingEffect.controllerPlayerId = replacements.get(engine.state.pendingEffect.controllerPlayerId)
                ?? engine.state.pendingEffect.controllerPlayerId;
        }
    }

    if (engine.state.turnStats) {
        engine.state.turnStats.effectTrashedFriendlyUnitCountByPlayerId = remapRecordKeys(
            engine.state.turnStats.effectTrashedFriendlyUnitCountByPlayerId,
            replacements,
        );
        engine.state.turnStats.handTrashedByEffectCountByPlayerId = remapRecordKeys(
            engine.state.turnStats.handTrashedByEffectCountByPlayerId,
            replacements,
        );
        engine.state.turnStats.unitAttackCountByPlayerId = remapRecordKeys(
            engine.state.turnStats.unitAttackCountByPlayerId,
            replacements,
        );
    }

    engine.state.effectQueue.forEach(item => {
        item.sourcePlayerId = replacements.get(item.sourcePlayerId) ?? item.sourcePlayerId;
        item.context.player.id = replacements.get(item.context.player.id) ?? item.context.player.id;
        item.context.opponent.id = replacements.get(item.context.opponent.id) ?? item.context.opponent.id;
    });
    engine.state.deferredEffectQueue.forEach(item => {
        item.sourcePlayerId = replacements.get(item.sourcePlayerId) ?? item.sourcePlayerId;
        item.context.player.id = replacements.get(item.context.player.id) ?? item.context.player.id;
        item.context.opponent.id = replacements.get(item.context.opponent.id) ?? item.context.opponent.id;
    });
}

function setupLocalOnlineGame(
    sessionId: string,
    seed: number,
    p1Deck: DeckSubmission,
    p2Deck: DeckSubmission,
    playerIdBySlot: Record<PlayerSlot, string>,
): boolean {
    const p1Hydrated = hydrateDeckSubmission(p1Deck);
    const p2Hydrated = hydrateDeckSubmission(p2Deck);
    if (!p1Hydrated || !p2Hydrated) return false;

    clearBotStepTimer();
    clearAutoPhaseAdvanceTimer();
    uiState.gameLogFeed.clear();
    uiState.replaySession = null;
    uiState.verificationSession = null;
    uiState.botByPlayerId.clear();
    uiState.botLabelByPlayerId.clear();
    uiState.activeMatchConfig = toMatchControlLabel();
    uiState.activeMatchViewConfig = { revealBotHand: false };

    const engine = new GameEngine(
        'Player 1',
        'Player 2',
        p1Hydrated.deckCards,
        p2Hydrated.deckCards,
        p1Hydrated.leader,
        p2Hydrated.leader,
        {
            seed,
            enableMulligan: true,
        },
    );

    normalizeEnginePlayerIds(engine, playerIdBySlot);
    uiState.game = engine;
    (window as any).debug = new DebugManager(engine, uiState.render ?? (() => {}));

    activeSessionId = sessionId;
    nextCommitSeq = 0;
    lastAppliedCommitSeq = 0;
    currentPlayerIdBySlot = playerIdBySlot;

    const localSlot = uiState.onlineSession.localSlot;
    uiState.onlineSession.localEnginePlayerId = localSlot ? playerIdBySlot[localSlot] : null;
    uiState.onlineSession.pendingRequestId = null;
    uiState.currentScreen = Screen.GAME;
    uiState.gameLogFeed.pushUiLog(`[Online] Match started (${sessionId})`, 'SYSTEM');
    uiState.render?.();
    return true;
}

function getRoomPlayerSlot(clientId: string, room: RoomView): PlayerSlot | null {
    const player = room.players.find(item => item.clientId === clientId);
    return player?.slot ?? null;
}

function isSameAction(a: EngineAction, b: EngineAction): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
}

function getExpectedActorIdForClient(clientId: string): string | null {
    const room = uiState.onlineSession.room;
    if (!room || !currentPlayerIdBySlot) return null;
    const slot = getRoomPlayerSlot(clientId, room);
    if (!slot) return null;
    return currentPlayerIdBySlot[slot];
}

function validateActionWithLegalList(action: EngineAction): boolean {
    if (!uiState.game) return false;
    const legalActions = uiState.game.getLegalActions(action.actorPlayerId);
    return legalActions.some(legal => isSameAction(legal, action));
}

function sendMatchEnd(reason: MatchEndReason, winnerPlayerId?: string): void {
    if (!activeSessionId) return;
    queueOrSend({
        type: 'MATCH_END',
        sessionId: activeSessionId,
        reason,
        winnerPlayerId,
    });
}

function applyCommitBroadcast(
    sessionId: string,
    seq: number,
    action: EngineAction,
    stateHash: string,
): void {
    if (!uiState.game || !activeSessionId || sessionId !== activeSessionId) return;
    if (seq <= lastAppliedCommitSeq) return;

    if (seq !== lastAppliedCommitSeq + 1) {
        uiState.gameLogFeed.pushUiLog('[Online] Commit sequence mismatch. Declaring desync.', 'SYSTEM', 'WARN');
        sendMatchEnd('desync');
        uiState.render?.();
        return;
    }

    const role = uiState.onlineSession.role;
    if (role === 'HOST') {
        // Host already applied locally before broadcasting commit.
        lastAppliedCommitSeq = seq;
        uiState.onlineSession.pendingRequestId = null;
        uiState.render?.();
        return;
    }

    const ok = uiState.game.step(action);
    if (!ok) {
        uiState.gameLogFeed.pushUiLog('[Online] Failed to apply commit action. Declaring desync.', 'SYSTEM', 'WARN');
        sendMatchEnd('desync');
        uiState.render?.();
        return;
    }

    const localHash = computeStateHash(uiState.game);
    if (localHash !== stateHash) {
        uiState.gameLogFeed.pushUiLog(
            `[Online] State hash mismatch (${localHash} != ${stateHash}). Declaring desync.`,
            'SYSTEM',
            'WARN',
        );
        sendMatchEnd('desync');
        uiState.render?.();
        return;
    }

    lastAppliedCommitSeq = seq;
    uiState.onlineSession.pendingRequestId = null;
    uiState.render?.();
}

function commitHostAction(action: EngineAction): boolean {
    if (!uiState.game || !activeSessionId) return false;
    if (!validateActionWithLegalList(action)) return false;

    const ok = uiState.game.step(action);
    if (!ok) return false;

    nextCommitSeq += 1;
    lastAppliedCommitSeq = nextCommitSeq;
    const stateHash = computeStateHash(uiState.game);

    queueOrSend({
        type: 'ACTION_COMMIT',
        sessionId: activeSessionId,
        seq: nextCommitSeq,
        action,
        stateHash,
    });

    if (uiState.game.state.winner) {
        sendMatchEnd('winner', uiState.game.state.winner);
    }

    uiState.render?.();
    return true;
}

function handleRoomState(room: RoomView): void {
    uiState.onlineSession.room = room;

    const localClientId = uiState.onlineSession.localClientId;
    if (localClientId) {
        const localPlayer = room.players.find(player => player.clientId === localClientId) ?? null;
        uiState.onlineSession.localSlot = localPlayer?.slot ?? null;
    }

    uiState.render?.();
}

function routeToOnlineLobby(message: string): void {
    clearBotStepTimer();
    clearAutoPhaseAdvanceTimer();
    if (uiState.onlineSession.room) {
        uiState.onlineSession.room.phase = 'LOBBY';
        uiState.onlineSession.room.matchSessionId = null;
        uiState.onlineSession.room.players = uiState.onlineSession.room.players.map(player => ({
            ...player,
            ready: false,
        }));
    }
    uiState.game = null;
    uiState.replaySession = null;
    uiState.verificationSession = null;
    resetMatchRuntimeState();
    uiState.currentScreen = Screen.ONLINE_ROOM;
    uiState.gameLogFeed.pushUiLog(`[Online] ${message}`, 'SYSTEM');
    uiState.render?.();
}

function handleServerMessage(message: ServerToClientMessage): void {
    switch (message.type) {
        case 'WELCOME':
            uiState.onlineSession.localClientId = message.clientId;
            uiState.render?.();
            return;
        case 'ROOM_STATE':
            handleRoomState(message.room);
            return;
        case 'ROOM_ERROR':
            uiState.gameLogFeed.pushUiLog(`[Online] ${message.code}: ${message.message}`, 'SYSTEM', 'WARN');
            uiState.render?.();
            return;
        case 'ROOM_CLOSED':
            routeToOnlineLobby('Host left. Room closed.');
            resetOnlineState();
            return;
        case 'MATCH_START_AUTH': {
            if (uiState.onlineSession.role !== 'HOST') return;
            const sessionId = makeSessionId();
            const seed = Date.now() & 0x7fffffff;

            const p1 = hydrateDeckSubmission(message.p1);
            const p2 = hydrateDeckSubmission(message.p2);
            if (!p1 || !p2) {
                uiState.gameLogFeed.pushUiLog('[Online] Failed to hydrate decks for match start.', 'SYSTEM', 'WARN');
                return;
            }

            const engine = new GameEngine('Player 1', 'Player 2', p1.deckCards, p2.deckCards, p1.leader, p2.leader, {
                seed,
                enableMulligan: true,
            });

            const playerIdBySlot: Record<PlayerSlot, string> = {
                P1: engine.state.players[0].id,
                P2: engine.state.players[1].id,
            };

            queueOrSend({
                type: 'GAME_INIT',
                sessionId,
                seed,
                p1: message.p1,
                p2: message.p2,
                playerIdBySlot,
            });
            return;
        }
        case 'GAME_INIT': {
            const started = setupLocalOnlineGame(
                message.sessionId,
                message.seed,
                message.p1,
                message.p2,
                message.playerIdBySlot,
            );
            if (!started) {
                uiState.gameLogFeed.pushUiLog('[Online] GAME_INIT failed (invalid deck payload).', 'SYSTEM', 'WARN');
            }
            return;
        }
        case 'ACTION_REQUEST_FORWARD': {
            if (uiState.onlineSession.role !== 'HOST') return;
            if (!uiState.game || !activeSessionId || message.sessionId !== activeSessionId) return;
            const expectedActorId = getExpectedActorIdForClient(message.fromClientId);
            if (!expectedActorId) return;
            const action = { ...message.action, actorPlayerId: expectedActorId } as EngineAction;
            commitHostAction(action);
            return;
        }
        case 'ACTION_COMMIT_BROADCAST':
            applyCommitBroadcast(message.sessionId, message.seq, message.action, message.stateHash);
            return;
        case 'MATCH_ENDED':
            // Keep the game-over modal on screen for winner results.
            // Players should explicitly click the result modal button to return to the lobby.
            if (message.reason === 'winner' && uiState.currentScreen === Screen.GAME && uiState.game?.state.winner) {
                uiState.gameLogFeed.pushUiLog('[Online] Match ended. Click "Back to Online Room" to continue.', 'SYSTEM');
                uiState.render?.();
                return;
            }
            routeToOnlineLobby(`Match ended (${message.reason}).`);
            return;
    }
}

function buildDeckSubmission(deckId: string): DeckSubmission | null {
    const saved = DeckPersistence.getDeck(deckId);
    if (!saved || !saved.leaderId) return null;
    return {
        deckId: saved.id,
        deckName: saved.name,
        leaderId: saved.leaderId,
        cardIds: [...saved.cardIds],
        revision: localDeckRevision,
    };
}

export function ensureOnlineClient(): void {
    connectClientIfNeeded();
}

export function createRoom(playerName: string): void {
    uiState.onlineSession.role = 'HOST';
    uiState.onlineSession.localSlot = null;
    uiState.onlineSession.room = null;
    queueOrSend({
        type: 'CREATE_ROOM',
        playerName: sanitizePlayerName(playerName),
    });
}

export function joinRoom(roomCode: string, playerName: string): void {
    uiState.onlineSession.role = 'GUEST';
    uiState.onlineSession.localSlot = null;
    uiState.onlineSession.room = null;
    queueOrSend({
        type: 'JOIN_ROOM',
        roomCode: roomCode.trim(),
        playerName: sanitizePlayerName(playerName),
    });
}

export function leaveRoomAndDisconnect(): void {
    if (onlineClient) {
        if (onlineClient.isConnected()) {
            onlineClient.send({ type: 'LEAVE_ROOM' });
        }
        onlineClient.disconnect();
        onlineClient = null;
    }
    pendingMessages = [];
    resetOnlineState();
}

export function submitDeckSelection(deckId: string): boolean {
    localDeckRevision += 1;
    localSelectedDeckId = deckId;
    const deck = buildDeckSubmission(deckId);
    if (!deck || !isDeckSubmissionValid(deck)) {
        return false;
    }
    queueOrSend({
        type: 'UPDATE_DECK',
        deck,
    });
    return true;
}

export function getLocalSelectedDeckId(): string | null {
    return localSelectedDeckId;
}

export function setReady(ready: boolean): void {
    queueOrSend({
        type: 'SET_READY',
        ready,
    });
}

export function isOnlineInGame(): boolean {
    return uiState.onlineSession.room?.phase === 'IN_GAME' && !!uiState.game && !!activeSessionId;
}

export function dispatchEngineAction(action: EngineAction): boolean {
    if (!uiState.game) return false;
    if (!isOnlineInGame()) {
        const ok = uiState.game.step(action);
        if (ok && uiState.game.state.winner && uiState.currentScreen === Screen.GAME && uiState.onlineSession.room) {
            routeToOnlineLobby('Match ended.');
        }
        return ok;
    }

    const role = uiState.onlineSession.role;
    if (!role || !activeSessionId) return false;

    if (role === 'HOST') {
        return commitHostAction(action);
    }

    const requestId = makeRequestId();
    uiState.onlineSession.pendingRequestId = requestId;
    queueOrSend({
        type: 'ACTION_REQUEST',
        sessionId: activeSessionId,
        requestId,
        action,
    });
    uiState.render?.();
    return true;
}

export function reportGameOverToServer(reason: MatchEndReason, winnerPlayerId?: string): void {
    if (!isOnlineInGame()) return;
    sendMatchEnd(reason, winnerPlayerId);
}
