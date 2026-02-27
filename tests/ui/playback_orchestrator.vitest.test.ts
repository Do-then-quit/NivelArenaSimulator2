import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Screen, uiState } from '../../src/ui/appState';
import {
    PlaybackBeat,
    buildPlaybackBeats,
    clearPlaybackRuntimeState,
    enqueuePlaybackBeats,
    skipPlaybackQueue,
} from '../../src/ui/playbackOrchestrator';
import { UiTraceEvent } from '../../src/logic/types';

describe('playback orchestrator', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.resetModules();
        document.body.innerHTML = '<div id="app"></div>';
        clearPlaybackRuntimeState();
        uiState.playback.enabled = true;
        uiState.playback.speed = 'NORMAL';
        uiState.playback.toasts = [];
        uiState.playback.logEntries = [];
        uiState.playback.modalGateUntilMs = 0;
        uiState.currentScreen = Screen.GAME;
        uiState.replaySession = null;
        uiState.verificationSession = null;
        uiState.render = vi.fn();
        uiState.game = {
            state: {
                players: [
                    { id: 'P1', name: 'Player 1' },
                    { id: 'P2', name: 'Player 2' },
                ],
            },
        } as any;
    });

    afterEach(() => {
        clearPlaybackRuntimeState();
        vi.useRealTimers();
    });

    it('maps ui trace events to beats with speed presets', () => {
        const events: UiTraceEvent[] = [
            {
                id: 'e1',
                type: 'INTERACTION_OPENED',
                createdAtMs: Date.now(),
                turnCount: 1,
                phase: 'MAIN' as any,
                interactionMode: 'SELECT_TARGET',
            },
            {
                id: 'e2',
                type: 'CARDS_DRAWN',
                createdAtMs: Date.now(),
                turnCount: 1,
                phase: 'MAIN' as any,
                sourcePlayerId: 'P1',
                cardNames: ['Alpha'],
                count: 1,
            },
        ];

        const slowBeats = buildPlaybackBeats(events, 'SLOW');
        const fastBeats = buildPlaybackBeats(events, 'FAST');

        expect(slowBeats).toHaveLength(2);
        expect(slowBeats[0].durationMs).toBe(520);
        expect(slowBeats[0].modalGateMs).toBe(360);
        expect(fastBeats[0].durationMs).toBe(180);
        expect(fastBeats[0].modalGateMs).toBe(120);
    });

    it('flushes remaining beats on skip', () => {
        const beats: PlaybackBeat[] = [
            {
                id: 'b1',
                eventType: 'EFFECT_EXECUTED',
                durationMs: 400,
                modalGateMs: 0,
                toastMessage: 'effect 1',
                pulseTargets: [],
            },
            {
                id: 'b2',
                eventType: 'EFFECT_EXECUTED',
                durationMs: 400,
                modalGateMs: 0,
                toastMessage: 'effect 2',
                pulseTargets: [],
            },
        ];

        enqueuePlaybackBeats(beats);
        expect(uiState.playback.queueBusy).toBe(true);

        const skipped = skipPlaybackQueue();

        expect(skipped).toBe(true);
        expect(uiState.playback.queueBusy).toBe(false);
        expect(uiState.playback.toasts).toHaveLength(0);
        expect(uiState.playback.logEntries.length).toBeGreaterThan(0);
    });
});
