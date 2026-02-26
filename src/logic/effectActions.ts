import { ActionImplementation, Attribute, CardType, Phase, UnitZoneState } from './types';
import { TargetSelector } from './TargetSelector';
import {
    autoAttackIfEncounter,
    damage,
    discard,
    discardAll,
    drawCard,
    drawDynamic,
    drawThenDiscard,
    destroySelf,
    gainLevel,
    lockSkillIdUntilTurnEnd,
    moveFromDamageToHand,
    moveFromHandToDamage,
    moveFromTrashToDeckBottom,
    moveFromTrashToDeckTop,
    noneAction,
    returnToHand,
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
import { getOwnerOfZone, zoneHasKeyword } from './effectActions/helpers';

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

const complexAction: ActionImplementation = (ctx, params, _targets) => {
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

    if ((params as any).mode === 'PROMPT_SELECT_SKILL_ZONE_CARD_FOR_ZERO_COST') {
        const skills = ctx.player.skillZone
            .map((card, skillZoneIndex) => ({ card, skillZoneIndex }))
            .filter(({ card }) => card?.type === CardType.SKILL);

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
            ctx.machine.drawCard(playerIndex, drawCount);
        }
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

        targetZone.buffs.push({
            id: ctx.machine.createRuntimeId('BUFF'),
            sourceCard: ctx.sourceCard,
            type: 'POWER',
            value: -2000 * diff,
            duration: (params as any).duration || 'TURN_END',
        });
        return;
    }

    if ((params as any).mode === 'LOCK_ACTIVATION_UNTIL_TURN_END') {
        const targetPlayer = (params as any).target === 'OPPONENT' ? ctx.opponent : ctx.player;
        const activation = (params as any).activation;
        if (!targetPlayer || !activation) return;

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
        const debuffValue = trashedCards.length * 3000;
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

    const subActions = (params as any).subActions;
    if (!Array.isArray(subActions)) return;

    for (const sub of subActions) {
        const impl = ActionRegistry[sub.type];
        if (impl) {
            let subTargets = _targets;
            if (sub.targets) {
                subTargets = TargetSelector.resolve(ctx.machine, sub.targets, ctx);
            }
            impl(ctx, sub.params || {}, subTargets);
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
    'MOVE_FROM_TRASH_TO_DECK_TOP': moveFromTrashToDeckTop,
    'MOVE_FROM_TRASH_TO_DECK_BOTTOM': moveFromTrashToDeckBottom,
    'DRAW_BY_TARGET_HIT': drawByTargetHit,
    'LOCK_ATTACK_UNTIL_TURN_END': lockAttackUntilTurnEnd,
    'APPLY_DUALIST_MARK': applyDualistMark,
    'APPLY_INFILTRATION_MARK': applyInfiltrationMark,
    'REVEAL_TOP_PICK_TO_HAND_THEN_ORDER_BOTTOM': revealTopPickToHandThenOrderBottom,
    'GRANT_EXTRA_ATTACK_THIS_TURN': grantExtraAttackThisTurn,
    'LOCK_SKILL_ID_UNTIL_TURN_END': lockSkillIdUntilTurnEnd,
    'AUTO_ATTACK_IF_ENCOUNTER': autoAttackIfEncounter,
    'DAMAGE': damage,
    'DRAW_THEN_DISCARD': drawThenDiscard,
    'DESTROY_SELF': destroySelf,
    'DESTROY_UNIT_AND_DRAW': destroyUnitAndDraw,
    'NONE': noneAction,
};
