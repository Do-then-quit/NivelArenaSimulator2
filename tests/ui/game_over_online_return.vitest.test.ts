import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('game over online return routing', () => {
    beforeEach(() => {
        vi.resetModules();
        document.body.innerHTML = `
            <div id="app"></div>
            <button id="game-over-menu-btn"></button>
            <button id="db-back-to-menu"></button>
        `;
    });

    it('routes to online room from game-over button even after room phase returns to lobby', async () => {
        const { uiState, Screen } = await import('../../src/ui/appState');
        const { attachListeners } = await import('../../src/ui/screens/gameBindings');

        const p1 = { id: 'P1', name: 'P1', hand: [], unitZones: [], damage: [], trash: [], skillZone: [], levelZone: null } as any;
        const p2 = { id: 'P2', name: 'P2', hand: [], unitZones: [], damage: [], trash: [], skillZone: [], levelZone: null } as any;

        uiState.currentScreen = Screen.GAME;
        uiState.replaySession = null;
        uiState.verificationSession = null;
        uiState.render = vi.fn();
        uiState.onlineSession.role = 'HOST';
        uiState.onlineSession.room = {
            roomCode: '123456',
            phase: 'LOBBY',
            hostClientId: 'host',
            matchSessionId: null,
            players: [],
        };
        uiState.game = {
            state: {
                winner: p1.id,
                interactionMode: 'NORMAL',
                interactionOwnerPlayerId: p1.id,
                players: [p1, p2],
                pendingEffect: null,
                revealedCards: [],
            },
            currentPlayer: p1,
            opponentPlayer: p2,
            getLegalActions: vi.fn(() => []),
        } as any;

        attachListeners(() => '');
        (document.getElementById('game-over-menu-btn') as HTMLButtonElement).click();

        expect(uiState.currentScreen).toBe(Screen.ONLINE_ROOM);
        expect(uiState.game).toBeNull();
    });
});
