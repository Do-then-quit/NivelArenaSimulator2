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
                if (this.checkCondition(effect, context)) {
                    // Cost payment should happen here or be prompted. 
                    // For now, auto-pay if possible, else fail.
                    if (this.payCost(effect, context)) {
                        triggered = true;
                        // If effect has targets, we might need to go into selection mode via Engine
                        if (effect.targets && effect.targets.selectMode === 'MANUAL') {
                            // NEW: Check if there are any valid targets available before prompting
                            const candidates = TargetSelector.resolve(this.engine, effect.targets, context);
                            if (candidates.length > 0) {
                                this.engine.initiateTargetSelection(effect, context);
                            } else {
                                console.log(`No valid targets for ${effect.description}, skipping selection.`);
                            }
                        } else {
                            // Instant execution (self, random, or auto targets)
                            const targets = this.resolveAutoTargets(effect.targets, context);
                            this.executeEffect(effect, context, targets);
                        }
                    }
                }
            }
        });

        return triggered;
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

    private payCost(effect: Effect, context: any): boolean {
        if (!effect.cost) return true;
        const { type, amount } = effect.cost;
        const { player } = context;

        if (type === 'TRASH_HAND') {
            if (player.hand.length >= (amount || 1)) {
                // Simplified: Randomly trash for now or just pop last
                // In real game, should prompt user.
                for (let i = 0; i < (amount || 1); i++) {
                    const card = player.hand.pop();
                    if (card) player.trash.push(card);
                }
                return true;
            }
            return false;
        }
        return true;
    }

    private resolveAutoTargets(schema: TargetSchema | undefined, context: GameContext): any[] {
        if (!schema) return [];
        return TargetSelector.resolve(this.engine, schema, context);
    }

}

