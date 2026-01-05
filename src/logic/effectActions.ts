import { ActionImplementation, UnitZoneState } from './types';

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
        ctx.machine.drawCard(pIdx, count);
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
                id: Math.random().toString(36),
                sourceCard: ctx.sourceCard,
                type: 'POWER',
                value: value,
                duration: params.duration || 'TURN_END'
            });
            console.log(`Buffed ${target.unit.name} by ${value} Power.`);
        }
    });
};

const buffHit: ActionImplementation = (ctx, params, targets) => {
    targets.forEach(target => {
        if (target && target.unit) {
            const value = params.value || 0;
            target.buffs.push({
                id: Math.random().toString(36),
                sourceCard: ctx.sourceCard,
                type: 'HIT',
                value: value,
                duration: params.duration || 'TURN_END'
            });
            console.log(`Buffed ${target.unit.name} by ${value} Hit.`);
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
                            ctx.machine.destroyUnit(opponent, oppZone);
                        }
                    }
                }
                ctx.machine.destroyUnit(owner, target);
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
            if (myPower < oppPower) ctx.machine.destroyUnit(player, myZ);
            else if (oppPower < myPower) ctx.machine.destroyUnit(opponent, oppZ);
            else {
                ctx.machine.destroyUnit(player, myZ);
                ctx.machine.destroyUnit(opponent, oppZ);
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
            id: Math.random().toString(36),
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
            id: Math.random().toString(36),
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
                ctx.machine.destroyUnit(owner, killerZone);
            }
        }
    }
};

const terminateAttack: ActionImplementation = (ctx, _params, _targets) => {
    console.log("Attack Terminated by effect.");
    ctx.machine.state.attackTerminated = true;

    // Trash self (Defender)
    if (ctx.unitZone) {
        ctx.machine.destroyUnit(ctx.player, ctx.unitZone);
    }
};

const discard: ActionImplementation = (ctx, params, targets) => {
    const targetPlayer = params.target === 'OPPONENT' ? ctx.opponent : ctx.player;

    if (targets && targets.length > 0) {
        targets.forEach(card => {
            const idx = targetPlayer.hand.indexOf(card);
            if (idx !== -1) {
                targetPlayer.hand.splice(idx, 1);
                targetPlayer.trash.push(card);
                console.log(`${targetPlayer.name} discarded chosen card: ${card.name}`);
            }
        });
    } else {
        const count = params.count || 1;
        for (let i = 0; i < count; i++) {
            if (targetPlayer.hand.length > 0) {
                const card = targetPlayer.hand.shift()!;
                targetPlayer.trash.push(card);
                console.log(`${targetPlayer.name} discarded ${card.name} from hand (auto).`);
            }
        }
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
};

const destroyEncounter: ActionImplementation = (ctx, _params, targets) => {
    targets.forEach(targetZone => {
        const idx = ctx.player.unitZones.indexOf(targetZone);
        if (idx !== -1) {
            const oppZone = ctx.opponent.unitZones[idx];
            if (oppZone.unit) {
                const unitName = oppZone.unit.name;
                ctx.machine.destroyUnit(ctx.opponent, oppZone);
                console.log(`Trashed encounter unit ${unitName} in lane ${idx}`);
            }
        } else {
            const oppIdx = ctx.opponent.unitZones.indexOf(targetZone);
            if (oppIdx !== -1) {
                const myZone = ctx.player.unitZones[oppIdx];
                if (myZone.unit) {
                    ctx.machine.destroyUnit(ctx.player, myZone);
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
                id: Math.random().toString(36),
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
                id: Math.random().toString(36),
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
                ctx.machine.destroyUnit(owner, target);
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

    const revealed = deck.splice(-count);
    let chosen: any = null;

    // Filter logic: e.g., { trait: '베이스' }
    if (params.filter) {
        if (params.filter.trait) {
            chosen = revealed.find(c => c.traits?.includes(params.filter.trait));
        }
    }

    if (chosen) {
        // Remove chosen from revealed
        const idx = revealed.indexOf(chosen);
        revealed.splice(idx, 1);
        player.hand.push(chosen);
        console.log(`${player.name} chose ${chosen.name} from revealed cards.`);
    }

    // Shuffle rest back
    player.deck.push(...revealed);
    ctx.machine.shuffle(player.deck);
    console.log(`Shuffled remaining ${revealed.length} cards back into deck.`);
};

const revealTopAndTakeAllByFilter: ActionImplementation = (ctx, params) => {
    const player = ctx.player;
    const deck = player.deck;
    const count = params.count || 3;
    if (deck.length === 0) return;

    const revealed = deck.splice(-count);
    const toHand: any[] = [];
    const rest: any[] = [];

    revealed.forEach(card => {
        let match = false;
        if (params.filter) {
            if (params.filter.costMax !== undefined && card.cost <= params.filter.costMax) match = true;
        }
        if (match) toHand.push(card);
        else rest.push(card);
    });

    player.hand.push(...toHand);
    player.deck.push(...rest);
    ctx.machine.shuffle(player.deck);
    console.log(`${player.name} took ${toHand.length} cards to hand, shuffled ${rest.length} back.`);
};

const drawDynamic: ActionImplementation = (ctx, params) => {
    const player = ctx.player;
    let count = 0;
    if (params.multiplier === 'BASE_UNIT_COUNT') {
        count = player.unitZones.filter(z => z.unit && z.unit.traits?.includes('베이스')).length;
    }

    if (count > 0) {
        const pIdx = ctx.machine.state.players.indexOf(player);
        ctx.machine.drawCard(pIdx, count);
        console.log(`Drew ${count} cards dynamically.`);
    }
};

// Helper inside this module
function getOwnerOfZone(machine: any, zone: UnitZoneState): any {
    if (machine.state.players[0].unitZones.includes(zone)) return machine.state.players[0];
    if (machine.state.players[1].unitZones.includes(zone)) return machine.state.players[1];
    return null;
}

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
};
