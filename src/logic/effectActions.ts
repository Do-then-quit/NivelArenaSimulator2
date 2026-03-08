import { ActionImplementation, ActivationCondition, Attribute, CardType, Phase, UnitZoneState } from './types';
import { TargetSelector } from './TargetSelector';
import {
    addDamageCountReferenceBonusThisTurn,
    autoAttackIfEncounter,
    damage,
    discard,
    discardAll,
    drawCard,
    drawDynamic,
    drawThenDiscard,
    destroySelf,
    gainLevel,
    lockSkillTraitUntilTurnEnd,
    lockSkillIdUntilTurnEnd,
    moveFromDamageToTrash,
    moveFromDamageToHand,
    moveFromHandToDamage,
    moveFromTrashToDamage,
    moveFromTrashToDeckBottom,
    moveFromTrashToDeckTop,
    noneAction,
    queueNextPlayUnitEffects,
    returnToHand,
    setTargetCostThisTurn,
    trashSelf,
} from './effectActions/core';
import {
    applyDualistMark,
    applyInfiltrationMark,
    buffHit,
    buffPower,
    buffPowerAndDrawIfTrashed,
    grantExtraAttackThisTurn,
    grantEffect,
    lockAttackUntilTurnEnd,
    sacrificeToBuff,
    setPower,
} from './effectActions/buff';
import {
    breakthrough,
    destroyEncounter,
    destroyLaneLowest,
    destroyUnit,
    destroyUnitAndDraw,
    destroyUnitAndDrawByHit,
    destroyUnitWithHitCost,
    drawByTargetHit,
    mutualDestruction,
    penetration,
    plunder,
    terminateAttack,
} from './effectActions/combat';
import {
    revealTopAndChooseToHand,
    revealTopAndTakeAllByFilter,
    revealTopPickToHandThenOrderBottom,
} from './effectActions/reveal';
import {
    destroyItem,
    moveFromTrashToHand,
    moveItemToDeckBottom,
    returnFromTrashAtTurnEnd,
    returnItemToHand,
    returnUnitAndItemsToHand,
} from './effectActions/transfer';
import { findItemLocation, getOwnerOfZone, zoneHasKeyword } from './effectActions/helpers';
import { RuleValidator } from './RuleValidator';

function effectHasPhaseAttackCondition(condition: any): boolean {
    if (!condition || typeof condition !== 'object') return false;

    if (condition.type === 'CONTEXT_FLAG') {
        const value = condition.value;
        if (value === 'PHASE_ATTACK') return true;
        if (value?.key === 'PHASE_ATTACK') {
            if (value.equals === undefined) return true;
            return value.equals === true;
        }
        return false;
    }

    if (condition.type === 'ALL' && Array.isArray(condition.value)) {
        return condition.value.some((nested: any) => effectHasPhaseAttackCondition(nested));
    }

    return false;
}

function createPromptOptionCard(id: string, name: string, text: string, imageUrl?: string) {
    return {
        id,
        name,
        type: CardType.SKILL,
        attribute: Attribute.NONE,
        cost: 0,
        text,
        imageUrl,
    };
}

function executeBt06FollowUpSubActions(engine: any, context: any, subActions: any[]) {
    if (!Array.isArray(subActions)) return;
    for (const sub of subActions) {
        if (!sub || !sub.type) continue;
        const followUpEffect = {
            activation: 'ACTIVE' as any,
            description: sub.description || 'BT04 follow-up',
            action: { type: sub.type, params: sub.params || {} },
            ...(sub.targets ? { targets: sub.targets } : {}),
            ...(sub.duration ? { duration: sub.duration } : {}),
        } as any;

        let followUpTargets: any[] = [];
        if (sub.targets) {
            followUpTargets = TargetSelector.resolve(engine, sub.targets, context);
        } else if (context.unitZone) {
            followUpTargets = [context.unitZone];
        }

        engine.effectManager.executeEffect(followUpEffect, context, followUpTargets);
    }
}

function resolveSelectedEffectSource(ctx: any, target: any, params: any) {
    if (target && typeof target === 'object' && 'unit' in target) {
        const sourceZone = target as UnitZoneState;
        const sourceOwner = getOwnerOfZone(ctx.machine, sourceZone);
        const sourceOpponent = sourceOwner ? ctx.machine.state.players.find((player: any) => player.id !== sourceOwner.id) : null;
        return {
            sourceCard: sourceZone.unit,
            sourcePlayer: sourceOwner,
            sourceOpponent,
            sourceZone,
            sourceArea: 'FIELD',
        };
    }

    if (target && typeof target === 'object' && 'type' in target) {
        const ownerRole = (params as any).targetOwner === 'OPPONENT' ? 'OPPONENT' : 'SELF';
        const sourcePlayer = ownerRole === 'OPPONENT' ? ctx.opponent : ctx.player;
        const sourceOpponent = ownerRole === 'OPPONENT' ? ctx.player : ctx.opponent;
        return {
            sourceCard: target,
            sourcePlayer,
            sourceOpponent,
            sourceZone: undefined,
            sourceArea: (params as any).targetArea || 'CARD',
        };
    }

    return null;
}

function buildActivatableEffectOptions(ctx: any, target: any, params: any) {
    const source = resolveSelectedEffectSource(ctx, target, params);
    if (!source?.sourceCard || !source.sourcePlayer || !source.sourceOpponent) return [];

    const activationSet = new Set(
        (Array.isArray((params as any).activations) ? (params as any).activations : [(params as any).activation])
            .filter((activation: any) => !!activation)
            .map((activation: any) => String(activation))
    );
    if (activationSet.size <= 0) return [];

    return (source.sourceCard.effects || [])
        .map((effect: any, effectIndex: number) => ({ effect, effectIndex }))
        .filter(({ effect }: { effect: any; effectIndex: number }) => {
            if (!effect || !activationSet.has(String(effect.activation))) return false;

            const effectContext = {
                sourceCard: source.sourceCard,
                player: source.sourcePlayer,
                opponent: source.sourceOpponent,
                ...(source.sourceZone ? { unitZone: source.sourceZone } : {}),
                machine: ctx.machine,
            };

            if (!ctx.machine.effectManager.checkCondition(effect, effectContext)) return false;

            if (effect.cost && effect.cost.type !== 'NONE') {
                if (effect.cost.type === 'TRASH_HAND' || effect.cost.type === 'SHUFFLE_HAND_TO_DECK') {
                    const requiredAmount = effect.cost.amount || 1;
                    const costFilter = effect.cost.cardTypeFilter;
                    const payableCount = source.sourcePlayer.hand.filter((card: any) => !costFilter || card.type === costFilter).length;
                    if (payableCount < requiredAmount) return false;
                }
            }

            if (effect.targets && effect.targets.selectMode === 'MANUAL') {
                const candidates = TargetSelector.resolve(ctx.machine, effect.targets, effectContext);
                if (candidates.length === 0) return false;
            }

            return true;
        })
        .map(({ effect, effectIndex }: { effect: any; effectIndex: number }) => ({
            effect,
            effectIndex,
            sourcePlayerId: source.sourcePlayer.id,
            sourceZoneIndex: source.sourceZone ? source.sourcePlayer.unitZones.indexOf(source.sourceZone) : undefined,
            sourceCardId: source.sourceCard.id,
            sourceCardRef: source.sourceCard,
            sourceArea: source.sourceArea,
            preMoveToDeckBottom: (params as any).preMoveToDeckBottom === true,
        }));
}

function getCardCost(machine: any, card: any): number {
    if (!card) return 0;
    if (typeof machine?.getCardCost === 'function') {
        return machine.getCardCost(card);
    }
    return Math.max(0, Number(card.cost || 0));
}

function cardHasKeywordLike(card: any, keyword: string): boolean {
    if (!card || !keyword) return false;
    if (Array.isArray(card.keywords) && card.keywords.includes(keyword)) return true;
    if (Array.isArray(card.effects)) {
        return card.effects.some((effect: any) => String(effect?.description || '').includes(keyword));
    }
    return false;
}

function zoneHasKeywordLike(zone: any, keyword: string): boolean {
    if (!zone || !zone.unit || !keyword) return false;
    if (cardHasKeywordLike(zone.unit, keyword)) return true;

    if (Array.isArray(zone.items)) {
        for (const item of zone.items) {
            if (cardHasKeywordLike(item, keyword)) return true;
        }
    }

    if (Array.isArray(zone.temporaryEffects)) {
        for (const effect of zone.temporaryEffects) {
            if (String(effect?.description || '').includes(keyword)) return true;
        }
    }

    return false;
}

function countFriendlyExitUnits(player: any): number {
    return player.unitZones.filter((zone: any) => zone?.unit && zoneHasKeywordLike(zone, '엑시트')).length;
}

function cardHasTraitLike(card: any, trait: string): boolean {
    if (!card || !trait) return false;
    if (Array.isArray(card.traits)) {
        return card.traits.some((entry: unknown) => String(entry ?? '').includes(trait));
    }
    return String(card.traits || '').includes(trait);
}

function countFriendlyTraitAttacks(ctx: any, trait: string): number {
    if (typeof ctx.machine?.getTraitAttackCountThisTurn !== 'function') return 0;
    return Math.max(0, Number(ctx.machine.getTraitAttackCountThisTurn(ctx.player.id, trait) || 0));
}

function trashTopCards(player: any, count: number): any[] {
    const trashed: any[] = [];
    for (let i = 0; i < count; i++) {
        if (player.deck.length <= 0) break;
        const card = player.deck.pop();
        if (!card) break;
        player.trash.push(card);
        trashed.push(card);
    }
    return trashed;
}

function resetUnitZoneForPlacement(zone: any, unit: any) {
    zone.unit = unit;
    zone.items = [];
    zone.buffs = [];
    zone.temporaryEffects = [];
    zone.hasAttacked = false;
    zone.attackCountThisTurn = 0;
    zone.extraAttackAllowance = 0;
    zone.isExhausted = false;
    zone.hasPlacedUnitThisTurn = false;
    zone.hasActivatedEffectThisTurn = false;
    zone.activatedEffectKeys = {};
}

function deployUnitToFirstEmptyZone(engine: any, player: any, unit: any, options?: { triggerEntry?: boolean }) {
    if (!unit) return null;
    const emptyZone = player.unitZones.find((zone: any) => !zone?.unit);
    if (!emptyZone) return null;
    resetUnitZoneForPlacement(emptyZone, unit);
    if (options?.triggerEntry !== false) {
        engine.triggerEntryEffectsForPlacedUnit(player, emptyZone);
    }
    return emptyZone;
}

function triggerBottomToDeckPassives(engine: any, player: any, sourceZone: any, movedHit: number) {
    if (!engine || !player || movedHit <= 0) return;
    const opponent = engine.state.players.find((candidate: any) => candidate.id !== player.id);
    if (!opponent) return;

    player.unitZones.forEach((zone: any) => {
        if (!zone?.unit || zone === sourceZone) return;
        const hasPassive = (zone.unit.effects || []).some((effect: any) =>
            effect?.activation === ActivationCondition.PASSIVE &&
            effect.action?.type === 'NONE' &&
            effect.action?.params?.onFriendlyFieldUnitBottomToDeckDamageByHitOncePerTurn === true
        );
        if (!hasPassive) return;

        const lastTriggeredTurnCount = (zone.unit as any).st09_006LastTriggeredTurnCount;
        if (lastTriggeredTurnCount === engine.state.turnCount) return;

        (zone.unit as any).st09_006LastTriggeredTurnCount = engine.state.turnCount;
        engine.dealDamage(opponent, movedHit);
    });
}

function moveUnitZoneToDeckBottom(engine: any, player: any, zone: any) {
    if (!player || !zone?.unit) return null;
    const movedHit =
        engine && typeof engine.getUnitHit === 'function'
            ? Math.max(0, Number(engine.getUnitHit(zone, player) || 0))
            : Math.max(0, Number(zone.unit?.hit || 0));
    const movedUnit = zone.unit;
    zone.unit = null;
    if (Array.isArray(zone.items) && zone.items.length > 0) {
        player.trash.push(...zone.items);
    }
    zone.items = [];
    zone.buffs = [];
    zone.temporaryEffects = [];
    zone.hasAttacked = false;
    zone.attackCountThisTurn = 0;
    zone.extraAttackAllowance = 0;
    zone.isExhausted = false;
    zone.hasPlacedUnitThisTurn = false;
    zone.hasActivatedEffectThisTurn = false;
    zone.activatedEffectKeys = {};
    player.deck.unshift(movedUnit);
    triggerBottomToDeckPassives(engine, player, zone, movedHit);
    return movedUnit;
}

function resolveAttributeValue(raw: unknown): Attribute | null {
    if (typeof raw !== 'string') return null;
    const normalized = String(raw).trim().toUpperCase();
    const aliasMap: Record<string, Attribute> = {
        '화염': Attribute.FIRE,
        '대지': Attribute.EARTH,
        '폭풍': Attribute.STORM,
        '파도': Attribute.WATER,
        '번개': Attribute.LIGHTNING,
        '없음': Attribute.NONE,
        'FIRE': Attribute.FIRE,
        'EARTH': Attribute.EARTH,
        'STORM': Attribute.STORM,
        'WATER': Attribute.WATER,
        'LIGHTNING': Attribute.LIGHTNING,
        'NONE': Attribute.NONE,
    };
    return aliasMap[normalized] ?? null;
}

function createComplexRuntimeEffect(
    targetSchema: any,
    description: string,
    params: Record<string, any>,
    activation: ActivationCondition | string = ActivationCondition.ACTIVE,
) {
    return {
        activation,
        description,
        targets: targetSchema,
        action: {
            type: 'COMPLEX_ACTION',
            params,
        },
    } as any;
}

function beginTargetSelection(
    ctx: any,
    options: {
        actionType: string;
        effectDescription: string;
        validTargets: any;
        targetSchema: any;
        actionValue?: Record<string, any>;
        controllerPlayerId?: string;
    },
    runtimeEffect: any,
) {
    const controllerPlayerId = options.controllerPlayerId ?? ctx.player.id;
    ctx.machine.state.interactionMode = 'SELECT_TARGET';
    ctx.machine.state.pendingEffect = {
        sourceCard: ctx.sourceCard,
        sourcePlayerId: ctx.player.id,
        controllerPlayerId,
        actionType: options.actionType,
        actionValue: options.actionValue || {},
        effectDescription: options.effectDescription,
        validTargets: options.validTargets,
        targetSchema: options.targetSchema,
        selectedTargets: [],
    };
    ctx.machine.setPendingRuntime(ctx, runtimeEffect || null);
    ctx.machine.setInteractionOwner(controllerPlayerId);
}

function removeCardFromArrayByRefOrId(cards: any[], cardRef: any, cardId?: string) {
    const directIndex = cards.indexOf(cardRef);
    if (directIndex !== -1) {
        const [removed] = cards.splice(directIndex, 1);
        return removed;
    }
    if (cardId) {
        const idIndex = cards.findIndex((card: any) => card?.id === cardId);
        if (idIndex !== -1) {
            const [removed] = cards.splice(idIndex, 1);
            return removed;
        }
    }
    return null;
}

function equipItemIgnoringSize(
    ctx: any,
    unitZone: UnitZoneState,
    item: any,
    options?: {
        sourceActivation?: ActivationCondition | string;
        sourcePlayerId?: string;
        sourceCardId?: string;
    },
) {
    if (!unitZone?.unit || !item || item.type !== CardType.ITEM) return false;

    const duplicateName = unitZone.items.some((equipped: any) => equipped?.name && equipped.name === item.name);
    if (duplicateName) return false;

    const equipValid = RuleValidator.validateItemEquipConditions(ctx.machine, ctx.player, unitZone, item).valid;
    if (!equipValid) return false;

    unitZone.items.push(item);
    ctx.machine.notifyItemsEquipped(ctx.player, unitZone, [item], {
        sourceActivation: options?.sourceActivation,
        sourcePlayerId: options?.sourcePlayerId ?? ctx.player.id,
        sourceCardId: options?.sourceCardId ?? ctx.sourceCard.id,
    });
    return true;
}

function getValidEquipZoneIndexesForItem(
    ctx: any,
    item: any,
    options?: {
        excludeZone?: UnitZoneState | null;
    },
) {
    if (!item || item.type !== CardType.ITEM) return [] as number[];
    return ctx.player.unitZones
        .map((zone: UnitZoneState, zoneIndex: number) => ({ zone, zoneIndex }))
        .filter(({ zone }) => {
            if (!zone?.unit) return false;
            if (options?.excludeZone && zone === options.excludeZone) return false;
            const duplicateName = zone.items.some((equipped: any) => equipped?.name && equipped.name === item.name);
            if (duplicateName) return false;
            return RuleValidator.validateItemEquipConditions(ctx.machine, ctx.player, zone, item).valid;
        })
        .map(({ zoneIndex }) => zoneIndex);
}

function hasNonAttributeCardOnField(player: any, rawAttribute: unknown): boolean {
    const attribute = resolveAttributeValue(rawAttribute);
    if (!attribute) return false;
    return player.unitZones.some((zone: any) =>
        (zone?.unit && zone.unit.attribute !== attribute) ||
        (zone?.items || []).some((item: any) => item?.attribute !== attribute)
    ) || player.skillZone.some((card: any) => card?.attribute !== attribute);
}

const complexAction: ActionImplementation = (ctx, params, _targets) => {
    if (
        (params as any).mode === 'ST08_001_AWAKEN_OPPONENT_DRAW_IF_NON_EARTH_PRESENT' ||
        (params as any).mode === 'PROMPT_OPPONENT_DRAW_IF_FIELD_HAS_NON_ATTRIBUTE'
    ) {
        const stage = (params as any).stage;
        if (stage === 'FINALIZE') {
            if ((ctx as any)._optionalConfirmed !== true) return;
            drawCard(ctx, { count: 1, target: 'OPPONENT', __sourceActivation: ActivationCondition.AWAKEN }, _targets);
            return;
        }

        const attribute = (params as any).attribute ?? Attribute.EARTH;
        if (!hasNonAttributeCardOnField(ctx.player, attribute)) return;
        ctx.machine.state.interactionMode = 'SELECT_OPTIONAL';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.opponent.id,
            actionType: 'COMPLEX_ACTION',
            actionValue: {
                mode: (params as any).mode,
                stage: 'FINALIZE',
                attribute,
            },
            effectDescription: '상대는 카드를 1장 드로우할 수 있다.',
            selectionPurpose: '상대의 드로우 여부 선택',
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: ActivationCondition.AWAKEN,
            optional: true,
            description: 'ST08-001 awaken opponent may draw',
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: (params as any).mode,
                    stage: 'FINALIZE',
                    attribute,
                },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.opponent.id);
        return;
    }

    if ((params as any).mode === 'MOVE_SELF_TO_DECK_BOTTOM_THEN_SUBACTIONS') {
        const sourceZone = ctx.player.unitZones.find((zone: any) => zone?.unit === ctx.sourceCard);
        if (!sourceZone) return;
        const movedUnit = moveUnitZoneToDeckBottom(ctx.machine, ctx.player, sourceZone);
        if (!movedUnit) return;
        executeBt06FollowUpSubActions(ctx.machine, ctx, (params as any).subActions || []);
        return;
    }

    if ((params as any).mode === 'ST09_005_END_TURN_DISCARD_TO_7_AND_DAMAGE') {
        const stage = (params as any).stage;
        if (stage === 'RESOLVE') {
            const requiredCount = Math.max(0, Number((params as any).requiredCount ?? 0));
            const selectedCards = (_targets || []).filter((card: any) => ctx.player.hand.includes(card));
            if (requiredCount <= 0 || selectedCards.length !== requiredCount) return;

            const trashedCards: any[] = [];
            selectedCards.forEach((card: any) => {
                const handIndex = ctx.player.hand.indexOf(card);
                if (handIndex === -1) return;
                const [removed] = ctx.player.hand.splice(handIndex, 1);
                if (!removed) return;
                ctx.player.trash.push(removed);
                trashedCards.push(removed);
            });

            if (trashedCards.length > 0) {
                ctx.machine.notifyHandTrashed(ctx.player, trashedCards, {
                    flags: { handTrashByEffect: true },
                });
                ctx.machine.dealDamage(ctx.opponent, trashedCards.length);
            }
            return;
        }

        const discardCount = Math.max(0, ctx.player.hand.length - 7);
        if (discardCount <= 0) return;

        const handSelectionSchema = {
            scope: 'MY_HAND',
            type: 'CARD',
            count: discardCount,
            selectMode: 'MANUAL',
        } as const;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'ST09_005_SELECT_HAND_TO_DISCARD_TO_7',
            actionValue: { allowPartialSelection: false, requiredCount: discardCount },
            effectDescription: `패가 7장이 되도록 ${discardCount}장을 선택해 트래시한다.`,
            validTargets: 'MY_HAND',
            targetSchema: handSelectionSchema,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: ActivationCondition.TURN_END,
            description: 'ST09-005 resolve discard and damage',
            targets: handSelectionSchema as any,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'ST09_005_END_TURN_DISCARD_TO_7_AND_DAMAGE',
                    stage: 'RESOLVE',
                    requiredCount: discardCount,
                },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'ST09_007_ENABLE_DRAW_ON_EFFECT_DAMAGE') {
        const current = Math.max(0, Number((ctx.player as any).st09_007DrawOnEffectDamageUntilTurnCount || 0));
        (ctx.player as any).st09_007DrawOnEffectDamageUntilTurnCount = Math.max(current, ctx.machine.state.turnCount);
        ctx.player.lockedSkillIdsUntilTurnEnd = {
            ...(ctx.player.lockedSkillIdsUntilTurnEnd || {}),
            [ctx.sourceCard.id]: true,
        };
        return;
    }

    if ((params as any).mode === 'ST09_008_TRIGGER_REVEAL1_OPTIONAL_CAST_SKILL') {
        if (ctx.player.deck.length <= 0) return;
        const revealed = ctx.player.deck.pop();
        if (!revealed) return;

        if (revealed.type !== CardType.SKILL) {
            ctx.player.hand.push(revealed);
            return;
        }

        ctx.player.trash.push(revealed);
        ctx.machine.state.revealedCards = [revealed] as any;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT06_SELECT_TRASHED_SKILL_TO_CAST',
            actionValue: {
                allowPartialSelection: true,
                returnSkippedSkillToHand: true,
            },
            effectDescription: '공개한 스킬을 발동할지 선택한다. 선택하지 않으면 패에 넣는다.',
            validTargets: 'REVEALED',
            targetSchema: {
                scope: 'REVEALED',
                type: 'CARD',
                count: 1,
                selectMode: 'MANUAL',
            },
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, null);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if (
        (params as any).mode === 'ST09_012_ENTRY_DESTROY_PAIR' ||
        (params as any).mode === 'ST09_015_DESTROY_PAIR_LOWER_COST'
    ) {
        const excludeSelf = (params as any).mode === 'ST09_012_ENTRY_DESTROY_PAIR';
        const operator = excludeSelf ? 'LTE' : 'LT';
        const targetSchema = {
            scope: 'MY_FIELD',
            type: 'UNIT',
            count: 1,
            filters: excludeSelf ? [{ type: 'EXCLUDE_SELF' }] : [],
            selectMode: 'MANUAL',
        } as const;

        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'PAIR_DESTROY_SELECT_FRIENDLY',
            actionValue: {
                operator,
                excludeSelf,
            },
            effectDescription: '기준이 될 자신 유닛을 선택한다.',
            validTargets: 'MY_UNITS',
            targetSchema: targetSchema as any,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, null);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'PROMPT_SELECT_TARGET_EFFECT_TO_ACTIVATE') {
        const selectedTarget = (_targets || [])[0];
        const options = buildActivatableEffectOptions(ctx, selectedTarget, params);
        if (options.length <= 0) return;

        const executeSingleOption = (option: any) => {
            const sourcePlayer = ctx.machine.getPlayerById(option.sourcePlayerId);
            if (!sourcePlayer) return;
            const sourceOpponent = ctx.machine.state.players.find((player: any) => player.id !== sourcePlayer.id);
            if (!sourceOpponent) return;

            const sourceZone = typeof option.sourceZoneIndex === 'number'
                ? sourcePlayer.unitZones[option.sourceZoneIndex]
                : undefined;
            const sourceCard = sourceZone?.unit?.id === option.sourceCardId
                ? sourceZone.unit
                : option.sourceCardRef;
            if (!sourceCard) return;

            if (option.preMoveToDeckBottom === true && !sourceZone) {
                const trashIndex = sourcePlayer.trash.indexOf(sourceCard);
                if (trashIndex !== -1) {
                    const [removed] = sourcePlayer.trash.splice(trashIndex, 1);
                    if (removed) {
                        sourcePlayer.deck.unshift(removed);
                    }
                } else {
                    const revealedIndex = ctx.machine.state.revealedCards.indexOf(sourceCard);
                    if (revealedIndex !== -1) {
                        const [removed] = ctx.machine.state.revealedCards.splice(revealedIndex, 1);
                        if (removed) {
                            sourcePlayer.deck.unshift(removed);
                        }
                    }
                }
            }

            const effectContext = {
                sourceCard,
                player: sourcePlayer,
                opponent: sourceOpponent,
                ...(sourceZone ? { unitZone: sourceZone } : {}),
                machine: ctx.machine,
            };
            if (
                sourceCard.type === CardType.SKILL &&
                (option.effect?.activation === ActivationCondition.ACTIVE || option.effect?.activation === ActivationCondition.ACTIVE_MAIN) &&
                typeof ctx.machine.recordSkillActivation === 'function'
            ) {
                ctx.machine.recordSkillActivation(sourcePlayer.id);
            }
            ctx.machine.effectManager.processEffect(option.effect, effectContext);
        };

        if (options.length === 1) {
            executeSingleOption(options[0]);
            return;
        }

        ctx.machine.state.revealedCards = options.map((option: any, optionIndex: number) =>
            createPromptOptionCard(
                `GENERIC_EFFECT_OPTION_${option.sourceCardId}_${option.effectIndex}_${optionIndex}`,
                `${option.sourceCardId} 효과 ${option.effectIndex + 1}`,
                option.effect?.description || '발동할 효과를 선택한다.'
            )
        ) as any;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'GENERIC_SELECT_ACTIVATABLE_EFFECT',
            actionValue: { options },
            effectDescription: '발동할 효과를 선택한다.',
            validTargets: 'REVEALED',
            targetSchema: {
                scope: 'REVEALED',
                type: 'CARD',
                count: 1,
                selectMode: 'MANUAL',
            },
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, null);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'BT05_005_ESCAPE_DEBUFF_UP_TO_TWO_THEN_BOTTOM') {
        const stage = (params as any).stage;
        if (stage === 'RESOLVE') {
            const sourceZone = ctx.player.unitZones.find((zone: any) => zone?.unit === ctx.sourceCard);
            if (!sourceZone?.unit) return;

            const sourcePower = ctx.machine.getUnitPower(sourceZone, ctx.player);
            (_targets || []).forEach((targetZone: any) => {
                if (!targetZone?.unit) return;
                buffPower(ctx, { value: -sourcePower, duration: 'TURN_END' }, [targetZone]);
            });
            moveUnitZoneToDeckBottom(ctx.machine, ctx.player, sourceZone);
            return;
        }

        const sourceZone = ctx.player.unitZones.find((zone: any) => zone?.unit === ctx.sourceCard);
        if (!sourceZone?.unit) return;
        const targetSchema = {
            scope: 'OPP_FIELD',
            type: 'UNIT',
            count: 2,
            selectMode: 'MANUAL',
        } as const;
        const candidates = TargetSelector.resolve(ctx.machine, targetSchema as any, ctx);
        if (candidates.length <= 0) {
            moveUnitZoneToDeckBottom(ctx.machine, ctx.player, sourceZone);
            return;
        }

        beginTargetSelection(
            ctx,
            {
                actionType: 'BT05_005_SELECT_OPP_UNITS',
                effectDescription: '파워를 감소시킬 상대 유닛을 최대 2장까지 선택한다.',
                validTargets: 'OPP_UNITS',
                targetSchema,
                actionValue: {
                    allowPartialSelection: true,
                    minSelection: 0,
                    maxSelection: 2,
                },
            },
            createComplexRuntimeEffect(
                targetSchema,
                'BT05-005 resolve escape debuff',
                {
                    mode: 'BT05_005_ESCAPE_DEBUFF_UP_TO_TWO_THEN_BOTTOM',
                    stage: 'RESOLVE',
                },
                ActivationCondition.ESCAPE,
            ),
        );
        return;
    }

    if ((params as any).mode === 'BT05_008_REPEAT_TARGET_DEBUFF_BY_SKILL_COUNT') {
        const stage = (params as any).stage;
        if (stage === 'RESOLVE') {
            const targetZone = (_targets || [])[0] as UnitZoneState | undefined;
            if (targetZone?.unit) {
                buffPower(ctx, { value: -2000, duration: 'TURN_END' }, [targetZone]);
            }

            const remaining = Math.max(0, Number((params as any).remaining ?? 1) - 1);
            if (remaining <= 0) return;

            const targetSchema = {
                scope: 'OPP_FIELD',
                type: 'UNIT',
                count: 1,
                selectMode: 'MANUAL',
            } as const;
            const candidates = TargetSelector.resolve(ctx.machine, targetSchema as any, ctx);
            if (candidates.length <= 0) return;

            beginTargetSelection(
                ctx,
                {
                    actionType: 'BT05_008_SELECT_OPP_UNIT',
                    effectDescription: '파워를 감소시킬 상대 유닛을 선택한다.',
                    validTargets: 'OPP_UNITS',
                    targetSchema,
                },
                createComplexRuntimeEffect(
                    targetSchema,
                    'BT05-008 resolve repeated debuff',
                    {
                        mode: 'BT05_008_REPEAT_TARGET_DEBUFF_BY_SKILL_COUNT',
                        stage: 'RESOLVE',
                        remaining,
                    },
                    ActivationCondition.ACTIVE_MAIN,
                ),
            );
            return;
        }

        const repeatCount = 1 + Math.max(
            0,
            typeof ctx.machine.getSkillActivationCountThisTurn === 'function'
                ? ctx.machine.getSkillActivationCountThisTurn(ctx.player.id)
                : 0,
        );
        if (repeatCount <= 0) return;
        const targetSchema = {
            scope: 'OPP_FIELD',
            type: 'UNIT',
            count: 1,
            selectMode: 'MANUAL',
        } as const;
        if (TargetSelector.resolve(ctx.machine, targetSchema as any, ctx).length <= 0) return;

        beginTargetSelection(
            ctx,
            {
                actionType: 'BT05_008_SELECT_OPP_UNIT',
                effectDescription: '파워를 감소시킬 상대 유닛을 선택한다.',
                validTargets: 'OPP_UNITS',
                targetSchema,
            },
            createComplexRuntimeEffect(
                targetSchema,
                'BT05-008 resolve repeated debuff',
                {
                    mode: 'BT05_008_REPEAT_TARGET_DEBUFF_BY_SKILL_COUNT',
                    stage: 'RESOLVE',
                    remaining: repeatCount,
                },
                ActivationCondition.ACTIVE_MAIN,
            ),
        );
        return;
    }

    if ((params as any).mode === 'BT05_009_ATTACKER_DEBUFF_AND_RECOVER_IF_DESTROYED') {
        const stage = (params as any).stage;
        if (stage === 'RECOVER') {
            moveFromTrashToHand(ctx, {}, _targets || []);
            return;
        }

        if (!ctx.unitZone?.unit) return;
        const laneIndex = ctx.player.unitZones.indexOf(ctx.unitZone);
        if (laneIndex < 0) return;
        const encounterZone = ctx.opponent.unitZones[laneIndex];
        if (!encounterZone?.unit) return;

        const encounterBefore = encounterZone.unit;
        buffPower(ctx, { value: -4000, duration: 'BATTLE_END' }, [encounterZone]);

        let destroyed = false;
        if (encounterZone.unit && ctx.machine.getUnitPower(encounterZone, ctx.opponent) <= 0) {
            ctx.machine.destroyUnit(ctx.opponent, encounterZone, undefined, 'EFFECT');
            destroyed = ctx.opponent.trash.includes(encounterBefore);
        }
        if (!destroyed) return;

        const targetSchema = {
            scope: 'MY_TRASH',
            type: 'CARD',
            count: 1,
            filters: [
                { type: 'UNIT_TYPE', value: CardType.SKILL },
                { type: 'NOT_HAS_KEYWORD', value: '트리거' },
                { type: 'COST_LIMIT', value: 2 },
            ],
            selectMode: 'MANUAL',
        } as const;
        if (TargetSelector.resolve(ctx.machine, targetSchema as any, ctx).length <= 0) return;

        beginTargetSelection(
            ctx,
            {
                actionType: 'BT05_009_SELECT_TRASH_SKILL',
                effectDescription: '패에 넣을 스킬을 선택한다.',
                validTargets: 'MY_TRASH',
                targetSchema,
            },
            createComplexRuntimeEffect(
                targetSchema,
                'BT05-009 recover skill from trash',
                {
                    mode: 'BT05_009_ATTACKER_DEBUFF_AND_RECOVER_IF_DESTROYED',
                    stage: 'RECOVER',
                },
                ActivationCondition.ATTACKER,
            ),
        );
        return;
    }

    if ((params as any).mode === 'BT05_010_ENTRY_BOTTOM_CARD_AND_REPEAT_ENCOUNTER_DEBUFF') {
        const selectedCard = (_targets || []).find((card: any) => ctx.player.trash.includes(card));
        if (!selectedCard) return;

        const trashIndex = ctx.player.trash.indexOf(selectedCard);
        if (trashIndex === -1) return;
        const [removed] = ctx.player.trash.splice(trashIndex, 1);
        if (removed) {
            ctx.player.deck.unshift(removed);
        }

        if (!ctx.unitZone?.unit) return;
        const laneIndex = ctx.player.unitZones.indexOf(ctx.unitZone);
        if (laneIndex < 0) return;
        const encounterZone = ctx.opponent.unitZones[laneIndex];
        if (!encounterZone?.unit) return;
        buffPower(ctx, { value: -2000, duration: 'TURN_END' }, [encounterZone]);
        return;
    }

    if ((params as any).mode === 'BT05_011_ENTRY_TRASH_SKILL_AND_CAST') {
        const stage = (params as any).stage;
        if (stage === 'RESOLVE') {
            const selectedSkill = (_targets || [])[0];
            ctx.machine.state.revealedCards = [];
            if (!selectedSkill) return;

            const removed = removeCardFromArrayByRefOrId(ctx.player.skillZone, selectedSkill, selectedSkill?.id);
            if (!removed) return;
            ctx.player.trash.push(removed);
            if (typeof ctx.machine.recordSkillActivation === 'function') {
                ctx.machine.recordSkillActivation(ctx.player.id);
            }
            ctx.machine.effectManager.processEffects(ActivationCondition.ACTIVE, {
                sourceCard: removed,
                player: ctx.player,
                opponent: ctx.opponent,
                machine: ctx.machine,
            });
            return;
        }

        const skillCandidates = ctx.player.skillZone.filter((card: any) =>
            card?.type === CardType.SKILL && getCardCost(ctx.machine, card) >= 2,
        );
        if (skillCandidates.length < 2) return;

        ctx.machine.state.revealedCards = [...skillCandidates];
        const targetSchema = {
            scope: 'REVEALED',
            type: 'CARD',
            count: 1,
            selectMode: 'MANUAL',
        } as const;
        beginTargetSelection(
            ctx,
            {
                actionType: 'BT05_011_SELECT_SKILL',
                effectDescription: '트래시할 스킬을 선택한다.',
                validTargets: 'REVEALED',
                targetSchema,
            },
            createComplexRuntimeEffect(
                targetSchema,
                'BT05-011 trash skill and cast',
                {
                    mode: 'BT05_011_ENTRY_TRASH_SKILL_AND_CAST',
                    stage: 'RESOLVE',
                },
                ActivationCondition.ENTRY,
            ),
        );
        return;
    }

    if ((params as any).mode === 'BT05_013_RECOVER_LOWER_COST_THEN_BOTTOM_TARGET') {
        const stage = (params as any).stage;
        if (stage === 'RECOVER') {
            moveFromTrashToHand(ctx, {}, _targets || []);
            const selectedZone = ctx.flags?.BT05_013_SELECTED_ZONE as unknown as UnitZoneState | undefined;
            if (selectedZone?.unit) {
                moveUnitZoneToDeckBottom(ctx.machine, ctx.player, selectedZone);
            }
            return;
        }

        const selectedZone = (_targets || [])[0] as UnitZoneState | undefined;
        if (!selectedZone?.unit) return;
        ctx.flags = ctx.flags || {};
        ctx.flags.BT05_013_SELECTED_ZONE = selectedZone as any;

        const targetSchema = {
            scope: 'MY_TRASH',
            type: 'CARD',
            count: 1,
            filters: [
                { type: 'NOT_HAS_KEYWORD', value: '트리거' },
                { type: 'COST_LOWER_THAN_COST_PAYMENT' },
            ],
            selectMode: 'MANUAL',
        } as const;
        ctx.costPaymentCard = selectedZone.unit;
        const candidates = TargetSelector.resolve(ctx.machine, targetSchema as any, ctx);
        if (candidates.length <= 0) {
            moveUnitZoneToDeckBottom(ctx.machine, ctx.player, selectedZone);
            return;
        }

        beginTargetSelection(
            ctx,
            {
                actionType: 'BT05_013_SELECT_TRASH_CARD',
                effectDescription: '패에 넣을 카드를 선택한다.',
                validTargets: 'MY_TRASH',
                targetSchema,
            },
            createComplexRuntimeEffect(
                targetSchema,
                'BT05-013 recover lower-cost card',
                {
                    mode: 'BT05_013_RECOVER_LOWER_COST_THEN_BOTTOM_TARGET',
                    stage: 'RECOVER',
                },
                ActivationCondition.ACTIVE,
            ),
        );
        return;
    }

    if ((params as any).mode === 'BT05_015_GRANT_TRASHED_MOVE_SKILL_TO_DAMAGE') {
        const targetZone = (_targets || [])[0] as UnitZoneState | undefined;
        if (!targetZone?.unit) return;

        targetZone.temporaryEffects.push({
            activation: ActivationCondition.EXIT,
            description: '엑시트 : 자신의 트래시 존에 있는 이 카드를 대미지 존에 놓는다.',
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT05_015_MOVE_STORED_SKILL_FROM_TRASH_TO_DAMAGE',
                    sourceCardRef: ctx.sourceCard,
                    sourceCardId: ctx.sourceCard.id,
                },
            },
            duration: 'TURN_END',
        } as any);
        return;
    }

    if ((params as any).mode === 'BT05_015_MOVE_STORED_SKILL_FROM_TRASH_TO_DAMAGE') {
        const sourceCardRef = (params as any).sourceCardRef;
        const sourceCardId = (params as any).sourceCardId;
        const moved = removeCardFromArrayByRefOrId(ctx.player.trash, sourceCardRef, sourceCardId);
        if (!moved) return;
        ctx.player.damage.push(moved);
        if (typeof ctx.machine.recordDamagePlacedByEffect === 'function') {
            ctx.machine.recordDamagePlacedByEffect(ctx.player.id, 'TRASH', 1);
        }
        return;
    }

    if ((params as any).mode === 'BT05_019_REVEAL_BY_HIT_PICK_AND_BOTTOM_TARGET') {
        const stage = (params as any).stage;
        if (stage === 'RESOLVE_PICK') {
            const selectedCard = (_targets || [])[0];
            const targetZone = ctx.flags?.BT05_019_SELECTED_ZONE as unknown as UnitZoneState | undefined;
            const selectedIndex = ctx.machine.state.revealedCards.indexOf(selectedCard);
            if (selectedIndex !== -1) {
                const [movedCard] = ctx.machine.state.revealedCards.splice(selectedIndex, 1);
                if (movedCard) {
                    ctx.player.hand.push(movedCard);
                }
            }
            if (ctx.machine.state.revealedCards.length > 0) {
                ctx.player.trash.push(...ctx.machine.state.revealedCards);
            }
            ctx.machine.state.revealedCards = [];
            if (targetZone?.unit) {
                moveUnitZoneToDeckBottom(ctx.machine, ctx.player, targetZone);
            }
            return;
        }

        const selectedZone = (_targets || [])[0] as UnitZoneState | undefined;
        if (!selectedZone?.unit) return;
        ctx.flags = ctx.flags || {};
        ctx.flags.BT05_019_SELECTED_ZONE = selectedZone as any;

        const revealCount = Math.max(0, ctx.machine.getUnitHit(selectedZone, ctx.player));
        if (revealCount <= 0) {
            moveUnitZoneToDeckBottom(ctx.machine, ctx.player, selectedZone);
            return;
        }

        const revealedCards: any[] = [];
        for (let index = 0; index < revealCount; index += 1) {
            const revealed = ctx.player.deck.pop();
            if (!revealed) break;
            revealedCards.push(revealed);
        }
        if (revealedCards.length <= 0) {
            moveUnitZoneToDeckBottom(ctx.machine, ctx.player, selectedZone);
            return;
        }

        ctx.machine.state.revealedCards = revealedCards;
        const targetSchema = {
            scope: 'REVEALED',
            type: 'CARD',
            count: 1,
            selectMode: 'MANUAL',
        } as const;
        beginTargetSelection(
            ctx,
            {
                actionType: 'BT05_019_SELECT_REVEALED',
                effectDescription: '패에 넣을 카드를 선택한다.',
                validTargets: 'REVEALED',
                targetSchema,
            },
            createComplexRuntimeEffect(
                targetSchema,
                'BT05-019 resolve reveal and pick',
                {
                    mode: 'BT05_019_REVEAL_BY_HIT_PICK_AND_BOTTOM_TARGET',
                    stage: 'RESOLVE_PICK',
                },
                ActivationCondition.ACTIVE_MAIN,
            ),
        );
        return;
    }

    if ((params as any).mode === 'BT05_025_ACTIVE_DISCARD_ANY_FOR_BUFF_AND_BREAKTHROUGH') {
        const stage = (params as any).stage;
        if (stage === 'RESOLVE') {
            const selectedCards = (_targets || []).filter((card: any) => ctx.player.hand.includes(card));
            const trashedCards: any[] = [];
            selectedCards.forEach((card: any) => {
                const handIndex = ctx.player.hand.indexOf(card);
                if (handIndex === -1) return;
                const [removed] = ctx.player.hand.splice(handIndex, 1);
                if (!removed) return;
                ctx.player.trash.push(removed);
                trashedCards.push(removed);
            });
            if (trashedCards.length > 0) {
                ctx.machine.notifyHandTrashed(ctx.player, trashedCards, {
                    flags: { handTrashByEffect: true },
                });
                buffPower(ctx, { value: trashedCards.length * 1000, duration: 'TURN_END' }, [ctx.unitZone]);
            }
            if (!ctx.unitZone?.unit) return;
            const laneIndex = ctx.player.unitZones.indexOf(ctx.unitZone);
            if (laneIndex < 0) return;
            const encounterZone = ctx.opponent.unitZones[laneIndex];
            if (!encounterZone?.unit) return;
            const powerMargin = ctx.machine.getUnitPower(ctx.unitZone, ctx.player) - ctx.machine.getUnitPower(encounterZone, ctx.opponent);
            if (powerMargin >= 12000) {
                ctx.unitZone.temporaryEffects.push({
                    activation: ActivationCondition.ATTACKER,
                    description: '어태커 : 돌파',
                    action: { type: 'BREAKTHROUGH', params: { mode: 'ALL' } },
                    duration: 'TURN_END',
                } as any);
            }
            return;
        }

        const targetSchema = {
            scope: 'MY_HAND',
            type: 'CARD',
            count: ctx.player.hand.length,
            selectMode: 'MANUAL',
        } as const;
        beginTargetSelection(
            ctx,
            {
                actionType: 'BT05_025_SELECT_HAND_TO_TRASH',
                effectDescription: '트래시할 패를 원하는 수만큼 선택한다.',
                validTargets: 'MY_HAND',
                targetSchema,
                actionValue: {
                    allowPartialSelection: true,
                    minSelection: 0,
                    maxSelection: ctx.player.hand.length,
                },
            },
            createComplexRuntimeEffect(
                targetSchema,
                'BT05-025 resolve discard and buff',
                {
                    mode: 'BT05_025_ACTIVE_DISCARD_ANY_FOR_BUFF_AND_BREAKTHROUGH',
                    stage: 'RESOLVE',
                },
                ActivationCondition.ACTIVE_MAIN,
            ),
        );
        return;
    }

    if ((params as any).mode === 'BT05_027_BOTTOM_FRIENDLY_AND_DEPLOY_FROM_HAND') {
        const stage = (params as any).stage;
        if (stage === 'SELECT_ZONE') {
            const selectedCardRef = (params as any).selectedCardRef;
            const selectedCardId = (params as any).selectedCardId;
            const targetZone = (_targets || [])[0] as UnitZoneState | undefined;
            if (!targetZone || targetZone.unit) return;

            const placedUnit = removeCardFromArrayByRefOrId(ctx.player.hand, selectedCardRef, selectedCardId);
            if (!placedUnit) return;
            resetUnitZoneForPlacement(targetZone, placedUnit);
            ctx.machine.triggerEntryEffectsForPlacedUnit(ctx.player, targetZone);
            return;
        }

        const selectedZone = (_targets || [])[0] as UnitZoneState | undefined;
        if (!selectedZone?.unit) return;

        const laneIndex = ctx.player.unitZones.indexOf(selectedZone);
        const selectedCost = getCardCost(ctx.machine, selectedZone.unit);
        moveUnitZoneToDeckBottom(ctx.machine, ctx.player, selectedZone);

        const handCandidates = ctx.player.hand.filter((card: any) =>
            card?.type === CardType.UNIT && getCardCost(ctx.machine, card) <= selectedCost + 3
        );
        if (handCandidates.length <= 0) return;

        const handSchema = {
            scope: 'MY_HAND',
            type: 'CARD',
            count: 1,
            filters: [
                { type: 'UNIT_TYPE', value: CardType.UNIT },
                { type: 'COST_LIMIT', value: selectedCost + 3 },
            ],
            selectMode: 'MANUAL',
        } as const;
        ctx.flags = ctx.flags || {};
        ctx.flags.BT05_027_TARGET_ZONE_INDEX = laneIndex;
        beginTargetSelection(
            ctx,
            {
                actionType: 'BT05_027_SELECT_HAND_UNIT',
                effectDescription: '배치할 유닛 카드를 선택한다.',
                validTargets: 'MY_HAND',
                targetSchema: handSchema,
            },
            {
                activation: ActivationCondition.ACTIVE,
                description: 'BT05-027 choose empty zone',
                targets: {
                    scope: 'MY_FIELD',
                    type: 'ALL',
                    count: 1,
                    selectMode: 'MANUAL',
                },
                action: {
                    type: 'COMPLEX_ACTION',
                    params: {
                        mode: 'BT05_027_BOTTOM_FRIENDLY_AND_DEPLOY_FROM_HAND',
                        stage: 'SELECT_ZONE',
                    },
                },
            } as any,
        );
        ctx.machine.state.pendingEffect!.actionValue = {
            selectedCardRef: undefined,
            selectedCardId: undefined,
        };
        // The first selection chooses the hand card. Resolve immediately to second stage.
        return;
    }

    if ((params as any).mode === 'BT05_028_BOTTOM_FRIENDLY_REVEAL3_DEPLOY_AND_ZERO_SELF') {
        const stage = (params as any).stage;
        if (stage === 'PROMPT_ZONE') {
            const selectedCard = (_targets || [])[0];
            const targetZone = (_targets || [])[1] as UnitZoneState | undefined;
            void selectedCard;
            void targetZone;
            return;
        }

        const selectedZone = (_targets || [])[0] as UnitZoneState | undefined;
        if (!selectedZone?.unit) return;
        moveUnitZoneToDeckBottom(ctx.machine, ctx.player, selectedZone);

        const revealedCards: any[] = [];
        for (let index = 0; index < 3; index += 1) {
            const revealed = ctx.player.deck.pop();
            if (!revealed) break;
            revealedCards.push(revealed);
        }
        if (revealedCards.length <= 0) return;

        const unitCandidates = revealedCards.filter((card: any) => card?.type === CardType.UNIT);
        if (unitCandidates.length <= 0 || !ctx.player.unitZones.some((zone: any) => !zone?.unit)) {
            ctx.player.trash.push(...revealedCards);
            return;
        }

        ctx.machine.state.revealedCards = revealedCards;
        const pickSchema = {
            scope: 'REVEALED',
            type: 'CARD',
            count: 1,
            filters: [{ type: 'UNIT_TYPE', value: CardType.UNIT }],
            selectMode: 'MANUAL',
        } as const;
        beginTargetSelection(
            ctx,
            {
                actionType: 'BT05_028_SELECT_REVEALED_UNIT',
                effectDescription: '배치할 유닛을 선택한다.',
                validTargets: 'REVEALED',
                targetSchema: pickSchema,
            },
            createComplexRuntimeEffect(
                pickSchema,
                'BT05-028 choose zone for deployed unit',
                {
                    mode: 'BT05_028_BOTTOM_FRIENDLY_REVEAL3_DEPLOY_AND_ZERO_SELF',
                    stage: 'RESOLVE_DEPLOY',
                },
                ActivationCondition.ACTIVE,
            ),
        );
        return;
    }

    if ((params as any).mode === 'BT05_029_BOTTOM_FRIENDLY_AND_LOCK_OPP_BLOCK') {
        const stage = (params as any).stage;
        if (stage === 'RESOLVE_OPP') {
            const opponentZone = (_targets || [])[0] as UnitZoneState | undefined;
            const friendlyZone = ctx.flags?.BT05_029_FRIENDLY_ZONE as unknown as UnitZoneState | undefined;
            if (!opponentZone?.unit || !friendlyZone?.unit) return;

            moveUnitZoneToDeckBottom(ctx.machine, ctx.player, friendlyZone);
            opponentZone.temporaryEffects.push({
                activation: ActivationCondition.PASSIVE,
                description: '패시브 : 이 유닛은 이 턴이 끝날 때까지 공격을 방어할 수 없다.',
                action: { type: 'NONE', params: { cannotBlock: true } },
                duration: 'TURN_END',
            } as any);
            return;
        }

        const friendlyZone = (_targets || [])[0] as UnitZoneState | undefined;
        if (!friendlyZone?.unit) {
            const targetSchema = {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 1,
                selectMode: 'MANUAL',
            } as const;
            beginTargetSelection(
                ctx,
                {
                    actionType: 'BT05_029_SELECT_FRIENDLY',
                    effectDescription: '기준이 될 자신 유닛을 선택한다.',
                    validTargets: 'MY_UNITS',
                    targetSchema,
                },
                createComplexRuntimeEffect(
                    targetSchema,
                    'BT05-029 choose opponent unit',
                    {
                        mode: 'BT05_029_BOTTOM_FRIENDLY_AND_LOCK_OPP_BLOCK',
                    },
                    ActivationCondition.ACTIVE,
                ),
            );
            return;
        }

        ctx.flags = ctx.flags || {};
        ctx.flags.BT05_029_FRIENDLY_ZONE = friendlyZone as any;
        const sourcePower = ctx.machine.getUnitPower(friendlyZone, ctx.player);
        const targetSchema = {
            scope: 'OPP_FIELD',
            type: 'UNIT',
            count: 1,
            filters: [{ type: 'POWER_LIMIT', value: sourcePower }],
            selectMode: 'MANUAL',
        } as const;
        if (TargetSelector.resolve(ctx.machine, targetSchema as any, ctx).length <= 0) return;

        beginTargetSelection(
            ctx,
            {
                actionType: 'BT05_029_SELECT_OPPONENT',
                effectDescription: '상대 유닛을 선택한다.',
                validTargets: 'OPP_UNITS',
                targetSchema,
            },
            createComplexRuntimeEffect(
                targetSchema,
                'BT05-029 resolve chosen units',
                {
                    mode: 'BT05_029_BOTTOM_FRIENDLY_AND_LOCK_OPP_BLOCK',
                    stage: 'RESOLVE_OPP',
                },
                ActivationCondition.ACTIVE,
            ),
        );
        return;
    }

    if ((params as any).mode === 'BT05_032_LEADER_CHOOSE_RETURN_OR_DESTROY') {
        const stage = (params as any).stage;
        if (stage === 'RESOLVE_OPTION') {
            const selectedOption = (_targets || [])[0];
            const optionName = String(selectedOption?.name || '');
            ctx.machine.state.revealedCards = [];
            const targetSchema = {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 1,
                selectMode: 'MANUAL',
            } as const;
            if (optionName.includes('귀환')) {
                beginTargetSelection(
                    ctx,
                    {
                        actionType: 'BT05_032_SELECT_FRIENDLY_RETURN',
                        effectDescription: '귀환을 부여할 유닛을 선택한다.',
                        validTargets: 'MY_UNITS',
                        targetSchema,
                    },
                    createComplexRuntimeEffect(
                        targetSchema,
                        'BT05-032 grant exit return',
                        {
                            mode: 'BT05_032_LEADER_CHOOSE_RETURN_OR_DESTROY',
                            stage: 'APPLY_RETURN',
                        },
                        ActivationCondition.ACTIVE_MAIN,
                    ),
                );
                return;
            }

            beginTargetSelection(
                ctx,
                {
                    actionType: 'BT05_032_SELECT_FRIENDLY_DESTROY',
                    effectDescription: '트래시할 유닛을 선택한다.',
                    validTargets: 'MY_UNITS',
                    targetSchema,
                },
                createComplexRuntimeEffect(
                    targetSchema,
                    'BT05-032 destroy friendly unit',
                    {
                        mode: 'BT05_032_LEADER_CHOOSE_RETURN_OR_DESTROY',
                        stage: 'APPLY_DESTROY',
                    },
                    ActivationCondition.ACTIVE_MAIN,
                ),
            );
            return;
        }
        if (stage === 'APPLY_RETURN') {
            const targetZone = (_targets || [])[0] as UnitZoneState | undefined;
            if (!targetZone?.unit) return;
            targetZone.temporaryEffects.push({
                activation: ActivationCondition.EXIT,
                description: '엑시트 : 상대 턴 종료 시 이 유닛을 패로 되돌린다.',
                duration: 'PERMANENT',
                action: {
                    type: 'RETURN_FROM_TRASH_AT_TURN_END',
                    params: {
                        untilTurnCount: ctx.machine.state.turnCount + 1,
                    },
                },
            } as any);
            return;
        }
        if (stage === 'APPLY_DESTROY') {
            destroyUnit(ctx, {}, _targets || []);
            return;
        }

        ctx.machine.state.revealedCards = [
            createPromptOptionCard('BT05-032-RETURN', '귀환 부여', '자신 유닛 1장에게 상대 턴 종료까지 [엑시트] 귀환을 부여한다.'),
            createPromptOptionCard('BT05-032-DESTROY', '아군 트래시', '필드에 있는 자신 유닛 1장을 트래시한다.'),
        ] as any;
        const targetSchema = {
            scope: 'REVEALED',
            type: 'CARD',
            count: 1,
            selectMode: 'MANUAL',
        } as const;
        beginTargetSelection(
            ctx,
            {
                actionType: 'BT05_032_SELECT_OPTION',
                effectDescription: '효과 하나를 선택한다.',
                validTargets: 'REVEALED',
                targetSchema,
            },
            createComplexRuntimeEffect(
                targetSchema,
                'BT05-032 resolve leader option',
                {
                    mode: 'BT05_032_LEADER_CHOOSE_RETURN_OR_DESTROY',
                    stage: 'RESOLVE_OPTION',
                },
                ActivationCondition.ACTIVE_MAIN,
            ),
        );
        return;
    }

    if ((params as any).mode === 'BT05_035_TRASH_FRIENDLY_AND_GAIN_BREAKTHROUGH') {
        const selectedZone = (_targets || [])[0] as UnitZoneState | undefined;
        if (!selectedZone?.unit) return;
        destroyUnit(ctx, {}, [selectedZone]);
        const sourceZone = ctx.player.unitZones.find((zone: any) => zone?.unit === ctx.sourceCard);
        if (!sourceZone?.unit) return;
        sourceZone.temporaryEffects.push({
            activation: ActivationCondition.ATTACKER,
            description: '어태커 : 돌파',
            action: { type: 'BREAKTHROUGH', params: { mode: 'ALL' } },
            duration: 'TURN_END',
        } as any);
        return;
    }

    if ((params as any).mode === 'BT05_STORM_EXIT_DEPLOY_LOW_COST_FROM_TRASH') {
        const stage = (params as any).stage;
        if (stage === 'RESOLVE_ZONE') {
            const selectedZone = (_targets || [])[0] as UnitZoneState | undefined;
            if (!selectedZone || selectedZone.unit) return;
            const selectedCardRef = (params as any).selectedCardRef;
            const selectedCardId = (params as any).selectedCardId;
            const placedUnit = removeCardFromArrayByRefOrId(ctx.player.trash, selectedCardRef, selectedCardId);
            if (!placedUnit) return;
            resetUnitZoneForPlacement(selectedZone, placedUnit);
            ctx.machine.triggerEntryEffectsForPlacedUnit(ctx.player, selectedZone);
            return;
        }
        if (stage === 'RESOLVE_TRASH') {
            const selectedCard = (_targets || [])[0];
            if (!selectedCard) return;
            const zoneSchema = {
                scope: 'MY_FIELD',
                type: 'ALL',
                count: 1,
                selectMode: 'MANUAL',
            } as const;
            beginTargetSelection(
                ctx,
                {
                    actionType: 'BT05_STORM_SELECT_EMPTY_ZONE',
                    effectDescription: '배치할 빈 유닛 존을 선택한다.',
                    validTargets: 'MY_UNITS',
                    targetSchema: zoneSchema,
                },
                createComplexRuntimeEffect(
                    zoneSchema,
                    'BT05 storm exit deploy from trash',
                    {
                        mode: 'BT05_STORM_EXIT_DEPLOY_LOW_COST_FROM_TRASH',
                        stage: 'RESOLVE_ZONE',
                        selectedCardRef: selectedCard,
                        selectedCardId: selectedCard?.id,
                    },
                    ActivationCondition.EXIT,
                ),
            );
            return;
        }

        const candidates = ctx.player.trash.filter((card: any) =>
            card?.type === CardType.UNIT &&
            getCardCost(ctx.machine, card) <= 2 &&
            !cardHasKeywordLike(card, '트리거')
        );
        if (candidates.length <= 0) return;
        if (!ctx.player.unitZones.some((zone: any) => !zone?.unit)) return;

        const targetSchema = {
            scope: 'MY_TRASH',
            type: 'CARD',
            count: 1,
            filters: [
                { type: 'UNIT_TYPE', value: CardType.UNIT },
                { type: 'COST_LIMIT', value: 2 },
                { type: 'NOT_HAS_KEYWORD', value: '트리거' },
            ],
            selectMode: 'MANUAL',
        } as const;
        beginTargetSelection(
            ctx,
            {
                actionType: 'BT05_STORM_SELECT_TRASH_UNIT',
                effectDescription: '배치할 유닛을 선택한다.',
                validTargets: 'MY_TRASH',
                targetSchema,
            },
            createComplexRuntimeEffect(
                targetSchema,
                'BT05 storm exit choose trash unit',
                {
                    mode: 'BT05_STORM_EXIT_DEPLOY_LOW_COST_FROM_TRASH',
                    stage: 'RESOLVE_TRASH',
                },
                ActivationCondition.EXIT,
            ),
        );
        return;
    }

    if ((params as any).mode === 'BT05_041_EXIT_BOTTOM_UP_TO_NINE_AND_DAMAGE') {
        const stage = (params as any).stage;
        if (stage === 'RESOLVE') {
            const selectedCards = (_targets || []).filter((card: any) => ctx.player.trash.includes(card));
            const movedCount = selectedCards.length;
            selectedCards.forEach((card: any) => {
                const removed = removeCardFromArrayByRefOrId(ctx.player.trash, card, card?.id);
                if (removed) {
                    ctx.player.deck.unshift(removed);
                }
            });
            const damageCount = Math.floor(movedCount / 3);
            if (damageCount > 0) {
                ctx.machine.dealDamage(ctx.opponent, damageCount);
            }
            return;
        }

        const candidates = ctx.player.trash.filter((card: any) => !cardHasKeywordLike(card, '트리거'));
        if (candidates.length <= 0) return;
        const targetSchema = {
            scope: 'MY_TRASH',
            type: 'CARD',
            count: Math.min(9, candidates.length),
            filters: [{ type: 'NOT_HAS_KEYWORD', value: '트리거' }],
            selectMode: 'MANUAL',
        } as const;
        beginTargetSelection(
            ctx,
            {
                actionType: 'BT05_041_SELECT_TRASH',
                effectDescription: '덱 맨 아래에 놓을 카드를 최대 9장까지 선택한다.',
                validTargets: 'MY_TRASH',
                targetSchema,
                actionValue: {
                    allowPartialSelection: true,
                    minSelection: 0,
                    maxSelection: Math.min(9, candidates.length),
                },
            },
            createComplexRuntimeEffect(
                targetSchema,
                'BT05-041 bottom trash cards and damage',
                {
                    mode: 'BT05_041_EXIT_BOTTOM_UP_TO_NINE_AND_DAMAGE',
                    stage: 'RESOLVE',
                },
                ActivationCondition.EXIT,
            ),
        );
        return;
    }

    if ((params as any).mode === 'BT05_042_BOTTOM_EXIT_UNIT_AND_BUFF_HIT') {
        const stage = (params as any).stage;
        if (stage === 'RESOLVE_BUFF') {
            const targetZone = (_targets || [])[0] as UnitZoneState | undefined;
            if (!targetZone?.unit) return;
            buffHit(ctx, { value: 1, duration: 'TURN_END' }, [targetZone]);
            return;
        }
        if (stage === 'RESOLVE_TRASH') {
            const selectedCard = (_targets || [])[0];
            if (!selectedCard) return;
            const removed = removeCardFromArrayByRefOrId(ctx.player.trash, selectedCard, selectedCard?.id);
            if (!removed) return;
            ctx.player.deck.unshift(removed);
            ctx.costPaymentCard = removed;

            const targetSchema = {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'COST_LIMIT_BY_COST_PAYMENT' }],
                selectMode: 'MANUAL',
            } as const;
            if (TargetSelector.resolve(ctx.machine, targetSchema as any, ctx).length <= 0) return;
            beginTargetSelection(
                ctx,
                {
                    actionType: 'BT05_042_SELECT_FRIENDLY',
                    effectDescription: '히트를 높일 유닛을 선택한다.',
                    validTargets: 'MY_UNITS',
                    targetSchema,
                },
                createComplexRuntimeEffect(
                    targetSchema,
                    'BT05-042 buff hit after bottoming exit unit',
                    {
                        mode: 'BT05_042_BOTTOM_EXIT_UNIT_AND_BUFF_HIT',
                        stage: 'RESOLVE_BUFF',
                    },
                    ActivationCondition.ACTIVE,
                ),
            );
            return;
        }

        const targetSchema = {
            scope: 'MY_TRASH',
            type: 'CARD',
            count: 1,
            filters: [
                { type: 'UNIT_TYPE', value: CardType.UNIT },
                { type: 'HAS_KEYWORD', value: '엑시트' },
                { type: 'NOT_HAS_KEYWORD', value: '트리거' },
            ],
            selectMode: 'MANUAL',
        } as const;
        if (TargetSelector.resolve(ctx.machine, targetSchema as any, ctx).length <= 0) return;
        beginTargetSelection(
            ctx,
            {
                actionType: 'BT05_042_SELECT_TRASH_EXIT',
                effectDescription: '덱 맨 아래에 놓을 유닛을 선택한다.',
                validTargets: 'MY_TRASH',
                targetSchema,
            },
            createComplexRuntimeEffect(
                targetSchema,
                'BT05-042 bottom exit unit',
                {
                    mode: 'BT05_042_BOTTOM_EXIT_UNIT_AND_BUFF_HIT',
                    stage: 'RESOLVE_TRASH',
                },
                ActivationCondition.ACTIVE,
            ),
        );
        return;
    }

    if ((params as any).mode === 'BT05_043_TRASH_HAND_UNIT_THEN_DESTROY_LOWER_COST') {
        const stage = (params as any).stage;
        if (stage === 'RESOLVE_DESTROY') {
            destroyUnit(ctx, {}, _targets || []);
            return;
        }
        if (stage === 'RESOLVE_HAND') {
            const selectedCard = (_targets || [])[0];
            if (!selectedCard) return;
            const removed = removeCardFromArrayByRefOrId(ctx.player.hand, selectedCard, selectedCard?.id);
            if (!removed) return;
            ctx.player.trash.push(removed);
            ctx.machine.notifyHandTrashed(ctx.player, [removed], {
                flags: { handTrashByEffect: true },
            });
            ctx.costPaymentCard = removed;

            const targetSchema = {
                scope: 'BOTH_FIELDS',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'COST_LOWER_THAN_COST_PAYMENT' }],
                selectMode: 'MANUAL',
            } as const;
            if (TargetSelector.resolve(ctx.machine, targetSchema as any, ctx).length <= 0) return;
            beginTargetSelection(
                ctx,
                {
                    actionType: 'BT05_043_SELECT_TARGET',
                    effectDescription: '트래시할 유닛을 선택한다.',
                    validTargets: 'ALL_UNITS',
                    targetSchema,
                },
                createComplexRuntimeEffect(
                    targetSchema,
                    'BT05-043 destroy lower-cost unit',
                    {
                        mode: 'BT05_043_TRASH_HAND_UNIT_THEN_DESTROY_LOWER_COST',
                        stage: 'RESOLVE_DESTROY',
                    },
                    ActivationCondition.ACTIVE,
                ),
            );
            return;
        }

        const targetSchema = {
            scope: 'MY_HAND',
            type: 'CARD',
            count: 1,
            filters: [{ type: 'UNIT_TYPE', value: CardType.UNIT }],
            selectMode: 'MANUAL',
        } as const;
        if (TargetSelector.resolve(ctx.machine, targetSchema as any, ctx).length <= 0) return;
        beginTargetSelection(
            ctx,
            {
                actionType: 'BT05_043_SELECT_HAND_UNIT',
                effectDescription: '트래시할 유닛 카드를 선택한다.',
                validTargets: 'MY_HAND',
                targetSchema,
            },
            createComplexRuntimeEffect(
                targetSchema,
                'BT05-043 trash hand unit',
                {
                    mode: 'BT05_043_TRASH_HAND_UNIT_THEN_DESTROY_LOWER_COST',
                    stage: 'RESOLVE_HAND',
                },
                ActivationCondition.ACTIVE,
            ),
        );
        return;
    }

    if ((params as any).mode === 'BT05_044_BORROW_EXIT_EFFECT') {
        const stage = (params as any).stage;
        if (stage === 'RESOLVE_CARD') {
            const selectedCard = (_targets || [])[0];
            if (!selectedCard) return;
            complexAction(ctx, {
                mode: 'PROMPT_SELECT_TARGET_EFFECT_TO_ACTIVATE',
                activation: ActivationCondition.EXIT,
                targetOwner: 'SELF',
                targetArea: 'TRASH',
                preMoveToDeckBottom: true,
            }, [selectedCard]);

            const shouldRepeat = Math.max(0, Number((params as any).shouldRepeat ?? 0));
            const mixActive = hasNonAttributeCardOnField(ctx.player, Attribute.STORM);
            if (shouldRepeat > 0 && mixActive && ctx.machine.state.interactionMode === 'NORMAL') {
                complexAction(ctx, { mode: 'BT05_044_BORROW_EXIT_EFFECT', repeatsIfMix: 0 }, []);
            }
            return;
        }

        const targetSchema = {
            scope: 'MY_TRASH',
            type: 'CARD',
            count: 1,
            filters: [
                { type: 'UNIT_TYPE', value: CardType.UNIT },
                { type: 'HAS_KEYWORD', value: '엑시트' },
                { type: 'NOT_HAS_KEYWORD', value: '트리거' },
            ],
            selectMode: 'MANUAL',
        } as const;
        if (TargetSelector.resolve(ctx.machine, targetSchema as any, ctx).length <= 0) return;
        beginTargetSelection(
            ctx,
            {
                actionType: 'BT05_044_SELECT_TRASH_UNIT',
                effectDescription: '엑시트 효과를 빌릴 유닛을 선택한다.',
                validTargets: 'MY_TRASH',
                targetSchema,
            },
            createComplexRuntimeEffect(
                targetSchema,
                'BT05-044 borrow exit effect',
                {
                    mode: 'BT05_044_BORROW_EXIT_EFFECT',
                    stage: 'RESOLVE_CARD',
                    shouldRepeat: Math.max(0, Number((params as any).repeatsIfMix ?? 0)),
                },
                ActivationCondition.ACTIVE,
            ),
        );
        return;
    }

    if ((params as any).mode === 'BT05_046_OPP_TURN_END_DISCARD_OR_DESTROY') {
        const stage = (params as any).stage;
        if (stage === 'RESOLVE') {
            const selectedCards = (_targets || []).filter((card: any) => ctx.player.hand.includes(card));
            if (selectedCards.length > 0) {
                selectedCards.forEach((card: any) => {
                    const removed = removeCardFromArrayByRefOrId(ctx.player.hand, card, card?.id);
                    if (removed) {
                        ctx.player.trash.push(removed);
                        ctx.machine.notifyHandTrashed(ctx.player, [removed], {
                            flags: { handTrashByEffect: true },
                        });
                    }
                });
                return;
            }
            if (ctx.unitZone?.unit) {
                ctx.machine.destroyUnit(ctx.player, ctx.unitZone, undefined, 'EFFECT');
            }
            return;
        }

        if (ctx.player.hand.length <= 0) {
            if (ctx.unitZone?.unit) {
                ctx.machine.destroyUnit(ctx.player, ctx.unitZone, undefined, 'EFFECT');
            }
            return;
        }

        const targetSchema = {
            scope: 'MY_HAND',
            type: 'CARD',
            count: 1,
            selectMode: 'MANUAL',
        } as const;
        beginTargetSelection(
            ctx,
            {
                actionType: 'BT05_046_SELECT_HAND',
                effectDescription: '버릴 패를 선택한다. 선택하지 않으면 장착 유닛이 트래시된다.',
                validTargets: 'MY_HAND',
                targetSchema,
                actionValue: {
                    allowPartialSelection: true,
                    minSelection: 0,
                    maxSelection: 1,
                },
            },
            createComplexRuntimeEffect(
                targetSchema,
                'BT05-046 resolve discard or destroy',
                {
                    mode: 'BT05_046_OPP_TURN_END_DISCARD_OR_DESTROY',
                    stage: 'RESOLVE',
                },
                ActivationCondition.TURN_END,
            ),
        );
        return;
    }

    if ((params as any).mode === 'BT05_023_ESCAPE_DESTROY_LOWER_POWER_THEN_BOTTOM') {
        const targetZone = (_targets || [])[0] as UnitZoneState | undefined;
        if (targetZone?.unit) {
            const owner = getOwnerOfZone(ctx.machine, targetZone);
            if (owner) {
                ctx.machine.destroyUnit(owner, targetZone, undefined, 'EFFECT');
            }
        }

        const sourceZone = ctx.player.unitZones.find((zone: any) => zone?.unit === ctx.sourceCard);
        if (sourceZone?.unit) {
            moveUnitZoneToDeckBottom(ctx.machine, ctx.player, sourceZone);
        }
        return;
    }

    if ((params as any).mode === 'BT05_049_DEFENDER_DISCARD_AND_TERMINATE_ATTACK') {
        const sourceOwner = ctx.machine.opponentPlayer || ctx.opponent || ctx.player;
        const selectionCtx = {
            ...ctx,
            player: sourceOwner,
            opponent: sourceOwner.id === ctx.player.id ? ctx.opponent : ctx.player,
        };
        const stage = (params as any).stage;
        if (stage === 'RESOLVE') {
            const requiredCount = Math.max(0, Number((params as any).requiredCount ?? 0));
            const selectedCards = (_targets || []).filter((card: any) => sourceOwner.hand.includes(card));
            if (selectedCards.length !== requiredCount) return;

            const trashedCards: any[] = [];
            selectedCards.forEach((card: any) => {
                const removed = removeCardFromArrayByRefOrId(sourceOwner.hand, card, card?.id);
                if (!removed) return;
                sourceOwner.trash.push(removed);
                trashedCards.push(removed);
            });

            if (trashedCards.length > 0) {
                ctx.machine.notifyHandTrashed(sourceOwner, trashedCards, {
                    flags: { handTrashByEffect: true },
                });
            }
            ctx.machine.state.attackTerminated = true;
            return;
        }

        const attackerZoneIndex = ctx.machine.state.pendingAttackerIndex;
        if (typeof attackerZoneIndex !== 'number' || attackerZoneIndex < 0) return;
        const attackerZone = ctx.opponent.unitZones[attackerZoneIndex];
        const requiredCount = Math.max(0, ctx.machine.getUnitHit(attackerZone, ctx.opponent) - 1);
        if (requiredCount <= 0) {
            ctx.machine.state.attackTerminated = true;
            return;
        }
        if (sourceOwner.hand.length < requiredCount) return;

        const targetSchema = {
            scope: 'MY_HAND',
            type: 'CARD',
            count: requiredCount,
            selectMode: 'MANUAL',
        } as const;
        beginTargetSelection(
            selectionCtx,
            {
                actionType: 'BT05_049_SELECT_HAND',
                effectDescription: '트래시할 패를 선택한다.',
                validTargets: 'MY_HAND',
                targetSchema,
                controllerPlayerId: sourceOwner.id,
            },
            createComplexRuntimeEffect(
                targetSchema,
                'BT05-049 discard hand cards and terminate attack',
                {
                    mode: 'BT05_049_DEFENDER_DISCARD_AND_TERMINATE_ATTACK',
                    stage: 'RESOLVE',
                    requiredCount,
                },
                ActivationCondition.DEFENDER,
            ),
        );
        if (ctx.machine.state.pendingEffect) {
            ctx.machine.state.pendingEffect.sourcePlayerId = sourceOwner.id;
            ctx.machine.state.pendingEffect.controllerPlayerId = sourceOwner.id;
        }
        ctx.machine.setInteractionOwner(sourceOwner.id);
        return;
    }

    if ((params as any).mode === 'BT05_051_052_RETURN_ENCOUNTER_AND_SET_HIT') {
        if (!ctx.unitZone?.unit) return;
        const laneIndex = ctx.player.unitZones.indexOf(ctx.unitZone);
        if (laneIndex < 0) return;
        const encounterZone = ctx.opponent.unitZones[laneIndex];
        if (!encounterZone?.unit) return;

        returnUnitAndItemsToHand(ctx, {}, [encounterZone]);
        buffHit(ctx, { value: 1, mode: 'SET', duration: 'TURN_END' }, [ctx.unitZone]);
        return;
    }

    if ((params as any).mode === 'BT05_053_GRANT_COST_OVER_BREAKTHROUGH') {
        const stage = (params as any).stage;
        if (stage === 'RESOLVE_HAND') {
            const targetZone = ctx.flags?.BT05_053_TARGET_ZONE as unknown as UnitZoneState | undefined;
            const selectedCard = (_targets || [])[0];
            if (!targetZone?.unit || !selectedCard) return;

            const removed = removeCardFromArrayByRefOrId(ctx.player.hand, selectedCard, selectedCard?.id);
            if (!removed) return;
            ctx.player.trash.push(removed);
            ctx.machine.notifyHandTrashed(ctx.player, [removed], {
                flags: { handTrashByEffect: true },
            });

            targetZone.temporaryEffects.push({
                activation: ActivationCondition.ATTACKER,
                description: '어태커 : 돌파[코스트 초과]',
                action: { type: 'BREAKTHROUGH', params: { mode: 'COST_OVER' } },
                duration: 'TURN_END',
            } as any);
            return;
        }

        const targetZone = (_targets || [])[0] as UnitZoneState | undefined;
        if (!targetZone?.unit) return;
        if (ctx.player.hand.length <= 0) return;
        ctx.flags = ctx.flags || {};
        ctx.flags.BT05_053_TARGET_ZONE = targetZone as any;

        const targetSchema = {
            scope: 'MY_HAND',
            type: 'CARD',
            count: 1,
            selectMode: 'MANUAL',
        } as const;
        beginTargetSelection(
            ctx,
            {
                actionType: 'BT05_053_SELECT_HAND',
                effectDescription: '트래시할 패를 선택한다.',
                validTargets: 'MY_HAND',
                targetSchema,
                actionValue: {
                    allowPartialSelection: true,
                    minSelection: 0,
                    maxSelection: 1,
                },
            },
            createComplexRuntimeEffect(
                targetSchema,
                'BT05-053 discard to grant cost-over breakthrough',
                {
                    mode: 'BT05_053_GRANT_COST_OVER_BREAKTHROUGH',
                    stage: 'RESOLVE_HAND',
                },
                ActivationCondition.ACTIVE_MAIN,
            ),
        );
        return;
    }

    if ((params as any).mode === 'BT05_055_ENTRY_OPTIONAL_BOTTOM_AND_DAMAGE_IF_ESCAPE') {
        const targetZone = (_targets || [])[0] as UnitZoneState | undefined;
        if (!targetZone?.unit) return;

        const hadEscape = zoneHasKeywordLike(targetZone, '이스케이프');
        moveUnitZoneToDeckBottom(ctx.machine, ctx.player, targetZone);
        if (hadEscape) {
            damage(ctx, { value: 1, __sourceActivation: ActivationCondition.ENTRY }, []);
        }
        return;
    }

    if ((params as any).mode === 'BT05_056_DISCARD_DAMAGE_BY_SKILL_ZONE_AND_LOCK_ATTACK') {
        const damageCount = Math.max(0, ctx.player.skillZone.length);
        if (damageCount > 0) {
            damage(ctx, { value: damageCount, __sourceActivation: ActivationCondition.ACTIVE_MAIN }, []);
        }
        if (ctx.unitZone?.unit) {
            lockAttackUntilTurnEnd(ctx, {}, [ctx.unitZone]);
        }
        return;
    }

    if ((params as any).mode === 'BT05_058_OPP_CHOOSE_RETURN_ENCOUNTER_OR_DRAW') {
        const stage = (params as any).stage;
        if (stage === 'RESOLVE_OPTION') {
            const targetZone = ctx.flags?.BT05_058_SELECTED_ZONE as unknown as UnitZoneState | undefined;
            if (!targetZone?.unit) return;
            ctx.machine.state.revealedCards = [];
            const laneIndex = ctx.player.unitZones.indexOf(targetZone);
            if (laneIndex < 0) return;
            const encounterZone = ctx.opponent.unitZones[laneIndex];
            const selectedOption = (_targets || [])[0];
            const optionId = String(selectedOption?.id || '');
            if (optionId.includes('RETURN')) {
                if (encounterZone?.unit) {
                    returnUnitAndItemsToHand(ctx, {}, [encounterZone]);
                }
                return;
            }

            const drawCount = Math.max(0, ctx.machine.getUnitHit(targetZone, ctx.player));
            if (drawCount > 0) {
                drawCard(ctx, { count: drawCount, __sourceActivation: ActivationCondition.ACTIVE }, []);
            }
            return;
        }

        const targetZone = (_targets || [])[0] as UnitZoneState | undefined;
        if (!targetZone?.unit) return;
        const laneIndex = ctx.player.unitZones.indexOf(targetZone);
        if (laneIndex < 0) return;
        const encounterZone = ctx.opponent.unitZones[laneIndex];
        if (!encounterZone?.unit) return;

        ctx.flags = ctx.flags || {};
        ctx.flags.BT05_058_SELECTED_ZONE = targetZone as any;
        ctx.machine.state.revealedCards = [
            createPromptOptionCard('BT05_058_RETURN', '조우 유닛 귀환', '상대는 조우 유닛을 패로 되돌린다.'),
            createPromptOptionCard('BT05_058_DRAW', '드로우 허용', '상대는 귀환을 거부하고, 자신은 히트만큼 드로우한다.'),
        ] as any;
        const targetSchema = {
            scope: 'REVEALED',
            type: 'CARD',
            count: 1,
            selectMode: 'MANUAL',
        } as const;
        beginTargetSelection(
            ctx,
            {
                actionType: 'BT05_058_SELECT_OPTION',
                effectDescription: '상대는 조우 유닛을 패로 되돌릴지 선택한다.',
                validTargets: 'REVEALED',
                targetSchema,
                controllerPlayerId: ctx.opponent.id,
            },
            {
                activation: ActivationCondition.ACTIVE,
                description: 'BT05-058 resolve opponent choice',
                targets: targetSchema,
                action: {
                    type: 'COMPLEX_ACTION',
                    params: {
                        mode: 'BT05_058_OPP_CHOOSE_RETURN_ENCOUNTER_OR_DRAW',
                        stage: 'RESOLVE_OPTION',
                    },
                },
            } as any,
        );
        return;
    }

    if ((params as any).mode === 'BT05_063_LEADER_DISCARD_THEN_EQUIP_DIFFERENT_NAME_ITEM') {
        const stage = (params as any).stage;
        if (stage === 'RESOLVE_EQUIP') {
            const targetZone = (_targets || [])[0] as UnitZoneState | undefined;
            if (!targetZone?.unit) return;
            const item = removeCardFromArrayByRefOrId(
                ctx.player.trash,
                (params as any).selectedItemRef,
                (params as any).selectedItemId,
            );
            if (!item) return;
            if (!equipItemIgnoringSize(ctx, targetZone, item, { sourceActivation: ActivationCondition.ACTIVE_MAIN })) {
                ctx.player.trash.push(item);
            }
            return;
        }

        if (stage === 'SELECT_ITEM') {
            const selectedCard = (_targets || [])[0];
            if (!selectedCard) return;

            const removed = removeCardFromArrayByRefOrId(ctx.player.hand, selectedCard, selectedCard?.id);
            if (!removed) return;
            ctx.player.trash.push(removed);
            ctx.machine.notifyHandTrashed(ctx.player, [removed], {
                flags: { handTrashByEffect: true },
            });

            const itemCandidates = ctx.player.trash.filter((card: any) =>
                card?.type === CardType.ITEM &&
                card?.name !== removed.name &&
                getValidEquipZoneIndexesForItem(ctx, card).length > 0
            );
            if (itemCandidates.length <= 0) return;

            ctx.machine.state.revealedCards = itemCandidates;
            const targetSchema = {
                scope: 'REVEALED',
                type: 'CARD',
                count: 1,
                selectMode: 'MANUAL',
            } as const;
            beginTargetSelection(
                ctx,
                {
                    actionType: 'BT05_063_SELECT_ITEM',
                    effectDescription: '장착할 아이템을 선택한다.',
                    validTargets: 'REVEALED',
                    targetSchema,
                },
                createComplexRuntimeEffect(
                    targetSchema,
                    'BT05-063 choose item from trash',
                    {
                        mode: 'BT05_063_LEADER_DISCARD_THEN_EQUIP_DIFFERENT_NAME_ITEM',
                        stage: 'SELECT_ZONE',
                    },
                    ActivationCondition.ACTIVE_MAIN,
                ),
            );
            return;
        }

        if (stage === 'SELECT_ZONE') {
            const selectedItem = (_targets || [])[0];
            if (!selectedItem) return;

            if (getValidEquipZoneIndexesForItem(ctx, selectedItem).length <= 0) return;

            const targetSchema = {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 1,
                selectMode: 'MANUAL',
            } as const;
            beginTargetSelection(
                ctx,
                {
                    actionType: 'BT05_063_SELECT_ZONE',
                    effectDescription: '장착할 자신 유닛을 선택한다.',
                    validTargets: 'MY_UNITS',
                    targetSchema,
                },
                createComplexRuntimeEffect(
                    targetSchema,
                    'BT05-063 equip selected item',
                    {
                        mode: 'BT05_063_LEADER_DISCARD_THEN_EQUIP_DIFFERENT_NAME_ITEM',
                        stage: 'RESOLVE_EQUIP',
                        selectedItemRef: selectedItem,
                        selectedItemId: selectedItem?.id,
                    },
                    ActivationCondition.ACTIVE_MAIN,
                ),
            );
            return;
        }

        if (ctx.player.hand.length <= 0) return;
        const targetSchema = {
            scope: 'MY_HAND',
            type: 'CARD',
            count: 1,
            selectMode: 'MANUAL',
        } as const;
        beginTargetSelection(
            ctx,
            {
                actionType: 'BT05_063_SELECT_HAND',
                effectDescription: '트래시할 패를 선택한다.',
                validTargets: 'MY_HAND',
                targetSchema,
            },
            createComplexRuntimeEffect(
                targetSchema,
                'BT05-063 discard hand card',
                {
                    mode: 'BT05_063_LEADER_DISCARD_THEN_EQUIP_DIFFERENT_NAME_ITEM',
                    stage: 'SELECT_ITEM',
                },
                ActivationCondition.ACTIVE_MAIN,
            ),
        );
        return;
    }

    if ((params as any).mode === 'BT05_065_ENTRY_MILL3_AND_RECOVER_DAMAGE') {
        const stage = (params as any).stage;
        if (stage === 'RECOVER') {
            moveFromDamageToHand(ctx, {}, _targets || []);
            return;
        }

        trashTopCards(ctx.player, 3);
        if (ctx.player.damage.length <= 0) return;
        const targetSchema = {
            scope: 'MY_DAMAGE',
            type: 'CARD',
            count: 1,
            selectMode: 'MANUAL',
        } as const;
        beginTargetSelection(
            ctx,
            {
                actionType: 'BT05_065_SELECT_DAMAGE',
                effectDescription: '패에 넣을 대미지 카드를 선택한다.',
                validTargets: 'MY_DAMAGE',
                targetSchema,
            },
            createComplexRuntimeEffect(
                targetSchema,
                'BT05-065 recover card from damage',
                {
                    mode: 'BT05_065_ENTRY_MILL3_AND_RECOVER_DAMAGE',
                    stage: 'RECOVER',
                },
                ActivationCondition.ENTRY,
            ),
        );
        return;
    }

    if ((params as any).mode === 'BT05_070_ENTRY_DISCARD_UP_TO_TWO_AND_DRAW') {
        const stage = (params as any).stage;
        if (stage === 'RESOLVE') {
            const selectedCards = (_targets || []).filter((card: any) => ctx.player.hand.includes(card));
            const trashedCards: any[] = [];
            let trashedItemCount = 0;
            selectedCards.forEach((card: any) => {
                const removed = removeCardFromArrayByRefOrId(ctx.player.hand, card, card?.id);
                if (!removed) return;
                ctx.player.trash.push(removed);
                trashedCards.push(removed);
                if (removed.type === CardType.ITEM) trashedItemCount += 1;
            });
            if (trashedCards.length > 0) {
                ctx.machine.notifyHandTrashed(ctx.player, trashedCards, {
                    flags: { handTrashByEffect: true },
                });
            }
            const drawCount = trashedCards.length + (trashedItemCount >= 2 ? 1 : 0);
            if (drawCount > 0) {
                drawCard(ctx, { count: drawCount, __sourceActivation: ActivationCondition.ENTRY }, []);
            }
            return;
        }

        if (ctx.player.hand.length <= 0) return;
        const targetSchema = {
            scope: 'MY_HAND',
            type: 'CARD',
            count: Math.min(2, ctx.player.hand.length),
            selectMode: 'MANUAL',
        } as const;
        beginTargetSelection(
            ctx,
            {
                actionType: 'BT05_070_SELECT_HAND',
                effectDescription: '트래시할 패를 최대 2장까지 선택한다.',
                validTargets: 'MY_HAND',
                targetSchema,
                actionValue: {
                    allowPartialSelection: true,
                    minSelection: 0,
                    maxSelection: Math.min(2, ctx.player.hand.length),
                },
            },
            createComplexRuntimeEffect(
                targetSchema,
                'BT05-070 discard up to two and draw',
                {
                    mode: 'BT05_070_ENTRY_DISCARD_UP_TO_TWO_AND_DRAW',
                    stage: 'RESOLVE',
                },
                ActivationCondition.ENTRY,
            ),
        );
        return;
    }

    if ((params as any).mode === 'BT05_072_REVEAL_THREE_AND_TRASH_ANY') {
        const stage = (params as any).stage;
        if (stage === 'RESOLVE') {
            const selectedCards = (_targets || []).filter((card: any) => ctx.machine.state.revealedCards.includes(card));
            selectedCards.forEach((card: any) => {
                const revealedIndex = ctx.machine.state.revealedCards.indexOf(card);
                if (revealedIndex === -1) return;
                const [removed] = ctx.machine.state.revealedCards.splice(revealedIndex, 1);
                if (removed) {
                    ctx.player.trash.push(removed);
                }
            });
            if (ctx.machine.state.revealedCards.length > 0) {
                ctx.player.deck.push(...ctx.machine.state.revealedCards);
                ctx.machine.shuffle(ctx.player.deck);
            }
            ctx.machine.state.revealedCards = [];
            return;
        }

        const revealedCards: any[] = [];
        for (let index = 0; index < 3; index += 1) {
            const revealed = ctx.player.deck.pop();
            if (!revealed) break;
            revealedCards.push(revealed);
        }
        if (revealedCards.length <= 0) return;

        ctx.machine.state.revealedCards = revealedCards;
        const targetSchema = {
            scope: 'REVEALED',
            type: 'CARD',
            count: revealedCards.length,
            selectMode: 'MANUAL',
        } as const;
        beginTargetSelection(
            ctx,
            {
                actionType: 'BT05_072_SELECT_REVEALED',
                effectDescription: '트래시할 공개 카드를 원하는 수만큼 선택한다.',
                validTargets: 'REVEALED',
                targetSchema,
                actionValue: {
                    allowPartialSelection: true,
                    minSelection: 0,
                    maxSelection: revealedCards.length,
                },
            },
            createComplexRuntimeEffect(
                targetSchema,
                'BT05-072 reveal three and trash any',
                {
                    mode: 'BT05_072_REVEAL_THREE_AND_TRASH_ANY',
                    stage: 'RESOLVE',
                },
                ActivationCondition.ENTRY,
            ),
        );
        return;
    }

    if ((params as any).mode === 'BT05_073_TRASH_TWO_ITEMS_AND_DESTROY_OTHER_LANE') {
        const stage = (params as any).stage;
        if (stage === 'RESOLVE_DESTROY') {
            destroyUnit(ctx, {}, _targets || []);
            return;
        }

        if (stage === 'RESOLVE_ITEMS') {
            if (!ctx.unitZone?.unit) return;
            const selectedItems = (_targets || []).filter((item: any) => {
                const located = findItemLocation(ctx.machine, item);
                return !!located && located.owner?.id === ctx.player.id && located.zone === ctx.unitZone;
            });
            if (selectedItems.length !== 2) return;

            selectedItems.forEach((item: any) => {
                const located = findItemLocation(ctx.machine, item);
                if (!located || located.zone !== ctx.unitZone || located.owner?.id !== ctx.player.id) return;
                const [removed] = located.zone.items.splice(located.itemIndex, 1);
                if (removed) {
                    ctx.player.trash.push(removed);
                }
            });

            const targetSchema = {
                scope: 'OPP_FIELD',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'DIFFERENT_LANE_FROM_SOURCE' }],
                selectMode: 'MANUAL',
            } as const;
            if (TargetSelector.resolve(ctx.machine, targetSchema as any, ctx).length <= 0) return;
            beginTargetSelection(
                ctx,
                {
                    actionType: 'BT05_073_SELECT_OPPONENT',
                    effectDescription: '트래시할 상대 유닛을 선택한다.',
                    validTargets: 'OPP_UNITS',
                    targetSchema,
                },
                createComplexRuntimeEffect(
                    targetSchema,
                    'BT05-073 destroy opponent in other lane',
                    {
                        mode: 'BT05_073_TRASH_TWO_ITEMS_AND_DESTROY_OTHER_LANE',
                        stage: 'RESOLVE_DESTROY',
                    },
                    ActivationCondition.ATTACKER,
                ),
            );
            return;
        }

        if (!ctx.unitZone?.unit || ctx.unitZone.items.length < 2) return;
        const targetSchema = {
            scope: 'MY_FIELD_ITEMS',
            type: 'CARD',
            count: 2,
            filters: [{ type: 'EQUIPPED_ON_SOURCE_UNIT' }],
            selectMode: 'MANUAL',
        } as const;
        beginTargetSelection(
            ctx,
            {
                actionType: 'BT05_073_SELECT_ITEMS',
                effectDescription: '트래시할 장착 아이템 2장을 선택한다.',
                validTargets: 'MY_FIELD_ITEMS',
                targetSchema,
            },
            createComplexRuntimeEffect(
                targetSchema,
                'BT05-073 trash two equipped items',
                {
                    mode: 'BT05_073_TRASH_TWO_ITEMS_AND_DESTROY_OTHER_LANE',
                    stage: 'RESOLVE_ITEMS',
                },
                ActivationCondition.ATTACKER,
            ),
        );
        return;
    }

    if ((params as any).mode === 'BT05_076_DRAW_DISCARD_AND_RECOVER_DISTINCT_ITEMS') {
        const openRecoverSelection = () => {
            const candidates = ctx.player.trash.filter((card: any) =>
                card?.type === CardType.ITEM && !cardHasKeywordLike(card, '트리거')
            );
            if (candidates.length <= 0) return;

            const targetSchema = {
                scope: 'MY_TRASH',
                type: 'CARD',
                count: Math.min(2, candidates.length),
                filters: [
                    { type: 'UNIT_TYPE', value: CardType.ITEM },
                    { type: 'NOT_HAS_KEYWORD', value: '트리거' },
                ],
                selectMode: 'MANUAL',
            } as const;
            beginTargetSelection(
                ctx,
                {
                    actionType: 'BT05_076_SELECT_TRASH',
                    effectDescription: '패에 넣을 서로 다른 이름의 아이템을 최대 2장까지 선택한다.',
                    validTargets: 'MY_TRASH',
                    targetSchema,
                    actionValue: {
                        allowPartialSelection: true,
                        minSelection: 0,
                        maxSelection: Math.min(2, candidates.length),
                        requireDistinctNames: true,
                    },
                },
                createComplexRuntimeEffect(
                    targetSchema,
                    'BT05-076 recover distinct item cards',
                    {
                        mode: 'BT05_076_DRAW_DISCARD_AND_RECOVER_DISTINCT_ITEMS',
                        stage: 'RECOVER',
                    },
                    ActivationCondition.ACTIVE,
                ),
            );
        };

        const stage = (params as any).stage;
        if (stage === 'RECOVER') {
            moveFromTrashToHand(ctx, {}, _targets || []);
            return;
        }

        if (stage === 'DISCARD') {
            const selectedCards = (_targets || []).filter((card: any) => ctx.player.hand.includes(card));
            const trashedCards: any[] = [];
            selectedCards.forEach((card: any) => {
                const removed = removeCardFromArrayByRefOrId(ctx.player.hand, card, card?.id);
                if (!removed) return;
                ctx.player.trash.push(removed);
                trashedCards.push(removed);
            });
            if (trashedCards.length > 0) {
                ctx.machine.notifyHandTrashed(ctx.player, trashedCards, {
                    flags: { handTrashByEffect: true },
                });
            }
            openRecoverSelection();
            return;
        }

        drawCard(ctx, { count: 2, __sourceActivation: ActivationCondition.ACTIVE }, []);
        const discardCount = Math.min(2, ctx.player.hand.length);
        if (discardCount <= 0) {
            openRecoverSelection();
            return;
        }

        const targetSchema = {
            scope: 'MY_HAND',
            type: 'CARD',
            count: discardCount,
            selectMode: 'MANUAL',
        } as const;
        beginTargetSelection(
            ctx,
            {
                actionType: 'BT05_076_SELECT_HAND',
                effectDescription: '트래시할 패를 선택한다.',
                validTargets: 'MY_HAND',
                targetSchema,
            },
            createComplexRuntimeEffect(
                targetSchema,
                'BT05-076 discard two after draw',
                {
                    mode: 'BT05_076_DRAW_DISCARD_AND_RECOVER_DISTINCT_ITEMS',
                    stage: 'DISCARD',
                },
                ActivationCondition.ACTIVE,
            ),
        );
        return;
    }

    if ((params as any).mode === 'BT05_077_EQUIP_ITEM_FROM_TRASH_AND_OPTIONAL_TRASH_SELF') {
        const stage = (params as any).stage;
        if (stage === 'RESOLVE_EQUIP') {
            const targetZone = (_targets || [])[0] as UnitZoneState | undefined;
            if (!targetZone?.unit) return;
            const item = removeCardFromArrayByRefOrId(
                ctx.player.trash,
                (params as any).selectedItemRef,
                (params as any).selectedItemId,
            );
            if (!item) return;
            const equipped = equipItemIgnoringSize(ctx, targetZone, item, { sourceActivation: ActivationCondition.ACTIVE });
            if (!equipped) {
                ctx.player.trash.push(item);
                return;
            }

            if (hasNonAttributeCardOnField(ctx.player, Attribute.LIGHTNING)) {
                const removedSource = removeCardFromArrayByRefOrId(ctx.player.skillZone, ctx.sourceCard, ctx.sourceCard.id);
                if (removedSource) {
                    ctx.player.trash.push(removedSource);
                }
            }
            return;
        }

        if (stage === 'SELECT_ZONE') {
            const selectedItem = (_targets || [])[0];
            if (!selectedItem) return;

            if (getValidEquipZoneIndexesForItem(ctx, selectedItem).length <= 0) return;

            const targetSchema = {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 1,
                selectMode: 'MANUAL',
            } as const;
            beginTargetSelection(
                ctx,
                {
                    actionType: 'BT05_077_SELECT_ZONE',
                    effectDescription: '장착할 자신 유닛을 선택한다.',
                    validTargets: 'MY_UNITS',
                    targetSchema,
                },
                createComplexRuntimeEffect(
                    targetSchema,
                    'BT05-077 equip chosen item from trash',
                    {
                        mode: 'BT05_077_EQUIP_ITEM_FROM_TRASH_AND_OPTIONAL_TRASH_SELF',
                        stage: 'RESOLVE_EQUIP',
                        selectedItemRef: selectedItem,
                        selectedItemId: selectedItem?.id,
                    },
                    ActivationCondition.ACTIVE,
                ),
            );
            return;
        }

        const itemCandidates = ctx.player.trash.filter((card: any) =>
            card?.type === CardType.ITEM && getValidEquipZoneIndexesForItem(ctx, card).length > 0
        );
        if (itemCandidates.length <= 0) return;
        ctx.machine.state.revealedCards = itemCandidates;
        const targetSchema = {
            scope: 'REVEALED',
            type: 'CARD',
            count: 1,
            selectMode: 'MANUAL',
        } as const;
        beginTargetSelection(
            ctx,
            {
                actionType: 'BT05_077_SELECT_ITEM',
                effectDescription: '장착할 트래시 아이템을 선택한다.',
                validTargets: 'REVEALED',
                targetSchema,
            },
            createComplexRuntimeEffect(
                targetSchema,
                'BT05-077 choose trash item to equip',
                {
                    mode: 'BT05_077_EQUIP_ITEM_FROM_TRASH_AND_OPTIONAL_TRASH_SELF',
                    stage: 'SELECT_ZONE',
                },
                ActivationCondition.ACTIVE,
            ),
        );
        return;
    }

    if ((params as any).mode === 'BT05_078_TRASH_EQUIPPED_UNIT_DRAW_AND_DAMAGE_IF_MIX') {
        const targetZone = (_targets || [])[0] as UnitZoneState | undefined;
        if (!targetZone?.unit) return;

        destroyUnit(ctx, {}, [targetZone]);
        drawCard(ctx, { count: 2, __sourceActivation: ActivationCondition.ACTIVE }, []);
        if (hasNonAttributeCardOnField(ctx.player, Attribute.LIGHTNING)) {
            damage(ctx, { value: 1, __sourceActivation: ActivationCondition.ACTIVE }, []);
        }
        return;
    }

    if ((params as any).mode === 'BT05_080_MOVE_EQUIPPED_ITEM_TO_OTHER_FRIENDLY') {
        const stage = (params as any).stage;
        if (stage === 'RESOLVE_MOVE') {
            const targetZone = (_targets || [])[0] as UnitZoneState | undefined;
            if (!targetZone?.unit) return;
            const located = findItemLocation(ctx.machine, (params as any).selectedItemRef);
            if (!located || located.owner?.id !== ctx.player.id) return;
            if (located.zone === targetZone) return;
            const duplicateName = targetZone.items.some((item: any) => item?.name && item.name === (params as any).selectedItemRef?.name);
            if (duplicateName) return;
            if (!RuleValidator.validateItemEquipConditions(ctx.machine, ctx.player, targetZone, (params as any).selectedItemRef).valid) return;

            const [movedItem] = located.zone.items.splice(located.itemIndex, 1);
            if (!movedItem) return;
            targetZone.items.push(movedItem);
            ctx.machine.notifyItemsEquipped(ctx.player, targetZone, [movedItem], {
                sourceActivation: ActivationCondition.ACTIVE_MAIN,
                sourcePlayerId: ctx.player.id,
                sourceCardId: ctx.sourceCard.id,
            });
            return;
        }

        if (stage === 'SELECT_ZONE') {
            const selectedItem = (_targets || [])[0];
            if (!selectedItem) return;
            const located = findItemLocation(ctx.machine, selectedItem);
            if (!located || located.owner?.id !== ctx.player.id) return;

            if (getValidEquipZoneIndexesForItem(ctx, selectedItem, { excludeZone: located.zone }).length <= 0) return;

            const targetSchema = {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 1,
                selectMode: 'MANUAL',
            } as const;
            beginTargetSelection(
                ctx,
                {
                    actionType: 'BT05_080_SELECT_ZONE',
                    effectDescription: '이동 장착할 자신 유닛을 선택한다.',
                    validTargets: 'MY_UNITS',
                    targetSchema,
                },
                createComplexRuntimeEffect(
                    targetSchema,
                    'BT05-080 move equipped item to other friendly unit',
                    {
                        mode: 'BT05_080_MOVE_EQUIPPED_ITEM_TO_OTHER_FRIENDLY',
                        stage: 'RESOLVE_MOVE',
                        selectedItemRef: selectedItem,
                        selectedItemId: selectedItem?.id,
                    },
                    ActivationCondition.ACTIVE_MAIN,
                ),
            );
            return;
        }

        const itemCandidates = ctx.player.unitZones.flatMap((zone: any) =>
            (zone?.items || []).filter((item: any) =>
                item?.type === CardType.ITEM &&
                item?.id !== ctx.sourceCard.id &&
                getValidEquipZoneIndexesForItem(ctx, item, { excludeZone: zone }).length > 0
            )
        );
        if (itemCandidates.length <= 0) return;

        ctx.machine.state.revealedCards = itemCandidates;
        const targetSchema = {
            scope: 'REVEALED',
            type: 'CARD',
            count: 1,
            selectMode: 'MANUAL',
        } as const;
        beginTargetSelection(
            ctx,
            {
                actionType: 'BT05_080_SELECT_ITEM',
                effectDescription: '이동할 장착 아이템을 선택한다.',
                validTargets: 'REVEALED',
                targetSchema,
            },
            createComplexRuntimeEffect(
                targetSchema,
                'BT05-080 choose equipped item to move',
                {
                    mode: 'BT05_080_MOVE_EQUIPPED_ITEM_TO_OTHER_FRIENDLY',
                    stage: 'SELECT_ZONE',
                },
                ActivationCondition.ACTIVE_MAIN,
            ),
        );
        return;
    }

    if ((params as any).mode === 'ST08_003_ESCAPE_BOTTOM_LEVEL') {
        const sourceZone = ctx.player.unitZones.find((zone: any) => zone?.unit === ctx.sourceCard);
        if (!sourceZone) return;
        const movedUnit = moveUnitZoneToDeckBottom(ctx.machine, ctx.player, sourceZone);
        if (!movedUnit) return;
        gainLevel(ctx, { value: 1 }, _targets);
        return;
    }

    if (
        (params as any).mode === 'ST08_009_REVEAL_TOP_DEPLOY_UNIT' ||
        (params as any).mode === 'ST08_001_ACTIVE_REVEAL_TOP_DEPLOY'
    ) {
        if (ctx.player.deck.length <= 0) return;
        const revealed = ctx.player.deck.pop();
        if (!revealed) return;
        const hasEmptyZone = ctx.player.unitZones.some((zone: any) => !zone?.unit);
        if (revealed.type !== CardType.UNIT || !hasEmptyZone) {
            ctx.player.trash.push(revealed);
            return;
        }

        ctx.machine.state.revealedCards = [revealed];
        const zoneSchema = {
            scope: 'MY_FIELD',
            type: 'ALL',
            count: 1,
            selectMode: 'MANUAL',
        } as const;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'ST08_009_SELECT_EMPTY_ZONE_TO_DEPLOY',
            actionValue: {
                revealedCardRef: revealed,
                revealedCardId: revealed.id,
            },
            effectDescription: '배치할 빈 유닛 존을 선택한다.',
            validTargets: 'MY_UNITS',
            targetSchema: zoneSchema as any,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, null);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'ST08_004_ACTIVE_DEPLOY_FROM_HAND') {
        const selectedCard = (_targets || []).find((card: any) =>
            ctx.player.hand.includes(card) &&
            card.type === CardType.UNIT &&
            ctx.machine.getCardCost(card) <= ctx.player.leaderLevel
        );
        if (!selectedCard) return;
        if (!ctx.player.unitZones.some((zone: any) => !zone?.unit)) return;

        const zoneSchema = {
            scope: 'MY_FIELD',
            type: 'ALL',
            count: 1,
            selectMode: 'MANUAL',
        } as const;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'ST08_004_SELECT_EMPTY_ZONE_TO_DEPLOY',
            actionValue: {
                selectedCardRef: selectedCard,
                selectedCardId: selectedCard.id,
            },
            effectDescription: '배치할 빈 유닛 존을 선택한다.',
            validTargets: 'MY_UNITS',
            targetSchema: zoneSchema as any,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, null);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'ST08_015_BUFF_AND_RECOVER_IF_ATTACKER') {
        const targetZone = (_targets || [])[0] as UnitZoneState | undefined;
        if (!targetZone?.unit) return;
        const owner = getOwnerOfZone(ctx.machine, targetZone);
        if (!owner || owner.id !== ctx.player.id) return;

        buffPower(ctx, { value: 2000, duration: 'TURN_END' }, [targetZone]);
        if (!zoneHasKeywordLike(targetZone, '어태커')) return;

        const targetSchema = {
            scope: 'MY_TRASH',
            type: 'CARD',
            count: 1,
            filters: [
                { type: 'UNIT_TYPE', value: CardType.SKILL },
                { type: 'COST_EQUAL', value: 2 },
                { type: 'NOT_HAS_KEYWORD', value: '트리거' },
            ],
            selectMode: 'MANUAL',
        } as const;
        if (TargetSelector.resolve(ctx.machine, targetSchema as any, ctx).length <= 0) return;

        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'ST08_015_SELECT_TRASH_SKILL_TO_HAND',
            actionValue: {},
            effectDescription: '패에 넣을 2코스트 스킬을 선택한다.',
            validTargets: 'MY_TRASH',
            targetSchema: targetSchema as any,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: ActivationCondition.ACTIVE,
            description: 'ST08-015 recover skill from trash',
            targets: targetSchema as any,
            action: { type: 'MOVE_FROM_TRASH_TO_HAND', params: {} },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'ST08_006_ESCAPE_REVEAL3_DEPLOY_BUFF') {
        const stage = (params as any).stage;
        if (stage === 'PROMPT_ZONE') {
            const selectedCard = (_targets || [])[0];
            const revealedCards = [...(ctx.machine.state.revealedCards || [])];
            const selectedIndex = revealedCards.findIndex((card: any) =>
                card === selectedCard || card?.id === selectedCard?.id
            );
            if (selectedIndex < 0) {
                ctx.player.trash.push(...revealedCards);
                ctx.machine.state.revealedCards = [];
                return;
            }

            ctx.machine.state.interactionMode = 'SELECT_TARGET';
            ctx.machine.state.pendingEffect = {
                sourceCard: ctx.sourceCard,
                sourcePlayerId: ctx.player.id,
                controllerPlayerId: ctx.player.id,
                actionType: 'ST08_006_SELECT_EMPTY_ZONE_TO_DEPLOY',
                actionValue: {
                    selectedCardRef: revealedCards[selectedIndex],
                    selectedCardId: revealedCards[selectedIndex]?.id,
                },
                effectDescription: '배치할 빈 유닛 존을 선택한다.',
                validTargets: 'MY_UNITS',
                targetSchema: {
                    scope: 'MY_FIELD',
                    type: 'ALL',
                    count: 1,
                    selectMode: 'MANUAL',
                } as any,
                selectedTargets: [],
            };
            ctx.machine.setPendingRuntime(ctx, null);
            ctx.machine.setInteractionOwner(ctx.player.id);
            return;
        }

        const sourceZone = ctx.player.unitZones.find((zone: any) => zone?.unit === ctx.sourceCard);
        if (!sourceZone) return;
        const movedUnit = moveUnitZoneToDeckBottom(ctx.machine, ctx.player, sourceZone);
        if (!movedUnit) return;

        const revealedCards: any[] = [];
        for (let i = 0; i < 3; i++) {
            const revealed = ctx.player.deck.pop();
            if (!revealed) break;
            revealedCards.push(revealed);
        }
        if (revealedCards.length <= 0) return;

        const unitCandidates = revealedCards.filter((card: any) => card?.type === CardType.UNIT);
        ctx.machine.state.revealedCards = revealedCards;
        if (unitCandidates.length <= 0 || !ctx.player.unitZones.some((zone: any) => !zone?.unit)) {
            ctx.player.trash.push(...revealedCards);
            ctx.machine.state.revealedCards = [];
            return;
        }

        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'ST08_006_SELECT_REVEALED_UNIT_TO_DEPLOY',
            actionValue: {},
            effectDescription: '배치할 공개 유닛을 선택한다.',
            validTargets: 'REVEALED',
            targetSchema: {
                scope: 'REVEALED',
                type: 'CARD',
                count: 1,
                filters: [{ type: 'UNIT_TYPE', value: CardType.UNIT }],
                selectMode: 'MANUAL',
            } as any,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: ActivationCondition.ESCAPE,
            description: 'ST08-006 select revealed unit then choose zone',
            targets: {
                scope: 'REVEALED',
                type: 'CARD',
                count: 1,
                filters: [{ type: 'UNIT_TYPE', value: CardType.UNIT }],
                selectMode: 'MANUAL',
            } as any,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'ST08_006_ESCAPE_REVEAL3_DEPLOY_BUFF',
                    stage: 'PROMPT_ZONE',
                },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'ST08_006_TRIGGER_TRASH_SELF') {
        const damageIndexByRef = ctx.player.damage.indexOf(ctx.sourceCard as any);
        const damageIndex = damageIndexByRef !== -1
            ? damageIndexByRef
            : ctx.player.damage.findIndex((card: any) => card?.id === ctx.sourceCard.id);
        if (damageIndex < 0) return;
        const [movedCard] = ctx.player.damage.splice(damageIndex, 1);
        if (!movedCard) return;
        ctx.player.trash.push(movedCard);
        const contextFlag = (params as any).setContextFlag;
        if (contextFlag) {
            ctx.flags = ctx.flags || {};
            ctx.flags[contextFlag] = true;
        }
        return;
    }

    if ((params as any).mode === 'ST08_007_ESCAPE_BOTTOM_SET_REACTIVE') {
        const sourceZone = ctx.player.unitZones.find((zone: any) => zone?.unit === ctx.sourceCard);
        if (!sourceZone) return;
        const movedUnit = moveUnitZoneToDeckBottom(ctx.machine, ctx.player, sourceZone);
        if (!movedUnit) return;

        const current = (ctx.player as any).st08_007Reactive as
            | { untilTurnCount?: number; count?: number }
            | undefined;
        const untilTurnCount = ctx.machine.state.turnCount + 1;
        const previousCount =
            current && ctx.machine.state.turnCount <= Number(current.untilTurnCount ?? -1)
                ? Math.max(0, Number(current.count || 0))
                : 0;
        (ctx.player as any).st08_007Reactive = {
            untilTurnCount: Math.max(untilTurnCount, Number(current?.untilTurnCount || 0)),
            count: previousCount + 1,
        };
        return;
    }

    if ((params as any).mode === 'ST08_016_TRASH_SKILLS_DAMAGE_IF_THREE') {
        const trashedSkills = ctx.player.skillZone.splice(0, ctx.player.skillZone.length);
        if (trashedSkills.length > 0) {
            ctx.player.trash.push(...trashedSkills);
        }
        if (trashedSkills.length >= 3) {
            damage(ctx, { value: 1 }, _targets);
        }
        return;
    }

    if ((params as any).mode === 'BT04_PROMPT_SCRIPTED_OPTIONS') {
        const unitPower = ctx.unitZone?.unit ? ctx.machine.getUnitPower(ctx.unitZone, ctx.player) : 0;
        const scriptedOptions = ((params as any).options || []).filter((option: any) => {
            const minSelfPower = typeof option?.minSelfPower === 'number' ? option.minSelfPower : undefined;
            if (typeof minSelfPower === 'number' && unitPower < minSelfPower) return false;
            return true;
        });
        if (scriptedOptions.length <= 0) return;

        if (scriptedOptions.length === 1) {
            executeBt06FollowUpSubActions(ctx.machine, ctx, scriptedOptions[0]?.subActions || []);
            return;
        }

        ctx.machine.state.revealedCards = scriptedOptions.map((option: any, index: number) =>
            createPromptOptionCard(
                `BT04-OPTION-${index}`,
                option?.label || `선택지 ${index + 1}`,
                option?.text || option?.label || `선택지 ${index + 1}`,
            )
        );

        const targetSchema = {
            scope: 'REVEALED',
            type: 'CARD',
            count: 1,
            selectMode: 'MANUAL',
        } as const;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT04_SELECT_SCRIPTED_OPTION',
            actionValue: { options: scriptedOptions },
            effectDescription: (params as any).prompt || '효과를 선택한다.',
            validTargets: 'REVEALED',
            targetSchema: targetSchema as any,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: ActivationCondition.ACTIVE,
            description: (params as any).prompt || 'BT04 scripted option prompt',
            targets: targetSchema as any,
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT04_PROMPT_SCRIPTED_OPTIONS' } },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'BT04_MOVE_TOP_DECK_TO_DAMAGE') {
        const count = Math.max(1, Number((params as any).count ?? 1));
        const movedCards: any[] = [];
        for (let i = 0; i < count; i++) {
            const moved = ctx.player.deck.pop();
            if (!moved) break;
            ctx.player.damage.push(moved);
            movedCards.push(moved);
        }
        if (movedCards.length <= 0) return;
        if (typeof ctx.machine.recordDamagePlacedByEffect === 'function') {
            ctx.machine.recordDamagePlacedByEffect(ctx.player.id, 'DECK', movedCards.length);
        }
        if ((params as any).setContextFlag) {
            ctx.flags = ctx.flags || {};
            ctx.flags[(params as any).setContextFlag] = true;
        }
        executeBt06FollowUpSubActions(ctx.machine, ctx, (params as any).thenSubActions || []);
        return;
    }

    if ((params as any).mode === 'BT04_MOVE_SOURCE_CARD_FROM_TRASH_TO_DAMAGE') {
        const sourceIndexByRef = ctx.player.trash.indexOf(ctx.sourceCard as any);
        const sourceIndex = sourceIndexByRef !== -1
            ? sourceIndexByRef
            : ctx.player.trash.findIndex((card: any) => card?.id === ctx.sourceCard.id);
        if (sourceIndex === -1) return;
        const [movedCard] = ctx.player.trash.splice(sourceIndex, 1);
        if (!movedCard) return;
        ctx.player.damage.push(movedCard);
        if (typeof ctx.machine.recordDamagePlacedByEffect === 'function') {
            ctx.machine.recordDamagePlacedByEffect(ctx.player.id, 'TRASH', 1);
        }
        return;
    }

    if ((params as any).mode === 'BT04_031_DRAW_IF_DAMAGE5_AND_ADD_BONUS') {
        const myDamageCount = typeof ctx.machine?.getEffectiveDamageCount === 'function'
            ? ctx.machine.getEffectiveDamageCount(ctx.player, ctx)
            : ctx.player.damage.length;
        if (myDamageCount >= 5) {
            drawCard(ctx, { count: 1, __sourceActivation: (params as any).__sourceActivation }, _targets);
        }
        addDamageCountReferenceBonusThisTurn(ctx, { value: 3 }, _targets);
        return;
    }

    if ((params as any).mode === 'BT04_034_BUFF_ALL_AND_DRAW_IF_TOTAL_DAMAGE10') {
        const friendlyUnitZones = ctx.player.unitZones.filter((zone: any) => !!zone?.unit);
        if (friendlyUnitZones.length > 0) {
            buffPower(ctx, { value: 2000, duration: 'TURN_END' }, friendlyUnitZones);
        }
        const myDamageCount = typeof ctx.machine?.getEffectiveDamageCount === 'function'
            ? ctx.machine.getEffectiveDamageCount(ctx.player, ctx)
            : ctx.player.damage.length;
        if (myDamageCount + ctx.opponent.damage.length >= 10) {
            drawCard(ctx, { count: 1, __sourceActivation: (params as any).__sourceActivation }, _targets);
        }
        return;
    }

    if ((params as any).mode === 'BT04_041_LEADER_MOVE_HAND_TO_DAMAGE_THEN_RECOVER_BY_COST') {
        const stage = (params as any).stage;

        if (stage === 'RESOLVE_TRASH') {
            const selectedCard = (_targets || []).find((card: any) => ctx.player.trash.includes(card));
            if (!selectedCard) return;
            moveFromTrashToHand(ctx, {}, [selectedCard]);
            return;
        }

        if (stage === 'SELECT_HAND') {
            const selectedCard = (_targets || []).find((card: any) => ctx.player.hand.includes(card));
            if (!selectedCard) return;
            moveFromHandToDamage(ctx, {
                setContextFlag: 'BT04_041_MOVED',
                storeMovedCardAsCostPayment: true,
            }, [selectedCard]);
            if (ctx.flags?.BT04_041_MOVED !== true) return;

            const targetSchema = {
                scope: 'MY_TRASH',
                type: 'CARD',
                count: 1,
                filters: [{ type: 'COST_LIMIT_BY_COST_PAYMENT' }],
                selectMode: 'MANUAL',
            } as const;
            if (TargetSelector.resolve(ctx.machine, targetSchema as any, ctx).length <= 0) return;

            ctx.machine.state.interactionMode = 'SELECT_TARGET';
            ctx.machine.state.pendingEffect = {
                sourceCard: ctx.sourceCard,
                sourcePlayerId: ctx.player.id,
                controllerPlayerId: ctx.player.id,
                actionType: 'BT04_041_SELECT_TRASH_TO_HAND',
                actionValue: {},
                effectDescription: '패에 넣을 트래시 카드를 선택한다.',
                validTargets: 'MY_TRASH',
                targetSchema: targetSchema as any,
                selectedTargets: [],
            };
            ctx.machine.setPendingRuntime(ctx, {
                activation: ActivationCondition.ACTIVE_MAIN,
                description: 'BT04-041 recover card from trash',
                targets: targetSchema as any,
                action: {
                    type: 'COMPLEX_ACTION',
                    params: { mode: 'BT04_041_LEADER_MOVE_HAND_TO_DAMAGE_THEN_RECOVER_BY_COST', stage: 'RESOLVE_TRASH' },
                },
            } as any);
            ctx.machine.setInteractionOwner(ctx.player.id);
            return;
        }

        const handSchema = {
            scope: 'MY_HAND',
            type: 'CARD',
            count: 1,
            filters: [{ type: 'HAS_ANY_TRAIT', value: ['용의 계곡', '혹한의 날들'] }],
            selectMode: 'MANUAL',
        } as const;
        if (TargetSelector.resolve(ctx.machine, handSchema as any, ctx).length <= 0) return;

        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT04_041_SELECT_HAND_TO_DAMAGE',
            actionValue: {},
            effectDescription: '대미지 존에 놓을 패를 선택한다.',
            validTargets: 'MY_HAND',
            targetSchema: handSchema as any,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: 'BT04-041 move hand card to damage',
            targets: handSchema as any,
            action: {
                type: 'COMPLEX_ACTION',
                params: { mode: 'BT04_041_LEADER_MOVE_HAND_TO_DAMAGE_THEN_RECOVER_BY_COST', stage: 'SELECT_HAND' },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'BT04_019_ATTACKER_OPTIONAL_HAND_TO_DAMAGE_THEN_DAMAGE') {
        const stage = (params as any).stage;
        if (stage === 'RESOLVE') {
            const selectedCard = (_targets || []).find((card: any) => ctx.player.hand.includes(card));
            if (!selectedCard) return;
            const handIndex = ctx.player.hand.indexOf(selectedCard);
            if (handIndex === -1) return;
            const [moved] = ctx.player.hand.splice(handIndex, 1);
            if (!moved) return;
            ctx.player.damage.push(moved);
            if (typeof ctx.machine.recordDamagePlacedByEffect === 'function') {
                ctx.machine.recordDamagePlacedByEffect(ctx.player.id, 'HAND', 1);
            }
            damage(ctx, { value: 1, __sourceActivation: (params as any).__sourceActivation }, _targets);
            return;
        }

        if (ctx.player.hand.length <= 0) return;
        const targetSchema = {
            scope: 'MY_HAND',
            type: 'CARD',
            count: 1,
            selectMode: 'MANUAL',
        } as const;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT04_019_SELECT_HAND_TO_DAMAGE',
            actionValue: {},
            effectDescription: '대미지 존에 놓을 패를 선택한다.',
            validTargets: 'MY_HAND',
            targetSchema: targetSchema as any,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: ActivationCondition.ATTACKER,
            description: 'BT04-019 resolve hand to damage then deal 1',
            targets: targetSchema as any,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT04_019_ATTACKER_OPTIONAL_HAND_TO_DAMAGE_THEN_DAMAGE',
                    stage: 'RESOLVE',
                },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'BT04_BUFF_ALL_FRIENDLY_IF_UNIT_COUNT') {
        const requiredCount = Math.max(0, Number((params as any).requiredCount ?? 0));
        const power = Number((params as any).power ?? 0);
        const friendlyUnitZones = ctx.player.unitZones.filter((zone: any) => !!zone?.unit);
        if (friendlyUnitZones.length !== requiredCount || power === 0) return;
        friendlyUnitZones.forEach((zone: any) => {
            zone.buffs.push({
                id: ctx.machine.createRuntimeId('BUFF'),
                sourceCard: ctx.sourceCard,
                type: 'POWER',
                value: power,
                duration: 'TURN_END',
            });
        });
        return;
    }

    if ((params as any).mode === 'BT04_044_MILL3_DRAW_IF_EXIT_UNIT') {
        const trashed = trashTopCards(ctx.player, 3);
        const hasExitUnit = trashed.some((card: any) => card?.type === CardType.UNIT && cardHasKeywordLike(card, '엑시트'));
        if (hasExitUnit) {
            drawCard(ctx, { count: 1, __sourceActivation: (params as any).__sourceActivation }, _targets);
        }
        return;
    }

    if ((params as any).mode === 'BT04_045_REDEPLOY_SELF_AT_TURN_END') {
        const delayed = (ctx.player as any).delayedActions = (ctx.player as any).delayedActions || [];
        delayed.push({
            type: 'DEPLOY_FROM_TRASH_TO_EMPTY_ZONE',
            card: ctx.sourceCard,
            turnCount: ctx.machine.state.turnCount,
        });
        return;
    }

    if ((params as any).mode === 'BT04_048_MOVE_OTHER_FRIENDLY_TO_DAMAGE_AND_BUFF_SELF') {
        const targetZone = (_targets || []).find((target: any) => target?.unit && ctx.player.unitZones.includes(target));
        if (!targetZone?.unit) return;
        const movedUnit = targetZone.unit;
        targetZone.unit = null;
        ctx.player.damage.push(movedUnit);
        targetZone.items.forEach((item: any) => ctx.player.trash.push(item));
        targetZone.items = [];
        targetZone.buffs = [];
        targetZone.temporaryEffects = [];
        targetZone.attackCountThisTurn = 0;
        targetZone.extraAttackAllowance = 0;
        targetZone.hasAttacked = false;
        targetZone.isExhausted = false;
        targetZone.hasPlacedUnitThisTurn = false;
        targetZone.hasActivatedEffectThisTurn = false;
        targetZone.activatedEffectKeys = {};
        if (typeof ctx.machine.recordDamagePlacedByEffect === 'function') {
            ctx.machine.recordDamagePlacedByEffect(ctx.player.id, 'FIELD', 1);
        }
        if (!ctx.unitZone?.unit) return;
        ctx.unitZone.buffs.push({
            id: ctx.machine.createRuntimeId('BUFF'),
            sourceCard: ctx.sourceCard,
            type: 'POWER',
            value: 2000,
            duration: 'TURN_END',
        });
        ctx.unitZone.buffs.push({
            id: ctx.machine.createRuntimeId('BUFF'),
            sourceCard: ctx.sourceCard,
            type: 'HIT',
            value: 1,
            duration: 'TURN_END',
        });
        return;
    }

    if ((params as any).mode === 'BT04_049_GRANT_TURN_END_TRASH_AND_HIT') {
        const targetZone = (_targets || []).find((target: any) => target?.unit);
        if (!targetZone?.unit) return;
        targetZone.temporaryEffects.push({
            activation: ActivationCondition.TURN_END,
            description: '턴 종료 시 이 유닛을 트래시한다.',
            action: { type: 'DESTROY_SELF', params: {} },
            duration: 'TURN_END',
        });
        targetZone.buffs.push({
            id: ctx.machine.createRuntimeId('BUFF'),
            sourceCard: ctx.sourceCard,
            type: 'HIT',
            value: 1,
            duration: 'TURN_END',
        });
        return;
    }

    if ((params as any).mode === 'BT04_052_EXIT_DISCARD_FOR_HOMUNCULUS_RECOVER') {
        const stage = (params as any).stage;
        const maxCost = countFriendlyTraitAttacks(ctx, '호문클루스');
        if (maxCost <= 0) return;

        if (stage === 'RESOLVE') {
            const selectedCard = (_targets || []).find((card: any) => ctx.player.trash.includes(card));
            if (!selectedCard) return;
            const trashIndex = ctx.player.trash.indexOf(selectedCard);
            if (trashIndex === -1) return;
            const [movedCard] = ctx.player.trash.splice(trashIndex, 1);
            if (movedCard) ctx.player.hand.push(movedCard);
            return;
        }

        const targetSchema = {
            scope: 'MY_TRASH',
            type: 'CARD',
            count: 1,
            filters: [{ type: 'COST_LIMIT', value: maxCost }],
            selectMode: 'MANUAL',
        } as const;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT04_052_SELECT_TRASH_TO_HAND',
            actionValue: {},
            effectDescription: '패에 넣을 카드를 선택한다.',
            validTargets: 'MY_TRASH',
            targetSchema: targetSchema as any,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: ActivationCondition.EXIT,
            description: 'BT04-052 resolve homunculus recover',
            targets: targetSchema as any,
            action: {
                type: 'COMPLEX_ACTION',
                params: { mode: 'BT04_052_EXIT_DISCARD_FOR_HOMUNCULUS_RECOVER', stage: 'RESOLVE' },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'BT04_061_MOVE_HAND_TO_DAMAGE_THEN_RECOVER_UNIT') {
        const stage = (params as any).stage;

        if (stage === 'RESOLVE_TRASH') {
            const selectedCard = (_targets || []).find((card: any) => ctx.player.trash.includes(card));
            if (!selectedCard) return;
            moveFromTrashToHand(ctx, {}, [selectedCard]);
            return;
        }

        if (stage === 'SELECT_HAND') {
            const selectedCard = (_targets || []).find((card: any) => ctx.player.hand.includes(card));
            if (!selectedCard) return;
            moveFromHandToDamage(ctx, { setContextFlag: 'BT04_061_MOVED' }, [selectedCard]);
            if (ctx.flags?.BT04_061_MOVED !== true) return;

            const targetSchema = {
                scope: 'MY_TRASH',
                type: 'CARD',
                count: 1,
                filters: [{ type: 'UNIT_TYPE', value: CardType.UNIT }],
                selectMode: 'MANUAL',
            } as const;
            if (TargetSelector.resolve(ctx.machine, targetSchema as any, ctx).length <= 0) return;

            ctx.machine.state.interactionMode = 'SELECT_TARGET';
            ctx.machine.state.pendingEffect = {
                sourceCard: ctx.sourceCard,
                sourcePlayerId: ctx.player.id,
                controllerPlayerId: ctx.player.id,
                actionType: 'BT04_061_SELECT_TRASH_UNIT_TO_HAND',
                actionValue: {},
                effectDescription: '패에 넣을 유닛 카드를 선택한다.',
                validTargets: 'MY_TRASH',
                targetSchema: targetSchema as any,
                selectedTargets: [],
            };
            ctx.machine.setPendingRuntime(ctx, {
                activation: ActivationCondition.ACTIVE_MAIN,
                description: 'BT04-061 recover unit from trash',
                targets: targetSchema as any,
                action: {
                    type: 'COMPLEX_ACTION',
                    params: { mode: 'BT04_061_MOVE_HAND_TO_DAMAGE_THEN_RECOVER_UNIT', stage: 'RESOLVE_TRASH' },
                },
            } as any);
            ctx.machine.setInteractionOwner(ctx.player.id);
            return;
        }

        const handSchema = {
            scope: 'MY_HAND',
            type: 'CARD',
            count: 1,
            selectMode: 'MANUAL',
        } as const;
        if (TargetSelector.resolve(ctx.machine, handSchema as any, ctx).length <= 0) return;

        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT04_061_SELECT_HAND_TO_DAMAGE',
            actionValue: {},
            effectDescription: '대미지 존에 놓을 패를 선택한다.',
            validTargets: 'MY_HAND',
            targetSchema: handSchema as any,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: 'BT04-061 move hand card to damage',
            targets: handSchema as any,
            action: {
                type: 'COMPLEX_ACTION',
                params: { mode: 'BT04_061_MOVE_HAND_TO_DAMAGE_THEN_RECOVER_UNIT', stage: 'SELECT_HAND' },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'BT04_062_EXIT_DISCARD_AND_RECOVER') {
        const stage = (params as any).stage;
        const discardedCard = ctx.costPaymentCard;
        const allowAny = cardHasTraitLike(discardedCard, '런웨이 파이터');

        if (stage === 'RESOLVE') {
            const selectedCard = (_targets || []).find((card: any) => ctx.player.trash.includes(card));
            if (!selectedCard) return;
            const trashIndex = ctx.player.trash.indexOf(selectedCard);
            if (trashIndex === -1) return;
            const [movedCard] = ctx.player.trash.splice(trashIndex, 1);
            if (movedCard) ctx.player.hand.push(movedCard);
            return;
        }

        const targetSchema = allowAny
            ? {
                scope: 'MY_TRASH',
                type: 'CARD',
                count: 1,
                selectMode: 'MANUAL',
            } as const
            : {
                scope: 'MY_TRASH',
                type: 'CARD',
                count: 1,
                filters: [
                    { type: 'UNIT_TYPE', value: CardType.UNIT },
                    { type: 'COST_LIMIT', value: 2 },
                ],
                selectMode: 'MANUAL',
            } as const;
        if (TargetSelector.resolve(ctx.machine, targetSchema as any, ctx).length <= 0) return;

        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT04_062_SELECT_TRASH_TO_HAND',
            actionValue: {},
            effectDescription: '패에 넣을 카드를 선택한다.',
            validTargets: 'MY_TRASH',
            targetSchema: targetSchema as any,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: ActivationCondition.EXIT,
            description: 'BT04-062 resolve recover from trash',
            targets: targetSchema as any,
            action: {
                type: 'COMPLEX_ACTION',
                params: { mode: 'BT04_062_EXIT_DISCARD_AND_RECOVER', stage: 'RESOLVE' },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'BT04_066_REVEAL4_SPLIT_DAMAGE_HAND_TRASH') {
        const stage = (params as any).stage;
        if (stage === 'SELECT_DAMAGE') {
            const selectedCard = (_targets || []).find((card: any) => ctx.machine.state.revealedCards.includes(card));
            if (!selectedCard) return;
            const revealIndex = ctx.machine.state.revealedCards.indexOf(selectedCard);
            if (revealIndex !== -1) ctx.machine.state.revealedCards.splice(revealIndex, 1);
            ctx.player.damage.push(selectedCard);
            if (typeof ctx.machine.recordDamagePlacedByEffect === 'function') {
                ctx.machine.recordDamagePlacedByEffect(ctx.player.id, 'DECK', 1);
            }

            if (ctx.machine.state.revealedCards.length <= 0) return;
            const targetSchema = {
                scope: 'REVEALED',
                type: 'CARD',
                count: 1,
                selectMode: 'MANUAL',
            } as const;
            ctx.machine.state.interactionMode = 'SELECT_TARGET';
            ctx.machine.state.pendingEffect = {
                sourceCard: ctx.sourceCard,
                sourcePlayerId: ctx.player.id,
                controllerPlayerId: ctx.player.id,
                actionType: 'BT04_066_SELECT_REVEALED_TO_HAND',
                actionValue: {},
                effectDescription: '패에 넣을 카드를 선택한다.',
                validTargets: 'REVEALED',
                targetSchema: targetSchema as any,
                selectedTargets: [],
            };
            ctx.machine.setPendingRuntime(ctx, {
                activation: ActivationCondition.EXIT,
                description: 'BT04-066 select revealed card to hand',
                targets: targetSchema as any,
                action: {
                    type: 'COMPLEX_ACTION',
                    params: { mode: 'BT04_066_REVEAL4_SPLIT_DAMAGE_HAND_TRASH', stage: 'SELECT_HAND' },
                },
            } as any);
            ctx.machine.setInteractionOwner(ctx.player.id);
            return;
        }

        if (stage === 'SELECT_HAND') {
            const selectedCard = (_targets || []).find((card: any) => ctx.machine.state.revealedCards.includes(card));
            if (selectedCard) {
                const revealIndex = ctx.machine.state.revealedCards.indexOf(selectedCard);
                if (revealIndex !== -1) ctx.machine.state.revealedCards.splice(revealIndex, 1);
                ctx.player.hand.push(selectedCard);
            }
            if (ctx.machine.state.revealedCards.length > 0) {
                ctx.player.trash.push(...ctx.machine.state.revealedCards);
            }
            ctx.machine.state.revealedCards = [];
            return;
        }

        const revealCount = Math.min(4, ctx.player.deck.length);
        if (revealCount <= 0) return;
        ctx.machine.state.revealedCards = ctx.player.deck.splice(-revealCount);
        const targetSchema = {
            scope: 'REVEALED',
            type: 'CARD',
            count: 1,
            selectMode: 'MANUAL',
        } as const;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT04_066_SELECT_REVEALED_TO_DAMAGE',
            actionValue: {},
            effectDescription: '대미지 존에 놓을 카드를 선택한다.',
            validTargets: 'REVEALED',
            targetSchema: targetSchema as any,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: ActivationCondition.EXIT,
            description: 'BT04-066 select revealed card to damage',
            targets: targetSchema as any,
            action: {
                type: 'COMPLEX_ACTION',
                params: { mode: 'BT04_066_REVEAL4_SPLIT_DAMAGE_HAND_TRASH', stage: 'SELECT_DAMAGE' },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'BT04_067_EXIT_REDEPLOY_HOMUNCULUS_FROM_TRASH') {
        const stage = (params as any).stage;
        const maxCost = countFriendlyTraitAttacks(ctx, '호문클루스');
        if (maxCost <= 0 || !ctx.player.unitZones.some((zone: any) => !zone?.unit)) return;

        if (stage === 'RESOLVE') {
            const selectedCard = (_targets || []).find((card: any) => ctx.player.trash.includes(card));
            if (!selectedCard) return;
            const trashIndex = ctx.player.trash.indexOf(selectedCard);
            if (trashIndex === -1) return;
            const [placedUnit] = ctx.player.trash.splice(trashIndex, 1);
            if (!placedUnit) return;
            deployUnitToFirstEmptyZone(ctx.machine, ctx.player, placedUnit);
            return;
        }

        const targetSchema = {
            scope: 'MY_TRASH',
            type: 'CARD',
            count: 1,
            filters: [
                { type: 'UNIT_TYPE', value: CardType.UNIT },
                { type: 'HAS_TRAIT', value: '호문클루스' },
                { type: 'EXCLUDE_CARD_ID', value: 'BT04-067' },
                { type: 'COST_LIMIT', value: maxCost },
            ],
            selectMode: 'MANUAL',
        } as const;
        if (TargetSelector.resolve(ctx.machine, targetSchema as any, ctx).length <= 0) return;

        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT04_067_SELECT_TRASH_TO_DEPLOY',
            actionValue: {},
            effectDescription: '배치할 《호문클루스》 유닛을 선택한다.',
            validTargets: 'MY_TRASH',
            targetSchema: targetSchema as any,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: ActivationCondition.EXIT,
            description: 'BT04-067 select homunculus to deploy',
            targets: targetSchema as any,
            action: {
                type: 'COMPLEX_ACTION',
                params: { mode: 'BT04_067_EXIT_REDEPLOY_HOMUNCULUS_FROM_TRASH', stage: 'RESOLVE' },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'BT04_035_COMPARE_POWER_AND_TRASH') {
        const stage = (params as any).stage;
        if (stage === 'SELECT_FRIENDLY') {
            const friendlyZone = (_targets || []).find((target: any) => target?.unit && ctx.player.unitZones.includes(target));
            if (!friendlyZone?.unit) return;
            const friendlyZoneIndex = ctx.player.unitZones.indexOf(friendlyZone);
            if (friendlyZoneIndex < 0) return;
            const targetSchema = {
                scope: 'OPP_FIELD',
                type: 'UNIT',
                count: 1,
                selectMode: 'MANUAL',
            } as const;
            ctx.machine.state.interactionMode = 'SELECT_TARGET';
            ctx.machine.state.pendingEffect = {
                sourceCard: ctx.sourceCard,
                sourcePlayerId: ctx.player.id,
                controllerPlayerId: ctx.player.id,
                actionType: 'BT04_035_SELECT_OPP_UNIT',
                actionValue: { friendlyZoneIndex },
                effectDescription: '파워를 감소시킬 상대 유닛을 선택한다.',
                validTargets: 'OPP_UNITS',
                targetSchema: targetSchema as any,
                selectedTargets: [],
            };
            ctx.machine.setPendingRuntime(ctx, {
                activation: ActivationCondition.ACTIVE_MAIN,
                description: 'BT04-035 resolve compare power and trash',
                targets: targetSchema as any,
                action: {
                    type: 'COMPLEX_ACTION',
                    params: {
                        mode: 'BT04_035_COMPARE_POWER_AND_TRASH',
                        stage: 'RESOLVE',
                        friendlyZoneIndex,
                    },
                },
            } as any);
            ctx.machine.setInteractionOwner(ctx.player.id);
            return;
        }

        if (stage === 'RESOLVE') {
            const friendlyZoneIndex = Number((params as any).friendlyZoneIndex);
            const friendlyZone = ctx.player.unitZones[friendlyZoneIndex];
            const targetZone = (_targets || []).find((target: any) => target?.unit && ctx.opponent.unitZones.includes(target));
            if (!friendlyZone?.unit || !targetZone?.unit) return;
            const friendlyPower = ctx.machine.getUnitPower(friendlyZone, ctx.player);
            targetZone.buffs.push({
                id: ctx.machine.createRuntimeId('BUFF'),
                sourceCard: ctx.sourceCard,
                type: 'POWER',
                value: -friendlyPower,
                duration: 'TURN_END',
            });
            ctx.machine.destroyUnit(ctx.player, friendlyZone, undefined, 'EFFECT');
            return;
        }

        const targetSchema = {
            scope: 'MY_FIELD',
            type: 'UNIT',
            count: 1,
            selectMode: 'MANUAL',
        } as const;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT04_035_SELECT_FRIENDLY_UNIT',
            actionValue: {},
            effectDescription: '파워를 비교할 자신 유닛을 선택한다.',
            validTargets: 'MY_UNITS',
            targetSchema: targetSchema as any,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: 'BT04-035 select friendly unit',
            targets: targetSchema as any,
            action: {
                type: 'COMPLEX_ACTION',
                params: { mode: 'BT04_035_COMPARE_POWER_AND_TRASH', stage: 'SELECT_FRIENDLY' },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'BT04_037_RETURN_TRASH_DISCARD_ZERO_COST_DRAW') {
        const stage = (params as any).stage;
        lockSkillTraitUntilTurnEnd(ctx, { trait: '성약' }, _targets);

        if (stage === 'SELECT_TRASH') {
            const selectedCard = (_targets || []).find((card: any) => ctx.player.trash.includes(card));
            if (!selectedCard) return;
            const trashIndex = ctx.player.trash.indexOf(selectedCard);
            if (trashIndex === -1) return;
            const [movedCard] = ctx.player.trash.splice(trashIndex, 1);
            if (movedCard) ctx.player.hand.push(movedCard);

            const handSchema = {
                scope: 'MY_HAND',
                type: 'CARD',
                count: 1,
                selectMode: 'MANUAL',
            } as const;
            ctx.machine.state.interactionMode = 'SELECT_TARGET';
            ctx.machine.state.pendingEffect = {
                sourceCard: ctx.sourceCard,
                sourcePlayerId: ctx.player.id,
                controllerPlayerId: ctx.player.id,
                actionType: 'BT04_037_SELECT_HAND_DISCARD',
                actionValue: {},
                effectDescription: '트래시할 패를 선택한다.',
                validTargets: 'MY_HAND',
                targetSchema: handSchema as any,
                selectedTargets: [],
            };
            ctx.machine.setPendingRuntime(ctx, {
                activation: ActivationCondition.ACTIVE_MAIN,
                description: 'BT04-037 discard hand after recover',
                targets: handSchema as any,
                action: {
                    type: 'COMPLEX_ACTION',
                    params: { mode: 'BT04_037_RETURN_TRASH_DISCARD_ZERO_COST_DRAW', stage: 'SELECT_HAND' },
                },
            } as any);
            ctx.machine.setInteractionOwner(ctx.player.id);
            return;
        }

        if (stage === 'SELECT_HAND') {
            const selectedCard = (_targets || []).find((card: any) => ctx.player.hand.includes(card));
            if (!selectedCard) return;
            const handIndex = ctx.player.hand.indexOf(selectedCard);
            if (handIndex === -1) return;
            const [trashedCard] = ctx.player.hand.splice(handIndex, 1);
            if (trashedCard) {
                ctx.player.trash.push(trashedCard);
                ctx.machine.notifyHandTrashed(ctx.player, [trashedCard], {
                    flags: { handTrashByEffect: true },
                });
            }

            const zoneSchema = {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'HAS_TRAIT', value: '계승자' }],
                selectMode: 'MANUAL',
            } as const;
            ctx.machine.state.interactionMode = 'SELECT_TARGET';
            ctx.machine.state.pendingEffect = {
                sourceCard: ctx.sourceCard,
                sourcePlayerId: ctx.player.id,
                controllerPlayerId: ctx.player.id,
                actionType: 'BT04_037_SELECT_UNIT_ZERO_COST',
                actionValue: {},
                effectDescription: '0코스트로 만들 유닛을 선택한다.',
                validTargets: 'MY_UNITS',
                targetSchema: zoneSchema as any,
                selectedTargets: [],
            };
            ctx.machine.setPendingRuntime(ctx, {
                activation: ActivationCondition.ACTIVE_MAIN,
                description: 'BT04-037 set target cost zero',
                targets: zoneSchema as any,
                action: {
                    type: 'COMPLEX_ACTION',
                    params: { mode: 'BT04_037_RETURN_TRASH_DISCARD_ZERO_COST_DRAW', stage: 'SELECT_UNIT' },
                },
            } as any);
            ctx.machine.setInteractionOwner(ctx.player.id);
            return;
        }

        if (stage === 'SELECT_UNIT') {
            const targetZone = (_targets || []).find((target: any) => target?.unit && ctx.player.unitZones.includes(target));
            if (!targetZone?.unit) return;
            (targetZone.unit as any).turnCostOverride = {
                cost: 0,
                turnCount: ctx.machine.state.turnCount,
            };
            drawCard(ctx, { count: 1, __sourceActivation: (params as any).__sourceActivation }, _targets);
            return;
        }

        const targetSchema = {
            scope: 'MY_TRASH',
            type: 'CARD',
            count: 1,
            filters: [{ type: 'COST_LIMIT', value: 4 }],
            selectMode: 'MANUAL',
        } as const;
        if (TargetSelector.resolve(ctx.machine, targetSchema as any, ctx).length <= 0) return;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT04_037_SELECT_TRASH_TO_HAND',
            actionValue: {},
            effectDescription: '패에 넣을 트래시 카드를 선택한다.',
            validTargets: 'MY_TRASH',
            targetSchema: targetSchema as any,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: 'BT04-037 recover from trash',
            targets: targetSchema as any,
            action: {
                type: 'COMPLEX_ACTION',
                params: { mode: 'BT04_037_RETURN_TRASH_DISCARD_ZERO_COST_DRAW', stage: 'SELECT_TRASH' },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'BT04_069_EXIT_BOTTOM6_AND_REVIVE_SELF') {
        const stage = (params as any).stage;
        if (stage === 'RESOLVE_BOTTOM') {
            const selectedCards = (_targets || []).filter((card: any) => ctx.player.trash.includes(card));
            if (selectedCards.length !== 6) return;
            const movedCards: any[] = [];
            selectedCards.forEach((card: any) => {
                const index = ctx.player.trash.indexOf(card);
                if (index !== -1) {
                    const [removed] = ctx.player.trash.splice(index, 1);
                    if (removed) movedCards.push(removed);
                }
            });
            if (movedCards.length !== 6) return;
            ctx.player.deck.unshift(...movedCards);

            const runwayCount = movedCards.filter((card: any) => cardHasTraitLike(card, '런웨이 파이터')).length;
            if (runwayCount >= 2 && ctx.player.damage.length >= 7) {
                const damageSchema = {
                    scope: 'MY_DAMAGE',
                    type: 'CARD',
                    count: 1,
                    selectMode: 'MANUAL',
                } as const;
                ctx.machine.state.interactionMode = 'SELECT_TARGET';
                ctx.machine.state.pendingEffect = {
                    sourceCard: ctx.sourceCard,
                    sourcePlayerId: ctx.player.id,
                    controllerPlayerId: ctx.player.id,
                    actionType: 'BT04_069_SELECT_DAMAGE_TO_TRASH',
                    actionValue: {},
                    effectDescription: '트래시할 대미지 카드를 선택할 수 있다.',
                    validTargets: 'MY_DAMAGE',
                    targetSchema: damageSchema as any,
                    selectedTargets: [],
                };
                ctx.machine.setPendingRuntime(ctx, {
                    activation: ActivationCondition.EXIT,
                    description: 'BT04-069 optional damage to trash',
                    targets: damageSchema as any,
                    action: {
                        type: 'COMPLEX_ACTION',
                        params: { mode: 'BT04_069_EXIT_BOTTOM6_AND_REVIVE_SELF', stage: 'SELECT_DAMAGE' },
                    },
                } as any);
                ctx.machine.setInteractionOwner(ctx.player.id);
                return;
            }

            const selfTrashIndex = ctx.player.trash.indexOf(ctx.sourceCard as any);
            const selfIndex = selfTrashIndex !== -1
                ? selfTrashIndex
                : ctx.player.trash.findIndex((card: any) => card?.id === ctx.sourceCard.id);
            if (selfIndex === -1) return;
            const [selfCard] = ctx.player.trash.splice(selfIndex, 1);
            if (selfCard) {
                deployUnitToFirstEmptyZone(ctx.machine, ctx.player, selfCard);
            }
            return;
        }

        if (stage === 'SELECT_DAMAGE') {
            const selectedCard = (_targets || []).find((card: any) => ctx.player.damage.includes(card));
            if (selectedCard) {
                const damageIndex = ctx.player.damage.indexOf(selectedCard);
                if (damageIndex !== -1) {
                    const [movedCard] = ctx.player.damage.splice(damageIndex, 1);
                    if (movedCard) ctx.player.trash.push(movedCard);
                }
            }
            const selfTrashIndex = ctx.player.trash.indexOf(ctx.sourceCard as any);
            const selfIndex = selfTrashIndex !== -1
                ? selfTrashIndex
                : ctx.player.trash.findIndex((card: any) => card?.id === ctx.sourceCard.id);
            if (selfIndex === -1) return;
            const [selfCard] = ctx.player.trash.splice(selfIndex, 1);
            if (selfCard) {
                deployUnitToFirstEmptyZone(ctx.machine, ctx.player, selfCard);
            }
            return;
        }

        const targetSchema = {
            scope: 'MY_TRASH',
            type: 'CARD',
            count: 6,
            filters: [
                { type: 'NOT_HAS_KEYWORD', value: '트리거' },
                { type: 'EXCLUDE_CARD_ID', value: ctx.sourceCard.id },
            ],
            selectMode: 'MANUAL',
        } as const;
        const candidates = TargetSelector.resolve(ctx.machine, targetSchema as any, ctx);
        if (candidates.length < 6 || !ctx.player.unitZones.some((zone: any) => !zone?.unit)) return;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT04_069_SELECT_BOTTOM6',
            actionValue: { requireDistinctNames: true },
            effectDescription: '덱 맨 아래에 둘 카드 6장을 선택한다.',
            validTargets: 'MY_TRASH',
            targetSchema: targetSchema as any,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: ActivationCondition.EXIT,
            description: 'BT04-069 select six cards to bottom',
            targets: targetSchema as any,
            action: {
                type: 'COMPLEX_ACTION',
                params: { mode: 'BT04_069_EXIT_BOTTOM6_AND_REVIVE_SELF', stage: 'RESOLVE_BOTTOM' },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'BT04_070_ENTRY_TRASH_FRIENDLY_FOR_DRAW_AND_BUFF') {
        const targetSchema = {
            scope: 'MY_FIELD',
            type: 'UNIT',
            count: 1,
            selectMode: 'MANUAL',
        } as const;
        const stage = (params as any).stage;
        if (stage === 'RESOLVE') {
            const targetZone = (_targets || []).find((target: any) => target?.unit && ctx.player.unitZones.includes(target));
            if (!targetZone?.unit) return;
            const targetUnit = targetZone.unit;
            const isOtherUnit = ctx.unitZone ? targetZone !== ctx.unitZone : targetUnit.id !== ctx.sourceCard.id;
            ctx.machine.destroyUnit(ctx.player, targetZone, undefined, 'EFFECT');
            if (isOtherUnit && ctx.player.trash.includes(targetUnit)) {
                drawCard(ctx, { count: 1, __sourceActivation: (params as any).__sourceActivation }, _targets);
                if (ctx.unitZone?.unit) {
                    ctx.unitZone.buffs.push({
                        id: ctx.machine.createRuntimeId('BUFF'),
                        sourceCard: ctx.sourceCard,
                        type: 'POWER',
                        value: 2000,
                        duration: 'OPP_TURN_END',
                    });
                }
            }
            return;
        }
        if (TargetSelector.resolve(ctx.machine, targetSchema as any, ctx).length <= 0) return;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT04_070_SELECT_FRIENDLY_TO_TRASH',
            actionValue: {},
            effectDescription: '트래시할 자신 유닛을 선택한다.',
            validTargets: 'MY_UNITS',
            targetSchema: targetSchema as any,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: ActivationCondition.ENTRY,
            description: 'BT04-070 trash friendly for draw and buff',
            targets: targetSchema as any,
            action: {
                type: 'COMPLEX_ACTION',
                params: { mode: 'BT04_070_ENTRY_TRASH_FRIENDLY_FOR_DRAW_AND_BUFF', stage: 'RESOLVE' },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'BT04_073_DESTROY_SELECTED_AND_LOCK_IF_TWO') {
        const targets = (_targets || []).filter((target: any) => target?.unit) as UnitZoneState[];
        let destroyedCount = 0;
        targets.forEach((targetZone: UnitZoneState) => {
            const owner = getOwnerOfZone(ctx.machine, targetZone);
            const targetUnit = targetZone?.unit;
            if (!owner || !targetUnit) return;
            ctx.machine.destroyUnit(owner, targetZone, undefined, 'EFFECT');
            if (owner.trash.includes(targetUnit)) {
                destroyedCount += 1;
            }
        });
        if (destroyedCount >= 2 && ctx.unitZone?.unit) {
            ctx.unitZone.temporaryEffects.push({
                activation: ActivationCondition.PASSIVE,
                description: '패시브 : 이 유닛은 공격할 수 없다.',
                action: { type: 'NONE', params: { cannotAttack: true } },
                duration: 'TURN_END',
            });
            ctx.unitZone.extraAttackAllowance = 0;
        }
        return;
    }

    if ((params as any).mode === 'BT04_075_MOVE_ENCOUNTER_TO_OPP_DAMAGE') {
        if (!ctx.unitZone) return;
        const laneIndex = ctx.player.unitZones.indexOf(ctx.unitZone);
        if (laneIndex < 0) return;
        const encounterZone = ctx.opponent.unitZones[laneIndex];
        if (!encounterZone?.unit) return;
        const movedUnit = encounterZone.unit;
        encounterZone.unit = null;
        ctx.opponent.damage.push(movedUnit);
        encounterZone.items.forEach((item: any) => ctx.opponent.trash.push(item));
        encounterZone.items = [];
        encounterZone.buffs = [];
        encounterZone.temporaryEffects = [];
        encounterZone.attackCountThisTurn = 0;
        encounterZone.extraAttackAllowance = 0;
        encounterZone.hasAttacked = false;
        encounterZone.isExhausted = false;
        encounterZone.hasPlacedUnitThisTurn = false;
        encounterZone.hasActivatedEffectThisTurn = false;
        encounterZone.activatedEffectKeys = {};
        if (typeof ctx.machine.recordDamagePlacedByEffect === 'function') {
            ctx.machine.recordDamagePlacedByEffect(ctx.opponent.id, 'FIELD', 1);
        }
        return;
    }

    if ((params as any).mode === 'BT04_076_SWAP_DAMAGE_AND_TRASH') {
        const stage = (params as any).stage;
        if (stage === 'RESOLVE_DAMAGE_TO_TRASH') {
            const selectedCards = (_targets || []).filter((card: any) => ctx.player.damage.includes(card));
            const movedCount = selectedCards.length;
            selectedCards.forEach((card: any) => {
                const index = ctx.player.damage.indexOf(card);
                if (index !== -1) {
                    const [movedCard] = ctx.player.damage.splice(index, 1);
                    if (movedCard) ctx.player.trash.push(movedCard);
                }
            });
            if (movedCount <= 0) {
                if (ctx.machine.getDamageTraitCount(ctx.player, '용의 계곡') >= 5) {
                    drawCard(ctx, { count: 1, __sourceActivation: (params as any).__sourceActivation }, _targets);
                }
                return;
            }

            const targetSchema = {
                scope: 'MY_TRASH',
                type: 'CARD',
                count: movedCount,
                selectMode: 'MANUAL',
            } as const;
            ctx.machine.state.interactionMode = 'SELECT_TARGET';
            ctx.machine.state.pendingEffect = {
                sourceCard: ctx.sourceCard,
                sourcePlayerId: ctx.player.id,
                controllerPlayerId: ctx.player.id,
                actionType: 'BT04_076_SELECT_TRASH_TO_DAMAGE',
                actionValue: {},
                effectDescription: '대미지 존에 놓을 트래시 카드를 선택한다.',
                validTargets: 'MY_TRASH',
                targetSchema: targetSchema as any,
                selectedTargets: [],
            };
            ctx.machine.setPendingRuntime(ctx, {
                activation: ActivationCondition.ACTIVE_MAIN,
                description: 'BT04-076 select trash cards to move to damage',
                targets: targetSchema as any,
                action: {
                    type: 'COMPLEX_ACTION',
                    params: { mode: 'BT04_076_SWAP_DAMAGE_AND_TRASH', stage: 'RESOLVE_TRASH_TO_DAMAGE' },
                },
            } as any);
            ctx.machine.setInteractionOwner(ctx.player.id);
            return;
        }

        if (stage === 'RESOLVE_TRASH_TO_DAMAGE') {
            (_targets || []).forEach((card: any) => {
                const index = ctx.player.trash.indexOf(card);
                if (index !== -1) {
                    const [movedCard] = ctx.player.trash.splice(index, 1);
                    if (movedCard) {
                        ctx.player.damage.push(movedCard);
                        if (typeof ctx.machine.recordDamagePlacedByEffect === 'function') {
                            ctx.machine.recordDamagePlacedByEffect(ctx.player.id, 'TRASH', 1);
                        }
                    }
                }
            });
            if (ctx.machine.getDamageTraitCount(ctx.player, '용의 계곡') >= 5) {
                drawCard(ctx, { count: 1, __sourceActivation: (params as any).__sourceActivation }, _targets);
            }
            return;
        }

        const targetSchema = {
            scope: 'MY_DAMAGE',
            type: 'CARD',
            count: 2,
            selectMode: 'MANUAL',
        } as const;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT04_076_SELECT_DAMAGE_TO_TRASH',
            actionValue: { allowPartialSelection: true, minSelection: 0 },
            effectDescription: '트래시할 대미지 카드를 2장까지 선택한다.',
            validTargets: 'MY_DAMAGE',
            targetSchema: targetSchema as any,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: 'BT04-076 select damage cards to trash',
            targets: targetSchema as any,
            action: {
                type: 'COMPLEX_ACTION',
                params: { mode: 'BT04_076_SWAP_DAMAGE_AND_TRASH', stage: 'RESOLVE_DAMAGE_TO_TRASH' },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'BT04_077_MOVE_HAND_TO_DAMAGE_THEN_DRAW2') {
        const stage = (params as any).stage;
        if (stage === 'RESOLVE') {
            const selectedCard = (_targets || []).find((card: any) => ctx.player.hand.includes(card));
            if (!selectedCard) return;
            moveFromHandToDamage(ctx, { setContextFlag: 'BT04_077_MOVED' }, [selectedCard]);
            if (ctx.flags?.BT04_077_MOVED === true) {
                drawCard(ctx, { count: 2, __sourceActivation: (params as any).__sourceActivation }, _targets);
            }
            return;
        }

        const handSchema = {
            scope: 'MY_HAND',
            type: 'CARD',
            count: 1,
            selectMode: 'MANUAL',
        } as const;
        if (TargetSelector.resolve(ctx.machine, handSchema as any, ctx).length <= 0) return;

        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT04_077_SELECT_HAND_TO_DAMAGE',
            actionValue: {},
            effectDescription: '대미지 존에 놓을 패를 선택한다.',
            validTargets: 'MY_HAND',
            targetSchema: handSchema as any,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: 'BT04-077 move hand card to damage',
            targets: handSchema as any,
            action: {
                type: 'COMPLEX_ACTION',
                params: { mode: 'BT04_077_MOVE_HAND_TO_DAMAGE_THEN_DRAW2', stage: 'RESOLVE' },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'BT04_078_TRASH_FRIENDLY_THEN_DRAW2') {
        const stage = (params as any).stage;
        if (stage === 'RESOLVE') {
            const targetZone = (_targets || []).find((target: any) => target?.unit && ctx.player.unitZones.includes(target));
            if (!targetZone?.unit) return;
            destroyUnit(ctx, { setContextFlag: 'BT04_078_TRASHED' }, [targetZone]);
            if (ctx.flags?.BT04_078_TRASHED === true) {
                drawCard(ctx, { count: 2, __sourceActivation: (params as any).__sourceActivation }, _targets);
            }
            return;
        }

        const targetSchema = {
            scope: 'MY_FIELD',
            type: 'UNIT',
            count: 1,
            selectMode: 'MANUAL',
        } as const;
        if (TargetSelector.resolve(ctx.machine, targetSchema as any, ctx).length <= 0) return;

        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT04_078_SELECT_FRIENDLY_TO_TRASH',
            actionValue: {},
            effectDescription: '트래시할 자신 유닛을 선택한다.',
            validTargets: 'MY_UNITS',
            targetSchema: targetSchema as any,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: 'BT04-078 trash friendly unit',
            targets: targetSchema as any,
            action: {
                type: 'COMPLEX_ACTION',
                params: { mode: 'BT04_078_TRASH_FRIENDLY_THEN_DRAW2', stage: 'RESOLVE' },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'BT04_079_LOCK_SELF_AND_DAMAGE_IF_HOMUNCULUS5') {
        lockSkillIdUntilTurnEnd(ctx, { skillId: 'BT04-079' }, _targets);
        const homunculusUnitsInTrash = ctx.player.trash.filter((card: any) =>
            card?.type === CardType.UNIT && cardHasTraitLike(card, '호문클루스')
        ).length;
        if (homunculusUnitsInTrash >= 5) {
            damage(ctx, { value: 1, __sourceActivation: (params as any).__sourceActivation }, _targets);
        }
        return;
    }

    if ((params as any).mode === 'BT04_082_DEPLOY_SELECTED_HOMUNCULUS_AND_MARK_TURN_END_TRASH') {
        const selectedCards = (_targets || []).filter((card: any) => ctx.player.trash.includes(card));
        if (selectedCards.length !== 3) return;
        const emptyZoneCount = ctx.player.unitZones.filter((zone: any) => !zone?.unit).length;
        if (emptyZoneCount < 3) return;

        selectedCards.forEach((selectedCard: any) => {
            const trashIndex = ctx.player.trash.indexOf(selectedCard);
            if (trashIndex === -1) return;
            const [placedUnit] = ctx.player.trash.splice(trashIndex, 1);
            if (!placedUnit) return;
            const deployedZone = deployUnitToFirstEmptyZone(ctx.machine, ctx.player, placedUnit);
            if (!deployedZone?.unit) return;
            deployedZone.temporaryEffects.push({
                activation: ActivationCondition.TURN_END,
                description: '턴 종료 시 이 유닛을 트래시한다.',
                action: { type: 'DESTROY_SELF', params: {} },
                duration: 'TURN_END',
            });
        });
        return;
    }

    if ((params as any).mode === 'BT04_083_BUFF_HIT_BY_FRIENDLY_TRASH_COUNT') {
        if (!ctx.unitZone?.unit) return;
        const trashedCount = typeof ctx.machine?.getFieldTrashedFriendlyUnitCount === 'function'
            ? ctx.machine.getFieldTrashedFriendlyUnitCount(ctx.player.id)
            : 0;
        if (trashedCount >= 1) {
            buffHit(ctx, { value: 1, duration: 'TURN_END' }, [ctx.unitZone]);
        }
        if (trashedCount >= 3) {
            buffHit(ctx, { value: 1, duration: 'TURN_END' }, [ctx.unitZone]);
        }
        return;
    }

    if ((params as any).mode === 'GUARDIAN_TRANSFER_POWER') {
        if (!_targets || _targets.length < 2) return;
        const first = _targets[0] as UnitZoneState;
        const second = _targets[1] as UnitZoneState;
        if (!first?.unit || !second?.unit) return;

        const firstIsGuardian = zoneHasKeyword(first, '가디언');
        const secondIsGuardian = zoneHasKeyword(second, '가디언');
        if (firstIsGuardian === secondIsGuardian) return;

        const guardianZone = firstIsGuardian ? first : second;
        const targetZone = firstIsGuardian ? second : first;
        const guardianOwner = getOwnerOfZone(ctx.machine, guardianZone);
        if (!guardianOwner) return;

        const transferredPower = Math.max(0, ctx.machine.getUnitPower(guardianZone, guardianOwner));
        targetZone.buffs.push({
            id: ctx.machine.createRuntimeId('BUFF'),
            sourceCard: ctx.sourceCard,
            type: 'POWER',
            value: transferredPower,
            duration: params.duration || 'TURN_END',
        });
        return;
    }

    if ((params as any).mode === 'ST07_002_EXIT_DRAW_BY_HOMUNCULUS_ATTACK_COUNT') {
        const homunculusAttackCount = countFriendlyTraitAttacks(ctx, '호문클루스');
        if (homunculusAttackCount <= 0) return;
        drawCard(ctx, {
            count: homunculusAttackCount,
            __sourceActivation: (params as any).__sourceActivation,
        }, _targets);
        return;
    }

    if ((params as any).mode === 'ST07_003_EXIT_REVEAL_BY_HOMUNCULUS_ATTACK_COUNT') {
        const homunculusAttackCount = countFriendlyTraitAttacks(ctx, '호문클루스');
        if (homunculusAttackCount <= 0 || ctx.player.deck.length <= 0) return;
        revealTopAndChooseToHand(ctx, {
            count: homunculusAttackCount,
            remainingDestination: 'TRASH',
            __sourceActivation: (params as any).__sourceActivation,
        }, _targets);
        return;
    }

    if ((params as any).mode === 'ST07_004_EXIT_DESTROY_BY_HOMUNCULUS_ATTACK_COUNT') {
        const homunculusAttackCount = countFriendlyTraitAttacks(ctx, '호문클루스');
        if (homunculusAttackCount <= 0) return;

        const targetSchema = {
            scope: 'OPP_FIELD',
            type: 'UNIT',
            count: 1,
            filters: [{ type: 'COST_LIMIT', value: homunculusAttackCount }],
            selectMode: 'MANUAL',
        } as const;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'ST07_004_SELECT_OPP_UNIT_TO_TRASH',
            actionValue: {},
            effectDescription: '트래시할 상대 유닛을 선택한다.',
            validTargets: 'OPP_UNITS',
            targetSchema: targetSchema as any,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: ActivationCondition.EXIT,
            description: 'ST07-004 resolve exit destroy by homunculus attack count',
            targets: targetSchema as any,
            action: { type: 'DESTROY_UNIT', params: {} },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'ST07_006_EXIT_TRASH_TOP_AND_DAMAGE_BY_HOMUNCULUS_COUNT') {
        const homunculusAttackCount = countFriendlyTraitAttacks(ctx, '호문클루스');
        if (homunculusAttackCount <= 0) return;

        const trashedCards = trashTopCards(ctx.player, homunculusAttackCount);
        const trashedHomunculusCount = trashedCards.filter((card: any) => cardHasTraitLike(card, '호문클루스')).length;
        if (trashedHomunculusCount <= 0) return;

        damage(ctx, {
            value: trashedHomunculusCount,
            target: 'OPPONENT',
            __sourceActivation: (params as any).__sourceActivation,
        }, _targets);
        return;
    }

    if ((params as any).mode === 'ST07_007_EXIT_SELECT_REPEAT_DEBUFF_BY_HOMUNCULUS_COUNT') {
        const homunculusAttackCount = countFriendlyTraitAttacks(ctx, '호문클루스');
        if (homunculusAttackCount <= 0) return;

        const targetSchema = {
            scope: 'OPP_FIELD',
            type: 'UNIT',
            count: homunculusAttackCount,
            selectMode: 'MANUAL',
        } as const;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'ST07_007_SELECT_EXIT_DEBUFF_TARGETS',
            actionValue: {
                allowPartialSelection: true,
                allowDuplicates: true,
            },
            effectDescription: '파워를 감소시킬 상대 유닛을 선택한다.',
            validTargets: 'OPP_UNITS',
            targetSchema: targetSchema as any,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: ActivationCondition.EXIT,
            description: 'ST07-007 resolve repeated exit debuff',
            targets: targetSchema as any,
            action: { type: 'BUFF_POWER', params: { value: -3000 } },
            duration: 'TURN_END',
            actionDurationOverride: 'TURN_END',
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'ST07_009_ACTIVE_ATTACK_TRASH_EXIT_HOMUNCULUS_FOR_HIT') {
        if (!ctx.unitZone?.unit) return;
        const selectedZone = (_targets || [])[0] as UnitZoneState | undefined;
        if (!selectedZone?.unit) return;
        const owner = getOwnerOfZone(ctx.machine, selectedZone);
        if (!owner || owner.id !== ctx.player.id) return;

        ctx.machine.destroyUnit(owner, selectedZone, undefined, 'EFFECT');
        buffHit(ctx, { value: 1, duration: 'TURN_END' }, [ctx.unitZone]);
        return;
    }

    if ((params as any).mode === 'ST07_010_ACTIVE_MAIN_DEPLOY_EXIT_FROM_TRASH') {
        const stage = (params as any).stage;
        if (stage === 'SELECT_ZONE') {
            const selectedCard = (_targets || []).find((card: any) =>
                ctx.player.trash.includes(card) &&
                card.type === CardType.UNIT &&
                getCardCost(ctx.machine, card) <= 3 &&
                cardHasKeywordLike(card, '엑시트')
            );
            if (!selectedCard) return;
            if (!ctx.player.unitZones.some((zone: any) => !zone?.unit)) return;

            const zoneSchema = {
                scope: 'MY_FIELD',
                type: 'ALL',
                count: 1,
                selectMode: 'MANUAL',
            } as const;
            ctx.machine.state.interactionMode = 'SELECT_TARGET';
            ctx.machine.state.pendingEffect = {
                sourceCard: ctx.sourceCard,
                sourcePlayerId: ctx.player.id,
                controllerPlayerId: ctx.player.id,
                actionType: 'ST07_010_SELECT_EMPTY_ZONE_TO_DEPLOY',
                actionValue: {
                    selectedCardRef: selectedCard,
                    selectedCardId: selectedCard.id,
                },
                effectDescription: '배치할 빈 유닛 존을 선택한다.',
                validTargets: 'MY_UNITS',
                targetSchema: zoneSchema as any,
                selectedTargets: [],
            };
            ctx.machine.setPendingRuntime(ctx, null);
            ctx.machine.setInteractionOwner(ctx.player.id);
            return;
        }

        const candidates = ctx.player.trash.filter((card: any) =>
            card.type === CardType.UNIT &&
            getCardCost(ctx.machine, card) <= 3 &&
            cardHasKeywordLike(card, '엑시트')
        );
        if (candidates.length <= 0) return;
        if (!ctx.player.unitZones.some((zone: any) => !zone?.unit)) return;

        const targetSchema = {
            scope: 'MY_TRASH',
            type: 'CARD',
            count: 1,
            filters: [
                { type: 'UNIT_TYPE', value: CardType.UNIT },
                { type: 'HAS_KEYWORD', value: '엑시트' },
                { type: 'COST_LIMIT', value: 3 },
            ],
            selectMode: 'MANUAL',
        } as const;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'ST07_010_SELECT_TRASH_EXIT_UNIT_TO_DEPLOY',
            actionValue: {},
            effectDescription: '배치할 유닛을 선택한다.',
            validTargets: 'MY_TRASH',
            targetSchema: targetSchema as any,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: 'ST07-010 resolve deploy from trash',
            targets: targetSchema as any,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'ST07_010_ACTIVE_MAIN_DEPLOY_EXIT_FROM_TRASH',
                    stage: 'SELECT_ZONE',
                },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'ST07_011_ENTRY_RETURN_HOMUNCULUS_TO_BOTTOM') {
        if (!ctx.unitZone?.unit) return;
        const laneIndex = ctx.player.unitZones.indexOf(ctx.unitZone);
        if (laneIndex < 0) return;
        const encounterZone = ctx.opponent.unitZones[laneIndex];
        if (!encounterZone?.unit) return;

        const requiredCount = Math.max(0, getCardCost(ctx.machine, encounterZone.unit));
        if (requiredCount <= 0) return;

        const candidates = ctx.player.trash.filter((card: any) =>
            cardHasTraitLike(card, '호문클루스') && !cardHasKeywordLike(card, '트리거')
        );
        if (candidates.length <= 0) return;

        const targetSchema = {
            scope: 'MY_TRASH',
            type: 'CARD',
            count: requiredCount,
            filters: [
                { type: 'HAS_TRAIT', value: '호문클루스' },
                { type: 'NOT_HAS_KEYWORD', value: '트리거' },
            ],
            selectMode: 'MANUAL',
        } as const;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'ST07_011_SELECT_TRASH_TO_BOTTOM',
            actionValue: {
                allowPartialSelection: true,
                minSelection: requiredCount,
            },
            effectDescription: '덱 맨 아래에 놓을 카드를 선택한다.',
            validTargets: 'MY_TRASH',
            targetSchema: targetSchema as any,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: ActivationCondition.ENTRY,
            description: 'ST07-011 resolve trash to deck bottom',
            targets: targetSchema as any,
            action: {
                type: 'MOVE_FROM_TRASH_TO_DECK_BOTTOM',
                params: { thenDestroyEncounter: true },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'ST07_013_TRASH_TOP4_THEN_MOVE_TO_DAMAGE_AND_OPTIONAL_DRAW') {
        const stage = (params as any).stage;
        if (stage === 'RESOLVE') {
            const selectedCard = (_targets || []).find((card: any) => ctx.player.trash.includes(card));
            if (!selectedCard) return;

            const trashIndex = ctx.player.trash.indexOf(selectedCard);
            if (trashIndex === -1) return;
            const [movedCard] = ctx.player.trash.splice(trashIndex, 1);
            if (!movedCard) return;
            ctx.player.damage.push(movedCard);
            if (typeof ctx.machine.recordDamagePlacedByEffect === 'function') {
                ctx.machine.recordDamagePlacedByEffect(ctx.player.id, 'TRASH', 1);
            }

            if (ctx.player.damage.length >= 7) {
                const optionalEffect = {
                    activation: ActivationCondition.ACTIVE,
                    optional: true,
                    description: '카드를 1장 드로우할 수 있다.',
                    action: { type: 'DRAW', params: { count: 1 } },
                } as any;
                ctx.machine.effectManager.processEffect(optionalEffect, ctx);
            }
            return;
        }

        trashTopCards(ctx.player, 4);
        if (ctx.player.trash.length <= 0) return;

        const targetSchema = {
            scope: 'MY_TRASH',
            type: 'CARD',
            count: 1,
            selectMode: 'MANUAL',
        } as const;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'ST07_013_SELECT_TRASH_TO_DAMAGE',
            actionValue: {},
            effectDescription: '대미지 존에 놓을 카드를 선택한다.',
            validTargets: 'MY_TRASH',
            targetSchema: targetSchema as any,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: ActivationCondition.ACTIVE,
            description: 'ST07-013 resolve trash to damage',
            targets: targetSchema as any,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'ST07_013_TRASH_TOP4_THEN_MOVE_TO_DAMAGE_AND_OPTIONAL_DRAW',
                    stage: 'RESOLVE',
                },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'ST07_014_ACTIVE_TRASH_TOP4_THEN_OPTIONAL_RUNWAY_RECOVER') {
        trashTopCards(ctx.player, 4);

        const targetSchema = {
            scope: 'MY_TRASH',
            type: 'CARD',
            count: 1,
            filters: [
                { type: 'UNIT_TYPE', value: CardType.UNIT },
                { type: 'HAS_TRAIT', value: '런웨이 파이터' },
            ],
            selectMode: 'MANUAL',
        } as const;
        const candidates = ctx.player.trash.filter((card: any) =>
            card.type === CardType.UNIT && cardHasTraitLike(card, '런웨이 파이터')
        );
        if (candidates.length <= 0) return;

        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'ST07_014_SELECT_RUNWAY_UNIT_TO_HAND',
            actionValue: { allowPartialSelection: true },
            effectDescription: '패에 넣을 런웨이 파이터 유닛을 선택한다.',
            validTargets: 'MY_TRASH',
            targetSchema: targetSchema as any,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: ActivationCondition.ACTIVE,
            description: 'ST07-014 resolve optional runway recover',
            targets: targetSchema as any,
            action: { type: 'MOVE_FROM_TRASH_TO_HAND', params: {} },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'ST07_014_TRIGGER_TRASH_TOP4') {
        trashTopCards(ctx.player, 4);
        return;
    }

    if ((params as any).mode === 'PROMPT_SELECT_ATTACK_ACTIVE_EFFECT') {
        const targetZone = (_targets || [])[0] as UnitZoneState | undefined;
        if (!targetZone?.unit) return;
        const includeActivatedThisTurn = (params as any).includeActivatedThisTurn === true;

        const owner = getOwnerOfZone(ctx.machine, targetZone);
        if (!owner || owner.id !== ctx.player.id) return;

        const effectOptions = (targetZone.unit.effects || [])
            .map((effect, effectIndex) => ({ effect, effectIndex }))
            .filter(({ effect, effectIndex }) => {
                if (!effect || effect.activation !== 'ACTIVE') return false;
                if (!effectHasPhaseAttackCondition(effect.condition)) return false;
                const effectKey = `${targetZone.unit?.id}_${effect.id || effectIndex}`;
                if (!includeActivatedThisTurn && targetZone.activatedEffectKeys?.[effectKey]) return false;

                const effectContext = {
                    sourceCard: targetZone.unit!,
                    player: ctx.player,
                    opponent: ctx.opponent,
                    unitZone: targetZone,
                    machine: ctx.machine,
                };

                if (!ctx.machine.effectManager.checkCondition(effect, effectContext)) return false;

                if (effect.cost && effect.cost.type !== 'NONE') {
                    if (effect.cost.type === 'TRASH_HAND' || effect.cost.type === 'SHUFFLE_HAND_TO_DECK') {
                        const requiredAmount = effect.cost.amount || 1;
                        const costFilter = effect.cost.cardTypeFilter;
                        const payableCount = ctx.player.hand.filter(card => !costFilter || card.type === costFilter).length;
                        if (payableCount < requiredAmount) return false;
                    }
                }

                if (effect.targets && effect.targets.selectMode === 'MANUAL') {
                    const candidates = TargetSelector.resolve(ctx.machine, effect.targets, effectContext);
                    if (candidates.length === 0) return false;
                }

                return true;
            });

        if (effectOptions.length === 0) return;

        const sourceZoneIndex = owner.unitZones.indexOf(targetZone);
        if (sourceZoneIndex < 0) return;

        ctx.machine.state.revealedCards = effectOptions.map(({ effect, effectIndex }) =>
            createPromptOptionCard(
                `BT06_EFFECT_OPTION_${sourceZoneIndex}_${effectIndex}`,
                `효과 ${effectIndex + 1}`,
                effect.description || '선택한 [액티브: 어택] 효과를 발동한다.'
            )
        ) as any;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT06_SELECT_ATTACK_ACTIVE_EFFECT',
            actionValue: {
                sourceZoneIndex,
                options: effectOptions.map(({ effectIndex }) => ({ effectIndex })),
                includeActivatedThisTurn,
            },
            effectDescription: '발동할 [액티브: 어택] 효과를 선택한다.',
            validTargets: 'REVEALED',
            targetSchema: {
                scope: 'REVEALED',
                type: 'CARD',
                count: 1,
                selectMode: 'MANUAL',
            },
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, null);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'PROMPT_SELECT_ENTRY_EFFECT') {
        const targetZone = (_targets || [])[0] as UnitZoneState | undefined;
        if (!targetZone?.unit) return;

        const owner = getOwnerOfZone(ctx.machine, targetZone);
        if (!owner || owner.id !== ctx.player.id) return;

        const effectOptions = (targetZone.unit.effects || [])
            .map((effect, effectIndex) => ({ effect, effectIndex }))
            .filter(({ effect }) => {
                if (!effect || effect.activation !== ActivationCondition.ENTRY) return false;

                const effectContext = {
                    sourceCard: targetZone.unit!,
                    player: ctx.player,
                    opponent: ctx.opponent,
                    unitZone: targetZone,
                    machine: ctx.machine,
                };

                if (!ctx.machine.effectManager.checkCondition(effect, effectContext)) return false;

                if (effect.cost && effect.cost.type !== 'NONE') {
                    if (effect.cost.type === 'TRASH_HAND' || effect.cost.type === 'SHUFFLE_HAND_TO_DECK') {
                        const requiredAmount = effect.cost.amount || 1;
                        const costFilter = effect.cost.cardTypeFilter;
                        const payableCount = ctx.player.hand.filter(card => !costFilter || card.type === costFilter).length;
                        if (payableCount < requiredAmount) return false;
                    }
                }

                if (effect.targets && effect.targets.selectMode === 'MANUAL') {
                    const candidates = TargetSelector.resolve(ctx.machine, effect.targets, effectContext);
                    if (candidates.length === 0) return false;
                }

                return true;
            });

        if (effectOptions.length === 0) return;

        const sourceZoneIndex = owner.unitZones.indexOf(targetZone);
        if (sourceZoneIndex < 0) return;

        ctx.machine.state.revealedCards = effectOptions.map(({ effect, effectIndex }) =>
            createPromptOptionCard(
                `BT06_ENTRY_OPTION_${sourceZoneIndex}_${effectIndex}`,
                `엔트리 효과 ${effectIndex + 1}`,
                effect.description || '선택한 [엔트리] 효과를 발동한다.'
            )
        ) as any;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT06_SELECT_ENTRY_EFFECT',
            actionValue: {
                sourceZoneIndex,
                options: effectOptions.map(({ effectIndex }) => ({ effectIndex })),
            },
            effectDescription: '발동할 [엔트리] 효과를 선택한다.',
            validTargets: 'REVEALED',
            targetSchema: {
                scope: 'REVEALED',
                type: 'CARD',
                count: 1,
                selectMode: 'MANUAL',
            },
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, null);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'SB01_001_ENTRY_PROMPT_SKILL_COST_DEBUFF') {
        const stage = (params as any).stage;
        if (stage === 'RESOLVE') {
            const targetZone = (_targets || [])[0] as UnitZoneState | undefined;
            if (!targetZone?.unit) return;
            const skillCost = Math.max(0, Number((ctx.flags as any)?.SB01_001_TRASHED_SKILL_COST ?? (params as any).skillCost ?? 0));
            if (skillCost <= 0) return;
            targetZone.buffs.push({
                id: ctx.machine.createRuntimeId('BUFF'),
                sourceCard: ctx.sourceCard,
                type: 'POWER',
                value: -2000 * skillCost,
                duration: 'TURN_END',
            });
            return;
        }

        const skills = ctx.player.skillZone
            .map((card, skillZoneIndex) => ({ card, skillZoneIndex }))
            .filter(({ card }) => card?.type === CardType.SKILL);
        if (skills.length <= 0) return;

        ctx.machine.state.revealedCards = skills.map(({ card, skillZoneIndex }) =>
            createPromptOptionCard(
                `SB01_001_SKILL_OPTION_${skillZoneIndex}_${card.id}`,
                card.name,
                card.text || `${card.name}를 트래시`,
                card.imageUrl,
            )
        ) as any;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'SB01_001_SELECT_SKILL_ZONE_TO_TRASH',
            actionValue: {
                options: skills.map(({ skillZoneIndex }) => ({ skillZoneIndex })),
            },
            effectDescription: '트래시할 스킬을 선택한다.',
            validTargets: 'REVEALED',
            targetSchema: {
                scope: 'REVEALED',
                type: 'CARD',
                count: 1,
                selectMode: 'MANUAL',
            },
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, null);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'SB01_002_ACTIVE_MAIN_BUFF_ATTACKERS_BY_DISCARDED_COST') {
        const discardedCost = getCardCost(ctx.machine, ctx.costPaymentCard);
        const friendlyAttackers = ctx.player.unitZones.filter((zone: any) => zone?.unit && zoneHasKeywordLike(zone, '어태커'));
        if (friendlyAttackers.length <= 0) return;

        const targets = friendlyAttackers.filter((zone: any) => getCardCost(ctx.machine, zone.unit) <= discardedCost);
        targets.forEach((zone: any) => {
            zone.buffs.push({
                id: ctx.machine.createRuntimeId('BUFF'),
                sourceCard: ctx.sourceCard,
                type: 'POWER',
                value: discardedCost * 1000,
                duration: 'TURN_END',
            });
            zone.buffs.push({
                id: ctx.machine.createRuntimeId('BUFF'),
                sourceCard: ctx.sourceCard,
                type: 'HIT',
                value: 1,
                duration: 'TURN_END',
            });
        });
        return;
    }

    if ((params as any).mode === 'SB01_003_ATTACKER_BUFF_BY_DAMAGE_COUNT') {
        if (!ctx.unitZone?.unit) return;
        const value = Math.max(0, ctx.player.damage.length * 500);
        if (value <= 0) return;
        ctx.unitZone.buffs.push({
            id: ctx.machine.createRuntimeId('BUFF'),
            sourceCard: ctx.sourceCard,
            type: 'POWER',
            value,
            duration: 'BATTLE_END',
        });
        return;
    }

    if ((params as any).mode === 'SB01_003_ON_KILL_PROMPT_DISCARD_FOR_DAMAGE') {
        const stage = (params as any).stage;
        if (stage === 'RESOLVE') {
            const selectedCards = (_targets || []).filter((card: any) => ctx.player.hand.includes(card));
            if (selectedCards.length <= 0) return;
            const trashedCards: any[] = [];
            selectedCards.forEach((card: any) => {
                const handIndex = ctx.player.hand.indexOf(card);
                if (handIndex === -1) return;
                const [removed] = ctx.player.hand.splice(handIndex, 1);
                if (!removed) return;
                ctx.player.trash.push(removed);
                trashedCards.push(removed);
            });
            if (trashedCards.length > 0) {
                ctx.machine.notifyHandTrashed(ctx.player, trashedCards, {
                    flags: { handTrashByEffect: true },
                });
                ctx.machine.dealDamage(ctx.opponent, trashedCards.length);
            }
            return;
        }

        const hitMax = Math.max(0, Number(ctx.trashedUnit?.hit || 0));
        if (hitMax <= 0 || ctx.player.hand.length <= 0) return;
        const maxSelectable = Math.min(hitMax, ctx.player.hand.length);

        const handSchema = {
            scope: 'MY_HAND',
            type: 'CARD',
            count: maxSelectable,
            selectMode: 'MANUAL',
        } as const;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'SB01_003_SELECT_HAND_FOR_ON_KILL_DAMAGE',
            actionValue: {
                allowPartialSelection: true,
                minSelection: 0,
                maxSelection: maxSelectable,
            },
            effectDescription: '트래시할 패를 선택한다.',
            validTargets: 'MY_HAND',
            targetSchema: handSchema,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: ActivationCondition.ON_KILL,
            description: 'SB01-003 resolve optional discard damage',
            targets: handSchema as any,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'SB01_003_ON_KILL_PROMPT_DISCARD_FOR_DAMAGE',
                    stage: 'RESOLVE',
                },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'SB01_004_ACTIVE_DRAW_AND_PUNISH') {
        const attackerCount = ctx.player.unitZones.filter((zone: any) => zone?.unit && zoneHasKeywordLike(zone, '어태커')).length;
        if (attackerCount > 0) {
            drawCard(ctx, { count: attackerCount, __sourceActivation: (params as any).__sourceActivation }, _targets);
        }
        const current = (ctx.player as any).sb01OpponentEffectDrawPunish as { untilTurnCount: number; count: number } | undefined;
        const untilTurnCount = ctx.machine.state.turnCount + 1;
        const previousCount = current && ctx.machine.state.turnCount <= current.untilTurnCount
            ? Math.max(0, Number(current.count || 0))
            : 0;
        (ctx.player as any).sb01OpponentEffectDrawPunish = {
            untilTurnCount: Math.max(untilTurnCount, Number(current?.untilTurnCount || 0)),
            count: previousCount + 1,
        };
        return;
    }

    if ((params as any).mode === 'SB01_005_ACTIVE_DRAW_MARK_AND_OPTIONAL_TRASH') {
        const stage = (params as any).stage;
        if (stage === 'MARK_TARGET') {
            const targetZone = (_targets || [])[0] as UnitZoneState | undefined;
            if (targetZone?.unit) {
                targetZone.temporaryEffects.push({
                    activation: ActivationCondition.EXIT,
                    description: '엑시트 : 자신의 트래시 존에 있는 이 카드를 대미지 존에 놓는다.',
                    action: {
                        type: 'COMPLEX_ACTION',
                        params: {
                            mode: 'SB01_005_EXIT_MOVE_SKILL_FROM_TRASH_TO_DAMAGE',
                        },
                    },
                    duration: 'TURN_END',
                } as any);
            }

            const attackerCount = ctx.player.unitZones.filter((zone: any) => zone?.unit && zoneHasKeywordLike(zone, '어태커')).length;
            const inSkillZone = ctx.player.skillZone.includes(ctx.sourceCard);
            if (attackerCount >= 2 && inSkillZone) {
                const optionalEffect = {
                    activation: ActivationCondition.ACTIVE,
                    optional: true,
                    description: '이 스킬을 트래시할 수 있다.',
                    action: {
                        type: 'COMPLEX_ACTION',
                        params: {
                            mode: 'SB01_005_TRASH_SELF_FROM_SKILL_ZONE',
                        },
                    },
                } as any;
                ctx.machine.effectManager.processEffect(optionalEffect, ctx);
            }
            return;
        }

        drawCard(ctx, { count: 1, __sourceActivation: (params as any).__sourceActivation }, _targets);
        const targetSchema = {
            scope: 'OPP_FIELD',
            type: 'UNIT',
            count: 1,
            selectMode: 'MANUAL',
        } as const;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'SB01_005_SELECT_OPP_UNIT_TO_MARK',
            actionValue: {},
            effectDescription: '효과를 부여할 상대 유닛을 선택한다.',
            validTargets: 'OPP_UNITS',
            targetSchema: targetSchema as any,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: ActivationCondition.ACTIVE,
            description: 'SB01-005 resolve target grant',
            targets: targetSchema as any,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'SB01_005_ACTIVE_DRAW_MARK_AND_OPTIONAL_TRASH',
                    stage: 'MARK_TARGET',
                },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'SB01_005_TRASH_SELF_FROM_SKILL_ZONE') {
        const skillIndex = ctx.player.skillZone.indexOf(ctx.sourceCard);
        const resolvedIndex = skillIndex !== -1
            ? skillIndex
            : ctx.player.skillZone.findIndex((card: any) => card?.id === ctx.sourceCard.id);
        if (resolvedIndex === -1) return;
        const [removed] = ctx.player.skillZone.splice(resolvedIndex, 1);
        if (removed) {
            ctx.player.trash.push(removed);
        }
        return;
    }

    if ((params as any).mode === 'SB01_005_EXIT_MOVE_SKILL_FROM_TRASH_TO_DAMAGE') {
        // "이 카드"는 EXIT를 얻은(그리고 방금 트래시된) 해당 유닛 자신을 의미한다.
        const owner = ctx.player;
        let trashIndex = owner.trash.indexOf(ctx.sourceCard as any);
        if (trashIndex === -1) {
            const sourceId = (ctx.sourceCard as any)?.id;
            if (!sourceId) return;
            trashIndex = owner.trash.findIndex((card: any) => card?.id === sourceId);
        }
        if (trashIndex === -1) return;
        const [removed] = owner.trash.splice(trashIndex, 1);
        if (removed) {
            owner.damage.push(removed);
            if (typeof ctx.machine.recordDamagePlacedByEffect === 'function') {
                ctx.machine.recordDamagePlacedByEffect(owner.id, 'TRASH', 1);
            }
        }
        return;
    }

    if ((params as any).mode === 'SB01_006_ACTIVE_ATTACK_GRANT_BREAKTHROUGH_TO_LOW_COST') {
        const targets = ((_targets || []).filter((zone: any) => zone?.unit) as UnitZoneState[]);
        if (targets.length <= 0) return;
        const granted = {
            activation: ActivationCondition.ATTACKER,
            description: '어태커 : 돌파',
            action: { type: 'BREAKTHROUGH', params: { mode: 'ALL' } },
            duration: 'TURN_END',
        };
        grantEffect(ctx, { effect: granted, duration: 'TURN_END' }, targets as any);
        return;
    }

    if ((params as any).mode === 'SB01_007_EXIT_REVEAL_AND_DISCARD_TO_DEPLOY') {
        const stage = (params as any).stage;

        if (stage === 'SHOW_REVEALED_DECISION') {
            const revealedCardRef = (params as any).revealedCardRef;
            const revealedCardId = (params as any).revealedCardId;
            const revealedCardFromState = (ctx.machine.state.revealedCards || []).find((card: any) =>
                card === revealedCardRef ||
                (revealedCardId && card?.id === revealedCardId),
            );
            const revealedCard = revealedCardFromState || revealedCardRef;

            if (!revealedCard) {
                ctx.machine.state.revealedCards = [];
                return;
            }

            const hasEmptyZone = ctx.player.unitZones.some((zone: any) => !zone?.unit);
            if (revealedCard.type !== CardType.UNIT || ctx.player.hand.length <= 0 || !hasEmptyZone) {
                ctx.machine.state.revealedCards = [];
                ctx.player.trash.push(revealedCard);
                return;
            }

            ctx.machine.state.revealedCards = [revealedCard] as any;
            const targetSchema = {
                scope: 'REVEALED',
                type: 'CARD',
                count: 1,
                selectMode: 'MANUAL',
            } as const;
            ctx.machine.state.interactionMode = 'SELECT_TARGET';
            ctx.machine.state.pendingEffect = {
                sourceCard: ctx.sourceCard,
                sourcePlayerId: ctx.player.id,
                controllerPlayerId: ctx.player.id,
                actionType: 'SB01_007_SELECT_REVEALED_DEPLOY_CARD',
                actionValue: {
                    revealedCardRef,
                    revealedCardId,
                    allowPartialSelection: true,
                    minSelection: 0,
                    maxSelection: 1,
                },
                effectDescription: '공개 카드를 선택하고 확인하면 배치를 진행한다. 선택 없이 확인하면 카드를 트래시한다.',
                validTargets: 'REVEALED',
                targetSchema: targetSchema as any,
                selectedTargets: [],
            };
            ctx.machine.setPendingRuntime(ctx, {
                activation: ActivationCondition.EXIT,
                description: 'SB01-007 resolve revealed deploy decision',
                targets: targetSchema as any,
                action: {
                    type: 'COMPLEX_ACTION',
                    params: {
                        mode: 'SB01_007_EXIT_REVEAL_AND_DISCARD_TO_DEPLOY',
                        stage: 'RESOLVE_DEPLOY_DECISION',
                        revealedCardRef,
                        revealedCardId,
                    },
                },
            } as any);
            ctx.machine.setInteractionOwner(ctx.player.id);
            return;
        }

        if (stage === 'RESOLVE_DEPLOY_DECISION') {
            const selected = (_targets || [])[0];
            const revealedCardRef = (params as any).revealedCardRef;
            const revealedCardId = (params as any).revealedCardId;
            const revealedCardFromState = (ctx.machine.state.revealedCards || []).find((card: any) =>
                card === revealedCardRef ||
                (revealedCardId && card?.id === revealedCardId),
            );
            const revealedCard = revealedCardFromState || revealedCardRef;
            if (!revealedCard) {
                ctx.machine.state.revealedCards = [];
                return;
            }

            const selectedRevealed =
                selected === revealedCard ||
                (revealedCardId && selected?.id === revealedCardId);
            if (!selectedRevealed) {
                ctx.machine.state.revealedCards = [];
                ctx.player.trash.push(revealedCard);
                return;
            }

            ctx.machine.state.revealedCards = [];

            const targetSchema = {
                scope: 'MY_HAND',
                type: 'CARD',
                count: 1,
                selectMode: 'MANUAL',
            } as const;
            ctx.machine.state.interactionMode = 'SELECT_TARGET';
            ctx.machine.state.pendingEffect = {
                sourceCard: ctx.sourceCard,
                sourcePlayerId: ctx.player.id,
                controllerPlayerId: ctx.player.id,
                actionType: 'SB01_007_SELECT_HAND_TO_DISCARD_FOR_DEPLOY',
                actionValue: {
                    revealedCardRef,
                    revealedCardId,
                },
                effectDescription: '트래시할 패를 선택한다.',
                validTargets: 'MY_HAND',
                targetSchema: targetSchema as any,
                selectedTargets: [],
            };
            ctx.machine.setPendingRuntime(ctx, {
                activation: ActivationCondition.EXIT,
                description: 'SB01-007 discard hand then choose empty zone',
                targets: targetSchema as any,
                action: {
                    type: 'COMPLEX_ACTION',
                    params: {
                        mode: 'SB01_007_EXIT_REVEAL_AND_DISCARD_TO_DEPLOY',
                        stage: 'RESOLVE_DISCARD_THEN_PROMPT_ZONE',
                        revealedCardRef,
                        revealedCardId,
                    },
                },
            } as any);
            ctx.machine.setInteractionOwner(ctx.player.id);
            return;
        }

        if (stage === 'RESOLVE_DISCARD_THEN_PROMPT_ZONE') {
            const selectedHandCard = (_targets || []).find((card: any) => ctx.player.hand.includes(card));
            const revealedCardRef = (params as any).revealedCardRef;
            const revealedCardId = (params as any).revealedCardId;
            const revealedCardFromState = (ctx.machine.state.revealedCards || []).find((card: any) =>
                card === revealedCardRef ||
                (revealedCardId && card?.id === revealedCardId),
            );
            const revealedCard = revealedCardFromState || revealedCardRef;

            if (!selectedHandCard || !revealedCard) {
                if (revealedCard) {
                    ctx.player.trash.push(revealedCard);
                }
                ctx.machine.state.revealedCards = [];
                return;
            }

            const handIndex = ctx.player.hand.indexOf(selectedHandCard);
            if (handIndex === -1) {
                ctx.player.trash.push(revealedCard);
                ctx.machine.state.revealedCards = [];
                return;
            }
            const [discarded] = ctx.player.hand.splice(handIndex, 1);
            if (discarded) {
                ctx.player.trash.push(discarded);
                ctx.machine.notifyHandTrashed(ctx.player, [discarded], {
                    flags: { handTrashByEffect: true },
                });
            }

            const hasEmptyZone = ctx.player.unitZones.some((zone: any) => !zone?.unit);
            if (!hasEmptyZone) {
                ctx.player.trash.push(revealedCard);
                ctx.machine.state.revealedCards = [];
                return;
            }

            const zoneSchema = {
                scope: 'MY_FIELD',
                type: 'ALL',
                count: 1,
                selectMode: 'MANUAL',
            } as const;
            ctx.machine.state.interactionMode = 'SELECT_TARGET';
            ctx.machine.state.pendingEffect = {
                sourceCard: ctx.sourceCard,
                sourcePlayerId: ctx.player.id,
                controllerPlayerId: ctx.player.id,
                actionType: 'SB01_007_SELECT_EMPTY_ZONE_TO_DEPLOY',
                actionValue: {
                    revealedCardRef,
                    revealedCardId,
                },
                effectDescription: '배치할 빈 유닛 존을 선택한다.',
                validTargets: 'MY_UNITS',
                targetSchema: zoneSchema as any,
                selectedTargets: [],
            };
            ctx.machine.setPendingRuntime(ctx, null);
            ctx.machine.setInteractionOwner(ctx.player.id);
            return;
        }

        if (ctx.player.deck.length <= 0) return;
        const revealed = ctx.player.deck.pop();
        if (!revealed) return;
        const hasDeployOption =
            revealed.type === CardType.UNIT &&
            ctx.player.hand.length > 0 &&
            ctx.player.unitZones.some((zone: any) => !zone?.unit);

        if (!hasDeployOption) {
            ctx.machine.state.revealedCards = [];
            ctx.player.trash.push(revealed);
            return;
        }

        const optionalEffect = {
            activation: ActivationCondition.EXIT,
            optional: true,
            description: '공개한 카드를 처리한다.',
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'SB01_007_EXIT_REVEAL_AND_DISCARD_TO_DEPLOY',
                    stage: 'SHOW_REVEALED_DECISION',
                    revealedCardRef: revealed,
                    revealedCardId: revealed.id,
                },
            },
        } as any;
        ctx.machine.effectManager.processEffect(optionalEffect, ctx);
        return;
    }

    if ((params as any).mode === 'SB01_008_EXIT_REDEPLOY_IF_EFFECT_TRASHED') {
        if (ctx.trashReason !== 'EFFECT') return;
        if (!(ctx as any).costPaid) return;
        const emptyZone = ctx.player.unitZones.find((zone: any) => !zone?.unit);
        if (!emptyZone) return;

        const trashIndex = ctx.player.trash.indexOf(ctx.sourceCard);
        if (trashIndex === -1) return;

        const [revived] = ctx.player.trash.splice(trashIndex, 1);
        if (!revived) return;
        emptyZone.unit = revived;
        emptyZone.items = [];
        emptyZone.buffs = [];
        emptyZone.temporaryEffects = [];
        emptyZone.hasAttacked = false;
        emptyZone.attackCountThisTurn = 0;
        emptyZone.extraAttackAllowance = 0;
        emptyZone.isExhausted = false;
        emptyZone.hasPlacedUnitThisTurn = false;
        emptyZone.hasActivatedEffectThisTurn = false;
        emptyZone.activatedEffectKeys = {};
        ctx.machine.triggerEntryEffectsForPlacedUnit(ctx.player, emptyZone);
        return;
    }

    if ((params as any).mode === 'SB01_011_EXIT_DRAW_BY_EFFECT_TRASHED_COUNT') {
        if (ctx.machine.currentPlayer?.id !== ctx.player.id) return;
        const drawCount = Math.max(0, ctx.machine.getEffectTrashedFriendlyUnitCount(ctx.player.id));
        if (drawCount > 0) {
            drawCard(ctx, { count: drawCount, __sourceActivation: (params as any).__sourceActivation }, _targets);
        }
        if (drawCount >= 3) {
            damage(ctx, { value: 1, __sourceActivation: (params as any).__sourceActivation }, _targets);
        }
        return;
    }

    if ((params as any).mode === 'SB01_013_ENTRY_ENABLE_ACTIVE_DAMAGE_BONUS') {
        const current = (ctx.player as any).sb01ActiveDamageBonusUntilTurnEnd as
            | { untilTurnCount: number; bonus: number }
            | undefined;
        const previousBonus = current && ctx.machine.state.turnCount <= current.untilTurnCount
            ? Math.max(0, Number(current.bonus || 0))
            : 0;
        (ctx.player as any).sb01ActiveDamageBonusUntilTurnEnd = {
            untilTurnCount: ctx.machine.state.turnCount,
            bonus: previousBonus + 1,
        };

        const sourceZone = ctx.player.unitZones.find((zone: any) => zone?.unit === ctx.sourceCard);
        const hasCost5Unit = ctx.player.hand.some((card: any) => card?.type === CardType.UNIT && getCardCost(ctx.machine, card) === 5);
        if (!sourceZone || !hasCost5Unit) return;

        const optionalEffect = {
            activation: ActivationCondition.ENTRY,
            optional: true,
            description: '이 유닛을 트래시하고 5코스트 유닛으로 교체할 수 있다.',
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'SB01_013_PROMPT_SWAP_SELF_WITH_COST5',
                },
            },
        } as any;
        ctx.machine.effectManager.processEffect(optionalEffect, ctx);
        return;
    }

    if ((params as any).mode === 'SB01_013_PROMPT_SWAP_SELF_WITH_COST5') {
        const stage = (params as any).stage;
        if (stage === 'RESOLVE') {
            const selectedCard = (_targets || []).find((card: any) =>
                ctx.player.hand.includes(card) && card.type === CardType.UNIT && getCardCost(ctx.machine, card) === 5
            );
            if (!selectedCard) return;

            const sourceZone = ctx.player.unitZones.find((zone: any) => zone?.unit === ctx.sourceCard);
            if (!sourceZone) return;
            const sourceZoneIndex = ctx.player.unitZones.indexOf(sourceZone);
            if (sourceZoneIndex < 0) return;

            ctx.machine.destroyUnit(ctx.player, sourceZone, undefined, 'EFFECT');
            const zoneAfterDestroy = ctx.player.unitZones[sourceZoneIndex];
            if (!zoneAfterDestroy || zoneAfterDestroy.unit) return;

            const handIndex = ctx.player.hand.indexOf(selectedCard);
            if (handIndex === -1) return;
            const [placed] = ctx.player.hand.splice(handIndex, 1);
            if (!placed) return;

            zoneAfterDestroy.unit = placed;
            zoneAfterDestroy.items = [];
            zoneAfterDestroy.buffs = [];
            zoneAfterDestroy.temporaryEffects = [];
            zoneAfterDestroy.hasAttacked = false;
            zoneAfterDestroy.attackCountThisTurn = 0;
            zoneAfterDestroy.extraAttackAllowance = 0;
            zoneAfterDestroy.isExhausted = false;
            zoneAfterDestroy.hasPlacedUnitThisTurn = false;
            zoneAfterDestroy.hasActivatedEffectThisTurn = false;
            zoneAfterDestroy.activatedEffectKeys = {};
            (placed as any).turnCostOverride = {
                cost: 3,
                turnCount: ctx.machine.state.turnCount,
            };
            ctx.machine.triggerEntryEffectsForPlacedUnit(ctx.player, zoneAfterDestroy);
            return;
        }

        const sourceZone = ctx.player.unitZones.find((zone: any) => zone?.unit === ctx.sourceCard);
        if (!sourceZone) return;
        const cost5Units = ctx.player.hand.filter((card: any) => card?.type === CardType.UNIT && getCardCost(ctx.machine, card) === 5);
        if (cost5Units.length <= 0) return;

        const handSchema = {
            scope: 'MY_HAND',
            type: 'CARD',
            count: 1,
            filters: [
                { type: 'UNIT_TYPE', value: CardType.UNIT },
                { type: 'COST_EQUAL', value: 5 },
            ],
            selectMode: 'MANUAL',
        } as const;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'SB01_013_SELECT_COST5_UNIT_TO_SWAP',
            actionValue: {},
            effectDescription: '교체할 5코스트 유닛을 선택한다.',
            validTargets: 'MY_HAND',
            targetSchema: handSchema,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: ActivationCondition.ENTRY,
            description: 'SB01-013 resolve self swap',
            targets: handSchema as any,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'SB01_013_PROMPT_SWAP_SELF_WITH_COST5',
                    stage: 'RESOLVE',
                },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'SB01_014_ACTIVE_DEPLOY_LOW_COST_FROM_TRASH') {
        const stage = (params as any).stage;
        if (stage === 'RESOLVE') {
            const selectedCard = (_targets || []).find((card: any) =>
                ctx.player.trash.includes(card) && card.type === CardType.UNIT && getCardCost(ctx.machine, card) <= 2
            );
            if (!selectedCard) return;
            if (!ctx.player.unitZones.some((zone: any) => !zone?.unit)) return;

            const zoneSchema = {
                scope: 'MY_FIELD',
                type: 'ALL',
                count: 1,
                selectMode: 'MANUAL',
            } as const;
            ctx.machine.state.interactionMode = 'SELECT_TARGET';
            ctx.machine.state.pendingEffect = {
                sourceCard: ctx.sourceCard,
                sourcePlayerId: ctx.player.id,
                controllerPlayerId: ctx.player.id,
                actionType: 'SB01_014_SELECT_EMPTY_ZONE_TO_DEPLOY',
                actionValue: {
                    selectedCardRef: selectedCard,
                    selectedCardId: selectedCard.id,
                },
                effectDescription: '배치할 빈 유닛 존을 선택한다.',
                validTargets: 'MY_UNITS',
                targetSchema: zoneSchema as any,
                selectedTargets: [],
            };
            ctx.machine.setPendingRuntime(ctx, null);
            ctx.machine.setInteractionOwner(ctx.player.id);
            return;
        }

        const candidates = ctx.player.trash.filter((card: any) => card.type === CardType.UNIT && getCardCost(ctx.machine, card) <= 2);
        if (candidates.length <= 0) return;
        if (!ctx.player.unitZones.some((zone: any) => !zone?.unit)) return;

        const targetSchema = {
            scope: 'MY_TRASH',
            type: 'CARD',
            count: 1,
            filters: [
                { type: 'UNIT_TYPE', value: CardType.UNIT },
                { type: 'COST_LIMIT', value: 2 },
            ],
            selectMode: 'MANUAL',
        } as const;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'SB01_014_SELECT_TRASH_UNIT_TO_DEPLOY',
            actionValue: {},
            effectDescription: '배치할 유닛을 선택한다.',
            validTargets: 'MY_TRASH',
            targetSchema: targetSchema as any,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: ActivationCondition.ACTIVE,
            description: 'SB01-014 resolve deploy from trash',
            targets: targetSchema as any,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'SB01_014_ACTIVE_DEPLOY_LOW_COST_FROM_TRASH',
                    stage: 'RESOLVE',
                },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'SB01_014_EXIT_TRASH_PAIN_EATER_FROM_SKILL_ZONE') {
        const skillIndex = ctx.player.skillZone.findIndex((card: any) =>
            card?.id?.startsWith('SB01-014') || String(card?.name || '').includes('페인 이터')
        );
        if (skillIndex === -1) return;
        const [removed] = ctx.player.skillZone.splice(skillIndex, 1);
        if (removed) {
            ctx.player.trash.push(removed);
        }
        return;
    }

    if ((params as any).mode === 'SB01_015_ACTIVE_TRASH_AND_REDEPLOY_SAME_NAME') {
        const selectedZone = (_targets || [])[0] as UnitZoneState | undefined;
        if (!selectedZone?.unit) return;
        const owner = getOwnerOfZone(ctx.machine, selectedZone);
        if (!owner || owner.id !== ctx.player.id) return;
        const selectedUnit = selectedZone.unit;
        if (getCardCost(ctx.machine, selectedUnit) > 5) return;

        const laneIndex = ctx.player.unitZones.indexOf(selectedZone);
        if (laneIndex < 0) return;
        const unitName = selectedUnit.name;
        const unitCost = getCardCost(ctx.machine, selectedUnit);

        ctx.machine.destroyUnit(ctx.player, selectedZone, undefined, 'EFFECT');

        const reviveIndex = ctx.player.trash.findIndex((card: any) =>
            card?.type === CardType.UNIT &&
            card?.name === unitName &&
            getCardCost(ctx.machine, card) === unitCost
        );
        if (reviveIndex === -1) return;
        const lane = ctx.player.unitZones[laneIndex];
        if (!lane || lane.unit) return;
        const [revived] = ctx.player.trash.splice(reviveIndex, 1);
        if (!revived) return;
        lane.unit = revived;
        lane.items = [];
        lane.buffs = [];
        lane.temporaryEffects = [];
        lane.hasAttacked = false;
        lane.attackCountThisTurn = 0;
        lane.extraAttackAllowance = 0;
        lane.isExhausted = false;
        lane.hasPlacedUnitThisTurn = false;
        lane.hasActivatedEffectThisTurn = false;
        lane.activatedEffectKeys = {};
        ctx.machine.triggerEntryEffectsForPlacedUnit(ctx.player, lane);
        return;
    }

    if ((params as any).mode === 'SB01_017_DEFENDER_DISCARD_LOCK_ATTACKER_UNTIL_NEXT_OPP_TURN_END') {
        const attackerZoneIndex = ctx.machine.state.pendingAttackerIndex;
        if (typeof attackerZoneIndex !== 'number' || attackerZoneIndex < 0) return;
        const attackerZone = ctx.opponent.unitZones[attackerZoneIndex];
        if (!attackerZone?.unit) return;

        attackerZone.temporaryEffects.push({
            activation: ActivationCondition.PASSIVE,
            description: '패시브 : 이 유닛은 공격할 수 없다.',
            action: {
                type: 'NONE',
                params: {
                    cannotAttackUntilTurnCount: ctx.machine.state.turnCount + 2,
                },
            },
            duration: 'PERMANENT',
        } as any);
        return;
    }

    if ((params as any).mode === 'SB01_021_ENTRY_PROMPT_SELECT_ITEMS_AND_EQUIP') {
        const stage = (params as any).stage;
        if (stage === 'RESOLVE') {
            const unitZones = ctx.player.unitZones.filter((zone: any) => zone?.unit);
            if (unitZones.length <= 0) return;
            const selectedCards = (_targets || []).filter((card: any) =>
                card?.type === CardType.ITEM && (ctx.player.hand.includes(card) || ctx.player.trash.includes(card))
            );
            if (selectedCards.length <= 0) return;

            const equippedByZone = new Map<UnitZoneState, any[]>();
            selectedCards.slice(0, unitZones.length).forEach((card: any, idx: number) => {
                let removed: any | null = null;
                const handIndex = ctx.player.hand.indexOf(card);
                if (handIndex !== -1) {
                    [removed] = ctx.player.hand.splice(handIndex, 1);
                } else {
                    const trashIndex = ctx.player.trash.indexOf(card);
                    if (trashIndex !== -1) {
                        [removed] = ctx.player.trash.splice(trashIndex, 1);
                    }
                }
                if (!removed) return;

                const zone = unitZones[idx % unitZones.length];
                zone.items.push(removed);
                const existing = equippedByZone.get(zone) || [];
                existing.push(removed);
                equippedByZone.set(zone, existing);
            });

            equippedByZone.forEach((items, zone) => {
                if (items.length > 0) {
                    ctx.machine.notifyItemsEquipped(ctx.player, zone, items, {
                        sourceActivation: (params as any).__sourceActivation,
                        sourcePlayerId: ctx.player.id,
                        sourceCardId: ctx.sourceCard.id,
                    });
                }
            });
            return;
        }

        const unitZones = ctx.player.unitZones.filter((zone: any) => zone?.unit);
        if (unitZones.length <= 0) return;
        const candidates = [...ctx.player.hand, ...ctx.player.trash].filter((card: any) => card?.type === CardType.ITEM);
        if (candidates.length <= 0) return;

        const maxCount = Math.min(unitZones.length, candidates.length);
        ctx.machine.state.revealedCards = candidates;
        const targetSchema = {
            scope: 'REVEALED',
            type: 'CARD',
            count: maxCount,
            filters: [{ type: 'UNIT_TYPE', value: CardType.ITEM }],
            selectMode: 'MANUAL',
        } as const;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'SB01_021_SELECT_ITEMS_TO_EQUIP',
            actionValue: {
                allowPartialSelection: true,
                minSelection: 1,
            },
            effectDescription: '장착할 아이템을 선택한다.',
            validTargets: 'REVEALED',
            targetSchema: targetSchema as any,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: ActivationCondition.ENTRY,
            description: 'SB01-021 resolve equip items',
            targets: targetSchema as any,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'SB01_021_ENTRY_PROMPT_SELECT_ITEMS_AND_EQUIP',
                    stage: 'RESOLVE',
                },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'SB01_023_ENTRY_DISCARD_UP_TO_TWO_THEN_DRAW') {
        const stage = (params as any).stage;
        if (stage === 'RESOLVE') {
            const selectedCards = (_targets || []).filter((card: any) => ctx.player.hand.includes(card));
            let itemCount = 0;
            const trashedCards: any[] = [];
            selectedCards.forEach((card: any) => {
                const handIndex = ctx.player.hand.indexOf(card);
                if (handIndex === -1) return;
                const [removed] = ctx.player.hand.splice(handIndex, 1);
                if (!removed) return;
                ctx.player.trash.push(removed);
                trashedCards.push(removed);
                if (removed.type === CardType.ITEM) itemCount++;
            });
            if (trashedCards.length > 0) {
                ctx.machine.notifyHandTrashed(ctx.player, trashedCards, {
                    flags: { handTrashByEffect: true },
                });
            }
            const drawCount = trashedCards.length;
            if (drawCount > 0) {
                drawCard(ctx, { count: drawCount, __sourceActivation: (params as any).__sourceActivation }, _targets);
            }
            if (itemCount >= 2) {
                drawCard(ctx, { count: 1, __sourceActivation: (params as any).__sourceActivation }, _targets);
            }
            return;
        }

        const maxCount = Math.min(2, ctx.player.hand.length);
        if (maxCount <= 0) return;
        const handSchema = {
            scope: 'MY_HAND',
            type: 'CARD',
            count: maxCount,
            selectMode: 'MANUAL',
        } as const;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'SB01_023_SELECT_HAND_TO_TRASH',
            actionValue: {
                allowPartialSelection: true,
                minSelection: 0,
            },
            effectDescription: '트래시할 패를 최대 2장까지 선택한다.',
            validTargets: 'MY_HAND',
            targetSchema: handSchema,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: ActivationCondition.ENTRY,
            description: 'SB01-023 resolve hand discard and draw',
            targets: handSchema as any,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'SB01_023_ENTRY_DISCARD_UP_TO_TWO_THEN_DRAW',
                    stage: 'RESOLVE',
                },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'SB01_024_ACTIVE_MAIN_RECOVER_FROM_TRASH_BY_EQUIPPED_COUNT') {
        const stage = (params as any).stage;
        if (!ctx.unitZone?.unit) return;
        const equippedCount = ctx.unitZone.items.length;
        if (equippedCount <= 0) return;

        if (stage === 'RESOLVE') {
            const selectedCard = (_targets || []).find((card: any) =>
                ctx.player.trash.includes(card) && getCardCost(ctx.machine, card) <= equippedCount
            );
            if (!selectedCard) return;
            const trashIndex = ctx.player.trash.indexOf(selectedCard);
            if (trashIndex === -1) return;
            const [removed] = ctx.player.trash.splice(trashIndex, 1);
            if (removed) {
                ctx.player.hand.push(removed);
            }
            return;
        }

        const targetSchema = {
            scope: 'MY_TRASH',
            type: 'CARD',
            count: 1,
            filters: [{ type: 'COST_LIMIT', value: equippedCount }],
            selectMode: 'MANUAL',
        } as const;
        const candidates = TargetSelector.resolve(ctx.machine, targetSchema as any, ctx as any);
        if (candidates.length <= 0) return;

        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'SB01_024_SELECT_TRASH_CARD_TO_HAND',
            actionValue: {},
            effectDescription: '패로 가져올 카드를 선택한다.',
            validTargets: 'MY_TRASH',
            targetSchema: targetSchema as any,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: 'SB01-024 resolve recover card',
            targets: targetSchema as any,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'SB01_024_ACTIVE_MAIN_RECOVER_FROM_TRASH_BY_EQUIPPED_COUNT',
                    stage: 'RESOLVE',
                },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'SB01_025_ACTIVE_DISCARD_ITEMS_AND_DRAW') {
        const stage = (params as any).stage;
        if (stage === 'RESOLVE') {
            const selectedItems = (_targets || []).filter((card: any) => ctx.player.hand.includes(card) && card.type === CardType.ITEM);
            if (selectedItems.length <= 0) return;
            const trashedCards: any[] = [];
            selectedItems.forEach((card: any) => {
                const handIndex = ctx.player.hand.indexOf(card);
                if (handIndex === -1) return;
                const [removed] = ctx.player.hand.splice(handIndex, 1);
                if (!removed) return;
                ctx.player.trash.push(removed);
                trashedCards.push(removed);
            });
            if (trashedCards.length > 0) {
                ctx.machine.notifyHandTrashed(ctx.player, trashedCards, {
                    flags: { handTrashByEffect: true },
                });
                drawCard(ctx, { count: trashedCards.length, __sourceActivation: (params as any).__sourceActivation }, _targets);
            }
            return;
        }

        const itemCardsInHand = ctx.player.hand.filter((card: any) => card.type === CardType.ITEM);
        if (itemCardsInHand.length <= 0) return;
        const handSchema = {
            scope: 'MY_HAND',
            type: 'CARD',
            count: itemCardsInHand.length,
            filters: [{ type: 'UNIT_TYPE', value: CardType.ITEM }],
            selectMode: 'MANUAL',
        } as const;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'SB01_025_SELECT_ITEMS_TO_TRASH',
            actionValue: {
                allowPartialSelection: true,
                minSelection: 1,
            },
            effectDescription: '트래시할 아이템을 선택한다.',
            validTargets: 'MY_HAND',
            targetSchema: handSchema,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: ActivationCondition.ACTIVE,
            description: 'SB01-025 resolve item discard draw',
            targets: handSchema as any,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'SB01_025_ACTIVE_DISCARD_ITEMS_AND_DRAW',
                    stage: 'RESOLVE',
                },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'PROMPT_SELECT_SKILL_ZONE_CARD_FOR_ZERO_COST') {
        const costMax = typeof (params as any).costMax === 'number' ? Math.max(0, (params as any).costMax) : null;
        const skills = ctx.player.skillZone
            .map((card, skillZoneIndex) => ({ card, skillZoneIndex }))
            .filter(({ card }) => {
                if (card?.type !== CardType.SKILL) return false;
                if (costMax === null) return true;
                return getCardCost(ctx.machine, card) <= costMax;
            });

        if (skills.length === 0) return;

        ctx.machine.state.revealedCards = skills.map(({ card, skillZoneIndex }) =>
            createPromptOptionCard(
                `BT06_SKILL_OPTION_${skillZoneIndex}_${card.id}`,
                card.name,
                card.text || `${card.name}를 0코스트로 설정`,
                card.imageUrl
            )
        ) as any;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT06_SELECT_SKILL_ZONE_CARD',
            actionValue: {
                options: skills.map(({ skillZoneIndex }) => ({ skillZoneIndex })),
                followUpSubActions: Array.isArray((params as any).followUpSubActions) ? (params as any).followUpSubActions : [],
                contextFlagKey: (params as any).contextFlagKey || 'BT06_SKILL_ZERO_COST_SELECTED',
                allowPartialSelection: (params as any).allowSkip === true,
            },
            effectDescription: '0코스트로 만들 스킬을 선택한다.',
            validTargets: 'REVEALED',
            targetSchema: {
                scope: 'REVEALED',
                type: 'CARD',
                count: 1,
                selectMode: 'MANUAL',
            },
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, null);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'BT03_PROMPT_SELECT_SKILL_ZONE_CARD_TO_TRASH') {
        const costMax = typeof (params as any).costMax === 'number' ? Math.max(0, (params as any).costMax) : null;
        const skills = ctx.player.skillZone
            .map((card, skillZoneIndex) => ({ card, skillZoneIndex }))
            .filter(({ card }) => {
                if (card?.type !== CardType.SKILL) return false;
                if (costMax === null) return true;
                return getCardCost(ctx.machine, card) <= costMax;
            });

        if (skills.length === 0) return;

        ctx.machine.state.revealedCards = skills.map(({ card, skillZoneIndex }) =>
            createPromptOptionCard(
                `BT03_SKILL_OPTION_${skillZoneIndex}_${card.id}`,
                card.name,
                card.text || `${card.name}를 트래시`,
                card.imageUrl
            )
        ) as any;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT03_SELECT_SKILL_ZONE_CARD_TO_TRASH',
            actionValue: {
                options: skills.map(({ skillZoneIndex }) => ({ skillZoneIndex })),
                followUpSubActions: Array.isArray((params as any).followUpSubActions) ? (params as any).followUpSubActions : [],
                contextFlagKey: (params as any).contextFlagKey || 'BT03_SKILL_ZONE_CARD_TRASHED',
            },
            effectDescription: '트래시할 스킬을 선택한다.',
            validTargets: 'REVEALED',
            targetSchema: {
                scope: 'REVEALED',
                type: 'CARD',
                count: 1,
                selectMode: 'MANUAL',
            },
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, null);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'BT03_011_PROMPT_TRASH_LOWER_COST_TO_HAND') {
        const skills = ctx.player.skillZone
            .map((card, skillZoneIndex) => ({ card, skillZoneIndex }))
            .filter(({ card }) => card?.type === CardType.SKILL);

        if (skills.length === 0) return;

        ctx.machine.state.revealedCards = skills.map(({ card, skillZoneIndex }) =>
            createPromptOptionCard(
                `BT03_011_SKILL_OPTION_${skillZoneIndex}_${card.id}`,
                card.name,
                card.text || `${card.name}를 트래시`,
                card.imageUrl
            )
        ) as any;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT03_011_SELECT_SKILL_ZONE_CARD_TO_TRASH',
            actionValue: {
                options: skills.map(({ skillZoneIndex }) => ({ skillZoneIndex })),
            },
            effectDescription: '트래시할 스킬을 선택한다.',
            validTargets: 'REVEALED',
            targetSchema: {
                scope: 'REVEALED',
                type: 'CARD',
                count: 1,
                selectMode: 'MANUAL',
            },
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, null);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'BT06_TRASH_TOP_AND_PROMPT_TRASHED_SKILL_CAST') {
        const trashCount = Math.max(0, (params as any).count ?? 1);
        const costMax = typeof (params as any).costMax === 'number' ? Math.max(0, (params as any).costMax) : null;
        const trashedCards: any[] = [];

        for (let i = 0; i < trashCount; i++) {
            if (ctx.player.deck.length <= 0) break;
            const card = ctx.player.deck.pop();
            if (!card) break;
            ctx.player.trash.push(card);
            trashedCards.push(card);
        }

        const skillOptions = trashedCards.filter(card => {
            if (!card || card.type !== CardType.SKILL) return false;
            if (costMax === null) return true;
            return getCardCost(ctx.machine, card) <= costMax;
        });

        if (skillOptions.length === 0) return;

        ctx.machine.state.revealedCards = skillOptions as any;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT06_SELECT_TRASHED_SKILL_TO_CAST',
            actionValue: {
                allowPartialSelection: (params as any).allowSkip === true,
            },
            effectDescription: '트래시한 카드 중 발동할 스킬을 선택한다.',
            validTargets: 'REVEALED',
            targetSchema: {
                scope: 'REVEALED',
                type: 'CARD',
                count: 1,
                selectMode: 'MANUAL',
            },
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, null);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'BT06_058_RETURN_ENCOUNTER_AND_SET_HIT') {
        if (!ctx.unitZone || !ctx.unitZone.unit) return;
        const laneIndex = ctx.player.unitZones.indexOf(ctx.unitZone);
        if (laneIndex < 0) return;

        const encounterZone = ctx.opponent.unitZones[laneIndex];
        if (!encounterZone?.unit) return;
        if (getCardCost(ctx.machine, encounterZone.unit) < 4) return;

        returnUnitAndItemsToHand(ctx, {}, [encounterZone]);
        buffHit(ctx, { value: 1, mode: 'SET', duration: 'TURN_END' }, [ctx.unitZone]);
        return;
    }

    if ((params as any).mode === 'BT06_062_PROMPT_UNIQUE_TRASH_SKILLS') {
        const cardType = (params as any).cardType || CardType.SKILL;
        const excludeKeyword = (params as any).excludeKeyword || '트리거';
        const excludeName = typeof (params as any).excludeName === 'string' ? String((params as any).excludeName).trim() : '';
        const requiredCount = Math.max(1, (params as any).requiredCount ?? 3);

        const uniqueByName = new Map<string, any>();
        ctx.player.trash.forEach((card: any) => {
            if (!card || card.type !== cardType) return;
            if (excludeKeyword && cardHasKeywordLike(card, excludeKeyword)) return;
            const nameKey = String(card.name || card.id || '').trim();
            if (!nameKey) return;
            if (excludeName && nameKey === excludeName) return;
            if (!uniqueByName.has(nameKey)) {
                uniqueByName.set(nameKey, card);
            }
        });

        const options = Array.from(uniqueByName.values());
        if (options.length < requiredCount) return;

        const selectionSchema = {
            scope: 'REVEALED',
            type: 'CARD',
            count: requiredCount,
            selectMode: 'MANUAL',
        } as const;

        ctx.machine.state.revealedCards = options as any;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT06_062_SELECT_UNIQUE_TRASH_SKILLS',
            actionValue: {
                allowPartialSelection: false,
            },
            effectDescription: '카드명이 다른 비트리거 스킬 3장을 고른다.',
            validTargets: 'REVEALED',
            targetSchema: selectionSchema,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: 'BT06-062 unique trash skills resolve',
            targets: selectionSchema as any,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT06_062_RESOLVE_UNIQUE_TRASH_SKILLS',
                    damageValue: (params as any).damageValue ?? 2,
                },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'BT06_062_RESOLVE_UNIQUE_TRASH_SKILLS') {
        const selectedCards = (_targets || []).filter(card => ctx.player.trash.includes(card));
        if (selectedCards.length === 0) return;

        const movedToDeckBottom: any[] = [];
        selectedCards.forEach((card: any) => {
            const trashIndex = ctx.player.trash.indexOf(card);
            if (trashIndex === -1) return;
            const [removed] = ctx.player.trash.splice(trashIndex, 1);
            if (removed) movedToDeckBottom.push(removed);
        });
        if (movedToDeckBottom.length > 0) {
            ctx.player.deck.unshift(...movedToDeckBottom);
        }

        const damageValue = Math.max(0, (params as any).damageValue ?? 2);
        if (damageValue > 0) {
            ctx.machine.dealDamage(ctx.opponent, damageValue);
        }

        if (ctx.unitZone?.unit) {
            ctx.unitZone.temporaryEffects.push({
                activation: ActivationCondition.PASSIVE,
                description: '패시브 : 이 유닛은 이 턴이 끝날 때까지 공격할 수 없다.',
                action: { type: 'NONE', params: { cannotAttack: true } },
                duration: 'TURN_END',
            } as any);
        }
        return;
    }

    if ((params as any).mode === 'BT06_070_GRANT_ATTACKER_OPPONENT_DRAW_UNTIL_OPP_TURN_END') {
        const untilTurnCount = ctx.machine.state.turnCount + Math.max(0, (params as any).untilTurnCountOffset ?? 1);
        (_targets || []).forEach((target: any) => {
            if (!target || !('temporaryEffects' in target) || !target.unit) return;
            target.temporaryEffects.push({
                activation: ActivationCondition.ATTACKER,
                description: '어태커 : 상대는 카드를 1장 드로우한다.',
                action: {
                    type: 'DRAW',
                    params: {
                        count: 1,
                        target: 'OPPONENT',
                        untilTurnCount,
                    },
                },
                duration: 'PERMANENT',
            } as any);
        });
        return;
    }

    if ((params as any).mode === 'BT06_GRANT_BERSERK_UNTIL_OPP_TURN_END') {
        const untilTurnCount = ctx.machine.state.turnCount + Math.max(0, (params as any).untilTurnCountOffset ?? 1);
        (_targets || []).forEach((target: any) => {
            if (!target || !('temporaryEffects' in target) || !target.unit) return;
            target.temporaryEffects.push({
                activation: ActivationCondition.PASSIVE,
                description: '광전사',
                action: { type: 'NONE', params: { keyword: 'BERSERK', untilTurnCount } },
                duration: 'PERMANENT',
            } as any);
        });
        return;
    }

    if ((params as any).mode === 'BT06_077_DRAW_BY_DEFENDER_AND_LOCK_OPP_ATTACKER') {
        const defenderCount = ctx.player.unitZones.filter((zone: any) =>
            zoneHasKeywordLike(zone, '디펜더') || zoneHasKeywordLike(zone, 'DEFENDER')
        ).length;

        if (defenderCount > 0) {
            const playerIndex = ctx.machine.state.players.indexOf(ctx.player);
            ctx.machine.drawCard(playerIndex, defenderCount, {
                reason: 'EFFECT',
                sourceActivation: (params as any).__sourceActivation,
            });
        }

        const untilTurnCount = ctx.machine.state.turnCount + Math.max(0, (params as any).untilTurnCountOffset ?? 1);
        const lockUntilMap = (ctx.opponent.lockedActivationsUntilTurnCount || {}) as Record<string, number>;
        const current = lockUntilMap[String(ActivationCondition.ATTACKER)] ?? 0;
        lockUntilMap[String(ActivationCondition.ATTACKER)] = Math.max(current, untilTurnCount);
        ctx.opponent.lockedActivationsUntilTurnCount = lockUntilMap as any;
        return;
    }

    if ((params as any).mode === 'BT06_080_DISCARD_ALL_AND_DRAW_TO_HAND_SIZE') {
        discardAll(ctx, {}, _targets);
        const targetHandSize = Math.max(0, (params as any).targetHandSize ?? 5);
        const drawCount = Math.max(0, targetHandSize - ctx.player.hand.length);
        if (drawCount > 0) {
            const playerIndex = ctx.machine.state.players.indexOf(ctx.player);
            ctx.machine.drawCard(playerIndex, drawCount, {
                reason: 'EFFECT',
                sourceActivation: (params as any).__sourceActivation,
            });
        }
        return;
    }

    if ((params as any).mode === 'BT06_029_KEEP_AND_REFILL') {
        const keepSet = new Set((_targets || []).filter(card => ctx.player.hand.includes(card)));
        const cardsToTrash = ctx.player.hand.filter(card => !keepSet.has(card));
        const cardsToKeep = ctx.player.hand.filter(card => keepSet.has(card));

        if (cardsToTrash.length > 0) {
            ctx.player.hand = cardsToKeep;
            ctx.player.trash.push(...cardsToTrash);
            (ctx as any).discardedCount = cardsToTrash.length;
            ctx.machine.notifyHandTrashed(ctx.player, cardsToTrash, {
                flags: {
                    handTrashByEffect: true,
                },
            });
        } else {
            (ctx as any).discardedCount = 0;
        }

        const targetHandSize = Math.max(0, (params as any).targetHandSize ?? 3);
        const drawCount = Math.max(0, targetHandSize - ctx.player.hand.length);
        if (drawCount > 0) {
            const playerIndex = ctx.machine.state.players.indexOf(ctx.player);
            ctx.machine.drawCard(playerIndex, drawCount, {
                reason: 'EFFECT',
                sourceActivation: (params as any).__sourceActivation,
            });
        }
        return;
    }

    if ((params as any).mode === 'BT06_051_LOCK_ENCOUNTER_UNTIL_OPP_TURN_END') {
        const targetZone = (_targets || [])[0] as UnitZoneState | undefined;
        if (!targetZone?.unit) return;
        const untilTurnCount = ctx.machine.state.turnCount + 1;

        targetZone.temporaryEffects.push({
            activation: ActivationCondition.PASSIVE,
            description: '패시브 : 이 유닛은 상대의 턴이 끝날 때까지 공격할 수 없다.',
            action: { type: 'NONE', params: { cannotAttackUntilTurnCount: untilTurnCount } },
            duration: 'PERMANENT',
        } as any);
        return;
    }

    if ((params as any).mode === 'BT06_034_FORCE_SELECTED_ATTACK_IF_ENCOUNTER') {
        const targetZone = (_targets || [])[0] as UnitZoneState | undefined;
        if (!targetZone?.unit) return;
        const owner = getOwnerOfZone(ctx.machine, targetZone);
        if (!owner || owner.id !== ctx.player.id) return;

        const zoneIndex = owner.unitZones.indexOf(targetZone);
        if (zoneIndex < 0) return;
        if (!ctx.opponent.unitZones[zoneIndex]?.unit) return;
        if (ctx.machine.currentPlayer?.id !== ctx.player.id) return;
        if (ctx.machine.state.combatStep !== 'NONE') return;

        const previousPhase = ctx.machine.state.phase;
        (ctx.machine.state as any).resumePhaseAfterAutoAttack = previousPhase;
        ctx.machine.state.phase = Phase.ATTACK;
        ctx.machine.attack(zoneIndex, { byCardEffect: true });

        if (ctx.machine.state.interactionMode === 'NORMAL' && ctx.machine.state.combatStep === 'NONE') {
            ctx.machine.state.phase = previousPhase;
            delete (ctx.machine.state as any).resumePhaseAfterAutoAttack;
        }
        return;
    }

    if ((params as any).mode === 'BT06_035_APPLY_HAND_DIFF_DEBUFF') {
        const targetZone = (_targets || [])[0] as UnitZoneState | undefined;
        if (!targetZone?.unit) return;
        const diff = Math.abs(ctx.player.hand.length - ctx.opponent.hand.length);
        if (diff <= 0) return;
        const valuePerDiff = Math.max(0, (params as any).valuePerDiff ?? 2000);
        if (valuePerDiff <= 0) return;

        targetZone.buffs.push({
            id: ctx.machine.createRuntimeId('BUFF'),
            sourceCard: ctx.sourceCard,
            type: 'POWER',
            value: -valuePerDiff * diff,
            duration: (params as any).duration || 'TURN_END',
        });
        return;
    }

    if ((params as any).mode === 'LOCK_ACTIVATION_UNTIL_TURN_END') {
        const targetPlayer = (params as any).target === 'OPPONENT' ? ctx.opponent : ctx.player;
        const activation = (params as any).activation;
        if (!targetPlayer || !activation) return;

        if (typeof (params as any).untilTurnCountOffset === 'number') {
            const untilTurnCount = ctx.machine.state.turnCount + Math.max(0, (params as any).untilTurnCountOffset);
            const lockUntilMap = (targetPlayer.lockedActivationsUntilTurnCount || {}) as Record<string, number>;
            const current = lockUntilMap[String(activation)] ?? 0;
            lockUntilMap[String(activation)] = Math.max(current, untilTurnCount);
            targetPlayer.lockedActivationsUntilTurnCount = lockUntilMap as any;
            return;
        }

        const lockMap = (targetPlayer.lockedActivationsUntilTurnEnd || {}) as Record<string, boolean>;
        lockMap[String(activation)] = true;
        targetPlayer.lockedActivationsUntilTurnEnd = lockMap as any;
        return;
    }

    if ((params as any).mode === 'BT06_039_PROMPT_DISCARD_FOR_SCALING_DEBUFF') {
        const targetZone = (_targets || [])[0] as UnitZoneState | undefined;
        if (!targetZone?.unit) return;
        const owner = getOwnerOfZone(ctx.machine, targetZone);
        if (!owner) return;
        const zoneIndex = owner.unitZones.indexOf(targetZone);
        if (zoneIndex < 0) return;

        ctx.flags = ctx.flags || {};
        ctx.flags.BT06_039_TARGET_PLAYER_ID = owner.id;
        ctx.flags.BT06_039_TARGET_ZONE_INDEX = zoneIndex;

        const handCount = ctx.player.hand.length;
        const handSelectionSchema = {
            scope: 'MY_HAND',
            type: 'CARD',
            count: handCount,
            selectMode: 'MANUAL',
        } as const;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT06_SELECT_HAND_TO_TRASH_FOR_SCALING_DEBUFF',
            actionValue: { allowPartialSelection: true },
            effectDescription: '트래시할 패를 원하는 수만큼 고른다.',
            validTargets: 'MY_HAND',
            targetSchema: handSelectionSchema,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: 'ACTIVE' as any,
            description: 'BT06-039 discard and scale debuff',
            targets: handSelectionSchema as any,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT06_039_RESOLVE_DISCARD_AND_APPLY',
                    duration: (params as any).duration || 'TURN_END',
                    valuePerCard: Math.max(0, (params as any).valuePerCard ?? 3000),
                },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'BT06_039_RESOLVE_DISCARD_AND_APPLY') {
        const selectedCards = (_targets || []).filter(card => ctx.player.hand.includes(card));
        const trashedCards: any[] = [];
        selectedCards.forEach((card: any) => {
            const handIndex = ctx.player.hand.indexOf(card);
            if (handIndex === -1) return;
            const [removed] = ctx.player.hand.splice(handIndex, 1);
            if (!removed) return;
            ctx.player.trash.push(removed);
            trashedCards.push(removed);
        });

        if (trashedCards.length > 0) {
            ctx.machine.notifyHandTrashed(ctx.player, trashedCards, {
                flags: {
                    handTrashByEffect: true,
                },
            });
        }
        (ctx as any).discardedCount = trashedCards.length;

        const targetPlayerId = ctx.flags?.BT06_039_TARGET_PLAYER_ID;
        const targetZoneIndex = ctx.flags?.BT06_039_TARGET_ZONE_INDEX;
        const valuePerCard = Math.max(0, (params as any).valuePerCard ?? 3000);
        const debuffValue = trashedCards.length * valuePerCard;
        if (!targetPlayerId || typeof targetZoneIndex !== 'number' || debuffValue <= 0) return;

        const targetPlayer = ctx.machine.state.players.find((player: any) => player.id === targetPlayerId);
        const targetZone = targetPlayer?.unitZones?.[targetZoneIndex];
        if (!targetZone?.unit) return;

        targetZone.buffs.push({
            id: ctx.machine.createRuntimeId('BUFF'),
            sourceCard: ctx.sourceCard,
            type: 'POWER',
            value: -debuffValue,
            duration: (params as any).duration || 'TURN_END',
        });
        return;
    }

    if ((params as any).mode === 'BT03_015_PROMPT_UNIT_DISCARD_FOR_POWER_DEBUFF') {
        const targetZone = (_targets || [])[0] as UnitZoneState | undefined;
        if (!targetZone?.unit) return;
        const owner = getOwnerOfZone(ctx.machine, targetZone);
        if (!owner) return;
        const zoneIndex = owner.unitZones.indexOf(targetZone);
        if (zoneIndex < 0) return;

        const payableUnitCount = ctx.player.hand.filter(card => card.type === CardType.UNIT).length;
        if (payableUnitCount <= 0) return;

        ctx.flags = ctx.flags || {};
        ctx.flags.BT03_015_TARGET_PLAYER_ID = owner.id;
        ctx.flags.BT03_015_TARGET_ZONE_INDEX = zoneIndex;

        ctx.machine.state.interactionMode = 'SELECT_COST';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT03_015_SELECT_UNIT_DISCARD_FOR_DEBUFF',
            actionValue: {},
            effectDescription: '패의 유닛 카드 1장을 트래시한다.',
            selectionPurpose: '패 유닛 카드 1장 코스트 지불',
            costToPay: { type: 'TRASH_HAND', amount: 1, cardTypeFilter: CardType.UNIT },
            costCardTypeFilter: CardType.UNIT,
            costPaidCount: 0,
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: 'ACTIVE' as any,
            description: 'BT03-015 discard unit and apply debuff',
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT03_015_RESOLVE_DISCARD_AND_APPLY',
                    duration: (params as any).duration || 'TURN_END',
                },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'BT03_015_RESOLVE_DISCARD_AND_APPLY') {
        const targetPlayerId = ctx.flags?.BT03_015_TARGET_PLAYER_ID;
        const targetZoneIndex = ctx.flags?.BT03_015_TARGET_ZONE_INDEX;
        const costCard = ctx.costPaymentCard;
        const debuffValue = Math.max(0, costCard?.power || 0);
        if (!targetPlayerId || typeof targetZoneIndex !== 'number' || debuffValue <= 0) return;

        const targetPlayer = ctx.machine.state.players.find((player: any) => player.id === targetPlayerId);
        const targetZone = targetPlayer?.unitZones?.[targetZoneIndex];
        if (!targetZone?.unit) return;

        targetZone.buffs.push({
            id: ctx.machine.createRuntimeId('BUFF'),
            sourceCard: ctx.sourceCard,
            type: 'POWER',
            value: -debuffValue,
            duration: (params as any).duration || 'TURN_END',
        });
        return;
    }

    if ((params as any).mode === 'BT03_017_PROMPT_DISCARD_THEN_SET_OPP_POWER') {
        const targetZone = (_targets || [])[0] as UnitZoneState | undefined;
        if (!targetZone?.unit) return;
        const owner = getOwnerOfZone(ctx.machine, targetZone);
        if (!owner) return;
        const zoneIndex = owner.unitZones.indexOf(targetZone);
        if (zoneIndex < 0) return;
        if (ctx.player.hand.length <= 0) return;

        ctx.flags = ctx.flags || {};
        ctx.flags.BT03_017_TARGET_PLAYER_ID = owner.id;
        ctx.flags.BT03_017_TARGET_ZONE_INDEX = zoneIndex;

        ctx.machine.state.interactionMode = 'SELECT_COST';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT03_017_SELECT_HAND_DISCARD_FOR_SET_POWER',
            actionValue: {},
            effectDescription: '패 1장을 트래시한다.',
            selectionPurpose: '패 1장 코스트 지불',
            costToPay: { type: 'TRASH_HAND', amount: 1 },
            costPaidCount: 0,
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: 'ACTIVE' as any,
            description: 'BT03-017 discard and set opponent power',
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT03_017_RESOLVE_DISCARD_AND_APPLY',
                    setValue: Math.max(0, (params as any).setValue ?? 3000),
                    duration: (params as any).duration || 'TURN_END',
                },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'BT03_017_RESOLVE_DISCARD_AND_APPLY') {
        const targetPlayerId = ctx.flags?.BT03_017_TARGET_PLAYER_ID;
        const targetZoneIndex = ctx.flags?.BT03_017_TARGET_ZONE_INDEX;
        if (!targetPlayerId || typeof targetZoneIndex !== 'number') return;

        const targetPlayer = ctx.machine.state.players.find((player: any) => player.id === targetPlayerId);
        const targetZone = targetPlayer?.unitZones?.[targetZoneIndex];
        if (!targetZone?.unit) return;

        targetZone.buffs.push({
            id: ctx.machine.createRuntimeId('BUFF'),
            sourceCard: ctx.sourceCard,
            type: 'POWER',
            value: Math.max(0, (params as any).setValue ?? 3000),
            mode: 'SET',
            duration: (params as any).duration || 'TURN_END',
        });
        return;
    }

    if ((params as any).mode === 'BT03_025_ENTRY_LEVEL_OR_DRAW') {
        const threshold = Math.max(0, (params as any).leaderLevelThreshold ?? 10);
        if (ctx.player.leaderLevel >= threshold) {
            drawCard(ctx, { count: Math.max(0, (params as any).drawCount ?? 1), __sourceActivation: (params as any).__sourceActivation }, _targets);
        } else {
            gainLevel(ctx, { value: Math.max(0, (params as any).gainLevelValue ?? 1) }, _targets);
        }
        return;
    }

    if ((params as any).mode === 'BT03_027_GRANT_PENETRATION_IF_POWER_AHEAD') {
        if (!ctx.unitZone?.unit) return;
        const laneIndex = ctx.player.unitZones.indexOf(ctx.unitZone);
        if (laneIndex < 0) return;

        const encounterZone = ctx.opponent.unitZones[laneIndex];
        if (!encounterZone?.unit) return;

        const selfPower = ctx.machine.getUnitPower(ctx.unitZone, ctx.player);
        const encounterPower = ctx.machine.getUnitPower(encounterZone, ctx.opponent);
        const threshold = Math.max(0, (params as any).threshold ?? 3500);
        if (selfPower - encounterPower < threshold) return;

        const penetrationValue = Math.max(0, (params as any).penetrationValue ?? 1);
        const duration = (params as any).duration || 'TURN_END';
        grantEffect(ctx, {
            effect: {
                activation: ActivationCondition.ATTACKER,
                description: `어태커 : 관통[${penetrationValue}]`,
                action: { type: 'PENETRATION', params: { value: penetrationValue } },
                duration,
            },
            duration,
        }, [ctx.unitZone]);
        return;
    }

    if ((params as any).mode === 'BT03_030_BUFF_HIT_AND_DRAW_IF_LOW_COST_UNITS_MIN') {
        const targets = (_targets || []).filter((target: any) => target?.unit);
        const duration = (params as any).duration || 'TURN_END';
        const hitValue = (params as any).hitValue ?? 1;
        const minCount = Math.max(0, (params as any).minCount ?? 3);
        const drawCount = Math.max(0, (params as any).drawCount ?? 1);

        if (targets.length > 0) {
            buffHit(ctx, { value: hitValue, duration }, targets);
        }
        if (targets.length >= minCount && drawCount > 0) {
            drawCard(ctx, { count: drawCount, __sourceActivation: (params as any).__sourceActivation }, _targets);
        }
        return;
    }

    if ((params as any).mode === 'BT03_031_DESTROY_ENCOUNTER_IF_SELECTED_UNIT_POWER_HIGHER') {
        const selectedZone = (_targets || [])[0] as UnitZoneState | undefined;
        if (!selectedZone?.unit) return;
        const owner = getOwnerOfZone(ctx.machine, selectedZone);
        if (!owner || owner.id !== ctx.player.id) return;

        const laneIndex = ctx.player.unitZones.indexOf(selectedZone);
        if (laneIndex < 0) return;
        const encounterZone = ctx.opponent.unitZones[laneIndex];
        if (!encounterZone?.unit) return;

        const selectedPower = ctx.machine.getUnitPower(selectedZone, ctx.player);
        const encounterPower = ctx.machine.getUnitPower(encounterZone, ctx.opponent);
        if (selectedPower > encounterPower) {
            ctx.machine.destroyUnit(ctx.opponent, encounterZone, undefined, 'EFFECT');
        }
        return;
    }

    if ((params as any).mode === 'BT03_032_BUFF_LOW_COST_UNITS_AND_BONUS_HIT') {
        const targets = (_targets || []).filter((target: any) => target?.unit);
        if (targets.length === 0) return;

        const duration = (params as any).duration || 'TURN_END';
        const powerValue = (params as any).powerValue ?? 5000;
        const hitValue = (params as any).hitValue ?? 1;
        const minCount = Math.max(0, (params as any).minCount ?? 3);

        buffPower(ctx, { value: powerValue, duration }, targets);
        if (targets.length >= minCount) {
            buffHit(ctx, { value: hitValue, duration }, targets);
        }
        return;
    }

    if ((params as any).mode === 'BT03_036_DRAW_BY_EXIT_UNIT_COUNT') {
        const drawPerUnit = Math.max(0, (params as any).drawPerUnit ?? 1);
        const exitUnitCount = countFriendlyExitUnits(ctx.player);
        const drawCount = exitUnitCount * drawPerUnit;
        if (drawCount <= 0) return;
        drawCard(ctx, {
            count: drawCount,
            __sourceActivation: (params as any).__sourceActivation,
        }, _targets);
        return;
    }

    if ((params as any).mode === 'BT03_037_APPLY_DEBUFF_BY_EXIT_UNIT_COUNT') {
        const targetZone = (_targets || [])[0] as UnitZoneState | undefined;
        if (!targetZone?.unit) return;
        const valuePerUnit = Math.max(0, (params as any).valuePerUnit ?? 2500);
        const exitUnitCount = countFriendlyExitUnits(ctx.player);
        const debuffValue = exitUnitCount * valuePerUnit;
        if (debuffValue <= 0) return;
        targetZone.buffs.push({
            id: ctx.machine.createRuntimeId('BUFF'),
            sourceCard: ctx.sourceCard,
            type: 'POWER',
            value: -debuffValue,
            duration: (params as any).duration || 'TURN_END',
        });
        return;
    }

    if ((params as any).mode === 'BT03_040_PROMPT_OPP_DISCARD_TO_HAND_SIZE') {
        const keepCount = Math.max(0, (params as any).keepCount ?? 4);
        const discardCount = Math.max(0, ctx.opponent.hand.length - keepCount);
        if (discardCount <= 0) return;

        const handSelectionSchema = {
            scope: 'OPP_HAND',
            type: 'CARD',
            count: discardCount,
            selectMode: 'MANUAL',
        } as const;

        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.opponent.id,
            actionType: 'BT03_040_OPP_SELECT_HAND_TO_TRASH',
            actionValue: { allowPartialSelection: false, requiredCount: discardCount },
            effectDescription: '상대는 패를 4장 남기고 버릴 카드를 고른다.',
            selectionPurpose: '버릴 상대 패 선택',
            validTargets: 'OPP_HAND',
            targetSchema: handSelectionSchema,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: 'ACTIVE' as any,
            description: 'BT03-040 opponent discard to hand size',
            targets: handSelectionSchema as any,
            action: { type: 'DISCARD', params: { target: 'OPPONENT', count: discardCount } },
        } as any);
        ctx.machine.setInteractionOwner(ctx.opponent.id);
        return;
    }

    if ((params as any).mode === 'BT03_041_EXIT_PROMPT_DISCARD_AND_REVIVE') {
        const exitCandidates = ctx.player.hand
            .map((card: any, handIndex: number) => ({ card, handIndex }))
            .filter(({ card }) =>
                !!card &&
                (card.type === CardType.UNIT || card.type === CardType.ITEM) &&
                cardHasKeywordLike(card, '엑시트')
            );
        if (exitCandidates.length === 0) return;

        ctx.machine.state.revealedCards = exitCandidates.map(({ card, handIndex }) =>
            createPromptOptionCard(
                `BT03_041_HAND_OPTION_${handIndex}_${card.id}`,
                card.name,
                card.text || `${card.name}를 트래시`,
                card.imageUrl,
            )
        ) as any;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT03_041_SELECT_EXIT_HAND_CARD',
            actionValue: {
                options: exitCandidates.map(({ handIndex }) => ({ handIndex })),
                powerBuffValue: Math.max(0, (params as any).powerBuffValue ?? 2500),
            },
            effectDescription: '트래시할 [엑시트] 카드 1장을 선택한다.',
            validTargets: 'REVEALED',
            targetSchema: {
                scope: 'REVEALED',
                type: 'CARD',
                count: 1,
                selectMode: 'MANUAL',
            },
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, null);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'BT03_045_TRASH_AND_GRANT_EXIT_RETURN') {
        const selectedZone = (_targets || [])[0] as UnitZoneState | undefined;
        if (!selectedZone?.unit) return;
        const owner = getOwnerOfZone(ctx.machine, selectedZone);
        if (!owner || owner.id !== ctx.player.id) return;

        ctx.machine.destroyUnit(owner, selectedZone, undefined, 'EFFECT');

        const remainingFriendlyUnits = ctx.player.unitZones.filter((zone: any) => zone?.unit);
        if (remainingFriendlyUnits.length <= 0) return;

        grantEffect(ctx, {
            effect: {
                activation: ActivationCondition.EXIT,
                description: '엑시트 : 귀환',
                action: { type: 'RETURN_FROM_TRASH_AT_TURN_END', params: {} },
                duration: (params as any).duration || 'TURN_END',
            },
            duration: (params as any).duration || 'TURN_END',
        }, remainingFriendlyUnits);
        return;
    }

    if ((params as any).mode === 'BT03_049_BUFF_OTHERS_BY_SELECTED_POWER_THEN_TRASH') {
        const selectedZone = (_targets || [])[0] as UnitZoneState | undefined;
        if (!selectedZone?.unit) return;
        const owner = getOwnerOfZone(ctx.machine, selectedZone);
        if (!owner || owner.id !== ctx.player.id) return;

        const selectedPower = Math.max(0, ctx.machine.getUnitPower(selectedZone, ctx.player));
        const duration = (params as any).duration || 'TURN_END';

        ctx.player.unitZones.forEach((zone: any) => {
            if (!zone?.unit || zone === selectedZone) return;
            zone.buffs.push({
                id: ctx.machine.createRuntimeId('BUFF'),
                sourceCard: ctx.sourceCard,
                type: 'POWER',
                value: selectedPower,
                duration,
            });
        });

        ctx.machine.destroyUnit(ctx.player, selectedZone, undefined, 'EFFECT');
        return;
    }

    if ((params as any).mode === 'BT03_051_PROMPT_SELECT_TARGET_EXIT_EFFECT') {
        const targetZone = (_targets || [])[0] as UnitZoneState | undefined;
        if (!targetZone?.unit || !ctx.unitZone?.unit) return;

        const exitEffects: any[] = [];
        (targetZone.unit.effects || []).forEach((effect: any) => {
            if (effect?.activation === ActivationCondition.EXIT) exitEffects.push(effect);
        });
        (targetZone.temporaryEffects || []).forEach((effect: any) => {
            if (effect?.activation === ActivationCondition.EXIT) exitEffects.push(effect);
        });

        if (exitEffects.length <= 0) return;

        if (exitEffects.length === 1) {
            const selected = exitEffects[0];
            const actionDurationOverride =
                selected.actionDurationOverride !== undefined
                    ? selected.actionDurationOverride
                    : (selected.duration && selected.duration !== 'TURN_END' ? selected.duration : undefined);
            ctx.unitZone.temporaryEffects.push({
                ...selected,
                duration: (params as any).duration || 'OPP_TURN_END',
                actionDurationOverride,
            });
            return;
        }

        const owner = getOwnerOfZone(ctx.machine, ctx.unitZone);
        if (!owner || owner.id !== ctx.player.id) return;
        const sourceZoneIndex = ctx.player.unitZones.indexOf(ctx.unitZone);
        if (sourceZoneIndex < 0) return;

        ctx.machine.state.revealedCards = exitEffects.map((effect: any, effectIndex: number) =>
            createPromptOptionCard(
                `BT03_051_EXIT_EFFECT_OPTION_${effectIndex}`,
                `엑시트 효과 ${effectIndex + 1}`,
                effect.description || '획득할 [엑시트] 효과 선택'
            )
        ) as any;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT03_051_SELECT_EXIT_EFFECT_TO_GAIN',
            actionValue: {
                sourceZoneIndex,
                options: exitEffects.map((effect: any) => ({ effect })),
                duration: (params as any).duration || 'OPP_TURN_END',
            },
            effectDescription: '획득할 [엑시트] 효과를 선택한다.',
            validTargets: 'REVEALED',
            targetSchema: {
                scope: 'REVEALED',
                type: 'CARD',
                count: 1,
                selectMode: 'MANUAL',
            },
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, null);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'BT03_052_PROMPT_TRASH_COST3_SKILL_THEN_ENTRY_EFFECT') {
        const skills = ctx.player.skillZone
            .map((card, skillZoneIndex) => ({ card, skillZoneIndex }))
            .filter(({ card }) => card?.type === CardType.SKILL && getCardCost(ctx.machine, card) === 3);
        if (skills.length === 0) return;

        ctx.machine.state.revealedCards = skills.map(({ card, skillZoneIndex }) =>
            createPromptOptionCard(
                `BT03_052_SKILL_OPTION_${skillZoneIndex}_${card.id}`,
                card.name,
                card.text || `${card.name}를 트래시`,
                card.imageUrl
            )
        ) as any;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT03_052_SELECT_SKILL_ZONE_COST3_TO_TRASH',
            actionValue: {
                options: skills.map(({ skillZoneIndex }) => ({ skillZoneIndex })),
                followUpSubActions: [
                    {
                        type: 'COMPLEX_ACTION',
                        description: 'BT03-052 follow-up: entry effect selection',
                        targets: {
                            scope: 'MY_FIELD',
                            type: 'UNIT',
                            count: 1,
                            filters: [{ type: 'HAS_KEYWORD', value: '엔트리' }],
                            selectMode: 'MANUAL',
                        },
                        params: { mode: 'PROMPT_SELECT_ENTRY_EFFECT' },
                    },
                ],
            },
            effectDescription: '트래시할 3코스트 스킬을 선택한다.',
            validTargets: 'REVEALED',
            targetSchema: {
                scope: 'REVEALED',
                type: 'CARD',
                count: 1,
                selectMode: 'MANUAL',
            },
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, null);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'BT03_054_ENTRY_TRASH_TOP_SKILL_OR_DRAW') {
        if (ctx.player.deck.length <= 0) return;
        const trashedTopCard = ctx.player.deck.pop();
        if (!trashedTopCard) return;
        ctx.player.trash.push(trashedTopCard);

        if (trashedTopCard.type === CardType.SKILL) {
            // Show the exact trashed skill card so player can choose cast or skip.
            ctx.machine.state.revealedCards = [trashedTopCard] as any;
            ctx.machine.state.interactionMode = 'SELECT_TARGET';
            ctx.machine.state.pendingEffect = {
                sourceCard: ctx.sourceCard,
                sourcePlayerId: ctx.player.id,
                controllerPlayerId: ctx.player.id,
                actionType: 'BT06_SELECT_TRASHED_SKILL_TO_CAST',
                actionValue: {
                    allowPartialSelection: true,
                },
                effectDescription: '트래시한 스킬 카드 효과를 발동할지 선택한다.',
                validTargets: 'REVEALED',
                targetSchema: {
                    scope: 'REVEALED',
                    type: 'CARD',
                    count: 1,
                    selectMode: 'MANUAL',
                },
                selectedTargets: [],
            };
            ctx.machine.setPendingRuntime(ctx, null);
            ctx.machine.setInteractionOwner(ctx.player.id);
            return;
        }

        drawCard(ctx, {
            count: 1,
            __sourceActivation: (params as any).__sourceActivation,
        }, _targets);
        drawCard(ctx, {
            count: 1,
            target: 'OPPONENT',
            __sourceActivation: (params as any).__sourceActivation,
        }, _targets);
        return;
    }

    if ((params as any).mode === 'BT03_057_PROMPT_DISCARD_AND_OPP_MATCH_OR_DAMAGE') {
        drawCard(ctx, { count: 1, target: 'OPPONENT', __sourceActivation: (params as any).__sourceActivation }, _targets);

        const payableUnits = ctx.player.hand.filter(card => card.type === CardType.UNIT);
        if (payableUnits.length <= 0) return;

        const handSelectionSchema = {
            scope: 'MY_HAND',
            type: 'CARD',
            count: 1,
            filters: [{ type: 'UNIT_TYPE', value: CardType.UNIT }],
            selectMode: 'MANUAL',
        } as const;

        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT03_057_SELECT_MY_UNIT_TO_DISCARD',
            actionValue: { allowPartialSelection: false },
            effectDescription: '트래시할 자신의 유닛 카드 1장을 선택한다.',
            validTargets: 'MY_HAND',
            targetSchema: handSelectionSchema,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: 'ACTIVE' as any,
            description: 'BT03-057 discard self unit and resolve opponent response',
            targets: handSelectionSchema as any,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT03_057_RESOLVE_OPP_MATCH_OR_DAMAGE',
                    stage: 'SELF_DISCARD',
                },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'BT03_057_RESOLVE_OPP_MATCH_OR_DAMAGE') {
        const stage = (params as any).stage || 'SELF_DISCARD';
        if (stage === 'FINALIZE_OPP_DECISION') {
            const discardedCost = Number(ctx.flags?.BT03_057_DISCARDED_COST ?? -1);
            const discardedHit = Math.max(0, Number(ctx.flags?.BT03_057_DISCARDED_HIT ?? 0));
            const selectedMatch = (_targets || []).find((card: any) =>
                ctx.opponent.hand.includes(card) && getCardCost(ctx.machine, card) === discardedCost
            );

            if (selectedMatch) {
                const handIndex = ctx.opponent.hand.indexOf(selectedMatch);
                if (handIndex !== -1) {
                    const [removed] = ctx.opponent.hand.splice(handIndex, 1);
                    if (removed) {
                        ctx.opponent.trash.push(removed);
                        ctx.machine.notifyHandTrashed(ctx.opponent, [removed], {
                            flags: { handTrashByEffect: true },
                        });
                    }
                }
                return;
            }

            if (discardedHit > 0) {
                ctx.machine.dealDamage(ctx.opponent, discardedHit);
            }
            return;
        }

        const selectedUnit = (_targets || []).find((card: any) => ctx.player.hand.includes(card) && card.type === CardType.UNIT);
        if (!selectedUnit) return;

        const handIndex = ctx.player.hand.indexOf(selectedUnit);
        if (handIndex === -1) return;
        const [discardedUnit] = ctx.player.hand.splice(handIndex, 1);
        if (!discardedUnit) return;
        ctx.player.trash.push(discardedUnit);
        ctx.machine.notifyHandTrashed(ctx.player, [discardedUnit], {
            flags: { handTrashByEffect: true },
        });

        const discardedCost = getCardCost(ctx.machine, discardedUnit);
        const discardedHit = Math.max(0, discardedUnit.hit || 0);
        ctx.flags = ctx.flags || {};
        ctx.flags.BT03_057_DISCARDED_COST = discardedCost;
        ctx.flags.BT03_057_DISCARDED_HIT = discardedHit;

        const matchCandidates = ctx.opponent.hand.filter(card => getCardCost(ctx.machine, card) === discardedCost);
        if (matchCandidates.length <= 0) {
            if (discardedHit > 0) {
                ctx.machine.dealDamage(ctx.opponent, discardedHit);
            }
            return;
        }

        const oppHandSchema = {
            scope: 'OPP_HAND',
            type: 'CARD',
            count: 1,
            filters: [{ type: 'COST_EQUAL', value: discardedCost }],
            selectMode: 'ALL',
        } as const;

        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.opponent.id,
            actionType: 'BT03_057_OPP_SELECT_MATCH_OR_SKIP',
            actionValue: {
                allowPartialSelection: true,
                discardedCost,
                discardedHit,
            },
            effectDescription: '상대는 같은 코스트 카드 1장을 선택해 트래시할 수 있다.',
            validTargets: 'OPP_HAND',
            targetSchema: oppHandSchema,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: 'ACTIVE' as any,
            description: 'BT03-057 finalize opponent match discard or damage',
            targets: oppHandSchema as any,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT03_057_RESOLVE_OPP_MATCH_OR_DAMAGE',
                    stage: 'FINALIZE_OPP_DECISION',
                },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.opponent.id);
        return;
    }

    if ((params as any).mode === 'BT03_059_LOCK_OPP_HIGH_COST_UNIT_PLAY_GLOBAL') {
        const minCost = Math.max(0, Number((params as any).costMin ?? 5));
        const untilTurnCount = ctx.machine.state.turnCount + Math.max(0, (params as any).untilTurnCountOffset ?? 1);
        ctx.player.unitZones.forEach((zone: any) => {
            zone.temporaryEffects.push({
                activation: ActivationCondition.PASSIVE,
                description: `패시브 : 상대는 코스트 ${minCost} 이상 유닛을 배치할 수 없다.`,
                action: {
                    type: 'NONE',
                    params: {
                        preventOpponentPlayUnitCostMin: minCost,
                        untilTurnCount,
                    },
                },
                duration: 'PERMANENT',
            } as any);
        });
        return;
    }

    if ((params as any).mode === 'BT03_060_ENTRY_LOCK_SELF_AND_DAMAGE_BY_OPP_HAND_DIFF') {
        if (!ctx.unitZone?.unit) return;
        ctx.unitZone.temporaryEffects.push({
            activation: ActivationCondition.PASSIVE,
            description: '패시브 : 이 유닛은 이 턴이 끝날 때까지 공격할 수 없다.',
            action: { type: 'NONE', params: { cannotAttack: true } },
            duration: 'TURN_END',
        } as any);

        const threshold = Math.max(0, Number((params as any).handThreshold ?? 5));
        const damageValue = Math.max(0, ctx.opponent.hand.length - threshold);
        if (damageValue > 0) {
            ctx.machine.dealDamage(ctx.opponent, damageValue);
        }
        return;
    }

    if ((params as any).mode === 'BT03_062_PROMPT_SKILL_ZONE_CAST') {
        const skills = ctx.player.skillZone
            .map((card, skillZoneIndex) => ({ card, skillZoneIndex }))
            .filter(({ card }) => card?.type === CardType.SKILL);
        if (skills.length === 0) return;

        ctx.machine.state.revealedCards = skills.map(({ card, skillZoneIndex }) =>
            createPromptOptionCard(
                `BT03_062_SKILL_OPTION_${skillZoneIndex}_${card.id}`,
                card.name,
                card.text || `${card.name} 효과 발동`,
                card.imageUrl
            )
        ) as any;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT03_062_SELECT_SKILL_ZONE_TO_CAST',
            actionValue: {
                options: skills.map(({ skillZoneIndex }) => ({ skillZoneIndex })),
            },
            effectDescription: '효과를 발동할 스킬을 선택한다.',
            validTargets: 'REVEALED',
            targetSchema: {
                scope: 'REVEALED',
                type: 'CARD',
                count: 1,
                selectMode: 'MANUAL',
            },
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, null);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'BT03_064_PROMPT_DISCARD_BY_SELECTED_HIT_THEN_RETURN_ENCOUNTER') {
        const stage = (params as any).stage;
        if (stage === 'PROMPT_DISCARD') {
            const requiredCount = Math.max(0, Number(ctx.flags?.BT03_064_REQUIRED_DISCARD_COUNT ?? 0));
            if (requiredCount <= 0) return;
            if (ctx.player.hand.length < requiredCount) return;

            const handSelectionSchema = {
                scope: 'MY_HAND',
                type: 'CARD',
                count: requiredCount,
                selectMode: 'MANUAL',
            } as const;
            ctx.machine.state.interactionMode = 'SELECT_TARGET';
            ctx.machine.state.pendingEffect = {
                sourceCard: ctx.sourceCard,
                sourcePlayerId: ctx.player.id,
                controllerPlayerId: ctx.player.id,
                actionType: 'BT03_064_SELECT_HAND_FOR_HIT_COST',
                actionValue: { allowPartialSelection: false, requiredCount },
                effectDescription: `패 ${requiredCount}장을 선택해 트래시한다.`,
                validTargets: 'MY_HAND',
                targetSchema: handSelectionSchema,
                selectedTargets: [],
            };
            ctx.machine.setPendingRuntime(ctx, {
                activation: 'ACTIVE' as any,
                description: 'BT03-064 resolve hand discard and return encounter',
                targets: handSelectionSchema as any,
                action: {
                    type: 'COMPLEX_ACTION',
                    params: {
                        mode: 'BT03_064_RESOLVE_DISCARD_AND_RETURN_ENCOUNTER',
                    },
                },
            } as any);
            ctx.machine.setInteractionOwner(ctx.player.id);
            return;
        }

        const selectedZone = (_targets || [])[0] as UnitZoneState | undefined;
        if (!selectedZone?.unit) return;
        const owner = getOwnerOfZone(ctx.machine, selectedZone);
        if (!owner || owner.id !== ctx.player.id) return;
        const laneIndex = ctx.player.unitZones.indexOf(selectedZone);
        if (laneIndex < 0) return;

        const requiredCount = Math.max(0, ctx.machine.getUnitHit(selectedZone, ctx.player));
        if (requiredCount <= 0) return;

        ctx.flags = ctx.flags || {};
        ctx.flags.BT03_064_REQUIRED_DISCARD_COUNT = requiredCount;
        ctx.flags.BT03_064_TARGET_LANE_INDEX = laneIndex;

        const optionalEffect = {
            activation: ActivationCondition.ACTIVE,
            description: `BT03-064 : 패 ${requiredCount}장을 트래시할 수 있다.`,
            optional: true,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT03_064_PROMPT_DISCARD_BY_SELECTED_HIT_THEN_RETURN_ENCOUNTER',
                    stage: 'PROMPT_DISCARD',
                },
            },
        } as any;
        ctx.machine.effectManager.processEffect(optionalEffect, ctx as any);
        return;
    }

    if ((params as any).mode === 'BT03_064_RESOLVE_DISCARD_AND_RETURN_ENCOUNTER') {
        const requiredCount = Math.max(0, Number(ctx.flags?.BT03_064_REQUIRED_DISCARD_COUNT ?? 0));
        const selectedCards = (_targets || []).filter(card => ctx.player.hand.includes(card));
        if (requiredCount <= 0 || selectedCards.length !== requiredCount) return;

        const trashedCards: any[] = [];
        selectedCards.forEach((card: any) => {
            const handIndex = ctx.player.hand.indexOf(card);
            if (handIndex === -1) return;
            const [removed] = ctx.player.hand.splice(handIndex, 1);
            if (!removed) return;
            ctx.player.trash.push(removed);
            trashedCards.push(removed);
        });
        if (trashedCards.length > 0) {
            ctx.machine.notifyHandTrashed(ctx.player, trashedCards, {
                flags: { handTrashByEffect: true },
            });
        }

        const laneIndex = Number(ctx.flags?.BT03_064_TARGET_LANE_INDEX ?? -1);
        if (laneIndex < 0 || laneIndex >= ctx.opponent.unitZones.length) return;
        const encounterZone = ctx.opponent.unitZones[laneIndex];
        if (!encounterZone?.unit) return;
        returnUnitAndItemsToHand(ctx, {}, [encounterZone]);
        return;
    }

    if ((params as any).mode === 'BT03_065_DRAW_BY_ENTRY_COUNT_AND_LOCK_OPP_ENTRY') {
        const entryUnitCount = ctx.player.unitZones.filter((zone: any) => zone?.unit && zoneHasKeywordLike(zone, '엔트리')).length;
        if (entryUnitCount > 0) {
            drawCard(ctx, {
                count: entryUnitCount,
                __sourceActivation: (params as any).__sourceActivation,
            }, _targets);
        }

        const untilTurnCount = ctx.machine.state.turnCount + Math.max(0, (params as any).untilTurnCountOffset ?? 1);
        const lockUntilMap = (ctx.opponent.lockedActivationsUntilTurnCount || {}) as Record<string, number>;
        const current = lockUntilMap[String(ActivationCondition.ENTRY)] ?? 0;
        lockUntilMap[String(ActivationCondition.ENTRY)] = Math.max(current, untilTurnCount);
        ctx.opponent.lockedActivationsUntilTurnCount = lockUntilMap as any;
        return;
    }

    if ((params as any).mode === 'BT03_066_PROMPT_DISCARD_TO_SIX_THEN_DAMAGE') {
        const discardCount = Math.max(0, ctx.player.hand.length - 6);
        if (discardCount <= 0) return;

        ctx.flags = ctx.flags || {};
        ctx.flags.BT03_066_REQUIRED_DISCARD_COUNT = discardCount;

        const handSelectionSchema = {
            scope: 'MY_HAND',
            type: 'CARD',
            count: discardCount,
            selectMode: 'MANUAL',
        } as const;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT03_066_SELECT_HAND_TO_DISCARD_TO_SIX',
            actionValue: { allowPartialSelection: false, requiredCount: discardCount },
            effectDescription: `패가 6장이 되도록 ${discardCount}장을 선택해 트래시한다.`,
            validTargets: 'MY_HAND',
            targetSchema: handSelectionSchema,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: 'ACTIVE' as any,
            description: 'BT03-066 resolve discard and damage',
            targets: handSelectionSchema as any,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT03_066_RESOLVE_DISCARD_AND_DAMAGE',
                },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'BT03_066_RESOLVE_DISCARD_AND_DAMAGE') {
        const requiredCount = Math.max(0, Number(ctx.flags?.BT03_066_REQUIRED_DISCARD_COUNT ?? 0));
        const selectedCards = (_targets || []).filter(card => ctx.player.hand.includes(card));
        if (requiredCount <= 0 || selectedCards.length !== requiredCount) return;

        const trashedCards: any[] = [];
        selectedCards.forEach((card: any) => {
            const handIndex = ctx.player.hand.indexOf(card);
            if (handIndex === -1) return;
            const [removed] = ctx.player.hand.splice(handIndex, 1);
            if (!removed) return;
            ctx.player.trash.push(removed);
            trashedCards.push(removed);
        });
        if (trashedCards.length > 0) {
            ctx.machine.notifyHandTrashed(ctx.player, trashedCards, {
                flags: { handTrashByEffect: true },
            });
            ctx.machine.dealDamage(ctx.opponent, trashedCards.length);
        }
        return;
    }

    if ((params as any).mode === 'BT03_067_PROMPT_REVIVE_TRASHED_EQUIPPED_UNIT') {
        const trashedEquippedUnit = ctx.trashedUnit;
        if (!trashedEquippedUnit || trashedEquippedUnit.type !== CardType.UNIT) return;

        const reviveCandidate = ctx.player.trash.includes(trashedEquippedUnit)
            ? trashedEquippedUnit
            : ctx.player.trash.find((card: any) => card?.id === trashedEquippedUnit.id && card.type === CardType.UNIT);
        if (!reviveCandidate) return;

        const emptyZoneExists = ctx.player.unitZones.some((zone: any) => !zone?.unit);
        if (!emptyZoneExists) return;

        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT03_067_SELECT_EMPTY_ZONE_TO_REVIVE_EQUIPPED_UNIT',
            actionValue: {
                reviveCardId: reviveCandidate.id,
                reviveCardRef: reviveCandidate,
            },
            effectDescription: '부활시킬 빈 유닛 존을 선택한다.',
            validTargets: 'MY_UNITS',
            targetSchema: {
                scope: 'MY_FIELD',
                type: 'ALL',
                count: 1,
                selectMode: 'MANUAL',
            },
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, null);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'BT03_069_TRASH_TOP3_DRAW_IF_ITEM') {
        if (ctx.player.deck.length <= 0) return;
        const trashCount = Math.min(3, ctx.player.deck.length);
        let trashedItemCount = 0;
        for (let i = 0; i < trashCount; i++) {
            const card = ctx.player.deck.pop();
            if (!card) break;
            ctx.player.trash.push(card);
            if (card.type === CardType.ITEM) trashedItemCount++;
        }
        if (trashedItemCount > 0) {
            drawCard(ctx, { count: 1, __sourceActivation: (params as any).__sourceActivation }, _targets);
        }
        return;
    }

    if ((params as any).mode === 'BT03_073_ACTIVE_TRASH_BY_EQUIPPED_COUNT_AND_BUFF_HIT') {
        if (!ctx.unitZone?.unit) return;
        const equippedCount = ctx.unitZone.items.length;
        const trashCount = Math.max(0, equippedCount * 3);
        if (trashCount <= 0) return;

        let trashedItemCount = 0;
        for (let i = 0; i < trashCount; i++) {
            if (ctx.player.deck.length <= 0) break;
            const card = ctx.player.deck.pop();
            if (!card) break;
            ctx.player.trash.push(card);
            if (card.type === CardType.ITEM) trashedItemCount++;
        }

        if (trashedItemCount > 0) {
            buffHit(ctx, { value: trashedItemCount, duration: 'TURN_END' }, [ctx.unitZone]);
        }
        return;
    }

    if ((params as any).mode === 'BT03_075_ENTRY_TRASH_ITEMS_TO_BOTTOM_THEN_DESTROY_ENCOUNTER') {
        const stage = (params as any).stage;
        if (stage === 'RESOLVE') {
            const selectedItems = (_targets || []).filter((card: any) => ctx.player.trash.includes(card) && card.type === CardType.ITEM);
            const movedItems: any[] = [];
            selectedItems.forEach((card: any) => {
                const trashIndex = ctx.player.trash.indexOf(card);
                if (trashIndex === -1) return;
                const [removed] = ctx.player.trash.splice(trashIndex, 1);
                if (removed) movedItems.push(removed);
            });
            if (movedItems.length > 0) {
                ctx.player.deck.unshift(...movedItems);
            }

            const totalCost = movedItems.reduce((sum: number, card: any) => sum + getCardCost(ctx.machine, card), 0);
            if (!ctx.unitZone?.unit) return;
            const laneIndex = ctx.player.unitZones.indexOf(ctx.unitZone);
            if (laneIndex < 0) return;
            const encounterZone = ctx.opponent.unitZones[laneIndex];
            const encounterUnit = encounterZone?.unit;
            if (!encounterUnit) return;
            if (totalCost >= getCardCost(ctx.machine, encounterUnit)) {
                ctx.machine.destroyUnit(ctx.opponent, encounterZone, undefined, 'EFFECT');
            }
            return;
        }

        const itemCandidates = ctx.player.trash.filter((card: any) => card.type === CardType.ITEM);
        if (itemCandidates.length <= 0) return;

        const selectionSchema = {
            scope: 'MY_TRASH',
            type: 'CARD',
            count: Math.min(3, itemCandidates.length),
            filters: [{ type: 'UNIT_TYPE', value: CardType.ITEM }],
            selectMode: 'MANUAL',
        } as const;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT03_075_SELECT_TRASH_ITEMS_TO_BOTTOM',
            actionValue: { allowPartialSelection: true },
            effectDescription: '덱 맨 아래에 놓을 아이템을 최대 3장까지 선택한다.',
            validTargets: 'MY_TRASH',
            targetSchema: selectionSchema,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: 'ACTIVE' as any,
            description: 'BT03-075 resolve trash items and compare encounter cost',
            targets: selectionSchema as any,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT03_075_ENTRY_TRASH_ITEMS_TO_BOTTOM_THEN_DESTROY_ENCOUNTER',
                    stage: 'RESOLVE',
                },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'BT03_076_EXIT_SWAP_DAMAGE_WITH_SELF') {
        const stage = (params as any).stage;
        if (stage === 'RESOLVE') {
            const selected = (_targets || []).find((card: any) => ctx.player.damage.includes(card) && card.type === CardType.UNIT);
            if (!selected) return;

            const damageIndex = ctx.player.damage.indexOf(selected);
            if (damageIndex === -1) return;
            const [movedToHand] = ctx.player.damage.splice(damageIndex, 1);
            if (movedToHand) ctx.player.hand.push(movedToHand);

            const sourceIndexByRef = ctx.player.trash.indexOf(ctx.sourceCard);
            const sourceIndexById = sourceIndexByRef !== -1
                ? sourceIndexByRef
                : ctx.player.trash.findIndex((card: any) => card?.id === ctx.sourceCard.id);
            if (sourceIndexById !== -1) {
                const [selfCard] = ctx.player.trash.splice(sourceIndexById, 1);
                if (selfCard) {
                    ctx.player.damage.push(selfCard);
                    if (typeof ctx.machine.recordDamagePlacedByEffect === 'function') {
                        ctx.machine.recordDamagePlacedByEffect(ctx.player.id, 'TRASH', 1);
                    }
                }
            }
            return;
        }

        const damageCandidates = ctx.player.damage.filter((card: any) =>
            card.type === CardType.UNIT && !String(card.id || '').startsWith('BT03-076')
        );
        if (damageCandidates.length <= 0) return;

        const selectionSchema = {
            scope: 'MY_DAMAGE',
            type: 'CARD',
            count: 1,
            filters: [
                { type: 'UNIT_TYPE', value: CardType.UNIT },
                { type: 'EXCLUDE_CARD_ID', value: 'BT03-076' },
            ],
            selectMode: 'MANUAL',
        } as const;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT03_076_SELECT_DAMAGE_UNIT_TO_HAND',
            actionValue: {},
            effectDescription: '대미지 존에서 패로 가져올 유닛을 선택한다.',
            validTargets: 'MY_DAMAGE',
            targetSchema: selectionSchema,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: 'ACTIVE' as any,
            description: 'BT03-076 resolve damage swap',
            targets: selectionSchema as any,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT03_076_EXIT_SWAP_DAMAGE_WITH_SELF',
                    stage: 'RESOLVE',
                },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'BT03_077_ACTIVE_EQUIP_UP_TO_TWO_FROM_TRASH_AND_SET_ZERO_COST') {
        const stage = (params as any).stage;
        if (stage === 'RESOLVE') {
            if (!ctx.unitZone?.unit) return;
            const unitZone = ctx.unitZone;
            const selectedItems = (_targets || [])
                .filter((card: any) => ctx.player.trash.includes(card) && card.type === CardType.ITEM)
                .slice(0, 2);
            if (selectedItems.length <= 0) return;

            const equippedItems: any[] = [];
            const equippedItemNames = new Set(
                (unitZone.items || [])
                    .map((item: any) => item?.name)
                    .filter((name: any) => typeof name === 'string' && name.length > 0)
            );
            selectedItems.forEach((card: any) => {
                const cardName = typeof card?.name === 'string' ? card.name : '';
                if (cardName && equippedItemNames.has(cardName)) return;
                const trashIndex = ctx.player.trash.indexOf(card);
                if (trashIndex === -1) return;
                const [removed] = ctx.player.trash.splice(trashIndex, 1);
                if (removed) {
                    unitZone.items.push(removed);
                    equippedItems.push(removed);
                    if (removed.name) equippedItemNames.add(removed.name);
                }
            });
            if (equippedItems.length <= 0) return;

            unitZone.items.forEach((item: any) => {
                item.turnCostOverride = {
                    cost: 0,
                    turnCount: ctx.machine.state.turnCount,
                };
            });

            ctx.machine.notifyItemsEquipped(ctx.player, unitZone, equippedItems, {
                sourceActivation: (params as any).__sourceActivation,
                sourcePlayerId: ctx.player.id,
                sourceCardId: ctx.sourceCard.id,
            });

            // Rule 8.6.2: after effect processing finishes, items that do not satisfy equip
            // conditions are trashed as rule handling (not as effect trash).
            const invalidEquippedItems = [...unitZone.items].filter((item: any) =>
                !RuleValidator.validateItemEquipConditions(ctx.machine, ctx.player, unitZone, item).valid
            );
            invalidEquippedItems.forEach((item: any) => {
                const index = unitZone.items.indexOf(item);
                if (index === -1) return;
                const [removed] = unitZone.items.splice(index, 1);
                if (removed) {
                    ctx.player.trash.push(removed);
                }
            });
            return;
        }

        if (!ctx.unitZone?.unit) return;
        const itemCandidates = ctx.player.trash.filter((card: any) => card.type === CardType.ITEM);
        if (itemCandidates.length <= 0) return;

        ctx.machine.state.revealedCards = itemCandidates;
        const selectionSchema = {
            scope: 'REVEALED',
            type: 'CARD',
            count: Math.min(2, itemCandidates.length),
            filters: [{ type: 'UNIT_TYPE', value: CardType.ITEM }],
            selectMode: 'MANUAL',
        } as const;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT03_077_SELECT_TRASH_ITEMS_TO_EQUIP',
            actionValue: { allowPartialSelection: true },
            effectDescription: '장착할 트래시 아이템을 최대 2장까지 선택한다.',
            validTargets: 'REVEALED',
            targetSchema: selectionSchema,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: 'ACTIVE' as any,
            description: 'BT03-077 resolve equip from trash',
            targets: selectionSchema as any,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT03_077_ACTIVE_EQUIP_UP_TO_TWO_FROM_TRASH_AND_SET_ZERO_COST',
                    stage: 'RESOLVE',
                },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'BT03_079_ENTRY_PAY_8_ITEMS_THEN_DESTROY_AND_DRAW') {
        const stage = (params as any).stage;
        if (stage === 'RESOLVE_DESTROY_AND_DRAW') {
            const totalCostLimit = Math.max(0, Number((params as any).totalCostLimit ?? 8));
            let usedCost = 0;
            let destroyedCount = 0;

            (_targets || []).forEach((targetZone: any) => {
                if (!targetZone?.unit) return;
                const owner = getOwnerOfZone(ctx.machine, targetZone);
                if (!owner || owner.id !== ctx.opponent.id) return;
                const unitCost = getCardCost(ctx.machine, targetZone.unit);
                if (usedCost + unitCost > totalCostLimit) return;
                usedCost += unitCost;
                const unitBefore = targetZone.unit;
                ctx.machine.destroyUnit(owner, targetZone, undefined, 'EFFECT');
                if (unitBefore && targetZone.unit !== unitBefore) {
                    destroyedCount += 1;
                }
            });

            if (destroyedCount > 0) {
                drawCard(ctx, { count: destroyedCount, __sourceActivation: (params as any).__sourceActivation }, _targets);
            }
            return;
        }

        const handItems = ctx.player.hand.filter((card: any) => card.type === CardType.ITEM);
        const trashItems = ctx.player.trash.filter((card: any) => card.type === CardType.ITEM);
        const allCandidates = [...handItems, ...trashItems];
        if (allCandidates.length < 8) return;

        ctx.machine.state.revealedCards = allCandidates;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT03_079_SELECT_8_ITEMS_FROM_HAND_TRASH',
            actionValue: { allowPartialSelection: false },
            effectDescription: '손패/트래시의 아이템을 정확히 8장 선택한다.',
            validTargets: 'REVEALED',
            targetSchema: {
                scope: 'REVEALED',
                type: 'CARD',
                count: 8,
                filters: [{ type: 'UNIT_TYPE', value: CardType.ITEM }],
                selectMode: 'MANUAL',
            },
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, null);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'BT03_081_TRASH_TOP5_THEN_RECOVER_UNIT') {
        const stage = (params as any).stage;
        if (stage === 'RESOLVE') {
            const selectedUnit = (_targets || []).find((card: any) => ctx.player.trash.includes(card) && card.type === CardType.UNIT);
            if (!selectedUnit) return;
            const trashIndex = ctx.player.trash.indexOf(selectedUnit);
            if (trashIndex === -1) return;
            const [moved] = ctx.player.trash.splice(trashIndex, 1);
            if (moved) ctx.player.hand.push(moved);
            return;
        }

        const trashCount = Math.min(5, ctx.player.deck.length);
        for (let i = 0; i < trashCount; i++) {
            const card = ctx.player.deck.pop();
            if (!card) break;
            ctx.player.trash.push(card);
        }

        const unitCandidates = ctx.player.trash.filter((card: any) => card.type === CardType.UNIT);
        if (unitCandidates.length <= 0) return;
        const selectionSchema = {
            scope: 'MY_TRASH',
            type: 'CARD',
            count: 1,
            filters: [{ type: 'UNIT_TYPE', value: CardType.UNIT }],
            selectMode: 'MANUAL',
        } as const;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT03_081_SELECT_UNIT_FROM_TRASH_TO_HAND',
            actionValue: {},
            effectDescription: '패에 넣을 트래시 유닛을 선택한다.',
            validTargets: 'MY_TRASH',
            targetSchema: selectionSchema,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: 'ACTIVE' as any,
            description: 'BT03-081 resolve recover unit',
            targets: selectionSchema as any,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT03_081_TRASH_TOP5_THEN_RECOVER_UNIT',
                    stage: 'RESOLVE',
                },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'BT03_082_COPY_SELECTED_ITEM_EFFECTS_TO_OTHER_UNITS') {
        const sourceZone = (_targets || [])[0] as UnitZoneState | undefined;
        if (!sourceZone?.unit || !Array.isArray(sourceZone.items) || sourceZone.items.length <= 0) return;
        const sourceZoneIndex = ctx.player.unitZones.indexOf(sourceZone);
        if (sourceZoneIndex < 0) return;

        const options = sourceZone.items.map((item: any, itemIndex: number) => ({ item, itemIndex }));
        ctx.machine.state.revealedCards = options.map(({ item }) => item);
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT03_082_SELECT_EQUIPPED_ITEM_TO_COPY',
            actionValue: {
                sourceZoneIndex,
                options: options.map(({ itemIndex }) => ({ itemIndex })),
            },
            effectDescription: '효과를 복사할 장착 아이템을 선택한다.',
            validTargets: 'REVEALED',
            targetSchema: {
                scope: 'REVEALED',
                type: 'CARD',
                count: 1,
                selectMode: 'MANUAL',
            },
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, null);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'BT03_084_TRASH_TOP3_BUFF_IF_ITEM') {
        const trashCount = Math.min(3, ctx.player.deck.length);
        let trashedItemCount = 0;
        for (let i = 0; i < trashCount; i++) {
            const card = ctx.player.deck.pop();
            if (!card) break;
            ctx.player.trash.push(card);
            if (card.type === CardType.ITEM) trashedItemCount += 1;
        }

        if (trashedItemCount > 0 && ctx.unitZone?.unit) {
            buffPower(ctx, { value: 3000, duration: 'OPP_TURN_END' }, [ctx.unitZone]);
        }
        return;
    }

    if ((params as any).mode === 'BT03_085_SELF_DISCARD_THEN_OPP_DISCARD_OR_DESTROY_ENCOUNTER') {
        const stage = (params as any).stage;
        if (stage === 'SELF_SELECTED') {
            const selectedCard = (_targets || []).find((card: any) => ctx.player.hand.includes(card));
            if (!selectedCard) return;
            const handIndex = ctx.player.hand.indexOf(selectedCard);
            if (handIndex === -1) return;
            const [trashed] = ctx.player.hand.splice(handIndex, 1);
            if (trashed) {
                ctx.player.trash.push(trashed);
                ctx.machine.notifyHandTrashed(ctx.player, [trashed], {
                    flags: { handTrashByEffect: true },
                });
            }

            if (!ctx.unitZone?.unit) return;
            const requiredCount = Math.max(0, ctx.machine.getUnitHit(ctx.unitZone, ctx.player));
            if (requiredCount <= 0) return;

            if (ctx.opponent.hand.length < requiredCount) {
                const laneIndex = ctx.player.unitZones.indexOf(ctx.unitZone);
                if (laneIndex >= 0) {
                    const encounterZone = ctx.opponent.unitZones[laneIndex];
                    if (encounterZone?.unit) {
                        ctx.machine.destroyUnit(ctx.opponent, encounterZone, undefined, 'EFFECT');
                    }
                }
                return;
            }

            const oppHandSchema = {
                scope: 'OPP_HAND',
                type: 'CARD',
                count: requiredCount,
                selectMode: 'MANUAL',
            } as const;
            ctx.machine.state.interactionMode = 'SELECT_TARGET';
            ctx.machine.state.pendingEffect = {
                sourceCard: ctx.sourceCard,
                sourcePlayerId: ctx.player.id,
                controllerPlayerId: ctx.opponent.id,
                actionType: 'BT03_085_OPP_SELECT_HAND_FOR_HIT_OR_SKIP',
                actionValue: {
                    requiredCount,
                    allowPartialSelection: true,
                },
                effectDescription: `상대는 패를 ${requiredCount}장 트래시할 수 있다.`,
                validTargets: 'OPP_HAND',
                targetSchema: oppHandSchema,
                selectedTargets: [],
            };
            ctx.machine.setPendingRuntime(ctx, {
                activation: 'ACTIVE' as any,
                description: 'BT03-085 finalize opponent discard decision',
                targets: oppHandSchema as any,
                action: {
                    type: 'COMPLEX_ACTION',
                    params: {
                        mode: 'BT03_085_SELF_DISCARD_THEN_OPP_DISCARD_OR_DESTROY_ENCOUNTER',
                        stage: 'OPP_FINALIZE',
                        requiredCount,
                    },
                },
            } as any);
            ctx.machine.setInteractionOwner(ctx.opponent.id);
            return;
        }

        if (stage === 'OPP_FINALIZE') {
            const requiredCount = Math.max(0, Number((params as any).requiredCount ?? 0));
            const selectedOppCards = (_targets || []).filter((card: any) => ctx.opponent.hand.includes(card));

            if (requiredCount > 0 && selectedOppCards.length === requiredCount) {
                const trashedCards: any[] = [];
                selectedOppCards.forEach((card: any) => {
                    const handIndex = ctx.opponent.hand.indexOf(card);
                    if (handIndex === -1) return;
                    const [removed] = ctx.opponent.hand.splice(handIndex, 1);
                    if (removed) {
                        ctx.opponent.trash.push(removed);
                        trashedCards.push(removed);
                    }
                });
                if (trashedCards.length > 0) {
                    ctx.machine.notifyHandTrashed(ctx.opponent, trashedCards, {
                        flags: { handTrashByEffect: true },
                    });
                }
                return;
            }

            if (ctx.unitZone?.unit) {
                const laneIndex = ctx.player.unitZones.indexOf(ctx.unitZone);
                if (laneIndex >= 0) {
                    const encounterZone = ctx.opponent.unitZones[laneIndex];
                    if (encounterZone?.unit) {
                        ctx.machine.destroyUnit(ctx.opponent, encounterZone, undefined, 'EFFECT');
                    }
                }
            }
            return;
        }

        if (ctx.player.hand.length <= 0) return;
        const handSchema = {
            scope: 'MY_HAND',
            type: 'CARD',
            count: 1,
            selectMode: 'MANUAL',
        } as const;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT03_085_SELECT_SELF_HAND_TO_DISCARD',
            actionValue: {},
            effectDescription: '트래시할 자신의 패 1장을 선택한다.',
            validTargets: 'MY_HAND',
            targetSchema: handSchema,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: 'ACTIVE' as any,
            description: 'BT03-085 self discard step',
            targets: handSchema as any,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT03_085_SELF_DISCARD_THEN_OPP_DISCARD_OR_DESTROY_ENCOUNTER',
                    stage: 'SELF_SELECTED',
                },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'ST06_011_ATTACKER_OPTIONAL_DISCARD_FOR_TOTAL_POWER_DEBUFF') {
        const stage = (params as any).stage;
        const applyDebuffToStoredTarget = () => {
            const targetPlayerId = String(ctx.flags?.ST06_011_TARGET_PLAYER_ID || '');
            const targetZoneIndex = Number(ctx.flags?.ST06_011_TARGET_ZONE_INDEX ?? -1);
            const targetPlayer = ctx.machine.getPlayerById(targetPlayerId);
            if (!targetPlayer || targetZoneIndex < 0 || targetZoneIndex >= targetPlayer.unitZones.length) return;
            const targetZone = targetPlayer.unitZones[targetZoneIndex];
            if (!targetZone?.unit) return;

            const totalFriendlyPower = ctx.player.unitZones.reduce((sum: number, zone: UnitZoneState) => {
                if (!zone?.unit) return sum;
                return sum + Math.max(0, ctx.machine.getUnitPower(zone, ctx.player));
            }, 0);
            if (totalFriendlyPower <= 0) return;

            targetZone.buffs.push({
                id: ctx.machine.createRuntimeId('BUFF'),
                sourceCard: ctx.sourceCard,
                type: 'POWER',
                value: -totalFriendlyPower,
                duration: (params as any).duration || 'TURN_END',
            });
        };

        if (stage === 'PROMPT_DISCARD') {
            const requiredCount = Math.max(0, Number(ctx.flags?.ST06_011_REQUIRED_DISCARD_COUNT ?? 0));
            if (requiredCount <= 0) {
                applyDebuffToStoredTarget();
                return;
            }
            if (ctx.player.hand.length < requiredCount) return;

            const handSelectionSchema = {
                scope: 'MY_HAND',
                type: 'CARD',
                count: requiredCount,
                selectMode: 'MANUAL',
            } as const;
            ctx.machine.state.interactionMode = 'SELECT_TARGET';
            ctx.machine.state.pendingEffect = {
                sourceCard: ctx.sourceCard,
                sourcePlayerId: ctx.player.id,
                controllerPlayerId: ctx.player.id,
                actionType: 'ST06_011_SELECT_HAND_FOR_HIT_COST',
                actionValue: { allowPartialSelection: false, requiredCount },
                effectDescription: `패 ${requiredCount}장을 선택해 트래시한다.`,
                validTargets: 'MY_HAND',
                targetSchema: handSelectionSchema,
                selectedTargets: [],
            };
            ctx.machine.setPendingRuntime(ctx, {
                activation: ActivationCondition.ATTACKER,
                description: 'ST06-011 resolve optional hit discard and debuff',
                targets: handSelectionSchema as any,
                action: {
                    type: 'COMPLEX_ACTION',
                    params: {
                        mode: 'ST06_011_ATTACKER_OPTIONAL_DISCARD_FOR_TOTAL_POWER_DEBUFF',
                        stage: 'RESOLVE_DISCARD_AND_APPLY',
                    },
                },
                duration: 'TURN_END',
                actionDurationOverride: 'TURN_END',
            } as any);
            ctx.machine.setInteractionOwner(ctx.player.id);
            return;
        }

        if (stage === 'RESOLVE_DISCARD_AND_APPLY') {
            const requiredCount = Math.max(0, Number(ctx.flags?.ST06_011_REQUIRED_DISCARD_COUNT ?? 0));
            const selectedCards = (_targets || []).filter((card: any) => ctx.player.hand.includes(card));
            if (requiredCount > 0 && selectedCards.length !== requiredCount) return;

            const trashedCards: any[] = [];
            selectedCards.forEach((card: any) => {
                const handIndex = ctx.player.hand.indexOf(card);
                if (handIndex === -1) return;
                const [removed] = ctx.player.hand.splice(handIndex, 1);
                if (!removed) return;
                ctx.player.trash.push(removed);
                trashedCards.push(removed);
            });
            if (trashedCards.length > 0) {
                ctx.machine.notifyHandTrashed(ctx.player, trashedCards, {
                    flags: { handTrashByEffect: true },
                });
            }

            applyDebuffToStoredTarget();
            return;
        }

        const targetZone = (_targets || [])[0] as UnitZoneState | undefined;
        if (!targetZone?.unit) return;
        const targetOwner = getOwnerOfZone(ctx.machine, targetZone);
        if (!targetOwner) return;
        const targetZoneIndex = targetOwner.unitZones.indexOf(targetZone);
        if (targetZoneIndex < 0) return;

        const requiredCount = Math.max(0, ctx.machine.getUnitHit(targetZone, targetOwner));
        if (requiredCount > 0 && ctx.player.hand.length < requiredCount) return;

        ctx.flags = ctx.flags || {};
        ctx.flags.ST06_011_TARGET_PLAYER_ID = targetOwner.id;
        ctx.flags.ST06_011_TARGET_ZONE_INDEX = targetZoneIndex;
        ctx.flags.ST06_011_REQUIRED_DISCARD_COUNT = requiredCount;

        if (requiredCount <= 0) {
            applyDebuffToStoredTarget();
            return;
        }

        const optionalEffect = {
            activation: ActivationCondition.ATTACKER,
            description: `패 ${requiredCount}장을 트래시할 수 있다.`,
            optional: true,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'ST06_011_ATTACKER_OPTIONAL_DISCARD_FOR_TOTAL_POWER_DEBUFF',
                    stage: 'PROMPT_DISCARD',
                },
            },
        } as any;
        ctx.machine.effectManager.processEffect(optionalEffect, ctx as any);
        return;
    }

    if ((params as any).mode === 'ST06_012_ACTIVE_MAIN_DISCARD_SKILLS_FOR_ENCOUNTER_DEBUFF') {
        const stage = (params as any).stage;
        if (stage === 'RESOLVE') {
            const selectedSkills = (_targets || [])
                .filter((card: any) => ctx.player.hand.includes(card) && card.type === CardType.SKILL)
                .slice(0, 2);
            if (selectedSkills.length <= 0) return;

            let totalCost = 0;
            const trashedCards: any[] = [];
            selectedSkills.forEach((card: any) => {
                const handIndex = ctx.player.hand.indexOf(card);
                if (handIndex === -1) return;
                const [removed] = ctx.player.hand.splice(handIndex, 1);
                if (!removed) return;
                ctx.player.trash.push(removed);
                trashedCards.push(removed);
                totalCost += getCardCost(ctx.machine, removed);
            });
            if (trashedCards.length > 0) {
                ctx.machine.notifyHandTrashed(ctx.player, trashedCards, {
                    flags: { handTrashByEffect: true },
                });
            }
            if (totalCost <= 0) return;
            if (!ctx.unitZone) return;

            const laneIndex = ctx.player.unitZones.indexOf(ctx.unitZone);
            if (laneIndex < 0) return;
            const encounterZone = ctx.opponent.unitZones[laneIndex];
            if (!encounterZone?.unit) return;

            encounterZone.buffs.push({
                id: ctx.machine.createRuntimeId('BUFF'),
                sourceCard: ctx.sourceCard,
                type: 'POWER',
                value: -1000 * totalCost,
                duration: (params as any).duration || 'TURN_END',
            });
            return;
        }

        const skillCardsInHand = ctx.player.hand.filter((card: any) => card?.type === CardType.SKILL);
        if (skillCardsInHand.length <= 0) return;
        const maxSelectable = Math.min(2, skillCardsInHand.length);
        const handSelectionSchema = {
            scope: 'MY_HAND',
            type: 'CARD',
            count: maxSelectable,
            filters: [{ type: 'UNIT_TYPE', value: CardType.SKILL }],
            selectMode: 'MANUAL',
        } as const;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'ST06_012_SELECT_SKILLS_TO_TRASH',
            actionValue: {
                allowPartialSelection: true,
                minSelection: 0,
                maxSelection: maxSelectable,
            },
            effectDescription: '트래시할 스킬 카드를 최대 2장까지 선택한다.',
            validTargets: 'MY_HAND',
            targetSchema: handSelectionSchema,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: 'ST06-012 resolve skill discard and encounter debuff',
            targets: handSelectionSchema as any,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'ST06_012_ACTIVE_MAIN_DISCARD_SKILLS_FOR_ENCOUNTER_DEBUFF',
                    stage: 'RESOLVE',
                },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'ST06_015_DESTROY_IF_POWER_LEQ_MY_FIELD_SUM') {
        const targetZone = (_targets || [])[0] as UnitZoneState | undefined;
        if (!targetZone?.unit) return;
        const targetOwner = getOwnerOfZone(ctx.machine, targetZone);
        if (!targetOwner) return;

        const myFieldPowerTotal = ctx.player.unitZones.reduce((sum: number, zone: UnitZoneState) => {
            if (!zone?.unit) return sum;
            return sum + Math.max(0, ctx.machine.getUnitPower(zone, ctx.player));
        }, 0);
        const targetPower = ctx.machine.getUnitPower(targetZone, targetOwner);
        if (targetPower <= myFieldPowerTotal) {
            ctx.machine.destroyUnit(targetOwner, targetZone, undefined, 'EFFECT');
        }
        return;
    }

    const subActions = (params as any).subActions;
    if (!Array.isArray(subActions)) return;

    for (const sub of subActions) {
        const impl = ActionRegistry[sub.type];
        if (impl) {
            let subTargets = _targets;
            if (sub.targets) {
                subTargets = TargetSelector.resolve(ctx.machine, sub.targets, ctx);
            }
            impl(ctx, {
                ...(sub.params || {}),
                __sourceActivation: (params as any).__sourceActivation,
            }, subTargets);
        }
    }
};

export const ActionRegistry: Record<string, ActionImplementation> = {
    'GAIN_LEVEL': gainLevel,
    'DRAW': drawCard,
    'BUFF_POWER': buffPower,
    'BUFF_HIT': buffHit,
    'DESTROY_UNIT': destroyUnit,
    'DESTROY_LANE_LOWEST': destroyLaneLowest,
    'RETURN_TO_HAND': returnToHand,
    'TRASH_SELF': trashSelf,
    'PENETRATION': penetration,
    'PLUNDER': plunder,
    'MOVE_FROM_TRASH_TO_HAND': moveFromTrashToHand,
    'MUTUAL_DESTRUCTION': mutualDestruction,
    'TERMINATE_ATTACK': terminateAttack,
    'DISCARD': discard,
    'DISCARD_ALL': discardAll,
    'DESTROY_ENCOUNTER': destroyEncounter,
    'GRANT_EFFECT': grantEffect,
    'SET_POWER': setPower,
    'BUFF_POWER_AND_DRAW_IF_TRASHED': buffPowerAndDrawIfTrashed,
    'REVEAL_TOP_AND_CHOOSE_TO_HAND': revealTopAndChooseToHand,
    'REVEAL_TOP_AND_TAKE_ALL_BY_FILTER': revealTopAndTakeAllByFilter,
    'DRAW_DYNAMIC': drawDynamic,
    'RETURN_UNIT_AND_ITEMS_TO_HAND': returnUnitAndItemsToHand,
    'BREAKTHROUGH': breakthrough,
    'RETURN_FROM_TRASH_AT_TURN_END': returnFromTrashAtTurnEnd,
    'DESTROY_UNIT_AND_DRAW_BY_HIT': destroyUnitAndDrawByHit,
    'DESTROY_UNIT_WITH_HIT_COST': destroyUnitWithHitCost,
    'COMPLEX_ACTION': complexAction,
    'SACRIFICE_TO_BUFF': sacrificeToBuff,
    'DESTROY_ITEM': destroyItem,
    'RETURN_ITEM_TO_HAND': returnItemToHand,
    'MOVE_ITEM_TO_DECK_BOTTOM': moveItemToDeckBottom,
    'MOVE_FROM_DAMAGE_TO_HAND': moveFromDamageToHand,
    'MOVE_FROM_HAND_TO_DAMAGE': moveFromHandToDamage,
    'MOVE_FROM_TRASH_TO_DAMAGE': moveFromTrashToDamage,
    'MOVE_FROM_DAMAGE_TO_TRASH': moveFromDamageToTrash,
    'MOVE_FROM_TRASH_TO_DECK_TOP': moveFromTrashToDeckTop,
    'MOVE_FROM_TRASH_TO_DECK_BOTTOM': moveFromTrashToDeckBottom,
    'DRAW_BY_TARGET_HIT': drawByTargetHit,
    'LOCK_ATTACK_UNTIL_TURN_END': lockAttackUntilTurnEnd,
    'APPLY_DUALIST_MARK': applyDualistMark,
    'APPLY_INFILTRATION_MARK': applyInfiltrationMark,
    'REVEAL_TOP_PICK_TO_HAND_THEN_ORDER_BOTTOM': revealTopPickToHandThenOrderBottom,
    'GRANT_EXTRA_ATTACK_THIS_TURN': grantExtraAttackThisTurn,
    'LOCK_SKILL_ID_UNTIL_TURN_END': lockSkillIdUntilTurnEnd,
    'SET_TARGET_COST_THIS_TURN': setTargetCostThisTurn,
    'LOCK_SKILL_TRAIT_UNTIL_TURN_END': lockSkillTraitUntilTurnEnd,
    'ADD_DAMAGE_COUNT_REFERENCE_BONUS_THIS_TURN': addDamageCountReferenceBonusThisTurn,
    'QUEUE_NEXT_PLAY_UNIT_EFFECTS': queueNextPlayUnitEffects,
    'AUTO_ATTACK_IF_ENCOUNTER': autoAttackIfEncounter,
    'DAMAGE': damage,
    'DRAW_THEN_DISCARD': drawThenDiscard,
    'DESTROY_SELF': destroySelf,
    'DESTROY_UNIT_AND_DRAW': destroyUnitAndDraw,
    'NONE': noneAction,
};
