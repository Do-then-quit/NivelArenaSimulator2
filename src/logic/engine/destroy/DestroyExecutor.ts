import { ActivationCondition, type Card, type GameContext, type PlayerState, type UnitZoneState } from '../../types';
import { TargetSelector } from '../../TargetSelector';
import type { DestroyReason } from './DestroyReplacementFlow';

export function processPassiveGrantedExitEffects(
    engine: any,
    destroyedOwner: PlayerState,
    destroyedZone: UnitZoneState,
    destroyedUnit: Card,
    killerCard?: Card
) {
    engine.state.players.forEach((sourceOwner: PlayerState) => {
        const sourceOpponent = sourceOwner === engine.state.players[0] ? engine.state.players[1] : engine.state.players[0];
        const sources: { card: Card; zone?: UnitZoneState }[] = [];

        sourceOwner.unitZones.forEach(sourceZone => {
            if (sourceZone.unit) sources.push({ card: sourceZone.unit, zone: sourceZone });
            sourceZone.items.forEach(item => sources.push({ card: item, zone: sourceZone }));
        });
        if (sourceOwner.levelZone) sources.push({ card: sourceOwner.levelZone });

        sources.forEach(source => {
            if (!source.card.effects) return;
            source.card.effects.forEach(passive => {
                if (passive.activation !== ActivationCondition.PASSIVE) return;
                if (passive.action?.type !== 'GRANT_EFFECT') return;

                const granted = passive.action?.params?.effect;
                if (!granted || granted.activation !== ActivationCondition.EXIT) return;

                const sourceContext: GameContext = {
                    player: sourceOwner,
                    opponent: sourceOpponent,
                    sourceCard: source.card,
                    unitZone: source.zone,
                    machine: engine
                };

                if (!engine.effectManager.checkCondition(passive, sourceContext)) return;
                if (passive.targets && !TargetSelector.isValidTarget(engine, passive.targets, sourceContext, destroyedZone)) return;

                const grantedContext: GameContext = {
                    player: destroyedOwner,
                    opponent: destroyedOwner === engine.state.players[0] ? engine.state.players[1] : engine.state.players[0],
                    sourceCard: destroyedUnit,
                    unitZone: destroyedZone,
                    machine: engine,
                    destroyedBy: killerCard
                };

                engine.effectManager.executeEffect(granted, grantedContext, [destroyedZone]);
            });
        });
    });
}

export function destroyUnit(
    engine: any,
    player: PlayerState,
    zone: UnitZoneState,
    killerCard?: Card,
    reason: DestroyReason = 'EFFECT',
    options: { skipReplacement?: boolean } = {},
) {
    if (!zone.unit) return;

    if (!options.skipReplacement && engine.tryInitiateDestroyReplacement(player, zone, killerCard, reason)) {
        return;
    }

    const unit = zone.unit;
    const destroyKey = engine.getDestroyGuardKey(player, zone, unit);
    if (engine.destroyInProgressKeys.has(destroyKey)) {
        return;
    }

    engine.destroyInProgressKeys.add(destroyKey);
    try {
        const opponent = engine.getOpponentOf(player);

        // Apply passive "grant EXIT effect" auras before removing the unit from the zone.
        engine.processPassiveGrantedExitEffects(player, zone, unit, killerCard);

        // Remove from zone first to avoid recursive state inconsistencies while effects resolve.
        zone.unit = null;

        // 1) Queue EXIT effects in a single batch.
        const exitBatchStep = engine.incrementAndGetGlobalStep();
        const equippedItemsSnapshot = [...zone.items];
        engine.effectManager.processEffects(ActivationCondition.EXIT, {
            sourceCard: unit,
            player: player,
            opponent: opponent,
            unitZone: zone,
            machine: engine,
            destroyedBy: killerCard,
            trashReason: reason,
            flags: {
                equippedItemsSnapshot,
                destroyedUnitId: unit.id,
            },
        }, { enqueueOnly: true, batchStep: exitBatchStep });

        zone.items.forEach(item => {
            engine.effectManager.processEffects(ActivationCondition.EXIT, {
                sourceCard: item,
                player: player,
                opponent: opponent,
                unitZone: zone,
                machine: engine,
                destroyedBy: killerCard,
                trashedUnit: unit,
                trashReason: reason,
                flags: {
                    equippedItemsSnapshot,
                    destroyedUnitId: unit.id,
                },
            }, { enqueueOnly: true, batchStep: exitBatchStep });
        });

        // 2) Move cards to trash and clear lane state.
        player.trash.push(unit);
        const trashedUnit = unit;
        zone.items.forEach(i => player.trash.push(i));
        zone.items = [];
        zone.buffs = [];
        zone.temporaryEffects = [];
        zone.attackCountThisTurn = 0;
        zone.extraAttackAllowance = 0;
        zone.hasAttacked = false;
        if (reason === 'EFFECT' || reason === 'RULE') {
            engine.incrementEffectTrashedFriendlyUnitCount(player.id);
        }

        // 3) Queue UNIT_TRASHED effects as one simultaneous event in turn-player priority order.
        const trashedBatchStep = engine.incrementAndGetGlobalStep();
        const [turnPlayer, nonTurnPlayer] = engine.getPlayersInTurnOrder();
        [turnPlayer, nonTurnPlayer].forEach((p: PlayerState) => {
            const sourceOpponent = engine.getOpponentOf(p);

            if (p.levelZone) {
                engine.effectManager.processEffects(ActivationCondition.UNIT_TRASHED, {
                    sourceCard: p.levelZone,
                    player: p,
                    opponent: sourceOpponent,
                    machine: engine,
                    trashedUnit: trashedUnit,
                    trashedUnitOwner: player,
                    trashReason: reason,
                    flags: {
                        destroyedUnitId: trashedUnit.id,
                    },
                }, { enqueueOnly: true, batchStep: trashedBatchStep });
            }

            p.unitZones.forEach(z => {
                if (!z.unit) return;
                engine.effectManager.processEffects(ActivationCondition.UNIT_TRASHED, {
                    sourceCard: z.unit,
                    player: p,
                    opponent: sourceOpponent,
                    unitZone: z,
                    machine: engine,
                    trashedUnit: trashedUnit,
                    trashedUnitOwner: player,
                    trashReason: reason,
                    flags: {
                        destroyedUnitId: trashedUnit.id,
                    },
                }, { enqueueOnly: true, batchStep: trashedBatchStep });
            });
        });

        engine.effectManager.processQueue();
    } finally {
        engine.destroyInProgressKeys.delete(destroyKey);
    }
}
