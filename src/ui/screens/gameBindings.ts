import { Card, CardType, EngineAction } from '../../logic/types';
import { RuleValidator } from '../../logic/RuleValidator';
import { PlaybackSpeed, uiState, Screen } from '../appState';
import { canLocalHumanInput, getActionOwnerPlayerId } from '../gameLoop';
import { restartReplayFromBeginning, stepReplayForward } from './replaySetup';
import { GameLogCategory } from '../gameLogFeed';
import { dispatchEngineAction, reportGameOverToServer } from '../online/onlineMatchController';
import { getBottomPlayer, getTopPlayer, getUiPlayer, getUiPlayerRefForPlayerId, UiPlayerRef } from '../playerPerspective';
import { setPlaybackSpeed, skipPlaybackQueue } from '../playbackOrchestrator';

export function attachListeners(renderCardFn: (card: Card, isSmall?: boolean, calculatedPower?: number, calculatedHit?: number) => string) {
    if (!uiState.game) return;
    const hasOnlineRoomSession = () => !!uiState.onlineSession.room && !!uiState.onlineSession.role;
    const localHumanCanInput = canLocalHumanInput();
    const logAction = (message: string, category: GameLogCategory = 'ACTION') => {
        uiState.gameLogFeed.pushUiLog(message, category);
    };
    const getPlayerName = (playerId: string) => {
        return uiState.game?.state.players.find(player => player.id === playerId)?.name ?? playerId;
    };
    const getLaneLabel = (laneIndex: number) => `${laneIndex + 1}라인`;
    const getPlayerForUiRef = (ref: UiPlayerRef) => getUiPlayer(uiState.game!, ref);
    const getPlayerForPlayerAttr = (attr?: string) => getPlayerForUiRef(attr === 'opponent' ? 'opponent' : 'current');
    const getBottomUiPlayer = () => getBottomPlayer(uiState.game!);
    const getTopUiPlayer = () => getTopPlayer(uiState.game!);
    document.getElementById('fx-log-toggle')?.addEventListener('click', () => {
        uiState.gameLogView.expanded = !uiState.gameLogView.expanded;
        uiState.gameLogView.manualOverride = true;
        uiState.gameLogView.autoCollapsed = false;
        uiState.render?.();
    });

    document.querySelectorAll('[data-playback-speed]').forEach(button => {
        button.addEventListener('click', () => {
            const speed = (button as HTMLElement).dataset.playbackSpeed as PlaybackSpeed | undefined;
            if (!speed) return;
            setPlaybackSpeed(speed);
            uiState.render?.();
        });
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
        const beforePhase = uiState.game!.state.phase;
        const actorPlayerId = getActionOwnerPlayerId(uiState.game!);
        const ok = dispatchEngineAction({ type: 'NEXT_PHASE', actorPlayerId });
        if (!ok) return;
        const afterPhase = uiState.game!.state.phase;
        logAction(`[?섎룞] NEXT_PHASE: ${beforePhase} -> ${afterPhase}`);
        uiState.render?.();
    });

    if (uiState.game.state.interactionMode === 'SELECT_MULLIGAN' && localHumanCanInput) {
        const actorPlayerId = getActionOwnerPlayerId(uiState.game);
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

    if (uiState.game.state.interactionMode === 'SELECT_COST' && localHumanCanInput) {
        const pending = uiState.game.state.pendingEffect as any;
        const payerPlayer = uiState.game.state.players.find(player => player.id === pending?.sourcePlayerId);
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

    if (uiState.game.state.interactionMode === 'SELECT_TARGET' && localHumanCanInput) {
        const pending = uiState.game.state.pendingEffect as any;
        const actorId = getActionOwnerPlayerId(uiState.game);
        const legalActions = uiState.game.getLegalActions(actorId);
        const zoneTargetActions =
            legalActions.filter(action => action.type === 'SELECT_ZONE_TARGET') as Array<{ targetPlayerId: string; zoneIndex: number }>;

        const validZoneKeySet = new Set(zoneTargetActions.map(action => `${action.targetPlayerId}:${action.zoneIndex}`));

        const units = document.querySelectorAll('.unit-zone');
        units.forEach(u => {
            const el = u as HTMLElement;
            const zoneIndex = parseInt(el.dataset.index!);
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
            const trashTargetActions =
                legalActions.filter(action => action.type === 'SELECT_TRASH_TARGET') as Array<{ targetPlayerId: string; trashIndex: number }>;
            const validTrashKeys = new Set(trashTargetActions.map(action => `${action.targetPlayerId}:${action.trashIndex}`));

            document.querySelectorAll('.trash-card-item').forEach(item => {
                const index = parseInt((item as HTMLElement).dataset.index!);
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

                item.addEventListener('mouseenter', (e) => {
                    const sourcePlayer = uiState.game!.state.players.find(p => p.id === pending.sourcePlayerId);
                    if (!sourcePlayer) return;
                    const card = sourcePlayer.trash[index];
                    const mouseEvent = e as MouseEvent;
                    uiState.hoverPreview.show(card, mouseEvent.clientX, mouseEvent.clientY);
                });
                item.addEventListener('mouseleave', () => uiState.hoverPreview.hide());
            });
        }

        const handTargetActions =
            legalActions.filter(action => action.type === 'SELECT_HAND_TARGET') as Array<{ targetPlayerId: string; handIndex: number }>;
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
                    const index = parseInt(el.dataset.index!);
                    if (!allowedIndexes.has(index)) return;

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

        const damageTargetActions =
            legalActions.filter(action => action.type === 'SELECT_DAMAGE_TARGET') as Array<{ targetPlayerId: string; damageIndex: number }>;
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
                    const index = parseInt(el.dataset.index!);
                    if (!allowedIndexes.has(index)) return;

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

        const itemTargetActions =
            legalActions.filter(action => action.type === 'SELECT_ITEM_TARGET') as Array<{ targetPlayerId: string; zoneIndex: number; itemIndex: number }>;
        if (itemTargetActions.length > 0) {
            const validItemKeys = new Set(itemTargetActions.map(action => `${action.targetPlayerId}:${action.zoneIndex}:${action.itemIndex}`));
            document.querySelectorAll('.mini-item-card').forEach(item => {
                const el = item as HTMLElement;
                const zoneIndex = parseInt(el.dataset.zoneIndex || '-1');
                const itemIndex = parseInt(el.dataset.itemIndex || '-1');
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
                    const index = parseInt((item as HTMLElement).dataset.index!);
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

            item.addEventListener('mouseenter', (e) => {
                const index = parseInt((item as HTMLElement).dataset.index!);
                const card = uiState.game!.state.revealedCards[index];
                const mouseEvent = e as MouseEvent;
                uiState.hoverPreview.show(card, mouseEvent.clientX, mouseEvent.clientY);
            });
            item.addEventListener('mouseleave', () => uiState.hoverPreview.hide());
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

    if (uiState.game.state.interactionMode === 'SELECT_OPTIONAL' && localHumanCanInput) {
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
            uiState.trashHoverOverlay!.show(player.trash, el, isOpponent, renderCardFn, 'Trash');
        });

        zone.addEventListener('mouseleave', () => {
            uiState.trashHoverOverlay!.scheduleHide();
        });
    });

    document.querySelectorAll('.damage-zone').forEach(zone => {
        const zoneEl = zone as HTMLElement;
        const isOpponent = zoneEl.dataset.player === 'opponent' || zone.closest('.opponent') !== null;
        const player = getPlayerForUiRef(isOpponent ? 'opponent' : 'current');

        if (zoneEl.classList.contains('summary-mode')) {
            zoneEl.addEventListener('mouseenter', () => {
                uiState.trashHoverOverlay!.show(player.damage, zoneEl, isOpponent, renderCardFn, 'Damage');
            });

            zoneEl.addEventListener('mouseleave', () => {
                uiState.trashHoverOverlay!.scheduleHide();
            });
            return;
        }

        zone.querySelectorAll('.damage-card-item').forEach(cardEl => {
            const index = parseInt((cardEl as HTMLElement).dataset.index || '-1');
            if (index < 0) return;
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
    });
}
