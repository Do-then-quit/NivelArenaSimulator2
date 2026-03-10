import { GameEngine } from '../../GameEngine';
import { Card, CardType, EngineAction, PendingEffect, PlayerState } from '../../types';

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

const TRASH_RECOVERY_ACTIONS = new Set([
    'MOVE_FROM_TRASH_TO_HAND',
    'RETURN_FROM_TRASH_AT_TURN_END',
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

function getCurrentFieldCost(player: PlayerState): number {
    return player.unitZones.reduce((sum, zone) => {
        if (!zone.unit) return sum;
        const itemCost = zone.items.reduce((itemSum, item) => itemSum + item.cost, 0);
        return sum + zone.unit.cost + itemCost;
    }, 0);
}

function getImmediatePlayableBudget(player: PlayerState): number {
    const size = player.leaderLevel + player.damage.length;
    return Math.max(0, size - getCurrentFieldCost(player));
}

function getCardIntrinsicValue(card: Card | undefined): number {
    if (!card) return Number.NEGATIVE_INFINITY;
    const power = card.power ?? 0;
    const hit = card.hit ?? 0;

    let value = card.cost * 120 + power / 200 + hit * 95;
    if (card.type === CardType.UNIT) value += 80;
    if (card.type === CardType.ITEM) value += 35;
    if (card.type === CardType.SKILL) value += 50;
    if (card.effects && card.effects.length > 0) value += card.effects.length * 14;
    return value;
}

function getCardTempoAdjustment(card: Card | undefined, owner: PlayerState | null): number {
    if (!card || !owner) return 0;

    const immediateBudget = getImmediatePlayableBudget(owner);
    const boardSize = owner.leaderLevel + owner.damage.length;
    if (card.cost <= immediateBudget) return 420;
    if (card.cost <= boardSize) return 130;
    return -260 - (card.cost - boardSize) * 45;
}

function getCardTacticalValue(card: Card | undefined, owner: PlayerState | null = null): number {
    return getCardIntrinsicValue(card) + getCardTempoAdjustment(card, owner);
}

function getActivateEffectSourceCard(
    actor: PlayerState,
    action: Extract<EngineAction, { type: 'ACTIVATE_EFFECT' }>,
): Card | undefined {
    if (action.sourceType === 'LEADER') {
        return actor.levelZone ?? undefined;
    }

    const zone = actor.unitZones[action.zoneIndex];
    if (!zone) return undefined;

    if (action.sourceType === 'ITEM') {
        if (typeof action.itemIndex !== 'number') return undefined;
        return zone.items[action.itemIndex];
    }

    return zone.unit ?? undefined;
}

function getZoneTacticalValue(engine: GameEngine, targetPlayer: PlayerState, zoneIndex: number): number {
    const zone = targetPlayer.unitZones[zoneIndex];
    if (!zone?.unit) return Number.NEGATIVE_INFINITY;
    return zone.unit.cost * 150
        + engine.getUnitPower(zone, targetPlayer) / 220
        + engine.getUnitHit(zone, targetPlayer) * 130
        + zone.items.length * 18;
}

function getLaneThreatToActor(
    engine: GameEngine,
    actor: PlayerState,
    targetPlayer: PlayerState,
    zoneIndex: number,
): number {
    const zone = targetPlayer.unitZones[zoneIndex];
    if (!zone.unit) return 0;

    const actorZone = actor.unitZones[zoneIndex];
    if (actorZone.unit) return 0;

    const hit = Math.max(0, engine.getUnitHit(zone, targetPlayer));
    let score = hit * 220;
    if (actor.damage.length + hit >= 10) {
        score += 3200;
    }
    return score;
}

function getLanePressureForActor(
    engine: GameEngine,
    actor: PlayerState,
    opponent: PlayerState,
    zoneIndex: number,
): number {
    const ownZone = actor.unitZones[zoneIndex];
    if (!ownZone.unit) return 0;

    const ownHit = Math.max(0, engine.getUnitHit(ownZone, actor));
    const ownPower = Math.max(0, engine.getUnitPower(ownZone, actor));
    const oppZone = opponent.unitZones[zoneIndex];

    if (!oppZone.unit) {
        let score = ownHit * 170;
        if (opponent.damage.length + ownHit >= 10) {
            score += 2200;
        }
        return score;
    }

    const oppPower = Math.max(0, engine.getUnitPower(oppZone, opponent));
    if (ownPower <= oppPower) {
        return 200;
    }
    return 60;
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
    const sourceCard = getActivateEffectSourceCard(actor, action);
    if (!sourceCard) return { score: Number.NEGATIVE_INFINITY, reason: 'no-effect-source' };
    if (
        action.sourceType === 'LEADER'
        && actor.unitZones.every(zone => !zone.unit)
        && (sourceCard.text ?? '').includes('필드에 있는 자신 유닛')
    ) {
        return { score: Number.NEGATIVE_INFINITY, reason: 'leader-needs-field-unit' };
    }

    const cost = typeof sourceCard.cost === 'number' ? sourceCard.cost : 0;
    const sourceTypeBias = action.sourceType === 'LEADER' ? 60 : action.sourceType === 'ITEM' ? 20 : 0;
    const score = 140 + cost * 22 - action.effectIndex + sourceTypeBias;
    return { score, reason: 'activate-effect' };
}

function scoreSelectCostHandAction(
    engine: GameEngine,
    actor: PlayerState,
    action: Extract<EngineAction, { type: 'SELECT_COST_HAND' }>,
): ActionScoreResult {
    const card = actor.hand[action.handIndex];
    if (!card) return { score: Number.NEGATIVE_INFINITY, reason: 'no-cost-card' };

    const preserveValue = getCardTacticalValue(card, actor);
    let score = 330 - preserveValue * 0.8;
    if (actor.hand.length <= 2) score -= 100;
    if (card.type === CardType.UNIT && actor.unitZones.every(zone => !zone.unit)) score -= 80;
    if (engine.state.pendingEffect?.actionType === 'DESTROY_UNIT_WITH_HIT_COST') score += 35;

    return { score, reason: 'select-cost-hand' };
}

function resolveOptionalConfirmBias(engine: GameEngine, actor: PlayerState): number {
    const pending = engine.state.pendingEffect;
    if (!pending) return 40;

    const actionType = pending.actionType;
    let bias = 40;

    if (OPTIONAL_POSITIVE_ACTIONS.has(actionType)) bias += 140;
    if (OPTIONAL_NEGATIVE_ACTIONS.has(actionType)) bias -= 260;

    const pendingValue = extractPendingNumericValue(pending);
    if ((actionType === 'BUFF_POWER' || actionType === 'BUFF_HIT') && typeof pendingValue === 'number') {
        bias += pendingValue >= 0 ? 140 : -240;
    }

    if (actionType === 'DRAW') {
        if (actor.hand.length >= 7) bias -= 90;
        if (actor.deck.length === 0) bias -= 500;
    }

    if (actionType === 'DISCARD') {
        const target = pending.actionValue?.target as string | undefined;
        if (target === 'SELF') bias -= 190;
        if (target === 'OPPONENT') bias += 70;
    }

    if (actionType === 'MOVE_FROM_TRASH_TO_HAND') {
        bias += actor.trash.length > 0 ? 120 : -120;
    }

    if (actionType === 'DAMAGE') {
        const opponent = engine.state.players.find(player => player.id !== actor.id);
        const damageValue = typeof pending.actionValue?.value === 'number' ? pending.actionValue.value : 0;
        if (opponent && opponent.damage.length + damageValue >= 10) bias += 600;
    }

    return bias;
}

function scoreResolveOptionalAction(
    engine: GameEngine,
    actor: PlayerState,
    action: Extract<EngineAction, { type: 'RESOLVE_OPTIONAL' }>,
): ActionScoreResult {
    const confirmBias = resolveOptionalConfirmBias(engine, actor);
    const score = action.confirm ? confirmBias : -confirmBias * 0.8;
    return {
        score,
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
    const selectedTargets = engine.state.pendingEffect?.selectedTargets ?? [];
    const targetSchema = engine.state.pendingEffect?.targetSchema;
    const requiredCount = targetSchema?.count ?? 1;
    if (requiredCount > 0 && selectedTargets.length >= requiredCount && !selectedTargets.includes(card)) {
        return { score: -1800, reason: 'hand-target-over-cap' };
    }
    if (selectedTargets.includes(card)) {
        return { score: -1600, reason: 'hand-target-unselect' };
    }

    const pending = engine.state.pendingEffect;
    const tactical = getCardTacticalValue(card, targetPlayer);
    const isOwnHand = targetPlayer.id === actor.id;
    if (pending?.actionType === 'DISCARD') {
        if (isOwnHand) return { score: -tactical - 80, reason: 'discard-own-low' };
        return { score: tactical + 80, reason: 'discard-opp-high' };
    }

    return {
        score: isOwnHand ? -tactical : tactical + 40,
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
    const opponent = engine.state.players.find(player => player.id !== actor.id) ?? null;

    const targetZone = targetPlayer.unitZones[action.zoneIndex];
    if (!targetZone) return { score: Number.NEGATIVE_INFINITY, reason: 'no-zone-target' };

    const selectedTargets = pending?.selectedTargets ?? [];
    const requiredCount = pending?.targetSchema?.count ?? 1;
    if (requiredCount > 0 && selectedTargets.length >= requiredCount && !selectedTargets.includes(targetZone)) {
        return { score: -2000, reason: 'zone-target-over-cap' };
    }
    const alreadySelected = selectedTargets.includes(targetZone);
    if (alreadySelected) {
        return { score: -1600, reason: 'zone-target-unselect' };
    }

    const zoneValue = getZoneTacticalValue(engine, targetPlayer, action.zoneIndex);
    if (zoneValue === Number.NEGATIVE_INFINITY) {
        return { score: Number.NEGATIVE_INFINITY, reason: 'zone-target-empty' };
    }

    if (pending?.actionType === 'SACRIFICE_TO_BUFF') {
        const selectedCount = selectedTargets.length;
        if (targetPlayer.id !== actor.id) return { score: -260, reason: 'sacrifice-to-buff-invalid-owner' };
        const lanePressureBonus = opponent ? getLanePressureForActor(engine, actor, opponent, action.zoneIndex) : 0;
        return selectedCount === 0
            ? { score: -zoneValue + 160, reason: 'sacrifice-low-first' }
            : { score: zoneValue + lanePressureBonus + 160, reason: 'buff-high-second' };
    }

    const targetBias = resolveZoneTargetBias(pending?.actionType, extractPendingNumericValue(pending ?? null));
    const isOwnZone = targetPlayer.id === actor.id;
    if (targetBias === 'offense') {
        const lethalDefenseBonus = !isOwnZone ? getLaneThreatToActor(engine, actor, targetPlayer, action.zoneIndex) : 0;
        return {
            score: isOwnZone ? -zoneValue - 180 : zoneValue + lethalDefenseBonus,
            reason: isOwnZone ? 'offense-own-zone-penalty' : 'offense-opp-zone',
        };
    }
    if (targetBias === 'support') {
        const lanePressureBonus =
            isOwnZone && opponent
                ? getLanePressureForActor(engine, actor, opponent, action.zoneIndex)
                : 0;
        return {
            score: isOwnZone ? zoneValue + lanePressureBonus : -zoneValue - 120,
            reason: isOwnZone ? 'support-own-zone' : 'support-opp-zone-penalty',
        };
    }

    return { score: isOwnZone ? zoneValue + 20 : zoneValue, reason: 'neutral-zone-target' };
}

function scoreSelectTrashTargetAction(
    engine: GameEngine,
    actor: PlayerState,
    action: Extract<EngineAction, { type: 'SELECT_TRASH_TARGET' }>,
): ActionScoreResult {
    const targetPlayer = engine.state.players.find(player => player.id === action.targetPlayerId);
    const card = targetPlayer?.trash[action.trashIndex];
    if (!targetPlayer || !card) return { score: Number.NEGATIVE_INFINITY, reason: 'no-trash-target' };
    const selectedTargets = engine.state.pendingEffect?.selectedTargets ?? [];
    const targetSchema = engine.state.pendingEffect?.targetSchema;
    const requiredCount = targetSchema?.count ?? 1;
    if (requiredCount > 0 && selectedTargets.length >= requiredCount && !selectedTargets.includes(card)) {
        return { score: -1800, reason: 'trash-target-over-cap' };
    }
    if (selectedTargets.includes(card)) {
        return { score: -1600, reason: 'trash-target-unselect' };
    }

    const tactical = getCardTacticalValue(card, targetPlayer);
    const actionType = engine.state.pendingEffect?.actionType;
    if (actionType && TRASH_RECOVERY_ACTIONS.has(actionType)) {
        const score = tactical + (targetPlayer.id === actor.id ? 120 : -220);
        return { score, reason: 'select-trash-recovery' };
    }

    return {
        score: actionType === 'TRASH_SELF' ? -tactical : tactical,
        reason: actionType === 'TRASH_SELF' ? 'select-trash-self-low' : 'select-trash-target',
    };
}

function scoreSelectRevealedTargetAction(
    engine: GameEngine,
    actor: PlayerState,
    action: Extract<EngineAction, { type: 'SELECT_REVEALED_TARGET' }>,
): ActionScoreResult {
    const card = engine.state.revealedCards[action.revealedIndex];
    if (!card) return { score: Number.NEGATIVE_INFINITY, reason: 'no-revealed-target' };
    const selectedTargets = engine.state.pendingEffect?.selectedTargets ?? [];
    const targetSchema = engine.state.pendingEffect?.targetSchema;
    const requiredCount = targetSchema?.count ?? 1;
    if (requiredCount > 0 && selectedTargets.length >= requiredCount && !selectedTargets.includes(card)) {
        return { score: -1800, reason: 'revealed-target-over-cap' };
    }
    if (selectedTargets.includes(card)) {
        return { score: -1600, reason: 'revealed-target-unselect' };
    }

    const tactical = getCardTacticalValue(card, actor);
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
        return { score: 2800, reason: 'confirm-targets-ready' };
    }

    // Rule 1.3.2 handling in legal-action generation can expose CONFIRM even below required count.
    // When that happens, prefer resolving over oscillating on already-selected targets.
    if (selectedCount > 0) {
        return { score: 320, reason: 'confirm-targets-partial' };
    }

    return { score: 40, reason: 'confirm-targets-empty' };
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
            return scoreSelectCostHandAction(engine, actor, action);
        case 'RESOLVE_OPTIONAL':
            return scoreResolveOptionalAction(engine, actor, action);
        case 'SELECT_HAND_TARGET':
            return scoreSelectHandTargetAction(engine, actor, action);
        case 'SELECT_ZONE_TARGET':
            return scoreSelectZoneTargetAction(engine, actor, action);
        case 'SELECT_TRASH_TARGET':
            return scoreSelectTrashTargetAction(engine, actor, action);
        case 'SELECT_REVEALED_TARGET':
            return scoreSelectRevealedTargetAction(engine, actor, action);
        case 'CONFIRM_TARGETS':
            return scoreConfirmTargetsAction(engine);
        case 'NEXT_PHASE':
            return { score: -90, reason: 'next-phase' };
        default:
            return { score: -150, reason: 'fallback-action' };
    }
}
