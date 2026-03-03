import {
    ActivationCondition,
    Phase,
    type Card,
    type EngineAction,
    type Effect,
    type GameContext,
    type UnitZoneState,
} from '../../types';
import { RuleValidator } from '../../RuleValidator';
import { TargetSelector } from '../../TargetSelector';

function getTargetCard(target: any): Card | null {
    if (!target) return null;
    if (typeof target === 'object' && 'unit' in target) return target.unit ?? null;
    if (typeof target === 'object' && 'type' in target) return target as Card;
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
        return Math.max(0, context.player.damage.length + add);
    }
    return null;
}

function canAddTargetWithinTotalCost(targetSchema: any, selectedTargets: any[], nextTarget: any, context: GameContext): boolean {
    const limit = resolveTotalCostLimit(targetSchema, context);
    if (limit === null) return true;
    if (selectedTargets.includes(nextTarget)) return true;
    const currentCost = selectedTargets.reduce((sum, target) => sum + getTargetCost(target, context), 0);
    return currentCost + getTargetCost(nextTarget, context) <= limit;
}

export function buildLegalActions(engine: any, actorPlayerId?: string): EngineAction[] {
    if (engine.state.winner) return [];

    const actorIds = actorPlayerId ? [actorPlayerId] : engine.state.players.map((p: any) => p.id);
    const actions: EngineAction[] = [];

    actorIds.forEach((id: string) => {
        const actor = engine.getPlayerById(id);
        if (!actor) return;
        if (!engine.canActorInput(id)) return;

        if (engine.state.interactionMode === 'SELECT_MULLIGAN') {
            const currentActorId = engine.state.mulliganState?.pendingPlayerIds[0];
            if (!currentActorId || currentActorId !== id) return;

            actions.push({ type: 'RESOLVE_MULLIGAN', actorPlayerId: id, shouldMulligan: false });
            actions.push({ type: 'RESOLVE_MULLIGAN', actorPlayerId: id, shouldMulligan: true });
            return;
        }

        if (engine.state.interactionMode === 'NORMAL') {
            if (engine.state.phase === Phase.BLOCK) {
                if (id !== engine.opponentPlayer.id) return;
                const attackerZoneIndex = engine.state.pendingAttackerIndex;
                if (attackerZoneIndex === null) return;
                const candidateBlockers = engine.getAvailableBlockerZoneIndexes(attackerZoneIndex);
                const encounterBlockForced = engine.isEncounterBlockForced(attackerZoneIndex, candidateBlockers);
                candidateBlockers.forEach((blockerZoneIndex: number) => {
                    actions.push({ type: 'RESOLVE_BLOCK', actorPlayerId: id, shouldBlock: true, blockerZoneIndex });
                });
                if (!encounterBlockForced) {
                    actions.push({ type: 'RESOLVE_BLOCK', actorPlayerId: id, shouldBlock: false });
                }
                return;
            }

            if (id !== engine.currentPlayer.id) return;

            if (RuleValidator.canEndPhase(engine, actor).valid) {
                actions.push({ type: 'NEXT_PHASE', actorPlayerId: id });
            }

            if (engine.state.phase === Phase.MAIN) {
                actor.hand.forEach((_card: Card, handIndex: number) => {
                    for (let zoneIndex = 0; zoneIndex < actor.unitZones.length; zoneIndex++) {
                        if (RuleValidator.canPlayUnit(engine, actor, handIndex, zoneIndex).valid) {
                            actions.push({ type: 'PLAY_UNIT', actorPlayerId: id, handIndex, zoneIndex });
                        }
                        if (RuleValidator.canPlayItem(engine, actor, handIndex, zoneIndex).valid) {
                            actions.push({ type: 'PLAY_ITEM', actorPlayerId: id, handIndex, zoneIndex });
                        }
                    }

                    if (RuleValidator.canPlaySkill(engine, actor, handIndex).valid) {
                        actions.push({ type: 'PLAY_SKILL', actorPlayerId: id, handIndex });
                    }
                });
            }

            actor.unitZones.forEach((zone: UnitZoneState, zoneIndex: number) => {
                if (
                    engine.state.phase === Phase.ATTACK &&
                    RuleValidator.canAttack(engine, actor, zoneIndex).valid
                ) {
                    actions.push({ type: 'ATTACK', actorPlayerId: id, attackerZoneIndex: zoneIndex });
                }

                const collectActivatableEffectActions = (
                    sourceCard: Card | null,
                    sourceType: 'UNIT' | 'ITEM',
                    itemIndex?: number
                ) => {
                    if (!sourceCard?.effects) return;
                    sourceCard.effects.forEach((effect, effectIndex) => {
                        const activatableInPhase =
                            (effect.activation === ActivationCondition.ACTIVE && (engine.state.phase === Phase.MAIN || engine.state.phase === Phase.ATTACK)) ||
                            (effect.activation === ActivationCondition.ACTIVE_MAIN && engine.state.phase === Phase.MAIN);
                        if (!activatableInPhase) return;

                        const effectKey = sourceType === 'ITEM'
                            ? `${sourceCard.id}_${itemIndex}_${effect.id || effectIndex}`
                            : `${sourceCard.id}_${effect.id || effectIndex}`;
                        if (zone.activatedEffectKeys?.[effectKey]) return;

                        const context: GameContext = {
                            sourceCard,
                            player: actor,
                            opponent: engine.getOpponentOf(actor),
                            unitZone: zone,
                            machine: engine,
                        };

                        if (!engine.effectManager.checkCondition(effect, context)) return;

                        if (effect.cost && effect.cost.type !== 'NONE') {
                            if (effect.cost.type === 'TRASH_HAND' || effect.cost.type === 'SHUFFLE_HAND_TO_DECK') {
                                const requiredAmount = effect.cost.amount || 1;
                                const costFilter = effect.cost.cardTypeFilter;
                                const payableCount = actor.hand.filter((card: Card) => !costFilter || card.type === costFilter).length;
                                if (payableCount < requiredAmount) return;
                            }
                        }

                        if (effect.targets && effect.targets.selectMode === 'MANUAL') {
                            const candidates = TargetSelector.resolve(engine, effect.targets, context);
                            if (candidates.length === 0) return;
                        }

                        actions.push({
                            type: 'ACTIVATE_EFFECT',
                            actorPlayerId: id,
                            zoneIndex,
                            effectIndex,
                            sourceType,
                            itemIndex
                        });
                    });
                };

                collectActivatableEffectActions(zone.unit, 'UNIT');
                zone.items.forEach((item: Card, itemIndex: number) => {
                    collectActivatableEffectActions(item, 'ITEM', itemIndex);
                });
            });

            const leader = actor.levelZone;
            if (leader?.effects) {
                const leaderActivatedKeys = ((actor as any).leaderActivatedEffectKeys || {}) as Record<string, boolean>;
                leader.effects.forEach((effect: Effect, effectIndex: number) => {
                    const activatableInPhase =
                        (effect.activation === ActivationCondition.ACTIVE && (engine.state.phase === Phase.MAIN || engine.state.phase === Phase.ATTACK)) ||
                        (effect.activation === ActivationCondition.ACTIVE_MAIN && engine.state.phase === Phase.MAIN);
                    if (!activatableInPhase) return;

                    const effectKey = `${leader.id}_${effect.id || effectIndex}`;
                    if (leaderActivatedKeys[effectKey]) return;

                    const context: GameContext = {
                        sourceCard: leader,
                        player: actor,
                        opponent: engine.getOpponentOf(actor),
                        machine: engine,
                    };

                    if (!engine.effectManager.checkCondition(effect, context)) return;

                    if (effect.cost && effect.cost.type !== 'NONE') {
                        if (effect.cost.type === 'TRASH_HAND' || effect.cost.type === 'SHUFFLE_HAND_TO_DECK') {
                            const requiredAmount = effect.cost.amount || 1;
                            const costFilter = effect.cost.cardTypeFilter;
                            const payableCount = actor.hand.filter((card: Card) => !costFilter || card.type === costFilter).length;
                            if (payableCount < requiredAmount) return;
                        }
                    }

                    if (effect.targets && effect.targets.selectMode === 'MANUAL') {
                        const candidates = TargetSelector.resolve(engine, effect.targets, context);
                        if (candidates.length === 0) return;
                    }

                    actions.push({
                        type: 'ACTIVATE_EFFECT',
                        actorPlayerId: id,
                        zoneIndex: -1,
                        effectIndex,
                        sourceType: 'LEADER',
                    });
                });
            }

            return;
        }

        const pending = engine.state.pendingEffect;
        if (!pending) return;

        if (engine.state.interactionMode === 'SELECT_OPTIONAL') {
            actions.push({ type: 'RESOLVE_OPTIONAL', actorPlayerId: id, confirm: true });
            actions.push({ type: 'RESOLVE_OPTIONAL', actorPlayerId: id, confirm: false });
            return;
        }

        if (engine.state.interactionMode === 'SELECT_COST') {
            const payer = engine.getPlayerById(pending.sourcePlayerId) ?? actor;
            if (payer.id !== id) return;
            const payableHandIndexes = engine.getPayableHandIndexesForCost(payer, pending.costToPay ?? {
                type: 'TRASH_HAND',
                amount: 1,
                cardTypeFilter: pending.costCardTypeFilter
            } as any);
            payableHandIndexes.forEach((handIndex: number) => {
                actions.push({ type: 'SELECT_COST_HAND', actorPlayerId: id, handIndex });
            });
            return;
        }

        if (engine.state.interactionMode !== 'SELECT_TARGET') return;

        const runtime = engine.getPendingRuntime();
        const context = runtime?.context;
        const targetSchema = pending.targetSchema;
        if (!context || !targetSchema) return;

        const needsConfirm =
            (targetSchema.count ?? 1) !== 1 ||
            targetSchema.selectMode === 'ALL' ||
            pending.actionType === 'TAKE_ALL_REVEALED';
        const selectedTargets = pending.selectedTargets ?? [];
        const requiredCount = targetSchema.count ?? 1;

        const shouldAllowConfirm = (candidateTargets: any[]): boolean => {
            const minSelection = Math.max(0, Number(pending.actionValue?.minSelection ?? 0));
            if (pending.actionValue?.allowPartialSelection === true) {
                if (selectedTargets.length >= minSelection) return true;
                const remainingSelectableCount = candidateTargets.filter(target => !selectedTargets.includes(target)).length;
                return selectedTargets.length + remainingSelectableCount < minSelection;
            }
            if (!needsConfirm) {
                // Single-target manual selection can become impossible due state changes.
                return candidateTargets.length === 0;
            }
            if (targetSchema.selectMode === 'ALL' || pending.actionType === 'TAKE_ALL_REVEALED') return true;
            if (requiredCount <= 0) return true;

            const selectedCount = selectedTargets.length;
            if (selectedCount >= requiredCount) return true;

            // Rule 1.3.2: if remaining valid targets cannot fill the requirement, allow partial confirm.
            const remainingSelectableCount = candidateTargets.filter(target => !selectedTargets.includes(target)).length;
            return selectedCount + remainingSelectableCount < requiredCount;
        };

        if (pending.validTargets === 'MY_TRASH') {
            const targetPlayerId = pending.sourcePlayerId;
            const targetPlayer = engine.getPlayerById(targetPlayerId);
            if (!targetPlayer) return;
            const selectableTrashCards: any[] = [];
            targetPlayer.trash.forEach((card: Card, trashIndex: number) => {
                if (!TargetSelector.isValidTarget(engine, targetSchema, context, card)) return;
                if (!canAddTargetWithinTotalCost(targetSchema, selectedTargets, card, context)) return;
                selectableTrashCards.push(card);
                actions.push({ type: 'SELECT_TRASH_TARGET', actorPlayerId: id, targetPlayerId, trashIndex });
            });
            if (shouldAllowConfirm(selectableTrashCards)) {
                actions.push({ type: 'CONFIRM_TARGETS', actorPlayerId: id });
            }
            return;
        }

        if (pending.validTargets === 'REVEALED') {
            const selectableRevealedCards: any[] = [];
            engine.state.revealedCards.forEach((card: Card, revealedIndex: number) => {
                if (!TargetSelector.isValidTarget(engine, targetSchema, context, card)) return;
                if (!canAddTargetWithinTotalCost(targetSchema, selectedTargets, card, context)) return;
                selectableRevealedCards.push(card);
                actions.push({ type: 'SELECT_REVEALED_TARGET', actorPlayerId: id, revealedIndex });
            });
            if (shouldAllowConfirm(selectableRevealedCards)) {
                actions.push({ type: 'CONFIRM_TARGETS', actorPlayerId: id });
            }
            return;
        }

        if (pending.validTargets === 'MY_HAND' || pending.validTargets === 'OPP_HAND' || pending.validTargets === 'LAST_DRAWN') {
            const targetPlayerId =
                pending.validTargets === 'OPP_HAND'
                    ? (context?.opponent?.id ?? engine.getOpponentOf(engine.getPlayerById(pending.sourcePlayerId) ?? engine.currentPlayer).id)
                    : (context?.player?.id ?? pending.sourcePlayerId);

            const targetPlayer = engine.getPlayerById(targetPlayerId);
            if (!targetPlayer) return;

            const selectableHandCards: any[] = [];
            targetPlayer.hand.forEach((card: Card, handIndex: number) => {
                if (!TargetSelector.isValidTarget(engine, targetSchema, context, card)) return;
                if (!canAddTargetWithinTotalCost(targetSchema, selectedTargets, card, context)) return;
                selectableHandCards.push(card);
                actions.push({ type: 'SELECT_HAND_TARGET', actorPlayerId: id, targetPlayerId, handIndex });
            });
            if (shouldAllowConfirm(selectableHandCards)) {
                actions.push({ type: 'CONFIRM_TARGETS', actorPlayerId: id });
            }
            return;
        }

        if (pending.validTargets === 'MY_DAMAGE') {
            const targetPlayerId = context?.player?.id ?? pending.sourcePlayerId;
            const targetPlayer = engine.getPlayerById(targetPlayerId);
            if (!targetPlayer) return;

            const selectableDamageCards: any[] = [];
            targetPlayer.damage.forEach((card: Card, damageIndex: number) => {
                if (!TargetSelector.isValidTarget(engine, targetSchema, context, card)) return;
                if (!canAddTargetWithinTotalCost(targetSchema, selectedTargets, card, context)) return;
                selectableDamageCards.push(card);
                actions.push({ type: 'SELECT_DAMAGE_TARGET', actorPlayerId: id, targetPlayerId, damageIndex });
            });
            if (shouldAllowConfirm(selectableDamageCards)) {
                actions.push({ type: 'CONFIRM_TARGETS', actorPlayerId: id });
            }
            return;
        }

        if (
            pending.validTargets === 'MY_FIELD_ITEMS' ||
            pending.validTargets === 'OPP_FIELD_ITEMS' ||
            pending.validTargets === 'FIELD_ITEMS'
        ) {
            const selectableItems: any[] = [];
            engine.state.players.forEach((targetPlayer: any) => {
                targetPlayer.unitZones.forEach((zone: UnitZoneState, zoneIndex: number) => {
                    zone.items.forEach((item: Card, itemIndex: number) => {
                        if (!TargetSelector.isValidTarget(engine, targetSchema, context, item)) return;
                        if (!canAddTargetWithinTotalCost(targetSchema, selectedTargets, item, context)) return;
                        selectableItems.push(item);
                        actions.push({
                            type: 'SELECT_ITEM_TARGET',
                            actorPlayerId: id,
                            targetPlayerId: targetPlayer.id,
                            zoneIndex,
                            itemIndex,
                        });
                    });
                });
            });
            if (shouldAllowConfirm(selectableItems)) {
                actions.push({ type: 'CONFIRM_TARGETS', actorPlayerId: id });
            }
            return;
        }

        const selectableZones: UnitZoneState[] = [];
        engine.state.players.forEach((targetPlayer: any) => {
            targetPlayer.unitZones.forEach((targetZone: UnitZoneState, zoneIndex: number) => {
                const requiresEmptyZone =
                    pending.actionType === 'SB01_007_SELECT_EMPTY_ZONE_TO_DEPLOY' ||
                    pending.actionType === 'SB01_014_SELECT_EMPTY_ZONE_TO_DEPLOY';
                if (requiresEmptyZone && targetZone.unit) return;
                if (TargetSelector.isValidTarget(engine, targetSchema, context, targetZone)) {
                    if (!canAddTargetWithinTotalCost(targetSchema, selectedTargets, targetZone, context)) return;
                    selectableZones.push(targetZone);
                    actions.push({ type: 'SELECT_ZONE_TARGET', actorPlayerId: id, targetPlayerId: targetPlayer.id, zoneIndex });
                }
            });
        });
        if (shouldAllowConfirm(selectableZones)) {
            actions.push({ type: 'CONFIRM_TARGETS', actorPlayerId: id });
        }
    });

    return actions;
}
