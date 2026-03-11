import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/ui/online/onlineMatchController', () => ({
    ensureOnlineClient: vi.fn(),
    createRoom: vi.fn(),
    joinRoom: vi.fn(),
    leaveRoomAndDisconnect: vi.fn(),
    submitDeckSelection: vi.fn(() => true),
    setReady: vi.fn(),
    getLocalSelectedDeckId: vi.fn(() => null),
}));

describe('online room state transitions', () => {
    beforeEach(() => {
        vi.resetModules();
        document.body.innerHTML = '<div id="app"></div>';
        localStorage.clear();
    });

    it('routes to online room from main menu button', async () => {
        const { uiState, Screen } = await import('../../src/ui/appState');
        const { renderMenu } = await import('../../src/ui/screens/menu');

        uiState.render = vi.fn();
        renderMenu();

        (document.getElementById('advanced-menu-btn') as HTMLButtonElement).click();
        (document.getElementById('online-room-btn') as HTMLButtonElement).click();
        expect(uiState.currentScreen).toBe(Screen.ONLINE_ROOM);
    });

    it('opens deck builder from online lobby and sets return screen', async () => {
        const { uiState, Screen } = await import('../../src/ui/appState');
        const { renderOnlineRoom } = await import('../../src/ui/screens/onlineRoom');

        uiState.render = vi.fn();
        uiState.currentScreen = Screen.ONLINE_ROOM;
        uiState.onlineSession.localClientId = 'local-client';
        uiState.onlineSession.role = 'HOST';
        uiState.onlineSession.room = {
            roomCode: '123456',
            phase: 'LOBBY',
            hostClientId: 'local-client',
            matchSessionId: null,
            players: [
                {
                    clientId: 'local-client',
                    slot: 'P1',
                    name: 'Host',
                    connected: true,
                    ready: false,
                    deckSummary: null,
                },
            ],
        };

        renderOnlineRoom();
        (document.getElementById('online-open-deck-builder-btn') as HTMLButtonElement).click();

        expect(uiState.currentScreen).toBe(Screen.DECK_BUILDER);
        expect(uiState.deckBuilderReturnScreen).toBe(Screen.ONLINE_ROOM);
    });
});
