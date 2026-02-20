import { ActionImplementation, CardType } from '../types';
import { findItemLocation, getOwnerOfZone } from './helpers';

export const moveFromTrashToHand: ActionImplementation = (ctx, _params, targets) => {
    const player = ctx.player;
    targets.forEach(targetCard => {
        const idx = player.trash.indexOf(targetCard);
        if (idx !== -1) {
            player.trash.splice(idx, 1);
            player.hand.push(targetCard);
            console.log(`Moved ${targetCard.name} from Trash to Hand.`);
        }
    });
};

export const returnFromTrashAtTurnEnd: ActionImplementation = (ctx, _params, _targets) => {
    let card = ctx.sourceCard;
    if (ctx.sourceCard.type === CardType.ITEM && ctx.trashedUnit) {
        card = ctx.trashedUnit;
    }
    const player = ctx.player;

    const delayed = (player as any).delayedActions = (player as any).delayedActions || [];
    delayed.push({
        type: 'RETURN_TO_HAND_FROM_TRASH',
        card,
        turnCount: ctx.machine.state.turnCount
    });
    console.log(`Scheduled ${card.name} to return to hand at end of turn.`);
};

export const returnUnitAndItemsToHand: ActionImplementation = (ctx, _params, targets) => {
    targets.forEach(targetZone => {
        if (!targetZone || !targetZone.unit) return;
        const owner = getOwnerOfZone(ctx.machine, targetZone);
        if (!owner) return;

        const unitName = targetZone.unit.name;
        owner.hand.push(targetZone.unit);
        targetZone.items.forEach((item: any) => owner.hand.push(item));
        targetZone.unit = null;
        targetZone.items = [];
        targetZone.buffs = [];
        targetZone.temporaryEffects = [];

        console.log(`Returned ${unitName} and equipped items to owner hand.`);
    });
};

export const destroyItem: ActionImplementation = (ctx, _params, targets) => {
    targets.forEach(itemCard => {
        const located = findItemLocation(ctx.machine, itemCard);
        if (!located) return;
        const { owner, zone, itemIndex } = located;
        const [removed] = zone.items.splice(itemIndex, 1);
        if (removed) {
            owner.trash.push(removed);
        }
    });
};

export const returnItemToHand: ActionImplementation = (ctx, params, targets) => {
    if (params.fromEquippedSnapshot && Array.isArray(ctx.flags?.equippedItemsSnapshot)) {
        const owner = ctx.player;
        const snapshot = (ctx.flags?.equippedItemsSnapshot ?? []) as any[];
        const cardInTrash = snapshot.find(card => owner.trash.includes(card));
        if (cardInTrash) {
            const trashIndex = owner.trash.indexOf(cardInTrash);
            owner.trash.splice(trashIndex, 1);
            owner.hand.push(cardInTrash);
        }
        return;
    }

    targets.forEach(itemCard => {
        const located = findItemLocation(ctx.machine, itemCard);
        if (!located) return;
        const { owner, zone, itemIndex } = located;
        const [removed] = zone.items.splice(itemIndex, 1);
        if (removed) owner.hand.push(removed);
    });
};

export const moveItemToDeckBottom: ActionImplementation = (ctx, _params, targets) => {
    targets.forEach(itemCard => {
        const located = findItemLocation(ctx.machine, itemCard);
        if (!located) return;
        const { owner, zone, itemIndex } = located;
        const [removed] = zone.items.splice(itemIndex, 1);
        if (removed) owner.deck.unshift(removed);
    });
};
