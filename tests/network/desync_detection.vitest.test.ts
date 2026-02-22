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

describe('online relay desync detection flow', () => {
    it('returns room to lobby when a client reports desync', async () => {
        const relay = getRelay();
        const host = await connectClient(relay.url);
        const guest = await connectClient(relay.url);

        await waitForMessage(host, (message) => message.type === 'WELCOME');
        await waitForMessage(guest, (message) => message.type === 'WELCOME');

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

        const sessionId = 'session_test_desync';
        sendMessage(host, {
            type: 'GAME_INIT',
            sessionId,
            seed: 101,
            p1: makeValidDeck(1, 'HostDeck').deck,
            p2: makeValidDeck(1, 'GuestDeck').deck,
            playerIdBySlot: { P1: 'P1', P2: 'P2' },
        });
        await waitForMessage(host, (message) => message.type === 'GAME_INIT');
        await waitForMessage(guest, (message) => message.type === 'GAME_INIT');

        sendMessage(guest, { type: 'MATCH_END', sessionId, reason: 'desync' });

        const endedHost = await waitForMessage(host, (message) => (
            message.type === 'MATCH_ENDED' && message.reason === 'desync'
        ));
        const endedGuest = await waitForMessage(guest, (message) => (
            message.type === 'MATCH_ENDED' && message.reason === 'desync'
        ));
        expect(endedHost.type).toBe('MATCH_ENDED');
        expect(endedGuest.type).toBe('MATCH_ENDED');

        const lobbyState = await waitForMessage(host, (message) => (
            message.type === 'ROOM_STATE' && message.room.phase === 'LOBBY'
        ));
        expect(lobbyState.type).toBe('ROOM_STATE');
        if (lobbyState.type === 'ROOM_STATE') {
            expect(lobbyState.room.players.every(player => player.ready === false)).toBe(true);
        }

        await closeClient(host);
        await closeClient(guest);
    });
});
