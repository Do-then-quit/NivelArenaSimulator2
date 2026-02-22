// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
    closeClient,
    connectClient,
    getRelay,
    makeValidDeck,
    sendMessage,
    waitForMessage,
} from './testUtils';

describe('online relay action routing', () => {
    it('forwards guest requests to host and broadcasts commits', async () => {
        const relay = getRelay();
        const host = await connectClient(relay.url);
        const guest = await connectClient(relay.url);

        const hostWelcome = await waitForMessage(host, (message) => message.type === 'WELCOME');
        const guestWelcome = await waitForMessage(guest, (message) => message.type === 'WELCOME');
        expect(hostWelcome.type).toBe('WELCOME');
        expect(guestWelcome.type).toBe('WELCOME');

        sendMessage(host, { type: 'CREATE_ROOM', playerName: 'Host' });
        const created = await waitForMessage(host, (message) => message.type === 'ROOM_STATE');
        if (created.type !== 'ROOM_STATE') return;

        sendMessage(guest, { type: 'JOIN_ROOM', roomCode: created.room.roomCode, playerName: 'Guest' });
        await waitForMessage(host, (message) => message.type === 'ROOM_STATE' && message.room.players.length === 2);

        sendMessage(host, makeValidDeck(1, 'HostDeck'));
        sendMessage(guest, makeValidDeck(1, 'GuestDeck'));
        sendMessage(host, { type: 'SET_READY', ready: true });
        sendMessage(guest, { type: 'SET_READY', ready: true });
        await waitForMessage(host, (message) => message.type === 'MATCH_START_AUTH');

        const sessionId = 'session_test_1';
        const playerIdBySlot = { P1: 'PLAYER_P1', P2: 'PLAYER_P2' } as const;

        sendMessage(host, {
            type: 'GAME_INIT',
            sessionId,
            seed: 12345,
            p1: makeValidDeck(1, 'HostDeck').deck,
            p2: makeValidDeck(1, 'GuestDeck').deck,
            playerIdBySlot,
        });

        const gameInitHost = await waitForMessage(host, (message) => message.type === 'GAME_INIT');
        const gameInitGuest = await waitForMessage(guest, (message) => message.type === 'GAME_INIT');
        expect(gameInitHost.type).toBe('GAME_INIT');
        expect(gameInitGuest.type).toBe('GAME_INIT');

        sendMessage(guest, {
            type: 'ACTION_REQUEST',
            sessionId,
            requestId: 'req-1',
            action: { type: 'NEXT_PHASE', actorPlayerId: 'PLAYER_P2' },
        });

        const forwarded = await waitForMessage(host, (message) => message.type === 'ACTION_REQUEST_FORWARD');
        expect(forwarded.type).toBe('ACTION_REQUEST_FORWARD');
        if (forwarded.type === 'ACTION_REQUEST_FORWARD') {
            expect(forwarded.requestId).toBe('req-1');
        }

        sendMessage(host, {
            type: 'ACTION_COMMIT',
            sessionId,
            seq: 1,
            action: { type: 'NEXT_PHASE', actorPlayerId: 'PLAYER_P2' },
            stateHash: 'deadbeef',
        });

        const commitHost = await waitForMessage(host, (message) => (
            message.type === 'ACTION_COMMIT_BROADCAST' && message.seq === 1
        ));
        const commitGuest = await waitForMessage(guest, (message) => (
            message.type === 'ACTION_COMMIT_BROADCAST' && message.seq === 1
        ));
        expect(commitHost.type).toBe('ACTION_COMMIT_BROADCAST');
        expect(commitGuest.type).toBe('ACTION_COMMIT_BROADCAST');

        await closeClient(host);
        await closeClient(guest);
    });
});
