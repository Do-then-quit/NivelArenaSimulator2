import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('game loop online hand visibility', () => {
    beforeEach(() => {
        vi.resetModules();
        document.body.innerHTML = '<div id="app"></div>';
    });

    it('reveals only local player hand during online match', async () => {
        const { uiState } = await import('../../src/ui/appState');
        const { shouldRevealHandForPlayer } = await import('../../src/ui/gameLoop');

        uiState.activeMatchViewConfig.revealBotHand = true;
        uiState.onlineSession.room = {
            roomCode: '123456',
            phase: 'IN_GAME',
            hostClientId: 'host-client',
            players: [],
            matchSessionId: 'session-1',
        };
        uiState.onlineSession.localEnginePlayerId = 'P2';

        expect(shouldRevealHandForPlayer('P2')).toBe(true);
        expect(shouldRevealHandForPlayer('P1')).toBe(false);
    });

    it('keeps existing non-online visibility behavior', async () => {
        const { uiState } = await import('../../src/ui/appState');
        const { shouldRevealHandForPlayer } = await import('../../src/ui/gameLoop');

        uiState.onlineSession.room = null;
        uiState.onlineSession.localEnginePlayerId = null;
        uiState.activeMatchViewConfig.revealBotHand = true;

        expect(shouldRevealHandForPlayer('P1')).toBe(true);
        expect(shouldRevealHandForPlayer('P2')).toBe(true);
    });
});
