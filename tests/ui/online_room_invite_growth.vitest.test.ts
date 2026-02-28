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

describe('online room invite growth loop', () => {
    beforeEach(() => {
        vi.resetModules();
        document.body.innerHTML = '<div id="app"></div>';
        localStorage.clear();
        window.history.replaceState({}, '', '/');
    });

    it('prefills room code from invite link', async () => {
        window.history.replaceState({}, '', '/?room=123456');

        const { uiState } = await import('../../src/ui/appState');
        const { renderOnlineRoom } = await import('../../src/ui/screens/onlineRoom');

        uiState.render = vi.fn();
        uiState.onlineSession.room = null;

        renderOnlineRoom();

        const roomCodeInput = document.getElementById('online-room-code-input') as HTMLInputElement | null;
        expect(roomCodeInput?.value).toBe('123456');
    });

    it('tracks invite_accepted when joining with the prefilled invite room code', async () => {
        window.history.replaceState({}, '', '/?room=654321');

        const { uiState } = await import('../../src/ui/appState');
        const { renderOnlineRoom } = await import('../../src/ui/screens/onlineRoom');
        const { getOnlineGrowthMetrics } = await import('../../src/ui/online/inviteGrowth');
        const onlineController = await import('../../src/ui/online/onlineMatchController');

        uiState.render = vi.fn();
        uiState.onlineSession.room = null;

        renderOnlineRoom();

        const nameInput = document.getElementById('online-player-name') as HTMLInputElement;
        nameInput.value = 'Guest';
        (document.getElementById('online-join-room-btn') as HTMLButtonElement).click();

        expect(onlineController.joinRoom).toHaveBeenCalledWith('654321', 'Guest');
        expect(getOnlineGrowthMetrics().invite_accepted).toBe(1);
    });

    it('copies invite link and tracks share_clicked from lobby', async () => {
        window.history.replaceState({}, '', '/play');

        const writeText = vi.fn(async () => undefined);
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: {
                writeText,
            },
        });

        const { uiState } = await import('../../src/ui/appState');
        const { renderOnlineRoom } = await import('../../src/ui/screens/onlineRoom');
        const { getOnlineGrowthMetrics } = await import('../../src/ui/online/inviteGrowth');

        uiState.render = vi.fn();
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
        (document.getElementById('online-copy-invite-btn') as HTMLButtonElement).click();

        await Promise.resolve();

        expect(writeText).toHaveBeenCalledTimes(1);
        const copiedInviteLink = writeText.mock.calls[0][0] as string;
        expect(new URL(copiedInviteLink).searchParams.get('room')).toBe('123456');
        expect(getOnlineGrowthMetrics().share_clicked).toBe(1);
        expect(document.getElementById('online-invite-feedback')?.textContent).toContain('Invite link copied.');
    });
});
