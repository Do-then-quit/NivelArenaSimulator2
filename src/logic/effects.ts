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

        sourceCard.effects.forEach((effect: Effect) => {
            if (effect.activation === activation) {
                if (this.processEffect(effect, context)) {
                    triggered = true;
                }
            }
        });

        return triggered;
    }

    public processEffect(effect: Effect, context: GameContext): boolean {
        if (!this.checkCondition(effect, context)) return false;

        // NEW: If cost exists and hasn't been paid yet, initiate cost selection
        // We add a flag to context if cost is already handled
        const costAlreadyPaid = (context as any).costPaid === true;

        if (effect.cost && effect.cost.type !== 'NONE' && !costAlreadyPaid) {
            // Only manual cost if it's ACTIVE or if we want to support it for others
            // For now, let's keep it consistent: manual cost for everyone if it's TRASH_HAND
            if (effect.cost.type === 'TRASH_HAND') {
                this.engine.initiateCostSelection(effect, context);
                return true;
            }
        }

        // If we reach here, either no cost or cost already paid
        // If effect has targets, we might need to go into selection mode via Engine
        if (effect.targets && effect.targets.selectMode === 'MANUAL') {
            const candidates = TargetSelector.resolve(this.engine, effect.targets, context);
            if (candidates.length > 0) {
                this.engine.initiateTargetSelection(effect, context);
            } else {
                console.log(`No valid targets for ${effect.description}, skipping selection.`);
                return false;
            }
        } else {
            // Instant execution (self, random, or auto targets)
            const targets = this.resolveAutoTargets(effect.targets, context);
            this.executeEffect(effect, context, targets);
        }
        return true;
    }

    public executeEffect(effect: Effect, context: GameContext, targets: any[] = []) {
        const { action } = effect;
        const actionImpl = ActionRegistry[action.type];

        if (actionImpl) {
            console.log(`Executing Effect: ${effect.description} [Action: ${action.type}]`);
            // Add duration to params for registry if needed
            const params = { ...action.params, duration: effect.duration };
            actionImpl(context, params, targets);
        } else {
            console.warn(`Unknown or unimplemented action type: ${action.type}`);
        }
    }

    private checkCondition(effect: Effect, _context: any): boolean {
        if (!effect.condition) return true;
        const { type } = effect.condition;
        // Simple implementation
        if (type === 'ALWAYS') return true;
        return true;
    }

    private resolveAutoTargets(schema: TargetSchema | undefined, context: GameContext): any[] {
        if (!schema) return [];
        return TargetSelector.resolve(this.engine, schema, context);
    }

}

