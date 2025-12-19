import { GameEngine } from './GameEngine';
import { ActivationCondition, Effect, UnitZoneState } from './types';

export class EffectManager {
    private engine: GameEngine;

    constructor(engine: GameEngine) {
        this.engine = engine;
    }

    /**
     * Process effects for a specific activation condition.
     * System-level "triggering" renamed to avoid confusion with in-game "Trigger" keyword.
     */
    processEffects(activation: ActivationCondition, context: any) {
        const { sourceCard } = context;

        if (!sourceCard || !sourceCard.effects) return;

        sourceCard.effects.forEach((effect: Effect) => {
            if (effect.activation === activation) {
                if (this.checkCondition(effect, context)) {
                    if (this.payCost(effect, context)) {
                        this.resolve(effect, context);
                    }
                }
            }
        });
    }

    private checkCondition(effect: Effect, context: any): boolean {
        if (!effect.condition) return true;

        const { type, value } = effect.condition;
        const { player } = context;

        switch (type) {
            case 'ALWAYS': return true;
            case 'LEADER_LEVEL':
                return player.leaderLevel >= value;
            case 'HAS_ITEM':
                return (context.unitZone as UnitZoneState)?.items.length > 0;
            default: return true;
        }
    }

    private payCost(effect: Effect, context: any): boolean {
        if (!effect.cost) return true;

        const { type, value } = effect.cost;
        const { player } = context;

        switch (type) {
            case 'NONE': return true;
            case 'TRASH_HAND':
                if (player.hand.length >= value) {
                    // Logic to select cards to trash would go here.
                    // For now, let's assume it's the first N cards or handled by the engine.
                    return true;
                }
                return false;
            default: return true;
        }
    }

    private resolve(effect: Effect, context: any) {
        const { action } = effect;
        const { player, opponent, unitZone } = context;

        console.log(`Resolving Effect: ${effect.description}`);

        switch (action.type) {
            case 'DRAW':
                const drawCount = action.value || 1;
                const pIdx = this.engine.state.players.indexOf(player);
                this.engine.drawCard(pIdx, drawCount);
                break;
            case 'GAIN_LEVEL':
                player.leaderLevel += (action.value || 1);
                if (player.leaderLevel > 10) player.leaderLevel = 10;
                break;
            case 'DAMAGE':
                this.engine.dealDamage(opponent, action.value);
                break;
            case 'DESTROY_SELF':
                if (unitZone) {
                    this.engine.destroyUnit(player, unitZone);
                }
                break;
            case 'DESTROY_TARGET':
                // This would need target selection logic
                console.log(`Destroy target triggered for ${action.value} cost/condition`);
                break;
            default:
                console.warn(`Unknown action type: ${action.type}`);
        }
    }
}

// Factory functions for creating effects easily
export function createEntryEffect(description: string, actionType: string, actionValue: any): Effect {
    return {
        activation: ActivationCondition.ENTRY,
        description,
        action: { type: actionType, value: actionValue }
    };
}

export function createExitEffect(description: string, actionType: string, actionValue: any): Effect {
    return {
        activation: ActivationCondition.EXIT,
        description,
        action: { type: actionType, value: actionValue }
    };
}

export function createAttackerEffect(description: string, actionType: string, actionValue: any): Effect {
    return {
        activation: ActivationCondition.ATTACKER,
        description,
        action: { type: actionType, value: actionValue }
    };
}
