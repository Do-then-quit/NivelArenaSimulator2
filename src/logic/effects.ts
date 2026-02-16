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
        if (card.effects?.some((effect: any) => (effect.description || '').includes(keyword))) return true;
        return false;
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

        console.log(`[EffectManager] Processing ${activation} effects for ${sourceCard.name}`);

        const effectsToProcess: Effect[] = [];
        if (sourceCard.effects) {
            effectsToProcess.push(...sourceCard.effects.filter((e: Effect) => e.activation === activation));
        }

        // Add temporary effects from unitZone if applicable
        if (context.unitZone && context.unitZone.temporaryEffects) {
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
        const { action } = effect;
        const actionImpl = ActionRegistry[action.type];

        if (actionImpl) {
            console.log(`Executing Effect: ${effect.description} [Action: ${action.type}]`);

            // Mark as fired if it's a ONCE_PER_TURN effect
            if (effect.condition?.type === 'ONCE_PER_TURN') {
                const fired = (this.engine.state as any).firedEffects = (this.engine.state as any).firedEffects || {};
                const effectId = effect.id || effect.description;
                fired[effectId] = true;
            }

            let resolvedDuration = effect.duration;
            if (
                (effect.activation === ActivationCondition.ATTACKER || effect.activation === ActivationCondition.DEFENDER) &&
                (resolvedDuration === undefined || resolvedDuration === 'TURN_END')
            ) {
                resolvedDuration = 'BATTLE_END';
            }

            const params = { ...action.params, duration: resolvedDuration };
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
                const allItems = context.unitZone.items || [];
                const minCount = typeof value === 'number' ? value : (value?.minCount ?? 1);
                const costMin = typeof value === 'object' ? value?.costMin : undefined;
                const countedItems = costMin !== undefined
                    ? allItems.filter(item => (item.cost || 0) >= costMin)
                    : allItems;
                return countedItems.length >= minCount;
            }
            case 'HAS_KEYWORD': {
                const keyword = typeof value === 'string' ? value : value?.keyword;
                if (!keyword) return false;
                if (context.unitZone?.unit && this.cardHasKeyword(context.unitZone.unit, keyword)) return true;
                return this.cardHasKeyword(context.sourceCard, keyword);
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
                const fired = (this.engine.state as any).firedEffects = (this.engine.state as any).firedEffects || {};
                const effectId = effect.id || effect.description; // Fallback to description if ID missing
                return !fired[effectId];
            default:
                return true;
        }
    }

    private resolveAutoTargets(schema: TargetSchema | undefined, context: GameContext): any[] {
        if (!schema) return [];
        return TargetSelector.resolve(this.engine, schema, context);
    }

}
