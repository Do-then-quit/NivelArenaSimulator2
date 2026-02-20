import { ActionImplementation, ActivationCondition } from '../types';

export const revealTopAndChooseToHand: ActionImplementation = (ctx, params) => {
    const player = ctx.player;
    const deck = player.deck;
    const count = params.count || 3;
    if (deck.length === 0) return;

    const revealed = deck.splice(-count);
    ctx.machine.state.revealedCards = revealed;

    const filters = Array.isArray(params.filters)
        ? params.filters
        : (params.filter ? [params.filter] : []);

    const selectionEffect = {
        activation: ActivationCondition.ACTIVE,
        description: 'Choose card to hand',
        action: { type: 'NONE', params: {} },
        targets: {
            scope: 'REVEALED',
            type: 'CARD',
            count: 1,
            filters,
            selectMode: 'MANUAL'
        }
    } as any;

    ctx.machine.state.interactionMode = 'SELECT_TARGET';
    ctx.machine.state.pendingEffect = {
        sourceCard: ctx.sourceCard,
        sourcePlayerId: player.id,
        controllerPlayerId: player.id,
        actionType: 'PICK_REVEALED',
        actionValue: params,
        effectDescription: selectionEffect.description,
        validTargets: 'REVEALED',
        targetSchema: selectionEffect.targets,
        selectedTargets: []
    };
    ctx.machine.setPendingRuntime(ctx, selectionEffect);
    ctx.machine.setInteractionOwner(player.id);

    console.log(`Revealed top ${revealed.length} cards. Waiting for selection.`);
};

export const revealTopAndTakeAllByFilter: ActionImplementation = (ctx, params) => {
    const player = ctx.player;
    const deck = player.deck;
    const count = params.count || 3;
    if (deck.length === 0) return;

    const revealed = deck.splice(-count);
    ctx.machine.state.revealedCards = revealed;

    const filters = Array.isArray(params.filters)
        ? params.filters
        : (params.filter ? [params.filter] : []);

    const selectionEffect = {
        activation: ActivationCondition.ACTIVE,
        description: 'Review revealed cards',
        action: { type: 'NONE', params: {} },
        targets: {
            scope: 'REVEALED',
            type: 'CARD',
            count: 0,
            filters,
            selectMode: 'ALL'
        }
    } as any;

    ctx.machine.state.interactionMode = 'SELECT_TARGET';
    ctx.machine.state.pendingEffect = {
        sourceCard: ctx.sourceCard,
        sourcePlayerId: player.id,
        controllerPlayerId: player.id,
        actionType: 'TAKE_ALL_REVEALED',
        actionValue: params,
        effectDescription: selectionEffect.description,
        validTargets: 'REVEALED',
        targetSchema: selectionEffect.targets,
        selectedTargets: []
    };
    ctx.machine.setPendingRuntime(ctx, selectionEffect);
    ctx.machine.setInteractionOwner(player.id);

    console.log(`Revealed top ${revealed.length} cards for review. Waiting for confirmation.`);
};

export const revealTopPickToHandThenOrderBottom: ActionImplementation = (ctx, params) => {
    const player = ctx.player;
    const count = params.count || 2;
    const pickCount = params.pickCount || 1;
    if (player.deck.length === 0) return;

    const revealed = player.deck.splice(-count);
    ctx.machine.state.revealedCards = revealed;

    const filters = Array.isArray(params.filters)
        ? params.filters
        : (params.filter ? [params.filter] : []);

    const selectionEffect = {
        activation: ActivationCondition.ACTIVE,
        description: 'Choose revealed cards to hand, then order the rest to deck bottom',
        action: { type: 'NONE', params: {} },
        targets: {
            scope: 'REVEALED',
            type: 'CARD',
            count: pickCount,
            filters,
            selectMode: 'MANUAL'
        }
    } as any;

    ctx.machine.state.interactionMode = 'SELECT_TARGET';
    ctx.machine.state.pendingEffect = {
        sourceCard: ctx.sourceCard,
        sourcePlayerId: player.id,
        controllerPlayerId: player.id,
        actionType: 'PICK_REVEALED_ORDER_BOTTOM',
        actionValue: {
            ...params,
            allowPartialSelection: !!params.allowPartialSelection,
        },
        effectDescription: selectionEffect.description,
        validTargets: 'REVEALED',
        targetSchema: selectionEffect.targets,
        selectedTargets: []
    };
    ctx.machine.setPendingRuntime(ctx, selectionEffect);
    ctx.machine.setInteractionOwner(player.id);
};
