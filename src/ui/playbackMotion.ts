import { Card } from '../logic/types';
import { GameEngine } from '../logic/GameEngine';
import { uiState } from './appState';
import { renderCard, renderHiddenHandCard } from './cardMarkup';

export type CardMotionZone = 'DECK' | 'HAND' | 'DAMAGE' | 'TRASH' | 'SKILL' | 'REVEALED';
export type CardMotionType = 'DRAW' | 'DAMAGE_REVEAL' | 'REVEAL_ENTER' | 'REVEAL_EXIT';
export type CardMotionFace = 'BACK' | 'FRONT';
export type ActionFxKind = 'ATTACK' | 'BLOCK' | 'ACTIVATE' | 'PASS' | 'NEXT_PHASE';
export type ActionAnchorKey = string;

export interface CardLocator {
    playerId?: string;
    zone: CardMotionZone;
    slotIndex: number;
    motionKey: string;
}

export type CardLocatorSnapshot = Map<Card, CardLocator>;

export interface CardMoveRecord {
    card: Card;
    source: CardLocator;
    target: CardLocator;
}

export interface MotionRect {
    left: number;
    top: number;
    width: number;
    height: number;
}

export type MotionRectSnapshot = Map<string, MotionRect>;

export interface CardMotionBeat {
    id: string;
    motionType: CardMotionType;
    motionKey: string;
    card: Card;
    source: CardLocator;
    target: CardLocator;
    sourceFace: CardMotionFace;
    flipToFront: boolean;
    sourceRect: MotionRect | null;
    sourceAnchorKeys: string[];
    targetAnchorKeys: string[];
}

export interface ActionFxBeat {
    id: string;
    kind: ActionFxKind;
    label: string;
    sourceAnchorKeys: string[];
    targetAnchorKeys: string[];
    emphasisAnchorKeys: string[];
    phaseFrom?: string | null;
    phaseTo?: string | null;
    sourceRect: MotionRect | null;
    targetRect: MotionRect | null;
}

export interface InteractionFocusBeat {
    id: string;
    label: string;
    sourceAnchorKeys: string[];
    targetAnchorKeys: string[];
    selectedAnchorKeys: string[];
    sourceRect: MotionRect | null;
}

let motionKeyCounter = 0;
let motionKeyRegistry = new WeakMap<object, string>();

function nextMotionKey(): string {
    motionKeyCounter += 1;
    return `cmk_${motionKeyCounter.toString(36)}`;
}

export function resetCardMotionRegistry(): void {
    motionKeyCounter = 0;
    motionKeyRegistry = new WeakMap<object, string>();
}

export function getCardMotionKey(card: Card): string {
    const existing = motionKeyRegistry.get(card as unknown as object);
    if (existing) return existing;
    const key = nextMotionKey();
    motionKeyRegistry.set(card as unknown as object, key);
    return key;
}

export function buildCardAnchorKey(motionKey: string): string {
    return `card:${motionKey}`;
}

export function buildZoneAnchorKey(zone: CardMotionZone, playerId?: string): string {
    return `zone:${playerId ?? 'shared'}:${zone}`;
}

export function buildActionAnchorKey(...parts: Array<string | number | undefined | null>): ActionAnchorKey {
    return `action:${parts.filter((part) => part !== undefined && part !== null && `${part}`.length > 0).join(':')}`;
}

export function buildPlayerAreaAnchorKey(playerId: string): ActionAnchorKey {
    return buildActionAnchorKey('player-area', playerId);
}

export function buildLeaderSlotAnchorKey(playerId: string): ActionAnchorKey {
    return buildActionAnchorKey('leader-slot', playerId);
}

export function buildUnitZoneActionAnchorKey(playerId: string, zoneIndex: number): ActionAnchorKey {
    return buildActionAnchorKey('unit-zone', playerId, zoneIndex);
}

export function buildActionButtonAnchorKey(
    kind: 'attack' | 'block' | 'pass' | 'activate' | 'leader-activate' | 'next-phase',
    playerId?: string,
    zoneIndex?: number,
): ActionAnchorKey {
    return buildActionAnchorKey('button', kind, playerId, zoneIndex);
}

export function buildPhaseStatusAnchorKey(): ActionAnchorKey {
    return buildActionAnchorKey('status', 'phase');
}

export function buildPhaseStepAnchorKey(phase: string): ActionAnchorKey {
    return buildActionAnchorKey('phase-step', phase);
}

export function buildSelectionTrayAnchorKey(kind: 'revealed' | 'trash', playerId?: string): ActionAnchorKey {
    return buildActionAnchorKey('selection-tray', kind, playerId);
}

export function getLocatorAnchorKeys(locator: CardLocator): string[] {
    return [
        buildCardAnchorKey(locator.motionKey),
        buildZoneAnchorKey(locator.zone, locator.playerId),
    ];
}

function rectToSnapshot(rect: DOMRect): MotionRect {
    return {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
    };
}

function queryAnchorElement(anchorKey: string): HTMLElement | null {
    return document.querySelector<HTMLElement>(
        `[data-motion-anchor-key="${anchorKey}"], [data-action-anchor-key="${anchorKey}"]`,
    );
}

function queryAnchorRect(anchorKeys: string[]): MotionRect | null {
    for (const key of anchorKeys) {
        const element = queryAnchorElement(key);
        if (!element) continue;
        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) continue;
        return rectToSnapshot(rect);
    }
    return null;
}

function queryAnchorElements(anchorKeys: string[]): HTMLElement[] {
    const elements: HTMLElement[] = [];
    const seen = new Set<HTMLElement>();
    anchorKeys.forEach((key) => {
        const element = queryAnchorElement(key);
        if (!element || seen.has(element)) return;
        seen.add(element);
        elements.push(element);
    });
    return elements;
}

function snapshotActionAnchorRects(root: ParentNode = document): MotionRectSnapshot {
    const snapshot: MotionRectSnapshot = new Map();
    const elements = root.querySelectorAll<HTMLElement>('[data-action-anchor-key]');
    elements.forEach((element) => {
        const key = element.dataset.actionAnchorKey;
        if (!key) return;
        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        snapshot.set(key, rectToSnapshot(rect));
    });
    return snapshot;
}

export function snapshotMotionAnchorRects(root: ParentNode = document): MotionRectSnapshot {
    const snapshot: MotionRectSnapshot = new Map();
    root.querySelectorAll<HTMLElement>('[data-motion-anchor-key]').forEach((element) => {
        const key = element.dataset.motionAnchorKey;
        if (!key) return;
        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        snapshot.set(key, rectToSnapshot(rect));
    });
    snapshotActionAnchorRects(root).forEach((rect, key) => {
        snapshot.set(key, rect);
    });
    return snapshot;
}

export function captureCardLocators(engine: GameEngine): CardLocatorSnapshot {
    const snapshot: CardLocatorSnapshot = new Map();
    const assignCards = (cards: Card[], zone: CardMotionZone, playerId?: string) => {
        cards.forEach((card, slotIndex) => {
            snapshot.set(card, {
                playerId,
                zone,
                slotIndex,
                motionKey: getCardMotionKey(card),
            });
        });
    };

    engine.state.players.forEach((player) => {
        assignCards(player.deck, 'DECK', player.id);
        assignCards(player.hand, 'HAND', player.id);
        assignCards(player.damage, 'DAMAGE', player.id);
        assignCards(player.trash, 'TRASH', player.id);
        assignCards(player.skillZone, 'SKILL', player.id);
    });
    assignCards(engine.state.revealedCards, 'REVEALED');

    return snapshot;
}

export function diffCardLocators(before: CardLocatorSnapshot, after: CardLocatorSnapshot): CardMoveRecord[] {
    const moves: CardMoveRecord[] = [];
    before.forEach((source, card) => {
        const target = after.get(card);
        if (!target) return;
        const sameLocation = source.zone === target.zone
            && source.playerId === target.playerId
            && source.slotIndex === target.slotIndex;
        if (sameLocation) return;
        moves.push({ card, source, target });
    });
    return moves;
}

function isBotControlledPlayerForView(playerId: string): boolean {
    if (uiState.replaySession?.playerBotModelById[playerId]) return true;
    return uiState.botByPlayerId.has(playerId);
}

export function isHandVisibleToViewer(playerId: string | undefined): boolean {
    if (!playerId) return false;
    if (uiState.onlineSession.room?.phase === 'IN_GAME') {
        return uiState.onlineSession.localEnginePlayerId === playerId;
    }
    if (uiState.activeMatchViewConfig.revealBotHand) return true;
    return !isBotControlledPlayerForView(playerId);
}

function buildRingMarkup(rect: MotionRect, roleClass: string): string {
    return `
        <div
            class="fx-action-ring ${roleClass}"
            style="left:${rect.left}px; top:${rect.top}px; width:${rect.width}px; height:${rect.height}px;"
        ></div>
    `;
}

function expandRect(rect: MotionRect, horizontalPadding: number, verticalPadding: number = horizontalPadding): MotionRect {
    return {
        left: rect.left - horizontalPadding,
        top: rect.top - verticalPadding,
        width: rect.width + (horizontalPadding * 2),
        height: rect.height + (verticalPadding * 2),
    };
}

function buildWashMarkup(rect: MotionRect, roleClass: string): string {
    const expandedRect = expandRect(
        rect,
        Math.max(16, Math.round(rect.width * 0.12)),
        Math.max(16, Math.round(rect.height * 0.18)),
    );
    return `
        <div
            class="fx-action-wash ${roleClass}"
            style="left:${expandedRect.left}px; top:${expandedRect.top}px; width:${expandedRect.width}px; height:${expandedRect.height}px;"
        ></div>
    `;
}

function buildTrailMarkup(sourceRect: MotionRect, targetRect: MotionRect): string {
    const sourceX = sourceRect.left + sourceRect.width / 2;
    const sourceY = sourceRect.top + sourceRect.height / 2;
    const targetX = targetRect.left + targetRect.width / 2;
    const targetY = targetRect.top + targetRect.height / 2;
    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    const length = Math.sqrt((dx * dx) + (dy * dy));
    const angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
    return `
        <div
            class="fx-action-trail"
            style="left:${sourceX}px; top:${sourceY}px; width:${length}px; transform:rotate(${angleDeg}deg);"
        ></div>
    `;
}

function buildArrowheadMarkup(sourceRect: MotionRect, targetRect: MotionRect): string {
    const sourceX = sourceRect.left + sourceRect.width / 2;
    const sourceY = sourceRect.top + sourceRect.height / 2;
    const targetX = targetRect.left + targetRect.width / 2;
    const targetY = targetRect.top + targetRect.height / 2;
    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    const angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
    const length = Math.sqrt((dx * dx) + (dy * dy));
    const size = Math.max(18, Math.min(34, Math.round(length * 0.12)));
    return `
        <div
            class="fx-action-arrowhead"
            style="left:${targetX}px; top:${targetY}px; width:${size}px; height:${size}px; transform:translate(-58%, -50%) rotate(${angleDeg}deg);"
        ></div>
    `;
}

function buildImpactMarkup(rect: MotionRect, roleClass: string): string {
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const size = Math.max(44, Math.round(Math.max(rect.width, rect.height) * 1.14));
    return `
        <div
            class="fx-action-impact ${roleClass}"
            style="left:${centerX - (size / 2)}px; top:${centerY - (size / 2)}px; width:${size}px; height:${size}px;"
        ></div>
    `;
}

class PlaybackMotionOverlayController {
    private root: HTMLElement | null = null;
    private motionLayer: HTMLElement | null = null;
    private actionLayer: HTMLElement | null = null;
    private focusLayer: HTMLElement | null = null;
    private cleanupTimerIds: number[] = [];
    private classCleanups: Array<() => void> = [];

    playCardMotion(beat: CardMotionBeat, durationMs: number): boolean {
        const sourceRect = beat.sourceRect ?? queryAnchorRect(beat.sourceAnchorKeys);
        const targetRect = queryAnchorRect(beat.targetAnchorKeys);
        if (!sourceRect || !targetRect) return false;
        if (sourceRect.width <= 0 || sourceRect.height <= 0 || targetRect.width <= 0 || targetRect.height <= 0) return false;

        const layer = this.ensureMotionLayer();
        const shell = document.createElement('div');
        shell.className = 'fx-motion-card-shell';
        shell.style.left = `${sourceRect.left}px`;
        shell.style.top = `${sourceRect.top}px`;
        shell.style.width = `${sourceRect.width}px`;
        shell.style.height = `${sourceRect.height}px`;
        shell.innerHTML = `
            <div class="fx-motion-card-body ${beat.sourceFace === 'FRONT' ? 'is-front' : ''}">
                <div class="fx-motion-card-face fx-motion-card-face-back">
                    ${renderHiddenHandCard(true)}
                </div>
                <div class="fx-motion-card-face fx-motion-card-face-front">
                    ${renderCard(beat.card, true)}
                </div>
            </div>
        `;
        layer.appendChild(shell);

        const deltaX = targetRect.left - sourceRect.left;
        const deltaY = targetRect.top - sourceRect.top;
        const scaleX = sourceRect.width > 0 ? targetRect.width / sourceRect.width : 1;
        const scaleY = sourceRect.height > 0 ? targetRect.height / sourceRect.height : 1;
        const motionBody = shell.querySelector<HTMLElement>('.fx-motion-card-body');

        window.requestAnimationFrame(() => {
            shell.style.transitionDuration = `${durationMs}ms`;
            shell.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY})`;
        });

        if (beat.flipToFront && motionBody) {
            const flipTimer = window.setTimeout(() => {
                motionBody.classList.add('is-front');
            }, Math.max(40, Math.round(durationMs * 0.45)));
            this.cleanupTimerIds.push(flipTimer);
        }

        const cleanupTimer = window.setTimeout(() => {
            shell.remove();
        }, Math.max(80, durationMs + 50));
        this.cleanupTimerIds.push(cleanupTimer);
        return true;
    }

    playActionFx(beat: ActionFxBeat, durationMs: number): boolean {
        const sourceRect = beat.sourceRect ?? queryAnchorRect(beat.sourceAnchorKeys);
        const targetRect = beat.targetRect ?? queryAnchorRect(beat.targetAnchorKeys);
        const emphasisRects = beat.emphasisAnchorKeys
            .map((key) => queryAnchorRect([key]))
            .filter((rect): rect is MotionRect => rect !== null);
        const sourceElements = queryAnchorElements(beat.sourceAnchorKeys);
        const targetElements = queryAnchorElements(beat.targetAnchorKeys);
        const emphasisElements = queryAnchorElements(beat.emphasisAnchorKeys);
        if (!sourceRect && !targetRect && emphasisRects.length === 0) return false;

        const layer = this.ensureActionLayer();
        const shell = document.createElement('div');
        shell.className = `fx-action-shell is-${beat.kind.toLowerCase()}`;
        shell.style.setProperty('--fx-beat-ms', `${durationMs}ms`);
        const anchorRect = sourceRect ?? targetRect ?? emphasisRects[0];
        const kindClass = `fx-action-kind-${beat.kind.toLowerCase().replace(/_/g, '-')}`;
        const localCleanups: Array<() => void> = [];
        const burstRect = beat.kind === 'ACTIVATE'
            ? (sourceRect ?? targetRect ?? emphasisRects[0])
            : (targetRect ?? sourceRect ?? emphasisRects[0]);
        shell.innerHTML = `
            ${sourceRect ? buildWashMarkup(sourceRect, 'is-source') : ''}
            ${targetRect ? buildWashMarkup(targetRect, 'is-target') : ''}
            ${emphasisRects.map((rect) => buildWashMarkup(rect, 'is-emphasis')).join('')}
            ${sourceRect ? buildRingMarkup(sourceRect, 'is-source') : ''}
            ${targetRect ? buildRingMarkup(targetRect, 'is-target') : ''}
            ${sourceRect && targetRect ? buildTrailMarkup(sourceRect, targetRect) : ''}
            ${sourceRect && targetRect ? buildArrowheadMarkup(sourceRect, targetRect) : ''}
            ${emphasisRects.map((rect) => buildRingMarkup(rect, 'is-emphasis')).join('')}
            ${burstRect ? buildImpactMarkup(burstRect, beat.kind === 'BLOCK' ? 'is-block' : beat.kind === 'PASS' ? 'is-pass' : 'is-primary') : ''}
            <div class="fx-action-badge" style="left:${anchorRect.left + (anchorRect.width / 2)}px; top:${anchorRect.top - 18}px;">
                ${beat.label}
            </div>
        `;
        layer.appendChild(shell);

        sourceElements.forEach((element) => {
            this.trackElementClass(element, 'fx-action-source', localCleanups);
            this.trackElementClass(element, kindClass, localCleanups);
        });
        targetElements.forEach((element) => {
            this.trackElementClass(element, 'fx-action-target', localCleanups);
            this.trackElementClass(element, kindClass, localCleanups);
        });
        emphasisElements.forEach((element) => {
            this.trackElementClass(element, 'fx-action-emphasis', localCleanups);
            this.trackElementClass(element, kindClass, localCleanups);
        });

        window.requestAnimationFrame(() => {
            shell.classList.add('is-active');
        });

        const cleanupTimer = window.setTimeout(() => {
            shell.remove();
            this.flushCleanupGroup(localCleanups);
        }, Math.max(80, durationMs + 80));
        this.cleanupTimerIds.push(cleanupTimer);
        return true;
    }

    playInteractionFocus(beat: InteractionFocusBeat, durationMs: number): boolean {
        const sourceRect = beat.sourceRect ?? queryAnchorRect(beat.sourceAnchorKeys);
        const targetRects = beat.targetAnchorKeys
            .map((key) => queryAnchorRect([key]))
            .filter((rect): rect is MotionRect => rect !== null);
        const sourceElements = queryAnchorElements(beat.sourceAnchorKeys);
        const targetElements = queryAnchorElements(beat.targetAnchorKeys);
        const selectedElements = queryAnchorElements(beat.selectedAnchorKeys);
        if (!sourceRect && targetRects.length === 0 && sourceElements.length === 0 && targetElements.length === 0) return false;

        const layer = this.ensureFocusLayer();
        const shell = document.createElement('div');
        shell.className = 'fx-interaction-shell';
        shell.style.setProperty('--fx-beat-ms', `${durationMs}ms`);
        const anchorRect = sourceRect ?? targetRects[0];
        const localCleanups: Array<() => void> = [];
        shell.innerHTML = `
            ${sourceRect ? buildRingMarkup(sourceRect, 'is-source') : ''}
            ${targetRects.map((rect) => buildRingMarkup(rect, 'is-target')).join('')}
            <div class="fx-interaction-badge" style="left:${anchorRect.left + (anchorRect.width / 2)}px; top:${anchorRect.top - 18}px;">
                ${beat.label}
            </div>
        `;
        layer.appendChild(shell);

        document.body.classList.add('fx-interaction-focus-active');
        this.trackCleanup(() => document.body.classList.remove('fx-interaction-focus-active'), localCleanups);

        sourceElements.forEach((element) => {
            this.trackElementClass(element, 'fx-focus-source', localCleanups);
        });
        targetElements.forEach((element) => {
            this.trackElementClass(element, 'fx-focus-target', localCleanups);
        });
        selectedElements.forEach((element) => {
            this.trackElementClass(element, 'fx-focus-selected', localCleanups);
        });

        window.requestAnimationFrame(() => {
            shell.classList.add('is-active');
        });

        const cleanupTimer = window.setTimeout(() => {
            shell.remove();
            this.flushCleanupGroup(localCleanups);
        }, Math.max(80, durationMs + 80));
        this.cleanupTimerIds.push(cleanupTimer);
        return true;
    }

    pulseActionAnchor(anchorKey: ActionAnchorKey, durationMs: number = 220): boolean {
        const element = queryAnchorElement(anchorKey);
        if (!element) return false;
        element.classList.add('fx-action-anchor-pressed');
        const cleanupTimer = window.setTimeout(() => {
            element.classList.remove('fx-action-anchor-pressed');
        }, Math.max(120, durationMs));
        this.cleanupTimerIds.push(cleanupTimer);
        return true;
    }

    clear(): void {
        this.cleanupTimerIds.forEach((timerId) => window.clearTimeout(timerId));
        this.cleanupTimerIds = [];
        this.flushClassCleanups();
        if (this.motionLayer) this.motionLayer.innerHTML = '';
        if (this.actionLayer) this.actionLayer.innerHTML = '';
        if (this.focusLayer) this.focusLayer.innerHTML = '';
    }

    private flushClassCleanups(): void {
        this.classCleanups.forEach((cleanup) => cleanup());
        this.classCleanups = [];
    }

    private flushCleanupGroup(cleanups: Array<() => void>): void {
        cleanups.forEach((cleanup) => cleanup());
        cleanups.length = 0;
    }

    private trackCleanup(cleanup: () => void, localCleanups: Array<() => void>): void {
        let flushed = false;
        const wrapped = () => {
            if (flushed) return;
            flushed = true;
            cleanup();
            this.classCleanups = this.classCleanups.filter((entry) => entry !== wrapped);
        };
        this.classCleanups.push(wrapped);
        localCleanups.push(wrapped);
    }

    private trackElementClass(element: HTMLElement, className: string, localCleanups: Array<() => void>): void {
        element.classList.add(className);
        this.trackCleanup(() => element.classList.remove(className), localCleanups);
    }

    private ensureRoot(): HTMLElement {
        if (this.root) return this.root;
        const root = document.createElement('div');
        root.className = 'fx-overlay-root';
        document.body.appendChild(root);
        this.root = root;
        return root;
    }

    private ensureMotionLayer(): HTMLElement {
        if (this.motionLayer) return this.motionLayer;
        const layer = document.createElement('div');
        layer.className = 'fx-motion-layer';
        this.ensureRoot().appendChild(layer);
        this.motionLayer = layer;
        return layer;
    }

    private ensureActionLayer(): HTMLElement {
        if (this.actionLayer) return this.actionLayer;
        const layer = document.createElement('div');
        layer.className = 'fx-action-layer';
        this.ensureRoot().appendChild(layer);
        this.actionLayer = layer;
        return layer;
    }

    private ensureFocusLayer(): HTMLElement {
        if (this.focusLayer) return this.focusLayer;
        const layer = document.createElement('div');
        layer.className = 'fx-interaction-layer';
        this.ensureRoot().appendChild(layer);
        this.focusLayer = layer;
        return layer;
    }
}

const playbackMotionOverlayController = new PlaybackMotionOverlayController();

export function playCardMotionBeat(beat: CardMotionBeat, durationMs: number): boolean {
    return playbackMotionOverlayController.playCardMotion(beat, durationMs);
}

export function playActionFxBeat(beat: ActionFxBeat, durationMs: number): boolean {
    return playbackMotionOverlayController.playActionFx(beat, durationMs);
}

export function playInteractionFocusBeat(beat: InteractionFocusBeat, durationMs: number): boolean {
    return playbackMotionOverlayController.playInteractionFocus(beat, durationMs);
}

export function triggerActionAnchorPress(anchorKey: ActionAnchorKey, durationMs: number = 220): boolean {
    return playbackMotionOverlayController.pulseActionAnchor(anchorKey, durationMs);
}

export function clearPlaybackMotionOverlay(): void {
    playbackMotionOverlayController.clear();
}
