import { ActionImplementation, CardType, UnitZoneState } from '../types';
import { getOwnerOfZone } from './helpers';

export const destroyUnit: ActionImplementation = (ctx, params, targets) => {
    targets.forEach(target => {
        if (target && target.unit) {
            if (params.costMax !== undefined && (target.unit.cost || 0) > params.costMax) return;

            const owner = getOwnerOfZone(ctx.machine, target);
            if (owner) {
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

export const destroyLaneLowest: ActionImplementation = (ctx, _params, _targets) => {
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

export const penetration: ActionImplementation = (ctx, params, _targets) => {
    if (ctx.unitZone) {
        ctx.unitZone.buffs.push({
            id: ctx.machine.createRuntimeId('BUFF'),
            sourceCard: ctx.sourceCard,
            type: 'PENETRATION',
            value: params.value || 0,
            duration: params.duration || 'TURN_END'
        });
        console.log(`Granted PENETRATION[${params.value}] to ${ctx.unitZone.unit?.name}`);
    }
};

export const plunder: ActionImplementation = (ctx, params, _targets) => {
    if (ctx.unitZone) {
        ctx.unitZone.buffs.push({
            id: ctx.machine.createRuntimeId('BUFF'),
            sourceCard: ctx.sourceCard,
            type: 'PLUNDER',
            value: params.value || 0,
            duration: params.duration || 'TURN_END'
        });
        console.log(`Granted PLUNDER[${params.value}] to ${ctx.unitZone.unit?.name}`);
    }
};

export const mutualDestruction: ActionImplementation = (ctx, _params, _targets) => {
    if (!ctx.destroyedBy) return;

    const killerCost = ctx.destroyedBy.cost;
    const myCost = ctx.unitZone?.unit?.cost ?? ctx.sourceCard?.cost;

    if (myCost === undefined) return;

    if (killerCost <= myCost) {
        console.log(`Mutual Destruction triggered! Trash killer ${ctx.destroyedBy.name} (Cost ${killerCost} <= ${myCost})`);

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

export const terminateAttack: ActionImplementation = (ctx, _params, _targets) => {
    console.log('Attack Terminated by effect.');
    ctx.machine.state.attackTerminated = true;

    if (ctx.unitZone) {
        ctx.machine.destroyUnit(ctx.player, ctx.unitZone, undefined, 'EFFECT');
    }
};

export const destroyEncounter: ActionImplementation = (ctx, params, targets) => {
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
                triggerReason: '인카운터 파괴 코스트 처리',
                selectionPurpose: '아이템 패 코스트 지불',
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

export const destroyUnitAndDrawByHit: ActionImplementation = (ctx, params, targets) => {
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
        ctx.machine.drawCard(controllerIdx, hit, {
            reason: 'EFFECT',
            sourceActivation: params?.__sourceActivation,
        });
        console.log(`Destroyed ${unit.name} and drew ${hit} cards.`);
    }
};

export const destroyUnitWithHitCost: ActionImplementation = (ctx, params, targets) => {
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

    ctx.machine.state.interactionMode = 'SELECT_COST';
    ctx.machine.state.pendingEffect = {
        sourceCard: ctx.sourceCard,
        sourcePlayerId: ctx.player.id,
        controllerPlayerId: ctx.player.id,
        actionType: 'DESTROY_UNIT_WITH_HIT_COST',
        actionValue: { hitCost: hit },
        effectDescription: 'Destroy selected unit after paying hit cost',
        sourceActivation: params?.__sourceActivation,
        triggerReason: '유닛 파괴 코스트 처리',
        selectionPurpose: '히트만큼 패 코스트 지불',
        costToPay: { type: 'TRASH_HAND', amount: hit },
        costPaidCount: 0,
        selectedTargets: [targetZone]
    };
    ctx.machine.setPendingRuntime(ctx, null);
    ctx.machine.setInteractionOwner(ctx.player.id);
    console.log(`Entered Cost Selection Mode for ${ctx.sourceCard.name}`);
};

export const drawByTargetHit: ActionImplementation = (ctx, params, targets) => {
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
    ctx.machine.drawCard(pIdx, totalDraw, {
        reason: 'EFFECT',
        sourceActivation: params?.__sourceActivation,
    });
};

export const breakthrough: ActionImplementation = (_ctx, _params, _targets) => {
    // Breakthrough is handled by GameEngine.getBreakthroughLimit directly
};

export const destroyUnitAndDraw: ActionImplementation = (ctx, params, targets) => {
    if (!targets[0]) return;
    const targetZone = targets[0] as UnitZoneState;
    const unit = targetZone.unit;
    if (!unit) return;

    const owner = getOwnerOfZone(ctx.machine, targetZone);
    const drawCount = params.drawCount || 1;

    ctx.machine.destroyUnit(owner, targetZone, undefined, 'EFFECT');
    console.log(`Destroyed ${unit.name} for DESTROY_UNIT_AND_DRAW effect.`);

    const pIdx = ctx.machine.state.players.indexOf(ctx.player);
    ctx.machine.drawCard(pIdx, drawCount, {
        reason: 'EFFECT',
        sourceActivation: params?.__sourceActivation,
    });
    console.log(`Drew ${drawCount} card(s) after destroying unit.`);
};
