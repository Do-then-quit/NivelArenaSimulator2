import { ActionImplementation, ActivationCondition, Phase, UnitZoneState } from '../types';

function resolveEffectDrawMeta(params: any) {
    return {
        reason: 'EFFECT' as const,
        sourceActivation: params?.__sourceActivation,
    };
}

export const gainLevel: ActionImplementation = (ctx, params) => {
    const amount = params.value || 1;
    const pIdx = ctx.machine.state.players.indexOf(ctx.player);
    ctx.machine.addLeaderLevel(pIdx, amount);
};

export const drawCard: ActionImplementation = (ctx, params) => {
    const targetPlayer = params.target === 'OPPONENT' ? ctx.opponent : ctx.player;
    const targetPlayerIndex = ctx.machine.state.players.indexOf(targetPlayer);

    if (params.selection === 'LOOK_3_PICK_1') {
        const deck = targetPlayer.deck;
        if (deck.length === 0) return;

        const revealed = deck.splice(-3);
        if (revealed.length === 0) return;

        const picked = revealed.pop()!;
        targetPlayer.hand.push(picked);
        console.log(`${targetPlayer.name} picked ${picked.name} from top ${revealed.length + 1} cards.`);

        targetPlayer.deck.unshift(...revealed);
    } else {
        const count = params.count || 1;
        const drawn = ctx.machine.drawCard(targetPlayerIndex, count, resolveEffectDrawMeta(params));
        if (targetPlayer === ctx.player) {
            (ctx as any).lastDrawnCards = drawn;
        }
    }
};

export const returnToHand: ActionImplementation = (ctx, _params, _targets) => {
    const card = ctx.sourceCard;
    const player = ctx.player;

    const damageIdx = player.damage.findIndex(c => c === card);
    if (damageIdx !== -1) {
        player.damage.splice(damageIdx, 1);
        player.hand.push(card);
        console.log(`${card.name} returned to hand from Damage Zone.`);
        return;
    }

    console.log('Return to hand action: only Damage Zone move implemented.');
};

export const trashSelf: ActionImplementation = (ctx, _params, _targets) => {
    const card = ctx.sourceCard;
    const player = ctx.player;

    const damageIdx = player.damage.findIndex(c => c === card);
    if (damageIdx !== -1) {
        player.damage.splice(damageIdx, 1);
        player.trash.push(card);
        console.log(`${card.name} trashed from Damage Zone.`);
        return;
    }
    console.log('Trash self action: only Damage Zone move implemented.');
};

export const discard: ActionImplementation = (ctx, params, targets) => {
    const targetPlayer = params.target === 'OPPONENT' ? ctx.opponent : ctx.player;
    const trashedCards: any[] = [];

    if (targets && targets.length > 0) {
        targets.forEach(card => {
            const idx = targetPlayer.hand.indexOf(card);
            if (idx !== -1) {
                targetPlayer.hand.splice(idx, 1);
                targetPlayer.trash.push(card);
                trashedCards.push(card);
                console.log(`${targetPlayer.name} discarded chosen card: ${card.name}`);
            }
        });
    } else {
        const count = params.count || 1;
        for (let i = 0; i < count; i++) {
            if (targetPlayer.hand.length > 0) {
                const card = targetPlayer.hand.shift()!;
                targetPlayer.trash.push(card);
                trashedCards.push(card);
                console.log(`${targetPlayer.name} discarded ${card.name} from hand (auto).`);
            }
        }
    }

    if (trashedCards.length > 0) {
        (ctx as any).discardedCount = ((ctx as any).discardedCount || 0) + trashedCards.length;
        ctx.machine.notifyHandTrashed(targetPlayer, trashedCards, {
            flags: {
                handTrashByEffect: !params.isRule,
            },
        });
    }
};

export const discardAll: ActionImplementation = (ctx, _params) => {
    const player = ctx.player;
    const count = player.hand.length;
    const trashedCards: any[] = [];
    while (player.hand.length > 0) {
        const card = player.hand.pop()!;
        player.trash.push(card);
        trashedCards.push(card);
    }
    console.log(`${player.name} discarded all cards from hand (${count} cards).`);
    (ctx as any).discardedCount = count;
    if (trashedCards.length > 0) {
        ctx.machine.notifyHandTrashed(player, trashedCards, {
            flags: {
                handTrashByEffect: true,
            },
        });
    }
};

export const drawDynamic: ActionImplementation = (ctx, params, targets) => {
    const player = ctx.player;
    let count = 0;
    if (params.multiplier === 'BASE_UNIT_COUNT') {
        count = player.unitZones.filter(z => z.unit && z.unit.traits?.includes('베이스')).length;
    } else if (params.multiplier === 'TARGET_ITEM_COUNT') {
        const costMin = params.costMin ?? 0;
        const selectedTargets = targets || [];
        count = selectedTargets.reduce((sum, target) => {
            if (!target || typeof target !== 'object' || !('items' in target)) return sum;
            const items = Array.isArray((target as UnitZoneState).items) ? (target as UnitZoneState).items : [];
            const validItemCount = items.filter(item => (item.cost || 0) >= costMin).length;
            return sum + validItemCount;
        }, 0);
    }

    if (count > 0) {
        const pIdx = ctx.machine.state.players.indexOf(player);
        ctx.machine.drawCard(pIdx, count, resolveEffectDrawMeta(params));
        console.log(`Drew ${count} cards dynamically.`);
    }
};

export const moveFromDamageToHand: ActionImplementation = (ctx, _params, targets) => {
    targets.forEach(card => {
        const owner = ctx.machine.state.players.find((player: any) => player.damage.includes(card));
        if (!owner) return;
        const idx = owner.damage.indexOf(card);
        if (idx === -1) return;
        owner.damage.splice(idx, 1);
        owner.hand.push(card);
    });
};

export const moveFromHandToDamage: ActionImplementation = (ctx, _params, targets) => {
    targets.forEach(card => {
        const owner = ctx.machine.state.players.find((player: any) => player.hand.includes(card));
        if (!owner) return;
        const idx = owner.hand.indexOf(card);
        if (idx === -1) return;
        owner.hand.splice(idx, 1);
        owner.damage.push(card);
    });
};

export const moveFromTrashToDeckTop: ActionImplementation = (ctx, _params, targets) => {
    targets.forEach(card => {
        const idx = ctx.player.trash.indexOf(card);
        if (idx === -1) return;
        const [removed] = ctx.player.trash.splice(idx, 1);
        if (removed) ctx.player.deck.push(removed);
    });
};

export const moveFromTrashToDeckBottom: ActionImplementation = (ctx, params, targets) => {
    const movedCards: any[] = [];
    targets.forEach(card => {
        const idx = ctx.player.trash.indexOf(card);
        if (idx === -1) return;
        const [removed] = ctx.player.trash.splice(idx, 1);
        if (removed) movedCards.push(removed);
    });

    if (movedCards.length > 0) {
        ctx.player.deck.unshift(...movedCards);
    }

    if (params.thenDestroyEncounter && ctx.unitZone) {
        const laneIndex = ctx.player.unitZones.indexOf(ctx.unitZone);
        if (laneIndex !== -1) {
            const encounterZone = ctx.opponent.unitZones[laneIndex];
            if (encounterZone?.unit) {
                ctx.machine.destroyUnit(ctx.opponent, encounterZone, undefined, 'EFFECT');
            }
        }
    }
};

export const damage: ActionImplementation = (ctx, params, _targets) => {
    const value = params.value || 0;
    const targetPlayer = ctx.opponent;
    if (value > 0) {
        ctx.machine.dealDamage(targetPlayer, value);
        console.log(`Dealt ${value} damage to ${targetPlayer.name} via effect.`);
    }
};

export const destroySelf: ActionImplementation = (ctx) => {
    if (!ctx.unitZone || !ctx.unitZone.unit) return;
    ctx.machine.destroyUnit(ctx.player, ctx.unitZone, undefined, 'EFFECT');
};

export const lockSkillIdUntilTurnEnd: ActionImplementation = (ctx, params) => {
    const targetPlayer = params.target === 'OPPONENT' ? ctx.opponent : ctx.player;
    const lockId = params.skillId || ctx.sourceCard.id;
    if (!lockId) return;

    const lockMap = ((targetPlayer as any).lockedSkillIdsUntilTurnEnd || {}) as Record<string, boolean>;
    lockMap[lockId] = true;
    (targetPlayer as any).lockedSkillIdsUntilTurnEnd = lockMap;
};

export const autoAttackIfEncounter: ActionImplementation = (ctx) => {
    if (!ctx.unitZone || !ctx.unitZone.unit) return;
    const laneIndex = ctx.player.unitZones.indexOf(ctx.unitZone);
    if (laneIndex < 0) return;
    if (!ctx.opponent.unitZones[laneIndex]?.unit) return;
    if (ctx.machine.currentPlayer?.id !== ctx.player.id) return;
    if (ctx.machine.state.interactionMode !== 'NORMAL') return;
    if (ctx.machine.state.combatStep !== 'NONE') return;

    const previousPhase = ctx.machine.state.phase;
    (ctx.machine.state as any).resumePhaseAfterAutoAttack = previousPhase;
    ctx.machine.state.phase = Phase.ATTACK;
    ctx.machine.attack(laneIndex, { byCardEffect: true });

    if (ctx.machine.state.interactionMode === 'NORMAL' && ctx.machine.state.combatStep === 'NONE') {
        ctx.machine.state.phase = previousPhase;
        delete (ctx.machine.state as any).resumePhaseAfterAutoAttack;
    }
};

export const drawThenDiscard: ActionImplementation = (ctx, params, _targets) => {
    const player = ctx.player;
    const drawCount = params.drawCount || 2;
    const discardCount = params.discardCount || 1;
    const pIdx = ctx.machine.state.players.indexOf(player);

    const drawnCards = ctx.machine.drawCard(pIdx, drawCount, resolveEffectDrawMeta(params));
    console.log(`${player.name} drew ${drawnCards.length} cards for DRAW_THEN_DISCARD effect.`);

    if (drawnCards.length === 0) return;

    const selectionEffect = {
        activation: ActivationCondition.ACTIVE,
        description: 'Choose card to discard',
        action: { type: 'DISCARD', params: { target: 'SELF', count: discardCount } },
        targets: {
            scope: 'REVEALED',
            type: 'CARD',
            count: discardCount,
            selectMode: 'MANUAL'
        }
    } as any;

    ctx.machine.state.revealedCards = drawnCards;
    ctx.machine.state.interactionMode = 'SELECT_TARGET';
    ctx.machine.state.pendingEffect = {
        sourceCard: ctx.sourceCard,
        sourcePlayerId: player.id,
        controllerPlayerId: player.id,
        actionType: 'DISCARD_FROM_DRAWN',
        actionValue: { discardCount },
        effectDescription: selectionEffect.description,
        validTargets: 'REVEALED',
        targetSchema: selectionEffect.targets,
        selectedTargets: []
    };
    ctx.machine.setPendingRuntime(ctx, selectionEffect);
    ctx.machine.setInteractionOwner(player.id);

    console.log(`Waiting for ${player.name} to select ${discardCount} card(s) to discard from drawn cards.`);
};

export const noneAction: ActionImplementation = () => {
    // Intentionally no-op. Used for effects that only gate costs/timing.
};
