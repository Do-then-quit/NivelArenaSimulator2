import { EngineAction, GameState, UiTraceEvent, UiTraceEventType } from '../logic/types';
import { GameEngine } from '../logic/GameEngine';
import { PlaybackSpeed, PlaybackToast, Screen, uiState } from './appState';

export interface PlaybackBeat {
    id: string;
    eventType: UiTraceEventType;
    durationMs: number;
    modalGateMs: number;
    toastMessage?: string;
    pulseTargets: Array<{ playerId: string; zone: 'HAND' | 'DECK' | 'DAMAGE' }>;
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
    const toast: PlaybackToast = {
        id: `ptoast_${now.toString(36)}_${Math.floor(Math.random() * 1_000_000).toString(36)}`,
        message,
        createdAtMs: now,
        expiresAtMs: now + Math.max(900, durationMs * 2),
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

export function buildPlaybackBeats(events: UiTraceEvent[], speed: PlaybackSpeed): PlaybackBeat[] {
    const timing = getTiming(speed);
    return events.map((event) => {
        const toastMessage = buildToastMessage(event);
        const beat: PlaybackBeat = {
            id: nextBeatId(),
            eventType: event.type,
            durationMs: timing.beatMs,
            modalGateMs: event.type === 'INTERACTION_OPENED' ? timing.modalGateMs : 0,
            toastMessage: toastMessage ?? undefined,
            pulseTargets: buildPulseTargets(event),
        };
        return beat;
    });
}

function runNextBeat(): void {
    if (activeBeatTimer !== null) return;

    pruneExpiredToasts();

    const beat = beatQueue.shift();
    if (!beat) {
        uiState.playback.queueBusy = false;
        uiState.playback.activePulseTargets = [];
        uiState.render?.();
        return;
    }

    uiState.playback.queueBusy = true;
    if (beat.modalGateMs > 0) {
        uiState.playback.modalGateUntilMs = Math.max(uiState.playback.modalGateUntilMs, Date.now() + beat.modalGateMs);
    }
    if (beat.toastMessage) {
        appendToast(beat.toastMessage, beat.durationMs);
        appendPlaybackLog(beat.toastMessage);
    }
    uiState.playback.activePulseTargets = beat.pulseTargets;
    uiState.render?.();

    activeBeatTimer = window.setTimeout(() => {
        activeBeatTimer = null;
        uiState.playback.activePulseTargets = [];
        pruneExpiredToasts();
        if (beatQueue.length === 0) {
            uiState.playback.queueBusy = false;
        }
        uiState.render?.();
        runNextBeat();
    }, beat.durationMs);
}

export function enqueuePlaybackBeats(beats: PlaybackBeat[]): void {
    if (beats.length === 0) return;
    if (!uiState.playback.enabled) return;
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

export function consumeEngineUiTraceEvents(engine: GameEngine): PlaybackBeat[] {
    if (typeof (engine as any).drainUiTraceEvents !== 'function') return [];
    const events = engine.drainUiTraceEvents();
    if (events.length === 0) return [];
    if (!shouldPlaybackRunNow()) return [];
    const beats = buildPlaybackBeats(events, uiState.playback.speed);
    enqueuePlaybackBeats(beats);
    return beats;
}

export function stepEngineActionWithPlayback(engine: GameEngine, action: EngineAction): boolean {
    const ok = engine.step(action);
    if (ok) {
        consumeEngineUiTraceEvents(engine);
    }
    return ok;
}

export function setPlaybackSpeed(speed: PlaybackSpeed): void {
    uiState.playback.speed = speed;
}

export function isPlaybackQueueBusy(): boolean {
    return uiState.playback.queueBusy;
}

export function skipPlaybackQueue(): boolean {
    const hadPending = activeBeatTimer !== null || beatQueue.length > 0;
    if (!hadPending) return false;

    if (activeBeatTimer !== null) {
        window.clearTimeout(activeBeatTimer);
        activeBeatTimer = null;
    }
    beatQueue.length = 0;
    uiState.playback.queueBusy = false;
    uiState.playback.modalGateUntilMs = 0;
    uiState.playback.activePulseTargets = [];
    uiState.playback.toasts = [];
    uiState.render?.();
    return true;
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
}

export function clearPlaybackLogHistory(): void {
    uiState.playback.logEntries = [];
}

export function shouldDelayInteractionModal(interactionMode: GameState['interactionMode']): boolean {
    if (!MODAL_DELAY_INTERACTION_MODES.has(interactionMode)) return false;
    return Date.now() < uiState.playback.modalGateUntilMs;
}
