import { ActionImplementation, ActivationCondition, UnitZoneState } from '../types';
import { getOwnerOfZone } from './helpers';

export const buffPower: ActionImplementation = (ctx, params, targets) => {
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
                value,
                mode: params.mode || 'ADD',
                duration: params.duration || 'TURN_END'
            });
            console.log(`Buffed ${target.unit.name} to ${value} Power (Mode: ${params.mode || 'ADD'}).`);
        }
    });
};

export const buffHit: ActionImplementation = (ctx, params, targets) => {
    targets.forEach(target => {
        if (target && target.unit) {
            const value = params.value || 0;
            target.buffs.push({
                id: ctx.machine.createRuntimeId('BUFF'),
                sourceCard: ctx.sourceCard,
                type: 'HIT',
                value,
                mode: params.mode || 'ADD',
                duration: params.duration || 'TURN_END'
            });
            console.log(`Buffed ${target.unit.name} to ${value} Hit (Mode: ${params.mode || 'ADD'}).`);
        }
    });
};

export const grantEffect: ActionImplementation = (_ctx, params, targets) => {
    targets.forEach(target => {
        if (target && 'temporaryEffects' in target) {
            const effect = params.effect;
            if (effect) {
                const actionDurationOverride = effect.actionDurationOverride ?? effect.duration;
                target.temporaryEffects.push({
                    ...effect,
                    duration: params.duration || 'TURN_END',
                    actionDurationOverride
                });
                console.log(`Granted effect to ${target.unit?.name}: ${effect.description}`);
            }
        }
    });
};

export const setPower: ActionImplementation = (ctx, params, targets) => {
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

export const buffPowerAndDrawIfTrashed: ActionImplementation = (ctx, params, targets) => {
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

export const lockAttackUntilTurnEnd: ActionImplementation = (_ctx, _params, targets) => {
    targets.forEach(target => {
        if (!target || !('unit' in target) || !target.unit) return;
        target.hasAttacked = true;
        target.attackCountThisTurn = Math.max(1, target.attackCountThisTurn || 0);
        target.extraAttackAllowance = 0;
        target.isExhausted = true;
    });
};

export const grantExtraAttackThisTurn: ActionImplementation = (_ctx, params, targets) => {
    const value = Math.max(0, params.value ?? 1);
    if (value <= 0) return;
    targets.forEach(target => {
        if (!target || !('unit' in target) || !target.unit) return;
        target.extraAttackAllowance = (target.extraAttackAllowance || 0) + value;
    });
};

export const applyDualistMark: ActionImplementation = (_ctx, params, targets) => {
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

export const applyInfiltrationMark: ActionImplementation = (_ctx, params, targets) => {
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

export const sacrificeToBuff: ActionImplementation = (ctx, params, targets) => {
    if (!targets || targets.length < 2) {
        console.warn('SACRIFICE_TO_BUFF requires at least 2 targets.');
        return;
    }

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
            value,
            duration: params.duration || 'TURN_END'
        });
        console.log(`Buffed ${buffTarget.unit.name} by ${value} Power.`);
    }
};
