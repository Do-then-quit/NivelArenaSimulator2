import { ActivationCondition, type Card, type GameContext, type PlayerState, type UnitZoneState } from '../../types';
import { TargetSelector } from '../../TargetSelector';
import type { DestroyReason } from './DestroyReplacementFlow';

export function processPassiveGrantedExitEffects(
    engine: any,
    destroyedOwner: PlayerState,
    destroyedZone: UnitZoneState,
    destroyedUnit: Card,
    killerCard?: Card,
    trashReason: DestroyReason = 'EFFECT',
    batchStep: number = engine.incrementAndGetGlobalStep(),
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
            source.card.effects.forEach((passive, passiveIndex) => {
                if (passive.activation !== ActivationCondition.PASSIVE) return;
                if (passive.action?.type !== 'GRANT_EFFECT') return;

                const granted = passive.action?.params?.effect;
                if (!granted || granted.activation !== ActivationCondition.EXIT) return;

                const sourceContext: GameContext = {
                    player: sourceOwner,
                    opponent: sourceOpponent,
                    sourceCard: source.card,
                    unitZone: source.zone,
                    machine: engine,
                    trashedUnit: destroyedUnit,
                    trashedUnitOwner: destroyedOwner,
                    trashReason,
                    destroyedBy: killerCard,
                };

                if (!engine.effectManager.checkCondition(passive, sourceContext)) return;
                if (passive.targets && !TargetSelector.isValidTarget(engine, passive.targets, sourceContext, destroyedZone)) return;

                const grantedContext: GameContext = {
                    player: destroyedOwner,
                    opponent: destroyedOwner === engine.state.players[0] ? engine.state.players[1] : engine.state.players[0],
                    sourceCard: destroyedUnit,
                    unitZone: destroyedZone,
                    machine: engine,
                    destroyedBy: killerCard,
                    trashReason,
                };

                engine.state.effectQueue.push({
                    effect: granted,
                    context: grantedContext,
                    id: engine.createRuntimeId(`GRANTED_EXIT_${passiveIndex}`),
                    creationTime: batchStep,
                    sourcePlayerId: destroyedOwner.id,
                });
            });
        });
    });
}

function queuePassiveGrantedOnKillEffects(
    engine: any,
    killerOwner: PlayerState,
    killerZone: UnitZoneState,
    trashedUnit: Card,
    trashedUnitOwner: PlayerState,
    trashReason: DestroyReason,
    killerCard: Card,
    batchStep: number,
) {
    if (!killerZone?.unit) return;
    const killerUnit = killerZone.unit;
    const killerOpponent = engine.getOpponentOf(killerOwner);

    const evaluateEffectList = (
        sourceOwner: PlayerState,
        sourceCard: Card,
        effects: any[] | undefined,
        sourceZone?: UnitZoneState,
    ) => {
        if (!sourceCard || !Array.isArray(effects) || effects.length <= 0) return;
        const sourceOpponent = engine.getOpponentOf(sourceOwner);

        effects.forEach((passive: any, passiveIndex: number) => {
            if (!passive || passive.activation !== ActivationCondition.PASSIVE) return;
            if (passive.action?.type !== 'GRANT_EFFECT') return;
            const granted = passive.action?.params?.effect;
            if (!granted || granted.activation !== ActivationCondition.ON_KILL) return;

            const sourceContext: GameContext = {
                player: sourceOwner,
                opponent: sourceOpponent,
                sourceCard,
                unitZone: sourceZone,
                machine: engine,
                trashedUnit,
                trashedUnitOwner,
                trashReason,
                destroyedBy: killerCard,
            };
            if (!engine.effectManager.checkCondition(passive, sourceContext)) return;
            if (passive.targets && !TargetSelector.isValidTarget(engine, passive.targets, sourceContext, killerZone)) return;

            const grantedContext: GameContext = {
                sourceCard: killerUnit,
                player: killerOwner,
                opponent: killerOpponent,
                unitZone: killerZone,
                machine: engine,
                trashedUnit,
                trashedUnitOwner,
                trashReason,
                destroyedBy: killerCard,
            };
            engine.state.effectQueue.push({
                effect: granted,
                context: grantedContext,
                id: engine.createRuntimeId(`GRANTED_ON_KILL_${passiveIndex}`),
                creationTime: batchStep,
                sourcePlayerId: killerOwner.id,
            });
        });
    };

    engine.state.players.forEach((sourceOwner: PlayerState) => {
        sourceOwner.unitZones.forEach(sourceZone => {
            if (sourceZone.unit) {
                evaluateEffectList(sourceOwner, sourceZone.unit, sourceZone.unit.effects || [], sourceZone);
                evaluateEffectList(sourceOwner, sourceZone.unit, sourceZone.temporaryEffects as any, sourceZone);
            }
            sourceZone.items.forEach(item => {
                evaluateEffectList(sourceOwner, item, item.effects || [], sourceZone);
            });
        });
        if (sourceOwner.levelZone) {
            evaluateEffectList(sourceOwner, sourceOwner.levelZone, sourceOwner.levelZone.effects || [], undefined);
        }
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
        const exitBatchStep = engine.incrementAndGetGlobalStep();

        // Evaluate passive "grant EXIT effect" auras while the unit is still on field,
        // then queue them to resolve with this destruction batch.
        engine.processPassiveGrantedExitEffects(player, zone, unit, killerCard, reason, exitBatchStep);

        // Remove from zone first to avoid recursive state inconsistencies while effects resolve.
        zone.unit = null;

        // 1) Queue unit/item EXIT effects in the same batch as granted EXIT effects.
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

        // 4) Queue ON_KILL effects for battle/effect kills with a known killer source.
        if ((reason === 'BATTLE' || reason === 'EFFECT') && killerCard) {
            const killerOwner = engine.state.players.find((candidate: PlayerState) =>
                candidate.unitZones.some((candidateZone: UnitZoneState) =>
                    candidateZone.unit === killerCard || candidateZone.items.includes(killerCard)
                )
            );
            if (killerOwner) {
                const killerZone = killerOwner.unitZones.find((candidateZone: UnitZoneState) =>
                    candidateZone.unit === killerCard || candidateZone.items.includes(killerCard)
                );
                if (killerZone?.unit) {
                    const killBatchStep = engine.incrementAndGetGlobalStep();
                    const killContextBase = {
                        player: killerOwner,
                        opponent: engine.getOpponentOf(killerOwner),
                        unitZone: killerZone,
                        machine: engine,
                        trashedUnit: trashedUnit,
                        trashedUnitOwner: player,
                        trashReason: reason,
                        destroyedBy: killerCard,
                    } as any;

                    engine.effectManager.processEffects(ActivationCondition.ON_KILL, {
                        ...killContextBase,
                        sourceCard: killerZone.unit,
                    }, { enqueueOnly: true, batchStep: killBatchStep });

                    killerZone.items.forEach((item: any) => {
                        engine.effectManager.processEffects(ActivationCondition.ON_KILL, {
                            ...killContextBase,
                            sourceCard: item,
                        }, { enqueueOnly: true, batchStep: killBatchStep });
                    });

                    queuePassiveGrantedOnKillEffects(
                        engine,
                        killerOwner,
                        killerZone,
                        trashedUnit,
                        player,
                        reason,
                        killerCard,
                        killBatchStep,
                    );
                    engine.sortEffectQueue();
                }
            }
        }

        engine.effectManager.processQueue();
    } finally {
        engine.destroyInProgressKeys.delete(destroyKey);
    }
}
