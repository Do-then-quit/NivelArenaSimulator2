import { WebSocketServer, WebSocket } from 'ws';
import { fileURLToPath } from 'node:url';
import {
    ClientToServerMessage,
    DeckSubmission,
    MatchEndReason,
    PlayerSlot,
    RoomPlayerView,
    RoomView,
    ServerToClientMessage,
} from '../src/shared/onlineProtocol';

interface ClientSession {
    id: string;
    socket: WebSocket;
    roomCode: string | null;
    playerName: string;
}

interface RoomPlayerState {
    clientId: string;
    socket: WebSocket;
    slot: PlayerSlot;
    name: string;
    connected: boolean;
    ready: boolean;
    deck: DeckSubmission | null;
}

interface RoomState {
    roomCode: string;
    hostClientId: string;
    phase: 'LOBBY' | 'IN_GAME';
    players: Map<string, RoomPlayerState>;
    matchSessionId: string | null;
}

const rooms = new Map<string, RoomState>();
const clients = new Map<WebSocket, ClientSession>();

function log(message: string) {
    const ts = new Date().toISOString();
    console.log(`[relay][${ts}] ${message}`);
}

function createId(prefix: string): string {
    return `${prefix}_${Date.now().toString(36)}_${Math.floor(Math.random() * 1_000_000).toString(36)}`;
}

function createRoomCode(): string {
    for (let i = 0; i < 1000; i++) {
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        if (!rooms.has(code)) return code;
    }
    throw new Error('Failed to allocate room code');
}

function send(socket: WebSocket, message: ServerToClientMessage): void {
    if (socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(message));
}

function getDeckSummary(deck: DeckSubmission | null) {
    if (!deck) return null;
    return {
        deckName: deck.deckName,
        leaderId: deck.leaderId,
        cardCount: deck.cardIds.length,
        valid: deck.cardIds.length === 40 && !!deck.leaderId,
        revision: deck.revision,
    };
}

function toRoomView(room: RoomState): RoomView {
    const players: RoomPlayerView[] = [...room.players.values()]
        .sort((a, b) => a.slot.localeCompare(b.slot))
        .map(player => ({
            clientId: player.clientId,
            slot: player.slot,
            name: player.name,
            connected: player.connected,
            ready: player.ready,
            deckSummary: getDeckSummary(player.deck),
        }));

    return {
        roomCode: room.roomCode,
        phase: room.phase,
        hostClientId: room.hostClientId,
        players,
        matchSessionId: room.matchSessionId,
    };
}

function broadcastRoom(room: RoomState, message: ServerToClientMessage): void {
    room.players.forEach(player => send(player.socket, message));
}

function broadcastRoomState(room: RoomState): void {
    broadcastRoom(room, { type: 'ROOM_STATE', room: toRoomView(room) });
}

function getRoomOfClient(client: ClientSession): RoomState | null {
    if (!client.roomCode) return null;
    return rooms.get(client.roomCode) ?? null;
}

function deckIsValid(deck: DeckSubmission | null): deck is DeckSubmission {
    if (!deck) return false;
    if (!deck.leaderId) return false;
    return deck.cardIds.length === 40;
}

function getPlayerBySlot(room: RoomState, slot: PlayerSlot): RoomPlayerState | null {
    for (const player of room.players.values()) {
        if (player.slot === slot) return player;
    }
    return null;
}

function maybeAuthorizeMatchStart(room: RoomState): void {
    if (room.phase !== 'LOBBY') return;
    if (room.players.size !== 2) return;
    const allReady = [...room.players.values()].every(player => player.ready && deckIsValid(player.deck));
    if (!allReady) return;

    const host = room.players.get(room.hostClientId);
    const p1 = getPlayerBySlot(room, 'P1');
    const p2 = getPlayerBySlot(room, 'P2');
    if (!host || !p1 || !p2 || !p1.deck || !p2.deck) return;

    send(host.socket, {
        type: 'MATCH_START_AUTH',
        roomCode: room.roomCode,
        p1: p1.deck,
        p2: p2.deck,
    });
    log(`match_start_auth room=${room.roomCode}`);
}

function finishMatch(room: RoomState, reason: MatchEndReason, winnerPlayerId?: string): void {
    const endedSessionId = room.matchSessionId ?? 'ended';
    room.phase = 'LOBBY';
    room.matchSessionId = null;
    room.players.forEach(player => {
        player.ready = false;
    });

    broadcastRoom(room, { type: 'MATCH_ENDED', sessionId: endedSessionId, reason, winnerPlayerId });
    broadcastRoomState(room);
    log(`match_end room=${room.roomCode} reason=${reason} winner=${winnerPlayerId ?? 'none'}`);
}

function destroyRoom(room: RoomState): void {
    rooms.delete(room.roomCode);
    log(`room_destroy room=${room.roomCode}`);
}

function removePlayerFromRoom(client: ClientSession, closeRoomIfHost: boolean): void {
    const room = getRoomOfClient(client);
    if (!room) {
        client.roomCode = null;
        return;
    }

    const wasHost = room.hostClientId === client.id;
    room.players.delete(client.id);
    client.roomCode = null;

    if (wasHost && closeRoomIfHost) {
        room.players.forEach(player => {
            send(player.socket, { type: 'ROOM_CLOSED', reason: 'HOST_LEFT' });
            const targetSession = clients.get(player.socket);
            if (targetSession) {
                targetSession.roomCode = null;
            }
        });
        destroyRoom(room);
        return;
    }

    if (room.players.size === 0) {
        destroyRoom(room);
        return;
    }

    if (room.phase === 'IN_GAME') {
        finishMatch(room, 'disconnect');
    }
    broadcastRoomState(room);
}

function createRoomForClient(client: ClientSession, playerName: string): void {
    removePlayerFromRoom(client, true);

    const roomCode = createRoomCode();
    const room: RoomState = {
        roomCode,
        hostClientId: client.id,
        phase: 'LOBBY',
        players: new Map(),
        matchSessionId: null,
    };

    const player: RoomPlayerState = {
        clientId: client.id,
        socket: client.socket,
        slot: 'P1',
        name: playerName,
        connected: true,
        ready: false,
        deck: null,
    };

    room.players.set(client.id, player);
    rooms.set(roomCode, room);
    client.roomCode = roomCode;
    client.playerName = playerName;

    broadcastRoomState(room);
    log(`room_create room=${roomCode} host=${client.id}`);
}

function joinRoomForClient(client: ClientSession, roomCodeRaw: string, playerName: string): void {
    const roomCode = roomCodeRaw.trim();
    if (!/^\d{6}$/.test(roomCode)) {
        send(client.socket, { type: 'ROOM_ERROR', code: 'INVALID_ROOM_CODE', message: 'Room code must be 6 digits.' });
        return;
    }

    const room = rooms.get(roomCode);
    if (!room) {
        send(client.socket, { type: 'ROOM_ERROR', code: 'ROOM_NOT_FOUND', message: 'Room not found.' });
        return;
    }

    if (room.players.size >= 2) {
        send(client.socket, { type: 'ROOM_ERROR', code: 'ROOM_FULL', message: 'Room is full.' });
        return;
    }

    removePlayerFromRoom(client, true);

    const player: RoomPlayerState = {
        clientId: client.id,
        socket: client.socket,
        slot: 'P2',
        name: playerName,
        connected: true,
        ready: false,
        deck: null,
    };

    room.players.set(client.id, player);
    client.roomCode = room.roomCode;
    client.playerName = playerName;
    broadcastRoomState(room);
    log(`room_join room=${room.roomCode} client=${client.id}`);
}

function handleDeckUpdate(client: ClientSession, deck: DeckSubmission): void {
    const room = getRoomOfClient(client);
    if (!room) {
        send(client.socket, { type: 'ROOM_ERROR', code: 'NOT_IN_ROOM', message: 'Not in room.' });
        return;
    }

    const player = room.players.get(client.id);
    if (!player) return;

    player.deck = deck;
    player.ready = false;
    broadcastRoomState(room);
}

function handleReady(client: ClientSession, ready: boolean): void {
    const room = getRoomOfClient(client);
    if (!room) {
        send(client.socket, { type: 'ROOM_ERROR', code: 'NOT_IN_ROOM', message: 'Not in room.' });
        return;
    }

    const player = room.players.get(client.id);
    if (!player) return;

    if (ready && !deckIsValid(player.deck)) {
        send(client.socket, { type: 'ROOM_ERROR', code: 'DECK_INVALID', message: 'Submit a valid deck first.' });
        return;
    }

    player.ready = ready;
    broadcastRoomState(room);
    maybeAuthorizeMatchStart(room);
}

function handleGameInit(client: ClientSession, message: Extract<ClientToServerMessage, { type: 'GAME_INIT' }>): void {
    const room = getRoomOfClient(client);
    if (!room) {
        send(client.socket, { type: 'ROOM_ERROR', code: 'NOT_IN_ROOM', message: 'Not in room.' });
        return;
    }
    if (room.hostClientId !== client.id) {
        send(client.socket, { type: 'ROOM_ERROR', code: 'NOT_HOST', message: 'Only host can initialize game.' });
        return;
    }

    const p1 = getPlayerBySlot(room, 'P1');
    const p2 = getPlayerBySlot(room, 'P2');
    if (!p1?.deck || !p2?.deck) {
        send(client.socket, { type: 'ROOM_ERROR', code: 'MISSING_DECK', message: 'Both players need decks.' });
        return;
    }

    room.phase = 'IN_GAME';
    room.matchSessionId = message.sessionId;

    broadcastRoom(room, {
        type: 'GAME_INIT',
        sessionId: message.sessionId,
        seed: message.seed,
        p1: message.p1,
        p2: message.p2,
        playerIdBySlot: message.playerIdBySlot,
    });
    broadcastRoomState(room);
    log(`game_init room=${room.roomCode} session=${message.sessionId}`);
}

function handleActionRequest(client: ClientSession, message: Extract<ClientToServerMessage, { type: 'ACTION_REQUEST' }>): void {
    const room = getRoomOfClient(client);
    if (!room || room.phase !== 'IN_GAME') return;
    if (room.matchSessionId !== message.sessionId) return;

    const host = room.players.get(room.hostClientId);
    if (!host) return;

    send(host.socket, {
        type: 'ACTION_REQUEST_FORWARD',
        sessionId: message.sessionId,
        fromClientId: client.id,
        requestId: message.requestId,
        action: message.action,
    });
}

function handleActionCommit(client: ClientSession, message: Extract<ClientToServerMessage, { type: 'ACTION_COMMIT' }>): void {
    const room = getRoomOfClient(client);
    if (!room || room.phase !== 'IN_GAME') return;
    if (room.hostClientId !== client.id) return;
    if (room.matchSessionId !== message.sessionId) return;

    broadcastRoom(room, {
        type: 'ACTION_COMMIT_BROADCAST',
        sessionId: message.sessionId,
        seq: message.seq,
        action: message.action,
        stateHash: message.stateHash,
    });
}

function handleMatchEnd(client: ClientSession, message: Extract<ClientToServerMessage, { type: 'MATCH_END' }>): void {
    const room = getRoomOfClient(client);
    if (!room) return;
    if (room.phase !== 'IN_GAME') return;
    if (room.matchSessionId !== message.sessionId) return;
    finishMatch(room, message.reason, message.winnerPlayerId);
}

function onMessage(socket: WebSocket, raw: WebSocket.RawData): void {
    const client = clients.get(socket);
    if (!client) return;

    let message: ClientToServerMessage;
    try {
        message = JSON.parse(String(raw)) as ClientToServerMessage;
    } catch (_error) {
        send(socket, { type: 'ROOM_ERROR', code: 'INTERNAL_ERROR', message: 'Invalid message format.' });
        return;
    }

    switch (message.type) {
        case 'CREATE_ROOM':
            createRoomForClient(client, message.playerName.trim() || 'Player');
            return;
        case 'JOIN_ROOM':
            joinRoomForClient(client, message.roomCode, message.playerName.trim() || 'Player');
            return;
        case 'LEAVE_ROOM':
            removePlayerFromRoom(client, true);
            return;
        case 'UPDATE_DECK':
            handleDeckUpdate(client, message.deck);
            return;
        case 'SET_READY':
            handleReady(client, message.ready);
            return;
        case 'GAME_INIT':
            handleGameInit(client, message);
            return;
        case 'ACTION_REQUEST':
            handleActionRequest(client, message);
            return;
        case 'ACTION_COMMIT':
            handleActionCommit(client, message);
            return;
        case 'MATCH_END':
            handleMatchEnd(client, message);
            return;
    }
}

export function createRelayServer(port: number): WebSocketServer {
    rooms.clear();
    clients.clear();
    const wss = new WebSocketServer({ port });

    wss.on('connection', (socket) => {
        const client: ClientSession = {
            id: createId('client'),
            socket,
            roomCode: null,
            playerName: 'Player',
        };
        clients.set(socket, client);
        send(socket, { type: 'WELCOME', clientId: client.id });
        log(`connected client=${client.id}`);

        socket.on('message', (raw) => {
            onMessage(socket, raw);
        });

        socket.on('close', () => {
            const current = clients.get(socket);
            if (!current) return;
            removePlayerFromRoom(current, true);
            clients.delete(socket);
            log(`disconnected client=${current.id}`);
        });
    });

    log(`relay_listening port=${port}`);
    return wss;
}

const modulePath = fileURLToPath(import.meta.url);
if (process.argv[1] === modulePath) {
    const port = Number.parseInt(process.env.PORT ?? '8787', 10);
    createRelayServer(port);
}
