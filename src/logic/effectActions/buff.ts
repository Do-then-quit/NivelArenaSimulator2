import { ActionImplementation, ActivationCondition, UnitZoneState } from '../types';
import { getOwnerOfZone } from './helpers';

function resolveOwnerTurnEndUntilTurnCount(ctx: any, target: any): number {
    const owner = getOwnerOfZone(ctx.machine, target);
    if (!owner) return ctx.machine.state.turnCount;
    const isOwnersTurn = ctx.machine.currentPlayer?.id === owner.id;
    return ctx.machine.state.turnCount + (isOwnersTurn ? 0 : 1);
}

function resolveSourceOwnerTurnEndUntilTurnCount(ctx: any): number {
    const isSourceOwnersTurn = ctx.machine.currentPlayer?.id === ctx.player.id;
    return ctx.machine.state.turnCount + (isSourceOwnersTurn ? 0 : 1);
}

function resolveSourceOwnerNextTurnEndUntilTurnCount(ctx: any): number {
    const isSourceOwnersTurn = ctx.machine.currentPlayer?.id === ctx.player.id;
    return ctx.machine.state.turnCount + (isSourceOwnersTurn ? 2 : 1);
}

export const buffPower: ActionImplementation = (ctx, params, targets) => {
    targets.forEach(target => {
        if (target && target.unit) {
            let value = params.value || 0;
            if (params.dynamic === 'LEADER_LEVEL_MULTIPLIER') {
                value = ctx.player.leaderLevel * value;
            } else if (params.dynamic === 'MY_HAND_COUNT_MULTIPLIER') {
                value = ctx.player.hand.length * value;
            } else if (params.dynamic === 'HAND_COUNT_DIFF_MULTIPLIER') {
                value = Math.abs(ctx.player.hand.length - ctx.opponent.hand.length) * value;
            } else if (params.dynamic === 'DAMAGE_COUNT_MULTIPLIER') {
                const damageCount = typeof ctx.machine?.getEffectiveDamageCount === 'function'
                    ? ctx.machine.getEffectiveDamageCount(ctx.player, ctx)
                    : ctx.player.damage.length;
                value = damageCount * value;
            } else if (params.dynamic === 'TOTAL_DAMAGE_COUNT_MULTIPLIER') {
                const myDamageCount = typeof ctx.machine?.getEffectiveDamageCount === 'function'
                    ? ctx.machine.getEffectiveDamageCount(ctx.player, ctx)
                    : ctx.player.damage.length;
                value = (myDamageCount + ctx.opponent.damage.length) * value;
            } else if (params.dynamic === 'DAMAGE_TRAIT_COUNT_MULTIPLIER') {
                const trait = typeof params.trait === 'string' ? params.trait : '';
                const damageTraitCount = trait && typeof ctx.machine?.getDamageTraitCount === 'function'
                    ? ctx.machine.getDamageTraitCount(ctx.player, trait)
                    : 0;
                value = damageTraitCount * value;
            } else if (params.dynamic === 'TRASHED_CARD_COST_MULTIPLIER') {
                const trashedCardCost = Math.max(
                    0,
                    Number(
                        params.trashedCardCost ??
                        ctx.flags?.trashedCardCost ??
                        (ctx.trashedUnit ? ctx.machine.getCardCost(ctx.trashedUnit) : 0)
                    ) || 0
                );
                value = trashedCardCost * value;
            }

            const untilOwnerTurnEnd = params.untilOwnerTurnEnd === true;
            const untilSourceOwnerTurnEnd = params.untilSourceOwnerTurnEnd === true;
            const duration = (untilOwnerTurnEnd || untilSourceOwnerTurnEnd) ? 'PERMANENT' : (params.duration || 'TURN_END');
            const untilTurnCount = untilOwnerTurnEnd
                ? resolveOwnerTurnEndUntilTurnCount(ctx, target)
                : (untilSourceOwnerTurnEnd ? resolveSourceOwnerTurnEndUntilTurnCount(ctx) : undefined);

            target.buffs.push({
                id: ctx.machine.createRuntimeId('BUFF'),
                sourceCard: ctx.sourceCard,
                type: 'POWER',
                value,
                mode: params.mode || 'ADD',
                duration,
                ...(typeof untilTurnCount === 'number' ? { untilTurnCount } : {}),
            });
            console.log(`Buffed ${target.unit.name} to ${value} Power (Mode: ${params.mode || 'ADD'}).`);
        }
    });
};

export const buffHit: ActionImplementation = (ctx, params, targets) => {
    targets.forEach(target => {
        if (target && target.unit) {
            const value = params.value || 0;
            const untilSourceOwnerTurnEnd = params.untilSourceOwnerTurnEnd === true;
            target.buffs.push({
                id: ctx.machine.createRuntimeId('BUFF'),
                sourceCard: ctx.sourceCard,
                type: 'HIT',
                value,
                mode: params.mode || 'ADD',
                duration: untilSourceOwnerTurnEnd ? 'PERMANENT' : (params.duration || 'TURN_END'),
                ...(untilSourceOwnerTurnEnd ? { untilTurnCount: resolveSourceOwnerTurnEndUntilTurnCount(ctx) } : {}),
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
                const nextSourceOwnerTurnEnd = params.untilSourceOwnerNextTurnEnd === true;
                const untilTurnCount = nextSourceOwnerTurnEnd
                    ? resolveSourceOwnerNextTurnEndUntilTurnCount(_ctx)
                    : undefined;
                const actionParams = {
                    ...(effect.action?.params || {}),
                    ...(typeof untilTurnCount === 'number' ? { untilTurnCount } : {}),
                };
                const actionDurationOverride =
                    effect.actionDurationOverride !== undefined
                        ? effect.actionDurationOverride
                        : (effect.duration && effect.duration !== 'TURN_END' ? effect.duration : undefined);
                target.temporaryEffects.push({
                    ...effect,
                    duration: nextSourceOwnerTurnEnd ? 'PERMANENT' : (params.duration || 'TURN_END'),
                    action: {
                        ...effect.action,
                        params: actionParams,
                    },
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
                        ctx.machine.drawCard(pIdx, drawCount, {
                            reason: 'EFFECT',
                            sourceActivation: params?.__sourceActivation,
                        });
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
    const value = Math.max(1, Number(params.value ?? 1));
    targets.forEach(target => {
        if (!target || !('temporaryEffects' in target) || !target.unit) return;
        target.temporaryEffects.push({
            activation: ActivationCondition.ATTACKER,
            description: `어태커 : 침투[${value}]`,
            action: { type: 'NONE', params: { infiltrationValue: value } },
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
