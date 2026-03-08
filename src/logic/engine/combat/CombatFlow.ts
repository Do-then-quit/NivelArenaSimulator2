import { ActivationCondition, Phase, type Card, type Effect, type GameContext, type UnitZoneState } from '../../types';
import { TargetSelector } from '../../TargetSelector';

interface GuardianBlockItemCost {
    itemName?: string;
    itemCardId?: string;
    count: number;
}

interface GuardianBlockUnitSacrificeCost {
    unitName?: string;
    unitCardId?: string;
    count: number;
}

function getRequiredHandDiscardForBlockByHitDiff(
    engine: any,
    attackerZone: UnitZoneState,
    blockerZone: UnitZoneState
): number {
    if (!attackerZone?.unit || !blockerZone?.unit) return 0;

    const effectSources: Array<{ sourceCard: Card; effect: Effect }> = [];
    if (attackerZone.unit.effects) {
        attackerZone.unit.effects.forEach(effect => effectSources.push({ sourceCard: attackerZone.unit!, effect }));
    }
    attackerZone.items.forEach(item => {
        if (item.effects) {
            item.effects.forEach(effect => effectSources.push({ sourceCard: item, effect }));
        }
    });
    attackerZone.temporaryEffects.forEach(effect => {
        effectSources.push({ sourceCard: attackerZone.unit!, effect });
    });

    const hasRestriction = effectSources.some(({ sourceCard, effect }) => {
        if (!effect) return false;
        if (effect.action?.type !== 'NONE') return false;
        if (effect.action?.params?.requireBlockHandDiscardByHitDiff !== true) return false;
        if (effect.activation !== ActivationCondition.ATTACKER && effect.activation !== ActivationCondition.PASSIVE) return false;

        const context: GameContext = {
            sourceCard,
            player: engine.currentPlayer,
            opponent: engine.opponentPlayer,
            unitZone: attackerZone,
            machine: engine,
        };
        return engine.effectManager.checkCondition(effect, context);
    });

    if (!hasRestriction) return 0;

    const attackerHit = Math.max(0, engine.getUnitHit(attackerZone, engine.currentPlayer));
    const blockerHit = Math.max(0, engine.getUnitHit(blockerZone, engine.opponentPlayer));
    if (blockerHit >= attackerHit) return 0;
    return attackerHit - blockerHit;
}

function queuePassiveGrantedDefenderEffects(
    engine: any,
    defenderOwner: any,
    defenderZone: UnitZoneState,
    batchStep: number,
) {
    if (!defenderZone?.unit) return;
    const defenderUnit = defenderZone.unit;
    const defenderOpponent = engine.getOpponentOf(defenderOwner);

    const evaluateEffectList = (sourceOwner: any, sourceCard: Card, effects: Effect[] | undefined, sourceZone?: UnitZoneState) => {
        if (!sourceCard || !Array.isArray(effects) || effects.length <= 0) return;
        const sourceOpponent = engine.getOpponentOf(sourceOwner);

        effects.forEach((passive: any, passiveIndex: number) => {
            if (!passive || passive.activation !== ActivationCondition.PASSIVE) return;
            if (passive.action?.type !== 'GRANT_EFFECT') return;
            const granted = passive.action?.params?.effect;
            if (!granted || granted.activation !== ActivationCondition.DEFENDER) return;

            const sourceContext: GameContext = {
                player: sourceOwner,
                opponent: sourceOpponent,
                sourceCard,
                unitZone: sourceZone,
                machine: engine,
            };
            if (!engine.effectManager.checkCondition(passive, sourceContext)) return;
            if (sourceCard.type === 'LEADER' && !sourceCard.isAwakened && (engine as any).requiresAwakenedLeader?.(passive)) return;
            if (passive.targets && !TargetSelector.isValidTarget(engine, passive.targets, sourceContext, defenderZone)) return;

            const grantedContext: GameContext = {
                sourceCard: defenderUnit,
                player: defenderOwner,
                opponent: defenderOpponent,
                unitZone: defenderZone,
                machine: engine,
            };
            engine.state.effectQueue.push({
                effect: granted,
                context: grantedContext,
                id: engine.createRuntimeId(`GRANTED_DEFENDER_${passiveIndex}`),
                creationTime: batchStep,
                sourcePlayerId: defenderOwner.id,
            });
        });
    };

    engine.state.players.forEach((sourceOwner: any) => {
        sourceOwner.unitZones.forEach((sourceZone: UnitZoneState) => {
            if (sourceZone.unit) {
                evaluateEffectList(sourceOwner, sourceZone.unit, sourceZone.unit.effects || [], sourceZone);
                evaluateEffectList(sourceOwner, sourceZone.unit, sourceZone.temporaryEffects as any, sourceZone);
            }
            sourceZone.items.forEach((item: any) => {
                evaluateEffectList(sourceOwner, item, item?.effects || [], sourceZone);
            });
        });
        if (sourceOwner.levelZone) {
            evaluateEffectList(sourceOwner, sourceOwner.levelZone, sourceOwner.levelZone.effects || [], undefined);
        }
    });

    engine.sortEffectQueue();
}

function getGuardianBlockItemCost(
    engine: any,
    owner: any,
    opponent: any,
    zone: UnitZoneState
): GuardianBlockItemCost | null {
    if (!zone?.unit) return null;

    const effectSources: Array<{ sourceCard: Card; effect: Effect }> = [];
    if (zone.unit.effects) {
        zone.unit.effects.forEach(effect => effectSources.push({ sourceCard: zone.unit!, effect }));
    }
    zone.items.forEach(item => {
        if (item.effects) {
            item.effects.forEach(effect => effectSources.push({ sourceCard: item, effect }));
        }
    });
    zone.temporaryEffects.forEach(effect => {
        effectSources.push({ sourceCard: zone.unit!, effect });
    });

    for (const { sourceCard, effect } of effectSources) {
        if (!effect || effect.activation !== ActivationCondition.PASSIVE) continue;
        if (effect.action?.type !== 'NONE') continue;
        const raw = effect.action?.params?.guardianBlockItemCost;
        if (!raw || typeof raw !== 'object') continue;

        const context: GameContext = {
            sourceCard,
            player: owner,
            opponent,
            unitZone: zone,
            machine: engine,
        };
        if (!engine.effectManager.checkCondition(effect, context)) continue;

        return {
            itemName: typeof raw.itemName === 'string' ? raw.itemName : undefined,
            itemCardId: typeof raw.itemCardId === 'string' ? raw.itemCardId : undefined,
            count: Math.max(1, Number(raw.count) || 1),
        };
    }

    return null;
}

function getGuardianBlockUnitSacrificeCost(
    engine: any,
    owner: any,
    opponent: any,
    zone: UnitZoneState
): GuardianBlockUnitSacrificeCost | null {
    if (!zone?.unit) return null;

    const effectSources: Array<{ sourceCard: Card; effect: Effect }> = [];
    if (zone.unit.effects) {
        zone.unit.effects.forEach(effect => effectSources.push({ sourceCard: zone.unit!, effect }));
    }
    zone.items.forEach(item => {
        if (item.effects) {
            item.effects.forEach(effect => effectSources.push({ sourceCard: item, effect }));
        }
    });
    zone.temporaryEffects.forEach(effect => {
        effectSources.push({ sourceCard: zone.unit!, effect });
    });

    for (const { sourceCard, effect } of effectSources) {
        if (!effect || effect.activation !== ActivationCondition.PASSIVE) continue;
        if (effect.action?.type !== 'NONE') continue;

        const raw = effect.action?.params?.guardianBlockUnitSacrificeCost;
        if (raw === undefined || raw === null) continue;

        const context: GameContext = {
            sourceCard,
            player: owner,
            opponent,
            unitZone: zone,
            machine: engine,
        };
        if (!engine.effectManager.checkCondition(effect, context)) continue;

        if (typeof raw === 'number') {
            return {
                count: Math.max(1, Number(raw) || 1),
            };
        }

        if (typeof raw === 'object') {
            return {
                unitName: typeof raw.unitName === 'string' ? raw.unitName : undefined,
                unitCardId: typeof raw.unitCardId === 'string' ? raw.unitCardId : undefined,
                count: Math.max(1, Number(raw.count) || 1),
            };
        }
    }

    return null;
}

function isGuardianBlockItemMatch(item: Card, spec: GuardianBlockItemCost): boolean {
    if (!item) return false;
    if (spec.itemCardId && item.id !== spec.itemCardId) return false;
    if (spec.itemName && !String(item.name || '').includes(spec.itemName)) return false;
    return true;
}

function getGuardianBlockPayableItems(zone: UnitZoneState, spec: GuardianBlockItemCost): Card[] {
    if (!Array.isArray(zone?.items)) return [];
    return zone.items.filter(item => isGuardianBlockItemMatch(item, spec));
}

function isGuardianBlockUnitMatch(unit: Card, spec: GuardianBlockUnitSacrificeCost): boolean {
    if (!unit) return false;
    if (spec.unitCardId && unit.id !== spec.unitCardId) return false;
    if (spec.unitName && !String(unit.name || '').includes(spec.unitName)) return false;
    return true;
}

function getGuardianBlockPayableUnits(owner: any, blockerZoneIndex: number, spec: GuardianBlockUnitSacrificeCost): UnitZoneState[] {
    if (!owner || !Array.isArray(owner.unitZones)) return [];
    return owner.unitZones.filter((candidateZone: UnitZoneState, zoneIndex: number) => {
        if (zoneIndex === blockerZoneIndex) return false;
        if (!candidateZone?.unit) return false;
        return isGuardianBlockUnitMatch(candidateZone.unit, spec);
    });
}

function failBlockDeclaration(engine: any) {
    engine.state.combatBlocked = false;
    engine.state.pendingBlockerZoneIndex = null;
    engine.assignInteractionOwner(engine.currentPlayer.id);
    if (engine.state.effectQueue.length === 0) {
        engine.advanceCombatStep();
    }
}

export function advanceCombatStep(engine: any) {
    // Combat progression must pause while any interaction window is open.
    if (engine.state.interactionMode !== 'NORMAL') {
        return;
    }

    const attackerZone = engine.currentPlayer.unitZones[engine.state.pendingAttackerIndex!];

    switch (engine.state.combatStep) {
        case 'ATTACK_DECLARATION':
            // Proceed to Defense Declaration
            engine.stepDefenseDeclaration(attackerZone);
            break;
        case 'DEFENSE_DECLARATION':
            // Proceed to Battle Resolution
            engine.stepBattleResolution(attackerZone);
            break;
        case 'BATTLE':
            // Proceed to Battle End
            engine.stepBattleEnd();
            break;
        case 'BATTLE_END':
            // End Combat
            engine.state.combatStep = 'NONE';
            engine.state.pendingAttackerIndex = null;
            engine.state.pendingBlockerZoneIndex = null;
            const resumePhaseAfterAutoAttack = (engine.state as any).resumePhaseAfterAutoAttack as Phase | undefined;
            engine.state.phase = resumePhaseAfterAutoAttack ?? Phase.ATTACK; // Return to ATTACK unless an auto-entry attack asked to restore original phase.
            if (resumePhaseAfterAutoAttack !== undefined) {
                delete (engine.state as any).resumePhaseAfterAutoAttack;
            }
            engine.assignInteractionOwner(engine.currentPlayer.id);
            break;
    }
}

export function stepDefenseDeclaration(engine: any, attackerZone: UnitZoneState) {
    engine.state.combatStep = 'DEFENSE_DECLARATION';
    const attackerZoneIndex = engine.state.players[engine.state.turnPlayerIndex].unitZones.indexOf(attackerZone);

    const candidateBlockers = engine.getAvailableBlockerZoneIndexes(attackerZoneIndex);
    if (candidateBlockers.length === 0) {
        engine.state.combatBlocked = false;
        engine.state.pendingBlockerZoneIndex = null;
        engine.assignInteractionOwner(engine.currentPlayer.id);
        engine.advanceCombatStep();
        return;
    }

    engine.state.phase = Phase.BLOCK;
    engine.assignInteractionOwner(engine.opponentPlayer.id);
    console.log("Waiting for Block Declaration...");
}

export function stepBattleResolution(engine: any, attackerZone: UnitZoneState) {
    engine.state.combatStep = 'BATTLE';
    const blockerZoneIndex = engine.state.pendingBlockerZoneIndex
        ?? engine.state.players[engine.state.turnPlayerIndex].unitZones.indexOf(attackerZone);
    const blockerZone = engine.opponentPlayer.unitZones[blockerZoneIndex];

    // 1. Check Attack Terminated
    if (engine.state.attackTerminated) {
        console.log("Attack Terminated during resolution.");
        engine.advanceCombatStep();
        return;
    }

    // 2. Pre-Combat Effects? (e.g. Infiltration)
    const infiltrationValue = getInfiltrationValue(engine, attackerZone);
    if (!engine.state.combatBlocked && infiltrationValue > 0) {
        console.log("Infiltration Triggered.");
        engine.drawCard(engine.state.turnPlayerIndex, infiltrationValue, {
            reason: 'EFFECT',
            sourceActivation: ActivationCondition.ATTACKER,
            sourcePlayerId: engine.currentPlayer.id,
            sourceCardId: attackerZone.unit?.id,
        });
    }

    // 3. Resolution
    if (engine.state.combatBlocked && blockerZone?.unit) {
        // Combat Resolution
        const attPower = engine.getUnitPower(attackerZone, engine.currentPlayer);
        const blkPower = engine.getUnitPower(blockerZone, engine.opponentPlayer);
        console.log(`Combat! Attacker Power: ${attPower}, Blocker Power: ${blkPower}`);

        if (attPower >= blkPower) {
            // IMPORTANT: Destroy first, THEN queue result effects.
            engine.destroyUnit(engine.opponentPlayer, blockerZone, attackerZone.unit || undefined, 'BATTLE');

            // PENETRATION (Rule 10.2.3.2)
            const penValue = engine.getPenetrationValue(attackerZone);
            if (penValue > 0) {
                console.log("[Combat] Queuing PENETRATION Effect");
                const penEffect: Effect = {
                    activation: 'AUTO_RESOLVED_COMBAT' as any,
                    action: { type: 'DAMAGE', params: { value: penValue } },
                    description: `Penetration Damage: ${penValue}`,
                    id: engine.createRuntimeId('PEN')
                } as any;
                engine.effectManager.queueEphemeralEffect(penEffect, {
                    sourceCard: attackerZone.unit!,
                    player: engine.currentPlayer,
                    opponent: engine.opponentPlayer,
                    machine: engine
                });
            }

            // PLUNDER (Rule 10.2.3.3)
            const pluValue = engine.getPlunderValue(attackerZone);
            if (pluValue > 0) {
                console.log("[Combat] Queuing PLUNDER Effect");
                const pluEffect: Effect = {
                    activation: 'AUTO_RESOLVED_COMBAT' as any,
                    action: { type: 'DRAW', params: { count: pluValue } },
                    description: `Plunder Draw: ${pluValue}`,
                    id: engine.createRuntimeId('PLU')
                } as any;
                engine.effectManager.queueEphemeralEffect(pluEffect, {
                    sourceCard: attackerZone.unit!,
                    player: engine.currentPlayer,
                    opponent: engine.opponentPlayer,
                    machine: engine
                });
            }
        }

        if (blkPower > attPower) {
            engine.destroyUnit(engine.currentPlayer, attackerZone, blockerZone.unit || undefined, 'BATTLE');
        }
    } else {
        // Direct Damage
        engine.dealDamage(engine.opponentPlayer, engine.getUnitHit(attackerZone, engine.currentPlayer));
    }

    // Queue might have new effects (Destruction triggers).
    if (engine.state.effectQueue.length === 0) {
        engine.advanceCombatStep();
    }
}

export function stepBattleEnd(engine: any) {
    engine.state.combatStep = 'BATTLE_END';

    const attackerZoneIndex = engine.state.pendingAttackerIndex;
    if (attackerZoneIndex !== null) {
        const attackerZone = engine.currentPlayer.unitZones[attackerZoneIndex];
        const blockerZoneIndex = engine.state.pendingBlockerZoneIndex ?? attackerZoneIndex;
        const blockerZone = engine.opponentPlayer.unitZones[blockerZoneIndex];
        const batchStep = engine.incrementAndGetGlobalStep();

        if (attackerZone?.unit) {
            engine.effectManager.processEffects(ActivationCondition.BATTLE_END, {
                sourceCard: attackerZone.unit,
                player: engine.currentPlayer,
                opponent: engine.opponentPlayer,
                unitZone: attackerZone,
                machine: engine,
            }, { enqueueOnly: true, batchStep });
            attackerZone.items.forEach((item: any) => {
                engine.effectManager.processEffects(ActivationCondition.BATTLE_END, {
                    sourceCard: item,
                    player: engine.currentPlayer,
                    opponent: engine.opponentPlayer,
                    unitZone: attackerZone,
                    machine: engine,
                }, { enqueueOnly: true, batchStep });
            });
        }

        if (blockerZone?.unit) {
            engine.effectManager.processEffects(ActivationCondition.BATTLE_END, {
                sourceCard: blockerZone.unit,
                player: engine.opponentPlayer,
                opponent: engine.currentPlayer,
                unitZone: blockerZone,
                machine: engine,
            }, { enqueueOnly: true, batchStep });
            blockerZone.items.forEach((item: any) => {
                engine.effectManager.processEffects(ActivationCondition.BATTLE_END, {
                    sourceCard: item,
                    player: engine.opponentPlayer,
                    opponent: engine.currentPlayer,
                    unitZone: blockerZone,
                    machine: engine,
                }, { enqueueOnly: true, batchStep });
            });
        }

        engine.effectManager.processQueue();
    }

    engine.clearBattleScopedEffects();

    if (engine.state.effectQueue.length === 0) {
        engine.advanceCombatStep();
    }
}

export function clearBattleScopedEffects(engine: any) {
    engine.state.players.forEach((player: any) => {
        player.unitZones.forEach((zone: any) => {
            zone.buffs = zone.buffs.filter((buff: any) => buff.duration !== 'BATTLE_END');
            zone.temporaryEffects = zone.temporaryEffects.filter((effect: any) => effect.duration !== 'BATTLE_END');
        });
    });
}

export function resolveBlock(engine: any, shouldBlock: boolean, blockerZoneIndex?: number) {
    if (engine.state.phase !== Phase.BLOCK || engine.state.pendingAttackerIndex === null) return;

    const attackerZoneIndex = engine.state.pendingAttackerIndex;
    const attackerZone = engine.currentPlayer.unitZones[attackerZoneIndex];
    if (!attackerZone.unit) return;

    const candidateBlockers = engine.getAvailableBlockerZoneIndexes(attackerZoneIndex);
    const encounterBlockForced = engine.isEncounterBlockForced(attackerZoneIndex, candidateBlockers);
    const effectiveShouldBlock = encounterBlockForced ? true : shouldBlock;
    const effectiveBlockerZoneIndex = encounterBlockForced ? attackerZoneIndex : blockerZoneIndex;
    if (!effectiveShouldBlock || candidateBlockers.length === 0) {
        engine.state.combatBlocked = false;
        engine.state.pendingBlockerZoneIndex = null;
        engine.assignInteractionOwner(engine.currentPlayer.id);
        if (engine.state.effectQueue.length === 0) {
            engine.advanceCombatStep();
        }
        return;
    }

    let selectedBlockerZoneIndex: number | null = null;
    if (encounterBlockForced && candidateBlockers.includes(attackerZoneIndex)) {
        selectedBlockerZoneIndex = attackerZoneIndex;
    } else if (effectiveBlockerZoneIndex !== undefined && candidateBlockers.includes(effectiveBlockerZoneIndex)) {
        selectedBlockerZoneIndex = effectiveBlockerZoneIndex;
    } else if (candidateBlockers.includes(attackerZoneIndex)) {
        selectedBlockerZoneIndex = attackerZoneIndex;
    } else if (candidateBlockers.length === 1) {
        selectedBlockerZoneIndex = candidateBlockers[0];
    }

    if (selectedBlockerZoneIndex === null) {
        engine.state.combatBlocked = false;
        engine.state.pendingBlockerZoneIndex = null;
        engine.assignInteractionOwner(engine.currentPlayer.id);
        if (engine.state.effectQueue.length === 0) {
            engine.advanceCombatStep();
        }
        return;
    }

    const selectedBlockerZone = engine.opponentPlayer.unitZones[selectedBlockerZoneIndex];
    if (!selectedBlockerZone.unit) {
        engine.state.combatBlocked = false;
        engine.state.pendingBlockerZoneIndex = null;
        engine.assignInteractionOwner(engine.currentPlayer.id);
        if (engine.state.effectQueue.length === 0) {
            engine.advanceCombatStep();
        }
        return;
    }

    const blockHandDiscardCost = getRequiredHandDiscardForBlockByHitDiff(engine, attackerZone, selectedBlockerZone);
    if (blockHandDiscardCost > 0) {
        if (engine.opponentPlayer.hand.length < blockHandDiscardCost) {
            failBlockDeclaration(engine);
            return;
        }

        const controllerPlayerId = engine.opponentPlayer.id;
        engine.state.interactionMode = 'SELECT_COST';
        engine.state.pendingEffect = {
            sourceCard: attackerZone.unit,
            sourcePlayerId: engine.opponentPlayer.id,
            controllerPlayerId,
            actionType: 'SB01_010_BLOCK_HAND_COST',
            actionValue: { blockerZoneIndex: selectedBlockerZoneIndex, blockHandDiscardCost },
            effectDescription: `SB01-010 block hand discard cost (${blockHandDiscardCost})`,
            sourceActivation: ActivationCondition.ATTACKER,
            triggerReason: '방어 선언 핸드 코스트',
            selectionPurpose: '방어를 위한 핸드 코스트 지불',
            costToPay: { type: 'TRASH_HAND', amount: blockHandDiscardCost },
            selectedTargets: []
        };
        engine.setPendingRuntime({
            sourceCard: attackerZone.unit,
            player: engine.opponentPlayer,
            opponent: engine.currentPlayer,
            unitZone: selectedBlockerZone,
            machine: engine,
        }, null);
        engine.assignInteractionOwner(controllerPlayerId);
        return;
    }

    const isGuardianBlock = selectedBlockerZoneIndex !== attackerZoneIndex;
    const guardianBlockUnitSacrificeCost = isGuardianBlock
        ? getGuardianBlockUnitSacrificeCost(engine, engine.opponentPlayer, engine.currentPlayer, selectedBlockerZone)
        : null;

    if (isGuardianBlock && guardianBlockUnitSacrificeCost) {
        const payableUnits = getGuardianBlockPayableUnits(
            engine.opponentPlayer,
            selectedBlockerZoneIndex,
            guardianBlockUnitSacrificeCost
        );
        if (payableUnits.length < guardianBlockUnitSacrificeCost.count) {
            failBlockDeclaration(engine);
            return;
        }

        if (guardianBlockUnitSacrificeCost.count === 1 && payableUnits.length === 1) {
            const payZone = payableUnits[0];
            const payUnit = payZone.unit;
            if (!payUnit) {
                failBlockDeclaration(engine);
                return;
            }
            payZone.unit = null;
            engine.opponentPlayer.trash.push(payUnit);
            payZone.items.forEach((item: Card) => engine.opponentPlayer.trash.push(item));
            payZone.items = [];
            payZone.buffs = [];
            payZone.temporaryEffects = [];
            payZone.attackCountThisTurn = 0;
            payZone.extraAttackAllowance = 0;
            payZone.hasAttacked = false;

            engine.commitBlockDeclaration(selectedBlockerZoneIndex);
            return;
        }

        const controllerPlayerId = engine.opponentPlayer.id;
        engine.state.interactionMode = 'SELECT_TARGET';
        engine.state.pendingEffect = {
            sourceCard: selectedBlockerZone.unit,
            sourcePlayerId: engine.opponentPlayer.id,
            controllerPlayerId,
            actionType: 'GUARDIAN_BLOCK_UNIT_COST',
            actionValue: {
                blockerZoneIndex: selectedBlockerZoneIndex,
                unitName: guardianBlockUnitSacrificeCost.unitName,
                unitCardId: guardianBlockUnitSacrificeCost.unitCardId,
                requiredCount: guardianBlockUnitSacrificeCost.count,
            },
            effectDescription: 'Guardian block unit sacrifice cost',
            sourceActivation: ActivationCondition.DEFENDER,
            triggerReason: '가디언 블록 선언 비용',
            selectionPurpose: '가디언 블록에 사용할 희생 유닛 선택',
            validTargets: 'MY_UNITS',
            targetSchema: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 1,
                selectMode: 'MANUAL',
                filters: [
                    { type: 'EXCLUDE_SELF' },
                    ...(guardianBlockUnitSacrificeCost.unitName ? [{ type: 'HAS_NAME', value: guardianBlockUnitSacrificeCost.unitName }] : []),
                ],
            },
            selectedTargets: [],
        };
        engine.setPendingRuntime({
            sourceCard: selectedBlockerZone.unit,
            player: engine.opponentPlayer,
            opponent: engine.currentPlayer,
            unitZone: selectedBlockerZone,
            machine: engine,
        }, null);
        engine.assignInteractionOwner(controllerPlayerId);
        return;
    }

    const guardianBlockItemCost = isGuardianBlock
        ? getGuardianBlockItemCost(engine, engine.opponentPlayer, engine.currentPlayer, selectedBlockerZone)
        : null;

    if (isGuardianBlock && guardianBlockItemCost) {
        const payableItems = getGuardianBlockPayableItems(selectedBlockerZone, guardianBlockItemCost);
        if (payableItems.length < guardianBlockItemCost.count) {
            failBlockDeclaration(engine);
            return;
        }

        if (guardianBlockItemCost.count === 1 && payableItems.length === 1) {
            const itemToTrash = payableItems[0];
            const itemIndex = selectedBlockerZone.items.indexOf(itemToTrash);
            if (itemIndex === -1) {
                failBlockDeclaration(engine);
                return;
            }
            const [removed] = selectedBlockerZone.items.splice(itemIndex, 1);
            if (!removed) {
                failBlockDeclaration(engine);
                return;
            }
            engine.opponentPlayer.trash.push(removed);
            engine.commitBlockDeclaration(selectedBlockerZoneIndex);
            return;
        }

        const controllerPlayerId = engine.opponentPlayer.id;
        engine.state.interactionMode = 'SELECT_TARGET';
        engine.state.pendingEffect = {
            sourceCard: selectedBlockerZone.unit,
            sourcePlayerId: engine.opponentPlayer.id,
            controllerPlayerId,
            actionType: 'GUARDIAN_BLOCK_ITEM_COST',
            actionValue: {
                blockerZoneIndex: selectedBlockerZoneIndex,
                itemName: guardianBlockItemCost.itemName,
                itemCardId: guardianBlockItemCost.itemCardId,
                requiredCount: guardianBlockItemCost.count,
            },
            effectDescription: 'Guardian block item cost',
            sourceActivation: ActivationCondition.DEFENDER,
            triggerReason: '가디언 블록 선언 비용',
            selectionPurpose: '가디언 블록에 사용할 아이템 선택',
            validTargets: 'MY_FIELD_ITEMS',
            targetSchema: {
                scope: 'MY_FIELD_ITEMS',
                type: 'CARD',
                count: 1,
                selectMode: 'MANUAL',
                filters: [
                    { type: 'EQUIPPED_ON_SOURCE_UNIT' },
                    ...(guardianBlockItemCost.itemName ? [{ type: 'HAS_NAME', value: guardianBlockItemCost.itemName }] : []),
                ],
            },
            selectedTargets: [],
        };
        engine.setPendingRuntime({
            sourceCard: selectedBlockerZone.unit,
            player: engine.opponentPlayer,
            opponent: engine.currentPlayer,
            unitZone: selectedBlockerZone,
            machine: engine,
        }, null);
        engine.assignInteractionOwner(controllerPlayerId);
        return;
    }

    const barrierCost = isGuardianBlock ? engine.getGuardianBarrierCost(selectedBlockerZone) : 0;
    if (isGuardianBlock && barrierCost > 0) {
        if (engine.opponentPlayer.hand.length < barrierCost) {
            failBlockDeclaration(engine);
            return;
        }

        const controllerPlayerId = engine.opponentPlayer.id;
        engine.state.interactionMode = 'SELECT_COST';
        engine.state.pendingEffect = {
            sourceCard: selectedBlockerZone.unit,
            sourcePlayerId: engine.opponentPlayer.id,
            controllerPlayerId,
            actionType: 'GUARDIAN_BLOCK_COST',
            actionValue: { blockerZoneIndex: selectedBlockerZoneIndex, barrierCost },
            effectDescription: `Guardian barrier cost (${barrierCost})`,
            sourceActivation: ActivationCondition.DEFENDER,
            triggerReason: '가디언 블록 선언 비용',
            selectionPurpose: '가디언 배리어 코스트 지불',
            costToPay: { type: 'TRASH_HAND', amount: barrierCost },
            selectedTargets: []
        };
        engine.setPendingRuntime({
            sourceCard: selectedBlockerZone.unit,
            player: engine.opponentPlayer,
            opponent: engine.currentPlayer,
            unitZone: selectedBlockerZone,
            machine: engine
        }, null);
        engine.assignInteractionOwner(controllerPlayerId);
        return;
    }

    engine.commitBlockDeclaration(selectedBlockerZoneIndex);
}

export function commitBlockDeclaration(engine: any, blockerZoneIndex: number) {
    const blockerZone = engine.opponentPlayer.unitZones[blockerZoneIndex];
    if (!blockerZone.unit) {
        engine.state.combatBlocked = false;
        engine.state.pendingBlockerZoneIndex = null;
        engine.assignInteractionOwner(engine.currentPlayer.id);
        if (engine.state.effectQueue.length === 0) {
            engine.advanceCombatStep();
        }
        return;
    }

    engine.state.pendingBlockerZoneIndex = blockerZoneIndex;
    engine.state.combatBlocked = true;

    const defenderBatchStep = engine.incrementAndGetGlobalStep();
    engine.effectManager.processEffects(ActivationCondition.DEFENDER, {
        sourceCard: blockerZone.unit,
        player: engine.opponentPlayer,
        opponent: engine.currentPlayer,
        unitZone: blockerZone,
        machine: engine
    } as GameContext, { enqueueOnly: true, batchStep: defenderBatchStep });

    blockerZone.items.forEach((item: any) => {
        engine.effectManager.processEffects(ActivationCondition.DEFENDER, {
            sourceCard: item,
            player: engine.opponentPlayer,
            opponent: engine.currentPlayer,
            unitZone: blockerZone,
            machine: engine
        } as GameContext, { enqueueOnly: true, batchStep: defenderBatchStep });
    });

    queuePassiveGrantedDefenderEffects(engine, engine.opponentPlayer, blockerZone, defenderBatchStep);
    engine.effectManager.processQueue();

    engine.assignInteractionOwner(engine.currentPlayer.id);
    if (engine.state.effectQueue.length === 0) {
        engine.advanceCombatStep();
    }
}

export function hasKeyword(card: Card, keyword: string): boolean {
    return card.keywords?.includes(keyword) || false;
}

export function isEncounterBlockForced(engine: any, attackerZoneIndex: number, candidateBlockers?: number[]): boolean {
    const attackerZone = engine.currentPlayer.unitZones[attackerZoneIndex];
    if (!attackerZone?.unit) return false;

    const isDualist = engine.hasKeywordInZone(attackerZone, '듀얼리스트') || engine.hasKeywordInZone(attackerZone, 'DUALIST');
    if (!isDualist) return false;

    const availableBlockers = candidateBlockers ?? engine.getAvailableBlockerZoneIndexes(attackerZoneIndex);
    return availableBlockers.includes(attackerZoneIndex);
}

export function getAvailableBlockerZoneIndexes(engine: any, attackerZoneIndex: number): number[] {
    const attackerZone = engine.currentPlayer.unitZones[attackerZoneIndex];
    if (!attackerZone?.unit) return [];

    const defender = engine.opponentPlayer;
    const defenderOpponent = engine.currentPlayer;
    const candidateSet = new Set<number>();
    const isDualist = engine.hasKeywordInZone(attackerZone, '듀얼리스트') || engine.hasKeywordInZone(attackerZone, 'DUALIST');

    const encounterZone = defender.unitZones[attackerZoneIndex];
    if (
        encounterZone.unit &&
        !hasCannotBlockFlag(engine, encounterZone, defender, defenderOpponent) &&
        !engine.isBlockPreventedByBreakthrough(attackerZone, encounterZone)
    ) {
        candidateSet.add(attackerZoneIndex);
    }

    if (!isDualist) {
        defender.unitZones.forEach((zone: UnitZoneState, zoneIndex: number) => {
            if (zoneIndex === attackerZoneIndex) return;
            if (Math.abs(zoneIndex - attackerZoneIndex) !== 1) return;
            if (!zone.unit) return;
            if (hasCannotBlockFlag(engine, zone, defender, defenderOpponent)) return;
            if (!(engine.hasKeywordInZone(zone, '가디언') || engine.hasKeywordInZone(zone, 'GUARDIAN'))) return;
            if (engine.isBlockPreventedByBreakthrough(attackerZone, zone)) return;

            const guardianBlockUnitSacrificeCost = getGuardianBlockUnitSacrificeCost(engine, defender, defenderOpponent, zone);
            if (guardianBlockUnitSacrificeCost) {
                const payableUnits = getGuardianBlockPayableUnits(defender, zoneIndex, guardianBlockUnitSacrificeCost);
                if (payableUnits.length < guardianBlockUnitSacrificeCost.count) return;
            }

            const guardianBlockItemCost = getGuardianBlockItemCost(engine, defender, defenderOpponent, zone);
            if (guardianBlockItemCost) {
                const payableItems = getGuardianBlockPayableItems(zone, guardianBlockItemCost);
                if (payableItems.length < guardianBlockItemCost.count) return;
                candidateSet.add(zoneIndex);
                return;
            }

            const barrierCost = engine.getGuardianBarrierCost(zone);
            if (defender.hand.length < barrierCost) return;
            candidateSet.add(zoneIndex);
        });
    }

    return Array.from(candidateSet).sort((a, b) => a - b);
}

function hasCannotBlockFlag(engine: any, zone: UnitZoneState, owner: any, opponent: any): boolean {
    if (!zone.unit) return false;

    const effectSources: Array<{ effect: Effect; sourceCard: Card }> = [];
    if (zone.unit.effects) {
        zone.unit.effects.forEach(effect => effectSources.push({ effect, sourceCard: zone.unit! }));
    }
    zone.items.forEach(item => {
        if (item.effects) {
            item.effects.forEach(effect => effectSources.push({ effect, sourceCard: item }));
        }
    });
    zone.temporaryEffects.forEach(effect => {
        effectSources.push({ effect, sourceCard: zone.unit! });
    });

    return effectSources.some(({ effect, sourceCard }) => {
        if (!effect || effect.activation !== ActivationCondition.PASSIVE) return false;
        if (effect.action?.type !== 'NONE' || effect.action?.params?.cannotBlock !== true) return false;

        const context: GameContext = {
            sourceCard,
            player: owner,
            opponent,
            unitZone: zone,
            machine: engine,
        };
        return engine.effectManager.checkCondition(effect, context);
    });
}

export function getGuardianBarrierCost(_engine: any, zone: UnitZoneState): number {
    let maxCost = 0;
    const allEffects: Effect[] = [];

    if (zone.unit?.effects) allEffects.push(...zone.unit.effects);
    zone.items.forEach(item => {
        if (item.effects) allEffects.push(...item.effects);
    });
    allEffects.push(...zone.temporaryEffects);

    allEffects.forEach(effect => {
        const explicit = effect.action?.params?.guardianBarrierCost;
        if (typeof explicit === 'number') {
            maxCost = Math.max(maxCost, explicit);
            return;
        }

        const text = effect.description || '';
        const match = text.match(/방벽\[(\d+)\]/);
        if (match) {
            maxCost = Math.max(maxCost, parseInt(match[1], 10));
        }
    });

    return maxCost;
}

export function isBlockPreventedByBreakthrough(engine: any, attackerZone: UnitZoneState, blockerZone: UnitZoneState): boolean {
    if (!blockerZone.unit) return true;
    const blockerCost = typeof engine.getCardCost === 'function'
        ? engine.getCardCost(blockerZone.unit)
        : Math.max(0, Number(blockerZone.unit.cost || 0));

    const checkRule = (params: any): boolean => {
        if (!params) return false;
        if (params.mode === 'ALL' || params.costMode === 'ALL' || params.all === true) return true;
        if (params.mode === 'COST_OVER_SELF') {
            const attackerCost = attackerZone.unit
                ? (typeof engine.getCardCost === 'function'
                    ? engine.getCardCost(attackerZone.unit)
                    : Math.max(0, Number(attackerZone.unit?.cost || 0)))
                : 0;
            return blockerCost > attackerCost;
        }
        if (params.costMax !== undefined && blockerCost <= params.costMax) return true;
        if (params.costMin !== undefined && blockerCost >= params.costMin) return true;
        return false;
    };

    const allEffects: Array<{ effect: Effect; sourceCard: Card }> = [];
    if (attackerZone.unit?.effects) {
        attackerZone.unit.effects.forEach(effect => {
            allEffects.push({ effect, sourceCard: attackerZone.unit! });
        });
    }
    attackerZone.items.forEach(item => {
        if (item.effects) {
            item.effects.forEach(effect => {
                allEffects.push({ effect, sourceCard: item });
            });
        }
    });
    attackerZone.temporaryEffects.forEach(effect => {
        allEffects.push({ effect, sourceCard: attackerZone.unit! });
    });

    return allEffects.some(({ effect, sourceCard }) => {
        if (effect.action?.type !== 'BREAKTHROUGH') return false;
        if (effect.activation !== ActivationCondition.ATTACKER && effect.activation !== ActivationCondition.PASSIVE) {
            return false;
        }

        const context: GameContext = {
            sourceCard,
            player: engine.currentPlayer,
            opponent: engine.opponentPlayer,
            unitZone: attackerZone,
            machine: engine,
        };

        if (!engine.effectManager.checkCondition(effect, context)) return false;
        return checkRule(effect.action.params);
    });
}

export function getPenetrationValue(engine: any, zone: UnitZoneState): number {
    if (!zone.unit) return 0;
    let value = 0;

    const hasPenetrationActionSource = (() => {
        const effects: Effect[] = [];
        if (zone.unit?.effects) effects.push(...zone.unit.effects);
        zone.items.forEach(item => {
            if (item.effects) effects.push(...item.effects);
        });
        effects.push(...zone.temporaryEffects);
        return effects.some(effect => effect.action?.type === 'PENETRATION');
    })();

    if (!hasPenetrationActionSource && (engine.hasKeywordInZone(zone, '관통') || engine.hasKeywordInZone(zone, 'PENETRATION'))) {
        value = Math.max(value, zone.unit.hit || 0);
    }

    // Buffs (from explicitly called PENETRATION actions)
    zone.buffs.forEach(b => {
        if (b.type === 'PENETRATION') value = Math.max(value, b.value);
    });

    return value;
}

export function getPlunderValue(engine: any, zone: UnitZoneState): number {
    if (!zone.unit) return 0;
    let value = 0;

    if (engine.hasKeywordInZone(zone, '약탈') || engine.hasKeywordInZone(zone, 'PLUNDER')) {
        value = Math.max(value, 1);
    }

    zone.buffs.forEach(b => {
        if (b.type === 'PLUNDER') value = Math.max(value, b.value);
    });

    return value;
}

export function getInfiltrationValue(engine: any, zone: UnitZoneState): number {
    if (!zone.unit) return 0;
    let value = 0;

    const allEffects: Effect[] = [];
    if (zone.unit?.effects) allEffects.push(...zone.unit.effects);
    zone.items.forEach(item => {
        if (item.effects) allEffects.push(...item.effects);
    });
    allEffects.push(...zone.temporaryEffects);

    const infiltrationFromEffects = allEffects.reduce((maxValue, effect) => {
        if (!effect) return maxValue;
        const paramsValue = Number(effect.action?.params?.infiltrationValue ?? 0);
        if (paramsValue > 0) return Math.max(maxValue, paramsValue);
        const description = String(effect.description || '');
        const match = description.match(/침투\[(\d+)\]/);
        if (!match) return maxValue;
        return Math.max(maxValue, Number(match[1]) || 0);
    }, 0);
    value = Math.max(value, infiltrationFromEffects);

    if (value <= 0 && (engine.hasKeywordInZone(zone, '침투') || engine.hasKeywordInZone(zone, 'INFILTRATION'))) {
        value = 1;
    }

    return value;
}

export function hasKeywordInZone(engine: any, zone: UnitZoneState, keyword: string): boolean {
    if (!zone.unit) return false;

    // Check Unit
    if (engine.hasKeyword(zone.unit, keyword)) return true;

    // Check Items
    if (zone.items.some(item => engine.hasKeyword(item, keyword))) return true;

    // Check Temporary Effects (which might grant the keyword)
    if (zone.temporaryEffects.some(effect => effect.description.includes(keyword))) return true;

    return false;
}
