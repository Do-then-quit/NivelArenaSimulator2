import { GameEngine } from './GameEngine';
import { TargetSchema, GameContext, UnitZoneState, PlayerState } from './types';

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
            candidates = candidates.filter(c => this.getUnitFromTarget(c) !== null);
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
                            return unit && unit.traits?.includes(filter.value);
                        });
                        break;
                    case 'HAS_KEYWORD':
                        candidates = candidates.filter(c => {
                            const unit = this.getUnitFromTarget(c);
                            if (!unit) return false;
                            const zone = ('unit' in c) ? c as UnitZoneState : null;
                            return unit && this.hasDynamicKeyword(unit, filter.value, zone);
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
                    case 'COST_LIMIT':
                        candidates = candidates.filter(c => {
                            const unit = this.getUnitFromTarget(c);
                            return unit && unit.cost <= filter.value;
                        });
                        break;
                    case 'COST_MIN':
                        candidates = candidates.filter(c => {
                            const unit = this.getUnitFromTarget(c);
                            return unit && unit.cost >= filter.value;
                        });
                        break;
                    case 'COST_EQUAL':
                        candidates = candidates.filter(c => {
                            const unit = this.getUnitFromTarget(c);
                            return unit && unit.cost === filter.value;
                        });
                        break;
                    case 'COST_LOWER_THAN_COST_PAYMENT':
                        candidates = candidates.filter(c => {
                            const unit = this.getUnitFromTarget(c);
                            if (!unit || !context.costPaymentCard) return false;
                            return unit.cost < context.costPaymentCard.cost;
                        });
                        break;
                    case 'COST_HIGHER_THAN_ENCOUNTER':
                        candidates = candidates.filter(c => {
                            const unit = this.getUnitFromTarget(c);
                            if (!unit || !context.unitZone || !context.unitZone.unit) return false;
                            const encounterUnit = context.unitZone.unit;
                            return unit.cost > encounterUnit.cost;
                        });
                        break;
                    case 'HAS_NAME':
                        candidates = candidates.filter(c => {
                            const unit = this.getUnitFromTarget(c);
                            return unit && unit.name.includes(filter.value);
                        });
                        break;
                    case 'ITEM_COUNT_MIN':
                        candidates = candidates.filter(c => {
                            if (!c || typeof c !== 'object' || !('items' in c)) return false;
                            const minCount = typeof filter.value === 'number' ? filter.value : 0;
                            return Array.isArray((c as UnitZoneState).items) && (c as UnitZoneState).items.length >= minCount;
                        });
                        break;
                    case 'LOWEST_COST_ONLY': {
                        const costs = candidates
                            .map(c => this.getCardFromTarget(c))
                            .filter((card): card is any => card !== null && typeof card.cost === 'number')
                            .map(card => card.cost);
                        if (costs.length === 0) {
                            candidates = [];
                            break;
                        }
                        const minCost = Math.min(...costs);
                        candidates = candidates.filter(c => {
                            const card = this.getCardFromTarget(c);
                            return !!card && card.cost === minCost;
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
                    return unit && unit.cost <= schema.conditions!.costMax!;
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
            if (this.getUnitFromTarget(target) === null) return false;
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
                    case 'HAS_TRAIT': if (!unit || !unit.traits?.includes(filter.value)) return false; break;
                    case 'HAS_KEYWORD':
                        if (!unit) return false;
                        {
                            const zone = (target && typeof target === 'object' && 'unit' in target)
                                ? target as UnitZoneState
                                : null;
                            if (!this.hasDynamicKeyword(unit, filter.value, zone)) return false;
                        }
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
                    case 'COST_LIMIT': if (!unit || unit.cost > filter.value) return false; break;
                    case 'COST_MIN': if (!unit || unit.cost < filter.value) return false; break;
                    case 'POWER_LIMIT': if (!unit || engine.getUnitPower(target, this.getOwner(engine, target)) > filter.value) return false; break;
                    case 'COST_LOWER_THAN_COST_PAYMENT':
                        if (!unit || !context.costPaymentCard) return false;
                        if (unit.cost >= context.costPaymentCard.cost) return false;
                        break;
                    case 'HAS_NAME':
                        if (!unit || !unit.name.includes(filter.value)) return false;
                        break;
                    case 'COST_EQUAL':
                        if (!unit || unit.cost !== filter.value) return false;
                        break;
                    case 'COST_HIGHER_THAN_ENCOUNTER':
                        if (!unit || !context.unitZone || !context.unitZone.unit) return false;
                        if (unit.cost <= context.unitZone.unit.cost) return false;
                        break;
                    case 'ITEM_COUNT_MIN':
                        if (!target || typeof target !== 'object' || !('items' in target)) return false;
                        {
                            const minCount = typeof filter.value === 'number' ? filter.value : 0;
                            const itemCount = Array.isArray((target as UnitZoneState).items) ? (target as UnitZoneState).items.length : 0;
                            if (itemCount < minCount) return false;
                        }
                        break;
                    case 'LOWEST_COST_ONLY': {
                        const otherFilters = (schema.filters || []).filter(f => f.type !== 'LOWEST_COST_ONLY');
                        const baseSchema: TargetSchema = { ...schema, filters: otherFilters };
                        const baseCandidates = this.resolve(engine, baseSchema, context);
                        const baseCosts = baseCandidates
                            .map(candidate => this.getCardFromTarget(candidate))
                            .filter((card): card is any => card !== null && typeof card.cost === 'number')
                            .map(card => card.cost);
                        if (baseCosts.length === 0) return false;
                        const targetCard = this.getCardFromTarget(target);
                        if (!targetCard) return false;
                        if (targetCard.cost !== Math.min(...baseCosts)) return false;
                        break;
                    }
                }
            }
        }

        // 4. Legacy Conditions Check
        if (schema.conditions) {
            const unit = this.getUnitFromTarget(target);
            if (schema.conditions.costMax !== undefined && (!unit || unit.cost > schema.conditions.costMax)) return false;
            if (schema.conditions.hasTrait && (!unit || !unit.traits?.includes(schema.conditions.hasTrait))) return false;
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
        const mappedCondition = keywordMap[keyword];
        const isActivationKeyword = !!mappedCondition;

        const effectHasKeyword = (effect: any) => {
            if (isActivationKeyword) return effect.activation === mappedCondition;
            if (keyword === '공멸') return effect.action?.type === 'MUTUAL_DESTRUCTION';
            return effect.description.includes(keyword);
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
}
