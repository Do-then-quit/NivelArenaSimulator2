import { GameEngine } from '../../GameEngine';
import { PlayerState, UnitZoneState } from '../../types';

export interface StateScoreBreakdown {
    total: number;
    damageRace: number;
    boardPresence: number;
    handAdvantage: number;
    directPressure: number;
    lethalSwing: number;
}

function getPlayerById(engine: GameEngine, playerId: string): PlayerState | null {
    return engine.state.players.find(player => player.id === playerId) ?? null;
}

function getZoneCombatValue(engine: GameEngine, owner: PlayerState, zone: UnitZoneState): number {
    if (!zone.unit) return 0;
    const power = engine.getUnitPower(zone, owner);
    const hit = engine.getUnitHit(zone, owner);
    return zone.unit.cost * 10 + power / 300 + hit * 30 + zone.items.length * 12;
}

function estimateDirectPressure(engine: GameEngine, attacker: PlayerState, defender: PlayerState): number {
    let pressure = 0;
    for (let laneIndex = 0; laneIndex < attacker.unitZones.length; laneIndex++) {
        const attackingZone = attacker.unitZones[laneIndex];
        if (!attackingZone.unit) continue;
        const defendingZone = defender.unitZones[laneIndex];
        if (defendingZone.unit) continue;
        pressure += engine.getUnitHit(attackingZone, attacker) * 35;
    }
    return pressure;
}

export function evaluateState(engine: GameEngine, actorPlayerId: string): StateScoreBreakdown {
    const actor = getPlayerById(engine, actorPlayerId);
    if (!actor) {
        return {
            total: Number.NEGATIVE_INFINITY,
            damageRace: Number.NEGATIVE_INFINITY,
            boardPresence: Number.NEGATIVE_INFINITY,
            handAdvantage: Number.NEGATIVE_INFINITY,
            directPressure: Number.NEGATIVE_INFINITY,
            lethalSwing: Number.NEGATIVE_INFINITY,
        };
    }
    const opponent = engine.state.players.find(player => player.id !== actor.id);
    if (!opponent) {
        return {
            total: Number.NEGATIVE_INFINITY,
            damageRace: Number.NEGATIVE_INFINITY,
            boardPresence: Number.NEGATIVE_INFINITY,
            handAdvantage: Number.NEGATIVE_INFINITY,
            directPressure: Number.NEGATIVE_INFINITY,
            lethalSwing: Number.NEGATIVE_INFINITY,
        };
    }

    const damageRace = (opponent.damage.length - actor.damage.length) * 130;
    const boardPresence = actor.unitZones.reduce((sum, zone) => sum + getZoneCombatValue(engine, actor, zone), 0)
        - opponent.unitZones.reduce((sum, zone) => sum + getZoneCombatValue(engine, opponent, zone), 0);
    const handAdvantage = (actor.hand.length - opponent.hand.length) * 14;
    const directPressure = estimateDirectPressure(engine, actor, opponent) - estimateDirectPressure(engine, opponent, actor);

    const myPotentialLethal = opponent.damage.length
        + actor.unitZones.reduce((sum, zone, laneIndex) => {
            if (!zone.unit) return sum;
            if (opponent.unitZones[laneIndex].unit) return sum;
            return sum + engine.getUnitHit(zone, actor);
        }, 0);
    const oppPotentialLethal = actor.damage.length
        + opponent.unitZones.reduce((sum, zone, laneIndex) => {
            if (!zone.unit) return sum;
            if (actor.unitZones[laneIndex].unit) return sum;
            return sum + engine.getUnitHit(zone, opponent);
        }, 0);

    let lethalSwing = 0;
    if (myPotentialLethal >= 10) lethalSwing += 550;
    if (oppPotentialLethal >= 10) lethalSwing -= 550;

    const total = damageRace + boardPresence + handAdvantage + directPressure + lethalSwing;
    return {
        total,
        damageRace,
        boardPresence,
        handAdvantage,
        directPressure,
        lethalSwing,
    };
}

