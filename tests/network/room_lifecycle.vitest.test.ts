// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
    closeClient,
    connectClient,
    getRelay,
    sendMessage,
    waitForMessage,
} from './testUtils';

describe('online relay room lifecycle', () => {
    it('handles create/join/full/host disconnect lifecycle', async () => {
        const relay = getRelay();
        const host = await connectClient(relay.url);
        const guest = await connectClient(relay.url);
        const third = await connectClient(relay.url);

        await waitForMessage(host, (message) => message.type === 'WELCOME');
        await waitForMessage(guest, (message) => message.type === 'WELCOME');
        await waitForMessage(third, (message) => message.type === 'WELCOME');

        sendMessage(guest, { type: 'JOIN_ROOM', roomCode: '12A4', playerName: 'Guest' });
        const invalidCode = await waitForMessage(guest, (message) => (
            message.type === 'ROOM_ERROR' && message.code === 'INVALID_ROOM_CODE'
        ));
        expect(invalidCode.type).toBe('ROOM_ERROR');

        sendMessage(host, { type: 'CREATE_ROOM', playerName: 'Host' });
        const created = await waitForMessage(host, (message) => message.type === 'ROOM_STATE');
        expect(created.type).toBe('ROOM_STATE');
        if (created.type !== 'ROOM_STATE') return;
        expect(created.room.players).toHaveLength(1);
        expect(created.room.players[0].slot).toBe('P1');

        const roomCode = created.room.roomCode;
        sendMessage(guest, { type: 'JOIN_ROOM', roomCode, playerName: 'Guest' });
        const joined = await waitForMessage(host, (message) => (
            message.type === 'ROOM_STATE' && message.room.players.length === 2
        ));
        expect(joined.type).toBe('ROOM_STATE');

        sendMessage(third, { type: 'JOIN_ROOM', roomCode, playerName: 'Third' });
        const fullError = await waitForMessage(third, (message) => (
            message.type === 'ROOM_ERROR' && message.code === 'ROOM_FULL'
        ));
        expect(fullError.type).toBe('ROOM_ERROR');

        await closeClient(host);
        const roomClosed = await waitForMessage(guest, (message) => message.type === 'ROOM_CLOSED');
        expect(roomClosed.type).toBe('ROOM_CLOSED');

        await closeClient(guest);
        await closeClient(third);
    });
});
