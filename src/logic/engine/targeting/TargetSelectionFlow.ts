import { TargetSelector } from '../../TargetSelector';
import type { GameContext, GameState } from '../../types';

function getTargetCard(target: any): any | null {
    if (!target) return null;
    if (typeof target === 'object' && 'unit' in target) return target.unit ?? null;
    if (typeof target === 'object' && 'type' in target) return target;
    return null;
}

function getTargetCost(target: any): number {
    const card = getTargetCard(target);
    if (!card || typeof card.cost !== 'number') return 0;
    return Math.max(0, card.cost);
}

function resolveTotalCostLimit(targetSchema: any, context: GameContext): number | null {
    const limit = targetSchema?.totalCostLimit;
    if (typeof limit === 'number') return Math.max(0, limit);
    if (limit && typeof limit === 'object' && limit.type === 'MY_HAND_COUNT') {
        const add = typeof limit.add === 'number' ? limit.add : 0;
        return Math.max(0, context.player.hand.length + add);
    }
    return null;
}

function canAddTargetWithinTotalCost(targetSchema: any, context: GameContext, selectedTargets: any[], target: any): boolean {
    const limit = resolveTotalCostLimit(targetSchema, context);
    if (limit === null) return true;
    if (selectedTargets.includes(target)) return true;
    const currentCost = selectedTargets.reduce((sum, item) => sum + getTargetCost(item), 0);
    return currentCost + getTargetCost(target) <= limit;
}

function executeBt06FollowUpSubActions(engine: any, context: GameContext, subActions: any[]) {
    if (!Array.isArray(subActions)) return;
    for (const sub of subActions) {
        if (!sub || !sub.type) continue;
        const followUpEffect = {
            activation: 'ACTIVE' as any,
            description: sub.description || 'BT06 follow-up',
            action: { type: sub.type, params: sub.params || {} },
            ...(sub.targets ? { targets: sub.targets } : {}),
            ...(sub.duration ? { duration: sub.duration } : {}),
        } as any;

        let followUpTargets: any[] = [];
        if (sub.targets) {
            followUpTargets = TargetSelector.resolve(engine, sub.targets, context);
        } else if (context.unitZone) {
            followUpTargets = [context.unitZone];
        }

        engine.effectManager.executeEffect(followUpEffect, context, followUpTargets);
    }
}

export function selectZoneTargetByPlayerId(engine: any, zoneIndex: number, targetPlayerId: string) {
    if (engine.state.interactionMode !== 'SELECT_TARGET' || !engine.state.pendingEffect) return;

    // This logic handles the manual selection input from the UI
    const pending = engine.state.pendingEffect;
    const runtime = engine.getPendingRuntime();
    const effect = runtime?.effect;
    const context = runtime?.context;
    const targetSchema = pending.targetSchema;
    if (!effect || !context || !targetSchema) return;
    const targetPlayer = engine.getPlayerById(targetPlayerId);
    if (!targetPlayer) return;
    if (zoneIndex < 0 || zoneIndex >= targetPlayer.unitZones.length) return;
    const targetZone = targetPlayer.unitZones[zoneIndex];
    const scope = targetSchema.scope;

    // NEW: Full validation using TargetSelector
    if (!TargetSelector.isValidTarget(engine, targetSchema, context, targetZone)) {
        console.log("Invalid Target Selected. Mode maintained.");
        return;
    }

    // Shared Lane validation (extra layer for clarity, though isValidTarget covers it)
    if (scope === 'SHARED_LANE') {
        const myUnit = context.player.unitZones[zoneIndex]?.unit;
        const oppUnit = context.opponent.unitZones[zoneIndex]?.unit;
        if (!myUnit || !oppUnit) {
            console.log("Invalid Target: Lane is not shared.");
            return;
        }
    }

    // If everything good, execute
    if (effect.action.type === 'DESTROY_LANE_LOWEST') {
        context.selectedLaneIndex = zoneIndex;
    }

    // Multi-target logic
    const maxCount = targetSchema.count || 1;
    const selectedTargets = pending.selectedTargets ?? (pending.selectedTargets = []);
    if (maxCount > 1) {
        if (!selectedTargets.includes(targetZone)) {
            if (selectedTargets.length >= maxCount) {
                console.log(`Cannot select more than ${maxCount} targets.`);
                return;
            }
            if (!canAddTargetWithinTotalCost(targetSchema, context, selectedTargets, targetZone)) {
                console.log('Cannot select target: total cost limit exceeded.');
                return;
            }
            selectedTargets.push(targetZone);
            console.log(`Target added. ${selectedTargets.length}/${maxCount}`);
        } else {
            pending.selectedTargets = selectedTargets.filter((t: any) => t !== targetZone);
            console.log(`Target removed. ${(pending.selectedTargets ?? []).length}/${maxCount}`);
        }
        // Do not execute yet. Wait for Confirm.
        return;
    }

    // Single target behavior: Execute immediately
    engine.effectManager.executeEffect(effect, context, [targetZone]);
    engine.handleEffectCompletion(context, pending);
}

export function confirmTargets(engine: any) {
    if (engine.state.interactionMode !== 'SELECT_TARGET' || !engine.state.pendingEffect) return;

    const pending = engine.state.pendingEffect;
    const runtime = engine.getPendingRuntime();
    const effect = runtime?.effect;
    const context = runtime?.context;
    const targetSchema = pending.targetSchema;
    if (!effect || !context || !targetSchema) return;

    // Validation - can be empty if no valid targets were found among revealed

    // Special logic for PICK_REVEALED
    if (pending.actionType === 'PICK_REVEALED') {
        const player = engine.state.players.find((p: any) => p.id === pending.sourcePlayerId);
        if (player) {
            (pending.selectedTargets ?? []).forEach((card: any) => {
                const idx = engine.state.revealedCards.indexOf(card);
                if (idx !== -1) {
                    player.hand.push(card);
                    engine.state.revealedCards.splice(idx, 1);
                }
            });
            const remainingDestination = pending.actionValue?.remainingDestination;
            if (engine.state.revealedCards.length > 0) {
                if (remainingDestination === 'TRASH') {
                    player.trash.push(...engine.state.revealedCards);
                } else {
                    player.deck.push(...engine.state.revealedCards);
                    engine.shuffle(player.deck);
                }
            }
        }
        engine.state.revealedCards = [];
    }

    // SPECIAL LOGIC for TAKE_ALL_REVEALED (VIP Gift)
    if (pending.actionType === 'TAKE_ALL_REVEALED') {
        const player = engine.state.players.find((p: any) => p.id === pending.sourcePlayerId);
        if (player) {
            const candidates = TargetSelector.resolve(engine, targetSchema, context);
            candidates.forEach((card: any) => {
                const idx = engine.state.revealedCards.indexOf(card);
                if (idx !== -1) {
                    player.hand.push(card);
                    engine.state.revealedCards.splice(idx, 1);
                }
            });
            // Shuffle rest back
            if (engine.state.revealedCards.length > 0) {
                player.deck.push(...engine.state.revealedCards);
                engine.shuffle(player.deck);
            }
        }
        engine.state.revealedCards = [];
    }

    if (pending.actionType === 'PICK_REVEALED_ORDER_BOTTOM') {
        const player = engine.state.players.find((p: any) => p.id === pending.sourcePlayerId);
        if (!player) return;

        (pending.selectedTargets ?? []).forEach((card: any) => {
            const idx = engine.state.revealedCards.indexOf(card);
            if (idx !== -1) {
                player.hand.push(card);
                engine.state.revealedCards.splice(idx, 1);
            }
        });

        if (engine.state.revealedCards.length > 1) {
            engine.state.interactionMode = 'SELECT_TARGET';
            pending.actionType = 'ORDER_REVEALED_BOTTOM';
            pending.effectDescription = '덱 맨 아래에 놓을 순서를 정하세요.';
            pending.validTargets = 'REVEALED';
            pending.targetSchema = {
                scope: 'REVEALED',
                type: 'CARD',
                count: engine.state.revealedCards.length,
                selectMode: 'MANUAL',
            } as any;
            pending.selectedTargets = [];
            pending.actionValue = {
                ...(pending.actionValue || {}),
                allowPartialSelection: false,
            };
            engine.assignInteractionOwner(pending.controllerPlayerId ?? pending.sourcePlayerId);
            return;
        }

        if (engine.state.revealedCards.length === 1) {
            player.deck.unshift(engine.state.revealedCards[0]);
        }
        engine.state.revealedCards = [];
    }

    if (pending.actionType === 'ORDER_REVEALED_BOTTOM') {
        const player = engine.state.players.find((p: any) => p.id === pending.sourcePlayerId);
        if (!player) return;

        const selectedOrder = pending.selectedTargets ?? [];
        const remaining = engine.state.revealedCards.filter((card: any) => !selectedOrder.includes(card));
        const finalOrder = [...selectedOrder, ...remaining];
        if (finalOrder.length > 0) {
            player.deck.unshift(...finalOrder);
        }
        engine.state.revealedCards = [];
    }

    // Execute Effect via Manager
    engine.effectManager.executeEffect(effect, context, pending.selectedTargets ?? []);

    engine.handleEffectCompletion(context, pending);
}

export function selectTrashTarget(engine: any, trashIndex: number, targetPlayerId?: string) {
    if (engine.state.interactionMode !== 'SELECT_TARGET' || !engine.state.pendingEffect) return;

    const pending = engine.state.pendingEffect;
    const runtime = engine.getPendingRuntime();
    const effect = runtime?.effect;
    const context = runtime?.context;
    const targetSchema = pending.targetSchema;
    if (!effect || !context || !targetSchema) return;
    // Verify scope is MY_TRASH
    if (pending.validTargets !== 'MY_TRASH') {
        console.log("Invalid Target: Expected Trash selection.");
        return;
    }

    // Use the effect source player's trash, not the current turn player's trash
    // This is important for trigger effects that activate on opponent's turn
    const expectedPlayerId = pending.sourcePlayerId;
    if (targetPlayerId && targetPlayerId !== expectedPlayerId) return;
    const player = engine.state.players.find((p: any) => p.id === expectedPlayerId);
    if (!player) {
        console.log("Source player not found for trash selection.");
        return;
    }
    if (trashIndex < 0 || trashIndex >= player.trash.length) return;
    const card = player.trash[trashIndex];

    // Validate with TargetSelector
    if (!TargetSelector.isValidTarget(engine, targetSchema, context, card)) {
        console.log("Invalid Trash Target Selected.");
        return;
    }

    // Multi-target logic for trash
    const maxCount = targetSchema.count || 1;
    const selectedTargets = pending.selectedTargets ?? (pending.selectedTargets = []);
    if (maxCount > 1) {
        if (!selectedTargets.includes(card)) {
            if (selectedTargets.length >= maxCount) {
                console.log(`Cannot select more than ${maxCount} targets.`);
                return;
            }
            if (!canAddTargetWithinTotalCost(targetSchema, context, selectedTargets, card)) {
                console.log('Cannot select target: total cost limit exceeded.');
                return;
            }
            selectedTargets.push(card);
        } else {
            pending.selectedTargets = selectedTargets.filter((t: any) => t !== card);
        }
        return;
    }

    // Execute
    engine.effectManager.executeEffect(effect, context, [card]);
    engine.handleEffectCompletion(context, pending);
}

export function selectDamageTargetByPlayerId(engine: any, damageIndex: number, targetPlayerId: string) {
    if (engine.state.interactionMode !== 'SELECT_TARGET' || !engine.state.pendingEffect) return;

    const pending = engine.state.pendingEffect;
    const runtime = engine.getPendingRuntime();
    const effect = runtime?.effect;
    const context = runtime?.context;
    const targetSchema = pending.targetSchema;
    if (!effect || !context || !targetSchema) return;

    const targetPlayer = engine.getPlayerById(targetPlayerId);
    if (!targetPlayer) return;
    if (damageIndex < 0 || damageIndex >= targetPlayer.damage.length) return;
    const targetCard = targetPlayer.damage[damageIndex];

    if (!TargetSelector.isValidTarget(engine, targetSchema, context, targetCard)) {
        console.log("Invalid Damage Target Selected.");
        return;
    }

    const maxCount = targetSchema.count || 1;
    const selectedTargets = pending.selectedTargets ?? (pending.selectedTargets = []);
    if (maxCount > 1) {
        if (!selectedTargets.includes(targetCard)) {
            if (selectedTargets.length >= maxCount) {
                console.log(`Cannot select more than ${maxCount} targets.`);
                return;
            }
            if (!canAddTargetWithinTotalCost(targetSchema, context, selectedTargets, targetCard)) {
                console.log('Cannot select target: total cost limit exceeded.');
                return;
            }
            selectedTargets.push(targetCard);
        } else {
            pending.selectedTargets = selectedTargets.filter((t: any) => t !== targetCard);
        }
        return;
    }

    engine.effectManager.executeEffect(effect, context, [targetCard]);
    engine.handleEffectCompletion(context, pending);
}

export function selectItemTargetByPlayerId(engine: any, zoneIndex: number, itemIndex: number, targetPlayerId: string) {
    if (engine.state.interactionMode !== 'SELECT_TARGET' || !engine.state.pendingEffect) return;

    const pending = engine.state.pendingEffect;
    const runtime = engine.getPendingRuntime();
    const effect = runtime?.effect;
    const context = runtime?.context;
    const targetSchema = pending.targetSchema;
    if (!effect || !context || !targetSchema) return;

    const targetPlayer = engine.getPlayerById(targetPlayerId);
    if (!targetPlayer) return;
    if (zoneIndex < 0 || zoneIndex >= targetPlayer.unitZones.length) return;
    const zone = targetPlayer.unitZones[zoneIndex];
    if (itemIndex < 0 || itemIndex >= zone.items.length) return;
    const targetCard = zone.items[itemIndex];

    if (!TargetSelector.isValidTarget(engine, targetSchema, context, targetCard)) {
        console.log("Invalid Item Target Selected.");
        return;
    }

    const maxCount = targetSchema.count || 1;
    const selectedTargets = pending.selectedTargets ?? (pending.selectedTargets = []);
    if (maxCount > 1) {
        if (!selectedTargets.includes(targetCard)) {
            if (selectedTargets.length >= maxCount) {
                console.log(`Cannot select more than ${maxCount} targets.`);
                return;
            }
            if (!canAddTargetWithinTotalCost(targetSchema, context, selectedTargets, targetCard)) {
                console.log('Cannot select target: total cost limit exceeded.');
                return;
            }
            selectedTargets.push(targetCard);
        } else {
            pending.selectedTargets = selectedTargets.filter((t: any) => t !== targetCard);
        }
        return;
    }

    engine.effectManager.executeEffect(effect, context, [targetCard]);
    engine.handleEffectCompletion(context, pending);
}

export function selectHandTargetByPlayerId(engine: any, handIndex: number, targetPlayerId: string) {
    if (engine.state.interactionMode !== 'SELECT_TARGET' || !engine.state.pendingEffect) return;

    const pending = engine.state.pendingEffect;
    const runtime = engine.getPendingRuntime();
    const effect = runtime?.effect;
    const context = runtime?.context;
    const targetSchema = pending.targetSchema;
    if (!effect || !context || !targetSchema) return;

    const targetPlayer = engine.getPlayerById(targetPlayerId);
    if (!targetPlayer) return;
    if (handIndex < 0 || handIndex >= targetPlayer.hand.length) return;

    const targetCard = targetPlayer.hand[handIndex];

    // Validate
    if (!TargetSelector.isValidTarget(engine, targetSchema, context, targetCard)) {
        console.log("Invalid Hand Target Selected.");
        return;
    }

    // Multi-target logic for hand
    const maxCount = targetSchema.count || 1;
    const selectedTargets = pending.selectedTargets ?? (pending.selectedTargets = []);
    if (maxCount > 1) {
        if (!selectedTargets.includes(targetCard)) {
            if (selectedTargets.length >= maxCount) {
                console.log(`Cannot select more than ${maxCount} targets.`);
                return;
            }
            if (!canAddTargetWithinTotalCost(targetSchema, context, selectedTargets, targetCard)) {
                console.log('Cannot select target: total cost limit exceeded.');
                return;
            }
            selectedTargets.push(targetCard);
        } else {
            pending.selectedTargets = selectedTargets.filter((t: any) => t !== targetCard);
        }
        return;
    }

    // Execute Effect via Manager
    engine.effectManager.executeEffect(effect, context, [targetCard]);
    engine.handleEffectCompletion(context, pending);
}

export function selectRevealedTarget(engine: any, index: number) {
    if (engine.state.interactionMode !== 'SELECT_TARGET' || !engine.state.pendingEffect) return;
    if (index < 0 || index >= engine.state.revealedCards.length) return;

    const pending = engine.state.pendingEffect;
    const runtime = engine.getPendingRuntime();
    const effect = runtime?.effect;
    const context = runtime?.context;
    const targetSchema = pending.targetSchema;
    if (!context || !targetSchema) return;
    if (pending.validTargets !== 'REVEALED') return;

    const card = engine.state.revealedCards[index];

    // Validate
    if (!TargetSelector.isValidTarget(engine, targetSchema, context, card)) {
        console.log("Invalid Revealed Target Selected.");
        return;
    }

    if (pending.actionType === 'BT06_SELECT_ATTACK_ACTIVE_EFFECT') {
        const option = pending.actionValue?.options?.[index];
        const sourceZoneIndex = pending.actionValue?.sourceZoneIndex;
        const sourcePlayer = engine.getPlayerById(pending.sourcePlayerId);
        if (!sourcePlayer || typeof sourceZoneIndex !== 'number' || !option) return;

        engine.state.revealedCards = [];
        engine.activateEffect(sourceZoneIndex, option.effectIndex, 'UNIT');
        engine.handleEffectCompletion(context, pending);
        return;
    }

    if (pending.actionType === 'BT06_SELECT_SKILL_ZONE_CARD') {
        const option = pending.actionValue?.options?.[index];
        const sourcePlayer = engine.getPlayerById(pending.sourcePlayerId);
        if (!sourcePlayer || !option) return;

        const selectedSkill = sourcePlayer.skillZone[option.skillZoneIndex];
        if (!selectedSkill) return;

        (selectedSkill as any).turnCostOverride = {
            cost: 0,
            turnCount: engine.state.turnCount,
        };

        context.flags = context.flags || {};
        const contextFlagKey = pending.actionValue?.contextFlagKey || 'BT06_SKILL_ZERO_COST_SELECTED';
        context.flags[contextFlagKey] = true;

        executeBt06FollowUpSubActions(engine, context, pending.actionValue?.followUpSubActions || []);

        engine.state.revealedCards = [];
        engine.handleEffectCompletion(context, pending);
        return;
    }

    if (!effect) return;

    const maxCount = targetSchema.count || 1;
    const selectedTargets = pending.selectedTargets ?? (pending.selectedTargets = []);
    if (maxCount > 1) {
        if (!selectedTargets.includes(card)) {
            if (selectedTargets.length >= maxCount) {
                console.log(`Cannot select more than ${maxCount} targets.`);
                return;
            }
            if (!canAddTargetWithinTotalCost(targetSchema, context, selectedTargets, card)) {
                console.log('Cannot select target: total cost limit exceeded.');
                return;
            }
            selectedTargets.push(card);
        } else {
            pending.selectedTargets = selectedTargets.filter((t: any) => t !== card);
        }
        return;
    }

    // Execute
    engine.effectManager.executeEffect(effect, context, [card]);
    // Move card to hand (if required by the specific action type)
    if (pending.actionType === 'PICK_REVEALED') {
        const player = engine.state.players.find((p: any) => p.id === pending.sourcePlayerId);
        if (player) {
            player.hand.push(card);
            engine.state.revealedCards.splice(index, 1);
        }
    }
    if (pending.actionType === 'PICK_REVEALED_ORDER_BOTTOM') {
        const player = engine.state.players.find((p: any) => p.id === pending.sourcePlayerId);
        if (player) {
            player.hand.push(card);
            engine.state.revealedCards.splice(index, 1);

            if (engine.state.revealedCards.length > 1) {
                engine.state.interactionMode = 'SELECT_TARGET';
                pending.actionType = 'ORDER_REVEALED_BOTTOM';
                pending.effectDescription = '덱 맨 아래에 놓을 순서를 정하세요.';
                pending.validTargets = 'REVEALED';
                pending.targetSchema = {
                    scope: 'REVEALED',
                    type: 'CARD',
                    count: engine.state.revealedCards.length,
                    selectMode: 'MANUAL',
                } as any;
                pending.selectedTargets = [];
                pending.actionValue = {
                    ...(pending.actionValue || {}),
                    allowPartialSelection: false,
                };
                engine.assignInteractionOwner(pending.controllerPlayerId ?? pending.sourcePlayerId);
                return;
            }

            if (engine.state.revealedCards.length === 1) {
                player.deck.unshift(engine.state.revealedCards[0]);
                engine.state.revealedCards = [];
            }
        }
    }
    // Shuffle rest back
    if (engine.state.revealedCards.length > 0 && pending.actionType !== 'PICK_REVEALED_ORDER_BOTTOM') {
        const player = engine.state.players.find((p: any) => p.id === pending.sourcePlayerId);
        if (player) {
            const remainingDestination = pending.actionValue?.remainingDestination;
            if (remainingDestination === 'TRASH') {
                player.trash.push(...engine.state.revealedCards);
            } else {
                player.deck.push(...engine.state.revealedCards);
                engine.shuffle(player.deck);
            }
            engine.state.revealedCards = [];
        }
    }
    // Reset
    engine.handleEffectCompletion(context, pending);
}

export function handleEffectCompletion(engine: any, context: GameContext, currentPending: GameState['pendingEffect']) {
    console.log(`[GameEngine] Handling completion for ${context.sourceCard.name}`);
    // Queue Architecture: If a new interaction mode started, it means the processed effect caused a trigger.
    // We do NOTHING here. The queue already has the remaining effects.
    // The new interaction will block the queue until it is resolved.
    if (engine.state.interactionMode !== 'NORMAL' && engine.state.pendingEffect !== currentPending) {
        console.log("[GameEngine] Action triggered a nested selection mode. Queue paused.");
    } else {
        engine.resetInteractionMode();
    }

    if (
        currentPending?.actionType === engine.endPhaseHandAdjustActionType
    ) {
        engine.finalizeEndPhaseHandAdjustmentIfReady();
    }
}
