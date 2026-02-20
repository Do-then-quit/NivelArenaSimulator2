import { Card, CardType } from '../../logic/types';
import { RuleValidator } from '../../logic/RuleValidator';
import { uiState, Screen } from '../appState';
import { canLocalHumanInput, getActionOwnerPlayerId } from '../gameLoop';
import { restartReplayFromBeginning, stepReplayForward } from './replaySetup';

export function attachListeners(renderCardFn: (card: Card, isSmall?: boolean, calculatedPower?: number, calculatedHit?: number) => string) {
    if (!uiState.game) return;
    const localHumanCanInput = canLocalHumanInput();

    document.getElementById('db-back-to-menu')?.addEventListener('click', () => {
        uiState.replaySession = null;
        uiState.verificationSession = null;
        uiState.game = null;
        uiState.currentScreen = Screen.MENU;
        uiState.render?.();
    });

    document.getElementById('game-over-menu-btn')?.addEventListener('click', () => {
        uiState.replaySession = null;
        uiState.verificationSession = null;
        uiState.game = null;
        uiState.currentScreen = Screen.MENU;
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
        uiState.game!.nextPhase();
        uiState.render?.();
    });

    if (uiState.game.state.interactionMode === 'SELECT_MULLIGAN' && localHumanCanInput) {
        const actorPlayerId = getActionOwnerPlayerId(uiState.game);
        document.getElementById('mulligan-keep-btn')?.addEventListener('click', () => {
            if (!canLocalHumanInput()) return;
            const ok = uiState.game!.step({ type: 'RESOLVE_MULLIGAN', actorPlayerId, shouldMulligan: false });
            if (!ok) return;
            uiState.render?.();
        });
        document.getElementById('mulligan-redraw-btn')?.addEventListener('click', () => {
            if (!canLocalHumanInput()) return;
            const ok = uiState.game!.step({ type: 'RESOLVE_MULLIGAN', actorPlayerId, shouldMulligan: true });
            if (!ok) return;
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
            const cardObj = isOpponent ? uiState.game!.opponentPlayer.hand[index] : uiState.game!.currentPlayer.hand[index];
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
            const cardObj = isOpponent ? uiState.game!.opponentPlayer.hand[index] : uiState.game!.currentPlayer.hand[index];
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
                const card = uiState.game!.currentPlayer.hand[uiState.draggedCardIndex];

                let isValid = false;
                if (card.type === CardType.UNIT) {
                    isValid = RuleValidator.canPlayUnit(uiState.game!, uiState.game!.currentPlayer, uiState.draggedCardIndex, zoneIndex).valid;
                } else if (card.type === CardType.ITEM) {
                    isValid = RuleValidator.canPlayItem(uiState.game!, uiState.game!.currentPlayer, uiState.draggedCardIndex, zoneIndex).valid;
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
                    const card = uiState.game!.currentPlayer.hand[cardIndex];
                    if (card.type === CardType.UNIT) {
                        uiState.game!.playUnit(cardIndex, zoneIndex);
                    } else if (card.type === CardType.ITEM) {
                        uiState.game!.playItem(cardIndex, zoneIndex);
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
                const isValid = RuleValidator.canPlaySkill(uiState.game!, uiState.game!.currentPlayer, uiState.draggedCardIndex).valid;
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
                    uiState.game!.playSkill(cardIndex);
                    uiState.render?.();
                }
            }
        });
    });

    const getMiniItemCardFromElement = (miniItemEl: HTMLElement): Card | null => {
        const isOpponent = miniItemEl.dataset.player === 'opponent';
        const zoneIndex = parseInt(miniItemEl.dataset.zoneIndex || '-1', 10);
        const itemIndex = parseInt(miniItemEl.dataset.itemIndex || '-1', 10);
        if (Number.isNaN(zoneIndex) || Number.isNaN(itemIndex) || zoneIndex < 0 || itemIndex < 0) return null;

        const player = isOpponent ? uiState.game!.opponentPlayer : uiState.game!.currentPlayer;
        const zone = player.unitZones[zoneIndex];
        if (!zone) return null;
        return zone.items[itemIndex] ?? null;
    };

    const unitZones = document.querySelectorAll('.unit-zone');
    unitZones.forEach(zone => {
        zone.addEventListener('mouseenter', (e) => {
            const el = zone as HTMLElement;
            const isOpponent = el.dataset.player === 'opponent';
            const index = parseInt(el.dataset.index!);
            const player = isOpponent ? uiState.game!.opponentPlayer : uiState.game!.currentPlayer;
            const unit = player.unitZones[index].unit;

            if (unit) {
                const mouseEvent = e as MouseEvent;
                uiState.hoverPreview.show(unit, mouseEvent.clientX, mouseEvent.clientY);
            }
        });

        zone.addEventListener('mousemove', (e) => {
            const el = zone as HTMLElement;
            const isOpponent = el.dataset.player === 'opponent';
            const index = parseInt(el.dataset.index!);
            const player = isOpponent ? uiState.game!.opponentPlayer : uiState.game!.currentPlayer;
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
            const zoneIndex = parseInt((btn.closest('.unit-zone') as HTMLElement).dataset.index!);
            uiState.game!.attack(zoneIndex);
            uiState.render?.();
        });
    });

    document.querySelectorAll('.block-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!canLocalHumanInput()) return;
            const blockerZoneIndexRaw = (btn as HTMLElement).dataset.blockerZoneIndex;
            const blockerZoneIndex = blockerZoneIndexRaw !== undefined ? parseInt(blockerZoneIndexRaw, 10) : undefined;
            uiState.game!.resolveBlock(true, Number.isNaN(blockerZoneIndex) ? undefined : blockerZoneIndex);
            uiState.render?.();
        });
    });

    document.querySelectorAll('.pass-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!canLocalHumanInput()) return;
            uiState.game!.resolveBlock(false);
            uiState.render?.();
        });
    });

    document.querySelectorAll('.active-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!canLocalHumanInput()) return;
            const zoneIndex = parseInt((btn.closest('.unit-zone') as HTMLElement).dataset.index!);
            const actorId = getActionOwnerPlayerId(uiState.game!);
            const activateActions = uiState.game!.getLegalActions(actorId).filter((action: any) =>
                action.type === 'ACTIVATE_EFFECT' && action.zoneIndex === zoneIndex,
            ) as any[];
            const preferredAction =
                activateActions.find((action: any) => action.sourceType !== 'ITEM') ??
                activateActions[0];

            if (preferredAction) {
                uiState.game!.step(preferredAction);
                uiState.render?.();
            }
        });
    });

    if (uiState.game.state.interactionMode === 'SELECT_COST' && localHumanCanInput) {
        const pending = uiState.game.state.pendingEffect as any;
        const payerPlayer = uiState.game.state.players.find(player => player.id === pending?.sourcePlayerId);
        const costFilter = pending?.costCardTypeFilter;
        if (payerPlayer) {
            const handSelector = payerPlayer.id === uiState.game.currentPlayer.id
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
                        uiState.game!.selectCostForPlayerId(index, payerPlayer.id);
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
            const isOpponent = el.dataset.player === 'opponent';
            const targetPlayerId = isOpponent ? uiState.game!.opponentPlayer.id : uiState.game!.currentPlayer.id;
            const zoneKey = `${targetPlayerId}:${zoneIndex}`;
            const canSelectZone = zoneTargetActions.length > 0 && validZoneKeySet.has(zoneKey);
            if (!canSelectZone) return;

            el.addEventListener('click', () => {
                if (!canLocalHumanInput()) return;
                uiState.game!.selectZoneTargetByPlayerId(zoneIndex, targetPlayerId);
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
                    uiState.game!.selectTrashTarget(index, pending.sourcePlayerId);
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
                const handSelector = targetPlayerId === uiState.game!.currentPlayer.id
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
                        uiState.game!.selectHandTargetByPlayerId(index, targetPlayerId);
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
                const selector = targetPlayerId === uiState.game!.currentPlayer.id
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
                        uiState.game!.selectDamageTargetByPlayerId(index, targetPlayerId);
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
                const playerRef = el.dataset.player === 'opponent' ? uiState.game!.opponentPlayer.id : uiState.game!.currentPlayer.id;
                const key = `${playerRef}:${zoneIndex}:${itemIndex}`;
                if (!validItemKeys.has(key)) return;

                el.style.cursor = 'crosshair';
                el.style.boxShadow = '0 0 10px #ffeaa7';
                el.style.border = '2px solid #e17055';
                el.addEventListener('click', () => {
                    if (!canLocalHumanInput()) return;
                    uiState.game!.selectItemTargetByPlayerId(zoneIndex, itemIndex, playerRef);
                    uiState.render?.();
                });
            });
        }

        document.querySelectorAll('.revealed-card-item').forEach(item => {
            if (pending && pending.validTargets === 'REVEALED') {
                item.addEventListener('click', () => {
                    if (!canLocalHumanInput()) return;
                    const index = parseInt((item as HTMLElement).dataset.index!);
                    uiState.game!.selectRevealedTarget(index);
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

        document.getElementById('confirm-targets-btn')?.addEventListener('click', () => {
            if (!canLocalHumanInput()) return;
            uiState.game!.confirmTargets();
            uiState.render?.();
        });
    }

    if (uiState.game.state.interactionMode === 'SELECT_OPTIONAL' && localHumanCanInput) {
        document.getElementById('opt-confirm')?.addEventListener('click', () => {
            if (!canLocalHumanInput()) return;
            uiState.game!.resolveOptionalEffect(true);
            uiState.render?.();
        });
        document.getElementById('opt-skip')?.addEventListener('click', () => {
            if (!canLocalHumanInput()) return;
            uiState.game!.resolveOptionalEffect(false);
            uiState.render?.();
        });
    }

    document.querySelectorAll('.leader-slot .card').forEach(card => {
        card.addEventListener('mouseenter', (e) => {
            const isOpponent = card.closest('.opponent') !== null;
            const player = isOpponent ? uiState.game!.opponentPlayer : uiState.game!.currentPlayer;
            if (player.levelZone) {
                const mouseEvent = e as MouseEvent;
                uiState.hoverPreview.show(player.levelZone, mouseEvent.clientX, mouseEvent.clientY);
            }
        });
        card.addEventListener('mousemove', (e) => {
            const mouseEvent = e as MouseEvent;
            const isOpponent = card.closest('.opponent') !== null;
            const player = isOpponent ? uiState.game!.opponentPlayer : uiState.game!.currentPlayer;
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
            const player = isOpponent ? uiState.game!.opponentPlayer : uiState.game!.currentPlayer;
            uiState.trashHoverOverlay!.show(player.trash, el, isOpponent, renderCardFn);
        });

        zone.addEventListener('mouseleave', () => {
            uiState.trashHoverOverlay!.scheduleHide();
        });
    });

    document.querySelectorAll('.damage-zone').forEach(zone => {
        const isOpponent = zone.closest('.opponent') !== null;
        const player = isOpponent ? uiState.game!.opponentPlayer : uiState.game!.currentPlayer;

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
}
