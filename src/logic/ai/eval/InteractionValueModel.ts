import { Card, CardType, EngineAction, GameState, PendingEffect, PlayerState, UnitZoneState } from '../../types';

export interface InteractionValueModelOptions {
    enableAntiOscillationPenalty: boolean;
}

export interface InteractionValueResult {
    score: number;
    reason: string;
}

const TOGGLE_UNSELECT_HEAVY_PENALTY = -50000;

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

const OPTIONAL_POSITIVE_ACTIONS = new Set([
    'DRAW',
    'GAIN_LEVEL',
    'MOVE_FROM_TRASH_TO_HAND',
    'PICK_REVEALED',
    'TAKE_ALL_REVEALED',
    'DESTROY_UNIT',
    'DESTROY_ENCOUNTER',
    'DESTROY_UNIT_AND_DRAW',
    'DESTROY_UNIT_AND_DRAW_BY_HIT',
    'DAMAGE',
]);

const OPTIONAL_NEGATIVE_ACTIONS = new Set([
    'TRASH_SELF',
    'DISCARD_ALL',
]);

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

function getZonePower(zone: UnitZoneState): number {
    if (!zone.unit) return 0;
    return computeBuffedStat(zone.unit.power ?? 0, zone, 'POWER');
}

function getZoneHit(zone: UnitZoneState): number {
    if (!zone.unit) return 0;
    return computeBuffedStat(zone.unit.hit ?? 0, zone, 'HIT');
}

function getCardValue(card: Card | undefined): number {
    if (!card) return Number.NEGATIVE_INFINITY;
    const power = card.power ?? 0;
    const hit = card.hit ?? 0;
    let value = card.cost * 120 + power / 200 + hit * 95;
    if (card.type === CardType.UNIT) value += 80;
    if (card.type === CardType.ITEM) value += 35;
    if (card.type === CardType.SKILL) value += 45;
    if (card.effects && card.effects.length > 0) value += card.effects.length * 14;
    return value;
}

function getZoneValue(zone: UnitZoneState): number {
    if (!zone.unit) return Number.NEGATIVE_INFINITY;
    return zone.unit.cost * 150 + getZonePower(zone) / 220 + getZoneHit(zone) * 130 + zone.items.length * 18;
}

function getImmediatePlayableBudget(player: PlayerState): number {
    const size = player.leaderLevel + player.damage.length;
    const fieldCost = player.unitZones.reduce((sum, zone) => {
        if (!zone.unit) return sum;
        const itemCost = zone.items.reduce((itemSum, item) => itemSum + item.cost, 0);
        return sum + zone.unit.cost + itemCost;
    }, 0);
    return Math.max(0, size - fieldCost);
}

function laneThreatToActor(
    actor: PlayerState,
    targetPlayer: PlayerState,
    zoneIndex: number,
): number {
    const zone = targetPlayer.unitZones[zoneIndex];
    if (!zone?.unit) return 0;
    if (actor.unitZones[zoneIndex]?.unit) return 0;

    const hit = getZoneHit(zone);
    let score = hit * 220;
    if (actor.damage.length + hit >= 10) score += 3200;
    return score;
}

function lanePressureForActor(
    actor: PlayerState,
    opponent: PlayerState,
    zoneIndex: number,
): number {
    const ownZone = actor.unitZones[zoneIndex];
    if (!ownZone?.unit) return 0;
    const ownHit = getZoneHit(ownZone);
    const ownPower = getZonePower(ownZone);
    const oppZone = opponent.unitZones[zoneIndex];

    if (!oppZone?.unit) {
        let score = ownHit * 170;
        if (opponent.damage.length + ownHit >= 10) score += 2200;
        return score;
    }

    const oppPower = getZonePower(oppZone);
    return ownPower > oppPower ? 120 : 20;
}

function extractPendingNumericValue(pending: PendingEffect | null): number | null {
    if (!pending || typeof pending.actionValue !== 'object' || pending.actionValue === null) return null;
    const value = pending.actionValue as Record<string, unknown>;
    if (typeof value.value === 'number') return value.value;
    if (typeof value.powerValue === 'number') return value.powerValue;
    return null;
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

function withAntiOscillationPenalty(
    baseScore: number,
    options: InteractionValueModelOptions,
    repeatCount: number,
): number {
    if (!options.enableAntiOscillationPenalty) return baseScore;
    if (repeatCount <= 0) return baseScore;
    return baseScore - repeatCount * 150;
}

function isOverTargetCap(
    pending: PendingEffect | null,
    candidate: unknown,
): boolean {
    if (!pending) return false;
    const targetSchema = pending.targetSchema;
    if (!targetSchema) return false;
    const requiredCount = targetSchema.count ?? 1;
    if (requiredCount <= 0) return false;
    const selected = pending.selectedTargets ?? [];
    if (selected.length < requiredCount) return false;
    return !selected.includes(candidate);
}

function isAlreadySelected(pending: PendingEffect | null, candidate: unknown): boolean {
    return (pending?.selectedTargets ?? []).includes(candidate);
}

function scoreOptionalAction(
    state: GameState,
    actor: PlayerState,
    action: Extract<EngineAction, { type: 'RESOLVE_OPTIONAL' }>,
): InteractionValueResult {
    const pending = state.pendingEffect;
    if (!pending) return { score: action.confirm ? 20 : 0, reason: 'optional-no-pending' };
    const actionType = pending.actionType;

    let confirmBias = 40;
    if (OPTIONAL_POSITIVE_ACTIONS.has(actionType)) confirmBias += 140;
    if (OPTIONAL_NEGATIVE_ACTIONS.has(actionType)) confirmBias -= 320;

    const pendingValue = extractPendingNumericValue(pending);
    if ((actionType === 'BUFF_POWER' || actionType === 'BUFF_HIT') && typeof pendingValue === 'number') {
        confirmBias += pendingValue >= 0 ? 140 : -260;
    }

    if (actionType === 'DRAW') {
        if (actor.hand.length >= 7) confirmBias -= 90;
        if (actor.deck.length === 0) confirmBias -= 500;
    }

    if (actionType === 'DISCARD') {
        const target = pending.actionValue?.target as string | undefined;
        if (target === 'SELF') confirmBias -= 220;
        if (target === 'OPPONENT') confirmBias += 90;
    }

    if (actionType === 'MOVE_FROM_TRASH_TO_HAND') {
        confirmBias += actor.trash.length > 0 ? 120 : -120;
    }

    if (actionType === 'DAMAGE') {
        const opponent = state.players.find(player => player.id !== actor.id);
        const damageValue = typeof pending.actionValue?.value === 'number' ? pending.actionValue.value : 0;
        if (opponent && opponent.damage.length + damageValue >= 10) confirmBias += 600;
    }

    const score = action.confirm ? confirmBias : -confirmBias * 0.82;
    return {
        score,
        reason: action.confirm ? 'optional-confirm' : 'optional-skip',
    };
}

function scoreSelectCostAction(
    actor: PlayerState,
    action: Extract<EngineAction, { type: 'SELECT_COST_HAND' }>,
): InteractionValueResult {
    const card = actor.hand[action.handIndex];
    if (!card) return { score: Number.NEGATIVE_INFINITY, reason: 'no-cost-card' };

    const preserveValue = getCardValue(card);
    let score = 330 - preserveValue * 0.82;
    if (actor.hand.length <= 2) score -= 100;
    if (card.type === CardType.UNIT && actor.unitZones.every(zone => !zone.unit)) score -= 80;
    return { score, reason: 'select-cost-hand' };
}

function scoreSelectHandTargetAction(
    state: GameState,
    actor: PlayerState,
    action: Extract<EngineAction, { type: 'SELECT_HAND_TARGET' }>,
): InteractionValueResult {
    const pending = state.pendingEffect;
    const targetPlayer = getPlayerById(state, action.targetPlayerId);
    const card = targetPlayer?.hand[action.handIndex];
    if (!targetPlayer || !card) return { score: Number.NEGATIVE_INFINITY, reason: 'no-hand-target' };
    if (isOverTargetCap(pending, card)) return { score: -1800, reason: 'hand-target-over-cap' };
    if (isAlreadySelected(pending, card)) return { score: TOGGLE_UNSELECT_HEAVY_PENALTY, reason: 'hand-target-unselect' };

    const tactical = getCardValue(card);
    const isOwnHand = targetPlayer.id === actor.id;
    if (pending?.actionType === 'DISCARD') {
        return {
            score: isOwnHand ? -tactical - 80 : tactical + 80,
            reason: isOwnHand ? 'discard-own-low' : 'discard-opp-high',
        };
    }
    return {
        score: isOwnHand ? -tactical : tactical + 40,
        reason: isOwnHand ? 'select-own-hand-target' : 'select-opp-hand-target',
    };
}

function scoreSelectZoneTargetAction(
    state: GameState,
    actor: PlayerState,
    action: Extract<EngineAction, { type: 'SELECT_ZONE_TARGET' }>,
): InteractionValueResult {
    const pending = state.pendingEffect;
    const targetPlayer = getPlayerById(state, action.targetPlayerId);
    if (!targetPlayer) return { score: Number.NEGATIVE_INFINITY, reason: 'no-zone-target-player' };
    const opponent = state.players.find(player => player.id !== actor.id) ?? null;
    const targetZone = targetPlayer.unitZones[action.zoneIndex];
    if (!targetZone?.unit) return { score: Number.NEGATIVE_INFINITY, reason: 'zone-target-empty' };
    if (isOverTargetCap(pending, targetZone)) return { score: -2000, reason: 'zone-target-over-cap' };
    if (isAlreadySelected(pending, targetZone)) return { score: TOGGLE_UNSELECT_HEAVY_PENALTY, reason: 'zone-target-unselect' };

    const zoneValue = getZoneValue(targetZone);
    if (pending?.actionType === 'SACRIFICE_TO_BUFF') {
        if (targetPlayer.id !== actor.id) return { score: -260, reason: 'sacrifice-owner-mismatch' };
        const selectedCount = pending.selectedTargets?.length ?? 0;
        const lanePressureBonus = opponent ? lanePressureForActor(actor, opponent, action.zoneIndex) : 0;
        return selectedCount === 0
            ? { score: -zoneValue + 220, reason: 'sacrifice-low-first' }
            : { score: zoneValue + lanePressureBonus + 180, reason: 'buff-high-second' };
    }

    const targetBias = resolveZoneTargetBias(pending?.actionType, extractPendingNumericValue(pending ?? null));
    const isOwnZone = targetPlayer.id === actor.id;
    if (targetBias === 'offense') {
        const lethalDefenseBonus = !isOwnZone ? laneThreatToActor(actor, targetPlayer, action.zoneIndex) : 0;
        return {
            score: isOwnZone ? -zoneValue - 180 : zoneValue + lethalDefenseBonus,
            reason: isOwnZone ? 'offense-own-zone-penalty' : 'offense-opp-zone',
        };
    }
    if (targetBias === 'support') {
        const lanePressureBonus = isOwnZone && opponent ? lanePressureForActor(actor, opponent, action.zoneIndex) : 0;
        return {
            score: isOwnZone ? zoneValue + lanePressureBonus : -zoneValue - 120,
            reason: isOwnZone ? 'support-own-zone' : 'support-opp-zone-penalty',
        };
    }
    return { score: isOwnZone ? zoneValue + 20 : zoneValue, reason: 'neutral-zone-target' };
}

function scoreSelectTrashTargetAction(
    state: GameState,
    actor: PlayerState,
    action: Extract<EngineAction, { type: 'SELECT_TRASH_TARGET' }>,
): InteractionValueResult {
    const pending = state.pendingEffect;
    const targetPlayer = getPlayerById(state, action.targetPlayerId);
    const card = targetPlayer?.trash[action.trashIndex];
    if (!targetPlayer || !card) return { score: Number.NEGATIVE_INFINITY, reason: 'no-trash-target' };
    if (isOverTargetCap(pending, card)) return { score: -1800, reason: 'trash-target-over-cap' };
    if (isAlreadySelected(pending, card)) return { score: TOGGLE_UNSELECT_HEAVY_PENALTY, reason: 'trash-target-unselect' };

    const tactical = getCardValue(card);
    const actionType = pending?.actionType;
    if (actionType === 'MOVE_FROM_TRASH_TO_HAND' || actionType === 'RETURN_FROM_TRASH_AT_TURN_END') {
        const immediateBudget = getImmediatePlayableBudget(actor);
        const tempoBonus = targetPlayer.id === actor.id && card.cost <= immediateBudget ? 280 : 0;
        const ownershipBias = targetPlayer.id === actor.id ? 120 : -220;
        return { score: tactical + tempoBonus + ownershipBias, reason: 'select-trash-recovery' };
    }
    if (actionType === 'TRASH_SELF') {
        return { score: -tactical, reason: 'select-trash-self-low' };
    }
    return { score: tactical, reason: 'select-trash-target' };
}

function scoreSelectRevealedAction(
    state: GameState,
    action: Extract<EngineAction, { type: 'SELECT_REVEALED_TARGET' }>,
): InteractionValueResult {
    const pending = state.pendingEffect;
    const card = state.revealedCards[action.revealedIndex];
    if (!card) return { score: Number.NEGATIVE_INFINITY, reason: 'no-revealed-target' };
    if (isOverTargetCap(pending, card)) return { score: -1800, reason: 'revealed-over-cap' };
    if (isAlreadySelected(pending, card)) return { score: TOGGLE_UNSELECT_HEAVY_PENALTY, reason: 'revealed-unselect' };

    const tactical = getCardValue(card);
    const preferLow = pending?.actionType === 'DISCARD_FROM_DRAWN';
    return {
        score: preferLow ? -tactical : tactical,
        reason: preferLow ? 'revealed-prefer-low' : 'revealed-prefer-high',
    };
}

function scoreConfirmTargets(state: GameState): InteractionValueResult {
    const pending = state.pendingEffect;
    const targetSchema = pending?.targetSchema;
    if (!pending || !targetSchema) return { score: 20, reason: 'confirm-no-pending' };

    if (targetSchema.selectMode === 'ALL' || pending.actionType === 'TAKE_ALL_REVEALED') {
        return { score: 120, reason: 'confirm-all-targets' };
    }

    const requiredCount = targetSchema.count ?? 1;
    if (requiredCount <= 0) return { score: 120, reason: 'confirm-unbounded-targets' };
    const selectedCount = pending.selectedTargets?.length ?? 0;
    if (selectedCount >= requiredCount) return { score: 2800, reason: 'confirm-ready' };
    if (selectedCount > 0) return { score: 320, reason: 'confirm-partial' };
    return { score: 40, reason: 'confirm-empty' };
}

export function scoreInteractionAction(
    state: GameState,
    actorPlayerId: string,
    action: EngineAction,
    options: InteractionValueModelOptions,
    repeatCount: number = 0,
): InteractionValueResult {
    const actor = getPlayerById(state, actorPlayerId);
    if (!actor) return { score: Number.NEGATIVE_INFINITY, reason: 'no-actor' };

    let result: InteractionValueResult;
    switch (action.type) {
        case 'RESOLVE_OPTIONAL':
            result = scoreOptionalAction(state, actor, action);
            break;
        case 'SELECT_COST_HAND':
            result = scoreSelectCostAction(actor, action);
            break;
        case 'SELECT_HAND_TARGET':
            result = scoreSelectHandTargetAction(state, actor, action);
            break;
        case 'SELECT_ZONE_TARGET':
            result = scoreSelectZoneTargetAction(state, actor, action);
            break;
        case 'SELECT_TRASH_TARGET':
            result = scoreSelectTrashTargetAction(state, actor, action);
            break;
        case 'SELECT_REVEALED_TARGET':
            result = scoreSelectRevealedAction(state, action);
            break;
        case 'CONFIRM_TARGETS':
            result = scoreConfirmTargets(state);
            break;
        default:
            result = { score: 0, reason: 'non-interaction-action' };
            break;
    }

    return {
        ...result,
        score: withAntiOscillationPenalty(result.score, options, repeatCount),
    };
}
