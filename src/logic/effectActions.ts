import { ActionImplementation, GameContext, UnitZoneState } from './types';

const gainLevel: ActionImplementation = (ctx, params) => {
    const amount = params.value || 1;
    ctx.player.leaderLevel = Math.min(10, ctx.player.leaderLevel + amount);
    console.log(`${ctx.player.name} gained ${amount} level(s).`);
};

const drawCard: ActionImplementation = (ctx, params) => {
    const count = params.count || 1;
    const pIdx = ctx.machine.state.players.indexOf(ctx.player);
    ctx.machine.drawCard(pIdx, count);
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
};
