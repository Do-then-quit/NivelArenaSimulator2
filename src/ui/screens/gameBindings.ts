import { Card, CardType, EngineAction, Phase } from '../../logic/types';
import { RuleValidator } from '../../logic/RuleValidator';
import { PlaybackSpeed, uiState, Screen } from '../appState';
import { canLocalHumanInput, getActionOwnerPlayerId } from '../gameLoop';
import { restartReplayFromBeginning, stepReplayForward } from './replaySetup';
import { GameLogCategory } from '../gameLogFeed';
import { dispatchEngineAction, reportGameOverToServer } from '../online/onlineMatchController';
import { getBottomPlayer, getTopPlayer, getUiPlayer, getUiPlayerRefForPlayerId, UiPlayerRef } from '../playerPerspective';
import { triggerActionAnchorPress } from '../playbackMotion';
import { setPlaybackAnimationEnabled, setPlaybackSpeed, skipPlaybackQueue } from '../playbackOrchestrator';

const SKILL_ZONE_PROMPT_ACTION_TYPES = new Set<string>([
    'BT06_SELECT_SKILL_ZONE_CARD',
    'BT03_SELECT_SKILL_ZONE_CARD_TO_TRASH',
    'BT03_011_SELECT_SKILL_ZONE_CARD_TO_TRASH',
    'BT03_052_SELECT_SKILL_ZONE_COST3_TO_TRASH',
    'BT03_062_SELECT_SKILL_ZONE_TO_CAST',
    'SB01_001_SELECT_SKILL_ZONE_TO_TRASH',
]);

const TOUCH_LONG_PRESS_MS = 350;
const TOUCH_LONG_PRESS_MOVE_THRESHOLD_PX = 16;
const MOBILE_CONTEXT_MENU_BLOCK_SELECTORS = [
    '.card-in-hand',
    '.damage-zone',
    '.damage-card-item',
    '.skill-zone',
    '.skill-card-item',
    '.trash-zone',
    '.trash-card-item',
    '.revealed-card-item',
    '.selection-modal-overlay',
    '.selection-modal-overlay .card',
    '.selection-modal-overlay .card-image',
    '.mini-item-card',
    '.mini-item-card img',
    '.trash-hover-card',
    '.trash-hover-overlay',
];
let touchContextMenuGuardBound = false;

function supportsHoverAndFinePointer(): boolean {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
    try {
        return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    } catch {
        return true;
    }
}

function shouldBlockMobileCardContextMenu(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    if (!el) return false;
    return MOBILE_CONTEXT_MENU_BLOCK_SELECTORS.some((selector) => el.closest(selector));
}

function ensureTouchContextMenuGuard() {
    if (touchContextMenuGuardBound) return;
    document.addEventListener('contextmenu', (event) => {
        if (uiState.currentScreen !== Screen.GAME || !uiState.game) return;
        const isMobilePortrait = uiState.app.querySelector('.game-container.mobile-portrait') !== null;
        if (!isMobilePortrait) return;
        if (supportsHoverAndFinePointer()) return;
        if (!shouldBlockMobileCardContextMenu(event.target)) return;
        event.preventDefault();
    }, true);
    touchContextMenuGuardBound = true;
}

export function attachListeners(renderCardFn: (card: Card, isSmall?: boolean, calculatedPower?: number, calculatedHit?: number) => string) {
    const game = uiState.game;
    if (!game) return;
    ensureTouchContextMenuGuard();
    const hasOnlineRoomSession = () => !!uiState.onlineSession.room && !!uiState.onlineSession.role;
    const localHumanCanInput = canLocalHumanInput();
    const logAction = (message: string, category: GameLogCategory = 'ACTION') => {
        uiState.gameLogFeed.pushUiLog(message, category);
    };
    const getPlayerName = (playerId: string) => {
        return uiState.game?.state.players.find(player => player.id === playerId)?.name ?? playerId;
    };
    const getLaneLabel = (laneIndex: number) => `${laneIndex + 1}라인`;
    const getPlayerForUiRef = (ref: UiPlayerRef) => getUiPlayer(game, ref);
    const getPlayerForPlayerAttr = (attr?: string) => getPlayerForUiRef(attr === 'opponent' ? 'opponent' : 'current');
    const getBottomUiPlayer = () => getBottomPlayer(game);
    const getTopUiPlayer = () => getTopPlayer(game);
    const isMobilePortraitLayout = uiState.app.querySelector('.game-container.mobile-portrait') !== null;
    const supportsMouseHoverPreview = supportsHoverAndFinePointer();
    const isMobileTapPlayMode = () => {
        if (!uiState.game || !isMobilePortraitLayout) return false;
        if (uiState.replaySession) return false;
        if (!canLocalHumanInput()) return false;
        if (uiState.game.state.phase !== Phase.MAIN) return false;
        return uiState.game.state.interactionMode === 'NORMAL';
    };
    const getLegalPlayActions = () => {
        if (!uiState.game) return [];
        const actorPlayerId = getActionOwnerPlayerId(uiState.game);
        return uiState.game.getLegalActions(actorPlayerId);
    };
    const getPlayableActionBuckets = (legalActions: any[]) => {
        const unitTargetsByHandIndex = new Map<number, Set<number>>();
        const itemTargetsByHandIndex = new Map<number, Set<number>>();
        const skillHandIndexes = new Set<number>();

        legalActions.forEach((action: any) => {
            if (action.type === 'PLAY_UNIT' && Number.isInteger(action.handIndex) && Number.isInteger(action.zoneIndex)) {
                const nextSet = unitTargetsByHandIndex.get(action.handIndex) ?? new Set<number>();
                nextSet.add(action.zoneIndex);
                unitTargetsByHandIndex.set(action.handIndex, nextSet);
            }
            if (action.type === 'PLAY_ITEM' && Number.isInteger(action.handIndex) && Number.isInteger(action.zoneIndex)) {
                const nextSet = itemTargetsByHandIndex.get(action.handIndex) ?? new Set<number>();
                nextSet.add(action.zoneIndex);
                itemTargetsByHandIndex.set(action.handIndex, nextSet);
            }
            if (action.type === 'PLAY_SKILL' && Number.isInteger(action.handIndex)) {
                skillHandIndexes.add(action.handIndex);
            }
        });

        return {
            unitTargetsByHandIndex,
            itemTargetsByHandIndex,
            skillHandIndexes,
        };
    };
    const clearMobileTapSelection = () => {
        uiState.mobileGameView.selectedHandIndex = null;
    };
    const pulseActionAnchor = (target: EventTarget | null) => {
        const element = (target as HTMLElement | null)?.closest<HTMLElement>('[data-action-anchor-key]');
        const anchorKey = element?.dataset.actionAnchorKey;
        if (!anchorKey) return;
        triggerActionAnchorPress(anchorKey);
    };
    const applyMobileTapPlayableHighlights = () => {
        const handCards = document.querySelectorAll('.hand-zone .card-in-hand');
        const zones = document.querySelectorAll('.drop-zone');
        const skillZones = document.querySelectorAll('.drop-zone-skill');

        handCards.forEach((cardEl) => {
            (cardEl as HTMLElement).classList.remove('mobile-tap-playable', 'mobile-selected');
        });
        zones.forEach((zoneEl) => {
            (zoneEl as HTMLElement).classList.remove('mobile-play-target');
        });
        skillZones.forEach((zoneEl) => {
            (zoneEl as HTMLElement).classList.remove('mobile-play-target');
        });

        if (!isMobileTapPlayMode()) {
            clearMobileTapSelection();
            return;
        }

        const localPlayer = getBottomUiPlayer();
        const legalActions = getLegalPlayActions();
        const { unitTargetsByHandIndex, itemTargetsByHandIndex, skillHandIndexes } = getPlayableActionBuckets(legalActions);
        const playableHandIndexSet = new Set<number>([
            ...unitTargetsByHandIndex.keys(),
            ...itemTargetsByHandIndex.keys(),
            ...skillHandIndexes.values(),
        ]);

        handCards.forEach((cardEl) => {
            const el = cardEl as HTMLElement;
            const handIndex = parseInt(el.dataset.index || '-1', 10);
            if (handIndex < 0) return;
            if (playableHandIndexSet.has(handIndex)) {
                el.classList.add('mobile-tap-playable');
            }
        });

        const selectedHandIndex = uiState.mobileGameView.selectedHandIndex;
        if (selectedHandIndex === null) return;
        const selectedCard = localPlayer.hand[selectedHandIndex];
        if (!selectedCard || !playableHandIndexSet.has(selectedHandIndex)) {
            clearMobileTapSelection();
            return;
        }

        const selectedCardElement = document.querySelector(`.hand-zone .card-in-hand[data-index="${selectedHandIndex}"]`) as HTMLElement | null;
        selectedCardElement?.classList.add('mobile-selected');

        if (selectedCard.type === CardType.SKILL) {
            if (!skillHandIndexes.has(selectedHandIndex)) return;
            skillZones.forEach((zoneEl) => {
                (zoneEl as HTMLElement).classList.add('mobile-play-target');
            });
            return;
        }

        if (selectedCard.type !== CardType.UNIT && selectedCard.type !== CardType.ITEM) return;
        const targetZoneSet = selectedCard.type === CardType.UNIT
            ? unitTargetsByHandIndex.get(selectedHandIndex) ?? new Set<number>()
            : itemTargetsByHandIndex.get(selectedHandIndex) ?? new Set<number>();

        zones.forEach((zoneEl) => {
            const el = zoneEl as HTMLElement;
            const zoneIndex = parseInt(el.dataset.index || '-1', 10);
            if (targetZoneSet.has(zoneIndex)) {
                el.classList.add('mobile-play-target');
            }
        });
    };
    const bindTouchLongPressPreview = (elements: Iterable<HTMLElement>, resolveCard: (el: HTMLElement) => Card | null) => {
        const suppressClickElements = new WeakSet<HTMLElement>();
        for (const el of elements) {
            let pressTimer: number | null = null;
            let longPressActive = false;
            let pointerId: number | null = null;
            let originX = 0;
            let originY = 0;

            const clearPressTimer = () => {
                if (pressTimer !== null) {
                    window.clearTimeout(pressTimer);
                    pressTimer = null;
                }
            };

            const cancelLongPress = (consumeClick: boolean) => {
                clearPressTimer();
                if (longPressActive) {
                    uiState.hoverPreview.hide();
                    if (consumeClick) {
                        suppressClickElements.add(el);
                    }
                }
                longPressActive = false;
                pointerId = null;
            };

            el.addEventListener('pointerdown', (event: PointerEvent) => {
                if (event.pointerType === 'mouse') return;
                const eventTarget = event.target as HTMLElement | null;
                if (el.classList.contains('unit-zone') && eventTarget?.closest('.mini-item-card')) return;
                const card = resolveCard(el);
                if (!card) return;

                pointerId = event.pointerId;
                originX = event.clientX;
                originY = event.clientY;
                longPressActive = false;
                clearPressTimer();
                pressTimer = window.setTimeout(() => {
                    longPressActive = true;
                    uiState.hoverPreview.show(card, originX, originY);
                }, TOUCH_LONG_PRESS_MS);
            });

            el.addEventListener('pointermove', (event: PointerEvent) => {
                if (pointerId === null || event.pointerId !== pointerId || event.pointerType === 'mouse') return;
                const eventTarget = event.target as HTMLElement | null;
                if (el.classList.contains('unit-zone') && eventTarget?.closest('.mini-item-card')) return;
                if (!longPressActive) {
                    const movedX = event.clientX - originX;
                    const movedY = event.clientY - originY;
                    if (Math.hypot(movedX, movedY) > TOUCH_LONG_PRESS_MOVE_THRESHOLD_PX) {
                        cancelLongPress(false);
                    }
                    return;
                }

                const card = resolveCard(el);
                if (!card) return;
                uiState.hoverPreview.show(card, event.clientX, event.clientY);
            });

            el.addEventListener('pointerup', (event: PointerEvent) => {
                if (pointerId === null || event.pointerId !== pointerId || event.pointerType === 'mouse') return;
                cancelLongPress(true);
            });
            el.addEventListener('pointercancel', () => cancelLongPress(false));
            el.addEventListener('pointerleave', () => {
                if (longPressActive) {
                    uiState.hoverPreview.hide();
                }
            });
            el.addEventListener('click', (event: MouseEvent) => {
                if (!suppressClickElements.has(el)) return;
                suppressClickElements.delete(el);
                event.preventDefault();
                event.stopPropagation();
            }, true);
            el.addEventListener('contextmenu', (event: MouseEvent) => {
                if (supportsMouseHoverPreview) return;
                event.preventDefault();
            });
        }
    };
    const inSelectTargetMode = game.state.interactionMode === 'SELECT_TARGET' && localHumanCanInput;
    const pendingSelectEffect = inSelectTargetMode ? (game.state.pendingEffect as any) : null;
    const selectTargetActorId = inSelectTargetMode ? getActionOwnerPlayerId(game) : '';
    const selectTargetLegalActions = inSelectTargetMode
        ? game.getLegalActions(selectTargetActorId)
        : [];
    const zoneTargetActions = selectTargetLegalActions
        .filter(action => action.type === 'SELECT_ZONE_TARGET') as Array<{ targetPlayerId: string; zoneIndex: number }>;
    const handTargetActions = selectTargetLegalActions
        .filter(action => action.type === 'SELECT_HAND_TARGET') as Array<{ targetPlayerId: string; handIndex: number }>;
    const trashTargetActions = selectTargetLegalActions
        .filter(action => action.type === 'SELECT_TRASH_TARGET') as Array<{ targetPlayerId: string; trashIndex: number }>;
    const damageTargetActions = selectTargetLegalActions
        .filter(action => action.type === 'SELECT_DAMAGE_TARGET') as Array<{ targetPlayerId: string; damageIndex: number }>;
    const itemTargetActions = selectTargetLegalActions
        .filter(action => action.type === 'SELECT_ITEM_TARGET') as Array<{ targetPlayerId: string; zoneIndex: number; itemIndex: number }>;
    const revealedTargetActions = selectTargetLegalActions
        .filter(action => action.type === 'SELECT_REVEALED_TARGET') as Array<{ revealedIndex: number }>;
    const buildIndexedActionMap = (
        actions: Array<{ targetPlayerId: string; index: number }>,
    ): Map<string, Set<number>> => {
        const map = new Map<string, Set<number>>();
        actions.forEach(action => {
            const set = map.get(action.targetPlayerId) ?? new Set<number>();
            set.add(action.index);
            map.set(action.targetPlayerId, set);
        });
        return map;
    };
    const trashTargetMapByPlayerId = buildIndexedActionMap(
        trashTargetActions.map(action => ({ targetPlayerId: action.targetPlayerId, index: action.trashIndex })),
    );
    const damageTargetMapByPlayerId = buildIndexedActionMap(
        damageTargetActions.map(action => ({ targetPlayerId: action.targetPlayerId, index: action.damageIndex })),
    );
    const resolveSelectedIndexesByPlayer = (
        zoneAccessor: (player: any) => Card[],
    ): Map<string, Set<number>> => {
        const map = new Map<string, Set<number>>();
        if (!pendingSelectEffect || !Array.isArray(pendingSelectEffect.selectedTargets)) return map;
        game.state.players.forEach((player: any) => {
            const zoneCards = zoneAccessor(player);
            pendingSelectEffect.selectedTargets.forEach((target: Card) => {
                const index = zoneCards.indexOf(target);
                if (index < 0) return;
                const set = map.get(player.id) ?? new Set<number>();
                set.add(index);
                map.set(player.id, set);
            });
        });
        return map;
    };
    const selectedTrashIndexesByPlayerId = resolveSelectedIndexesByPlayer((player) => player.trash);
    const selectedDamageIndexesByPlayerId = resolveSelectedIndexesByPlayer((player) => player.damage);
    const skillPromptRevealedIndexBySkillKey = new Map<string, number>();
    if (pendingSelectEffect && pendingSelectEffect.validTargets === 'REVEALED' && SKILL_ZONE_PROMPT_ACTION_TYPES.has(pendingSelectEffect.actionType)) {
        const options = Array.isArray(pendingSelectEffect.actionValue?.options)
            ? pendingSelectEffect.actionValue.options
            : [];
        options.forEach((option: any, revealedIndex: number) => {
            const skillZoneIndex = Number(option?.skillZoneIndex);
            if (!Number.isInteger(skillZoneIndex) || skillZoneIndex < 0) return;
            const key = `${pendingSelectEffect.sourcePlayerId}:${skillZoneIndex}`;
            skillPromptRevealedIndexBySkillKey.set(key, revealedIndex);
        });
    }
    document.getElementById('fx-log-toggle')?.addEventListener('click', () => {
        uiState.gameLogView.expanded = !uiState.gameLogView.expanded;
        uiState.gameLogView.manualOverride = true;
        uiState.gameLogView.autoCollapsed = false;
        uiState.render?.();
    });
    const closeMobileLogSheet = () => {
        if (!uiState.mobileGameView.logSheetOpen) return;
        uiState.mobileGameView.logSheetOpen = false;
        uiState.render?.();
    };
    document.getElementById('mobile-log-fab')?.addEventListener('click', () => {
        uiState.mobileGameView.logSheetOpen = true;
        uiState.render?.();
    });
    document.getElementById('mobile-log-sheet-close')?.addEventListener('click', closeMobileLogSheet);
    document.getElementById('mobile-log-sheet-backdrop')?.addEventListener('click', closeMobileLogSheet);

    document.querySelectorAll('[data-playback-speed]').forEach(button => {
        button.addEventListener('click', () => {
            const speed = (button as HTMLElement).dataset.playbackSpeed as PlaybackSpeed | undefined;
            if (!speed) return;
            setPlaybackSpeed(speed);
            uiState.render?.();
        });
    });

    document.getElementById('playback-animation-toggle-btn')?.addEventListener('click', () => {
        setPlaybackAnimationEnabled(!uiState.playback.animationEnabled);
        uiState.render?.();
    });

    document.getElementById('playback-skip-btn')?.addEventListener('click', () => {
        skipPlaybackQueue();
    });

    document.getElementById('db-back-to-menu')?.addEventListener('click', () => {
        uiState.replaySession = null;
        uiState.verificationSession = null;
        if (uiState.onlineSession.room?.phase === 'IN_GAME') {
            reportGameOverToServer('disconnect');
        }
        if (hasOnlineRoomSession()) {
            uiState.game = null;
            uiState.currentScreen = Screen.ONLINE_ROOM;
        } else {
            uiState.game = null;
            uiState.currentScreen = Screen.MENU;
        }
        uiState.render?.();
    });

    document.getElementById('game-over-menu-btn')?.addEventListener('click', () => {
        uiState.replaySession = null;
        uiState.verificationSession = null;
        if (hasOnlineRoomSession()) {
            uiState.game = null;
            uiState.currentScreen = Screen.ONLINE_ROOM;
        } else {
            uiState.game = null;
            uiState.currentScreen = Screen.MENU;
        }
        uiState.render?.();
    });

    document.getElementById('verification-back-btn')?.addEventListener('click', () => {
        uiState.returnToVerificationScreen?.();
    });

    document.getElementById('verification-next-btn')?.addEventListener('click', () => {
        uiState.goToNextVerificationTest?.();
    });

    document.getElementById('verification-panel-toggle-btn')?.addEventListener('click', () => {
        uiState.verificationPanelCollapsed = !uiState.verificationPanelCollapsed;
        uiState.render?.();
    });

    document.getElementById('replay-next-action')?.addEventListener('click', () => {
        stepReplayForward();
    });

    document.getElementById('replay-restart')?.addEventListener('click', () => {
        restartReplayFromBeginning();
    });

    document.getElementById('replay-overlay-next-action')?.addEventListener('click', () => {
        stepReplayForward();
    });

    document.getElementById('replay-overlay-restart')?.addEventListener('click', () => {
        restartReplayFromBeginning();
    });

    document.getElementById('next-phase')?.addEventListener('click', () => {
        if (!canLocalHumanInput()) return;
        pulseActionAnchor(document.getElementById('next-phase'));
        const beforePhase = uiState.game!.state.phase;
        const actorPlayerId = getActionOwnerPlayerId(uiState.game!);
        const ok = dispatchEngineAction({ type: 'NEXT_PHASE', actorPlayerId });
        if (!ok) return;
        clearMobileTapSelection();
        const afterPhase = uiState.game!.state.phase;
        logAction(`[?섎룞] NEXT_PHASE: ${beforePhase} -> ${afterPhase}`);
        uiState.render?.();
    });

    if (game.state.interactionMode === 'SELECT_MULLIGAN' && localHumanCanInput) {
        const actorPlayerId = getActionOwnerPlayerId(game);
        document.getElementById('mulligan-keep-btn')?.addEventListener('click', () => {
            if (!canLocalHumanInput()) return;
            const ok = dispatchEngineAction({ type: 'RESOLVE_MULLIGAN', actorPlayerId, shouldMulligan: false });
            if (!ok) return;
            logAction(`[硫由ш굔] ${getPlayerName(actorPlayerId)}: ?좎?`);
            uiState.render?.();
        });
        document.getElementById('mulligan-redraw-btn')?.addEventListener('click', () => {
            if (!canLocalHumanInput()) return;
            const ok = dispatchEngineAction({ type: 'RESOLVE_MULLIGAN', actorPlayerId, shouldMulligan: true });
            if (!ok) return;
            logAction(`[硫由ш굔] ${getPlayerName(actorPlayerId)}: ?꾩껜 援먯껜`);
            uiState.render?.();
        });
    }

    const cards = document.querySelectorAll('.card-in-hand');
    cards.forEach(card => {
        card.addEventListener('dragstart', (e) => {
            const event = e as DragEvent;
            if (event.dataTransfer) {
                const index = parseInt((card as HTMLElement).dataset.index!);
                uiState.draggedCardIndex = index;
                uiState.hoverPreview.setSuppressed(true);
                event.dataTransfer.setData('text/plain', index.toString());
                event.dataTransfer.effectAllowed = 'move';
            }
        });
        card.addEventListener('dragend', () => {
            uiState.draggedCardIndex = null;
            uiState.hoverPreview.setSuppressed(false);
            document.querySelectorAll('.zone').forEach(z => z.classList.remove('valid-target', 'invalid-target'));
        });

        card.addEventListener('click', (e) => {
            if (!isMobileTapPlayMode()) return;
            if (!canLocalHumanInput()) return;
            if (card.closest('.opponent-hand-zone')) return;

            const handIndex = parseInt((card as HTMLElement).dataset.index || '-1', 10);
            if (handIndex < 0) return;
            const localPlayer = getBottomUiPlayer();
            const handCard = localPlayer.hand[handIndex];
            if (!handCard) return;

            const legalActions = getLegalPlayActions();
            const { unitTargetsByHandIndex, itemTargetsByHandIndex, skillHandIndexes } = getPlayableActionBuckets(legalActions);
            const canPlayAsUnit = unitTargetsByHandIndex.has(handIndex);
            const canPlayAsItem = itemTargetsByHandIndex.has(handIndex);
            const canPlayAsSkill = skillHandIndexes.has(handIndex);
            if (!canPlayAsUnit && !canPlayAsItem && !canPlayAsSkill) return;

            if (uiState.mobileGameView.selectedHandIndex === handIndex) {
                clearMobileTapSelection();
            } else {
                uiState.mobileGameView.selectedHandIndex = handIndex;
            }
            uiState.render?.();
            e.stopPropagation();
        });

        if (supportsMouseHoverPreview) {
            card.addEventListener('mouseenter', (e) => {
                const el = card as HTMLElement;
                const isRevealed = el.dataset.handRevealed === '1';
                if (!isRevealed) return;
                const index = parseInt((card as HTMLElement).dataset.index!);
                const isOpponent = card.closest('.opponent-hand-zone') !== null;
                const player = isOpponent ? getTopUiPlayer() : getBottomUiPlayer();
                const cardObj = player.hand[index];
                const mouseEvent = e as MouseEvent;
                uiState.hoverPreview.show(cardObj, mouseEvent.clientX, mouseEvent.clientY);
            });

            card.addEventListener('mousemove', (e) => {
                const el = card as HTMLElement;
                const isRevealed = el.dataset.handRevealed === '1';
                if (!isRevealed) return;
                const mouseEvent = e as MouseEvent;
                const index = parseInt((card as HTMLElement).dataset.index!);
                const isOpponent = card.closest('.opponent-hand-zone') !== null;
                const player = isOpponent ? getTopUiPlayer() : getBottomUiPlayer();
                const cardObj = player.hand[index];
                uiState.hoverPreview.show(cardObj, mouseEvent.clientX, mouseEvent.clientY);
            });

            card.addEventListener('mouseleave', () => {
                uiState.hoverPreview.hide();
            });
        }
    });

    const dropZones = document.querySelectorAll('.drop-zone');
    dropZones.forEach(zone => {
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            const event = e as DragEvent;
            if (event.dataTransfer) {
                event.dataTransfer.dropEffect = 'move';
            }

            if (uiState.draggedCardIndex !== null) {
                const zoneIndex = parseInt((zone as HTMLElement).dataset.index!);
                const localPlayer = getBottomUiPlayer();
                const card = localPlayer.hand[uiState.draggedCardIndex];
                if (!card) return;

                let isValid = false;
                if (card.type === CardType.UNIT) {
                    isValid = RuleValidator.canPlayUnit(uiState.game!, localPlayer, uiState.draggedCardIndex, zoneIndex).valid;
                } else if (card.type === CardType.ITEM) {
                    isValid = RuleValidator.canPlayItem(uiState.game!, localPlayer, uiState.draggedCardIndex, zoneIndex).valid;
                }

                zone.classList.add(isValid ? 'valid-target' : 'invalid-target');
            }

            zone.classList.add('drag-over');
        });

        zone.addEventListener('dragleave', () => {
            zone.classList.remove('drag-over', 'valid-target', 'invalid-target');
        });

        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            if (!canLocalHumanInput()) return;
            zone.classList.remove('drag-over');
            const event = e as DragEvent;
            if (event.dataTransfer) {
                const cardIndex = parseInt(event.dataTransfer.getData('text/plain'));
                const zoneIndex = parseInt((zone as HTMLElement).dataset.index!);

                if (!isNaN(cardIndex) && !isNaN(zoneIndex)) {
                    const localPlayer = getBottomUiPlayer();
                    const card = localPlayer.hand[cardIndex];
                    if (!card) return;
                    if (card.type === CardType.UNIT) {
                        const actorPlayerId = getActionOwnerPlayerId(uiState.game!);
                        dispatchEngineAction({ type: 'PLAY_UNIT', actorPlayerId, handIndex: cardIndex, zoneIndex });
                        logAction(`[?뚮젅?? ?좊떅 ${card.name} -> ${getLaneLabel(zoneIndex)}`);
                    } else if (card.type === CardType.ITEM) {
                        const actorPlayerId = getActionOwnerPlayerId(uiState.game!);
                        dispatchEngineAction({ type: 'PLAY_ITEM', actorPlayerId, handIndex: cardIndex, zoneIndex });
                        logAction(`[?뚮젅?? ?꾩씠??${card.name} -> ${getLaneLabel(zoneIndex)}`);
                    }
                    uiState.render?.();
                }
            }
        });

        zone.addEventListener('click', (e) => {
            if (!isMobileTapPlayMode()) return;
            if (!canLocalHumanInput()) return;

            const selectedHandIndex = uiState.mobileGameView.selectedHandIndex;
            if (selectedHandIndex === null) return;
            const zoneIndex = parseInt((zone as HTMLElement).dataset.index || '-1', 10);
            if (zoneIndex < 0) return;

            const localPlayer = getBottomUiPlayer();
            const card = localPlayer.hand[selectedHandIndex];
            if (!card) {
                clearMobileTapSelection();
                uiState.render?.();
                return;
            }

            const legalActions = getLegalPlayActions();
            let ok = false;
            if (card.type === CardType.UNIT) {
                const legalUnitAction = legalActions.find((action: any) =>
                    action.type === 'PLAY_UNIT'
                    && action.handIndex === selectedHandIndex
                    && action.zoneIndex === zoneIndex,
                ) as EngineAction | undefined;
                if (!legalUnitAction) return;
                ok = dispatchEngineAction(legalUnitAction);
                if (ok) {
                    logAction(`[플레이] 유닛 ${card.name} -> ${getLaneLabel(zoneIndex)}`);
                }
            } else if (card.type === CardType.ITEM) {
                const legalItemAction = legalActions.find((action: any) =>
                    action.type === 'PLAY_ITEM'
                    && action.handIndex === selectedHandIndex
                    && action.zoneIndex === zoneIndex,
                ) as EngineAction | undefined;
                if (!legalItemAction) return;
                ok = dispatchEngineAction(legalItemAction);
                if (ok) {
                    logAction(`[플레이] 아이템 ${card.name} -> ${getLaneLabel(zoneIndex)}`);
                }
            }
            if (!ok) return;
            clearMobileTapSelection();
            uiState.render?.();
            e.stopPropagation();
        });
    });

    const skillZones = document.querySelectorAll('.drop-zone-skill');
    skillZones.forEach(zone => {
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            const event = e as DragEvent;
            if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';

            if (uiState.draggedCardIndex !== null) {
                const localPlayer = getBottomUiPlayer();
                const isValid = RuleValidator.canPlaySkill(uiState.game!, localPlayer, uiState.draggedCardIndex).valid;
                zone.classList.add(isValid ? 'valid-target' : 'invalid-target');
            }

            zone.classList.add('drag-over');
        });

        zone.addEventListener('dragleave', () => {
            zone.classList.remove('drag-over', 'valid-target', 'invalid-target');
        });

        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            if (!canLocalHumanInput()) return;
            zone.classList.remove('drag-over');
            const event = e as DragEvent;
            if (event.dataTransfer) {
                const cardIndex = parseInt(event.dataTransfer.getData('text/plain'));
                if (!isNaN(cardIndex)) {
                    const localPlayer = getBottomUiPlayer();
                    const card = localPlayer.hand[cardIndex];
                    const actorPlayerId = getActionOwnerPlayerId(uiState.game!);
                    dispatchEngineAction({ type: 'PLAY_SKILL', actorPlayerId, handIndex: cardIndex });
                    if (card) {
                        logAction(`[?뚮젅?? ?ㅽ궗 ${card.name}`);
                    }
                    uiState.render?.();
                }
            }
        });

        zone.addEventListener('click', (e) => {
            if (!isMobileTapPlayMode()) return;
            if (!canLocalHumanInput()) return;

            const selectedHandIndex = uiState.mobileGameView.selectedHandIndex;
            if (selectedHandIndex === null) return;
            const localPlayer = getBottomUiPlayer();
            const selectedCard = localPlayer.hand[selectedHandIndex];
            if (!selectedCard || selectedCard.type !== CardType.SKILL) return;

            const legalSkillAction = getLegalPlayActions().find((action: any) =>
                action.type === 'PLAY_SKILL' && action.handIndex === selectedHandIndex,
            ) as EngineAction | undefined;
            if (!legalSkillAction) return;

            const ok = dispatchEngineAction(legalSkillAction);
            if (!ok) return;
            logAction(`[플레이] 스킬 ${selectedCard.name}`);
            clearMobileTapSelection();
            uiState.render?.();
            e.stopPropagation();
        });
    });

    uiState.app.querySelector('.battle-fit-viewport')?.addEventListener('click', (e) => {
        if (!isMobileTapPlayMode()) return;
        if (uiState.mobileGameView.selectedHandIndex === null) return;
        const target = e.target as HTMLElement | null;
        if (!target) return;
        if (target.closest('.hand-zone .card-in-hand')) return;
        if (target.closest('.drop-zone')) return;
        if (target.closest('.drop-zone-skill')) return;
        clearMobileTapSelection();
        uiState.render?.();
    });

    const getMiniItemCardFromElement = (miniItemEl: HTMLElement): Card | null => {
        const zoneIndex = parseInt(miniItemEl.dataset.zoneIndex || '-1', 10);
        const itemIndex = parseInt(miniItemEl.dataset.itemIndex || '-1', 10);
        if (Number.isNaN(zoneIndex) || Number.isNaN(itemIndex) || zoneIndex < 0 || itemIndex < 0) return null;

        const player = getPlayerForPlayerAttr(miniItemEl.dataset.player);
        const zone = player.unitZones[zoneIndex];
        if (!zone) return null;
        return zone.items[itemIndex] ?? null;
    };

    const unitZones = document.querySelectorAll('.unit-zone');
    unitZones.forEach(zone => {
        if (!supportsMouseHoverPreview) return;
        zone.addEventListener('mouseenter', (e) => {
            const el = zone as HTMLElement;
            const index = parseInt(el.dataset.index!);
            const player = getPlayerForPlayerAttr(el.dataset.player);
            const unit = player.unitZones[index].unit;

            if (unit) {
                const mouseEvent = e as MouseEvent;
                uiState.hoverPreview.show(unit, mouseEvent.clientX, mouseEvent.clientY);
            }
        });

        zone.addEventListener('mousemove', (e) => {
            const el = zone as HTMLElement;
            const index = parseInt(el.dataset.index!);
            const player = getPlayerForPlayerAttr(el.dataset.player);
            const unit = player.unitZones[index].unit;

            const eventTarget = e.target as HTMLElement | null;
            if (eventTarget?.closest('.mini-item-card')) {
                return;
            }

            if (unit) {
                const mouseEvent = e as MouseEvent;
                uiState.hoverPreview.show(unit, mouseEvent.clientX, mouseEvent.clientY);
            }
        });

        zone.addEventListener('mouseleave', () => {
            uiState.hoverPreview.hide();
        });
    });

    document.querySelectorAll('.mini-item-card').forEach((itemEl) => {
        if (!supportsMouseHoverPreview) return;
        itemEl.addEventListener('mouseenter', (e) => {
            const card = getMiniItemCardFromElement(itemEl as HTMLElement);
            if (!card) return;
            const mouseEvent = e as MouseEvent;
            uiState.hoverPreview.show(card, mouseEvent.clientX, mouseEvent.clientY);
        });

        itemEl.addEventListener('mousemove', (e) => {
            const card = getMiniItemCardFromElement(itemEl as HTMLElement);
            if (!card) return;
            const mouseEvent = e as MouseEvent;
            uiState.hoverPreview.show(card, mouseEvent.clientX, mouseEvent.clientY);
        });

        itemEl.addEventListener('mouseleave', (e) => {
            const related = (e as MouseEvent).relatedTarget as HTMLElement | null;
            if (related?.closest('.unit-zone')) {
                return;
            }
            uiState.hoverPreview.hide();
        });
    });

    document.querySelectorAll('.attack-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!canLocalHumanInput()) return;
            pulseActionAnchor(e.target);
            const zoneEl = btn.closest('.unit-zone') as HTMLElement;
            const zoneIndex = parseInt(zoneEl.dataset.index!);
            const player = getPlayerForPlayerAttr(zoneEl.dataset.player);
            const attacker = player.unitZones[zoneIndex]?.unit;
            const actorPlayerId = getActionOwnerPlayerId(uiState.game!);
            dispatchEngineAction({ type: 'ATTACK', actorPlayerId, attackerZoneIndex: zoneIndex });
            if (attacker) {
                logAction(`[怨듦꺽] ${attacker.name} (${getLaneLabel(zoneIndex)})`);
            }
            uiState.render?.();
        });
    });

    document.querySelectorAll('.block-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!canLocalHumanInput()) return;
            pulseActionAnchor(e.target);
            const blockerZoneIndexRaw = (btn as HTMLElement).dataset.blockerZoneIndex;
            const blockerZoneIndex = blockerZoneIndexRaw !== undefined ? parseInt(blockerZoneIndexRaw, 10) : undefined;
            const zoneEl = btn.closest('.unit-zone') as HTMLElement | null;
            const blockerPlayer = zoneEl ? getPlayerForPlayerAttr(zoneEl.dataset.player) : getTopUiPlayer();
            const blocker = Number.isFinite(blockerZoneIndex as number)
                ? blockerPlayer.unitZones[blockerZoneIndex as number]?.unit
                : null;
            const actorPlayerId = getActionOwnerPlayerId(uiState.game!);
            dispatchEngineAction({
                type: 'RESOLVE_BLOCK',
                actorPlayerId,
                shouldBlock: true,
                blockerZoneIndex: Number.isNaN(blockerZoneIndex) ? undefined : blockerZoneIndex,
            });
            if (typeof blockerZoneIndex === 'number' && blocker) {
                logAction(`[諛⑹뼱] ${blocker.name} (${getLaneLabel(blockerZoneIndex)})濡?釉붾줉`);
            } else {
                logAction('[諛⑹뼱] 釉붾줉 ?좎뼵');
            }
            uiState.render?.();
        });
    });

    document.querySelectorAll('.pass-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!canLocalHumanInput()) return;
            pulseActionAnchor(e.target);
            const actorPlayerId = getActionOwnerPlayerId(uiState.game!);
            dispatchEngineAction({ type: 'RESOLVE_BLOCK', actorPlayerId, shouldBlock: false });
            logAction('[諛⑹뼱] ?⑥뒪');
            uiState.render?.();
        });
    });

    document.querySelectorAll('.active-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!canLocalHumanInput()) return;
            pulseActionAnchor(e.target);
            const zoneEl = btn.closest('.unit-zone') as HTMLElement;
            const zoneIndex = parseInt(zoneEl.dataset.index!);
            const player = getPlayerForPlayerAttr(zoneEl.dataset.player);
            const actorId = getActionOwnerPlayerId(uiState.game!);
            const activateActions = uiState.game!.getLegalActions(actorId).filter((action: any) =>
                action.type === 'ACTIVATE_EFFECT' && action.zoneIndex === zoneIndex,
            ) as any[];
            const preferredAction =
                activateActions.find((action: any) => action.sourceType !== 'ITEM') ??
                activateActions[0];

            if (preferredAction) {
                dispatchEngineAction(preferredAction as EngineAction);
                const sourceCard = player.unitZones[zoneIndex]?.unit;
                logAction(`[?≫떚釉? ${sourceCard?.name ?? '?좊떅'} (${getLaneLabel(zoneIndex)}) ?④낵 諛쒕룞`);
                uiState.render?.();
            }
        });
    });

    document.querySelectorAll('.leader-active-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!canLocalHumanInput()) return;
            pulseActionAnchor(e.target);
            const actorId = getActionOwnerPlayerId(uiState.game!);
            const leaderAction = uiState.game!
                .getLegalActions(actorId)
                .find((action: any) => action.type === 'ACTIVATE_EFFECT' && action.sourceType === 'LEADER') as any;

            if (leaderAction) {
                const area = btn.closest('.player-area') as HTMLElement | null;
                const uiRef: UiPlayerRef = area?.classList.contains('opponent') ? 'opponent' : 'current';
                const leader = getPlayerForUiRef(uiRef).levelZone;
                dispatchEngineAction(leaderAction as EngineAction);
                logAction(`[?≫떚釉? 由щ뜑 ${leader?.name ?? ''} ?④낵 諛쒕룞`);
                uiState.render?.();
            }
        });
    });

    if (game.state.interactionMode === 'SELECT_COST' && localHumanCanInput) {
        const pending = game.state.pendingEffect as any;
        const payerPlayer = game.state.players.find(player => player.id === pending?.sourcePlayerId);
        const costFilter = pending?.costCardTypeFilter;
        if (payerPlayer) {
            const handSelector = payerPlayer.id === getBottomUiPlayer().id
                ? '.hand-zone .card-in-hand'
                : '.opponent-hand-zone .card-in-hand';
            const handCards = document.querySelectorAll(handSelector);

            handCards.forEach((card, i) => {
                const el = card as HTMLElement;
                const handCard = payerPlayer.hand[i];
                if (!handCard) return;

                const isValidCostCard = !costFilter || handCard.type === costFilter;

                if (isValidCostCard) {
                    el.style.cursor = 'pointer';
                    el.style.boxShadow = '0 0 10px #0984e3';
                    el.addEventListener('click', () => {
                        if (!canLocalHumanInput()) return;
                        const index = parseInt(el.dataset.index!);
                        const picked = payerPlayer.hand[index];
                        dispatchEngineAction({ type: 'SELECT_COST_HAND', actorPlayerId: payerPlayer.id, handIndex: index });
                        if (picked) {
                            logAction(`[肄붿뒪?? ${getPlayerName(payerPlayer.id)}: ${picked.name}`);
                        }
                        uiState.render?.();
                    });
                } else {
                    el.style.opacity = '0.4';
                    el.style.cursor = 'not-allowed';
                }
            });
        }
    }

    if (inSelectTargetMode) {
        const pending = pendingSelectEffect;
        const actorId = selectTargetActorId;
        const validZoneKeySet = new Set(zoneTargetActions.map(action => `${action.targetPlayerId}:${action.zoneIndex}`));

        const units = document.querySelectorAll('.unit-zone');
        units.forEach(u => {
            const el = u as HTMLElement;
            const zoneIndex = parseInt(el.dataset.index || '-1', 10);
            if (zoneIndex < 0) return;
            const targetPlayerId = getPlayerForPlayerAttr(el.dataset.player).id;
            const zoneKey = `${targetPlayerId}:${zoneIndex}`;
            const canSelectZone = zoneTargetActions.length > 0 && validZoneKeySet.has(zoneKey);
            if (!canSelectZone) return;

            el.addEventListener('click', () => {
                if (!canLocalHumanInput()) return;
                dispatchEngineAction({
                    type: 'SELECT_ZONE_TARGET',
                    actorPlayerId: actorId,
                    targetPlayerId,
                    zoneIndex,
                });
                logAction(`[????좏깮] ${getPlayerName(targetPlayerId)} ${getLaneLabel(zoneIndex)}`);
                uiState.render?.();
            });
            el.style.cursor = 'crosshair';
            el.style.boxShadow = '0 0 10px #ffeaa7';
        });

        if (pending && pending.validTargets === 'MY_TRASH') {
            const validTrashKeys = new Set(trashTargetActions.map(action => `${action.targetPlayerId}:${action.trashIndex}`));

            document.querySelectorAll('.trash-card-item').forEach(item => {
                const index = parseInt((item as HTMLElement).dataset.index || '-1', 10);
                if (index < 0) return;
                const key = `${pending.sourcePlayerId}:${index}`;
                if (trashTargetActions.length > 0 && !validTrashKeys.has(key)) return;

                item.addEventListener('click', () => {
                    if (!canLocalHumanInput()) return;
                    const selectedCard = pending.sourcePlayerId
                        ? uiState.game!.state.players.find(p => p.id === pending.sourcePlayerId)?.trash[index]
                        : null;
                    dispatchEngineAction({
                        type: 'SELECT_TRASH_TARGET',
                        actorPlayerId: actorId,
                        targetPlayerId: pending.sourcePlayerId,
                        trashIndex: index,
                    });
                    logAction(`[????좏깮] ?몃옒?? ${selectedCard?.name ?? `index ${index}`}`);
                    uiState.render?.();
                });

                if (supportsMouseHoverPreview) {
                    item.addEventListener('mouseenter', (e) => {
                        const sourcePlayer = uiState.game!.state.players.find(p => p.id === pending.sourcePlayerId);
                        if (!sourcePlayer) return;
                        const card = sourcePlayer.trash[index];
                        const mouseEvent = e as MouseEvent;
                        uiState.hoverPreview.show(card, mouseEvent.clientX, mouseEvent.clientY);
                    });
                    item.addEventListener('mouseleave', () => uiState.hoverPreview.hide());
                }
            });
        }

        if (handTargetActions.length > 0) {
            const targetMap = new Map<string, Set<number>>();
            handTargetActions.forEach(action => {
                const set = targetMap.get(action.targetPlayerId) ?? new Set<number>();
                set.add(action.handIndex);
                targetMap.set(action.targetPlayerId, set);
            });

            targetMap.forEach((allowedIndexes, targetPlayerId) => {
                const handSelector = getUiPlayerRefForPlayerId(uiState.game!, targetPlayerId) === 'current'
                    ? '.hand-zone .card-in-hand'
                    : '.opponent-hand-zone .card-in-hand';
                const handCards = document.querySelectorAll(handSelector);

                handCards.forEach(card => {
                    const el = card as HTMLElement;
                    const index = parseInt(el.dataset.index || '-1', 10);
                    if (index < 0 || !allowedIndexes.has(index)) return;

                    el.style.cursor = 'crosshair';
                    el.style.boxShadow = '0 0 10px #ffeaa7';
                    el.style.border = '2px solid #e17055';

                    el.addEventListener('click', () => {
                        if (!canLocalHumanInput()) return;
                        const targetPlayer = uiState.game!.state.players.find(player => player.id === targetPlayerId);
                        const selectedCard = targetPlayer?.hand[index];
                        dispatchEngineAction({
                            type: 'SELECT_HAND_TARGET',
                            actorPlayerId: actorId,
                            targetPlayerId,
                            handIndex: index,
                        });
                        logAction(`[????좏깮] ?? ${selectedCard?.name ?? `index ${index}`} (${getPlayerName(targetPlayerId)})`);
                        uiState.render?.();
                    });
                });
            });
        }

        if (damageTargetActions.length > 0) {
            const targetMap = new Map<string, Set<number>>();
            damageTargetActions.forEach(action => {
                const set = targetMap.get(action.targetPlayerId) ?? new Set<number>();
                set.add(action.damageIndex);
                targetMap.set(action.targetPlayerId, set);
            });

            targetMap.forEach((allowedIndexes, targetPlayerId) => {
                const selector = getUiPlayerRefForPlayerId(uiState.game!, targetPlayerId) === 'current'
                    ? '.current .damage-zone .damage-card-item'
                    : '.opponent .damage-zone .damage-card-item';
                document.querySelectorAll(selector).forEach(item => {
                    const el = item as HTMLElement;
                    const index = parseInt(el.dataset.index || '-1', 10);
                    if (index < 0 || !allowedIndexes.has(index)) return;

                    el.style.cursor = 'crosshair';
                    el.style.boxShadow = '0 0 10px #ffeaa7';
                    el.addEventListener('click', () => {
                        if (!canLocalHumanInput()) return;
                        const targetPlayer = uiState.game!.state.players.find(player => player.id === targetPlayerId);
                        const selectedCard = targetPlayer?.damage[index];
                        dispatchEngineAction({
                            type: 'SELECT_DAMAGE_TARGET',
                            actorPlayerId: actorId,
                            targetPlayerId,
                            damageIndex: index,
                        });
                        logAction(`[????좏깮] ?誘몄? 議? ${selectedCard?.name ?? `index ${index}`} (${getPlayerName(targetPlayerId)})`);
                        uiState.render?.();
                    });
                });
            });
        }

        if (itemTargetActions.length > 0) {
            const validItemKeys = new Set(itemTargetActions.map(action => `${action.targetPlayerId}:${action.zoneIndex}:${action.itemIndex}`));
            document.querySelectorAll('.mini-item-card').forEach(item => {
                const el = item as HTMLElement;
                const zoneIndex = parseInt(el.dataset.zoneIndex || '-1', 10);
                const itemIndex = parseInt(el.dataset.itemIndex || '-1', 10);
                if (zoneIndex < 0 || itemIndex < 0) return;
                const playerRef = getPlayerForPlayerAttr(el.dataset.player).id;
                const key = `${playerRef}:${zoneIndex}:${itemIndex}`;
                if (!validItemKeys.has(key)) return;

                el.style.cursor = 'crosshair';
                el.style.boxShadow = '0 0 10px #ffeaa7';
                el.style.border = '2px solid #e17055';
                el.addEventListener('click', () => {
                    if (!canLocalHumanInput()) return;
                    const itemCard = uiState.game!.state.players
                        .find(player => player.id === playerRef)
                        ?.unitZones[zoneIndex]
                        ?.items[itemIndex];
                    dispatchEngineAction({
                        type: 'SELECT_ITEM_TARGET',
                        actorPlayerId: actorId,
                        targetPlayerId: playerRef,
                        zoneIndex,
                        itemIndex,
                    });
                    logAction(`[????좏깮] ?꾩씠?? ${itemCard?.name ?? `index ${itemIndex}`} (${getPlayerName(playerRef)} ${getLaneLabel(zoneIndex)})`);
                    uiState.render?.();
                });
            });
        }

        document.querySelectorAll('.revealed-card-item').forEach(item => {
            if (pending && pending.validTargets === 'REVEALED') {
                item.addEventListener('click', () => {
                    if (!canLocalHumanInput()) return;
                    const index = parseInt((item as HTMLElement).dataset.index || '-1', 10);
                    if (index < 0) return;
                    const card = uiState.game!.state.revealedCards[index];
                    dispatchEngineAction({
                        type: 'SELECT_REVEALED_TARGET',
                        actorPlayerId: actorId,
                        revealedIndex: index,
                    });
                    logAction(`[????좏깮] 怨듦컻 移대뱶: ${card?.name ?? `index ${index}`}`);
                    uiState.render?.();
                });
            }

            if (supportsMouseHoverPreview) {
                item.addEventListener('mouseenter', (e) => {
                    const index = parseInt((item as HTMLElement).dataset.index || '-1', 10);
                    if (index < 0) return;
                    const card = uiState.game!.state.revealedCards[index];
                    const mouseEvent = e as MouseEvent;
                    uiState.hoverPreview.show(card, mouseEvent.clientX, mouseEvent.clientY);
                });
                item.addEventListener('mouseleave', () => uiState.hoverPreview.hide());
            }
        });

        document.querySelectorAll('.skill-card-item').forEach((itemEl) => {
            const el = itemEl as HTMLElement;
            const skillIndex = parseInt(el.dataset.index || '-1', 10);
            if (skillIndex < 0) return;
            const player = getPlayerForPlayerAttr(el.dataset.player);
            const skillPromptKey = `${player.id}:${skillIndex}`;
            const revealedIndex = skillPromptRevealedIndexBySkillKey.get(skillPromptKey);
            if (revealedIndex === undefined || !revealedTargetActions.some(action => action.revealedIndex === revealedIndex)) return;

            el.style.cursor = 'crosshair';
            el.addEventListener('click', () => {
                if (!canLocalHumanInput()) return;
                const selectedSkill = player.skillZone[skillIndex];
                dispatchEngineAction({
                    type: 'SELECT_REVEALED_TARGET',
                    actorPlayerId: actorId,
                    revealedIndex,
                });
                logAction(`[????좏깮] ?ㅽ궓 議? ${selectedSkill?.name ?? `index ${skillIndex}`}`);
                uiState.render?.();
            });
        });

        const onConfirmTargets = () => {
            if (!canLocalHumanInput()) return;
            dispatchEngineAction({ type: 'CONFIRM_TARGETS', actorPlayerId: actorId });
            logAction('[????좏깮] ?뺤씤');
            uiState.render?.();
        };

        document.getElementById('confirm-targets-btn')?.addEventListener('click', onConfirmTargets);
        document.getElementById('confirm-targets-modal-btn')?.addEventListener('click', onConfirmTargets);
    }

    document.getElementById('selection-modal-toggle-btn')?.addEventListener('click', () => {
        uiState.selectionModalCollapsed = !uiState.selectionModalCollapsed;
        uiState.render?.();
    });

    if (game.state.interactionMode === 'SELECT_OPTIONAL' && localHumanCanInput) {
        document.getElementById('opt-confirm')?.addEventListener('click', () => {
            if (!canLocalHumanInput()) return;
            const actorPlayerId = getActionOwnerPlayerId(uiState.game!);
            dispatchEngineAction({ type: 'RESOLVE_OPTIONAL', actorPlayerId, confirm: true });
            logAction('[Optional] Confirmed');
            uiState.render?.();
        });
        document.getElementById('opt-skip')?.addEventListener('click', () => {
            if (!canLocalHumanInput()) return;
            const actorPlayerId = getActionOwnerPlayerId(uiState.game!);
            dispatchEngineAction({ type: 'RESOLVE_OPTIONAL', actorPlayerId, confirm: false });
            logAction('[Optional] Skipped');
            uiState.render?.();
        });
    }

    document.querySelectorAll('.leader-slot .card').forEach(card => {
        if (!supportsMouseHoverPreview) return;
        card.addEventListener('mouseenter', (e) => {
            const isOpponent = card.closest('.opponent') !== null;
            const player = getPlayerForUiRef(isOpponent ? 'opponent' : 'current');
            if (player.levelZone) {
                const mouseEvent = e as MouseEvent;
                uiState.hoverPreview.show(player.levelZone, mouseEvent.clientX, mouseEvent.clientY);
            }
        });
        card.addEventListener('mousemove', (e) => {
            const mouseEvent = e as MouseEvent;
            const isOpponent = card.closest('.opponent') !== null;
            const player = getPlayerForUiRef(isOpponent ? 'opponent' : 'current');
            if (player.levelZone) {
                uiState.hoverPreview.show(player.levelZone, mouseEvent.clientX, mouseEvent.clientY);
            }
        });
        card.addEventListener('mouseleave', () => {
            uiState.hoverPreview.hide();
        });
    });

    document.querySelectorAll('.trash-zone').forEach(zone => {
        zone.addEventListener('mouseenter', () => {
            const el = zone as HTMLElement;
            const isOpponent = el.dataset.player === 'opponent';
            const player = getPlayerForUiRef(isOpponent ? 'opponent' : 'current');
            const selectableIndexes = trashTargetMapByPlayerId.get(player.id) ?? new Set<number>();
            const selectedIndexes = selectedTrashIndexesByPlayerId.get(player.id) ?? new Set<number>();
            const interactive = inSelectTargetMode && selectableIndexes.size > 0;
            uiState.trashHoverOverlay!.show(player.trash, el, isOpponent, renderCardFn, 'Trash', {
                interactive,
                selectableIndexes,
                selectedIndexes,
                onCardSelect: (trashIndex: number) => {
                    if (!inSelectTargetMode || !canLocalHumanInput()) return;
                    const selectedCard = player.trash[trashIndex];
                    dispatchEngineAction({
                        type: 'SELECT_TRASH_TARGET',
                        actorPlayerId: selectTargetActorId,
                        targetPlayerId: player.id,
                        trashIndex,
                    });
                    logAction(`[????좏깮] ?몃옒?? ${selectedCard?.name ?? `index ${trashIndex}`}`);
                    uiState.render?.();
                },
            });
        });

        zone.addEventListener('mouseleave', () => {
            uiState.trashHoverOverlay!.scheduleHide();
        });
    });

    document.querySelectorAll('.damage-zone').forEach(zone => {
        const zoneEl = zone as HTMLElement;
        const isOpponent = zoneEl.dataset.player === 'opponent' || zone.closest('.opponent') !== null;
        const player = getPlayerForUiRef(isOpponent ? 'opponent' : 'current');
        const selectableIndexes = damageTargetMapByPlayerId.get(player.id) ?? new Set<number>();
        const selectedIndexes = selectedDamageIndexesByPlayerId.get(player.id) ?? new Set<number>();
        const interactive = inSelectTargetMode && selectableIndexes.size > 0;

        if (zoneEl.classList.contains('summary-mode')) {
            zoneEl.addEventListener('mouseenter', () => {
                uiState.trashHoverOverlay!.show(player.damage, zoneEl, isOpponent, renderCardFn, 'Damage', {
                    interactive,
                    selectableIndexes,
                    selectedIndexes,
                    onCardSelect: (damageIndex: number) => {
                        if (!inSelectTargetMode || !canLocalHumanInput()) return;
                        const selectedCard = player.damage[damageIndex];
                        dispatchEngineAction({
                            type: 'SELECT_DAMAGE_TARGET',
                            actorPlayerId: selectTargetActorId,
                            targetPlayerId: player.id,
                            damageIndex,
                        });
                        logAction(`[????좏깮] ?誘몄? 議? ${selectedCard?.name ?? `index ${damageIndex}`} (${getPlayerName(player.id)})`);
                        uiState.render?.();
                    },
                });
            });

            zoneEl.addEventListener('mouseleave', () => {
                uiState.trashHoverOverlay!.scheduleHide();
            });
            return;
        }

        zone.querySelectorAll('.damage-card-item').forEach(cardEl => {
            const index = parseInt((cardEl as HTMLElement).dataset.index || '-1');
            if (index < 0) return;
            if (!supportsMouseHoverPreview) return;
            cardEl.addEventListener('mouseenter', (e) => {
                const card = player.damage[index];
                if (card) {
                    const mouseEvent = e as MouseEvent;
                    uiState.hoverPreview.show(card, mouseEvent.clientX, mouseEvent.clientY);
                }
            });
            cardEl.addEventListener('mousemove', (e) => {
                const mouseEvent = e as MouseEvent;
                const card = player.damage[index];
                if (card) {
                    uiState.hoverPreview.show(card, mouseEvent.clientX, mouseEvent.clientY);
                }
            });
            cardEl.addEventListener('mouseleave', () => {
                uiState.hoverPreview.hide();
            });
        });
    });

    document.querySelectorAll('.skill-card-item').forEach((itemEl) => {
        const el = itemEl as HTMLElement;
        const index = parseInt(el.dataset.index || '-1', 10);
        if (index < 0) return;

        const player = getPlayerForPlayerAttr(el.dataset.player);
        const card = player.skillZone[index];
        if (!card) return;

        if (supportsMouseHoverPreview) {
            el.addEventListener('mouseenter', (e) => {
                const mouseEvent = e as MouseEvent;
                uiState.hoverPreview.show(card, mouseEvent.clientX, mouseEvent.clientY);
            });

            el.addEventListener('mousemove', (e) => {
                const mouseEvent = e as MouseEvent;
                uiState.hoverPreview.show(card, mouseEvent.clientX, mouseEvent.clientY);
            });

            el.addEventListener('mouseleave', () => {
                uiState.hoverPreview.hide();
            });
        }
    });

    bindTouchLongPressPreview(
        Array.from(document.querySelectorAll('.card-in-hand')) as HTMLElement[],
        (el) => {
            const handIndex = parseInt(el.dataset.index || '-1', 10);
            if (handIndex < 0) return null;
            const isRevealed = el.dataset.handRevealed === '1';
            if (!isRevealed) return null;
            const isOpponent = el.closest('.opponent-hand-zone') !== null;
            const player = isOpponent ? getTopUiPlayer() : getBottomUiPlayer();
            return player.hand[handIndex] ?? null;
        },
    );
    bindTouchLongPressPreview(
        Array.from(document.querySelectorAll('.unit-zone')) as HTMLElement[],
        (el) => {
            const zoneIndex = parseInt(el.dataset.index || '-1', 10);
            if (zoneIndex < 0) return null;
            const player = getPlayerForPlayerAttr(el.dataset.player);
            return player.unitZones[zoneIndex]?.unit ?? null;
        },
    );
    bindTouchLongPressPreview(
        Array.from(document.querySelectorAll('.mini-item-card')) as HTMLElement[],
        (el) => getMiniItemCardFromElement(el),
    );
    bindTouchLongPressPreview(
        Array.from(document.querySelectorAll('.skill-card-item')) as HTMLElement[],
        (el) => {
            const skillIndex = parseInt(el.dataset.index || '-1', 10);
            if (skillIndex < 0) return null;
            const player = getPlayerForPlayerAttr(el.dataset.player);
            return player.skillZone[skillIndex] ?? null;
        },
    );
    bindTouchLongPressPreview(
        Array.from(document.querySelectorAll('.revealed-card-item')) as HTMLElement[],
        (el) => {
            const revealedIndex = parseInt(el.dataset.index || '-1', 10);
            if (revealedIndex < 0) return null;
            return uiState.game?.state.revealedCards[revealedIndex] ?? null;
        },
    );
    bindTouchLongPressPreview(
        Array.from(document.querySelectorAll('.trash-card-item')) as HTMLElement[],
        (el) => {
            const trashIndex = parseInt(el.dataset.index || '-1', 10);
            if (trashIndex < 0) return null;
            if (game.state.interactionMode !== 'SELECT_TARGET') return null;
            const pending = game.state.pendingEffect as any;
            const sourcePlayer = game.state.players.find(player => player.id === pending?.sourcePlayerId);
            return sourcePlayer?.trash[trashIndex] ?? null;
        },
    );
    bindTouchLongPressPreview(
        Array.from(document.querySelectorAll('.damage-card-item')) as HTMLElement[],
        (el) => {
            const damageIndex = parseInt(el.dataset.index || '-1', 10);
            if (damageIndex < 0) return null;
            const player = getPlayerForPlayerAttr(el.dataset.player);
            return player.damage[damageIndex] ?? null;
        },
    );
    bindTouchLongPressPreview(
        Array.from(document.querySelectorAll('.leader-slot .card')) as HTMLElement[],
        (el) => {
            const isOpponent = el.closest('.opponent') !== null;
            const player = getPlayerForUiRef(isOpponent ? 'opponent' : 'current');
            return player.levelZone ?? null;
        },
    );

    applyMobileTapPlayableHighlights();
}
