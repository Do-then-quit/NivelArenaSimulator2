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

describe('online relay ready/start gate', () => {
    it('allows ready regardless of deck validity and keeps ready reset behavior on deck update', async () => {
        const relay = getRelay();
        const host = await connectClient(relay.url);
        const guest = await connectClient(relay.url);

        await waitForMessage(host, (message) => message.type === 'WELCOME');
        await waitForMessage(guest, (message) => message.type === 'WELCOME');

        sendMessage(host, { type: 'CREATE_ROOM', playerName: 'Host' });
        const created = await waitForMessage(host, (message) => message.type === 'ROOM_STATE');
        expect(created.type).toBe('ROOM_STATE');
        if (created.type !== 'ROOM_STATE') return;

        sendMessage(guest, { type: 'JOIN_ROOM', roomCode: created.room.roomCode, playerName: 'Guest' });
        await waitForMessage(host, (message) => message.type === 'ROOM_STATE' && message.room.players.length === 2);

        sendMessage(host, { type: 'SET_READY', ready: true });
        const hostReadyWithoutDeck = await waitForMessage(host, (message) => (
            message.type === 'ROOM_STATE' &&
            message.room.players.some(player => player.slot === 'P1' && player.ready === true)
        ));
        expect(hostReadyWithoutDeck.type).toBe('ROOM_STATE');

        sendMessage(host, makeValidDeck(1, 'HostDeck'));
        sendMessage(host, { type: 'SET_READY', ready: true });
        const hostReadyState = await waitForMessage(host, (message) => (
            message.type === 'ROOM_STATE' &&
            message.room.players.some(player => player.slot === 'P1' && player.ready === true)
        ));
        expect(hostReadyState.type).toBe('ROOM_STATE');

        sendMessage(host, makeValidDeck(2, 'HostDeckV2'));
        const hostReadyReset = await waitForMessage(host, (message) => (
            message.type === 'ROOM_STATE' &&
            message.room.players.some(player => player.slot === 'P1' && player.ready === false)
        ));
        expect(hostReadyReset.type).toBe('ROOM_STATE');

        sendMessage(guest, makeValidDeck(1, 'GuestDeck'));
        sendMessage(host, { type: 'SET_READY', ready: true });
        sendMessage(guest, { type: 'SET_READY', ready: true });

        const startAuth = await waitForMessage(host, (message) => message.type === 'MATCH_START_AUTH');
        expect(startAuth.type).toBe('MATCH_START_AUTH');

        await closeClient(host);
        await closeClient(guest);
    });

    it('emits start auth when both players are ready even with invalid deck submissions', async () => {
        const relay = getRelay();
        const host = await connectClient(relay.url);
        const guest = await connectClient(relay.url);

        await waitForMessage(host, (message) => message.type === 'WELCOME');
        await waitForMessage(guest, (message) => message.type === 'WELCOME');

        sendMessage(host, { type: 'CREATE_ROOM', playerName: 'Host' });
        const created = await waitForMessage(host, (message) => message.type === 'ROOM_STATE');
        expect(created.type).toBe('ROOM_STATE');
        if (created.type !== 'ROOM_STATE') return;

        sendMessage(guest, { type: 'JOIN_ROOM', roomCode: created.room.roomCode, playerName: 'Guest' });
        await waitForMessage(host, (message) => message.type === 'ROOM_STATE' && message.room.players.length === 2);

        sendMessage(host, {
            type: 'UPDATE_DECK',
            deck: {
                deckId: 'host-invalid',
                deckName: 'Host Invalid',
                leaderId: '',
                cardIds: ['ST01-002'],
                revision: 1,
            },
        });
        sendMessage(guest, {
            type: 'UPDATE_DECK',
            deck: {
                deckId: 'guest-invalid',
                deckName: 'Guest Invalid',
                leaderId: '',
                cardIds: [],
                revision: 1,
            },
        });

        sendMessage(host, { type: 'SET_READY', ready: true });
        sendMessage(guest, { type: 'SET_READY', ready: true });

        const startAuth = await waitForMessage(host, (message) => message.type === 'MATCH_START_AUTH');
        expect(startAuth.type).toBe('MATCH_START_AUTH');
        if (startAuth.type !== 'MATCH_START_AUTH') return;
        expect(startAuth.p1.leaderId).toBe('');
        expect(startAuth.p2.cardIds).toHaveLength(0);

        await closeClient(host);
        await closeClient(guest);
    });
});
