import { GameEngine } from './GameEngine';
import { ActivationCondition, Effect, TargetSchema, GameContext } from './types';
import { ActionRegistry } from './effectActions';
import { TargetSelector } from './TargetSelector';

export class EffectManager {
    private engine: GameEngine;

    constructor(engine: GameEngine) {
        this.engine = engine;
    }

    public queueEphemeralEffect(effect: Effect, context: GameContext) {
        this.engine.incrementGlobalStep();
        const currentStep = this.engine.state.globalStep;

        const item = {
            effect: effect,
            context: context,
            id: `EPH_${Date.now()}_${Math.random()}`,
            creationTime: currentStep,
            sourcePlayerId: context.player.id
        };

        this.engine.state.effectQueue.push(item);
        this.engine.log(`[EffectManager] Queued Ephemeral Effect: ${effect.description} (Timestamp: ${currentStep})`, 'effect');

        this.engine.sortEffectQueue();
        this.processQueue();
    }

    processEffects(activation: ActivationCondition, context: any): boolean {
        const { sourceCard } = context;

        // this.engine.log(`[EffectManager] Processing ${activation} effects for ${sourceCard.name}`, 'info');

        const effectsToProcess: Effect[] = [];
        if (sourceCard.effects) {
            effectsToProcess.push(...sourceCard.effects.filter((e: Effect) => e.activation === activation));
        }

        // Add temporary effects from unitZone if applicable
        if (context.unitZone && context.unitZone.temporaryEffects) {
            effectsToProcess.push(...context.unitZone.temporaryEffects.filter((e: Effect) => e.activation === activation));
        }

        if (effectsToProcess.length === 0) return false;

        // Queueing with Timestamp & Priority System

        // 1. Increment Global Step for this new batch of effects
        // (Assuming this method call represents an atomic event reaction)
        this.engine.incrementGlobalStep();
        const currentStep = this.engine.state.globalStep;

        const queueItems = effectsToProcess.map((e: Effect, index: number) => ({
            effect: e,
            context: context,
            id: `${sourceCard.id}_${activation}_${index}_${Date.now()}`,
            creationTime: currentStep,
            sourcePlayerId: context.player.id
        }));

        this.engine.state.effectQueue.push(...queueItems);
        this.engine.log(`[EffectManager] Added ${queueItems.length} effects to queue (Timestamp: ${currentStep}). Total: ${this.engine.state.effectQueue.length}`, 'effect');

        // 2. Sort Queue based on Priority
        this.engine.sortEffectQueue();

        // Start processing immediately
        this.processQueue();

        return true;
    }

    public processQueue(): 'COMPLETED' | 'PAUSED' {
        if (this.engine.state.interactionMode !== 'NORMAL') {
            console.log(`[EffectManager] Cannot process queue, interaction mode is ${this.engine.state.interactionMode}`);
            return 'PAUSED';
        }

        while (this.engine.state.effectQueue.length > 0) {
            const item = this.engine.state.effectQueue[0]; // Peek first (don't remove yet in case of failure/pause?) 
            // Actually, standard is shift. If we pause, we rely on the fact that we break loop.
            // But if processEffect triggers a manual step, it might consume the step logic.

            // Let's shift it. If it causes a pause, the handling logic (initiateTargetSelection) 
            // will set the interaction mode. The effect itself is "processed" in terms of "we tried to run it".
            // The *continuation* of that effect (resolution) happens later via resolve methods, 
            // but the effect item itself is done being "initiated".

            this.engine.state.effectQueue.shift();
            this.processEffect(item.effect, item.context);

            if (this.engine.state.interactionMode !== 'NORMAL') {
                console.log(`[EffectManager] Queue paused for interaction: ${this.engine.state.interactionMode}`);
                return 'PAUSED';
            }
        }
        return 'COMPLETED';
    }

    public resumeQueue() {
        console.log(`[EffectManager] Resuming queue. Size: ${this.engine.state.effectQueue.length}`);
        const status = this.processQueue();
        if (status === 'COMPLETED') {
            this.engine.onQueueCompleted();
        }
    }

    public processEffect(effect: Effect, context: GameContext): boolean {
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
                this.engine.initiateCostSelection(effect, context);
                return true;
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
            this.engine.log(`Executing Effect: ${effect.description} [Action: ${action.type}]`, 'effect');

            // Mark as fired if it's a ONCE_PER_TURN effect
            if (effect.condition?.type === 'ONCE_PER_TURN') {
                const fired = (this.engine.state as any).firedEffects = (this.engine.state as any).firedEffects || {};
                const effectId = effect.id || effect.description;
                fired[effectId] = true;
            }

            const params = { ...action.params, duration: effect.duration };
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
                if (context.unitZone && context.unitZone.unit) {
                    const cost = context.unitZone.unit.cost;
                    if (value.operator === 'GTE') return cost >= value.cost;
                    if (value.operator === 'LTE') return cost <= value.cost;
                }
                return false;
            case 'YOUR_TURN':
                return context.machine.currentPlayer === context.player;
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