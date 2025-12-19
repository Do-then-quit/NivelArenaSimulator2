import { GameEngine } from './GameEngine';
import { Effect, EffectType, PlayerState } from './types';

export class EffectManager {
    private engine: GameEngine;

    constructor(engine: GameEngine) {
        this.engine = engine;
    }

    // Trigger effects of a specific type for a specific card/source
    trigger(type: EffectType, context: any) {
        // This is a simplified trigger. In a full system, we'd gather all valid effects, sort them, and execute.
        // For this simulator, we'll check the source card's effects.

        const { sourceCard } = context;

        if (!sourceCard || !sourceCard.effects) return;

        sourceCard.effects.forEach((effect: Effect) => {
            if (effect.type === type) {
                if (this.checkCondition(effect, context)) {
                    this.resolve(effect, context);
                }
            }
        });
    }

    // Trigger all passive effects (re-calculate stat buffs, etc.)
    // This typically runs every state update or when specific events happen.
    // For simplicity, we might call this before resolving combat or drawing UI.
    applyPassives(_player: PlayerState) {
        // Reset buffs first? In this simple engine, maybe we calculate dynamic power on the fly.
        // But let's assume we are modifying UnitZoneState temporarily or using a getter.
        // For this task, let's focus on Event triggers first (Entry, Attack, etc.)
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
                return context.unitZone && context.unitZone.items.length > 0;
            // Add more conditions as needed
            default: return true;
        }
    }

    private resolve(effect: Effect, context: any) {
        const { action } = effect;
        const { player, opponent, unitZone } = context;

        console.log(`Resolving Effect: ${effect.description}`);

        switch (action.type) {
            case 'DRAW':
                this.engine.drawCard(player === this.engine.state.players[0] ? 0 : 1, action.value);
                break;
            case 'POWER_BUFF':
                // This would need a way to persist buffs. 
                // For now, let's assume it's a "Until End of Turn" buff if it's an Action,
                // or a permanent change if it's an instantaneous effect? 
                // Actually, Power Buffs are usually Passives or "Until End of Turn".
                // Let's implement a simple "Heal" or "Damage" for now as they are instant.
                break;
            case 'DAMAGE':
                // Deal damage to opponent
                // We need to access GameEngine's dealDamage. 
                // We can expose dealDamage as public or use a method on Engine.
                // For now, let's cast engine to any to access private methods or make them public in next step.
                (this.engine as any).dealDamage(opponent, action.value);
                break;
            case 'DESTROY_SELF':
                if (unitZone) {
                    (this.engine as any).destroyUnit(player, unitZone);
                }
                break;
            default:
                console.warn(`Unknown action type: ${action.type}`);
        }
    }
}

// Factory functions for creating effects easily
export function createEntryEffect(description: string, actionType: string, actionValue: any): Effect {
    return {
        type: EffectType.ENTRY,
        description,
        action: { type: actionType, value: actionValue }
    };
}

export function createExitEffect(description: string, actionType: string, actionValue: any): Effect {
    return {
        type: EffectType.EXIT,
        description,
        action: { type: actionType, value: actionValue }
    };
}

export function createAttackerEffect(description: string, actionType: string, actionValue: any): Effect {
    return {
        type: EffectType.ATTACKER,
        description,
        action: { type: actionType, value: actionValue }
    };
}
