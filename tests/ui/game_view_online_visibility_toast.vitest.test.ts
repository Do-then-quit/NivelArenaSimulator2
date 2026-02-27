import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UiTraceEvent } from '../../src/logic/types';

describe('playback toast online visibility', () => {
    beforeEach(() => {
        vi.resetModules();
        document.body.innerHTML = '<div id="app"></div>';
    });

    it('does not expose drawn card names in playback toasts', async () => {
        const { Screen, uiState } = await import('../../src/ui/appState');
        const { buildPlaybackBeats } = await import('../../src/ui/playbackOrchestrator');

        uiState.currentScreen = Screen.GAME;
        uiState.playback.enabled = true;
        uiState.onlineSession.room = {
            roomCode: '123456',
            phase: 'IN_GAME',
            hostClientId: 'host-client',
            players: [],
            matchSessionId: 'session-1',
        };
        uiState.onlineSession.localEnginePlayerId = 'P1';
        uiState.game = {
            state: {
                players: [
                    { id: 'P1', name: 'Local' },
                    { id: 'P2', name: 'Remote' },
                ],
            },
        } as any;

        const remoteDrawEvent: UiTraceEvent = {
            id: 'evt_remote_draw',
            type: 'CARDS_DRAWN',
            createdAtMs: Date.now(),
            turnCount: 1,
            phase: 'MAIN' as any,
            sourcePlayerId: 'P2',
            cardNames: ['SECRET_CARD_NAME'],
            count: 1,
        };

        const localDrawEvent: UiTraceEvent = {
            id: 'evt_local_draw',
            type: 'CARDS_DRAWN',
            createdAtMs: Date.now(),
            turnCount: 1,
            phase: 'MAIN' as any,
            sourcePlayerId: 'P1',
            cardNames: ['LOCAL_CARD_NAME'],
            count: 1,
        };

        const remoteBeat = buildPlaybackBeats([remoteDrawEvent], 'NORMAL')[0];
        const localBeat = buildPlaybackBeats([localDrawEvent], 'NORMAL')[0];

        expect(remoteBeat.toastMessage).toContain('1장 드로우');
        expect(remoteBeat.toastMessage).not.toContain('SECRET_CARD_NAME');
        expect(localBeat.toastMessage).toContain('1장 드로우');
        expect(localBeat.toastMessage).not.toContain('LOCAL_CARD_NAME');
    });
});
