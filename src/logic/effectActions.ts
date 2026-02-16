import { ActionImplementation, UnitZoneState, ActivationCondition, CardType } from './types';
import { TargetSelector } from './TargetSelector';

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
        ctx.machine.notifyHandTrashed(targetPlayer, trashedCards, {
            flags: {
                handTrashByEffect: !params.isRule,
            },
        });
    }
};

const discardAll: ActionImplementation = (ctx, _params) => {
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

const destroyEncounter: ActionImplementation = (ctx, params, targets) => {
    if (params.requireHandItemCostByEncounterHit) {
        if (!ctx.unitZone) return;
        const laneIndex = ctx.player.unitZones.indexOf(ctx.unitZone);
        if (laneIndex < 0) return;
        const encounterZone = ctx.opponent.unitZones[laneIndex];
        if (!encounterZone?.unit) return;

        const requiredCount = Math.max(0, ctx.machine.getUnitHit(encounterZone, ctx.opponent));
        if (requiredCount > 0) {
            const payableItemCount = ctx.player.hand.filter((card: any) => card.type === CardType.ITEM).length;
            if (payableItemCount < requiredCount) {
                console.log(
                    `Cannot resolve DESTROY_ENCOUNTER cost (${payableItemCount}/${requiredCount}) for ${ctx.sourceCard.name}.`
                );
                return;
            }

            ctx.machine.state.interactionMode = 'SELECT_COST';
            ctx.machine.state.pendingEffect = {
                sourceCard: ctx.sourceCard,
                sourcePlayerId: ctx.player.id,
                controllerPlayerId: ctx.player.id,
                actionType: 'DESTROY_ENCOUNTER_WITH_HIT_COST',
                actionValue: { zoneIndex: laneIndex, requiredCount },
                effectDescription: 'Pay item hand cost to destroy encounter',
                costToPay: { type: 'TRASH_HAND', amount: requiredCount, cardTypeFilter: CardType.ITEM },
                costCardTypeFilter: CardType.ITEM,
                costPaidCount: 0,
                selectedTargets: [],
            };
            ctx.machine.setPendingRuntime(ctx, null);
            ctx.machine.setInteractionOwner(ctx.player.id);
            return;
        }

        ctx.machine.destroyUnit(ctx.opponent, encounterZone, undefined, 'EFFECT');
        return;
    }

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

const drawDynamic: ActionImplementation = (ctx, params, targets) => {
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
        ctx.machine.drawCard(pIdx, count);
        console.log(`Drew ${count} cards dynamically.`);
    }
};

const returnUnitAndItemsToHand: ActionImplementation = (ctx, _params, targets) => {
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

const destroyItem: ActionImplementation = (ctx, _params, targets) => {
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

const returnItemToHand: ActionImplementation = (ctx, params, targets) => {
    if ((!targets || targets.length === 0) && params.fromEquippedSnapshot && Array.isArray(ctx.flags?.equippedItemsSnapshot)) {
        const owner = ctx.player;
        const snapshot = (ctx.flags?.equippedItemsSnapshot ?? []) as any[];
        const card = snapshot[0];
        const trashIndex = owner.trash.indexOf(card);
        if (trashIndex !== -1) {
            owner.trash.splice(trashIndex, 1);
            owner.hand.push(card);
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

const moveItemToDeckBottom: ActionImplementation = (ctx, _params, targets) => {
    targets.forEach(itemCard => {
        const located = findItemLocation(ctx.machine, itemCard);
        if (!located) return;
        const { owner, zone, itemIndex } = located;
        const [removed] = zone.items.splice(itemIndex, 1);
        if (removed) owner.deck.unshift(removed);
    });
};

const moveFromDamageToHand: ActionImplementation = (ctx, _params, targets) => {
    targets.forEach(card => {
        const owner = ctx.machine.state.players.find((player: any) => player.damage.includes(card));
        if (!owner) return;
        const idx = owner.damage.indexOf(card);
        if (idx === -1) return;
        owner.damage.splice(idx, 1);
        owner.hand.push(card);
    });
};

const moveFromHandToDamage: ActionImplementation = (ctx, _params, targets) => {
    targets.forEach(card => {
        const owner = ctx.machine.state.players.find((player: any) => player.hand.includes(card));
        if (!owner) return;
        const idx = owner.hand.indexOf(card);
        if (idx === -1) return;
        owner.hand.splice(idx, 1);
        owner.damage.push(card);
    });
};

const moveFromTrashToDeckTop: ActionImplementation = (ctx, _params, targets) => {
    targets.forEach(card => {
        const idx = ctx.player.trash.indexOf(card);
        if (idx === -1) return;
        const [removed] = ctx.player.trash.splice(idx, 1);
        if (removed) ctx.player.deck.push(removed);
    });
};

const moveFromTrashToDeckBottom: ActionImplementation = (ctx, params, targets) => {
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

const drawByTargetHit: ActionImplementation = (ctx, params, targets) => {
    let totalDraw = 0;
    if (params.source === 'COST_PAYMENT' || params.fromCostPayment) {
        totalDraw = Math.max(0, ctx.costPaymentCard?.hit || 0);
    } else {
        targets.forEach(target => {
            if (target && target.unit) {
                const owner = getOwnerOfZone(ctx.machine, target);
                if (!owner) return;
                totalDraw += Math.max(0, ctx.machine.getUnitHit(target, owner));
                return;
            }
            if (target && typeof target === 'object' && 'hit' in target) {
                totalDraw += Math.max(0, (target.hit as number) || 0);
            }
        });
    }

    if (totalDraw <= 0) return;
    const pIdx = ctx.machine.state.players.indexOf(ctx.player);
    ctx.machine.drawCard(pIdx, totalDraw);
};

const lockAttackUntilTurnEnd: ActionImplementation = (_ctx, _params, targets) => {
    targets.forEach(target => {
        if (!target || !('unit' in target) || !target.unit) return;
        target.hasAttacked = true;
        target.isExhausted = true;
    });
};

const applyDualistMark: ActionImplementation = (_ctx, params, targets) => {
    targets.forEach(target => {
        if (!target || !('temporaryEffects' in target) || !target.unit) return;
        target.temporaryEffects.push({
            activation: ActivationCondition.ATTACKER,
            description: '어태커 : 듀얼리스트',
            action: { type: 'NONE', params: {} },
            duration: params.duration || 'TURN_END',
        });
    });
};

const applyInfiltrationMark: ActionImplementation = (_ctx, params, targets) => {
    targets.forEach(target => {
        if (!target || !('temporaryEffects' in target) || !target.unit) return;
        target.temporaryEffects.push({
            activation: ActivationCondition.ATTACKER,
            description: '어태커 : 침투[1]',
            action: { type: 'NONE', params: {} },
            duration: params.duration || 'TURN_END',
        });
    });
};

const revealTopPickToHandThenOrderBottom: ActionImplementation = (ctx, params) => {
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

const noneAction: ActionImplementation = () => {
    // Intentionally no-op. Used for effects that only gate costs/timing.
};

// Helper inside this module
function getOwnerOfZone(machine: any, zone: UnitZoneState): any {
    if (machine.state.players[0].unitZones.includes(zone)) return machine.state.players[0];
    if (machine.state.players[1].unitZones.includes(zone)) return machine.state.players[1];
    return null;
}

function zoneHasKeyword(zone: UnitZoneState, keyword: string): boolean {
    if (!zone.unit) return false;
    if (zone.unit.keywords?.includes(keyword)) return true;
    if (zone.unit.effects?.some((effect: any) => (effect.description || '').includes(keyword))) return true;
    if (zone.items.some(item => item.keywords?.includes(keyword) || item.effects?.some((effect: any) => (effect.description || '').includes(keyword)))) return true;
    if (zone.temporaryEffects.some((effect: any) => (effect.description || '').includes(keyword))) return true;
    return false;
}

function findItemLocation(machine: any, itemCard: any): { owner: any; zone: UnitZoneState; zoneIndex: number; itemIndex: number } | null {
    for (const owner of machine.state.players) {
        for (let zoneIndex = 0; zoneIndex < owner.unitZones.length; zoneIndex++) {
            const zone = owner.unitZones[zoneIndex];
            const itemIndex = zone.items.indexOf(itemCard);
            if (itemIndex !== -1) {
                return { owner, zone, zoneIndex, itemIndex };
            }
        }
    }
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
            scope: 'REVEALED',
            type: 'CARD',
            count: discardCount,
            selectMode: 'MANUAL'
        }
    } as any;

    // Now, initiate discard selection from drawn cards
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
