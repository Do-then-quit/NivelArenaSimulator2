import { GameEngine } from '../../GameEngine';
import { Card, EngineAction, PlayerState } from '../../types';

export interface ActionScoreResult {
    score: number;
    reason: string;
}

function getPlayerById(engine: GameEngine, playerId: string): PlayerState | null {
    return engine.state.players.find(player => player.id === playerId) ?? null;
}

const OFFENSIVE_TARGET_ACTIONS = new Set([
    'DESTROY_UNIT',
    'DESTROY_ENCOUNTER',
    'DESTROY_UNIT_AND_DRAW',
    'DESTROY_UNIT_AND_DRAW_BY_HIT',
    'DESTROY_UNIT_WITH_HIT_COST',
    'DESTROY_LANE_LOWEST',
]);

const SUPPORTIVE_TARGET_ACTIONS = new Set([
    'GRANT_EFFECT',
    'SET_POWER',
    'BUFF_POWER_AND_DRAW_IF_TRASHED',
]);

function getCardTacticalValue(card: Card | undefined): number {
    if (!card) return Number.NEGATIVE_INFINITY;
    return card.cost * 130 + (card.power ?? 0) / 220 + (card.hit ?? 0) * 90;
}

function getZoneTacticalValue(engine: GameEngine, targetPlayer: PlayerState, zoneIndex: number): number {
    const zone = targetPlayer.unitZones[zoneIndex];
    if (!zone?.unit) return Number.NEGATIVE_INFINITY;
    return zone.unit.cost * 150
        + engine.getUnitPower(zone, targetPlayer) / 220
        + engine.getUnitHit(zone, targetPlayer) * 130
        + zone.items.length * 18;
}

function resolveZoneTargetBias(actionType: string | undefined, pendingValue: unknown): 'offense' | 'support' | 'neutral' {
    if (!actionType) return 'neutral';
    if (OFFENSIVE_TARGET_ACTIONS.has(actionType)) return 'offense';
    if (SUPPORTIVE_TARGET_ACTIONS.has(actionType)) return 'support';
    if ((actionType === 'BUFF_POWER' || actionType === 'BUFF_HIT') && typeof pendingValue === 'number') {
        return pendingValue < 0 ? 'offense' : 'support';
    }
    return 'neutral';
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

function scoreSelectCostHandAction(actor: PlayerState, action: Extract<EngineAction, { type: 'SELECT_COST_HAND' }>): ActionScoreResult {
    const card = actor.hand[action.handIndex];
    if (!card) return { score: Number.NEGATIVE_INFINITY, reason: 'no-cost-card' };
    const score = 260 - card.cost * 55 - (card.power ?? 0) / 280 - (card.hit ?? 0) * 40;
    return { score, reason: 'select-cost-hand' };
}

function scoreResolveOptionalAction(action: Extract<EngineAction, { type: 'RESOLVE_OPTIONAL' }>): ActionScoreResult {
    return {
        score: action.confirm ? 90 : -70,
        reason: action.confirm ? 'resolve-optional-confirm' : 'resolve-optional-skip',
    };
}

function scoreSelectHandTargetAction(
    engine: GameEngine,
    actor: PlayerState,
    action: Extract<EngineAction, { type: 'SELECT_HAND_TARGET' }>,
): ActionScoreResult {
    const targetPlayer = engine.state.players.find(player => player.id === action.targetPlayerId);
    const card = targetPlayer?.hand[action.handIndex];
    if (!targetPlayer || !card) return { score: Number.NEGATIVE_INFINITY, reason: 'no-hand-target' };

    const tactical = getCardTacticalValue(card);
    const isOwnHand = targetPlayer.id === actor.id;
    return {
        score: isOwnHand ? -tactical : tactical,
        reason: isOwnHand ? 'select-own-hand-target' : 'select-opp-hand-target',
    };
}

function scoreSelectZoneTargetAction(
    engine: GameEngine,
    actor: PlayerState,
    action: Extract<EngineAction, { type: 'SELECT_ZONE_TARGET' }>,
): ActionScoreResult {
    const pending = engine.state.pendingEffect;
    const targetPlayer = engine.state.players.find(player => player.id === action.targetPlayerId);
    if (!targetPlayer) return { score: Number.NEGATIVE_INFINITY, reason: 'no-zone-target-player' };

    const targetZone = targetPlayer.unitZones[action.zoneIndex];
    if (!targetZone) return { score: Number.NEGATIVE_INFINITY, reason: 'no-zone-target' };

    const selectedTargets = pending?.selectedTargets ?? [];
    const alreadySelected = selectedTargets.includes(targetZone);
    if (alreadySelected) {
        return { score: -180, reason: 'zone-target-unselect' };
    }

    const zoneValue = getZoneTacticalValue(engine, targetPlayer, action.zoneIndex);
    if (zoneValue === Number.NEGATIVE_INFINITY) {
        return { score: Number.NEGATIVE_INFINITY, reason: 'zone-target-empty' };
    }

    if (pending?.actionType === 'SACRIFICE_TO_BUFF') {
        const selectedCount = selectedTargets.length;
        if (targetPlayer.id !== actor.id) return { score: -260, reason: 'sacrifice-to-buff-invalid-owner' };
        return selectedCount === 0
            ? { score: -zoneValue + 160, reason: 'sacrifice-low-first' }
            : { score: zoneValue + 160, reason: 'buff-high-second' };
    }

    const targetBias = resolveZoneTargetBias(pending?.actionType, pending?.actionValue?.value);
    const isOwnZone = targetPlayer.id === actor.id;
    if (targetBias === 'offense') {
        return {
            score: isOwnZone ? -zoneValue : zoneValue,
            reason: isOwnZone ? 'offense-own-zone-penalty' : 'offense-opp-zone',
        };
    }
    if (targetBias === 'support') {
        return {
            score: isOwnZone ? zoneValue : -zoneValue,
            reason: isOwnZone ? 'support-own-zone' : 'support-opp-zone-penalty',
        };
    }

    return { score: zoneValue, reason: 'neutral-zone-target' };
}

function scoreSelectTrashTargetAction(
    engine: GameEngine,
    action: Extract<EngineAction, { type: 'SELECT_TRASH_TARGET' }>,
): ActionScoreResult {
    const targetPlayer = engine.state.players.find(player => player.id === action.targetPlayerId);
    const card = targetPlayer?.trash[action.trashIndex];
    if (!targetPlayer || !card) return { score: Number.NEGATIVE_INFINITY, reason: 'no-trash-target' };

    const tactical = getCardTacticalValue(card);
    const actionType = engine.state.pendingEffect?.actionType;
    return {
        score: actionType === 'TRASH_SELF' ? -tactical : tactical,
        reason: actionType === 'TRASH_SELF' ? 'select-trash-self-low' : 'select-trash-target',
    };
}

function scoreSelectRevealedTargetAction(
    engine: GameEngine,
    action: Extract<EngineAction, { type: 'SELECT_REVEALED_TARGET' }>,
): ActionScoreResult {
    const card = engine.state.revealedCards[action.revealedIndex];
    if (!card) return { score: Number.NEGATIVE_INFINITY, reason: 'no-revealed-target' };

    const tactical = getCardTacticalValue(card);
    const actionType = engine.state.pendingEffect?.actionType;
    const preferLow = actionType === 'DISCARD_FROM_DRAWN';
    return {
        score: preferLow ? -tactical : tactical,
        reason: preferLow ? 'revealed-prefer-low' : 'revealed-prefer-high',
    };
}

function scoreConfirmTargetsAction(engine: GameEngine): ActionScoreResult {
    const pending = engine.state.pendingEffect;
    const targetSchema = pending?.targetSchema;
    if (!pending || !targetSchema) return { score: 20, reason: 'confirm-no-pending' };

    if (targetSchema.selectMode === 'ALL' || pending.actionType === 'TAKE_ALL_REVEALED') {
        return { score: 120, reason: 'confirm-all-targets' };
    }

    const requiredCount = targetSchema.count ?? 1;
    if (requiredCount <= 0) return { score: 120, reason: 'confirm-unbounded-targets' };

    const selectedCount = pending.selectedTargets?.length ?? 0;
    if (selectedCount >= requiredCount) {
        return { score: 180, reason: 'confirm-targets-ready' };
    }

    return { score: -260, reason: 'confirm-targets-insufficient' };
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
        case 'SELECT_COST_HAND':
            return scoreSelectCostHandAction(actor, action);
        case 'RESOLVE_OPTIONAL':
            return scoreResolveOptionalAction(action);
        case 'SELECT_HAND_TARGET':
            return scoreSelectHandTargetAction(engine, actor, action);
        case 'SELECT_ZONE_TARGET':
            return scoreSelectZoneTargetAction(engine, actor, action);
        case 'SELECT_TRASH_TARGET':
            return scoreSelectTrashTargetAction(engine, action);
        case 'SELECT_REVEALED_TARGET':
            return scoreSelectRevealedTargetAction(engine, action);
        case 'CONFIRM_TARGETS':
            return scoreConfirmTargetsAction(engine);
        case 'NEXT_PHASE':
            return { score: -90, reason: 'next-phase' };
        default:
            return { score: -150, reason: 'fallback-action' };
    }
}
