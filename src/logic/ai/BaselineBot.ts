import { GameEngine } from '../GameEngine';
import { Card, CardType, EngineAction, Phase, PlayerState } from '../types';

type BlockAction = Extract<EngineAction, { type: 'RESOLVE_BLOCK' }>;
type MulliganAction = Extract<EngineAction, { type: 'RESOLVE_MULLIGAN' }>;
type AttackAction = Extract<EngineAction, { type: 'ATTACK' }>;
type PlayUnitAction = Extract<EngineAction, { type: 'PLAY_UNIT' }>;
type PlayItemAction = Extract<EngineAction, { type: 'PLAY_ITEM' }>;
type PlaySkillAction = Extract<EngineAction, { type: 'PLAY_SKILL' }>;
type ActivateEffectAction = Extract<EngineAction, { type: 'ACTIVATE_EFFECT' }>;
type NextPhaseAction = Extract<EngineAction, { type: 'NEXT_PHASE' }>;
type SelectCostHandAction = Extract<EngineAction, { type: 'SELECT_COST_HAND' }>;
type SelectZoneTargetAction = Extract<EngineAction, { type: 'SELECT_ZONE_TARGET' }>;
type SelectHandTargetAction = Extract<EngineAction, { type: 'SELECT_HAND_TARGET' }>;
type SelectTrashTargetAction = Extract<EngineAction, { type: 'SELECT_TRASH_TARGET' }>;
type SelectRevealedTargetAction = Extract<EngineAction, { type: 'SELECT_REVEALED_TARGET' }>;

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

export type BaselineTerminationReason = 'winner' | 'max_steps' | 'no_action' | 'invalid_action';

export interface BaselineSelfPlayResult {
    winnerId: string | null;
    steps: number;
    terminationReason: BaselineTerminationReason;
}

export class BaselineBot {
    readonly name: string;

    constructor(name: string = 'BaselineBot') {
        this.name = name;
    }

    public chooseAction(engine: GameEngine, actorPlayerId?: string): EngineAction | null {
        const resolvedActorId = actorPlayerId ?? engine.state.interactionOwnerPlayerId ?? engine.currentPlayer.id;
        const observation = engine.getObservation(resolvedActorId);
        if (!observation.canAct || observation.legalActions.length === 0) return null;
        return this.selectBestAction(engine, resolvedActorId, observation.legalActions);
    }

    public step(engine: GameEngine, actorPlayerId?: string): boolean {
        const action = this.chooseAction(engine, actorPlayerId);
        if (!action) return false;
        return engine.step(action);
    }

    private selectBestAction(engine: GameEngine, actorPlayerId: string, actions: EngineAction[]): EngineAction | null {
        const blockActions = this.filterByType(actions, 'RESOLVE_BLOCK');
        if (blockActions.length > 0) {
            return this.pickBlockAction(engine, blockActions);
        }

        if (engine.state.interactionMode !== 'NORMAL') {
            return this.pickInteractionAction(engine, actorPlayerId, actions);
        }

        if (engine.state.phase === Phase.ATTACK) {
            return this.pickAttackAction(engine, actions) ?? this.pickNextPhaseAction(actions) ?? actions[0];
        }

        if (engine.state.phase === Phase.MAIN) {
            return this.pickPlayUnitAction(engine, actorPlayerId, actions)
                ?? this.pickPlayItemAction(engine, actorPlayerId, actions)
                ?? this.pickPlaySkillAction(engine, actorPlayerId, actions)
                ?? this.pickActivateEffectAction(engine, actorPlayerId, actions)
                ?? this.pickNextPhaseAction(actions)
                ?? actions[0];
        }

        return this.pickNextPhaseAction(actions) ?? actions[0];
    }

    private pickInteractionAction(engine: GameEngine, actorPlayerId: string, actions: EngineAction[]): EngineAction | null {
        const mulliganActions = this.filterByType(actions, 'RESOLVE_MULLIGAN');
        if (mulliganActions.length > 0) {
            return this.pickMulliganAction(engine, actorPlayerId, mulliganActions);
        }

        const optionalActions = this.filterByType(actions, 'RESOLVE_OPTIONAL');
        if (optionalActions.length > 0) {
            return optionalActions.find(a => a.confirm) ?? optionalActions[0];
        }

        const costActions = this.filterByType(actions, 'SELECT_COST_HAND');
        if (costActions.length > 0) {
            return this.pickCostAction(engine, actorPlayerId, costActions);
        }

        const readyConfirmAction = this.pickReadyConfirmAction(engine, actions);
        if (readyConfirmAction) {
            return readyConfirmAction;
        }

        const handActions = this.filterByType(actions, 'SELECT_HAND_TARGET');
        if (handActions.length > 0) {
            const handAction = this.pickHandTargetAction(engine, actorPlayerId, handActions);
            if (handAction) return handAction;
        }

        const zoneActions = this.filterByType(actions, 'SELECT_ZONE_TARGET');
        if (zoneActions.length > 0) {
            const zoneAction = this.pickZoneTargetAction(engine, actorPlayerId, zoneActions);
            if (zoneAction) return zoneAction;
        }

        const trashActions = this.filterByType(actions, 'SELECT_TRASH_TARGET');
        if (trashActions.length > 0) {
            const trashAction = this.pickTrashTargetAction(engine, trashActions);
            if (trashAction) return trashAction;
        }

        const revealedActions = this.filterByType(actions, 'SELECT_REVEALED_TARGET');
        if (revealedActions.length > 0) {
            const revealedAction = this.pickRevealedTargetAction(engine, revealedActions);
            if (revealedAction) return revealedAction;
        }

        const confirmActions = this.filterByType(actions, 'CONFIRM_TARGETS');
        if (confirmActions.length > 0) {
            return confirmActions[0];
        }

        return actions[0] ?? null;
    }

    private pickMulliganAction(engine: GameEngine, actorPlayerId: string, actions: MulliganAction[]): MulliganAction {
        const keepAction = actions.find(action => !action.shouldMulligan);
        const redrawAction = actions.find(action => action.shouldMulligan);
        if (!keepAction) return redrawAction ?? actions[0];
        if (!redrawAction) return keepAction;

        const actor = this.getPlayerById(engine, actorPlayerId);
        if (!actor || actor.hand.length === 0) return keepAction;

        const unitCount = actor.hand.filter(card => card.type === CardType.UNIT).length;
        const lowCostCount = actor.hand.filter(card => card.cost <= 2).length;
        const totalCost = actor.hand.reduce((sum, card) => sum + card.cost, 0);
        const averageCost = totalCost / actor.hand.length;

        const shouldMulligan = unitCount === 0 || (averageCost >= 3.4 && lowCostCount === 0);
        return shouldMulligan ? redrawAction : keepAction;
    }

    private pickBlockAction(engine: GameEngine, actions: BlockAction[]): BlockAction {
        const blockTrue = actions.find(a => a.shouldBlock);
        const blockFalse = actions.find(a => !a.shouldBlock);
        if (!blockTrue) return blockFalse ?? actions[0];
        if (!blockFalse) return blockTrue;

        const attackerIndex = engine.state.pendingAttackerIndex;
        if (attackerIndex === null) return blockFalse;

        const attackerPlayer = engine.currentPlayer;
        const defenderPlayer = engine.opponentPlayer;
        const attackerZone = attackerPlayer.unitZones[attackerIndex];
        const defenderZone = defenderPlayer.unitZones[attackerIndex];
        if (!attackerZone?.unit || !defenderZone?.unit) return blockFalse;

        const attackerPower = engine.getUnitPower(attackerZone, attackerPlayer);
        const attackerHit = engine.getUnitHit(attackerZone, attackerPlayer);
        const defenderPower = engine.getUnitPower(defenderZone, defenderPlayer);

        const shouldBlock = defenderPower >= attackerPower || attackerHit >= 2;
        return shouldBlock ? blockTrue : blockFalse;
    }

    private pickAttackAction(engine: GameEngine, actions: EngineAction[]): AttackAction | null {
        const attackActions = this.filterByType(actions, 'ATTACK');
        if (attackActions.length === 0) return null;

        return this.pickMax(attackActions, action => {
            const zone = engine.currentPlayer.unitZones[action.attackerZoneIndex];
            if (!zone.unit) return Number.NEGATIVE_INFINITY;
            const power = engine.getUnitPower(zone, engine.currentPlayer);
            const hit = engine.getUnitHit(zone, engine.currentPlayer);
            return hit * 10000 + power;
        });
    }

    private pickPlayUnitAction(engine: GameEngine, actorPlayerId: string, actions: EngineAction[]): PlayUnitAction | null {
        const unitActions = this.filterByType(actions, 'PLAY_UNIT');
        if (unitActions.length === 0) return null;
        const actor = this.getPlayerById(engine, actorPlayerId);
        if (!actor) return unitActions[0];

        return this.pickMax(unitActions, action => {
            const card = actor.hand[action.handIndex];
            if (!card) return Number.NEGATIVE_INFINITY;
            const power = card.power ?? 0;
            const hit = card.hit ?? 0;
            return card.cost * 10000 + power * 10 + hit;
        });
    }

    private pickPlayItemAction(engine: GameEngine, actorPlayerId: string, actions: EngineAction[]): PlayItemAction | null {
        const itemActions = this.filterByType(actions, 'PLAY_ITEM');
        if (itemActions.length === 0) return null;
        const actor = this.getPlayerById(engine, actorPlayerId);
        if (!actor) return itemActions[0];

        return this.pickMax(itemActions, action => {
            const card = actor.hand[action.handIndex];
            if (!card) return Number.NEGATIVE_INFINITY;
            return card.cost * 10000;
        });
    }

    private pickPlaySkillAction(engine: GameEngine, actorPlayerId: string, actions: EngineAction[]): PlaySkillAction | null {
        const skillActions = this.filterByType(actions, 'PLAY_SKILL');
        if (skillActions.length === 0) return null;
        const actor = this.getPlayerById(engine, actorPlayerId);
        if (!actor) return skillActions[0];

        return this.pickMax(skillActions, action => {
            const card = actor.hand[action.handIndex];
            if (!card) return Number.NEGATIVE_INFINITY;
            return card.cost * 10000;
        });
    }

    private pickActivateEffectAction(engine: GameEngine, actorPlayerId: string, actions: EngineAction[]): ActivateEffectAction | null {
        const activateActions = this.filterByType(actions, 'ACTIVATE_EFFECT');
        if (activateActions.length === 0) return null;
        const actor = this.getPlayerById(engine, actorPlayerId);
        if (!actor) return activateActions[0];

        return this.pickMax(activateActions, action => {
            const sourceCard = this.getActivateEffectSourceCard(actor, action);
            if (!sourceCard) return Number.NEGATIVE_INFINITY;
            if (
                action.sourceType === 'LEADER'
                && actor.unitZones.every(zone => !zone.unit)
                && (sourceCard.text ?? '').includes('필드에 있는 자신 유닛')
            ) {
                return Number.NEGATIVE_INFINITY;
            }
            const cost = typeof sourceCard.cost === 'number' ? sourceCard.cost : 0;
            const sourceTypeBias = action.sourceType === 'LEADER' ? 250 : action.sourceType === 'ITEM' ? 120 : 0;
            return sourceTypeBias + cost * 1000 - action.effectIndex;
        });
    }

    private getActivateEffectSourceCard(actor: PlayerState, action: ActivateEffectAction): Card | null {
        if (action.sourceType === 'LEADER') {
            return actor.levelZone ?? null;
        }

        const zone = actor.unitZones[action.zoneIndex];
        if (!zone) return null;

        if (action.sourceType === 'ITEM') {
            if (typeof action.itemIndex !== 'number') return null;
            return zone.items[action.itemIndex] ?? null;
        }

        return zone.unit ?? null;
    }

    private pickNextPhaseAction(actions: EngineAction[]): NextPhaseAction | null {
        const nextActions = this.filterByType(actions, 'NEXT_PHASE');
        return nextActions[0] ?? null;
    }

    private pickCostAction(engine: GameEngine, actorPlayerId: string, actions: SelectCostHandAction[]): SelectCostHandAction {
        const actor = this.getPlayerById(engine, actorPlayerId);
        if (!actor) return actions[0];

        return this.pickMin(actions, action => {
            const card = actor.hand[action.handIndex];
            if (!card) return Number.POSITIVE_INFINITY;
            return card.cost;
        }) ?? actions[0];
    }

    private pickHandTargetAction(engine: GameEngine, actorPlayerId: string, actions: SelectHandTargetAction[]): SelectHandTargetAction | null {
        const pendingSelectedTargets = engine.state.pendingEffect?.selectedTargets ?? [];
        const selectableActions = actions.filter(action => {
            const targetPlayer = this.getPlayerById(engine, action.targetPlayerId);
            const card = targetPlayer?.hand[action.handIndex];
            return !!card && !pendingSelectedTargets.includes(card);
        });
        const candidateActions = selectableActions.length > 0 ? selectableActions : [];
        if (candidateActions.length === 0) return null;

        return this.pickMax(candidateActions, action => {
            const targetPlayer = this.getPlayerById(engine, action.targetPlayerId);
            const card = targetPlayer?.hand[action.handIndex];
            if (!card) return Number.NEGATIVE_INFINITY;
            const cardValue = this.getCardValue(card);
            const isOwnHand = action.targetPlayerId === actorPlayerId;
            return isOwnHand ? -cardValue : cardValue;
        }) ?? candidateActions[0];
    }

    private pickZoneTargetAction(engine: GameEngine, actorPlayerId: string, actions: SelectZoneTargetAction[]): SelectZoneTargetAction | null {
        const pendingActionType = engine.state.pendingEffect?.actionType;
        const pendingValue = engine.state.pendingEffect?.actionValue?.value;
        const targetBias = this.resolveZoneTargetBias(pendingActionType, pendingValue);
        const selectedTargets = engine.state.pendingEffect?.selectedTargets ?? [];

        const selectableActions = actions.filter(action => {
            const targetPlayer = this.getPlayerById(engine, action.targetPlayerId);
            const targetZone = targetPlayer?.unitZones[action.zoneIndex];
            return !!targetZone && !selectedTargets.includes(targetZone);
        });
        const candidateActions = selectableActions.length > 0 ? selectableActions : [];
        if (candidateActions.length === 0) return null;

        if (pendingActionType === 'SACRIFICE_TO_BUFF') {
            const ownCandidateActions = candidateActions.filter(action => action.targetPlayerId === actorPlayerId);
            if (ownCandidateActions.length > 0) {
                const selectedCount = selectedTargets.length;
                if (selectedCount === 0) {
                    return this.pickMin(ownCandidateActions, action => this.getZoneActionValue(engine, action)) ?? ownCandidateActions[0];
                }
                return this.pickMax(ownCandidateActions, action => this.getZoneActionValue(engine, action)) ?? ownCandidateActions[0];
            }
        }

        return this.pickMax(candidateActions, action => {
            const zoneValue = this.getZoneActionValue(engine, action);
            if (zoneValue === Number.NEGATIVE_INFINITY) return zoneValue;
            const isOwnZone = action.targetPlayerId === actorPlayerId;

            if (targetBias === 'offense') return isOwnZone ? -zoneValue : zoneValue;
            if (targetBias === 'support') return isOwnZone ? zoneValue : -zoneValue;
            return zoneValue;
        }) ?? candidateActions[0];
    }

    private pickTrashTargetAction(engine: GameEngine, actions: SelectTrashTargetAction[]): SelectTrashTargetAction | null {
        const pendingSelectedTargets = engine.state.pendingEffect?.selectedTargets ?? [];
        const selectableActions = actions.filter(action => {
            const targetPlayer = this.getPlayerById(engine, action.targetPlayerId);
            const card = targetPlayer?.trash[action.trashIndex];
            return !!card && !pendingSelectedTargets.includes(card);
        });
        const candidateActions = selectableActions.length > 0 ? selectableActions : [];
        if (candidateActions.length === 0) return null;

        return this.pickMax(candidateActions, action => {
            const targetPlayer = this.getPlayerById(engine, action.targetPlayerId);
            const card = targetPlayer?.trash[action.trashIndex];
            if (!card) return Number.NEGATIVE_INFINITY;
            const cardValue = this.getCardValue(card);
            const actionType = engine.state.pendingEffect?.actionType;
            if (actionType === 'TRASH_SELF') return -cardValue;
            return cardValue;
        }) ?? candidateActions[0];
    }

    private pickRevealedTargetAction(engine: GameEngine, actions: SelectRevealedTargetAction[]): SelectRevealedTargetAction | null {
        const pendingSelectedTargets = engine.state.pendingEffect?.selectedTargets ?? [];
        const selectableActions = actions.filter(action => {
            const card = engine.state.revealedCards[action.revealedIndex];
            return !!card && !pendingSelectedTargets.includes(card);
        });
        const candidateActions = selectableActions.length > 0 ? selectableActions : [];
        if (candidateActions.length === 0) return null;

        const actionType = engine.state.pendingEffect?.actionType;
        const preferLow = actionType === 'DISCARD_FROM_DRAWN';

        return (preferLow
            ? this.pickMin(candidateActions, action => this.getCardValue(engine.state.revealedCards[action.revealedIndex]))
            : this.pickMax(candidateActions, action => this.getCardValue(engine.state.revealedCards[action.revealedIndex])))
            ?? candidateActions[0];
    }

    private pickReadyConfirmAction(engine: GameEngine, actions: EngineAction[]): Extract<EngineAction, { type: 'CONFIRM_TARGETS' }> | null {
        const confirmActions = this.filterByType(actions, 'CONFIRM_TARGETS');
        if (confirmActions.length === 0) return null;

        const pending = engine.state.pendingEffect;
        const targetSchema = pending?.targetSchema;
        if (!pending || !targetSchema) return confirmActions[0];

        const requiredCount = targetSchema.count ?? 1;
        if (targetSchema.selectMode === 'ALL' || pending.actionType === 'TAKE_ALL_REVEALED' || requiredCount <= 0) {
            return confirmActions[0];
        }

        const selectedCount = pending.selectedTargets?.length ?? 0;
        if (selectedCount >= requiredCount) {
            return confirmActions[0];
        }

        return null;
    }

    private resolveZoneTargetBias(actionType: string | undefined, pendingValue: unknown): 'offense' | 'support' | 'neutral' {
        if (!actionType) return 'neutral';
        if (OFFENSIVE_TARGET_ACTIONS.has(actionType)) return 'offense';
        if (SUPPORTIVE_TARGET_ACTIONS.has(actionType)) return 'support';

        if ((actionType === 'BUFF_POWER' || actionType === 'BUFF_HIT') && typeof pendingValue === 'number') {
            return pendingValue < 0 ? 'offense' : 'support';
        }

        return 'neutral';
    }

    private getCardValue(card: Card | undefined): number {
        if (!card) return Number.NEGATIVE_INFINITY;
        const power = card.power ?? 0;
        const hit = card.hit ?? 0;
        return card.cost * 10000 + power + hit * 100;
    }

    private getZoneActionValue(engine: GameEngine, action: SelectZoneTargetAction): number {
        const targetPlayer = this.getPlayerById(engine, action.targetPlayerId);
        if (!targetPlayer) return Number.NEGATIVE_INFINITY;
        const targetZone = targetPlayer.unitZones[action.zoneIndex];
        const unit = targetZone.unit;
        if (!unit) return Number.NEGATIVE_INFINITY;
        return unit.cost * 10000 + engine.getUnitPower(targetZone, targetPlayer) + engine.getUnitHit(targetZone, targetPlayer) * 100;
    }

    private getPlayerById(engine: GameEngine, playerId: string): PlayerState | undefined {
        return engine.state.players.find(player => player.id === playerId);
    }

    private filterByType<T extends EngineAction['type']>(actions: EngineAction[], type: T): Extract<EngineAction, { type: T }>[] {
        return actions.filter((action): action is Extract<EngineAction, { type: T }> => action.type === type);
    }

    private pickMax<T>(items: T[], score: (item: T) => number): T | null {
        let best: T | null = null;
        let bestScore = Number.NEGATIVE_INFINITY;

        for (const item of items) {
            const current = score(item);
            if (current > bestScore) {
                best = item;
                bestScore = current;
            }
        }

        return best;
    }

    private pickMin<T>(items: T[], score: (item: T) => number): T | null {
        let best: T | null = null;
        let bestScore = Number.POSITIVE_INFINITY;

        for (const item of items) {
            const current = score(item);
            if (current < bestScore) {
                best = item;
                bestScore = current;
            }
        }

        return best;
    }
}

export function runBaselineSelfPlay(
    engine: GameEngine,
    player1Bot: BaselineBot,
    player2Bot: BaselineBot,
    maxSteps: number = 1000
): BaselineSelfPlayResult {
    let steps = 0;

    while (!engine.state.winner && steps < maxSteps) {
        const actorPlayerId = engine.state.interactionOwnerPlayerId ?? engine.currentPlayer.id;
        const playerIndex = engine.state.players[0].id === actorPlayerId ? 0 : 1;
        const bot = playerIndex === 0 ? player1Bot : player2Bot;

        const action = bot.chooseAction(engine, actorPlayerId);
        if (!action) {
            return {
                winnerId: engine.state.winner,
                steps,
                terminationReason: 'no_action',
            };
        }

        const ok = engine.step(action);
        if (!ok) {
            return {
                winnerId: engine.state.winner,
                steps,
                terminationReason: 'invalid_action',
            };
        }

        steps += 1;
    }

    if (engine.state.winner) {
        return {
            winnerId: engine.state.winner,
            steps,
            terminationReason: 'winner',
        };
    }

    return {
        winnerId: null,
        steps,
        terminationReason: 'max_steps',
    };
}
