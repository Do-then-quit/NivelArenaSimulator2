import { ActionImplementation, UnitZoneState } from './types';
import { TargetSelector } from './TargetSelector';
import {
    damage,
    discard,
    discardAll,
    drawCard,
    drawDynamic,
    drawThenDiscard,
    gainLevel,
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
    'DAMAGE': damage,
    'DRAW_THEN_DISCARD': drawThenDiscard,
    'DESTROY_UNIT_AND_DRAW': destroyUnitAndDraw,
    'NONE': noneAction,
};
