import { Card, CardType, EngineAction, GameState, PlayerState, UnitZoneState } from '../../types';
import { scoreInteractionAction } from './InteractionValueModel';

export interface ObservedStateScoreBreakdown {
    total: number;
    damageRace: number;
    boardPresence: number;
    handAdvantage: number;
    directPressure: number;
    lethalSwing: number;
    resourceEconomy: number;
}

export interface ObservedActionScoreResult {
    score: number;
    reason: string;
}

export interface ObservationEvaluatorOptions {
    enableResourceEconomyModel: boolean;
    enableAntiOscillationPenalty: boolean;
}

function getPlayerById(state: GameState, playerId: string): PlayerState | null {
    return state.players.find(player => player.id === playerId) ?? null;
}

function computeBuffedStat(base: number, zone: UnitZoneState, statType: 'POWER' | 'HIT'): number {
    let value = base;
    for (const buff of zone.buffs) {
        if (buff.type !== statType) continue;
        const mode = buff.mode ?? 'ADD';
        if (mode === 'SET') {
            value = buff.value;
            continue;
        }
        value += buff.value;
    }
    return Math.max(0, value);
}

function getObservedZonePower(zone: UnitZoneState): number {
    if (!zone.unit) return 0;
    return computeBuffedStat(zone.unit.power ?? 0, zone, 'POWER');
}

function getObservedZoneHit(zone: UnitZoneState): number {
    if (!zone.unit) return 0;
    return computeBuffedStat(zone.unit.hit ?? 0, zone, 'HIT');
}

function getCardHeuristicValue(card: Card | undefined): number {
    if (!card) return Number.NEGATIVE_INFINITY;
    const power = card.power ?? 0;
    const hit = card.hit ?? 0;
    let value = card.cost * 120 + power / 210 + hit * 90;
    if (card.type === CardType.UNIT) value += 80;
    if (card.type === CardType.ITEM) value += 45;
    if (card.type === CardType.SKILL) value += 50;
    if (card.effects && card.effects.length > 0) value += card.effects.length * 12;
    return value;
}

function getZonePresenceValue(zone: UnitZoneState): number {
    if (!zone.unit) return 0;
    return zone.unit.cost * 10 + getObservedZonePower(zone) / 300 + getObservedZoneHit(zone) * 30 + zone.items.length * 12;
}

function estimateDirectPressure(attacker: PlayerState, defender: PlayerState): number {
    let pressure = 0;
    for (let laneIndex = 0; laneIndex < attacker.unitZones.length; laneIndex++) {
        const attackerZone = attacker.unitZones[laneIndex];
        if (!attackerZone.unit) continue;
        if (defender.unitZones[laneIndex].unit) continue;
        pressure += getObservedZoneHit(attackerZone) * 35;
    }
    return pressure;
}

function estimatePotentialLethalDamage(attacker: PlayerState, defender: PlayerState): number {
    return defender.damage.length
        + attacker.unitZones.reduce((sum, zone, laneIndex) => {
            if (!zone.unit) return sum;
            if (defender.unitZones[laneIndex].unit) return sum;
            return sum + getObservedZoneHit(zone);
        }, 0);
}

function estimateLanePressureFromStats(
    power: number,
    hit: number,
    defender: PlayerState,
    defenderZone: UnitZoneState,
): number {
    if (!defenderZone.unit) {
        let score = hit * 170;
        if (defender.damage.length + hit >= 10) {
            score += 2200;
        }
        return score;
    }

    const defenderPower = getObservedZonePower(defenderZone);
    return power > defenderPower ? 120 : 20;
}

function estimateLanePressureForCard(
    card: Card,
    defender: PlayerState,
    defenderZone: UnitZoneState,
): number {
    const power = Math.max(0, card.power ?? 0);
    const hit = Math.max(0, card.hit ?? 0);
    if (!defenderZone.unit) {
        let score = hit * 170;
        if (defender.damage.length + hit >= 10) {
            score += 2200;
        }
        return score;
    }

    const defenderPower = getObservedZonePower(defenderZone);
    return power > defenderPower ? 120 : 20;
}

function hasGuardianAbility(zone: UnitZoneState): boolean {
    const hasGuardianText = (card: Card | undefined): boolean => {
        if (!card?.text) return false;
        const normalized = card.text.replace(/&nbsp;/g, ' ').replace(/\s+/g, '');
        return normalized.includes('가디언') || normalized.includes('GUARDIAN');
    };

    if (hasGuardianText(zone.unit ?? undefined)) return true;
    return zone.items.some(item => hasGuardianText(item));
}

export function evaluateObservedState(
    state: GameState,
    actorPlayerId: string,
    options: ObservationEvaluatorOptions,
): ObservedStateScoreBreakdown {
    const actor = getPlayerById(state, actorPlayerId);
    if (!actor) {
        return {
            total: Number.NEGATIVE_INFINITY,
            damageRace: Number.NEGATIVE_INFINITY,
            boardPresence: Number.NEGATIVE_INFINITY,
            handAdvantage: Number.NEGATIVE_INFINITY,
            directPressure: Number.NEGATIVE_INFINITY,
            lethalSwing: Number.NEGATIVE_INFINITY,
            resourceEconomy: Number.NEGATIVE_INFINITY,
        };
    }
    const opponent = state.players.find(player => player.id !== actor.id);
    if (!opponent) {
        return {
            total: Number.NEGATIVE_INFINITY,
            damageRace: Number.NEGATIVE_INFINITY,
            boardPresence: Number.NEGATIVE_INFINITY,
            handAdvantage: Number.NEGATIVE_INFINITY,
            directPressure: Number.NEGATIVE_INFINITY,
            lethalSwing: Number.NEGATIVE_INFINITY,
            resourceEconomy: Number.NEGATIVE_INFINITY,
        };
    }

    const damageRace = (opponent.damage.length - actor.damage.length) * 130;
    const boardPresence = actor.unitZones.reduce((sum, zone) => sum + getZonePresenceValue(zone), 0)
        - opponent.unitZones.reduce((sum, zone) => sum + getZonePresenceValue(zone), 0);
    const handAdvantage = (actor.hand.length - opponent.hand.length) * 14;
    const directPressure = estimateDirectPressure(actor, opponent) - estimateDirectPressure(opponent, actor);

    const myPotentialLethal = estimatePotentialLethalDamage(actor, opponent);
    const oppPotentialLethal = estimatePotentialLethalDamage(opponent, actor);
    let lethalSwing = 0;
    if (myPotentialLethal >= 10) lethalSwing += 550;
    if (oppPotentialLethal >= 10) lethalSwing -= 550;

    const resourceEconomy = options.enableResourceEconomyModel
        ? ((actor.unitZones.filter(zone => !!zone.unit).length + actor.hand.length)
            - (opponent.unitZones.filter(zone => !!zone.unit).length + opponent.hand.length)) * 24
        : 0;

    const total = damageRace + boardPresence + handAdvantage + directPressure + lethalSwing + resourceEconomy;
    return {
        total,
        damageRace,
        boardPresence,
        handAdvantage,
        directPressure,
        lethalSwing,
        resourceEconomy,
    };
}

function scoreAttackAction(
    state: GameState,
    actor: PlayerState,
    action: Extract<EngineAction, { type: 'ATTACK' }>,
): ObservedActionScoreResult {
    const opponent = state.players.find(player => player.id !== actor.id);
    if (!opponent) return { score: Number.NEGATIVE_INFINITY, reason: 'no-opponent' };

    const attackerZone = actor.unitZones[action.attackerZoneIndex];
    if (!attackerZone?.unit) return { score: Number.NEGATIVE_INFINITY, reason: 'no-attacker' };

    const defenderZone = opponent.unitZones[action.attackerZoneIndex];
    const attackerPower = getObservedZonePower(attackerZone);
    const attackerHit = getObservedZoneHit(attackerZone);
    const attackerCost = attackerZone.unit.cost;

    if (!defenderZone.unit) {
        const lethal = opponent.damage.length + attackerHit >= 10;
        const base = attackerHit * 180 + attackerPower / 250 + attackerCost * 14 + 420;
        return { score: lethal ? base + 20000 : base, reason: lethal ? 'direct-lethal' : 'direct-pressure' };
    }

    const defenderPower = getObservedZonePower(defenderZone);
    const defenderHit = getObservedZoneHit(defenderZone);
    const defenderCost = defenderZone.unit.cost;
    const attackerWinsTrade = attackerPower > defenderPower;

    let score = 0;
    if (attackerWinsTrade) {
        score += 260 + defenderCost * 30 + defenderPower / 250;
    } else if (attackerPower === defenderPower) {
        score += 70 + (defenderCost - attackerCost) * 20;
    } else {
        score -= 120 + attackerCost * 20;
    }
    score += (attackerHit - defenderHit) * 25;
    return { score, reason: attackerWinsTrade ? 'favorable-trade' : 'attack-trade' };
}

function scorePlayUnitAction(
    state: GameState,
    actor: PlayerState,
    action: Extract<EngineAction, { type: 'PLAY_UNIT' }>,
    options: ObservationEvaluatorOptions,
): ObservedActionScoreResult {
    const card = actor.hand[action.handIndex];
    if (!card) return { score: Number.NEGATIVE_INFINITY, reason: 'no-card' };

    const opponent = state.players.find(player => player.id !== actor.id);
    const ownZone = actor.unitZones[action.zoneIndex];
    const isUpgrade = !!ownZone.unit;
    let score = card.cost * 40 + (card.power ?? 0) / 220 + (card.hit ?? 0) * 90 + 120;

    if (isUpgrade && options.enableResourceEconomyModel) {
        const oldValue = getCardHeuristicValue(ownZone.unit ?? undefined);
        const newValue = getCardHeuristicValue(card);
        score += newValue >= oldValue ? 45 : -190;

        const basePowerDelta = (card.power ?? 0) - (ownZone.unit?.power ?? 0);
        const baseHitDelta = (card.hit ?? 0) - (ownZone.unit?.hit ?? 0);
        if (basePowerDelta <= 0 && baseHitDelta <= 0) {
            score -= 90;
        }
    }

    if (!opponent) return { score, reason: 'play-unit' };

    const opposingZone = opponent.unitZones[action.zoneIndex];
    const currentLanePressure = isUpgrade
        ? estimateLanePressureFromStats(
            getObservedZonePower(ownZone),
            getObservedZoneHit(ownZone),
            opponent,
            opposingZone,
        )
        : 0;
    const nextLanePressure = estimateLanePressureForCard(card, opponent, opposingZone);
    const lanePressureDelta = nextLanePressure - currentLanePressure;

    score += lanePressureDelta * 0.32;
    if (isUpgrade && lanePressureDelta <= 0) {
        score -= options.enableResourceEconomyModel ? 210 : 140;
    }
    if (isUpgrade && !opposingZone.unit && lanePressureDelta < 120) {
        score -= 170;
    }

    if (opposingZone.unit) {
        const opposingPower = getObservedZonePower(opposingZone);
        if ((card.power ?? 0) >= opposingPower) score += 130;
    } else {
        score += isUpgrade ? 40 : 95;
    }

    return { score, reason: 'play-unit' };
}

function scoreResolveBlockAction(
    state: GameState,
    actor: PlayerState,
    action: Extract<EngineAction, { type: 'RESOLVE_BLOCK' }>,
): ObservedActionScoreResult {
    const attackerIndex = state.pendingAttackerIndex;
    const opponent = state.players.find(player => player.id !== actor.id);
    if (attackerIndex === null || !opponent) return { score: action.shouldBlock ? -40 : 20, reason: 'block-default' };

    const attackerZone = opponent.unitZones[attackerIndex];
    if (!attackerZone.unit) {
        return { score: action.shouldBlock ? -20 : 60, reason: 'block-empty-lane' };
    }

    const defenderCandidates: UnitZoneState[] = [];
    const encounterZone = actor.unitZones[attackerIndex];
    if (encounterZone?.unit) defenderCandidates.push(encounterZone);
    [attackerIndex - 1, attackerIndex + 1]
        .filter(index => index >= 0 && index < actor.unitZones.length)
        .forEach(index => {
            const zone = actor.unitZones[index];
            if (!zone?.unit) return;
            if (hasGuardianAbility(zone)) defenderCandidates.push(zone);
        });
    if (defenderCandidates.length === 0) {
        return { score: action.shouldBlock ? -20 : 60, reason: 'block-empty-lane' };
    }

    const attackerPower = getObservedZonePower(attackerZone);
    const attackerHit = getObservedZoneHit(attackerZone);
    const defenderPower = defenderCandidates.reduce((maxPower, zone) => Math.max(maxPower, getObservedZonePower(zone)), Number.NEGATIVE_INFINITY);
    const directLethalIfUnblocked = actor.damage.length + attackerHit >= 10;
    const shouldBlock = directLethalIfUnblocked || defenderPower >= attackerPower;

    return {
        score: action.shouldBlock === shouldBlock ? 10000 : -10000,
        reason: shouldBlock ? 'block-recommended' : 'block-skip',
    };
}

export function scoreObservedAction(
    state: GameState,
    actorPlayerId: string,
    action: EngineAction,
    options: ObservationEvaluatorOptions,
    repeatCount: number = 0,
): ObservedActionScoreResult {
    const actor = getPlayerById(state, actorPlayerId);
    if (!actor) return { score: Number.NEGATIVE_INFINITY, reason: 'no-actor' };

    switch (action.type) {
        case 'ATTACK':
            return scoreAttackAction(state, actor, action);
        case 'PLAY_UNIT':
            return scorePlayUnitAction(state, actor, action, options);
        case 'PLAY_ITEM': {
            const card = actor.hand[action.handIndex];
            if (!card) return { score: Number.NEGATIVE_INFINITY, reason: 'no-item' };
            const ownZone = actor.unitZones[action.zoneIndex];
            return { score: (ownZone.unit ? 170 : -300) + card.cost * 25, reason: 'play-item' };
        }
        case 'PLAY_SKILL': {
            const card = actor.hand[action.handIndex];
            if (!card) return { score: Number.NEGATIVE_INFINITY, reason: 'no-skill' };
            return { score: 90 + card.cost * 18, reason: 'play-skill' };
        }
        case 'ACTIVATE_EFFECT': {
            const ownZone = actor.unitZones[action.zoneIndex];
            if (!ownZone.unit) return { score: Number.NEGATIVE_INFINITY, reason: 'no-effect-source' };
            return { score: 140 + ownZone.unit.cost * 22 - action.effectIndex, reason: 'activate-effect' };
        }
        case 'RESOLVE_BLOCK':
            return scoreResolveBlockAction(state, actor, action);
        case 'SELECT_COST_HAND':
        case 'RESOLVE_OPTIONAL':
        case 'SELECT_HAND_TARGET':
        case 'SELECT_ZONE_TARGET':
        case 'SELECT_TRASH_TARGET':
        case 'SELECT_REVEALED_TARGET':
        case 'CONFIRM_TARGETS':
            return scoreInteractionAction(
                state,
                actorPlayerId,
                action,
                { enableAntiOscillationPenalty: options.enableAntiOscillationPenalty },
                repeatCount,
            );
        case 'RESOLVE_MULLIGAN':
            return { score: action.shouldMulligan ? -50 : 50, reason: action.shouldMulligan ? 'mulligan-yes' : 'mulligan-no' };
        case 'NEXT_PHASE':
            return { score: -90, reason: 'next-phase' };
        default:
            return { score: -150, reason: 'fallback-action' };
    }
}
