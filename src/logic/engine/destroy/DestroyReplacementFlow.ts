import { ActivationCondition, type Card, type GameContext, type PendingEffect, type PlayerState, type UnitZoneState } from '../../types';

export type DestroyReason = 'BATTLE' | 'EFFECT' | 'RULE';

export interface DestroyPayload {
    targetPlayerId: string;
    zoneIndex: number;
    reason: DestroyReason;
    killerCard?: Card;
}

export interface DestroyReplacement {
    type: 'TRASH_EQUIPPED_ITEM' | 'DISCARD_HAND_BY_HIT';
    sourceCard: Card;
    requiredHandCount?: number;
    description: string;
}

export function isReplacementDestroyReason(reason: DestroyReason): boolean {
    return reason === 'BATTLE' || reason === 'EFFECT';
}

export function collectDestroyReplacements(
    engine: any,
    player: PlayerState,
    zone: UnitZoneState,
    reason: DestroyReason,
): DestroyReplacement[] {
    if (!isReplacementDestroyReason(reason) || !zone.unit) return [];
    const replacements: DestroyReplacement[] = [];
    const opponent = engine.getOpponentOf(player);

    const unitContext: GameContext = {
        sourceCard: zone.unit,
        player,
        opponent,
        unitZone: zone,
        machine: engine,
        trashReason: reason,
    };

    zone.unit.effects?.forEach(effect => {
        if (effect.activation !== ActivationCondition.PASSIVE) return;
        if (effect.action?.type !== 'NONE') return;
        if (effect.action?.params?.destroyReplacement !== 'TRASH_EQUIPPED_ITEM') return;
        if (zone.items.length === 0) return;
        if (!engine.effectManager.checkCondition(effect, unitContext)) return;

        replacements.push({
            type: 'TRASH_EQUIPPED_ITEM',
            sourceCard: zone.unit!,
            description: effect.description || '장착 아이템 1장을 트래시하고 파괴를 대체한다.',
        });
    });

    zone.items.forEach(item => {
        const alreadyUsedTurn = (item as any).__replacementUsedTurn as number | undefined;
        if (alreadyUsedTurn === engine.state.turnCount) return;

        const itemContext: GameContext = {
            sourceCard: item,
            player,
            opponent,
            unitZone: zone,
            machine: engine,
            trashReason: reason,
        };

        item.effects?.forEach(effect => {
            if (effect.activation !== ActivationCondition.PASSIVE) return;
            if (effect.action?.type !== 'NONE') return;
            if (effect.action?.params?.destroyReplacement !== 'DISCARD_HAND_BY_HIT') return;
            if (!engine.effectManager.checkCondition(effect, itemContext)) return;

            const requiredHandCount = Math.max(0, engine.getUnitHit(zone, player));
            if (player.hand.length < requiredHandCount) return;
            replacements.push({
                type: 'DISCARD_HAND_BY_HIT',
                sourceCard: item,
                requiredHandCount,
                description: effect.description || '패를 버리고 파괴를 대체한다.',
            });
        });
    });

    return replacements;
}

export function beginDestroyReplacementPrompt(
    engine: any,
    destroyPayload: DestroyPayload,
    replacements: DestroyReplacement[],
    index: number,
) {
    const replacement = replacements[index];
    if (!replacement) {
        engine.executePendingDestroyPayload(destroyPayload);
        return;
    }

    engine.state.interactionMode = 'SELECT_OPTIONAL';
    engine.state.pendingEffect = {
        sourceCard: replacement.sourceCard,
        sourcePlayerId: destroyPayload.targetPlayerId,
        controllerPlayerId: destroyPayload.targetPlayerId,
        actionType: 'DESTRUCTION_REPLACEMENT',
        actionValue: {
            destroyPayload,
            replacements,
            index,
        },
        effectDescription: replacement.description,
        triggerReason: '파괴 대체 효과 처리',
        selectionPurpose: '파괴 대체 효과 사용 여부 선택',
    };
    engine.clearPendingRuntime();
    engine.assignInteractionOwner(destroyPayload.targetPlayerId);
}

export function tryInitiateDestroyReplacement(
    engine: any,
    player: PlayerState,
    zone: UnitZoneState,
    killerCard: Card | undefined,
    reason: DestroyReason,
): boolean {
    const zoneIndex = player.unitZones.indexOf(zone);
    if (zoneIndex < 0) return false;

    const replacements = collectDestroyReplacements(engine, player, zone, reason);
    if (replacements.length === 0) return false;

    beginDestroyReplacementPrompt(
        engine,
        { targetPlayerId: player.id, zoneIndex, killerCard, reason },
        replacements,
        0,
    );
    return true;
}

export function executePendingDestroyPayload(engine: any, payload: DestroyPayload) {
    const owner = engine.getPlayerById(payload.targetPlayerId);
    if (!owner) {
        engine.resetInteractionMode();
        return;
    }

    const zone = owner.unitZones[payload.zoneIndex];
    engine.state.interactionMode = 'NORMAL';
    engine.state.pendingEffect = null;
    engine.clearPendingRuntime();
    engine.assignInteractionOwner(engine.getDefaultInteractionOwnerId());

    if (zone?.unit) {
        engine.destroyUnit(owner, zone, payload.killerCard, payload.reason, { skipReplacement: true });
    }
    engine.effectManager.resumeQueue();
}

export function completeDestructionReplacementAfterHandCost(engine: any, pending: PendingEffect) {
    const replacement = pending.actionValue?.replacement;
    if (replacement?.sourceCard) {
        (replacement.sourceCard as any).__replacementUsedTurn = engine.state.turnCount;
    }
    engine.resetInteractionMode();
}

export function resolveDestructionReplacementChoice(engine: any, confirm: boolean) {
    if (engine.state.interactionMode !== 'SELECT_OPTIONAL' || !engine.state.pendingEffect) return;

    const pending = engine.state.pendingEffect;
    const actionValue = pending.actionValue ?? {};
    const destroyPayload = actionValue.destroyPayload as DestroyPayload | undefined;
    const replacements = (actionValue.replacements ?? []) as DestroyReplacement[];
    const index = typeof actionValue.index === 'number' ? actionValue.index : 0;
    const replacement = replacements[index];

    if (!destroyPayload || !replacement) {
        engine.resetInteractionMode();
        return;
    }

    if (confirm) {
        const owner = engine.getPlayerById(destroyPayload.targetPlayerId);
        const zone = owner?.unitZones[destroyPayload.zoneIndex];
        if (owner && zone?.unit) {
            if (replacement.type === 'TRASH_EQUIPPED_ITEM') {
                if (zone.items.length > 0) {
                    const trashedItem = zone.items.shift()!;
                    owner.trash.push(trashedItem);
                    engine.resetInteractionMode();
                    return;
                }
            }

            if (replacement.type === 'DISCARD_HAND_BY_HIT') {
                const requiredHandCount = replacement.requiredHandCount ?? Math.max(0, engine.getUnitHit(zone, owner));
                if (owner.hand.length >= requiredHandCount) {
                    engine.state.interactionMode = 'SELECT_COST';
                    engine.state.pendingEffect = {
                        sourceCard: replacement.sourceCard,
                        sourcePlayerId: owner.id,
                        controllerPlayerId: owner.id,
                        actionType: 'DESTRUCTION_REPLACEMENT_PAY_HAND',
                        actionValue: {
                            destroyPayload,
                            replacement,
                        },
                        effectDescription: replacement.description,
                        triggerReason: '파괴 대체 비용 지불',
                        selectionPurpose: '파괴 대체를 위한 패 코스트 지불',
                        costToPay: { type: 'TRASH_HAND', amount: requiredHandCount },
                        costPaidCount: 0,
                        selectedTargets: [],
                    };
                    engine.clearPendingRuntime();
                    engine.assignInteractionOwner(owner.id);
                    return;
                }
            }
        }
    }

    const nextIndex = index + 1;
    if (nextIndex < replacements.length) {
        beginDestroyReplacementPrompt(engine, destroyPayload, replacements, nextIndex);
        return;
    }

    executePendingDestroyPayload(engine, destroyPayload);
}
