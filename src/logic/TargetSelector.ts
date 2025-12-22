import { GameEngine } from './GameEngine';
import { TargetSchema, GameContext, UnitZoneState, PlayerState } from './types';

export class TargetSelector {
    static resolve(engine: GameEngine, schema: TargetSchema, context: GameContext): any[] {
        const { player, opponent } = context;
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
                candidates = [...opponent.unitZones];
                break;
            case 'BOTH_FIELDS':
                candidates = [...player.unitZones, ...opponent.unitZones];
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
                        candidates = candidates.filter(c => c !== context.unitZone);
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

        // 4. Selection Mode
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

    private static getOwner(engine: GameEngine, zone: UnitZoneState): PlayerState {
        if (engine.state.players[0].unitZones.includes(zone)) return engine.state.players[0];
        return engine.state.players[1];
    }
}
