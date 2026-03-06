import { EngineAction, GameState, PendingEffect, UiTraceEvent, UiTraceEventType } from '../logic/types';
import { GameEngine } from '../logic/GameEngine';
import { PlaybackSpeed, PlaybackToast, Screen, uiState } from './appState';
import {
    ActionFxBeat,
    CardLocatorSnapshot,
    CardMoveRecord,
    CardMotionBeat,
    InteractionFocusBeat,
    MotionRectSnapshot,
    buildActionButtonAnchorKey,
    buildLeaderSlotAnchorKey,
    buildPhaseStatusAnchorKey,
    buildPlayerAreaAnchorKey,
    buildSelectionTrayAnchorKey,
    buildUnitZoneActionAnchorKey,
    captureCardLocators,
    clearPlaybackMotionOverlay,
    diffCardLocators,
    getLocatorAnchorKeys,
    isHandVisibleToViewer,
    playActionFxBeat,
    playCardMotionBeat,
    playInteractionFocusBeat,
    snapshotMotionAnchorRects,
} from './playbackMotion';
import { persistPlaybackPrefs } from './playbackPrefs';

export type PlaybackBeatEventType = UiTraceEventType | 'CARD_MOTION' | 'ACTION_FX' | 'INTERACTION_FOCUS';

export interface PlaybackBeat {
    id: string;
    eventType: PlaybackBeatEventType;
    durationMs: number;
    modalGateMs: number;
    toastMessage?: string;
    pulseTargets: Array<{ playerId: string; zone: 'HAND' | 'DECK' | 'DAMAGE' }>;
    motion?: CardMotionBeat;
    actionFx?: ActionFxBeat;
    interactionFocus?: InteractionFocusBeat;
}

interface PlaybackStateSnapshot {
    phase: GameState['phase'];
    interactionMode: GameState['interactionMode'];
    pendingAttackerIndex: number | null;
    pendingBlockerZoneIndex: number | null;
}

export interface PlaybackBeatBuildOptions {
    beforeLocators?: CardLocatorSnapshot;
    afterLocators?: CardLocatorSnapshot;
    beforeAnchorRects?: MotionRectSnapshot;
    action?: EngineAction | null;
    beforeState?: PlaybackStateSnapshot;
    afterState?: GameState | null;
    legalActions?: EngineAction[];
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
    beforeState: PlaybackStateSnapshot;
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
    return uiState.game?.state.players.find((player) => player.id === playerId)?.name ?? playerId;
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
    uiState.playback.toasts = uiState.playback.toasts.filter((toast) => toast.expiresAtMs > now);
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
        .filter((move) => move.source.zone === fromZone && move.target.zone === toZone && !!move.target.playerId)
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
        .filter((move) => direction === 'ENTER'
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

function resolveOpponentPlayerId(state: GameState | null | undefined, actorPlayerId: string | undefined): string | undefined {
    if (!state || !actorPlayerId) return undefined;
    return state.players.find((player) => player.id !== actorPlayerId)?.id;
}

function findCardLocator(card: unknown, locators: CardLocatorSnapshot | undefined) {
    if (!locators || !card || typeof card !== 'object') return null;
    return locators.get(card as any) ?? null;
}

function resolveZoneTargetAnchorKeys(playerId: string | undefined, zoneIndex: number | undefined): string[] {
    if (!playerId || !Number.isInteger(zoneIndex)) return [];
    return [buildUnitZoneActionAnchorKey(playerId, zoneIndex!)];
}

function resolveCardAnchorKeys(card: unknown, playerId: string | undefined, state: GameState | null | undefined, locators: CardLocatorSnapshot | undefined): string[] {
    const locator = findCardLocator(card, locators);
    if (locator) {
        if (locator.zone === 'HAND' && !isHandVisibleToViewer(locator.playerId)) {
            return locator.playerId ? [buildPlayerAreaAnchorKey(locator.playerId)] : [];
        }
        return getLocatorAnchorKeys(locator);
    }
    if (!state || !card || typeof card !== 'object') return playerId ? [buildPlayerAreaAnchorKey(playerId)] : [];

    const owner = playerId ? state.players.find((player) => player.id === playerId) ?? null : null;
    if (owner?.levelZone === card) return [buildLeaderSlotAnchorKey(owner.id)];

    for (const player of state.players) {
        for (let zoneIndex = 0; zoneIndex < player.unitZones.length; zoneIndex += 1) {
            const zone = player.unitZones[zoneIndex];
            if (zone === card || zone.unit === card || zone.items.includes(card as any)) {
                return [buildUnitZoneActionAnchorKey(player.id, zoneIndex)];
            }
        }
    }

    return playerId ? [buildPlayerAreaAnchorKey(playerId)] : [];
}

function resolveTargetEntityAnchorKeys(target: unknown, state: GameState | null | undefined, locators: CardLocatorSnapshot | undefined): string[] {
    if (!state || !target || typeof target !== 'object') return [];
    for (const player of state.players) {
        if (player.levelZone === target) return [buildLeaderSlotAnchorKey(player.id)];
        const locator = findCardLocator(target, locators);
        if (locator) return getLocatorAnchorKeys(locator);
        for (let zoneIndex = 0; zoneIndex < player.unitZones.length; zoneIndex += 1) {
            const zone = player.unitZones[zoneIndex];
            if (zone === target || zone.unit === target || zone.items.includes(target as any)) {
                return [buildUnitZoneActionAnchorKey(player.id, zoneIndex)];
            }
        }
    }
    return [];
}

function resolveSelectActionAnchorKeys(
    action: EngineAction,
    state: GameState | null | undefined,
    locators: CardLocatorSnapshot | undefined,
): string[] {
    if (!state) return [];
    switch (action.type) {
        case 'SELECT_ZONE_TARGET':
            return resolveZoneTargetAnchorKeys(action.targetPlayerId, action.zoneIndex);
        case 'SELECT_HAND_TARGET': {
            const player = state.players.find((entry) => entry.id === action.targetPlayerId);
            const targetCard = player?.hand[action.handIndex];
            if (!isHandVisibleToViewer(action.targetPlayerId)) {
                return [buildPlayerAreaAnchorKey(action.targetPlayerId)];
            }
            return targetCard
                ? resolveCardAnchorKeys(targetCard, action.targetPlayerId, state, locators)
                : [buildPlayerAreaAnchorKey(action.targetPlayerId)];
        }
        case 'SELECT_TRASH_TARGET': {
            const player = state.players.find((entry) => entry.id === action.targetPlayerId);
            const targetCard = player?.trash[action.trashIndex];
            return targetCard
                ? resolveCardAnchorKeys(targetCard, action.targetPlayerId, state, locators)
                : [buildSelectionTrayAnchorKey('trash', action.targetPlayerId)];
        }
        case 'SELECT_DAMAGE_TARGET': {
            const player = state.players.find((entry) => entry.id === action.targetPlayerId);
            const targetCard = player?.damage[action.damageIndex];
            return targetCard
                ? resolveCardAnchorKeys(targetCard, action.targetPlayerId, state, locators)
                : [buildPlayerAreaAnchorKey(action.targetPlayerId)];
        }
        case 'SELECT_ITEM_TARGET':
            return resolveZoneTargetAnchorKeys(action.targetPlayerId, action.zoneIndex);
        case 'SELECT_REVEALED_TARGET': {
            const targetCard = state.revealedCards[action.revealedIndex];
            return targetCard
                ? resolveCardAnchorKeys(targetCard, undefined, state, locators)
                : [buildSelectionTrayAnchorKey('revealed')];
        }
        default:
            return [];
    }
}

function dedupeAnchorKeys(anchorKeys: string[]): string[] {
    return [...new Set(anchorKeys.filter((key) => key.length > 0))];
}

function buildActionToastMessage(action: EngineAction, afterState: GameState | null | undefined): string {
    const playerName = getPlayerName(action.actorPlayerId);
    switch (action.type) {
        case 'ATTACK':
            return `${playerName} 공격 선언`;
        case 'RESOLVE_BLOCK':
            return action.shouldBlock ? `${playerName} 블록 선언` : `${playerName} 패스`;
        case 'ACTIVATE_EFFECT':
            return `${playerName} 액티브 발동`;
        case 'NEXT_PHASE':
            return afterState ? `${playerName} ${afterState.phase} 페이즈 진입` : `${playerName} 다음 페이즈`;
        default:
            return `${playerName} 행동`;
    }
}

function buildActionFxBeat(
    action: EngineAction | null | undefined,
    timing: PlaybackTiming,
    options: PlaybackBeatBuildOptions,
): PlaybackBeat | null {
    if (!action) return null;
    const actorPlayerId = action.actorPlayerId;
    const afterState = options.afterState;
    const beforeState = options.beforeState;
    let kind: ActionFxBeat['kind'] | null = null;
    let label = '';
    let sourceAnchorKeys: string[] = [];
    let targetAnchorKeys: string[] = [];
    let emphasisAnchorKeys: string[] = [];

    switch (action.type) {
        case 'ATTACK': {
            kind = 'ATTACK';
            label = 'ATTACK';
            sourceAnchorKeys = dedupeAnchorKeys([
                buildActionButtonAnchorKey('attack', actorPlayerId, action.attackerZoneIndex),
                buildUnitZoneActionAnchorKey(actorPlayerId, action.attackerZoneIndex),
            ]);
            const opponentPlayerId = resolveOpponentPlayerId(afterState, actorPlayerId);
            targetAnchorKeys = resolveZoneTargetAnchorKeys(opponentPlayerId, action.attackerZoneIndex);
            emphasisAnchorKeys = sourceAnchorKeys;
            break;
        }
        case 'RESOLVE_BLOCK': {
            if (action.shouldBlock && Number.isInteger(action.blockerZoneIndex)) {
                const blockerZoneIndex = action.blockerZoneIndex as number;
                kind = 'BLOCK';
                label = 'BLOCK';
                sourceAnchorKeys = dedupeAnchorKeys([
                    buildActionButtonAnchorKey('block', actorPlayerId, blockerZoneIndex),
                    buildUnitZoneActionAnchorKey(actorPlayerId, blockerZoneIndex),
                ]);
                const targetPlayerId = resolveOpponentPlayerId(afterState, actorPlayerId);
                const targetIndex = beforeState?.pendingAttackerIndex ?? afterState?.pendingAttackerIndex ?? null;
                targetAnchorKeys = resolveZoneTargetAnchorKeys(targetPlayerId, targetIndex ?? undefined);
                emphasisAnchorKeys = sourceAnchorKeys;
            } else {
                kind = 'PASS';
                label = 'PASS';
                const laneIndex = beforeState?.pendingAttackerIndex ?? afterState?.pendingAttackerIndex ?? undefined;
                sourceAnchorKeys = dedupeAnchorKeys([
                    buildActionButtonAnchorKey('pass', actorPlayerId, laneIndex),
                    buildPlayerAreaAnchorKey(actorPlayerId),
                ]);
                emphasisAnchorKeys = [buildPlayerAreaAnchorKey(actorPlayerId)];
            }
            break;
        }
        case 'ACTIVATE_EFFECT': {
            kind = 'ACTIVATE';
            label = 'ACTIVE';
            if (action.sourceType === 'LEADER') {
                sourceAnchorKeys = dedupeAnchorKeys([
                    buildActionButtonAnchorKey('leader-activate', actorPlayerId),
                    buildLeaderSlotAnchorKey(actorPlayerId),
                ]);
                emphasisAnchorKeys = [buildLeaderSlotAnchorKey(actorPlayerId)];
            } else {
                sourceAnchorKeys = dedupeAnchorKeys([
                    buildActionButtonAnchorKey('activate', actorPlayerId, action.zoneIndex),
                    buildUnitZoneActionAnchorKey(actorPlayerId, action.zoneIndex),
                ]);
                emphasisAnchorKeys = [buildUnitZoneActionAnchorKey(actorPlayerId, action.zoneIndex)];
            }
            break;
        }
        case 'NEXT_PHASE': {
            kind = 'NEXT_PHASE';
            label = afterState?.phase ?? 'NEXT';
            sourceAnchorKeys = dedupeAnchorKeys([
                buildActionButtonAnchorKey('next-phase'),
                buildPhaseStatusAnchorKey(),
            ]);
            targetAnchorKeys = [buildPhaseStatusAnchorKey()];
            emphasisAnchorKeys = [buildPhaseStatusAnchorKey()];
            break;
        }
        default:
            return null;
    }

    return {
        id: nextBeatId(),
        eventType: 'ACTION_FX',
        durationMs: timing.beatMs,
        modalGateMs: 0,
        toastMessage: buildActionToastMessage(action, afterState),
        pulseTargets: [],
        actionFx: {
            id: nextBeatId(),
            kind,
            label,
            sourceAnchorKeys,
            targetAnchorKeys,
            emphasisAnchorKeys,
            sourceRect: resolveSourceRect(sourceAnchorKeys, options.beforeAnchorRects),
            targetRect: resolveSourceRect(targetAnchorKeys, options.beforeAnchorRects),
        },
    };
}

function buildInteractionFocusLabel(interactionMode: GameState['interactionMode'], pending: PendingEffect | null): string {
    if (interactionMode === 'SELECT_COST') return 'COST';
    if (interactionMode === 'SELECT_OPTIONAL') return 'OPTION';
    if (pending?.validTargets === 'REVEALED') return 'REVEALED';
    if (pending?.validTargets === 'MY_TRASH') return 'TRASH';
    return 'SELECT';
}

function buildInteractionFocusBeat(
    timing: PlaybackTiming,
    options: PlaybackBeatBuildOptions,
): PlaybackBeat | null {
    const afterState = options.afterState;
    if (!afterState) return null;
    if (!MODAL_DELAY_INTERACTION_MODES.has(afterState.interactionMode)) return null;
    const pending = afterState.pendingEffect;
    if (!pending) return null;
    const sourceAnchorKeys = resolveCardAnchorKeys(
        pending.sourceCard,
        pending.sourcePlayerId,
        afterState,
        options.afterLocators,
    );
    const targetAnchorKeys = dedupeAnchorKeys(
        (options.legalActions ?? []).flatMap((action) => resolveSelectActionAnchorKeys(action, afterState, options.afterLocators)),
    );
    const selectedAnchorKeys = dedupeAnchorKeys(
        Array.isArray(pending.selectedTargets)
            ? pending.selectedTargets.flatMap((target) => resolveTargetEntityAnchorKeys(target, afterState, options.afterLocators))
            : [],
    );
    const hasMeaningfulFocus = sourceAnchorKeys.length > 0 || targetAnchorKeys.length > 0 || selectedAnchorKeys.length > 0;
    if (!hasMeaningfulFocus) return null;

    return {
        id: nextBeatId(),
        eventType: 'INTERACTION_FOCUS',
        durationMs: timing.beatMs,
        modalGateMs: timing.modalGateMs,
        toastMessage: undefined,
        pulseTargets: [],
        interactionFocus: {
            id: nextBeatId(),
            label: buildInteractionFocusLabel(afterState.interactionMode, pending),
            sourceAnchorKeys,
            targetAnchorKeys,
            selectedAnchorKeys,
            sourceRect: resolveSourceRect(sourceAnchorKeys, options.beforeAnchorRects),
        },
    };
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

    const actionBeat = buildActionFxBeat(options.action, timing, options);
    if (actionBeat) {
        beats.push(actionBeat);
    }

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
            const focusBeat = buildInteractionFocusBeat(timing, options);
            if (focusBeat) {
                beats.push(focusBeat);
            }
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

function playActionIfNeeded(beat: PlaybackBeat): void {
    if (!beat.actionFx || !uiState.playback.animationEnabled) return;
    window.requestAnimationFrame(() => {
        playActionFxBeat(beat.actionFx!, beat.durationMs);
    });
}

function playInteractionFocusIfNeeded(beat: PlaybackBeat): void {
    if (!beat.interactionFocus || !uiState.playback.animationEnabled) return;
    window.requestAnimationFrame(() => {
        playInteractionFocusBeat(beat.interactionFocus!, beat.durationMs);
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
        uiState.playback.activeActionBeatId = null;
        uiState.playback.activeInteractionBeatId = null;
        uiState.render?.();
        return;
    }

    uiState.playback.queueBusy = true;
    uiState.playback.activeMotionBeatId = beat.motion?.id ?? null;
    uiState.playback.activeActionBeatId = beat.actionFx?.id ?? null;
    uiState.playback.activeInteractionBeatId = beat.interactionFocus?.id ?? null;
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
    playActionIfNeeded(beat);
    playInteractionFocusIfNeeded(beat);

    activeBeatTimer = window.setTimeout(() => {
        activeBeatTimer = null;
        uiState.playback.activePulseTargets = [];
        uiState.playback.activeMotionBeatId = null;
        uiState.playback.activeActionBeatId = null;
        uiState.playback.activeInteractionBeatId = null;
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
    uiState.playback.activeActionBeatId = null;
    uiState.playback.activeInteractionBeatId = null;
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

function capturePlaybackState(engine: GameEngine): PlaybackStateSnapshot {
    return {
        phase: engine.state.phase,
        interactionMode: engine.state.interactionMode,
        pendingAttackerIndex: engine.state.pendingAttackerIndex,
        pendingBlockerZoneIndex: engine.state.pendingBlockerZoneIndex,
    };
}

function beginPlaybackCapture(engine: GameEngine): PlaybackCapture | null {
    if (!shouldPlaybackRunNow()) return null;
    if (uiState.game !== engine) return null;
    return {
        beforeLocators: captureCardLocators(engine),
        beforeAnchorRects: snapshotMotionAnchorRects(),
        beforeState: capturePlaybackState(engine),
    };
}

function finalizePlaybackCapture(engine: GameEngine, capture: PlaybackCapture | null, action?: EngineAction | null): PlaybackBeat[] {
    if (typeof (engine as any).drainUiTraceEvents !== 'function') return [];
    const events = engine.drainUiTraceEvents();
    if (events.length === 0 && !action) return [];
    if (!shouldPlaybackRunNow()) return [];
    const actorId = engine.state.interactionOwnerPlayerId ?? engine.currentPlayer.id;
    const beats = buildPlaybackBeats(events, uiState.playback.speed, {
        beforeLocators: capture?.beforeLocators,
        afterLocators: capture ? captureCardLocators(engine) : undefined,
        beforeAnchorRects: capture?.beforeAnchorRects,
        action,
        beforeState: capture?.beforeState,
        afterState: engine.state,
        legalActions: engine.getLegalActions(actorId),
    });
    enqueuePlaybackBeats(beats);
    return beats;
}

export function consumeEngineUiTraceEvents(engine: GameEngine): PlaybackBeat[] {
    return finalizePlaybackCapture(engine, null, null);
}

export function runEngineMutationWithPlayback<T>(
    engine: GameEngine,
    mutate: () => T,
    didMutate: (result: T) => boolean = () => true,
    action?: EngineAction | null,
): T {
    const capture = beginPlaybackCapture(engine);
    const result = mutate();
    if (didMutate(result)) {
        finalizePlaybackCapture(engine, capture, action);
    }
    return result;
}

export function stepEngineActionWithPlayback(engine: GameEngine, action: EngineAction): boolean {
    return runEngineMutationWithPlayback(engine, () => engine.step(action), (ok) => ok === true, action);
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
    const hadPending = activeBeatTimer !== null
        || beatQueue.length > 0
        || uiState.playback.activeMotionBeatId !== null
        || uiState.playback.activeActionBeatId !== null
        || uiState.playback.activeInteractionBeatId !== null;
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
    uiState.playback.activeActionBeatId = null;
    uiState.playback.activeInteractionBeatId = null;
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
    uiState.playback.activeActionBeatId = null;
    uiState.playback.activeInteractionBeatId = null;
    uiState.playback.pendingAutoPhaseActorId = null;
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
