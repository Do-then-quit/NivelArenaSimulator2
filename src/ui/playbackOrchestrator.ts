import { EngineAction, GameState, UiTraceEvent, UiTraceEventType } from '../logic/types';
import { GameEngine } from '../logic/GameEngine';
import { PlaybackSpeed, PlaybackToast, Screen, uiState } from './appState';
import {
    CardLocatorSnapshot,
    CardMoveRecord,
    CardMotionBeat,
    MotionRectSnapshot,
    captureCardLocators,
    clearPlaybackMotionOverlay,
    diffCardLocators,
    getLocatorAnchorKeys,
    isHandVisibleToViewer,
    playCardMotionBeat,
    snapshotMotionAnchorRects,
} from './playbackMotion';
import { persistPlaybackPrefs } from './playbackPrefs';

export type PlaybackBeatEventType = UiTraceEventType | 'CARD_MOTION';

export interface PlaybackBeat {
    id: string;
    eventType: PlaybackBeatEventType;
    durationMs: number;
    modalGateMs: number;
    toastMessage?: string;
    pulseTargets: Array<{ playerId: string; zone: 'HAND' | 'DECK' | 'DAMAGE' }>;
    motion?: CardMotionBeat;
}

export interface PlaybackBeatBuildOptions {
    beforeLocators?: CardLocatorSnapshot;
    afterLocators?: CardLocatorSnapshot;
    beforeAnchorRects?: MotionRectSnapshot;
}

const MODAL_DELAY_INTERACTION_MODES = new Set<GameState['interactionMode']>([
    'SELECT_TARGET',
    'SELECT_COST',
    'SELECT_OPTIONAL',
]);

interface PlaybackTiming {
    beatMs: number;
    modalGateMs: number;
}

interface PlaybackCapture {
    beforeLocators: CardLocatorSnapshot;
    beforeAnchorRects: MotionRectSnapshot;
}

const PLAYBACK_TIMING_BY_SPEED: Record<PlaybackSpeed, PlaybackTiming> = {
    SLOW: { beatMs: 520, modalGateMs: 360 },
    NORMAL: { beatMs: 320, modalGateMs: 220 },
    FAST: { beatMs: 180, modalGateMs: 120 },
};

let beatCounter = 0;
let activeBeatTimer: number | null = null;
const beatQueue: PlaybackBeat[] = [];

function nextBeatId(): string {
    beatCounter += 1;
    return `pbeat_${Date.now().toString(36)}_${beatCounter.toString(36)}`;
}

function getTiming(speed: PlaybackSpeed): PlaybackTiming {
    return PLAYBACK_TIMING_BY_SPEED[speed];
}

function getPlayerName(playerId: string | undefined): string {
    if (!playerId) return '플레이어';
    return uiState.game?.state.players.find(player => player.id === playerId)?.name ?? playerId;
}

function appendToast(message: string, durationMs: number): void {
    const now = Date.now();
    const minToastLifetimeMs = 2400;
    const toast: PlaybackToast = {
        id: `ptoast_${now.toString(36)}_${Math.floor(Math.random() * 1_000_000).toString(36)}`,
        message,
        createdAtMs: now,
        expiresAtMs: now + Math.max(minToastLifetimeMs, durationMs * 3),
    };
    uiState.playback.toasts.push(toast);
    if (uiState.playback.toasts.length > 5) {
        uiState.playback.toasts.splice(0, uiState.playback.toasts.length - 5);
    }
}

function appendPlaybackLog(message: string): void {
    const now = Date.now();
    uiState.playback.logEntries.push({
        id: `plog_${now.toString(36)}_${Math.floor(Math.random() * 1_000_000).toString(36)}`,
        message,
        createdAtMs: now,
    });

    const limit = Math.max(50, uiState.playback.maxLogEntries || 500);
    if (uiState.playback.logEntries.length > limit) {
        uiState.playback.logEntries.splice(0, uiState.playback.logEntries.length - limit);
    }
}

function pruneExpiredToasts(): void {
    const now = Date.now();
    uiState.playback.toasts = uiState.playback.toasts.filter(toast => toast.expiresAtMs > now);
}

function buildCardsDrawnMessage(event: UiTraceEvent): string {
    const playerName = getPlayerName(event.sourcePlayerId);
    const count = event.count ?? event.cardNames?.length ?? 0;
    if (!event.sourcePlayerId) return `${count}장 드로우`;
    return `${playerName}가 ${count}장 드로우`;
}

function buildToastMessage(event: UiTraceEvent): string | null {
    switch (event.type) {
        case 'CARDS_DRAWN':
            return buildCardsDrawnMessage(event);
        case 'DAMAGE_CARD_REVEALED': {
            const playerName = getPlayerName(event.targetPlayerId);
            const cardName = event.sourceCardName ?? '카드';
            return `${playerName} 데미지 공개: ${cardName}`;
        }
        case 'DAMAGE_TRIGGER_ACTIVATED': {
            const playerName = getPlayerName(event.targetPlayerId);
            const cardName = event.sourceCardName ?? '데미지 카드';
            return `${playerName} 트리거 발동: ${cardName}`;
        }
        case 'INTERACTION_OPENED':
            return '효과 선택 창 준비 중...';
        case 'PHASE_CHANGED':
            return `페이즈 전환: ${event.phase}`;
        case 'EFFECT_EXECUTED':
            return event.effectDescription
                ? `효과: ${event.effectDescription}`
                : (event.sourceCardName ? `${event.sourceCardName} 효과 처리` : '효과 처리');
        default:
            return null;
    }
}

function buildPulseTargets(event: UiTraceEvent): Array<{ playerId: string; zone: 'HAND' | 'DECK' | 'DAMAGE' }> {
    if (event.type === 'CARDS_DRAWN' && event.sourcePlayerId) {
        return [
            { playerId: event.sourcePlayerId, zone: 'DECK' },
            { playerId: event.sourcePlayerId, zone: 'HAND' },
        ];
    }
    if (event.type === 'DAMAGE_CARD_REVEALED' && event.targetPlayerId) {
        return [{ playerId: event.targetPlayerId, zone: 'DAMAGE' }];
    }
    if (event.type === 'DAMAGE_TRIGGER_ACTIVATED' && event.targetPlayerId) {
        return [{ playerId: event.targetPlayerId, zone: 'DAMAGE' }];
    }
    return [];
}

function createEventBeat(
    event: UiTraceEvent,
    timing: PlaybackTiming,
    overrides: Partial<PlaybackBeat> = {},
): PlaybackBeat {
    const toastMessage = overrides.toastMessage === undefined
        ? buildToastMessage(event) ?? undefined
        : overrides.toastMessage;
    return {
        id: nextBeatId(),
        eventType: event.type,
        durationMs: timing.beatMs,
        modalGateMs: event.type === 'INTERACTION_OPENED' ? timing.modalGateMs : 0,
        toastMessage,
        pulseTargets: buildPulseTargets(event),
        ...overrides,
    };
}

function resolveSourceRect(anchorKeys: string[], beforeAnchorRects: MotionRectSnapshot | undefined) {
    if (!beforeAnchorRects) return null;
    for (const key of anchorKeys) {
        const rect = beforeAnchorRects.get(key);
        if (rect) return rect;
    }
    return null;
}

function createMotionBeat(
    motionType: CardMotionBeat['motionType'],
    move: CardMoveRecord,
    sourceFace: CardMotionBeat['sourceFace'],
    flipToFront: boolean,
    beforeAnchorRects: MotionRectSnapshot | undefined,
): CardMotionBeat {
    const sourceAnchorKeys = getLocatorAnchorKeys(move.source);
    return {
        id: nextBeatId(),
        motionType,
        motionKey: move.source.motionKey,
        card: move.card,
        source: move.source,
        target: move.target,
        sourceFace,
        flipToFront,
        sourceRect: resolveSourceRect(sourceAnchorKeys, beforeAnchorRects),
        sourceAnchorKeys,
        targetAnchorKeys: getLocatorAnchorKeys(move.target),
    };
}

function groupMovesByPlayer(
    moves: CardMoveRecord[],
    fromZone: CardMoveRecord['source']['zone'],
    toZone: CardMoveRecord['target']['zone'],
): Map<string, CardMoveRecord[]> {
    const grouped = new Map<string, CardMoveRecord[]>();
    moves
        .filter(move => move.source.zone === fromZone && move.target.zone === toZone && !!move.target.playerId)
        .sort((left, right) => {
            if (left.source.playerId !== right.source.playerId) {
                return String(left.source.playerId).localeCompare(String(right.source.playerId));
            }
            return right.source.slotIndex - left.source.slotIndex;
        })
        .forEach((move) => {
            const key = move.target.playerId!;
            const next = grouped.get(key) ?? [];
            next.push(move);
            grouped.set(key, next);
        });
    return grouped;
}

function takeMoves(groupedMoves: Map<string, CardMoveRecord[]>, playerId: string | undefined, count: number): CardMoveRecord[] {
    if (!playerId) return [];
    const queue = groupedMoves.get(playerId);
    if (!queue || queue.length === 0) return [];
    return queue.splice(0, Math.max(0, count));
}

function sortRevealMoves(moves: CardMoveRecord[], direction: 'ENTER' | 'EXIT'): CardMoveRecord[] {
    return moves
        .filter(move => direction === 'ENTER'
            ? move.target.zone === 'REVEALED' && move.source.zone !== 'REVEALED'
            : move.source.zone === 'REVEALED' && move.target.zone !== 'REVEALED')
        .sort((left, right) => {
            if (direction === 'ENTER') {
                return left.target.slotIndex - right.target.slotIndex;
            }
            return left.source.slotIndex - right.source.slotIndex;
        });
}

function buildRevealEntryMotion(move: CardMoveRecord, beforeAnchorRects: MotionRectSnapshot | undefined): CardMotionBeat {
    if (move.source.zone === 'DECK') {
        return createMotionBeat('REVEAL_ENTER', move, 'BACK', true, beforeAnchorRects);
    }
    if (move.source.zone === 'HAND') {
        const visible = isHandVisibleToViewer(move.source.playerId);
        return createMotionBeat('REVEAL_ENTER', move, visible ? 'FRONT' : 'BACK', !visible, beforeAnchorRects);
    }
    return createMotionBeat('REVEAL_ENTER', move, 'FRONT', false, beforeAnchorRects);
}

function buildRevealExitMotion(move: CardMoveRecord, beforeAnchorRects: MotionRectSnapshot | undefined): CardMotionBeat {
    return createMotionBeat('REVEAL_EXIT', move, 'FRONT', false, beforeAnchorRects);
}

export function buildPlaybackBeats(
    events: UiTraceEvent[],
    speed: PlaybackSpeed,
    options: PlaybackBeatBuildOptions = {},
): PlaybackBeat[] {
    const timing = getTiming(speed);
    const beats: PlaybackBeat[] = [];
    const movedCards = options.beforeLocators && options.afterLocators
        ? diffCardLocators(options.beforeLocators, options.afterLocators)
        : [];
    const drawMovesByPlayer = groupMovesByPlayer(movedCards, 'DECK', 'HAND');
    const damageMovesByPlayer = groupMovesByPlayer(movedCards, 'DECK', 'DAMAGE');
    const revealEntryMoves = sortRevealMoves(movedCards, 'ENTER');
    const revealExitMoves = sortRevealMoves(movedCards, 'EXIT');

    let revealEntryInserted = false;
    const insertRevealEntryBeats = () => {
        if (revealEntryInserted || revealEntryMoves.length === 0) return;
        revealEntryInserted = true;
        revealEntryMoves.forEach((move) => {
            beats.push({
                id: nextBeatId(),
                eventType: 'CARD_MOTION',
                durationMs: timing.beatMs,
                modalGateMs: timing.modalGateMs,
                pulseTargets: [],
                motion: buildRevealEntryMotion(move, options.beforeAnchorRects),
            });
        });
    };

    events.forEach((event) => {
        if (event.type === 'INTERACTION_OPENED') {
            insertRevealEntryBeats();
        }

        if (event.type === 'CARDS_DRAWN') {
            const assignedMoves = takeMoves(drawMovesByPlayer, event.sourcePlayerId, event.count ?? 0);
            if (assignedMoves.length > 0) {
                assignedMoves.forEach((move, index) => {
                    beats.push(createEventBeat(event, timing, {
                        toastMessage: index === 0 ? buildToastMessage(event) ?? undefined : undefined,
                        motion: createMotionBeat('DRAW', move, 'BACK', false, options.beforeAnchorRects),
                    }));
                });
                return;
            }
        }

        if (event.type === 'DAMAGE_CARD_REVEALED') {
            const [assignedMove] = takeMoves(damageMovesByPlayer, event.targetPlayerId, 1);
            beats.push(createEventBeat(event, timing, assignedMove
                ? {
                    motion: createMotionBeat('DAMAGE_REVEAL', assignedMove, 'BACK', true, options.beforeAnchorRects),
                }
                : undefined));
            return;
        }

        beats.push(createEventBeat(event, timing));
    });

    insertRevealEntryBeats();

    revealExitMoves.forEach((move) => {
        beats.push({
            id: nextBeatId(),
            eventType: 'CARD_MOTION',
            durationMs: timing.beatMs,
            modalGateMs: 0,
            pulseTargets: [],
            motion: buildRevealExitMotion(move, options.beforeAnchorRects),
        });
    });

    return beats;
}

function playMotionIfNeeded(beat: PlaybackBeat): void {
    if (!beat.motion || !uiState.playback.animationEnabled) return;
    window.requestAnimationFrame(() => {
        playCardMotionBeat(beat.motion!, beat.durationMs);
    });
}

function runNextBeat(): void {
    if (activeBeatTimer !== null) return;

    pruneExpiredToasts();

    const beat = beatQueue.shift();
    if (!beat) {
        uiState.playback.queueBusy = false;
        uiState.playback.activePulseTargets = [];
        uiState.playback.activeMotionBeatId = null;
        uiState.render?.();
        return;
    }

    uiState.playback.queueBusy = true;
    uiState.playback.activeMotionBeatId = beat.motion?.id ?? null;
    if (beat.modalGateMs > 0) {
        uiState.playback.modalGateUntilMs = Math.max(uiState.playback.modalGateUntilMs, Date.now() + beat.modalGateMs);
    }
    if (beat.toastMessage) {
        appendToast(beat.toastMessage, beat.durationMs);
        appendPlaybackLog(beat.toastMessage);
    }
    uiState.playback.activePulseTargets = beat.pulseTargets;
    uiState.render?.();
    playMotionIfNeeded(beat);

    activeBeatTimer = window.setTimeout(() => {
        activeBeatTimer = null;
        uiState.playback.activePulseTargets = [];
        uiState.playback.activeMotionBeatId = null;
        pruneExpiredToasts();
        if (beatQueue.length === 0) {
            uiState.playback.queueBusy = false;
        }
        uiState.render?.();
        runNextBeat();
    }, beat.durationMs);
}

function flushPlaybackBeatsImmediately(beats: PlaybackBeat[]): void {
    beats.forEach((beat) => {
        if (beat.toastMessage) {
            appendToast(beat.toastMessage, 0);
            appendPlaybackLog(beat.toastMessage);
        }
    });
    uiState.playback.queueBusy = false;
    uiState.playback.modalGateUntilMs = 0;
    uiState.playback.activePulseTargets = [];
    uiState.playback.activeMotionBeatId = null;
    clearPlaybackMotionOverlay();
    uiState.render?.();
}

export function enqueuePlaybackBeats(beats: PlaybackBeat[]): void {
    if (beats.length === 0) return;
    if (!uiState.playback.enabled) return;
    if (!uiState.playback.animationEnabled) {
        flushPlaybackBeatsImmediately(beats);
        return;
    }
    beatQueue.push(...beats);
    runNextBeat();
}

function shouldPlaybackRunNow(): boolean {
    if (!uiState.playback.enabled) return false;
    if (uiState.currentScreen !== Screen.GAME) return false;
    if (!uiState.game) return false;
    if (uiState.replaySession) return false;
    if (uiState.verificationSession) return false;
    return true;
}

function beginPlaybackCapture(engine: GameEngine): PlaybackCapture | null {
    if (!shouldPlaybackRunNow()) return null;
    if (uiState.game !== engine) return null;
    return {
        beforeLocators: captureCardLocators(engine),
        beforeAnchorRects: snapshotMotionAnchorRects(),
    };
}

function finalizePlaybackCapture(engine: GameEngine, capture: PlaybackCapture | null): PlaybackBeat[] {
    if (typeof (engine as any).drainUiTraceEvents !== 'function') return [];
    const events = engine.drainUiTraceEvents();
    if (events.length === 0) return [];
    if (!shouldPlaybackRunNow()) return [];
    const beats = buildPlaybackBeats(events, uiState.playback.speed, {
        beforeLocators: capture?.beforeLocators,
        afterLocators: capture ? captureCardLocators(engine) : undefined,
        beforeAnchorRects: capture?.beforeAnchorRects,
    });
    enqueuePlaybackBeats(beats);
    return beats;
}

export function consumeEngineUiTraceEvents(engine: GameEngine): PlaybackBeat[] {
    return finalizePlaybackCapture(engine, null);
}

export function runEngineMutationWithPlayback<T>(
    engine: GameEngine,
    mutate: () => T,
    didMutate: (result: T) => boolean = () => true,
): T {
    const capture = beginPlaybackCapture(engine);
    const result = mutate();
    if (didMutate(result)) {
        finalizePlaybackCapture(engine, capture);
    }
    return result;
}

export function stepEngineActionWithPlayback(engine: GameEngine, action: EngineAction): boolean {
    return runEngineMutationWithPlayback(engine, () => engine.step(action), (ok) => ok === true);
}

export function setPlaybackSpeed(speed: PlaybackSpeed): void {
    uiState.playback.speed = speed;
    persistPlaybackPrefs({
        animationEnabled: uiState.playback.animationEnabled,
        speed,
    });
}

export function setPlaybackAnimationEnabled(enabled: boolean): void {
    uiState.playback.animationEnabled = enabled;
    persistPlaybackPrefs({
        animationEnabled: enabled,
        speed: uiState.playback.speed,
    });
    if (!enabled) {
        skipPlaybackQueue();
    }
}

export function isPlaybackQueueBusy(): boolean {
    return uiState.playback.queueBusy;
}

export function skipPlaybackQueue(): boolean {
    const hadPending = activeBeatTimer !== null || beatQueue.length > 0 || uiState.playback.activeMotionBeatId !== null;
    clearPlaybackMotionOverlay();
    if (activeBeatTimer !== null) {
        window.clearTimeout(activeBeatTimer);
        activeBeatTimer = null;
    }
    beatQueue.length = 0;
    uiState.playback.queueBusy = false;
    uiState.playback.modalGateUntilMs = 0;
    uiState.playback.activePulseTargets = [];
    uiState.playback.activeMotionBeatId = null;
    uiState.playback.toasts = [];
    uiState.render?.();
    return hadPending;
}

export function clearPlaybackRuntimeState(): void {
    if (activeBeatTimer !== null) {
        window.clearTimeout(activeBeatTimer);
        activeBeatTimer = null;
    }
    beatQueue.length = 0;
    uiState.playback.queueBusy = false;
    uiState.playback.modalGateUntilMs = 0;
    uiState.playback.toasts = [];
    uiState.playback.activePulseTargets = [];
    uiState.playback.activeMotionBeatId = null;
    clearPlaybackMotionOverlay();
}

export function clearPlaybackLogHistory(): void {
    uiState.playback.logEntries = [];
}

export function shouldDelayInteractionModal(interactionMode: GameState['interactionMode']): boolean {
    if (!MODAL_DELAY_INTERACTION_MODES.has(interactionMode)) return false;
    if (!uiState.playback.animationEnabled) return false;
    return Date.now() < uiState.playback.modalGateUntilMs;
}
