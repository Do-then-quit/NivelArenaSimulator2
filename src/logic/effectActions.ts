import { ActionImplementation, GameContext, UnitZoneState } from './types';

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
            if (owner) ctx.machine.destroyUnit(owner, target);
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
    if (!ctx.destroyedBy || !ctx.sourceCard) return;

    const killerCost = ctx.destroyedBy.cost;
    const myCost = ctx.sourceCard.cost;

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

const discard: ActionImplementation = (ctx, params) => {
    const targetPlayer = params.target === 'OPPONENT' ? ctx.opponent : ctx.player;
    const count = params.count || 1;
    for (let i = 0; i < count; i++) {
        if (targetPlayer.hand.length > 0) {
            const card = targetPlayer.hand.shift()!;
            targetPlayer.trash.push(card);
            console.log(`${targetPlayer.name} discarded ${card.name} from hand.`);
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
};
