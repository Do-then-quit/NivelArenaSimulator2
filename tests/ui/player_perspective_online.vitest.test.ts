import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('online player perspective', () => {
    beforeEach(() => {
        vi.resetModules();
        document.body.innerHTML = '<div id="app"></div>';
    });

    it('pins local player to bottom in online in-game phase', async () => {
        const { uiState } = await import('../../src/ui/appState');
        const { getBottomPlayer, getTopPlayer } = await import('../../src/ui/playerPerspective');

        const p1 = { id: 'P1', name: 'Host' } as any;
        const p2 = { id: 'P2', name: 'Guest' } as any;
        const engine = {
            state: { players: [p1, p2] },
            currentPlayer: p1,
            opponentPlayer: p2,
        } as any;

        uiState.onlineSession.room = {
            roomCode: '123456',
            phase: 'IN_GAME',
            hostClientId: 'host-client',
            players: [],
            matchSessionId: 'session-1',
        };
        uiState.onlineSession.localEnginePlayerId = 'P2';

        expect(getBottomPlayer(engine).id).toBe('P2');
        expect(getTopPlayer(engine).id).toBe('P1');
    });

    it('falls back to turn-based orientation outside online in-game phase', async () => {
        const { uiState } = await import('../../src/ui/appState');
        const { getBottomPlayer, getTopPlayer } = await import('../../src/ui/playerPerspective');

        const p1 = { id: 'P1', name: 'Host' } as any;
        const p2 = { id: 'P2', name: 'Guest' } as any;
        const engine = {
            state: { players: [p1, p2] },
            currentPlayer: p1,
            opponentPlayer: p2,
        } as any;

        uiState.onlineSession.room = null;
        uiState.onlineSession.localEnginePlayerId = null;

        expect(getBottomPlayer(engine).id).toBe('P1');
        expect(getTopPlayer(engine).id).toBe('P2');
    });
});
