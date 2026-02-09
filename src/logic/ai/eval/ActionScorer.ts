import { GameEngine } from '../../GameEngine';
import { EngineAction, PlayerState } from '../../types';

export interface ActionScoreResult {
    score: number;
    reason: string;
}

function getPlayerById(engine: GameEngine, playerId: string): PlayerState | null {
    return engine.state.players.find(player => player.id === playerId) ?? null;
}

function evaluateBlockDecision(engine: GameEngine): boolean {
    const attackerLane = engine.state.pendingAttackerIndex;
    if (attackerLane === null) return false;

    const attackerPlayer = engine.currentPlayer;
    const defenderPlayer = engine.opponentPlayer;
    const attackerZone = attackerPlayer.unitZones[attackerLane];
    const defenderZone = defenderPlayer.unitZones[attackerLane];
    if (!attackerZone.unit || !defenderZone.unit) return false;

    const attackerPower = engine.getUnitPower(attackerZone, attackerPlayer);
    const attackerHit = engine.getUnitHit(attackerZone, attackerPlayer);
    const defenderPower = engine.getUnitPower(defenderZone, defenderPlayer);
    const defenderWillLose = defenderPower <= attackerPower;

    // Tactical override: always block if direct hit would lose immediately.
    const directLethalIfUnblocked = defenderPlayer.damage.length + attackerHit >= 10;
    if (directLethalIfUnblocked) {
        return true;
    }

    if (defenderPower >= attackerPower) {
        return true;
    }

    if (attackerHit >= 2 && defenderPlayer.damage.length >= 8) {
        return true;
    }

    if (defenderWillLose && defenderPlayer.damage.length <= 5) {
        return false;
    }

    return false;
}

function scoreAttackAction(engine: GameEngine, actor: PlayerState, action: Extract<EngineAction, { type: 'ATTACK' }>): ActionScoreResult {
    const attackerZone = actor.unitZones[action.attackerZoneIndex];
    if (!attackerZone.unit) return { score: Number.NEGATIVE_INFINITY, reason: 'no-attacker' };

    const opponent = engine.state.players.find(player => player.id !== actor.id);
    if (!opponent) return { score: Number.NEGATIVE_INFINITY, reason: 'no-opponent' };

    const defenderZone = opponent.unitZones[action.attackerZoneIndex];
    const attackerPower = engine.getUnitPower(attackerZone, actor);
    const attackerHit = engine.getUnitHit(attackerZone, actor);
    const attackerCost = attackerZone.unit.cost;

    if (!defenderZone.unit) {
        const lethal = opponent.damage.length + attackerHit >= 10;
        const directDamageScore = attackerHit * 180 + attackerPower / 250 + attackerCost * 14 + 400;
        return {
            score: lethal ? directDamageScore + 20000 : directDamageScore,
            reason: lethal ? 'direct-lethal' : 'direct-pressure',
        };
    }

    const defenderPower = engine.getUnitPower(defenderZone, opponent);
    const defenderHit = engine.getUnitHit(defenderZone, opponent);
    const defenderCost = defenderZone.unit.cost;
    const attackerWinsTrade = attackerPower > defenderPower;
    const mutualDestruction = attackerPower === defenderPower;

    let score = 0;
    if (attackerWinsTrade) {
        score += 260 + defenderCost * 30 + defenderPower / 250;
    } else if (mutualDestruction) {
        score += 70 + (defenderCost - attackerCost) * 20;
    } else {
        score -= 120 + attackerCost * 20;
    }

    score += (attackerHit - defenderHit) * 25;
    return {
        score,
        reason: attackerWinsTrade ? 'favorable-trade' : (mutualDestruction ? 'even-trade' : 'unfavorable-trade'),
    };
}

function scorePlayUnitAction(engine: GameEngine, actor: PlayerState, action: Extract<EngineAction, { type: 'PLAY_UNIT' }>): ActionScoreResult {
    const card = actor.hand[action.handIndex];
    if (!card) return { score: Number.NEGATIVE_INFINITY, reason: 'no-card' };

    let score = card.cost * 40 + (card.power ?? 0) / 220 + (card.hit ?? 0) * 90 + 120;
    const opponent = engine.state.players.find(player => player.id !== actor.id);
    if (!opponent) return { score, reason: 'play-unit-base' };

    const opposingZone = opponent.unitZones[action.zoneIndex];
    if (opposingZone.unit) {
        const opposingPower = engine.getUnitPower(opposingZone, opponent);
        const cardPower = card.power ?? 0;
        if (cardPower >= opposingPower) score += 130;
    } else {
        score += 70;
    }

    return { score, reason: 'play-unit' };
}

function scorePlayItemAction(_engine: GameEngine, actor: PlayerState, action: Extract<EngineAction, { type: 'PLAY_ITEM' }>): ActionScoreResult {
    const card = actor.hand[action.handIndex];
    if (!card) return { score: Number.NEGATIVE_INFINITY, reason: 'no-item' };
    const ownZone = actor.unitZones[action.zoneIndex];
    const score = (ownZone.unit ? 160 : -300) + card.cost * 25;
    return { score, reason: ownZone.unit ? 'play-item-support' : 'item-no-host' };
}

function scorePlaySkillAction(actor: PlayerState, action: Extract<EngineAction, { type: 'PLAY_SKILL' }>): ActionScoreResult {
    const card = actor.hand[action.handIndex];
    if (!card) return { score: Number.NEGATIVE_INFINITY, reason: 'no-skill' };
    const score = 80 + card.cost * 18;
    return { score, reason: 'play-skill' };
}

function scoreActivateEffectAction(_engine: GameEngine, actor: PlayerState, action: Extract<EngineAction, { type: 'ACTIVATE_EFFECT' }>): ActionScoreResult {
    const zone = actor.unitZones[action.zoneIndex];
    if (!zone.unit) return { score: Number.NEGATIVE_INFINITY, reason: 'no-effect-source' };
    const score = 140 + zone.unit.cost * 22 - action.effectIndex;
    return { score, reason: 'activate-effect' };
}

export function scoreAction(engine: GameEngine, actorPlayerId: string, action: EngineAction): ActionScoreResult {
    const actor = getPlayerById(engine, actorPlayerId);
    if (!actor) return { score: Number.NEGATIVE_INFINITY, reason: 'no-actor' };

    switch (action.type) {
        case 'RESOLVE_BLOCK': {
            const shouldBlock = evaluateBlockDecision(engine);
            return {
                score: action.shouldBlock === shouldBlock ? 10000 : -10000,
                reason: shouldBlock ? 'block-recommended' : 'block-not-recommended',
            };
        }
        case 'ATTACK':
            return scoreAttackAction(engine, actor, action);
        case 'PLAY_UNIT':
            return scorePlayUnitAction(engine, actor, action);
        case 'PLAY_ITEM':
            return scorePlayItemAction(engine, actor, action);
        case 'PLAY_SKILL':
            return scorePlaySkillAction(actor, action);
        case 'ACTIVATE_EFFECT':
            return scoreActivateEffectAction(engine, actor, action);
        case 'NEXT_PHASE':
            return { score: -90, reason: 'next-phase' };
        default:
            return { score: -150, reason: 'fallback-action' };
    }
}
