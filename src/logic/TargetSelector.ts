import { GameEngine } from './GameEngine';
import { TargetSchema, GameContext, UnitZoneState, PlayerState, CardType } from './types';

export class TargetSelector {
    static resolve(engine: GameEngine, schema: TargetSchema, context: GameContext): any[] {
        const player = context.player;
        const opponent = context.opponent || engine.state.players.find(p => p !== player);
        let candidates: any[] = [];

        // 1. Initial Scope
        switch (schema.scope) {
            case 'SELF':
                if (context.unitZone) candidates = [context.unitZone];
                break;
            case 'MY_FIELD':
                candidates = [...player.unitZones];
                break;
            case 'OPP_FIELD':
                if (opponent) candidates = [...opponent.unitZones];
                break;
            case 'BOTH_FIELDS':
                candidates = [...player.unitZones];
                if (opponent) candidates.push(...opponent.unitZones);
                break;
            case 'ADJACENT_LANES':
                if (context.unitZone) {
                    const idx = player.unitZones.indexOf(context.unitZone);
                    if (idx !== -1) {
                        candidates = player.unitZones.filter((_, i) => Math.abs(i - idx) === 1);
                    }
                }
                break;
            case 'ENCOUNTER':
            case 'ENCOUNTER_UNIT':
                if (context.unitZone) {
                    const idx = player.unitZones.indexOf(context.unitZone);
                    if (idx !== -1 && opponent && opponent.unitZones[idx].unit) {
                        candidates = [opponent.unitZones[idx]];
                    }
                }
                break;
            case 'MY_TRASH':
                candidates = [...player.trash];
                break;
            case 'MY_HAND':
                candidates = [...player.hand];
                break;
            case 'OPP_HAND':
                if (opponent) candidates = [...opponent.hand];
                break;
            case 'MY_DAMAGE':
                candidates = [...player.damage];
                break;
            case 'MY_FIELD_ITEMS':
                candidates = this.getFieldItems(player);
                break;
            case 'OPP_FIELD_ITEMS':
                if (opponent) candidates = this.getFieldItems(opponent);
                break;
            case 'FIELD_ITEMS':
                candidates = this.getFieldItems(player);
                if (opponent) candidates.push(...this.getFieldItems(opponent));
                break;
            case 'SHARED_LANE':
                candidates = player.unitZones.filter((myZone, idx) => {
                    const oppZone = (opponent || engine.state.players.find(p => p !== player))?.unitZones[idx];
                    return myZone.unit !== null && oppZone?.unit !== null;
                });
                break;
            case 'REVEALED':
                candidates = [...engine.state.revealedCards];
                break;
            case 'LAST_DRAWN':
                candidates = [...((context as any).lastDrawnCards || [])];
                console.log(`[TargetSelector] Resolving LAST_DRAWN. Context has ${((context as any).lastDrawnCards || []).length} cards.`);
                break;
        }

        // 2. Type filtering
        if (schema.type === 'UNIT') {
            candidates = candidates.filter(c => this.getCardFromTarget(c)?.type === CardType.UNIT);
        }

        // 3. Advanced Filters
        if (schema.filters) {
            schema.filters.forEach(filter => {
                switch (filter.type) {
                    case 'EXCLUDE_SELF':
                        if (context.unitZone) {
                            candidates = candidates.filter(c => c !== context.unitZone);
                        }
                        break;
                    case 'UNIT_TYPE':
                        candidates = candidates.filter(c => {
                            const card = this.getCardFromTarget(c);
                            return card && card.type === filter.value;
                        });
                        break;
                    case 'HAS_TRAIT':
                        candidates = candidates.filter(c => {
                            const unit = this.getUnitFromTarget(c);
                            return unit && this.hasTrait(unit, filter.value);
                        });
                        break;
                    case 'HAS_ANY_TRAIT': {
                        const traits = Array.isArray(filter.value) ? filter.value : [filter.value];
                        candidates = candidates.filter(c => {
                            const unit = this.getUnitFromTarget(c);
                            return unit && traits.some((trait: any) => this.hasTrait(unit, trait));
                        });
                        break;
                    }
                    case 'HAS_KEYWORD':
                        candidates = candidates.filter(c => {
                            const unit = this.getUnitFromTarget(c);
                            if (!unit) return false;
                            const zone = ('unit' in c) ? c as UnitZoneState : null;
                            return unit && this.hasDynamicKeyword(unit, filter.value, zone);
                        });
                        break;
                    case 'HAS_ACTIVE_ATTACK_EFFECT':
                        candidates = candidates.filter(c => {
                            if (!c || typeof c !== 'object' || !('unit' in c)) return false;
                            return this.hasActivatableAttackActiveEffect(engine, c as UnitZoneState, filter.value);
                        });
                        break;
                    case 'NOT_HAS_KEYWORD':
                        candidates = candidates.filter(c => {
                            const unit = this.getUnitFromTarget(c);
                            if (!unit) return false;
                            const zone = ('unit' in c) ? c as UnitZoneState : null;
                            return !this.hasDynamicKeyword(unit, filter.value, zone);
                        });
                        break;
                    case 'HAS_ENCOUNTER':
                        candidates = candidates.filter(c =>
                            !!(c && typeof c === 'object' && 'unit' in c) &&
                            this.hasEncounter(engine, c as UnitZoneState)
                        );
                        break;
                    case 'NO_ENCOUNTER':
                        candidates = candidates.filter(c =>
                            !!(c && typeof c === 'object' && 'unit' in c) &&
                            !this.hasEncounter(engine, c as UnitZoneState)
                        );
                        break;
                    case 'DIFFERENT_LANE_FROM_SOURCE':
                        candidates = candidates.filter(c =>
                            !!(c && typeof c === 'object' && 'unit' in c) &&
                            this.isDifferentLaneFromSource(engine, context, c as UnitZoneState)
                        );
                        break;
                    case 'COST_LIMIT':
                        candidates = candidates.filter(c => {
                            const unit = this.getUnitFromTarget(c);
                            return unit && this.getCardCost(engine, unit) <= filter.value;
                        });
                        break;
                    case 'COST_LIMIT_BY_DAMAGE_COUNT':
                        candidates = candidates.filter(c => {
                            const card = this.getCardFromTarget(c);
                            if (!card) return false;
                            const add = typeof filter.value?.add === 'number' ? filter.value.add : 0;
                            const limit = typeof (engine as any)?.getEffectiveDamageCount === 'function'
                                ? (engine as any).getEffectiveDamageCount(context.player, context)
                                : context.player.damage.length;
                            return this.getCardCost(engine, card) <= limit + add;
                        });
                        break;
                    case 'COST_LIMIT_BY_DAMAGE_TRAIT_COUNT':
                        candidates = candidates.filter(c => {
                            const card = this.getCardFromTarget(c);
                            const trait = typeof filter.value === 'string' ? filter.value : filter.value?.trait;
                            const add = typeof filter.value?.add === 'number' ? filter.value.add : 0;
                            if (!card || !trait) return false;
                            const limit = typeof (engine as any)?.getDamageTraitCount === 'function'
                                ? (engine as any).getDamageTraitCount(context.player, trait)
                                : 0;
                            return this.getCardCost(engine, card) <= limit + add;
                        });
                        break;
                    case 'COST_STRICTLY_LOWER_THAN_DAMAGE_TRAIT_COUNT':
                        candidates = candidates.filter(c => {
                            const card = this.getCardFromTarget(c);
                            const trait = typeof filter.value === 'string' ? filter.value : filter.value?.trait;
                            const add = typeof filter.value?.add === 'number' ? filter.value.add : 0;
                            if (!card || !trait) return false;
                            const limit = typeof (engine as any)?.getDamageTraitCount === 'function'
                                ? (engine as any).getDamageTraitCount(context.player, trait)
                                : 0;
                            return this.getCardCost(engine, card) < limit + add;
                        });
                        break;
                    case 'POWER_LIMIT':
                        candidates = candidates.filter(c => {
                            if (c && typeof c === 'object' && 'unit' in c) {
                                const zone = c as UnitZoneState;
                                const owner = this.getOwner(engine, zone);
                                return engine.getUnitPower(zone, owner) <= filter.value;
                            }
                            const card = this.getCardFromTarget(c);
                            if (!card) return false;
                            return (card.power || 0) <= filter.value;
                        });
                        break;
                    case 'POWER_MIN':
                        candidates = candidates.filter(c => {
                            if (c && typeof c === 'object' && 'unit' in c) {
                                const zone = c as UnitZoneState;
                                const owner = this.getOwner(engine, zone);
                                return engine.getUnitPower(zone, owner) >= filter.value;
                            }
                            const card = this.getCardFromTarget(c);
                            if (!card) return false;
                            return (card.power || 0) >= filter.value;
                        });
                        break;
                    case 'HIT_LIMIT':
                        candidates = candidates.filter(c => {
                            if (c && typeof c === 'object' && 'unit' in c) {
                                const zone = c as UnitZoneState;
                                const owner = this.getOwner(engine, zone);
                                return engine.getUnitHit(zone, owner) <= filter.value;
                            }
                            const unit = this.getUnitFromTarget(c);
                            return unit && (unit.hit || 0) <= filter.value;
                        });
                        break;
                    case 'COST_MIN':
                        candidates = candidates.filter(c => {
                            const unit = this.getUnitFromTarget(c);
                            return unit && this.getCardCost(engine, unit) >= filter.value;
                        });
                        break;
                    case 'COST_LOWER_THAN_SKILL_ZONE_COUNT':
                        candidates = candidates.filter(c => {
                            const card = this.getCardFromTarget(c);
                            return card && this.getCardCost(engine, card) < context.player.skillZone.length;
                        });
                        break;
                    case 'COST_LIMIT_BY_LEADER_LEVEL':
                        candidates = candidates.filter(c => {
                            const card = this.getCardFromTarget(c);
                            return card && this.getCardCost(engine, card) <= context.player.leaderLevel;
                        });
                        break;
                    case 'COST_MIN_BY_LEADER_LEVEL':
                        candidates = candidates.filter(c => {
                            const card = this.getCardFromTarget(c);
                            return card && this.getCardCost(engine, card) >= context.player.leaderLevel;
                        });
                        break;
                    case 'COST_EQUAL':
                        candidates = candidates.filter(c => {
                            const unit = this.getUnitFromTarget(c);
                            const expectedCost = this.resolveCostEqualExpectedCost(engine, filter.value, context);
                            if (!unit || expectedCost === null) return false;
                            return this.getCardCost(engine, unit) === expectedCost;
                        });
                        break;
                    case 'COST_LOWER_THAN_COST_PAYMENT':
                        candidates = candidates.filter(c => {
                            const unit = this.getUnitFromTarget(c);
                            if (!unit || !context.costPaymentCard) return false;
                            return this.getCardCost(engine, unit) < this.getCardCost(engine, context.costPaymentCard);
                        });
                        break;
                    case 'COST_LIMIT_BY_COST_PAYMENT':
                        candidates = candidates.filter(c => {
                            const card = this.getCardFromTarget(c);
                            if (!card || !context.costPaymentCard) return false;
                            return this.getCardCost(engine, card) <= this.getCardCost(engine, context.costPaymentCard);
                        });
                        break;
                    case 'COST_LOWER_THAN_TRASHED_UNIT':
                        candidates = candidates.filter(c => {
                            const card = this.getCardFromTarget(c);
                            if (!card || !context.trashedUnit) return false;
                            return this.getCardCost(engine, card) < this.getCardCost(engine, context.trashedUnit);
                        });
                        break;
                    case 'COST_HIGHER_THAN_ENCOUNTER':
                        candidates = candidates.filter(c => {
                            const unit = this.getUnitFromTarget(c);
                            if (!unit || !context.unitZone || !context.unitZone.unit) return false;
                            const encounterUnit = context.unitZone.unit;
                            return this.getCardCost(engine, unit) > this.getCardCost(engine, encounterUnit);
                        });
                        break;
                    case 'HAS_NAME':
                        candidates = candidates.filter(c => {
                            const unit = this.getUnitFromTarget(c);
                            return unit && unit.name.includes(filter.value);
                        });
                        break;
                    case 'EXCLUDE_CARD_ID':
                        candidates = candidates.filter(c => {
                            const card = this.getCardFromTarget(c);
                            return card && card.id !== filter.value;
                        });
                        break;
                    case 'EQUIPPED_ON_SOURCE_UNIT':
                        candidates = candidates.filter(c => {
                            if (!context.unitZone || !Array.isArray(context.unitZone.items)) return false;
                            return context.unitZone.items.includes(c);
                        });
                        break;
                    case 'ITEM_COUNT_MIN':
                        candidates = candidates.filter(c => {
                            if (!c || typeof c !== 'object' || !('items' in c)) return false;
                            const minCount = typeof filter.value === 'number' ? filter.value : 0;
                            return Array.isArray((c as UnitZoneState).items) && (c as UnitZoneState).items.length >= minCount;
                        });
                        break;
                    case 'ITEM_COUNT_MAX':
                        candidates = candidates.filter(c => {
                            if (!c || typeof c !== 'object' || !('items' in c)) return false;
                            const maxCount = typeof filter.value === 'number' ? filter.value : 0;
                            const itemCount = Array.isArray((c as UnitZoneState).items) ? (c as UnitZoneState).items.length : 0;
                            return itemCount <= maxCount;
                        });
                        break;
                    case 'COST_LIMIT_BY_EQUIPPED_ITEM_COUNT':
                        candidates = candidates.filter(c => {
                            const card = this.getCardFromTarget(c);
                            if (!card || !context.unitZone) return false;
                            const equippedCount = Array.isArray(context.unitZone.items) ? context.unitZone.items.length : 0;
                            return this.getCardCost(engine, card) <= equippedCount;
                        });
                        break;
                    case 'POWER_LOWER_THAN_SOURCE':
                        candidates = candidates.filter(c => {
                            if (!context.unitZone?.unit) return false;
                            const sourcePower = engine.getUnitPower(context.unitZone, context.player);
                            if (c && typeof c === 'object' && 'unit' in c) {
                                const zone = c as UnitZoneState;
                                const owner = this.getOwner(engine, zone);
                                return engine.getUnitPower(zone, owner) < sourcePower;
                            }
                            const card = this.getCardFromTarget(c);
                            return !!card && (card.power || 0) < sourcePower;
                        });
                        break;
                    case 'POWER_LIMIT_BY_SOURCE':
                        candidates = candidates.filter(c => {
                            if (!context.unitZone?.unit) return false;
                            const sourcePower = engine.getUnitPower(context.unitZone, context.player);
                            if (c && typeof c === 'object' && 'unit' in c) {
                                const zone = c as UnitZoneState;
                                const owner = this.getOwner(engine, zone);
                                return engine.getUnitPower(zone, owner) <= sourcePower;
                            }
                            const card = this.getCardFromTarget(c);
                            return !!card && (card.power || 0) <= sourcePower;
                        });
                        break;
                    case 'CARD_TYPE_IN':
                        candidates = candidates.filter(c => {
                            const card = this.getCardFromTarget(c);
                            if (!card) return false;
                            const allowedTypes = Array.isArray(filter.value) ? filter.value : [filter.value];
                            return allowedTypes.includes(card.type);
                        });
                        break;
                    case 'LOWEST_COST_ONLY': {
                        const costs = candidates
                            .map(c => this.getCardFromTarget(c))
                            .filter((card): card is any => card !== null)
                            .map(card => this.getCardCost(engine, card));
                        if (costs.length === 0) {
                            candidates = [];
                            break;
                        }
                        const minCost = Math.min(...costs);
                        candidates = candidates.filter(c => {
                            const card = this.getCardFromTarget(c);
                            return !!card && this.getCardCost(engine, card) === minCost;
                        });
                        break;
                    }
                }
            });
        }

        // 4. Legacy Conditions Check
        if (schema.conditions) {
            if (schema.conditions.hasTrait) {
                candidates = candidates.filter(c => {
                    const unit = this.getUnitFromTarget(c);
                    return unit && unit.traits?.includes(schema.conditions!.hasTrait!);
                });
            }
            if (schema.conditions.costMax !== undefined) {
                candidates = candidates.filter(c => {
                    const unit = this.getUnitFromTarget(c);
                    return unit && this.getCardCost(engine, unit) <= schema.conditions!.costMax!;
                });
            }
        }

        // 5. Selection Mode
        if (schema.selectMode === 'ALL' || schema.count === 0) {
            return candidates;
        }

        if (schema.selectMode === 'RANDOM') {
            const count = schema.count || 1;
            const shuffled = engine.shuffledCopy(candidates);
            return shuffled.slice(0, count);
        }

        if (schema.selectMode === 'LOWEST_POWER') {
            candidates.sort((a, b) => {
                const pA = engine.getUnitPower(a, this.getOwner(engine, a));
                const pB = engine.getUnitPower(b, this.getOwner(engine, b));
                return pA - pB;
            });
            return candidates.slice(0, schema.count || 1);
        }

        if (schema.selectMode === 'HIGHEST_POWER') {
            candidates.sort((a, b) => {
                const pA = engine.getUnitPower(a, this.getOwner(engine, a));
                const pB = engine.getUnitPower(b, this.getOwner(engine, b));
                return pB - pA;
            });
            return candidates.slice(0, schema.count || 1);
        }

        return candidates;
    }

    public static isValidTarget(engine: GameEngine, schema: TargetSchema | undefined, context: GameContext, target: any): boolean {
        const player = context.player;
        const opponent = context.opponent || engine.state.players.find(p => p !== player);

        if (!schema) {
            return target === context.unitZone || target === context.player.levelZone;
        }

        // 1. Scope Check
        let inScope = false;
        switch (schema.scope) {
            case 'SELF': inScope = (target === context.unitZone); break;
            case 'MY_FIELD': inScope = player.unitZones.includes(target); break;
            case 'OPP_FIELD': inScope = opponent ? opponent.unitZones.includes(target) : false; break;
            case 'BOTH_FIELDS': inScope = player.unitZones.includes(target) || (opponent ? opponent.unitZones.includes(target) : false); break;
            case 'MY_LEADER': inScope = (target === player.levelZone); break;
            case 'OPP_LEADER': inScope = opponent ? (target === opponent.levelZone) : false; break;
            case 'ENCOUNTER':
            case 'ENCOUNTER_UNIT':
                if (context.unitZone) {
                    const idx = player.unitZones.indexOf(context.unitZone);
                    if (idx !== -1 && opponent) inScope = (target === opponent.unitZones[idx]);
                }
                break;
            case 'MY_TRASH': inScope = player.trash.includes(target); break;
            case 'MY_HAND': inScope = player.hand.includes(target); break;
            case 'OPP_HAND': inScope = opponent ? opponent.hand.includes(target) : false; break;
            case 'MY_DAMAGE': inScope = player.damage.includes(target); break;
            case 'MY_FIELD_ITEMS': inScope = this.isItemOnPlayerField(player, target); break;
            case 'OPP_FIELD_ITEMS': inScope = opponent ? this.isItemOnPlayerField(opponent, target) : false; break;
            case 'FIELD_ITEMS': inScope = this.isItemOnPlayerField(player, target) || (opponent ? this.isItemOnPlayerField(opponent, target) : false); break;
            case 'SHARED_LANE':
                const idx = player.unitZones.indexOf(target);
                if (idx !== -1) inScope = (player.unitZones[idx].unit !== null && (opponent ? opponent.unitZones[idx].unit !== null : false));
                else {
                    const oppIdx = opponent ? opponent.unitZones.indexOf(target) : -1;
                    if (oppIdx !== -1) inScope = (player.unitZones[oppIdx].unit !== null && (opponent ? opponent.unitZones[oppIdx].unit !== null : false));
                }
                break;
            case 'REVEALED': inScope = engine.state.revealedCards.includes(target); break;
            case 'LAST_DRAWN': inScope = ((context as any).lastDrawnCards || []).includes(target); break;
        }

        if (!inScope) return false;

        // 2. Type Check
        if (schema.type === 'UNIT') {
            if (this.getCardFromTarget(target)?.type !== CardType.UNIT) return false;
        }

        // 3. Filter Check
        if (schema.filters) {
            for (const filter of schema.filters) {
                const unit = this.getUnitFromTarget(target);
                switch (filter.type) {
                    case 'EXCLUDE_SELF': if (target === context.unitZone) return false; break;
                    case 'UNIT_TYPE':
                        {
                            const card = this.getCardFromTarget(target);
                            if (!card || card.type !== filter.value) return false;
                        }
                        break;
                    case 'HAS_TRAIT': if (!unit || !this.hasTrait(unit, filter.value)) return false; break;
                    case 'HAS_ANY_TRAIT': {
                        const traits = Array.isArray(filter.value) ? filter.value : [filter.value];
                        if (!unit || !traits.some((trait: any) => this.hasTrait(unit, trait))) return false;
                        break;
                    }
                    case 'HAS_KEYWORD':
                        if (!unit) return false;
                        {
                            const zone = (target && typeof target === 'object' && 'unit' in target)
                                ? target as UnitZoneState
                                : null;
                            if (!this.hasDynamicKeyword(unit, filter.value, zone)) return false;
                        }
                        break;
                    case 'HAS_ACTIVE_ATTACK_EFFECT':
                        if (!target || typeof target !== 'object' || !('unit' in target)) return false;
                        if (!this.hasActivatableAttackActiveEffect(engine, target as UnitZoneState, filter.value)) return false;
                        break;
                    case 'NOT_HAS_KEYWORD':
                        if (!unit) return false;
                        {
                            const zone = (target && typeof target === 'object' && 'unit' in target)
                                ? target as UnitZoneState
                                : null;
                            if (this.hasDynamicKeyword(unit, filter.value, zone)) return false;
                        }
                        break;
                    case 'HAS_ENCOUNTER':
                        if (!target || typeof target !== 'object' || !('unit' in target)) return false;
                        if (!this.hasEncounter(engine, target as UnitZoneState)) return false;
                        break;
                    case 'NO_ENCOUNTER':
                        if (!target || typeof target !== 'object' || !('unit' in target)) return false;
                        if (this.hasEncounter(engine, target as UnitZoneState)) return false;
                        break;
                    case 'DIFFERENT_LANE_FROM_SOURCE':
                        if (!target || typeof target !== 'object' || !('unit' in target)) return false;
                        if (!this.isDifferentLaneFromSource(engine, context, target as UnitZoneState)) return false;
                        break;
                    case 'COST_LIMIT': if (!unit || this.getCardCost(engine, unit) > filter.value) return false; break;
                    case 'COST_LIMIT_BY_DAMAGE_COUNT':
                        {
                            const card = this.getCardFromTarget(target);
                            const add = typeof filter.value?.add === 'number' ? filter.value.add : 0;
                            const limit = typeof (engine as any)?.getEffectiveDamageCount === 'function'
                                ? (engine as any).getEffectiveDamageCount(context.player, context)
                                : context.player.damage.length;
                            if (!card || this.getCardCost(engine, card) > limit + add) return false;
                        }
                        break;
                    case 'COST_LIMIT_BY_DAMAGE_TRAIT_COUNT':
                        {
                            const card = this.getCardFromTarget(target);
                            const trait = typeof filter.value === 'string' ? filter.value : filter.value?.trait;
                            const add = typeof filter.value?.add === 'number' ? filter.value.add : 0;
                            const limit = trait && typeof (engine as any)?.getDamageTraitCount === 'function'
                                ? (engine as any).getDamageTraitCount(context.player, trait)
                                : 0;
                            if (!card || !trait || this.getCardCost(engine, card) > limit + add) return false;
                        }
                        break;
                    case 'COST_STRICTLY_LOWER_THAN_DAMAGE_TRAIT_COUNT':
                        {
                            const card = this.getCardFromTarget(target);
                            const trait = typeof filter.value === 'string' ? filter.value : filter.value?.trait;
                            const add = typeof filter.value?.add === 'number' ? filter.value.add : 0;
                            const limit = trait && typeof (engine as any)?.getDamageTraitCount === 'function'
                                ? (engine as any).getDamageTraitCount(context.player, trait)
                                : 0;
                            if (!card || !trait || this.getCardCost(engine, card) >= limit + add) return false;
                        }
                        break;
                    case 'HIT_LIMIT':
                        if (target && typeof target === 'object' && 'unit' in target) {
                            const zoneTarget = target as UnitZoneState;
                            const owner = this.getOwner(engine, zoneTarget);
                            if (engine.getUnitHit(zoneTarget, owner) > filter.value) return false;
                            break;
                        }
                        if (!unit || (unit.hit || 0) > filter.value) return false;
                        break;
                    case 'COST_MIN': if (!unit || this.getCardCost(engine, unit) < filter.value) return false; break;
                    case 'COST_LOWER_THAN_SKILL_ZONE_COUNT':
                        {
                            const card = this.getCardFromTarget(target);
                            if (!card || this.getCardCost(engine, card) >= context.player.skillZone.length) return false;
                        }
                        break;
                    case 'COST_LIMIT_BY_LEADER_LEVEL':
                        {
                            const card = this.getCardFromTarget(target);
                            if (!card || this.getCardCost(engine, card) > context.player.leaderLevel) return false;
                        }
                        break;
                    case 'COST_MIN_BY_LEADER_LEVEL':
                        {
                            const card = this.getCardFromTarget(target);
                            if (!card || this.getCardCost(engine, card) < context.player.leaderLevel) return false;
                        }
                        break;
                    case 'POWER_LIMIT':
                        if (target && typeof target === 'object' && 'unit' in target) {
                            const zoneTarget = target as UnitZoneState;
                            const owner = this.getOwner(engine, zoneTarget);
                            if (engine.getUnitPower(zoneTarget, owner) > filter.value) return false;
                            break;
                        }
                        {
                            const card = this.getCardFromTarget(target);
                            if (!card || (card.power || 0) > filter.value) return false;
                        }
                        break;
                    case 'POWER_MIN':
                        if (target && typeof target === 'object' && 'unit' in target) {
                            const zoneTarget = target as UnitZoneState;
                            const owner = this.getOwner(engine, zoneTarget);
                            if (engine.getUnitPower(zoneTarget, owner) < filter.value) return false;
                            break;
                        }
                        {
                            const card = this.getCardFromTarget(target);
                            if (!card || (card.power || 0) < filter.value) return false;
                        }
                        break;
                    case 'COST_LOWER_THAN_COST_PAYMENT':
                        if (!unit || !context.costPaymentCard) return false;
                        if (this.getCardCost(engine, unit) >= this.getCardCost(engine, context.costPaymentCard)) return false;
                        break;
                    case 'COST_LIMIT_BY_COST_PAYMENT':
                        {
                            const card = this.getCardFromTarget(target);
                            if (!card || !context.costPaymentCard) return false;
                            if (this.getCardCost(engine, card) > this.getCardCost(engine, context.costPaymentCard)) return false;
                        }
                        break;
                    case 'COST_LOWER_THAN_TRASHED_UNIT':
                        {
                            const card = this.getCardFromTarget(target);
                            if (!card || !context.trashedUnit) return false;
                            if (this.getCardCost(engine, card) >= this.getCardCost(engine, context.trashedUnit)) return false;
                        }
                        break;
                    case 'HAS_NAME':
                        if (!unit || !unit.name.includes(filter.value)) return false;
                        break;
                    case 'EXCLUDE_CARD_ID':
                        {
                            const card = this.getCardFromTarget(target);
                            if (!card || card.id === filter.value) return false;
                        }
                        break;
                    case 'EQUIPPED_ON_SOURCE_UNIT':
                        if (!context.unitZone || !Array.isArray(context.unitZone.items)) return false;
                        if (!context.unitZone.items.includes(target)) return false;
                        break;
                    case 'COST_EQUAL':
                        {
                            const expectedCost = this.resolveCostEqualExpectedCost(engine, filter.value, context);
                            if (!unit || expectedCost === null) return false;
                            if (this.getCardCost(engine, unit) !== expectedCost) return false;
                        }
                        break;
                    case 'COST_HIGHER_THAN_ENCOUNTER':
                        if (!unit || !context.unitZone || !context.unitZone.unit) return false;
                        if (this.getCardCost(engine, unit) <= this.getCardCost(engine, context.unitZone.unit)) return false;
                        break;
                    case 'ITEM_COUNT_MIN':
                        if (!target || typeof target !== 'object' || !('items' in target)) return false;
                        {
                            const minCount = typeof filter.value === 'number' ? filter.value : 0;
                            const itemCount = Array.isArray((target as UnitZoneState).items) ? (target as UnitZoneState).items.length : 0;
                            if (itemCount < minCount) return false;
                        }
                        break;
                    case 'ITEM_COUNT_MAX':
                        if (!target || typeof target !== 'object' || !('items' in target)) return false;
                        {
                            const maxCount = typeof filter.value === 'number' ? filter.value : 0;
                            const itemCount = Array.isArray((target as UnitZoneState).items) ? (target as UnitZoneState).items.length : 0;
                            if (itemCount > maxCount) return false;
                        }
                        break;
                    case 'COST_LIMIT_BY_EQUIPPED_ITEM_COUNT':
                        {
                            const card = this.getCardFromTarget(target);
                            if (!card || !context.unitZone) return false;
                            const equippedCount = Array.isArray(context.unitZone.items) ? context.unitZone.items.length : 0;
                            if (this.getCardCost(engine, card) > equippedCount) return false;
                        }
                        break;
                    case 'POWER_LOWER_THAN_SOURCE':
                        if (!context.unitZone?.unit) return false;
                        {
                            const sourcePower = engine.getUnitPower(context.unitZone, context.player);
                            if (target && typeof target === 'object' && 'unit' in target) {
                                const zoneTarget = target as UnitZoneState;
                                const owner = this.getOwner(engine, zoneTarget);
                                if (engine.getUnitPower(zoneTarget, owner) >= sourcePower) return false;
                                break;
                            }
                            const card = this.getCardFromTarget(target);
                            if (!card || (card.power || 0) >= sourcePower) return false;
                        }
                        break;
                    case 'POWER_LIMIT_BY_SOURCE':
                        if (!context.unitZone?.unit) return false;
                        {
                            const sourcePower = engine.getUnitPower(context.unitZone, context.player);
                            if (target && typeof target === 'object' && 'unit' in target) {
                                const zoneTarget = target as UnitZoneState;
                                const owner = this.getOwner(engine, zoneTarget);
                                if (engine.getUnitPower(zoneTarget, owner) > sourcePower) return false;
                                break;
                            }
                            const card = this.getCardFromTarget(target);
                            if (!card || (card.power || 0) > sourcePower) return false;
                        }
                        break;
                    case 'CARD_TYPE_IN':
                        {
                            const card = this.getCardFromTarget(target);
                            const allowedTypes = Array.isArray(filter.value) ? filter.value : [filter.value];
                            if (!card || !allowedTypes.includes(card.type)) return false;
                        }
                        break;
                    case 'LOWEST_COST_ONLY': {
                        const otherFilters = (schema.filters || []).filter(f => f.type !== 'LOWEST_COST_ONLY');
                        const baseSchema: TargetSchema = { ...schema, filters: otherFilters };
                        const baseCandidates = this.resolve(engine, baseSchema, context);
                        const baseCosts = baseCandidates
                            .map(candidate => this.getCardFromTarget(candidate))
                            .filter((card): card is any => card !== null)
                            .map(card => this.getCardCost(engine, card));
                        if (baseCosts.length === 0) return false;
                        const targetCard = this.getCardFromTarget(target);
                        if (!targetCard) return false;
                        if (this.getCardCost(engine, targetCard) !== Math.min(...baseCosts)) return false;
                        break;
                    }
                }
            }
        }

        // 4. Legacy Conditions Check
        if (schema.conditions) {
            const unit = this.getUnitFromTarget(target);
            if (schema.conditions.costMax !== undefined && (!unit || this.getCardCost(engine, unit) > schema.conditions.costMax)) return false;
            if (schema.conditions.hasTrait && (!unit || !this.hasTrait(unit, schema.conditions.hasTrait))) return false;
        }

        return true;
    }

    private static getUnitFromTarget(target: any): any | null {
        if (!target) return null;
        if ('unit' in target) return target.unit;
        if ('type' in target) return target;
        return null;
    }

    private static getCardFromTarget(target: any): any | null {
        if (!target) return null;
        if ('unit' in target) return target.unit;
        if ('type' in target) return target;
        return null;
    }

    private static getOwner(engine: GameEngine, zone: UnitZoneState): PlayerState {
        if (engine.state.players[0].unitZones.includes(zone)) return engine.state.players[0];
        return engine.state.players[1];
    }

    private static hasEncounter(engine: GameEngine, zone: UnitZoneState): boolean {
        const owner = this.getOwner(engine, zone);
        const opponent = engine.state.players.find(player => player.id !== owner.id);
        if (!opponent) return false;
        const laneIndex = owner.unitZones.indexOf(zone);
        if (laneIndex < 0) return false;
        return !!opponent.unitZones[laneIndex]?.unit;
    }

    private static isDifferentLaneFromSource(engine: GameEngine, context: GameContext, targetZone: UnitZoneState): boolean {
        if (!context.unitZone) return false;
        const sourceOwner = this.getOwner(engine, context.unitZone);
        const targetOwner = this.getOwner(engine, targetZone);
        const sourceLaneIndex = sourceOwner.unitZones.indexOf(context.unitZone);
        const targetLaneIndex = targetOwner.unitZones.indexOf(targetZone);
        if (sourceLaneIndex < 0 || targetLaneIndex < 0) return false;
        return sourceLaneIndex !== targetLaneIndex;
    }

    private static getFieldItems(player: PlayerState): any[] {
        const items: any[] = [];
        player.unitZones.forEach(zone => {
            items.push(...zone.items);
        });
        return items;
    }

    private static isItemOnPlayerField(player: PlayerState, target: any): boolean {
        return player.unitZones.some(zone => zone.items.includes(target));
    }

    private static hasDynamicKeyword(card: any, keyword: string, zone: UnitZoneState | null): boolean {
        if (card.keywords?.includes(keyword)) return true;

        const keywordMap: Record<string, string> = {
            '어태커': 'ATTACKER', '디펜더': 'DEFENDER', '액티브': 'ACTIVE',
            '엔트리': 'ENTRY', '엑시트': 'EXIT', '트리거': 'DAMAGE_TRIGGER', '각성': 'AWAKEN'
        };
        const actionKeywordMap: Record<string, string[]> = {
            '관통': ['PENETRATION'],
            '약탈': ['PLUNDER'],
            '돌파': ['BREAKTHROUGH'],
            '공멸': ['MUTUAL_DESTRUCTION'],
            '침투': ['INFILTRATION', 'APPLY_INFILTRATION_MARK'],
            '듀얼리스트': ['DUALIST', 'APPLY_DUALIST_MARK'],
        };
        const mappedCondition = keywordMap[keyword];
        const isActivationKeyword = !!mappedCondition;
        const mappedActions = actionKeywordMap[keyword] || [];
        const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const keywordLabelPattern = new RegExp(`^[\\s「\\[]*${escapedKeyword}\\s*:`);

        const effectHasKeyword = (effect: any): boolean => {
            if (!effect) return false;
            if (isActivationKeyword && effect.activation === mappedCondition) return true;
            if (mappedActions.length > 0 && mappedActions.includes(effect.action?.type)) return true;
            if (effect.action?.type === 'GRANT_EFFECT' && effect.action?.params?.effect) {
                if (effectHasKeyword(effect.action.params.effect)) return true;
            }
            const description = String(effect.description || '').replace(/\u00a0/g, ' ').trim();
            return keywordLabelPattern.test(description);
        };

        if (card.effects) {
            for (const effect of card.effects) {
                if (effectHasKeyword(effect)) return true;
            }
        }

        if (zone) {
            const items = Array.isArray((zone as any).items) ? zone.items : [];
            for (const item of items) {
                if (item.keywords?.includes(keyword)) return true;
                if (item.effects) {
                    for (const effect of item.effects) {
                        if (effectHasKeyword(effect)) return true;
                    }
                }
            }
            const temporaryEffects = Array.isArray((zone as any).temporaryEffects) ? zone.temporaryEffects : [];
            for (const effect of temporaryEffects) {
                if (effectHasKeyword(effect)) return true;
            }
        }

        return false;
    }

    private static hasActivatableAttackActiveEffect(engine: GameEngine, zone: UnitZoneState, filterValue?: any): boolean {
        if (!zone.unit || !Array.isArray(zone.unit.effects)) return false;

        const owner = this.getOwner(engine, zone);
        const opponent = engine.state.players.find(player => player.id !== owner.id);
        if (!opponent) return false;

        const options = this.resolveActiveAttackFilterOptions(filterValue);
        return zone.unit.effects.some((effect: any, effectIndex: number) =>
            this.isActivatableAttackActiveEffect(engine, zone, owner, opponent, effect, effectIndex, options)
        );
    }

    private static isActivatableAttackActiveEffect(
        engine: GameEngine,
        zone: UnitZoneState,
        owner: PlayerState,
        opponent: PlayerState,
        effect: any,
        effectIndex: number,
        options: { includeActivatedThisTurn: boolean }
    ): boolean {
        if (!effect || effect.activation !== 'ACTIVE') return false;
        if (!this.effectHasPhaseAttackCondition(effect.condition)) return false;

        const effectKey = `${zone.unit?.id}_${effect.id || effectIndex}`;
        if (!options.includeActivatedThisTurn && zone.activatedEffectKeys?.[effectKey]) return false;

        const context: GameContext = {
            sourceCard: zone.unit!,
            player: owner,
            opponent,
            unitZone: zone,
            machine: engine,
        };

        if (!engine.effectManager.checkCondition(effect, context)) return false;

        if (effect.cost && effect.cost.type !== 'NONE') {
            if (effect.cost.type === 'TRASH_HAND' || effect.cost.type === 'SHUFFLE_HAND_TO_DECK') {
                const requiredAmount = effect.cost.amount || 1;
                const costFilter = effect.cost.cardTypeFilter;
                const payableCount = owner.hand.filter(card => !costFilter || card.type === costFilter).length;
                if (payableCount < requiredAmount) return false;
            }
        }

        if (effect.targets && effect.targets.selectMode === 'MANUAL') {
            const candidates = this.resolve(engine, effect.targets, context);
            if (candidates.length === 0) return false;
        }

        return true;
    }

    private static resolveActiveAttackFilterOptions(filterValue: any): { includeActivatedThisTurn: boolean } {
        if (!filterValue || typeof filterValue !== 'object') {
            return { includeActivatedThisTurn: false };
        }
        return {
            includeActivatedThisTurn: filterValue.includeActivatedThisTurn === true,
        };
    }

    private static effectHasPhaseAttackCondition(condition: any): boolean {
        if (!condition || typeof condition !== 'object') return false;

        if (condition.type === 'CONTEXT_FLAG') {
            const value = condition.value;
            if (value === 'PHASE_ATTACK') return true;
            if (value?.key === 'PHASE_ATTACK') {
                if (value.equals === undefined) return true;
                return value.equals === true;
            }
            return false;
        }

        if (condition.type === 'ALL' && Array.isArray(condition.value)) {
            return condition.value.some((nested: any) => this.effectHasPhaseAttackCondition(nested));
        }

        return false;
    }

    private static resolveCostEqualExpectedCost(engine: GameEngine, filterValue: any, context: GameContext): number | null {
        const dynamicValue = filterValue ?? (context.costPaymentCard ? this.getCardCost(engine, context.costPaymentCard) : null);
        if (typeof dynamicValue !== 'number') return null;
        return dynamicValue;
    }

    private static getCardCost(engine: GameEngine, card: any): number {
        if (!card) return 0;
        if (typeof (engine as any)?.getCardCost === 'function') {
            return (engine as any).getCardCost(card);
        }
        return Math.max(0, Number(card.cost || 0));
    }

    private static hasTrait(card: any, trait: any): boolean {
        if (!card || typeof trait !== 'string' || !trait.trim()) return false;
        return this.getTraitTokens(card).includes(trait.trim());
    }

    private static getTraitTokens(card: any): string[] {
        const traits = card?.traits;
        if (Array.isArray(traits)) {
            return traits
                .flatMap((trait: any) => String(trait ?? '').split('/'))
                .map((trait: string) => trait.trim())
                .filter((trait: string) => trait.length > 0 && trait !== '-');
        }
        return String(traits || '')
            .split('/')
            .map((trait: string) => trait.trim())
            .filter((trait: string) => trait.length > 0 && trait !== '-');
    }
}
