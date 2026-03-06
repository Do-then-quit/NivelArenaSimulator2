import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const dispatchEngineAction = vi.fn(() => true);

vi.mock('../../src/ui/online/onlineMatchController', () => ({
    dispatchEngineAction,
}));

function createAutoPhaseGame(actorPlayerId: string) {
    const players = [
        { id: 'P1', name: 'Player 1' },
        { id: 'P2', name: 'Player 2' },
    ];

    return {
        state: {
            players,
            phase: 'DRAW',
            interactionMode: 'NORMAL',
            interactionOwnerPlayerId: actorPlayerId,
            winner: null,
            pendingAttackerIndex: null,
            pendingBlockerZoneIndex: null,
        },
        currentPlayer: players.find((player) => player.id === actorPlayerId),
        getLegalActions: (requestedActorId: string) => requestedActorId === actorPlayerId
            ? [{ type: 'NEXT_PHASE', actorPlayerId }]
            : [],
    } as any;
}

describe('game loop auto phase advance', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.resetModules();
        dispatchEngineAction.mockClear();
    });

    afterEach(async () => {
        const { uiState } = await import('../../src/ui/appState');
        uiState.onlineSession.room = null;
        uiState.onlineSession.role = null;
        uiState.onlineSession.localEnginePlayerId = null;
        uiState.onlineSession.pendingRequestId = null;
        uiState.playback.queueBusy = false;
        uiState.playback.pendingAutoPhaseActorId = null;
        uiState.replaySession = null;
        uiState.game = null;
        vi.useRealTimers();
    });

    it('dispatches NEXT_PHASE through the shared dispatch path offline', async () => {
        const { Screen, uiState } = await import('../../src/ui/appState');
        const { scheduleAutoPhaseAdvance } = await import('../../src/ui/gameLoop');

        uiState.currentScreen = Screen.GAME;
        uiState.game = createAutoPhaseGame('P1');
        uiState.playback.queueBusy = false;
        uiState.replaySession = null;
        uiState.onlineSession.room = null;

        scheduleAutoPhaseAdvance(1);
        expect(uiState.playback.pendingAutoPhaseActorId).toBe('P1');

        vi.advanceTimersByTime(1);

        expect(dispatchEngineAction).toHaveBeenCalledWith({ type: 'NEXT_PHASE', actorPlayerId: 'P1' });
        expect(uiState.playback.pendingAutoPhaseActorId).toBeNull();
    });

    it('allows host-only online auto phase even for the remote actor turn', async () => {
        const { Screen, uiState } = await import('../../src/ui/appState');
        const { scheduleAutoPhaseAdvance, shouldAutoAdvancePhase } = await import('../../src/ui/gameLoop');

        uiState.currentScreen = Screen.GAME;
        uiState.game = createAutoPhaseGame('P2');
        uiState.playback.queueBusy = false;
        uiState.replaySession = null;
        uiState.onlineSession.room = {
            roomCode: '123456',
            phase: 'IN_GAME',
            hostClientId: 'host',
            players: [],
            matchSessionId: 'session-1',
        } as any;
        uiState.onlineSession.role = 'HOST';
        uiState.onlineSession.localEnginePlayerId = 'P1';

        expect(shouldAutoAdvancePhase(uiState.game)).toBe(true);
        scheduleAutoPhaseAdvance(1);
        vi.advanceTimersByTime(1);

        expect(dispatchEngineAction).toHaveBeenCalledWith({ type: 'NEXT_PHASE', actorPlayerId: 'P2' });
    });

    it('does not auto advance online for guests', async () => {
        const { Screen, uiState } = await import('../../src/ui/appState');
        const { scheduleAutoPhaseAdvance, shouldAutoAdvancePhase } = await import('../../src/ui/gameLoop');

        uiState.currentScreen = Screen.GAME;
        uiState.game = createAutoPhaseGame('P2');
        uiState.playback.queueBusy = false;
        uiState.replaySession = null;
        uiState.onlineSession.room = {
            roomCode: '123456',
            phase: 'IN_GAME',
            hostClientId: 'host',
            players: [],
            matchSessionId: 'session-1',
        } as any;
        uiState.onlineSession.role = 'GUEST';
        uiState.onlineSession.localEnginePlayerId = 'P2';

        expect(shouldAutoAdvancePhase(uiState.game)).toBe(false);
        scheduleAutoPhaseAdvance(1);
        vi.advanceTimersByTime(1);

        expect(dispatchEngineAction).not.toHaveBeenCalled();
    });
});
