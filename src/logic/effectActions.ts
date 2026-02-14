import { ActionImplementation, UnitZoneState, ActivationCondition, CardType } from './types';
import { TargetSelector } from './TargetSelector';

function matchesCardFilters(card: any, filters: any[]): boolean {
    for (const filter of filters) {
        if (!filter) continue;
        switch (filter.type) {
            case 'CARD_TYPE':
                if (card.type !== filter.value) return false;
                break;
            case 'COST_EQUAL':
                if (card.cost !== filter.value) return false;
                break;
            case 'COST_LIMIT':
                if (card.cost > filter.value) return false;
                break;
            case 'COST_MIN':
                if (card.cost < filter.value) return false;
                break;
            case 'HAS_KEYWORD':
                if (!card.keywords?.includes(filter.value)) return false;
                break;
            case 'HAS_TRAIT':
                if (!card.traits?.includes(filter.value)) return false;
                break;
            default:
                break;
        }
    }
    return true;
}

const gainLevel: ActionImplementation = (ctx, params) => {
    const amount = params.value || 1;
    const pIdx = ctx.machine.state.players.indexOf(ctx.player);
    ctx.machine.addLeaderLevel(pIdx, amount);
};

const drawCard: ActionImplementation = (ctx, params) => {
    if (params.selection === 'LOOK_3_PICK_1') {
        const player = ctx.player;
        const deck = player.deck;
        if (deck.length === 0) return; // Lose condition handled elsewhere or just empty

        // Simplified: Take top 3, pick 1st, rest to bottom
        const revealed = deck.splice(-3); // Take last 3 (top of deck)
        if (revealed.length === 0) return;

        // Pick the last one (top-most)
        const picked = revealed.pop()!;
        player.hand.push(picked);
        console.log(`${player.name} picked ${picked.name} from top ${revealed.length + 1} cards.`);

        // Put rest on bottom (start of array)
        player.deck.unshift(...revealed);
    } else {
        const count = params.count || 1;
        const pIdx = ctx.machine.state.players.indexOf(ctx.player);
        const drawn = ctx.machine.drawCard(pIdx, count);
        // Store drawn cards in context for subsequent effects (e.g. discard among drawn)
        (ctx as any).lastDrawnCards = drawn;
    }
};

const buffPower: ActionImplementation = (ctx, params, targets) => {
    targets.forEach(target => {
        if (target && target.unit) {
            let value = params.value || 0;
            if (params.dynamic === 'LEADER_LEVEL_MULTIPLIER') {
                value = ctx.player.leaderLevel * value;
            }

            target.buffs.push({
                id: ctx.machine.createRuntimeId('BUFF'),
                sourceCard: ctx.sourceCard,
                type: 'POWER',
                value: value,
                mode: params.mode || 'ADD',
                duration: params.duration || 'TURN_END'
            });
            console.log(`Buffed ${target.unit.name} to ${value} Power (Mode: ${params.mode || 'ADD'}).`);
        }
    });
};

const buffHit: ActionImplementation = (ctx, params, targets) => {
    targets.forEach(target => {
        if (target && target.unit) {
            const value = params.value || 0;
            target.buffs.push({
                id: ctx.machine.createRuntimeId('BUFF'),
                sourceCard: ctx.sourceCard,
                type: 'HIT',
                value: value,
                mode: params.mode || 'ADD',
                duration: params.duration || 'TURN_END'
            });
            console.log(`Buffed ${target.unit.name} to ${value} Hit (Mode: ${params.mode || 'ADD'}).`);
        }
    });
};

const destroyUnit: ActionImplementation = (ctx, params, targets) => {
    // If no targets provided, but action has filter conditions (e.g. Trigger)
    // Actually EffectManager handles Target selection, so targets should be populated.
    targets.forEach(target => {
        if (target && target.unit) {
            // Additional check for cost if specified in params (from Trigger description)
            if (params.costMax !== undefined && (target.unit.cost || 0) > params.costMax) return;

            const owner = getOwnerOfZone(ctx.machine, target);
            if (owner) {
                // If alsoDestroyEncounter is set, find and destroy encounter unit before trashing target
                if (params.alsoDestroyEncounter) {
                    const idx = owner.unitZones.indexOf(target);
                    if (idx !== -1) {
                        const opponent = ctx.machine.state.players.find((p: any) => p !== owner);
                        const oppZone = opponent.unitZones[idx];
                        if (oppZone.unit) {
                            ctx.machine.destroyUnit(opponent, oppZone, undefined, 'EFFECT');
                        }
                    }
                }
                ctx.machine.destroyUnit(owner, target, undefined, 'EFFECT');
            }
        }
    });
};

const destroyLaneLowest: ActionImplementation = (ctx, _params, _targets) => {
    if (ctx.selectedLaneIndex !== undefined) {
        const idx = ctx.selectedLaneIndex;
        const player = ctx.player;
        const opponent = ctx.opponent;
        const myZ = player.unitZones[idx];
        const oppZ = opponent.unitZones[idx];

        const myPower = ctx.machine.getUnitPower(myZ, player);
        const oppPower = ctx.machine.getUnitPower(oppZ, opponent);

        if (myZ.unit && oppZ.unit) {
            if (myPower < oppPower) ctx.machine.destroyUnit(player, myZ, undefined, 'EFFECT');
            else if (oppPower < myPower) ctx.machine.destroyUnit(opponent, oppZ, undefined, 'EFFECT');
            else {
                ctx.machine.destroyUnit(player, myZ, undefined, 'EFFECT');
                ctx.machine.destroyUnit(opponent, oppZ, undefined, 'EFFECT');
            }
        }
    }
};

const returnToHand: ActionImplementation = (ctx, _params, _targets) => {
    const card = ctx.sourceCard;
    const player = ctx.player;

    // Remove from current zone (usually Damage Zone during trigger)
    const damageIdx = player.damage.findIndex(c => c === card);
    if (damageIdx !== -1) {
        player.damage.splice(damageIdx, 1);
        player.hand.push(card);
        console.log(`${card.name} returned to hand from Damage Zone.`);
        return;
    }

    // Handled general case if needed, but primarily for Trigger now
    console.log("Return to hand action: only Damage Zone move implemented.");
};

const trashSelf: ActionImplementation = (ctx, _params, _targets) => {
    const card = ctx.sourceCard;
    const player = ctx.player;

    // Remove from Damage Zone
    const damageIdx = player.damage.findIndex(c => c === card);
    if (damageIdx !== -1) {
        player.damage.splice(damageIdx, 1);
        player.trash.push(card);
        console.log(`${card.name} trashed from Damage Zone.`);
        return;
    }
    console.log("Trash self action: only Damage Zone move implemented.");
};

const penetration: ActionImplementation = (ctx, params, _targets) => {
    // Penetration usually applies to the sourceCard's zone if it's an ATTACKER effect
    if (ctx.unitZone) {
        ctx.unitZone.buffs.push({
            id: ctx.machine.createRuntimeId('BUFF'),
            sourceCard: ctx.sourceCard,
            type: 'PENETRATION',
            value: params.value || 0,
            duration: 'TURN_END'
        });
        console.log(`Granted PENETRATION[${params.value}] to ${ctx.unitZone.unit?.name}`);
    }
};

const plunder: ActionImplementation = (ctx, params, _targets) => {
    if (ctx.unitZone) {
        ctx.unitZone.buffs.push({
            id: ctx.machine.createRuntimeId('BUFF'),
            sourceCard: ctx.sourceCard,
            type: 'PLUNDER',
            value: params.value || 0,
            duration: 'TURN_END'
        });
        console.log(`Granted PLUNDER[${params.value}] to ${ctx.unitZone.unit?.name}`);
    }
};

const moveFromTrashToHand: ActionImplementation = (ctx, _params, targets) => {
    // Targets are cards in trash
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

const mutualDestruction: ActionImplementation = (ctx, _params, _targets) => {
    if (!ctx.destroyedBy) return;

    const killerCost = ctx.destroyedBy.cost;
    // Use unitZone's unit cost for items, otherwise use sourceCard cost for unit effects
    // This is because the effect text says "이 유닛의 코스트" not "이 아이템의 코스트"
    const myCost = ctx.unitZone?.unit?.cost ?? ctx.sourceCard?.cost;

    if (myCost === undefined) return;

    if (killerCost <= myCost) {
        console.log(`Mutual Destruction triggered! Trash killer ${ctx.destroyedBy.name} (Cost ${killerCost} <= ${myCost})`);

        // Find killer zone
        const allZones = [...ctx.player.unitZones, ...ctx.opponent.unitZones];
        const killerZone = allZones.find(z => z.unit === ctx.destroyedBy);

        if (killerZone) {
            const owner = getOwnerOfZone(ctx.machine, killerZone);
            if (owner) {
                ctx.machine.destroyUnit(owner, killerZone, undefined, 'EFFECT');
            }
        }
    }
};

const terminateAttack: ActionImplementation = (ctx, _params, _targets) => {
    console.log("Attack Terminated by effect.");
    ctx.machine.state.attackTerminated = true;

    // Trash self (Defender)
    if (ctx.unitZone) {
        ctx.machine.destroyUnit(ctx.player, ctx.unitZone, undefined, 'EFFECT');
    }
};

const discard: ActionImplementation = (ctx, params, targets) => {
    const targetPlayer = params.target === 'OPPONENT' ? ctx.opponent : ctx.player;
    let discardedCount = 0;

    if (targets && targets.length > 0) {
        targets.forEach(card => {
            const idx = targetPlayer.hand.indexOf(card);
            if (idx !== -1) {
                targetPlayer.hand.splice(idx, 1);
                targetPlayer.trash.push(card);
                discardedCount++;
                console.log(`${targetPlayer.name} discarded chosen card: ${card.name}`);
            }
        });
    } else {
        const count = params.count || 1;
        for (let i = 0; i < count; i++) {
            if (targetPlayer.hand.length > 0) {
                const card = targetPlayer.hand.shift()!;
                targetPlayer.trash.push(card);
                discardedCount++;
                console.log(`${targetPlayer.name} discarded ${card.name} from hand (auto).`);
            }
        }
    }

    if (discardedCount > 0 && ctx.machine.notifyHandDiscardedByEffect) {
        ctx.machine.notifyHandDiscardedByEffect(targetPlayer, discardedCount);
    }
};

const discardAll: ActionImplementation = (ctx, _params) => {
    const player = ctx.player;
    const count = player.hand.length;
    while (player.hand.length > 0) {
        player.trash.push(player.hand.pop()!);
    }
    console.log(`${player.name} discarded all cards from hand (${count} cards).`);
    (ctx as any).discardedCount = count;
    if (count > 0 && ctx.machine.notifyHandDiscardedByEffect) {
        ctx.machine.notifyHandDiscardedByEffect(player, count);
    }
};

const destroyEncounter: ActionImplementation = (ctx, params, targets) => {
    targets.forEach(targetZone => {
        const idx = ctx.player.unitZones.indexOf(targetZone);
        if (idx !== -1) {
            const oppZone = ctx.opponent.unitZones[idx];
            if (oppZone.unit) {
                // Fix: Check costMax if provided
                if (params.costMax !== undefined && (oppZone.unit.cost || 0) > params.costMax) {
                    console.log(`Encounter unit ${oppZone.unit.name} cost ${oppZone.unit.cost} exceeds limit ${params.costMax}. Skipping.`);
                    return;
                }

                const unitName = oppZone.unit.name;
                ctx.machine.destroyUnit(ctx.opponent, oppZone, undefined, 'EFFECT');
                console.log(`Trashed encounter unit ${unitName} in lane ${idx}`);
            }
        } else {
            const oppIdx = ctx.opponent.unitZones.indexOf(targetZone);
            if (oppIdx !== -1) {
                const myZone = ctx.player.unitZones[oppIdx];
                if (myZone.unit) {
                    // Fix: Check costMax if provided (for reverse encounter case if any)
                    if (params.costMax !== undefined && (myZone.unit.cost || 0) > params.costMax) {
                        console.log(`Encounter unit ${myZone.unit.name} cost ${myZone.unit.cost} exceeds limit ${params.costMax}. Skipping.`);
                        return;
                    }

                    ctx.machine.destroyUnit(ctx.player, myZone, undefined, 'EFFECT');
                }
            }
        }
    });
};

const grantEffect: ActionImplementation = (_ctx, params, targets) => {
    targets.forEach(target => {
        if (target && 'temporaryEffects' in target) {
            const effect = params.effect;
            if (effect) {
                target.temporaryEffects.push({
                    ...effect,
                    duration: params.duration || 'TURN_END'
                });
                console.log(`Granted effect to ${target.unit?.name}: ${effect.description}`);
            }
        }
    });
};

const setPower: ActionImplementation = (ctx, params, targets) => {
    targets.forEach(target => {
        if (target && target.unit) {
            target.buffs.push({
                id: ctx.machine.createRuntimeId('BUFF'),
                sourceCard: ctx.sourceCard,
                type: 'POWER',
                value: params.value,
                mode: 'SET',
                duration: params.duration || 'TURN_END'
            });
            console.log(`Set ${target.unit.name} Power to ${params.value}.`);
        }
    });
};

const buffPowerAndDrawIfTrashed: ActionImplementation = (ctx, params, targets) => {
    targets.forEach(target => {
        if (target && target.unit) {
            const oldValue = ctx.machine.getUnitPower(target, getOwnerOfZone(ctx.machine, target));
            const buffValue = params.value || 0;

            target.buffs.push({
                id: ctx.machine.createRuntimeId('BUFF'),
                sourceCard: ctx.sourceCard,
                type: 'POWER',
                value: buffValue,
                duration: params.duration || 'TURN_END'
            });

            console.log(`Buffed ${target.unit.name} by ${buffValue} Power.`);

            // Check if it should be trashed immediately
            const newValue = ctx.machine.getUnitPower(target, getOwnerOfZone(ctx.machine, target));
            if (oldValue > 0 && newValue <= 0) {
                console.log(`Effect caused ${target.unit.name} to have 0 or less power. Trashing and drawing.`);
                const owner = getOwnerOfZone(ctx.machine, target);
                ctx.machine.destroyUnit(owner, target, undefined, 'EFFECT');
                const pIdx = ctx.machine.state.players.indexOf(ctx.player);
                ctx.machine.drawCard(pIdx, params.drawCount || 1);
            }
        }
    });
};

const revealTopAndChooseToHand: ActionImplementation = (ctx, params) => {
    const player = ctx.player;
    const deck = player.deck;
    const count = params.count || 3;
    if (deck.length === 0) return;

    // Move to revealed state
    const revealed = deck.splice(-count);
    ctx.machine.state.revealedCards = revealed;

    const selectionEffect = {
        activation: ActivationCondition.ACTIVE,
        description: 'Choose card to hand',
        action: { type: 'NONE', params: {} },
        targets: {
            scope: 'REVEALED',
            type: 'CARD',
            count: 1,
            filters: params.filter ? [params.filter] : [],
            selectMode: 'MANUAL'
        }
    } as any;

    // Transition to interactive selection
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

const revealTopAndTakeAllByFilter: ActionImplementation = (ctx, params) => {
    const player = ctx.player;
    const deck = player.deck;
    const count = params.count || 3;
    if (deck.length === 0) return;

    // Move to revealed state
    const revealed = deck.splice(-count);
    ctx.machine.state.revealedCards = revealed;

    const selectionEffect = {
        activation: ActivationCondition.ACTIVE,
        description: 'Review revealed cards',
        action: { type: 'NONE', params: {} },
        targets: {
            scope: 'REVEALED',
            type: 'CARD',
            count: 0,
            filters: params.filter ? [params.filter] : [],
            selectMode: 'ALL'
        }
    } as any;

    // Transition to interactive selection (Review mode)
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
        selectedTargets: [] // Not used for selection, but for consistency
    };
    ctx.machine.setPendingRuntime(ctx, selectionEffect);
    ctx.machine.setInteractionOwner(player.id);

    console.log(`Revealed top ${revealed.length} cards for review. Waiting for confirmation.`);
};

const returnFromTrashAtTurnEnd: ActionImplementation = (ctx, _params, _targets) => {
    let card = ctx.sourceCard;
    // If an item triggers this effect, return the destroyed unit instead of the item itself.
    if (ctx.sourceCard.type === CardType.ITEM && ctx.trashedUnit) {
        card = ctx.trashedUnit;
    }
    const player = ctx.player;

    // This is a delayed action, so we need a place to store it.
    // For now, let's add it to a temporary storage in the player's state
    // and assume GameEngine handles it at turn end.
    const delayed = (player as any).delayedActions = (player as any).delayedActions || [];
    delayed.push({
        type: 'RETURN_TO_HAND_FROM_TRASH',
        card: card,
        turnCount: ctx.machine.state.turnCount
    });
    console.log(`Scheduled ${card.name} to return to hand at end of turn.`);
};

const drawDynamic: ActionImplementation = (ctx, params) => {
    const player = ctx.player;
    let count = 0;
    if (params.multiplier === 'BASE_UNIT_COUNT') {
        count = player.unitZones.filter(z => z.unit && z.unit.traits?.includes('베이스')).length;
    } else if (params.multiplier === 'COST_PAYMENT_HIT') {
        count = Math.max(0, ctx.costPaymentCard?.hit || 0);
    }

    if (count > 0) {
        const pIdx = ctx.machine.state.players.indexOf(player);
        ctx.machine.drawCard(pIdx, count);
        console.log(`Drew ${count} cards dynamically.`);
    }
};

const destroyUnitAndDrawByHit: ActionImplementation = (ctx, _params, targets) => {
    if (!targets[0]) return;
    const targetZone = targets[0] as UnitZoneState;
    const unit = targetZone.unit;
    if (!unit) return;

    const owner = getOwnerOfZone(ctx.machine, targetZone);
    if (!owner) return;

    const hit = Math.max(0, ctx.machine.getUnitHit(targetZone, owner));
    const controllerIdx = ctx.machine.state.players.indexOf(ctx.player);

    ctx.machine.destroyUnit(owner, targetZone, undefined, 'EFFECT');
    if (hit > 0 && controllerIdx !== -1) {
        ctx.machine.drawCard(controllerIdx, hit);
        console.log(`Destroyed ${unit.name} and drew ${hit} cards.`);
    }
};

const destroyUnitWithHitCost: ActionImplementation = (ctx, _params, targets) => {
    if (!targets[0]) return;
    const targetZone = targets[0] as UnitZoneState;
    const unit = targetZone.unit;
    if (!unit) return;

    const owner = getOwnerOfZone(ctx.machine, targetZone);
    if (!owner) return;
    const hit = Math.max(0, ctx.machine.getUnitHit(targetZone, owner));

    if (hit <= 0) {
        ctx.machine.destroyUnit(owner, targetZone, undefined, 'EFFECT');
        console.log(`Destroyed ${unit.name} (no hand cost required).`);
        return;
    }

    const payableCount = ctx.player.hand.length;
    if (payableCount < hit) {
        console.log(
            `Cannot resolve DESTROY_UNIT_WITH_HIT_COST for ${ctx.sourceCard.name}: ` +
            `insufficient hand cards (${payableCount}/${hit}).`
        );
        return;
    }

    // Reuse the engine's unified cost selection flow.
    ctx.machine.state.interactionMode = 'SELECT_COST';
    ctx.machine.state.pendingEffect = {
        sourceCard: ctx.sourceCard,
        sourcePlayerId: ctx.player.id,
        controllerPlayerId: ctx.player.id,
        actionType: 'DESTROY_UNIT_WITH_HIT_COST',
        actionValue: { hitCost: hit },
        effectDescription: 'Destroy selected unit after paying hit cost',
        costToPay: { type: 'TRASH_HAND', amount: hit },
        costPaidCount: 0,
        selectedTargets: [targetZone]
    };
    ctx.machine.setPendingRuntime(ctx, null);
    ctx.machine.setInteractionOwner(ctx.player.id);
    console.log(`Entered Cost Selection Mode for ${ctx.sourceCard.name}`);
};

const complexAction: ActionImplementation = (ctx, params, _targets) => {
    const subActions = (params as any).subActions;
    if (!Array.isArray(subActions)) return;

    for (const sub of subActions) {
        const impl = ActionRegistry[sub.type];
        if (impl) {
            // Re-evaluating targets if specific target schemas are provided in sub-actions
            let subTargets = _targets;
            if (sub.targets) {
                // Fix: TargetSelector.resolve is a static method, not a property of machine instance
                subTargets = TargetSelector.resolve(ctx.machine, sub.targets, ctx);
            }
            impl(ctx, sub.params || {}, subTargets);
        }
    }
};

const sacrificeToBuff: ActionImplementation = (ctx, params, targets) => {
    if (!targets || targets.length < 2) {
        console.warn("SACRIFICE_TO_BUFF requires at least 2 targets.");
        return;
    }

    // Assumptions:
    // targets[0] is the unit to sacrifice (trash)
    // targets[1] is the unit to buff
    const trashTarget = targets[0] as UnitZoneState;
    const buffTarget = targets[1] as UnitZoneState;

    if (trashTarget && trashTarget.unit) {
        const trashedUnitName = trashTarget.unit.name;
        const owner = getOwnerOfZone(ctx.machine, trashTarget);
        if (owner) {
            ctx.machine.destroyUnit(owner, trashTarget, undefined, 'EFFECT');
            console.log(`Sacrificed ${trashedUnitName} for effect.`);
        }
    }

    if (buffTarget && buffTarget.unit) {
        const value = params.powerValue || 0;
        buffTarget.buffs.push({
            id: ctx.machine.createRuntimeId('BUFF'),
            sourceCard: ctx.sourceCard,
            type: 'POWER',
            value: value,
            duration: params.duration || 'TURN_END'
        });
        console.log(`Buffed ${buffTarget.unit.name} by ${value} Power.`);
    }
};

const noneAction: ActionImplementation = () => {
    // Intentionally no-op. Used for effects that only gate costs/timing.
};

// Helper inside this module
function getOwnerOfZone(machine: any, zone: UnitZoneState): any {
    if (machine.state.players[0].unitZones.includes(zone)) return machine.state.players[0];
    if (machine.state.players[1].unitZones.includes(zone)) return machine.state.players[1];
    return null;
}

const damage: ActionImplementation = (ctx, params, _targets) => {
    // Damage to player
    // params.value
    const value = params.value || 0;
    const targetPlayer = ctx.opponent; // Usually opponent? Or specified?
    // Penetration implies damage to opponent.
    if (value > 0) {
        ctx.machine.dealDamage(targetPlayer, value);
        console.log(`Dealt ${value} damage to ${targetPlayer.name} via effect.`);
    }
};

const breakthrough: ActionImplementation = (_ctx, _params, _targets) => {
    // Breakthrough is handled by GameEngine.getBreakthroughLimit directly
    // This action exists to avoid "unimplemented action" warnings
};

const drawThenDiscard: ActionImplementation = (ctx, params, _targets) => {
    const player = ctx.player;
    const drawCount = params.drawCount || 2;
    const discardCount = params.discardCount || 1;
    const discardFrom: 'DRAWN' | 'HAND' = params.discardFrom === 'HAND' ? 'HAND' : 'DRAWN';
    const pIdx = ctx.machine.state.players.indexOf(player);

    // First, draw cards
    const drawnCards = ctx.machine.drawCard(pIdx, drawCount);
    console.log(`${player.name} drew ${drawnCards.length} cards for DRAW_THEN_DISCARD effect.`);

    if (drawnCards.length === 0) return;

    const selectionEffect = {
        activation: ActivationCondition.ACTIVE,
        description: 'Choose card to discard',
        action: { type: 'DISCARD', params: { target: 'SELF', count: discardCount } },
        targets: {
            scope: discardFrom === 'HAND' ? 'MY_HAND' : 'REVEALED',
            type: 'CARD',
            count: discardCount,
            selectMode: 'MANUAL'
        }
    } as any;

    // Now, initiate discard selection
    if (discardFrom === 'DRAWN') {
        ctx.machine.state.revealedCards = drawnCards;
    }
    ctx.machine.state.interactionMode = 'SELECT_TARGET';
    ctx.machine.state.pendingEffect = {
        sourceCard: ctx.sourceCard,
        sourcePlayerId: player.id,
        controllerPlayerId: player.id,
        actionType: discardFrom === 'HAND' ? 'DISCARD_FROM_HAND' : 'DISCARD_FROM_DRAWN',
        actionValue: { discardCount },
        effectDescription: selectionEffect.description,
        validTargets: discardFrom === 'HAND' ? 'MY_HAND' : 'REVEALED',
        targetSchema: selectionEffect.targets,
        selectedTargets: []
    };
    ctx.machine.setPendingRuntime(ctx, selectionEffect as any);
    ctx.machine.setInteractionOwner(player.id);

    console.log(`Waiting for ${player.name} to select ${discardCount} card(s) to discard (${discardFrom}).`);
};

const destroyUnitAndDraw: ActionImplementation = (ctx, params, targets) => {
    if (!targets[0]) return;
    const targetZone = targets[0] as UnitZoneState;
    const unit = targetZone.unit;
    if (!unit) return;

    const owner = getOwnerOfZone(ctx.machine, targetZone);
    const drawCount = params.drawCount || 1;

    // Destroy the unit first
    ctx.machine.destroyUnit(owner, targetZone, undefined, 'EFFECT');
    console.log(`Destroyed ${unit.name} for DESTROY_UNIT_AND_DRAW effect.`);

    // Then draw cards for the effect controller (not the owner)
    const pIdx = ctx.machine.state.players.indexOf(ctx.player);
    ctx.machine.drawCard(pIdx, drawCount);
    console.log(`Drew ${drawCount} card(s) after destroying unit.`);
};

const searchDeckToHand: ActionImplementation = (ctx, params, _targets) => {
    const player = ctx.player;
    const filters = Array.isArray(params.filters) ? params.filters : [];
    const count = Math.max(1, params.count || 1);
    const shuffleAfter = params.shuffleAfter !== false;
    const candidates = player.deck.filter(card => matchesCardFilters(card, filters));

    if (candidates.length === 0) {
        if (shuffleAfter) {
            ctx.machine.shuffleInPlace(player.deck);
        }
        console.log(`No matching cards found in deck for ${ctx.sourceCard.name}.`);
        return;
    }

    ctx.machine.state.revealedCards = [...candidates];
    ctx.machine.state.interactionMode = 'SELECT_TARGET';
    ctx.machine.state.pendingEffect = {
        sourceCard: ctx.sourceCard,
        sourcePlayerId: player.id,
        controllerPlayerId: player.id,
        actionType: 'SEARCH_DECK_TO_HAND_PICK',
        actionValue: { count, shuffleAfter },
        effectDescription: 'Choose card(s) from deck search result',
        validTargets: 'REVEALED',
        targetSchema: {
            scope: 'REVEALED',
            type: 'CARD',
            count,
            selectMode: 'MANUAL'
        },
        selectedTargets: []
    };
    ctx.machine.setPendingRuntime(ctx, null);
    ctx.machine.setInteractionOwner(player.id);
};

const returnUnitAndItemsToHand: ActionImplementation = (ctx, _params, targets) => {
    targets.forEach(target => {
        if (!target || typeof target !== 'object' || !('unit' in target)) return;
        const zone = target as UnitZoneState;
        if (!zone.unit) return;

        const owner = getOwnerOfZone(ctx.machine, zone);
        if (!owner) return;

        owner.hand.push(zone.unit);
        zone.items.forEach(item => owner.hand.push(item));
        zone.unit = null;
        zone.items = [];
        zone.buffs = [];
        zone.temporaryEffects = [];
    });
};

const drawByEquippedItemCount: ActionImplementation = (ctx, params, targets) => {
    const targetZone = (targets[0] as UnitZoneState) || ctx.unitZone;
    if (!targetZone?.unit) return;

    const costMin = params.costMin ?? 0;
    const drawCount = targetZone.items.filter(item => item.cost >= costMin).length;
    if (drawCount <= 0) return;

    const pIdx = ctx.machine.state.players.indexOf(ctx.player);
    ctx.machine.drawCard(pIdx, drawCount);
};

const destroySelectedAndDestroyOpponent: ActionImplementation = (ctx, _params, targets) => {
    const ownTarget = targets[0] as UnitZoneState | undefined;
    if (!ownTarget?.unit) return;

    const ownOwner = getOwnerOfZone(ctx.machine, ownTarget);
    if (!ownOwner) return;
    ctx.machine.destroyUnit(ownOwner, ownTarget, undefined, 'EFFECT');

    ctx.machine.state.interactionMode = 'SELECT_TARGET';
    ctx.machine.state.pendingEffect = {
        sourceCard: ctx.sourceCard,
        sourcePlayerId: ctx.player.id,
        controllerPlayerId: ctx.player.id,
        actionType: 'DESTROY_SELECTED_AND_DESTROY_OPPONENT',
        actionValue: {},
        effectDescription: 'Select opponent unit to trash',
        targetSchema: {
            scope: 'OPP_FIELD',
            type: 'UNIT',
            count: 1,
            selectMode: 'MANUAL'
        },
        selectedTargets: []
    };
    ctx.machine.setPendingRuntime(ctx, null);
    ctx.machine.setInteractionOwner(ctx.player.id);
};

const destroyEquippedItem: ActionImplementation = (ctx, _params, targets) => {
    const targetZone = targets[0] as UnitZoneState | undefined;
    if (!targetZone || targetZone.items.length === 0) return;
    const owner = getOwnerOfZone(ctx.machine, targetZone);
    if (!owner) return;
    const [item] = targetZone.items.splice(0, 1);
    owner.trash.push(item);
};

const returnFirstEquippedItemToHand: ActionImplementation = (ctx, _params, targets) => {
    const targetZone = (targets[0] as UnitZoneState | undefined) || ctx.unitZone;
    if (!targetZone || targetZone.items.length === 0) return;
    const owner = getOwnerOfZone(ctx.machine, targetZone);
    if (!owner) return;
    const [item] = targetZone.items.splice(0, 1);
    owner.hand.push(item);
};

const moveEquippedItemToDeckBottom: ActionImplementation = (ctx, _params, targets) => {
    const targetZone = targets[0] as UnitZoneState | undefined;
    if (!targetZone || targetZone.items.length === 0) return;
    const owner = getOwnerOfZone(ctx.machine, targetZone);
    if (!owner) return;
    const [item] = targetZone.items.splice(0, 1);
    owner.deck.unshift(item);
};

const moveFromTrashToDeckTop: ActionImplementation = (ctx, _params, targets) => {
    const player = ctx.player;
    targets.forEach(targetCard => {
        const idx = player.trash.indexOf(targetCard);
        if (idx === -1) return;
        const [card] = player.trash.splice(idx, 1);
        player.deck.push(card);
    });
};

const moveFromTrashToDeckBottom: ActionImplementation = (ctx, _params, targets) => {
    const player = ctx.player;
    const moved: any[] = [];
    targets.forEach(targetCard => {
        const idx = player.trash.indexOf(targetCard);
        if (idx === -1) return;
        const [card] = player.trash.splice(idx, 1);
        moved.push(card);
    });
    for (let i = moved.length - 1; i >= 0; i--) {
        player.deck.unshift(moved[i]);
    }
};

const swapDamageItemWithHand: ActionImplementation = (ctx, _params, _targets) => {
    const player = ctx.player;
    const damageItemIndex = player.damage.findIndex(card => card.type === CardType.ITEM);
    if (damageItemIndex === -1) return;
    if (player.hand.length === 0) return;

    const [damageItem] = player.damage.splice(damageItemIndex, 1);
    player.hand.push(damageItem);

    const handIndexToDamage = player.hand.findIndex(card => card !== damageItem);
    if (handIndexToDamage === -1) return;
    const [handCard] = player.hand.splice(handIndexToDamage, 1);
    player.damage.push(handCard);
};

const buffPowerFromFirstToSecond: ActionImplementation = (ctx, params, targets) => {
    if (!targets || targets.length < 2) return;
    const sourceZone = targets[0] as UnitZoneState;
    const targetZone = targets[1] as UnitZoneState;
    if (!sourceZone?.unit || !targetZone?.unit) return;

    const sourceOwner = getOwnerOfZone(ctx.machine, sourceZone);
    if (!sourceOwner) return;
    const copiedPower = ctx.machine.getUnitPower(sourceZone, sourceOwner);

    targetZone.buffs.push({
        id: ctx.machine.createRuntimeId('BUFF'),
        sourceCard: ctx.sourceCard,
        type: 'POWER',
        value: copiedPower,
        mode: 'ADD',
        duration: params.duration || 'TURN_END'
    });
};

const damageAndExhaustSelected: ActionImplementation = (ctx, params, targets) => {
    targets.forEach(target => {
        if (!target || typeof target !== 'object' || !('unit' in target)) return;
        const zone = target as UnitZoneState;
        if (!zone.unit) return;
        zone.isExhausted = true;
        zone.hasAttacked = true;
    });

    const damageValue = params.damage || 1;
    if (damageValue > 0) {
        ctx.machine.dealDamage(ctx.opponent, damageValue);
    }
};

const buffPowerAndHitIfHand: ActionImplementation = (ctx, params, targets) => {
    const targetZone = (targets[0] as UnitZoneState | undefined) || ctx.unitZone;
    if (!targetZone?.unit) return;

    const powerValue = params.power || 0;
    if (powerValue !== 0) {
        targetZone.buffs.push({
            id: ctx.machine.createRuntimeId('BUFF'),
            sourceCard: ctx.sourceCard,
            type: 'POWER',
            value: powerValue,
            mode: 'ADD',
            duration: params.duration || 'TURN_END'
        });
    }

    const requiredHand = params.handCount || 5;
    if (ctx.player.hand.length >= requiredHand) {
        targetZone.buffs.push({
            id: ctx.machine.createRuntimeId('BUFF'),
            sourceCard: ctx.sourceCard,
            type: 'HIT',
            value: params.hit || 0,
            mode: 'ADD',
            duration: params.duration || 'TURN_END'
        });
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
    'BREAKTHROUGH': breakthrough,
    'RETURN_FROM_TRASH_AT_TURN_END': returnFromTrashAtTurnEnd,
    'DESTROY_UNIT_AND_DRAW_BY_HIT': destroyUnitAndDrawByHit,
    'DESTROY_UNIT_WITH_HIT_COST': destroyUnitWithHitCost,
    'COMPLEX_ACTION': complexAction,
    'SACRIFICE_TO_BUFF': sacrificeToBuff,
    'DAMAGE': damage,
    'DRAW_THEN_DISCARD': drawThenDiscard,
    'DESTROY_UNIT_AND_DRAW': destroyUnitAndDraw,
    'SEARCH_DECK_TO_HAND': searchDeckToHand,
    'RETURN_UNIT_AND_ITEMS_TO_HAND': returnUnitAndItemsToHand,
    'DRAW_BY_EQUIPPED_ITEM_COUNT': drawByEquippedItemCount,
    'DESTROY_SELECTED_AND_DESTROY_OPPONENT': destroySelectedAndDestroyOpponent,
    'DESTROY_EQUIPPED_ITEM': destroyEquippedItem,
    'RETURN_FIRST_EQUIPPED_ITEM_TO_HAND': returnFirstEquippedItemToHand,
    'MOVE_EQUIPPED_ITEM_TO_DECK_BOTTOM': moveEquippedItemToDeckBottom,
    'MOVE_FROM_TRASH_TO_DECK_TOP': moveFromTrashToDeckTop,
    'MOVE_FROM_TRASH_TO_DECK_BOTTOM': moveFromTrashToDeckBottom,
    'SWAP_DAMAGE_ITEM_WITH_HAND': swapDamageItemWithHand,
    'BUFF_POWER_FROM_FIRST_TO_SECOND': buffPowerFromFirstToSecond,
    'DAMAGE_AND_EXHAUST_SELECTED': damageAndExhaustSelected,
    'BUFF_POWER_AND_HIT_IF_HAND': buffPowerAndHitIfHand,
    'NONE': noneAction,
};
