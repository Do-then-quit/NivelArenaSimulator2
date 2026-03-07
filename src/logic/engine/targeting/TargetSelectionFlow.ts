import { TargetSelector } from '../../TargetSelector';
import { ActivationCondition, Phase, type GameContext, type GameState } from '../../types';

function getTargetCard(target: any): any | null {
    if (!target) return null;
    if (typeof target === 'object' && 'unit' in target) return target.unit ?? null;
    if (typeof target === 'object' && 'type' in target) return target;
    return null;
}

function getTargetCost(target: any, context: GameContext): number {
    const card = getTargetCard(target);
    if (!card) return 0;
    if (typeof context.machine?.getCardCost === 'function') {
        return context.machine.getCardCost(card);
    }
    return Math.max(0, Number(card.cost || 0));
}

function resolveTotalCostLimit(targetSchema: any, context: GameContext): number | null {
    const limit = targetSchema?.totalCostLimit;
    if (typeof limit === 'number') return Math.max(0, limit);
    if (limit && typeof limit === 'object' && limit.type === 'MY_HAND_COUNT') {
        const add = typeof limit.add === 'number' ? limit.add : 0;
        return Math.max(0, context.player.hand.length + add);
    }
    if (limit && typeof limit === 'object' && limit.type === 'MY_DAMAGE_COUNT') {
        const add = typeof limit.add === 'number' ? limit.add : 0;
        const damageCount = typeof context.machine?.getEffectiveDamageCount === 'function'
            ? context.machine.getEffectiveDamageCount(context.player, context)
            : context.player.damage.length;
        return Math.max(0, damageCount + add);
    }
    if (limit && typeof limit === 'object' && limit.type === 'MY_DAMAGE_TRAIT_COUNT') {
        const trait = typeof limit.trait === 'string' ? limit.trait : '';
        const add = typeof limit.add === 'number' ? limit.add : 0;
        const traitCount = trait && typeof context.machine?.getDamageTraitCount === 'function'
            ? context.machine.getDamageTraitCount(context.player, trait)
            : 0;
        return Math.max(0, traitCount + add);
    }
    return null;
}

function getTargetName(target: any): string {
    const card = getTargetCard(target);
    return String(card?.name || card?.id || '');
}

function canAddTargetWithSelectionConstraints(
    targetSchema: any,
    context: GameContext,
    selectedTargets: any[],
    target: any,
    actionValue?: any
): boolean {
    const requireDistinctNames = actionValue?.requireDistinctNames === true;
    if (requireDistinctNames && !selectedTargets.includes(target)) {
        const nextName = getTargetName(target);
        if (nextName && selectedTargets.some(selected => getTargetName(selected) === nextName)) {
            return false;
        }
    }

    const limit = resolveTotalCostLimit(targetSchema, context);
    if (limit === null) return true;
    if (selectedTargets.includes(target)) return true;
    const currentCost = selectedTargets.reduce((sum, item) => sum + getTargetCost(item, context), 0);
    return currentCost + getTargetCost(target, context) <= limit;
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

function trashUnitZoneWithoutTriggers(player: any, zone: any) {
    if (!player || !zone?.unit) return;
    const unit = zone.unit;
    zone.unit = null;
    player.trash.push(unit);
    zone.items.forEach((item: any) => player.trash.push(item));
    zone.items = [];
    zone.buffs = [];
    zone.temporaryEffects = [];
    zone.attackCountThisTurn = 0;
    zone.extraAttackAllowance = 0;
    zone.hasAttacked = false;
}

export function selectZoneTargetByPlayerId(engine: any, zoneIndex: number, targetPlayerId: string) {
    if (engine.state.interactionMode !== 'SELECT_TARGET' || !engine.state.pendingEffect) return;

    // This logic handles the manual selection input from the UI
    const pending = engine.state.pendingEffect;
    const runtime = engine.getPendingRuntime();
    const effect = runtime?.effect;
    const context = runtime?.context;
    const targetSchema = pending.targetSchema;
    const allowsEffectlessSelection =
        pending.actionType === 'GUARDIAN_BLOCK_UNIT_COST' ||
        pending.actionType === 'BT03_041_SELECT_EMPTY_ZONE_TO_REVIVE_SELF' ||
        pending.actionType === 'BT03_067_SELECT_EMPTY_ZONE_TO_REVIVE_EQUIPPED_UNIT' ||
        pending.actionType === 'SB01_007_SELECT_EMPTY_ZONE_TO_DEPLOY' ||
        pending.actionType === 'SB01_014_SELECT_EMPTY_ZONE_TO_DEPLOY' ||
        pending.actionType === 'ST08_006_SELECT_EMPTY_ZONE_TO_DEPLOY' ||
        pending.actionType === 'ST07_010_SELECT_EMPTY_ZONE_TO_DEPLOY' ||
        pending.actionType === 'ST08_004_SELECT_EMPTY_ZONE_TO_DEPLOY' ||
        pending.actionType === 'ST08_009_SELECT_EMPTY_ZONE_TO_DEPLOY';
    if ((!effect && !allowsEffectlessSelection) || !context || !targetSchema) return;
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

    if (pending.actionType === 'GUARDIAN_BLOCK_UNIT_COST') {
        const sourcePlayer = engine.getPlayerById(pending.sourcePlayerId);
        if (!sourcePlayer || sourcePlayer.id !== targetPlayer.id) return;

        const blockerZoneIndex = pending.actionValue?.blockerZoneIndex;
        if (typeof blockerZoneIndex !== 'number') return;
        if (zoneIndex === blockerZoneIndex) return;
        if (!targetZone.unit) return;

        trashUnitZoneWithoutTriggers(sourcePlayer, targetZone);

        engine.state.interactionMode = 'NORMAL';
        engine.state.pendingEffect = null;
        engine.clearPendingRuntime();
        engine.assignInteractionOwner(engine.currentPlayer.id);

        engine.commitBlockDeclaration(blockerZoneIndex);
        return;
    }

    if (pending.actionType === 'BT03_041_SELECT_EMPTY_ZONE_TO_REVIVE_SELF') {
        const sourcePlayer = engine.getPlayerById(pending.sourcePlayerId);
        if (!sourcePlayer || sourcePlayer.id !== targetPlayer.id) return;
        if (targetZone.unit) return;

        const sourceCard = pending.sourceCard;
        const trashIndexByRef = sourcePlayer.trash.indexOf(sourceCard);
        const trashIndexById = trashIndexByRef !== -1
            ? trashIndexByRef
            : sourcePlayer.trash.findIndex((card: any) => card?.id === sourceCard?.id);
        if (trashIndexById !== -1) {
            sourcePlayer.trash.splice(trashIndexById, 1);
        }

        targetZone.unit = sourceCard;
        targetZone.items = [];
        targetZone.buffs = [];
        targetZone.temporaryEffects = [];
        targetZone.hasAttacked = false;
        targetZone.attackCountThisTurn = 0;
        targetZone.extraAttackAllowance = 0;
        targetZone.isExhausted = false;
        targetZone.hasPlacedUnitThisTurn = false;
        targetZone.hasActivatedEffectThisTurn = false;
        targetZone.activatedEffectKeys = {};

        const powerBuffValue = Math.max(0, Number(pending.actionValue?.powerBuffValue ?? 2500));
        if (powerBuffValue > 0) {
            targetZone.buffs.push({
                id: engine.createRuntimeId('BUFF'),
                sourceCard: sourceCard,
                type: 'POWER',
                value: powerBuffValue,
                duration: 'PERMANENT',
                untilTurnCount: engine.state.turnCount + 1,
            });
        }

        engine.triggerEntryEffectsForPlacedUnit(sourcePlayer, targetZone);
        engine.state.revealedCards = [];
        engine.handleEffectCompletion(context, pending);
        return;
    }

    if (pending.actionType === 'BT03_067_SELECT_EMPTY_ZONE_TO_REVIVE_EQUIPPED_UNIT') {
        const sourcePlayer = engine.getPlayerById(pending.sourcePlayerId);
        if (!sourcePlayer || sourcePlayer.id !== targetPlayer.id) return;
        if (targetZone.unit) return;

        const reviveCardRef = pending.actionValue?.reviveCardRef;
        const reviveCardId = pending.actionValue?.reviveCardId;
        const trashIndexByRef = sourcePlayer.trash.indexOf(reviveCardRef);
        const trashIndex = trashIndexByRef !== -1
            ? trashIndexByRef
            : sourcePlayer.trash.findIndex((card: any) => card?.id === reviveCardId);
        if (trashIndex < 0) return;
        const [revivedUnit] = sourcePlayer.trash.splice(trashIndex, 1);
        if (!revivedUnit) return;

        targetZone.unit = revivedUnit;
        targetZone.items = [];
        targetZone.buffs = [];
        targetZone.temporaryEffects = [];
        targetZone.hasAttacked = false;
        targetZone.attackCountThisTurn = 0;
        targetZone.extraAttackAllowance = 0;
        targetZone.isExhausted = false;
        targetZone.hasPlacedUnitThisTurn = false;
        targetZone.hasActivatedEffectThisTurn = false;
        targetZone.activatedEffectKeys = {};

        engine.triggerEntryEffectsForPlacedUnit(sourcePlayer, targetZone);
        engine.state.revealedCards = [];
        engine.handleEffectCompletion(context, pending);
        return;
    }

    if (pending.actionType === 'SB01_007_SELECT_EMPTY_ZONE_TO_DEPLOY') {
        const sourcePlayer = engine.getPlayerById(pending.sourcePlayerId);
        if (!sourcePlayer || sourcePlayer.id !== targetPlayer.id) return;
        if (targetZone.unit) return;

        const revealedCardRef = pending.actionValue?.revealedCardRef;
        const revealedCardId = pending.actionValue?.revealedCardId;
        const revealedCardFromState = engine.state.revealedCards.find((card: any) =>
            card === revealedCardRef ||
            (revealedCardId && card?.id === revealedCardId),
        );
        const revealedCard = revealedCardFromState || revealedCardRef;
        if (!revealedCard || revealedCard.type !== 'UNIT') {
            engine.state.revealedCards = [];
            engine.handleEffectCompletion(context, pending);
            return;
        }

        const inRevealedIndex = engine.state.revealedCards.indexOf(revealedCard);
        if (inRevealedIndex !== -1) {
            engine.state.revealedCards.splice(inRevealedIndex, 1);
        }

        targetZone.unit = revealedCard;
        targetZone.items = [];
        targetZone.buffs = [];
        targetZone.temporaryEffects = [];
        targetZone.hasAttacked = false;
        targetZone.attackCountThisTurn = 0;
        targetZone.extraAttackAllowance = 0;
        targetZone.isExhausted = false;
        targetZone.hasPlacedUnitThisTurn = false;
        targetZone.hasActivatedEffectThisTurn = false;
        targetZone.activatedEffectKeys = {};
        (revealedCard as any).turnCostOverride = {
            cost: 0,
            turnCount: engine.state.turnCount,
        };

        engine.triggerEntryEffectsForPlacedUnit(sourcePlayer, targetZone);
        engine.state.revealedCards = [];
        engine.handleEffectCompletion(context, pending);
        return;
    }

    if (pending.actionType === 'SB01_014_SELECT_EMPTY_ZONE_TO_DEPLOY') {
        const sourcePlayer = engine.getPlayerById(pending.sourcePlayerId);
        if (!sourcePlayer || sourcePlayer.id !== targetPlayer.id) return;
        if (targetZone.unit) return;

        const selectedCardRef = pending.actionValue?.selectedCardRef;
        const selectedCardId = pending.actionValue?.selectedCardId;
        const trashIndexByRef = sourcePlayer.trash.indexOf(selectedCardRef);
        const trashIndex = trashIndexByRef !== -1
            ? trashIndexByRef
            : sourcePlayer.trash.findIndex((card: any) =>
                card?.id === selectedCardId &&
                card?.type === 'UNIT' &&
                engine.getCardCost(card) <= 2
            );
        if (trashIndex < 0) {
            engine.handleEffectCompletion(context, pending);
            return;
        }

        const [placedUnit] = sourcePlayer.trash.splice(trashIndex, 1);
        if (!placedUnit) {
            engine.handleEffectCompletion(context, pending);
            return;
        }

        targetZone.unit = placedUnit;
        targetZone.items = [];
        targetZone.buffs = [];
        targetZone.temporaryEffects = [];
        targetZone.hasAttacked = false;
        targetZone.attackCountThisTurn = 0;
        targetZone.extraAttackAllowance = 0;
        targetZone.isExhausted = false;
        targetZone.hasPlacedUnitThisTurn = false;
        targetZone.hasActivatedEffectThisTurn = false;
        targetZone.activatedEffectKeys = {};
        targetZone.temporaryEffects.push({
            activation: ActivationCondition.EXIT,
            description: '엑시트 : 자신의 스킬 존에서 〈페인 이터〉를 1장 골라 트래시한다.',
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'SB01_014_EXIT_TRASH_PAIN_EATER_FROM_SKILL_ZONE',
                },
            },
            duration: 'TURN_END',
        } as any);

        engine.triggerEntryEffectsForPlacedUnit(sourcePlayer, targetZone);
        engine.handleEffectCompletion(context, pending);
        return;
    }

    if (pending.actionType === 'ST07_010_SELECT_EMPTY_ZONE_TO_DEPLOY') {
        const sourcePlayer = engine.getPlayerById(pending.sourcePlayerId);
        if (!sourcePlayer || sourcePlayer.id !== targetPlayer.id) return;
        if (targetZone.unit) return;

        const selectedCardRef = pending.actionValue?.selectedCardRef;
        const selectedCardId = pending.actionValue?.selectedCardId;
        const trashIndexByRef = sourcePlayer.trash.indexOf(selectedCardRef);
        const trashIndex = trashIndexByRef !== -1
            ? trashIndexByRef
            : sourcePlayer.trash.findIndex((card: any) =>
                card?.id === selectedCardId &&
                card?.type === 'UNIT' &&
                engine.getCardCost(card) <= 3
            );
        if (trashIndex < 0) {
            engine.handleEffectCompletion(context, pending);
            return;
        }

        const [placedUnit] = sourcePlayer.trash.splice(trashIndex, 1);
        if (!placedUnit) {
            engine.handleEffectCompletion(context, pending);
            return;
        }

        targetZone.unit = placedUnit;
        targetZone.items = [];
        targetZone.buffs = [];
        targetZone.temporaryEffects = [];
        targetZone.hasAttacked = false;
        targetZone.attackCountThisTurn = 0;
        targetZone.extraAttackAllowance = 0;
        targetZone.isExhausted = false;
        targetZone.hasPlacedUnitThisTurn = false;
        targetZone.hasActivatedEffectThisTurn = false;
        targetZone.activatedEffectKeys = {};

        engine.triggerEntryEffectsForPlacedUnit(sourcePlayer, targetZone);
        engine.handleEffectCompletion(context, pending);
        return;
    }

    if (pending.actionType === 'ST08_004_SELECT_EMPTY_ZONE_TO_DEPLOY') {
        const sourcePlayer = engine.getPlayerById(pending.sourcePlayerId);
        if (!sourcePlayer || sourcePlayer.id !== targetPlayer.id) return;
        if (targetZone.unit) return;

        const selectedCardRef = pending.actionValue?.selectedCardRef;
        const selectedCardId = pending.actionValue?.selectedCardId;
        const handIndexByRef = sourcePlayer.hand.indexOf(selectedCardRef);
        const handIndex = handIndexByRef !== -1
            ? handIndexByRef
            : sourcePlayer.hand.findIndex((card: any) =>
                card?.id === selectedCardId &&
                card?.type === 'UNIT' &&
                engine.getCardCost(card) <= sourcePlayer.leaderLevel
            );
        if (handIndex < 0) {
            engine.handleEffectCompletion(context, pending);
            return;
        }

        const [placedUnit] = sourcePlayer.hand.splice(handIndex, 1);
        if (!placedUnit) {
            engine.handleEffectCompletion(context, pending);
            return;
        }

        targetZone.unit = placedUnit;
        targetZone.items = [];
        targetZone.buffs = [];
        targetZone.temporaryEffects = [];
        targetZone.hasAttacked = false;
        targetZone.attackCountThisTurn = 0;
        targetZone.extraAttackAllowance = 0;
        targetZone.isExhausted = false;
        targetZone.hasPlacedUnitThisTurn = false;
        targetZone.hasActivatedEffectThisTurn = false;
        targetZone.activatedEffectKeys = {};
        targetZone.temporaryEffects.push({
            activation: ActivationCondition.PASSIVE,
            description: '패시브 : 이 유닛은 이번 턴에 공격할 수 없다.',
            action: {
                type: 'NONE',
                params: {
                    cannotAttackUntilTurnCount: engine.state.turnCount,
                },
            },
            duration: 'PERMANENT',
        } as any);

        engine.triggerEntryEffectsForPlacedUnit(sourcePlayer, targetZone);
        engine.handleEffectCompletion(context, pending);
        return;
    }

    if (pending.actionType === 'ST08_006_SELECT_EMPTY_ZONE_TO_DEPLOY') {
        const sourcePlayer = engine.getPlayerById(pending.sourcePlayerId);
        if (!sourcePlayer || sourcePlayer.id !== targetPlayer.id) return;
        if (targetZone.unit) return;

        const selectedCardRef = pending.actionValue?.selectedCardRef;
        const selectedCardId = pending.actionValue?.selectedCardId;
        const selectedCard = engine.state.revealedCards.find((card: any) =>
            card === selectedCardRef ||
            (selectedCardId && card?.id === selectedCardId)
        );
        if (!selectedCard || selectedCard.type !== 'UNIT') {
            sourcePlayer.trash.push(...engine.state.revealedCards);
            engine.state.revealedCards = [];
            engine.handleEffectCompletion(context, pending);
            return;
        }

        const remainingCards = engine.state.revealedCards.filter((card: any) => card !== selectedCard);
        targetZone.unit = selectedCard;
        targetZone.items = [];
        targetZone.buffs = [];
        targetZone.temporaryEffects = [];
        targetZone.hasAttacked = false;
        targetZone.attackCountThisTurn = 0;
        targetZone.extraAttackAllowance = 0;
        targetZone.isExhausted = false;
        targetZone.hasPlacedUnitThisTurn = false;
        targetZone.hasActivatedEffectThisTurn = false;
        targetZone.activatedEffectKeys = {};
        (selectedCard as any).turnCostOverride = {
            cost: 0,
            turnCount: engine.state.turnCount,
        };
        targetZone.buffs.push({
            id: engine.createRuntimeId('BUFF'),
            sourceCard: pending.sourceCard,
            type: 'POWER',
            value: 5000,
            duration: 'TURN_END',
        });
        targetZone.buffs.push({
            id: engine.createRuntimeId('BUFF'),
            sourceCard: pending.sourceCard,
            type: 'HIT',
            value: 1,
            duration: 'TURN_END',
        });

        if (remainingCards.length > 0) {
            sourcePlayer.trash.push(...remainingCards);
        }

        engine.state.revealedCards = [];
        engine.triggerEntryEffectsForPlacedUnit(sourcePlayer, targetZone);
        engine.handleEffectCompletion(context, pending);
        return;
    }

    if (pending.actionType === 'ST08_009_SELECT_EMPTY_ZONE_TO_DEPLOY') {
        const sourcePlayer = engine.getPlayerById(pending.sourcePlayerId);
        if (!sourcePlayer || sourcePlayer.id !== targetPlayer.id) return;
        if (targetZone.unit) return;

        const revealedCardRef = pending.actionValue?.revealedCardRef;
        const revealedCardId = pending.actionValue?.revealedCardId;
        const revealedCardFromState = engine.state.revealedCards.find((card: any) =>
            card === revealedCardRef ||
            (revealedCardId && card?.id === revealedCardId),
        );
        const revealedCard = revealedCardFromState || revealedCardRef;
        if (!revealedCard || revealedCard.type !== 'UNIT') {
            engine.state.revealedCards = [];
            engine.handleEffectCompletion(context, pending);
            return;
        }

        const revealedIndex = engine.state.revealedCards.indexOf(revealedCard);
        if (revealedIndex !== -1) {
            engine.state.revealedCards.splice(revealedIndex, 1);
        }

        targetZone.unit = revealedCard;
        targetZone.items = [];
        targetZone.buffs = [];
        targetZone.temporaryEffects = [];
        targetZone.hasAttacked = false;
        targetZone.attackCountThisTurn = 0;
        targetZone.extraAttackAllowance = 0;
        targetZone.isExhausted = false;
        targetZone.hasPlacedUnitThisTurn = false;
        targetZone.hasActivatedEffectThisTurn = false;
        targetZone.activatedEffectKeys = {};

        engine.triggerEntryEffectsForPlacedUnit(sourcePlayer, targetZone);
        engine.state.revealedCards = [];
        engine.handleEffectCompletion(context, pending);
        return;
    }

    // If everything good, execute
    if (effect.action.type === 'DESTROY_LANE_LOWEST') {
        context.selectedLaneIndex = zoneIndex;
    }

    // Multi-target logic
    const maxCount = targetSchema.count || 1;
    const selectedTargets = pending.selectedTargets ?? (pending.selectedTargets = []);
    if (maxCount > 1) {
        const allowDuplicates = pending.actionValue?.allowDuplicates === true;
        if (allowDuplicates) {
            if (selectedTargets.length >= maxCount) {
                console.log(`Cannot select more than ${maxCount} targets.`);
                return;
            }
            if (!canAddTargetWithSelectionConstraints(targetSchema, context, selectedTargets, targetZone, pending.actionValue)) {
                console.log('Cannot select target: total cost limit exceeded.');
                return;
            }
            selectedTargets.push(targetZone);
            console.log(`Target added. ${selectedTargets.length}/${maxCount}`);
        } else if (!selectedTargets.includes(targetZone)) {
            if (selectedTargets.length >= maxCount) {
                console.log(`Cannot select more than ${maxCount} targets.`);
                return;
            }
            if (!canAddTargetWithSelectionConstraints(targetSchema, context, selectedTargets, targetZone, pending.actionValue)) {
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
    if (!context || !targetSchema) return;
    const allowsEffectlessConfirm =
        pending.actionType === 'BT06_SELECT_SKILL_ZONE_CARD' ||
        pending.actionType === 'BT06_SELECT_TRASHED_SKILL_TO_CAST' ||
        pending.actionType === 'BT03_SELECT_SKILL_ZONE_CARD_TO_TRASH' ||
        pending.actionType === 'BT03_011_SELECT_SKILL_ZONE_CARD_TO_TRASH' ||
        pending.actionType === 'BT03_011_SELECT_TRASH_LOWER_COST_TO_HAND' ||
        pending.actionType === 'BT03_079_SELECT_8_ITEMS_FROM_HAND_TRASH' ||
        pending.actionType === 'GUARDIAN_BLOCK_UNIT_COST';
    if (!effect && !allowsEffectlessConfirm) return;

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

    if (
        pending.actionType === 'BT06_SELECT_SKILL_ZONE_CARD' ||
        pending.actionType === 'BT06_SELECT_TRASHED_SKILL_TO_CAST' ||
        pending.actionType === 'BT03_SELECT_SKILL_ZONE_CARD_TO_TRASH' ||
        pending.actionType === 'BT03_011_SELECT_SKILL_ZONE_CARD_TO_TRASH' ||
        pending.actionType === 'BT03_011_SELECT_TRASH_LOWER_COST_TO_HAND'
    ) {
        engine.state.revealedCards = [];
        engine.handleEffectCompletion(context, pending);
        return;
    }

    if (pending.actionType === 'BT03_079_SELECT_8_ITEMS_FROM_HAND_TRASH') {
        const sourcePlayer = engine.getPlayerById(pending.sourcePlayerId);
        const sourceOpponent = sourcePlayer ? engine.getOpponentOf(sourcePlayer) : null;
        if (!sourcePlayer || !sourceOpponent) return;

        const selectedCards = (pending.selectedTargets ?? []).slice(0, 8);
        if (selectedCards.length !== 8) return;

        const movedCards: any[] = [];
        selectedCards.forEach((card: any) => {
            const handIndex = sourcePlayer.hand.indexOf(card);
            if (handIndex !== -1) {
                const [removed] = sourcePlayer.hand.splice(handIndex, 1);
                if (removed) movedCards.push(removed);
                return;
            }
            const trashIndex = sourcePlayer.trash.indexOf(card);
            if (trashIndex !== -1) {
                const [removed] = sourcePlayer.trash.splice(trashIndex, 1);
                if (removed) movedCards.push(removed);
            }
        });
        if (movedCards.length !== 8) return;

        sourcePlayer.deck.unshift(...movedCards);
        engine.state.revealedCards = [];

        pending.actionType = 'BT03_079_SELECT_OPP_UNITS_COST_SUM_UP_TO_8';
        pending.actionValue = {
            totalCostLimit: 8,
            allowPartialSelection: true,
        };
        pending.effectDescription = '코스트 합이 8 이하가 되도록 트래시할 상대 유닛을 선택한다.';
        pending.validTargets = 'OPP_UNITS' as any;
        pending.targetSchema = {
            scope: 'OPP_FIELD',
            type: 'UNIT',
            count: 3,
            totalCostLimit: 8,
            selectMode: 'MANUAL',
        } as any;
        pending.selectedTargets = [];
        engine.setPendingRuntime(context, {
            activation: 'ACTIVE' as any,
            description: 'BT03-079 resolve destroy and draw',
            targets: pending.targetSchema as any,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT03_079_ENTRY_PAY_8_ITEMS_THEN_DESTROY_AND_DRAW',
                    stage: 'RESOLVE_DESTROY_AND_DRAW',
                    totalCostLimit: 8,
                },
            },
        } as any);
        engine.assignInteractionOwner(sourcePlayer.id);
        return;
    }

    if (pending.actionType === 'BT06_062_SELECT_UNIQUE_TRASH_SKILLS') {
        // Clear prompt cards before resolving to avoid stale revealed modal after confirm.
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
    const allowsEffectlessSelection = pending.actionType === 'BT03_078_REPLACEMENT_SELECT_TRASH_ITEM_TO_BOTTOM';
    if ((!effect && !allowsEffectlessSelection) || !context || !targetSchema) return;
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

    if (pending.actionType === 'BT03_078_REPLACEMENT_SELECT_TRASH_ITEM_TO_BOTTOM') {
        const player = engine.getPlayerById(pending.sourcePlayerId);
        if (!player || player.id !== expectedPlayerId) return;

        const selectedIndex = player.trash.indexOf(card);
        if (selectedIndex === -1) return;
        const [selectedItem] = player.trash.splice(selectedIndex, 1);
        if (!selectedItem) return;
        player.deck.unshift(selectedItem);

        const destroyPayload = pending.actionValue?.destroyPayload;
        const zoneIndex = destroyPayload?.zoneIndex;
        if (typeof zoneIndex === 'number' && zoneIndex >= 0 && zoneIndex < player.unitZones.length) {
            const zone = player.unitZones[zoneIndex];
            if (zone?.unit) {
                player.hand.push(zone.unit);
                zone.items.forEach((item: any) => player.hand.push(item));
                zone.unit = null;
                zone.items = [];
                zone.buffs = [];
                zone.temporaryEffects = [];
                zone.attackCountThisTurn = 0;
                zone.extraAttackAllowance = 0;
                zone.hasAttacked = false;
            }
        }

        engine.resetInteractionMode();
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
            if (!canAddTargetWithSelectionConstraints(targetSchema, context, selectedTargets, card, pending.actionValue)) {
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
            if (!canAddTargetWithSelectionConstraints(targetSchema, context, selectedTargets, targetCard, pending.actionValue)) {
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
    const allowsEffectlessSelection =
        pending.actionType === 'GUARDIAN_BLOCK_ITEM_COST' ||
        pending.actionType === 'BT03_083_REPLACEMENT_SELECT_EQUIPPED_ITEM_TO_TRASH';
    if ((!effect && !allowsEffectlessSelection) || !context || !targetSchema) return;

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

    if (pending.actionType === 'GUARDIAN_BLOCK_ITEM_COST') {
        const sourcePlayer = engine.getPlayerById(pending.sourcePlayerId);
        if (!sourcePlayer || sourcePlayer.id !== targetPlayer.id) return;

        const blockerZoneIndex = pending.actionValue?.blockerZoneIndex;
        if (typeof blockerZoneIndex !== 'number') return;
        if (zoneIndex !== blockerZoneIndex) return;

        const requiredItemName = pending.actionValue?.itemName;
        const requiredItemCardId = pending.actionValue?.itemCardId;
        if (requiredItemCardId && targetCard.id !== requiredItemCardId) return;
        if (requiredItemName && !String(targetCard.name || '').includes(requiredItemName)) return;

        const [removed] = zone.items.splice(itemIndex, 1);
        if (!removed) return;
        sourcePlayer.trash.push(removed);

        engine.state.interactionMode = 'NORMAL';
        engine.state.pendingEffect = null;
        engine.clearPendingRuntime();
        engine.assignInteractionOwner(engine.currentPlayer.id);

        engine.commitBlockDeclaration(blockerZoneIndex);
        return;
    }

    if (pending.actionType === 'BT03_083_REPLACEMENT_SELECT_EQUIPPED_ITEM_TO_TRASH') {
        const sourcePlayer = engine.getPlayerById(pending.sourcePlayerId);
        if (!sourcePlayer || sourcePlayer.id !== targetPlayer.id) return;
        const destroyPayload = pending.actionValue?.destroyPayload;
        const payloadZoneIndex = destroyPayload?.zoneIndex;
        if (typeof payloadZoneIndex !== 'number' || payloadZoneIndex !== zoneIndex) return;
        if (!targetCard?.id?.startsWith('BT03-083')) return;

        const [trashedGoggle] = zone.items.splice(itemIndex, 1);
        if (!trashedGoggle) return;
        sourcePlayer.trash.push(trashedGoggle);

        if (zone.unit) {
            sourcePlayer.hand.push(zone.unit);
            zone.items.forEach((item: any) => sourcePlayer.hand.push(item));
            zone.unit = null;
            zone.items = [];
            zone.buffs = [];
            zone.temporaryEffects = [];
            zone.attackCountThisTurn = 0;
            zone.extraAttackAllowance = 0;
            zone.hasAttacked = false;
        }

        engine.resetInteractionMode();
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
            if (!canAddTargetWithSelectionConstraints(targetSchema, context, selectedTargets, targetCard, pending.actionValue)) {
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

    if (pending.actionType === 'BT03_057_OPP_SELECT_MATCH_OR_SKIP') {
        const selectedTargets = pending.selectedTargets ?? (pending.selectedTargets = []);
        if (selectedTargets.includes(targetCard)) {
            pending.selectedTargets = selectedTargets.filter((card: any) => card !== targetCard);
        } else {
            pending.selectedTargets = [targetCard];
        }
        return;
    }

    if (pending.actionType === 'BT03_085_OPP_SELECT_HAND_FOR_HIT_OR_SKIP') {
        const selectedTargets = pending.selectedTargets ?? (pending.selectedTargets = []);
        if (selectedTargets.includes(targetCard)) {
            pending.selectedTargets = selectedTargets.filter((card: any) => card !== targetCard);
        } else {
            pending.selectedTargets = [targetCard];
        }
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
            if (!canAddTargetWithSelectionConstraints(targetSchema, context, selectedTargets, targetCard, pending.actionValue)) {
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

    if (pending.actionType === 'SB01_007_SELECT_REVEALED_DEPLOY_CARD') {
        const selectedTargets = pending.selectedTargets ?? (pending.selectedTargets = []);
        if (selectedTargets.includes(card)) {
            pending.selectedTargets = selectedTargets.filter((target: any) => target !== card);
        } else {
            pending.selectedTargets = [card];
        }
        return;
    }

    if (pending.actionType === 'BT06_SELECT_ATTACK_ACTIVE_EFFECT') {
        const option = pending.actionValue?.options?.[index];
        const sourceZoneIndex = pending.actionValue?.sourceZoneIndex;
        const sourcePlayer = engine.getPlayerById(pending.sourcePlayerId);
        if (!sourcePlayer || typeof sourceZoneIndex !== 'number' || !option) return;
        const sourceZone = sourcePlayer.unitZones[sourceZoneIndex];
        const sourceUnit = sourceZone?.unit;
        if (!sourceZone || !sourceUnit) return;
        const selectedEffect = sourceUnit.effects?.[option.effectIndex];
        if (!selectedEffect) return;
        const opponent = engine.state.players.find((player: any) => player.id !== sourcePlayer.id);
        if (!opponent) return;

        const selectedEffectContext: GameContext = {
            sourceCard: sourceUnit,
            player: sourcePlayer,
            opponent,
            unitZone: sourceZone,
            machine: engine,
        };

        engine.state.revealedCards = [];
        engine.effectManager.processEffect(selectedEffect, selectedEffectContext);
        engine.handleEffectCompletion(context, pending);
        return;
    }

    if (pending.actionType === 'BT06_SELECT_ENTRY_EFFECT') {
        const option = pending.actionValue?.options?.[index];
        const sourceZoneIndex = pending.actionValue?.sourceZoneIndex;
        const sourcePlayer = engine.getPlayerById(pending.sourcePlayerId);
        if (!sourcePlayer || typeof sourceZoneIndex !== 'number' || !option) return;

        const sourceZone = sourcePlayer.unitZones[sourceZoneIndex];
        const sourceUnit = sourceZone?.unit;
        if (!sourceZone || !sourceUnit) return;

        const selectedEffect = sourceUnit.effects?.[option.effectIndex];
        if (!selectedEffect) return;
        const sourceOpponent = engine.state.players.find((player: any) => player.id !== sourcePlayer.id);
        if (!sourceOpponent) return;

        const selectedEffectContext: GameContext = {
            sourceCard: sourceUnit,
            player: sourcePlayer,
            opponent: sourceOpponent,
            unitZone: sourceZone,
            machine: engine,
        };

        engine.state.revealedCards = [];
        engine.effectManager.processEffect(selectedEffect, selectedEffectContext);
        engine.handleEffectCompletion(context, pending);
        return;
    }

    if (pending.actionType === 'BT03_052_SELECT_SKILL_ZONE_COST3_TO_TRASH') {
        const option = pending.actionValue?.options?.[index];
        const sourcePlayer = engine.getPlayerById(pending.sourcePlayerId);
        if (!sourcePlayer || !option) return;

        const skillZoneIndex = option.skillZoneIndex;
        if (typeof skillZoneIndex !== 'number' || skillZoneIndex < 0 || skillZoneIndex >= sourcePlayer.skillZone.length) return;
        const [selectedSkill] = sourcePlayer.skillZone.splice(skillZoneIndex, 1);
        if (!selectedSkill) return;
        sourcePlayer.trash.push(selectedSkill);

        const sourceOpponent = engine.state.players.find((player: any) => player.id !== sourcePlayer.id);
        if (!sourceOpponent) return;
        const followUpEffect = {
            activation: ActivationCondition.ACTIVE,
            description: 'BT03-052 : [엔트리]를 가진 자신 유닛을 1장 선택한다.',
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'HAS_KEYWORD', value: '엔트리' }],
                selectMode: 'MANUAL',
            },
            action: {
                type: 'COMPLEX_ACTION',
                params: { mode: 'PROMPT_SELECT_ENTRY_EFFECT' },
            },
        } as any;
        const followUpContext: GameContext = {
            sourceCard: pending.sourceCard,
            player: sourcePlayer,
            opponent: sourceOpponent,
            machine: engine,
        };
        engine.effectManager.processEffect(followUpEffect, followUpContext);

        engine.state.revealedCards = [];
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

    if (pending.actionType === 'BT03_SELECT_SKILL_ZONE_CARD_TO_TRASH') {
        const option = pending.actionValue?.options?.[index];
        const sourcePlayer = engine.getPlayerById(pending.sourcePlayerId);
        if (!sourcePlayer || !option) return;

        const skillZoneIndex = option.skillZoneIndex;
        if (typeof skillZoneIndex !== 'number' || skillZoneIndex < 0 || skillZoneIndex >= sourcePlayer.skillZone.length) return;
        const [selectedSkill] = sourcePlayer.skillZone.splice(skillZoneIndex, 1);
        if (!selectedSkill) return;
        sourcePlayer.trash.push(selectedSkill);

        context.flags = context.flags || {};
        const contextFlagKey = pending.actionValue?.contextFlagKey || 'BT03_SKILL_ZONE_CARD_TRASHED';
        context.flags[contextFlagKey] = true;
        context.flags.BT03_LAST_TRASHED_SKILL_COST = engine.getCardCost(selectedSkill);

        executeBt06FollowUpSubActions(engine, context, pending.actionValue?.followUpSubActions || []);

        engine.state.revealedCards = [];
        engine.handleEffectCompletion(context, pending);
        return;
    }

    if (pending.actionType === 'BT03_011_SELECT_SKILL_ZONE_CARD_TO_TRASH') {
        const option = pending.actionValue?.options?.[index];
        const sourcePlayer = engine.getPlayerById(pending.sourcePlayerId);
        if (!sourcePlayer || !option) return;

        const skillZoneIndex = option.skillZoneIndex;
        if (typeof skillZoneIndex !== 'number' || skillZoneIndex < 0 || skillZoneIndex >= sourcePlayer.skillZone.length) return;
        const [selectedSkill] = sourcePlayer.skillZone.splice(skillZoneIndex, 1);
        if (!selectedSkill) return;
        sourcePlayer.trash.push(selectedSkill);

        const selectedCost = engine.getCardCost(selectedSkill);
        const lowerCostCandidates = sourcePlayer.trash.filter((targetCard: any) =>
            targetCard && targetCard !== selectedSkill && engine.getCardCost(targetCard) < selectedCost
        );

        if (lowerCostCandidates.length === 0) {
            engine.state.revealedCards = [];
            engine.handleEffectCompletion(context, pending);
            return;
        }

        engine.state.revealedCards = lowerCostCandidates;
        pending.actionType = 'BT03_011_SELECT_TRASH_LOWER_COST_TO_HAND';
        pending.actionValue = { allowPartialSelection: false };
        pending.effectDescription = '패에 넣을 카드를 선택한다.';
        pending.validTargets = 'REVEALED';
        pending.targetSchema = {
            scope: 'REVEALED',
            type: 'CARD',
            count: 1,
            selectMode: 'MANUAL',
        } as any;
        pending.selectedTargets = [];
        return;
    }

    if (pending.actionType === 'BT03_011_SELECT_TRASH_LOWER_COST_TO_HAND') {
        const sourcePlayer = engine.getPlayerById(pending.sourcePlayerId);
        if (!sourcePlayer) return;
        const trashIndex = sourcePlayer.trash.indexOf(card);
        if (trashIndex === -1) return;
        const [selectedCard] = sourcePlayer.trash.splice(trashIndex, 1);
        if (selectedCard) {
            sourcePlayer.hand.push(selectedCard);
        }

        engine.state.revealedCards = [];
        engine.handleEffectCompletion(context, pending);
        return;
    }

    if (pending.actionType === 'BT03_062_SELECT_SKILL_ZONE_TO_CAST') {
        const option = pending.actionValue?.options?.[index];
        const sourcePlayer = engine.getPlayerById(pending.sourcePlayerId);
        if (!sourcePlayer || !option) return;

        const skillZoneIndex = option.skillZoneIndex;
        if (typeof skillZoneIndex !== 'number' || skillZoneIndex < 0 || skillZoneIndex >= sourcePlayer.skillZone.length) return;
        const selectedSkill = sourcePlayer.skillZone[skillZoneIndex];
        if (!selectedSkill) return;

        const sourceOpponent = engine.state.players.find((player: any) => player.id !== sourcePlayer.id);
        if (!sourceOpponent) return;

        const batchStep = engine.incrementAndGetGlobalStep();
        const castContext: GameContext = {
            sourceCard: selectedSkill,
            player: sourcePlayer,
            opponent: sourceOpponent,
            machine: engine,
        };

        engine.state.revealedCards = [];
        engine.effectManager.processEffects(ActivationCondition.ACTIVE, castContext, { enqueueOnly: true, batchStep });
        if (engine.state.phase === Phase.MAIN) {
            engine.effectManager.processEffects(ActivationCondition.ACTIVE_MAIN, castContext, { enqueueOnly: true, batchStep });
        }
        engine.handleEffectCompletion(context, pending);
        engine.effectManager.processQueue();
        return;
    }

    if (pending.actionType === 'BT03_082_SELECT_EQUIPPED_ITEM_TO_COPY') {
        const option = pending.actionValue?.options?.[index];
        const sourcePlayer = engine.getPlayerById(pending.sourcePlayerId);
        const sourceZoneIndex = pending.actionValue?.sourceZoneIndex;
        if (!sourcePlayer || !option || typeof sourceZoneIndex !== 'number') return;

        const sourceZone = sourcePlayer.unitZones[sourceZoneIndex];
        if (!sourceZone?.unit) return;
        const itemIndex = option.itemIndex;
        if (typeof itemIndex !== 'number' || itemIndex < 0 || itemIndex >= sourceZone.items.length) return;
        const selectedItem = sourceZone.items[itemIndex];
        if (!selectedItem) return;

        sourcePlayer.unitZones.forEach((targetZone: any, targetZoneIndex: number) => {
            if (!targetZone?.unit) return;
            if (targetZoneIndex === sourceZoneIndex) return;
            (selectedItem.effects || []).forEach((itemEffect: any) => {
                const copiedEffect = JSON.parse(JSON.stringify(itemEffect));
                copiedEffect.duration = 'TURN_END';
                targetZone.temporaryEffects.push(copiedEffect);
            });
        });

        engine.state.revealedCards = [];
        engine.handleEffectCompletion(context, pending);
        return;
    }

    if (pending.actionType === 'BT03_079_SELECT_8_ITEMS_FROM_HAND_TRASH') {
        const selectedTargets = pending.selectedTargets ?? (pending.selectedTargets = []);
        const maxCount = targetSchema.count || 8;
        const existingIndex = selectedTargets.indexOf(card);
        if (existingIndex !== -1) {
            selectedTargets.splice(existingIndex, 1);
            return;
        }
        if (selectedTargets.length >= maxCount) return;
        selectedTargets.push(card);
        return;
    }

    if (pending.actionType === 'BT03_041_SELECT_EXIT_HAND_CARD') {
        const option = pending.actionValue?.options?.[index];
        const sourcePlayer = engine.getPlayerById(pending.sourcePlayerId);
        if (!sourcePlayer || !option) return;

        const handIndex = option.handIndex;
        if (typeof handIndex !== 'number' || handIndex < 0 || handIndex >= sourcePlayer.hand.length) return;
        const [selectedCard] = sourcePlayer.hand.splice(handIndex, 1);
        if (selectedCard) {
            sourcePlayer.trash.push(selectedCard);
            engine.notifyHandTrashed(sourcePlayer, [selectedCard], {
                flags: { handTrashByEffect: true },
            });
        }

        const emptyZones = sourcePlayer.unitZones
            .map((zone: any, zoneIndex: number) => ({ zone, zoneIndex }))
            .filter(({ zone }: any) => !zone?.unit);
        if (emptyZones.length === 0) {
            engine.state.revealedCards = [];
            engine.handleEffectCompletion(context, pending);
            return;
        }

        engine.state.revealedCards = [];
        pending.actionType = 'BT03_041_SELECT_EMPTY_ZONE_TO_REVIVE_SELF';
        pending.effectDescription = '부활시킬 빈 유닛 존을 선택한다.';
        pending.validTargets = 'MY_UNITS';
        pending.targetSchema = {
            scope: 'MY_FIELD',
            type: 'ALL',
            count: 1,
            selectMode: 'MANUAL',
        } as any;
        pending.selectedTargets = [];
        engine.assignInteractionOwner(pending.controllerPlayerId ?? pending.sourcePlayerId);
        return;
    }

    if (pending.actionType === 'BT03_051_SELECT_EXIT_EFFECT_TO_GAIN') {
        const option = pending.actionValue?.options?.[index];
        const sourcePlayer = engine.getPlayerById(pending.sourcePlayerId);
        const sourceZoneIndex = pending.actionValue?.sourceZoneIndex;
        if (!sourcePlayer || !option || typeof sourceZoneIndex !== 'number') return;

        const sourceZone = sourcePlayer.unitZones[sourceZoneIndex];
        if (!sourceZone?.unit) return;
        const selectedEffect = option.effect;
        if (!selectedEffect) return;

        const actionDurationOverride =
            selectedEffect.actionDurationOverride !== undefined
                ? selectedEffect.actionDurationOverride
                : (selectedEffect.duration && selectedEffect.duration !== 'TURN_END' ? selectedEffect.duration : undefined);

        sourceZone.temporaryEffects.push({
            ...selectedEffect,
            duration: pending.actionValue?.duration || 'OPP_TURN_END',
            actionDurationOverride,
        });

        engine.state.revealedCards = [];
        engine.handleEffectCompletion(context, pending);
        return;
    }

    if (pending.actionType === 'BT06_SELECT_TRASHED_SKILL_TO_CAST') {
        const sourcePlayer = engine.getPlayerById(pending.sourcePlayerId);
        if (!sourcePlayer) return;
        const sourceOpponent = engine.state.players.find((player: any) => player.id !== sourcePlayer.id);
        if (!sourceOpponent) return;

        const batchStep = engine.incrementAndGetGlobalStep();
        const castContext: GameContext = {
            sourceCard: card,
            player: sourcePlayer,
            opponent: sourceOpponent,
            machine: engine,
        };

        engine.state.revealedCards = [];
        engine.effectManager.processEffects(ActivationCondition.ACTIVE, castContext, { enqueueOnly: true, batchStep });
        if (engine.state.phase === Phase.MAIN) {
            engine.effectManager.processEffects(ActivationCondition.ACTIVE_MAIN, castContext, { enqueueOnly: true, batchStep });
        }

        engine.handleEffectCompletion(context, pending);
        engine.effectManager.processQueue();
        return;
    }

    if (pending.actionType === 'BT04_SELECT_SCRIPTED_OPTION') {
        const option = pending.actionValue?.options?.[index];
        if (!option) return;

        executeBt06FollowUpSubActions(engine, context, option.subActions || []);
        engine.state.revealedCards = [];
        engine.handleEffectCompletion(context, pending);
        return;
    }

    if (pending.actionType === 'BT04_066_SELECT_REVEALED_TO_DAMAGE') {
        engine.effectManager.executeEffect(effect, context, [card]);
        return;
    }

    if (pending.actionType === 'SB01_001_SELECT_SKILL_ZONE_TO_TRASH') {
        const option = pending.actionValue?.options?.[index];
        const sourcePlayer = engine.getPlayerById(pending.sourcePlayerId);
        if (!sourcePlayer || !option) return;

        const skillZoneIndex = option.skillZoneIndex;
        if (typeof skillZoneIndex !== 'number' || skillZoneIndex < 0 || skillZoneIndex >= sourcePlayer.skillZone.length) return;
        const [trashedSkill] = sourcePlayer.skillZone.splice(skillZoneIndex, 1);
        if (!trashedSkill) return;
        sourcePlayer.trash.push(trashedSkill);

        context.flags = context.flags || {};
        context.flags.SB01_001_TRASHED_SKILL_COST = engine.getCardCost(trashedSkill);

        const targetSchema = {
            scope: 'OPP_FIELD',
            type: 'UNIT',
            count: 1,
            selectMode: 'MANUAL',
        } as const;

        pending.actionType = 'SB01_001_SELECT_OPP_UNIT_FOR_DEBUFF';
        pending.actionValue = {
            skillCost: engine.getCardCost(trashedSkill),
        };
        pending.effectDescription = '파워를 감소시킬 상대 유닛을 선택한다.';
        pending.validTargets = 'OPP_UNITS';
        pending.targetSchema = targetSchema as any;
        pending.selectedTargets = [];
        engine.state.revealedCards = [];
        engine.setPendingRuntime(context, {
            activation: ActivationCondition.ENTRY,
            description: 'SB01-001 resolve debuff by trashed skill cost',
            targets: targetSchema as any,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'SB01_001_ENTRY_PROMPT_SKILL_COST_DEBUFF',
                    stage: 'RESOLVE',
                },
            },
        } as any);
        engine.assignInteractionOwner(pending.controllerPlayerId ?? pending.sourcePlayerId);
        return;
    }

    if (pending.actionType === 'ST08_006_SELECT_REVEALED_UNIT_TO_DEPLOY') {
        engine.effectManager.executeEffect(effect, context, [card]);
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
            if (!canAddTargetWithSelectionConstraints(targetSchema, context, selectedTargets, card, pending.actionValue)) {
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
        if (currentPending?.validTargets === 'REVEALED') {
            engine.state.revealedCards = [];
        }
        engine.resetInteractionMode();
    }

    if (
        currentPending?.actionType === engine.endPhaseHandAdjustActionType
    ) {
        engine.finalizeEndPhaseHandAdjustmentIfReady();
    }
}
