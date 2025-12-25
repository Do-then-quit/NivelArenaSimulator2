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
            case 'SHARED_LANE':
                // For shared lane, we might return the zones in that lane or special handling
                // Usually it's handled via selectedLaneIndex if MANUAL
                break;
        }

        // 2. Type filtering (UNIT, LEADER, etc.)
        if (schema.type === 'UNIT') {
            candidates = candidates.filter(c => (c as UnitZoneState).unit !== null);
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
                    case 'HAS_TRAIT':
                        candidates = candidates.filter(c => {
                            const unit = (c as UnitZoneState).unit;
                            return unit && unit.traits?.includes(filter.value);
                        });
                        break;
                    case 'COST_LIMIT':
                        candidates = candidates.filter(c => {
                            const unit = (c as UnitZoneState).unit;
                            return unit && unit.cost <= filter.value;
                        });
                        break;
                }
            });
        }

        // 4. Legacy Conditions Check
        if (schema.conditions) {
            if (schema.conditions.hasTrait) {
                candidates = candidates.filter(c => {
                    const unit = (c as UnitZoneState).unit;
                    return unit && unit.traits?.includes(schema.conditions!.hasTrait!);
                });
            }
            if (schema.conditions.costMax !== undefined) {
                candidates = candidates.filter(c => {
                    const unit = (c as UnitZoneState).unit;
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
            const shuffled = [...candidates].sort(() => 0.5 - Math.random());
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

        return candidates;
    }

    public static isValidTarget(engine: GameEngine, schema: TargetSchema, context: GameContext, target: any): boolean {
        const player = context.player;
        const opponent = context.opponent || engine.state.players.find(p => p !== player);

        // 1. Scope Check
        let inScope = false;
        switch (schema.scope) {
            case 'SELF': inScope = (target === context.unitZone); break;
            case 'MY_FIELD': inScope = player.unitZones.includes(target); break;
            case 'OPP_FIELD': inScope = opponent ? opponent.unitZones.includes(target) : false; break;
            case 'BOTH_FIELDS': inScope = player.unitZones.includes(target) || (opponent ? opponent.unitZones.includes(target) : false); break;
            case 'MY_LEADER': inScope = (target === player.levelZone); break;
            case 'OPP_LEADER': inScope = opponent ? (target === opponent.levelZone) : false; break;
            case 'SHARED_LANE':
                // For shared lane validation, we usually need the lane index or both zones.
                // Simplified: check if target is a zone in a shared lane
                const idx = player.unitZones.indexOf(target);
                if (idx !== -1) inScope = (player.unitZones[idx].unit !== null && (opponent ? opponent.unitZones[idx].unit !== null : false));
                else {
                    const oppIdx = opponent ? opponent.unitZones.indexOf(target) : -1;
                    if (oppIdx !== -1) inScope = (player.unitZones[oppIdx].unit !== null && (opponent ? opponent.unitZones[oppIdx].unit !== null : false));
                }
                break;
        }


        // 2. Type Check
        if (schema.type === 'UNIT') {
            if (!(target as UnitZoneState).unit) return false;
        }

        // 3. Filter Check
        if (schema.filters) {
            for (const filter of schema.filters) {
                const unit = (target as UnitZoneState).unit;
                switch (filter.type) {
                    case 'EXCLUDE_SELF': if (target === context.unitZone) return false; break;
                    case 'HAS_TRAIT': if (!unit || !unit.traits?.includes(filter.value)) return false; break;
                    case 'COST_LIMIT': if (!unit || unit.cost > filter.value) return false; break;
                    case 'POWER_LIMIT': if (!unit || engine.getUnitPower(target, this.getOwner(engine, target)) > filter.value) return false; break;
                }
            }
        }

        // 4. Legacy Conditions Check
        if (schema.conditions) {
            const unit = (target as UnitZoneState).unit;
            if (schema.conditions.costMax !== undefined && (!unit || unit.cost > schema.conditions.costMax)) return false;
            if (schema.conditions.costMin !== undefined && (!unit || unit.cost < schema.conditions.costMin)) return false;
            if (schema.conditions.hasTrait && (!unit || !unit.traits?.includes(schema.conditions.hasTrait))) return false;
        }

        return true;
    }

    private static getOwner(engine: GameEngine, zone: UnitZoneState): PlayerState {
        if (engine.state.players[0].unitZones.includes(zone)) return engine.state.players[0];
        return engine.state.players[1];
    }
}
