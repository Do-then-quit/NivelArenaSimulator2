import { GameEngine } from './GameEngine';
import { ActivationCondition, Effect, TargetSchema, GameContext, CardType } from './types';
import { ActionRegistry } from './effectActions';
import { TargetSelector } from './TargetSelector';

interface ProcessOptions {
    enqueueOnly?: boolean;
    batchStep?: number;
}

export class EffectManager {
    private engine: GameEngine;
    private isProcessingQueue = false;

    constructor(engine: GameEngine) {
        this.engine = engine;
    }

    private requiresAwakenedLeader(effect: Effect): boolean {
        const description = effect.description || '';
        return (
            description.includes('각성면') ||
            description.includes('AWAKENED')
        );
    }

    private cardHasKeyword(card: any, keyword: string): boolean {
        if (!card) return false;
        if (card.keywords?.includes(keyword)) return true;

        const keywordMap: Record<string, string> = {
            '어태커': ActivationCondition.ATTACKER,
            '디펜더': ActivationCondition.DEFENDER,
            '액티브': ActivationCondition.ACTIVE,
            '엔트리': ActivationCondition.ENTRY,
            '엑시트': ActivationCondition.EXIT,
            '트리거': ActivationCondition.DAMAGE_TRIGGER,
            '각성': ActivationCondition.AWAKEN,
        };
        const actionKeywordMap: Record<string, string[]> = {
            '관통': ['PENETRATION'],
            '약탈': ['PLUNDER'],
            '돌파': ['BREAKTHROUGH'],
            '공멸': ['MUTUAL_DESTRUCTION'],
            '침투': ['INFILTRATION', 'APPLY_INFILTRATION_MARK'],
            '듀얼리스트': ['DUALIST', 'APPLY_DUALIST_MARK'],
        };
        const mappedActivation = keywordMap[keyword];
        const mappedActions = actionKeywordMap[keyword] || [];
        const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const keywordLabelPattern = new RegExp(`^[\\s「\\[]*${escapedKeyword}\\s*:`);

        const effectHasKeyword = (effect: any): boolean => {
            if (!effect) return false;
            if (mappedActivation && effect.activation === mappedActivation) return true;
            if (mappedActions.length > 0 && mappedActions.includes(effect.action?.type)) return true;
            if (effect.action?.type === 'GRANT_EFFECT' && effect.action?.params?.effect) {
                if (effectHasKeyword(effect.action.params.effect)) return true;
            }
            const description = String(effect.description || '').replace(/\u00a0/g, ' ').trim();
            return keywordLabelPattern.test(description);
        };

        if (card.effects?.some((effect: any) => effectHasKeyword(effect))) return true;
        return false;
    }

    private getAttackCountReferenceBonus(context: GameContext): number {
        if (!context.unitZone || !context.sourceCard) return 0;
        if (context.unitZone.unit !== context.sourceCard) return 0;
        if (!Array.isArray(context.unitZone.items)) return 0;

        return context.unitZone.items.reduce((sum, item) => {
            const bonusFromItem = (item.effects || []).reduce((itemSum: number, effect: any) => {
                if (!effect || effect.activation !== ActivationCondition.PASSIVE) return itemSum;
                const bonus = effect.action?.params?.attackCountReferenceBonus;
                if (typeof bonus !== 'number') return itemSum;
                return itemSum + bonus;
            }, 0);
            return sum + bonusFromItem;
        }, 0);
    }

    private isActivationLocked(player: any, activation: ActivationCondition | string | undefined): boolean {
        if (!player || !activation) return false;
        const lockMap = (player as any).lockedActivationsUntilTurnEnd as Record<string, boolean> | undefined;
        if (lockMap?.[String(activation)] === true) return true;

        const lockUntilMap = (player as any).lockedActivationsUntilTurnCount as Record<string, number> | undefined;
        const untilTurnCount = lockUntilMap?.[String(activation)];
        if (typeof untilTurnCount !== 'number') return false;
        return this.engine.state.turnCount <= untilTurnCount;
    }

    public queueEphemeralEffect(effect: Effect, context: GameContext) {
        this.engine.incrementGlobalStep();
        const currentStep = this.engine.state.globalStep;

        const item = {
            effect: effect,
            context: context,
            id: this.engine.createRuntimeId('EPH'),
            creationTime: currentStep,
            sourcePlayerId: context.player.id
        };

        if (this.engine.state.damageProcessingDepth > 0) {
            this.engine.state.deferredEffectQueue.push(item);
            console.log(`[EffectManager] Deferred Ephemeral Effect: ${effect.description} (Timestamp: ${currentStep})`);
            return;
        }

        this.engine.state.effectQueue.push(item);
        console.log(`[EffectManager] Queued Ephemeral Effect: ${effect.description} (Timestamp: ${currentStep})`);

        this.engine.sortEffectQueue();
        if (!this.isProcessingQueue) {
            this.processQueue();
        }
    }

    processEffects(activation: ActivationCondition, context: any, options: ProcessOptions = {}): boolean {
        const { sourceCard } = context;

        if (this.isActivationLocked(context.player, activation)) {
            console.log(`[EffectManager] Skipped locked activation ${activation} for ${sourceCard.name}`);
            return false;
        }

        console.log(`[EffectManager] Processing ${activation} effects for ${sourceCard.name}`);

        const effectsToProcess: Effect[] = [];
        if (sourceCard.effects) {
            effectsToProcess.push(...sourceCard.effects.filter((e: Effect) => e.activation === activation));
        }

        // Add zone temporary effects only when resolving the affected unit itself.
        // For EXIT, unit is already removed from zone, so use destroyedUnitId context flag.
        const shouldIncludeZoneTemporaryEffects =
            !!context.unitZone &&
            !!context.unitZone.temporaryEffects &&
            (
                context.unitZone.unit === context.sourceCard ||
                (
                    context.unitZone.unit === null &&
                    context.flags?.destroyedUnitId !== undefined &&
                    context.sourceCard?.id === context.flags.destroyedUnitId
                )
            );
        if (shouldIncludeZoneTemporaryEffects) {
            effectsToProcess.push(...context.unitZone.temporaryEffects.filter((e: Effect) => e.activation === activation));
        }

        if (effectsToProcess.length === 0) return false;

        const currentStep = options.batchStep ?? this.engine.incrementAndGetGlobalStep();

        const queueItems = effectsToProcess.map((e: Effect, index: number) => ({
            effect: e,
            context: context,
            id: this.engine.createRuntimeId(`${sourceCard.id}_${activation}_${index}`),
            creationTime: currentStep,
            sourcePlayerId: context.player.id
        }));

        // 8.4.3: while resolving damage processing, non-trigger auto effects are deferred.
        if (this.engine.state.damageProcessingDepth > 0 && activation !== ActivationCondition.DAMAGE_TRIGGER) {
            this.engine.state.deferredEffectQueue.push(...queueItems);
            console.log(`[EffectManager] Deferred ${queueItems.length} ${activation} effects (Timestamp: ${currentStep}). Total Deferred: ${this.engine.state.deferredEffectQueue.length}`);
            return true;
        }

        this.engine.state.effectQueue.push(...queueItems);
        console.log(`[EffectManager] Added ${queueItems.length} effects to queue (Timestamp: ${currentStep}). Total: ${this.engine.state.effectQueue.length}`);

        // 2. Sort Queue based on Priority
        this.engine.sortEffectQueue();

        if (!options.enqueueOnly && !this.isProcessingQueue) {
            this.processQueue();
        }

        return true;
    }

    public processQueue(): 'COMPLETED' | 'PAUSED' {
        if (this.engine.state.interactionMode !== 'NORMAL') {
            console.log(`[EffectManager] Cannot process queue, interaction mode is ${this.engine.state.interactionMode}`);
            return 'PAUSED';
        }

        if (this.isProcessingQueue) {
            return 'PAUSED';
        }

        this.isProcessingQueue = true;
        try {
            while (this.engine.state.effectQueue.length > 0) {
                const item = this.engine.state.effectQueue[0];
                this.engine.state.effectQueue.shift();
                this.processEffect(item.effect, item.context);

                if (this.engine.state.interactionMode !== 'NORMAL') {
                    console.log(`[EffectManager] Queue paused for interaction: ${this.engine.state.interactionMode}`);
                    return 'PAUSED';
                }
            }
            return 'COMPLETED';
        } finally {
            this.isProcessingQueue = false;
        }
    }

    public resumeQueue() {
        console.log(`[EffectManager] Resuming queue. Size: ${this.engine.state.effectQueue.length}`);
        const status = this.processQueue();
        if (status === 'COMPLETED') {
            this.engine.onQueueCompleted();
        }
    }

    public flushDeferredEffects() {
        if (this.engine.state.deferredEffectQueue.length === 0) return;

        console.log(`[EffectManager] Flushing deferred effects: ${this.engine.state.deferredEffectQueue.length}`);
        this.engine.state.effectQueue.push(...this.engine.state.deferredEffectQueue);
        this.engine.state.deferredEffectQueue = [];
        this.engine.sortEffectQueue();

        if (this.engine.state.interactionMode === 'NORMAL' && !this.isProcessingQueue) {
            this.processQueue();
        }
    }

    public processEffect(effect: Effect, context: GameContext): boolean {
        if (this.isActivationLocked(context.player, effect.activation)) {
            return false;
        }

        if (
            context.sourceCard.type === CardType.LEADER &&
            !context.sourceCard.isAwakened &&
            effect.activation !== ActivationCondition.AWAKEN &&
            this.requiresAwakenedLeader(effect)
        ) {
            return false;
        }

        if (!this.checkCondition(effect, context)) return false;

        // NEW: Check Optional
        if (effect.optional && !(context as any)._optionalConfirmed) {
            this.engine.initiateOptionalSelection(effect, context);
            return true; // Return true to pause execution flow (handled by loop break in processEffects)
        }

        if ((context as any).discardedCount === undefined) (context as any).discardedCount = 0;

        const costAlreadyPaid = (context as any).costPaid === true;

        if (effect.cost && effect.cost.type !== 'NONE' && !costAlreadyPaid) {
            if (effect.cost.type === 'TRASH_HAND' || effect.cost.type === 'SHUFFLE_HAND_TO_DECK') {
                const started = this.engine.initiateCostSelection(effect, context);
                return started;
            }
        }

        if (effect.targets && effect.targets.selectMode === 'MANUAL') {
            const candidates = TargetSelector.resolve(this.engine, effect.targets, context);
            context.flags = context.flags || {};
            context.flags.LAST_EFFECT_SKIPPED_NO_TARGET = candidates.length === 0;
            console.log(`[EffectManager] Resolving targets for "${effect.description}". Scope: ${effect.targets.scope}, Candidates: ${candidates.length}`);
            if (candidates.length > 0) {
                this.engine.initiateTargetSelection(effect, context);
            } else {
                console.log(`No valid targets for ${effect.description}, skipping selection.`);
                return false;
            }
        } else {
            let targets = this.resolveAutoTargets(effect.targets, context);

            if (!effect.targets && context.unitZone) {
                targets = [context.unitZone];
            } else if (!effect.targets && !context.unitZone) {
                targets = [];
            }

            this.executeEffect(effect, context, targets);
        }
        return true;
    }


    public executeEffect(effect: Effect, context: GameContext, targets: any[] = []) {
        if (this.isActivationLocked(context.player, effect.activation)) {
            return;
        }

        const { action } = effect;
        const actionImpl = ActionRegistry[action.type];

        if (actionImpl) {
            console.log(`Executing Effect: ${effect.description} [Action: ${action.type}]`);
            this.engine.traceUiEvent('EFFECT_EXECUTED', {
                sourcePlayerId: context.player.id,
                sourceCardId: context.sourceCard.id,
                sourceCardName: context.sourceCard.name,
                effectDescription: effect.description,
                actionType: action.type,
            });

            // Mark as fired if it's a ONCE_PER_TURN effect
            if (effect.condition?.type === 'ONCE_PER_TURN') {
                const fired = (this.engine.state as any).firedEffects = (this.engine.state as any).firedEffects || {};
                const effectId = effect.id || effect.description;
                fired[effectId] = true;
            }

            // Preserve the currently resolving effect metadata so nested UI prompts
            // can explain why the selection window opened.
            context.sourceActivation = effect.activation;
            context.sourceEffectDescription = effect.description;

            const hasActionDurationOverride = effect.actionDurationOverride !== undefined;
            let resolvedDuration = effect.actionDurationOverride ?? effect.duration;
            if (effect.activation === ActivationCondition.ATTACKER || effect.activation === ActivationCondition.DEFENDER) {
                if (resolvedDuration === undefined) {
                    resolvedDuration = 'BATTLE_END';
                } else if (!hasActionDurationOverride && resolvedDuration === 'TURN_END') {
                    const description = effect.description || '';
                    const explicitlyTurnScoped = /이\s*턴이\s*끝날\s*때까지/.test(description);
                    if (!explicitlyTurnScoped) {
                        resolvedDuration = 'BATTLE_END';
                    }
                }
            }

            const params = {
                ...action.params,
                duration: resolvedDuration,
                __sourceActivation: effect.activation,
            };
            actionImpl(context, params, targets);
            this.engine.checkRuleProcessing();
        } else {
            console.warn(`Unknown or unimplemented action type: ${action.type}`);
        }
    }

    public checkCondition(effect: Effect, context: GameContext): boolean {
        if (!effect.condition) return true;
        const { type, value, trashedUnitCostMin, friendlyOnly } = effect.condition;

        if (trashedUnitCostMin !== undefined && context.trashedUnit) {
            if (context.trashedUnit.cost < trashedUnitCostMin) return false;
        }

        if (friendlyOnly && context.trashedUnitOwner) {
            if (context.trashedUnitOwner !== context.player) return false;
        }

        switch (type) {
            case 'ALL': {
                const conditions = Array.isArray(value) ? value : [];
                if (conditions.length === 0) return false;
                return conditions.every((condition: any) => {
                    if (!condition || typeof condition !== 'object' || !condition.type) return false;
                    return this.checkCondition(
                        {
                            ...effect,
                            condition: condition as any,
                        },
                        context
                    );
                });
            }
            case 'ALWAYS':
                return true;
            case 'LEADER_LEVEL':
                if (typeof value === 'number') {
                    return context.player.leaderLevel >= value;
                }
                if (value.min !== undefined && context.player.leaderLevel < value.min) return false;
                if (value.max !== undefined && context.player.leaderLevel > value.max) return false;
                return true;
            case 'COST_COMPARISON':
                if (value?.operator === 'HIGHER_THAN_ENCOUNTER') {
                    if (!context.unitZone) return false;
                    const laneIndex = context.player.unitZones.indexOf(context.unitZone);
                    if (laneIndex === -1) return false;

                    const encounterUnit = context.opponent.unitZones[laneIndex]?.unit;
                    if (!encounterUnit) return false;

                    // Before paying cost, allow the effect if there exists a valid hand candidate.
                    if (!(context as any).costPaid) {
                        return context.player.hand.some(
                            card => card.type === CardType.UNIT && card.cost > encounterUnit.cost
                        );
                    }

                    // After paying cost, validate the chosen cost card against the encounter cost.
                    return !!context.costPaymentCard && context.costPaymentCard.cost > encounterUnit.cost;
                }
                if (context.unitZone && context.unitZone.unit) {
                    const cost = context.unitZone.unit.cost;
                    if (value.operator === 'GTE') return cost >= value.cost;
                    if (value.operator === 'LTE') return cost <= value.cost;
                }
                return false;
            case 'HAS_ITEM': {
                if (!context.unitZone) return false;
                let allItems = context.unitZone.items || [];
                const snapshotItems = context.flags?.equippedItemsSnapshot;
                if (
                    allItems.length === 0 &&
                    effect.activation === ActivationCondition.EXIT &&
                    Array.isArray(snapshotItems)
                ) {
                    allItems = snapshotItems;
                }
                const minCount = typeof value === 'number' ? value : (value?.minCount ?? 1);
                const costMin = typeof value === 'object' ? value?.costMin : undefined;
                const traitFilter = typeof value === 'object' ? value?.hasTrait : undefined;
                const keywordFilter = typeof value === 'object' ? value?.hasKeyword : undefined;
                const countedItems = allItems.filter(item => {
                    if (costMin !== undefined && (item.cost || 0) < costMin) return false;
                    if (traitFilter && !item.traits?.includes(traitFilter)) return false;
                    if (keywordFilter && !(item.keywords?.includes(keywordFilter) || item.effects?.some((effect: any) => (effect.description || '').includes(keywordFilter)))) return false;
                    return true;
                });
                return countedItems.length >= minCount;
            }
            case 'HAS_KEYWORD': {
                const keyword = typeof value === 'string' ? value : value?.keyword;
                if (!keyword) return false;
                if (context.unitZone?.unit && this.cardHasKeyword(context.unitZone.unit, keyword)) return true;
                return this.cardHasKeyword(context.sourceCard, keyword);
            }
            case 'HAS_TRAIT': {
                const trait = typeof value === 'string' ? value : value?.trait;
                if (!trait) return false;
                if (!context.unitZone?.unit) return false;
                return !!context.unitZone.unit.traits?.includes(trait);
            }
            case 'YOUR_TURN':
                return context.machine.currentPlayer === context.player;
            case 'OPPONENT_TURN':
                return context.machine.currentPlayer !== context.player;
            case 'OPPONENT_HAND_COUNT':
                if (typeof value === 'number') {
                    return context.opponent.hand.length >= value;
                }
                if (value.min !== undefined && context.opponent.hand.length < value.min) return false;
                if (value.max !== undefined && context.opponent.hand.length > value.max) return false;
                return true;
            case 'MY_HAND_COUNT':
                if (typeof value === 'number') {
                    return context.player.hand.length >= value;
                }
                if (value?.min !== undefined && context.player.hand.length < value.min) return false;
                if (value?.max !== undefined && context.player.hand.length > value.max) return false;
                return true;
            case 'DISCARDED_COUNT':
                const count = (context as any).discardedCount || 0;
                if (typeof value === 'number') return count >= value;
                if (value.min !== undefined && count < value.min) return false;
                return true;
            case 'FRONTLINE':
                return context.player.unitZones.every(z => z.unit !== null);
            case 'LEVEL_LINK':
                return context.player.leaderLevel >= value;
            case 'ONCE_PER_TURN':
                if (value?.contextFlag) {
                    const flagCondition = this.checkCondition({ ...effect, condition: { type: 'CONTEXT_FLAG', value: value.contextFlag } }, context);
                    if (!flagCondition) return false;
                }
                const fired = (this.engine.state as any).firedEffects = (this.engine.state as any).firedEffects || {};
                const effectId = effect.id || effect.description; // Fallback to description if ID missing
                return !fired[effectId];
            case 'EQUIPPED_UNIT_COUNT_MIN': {
                const min = typeof value === 'number' ? value : value?.min ?? 1;
                const countEquippedUnits = context.player.unitZones.filter(zone => zone.unit && zone.items.length > 0).length;
                return countEquippedUnits >= min;
            }
            case 'TRASHED_FRIENDLY_BY_EFFECT_THIS_TURN_MIN': {
                const min = typeof value === 'number' ? value : value?.min ?? 1;
                const countByEffect = context.machine.getEffectTrashedFriendlyUnitCount(context.player.id);
                return countByEffect >= min;
            }
            case 'OPPONENT_HAND_TRASHED_BY_EFFECT_THIS_TURN_MIN': {
                const min = typeof value === 'number' ? value : value?.min ?? 1;
                const countByEffect = context.machine.getHandTrashedByEffectCount(context.opponent.id);
                return countByEffect >= min;
            }
            case 'TRASH_REASON': {
                if (!context.trashReason) return false;
                if (Array.isArray(value)) return value.includes(context.trashReason);
                return context.trashReason === value;
            }
            case 'ITEM_COUNT_GTE_ENCOUNTER_HIT': {
                if (!context.unitZone) return false;
                const itemCount = context.unitZone.items.length;
                const laneIndex = context.player.unitZones.indexOf(context.unitZone);
                if (laneIndex === -1) return false;
                const encounterZone = context.opponent.unitZones[laneIndex];
                const encounterHit = encounterZone?.unit ? context.machine.getUnitHit(encounterZone, context.opponent) : 0;
                if (value?.requireTrait) {
                    const hasRequiredTrait = context.unitZone.items.some((item: any) => item.traits?.includes(value.requireTrait));
                    if (!hasRequiredTrait) return false;
                }
                return itemCount >= encounterHit;
            }
            case 'CONTEXT_FLAG': {
                if (typeof value === 'string') {
                    if (value === 'HAND_TRASH_OWNER_IS_SELF') {
                        return context.flags?.isOwnHandTrash === true;
                    }
                    if (value === 'PHASE_ATTACK') {
                        return context.machine.state.phase === 'ATTACK';
                    }
                    if (value === 'TRASHED_IS_OTHER') {
                        return !!context.trashedUnit && context.trashedUnit.id !== context.sourceCard.id;
                    }
                    if (value === 'TRASHED_IS_OTHER_BY_EFFECT') {
                        const byEffect = context.trashReason === 'EFFECT' || context.trashReason === 'RULE';
                        return byEffect && !!context.trashedUnit && context.trashedUnit.id !== context.sourceCard.id;
                    }
                    return !!context.flags?.[value];
                }

                const key = value?.key;
                if (!key) return false;
                let current: any;
                if (key === 'HAND_TRASH_OWNER_IS_SELF') {
                    current = context.flags?.isOwnHandTrash === true;
                } else if (key === 'PHASE_ATTACK') {
                    current = context.machine.state.phase === 'ATTACK';
                } else if (key === 'TRASHED_IS_OTHER') {
                    current = !!context.trashedUnit && context.trashedUnit.id !== context.sourceCard.id;
                } else if (key === 'TRASHED_IS_OTHER_BY_EFFECT') {
                    const byEffect = context.trashReason === 'EFFECT' || context.trashReason === 'RULE';
                    current = byEffect && !!context.trashedUnit && context.trashedUnit.id !== context.sourceCard.id;
                } else {
                    current = context.flags?.[key];
                }

                if (value.equals !== undefined) return current === value.equals;
                if (value.min !== undefined) return typeof current === 'number' && current >= value.min;
                return !!current;
            }
            case 'SKILL_ZONE_COUNT_MIN': {
                const min = typeof value === 'number' ? value : value?.min ?? 1;
                return context.player.skillZone.length >= min;
            }
            case 'ATTACK_COUNT_THIS_TURN_MIN': {
                const min = typeof value === 'number' ? value : value?.min ?? 1;
                const baseCount = context.machine.getTurnUnitAttackCount(context.player.id);
                const bonus = this.getAttackCountReferenceBonus(context);
                return baseCount + bonus >= min;
            }
            case 'TRASH_DISTINCT_NAME_COUNT_MIN': {
                const config = typeof value === 'number' ? { min: value } : (value || {});
                const min = Math.max(0, Number(config.min ?? 1));
                const cardType = config.cardType;
                const excludeKeyword = config.excludeKeyword;
                const distinctNames = new Set<string>();

                context.player.trash.forEach((card: any) => {
                    if (!card) return;
                    if (cardType && card.type !== cardType) return;
                    if (excludeKeyword && this.cardHasKeyword(card, excludeKeyword)) return;
                    distinctNames.add(String(card.name || card.id || ''));
                });

                return distinctNames.size >= min;
            }
            default:
                return true;
        }
    }

    private resolveAutoTargets(schema: TargetSchema | undefined, context: GameContext): any[] {
        if (!schema) return [];
        return TargetSelector.resolve(this.engine, schema, context);
    }

}
