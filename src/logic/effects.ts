import { GameEngine } from './GameEngine';
import { ActivationCondition, Effect, UnitZoneState, TargetSchema } from './types';

export class EffectManager {
    private engine: GameEngine;

    constructor(engine: GameEngine) {
        this.engine = engine;
    }

    processEffects(activation: ActivationCondition, context: any) {
        const { sourceCard } = context;

        if (!sourceCard || !sourceCard.effects) return;

        sourceCard.effects.forEach((effect: Effect) => {
            if (effect.activation === activation) {
                if (this.checkCondition(effect, context)) {
                    // Cost payment should happen here or be prompted. 
                    // For now, auto-pay if possible, else fail.
                    if (this.payCost(effect, context)) {

                        // If effect has targets, we might need to go into selection mode via Engine
                        if (effect.targets && effect.targets.selectMode === 'MANUAL') {
                            this.engine.initiateTargetSelection(effect, context);
                        } else {
                            // Instant execution (self, random, or auto targets)
                            const targets = this.resolveAutoTargets(effect.targets, context);
                            this.executeEffect(effect, context, targets);
                        }
                    }
                }
            }
        });
    }

    public executeEffect(effect: Effect, context: any, targets: any[] = []) {
        const { action } = effect;
        const { player, opponent } = context;
        const params = action.params || {};

        console.log(`Executing Effect: ${effect.description} [Action: ${action.type}]`);

        switch (action.type) {
            case 'GAIN_LEVEL':
                const amount = params.value || 1;
                player.leaderLevel = Math.min(10, player.leaderLevel + amount);
                console.log(`${player.name} gained ${amount} level(s).`);
                break;

            case 'DRAW':
                const count = params.count || 1;
                const pIdx = this.engine.state.players.indexOf(player);
                this.engine.drawCard(pIdx, count);
                break;

            case 'BUFF_POWER':
                targets.forEach(target => {
                    // Target is expected to be a UnitZoneState or similar wrapper
                    // But effectively we need the zone to apply the buff
                    if (target && target.unit) {
                        let value = params.value || 0;
                        if (params.dynamic === 'LEADER_LEVEL_MULTIPLIER') {
                            value = player.leaderLevel * value;
                        }

                        target.buffs.push({
                            id: Math.random().toString(36),
                            sourceCard: context.sourceCard,
                            type: 'POWER',
                            value: value,
                            duration: effect.duration || 'TURN_END'
                        });
                        console.log(`Buffed ${target.unit.name} by ${value} Power.`);
                    }
                });
                break;

            case 'BUFF_HIT':
                targets.forEach(target => {
                    if (target && target.unit) {
                        const value = params.value || 0;
                        target.buffs.push({
                            id: Math.random().toString(36),
                            sourceCard: context.sourceCard,
                            type: 'HIT',
                            value: value,
                            duration: effect.duration || 'TURN_END'
                        });
                        console.log(`Buffed ${target.unit.name} by ${value} Hit.`);
                    }
                });
                break;

            case 'DESTROY_UNIT':
                targets.forEach(target => {
                    if (target && target.unit) {
                        const owner = this.getOwnerOfZone(target);
                        if (owner) this.engine.destroyUnit(owner, target);
                    }
                });
                break;

            case 'RETURN_TO_HAND':
                // Usually 'SELF' for triggers
                if (effect.targets?.scope === 'SELF' || !effect.targets) {
                    // Logic to return self from field/trash to hand
                    // Check context.unitZone or context.card location
                    console.log("Return to hand not fully implemented for context");
                }
                break;

            case 'DESTROY_LANE_LOWEST':
                // Custom logic for Acceleration
                // Identify the specific lane from targets (which should be the lane index or zone objects)
                // If target is just 'SHARED_LANE' selection, engine passed the lane index?
                // Context should contain the selected lane if resolved manually
                if (context.selectedLaneIndex !== undefined) {
                    const idx = context.selectedLaneIndex;
                    const myZ = player.unitZones[idx];
                    const oppZ = opponent.unitZones[idx];

                    const myPower = this.engine.getUnitPower(myZ, player);
                    const oppPower = this.engine.getUnitPower(oppZ, opponent);

                    if (myZ.unit && oppZ.unit) {
                        if (myPower < oppPower) this.engine.destroyUnit(player, myZ);
                        else if (oppPower < myPower) this.engine.destroyUnit(opponent, oppZ);
                        else {
                            this.engine.destroyUnit(player, myZ);
                            this.engine.destroyUnit(opponent, oppZ);
                        }
                    }
                }
                break;

            default:
                console.warn(`Unknown action type: ${action.type}`);
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

    private resolveAutoTargets(schema: TargetSchema | undefined, context: any): any[] {
        if (!schema) return []; // No targets needed (Self or Global effect)

        const { player, opponent } = context;

        if (schema.scope === 'SELF') {
            // Return the unit zone of the source card if applicable
            if (context.unitZone) return [context.unitZone]; // e.g., Self-buff
            return [];
        }

        if (schema.selectMode === 'RANDOM' || schema.count === 0) { // 0 usually implies ALL
            let candidateZones: UnitZoneState[] = [];

            if (schema.scope === 'MY_FIELD' || schema.scope === 'BOTH_FIELDS') {
                candidateZones = candidateZones.concat(player.unitZones);
            }
            if (schema.scope === 'OPP_FIELD' || schema.scope === 'BOTH_FIELDS') {
                candidateZones = candidateZones.concat(opponent.unitZones);
            }

            // Filter empty zones if targeting units
            if (schema.type === 'UNIT') {
                candidateZones = candidateZones.filter(z => z.unit !== null);
            }

            // Apply specific filters
            if (schema.conditions) {
                candidateZones = candidateZones.filter(z => {
                    if (!z.unit) return false;
                    if (schema.conditions?.hasTrait && !z.unit.traits?.includes(schema.conditions.hasTrait)) return false;
                    return true;
                });
            }

            return candidateZones;
        }

        return [];
    }

    private getOwnerOfZone(zone: UnitZoneState): any {
        // Helper to find which player owns this zone state object
        if (this.engine.state.players[0].unitZones.includes(zone)) return this.engine.state.players[0];
        if (this.engine.state.players[1].unitZones.includes(zone)) return this.engine.state.players[1];
        return null;
    }
}

