import { GameEngine } from './GameEngine';
import { ActivationCondition, Effect, TargetSchema, GameContext } from './types';
import { ActionRegistry } from './effectActions';
import { TargetSelector } from './TargetSelector';

export class EffectManager {
    private engine: GameEngine;

    constructor(engine: GameEngine) {
        this.engine = engine;
    }

    processEffects(activation: ActivationCondition, context: any): boolean {
        const { sourceCard } = context;
        let triggered = false;

        if (!sourceCard || !sourceCard.effects) return false;

        const effectsToProcess = [...(sourceCard.effects || [])].filter((e: Effect) => e.activation === activation);

        // Add temporary effects from unitZone if applicable
        if (context.unitZone && context.unitZone.temporaryEffects) {
            effectsToProcess.push(...context.unitZone.temporaryEffects.filter((e: Effect) => e.activation === activation));
        }

        for (let i = 0; i < effectsToProcess.length; i++) {
            const effect = effectsToProcess[i];

            if (this.processEffect(effect, context)) {
                triggered = true;
                if (this.engine.state.interactionMode !== 'NORMAL') {
                    if (i < effectsToProcess.length - 1) {
                        (this.engine.state.pendingEffect as any)._remainingEffects = effectsToProcess.slice(i + 1);
                    }
                    break;
                }
            }
        }

        return triggered;
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

    public resumeEffects(effects: Effect[], context: GameContext) {
        for (let i = 0; i < effects.length; i++) {
            const effect = effects[i];
            if (this.processEffect(effect, context)) {
                if (this.engine.state.interactionMode !== 'NORMAL') {
                    if (i < effects.length - 1) {
                        (this.engine.state.pendingEffect as any)._remainingEffects = effects.slice(i + 1);
                    }
                    break;
                }
            }
        }
    }

    public executeEffect(effect: Effect, context: GameContext, targets: any[] = []) {
        const { action } = effect;
        const actionImpl = ActionRegistry[action.type];

        if (actionImpl) {
            console.log(`Executing Effect: ${effect.description} [Action: ${action.type}]`);
            const params = { ...action.params, duration: effect.duration };
            actionImpl(context, params, targets);
            this.engine.checkRuleProcessing();
        } else {
            console.warn(`Unknown or unimplemented action type: ${action.type}`);
        }
    }

    public checkCondition(effect: Effect, context: GameContext): boolean {
        if (!effect.condition) return true;
        const { type, value } = effect.condition;

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
            default:
                return true;
        }
    }

    private resolveAutoTargets(schema: TargetSchema | undefined, context: GameContext): any[] {
        if (!schema) return [];
        return TargetSelector.resolve(this.engine, schema, context);
    }

}