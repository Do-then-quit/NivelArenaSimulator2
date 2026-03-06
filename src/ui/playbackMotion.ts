import { Card } from '../logic/types';
import { GameEngine } from '../logic/GameEngine';
import { uiState } from './appState';
import { renderCard, renderHiddenHandCard } from './cardMarkup';

export type CardMotionZone = 'DECK' | 'HAND' | 'DAMAGE' | 'TRASH' | 'SKILL' | 'REVEALED';
export type CardMotionType = 'DRAW' | 'DAMAGE_REVEAL' | 'REVEAL_ENTER' | 'REVEAL_EXIT';
export type CardMotionFace = 'BACK' | 'FRONT';

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

export function snapshotMotionAnchorRects(root: ParentNode = document): MotionRectSnapshot {
    const snapshot: MotionRectSnapshot = new Map();
    const elements = root.querySelectorAll<HTMLElement>('[data-motion-anchor-key]');
    elements.forEach((element) => {
        const key = element.dataset.motionAnchorKey;
        if (!key) return;
        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        snapshot.set(key, rectToSnapshot(rect));
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

function queryAnchorRect(anchorKeys: string[]): MotionRect | null {
    for (const key of anchorKeys) {
        const element = document.querySelector<HTMLElement>(`[data-motion-anchor-key="${key}"]`);
        if (!element) continue;
        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) continue;
        return rectToSnapshot(rect);
    }
    return null;
}

class PlaybackMotionOverlayController {
    private layer: HTMLElement | null = null;
    private cleanupTimerIds: number[] = [];

    play(beat: CardMotionBeat, durationMs: number): boolean {
        const sourceRect = beat.sourceRect ?? queryAnchorRect(beat.sourceAnchorKeys);
        const targetRect = queryAnchorRect(beat.targetAnchorKeys);
        if (!sourceRect || !targetRect) return false;
        if (sourceRect.width <= 0 || sourceRect.height <= 0 || targetRect.width <= 0 || targetRect.height <= 0) return false;

        const layer = this.ensureLayer();
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

    clear(): void {
        this.cleanupTimerIds.forEach((timerId) => window.clearTimeout(timerId));
        this.cleanupTimerIds = [];
        if (this.layer) {
            this.layer.innerHTML = '';
        }
    }

    private ensureLayer(): HTMLElement {
        if (this.layer) return this.layer;
        const layer = document.createElement('div');
        layer.className = 'fx-motion-layer';
        document.body.appendChild(layer);
        this.layer = layer;
        return layer;
    }
}

const playbackMotionOverlayController = new PlaybackMotionOverlayController();

export function playCardMotionBeat(beat: CardMotionBeat, durationMs: number): boolean {
    return playbackMotionOverlayController.play(beat, durationMs);
}

export function clearPlaybackMotionOverlay(): void {
    playbackMotionOverlayController.clear();
}
