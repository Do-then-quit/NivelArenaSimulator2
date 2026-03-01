import { ActivationCondition, CardType, type Card, type GameContext, type PendingEffect, type PlayerState, type UnitZoneState } from '../../types';

export type DestroyReason = 'BATTLE' | 'EFFECT' | 'RULE';

export interface DestroyPayload {
    targetPlayerId: string;
    zoneIndex: number;
    reason: DestroyReason;
    killerCard?: Card;
}

export interface DestroyReplacement {
    type:
    | 'TRASH_EQUIPPED_ITEM'
    | 'DISCARD_HAND_BY_HIT'
    | 'BT03_078_RETURN_WITH_ITEM_BOTTOM'
    | 'BT03_083_TRASH_SELF_AND_RETURN'
    | 'SB01_020_DISCARD_HAND_PREVENT_DESTROY';
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
    killerCard?: Card,
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

    zone.unit.effects?.forEach(effect => {
        if (effect.activation !== ActivationCondition.PASSIVE) return;
        if (effect.action?.type !== 'NONE') return;
        if (effect.action?.params?.destroyReplacement !== 'BT03_078_RETURN_WITH_ITEM_BOTTOM') return;
        if (!engine.effectManager.checkCondition(effect, unitContext)) return;
        if (player.trash.filter((card: any) => card.type === 'ITEM').length <= 0) return;

        replacements.push({
            type: 'BT03_078_RETURN_WITH_ITEM_BOTTOM',
            sourceCard: zone.unit!,
            description: effect.description || '트래시 아이템 1장을 덱 맨 아래에 두고 유닛/아이템을 패로 되돌린다.',
        });
    });

    zone.unit.effects?.forEach(effect => {
        if (effect.activation !== ActivationCondition.PASSIVE) return;
        if (effect.action?.type !== 'NONE') return;
        if (effect.action?.params?.destroyReplacement !== 'SB01_020_DISCARD_HAND_PREVENT_DESTROY') return;
        if (reason !== 'EFFECT') return;
        if (!killerCard) return;
        const killerOwner = engine.state.players.find((candidate: PlayerState) =>
            candidate.unitZones.some((candidateZone: UnitZoneState) =>
                candidateZone.unit === killerCard || candidateZone.items.includes(killerCard)
            )
        );
        if (!killerOwner || killerOwner.id === player.id) return;
        if (!engine.effectManager.checkCondition(effect, unitContext)) return;
        if (player.hand.length < 1) return;

        replacements.push({
            type: 'SB01_020_DISCARD_HAND_PREVENT_DESTROY',
            sourceCard: zone.unit!,
            requiredHandCount: 1,
            description: effect.description || '패 1장을 트래시하고 파괴를 대체한다.',
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

        item.effects?.forEach(effect => {
            if (effect.activation !== ActivationCondition.PASSIVE) return;
            if (effect.action?.type !== 'NONE') return;
            if (effect.action?.params?.destroyReplacement !== 'BT03_083_TRASH_SELF_AND_RETURN') return;
            if (!engine.effectManager.checkCondition(effect, itemContext)) return;

            const hasSelfGoggle = zone.items.some((equipped: any) => equipped?.id?.startsWith('BT03-083'));
            if (!hasSelfGoggle) return;

            replacements.push({
                type: 'BT03_083_TRASH_SELF_AND_RETURN',
                sourceCard: item,
                description: effect.description || '장착한 IX 고글 1장을 트래시하고 유닛/아이템을 패로 되돌린다.',
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

    const replacements = collectDestroyReplacements(engine, player, zone, reason, killerCard);
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
            if (replacement.type === 'BT03_078_RETURN_WITH_ITEM_BOTTOM') {
                const hasItemInTrash = owner.trash.some((card: any) => card?.type === 'ITEM');
                if (hasItemInTrash) {
                    engine.state.interactionMode = 'SELECT_TARGET';
                    engine.state.pendingEffect = {
                        sourceCard: replacement.sourceCard,
                        sourcePlayerId: owner.id,
                        controllerPlayerId: owner.id,
                        actionType: 'BT03_078_REPLACEMENT_SELECT_TRASH_ITEM_TO_BOTTOM',
                        actionValue: {
                            destroyPayload,
                            replacement,
                        },
                        effectDescription: replacement.description,
                        triggerReason: 'BT03-078 파괴 대체 처리',
                        selectionPurpose: '덱 맨 아래에 둘 트래시 아이템 선택',
                        validTargets: 'MY_TRASH',
                        targetSchema: {
                            scope: 'MY_TRASH',
                            type: 'CARD',
                            count: 1,
                            filters: [{ type: 'UNIT_TYPE', value: CardType.ITEM }],
                            selectMode: 'MANUAL',
                        } as any,
                        selectedTargets: [],
                    };
                    const context: any = {
                        sourceCard: replacement.sourceCard,
                        player: owner,
                        opponent: engine.getOpponentOf(owner),
                        unitZone: zone,
                        machine: engine,
                        trashReason: destroyPayload.reason,
                        flags: {
                            destroyPayload,
                            replacementSourceCardId: replacement.sourceCard.id,
                        },
                    };
                    engine.setPendingRuntime(context, null);
                    engine.assignInteractionOwner(owner.id);
                    return;
                }
            }

            if (replacement.type === 'BT03_083_TRASH_SELF_AND_RETURN') {
                const hasTarget = zone.items.some((equipped: any) => equipped?.id?.startsWith('BT03-083'));
                if (hasTarget) {
                    engine.state.interactionMode = 'SELECT_TARGET';
                    engine.state.pendingEffect = {
                        sourceCard: replacement.sourceCard,
                        sourcePlayerId: owner.id,
                        controllerPlayerId: owner.id,
                        actionType: 'BT03_083_REPLACEMENT_SELECT_EQUIPPED_ITEM_TO_TRASH',
                        actionValue: {
                            destroyPayload,
                            replacement,
                        },
                        effectDescription: replacement.description,
                        triggerReason: 'BT03-083 파괴 대체 처리',
                        selectionPurpose: '트래시할 IX 고글 선택',
                        validTargets: 'MY_FIELD_ITEMS',
                        targetSchema: {
                            scope: 'MY_FIELD_ITEMS',
                            type: 'CARD',
                            count: 1,
                            filters: [
                                { type: 'HAS_NAME', value: '코드 넘버 : IX 고글' },
                                { type: 'EQUIPPED_ON_SOURCE_UNIT' },
                            ],
                            selectMode: 'MANUAL',
                        } as any,
                        selectedTargets: [],
                    };
                    const context: any = {
                        sourceCard: replacement.sourceCard,
                        player: owner,
                        opponent: engine.getOpponentOf(owner),
                        unitZone: zone,
                        machine: engine,
                        trashReason: destroyPayload.reason,
                        flags: {
                            destroyPayload,
                            replacementSourceCardId: replacement.sourceCard.id,
                        },
                    };
                    engine.setPendingRuntime(context, null);
                    engine.assignInteractionOwner(owner.id);
                    return;
                }
            }

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

            if (replacement.type === 'SB01_020_DISCARD_HAND_PREVENT_DESTROY') {
                const requiredHandCount = replacement.requiredHandCount ?? 1;
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
