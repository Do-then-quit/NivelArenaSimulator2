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
import { buildPlayerAreaAnchorKey, CardMotionBeat } from '../../src/ui/playbackMotion';

function createCard(id: string, name: string) {
    return {
        id,
        name,
        type: 'UNIT',
        attribute: 'FIRE',
        cost: 1,
        power: 1000,
        hit: 1000,
        text: '',
    } as any;
}

describe('playback orchestrator', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.resetModules();
        document.body.innerHTML = '<div id="app"></div>';
        clearPlaybackRuntimeState();
        uiState.playback.enabled = true;
        uiState.playback.animationEnabled = true;
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

    it('splits a multi-card draw into sequential deck-to-hand motion beats', () => {
        const firstDrawn = createCard('draw-1', 'First Draw');
        const secondDrawn = createCard('draw-2', 'Second Draw');
        const event: UiTraceEvent = {
            id: 'draw_evt',
            type: 'CARDS_DRAWN',
            createdAtMs: Date.now(),
            turnCount: 1,
            phase: 'DRAW' as any,
            sourcePlayerId: 'P1',
            count: 2,
        };
        const beforeLocators = new Map<any, any>([
            [firstDrawn, { playerId: 'P1', zone: 'DECK', slotIndex: 4, motionKey: 'mk_draw_1' }],
            [secondDrawn, { playerId: 'P1', zone: 'DECK', slotIndex: 3, motionKey: 'mk_draw_2' }],
        ]);
        const afterLocators = new Map<any, any>([
            [firstDrawn, { playerId: 'P1', zone: 'HAND', slotIndex: 5, motionKey: 'mk_draw_1' }],
            [secondDrawn, { playerId: 'P1', zone: 'HAND', slotIndex: 6, motionKey: 'mk_draw_2' }],
        ]);

        const beats = buildPlaybackBeats([event], 'NORMAL', { beforeLocators, afterLocators });

        expect(beats).toHaveLength(2);
        expect(beats[0].motion?.motionType).toBe('DRAW');
        expect(beats[1].motion?.motionType).toBe('DRAW');
        expect(beats[0].motion?.card).toBe(firstDrawn);
        expect(beats[1].motion?.card).toBe(secondDrawn);
        expect(beats[0].toastMessage).toContain('2장 드로우');
        expect(beats[1].toastMessage).toBeUndefined();
    });

    it('keeps damage reveal motion ahead of the trigger beat', () => {
        const revealedCard = createCard('damage-1', 'Trigger Unit');
        const events: UiTraceEvent[] = [
            {
                id: 'damage_evt',
                type: 'DAMAGE_CARD_REVEALED',
                createdAtMs: Date.now(),
                turnCount: 2,
                phase: 'ATTACK' as any,
                targetPlayerId: 'P2',
                sourceCardName: 'Trigger Unit',
            },
            {
                id: 'trigger_evt',
                type: 'DAMAGE_TRIGGER_ACTIVATED',
                createdAtMs: Date.now(),
                turnCount: 2,
                phase: 'ATTACK' as any,
                targetPlayerId: 'P2',
                sourceCardName: 'Trigger Unit',
            },
        ];
        const beforeLocators = new Map<any, any>([
            [revealedCard, { playerId: 'P2', zone: 'DECK', slotIndex: 6, motionKey: 'mk_damage_1' }],
        ]);
        const afterLocators = new Map<any, any>([
            [revealedCard, { playerId: 'P2', zone: 'DAMAGE', slotIndex: 0, motionKey: 'mk_damage_1' }],
        ]);

        const beats = buildPlaybackBeats(events, 'NORMAL', { beforeLocators, afterLocators });

        expect(beats).toHaveLength(2);
        expect(beats[0].eventType).toBe('DAMAGE_CARD_REVEALED');
        expect(beats[0].motion?.motionType).toBe('DAMAGE_REVEAL');
        expect(beats[0].motion?.flipToFront).toBe(true);
        expect(beats[1].eventType).toBe('DAMAGE_TRIGGER_ACTIVATED');
        expect(beats[1].motion).toBeUndefined();
    });

    it('prepends action fx beats before follow-up playback events', () => {
        const drawEvent: UiTraceEvent = {
            id: 'draw_evt',
            type: 'CARDS_DRAWN',
            createdAtMs: Date.now(),
            turnCount: 1,
            phase: 'DRAW' as any,
            sourcePlayerId: 'P1',
            count: 1,
        };
        const drawnCard = createCard('draw-action-1', 'After Phase Draw');
        const beforeLocators = new Map<any, any>([
            [drawnCard, { playerId: 'P1', zone: 'DECK', slotIndex: 5, motionKey: 'mk_after_phase_draw' }],
        ]);
        const afterLocators = new Map<any, any>([
            [drawnCard, { playerId: 'P1', zone: 'HAND', slotIndex: 0, motionKey: 'mk_after_phase_draw' }],
        ]);

        const beats = buildPlaybackBeats([drawEvent], 'NORMAL', {
            action: { type: 'NEXT_PHASE', actorPlayerId: 'P1' },
            beforeLocators,
            afterLocators,
            afterState: {
                players: [
                    { id: 'P1', name: 'Player 1', unitZones: [{}, {}, {}] },
                    { id: 'P2', name: 'Player 2', unitZones: [{}, {}, {}] },
                ],
                phase: 'DRAW',
                turnPlayerIndex: 0,
                interactionMode: 'NORMAL',
                interactionOwnerPlayerId: null,
                pendingAttackerIndex: null,
                pendingBlockerZoneIndex: null,
                winner: null,
                currentPlayer: undefined,
            } as any,
        });

        expect(beats[0].eventType).toBe('ACTION_FX');
        expect(beats[0].actionFx?.kind).toBe('NEXT_PHASE');
        expect(beats[1].eventType).toBe('CARDS_DRAWN');
        expect(beats[1].motion?.motionType).toBe('DRAW');
    });

    it('builds interaction focus without leaking hidden opponent hand targets', () => {
        const hiddenCard = createCard('opp-hand-1', 'Hidden Hand');
        const events: UiTraceEvent[] = [{
            id: 'interaction_evt',
            type: 'INTERACTION_OPENED',
            createdAtMs: Date.now(),
            turnCount: 2,
            phase: 'MAIN' as any,
            interactionMode: 'SELECT_TARGET',
        }];
        const afterLocators = new Map<any, any>([
            [hiddenCard, { playerId: 'P2', zone: 'HAND', slotIndex: 0, motionKey: 'mk_hidden_1' }],
        ]);

        uiState.activeMatchViewConfig.revealBotHand = false;
        uiState.onlineSession.room = {
            roomCode: '123456',
            phase: 'IN_GAME',
            hostClientId: 'host',
            players: [],
            matchSessionId: 'session-1',
        } as any;
        uiState.onlineSession.localEnginePlayerId = 'P1';

        const beats = buildPlaybackBeats(events, 'NORMAL', {
            afterLocators,
            afterState: {
                players: [
                    {
                        id: 'P1',
                        name: 'Player 1',
                        levelZone: null,
                        unitZones: [{ unit: null, items: [] }, { unit: null, items: [] }, { unit: null, items: [] }],
                        hand: [],
                        trash: [],
                        damage: [],
                    },
                    {
                        id: 'P2',
                        name: 'Player 2',
                        levelZone: null,
                        unitZones: [{ unit: null, items: [] }, { unit: null, items: [] }, { unit: null, items: [] }],
                        hand: [hiddenCard],
                        trash: [],
                        damage: [],
                    },
                ],
                phase: 'MAIN',
                turnPlayerIndex: 0,
                interactionMode: 'SELECT_TARGET',
                interactionOwnerPlayerId: 'P1',
                pendingAttackerIndex: null,
                pendingBlockerZoneIndex: null,
                pendingEffect: {
                    sourceCard: createCard('src-1', 'Source'),
                    sourcePlayerId: 'P1',
                    actionType: 'SELECT',
                    actionValue: {},
                    validTargets: 'OPP_HAND',
                    selectedTargets: [],
                },
                revealedCards: [],
            } as any,
            legalActions: [
                {
                    type: 'SELECT_HAND_TARGET',
                    actorPlayerId: 'P1',
                    targetPlayerId: 'P2',
                    handIndex: 0,
                },
            ],
        });

        expect(beats[0].eventType).toBe('INTERACTION_FOCUS');
        expect(beats[0].interactionFocus?.targetAnchorKeys).toEqual([buildPlayerAreaAnchorKey('P2')]);
        expect(beats[1].eventType).toBe('INTERACTION_OPENED');

        uiState.onlineSession.room = null;
        uiState.onlineSession.localEnginePlayerId = null;
        uiState.activeMatchViewConfig.revealBotHand = true;
    });

    it('creates reveal entry and exit beats from locator diffs', () => {
        const entering = createCard('reveal-enter', 'Reveal Enter');
        const leaving = createCard('reveal-exit', 'Reveal Exit');
        const beforeLocators = new Map<any, any>([
            [entering, { playerId: 'P1', zone: 'DECK', slotIndex: 5, motionKey: 'mk_reveal_enter' }],
            [leaving, { zone: 'REVEALED', slotIndex: 0, motionKey: 'mk_reveal_exit' }],
        ]);
        const afterLocators = new Map<any, any>([
            [entering, { zone: 'REVEALED', slotIndex: 0, motionKey: 'mk_reveal_enter' }],
            [leaving, { playerId: 'P1', zone: 'HAND', slotIndex: 4, motionKey: 'mk_reveal_exit' }],
        ]);

        const beats = buildPlaybackBeats([], 'NORMAL', { beforeLocators, afterLocators });

        expect(beats).toHaveLength(2);
        expect(beats[0].eventType).toBe('CARD_MOTION');
        expect(beats[0].motion?.motionType).toBe('REVEAL_ENTER');
        expect(beats[1].motion?.motionType).toBe('REVEAL_EXIT');
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

    it('flushes beats immediately when animation is disabled', () => {
        const card = createCard('motion-card', 'Motion Card');
        const motion: CardMotionBeat = {
            id: 'motion_beat',
            motionType: 'DRAW',
            motionKey: 'mk_motion',
            card,
            source: { playerId: 'P1', zone: 'DECK', slotIndex: 5, motionKey: 'mk_motion' },
            target: { playerId: 'P1', zone: 'HAND', slotIndex: 0, motionKey: 'mk_motion' },
            sourceFace: 'BACK',
            flipToFront: false,
            sourceRect: null,
            sourceAnchorKeys: ['zone:P1:DECK'],
            targetAnchorKeys: ['zone:P1:HAND'],
        };
        uiState.playback.animationEnabled = false;

        enqueuePlaybackBeats([{
            id: 'flush_beat',
            eventType: 'CARD_MOTION',
            durationMs: 320,
            modalGateMs: 220,
            toastMessage: 'motion toast',
            pulseTargets: [],
            motion,
        }]);

        expect(uiState.playback.queueBusy).toBe(false);
        expect(uiState.playback.modalGateUntilMs).toBe(0);
        expect(uiState.playback.logEntries.map(entry => entry.message)).toContain('motion toast');
        expect(uiState.playback.toasts).toHaveLength(1);
    });
});
