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
                const actionDurationOverride =
                    effect.actionDurationOverride !== undefined
                        ? effect.actionDurationOverride
                        : (effect.duration && effect.duration !== 'TURN_END' ? effect.duration : undefined);
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
            const owner = getOwnerOfZone(ctx.machine, target);
            if (!owner) return;

            const oldValue = ctx.machine.getUnitPower(target, owner);
            const buffValue = params.value || 0;
            const unitBeforeDestroy = target.unit;

            target.buffs.push({
                id: ctx.machine.createRuntimeId('BUFF'),
                sourceCard: ctx.sourceCard,
                type: 'POWER',
                value: buffValue,
                duration: params.duration || 'TURN_END'
            });

            console.log(`Buffed ${target.unit.name} by ${buffValue} Power.`);

            const newValue = ctx.machine.getUnitPower(target, owner);
            if (oldValue > 0 && newValue <= 0) {
                console.log(`Effect caused ${target.unit.name} to have 0 or less power. Attempting destruction.`);
                ctx.machine.destroyUnit(owner, target, undefined, 'EFFECT');

                const removedFromZone = target.unit !== unitBeforeDestroy;
                const movedToTrash = owner.trash.includes(unitBeforeDestroy);

                if (removedFromZone && movedToTrash) {
                    if (params.setContextFlagOnTrashed) {
                        ctx.flags = ctx.flags || {};
                        ctx.flags[params.setContextFlagOnTrashed] = true;
                    }
                    const pIdx = ctx.machine.state.players.indexOf(ctx.player);
                    const drawCount = params.drawCount ?? 1;
                    if (drawCount > 0) {
                        ctx.machine.drawCard(pIdx, drawCount);
                    }
                }
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
