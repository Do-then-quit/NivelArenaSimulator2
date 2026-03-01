import { ActionImplementation, ActivationCondition, Attribute, CardType, Phase, UnitZoneState } from './types';
import { TargetSelector } from './TargetSelector';
import {
    autoAttackIfEncounter,
    damage,
    discard,
    discardAll,
    drawCard,
    drawDynamic,
    drawThenDiscard,
    destroySelf,
    gainLevel,
    lockSkillIdUntilTurnEnd,
    moveFromDamageToHand,
    moveFromHandToDamage,
    moveFromTrashToDeckBottom,
    moveFromTrashToDeckTop,
    noneAction,
    returnToHand,
    trashSelf,
} from './effectActions/core';
import {
    applyDualistMark,
    applyInfiltrationMark,
    buffHit,
    buffPower,
    buffPowerAndDrawIfTrashed,
    grantExtraAttackThisTurn,
    grantEffect,
    lockAttackUntilTurnEnd,
    sacrificeToBuff,
    setPower,
} from './effectActions/buff';
import {
    breakthrough,
    destroyEncounter,
    destroyLaneLowest,
    destroyUnit,
    destroyUnitAndDraw,
    destroyUnitAndDrawByHit,
    destroyUnitWithHitCost,
    drawByTargetHit,
    mutualDestruction,
    penetration,
    plunder,
    terminateAttack,
} from './effectActions/combat';
import {
    revealTopAndChooseToHand,
    revealTopAndTakeAllByFilter,
    revealTopPickToHandThenOrderBottom,
} from './effectActions/reveal';
import {
    destroyItem,
    moveFromTrashToHand,
    moveItemToDeckBottom,
    returnFromTrashAtTurnEnd,
    returnItemToHand,
    returnUnitAndItemsToHand,
} from './effectActions/transfer';
import { getOwnerOfZone, zoneHasKeyword } from './effectActions/helpers';
import { RuleValidator } from './RuleValidator';

function effectHasPhaseAttackCondition(condition: any): boolean {
    if (!condition || typeof condition !== 'object') return false;

    if (condition.type === 'CONTEXT_FLAG') {
        const value = condition.value;
        if (value === 'PHASE_ATTACK') return true;
        if (value?.key === 'PHASE_ATTACK') {
            if (value.equals === undefined) return true;
            return value.equals === true;
        }
        return false;
    }

    if (condition.type === 'ALL' && Array.isArray(condition.value)) {
        return condition.value.some((nested: any) => effectHasPhaseAttackCondition(nested));
    }

    return false;
}

function createPromptOptionCard(id: string, name: string, text: string, imageUrl?: string) {
    return {
        id,
        name,
        type: CardType.SKILL,
        attribute: Attribute.NONE,
        cost: 0,
        text,
        imageUrl,
    };
}

function cardHasKeywordLike(card: any, keyword: string): boolean {
    if (!card || !keyword) return false;
    if (Array.isArray(card.keywords) && card.keywords.includes(keyword)) return true;
    if (Array.isArray(card.effects)) {
        return card.effects.some((effect: any) => String(effect?.description || '').includes(keyword));
    }
    return false;
}

function zoneHasKeywordLike(zone: any, keyword: string): boolean {
    if (!zone || !zone.unit || !keyword) return false;
    if (cardHasKeywordLike(zone.unit, keyword)) return true;

    if (Array.isArray(zone.items)) {
        for (const item of zone.items) {
            if (cardHasKeywordLike(item, keyword)) return true;
        }
    }

    if (Array.isArray(zone.temporaryEffects)) {
        for (const effect of zone.temporaryEffects) {
            if (String(effect?.description || '').includes(keyword)) return true;
        }
    }

    return false;
}

function countFriendlyExitUnits(player: any): number {
    return player.unitZones.filter((zone: any) => zone?.unit && zoneHasKeywordLike(zone, '엑시트')).length;
}

const complexAction: ActionImplementation = (ctx, params, _targets) => {
    if ((params as any).mode === 'GUARDIAN_TRANSFER_POWER') {
        if (!_targets || _targets.length < 2) return;
        const first = _targets[0] as UnitZoneState;
        const second = _targets[1] as UnitZoneState;
        if (!first?.unit || !second?.unit) return;

        const firstIsGuardian = zoneHasKeyword(first, '가디언');
        const secondIsGuardian = zoneHasKeyword(second, '가디언');
        if (firstIsGuardian === secondIsGuardian) return;

        const guardianZone = firstIsGuardian ? first : second;
        const targetZone = firstIsGuardian ? second : first;
        const guardianOwner = getOwnerOfZone(ctx.machine, guardianZone);
        if (!guardianOwner) return;

        const transferredPower = Math.max(0, ctx.machine.getUnitPower(guardianZone, guardianOwner));
        targetZone.buffs.push({
            id: ctx.machine.createRuntimeId('BUFF'),
            sourceCard: ctx.sourceCard,
            type: 'POWER',
            value: transferredPower,
            duration: params.duration || 'TURN_END',
        });
        return;
    }

    if ((params as any).mode === 'PROMPT_SELECT_ATTACK_ACTIVE_EFFECT') {
        const targetZone = (_targets || [])[0] as UnitZoneState | undefined;
        if (!targetZone?.unit) return;
        const includeActivatedThisTurn = (params as any).includeActivatedThisTurn === true;

        const owner = getOwnerOfZone(ctx.machine, targetZone);
        if (!owner || owner.id !== ctx.player.id) return;

        const effectOptions = (targetZone.unit.effects || [])
            .map((effect, effectIndex) => ({ effect, effectIndex }))
            .filter(({ effect, effectIndex }) => {
                if (!effect || effect.activation !== 'ACTIVE') return false;
                if (!effectHasPhaseAttackCondition(effect.condition)) return false;
                const effectKey = `${targetZone.unit?.id}_${effect.id || effectIndex}`;
                if (!includeActivatedThisTurn && targetZone.activatedEffectKeys?.[effectKey]) return false;

                const effectContext = {
                    sourceCard: targetZone.unit!,
                    player: ctx.player,
                    opponent: ctx.opponent,
                    unitZone: targetZone,
                    machine: ctx.machine,
                };

                if (!ctx.machine.effectManager.checkCondition(effect, effectContext)) return false;

                if (effect.cost && effect.cost.type !== 'NONE') {
                    if (effect.cost.type === 'TRASH_HAND' || effect.cost.type === 'SHUFFLE_HAND_TO_DECK') {
                        const requiredAmount = effect.cost.amount || 1;
                        const costFilter = effect.cost.cardTypeFilter;
                        const payableCount = ctx.player.hand.filter(card => !costFilter || card.type === costFilter).length;
                        if (payableCount < requiredAmount) return false;
                    }
                }

                if (effect.targets && effect.targets.selectMode === 'MANUAL') {
                    const candidates = TargetSelector.resolve(ctx.machine, effect.targets, effectContext);
                    if (candidates.length === 0) return false;
                }

                return true;
            });

        if (effectOptions.length === 0) return;

        const sourceZoneIndex = owner.unitZones.indexOf(targetZone);
        if (sourceZoneIndex < 0) return;

        ctx.machine.state.revealedCards = effectOptions.map(({ effect, effectIndex }) =>
            createPromptOptionCard(
                `BT06_EFFECT_OPTION_${sourceZoneIndex}_${effectIndex}`,
                `효과 ${effectIndex + 1}`,
                effect.description || '선택한 [액티브: 어택] 효과를 발동한다.'
            )
        ) as any;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT06_SELECT_ATTACK_ACTIVE_EFFECT',
            actionValue: {
                sourceZoneIndex,
                options: effectOptions.map(({ effectIndex }) => ({ effectIndex })),
                includeActivatedThisTurn,
            },
            effectDescription: '발동할 [액티브: 어택] 효과를 선택한다.',
            validTargets: 'REVEALED',
            targetSchema: {
                scope: 'REVEALED',
                type: 'CARD',
                count: 1,
                selectMode: 'MANUAL',
            },
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, null);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'PROMPT_SELECT_ENTRY_EFFECT') {
        const targetZone = (_targets || [])[0] as UnitZoneState | undefined;
        if (!targetZone?.unit) return;

        const owner = getOwnerOfZone(ctx.machine, targetZone);
        if (!owner || owner.id !== ctx.player.id) return;

        const effectOptions = (targetZone.unit.effects || [])
            .map((effect, effectIndex) => ({ effect, effectIndex }))
            .filter(({ effect }) => {
                if (!effect || effect.activation !== ActivationCondition.ENTRY) return false;

                const effectContext = {
                    sourceCard: targetZone.unit!,
                    player: ctx.player,
                    opponent: ctx.opponent,
                    unitZone: targetZone,
                    machine: ctx.machine,
                };

                if (!ctx.machine.effectManager.checkCondition(effect, effectContext)) return false;

                if (effect.cost && effect.cost.type !== 'NONE') {
                    if (effect.cost.type === 'TRASH_HAND' || effect.cost.type === 'SHUFFLE_HAND_TO_DECK') {
                        const requiredAmount = effect.cost.amount || 1;
                        const costFilter = effect.cost.cardTypeFilter;
                        const payableCount = ctx.player.hand.filter(card => !costFilter || card.type === costFilter).length;
                        if (payableCount < requiredAmount) return false;
                    }
                }

                if (effect.targets && effect.targets.selectMode === 'MANUAL') {
                    const candidates = TargetSelector.resolve(ctx.machine, effect.targets, effectContext);
                    if (candidates.length === 0) return false;
                }

                return true;
            });

        if (effectOptions.length === 0) return;

        const sourceZoneIndex = owner.unitZones.indexOf(targetZone);
        if (sourceZoneIndex < 0) return;

        ctx.machine.state.revealedCards = effectOptions.map(({ effect, effectIndex }) =>
            createPromptOptionCard(
                `BT06_ENTRY_OPTION_${sourceZoneIndex}_${effectIndex}`,
                `엔트리 효과 ${effectIndex + 1}`,
                effect.description || '선택한 [엔트리] 효과를 발동한다.'
            )
        ) as any;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT06_SELECT_ENTRY_EFFECT',
            actionValue: {
                sourceZoneIndex,
                options: effectOptions.map(({ effectIndex }) => ({ effectIndex })),
            },
            effectDescription: '발동할 [엔트리] 효과를 선택한다.',
            validTargets: 'REVEALED',
            targetSchema: {
                scope: 'REVEALED',
                type: 'CARD',
                count: 1,
                selectMode: 'MANUAL',
            },
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, null);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'SB01_001_ENTRY_PROMPT_SKILL_COST_DEBUFF') {
        const stage = (params as any).stage;
        if (stage === 'RESOLVE') {
            const targetZone = (_targets || [])[0] as UnitZoneState | undefined;
            if (!targetZone?.unit) return;
            const skillCost = Math.max(0, Number((ctx.flags as any)?.SB01_001_TRASHED_SKILL_COST ?? (params as any).skillCost ?? 0));
            if (skillCost <= 0) return;
            targetZone.buffs.push({
                id: ctx.machine.createRuntimeId('BUFF'),
                sourceCard: ctx.sourceCard,
                type: 'POWER',
                value: -2000 * skillCost,
                duration: 'TURN_END',
            });
            return;
        }

        const skills = ctx.player.skillZone
            .map((card, skillZoneIndex) => ({ card, skillZoneIndex }))
            .filter(({ card }) => card?.type === CardType.SKILL);
        if (skills.length <= 0) return;

        ctx.machine.state.revealedCards = skills.map(({ card, skillZoneIndex }) =>
            createPromptOptionCard(
                `SB01_001_SKILL_OPTION_${skillZoneIndex}_${card.id}`,
                card.name,
                card.text || `${card.name}를 트래시`,
                card.imageUrl,
            )
        ) as any;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'SB01_001_SELECT_SKILL_ZONE_TO_TRASH',
            actionValue: {
                options: skills.map(({ skillZoneIndex }) => ({ skillZoneIndex })),
            },
            effectDescription: '트래시할 스킬을 선택한다.',
            validTargets: 'REVEALED',
            targetSchema: {
                scope: 'REVEALED',
                type: 'CARD',
                count: 1,
                selectMode: 'MANUAL',
            },
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, null);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'SB01_002_ACTIVE_MAIN_BUFF_ATTACKERS_BY_DISCARDED_COST') {
        const discardedCost = Math.max(0, Number(ctx.costPaymentCard?.cost || 0));
        const friendlyAttackers = ctx.player.unitZones.filter((zone: any) => zone?.unit && zoneHasKeywordLike(zone, '어태커'));
        if (friendlyAttackers.length <= 0) return;

        const targets = friendlyAttackers.filter((zone: any) => Math.max(0, Number(zone.unit?.cost || 0)) <= discardedCost);
        targets.forEach((zone: any) => {
            zone.buffs.push({
                id: ctx.machine.createRuntimeId('BUFF'),
                sourceCard: ctx.sourceCard,
                type: 'POWER',
                value: discardedCost * 1000,
                duration: 'TURN_END',
            });
            zone.buffs.push({
                id: ctx.machine.createRuntimeId('BUFF'),
                sourceCard: ctx.sourceCard,
                type: 'HIT',
                value: 1,
                duration: 'TURN_END',
            });
        });
        return;
    }

    if ((params as any).mode === 'SB01_003_ATTACKER_BUFF_BY_DAMAGE_COUNT') {
        if (!ctx.unitZone?.unit) return;
        const value = Math.max(0, ctx.player.damage.length * 500);
        if (value <= 0) return;
        ctx.unitZone.buffs.push({
            id: ctx.machine.createRuntimeId('BUFF'),
            sourceCard: ctx.sourceCard,
            type: 'POWER',
            value,
            duration: 'BATTLE_END',
        });
        return;
    }

    if ((params as any).mode === 'SB01_003_ON_KILL_PROMPT_DISCARD_FOR_DAMAGE') {
        const stage = (params as any).stage;
        if (stage === 'RESOLVE') {
            const selectedCards = (_targets || []).filter((card: any) => ctx.player.hand.includes(card));
            if (selectedCards.length <= 0) return;
            const trashedCards: any[] = [];
            selectedCards.forEach((card: any) => {
                const handIndex = ctx.player.hand.indexOf(card);
                if (handIndex === -1) return;
                const [removed] = ctx.player.hand.splice(handIndex, 1);
                if (!removed) return;
                ctx.player.trash.push(removed);
                trashedCards.push(removed);
            });
            if (trashedCards.length > 0) {
                ctx.machine.notifyHandTrashed(ctx.player, trashedCards, {
                    flags: { handTrashByEffect: true },
                });
                ctx.machine.dealDamage(ctx.opponent, trashedCards.length);
            }
            return;
        }

        const hitMax = Math.max(0, Number(ctx.trashedUnit?.hit || 0));
        if (hitMax <= 0 || ctx.player.hand.length <= 0) return;
        const maxSelectable = Math.min(hitMax, ctx.player.hand.length);

        const handSchema = {
            scope: 'MY_HAND',
            type: 'CARD',
            count: maxSelectable,
            selectMode: 'MANUAL',
        } as const;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'SB01_003_SELECT_HAND_FOR_ON_KILL_DAMAGE',
            actionValue: {
                allowPartialSelection: true,
                minSelection: 0,
                maxSelection: maxSelectable,
            },
            effectDescription: '트래시할 패를 선택한다.',
            validTargets: 'MY_HAND',
            targetSchema: handSchema,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: ActivationCondition.ON_KILL,
            description: 'SB01-003 resolve optional discard damage',
            targets: handSchema as any,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'SB01_003_ON_KILL_PROMPT_DISCARD_FOR_DAMAGE',
                    stage: 'RESOLVE',
                },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'SB01_004_ACTIVE_DRAW_AND_PUNISH') {
        const attackerCount = ctx.player.unitZones.filter((zone: any) => zone?.unit && zoneHasKeywordLike(zone, '어태커')).length;
        if (attackerCount > 0) {
            drawCard(ctx, { count: attackerCount, __sourceActivation: (params as any).__sourceActivation }, _targets);
        }
        const current = (ctx.player as any).sb01OpponentEffectDrawPunish as { untilTurnCount: number; count: number } | undefined;
        const untilTurnCount = ctx.machine.state.turnCount + 1;
        const previousCount = current && ctx.machine.state.turnCount <= current.untilTurnCount
            ? Math.max(0, Number(current.count || 0))
            : 0;
        (ctx.player as any).sb01OpponentEffectDrawPunish = {
            untilTurnCount: Math.max(untilTurnCount, Number(current?.untilTurnCount || 0)),
            count: previousCount + 1,
        };
        return;
    }

    if ((params as any).mode === 'SB01_005_ACTIVE_DRAW_MARK_AND_OPTIONAL_TRASH') {
        const stage = (params as any).stage;
        if (stage === 'MARK_TARGET') {
            const targetZone = (_targets || [])[0] as UnitZoneState | undefined;
            if (targetZone?.unit) {
                targetZone.temporaryEffects.push({
                    activation: ActivationCondition.EXIT,
                    description: '엑시트 : 자신의 트래시 존에 있는 이 카드를 대미지 존에 놓는다.',
                    action: {
                        type: 'COMPLEX_ACTION',
                        params: {
                            mode: 'SB01_005_EXIT_MOVE_SKILL_FROM_TRASH_TO_DAMAGE',
                        },
                    },
                    duration: 'TURN_END',
                } as any);
            }

            const attackerCount = ctx.player.unitZones.filter((zone: any) => zone?.unit && zoneHasKeywordLike(zone, '어태커')).length;
            const inSkillZone = ctx.player.skillZone.includes(ctx.sourceCard);
            if (attackerCount >= 2 && inSkillZone) {
                const optionalEffect = {
                    activation: ActivationCondition.ACTIVE,
                    optional: true,
                    description: '이 스킬을 트래시할 수 있다.',
                    action: {
                        type: 'COMPLEX_ACTION',
                        params: {
                            mode: 'SB01_005_TRASH_SELF_FROM_SKILL_ZONE',
                        },
                    },
                } as any;
                ctx.machine.effectManager.processEffect(optionalEffect, ctx);
            }
            return;
        }

        drawCard(ctx, { count: 1, __sourceActivation: (params as any).__sourceActivation }, _targets);
        const targetSchema = {
            scope: 'OPP_FIELD',
            type: 'UNIT',
            count: 1,
            selectMode: 'MANUAL',
        } as const;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'SB01_005_SELECT_OPP_UNIT_TO_MARK',
            actionValue: {},
            effectDescription: '효과를 부여할 상대 유닛을 선택한다.',
            validTargets: 'OPP_UNITS',
            targetSchema: targetSchema as any,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: ActivationCondition.ACTIVE,
            description: 'SB01-005 resolve target grant',
            targets: targetSchema as any,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'SB01_005_ACTIVE_DRAW_MARK_AND_OPTIONAL_TRASH',
                    stage: 'MARK_TARGET',
                },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'SB01_005_TRASH_SELF_FROM_SKILL_ZONE') {
        const skillIndex = ctx.player.skillZone.indexOf(ctx.sourceCard);
        const resolvedIndex = skillIndex !== -1
            ? skillIndex
            : ctx.player.skillZone.findIndex((card: any) => card?.id === ctx.sourceCard.id);
        if (resolvedIndex === -1) return;
        const [removed] = ctx.player.skillZone.splice(resolvedIndex, 1);
        if (removed) {
            ctx.player.trash.push(removed);
        }
        return;
    }

    if ((params as any).mode === 'SB01_005_EXIT_MOVE_SKILL_FROM_TRASH_TO_DAMAGE') {
        // "이 카드"는 EXIT를 얻은(그리고 방금 트래시된) 해당 유닛 자신을 의미한다.
        const owner = ctx.player;
        let trashIndex = owner.trash.indexOf(ctx.sourceCard as any);
        if (trashIndex === -1) {
            const sourceId = (ctx.sourceCard as any)?.id;
            if (!sourceId) return;
            trashIndex = owner.trash.findIndex((card: any) => card?.id === sourceId);
        }
        if (trashIndex === -1) return;
        const [removed] = owner.trash.splice(trashIndex, 1);
        if (removed) {
            owner.damage.push(removed);
        }
        return;
    }

    if ((params as any).mode === 'SB01_006_ACTIVE_ATTACK_GRANT_BREAKTHROUGH_TO_LOW_COST') {
        const targets = ((_targets || []).filter((zone: any) => zone?.unit) as UnitZoneState[]);
        if (targets.length <= 0) return;
        const granted = {
            activation: ActivationCondition.ATTACKER,
            description: '어태커 : 돌파',
            action: { type: 'BREAKTHROUGH', params: { mode: 'ALL' } },
            duration: 'TURN_END',
        };
        grantEffect(ctx, { effect: granted, duration: 'TURN_END' }, targets as any);
        return;
    }

    if ((params as any).mode === 'SB01_007_EXIT_REVEAL_AND_DISCARD_TO_DEPLOY') {
        const stage = (params as any).stage;

        if (stage === 'SHOW_REVEALED_DECISION') {
            const revealedCardRef = (params as any).revealedCardRef;
            const revealedCardId = (params as any).revealedCardId;
            const revealedCardFromState = (ctx.machine.state.revealedCards || []).find((card: any) =>
                card === revealedCardRef ||
                (revealedCardId && card?.id === revealedCardId),
            );
            const revealedCard = revealedCardFromState || revealedCardRef;

            if (!revealedCard) {
                ctx.machine.state.revealedCards = [];
                return;
            }

            const hasEmptyZone = ctx.player.unitZones.some((zone: any) => !zone?.unit);
            if (revealedCard.type !== CardType.UNIT || ctx.player.hand.length <= 0 || !hasEmptyZone) {
                ctx.machine.state.revealedCards = [];
                ctx.player.trash.push(revealedCard);
                return;
            }

            ctx.machine.state.revealedCards = [revealedCard] as any;
            const targetSchema = {
                scope: 'REVEALED',
                type: 'CARD',
                count: 1,
                selectMode: 'MANUAL',
            } as const;
            ctx.machine.state.interactionMode = 'SELECT_TARGET';
            ctx.machine.state.pendingEffect = {
                sourceCard: ctx.sourceCard,
                sourcePlayerId: ctx.player.id,
                controllerPlayerId: ctx.player.id,
                actionType: 'SB01_007_SELECT_REVEALED_DEPLOY_CARD',
                actionValue: {
                    revealedCardRef,
                    revealedCardId,
                    allowPartialSelection: true,
                    minSelection: 0,
                    maxSelection: 1,
                },
                effectDescription: '공개 카드를 선택하고 확인하면 배치를 진행한다. 선택 없이 확인하면 카드를 트래시한다.',
                validTargets: 'REVEALED',
                targetSchema: targetSchema as any,
                selectedTargets: [],
            };
            ctx.machine.setPendingRuntime(ctx, {
                activation: ActivationCondition.EXIT,
                description: 'SB01-007 resolve revealed deploy decision',
                targets: targetSchema as any,
                action: {
                    type: 'COMPLEX_ACTION',
                    params: {
                        mode: 'SB01_007_EXIT_REVEAL_AND_DISCARD_TO_DEPLOY',
                        stage: 'RESOLVE_DEPLOY_DECISION',
                        revealedCardRef,
                        revealedCardId,
                    },
                },
            } as any);
            ctx.machine.setInteractionOwner(ctx.player.id);
            return;
        }

        if (stage === 'RESOLVE_DEPLOY_DECISION') {
            const selected = (_targets || [])[0];
            const revealedCardRef = (params as any).revealedCardRef;
            const revealedCardId = (params as any).revealedCardId;
            const revealedCardFromState = (ctx.machine.state.revealedCards || []).find((card: any) =>
                card === revealedCardRef ||
                (revealedCardId && card?.id === revealedCardId),
            );
            const revealedCard = revealedCardFromState || revealedCardRef;
            if (!revealedCard) {
                ctx.machine.state.revealedCards = [];
                return;
            }

            const selectedRevealed =
                selected === revealedCard ||
                (revealedCardId && selected?.id === revealedCardId);
            if (!selectedRevealed) {
                ctx.machine.state.revealedCards = [];
                ctx.player.trash.push(revealedCard);
                return;
            }

            ctx.machine.state.revealedCards = [];

            const targetSchema = {
                scope: 'MY_HAND',
                type: 'CARD',
                count: 1,
                selectMode: 'MANUAL',
            } as const;
            ctx.machine.state.interactionMode = 'SELECT_TARGET';
            ctx.machine.state.pendingEffect = {
                sourceCard: ctx.sourceCard,
                sourcePlayerId: ctx.player.id,
                controllerPlayerId: ctx.player.id,
                actionType: 'SB01_007_SELECT_HAND_TO_DISCARD_FOR_DEPLOY',
                actionValue: {
                    revealedCardRef,
                    revealedCardId,
                },
                effectDescription: '트래시할 패를 선택한다.',
                validTargets: 'MY_HAND',
                targetSchema: targetSchema as any,
                selectedTargets: [],
            };
            ctx.machine.setPendingRuntime(ctx, {
                activation: ActivationCondition.EXIT,
                description: 'SB01-007 discard hand then choose empty zone',
                targets: targetSchema as any,
                action: {
                    type: 'COMPLEX_ACTION',
                    params: {
                        mode: 'SB01_007_EXIT_REVEAL_AND_DISCARD_TO_DEPLOY',
                        stage: 'RESOLVE_DISCARD_THEN_PROMPT_ZONE',
                        revealedCardRef,
                        revealedCardId,
                    },
                },
            } as any);
            ctx.machine.setInteractionOwner(ctx.player.id);
            return;
        }

        if (stage === 'RESOLVE_DISCARD_THEN_PROMPT_ZONE') {
            const selectedHandCard = (_targets || []).find((card: any) => ctx.player.hand.includes(card));
            const revealedCardRef = (params as any).revealedCardRef;
            const revealedCardId = (params as any).revealedCardId;
            const revealedCardFromState = (ctx.machine.state.revealedCards || []).find((card: any) =>
                card === revealedCardRef ||
                (revealedCardId && card?.id === revealedCardId),
            );
            const revealedCard = revealedCardFromState || revealedCardRef;

            if (!selectedHandCard || !revealedCard) {
                if (revealedCard) {
                    ctx.player.trash.push(revealedCard);
                }
                ctx.machine.state.revealedCards = [];
                return;
            }

            const handIndex = ctx.player.hand.indexOf(selectedHandCard);
            if (handIndex === -1) {
                ctx.player.trash.push(revealedCard);
                ctx.machine.state.revealedCards = [];
                return;
            }
            const [discarded] = ctx.player.hand.splice(handIndex, 1);
            if (discarded) {
                ctx.player.trash.push(discarded);
                ctx.machine.notifyHandTrashed(ctx.player, [discarded], {
                    flags: { handTrashByEffect: true },
                });
            }

            const hasEmptyZone = ctx.player.unitZones.some((zone: any) => !zone?.unit);
            if (!hasEmptyZone) {
                ctx.player.trash.push(revealedCard);
                ctx.machine.state.revealedCards = [];
                return;
            }

            const zoneSchema = {
                scope: 'MY_FIELD',
                type: 'ALL',
                count: 1,
                selectMode: 'MANUAL',
            } as const;
            ctx.machine.state.interactionMode = 'SELECT_TARGET';
            ctx.machine.state.pendingEffect = {
                sourceCard: ctx.sourceCard,
                sourcePlayerId: ctx.player.id,
                controllerPlayerId: ctx.player.id,
                actionType: 'SB01_007_SELECT_EMPTY_ZONE_TO_DEPLOY',
                actionValue: {
                    revealedCardRef,
                    revealedCardId,
                },
                effectDescription: '배치할 빈 유닛 존을 선택한다.',
                validTargets: 'MY_UNITS',
                targetSchema: zoneSchema as any,
                selectedTargets: [],
            };
            ctx.machine.setPendingRuntime(ctx, null);
            ctx.machine.setInteractionOwner(ctx.player.id);
            return;
        }

        if (ctx.player.deck.length <= 0) return;
        const revealed = ctx.player.deck.pop();
        if (!revealed) return;
        const hasDeployOption =
            revealed.type === CardType.UNIT &&
            ctx.player.hand.length > 0 &&
            ctx.player.unitZones.some((zone: any) => !zone?.unit);

        if (!hasDeployOption) {
            ctx.machine.state.revealedCards = [];
            ctx.player.trash.push(revealed);
            return;
        }

        const optionalEffect = {
            activation: ActivationCondition.EXIT,
            optional: true,
            description: '공개한 카드를 처리한다.',
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'SB01_007_EXIT_REVEAL_AND_DISCARD_TO_DEPLOY',
                    stage: 'SHOW_REVEALED_DECISION',
                    revealedCardRef: revealed,
                    revealedCardId: revealed.id,
                },
            },
        } as any;
        ctx.machine.effectManager.processEffect(optionalEffect, ctx);
        return;
    }

    if ((params as any).mode === 'SB01_008_EXIT_REDEPLOY_IF_EFFECT_TRASHED') {
        if (ctx.trashReason !== 'EFFECT') return;
        if (!(ctx as any).costPaid) return;
        const emptyZone = ctx.player.unitZones.find((zone: any) => !zone?.unit);
        if (!emptyZone) return;

        const trashIndex = ctx.player.trash.indexOf(ctx.sourceCard);
        if (trashIndex === -1) return;

        const [revived] = ctx.player.trash.splice(trashIndex, 1);
        if (!revived) return;
        emptyZone.unit = revived;
        emptyZone.items = [];
        emptyZone.buffs = [];
        emptyZone.temporaryEffects = [];
        emptyZone.hasAttacked = false;
        emptyZone.attackCountThisTurn = 0;
        emptyZone.extraAttackAllowance = 0;
        emptyZone.isExhausted = false;
        emptyZone.hasPlacedUnitThisTurn = false;
        emptyZone.hasActivatedEffectThisTurn = false;
        emptyZone.activatedEffectKeys = {};
        ctx.machine.triggerEntryEffectsForPlacedUnit(ctx.player, emptyZone);
        return;
    }

    if ((params as any).mode === 'SB01_011_EXIT_DRAW_BY_EFFECT_TRASHED_COUNT') {
        if (ctx.machine.currentPlayer?.id !== ctx.player.id) return;
        const drawCount = Math.max(0, ctx.machine.getEffectTrashedFriendlyUnitCount(ctx.player.id));
        if (drawCount > 0) {
            drawCard(ctx, { count: drawCount, __sourceActivation: (params as any).__sourceActivation }, _targets);
        }
        if (drawCount >= 3) {
            damage(ctx, { value: 1, __sourceActivation: (params as any).__sourceActivation }, _targets);
        }
        return;
    }

    if ((params as any).mode === 'SB01_013_ENTRY_ENABLE_ACTIVE_DAMAGE_BONUS') {
        const current = (ctx.player as any).sb01ActiveDamageBonusUntilTurnEnd as
            | { untilTurnCount: number; bonus: number }
            | undefined;
        const previousBonus = current && ctx.machine.state.turnCount <= current.untilTurnCount
            ? Math.max(0, Number(current.bonus || 0))
            : 0;
        (ctx.player as any).sb01ActiveDamageBonusUntilTurnEnd = {
            untilTurnCount: ctx.machine.state.turnCount,
            bonus: previousBonus + 1,
        };

        const sourceZone = ctx.player.unitZones.find((zone: any) => zone?.unit === ctx.sourceCard);
        const hasCost5Unit = ctx.player.hand.some((card: any) => card?.type === CardType.UNIT && Number(card.cost || 0) === 5);
        if (!sourceZone || !hasCost5Unit) return;

        const optionalEffect = {
            activation: ActivationCondition.ENTRY,
            optional: true,
            description: '이 유닛을 트래시하고 5코스트 유닛으로 교체할 수 있다.',
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'SB01_013_PROMPT_SWAP_SELF_WITH_COST5',
                },
            },
        } as any;
        ctx.machine.effectManager.processEffect(optionalEffect, ctx);
        return;
    }

    if ((params as any).mode === 'SB01_013_PROMPT_SWAP_SELF_WITH_COST5') {
        const stage = (params as any).stage;
        if (stage === 'RESOLVE') {
            const selectedCard = (_targets || []).find((card: any) =>
                ctx.player.hand.includes(card) && card.type === CardType.UNIT && Number(card.cost || 0) === 5
            );
            if (!selectedCard) return;

            const sourceZone = ctx.player.unitZones.find((zone: any) => zone?.unit === ctx.sourceCard);
            if (!sourceZone) return;
            const sourceZoneIndex = ctx.player.unitZones.indexOf(sourceZone);
            if (sourceZoneIndex < 0) return;

            ctx.machine.destroyUnit(ctx.player, sourceZone, undefined, 'EFFECT');
            const zoneAfterDestroy = ctx.player.unitZones[sourceZoneIndex];
            if (!zoneAfterDestroy || zoneAfterDestroy.unit) return;

            const handIndex = ctx.player.hand.indexOf(selectedCard);
            if (handIndex === -1) return;
            const [placed] = ctx.player.hand.splice(handIndex, 1);
            if (!placed) return;

            zoneAfterDestroy.unit = placed;
            zoneAfterDestroy.items = [];
            zoneAfterDestroy.buffs = [];
            zoneAfterDestroy.temporaryEffects = [];
            zoneAfterDestroy.hasAttacked = false;
            zoneAfterDestroy.attackCountThisTurn = 0;
            zoneAfterDestroy.extraAttackAllowance = 0;
            zoneAfterDestroy.isExhausted = false;
            zoneAfterDestroy.hasPlacedUnitThisTurn = false;
            zoneAfterDestroy.hasActivatedEffectThisTurn = false;
            zoneAfterDestroy.activatedEffectKeys = {};
            (placed as any).turnCostOverride = {
                cost: 3,
                turnCount: ctx.machine.state.turnCount,
            };
            ctx.machine.triggerEntryEffectsForPlacedUnit(ctx.player, zoneAfterDestroy);
            return;
        }

        const sourceZone = ctx.player.unitZones.find((zone: any) => zone?.unit === ctx.sourceCard);
        if (!sourceZone) return;
        const cost5Units = ctx.player.hand.filter((card: any) => card?.type === CardType.UNIT && Number(card.cost || 0) === 5);
        if (cost5Units.length <= 0) return;

        const handSchema = {
            scope: 'MY_HAND',
            type: 'CARD',
            count: 1,
            filters: [
                { type: 'UNIT_TYPE', value: CardType.UNIT },
                { type: 'COST_EQUAL', value: 5 },
            ],
            selectMode: 'MANUAL',
        } as const;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'SB01_013_SELECT_COST5_UNIT_TO_SWAP',
            actionValue: {},
            effectDescription: '교체할 5코스트 유닛을 선택한다.',
            validTargets: 'MY_HAND',
            targetSchema: handSchema,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: ActivationCondition.ENTRY,
            description: 'SB01-013 resolve self swap',
            targets: handSchema as any,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'SB01_013_PROMPT_SWAP_SELF_WITH_COST5',
                    stage: 'RESOLVE',
                },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'SB01_014_ACTIVE_DEPLOY_LOW_COST_FROM_TRASH') {
        const stage = (params as any).stage;
        if (stage === 'RESOLVE') {
            const selectedCard = (_targets || []).find((card: any) =>
                ctx.player.trash.includes(card) && card.type === CardType.UNIT && Number(card.cost || 0) <= 2
            );
            if (!selectedCard) return;
            if (!ctx.player.unitZones.some((zone: any) => !zone?.unit)) return;

            const zoneSchema = {
                scope: 'MY_FIELD',
                type: 'ALL',
                count: 1,
                selectMode: 'MANUAL',
            } as const;
            ctx.machine.state.interactionMode = 'SELECT_TARGET';
            ctx.machine.state.pendingEffect = {
                sourceCard: ctx.sourceCard,
                sourcePlayerId: ctx.player.id,
                controllerPlayerId: ctx.player.id,
                actionType: 'SB01_014_SELECT_EMPTY_ZONE_TO_DEPLOY',
                actionValue: {
                    selectedCardRef: selectedCard,
                    selectedCardId: selectedCard.id,
                },
                effectDescription: '배치할 빈 유닛 존을 선택한다.',
                validTargets: 'MY_UNITS',
                targetSchema: zoneSchema as any,
                selectedTargets: [],
            };
            ctx.machine.setPendingRuntime(ctx, null);
            ctx.machine.setInteractionOwner(ctx.player.id);
            return;
        }

        const candidates = ctx.player.trash.filter((card: any) => card.type === CardType.UNIT && Number(card.cost || 0) <= 2);
        if (candidates.length <= 0) return;
        if (!ctx.player.unitZones.some((zone: any) => !zone?.unit)) return;

        const targetSchema = {
            scope: 'MY_TRASH',
            type: 'CARD',
            count: 1,
            filters: [
                { type: 'UNIT_TYPE', value: CardType.UNIT },
                { type: 'COST_LIMIT', value: 2 },
            ],
            selectMode: 'MANUAL',
        } as const;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'SB01_014_SELECT_TRASH_UNIT_TO_DEPLOY',
            actionValue: {},
            effectDescription: '배치할 유닛을 선택한다.',
            validTargets: 'MY_TRASH',
            targetSchema: targetSchema as any,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: ActivationCondition.ACTIVE,
            description: 'SB01-014 resolve deploy from trash',
            targets: targetSchema as any,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'SB01_014_ACTIVE_DEPLOY_LOW_COST_FROM_TRASH',
                    stage: 'RESOLVE',
                },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'SB01_014_EXIT_TRASH_PAIN_EATER_FROM_SKILL_ZONE') {
        const skillIndex = ctx.player.skillZone.findIndex((card: any) =>
            card?.id?.startsWith('SB01-014') || String(card?.name || '').includes('페인 이터')
        );
        if (skillIndex === -1) return;
        const [removed] = ctx.player.skillZone.splice(skillIndex, 1);
        if (removed) {
            ctx.player.trash.push(removed);
        }
        return;
    }

    if ((params as any).mode === 'SB01_015_ACTIVE_TRASH_AND_REDEPLOY_SAME_NAME') {
        const selectedZone = (_targets || [])[0] as UnitZoneState | undefined;
        if (!selectedZone?.unit) return;
        const owner = getOwnerOfZone(ctx.machine, selectedZone);
        if (!owner || owner.id !== ctx.player.id) return;
        const selectedUnit = selectedZone.unit;
        if (Math.max(0, Number(selectedUnit.cost || 0)) > 5) return;

        const laneIndex = ctx.player.unitZones.indexOf(selectedZone);
        if (laneIndex < 0) return;
        const unitName = selectedUnit.name;
        const unitCost = Math.max(0, Number(selectedUnit.cost || 0));

        ctx.machine.destroyUnit(ctx.player, selectedZone, undefined, 'EFFECT');

        const reviveIndex = ctx.player.trash.findIndex((card: any) =>
            card?.type === CardType.UNIT &&
            card?.name === unitName &&
            Math.max(0, Number(card?.cost || 0)) === unitCost
        );
        if (reviveIndex === -1) return;
        const lane = ctx.player.unitZones[laneIndex];
        if (!lane || lane.unit) return;
        const [revived] = ctx.player.trash.splice(reviveIndex, 1);
        if (!revived) return;
        lane.unit = revived;
        lane.items = [];
        lane.buffs = [];
        lane.temporaryEffects = [];
        lane.hasAttacked = false;
        lane.attackCountThisTurn = 0;
        lane.extraAttackAllowance = 0;
        lane.isExhausted = false;
        lane.hasPlacedUnitThisTurn = false;
        lane.hasActivatedEffectThisTurn = false;
        lane.activatedEffectKeys = {};
        ctx.machine.triggerEntryEffectsForPlacedUnit(ctx.player, lane);
        return;
    }

    if ((params as any).mode === 'SB01_017_DEFENDER_DISCARD_LOCK_ATTACKER_UNTIL_NEXT_OPP_TURN_END') {
        const attackerZoneIndex = ctx.machine.state.pendingAttackerIndex;
        if (typeof attackerZoneIndex !== 'number' || attackerZoneIndex < 0) return;
        const attackerZone = ctx.opponent.unitZones[attackerZoneIndex];
        if (!attackerZone?.unit) return;

        attackerZone.temporaryEffects.push({
            activation: ActivationCondition.PASSIVE,
            description: '패시브 : 이 유닛은 공격할 수 없다.',
            action: {
                type: 'NONE',
                params: {
                    cannotAttackUntilTurnCount: ctx.machine.state.turnCount + 2,
                },
            },
            duration: 'PERMANENT',
        } as any);
        return;
    }

    if ((params as any).mode === 'SB01_021_ENTRY_PROMPT_SELECT_ITEMS_AND_EQUIP') {
        const stage = (params as any).stage;
        if (stage === 'RESOLVE') {
            const unitZones = ctx.player.unitZones.filter((zone: any) => zone?.unit);
            if (unitZones.length <= 0) return;
            const selectedCards = (_targets || []).filter((card: any) =>
                card?.type === CardType.ITEM && (ctx.player.hand.includes(card) || ctx.player.trash.includes(card))
            );
            if (selectedCards.length <= 0) return;

            const equippedByZone = new Map<UnitZoneState, any[]>();
            selectedCards.slice(0, unitZones.length).forEach((card: any, idx: number) => {
                let removed: any | null = null;
                const handIndex = ctx.player.hand.indexOf(card);
                if (handIndex !== -1) {
                    [removed] = ctx.player.hand.splice(handIndex, 1);
                } else {
                    const trashIndex = ctx.player.trash.indexOf(card);
                    if (trashIndex !== -1) {
                        [removed] = ctx.player.trash.splice(trashIndex, 1);
                    }
                }
                if (!removed) return;

                const zone = unitZones[idx % unitZones.length];
                zone.items.push(removed);
                const existing = equippedByZone.get(zone) || [];
                existing.push(removed);
                equippedByZone.set(zone, existing);
            });

            equippedByZone.forEach((items, zone) => {
                if (items.length > 0) {
                    ctx.machine.notifyItemsEquipped(ctx.player, zone, items, {
                        sourceActivation: (params as any).__sourceActivation,
                        sourcePlayerId: ctx.player.id,
                        sourceCardId: ctx.sourceCard.id,
                    });
                }
            });
            return;
        }

        const unitZones = ctx.player.unitZones.filter((zone: any) => zone?.unit);
        if (unitZones.length <= 0) return;
        const candidates = [...ctx.player.hand, ...ctx.player.trash].filter((card: any) => card?.type === CardType.ITEM);
        if (candidates.length <= 0) return;

        const maxCount = Math.min(unitZones.length, candidates.length);
        ctx.machine.state.revealedCards = candidates;
        const targetSchema = {
            scope: 'REVEALED',
            type: 'CARD',
            count: maxCount,
            filters: [{ type: 'UNIT_TYPE', value: CardType.ITEM }],
            selectMode: 'MANUAL',
        } as const;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'SB01_021_SELECT_ITEMS_TO_EQUIP',
            actionValue: {
                allowPartialSelection: true,
                minSelection: 1,
            },
            effectDescription: '장착할 아이템을 선택한다.',
            validTargets: 'REVEALED',
            targetSchema: targetSchema as any,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: ActivationCondition.ENTRY,
            description: 'SB01-021 resolve equip items',
            targets: targetSchema as any,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'SB01_021_ENTRY_PROMPT_SELECT_ITEMS_AND_EQUIP',
                    stage: 'RESOLVE',
                },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'SB01_023_ENTRY_DISCARD_UP_TO_TWO_THEN_DRAW') {
        const stage = (params as any).stage;
        if (stage === 'RESOLVE') {
            const selectedCards = (_targets || []).filter((card: any) => ctx.player.hand.includes(card));
            let itemCount = 0;
            const trashedCards: any[] = [];
            selectedCards.forEach((card: any) => {
                const handIndex = ctx.player.hand.indexOf(card);
                if (handIndex === -1) return;
                const [removed] = ctx.player.hand.splice(handIndex, 1);
                if (!removed) return;
                ctx.player.trash.push(removed);
                trashedCards.push(removed);
                if (removed.type === CardType.ITEM) itemCount++;
            });
            if (trashedCards.length > 0) {
                ctx.machine.notifyHandTrashed(ctx.player, trashedCards, {
                    flags: { handTrashByEffect: true },
                });
            }
            const drawCount = trashedCards.length;
            if (drawCount > 0) {
                drawCard(ctx, { count: drawCount, __sourceActivation: (params as any).__sourceActivation }, _targets);
            }
            if (itemCount >= 2) {
                drawCard(ctx, { count: 1, __sourceActivation: (params as any).__sourceActivation }, _targets);
            }
            return;
        }

        const maxCount = Math.min(2, ctx.player.hand.length);
        if (maxCount <= 0) return;
        const handSchema = {
            scope: 'MY_HAND',
            type: 'CARD',
            count: maxCount,
            selectMode: 'MANUAL',
        } as const;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'SB01_023_SELECT_HAND_TO_TRASH',
            actionValue: {
                allowPartialSelection: true,
                minSelection: 0,
            },
            effectDescription: '트래시할 패를 최대 2장까지 선택한다.',
            validTargets: 'MY_HAND',
            targetSchema: handSchema,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: ActivationCondition.ENTRY,
            description: 'SB01-023 resolve hand discard and draw',
            targets: handSchema as any,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'SB01_023_ENTRY_DISCARD_UP_TO_TWO_THEN_DRAW',
                    stage: 'RESOLVE',
                },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'SB01_024_ACTIVE_MAIN_RECOVER_FROM_TRASH_BY_EQUIPPED_COUNT') {
        const stage = (params as any).stage;
        if (!ctx.unitZone?.unit) return;
        const equippedCount = ctx.unitZone.items.length;
        if (equippedCount <= 0) return;

        if (stage === 'RESOLVE') {
            const selectedCard = (_targets || []).find((card: any) =>
                ctx.player.trash.includes(card) && Math.max(0, Number(card?.cost || 0)) <= equippedCount
            );
            if (!selectedCard) return;
            const trashIndex = ctx.player.trash.indexOf(selectedCard);
            if (trashIndex === -1) return;
            const [removed] = ctx.player.trash.splice(trashIndex, 1);
            if (removed) {
                ctx.player.hand.push(removed);
            }
            return;
        }

        const targetSchema = {
            scope: 'MY_TRASH',
            type: 'CARD',
            count: 1,
            filters: [{ type: 'COST_LIMIT', value: equippedCount }],
            selectMode: 'MANUAL',
        } as const;
        const candidates = TargetSelector.resolve(ctx.machine, targetSchema as any, ctx as any);
        if (candidates.length <= 0) return;

        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'SB01_024_SELECT_TRASH_CARD_TO_HAND',
            actionValue: {},
            effectDescription: '패로 가져올 카드를 선택한다.',
            validTargets: 'MY_TRASH',
            targetSchema: targetSchema as any,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: 'SB01-024 resolve recover card',
            targets: targetSchema as any,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'SB01_024_ACTIVE_MAIN_RECOVER_FROM_TRASH_BY_EQUIPPED_COUNT',
                    stage: 'RESOLVE',
                },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'SB01_025_ACTIVE_DISCARD_ITEMS_AND_DRAW') {
        const stage = (params as any).stage;
        if (stage === 'RESOLVE') {
            const selectedItems = (_targets || []).filter((card: any) => ctx.player.hand.includes(card) && card.type === CardType.ITEM);
            if (selectedItems.length <= 0) return;
            const trashedCards: any[] = [];
            selectedItems.forEach((card: any) => {
                const handIndex = ctx.player.hand.indexOf(card);
                if (handIndex === -1) return;
                const [removed] = ctx.player.hand.splice(handIndex, 1);
                if (!removed) return;
                ctx.player.trash.push(removed);
                trashedCards.push(removed);
            });
            if (trashedCards.length > 0) {
                ctx.machine.notifyHandTrashed(ctx.player, trashedCards, {
                    flags: { handTrashByEffect: true },
                });
                drawCard(ctx, { count: trashedCards.length, __sourceActivation: (params as any).__sourceActivation }, _targets);
            }
            return;
        }

        const itemCardsInHand = ctx.player.hand.filter((card: any) => card.type === CardType.ITEM);
        if (itemCardsInHand.length <= 0) return;
        const handSchema = {
            scope: 'MY_HAND',
            type: 'CARD',
            count: itemCardsInHand.length,
            filters: [{ type: 'UNIT_TYPE', value: CardType.ITEM }],
            selectMode: 'MANUAL',
        } as const;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'SB01_025_SELECT_ITEMS_TO_TRASH',
            actionValue: {
                allowPartialSelection: true,
                minSelection: 1,
            },
            effectDescription: '트래시할 아이템을 선택한다.',
            validTargets: 'MY_HAND',
            targetSchema: handSchema,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: ActivationCondition.ACTIVE,
            description: 'SB01-025 resolve item discard draw',
            targets: handSchema as any,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'SB01_025_ACTIVE_DISCARD_ITEMS_AND_DRAW',
                    stage: 'RESOLVE',
                },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'PROMPT_SELECT_SKILL_ZONE_CARD_FOR_ZERO_COST') {
        const costMax = typeof (params as any).costMax === 'number' ? Math.max(0, (params as any).costMax) : null;
        const skills = ctx.player.skillZone
            .map((card, skillZoneIndex) => ({ card, skillZoneIndex }))
            .filter(({ card }) => {
                if (card?.type !== CardType.SKILL) return false;
                if (costMax === null) return true;
                return (card.cost || 0) <= costMax;
            });

        if (skills.length === 0) return;

        ctx.machine.state.revealedCards = skills.map(({ card, skillZoneIndex }) =>
            createPromptOptionCard(
                `BT06_SKILL_OPTION_${skillZoneIndex}_${card.id}`,
                card.name,
                card.text || `${card.name}를 0코스트로 설정`,
                card.imageUrl
            )
        ) as any;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT06_SELECT_SKILL_ZONE_CARD',
            actionValue: {
                options: skills.map(({ skillZoneIndex }) => ({ skillZoneIndex })),
                followUpSubActions: Array.isArray((params as any).followUpSubActions) ? (params as any).followUpSubActions : [],
                contextFlagKey: (params as any).contextFlagKey || 'BT06_SKILL_ZERO_COST_SELECTED',
                allowPartialSelection: (params as any).allowSkip === true,
            },
            effectDescription: '0코스트로 만들 스킬을 선택한다.',
            validTargets: 'REVEALED',
            targetSchema: {
                scope: 'REVEALED',
                type: 'CARD',
                count: 1,
                selectMode: 'MANUAL',
            },
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, null);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'BT03_PROMPT_SELECT_SKILL_ZONE_CARD_TO_TRASH') {
        const costMax = typeof (params as any).costMax === 'number' ? Math.max(0, (params as any).costMax) : null;
        const skills = ctx.player.skillZone
            .map((card, skillZoneIndex) => ({ card, skillZoneIndex }))
            .filter(({ card }) => {
                if (card?.type !== CardType.SKILL) return false;
                if (costMax === null) return true;
                return (card.cost || 0) <= costMax;
            });

        if (skills.length === 0) return;

        ctx.machine.state.revealedCards = skills.map(({ card, skillZoneIndex }) =>
            createPromptOptionCard(
                `BT03_SKILL_OPTION_${skillZoneIndex}_${card.id}`,
                card.name,
                card.text || `${card.name}를 트래시`,
                card.imageUrl
            )
        ) as any;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT03_SELECT_SKILL_ZONE_CARD_TO_TRASH',
            actionValue: {
                options: skills.map(({ skillZoneIndex }) => ({ skillZoneIndex })),
                followUpSubActions: Array.isArray((params as any).followUpSubActions) ? (params as any).followUpSubActions : [],
                contextFlagKey: (params as any).contextFlagKey || 'BT03_SKILL_ZONE_CARD_TRASHED',
            },
            effectDescription: '트래시할 스킬을 선택한다.',
            validTargets: 'REVEALED',
            targetSchema: {
                scope: 'REVEALED',
                type: 'CARD',
                count: 1,
                selectMode: 'MANUAL',
            },
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, null);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'BT03_011_PROMPT_TRASH_LOWER_COST_TO_HAND') {
        const skills = ctx.player.skillZone
            .map((card, skillZoneIndex) => ({ card, skillZoneIndex }))
            .filter(({ card }) => card?.type === CardType.SKILL);

        if (skills.length === 0) return;

        ctx.machine.state.revealedCards = skills.map(({ card, skillZoneIndex }) =>
            createPromptOptionCard(
                `BT03_011_SKILL_OPTION_${skillZoneIndex}_${card.id}`,
                card.name,
                card.text || `${card.name}를 트래시`,
                card.imageUrl
            )
        ) as any;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT03_011_SELECT_SKILL_ZONE_CARD_TO_TRASH',
            actionValue: {
                options: skills.map(({ skillZoneIndex }) => ({ skillZoneIndex })),
            },
            effectDescription: '트래시할 스킬을 선택한다.',
            validTargets: 'REVEALED',
            targetSchema: {
                scope: 'REVEALED',
                type: 'CARD',
                count: 1,
                selectMode: 'MANUAL',
            },
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, null);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'BT06_TRASH_TOP_AND_PROMPT_TRASHED_SKILL_CAST') {
        const trashCount = Math.max(0, (params as any).count ?? 1);
        const costMax = typeof (params as any).costMax === 'number' ? Math.max(0, (params as any).costMax) : null;
        const trashedCards: any[] = [];

        for (let i = 0; i < trashCount; i++) {
            if (ctx.player.deck.length <= 0) break;
            const card = ctx.player.deck.pop();
            if (!card) break;
            ctx.player.trash.push(card);
            trashedCards.push(card);
        }

        const skillOptions = trashedCards.filter(card => {
            if (!card || card.type !== CardType.SKILL) return false;
            if (costMax === null) return true;
            return (card.cost || 0) <= costMax;
        });

        if (skillOptions.length === 0) return;

        ctx.machine.state.revealedCards = skillOptions as any;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT06_SELECT_TRASHED_SKILL_TO_CAST',
            actionValue: {
                allowPartialSelection: (params as any).allowSkip === true,
            },
            effectDescription: '트래시한 카드 중 발동할 스킬을 선택한다.',
            validTargets: 'REVEALED',
            targetSchema: {
                scope: 'REVEALED',
                type: 'CARD',
                count: 1,
                selectMode: 'MANUAL',
            },
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, null);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'BT06_058_RETURN_ENCOUNTER_AND_SET_HIT') {
        if (!ctx.unitZone || !ctx.unitZone.unit) return;
        const laneIndex = ctx.player.unitZones.indexOf(ctx.unitZone);
        if (laneIndex < 0) return;

        const encounterZone = ctx.opponent.unitZones[laneIndex];
        if (!encounterZone?.unit) return;
        if ((encounterZone.unit.cost || 0) < 4) return;

        returnUnitAndItemsToHand(ctx, {}, [encounterZone]);
        buffHit(ctx, { value: 1, mode: 'SET', duration: 'TURN_END' }, [ctx.unitZone]);
        return;
    }

    if ((params as any).mode === 'BT06_062_PROMPT_UNIQUE_TRASH_SKILLS') {
        const cardType = (params as any).cardType || CardType.SKILL;
        const excludeKeyword = (params as any).excludeKeyword || '트리거';
        const excludeName = typeof (params as any).excludeName === 'string' ? String((params as any).excludeName).trim() : '';
        const requiredCount = Math.max(1, (params as any).requiredCount ?? 3);

        const uniqueByName = new Map<string, any>();
        ctx.player.trash.forEach((card: any) => {
            if (!card || card.type !== cardType) return;
            if (excludeKeyword && cardHasKeywordLike(card, excludeKeyword)) return;
            const nameKey = String(card.name || card.id || '').trim();
            if (!nameKey) return;
            if (excludeName && nameKey === excludeName) return;
            if (!uniqueByName.has(nameKey)) {
                uniqueByName.set(nameKey, card);
            }
        });

        const options = Array.from(uniqueByName.values());
        if (options.length < requiredCount) return;

        const selectionSchema = {
            scope: 'REVEALED',
            type: 'CARD',
            count: requiredCount,
            selectMode: 'MANUAL',
        } as const;

        ctx.machine.state.revealedCards = options as any;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT06_062_SELECT_UNIQUE_TRASH_SKILLS',
            actionValue: {
                allowPartialSelection: false,
            },
            effectDescription: '카드명이 다른 비트리거 스킬 3장을 고른다.',
            validTargets: 'REVEALED',
            targetSchema: selectionSchema,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: 'BT06-062 unique trash skills resolve',
            targets: selectionSchema as any,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT06_062_RESOLVE_UNIQUE_TRASH_SKILLS',
                    damageValue: (params as any).damageValue ?? 2,
                },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'BT06_062_RESOLVE_UNIQUE_TRASH_SKILLS') {
        const selectedCards = (_targets || []).filter(card => ctx.player.trash.includes(card));
        if (selectedCards.length === 0) return;

        const movedToDeckBottom: any[] = [];
        selectedCards.forEach((card: any) => {
            const trashIndex = ctx.player.trash.indexOf(card);
            if (trashIndex === -1) return;
            const [removed] = ctx.player.trash.splice(trashIndex, 1);
            if (removed) movedToDeckBottom.push(removed);
        });
        if (movedToDeckBottom.length > 0) {
            ctx.player.deck.unshift(...movedToDeckBottom);
        }

        const damageValue = Math.max(0, (params as any).damageValue ?? 2);
        if (damageValue > 0) {
            ctx.machine.dealDamage(ctx.opponent, damageValue);
        }

        if (ctx.unitZone?.unit) {
            ctx.unitZone.temporaryEffects.push({
                activation: ActivationCondition.PASSIVE,
                description: '패시브 : 이 유닛은 이 턴이 끝날 때까지 공격할 수 없다.',
                action: { type: 'NONE', params: { cannotAttack: true } },
                duration: 'TURN_END',
            } as any);
        }
        return;
    }

    if ((params as any).mode === 'BT06_070_GRANT_ATTACKER_OPPONENT_DRAW_UNTIL_OPP_TURN_END') {
        const untilTurnCount = ctx.machine.state.turnCount + Math.max(0, (params as any).untilTurnCountOffset ?? 1);
        (_targets || []).forEach((target: any) => {
            if (!target || !('temporaryEffects' in target) || !target.unit) return;
            target.temporaryEffects.push({
                activation: ActivationCondition.ATTACKER,
                description: '어태커 : 상대는 카드를 1장 드로우한다.',
                action: {
                    type: 'DRAW',
                    params: {
                        count: 1,
                        target: 'OPPONENT',
                        untilTurnCount,
                    },
                },
                duration: 'PERMANENT',
            } as any);
        });
        return;
    }

    if ((params as any).mode === 'BT06_GRANT_BERSERK_UNTIL_OPP_TURN_END') {
        const untilTurnCount = ctx.machine.state.turnCount + Math.max(0, (params as any).untilTurnCountOffset ?? 1);
        (_targets || []).forEach((target: any) => {
            if (!target || !('temporaryEffects' in target) || !target.unit) return;
            target.temporaryEffects.push({
                activation: ActivationCondition.PASSIVE,
                description: '광전사',
                action: { type: 'NONE', params: { keyword: 'BERSERK', untilTurnCount } },
                duration: 'PERMANENT',
            } as any);
        });
        return;
    }

    if ((params as any).mode === 'BT06_077_DRAW_BY_DEFENDER_AND_LOCK_OPP_ATTACKER') {
        const defenderCount = ctx.player.unitZones.filter((zone: any) =>
            zoneHasKeywordLike(zone, '디펜더') || zoneHasKeywordLike(zone, 'DEFENDER')
        ).length;

        if (defenderCount > 0) {
            const playerIndex = ctx.machine.state.players.indexOf(ctx.player);
            ctx.machine.drawCard(playerIndex, defenderCount, {
                reason: 'EFFECT',
                sourceActivation: (params as any).__sourceActivation,
            });
        }

        const untilTurnCount = ctx.machine.state.turnCount + Math.max(0, (params as any).untilTurnCountOffset ?? 1);
        const lockUntilMap = (ctx.opponent.lockedActivationsUntilTurnCount || {}) as Record<string, number>;
        const current = lockUntilMap[String(ActivationCondition.ATTACKER)] ?? 0;
        lockUntilMap[String(ActivationCondition.ATTACKER)] = Math.max(current, untilTurnCount);
        ctx.opponent.lockedActivationsUntilTurnCount = lockUntilMap as any;
        return;
    }

    if ((params as any).mode === 'BT06_080_DISCARD_ALL_AND_DRAW_TO_HAND_SIZE') {
        discardAll(ctx, {}, _targets);
        const targetHandSize = Math.max(0, (params as any).targetHandSize ?? 5);
        const drawCount = Math.max(0, targetHandSize - ctx.player.hand.length);
        if (drawCount > 0) {
            const playerIndex = ctx.machine.state.players.indexOf(ctx.player);
            ctx.machine.drawCard(playerIndex, drawCount, {
                reason: 'EFFECT',
                sourceActivation: (params as any).__sourceActivation,
            });
        }
        return;
    }

    if ((params as any).mode === 'BT06_029_KEEP_AND_REFILL') {
        const keepSet = new Set((_targets || []).filter(card => ctx.player.hand.includes(card)));
        const cardsToTrash = ctx.player.hand.filter(card => !keepSet.has(card));
        const cardsToKeep = ctx.player.hand.filter(card => keepSet.has(card));

        if (cardsToTrash.length > 0) {
            ctx.player.hand = cardsToKeep;
            ctx.player.trash.push(...cardsToTrash);
            (ctx as any).discardedCount = cardsToTrash.length;
            ctx.machine.notifyHandTrashed(ctx.player, cardsToTrash, {
                flags: {
                    handTrashByEffect: true,
                },
            });
        } else {
            (ctx as any).discardedCount = 0;
        }

        const targetHandSize = Math.max(0, (params as any).targetHandSize ?? 3);
        const drawCount = Math.max(0, targetHandSize - ctx.player.hand.length);
        if (drawCount > 0) {
            const playerIndex = ctx.machine.state.players.indexOf(ctx.player);
            ctx.machine.drawCard(playerIndex, drawCount, {
                reason: 'EFFECT',
                sourceActivation: (params as any).__sourceActivation,
            });
        }
        return;
    }

    if ((params as any).mode === 'BT06_051_LOCK_ENCOUNTER_UNTIL_OPP_TURN_END') {
        const targetZone = (_targets || [])[0] as UnitZoneState | undefined;
        if (!targetZone?.unit) return;
        const untilTurnCount = ctx.machine.state.turnCount + 1;

        targetZone.temporaryEffects.push({
            activation: ActivationCondition.PASSIVE,
            description: '패시브 : 이 유닛은 상대의 턴이 끝날 때까지 공격할 수 없다.',
            action: { type: 'NONE', params: { cannotAttackUntilTurnCount: untilTurnCount } },
            duration: 'PERMANENT',
        } as any);
        return;
    }

    if ((params as any).mode === 'BT06_034_FORCE_SELECTED_ATTACK_IF_ENCOUNTER') {
        const targetZone = (_targets || [])[0] as UnitZoneState | undefined;
        if (!targetZone?.unit) return;
        const owner = getOwnerOfZone(ctx.machine, targetZone);
        if (!owner || owner.id !== ctx.player.id) return;

        const zoneIndex = owner.unitZones.indexOf(targetZone);
        if (zoneIndex < 0) return;
        if (!ctx.opponent.unitZones[zoneIndex]?.unit) return;
        if (ctx.machine.currentPlayer?.id !== ctx.player.id) return;
        if (ctx.machine.state.combatStep !== 'NONE') return;

        const previousPhase = ctx.machine.state.phase;
        (ctx.machine.state as any).resumePhaseAfterAutoAttack = previousPhase;
        ctx.machine.state.phase = Phase.ATTACK;
        ctx.machine.attack(zoneIndex, { byCardEffect: true });

        if (ctx.machine.state.interactionMode === 'NORMAL' && ctx.machine.state.combatStep === 'NONE') {
            ctx.machine.state.phase = previousPhase;
            delete (ctx.machine.state as any).resumePhaseAfterAutoAttack;
        }
        return;
    }

    if ((params as any).mode === 'BT06_035_APPLY_HAND_DIFF_DEBUFF') {
        const targetZone = (_targets || [])[0] as UnitZoneState | undefined;
        if (!targetZone?.unit) return;
        const diff = Math.abs(ctx.player.hand.length - ctx.opponent.hand.length);
        if (diff <= 0) return;
        const valuePerDiff = Math.max(0, (params as any).valuePerDiff ?? 2000);
        if (valuePerDiff <= 0) return;

        targetZone.buffs.push({
            id: ctx.machine.createRuntimeId('BUFF'),
            sourceCard: ctx.sourceCard,
            type: 'POWER',
            value: -valuePerDiff * diff,
            duration: (params as any).duration || 'TURN_END',
        });
        return;
    }

    if ((params as any).mode === 'LOCK_ACTIVATION_UNTIL_TURN_END') {
        const targetPlayer = (params as any).target === 'OPPONENT' ? ctx.opponent : ctx.player;
        const activation = (params as any).activation;
        if (!targetPlayer || !activation) return;

        if (typeof (params as any).untilTurnCountOffset === 'number') {
            const untilTurnCount = ctx.machine.state.turnCount + Math.max(0, (params as any).untilTurnCountOffset);
            const lockUntilMap = (targetPlayer.lockedActivationsUntilTurnCount || {}) as Record<string, number>;
            const current = lockUntilMap[String(activation)] ?? 0;
            lockUntilMap[String(activation)] = Math.max(current, untilTurnCount);
            targetPlayer.lockedActivationsUntilTurnCount = lockUntilMap as any;
            return;
        }

        const lockMap = (targetPlayer.lockedActivationsUntilTurnEnd || {}) as Record<string, boolean>;
        lockMap[String(activation)] = true;
        targetPlayer.lockedActivationsUntilTurnEnd = lockMap as any;
        return;
    }

    if ((params as any).mode === 'BT06_039_PROMPT_DISCARD_FOR_SCALING_DEBUFF') {
        const targetZone = (_targets || [])[0] as UnitZoneState | undefined;
        if (!targetZone?.unit) return;
        const owner = getOwnerOfZone(ctx.machine, targetZone);
        if (!owner) return;
        const zoneIndex = owner.unitZones.indexOf(targetZone);
        if (zoneIndex < 0) return;

        ctx.flags = ctx.flags || {};
        ctx.flags.BT06_039_TARGET_PLAYER_ID = owner.id;
        ctx.flags.BT06_039_TARGET_ZONE_INDEX = zoneIndex;

        const handCount = ctx.player.hand.length;
        const handSelectionSchema = {
            scope: 'MY_HAND',
            type: 'CARD',
            count: handCount,
            selectMode: 'MANUAL',
        } as const;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT06_SELECT_HAND_TO_TRASH_FOR_SCALING_DEBUFF',
            actionValue: { allowPartialSelection: true },
            effectDescription: '트래시할 패를 원하는 수만큼 고른다.',
            validTargets: 'MY_HAND',
            targetSchema: handSelectionSchema,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: 'ACTIVE' as any,
            description: 'BT06-039 discard and scale debuff',
            targets: handSelectionSchema as any,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT06_039_RESOLVE_DISCARD_AND_APPLY',
                    duration: (params as any).duration || 'TURN_END',
                    valuePerCard: Math.max(0, (params as any).valuePerCard ?? 3000),
                },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'BT06_039_RESOLVE_DISCARD_AND_APPLY') {
        const selectedCards = (_targets || []).filter(card => ctx.player.hand.includes(card));
        const trashedCards: any[] = [];
        selectedCards.forEach((card: any) => {
            const handIndex = ctx.player.hand.indexOf(card);
            if (handIndex === -1) return;
            const [removed] = ctx.player.hand.splice(handIndex, 1);
            if (!removed) return;
            ctx.player.trash.push(removed);
            trashedCards.push(removed);
        });

        if (trashedCards.length > 0) {
            ctx.machine.notifyHandTrashed(ctx.player, trashedCards, {
                flags: {
                    handTrashByEffect: true,
                },
            });
        }
        (ctx as any).discardedCount = trashedCards.length;

        const targetPlayerId = ctx.flags?.BT06_039_TARGET_PLAYER_ID;
        const targetZoneIndex = ctx.flags?.BT06_039_TARGET_ZONE_INDEX;
        const valuePerCard = Math.max(0, (params as any).valuePerCard ?? 3000);
        const debuffValue = trashedCards.length * valuePerCard;
        if (!targetPlayerId || typeof targetZoneIndex !== 'number' || debuffValue <= 0) return;

        const targetPlayer = ctx.machine.state.players.find((player: any) => player.id === targetPlayerId);
        const targetZone = targetPlayer?.unitZones?.[targetZoneIndex];
        if (!targetZone?.unit) return;

        targetZone.buffs.push({
            id: ctx.machine.createRuntimeId('BUFF'),
            sourceCard: ctx.sourceCard,
            type: 'POWER',
            value: -debuffValue,
            duration: (params as any).duration || 'TURN_END',
        });
        return;
    }

    if ((params as any).mode === 'BT03_015_PROMPT_UNIT_DISCARD_FOR_POWER_DEBUFF') {
        const targetZone = (_targets || [])[0] as UnitZoneState | undefined;
        if (!targetZone?.unit) return;
        const owner = getOwnerOfZone(ctx.machine, targetZone);
        if (!owner) return;
        const zoneIndex = owner.unitZones.indexOf(targetZone);
        if (zoneIndex < 0) return;

        const payableUnitCount = ctx.player.hand.filter(card => card.type === CardType.UNIT).length;
        if (payableUnitCount <= 0) return;

        ctx.flags = ctx.flags || {};
        ctx.flags.BT03_015_TARGET_PLAYER_ID = owner.id;
        ctx.flags.BT03_015_TARGET_ZONE_INDEX = zoneIndex;

        ctx.machine.state.interactionMode = 'SELECT_COST';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT03_015_SELECT_UNIT_DISCARD_FOR_DEBUFF',
            actionValue: {},
            effectDescription: '패의 유닛 카드 1장을 트래시한다.',
            selectionPurpose: '패 유닛 카드 1장 코스트 지불',
            costToPay: { type: 'TRASH_HAND', amount: 1, cardTypeFilter: CardType.UNIT },
            costCardTypeFilter: CardType.UNIT,
            costPaidCount: 0,
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: 'ACTIVE' as any,
            description: 'BT03-015 discard unit and apply debuff',
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT03_015_RESOLVE_DISCARD_AND_APPLY',
                    duration: (params as any).duration || 'TURN_END',
                },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'BT03_015_RESOLVE_DISCARD_AND_APPLY') {
        const targetPlayerId = ctx.flags?.BT03_015_TARGET_PLAYER_ID;
        const targetZoneIndex = ctx.flags?.BT03_015_TARGET_ZONE_INDEX;
        const costCard = ctx.costPaymentCard;
        const debuffValue = Math.max(0, costCard?.power || 0);
        if (!targetPlayerId || typeof targetZoneIndex !== 'number' || debuffValue <= 0) return;

        const targetPlayer = ctx.machine.state.players.find((player: any) => player.id === targetPlayerId);
        const targetZone = targetPlayer?.unitZones?.[targetZoneIndex];
        if (!targetZone?.unit) return;

        targetZone.buffs.push({
            id: ctx.machine.createRuntimeId('BUFF'),
            sourceCard: ctx.sourceCard,
            type: 'POWER',
            value: -debuffValue,
            duration: (params as any).duration || 'TURN_END',
        });
        return;
    }

    if ((params as any).mode === 'BT03_017_PROMPT_DISCARD_THEN_SET_OPP_POWER') {
        const targetZone = (_targets || [])[0] as UnitZoneState | undefined;
        if (!targetZone?.unit) return;
        const owner = getOwnerOfZone(ctx.machine, targetZone);
        if (!owner) return;
        const zoneIndex = owner.unitZones.indexOf(targetZone);
        if (zoneIndex < 0) return;
        if (ctx.player.hand.length <= 0) return;

        ctx.flags = ctx.flags || {};
        ctx.flags.BT03_017_TARGET_PLAYER_ID = owner.id;
        ctx.flags.BT03_017_TARGET_ZONE_INDEX = zoneIndex;

        ctx.machine.state.interactionMode = 'SELECT_COST';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT03_017_SELECT_HAND_DISCARD_FOR_SET_POWER',
            actionValue: {},
            effectDescription: '패 1장을 트래시한다.',
            selectionPurpose: '패 1장 코스트 지불',
            costToPay: { type: 'TRASH_HAND', amount: 1 },
            costPaidCount: 0,
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: 'ACTIVE' as any,
            description: 'BT03-017 discard and set opponent power',
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT03_017_RESOLVE_DISCARD_AND_APPLY',
                    setValue: Math.max(0, (params as any).setValue ?? 3000),
                    duration: (params as any).duration || 'TURN_END',
                },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'BT03_017_RESOLVE_DISCARD_AND_APPLY') {
        const targetPlayerId = ctx.flags?.BT03_017_TARGET_PLAYER_ID;
        const targetZoneIndex = ctx.flags?.BT03_017_TARGET_ZONE_INDEX;
        if (!targetPlayerId || typeof targetZoneIndex !== 'number') return;

        const targetPlayer = ctx.machine.state.players.find((player: any) => player.id === targetPlayerId);
        const targetZone = targetPlayer?.unitZones?.[targetZoneIndex];
        if (!targetZone?.unit) return;

        targetZone.buffs.push({
            id: ctx.machine.createRuntimeId('BUFF'),
            sourceCard: ctx.sourceCard,
            type: 'POWER',
            value: Math.max(0, (params as any).setValue ?? 3000),
            mode: 'SET',
            duration: (params as any).duration || 'TURN_END',
        });
        return;
    }

    if ((params as any).mode === 'BT03_025_ENTRY_LEVEL_OR_DRAW') {
        const threshold = Math.max(0, (params as any).leaderLevelThreshold ?? 10);
        if (ctx.player.leaderLevel >= threshold) {
            drawCard(ctx, { count: Math.max(0, (params as any).drawCount ?? 1), __sourceActivation: (params as any).__sourceActivation }, _targets);
        } else {
            gainLevel(ctx, { value: Math.max(0, (params as any).gainLevelValue ?? 1) }, _targets);
        }
        return;
    }

    if ((params as any).mode === 'BT03_027_GRANT_PENETRATION_IF_POWER_AHEAD') {
        if (!ctx.unitZone?.unit) return;
        const laneIndex = ctx.player.unitZones.indexOf(ctx.unitZone);
        if (laneIndex < 0) return;

        const encounterZone = ctx.opponent.unitZones[laneIndex];
        if (!encounterZone?.unit) return;

        const selfPower = ctx.machine.getUnitPower(ctx.unitZone, ctx.player);
        const encounterPower = ctx.machine.getUnitPower(encounterZone, ctx.opponent);
        const threshold = Math.max(0, (params as any).threshold ?? 3500);
        if (selfPower - encounterPower < threshold) return;

        const penetrationValue = Math.max(0, (params as any).penetrationValue ?? 1);
        const duration = (params as any).duration || 'TURN_END';
        grantEffect(ctx, {
            effect: {
                activation: ActivationCondition.ATTACKER,
                description: `어태커 : 관통[${penetrationValue}]`,
                action: { type: 'PENETRATION', params: { value: penetrationValue } },
                duration,
            },
            duration,
        }, [ctx.unitZone]);
        return;
    }

    if ((params as any).mode === 'BT03_030_BUFF_HIT_AND_DRAW_IF_LOW_COST_UNITS_MIN') {
        const targets = (_targets || []).filter((target: any) => target?.unit);
        const duration = (params as any).duration || 'TURN_END';
        const hitValue = (params as any).hitValue ?? 1;
        const minCount = Math.max(0, (params as any).minCount ?? 3);
        const drawCount = Math.max(0, (params as any).drawCount ?? 1);

        if (targets.length > 0) {
            buffHit(ctx, { value: hitValue, duration }, targets);
        }
        if (targets.length >= minCount && drawCount > 0) {
            drawCard(ctx, { count: drawCount, __sourceActivation: (params as any).__sourceActivation }, _targets);
        }
        return;
    }

    if ((params as any).mode === 'BT03_031_DESTROY_ENCOUNTER_IF_SELECTED_UNIT_POWER_HIGHER') {
        const selectedZone = (_targets || [])[0] as UnitZoneState | undefined;
        if (!selectedZone?.unit) return;
        const owner = getOwnerOfZone(ctx.machine, selectedZone);
        if (!owner || owner.id !== ctx.player.id) return;

        const laneIndex = ctx.player.unitZones.indexOf(selectedZone);
        if (laneIndex < 0) return;
        const encounterZone = ctx.opponent.unitZones[laneIndex];
        if (!encounterZone?.unit) return;

        const selectedPower = ctx.machine.getUnitPower(selectedZone, ctx.player);
        const encounterPower = ctx.machine.getUnitPower(encounterZone, ctx.opponent);
        if (selectedPower > encounterPower) {
            ctx.machine.destroyUnit(ctx.opponent, encounterZone, undefined, 'EFFECT');
        }
        return;
    }

    if ((params as any).mode === 'BT03_032_BUFF_LOW_COST_UNITS_AND_BONUS_HIT') {
        const targets = (_targets || []).filter((target: any) => target?.unit);
        if (targets.length === 0) return;

        const duration = (params as any).duration || 'TURN_END';
        const powerValue = (params as any).powerValue ?? 5000;
        const hitValue = (params as any).hitValue ?? 1;
        const minCount = Math.max(0, (params as any).minCount ?? 3);

        buffPower(ctx, { value: powerValue, duration }, targets);
        if (targets.length >= minCount) {
            buffHit(ctx, { value: hitValue, duration }, targets);
        }
        return;
    }

    if ((params as any).mode === 'BT03_036_DRAW_BY_EXIT_UNIT_COUNT') {
        const drawPerUnit = Math.max(0, (params as any).drawPerUnit ?? 1);
        const exitUnitCount = countFriendlyExitUnits(ctx.player);
        const drawCount = exitUnitCount * drawPerUnit;
        if (drawCount <= 0) return;
        drawCard(ctx, {
            count: drawCount,
            __sourceActivation: (params as any).__sourceActivation,
        }, _targets);
        return;
    }

    if ((params as any).mode === 'BT03_037_APPLY_DEBUFF_BY_EXIT_UNIT_COUNT') {
        const targetZone = (_targets || [])[0] as UnitZoneState | undefined;
        if (!targetZone?.unit) return;
        const valuePerUnit = Math.max(0, (params as any).valuePerUnit ?? 2500);
        const exitUnitCount = countFriendlyExitUnits(ctx.player);
        const debuffValue = exitUnitCount * valuePerUnit;
        if (debuffValue <= 0) return;
        targetZone.buffs.push({
            id: ctx.machine.createRuntimeId('BUFF'),
            sourceCard: ctx.sourceCard,
            type: 'POWER',
            value: -debuffValue,
            duration: (params as any).duration || 'TURN_END',
        });
        return;
    }

    if ((params as any).mode === 'BT03_040_PROMPT_OPP_DISCARD_TO_HAND_SIZE') {
        const keepCount = Math.max(0, (params as any).keepCount ?? 4);
        const discardCount = Math.max(0, ctx.opponent.hand.length - keepCount);
        if (discardCount <= 0) return;

        const handSelectionSchema = {
            scope: 'OPP_HAND',
            type: 'CARD',
            count: discardCount,
            selectMode: 'MANUAL',
        } as const;

        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.opponent.id,
            actionType: 'BT03_040_OPP_SELECT_HAND_TO_TRASH',
            actionValue: { allowPartialSelection: false, requiredCount: discardCount },
            effectDescription: '상대는 패를 4장 남기고 버릴 카드를 고른다.',
            selectionPurpose: '버릴 상대 패 선택',
            validTargets: 'OPP_HAND',
            targetSchema: handSelectionSchema,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: 'ACTIVE' as any,
            description: 'BT03-040 opponent discard to hand size',
            targets: handSelectionSchema as any,
            action: { type: 'DISCARD', params: { target: 'OPPONENT', count: discardCount } },
        } as any);
        ctx.machine.setInteractionOwner(ctx.opponent.id);
        return;
    }

    if ((params as any).mode === 'BT03_041_EXIT_PROMPT_DISCARD_AND_REVIVE') {
        const exitCandidates = ctx.player.hand
            .map((card: any, handIndex: number) => ({ card, handIndex }))
            .filter(({ card }) =>
                !!card &&
                (card.type === CardType.UNIT || card.type === CardType.ITEM) &&
                cardHasKeywordLike(card, '엑시트')
            );
        if (exitCandidates.length === 0) return;

        ctx.machine.state.revealedCards = exitCandidates.map(({ card, handIndex }) =>
            createPromptOptionCard(
                `BT03_041_HAND_OPTION_${handIndex}_${card.id}`,
                card.name,
                card.text || `${card.name}를 트래시`,
                card.imageUrl,
            )
        ) as any;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT03_041_SELECT_EXIT_HAND_CARD',
            actionValue: {
                options: exitCandidates.map(({ handIndex }) => ({ handIndex })),
                powerBuffValue: Math.max(0, (params as any).powerBuffValue ?? 2500),
            },
            effectDescription: '트래시할 [엑시트] 카드 1장을 선택한다.',
            validTargets: 'REVEALED',
            targetSchema: {
                scope: 'REVEALED',
                type: 'CARD',
                count: 1,
                selectMode: 'MANUAL',
            },
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, null);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'BT03_045_TRASH_AND_GRANT_EXIT_RETURN') {
        const selectedZone = (_targets || [])[0] as UnitZoneState | undefined;
        if (!selectedZone?.unit) return;
        const owner = getOwnerOfZone(ctx.machine, selectedZone);
        if (!owner || owner.id !== ctx.player.id) return;

        ctx.machine.destroyUnit(owner, selectedZone, undefined, 'EFFECT');

        const remainingFriendlyUnits = ctx.player.unitZones.filter((zone: any) => zone?.unit);
        if (remainingFriendlyUnits.length <= 0) return;

        grantEffect(ctx, {
            effect: {
                activation: ActivationCondition.EXIT,
                description: '엑시트 : 귀환',
                action: { type: 'RETURN_FROM_TRASH_AT_TURN_END', params: {} },
                duration: (params as any).duration || 'TURN_END',
            },
            duration: (params as any).duration || 'TURN_END',
        }, remainingFriendlyUnits);
        return;
    }

    if ((params as any).mode === 'BT03_049_BUFF_OTHERS_BY_SELECTED_POWER_THEN_TRASH') {
        const selectedZone = (_targets || [])[0] as UnitZoneState | undefined;
        if (!selectedZone?.unit) return;
        const owner = getOwnerOfZone(ctx.machine, selectedZone);
        if (!owner || owner.id !== ctx.player.id) return;

        const selectedPower = Math.max(0, ctx.machine.getUnitPower(selectedZone, ctx.player));
        const duration = (params as any).duration || 'TURN_END';

        ctx.player.unitZones.forEach((zone: any) => {
            if (!zone?.unit || zone === selectedZone) return;
            zone.buffs.push({
                id: ctx.machine.createRuntimeId('BUFF'),
                sourceCard: ctx.sourceCard,
                type: 'POWER',
                value: selectedPower,
                duration,
            });
        });

        ctx.machine.destroyUnit(ctx.player, selectedZone, undefined, 'EFFECT');
        return;
    }

    if ((params as any).mode === 'BT03_051_PROMPT_SELECT_TARGET_EXIT_EFFECT') {
        const targetZone = (_targets || [])[0] as UnitZoneState | undefined;
        if (!targetZone?.unit || !ctx.unitZone?.unit) return;

        const exitEffects: any[] = [];
        (targetZone.unit.effects || []).forEach((effect: any) => {
            if (effect?.activation === ActivationCondition.EXIT) exitEffects.push(effect);
        });
        (targetZone.temporaryEffects || []).forEach((effect: any) => {
            if (effect?.activation === ActivationCondition.EXIT) exitEffects.push(effect);
        });

        if (exitEffects.length <= 0) return;

        if (exitEffects.length === 1) {
            const selected = exitEffects[0];
            const actionDurationOverride =
                selected.actionDurationOverride !== undefined
                    ? selected.actionDurationOverride
                    : (selected.duration && selected.duration !== 'TURN_END' ? selected.duration : undefined);
            ctx.unitZone.temporaryEffects.push({
                ...selected,
                duration: (params as any).duration || 'OPP_TURN_END',
                actionDurationOverride,
            });
            return;
        }

        const owner = getOwnerOfZone(ctx.machine, ctx.unitZone);
        if (!owner || owner.id !== ctx.player.id) return;
        const sourceZoneIndex = ctx.player.unitZones.indexOf(ctx.unitZone);
        if (sourceZoneIndex < 0) return;

        ctx.machine.state.revealedCards = exitEffects.map((effect: any, effectIndex: number) =>
            createPromptOptionCard(
                `BT03_051_EXIT_EFFECT_OPTION_${effectIndex}`,
                `엑시트 효과 ${effectIndex + 1}`,
                effect.description || '획득할 [엑시트] 효과 선택'
            )
        ) as any;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT03_051_SELECT_EXIT_EFFECT_TO_GAIN',
            actionValue: {
                sourceZoneIndex,
                options: exitEffects.map((effect: any) => ({ effect })),
                duration: (params as any).duration || 'OPP_TURN_END',
            },
            effectDescription: '획득할 [엑시트] 효과를 선택한다.',
            validTargets: 'REVEALED',
            targetSchema: {
                scope: 'REVEALED',
                type: 'CARD',
                count: 1,
                selectMode: 'MANUAL',
            },
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, null);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'BT03_052_PROMPT_TRASH_COST3_SKILL_THEN_ENTRY_EFFECT') {
        const skills = ctx.player.skillZone
            .map((card, skillZoneIndex) => ({ card, skillZoneIndex }))
            .filter(({ card }) => card?.type === CardType.SKILL && (card.cost || 0) === 3);
        if (skills.length === 0) return;

        ctx.machine.state.revealedCards = skills.map(({ card, skillZoneIndex }) =>
            createPromptOptionCard(
                `BT03_052_SKILL_OPTION_${skillZoneIndex}_${card.id}`,
                card.name,
                card.text || `${card.name}를 트래시`,
                card.imageUrl
            )
        ) as any;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT03_052_SELECT_SKILL_ZONE_COST3_TO_TRASH',
            actionValue: {
                options: skills.map(({ skillZoneIndex }) => ({ skillZoneIndex })),
                followUpSubActions: [
                    {
                        type: 'COMPLEX_ACTION',
                        description: 'BT03-052 follow-up: entry effect selection',
                        targets: {
                            scope: 'MY_FIELD',
                            type: 'UNIT',
                            count: 1,
                            filters: [{ type: 'HAS_KEYWORD', value: '엔트리' }],
                            selectMode: 'MANUAL',
                        },
                        params: { mode: 'PROMPT_SELECT_ENTRY_EFFECT' },
                    },
                ],
            },
            effectDescription: '트래시할 3코스트 스킬을 선택한다.',
            validTargets: 'REVEALED',
            targetSchema: {
                scope: 'REVEALED',
                type: 'CARD',
                count: 1,
                selectMode: 'MANUAL',
            },
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, null);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'BT03_054_ENTRY_TRASH_TOP_SKILL_OR_DRAW') {
        if (ctx.player.deck.length <= 0) return;
        const trashedTopCard = ctx.player.deck.pop();
        if (!trashedTopCard) return;
        ctx.player.trash.push(trashedTopCard);

        if (trashedTopCard.type === CardType.SKILL) {
            // Show the exact trashed skill card so player can choose cast or skip.
            ctx.machine.state.revealedCards = [trashedTopCard] as any;
            ctx.machine.state.interactionMode = 'SELECT_TARGET';
            ctx.machine.state.pendingEffect = {
                sourceCard: ctx.sourceCard,
                sourcePlayerId: ctx.player.id,
                controllerPlayerId: ctx.player.id,
                actionType: 'BT06_SELECT_TRASHED_SKILL_TO_CAST',
                actionValue: {
                    allowPartialSelection: true,
                },
                effectDescription: '트래시한 스킬 카드 효과를 발동할지 선택한다.',
                validTargets: 'REVEALED',
                targetSchema: {
                    scope: 'REVEALED',
                    type: 'CARD',
                    count: 1,
                    selectMode: 'MANUAL',
                },
                selectedTargets: [],
            };
            ctx.machine.setPendingRuntime(ctx, null);
            ctx.machine.setInteractionOwner(ctx.player.id);
            return;
        }

        drawCard(ctx, {
            count: 1,
            __sourceActivation: (params as any).__sourceActivation,
        }, _targets);
        drawCard(ctx, {
            count: 1,
            target: 'OPPONENT',
            __sourceActivation: (params as any).__sourceActivation,
        }, _targets);
        return;
    }

    if ((params as any).mode === 'BT03_057_PROMPT_DISCARD_AND_OPP_MATCH_OR_DAMAGE') {
        drawCard(ctx, { count: 1, target: 'OPPONENT', __sourceActivation: (params as any).__sourceActivation }, _targets);

        const payableUnits = ctx.player.hand.filter(card => card.type === CardType.UNIT);
        if (payableUnits.length <= 0) return;

        const handSelectionSchema = {
            scope: 'MY_HAND',
            type: 'CARD',
            count: 1,
            filters: [{ type: 'UNIT_TYPE', value: CardType.UNIT }],
            selectMode: 'MANUAL',
        } as const;

        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT03_057_SELECT_MY_UNIT_TO_DISCARD',
            actionValue: { allowPartialSelection: false },
            effectDescription: '트래시할 자신의 유닛 카드 1장을 선택한다.',
            validTargets: 'MY_HAND',
            targetSchema: handSelectionSchema,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: 'ACTIVE' as any,
            description: 'BT03-057 discard self unit and resolve opponent response',
            targets: handSelectionSchema as any,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT03_057_RESOLVE_OPP_MATCH_OR_DAMAGE',
                    stage: 'SELF_DISCARD',
                },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'BT03_057_RESOLVE_OPP_MATCH_OR_DAMAGE') {
        const stage = (params as any).stage || 'SELF_DISCARD';
        if (stage === 'FINALIZE_OPP_DECISION') {
            const discardedCost = Number(ctx.flags?.BT03_057_DISCARDED_COST ?? -1);
            const discardedHit = Math.max(0, Number(ctx.flags?.BT03_057_DISCARDED_HIT ?? 0));
            const selectedMatch = (_targets || []).find((card: any) =>
                ctx.opponent.hand.includes(card) && (card.cost || 0) === discardedCost
            );

            if (selectedMatch) {
                const handIndex = ctx.opponent.hand.indexOf(selectedMatch);
                if (handIndex !== -1) {
                    const [removed] = ctx.opponent.hand.splice(handIndex, 1);
                    if (removed) {
                        ctx.opponent.trash.push(removed);
                        ctx.machine.notifyHandTrashed(ctx.opponent, [removed], {
                            flags: { handTrashByEffect: true },
                        });
                    }
                }
                return;
            }

            if (discardedHit > 0) {
                ctx.machine.dealDamage(ctx.opponent, discardedHit);
            }
            return;
        }

        const selectedUnit = (_targets || []).find((card: any) => ctx.player.hand.includes(card) && card.type === CardType.UNIT);
        if (!selectedUnit) return;

        const handIndex = ctx.player.hand.indexOf(selectedUnit);
        if (handIndex === -1) return;
        const [discardedUnit] = ctx.player.hand.splice(handIndex, 1);
        if (!discardedUnit) return;
        ctx.player.trash.push(discardedUnit);
        ctx.machine.notifyHandTrashed(ctx.player, [discardedUnit], {
            flags: { handTrashByEffect: true },
        });

        const discardedCost = discardedUnit.cost || 0;
        const discardedHit = Math.max(0, discardedUnit.hit || 0);
        ctx.flags = ctx.flags || {};
        ctx.flags.BT03_057_DISCARDED_COST = discardedCost;
        ctx.flags.BT03_057_DISCARDED_HIT = discardedHit;

        const matchCandidates = ctx.opponent.hand.filter(card => (card.cost || 0) === discardedCost);
        if (matchCandidates.length <= 0) {
            if (discardedHit > 0) {
                ctx.machine.dealDamage(ctx.opponent, discardedHit);
            }
            return;
        }

        const oppHandSchema = {
            scope: 'OPP_HAND',
            type: 'CARD',
            count: 1,
            filters: [{ type: 'COST_EQUAL', value: discardedCost }],
            selectMode: 'ALL',
        } as const;

        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.opponent.id,
            actionType: 'BT03_057_OPP_SELECT_MATCH_OR_SKIP',
            actionValue: {
                allowPartialSelection: true,
                discardedCost,
                discardedHit,
            },
            effectDescription: '상대는 같은 코스트 카드 1장을 선택해 트래시할 수 있다.',
            validTargets: 'OPP_HAND',
            targetSchema: oppHandSchema,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: 'ACTIVE' as any,
            description: 'BT03-057 finalize opponent match discard or damage',
            targets: oppHandSchema as any,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT03_057_RESOLVE_OPP_MATCH_OR_DAMAGE',
                    stage: 'FINALIZE_OPP_DECISION',
                },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.opponent.id);
        return;
    }

    if ((params as any).mode === 'BT03_059_LOCK_OPP_HIGH_COST_UNIT_PLAY_GLOBAL') {
        const minCost = Math.max(0, Number((params as any).costMin ?? 5));
        const untilTurnCount = ctx.machine.state.turnCount + Math.max(0, (params as any).untilTurnCountOffset ?? 1);
        ctx.player.unitZones.forEach((zone: any) => {
            zone.temporaryEffects.push({
                activation: ActivationCondition.PASSIVE,
                description: `패시브 : 상대는 코스트 ${minCost} 이상 유닛을 배치할 수 없다.`,
                action: {
                    type: 'NONE',
                    params: {
                        preventOpponentPlayUnitCostMin: minCost,
                        untilTurnCount,
                    },
                },
                duration: 'PERMANENT',
            } as any);
        });
        return;
    }

    if ((params as any).mode === 'BT03_060_ENTRY_LOCK_SELF_AND_DAMAGE_BY_OPP_HAND_DIFF') {
        if (!ctx.unitZone?.unit) return;
        ctx.unitZone.temporaryEffects.push({
            activation: ActivationCondition.PASSIVE,
            description: '패시브 : 이 유닛은 이 턴이 끝날 때까지 공격할 수 없다.',
            action: { type: 'NONE', params: { cannotAttack: true } },
            duration: 'TURN_END',
        } as any);

        const threshold = Math.max(0, Number((params as any).handThreshold ?? 5));
        const damageValue = Math.max(0, ctx.opponent.hand.length - threshold);
        if (damageValue > 0) {
            ctx.machine.dealDamage(ctx.opponent, damageValue);
        }
        return;
    }

    if ((params as any).mode === 'BT03_062_PROMPT_SKILL_ZONE_CAST') {
        const skills = ctx.player.skillZone
            .map((card, skillZoneIndex) => ({ card, skillZoneIndex }))
            .filter(({ card }) => card?.type === CardType.SKILL);
        if (skills.length === 0) return;

        ctx.machine.state.revealedCards = skills.map(({ card, skillZoneIndex }) =>
            createPromptOptionCard(
                `BT03_062_SKILL_OPTION_${skillZoneIndex}_${card.id}`,
                card.name,
                card.text || `${card.name} 효과 발동`,
                card.imageUrl
            )
        ) as any;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT03_062_SELECT_SKILL_ZONE_TO_CAST',
            actionValue: {
                options: skills.map(({ skillZoneIndex }) => ({ skillZoneIndex })),
            },
            effectDescription: '효과를 발동할 스킬을 선택한다.',
            validTargets: 'REVEALED',
            targetSchema: {
                scope: 'REVEALED',
                type: 'CARD',
                count: 1,
                selectMode: 'MANUAL',
            },
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, null);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'BT03_064_PROMPT_DISCARD_BY_SELECTED_HIT_THEN_RETURN_ENCOUNTER') {
        const stage = (params as any).stage;
        if (stage === 'PROMPT_DISCARD') {
            const requiredCount = Math.max(0, Number(ctx.flags?.BT03_064_REQUIRED_DISCARD_COUNT ?? 0));
            if (requiredCount <= 0) return;
            if (ctx.player.hand.length < requiredCount) return;

            const handSelectionSchema = {
                scope: 'MY_HAND',
                type: 'CARD',
                count: requiredCount,
                selectMode: 'MANUAL',
            } as const;
            ctx.machine.state.interactionMode = 'SELECT_TARGET';
            ctx.machine.state.pendingEffect = {
                sourceCard: ctx.sourceCard,
                sourcePlayerId: ctx.player.id,
                controllerPlayerId: ctx.player.id,
                actionType: 'BT03_064_SELECT_HAND_FOR_HIT_COST',
                actionValue: { allowPartialSelection: false, requiredCount },
                effectDescription: `패 ${requiredCount}장을 선택해 트래시한다.`,
                validTargets: 'MY_HAND',
                targetSchema: handSelectionSchema,
                selectedTargets: [],
            };
            ctx.machine.setPendingRuntime(ctx, {
                activation: 'ACTIVE' as any,
                description: 'BT03-064 resolve hand discard and return encounter',
                targets: handSelectionSchema as any,
                action: {
                    type: 'COMPLEX_ACTION',
                    params: {
                        mode: 'BT03_064_RESOLVE_DISCARD_AND_RETURN_ENCOUNTER',
                    },
                },
            } as any);
            ctx.machine.setInteractionOwner(ctx.player.id);
            return;
        }

        const selectedZone = (_targets || [])[0] as UnitZoneState | undefined;
        if (!selectedZone?.unit) return;
        const owner = getOwnerOfZone(ctx.machine, selectedZone);
        if (!owner || owner.id !== ctx.player.id) return;
        const laneIndex = ctx.player.unitZones.indexOf(selectedZone);
        if (laneIndex < 0) return;

        const requiredCount = Math.max(0, ctx.machine.getUnitHit(selectedZone, ctx.player));
        if (requiredCount <= 0) return;

        ctx.flags = ctx.flags || {};
        ctx.flags.BT03_064_REQUIRED_DISCARD_COUNT = requiredCount;
        ctx.flags.BT03_064_TARGET_LANE_INDEX = laneIndex;

        const optionalEffect = {
            activation: ActivationCondition.ACTIVE,
            description: `BT03-064 : 패 ${requiredCount}장을 트래시할 수 있다.`,
            optional: true,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT03_064_PROMPT_DISCARD_BY_SELECTED_HIT_THEN_RETURN_ENCOUNTER',
                    stage: 'PROMPT_DISCARD',
                },
            },
        } as any;
        ctx.machine.effectManager.processEffect(optionalEffect, ctx as any);
        return;
    }

    if ((params as any).mode === 'BT03_064_RESOLVE_DISCARD_AND_RETURN_ENCOUNTER') {
        const requiredCount = Math.max(0, Number(ctx.flags?.BT03_064_REQUIRED_DISCARD_COUNT ?? 0));
        const selectedCards = (_targets || []).filter(card => ctx.player.hand.includes(card));
        if (requiredCount <= 0 || selectedCards.length !== requiredCount) return;

        const trashedCards: any[] = [];
        selectedCards.forEach((card: any) => {
            const handIndex = ctx.player.hand.indexOf(card);
            if (handIndex === -1) return;
            const [removed] = ctx.player.hand.splice(handIndex, 1);
            if (!removed) return;
            ctx.player.trash.push(removed);
            trashedCards.push(removed);
        });
        if (trashedCards.length > 0) {
            ctx.machine.notifyHandTrashed(ctx.player, trashedCards, {
                flags: { handTrashByEffect: true },
            });
        }

        const laneIndex = Number(ctx.flags?.BT03_064_TARGET_LANE_INDEX ?? -1);
        if (laneIndex < 0 || laneIndex >= ctx.opponent.unitZones.length) return;
        const encounterZone = ctx.opponent.unitZones[laneIndex];
        if (!encounterZone?.unit) return;
        returnUnitAndItemsToHand(ctx, {}, [encounterZone]);
        return;
    }

    if ((params as any).mode === 'BT03_065_DRAW_BY_ENTRY_COUNT_AND_LOCK_OPP_ENTRY') {
        const entryUnitCount = ctx.player.unitZones.filter((zone: any) => zone?.unit && zoneHasKeywordLike(zone, '엔트리')).length;
        if (entryUnitCount > 0) {
            drawCard(ctx, {
                count: entryUnitCount,
                __sourceActivation: (params as any).__sourceActivation,
            }, _targets);
        }

        const untilTurnCount = ctx.machine.state.turnCount + Math.max(0, (params as any).untilTurnCountOffset ?? 1);
        const lockUntilMap = (ctx.opponent.lockedActivationsUntilTurnCount || {}) as Record<string, number>;
        const current = lockUntilMap[String(ActivationCondition.ENTRY)] ?? 0;
        lockUntilMap[String(ActivationCondition.ENTRY)] = Math.max(current, untilTurnCount);
        ctx.opponent.lockedActivationsUntilTurnCount = lockUntilMap as any;
        return;
    }

    if ((params as any).mode === 'BT03_066_PROMPT_DISCARD_TO_SIX_THEN_DAMAGE') {
        const discardCount = Math.max(0, ctx.player.hand.length - 6);
        if (discardCount <= 0) return;

        ctx.flags = ctx.flags || {};
        ctx.flags.BT03_066_REQUIRED_DISCARD_COUNT = discardCount;

        const handSelectionSchema = {
            scope: 'MY_HAND',
            type: 'CARD',
            count: discardCount,
            selectMode: 'MANUAL',
        } as const;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT03_066_SELECT_HAND_TO_DISCARD_TO_SIX',
            actionValue: { allowPartialSelection: false, requiredCount: discardCount },
            effectDescription: `패가 6장이 되도록 ${discardCount}장을 선택해 트래시한다.`,
            validTargets: 'MY_HAND',
            targetSchema: handSelectionSchema,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: 'ACTIVE' as any,
            description: 'BT03-066 resolve discard and damage',
            targets: handSelectionSchema as any,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT03_066_RESOLVE_DISCARD_AND_DAMAGE',
                },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'BT03_066_RESOLVE_DISCARD_AND_DAMAGE') {
        const requiredCount = Math.max(0, Number(ctx.flags?.BT03_066_REQUIRED_DISCARD_COUNT ?? 0));
        const selectedCards = (_targets || []).filter(card => ctx.player.hand.includes(card));
        if (requiredCount <= 0 || selectedCards.length !== requiredCount) return;

        const trashedCards: any[] = [];
        selectedCards.forEach((card: any) => {
            const handIndex = ctx.player.hand.indexOf(card);
            if (handIndex === -1) return;
            const [removed] = ctx.player.hand.splice(handIndex, 1);
            if (!removed) return;
            ctx.player.trash.push(removed);
            trashedCards.push(removed);
        });
        if (trashedCards.length > 0) {
            ctx.machine.notifyHandTrashed(ctx.player, trashedCards, {
                flags: { handTrashByEffect: true },
            });
            ctx.machine.dealDamage(ctx.opponent, trashedCards.length);
        }
        return;
    }

    if ((params as any).mode === 'BT03_067_PROMPT_REVIVE_TRASHED_EQUIPPED_UNIT') {
        const trashedEquippedUnit = ctx.trashedUnit;
        if (!trashedEquippedUnit || trashedEquippedUnit.type !== CardType.UNIT) return;

        const reviveCandidate = ctx.player.trash.includes(trashedEquippedUnit)
            ? trashedEquippedUnit
            : ctx.player.trash.find((card: any) => card?.id === trashedEquippedUnit.id && card.type === CardType.UNIT);
        if (!reviveCandidate) return;

        const emptyZoneExists = ctx.player.unitZones.some((zone: any) => !zone?.unit);
        if (!emptyZoneExists) return;

        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT03_067_SELECT_EMPTY_ZONE_TO_REVIVE_EQUIPPED_UNIT',
            actionValue: {
                reviveCardId: reviveCandidate.id,
                reviveCardRef: reviveCandidate,
            },
            effectDescription: '부활시킬 빈 유닛 존을 선택한다.',
            validTargets: 'MY_UNITS',
            targetSchema: {
                scope: 'MY_FIELD',
                type: 'ALL',
                count: 1,
                selectMode: 'MANUAL',
            },
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, null);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'BT03_069_TRASH_TOP3_DRAW_IF_ITEM') {
        if (ctx.player.deck.length <= 0) return;
        const trashCount = Math.min(3, ctx.player.deck.length);
        let trashedItemCount = 0;
        for (let i = 0; i < trashCount; i++) {
            const card = ctx.player.deck.pop();
            if (!card) break;
            ctx.player.trash.push(card);
            if (card.type === CardType.ITEM) trashedItemCount++;
        }
        if (trashedItemCount > 0) {
            drawCard(ctx, { count: 1, __sourceActivation: (params as any).__sourceActivation }, _targets);
        }
        return;
    }

    if ((params as any).mode === 'BT03_073_ACTIVE_TRASH_BY_EQUIPPED_COUNT_AND_BUFF_HIT') {
        if (!ctx.unitZone?.unit) return;
        const equippedCount = ctx.unitZone.items.length;
        const trashCount = Math.max(0, equippedCount * 3);
        if (trashCount <= 0) return;

        let trashedItemCount = 0;
        for (let i = 0; i < trashCount; i++) {
            if (ctx.player.deck.length <= 0) break;
            const card = ctx.player.deck.pop();
            if (!card) break;
            ctx.player.trash.push(card);
            if (card.type === CardType.ITEM) trashedItemCount++;
        }

        if (trashedItemCount > 0) {
            buffHit(ctx, { value: trashedItemCount, duration: 'TURN_END' }, [ctx.unitZone]);
        }
        return;
    }

    if ((params as any).mode === 'BT03_075_ENTRY_TRASH_ITEMS_TO_BOTTOM_THEN_DESTROY_ENCOUNTER') {
        const stage = (params as any).stage;
        if (stage === 'RESOLVE') {
            const selectedItems = (_targets || []).filter((card: any) => ctx.player.trash.includes(card) && card.type === CardType.ITEM);
            const movedItems: any[] = [];
            selectedItems.forEach((card: any) => {
                const trashIndex = ctx.player.trash.indexOf(card);
                if (trashIndex === -1) return;
                const [removed] = ctx.player.trash.splice(trashIndex, 1);
                if (removed) movedItems.push(removed);
            });
            if (movedItems.length > 0) {
                ctx.player.deck.unshift(...movedItems);
            }

            const totalCost = movedItems.reduce((sum: number, card: any) => sum + Math.max(0, card?.cost || 0), 0);
            if (!ctx.unitZone?.unit) return;
            const laneIndex = ctx.player.unitZones.indexOf(ctx.unitZone);
            if (laneIndex < 0) return;
            const encounterZone = ctx.opponent.unitZones[laneIndex];
            const encounterUnit = encounterZone?.unit;
            if (!encounterUnit) return;
            if (totalCost >= Math.max(0, encounterUnit.cost || 0)) {
                ctx.machine.destroyUnit(ctx.opponent, encounterZone, undefined, 'EFFECT');
            }
            return;
        }

        const itemCandidates = ctx.player.trash.filter((card: any) => card.type === CardType.ITEM);
        if (itemCandidates.length <= 0) return;

        const selectionSchema = {
            scope: 'MY_TRASH',
            type: 'CARD',
            count: Math.min(3, itemCandidates.length),
            filters: [{ type: 'UNIT_TYPE', value: CardType.ITEM }],
            selectMode: 'MANUAL',
        } as const;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT03_075_SELECT_TRASH_ITEMS_TO_BOTTOM',
            actionValue: { allowPartialSelection: true },
            effectDescription: '덱 맨 아래에 놓을 아이템을 최대 3장까지 선택한다.',
            validTargets: 'MY_TRASH',
            targetSchema: selectionSchema,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: 'ACTIVE' as any,
            description: 'BT03-075 resolve trash items and compare encounter cost',
            targets: selectionSchema as any,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT03_075_ENTRY_TRASH_ITEMS_TO_BOTTOM_THEN_DESTROY_ENCOUNTER',
                    stage: 'RESOLVE',
                },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'BT03_076_EXIT_SWAP_DAMAGE_WITH_SELF') {
        const stage = (params as any).stage;
        if (stage === 'RESOLVE') {
            const selected = (_targets || []).find((card: any) => ctx.player.damage.includes(card) && card.type === CardType.UNIT);
            if (!selected) return;

            const damageIndex = ctx.player.damage.indexOf(selected);
            if (damageIndex === -1) return;
            const [movedToHand] = ctx.player.damage.splice(damageIndex, 1);
            if (movedToHand) ctx.player.hand.push(movedToHand);

            const sourceIndexByRef = ctx.player.trash.indexOf(ctx.sourceCard);
            const sourceIndexById = sourceIndexByRef !== -1
                ? sourceIndexByRef
                : ctx.player.trash.findIndex((card: any) => card?.id === ctx.sourceCard.id);
            if (sourceIndexById !== -1) {
                const [selfCard] = ctx.player.trash.splice(sourceIndexById, 1);
                if (selfCard) ctx.player.damage.push(selfCard);
            }
            return;
        }

        const damageCandidates = ctx.player.damage.filter((card: any) =>
            card.type === CardType.UNIT && !String(card.id || '').startsWith('BT03-076')
        );
        if (damageCandidates.length <= 0) return;

        const selectionSchema = {
            scope: 'MY_DAMAGE',
            type: 'CARD',
            count: 1,
            filters: [
                { type: 'UNIT_TYPE', value: CardType.UNIT },
                { type: 'EXCLUDE_CARD_ID', value: 'BT03-076' },
            ],
            selectMode: 'MANUAL',
        } as const;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT03_076_SELECT_DAMAGE_UNIT_TO_HAND',
            actionValue: {},
            effectDescription: '대미지 존에서 패로 가져올 유닛을 선택한다.',
            validTargets: 'MY_DAMAGE',
            targetSchema: selectionSchema,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: 'ACTIVE' as any,
            description: 'BT03-076 resolve damage swap',
            targets: selectionSchema as any,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT03_076_EXIT_SWAP_DAMAGE_WITH_SELF',
                    stage: 'RESOLVE',
                },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'BT03_077_ACTIVE_EQUIP_UP_TO_TWO_FROM_TRASH_AND_SET_ZERO_COST') {
        const stage = (params as any).stage;
        if (stage === 'RESOLVE') {
            if (!ctx.unitZone?.unit) return;
            const unitZone = ctx.unitZone;
            const selectedItems = (_targets || [])
                .filter((card: any) => ctx.player.trash.includes(card) && card.type === CardType.ITEM)
                .slice(0, 2);
            if (selectedItems.length <= 0) return;

            const equippedItems: any[] = [];
            const equippedItemNames = new Set(
                (unitZone.items || [])
                    .map((item: any) => item?.name)
                    .filter((name: any) => typeof name === 'string' && name.length > 0)
            );
            selectedItems.forEach((card: any) => {
                const cardName = typeof card?.name === 'string' ? card.name : '';
                if (cardName && equippedItemNames.has(cardName)) return;
                const trashIndex = ctx.player.trash.indexOf(card);
                if (trashIndex === -1) return;
                const [removed] = ctx.player.trash.splice(trashIndex, 1);
                if (removed) {
                    unitZone.items.push(removed);
                    equippedItems.push(removed);
                    if (removed.name) equippedItemNames.add(removed.name);
                }
            });
            if (equippedItems.length <= 0) return;

            unitZone.items.forEach((item: any) => {
                item.turnCostOverride = {
                    cost: 0,
                    turnCount: ctx.machine.state.turnCount,
                };
            });

            ctx.machine.notifyItemsEquipped(ctx.player, unitZone, equippedItems, {
                sourceActivation: (params as any).__sourceActivation,
                sourcePlayerId: ctx.player.id,
                sourceCardId: ctx.sourceCard.id,
            });

            // Rule 8.6.2: after effect processing finishes, items that do not satisfy equip
            // conditions are trashed as rule handling (not as effect trash).
            const invalidEquippedItems = [...unitZone.items].filter((item: any) =>
                !RuleValidator.validateItemEquipConditions(ctx.machine, ctx.player, unitZone, item).valid
            );
            invalidEquippedItems.forEach((item: any) => {
                const index = unitZone.items.indexOf(item);
                if (index === -1) return;
                const [removed] = unitZone.items.splice(index, 1);
                if (removed) {
                    ctx.player.trash.push(removed);
                }
            });
            return;
        }

        if (!ctx.unitZone?.unit) return;
        const itemCandidates = ctx.player.trash.filter((card: any) => card.type === CardType.ITEM);
        if (itemCandidates.length <= 0) return;

        ctx.machine.state.revealedCards = itemCandidates;
        const selectionSchema = {
            scope: 'REVEALED',
            type: 'CARD',
            count: Math.min(2, itemCandidates.length),
            filters: [{ type: 'UNIT_TYPE', value: CardType.ITEM }],
            selectMode: 'MANUAL',
        } as const;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT03_077_SELECT_TRASH_ITEMS_TO_EQUIP',
            actionValue: { allowPartialSelection: true },
            effectDescription: '장착할 트래시 아이템을 최대 2장까지 선택한다.',
            validTargets: 'REVEALED',
            targetSchema: selectionSchema,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: 'ACTIVE' as any,
            description: 'BT03-077 resolve equip from trash',
            targets: selectionSchema as any,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT03_077_ACTIVE_EQUIP_UP_TO_TWO_FROM_TRASH_AND_SET_ZERO_COST',
                    stage: 'RESOLVE',
                },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'BT03_079_ENTRY_PAY_8_ITEMS_THEN_DESTROY_AND_DRAW') {
        const stage = (params as any).stage;
        if (stage === 'RESOLVE_DESTROY_AND_DRAW') {
            const totalCostLimit = Math.max(0, Number((params as any).totalCostLimit ?? 8));
            let usedCost = 0;
            let destroyedCount = 0;

            (_targets || []).forEach((targetZone: any) => {
                if (!targetZone?.unit) return;
                const owner = getOwnerOfZone(ctx.machine, targetZone);
                if (!owner || owner.id !== ctx.opponent.id) return;
                const unitCost = Math.max(0, Number(targetZone.unit.cost || 0));
                if (usedCost + unitCost > totalCostLimit) return;
                usedCost += unitCost;
                const unitBefore = targetZone.unit;
                ctx.machine.destroyUnit(owner, targetZone, undefined, 'EFFECT');
                if (unitBefore && targetZone.unit !== unitBefore) {
                    destroyedCount += 1;
                }
            });

            if (destroyedCount > 0) {
                drawCard(ctx, { count: destroyedCount, __sourceActivation: (params as any).__sourceActivation }, _targets);
            }
            return;
        }

        const handItems = ctx.player.hand.filter((card: any) => card.type === CardType.ITEM);
        const trashItems = ctx.player.trash.filter((card: any) => card.type === CardType.ITEM);
        const allCandidates = [...handItems, ...trashItems];
        if (allCandidates.length < 8) return;

        ctx.machine.state.revealedCards = allCandidates;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT03_079_SELECT_8_ITEMS_FROM_HAND_TRASH',
            actionValue: { allowPartialSelection: false },
            effectDescription: '손패/트래시의 아이템을 정확히 8장 선택한다.',
            validTargets: 'REVEALED',
            targetSchema: {
                scope: 'REVEALED',
                type: 'CARD',
                count: 8,
                filters: [{ type: 'UNIT_TYPE', value: CardType.ITEM }],
                selectMode: 'MANUAL',
            },
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, null);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'BT03_081_TRASH_TOP5_THEN_RECOVER_UNIT') {
        const stage = (params as any).stage;
        if (stage === 'RESOLVE') {
            const selectedUnit = (_targets || []).find((card: any) => ctx.player.trash.includes(card) && card.type === CardType.UNIT);
            if (!selectedUnit) return;
            const trashIndex = ctx.player.trash.indexOf(selectedUnit);
            if (trashIndex === -1) return;
            const [moved] = ctx.player.trash.splice(trashIndex, 1);
            if (moved) ctx.player.hand.push(moved);
            return;
        }

        const trashCount = Math.min(5, ctx.player.deck.length);
        for (let i = 0; i < trashCount; i++) {
            const card = ctx.player.deck.pop();
            if (!card) break;
            ctx.player.trash.push(card);
        }

        const unitCandidates = ctx.player.trash.filter((card: any) => card.type === CardType.UNIT);
        if (unitCandidates.length <= 0) return;
        const selectionSchema = {
            scope: 'MY_TRASH',
            type: 'CARD',
            count: 1,
            filters: [{ type: 'UNIT_TYPE', value: CardType.UNIT }],
            selectMode: 'MANUAL',
        } as const;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT03_081_SELECT_UNIT_FROM_TRASH_TO_HAND',
            actionValue: {},
            effectDescription: '패에 넣을 트래시 유닛을 선택한다.',
            validTargets: 'MY_TRASH',
            targetSchema: selectionSchema,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: 'ACTIVE' as any,
            description: 'BT03-081 resolve recover unit',
            targets: selectionSchema as any,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT03_081_TRASH_TOP5_THEN_RECOVER_UNIT',
                    stage: 'RESOLVE',
                },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'BT03_082_COPY_SELECTED_ITEM_EFFECTS_TO_OTHER_UNITS') {
        const sourceZone = (_targets || [])[0] as UnitZoneState | undefined;
        if (!sourceZone?.unit || !Array.isArray(sourceZone.items) || sourceZone.items.length <= 0) return;
        const sourceZoneIndex = ctx.player.unitZones.indexOf(sourceZone);
        if (sourceZoneIndex < 0) return;

        const options = sourceZone.items.map((item: any, itemIndex: number) => ({ item, itemIndex }));
        ctx.machine.state.revealedCards = options.map(({ item }) => item);
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT03_082_SELECT_EQUIPPED_ITEM_TO_COPY',
            actionValue: {
                sourceZoneIndex,
                options: options.map(({ itemIndex }) => ({ itemIndex })),
            },
            effectDescription: '효과를 복사할 장착 아이템을 선택한다.',
            validTargets: 'REVEALED',
            targetSchema: {
                scope: 'REVEALED',
                type: 'CARD',
                count: 1,
                selectMode: 'MANUAL',
            },
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, null);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    if ((params as any).mode === 'BT03_084_TRASH_TOP3_BUFF_IF_ITEM') {
        const trashCount = Math.min(3, ctx.player.deck.length);
        let trashedItemCount = 0;
        for (let i = 0; i < trashCount; i++) {
            const card = ctx.player.deck.pop();
            if (!card) break;
            ctx.player.trash.push(card);
            if (card.type === CardType.ITEM) trashedItemCount += 1;
        }

        if (trashedItemCount > 0 && ctx.unitZone?.unit) {
            buffPower(ctx, { value: 3000, duration: 'OPP_TURN_END' }, [ctx.unitZone]);
        }
        return;
    }

    if ((params as any).mode === 'BT03_085_SELF_DISCARD_THEN_OPP_DISCARD_OR_DESTROY_ENCOUNTER') {
        const stage = (params as any).stage;
        if (stage === 'SELF_SELECTED') {
            const selectedCard = (_targets || []).find((card: any) => ctx.player.hand.includes(card));
            if (!selectedCard) return;
            const handIndex = ctx.player.hand.indexOf(selectedCard);
            if (handIndex === -1) return;
            const [trashed] = ctx.player.hand.splice(handIndex, 1);
            if (trashed) {
                ctx.player.trash.push(trashed);
                ctx.machine.notifyHandTrashed(ctx.player, [trashed], {
                    flags: { handTrashByEffect: true },
                });
            }

            if (!ctx.unitZone?.unit) return;
            const requiredCount = Math.max(0, ctx.machine.getUnitHit(ctx.unitZone, ctx.player));
            if (requiredCount <= 0) return;

            if (ctx.opponent.hand.length < requiredCount) {
                const laneIndex = ctx.player.unitZones.indexOf(ctx.unitZone);
                if (laneIndex >= 0) {
                    const encounterZone = ctx.opponent.unitZones[laneIndex];
                    if (encounterZone?.unit) {
                        ctx.machine.destroyUnit(ctx.opponent, encounterZone, undefined, 'EFFECT');
                    }
                }
                return;
            }

            const oppHandSchema = {
                scope: 'OPP_HAND',
                type: 'CARD',
                count: requiredCount,
                selectMode: 'MANUAL',
            } as const;
            ctx.machine.state.interactionMode = 'SELECT_TARGET';
            ctx.machine.state.pendingEffect = {
                sourceCard: ctx.sourceCard,
                sourcePlayerId: ctx.player.id,
                controllerPlayerId: ctx.opponent.id,
                actionType: 'BT03_085_OPP_SELECT_HAND_FOR_HIT_OR_SKIP',
                actionValue: {
                    requiredCount,
                    allowPartialSelection: true,
                },
                effectDescription: `상대는 패를 ${requiredCount}장 트래시할 수 있다.`,
                validTargets: 'OPP_HAND',
                targetSchema: oppHandSchema,
                selectedTargets: [],
            };
            ctx.machine.setPendingRuntime(ctx, {
                activation: 'ACTIVE' as any,
                description: 'BT03-085 finalize opponent discard decision',
                targets: oppHandSchema as any,
                action: {
                    type: 'COMPLEX_ACTION',
                    params: {
                        mode: 'BT03_085_SELF_DISCARD_THEN_OPP_DISCARD_OR_DESTROY_ENCOUNTER',
                        stage: 'OPP_FINALIZE',
                        requiredCount,
                    },
                },
            } as any);
            ctx.machine.setInteractionOwner(ctx.opponent.id);
            return;
        }

        if (stage === 'OPP_FINALIZE') {
            const requiredCount = Math.max(0, Number((params as any).requiredCount ?? 0));
            const selectedOppCards = (_targets || []).filter((card: any) => ctx.opponent.hand.includes(card));

            if (requiredCount > 0 && selectedOppCards.length === requiredCount) {
                const trashedCards: any[] = [];
                selectedOppCards.forEach((card: any) => {
                    const handIndex = ctx.opponent.hand.indexOf(card);
                    if (handIndex === -1) return;
                    const [removed] = ctx.opponent.hand.splice(handIndex, 1);
                    if (removed) {
                        ctx.opponent.trash.push(removed);
                        trashedCards.push(removed);
                    }
                });
                if (trashedCards.length > 0) {
                    ctx.machine.notifyHandTrashed(ctx.opponent, trashedCards, {
                        flags: { handTrashByEffect: true },
                    });
                }
                return;
            }

            if (ctx.unitZone?.unit) {
                const laneIndex = ctx.player.unitZones.indexOf(ctx.unitZone);
                if (laneIndex >= 0) {
                    const encounterZone = ctx.opponent.unitZones[laneIndex];
                    if (encounterZone?.unit) {
                        ctx.machine.destroyUnit(ctx.opponent, encounterZone, undefined, 'EFFECT');
                    }
                }
            }
            return;
        }

        if (ctx.player.hand.length <= 0) return;
        const handSchema = {
            scope: 'MY_HAND',
            type: 'CARD',
            count: 1,
            selectMode: 'MANUAL',
        } as const;
        ctx.machine.state.interactionMode = 'SELECT_TARGET';
        ctx.machine.state.pendingEffect = {
            sourceCard: ctx.sourceCard,
            sourcePlayerId: ctx.player.id,
            controllerPlayerId: ctx.player.id,
            actionType: 'BT03_085_SELECT_SELF_HAND_TO_DISCARD',
            actionValue: {},
            effectDescription: '트래시할 자신의 패 1장을 선택한다.',
            validTargets: 'MY_HAND',
            targetSchema: handSchema,
            selectedTargets: [],
        };
        ctx.machine.setPendingRuntime(ctx, {
            activation: 'ACTIVE' as any,
            description: 'BT03-085 self discard step',
            targets: handSchema as any,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT03_085_SELF_DISCARD_THEN_OPP_DISCARD_OR_DESTROY_ENCOUNTER',
                    stage: 'SELF_SELECTED',
                },
            },
        } as any);
        ctx.machine.setInteractionOwner(ctx.player.id);
        return;
    }

    const subActions = (params as any).subActions;
    if (!Array.isArray(subActions)) return;

    for (const sub of subActions) {
        const impl = ActionRegistry[sub.type];
        if (impl) {
            let subTargets = _targets;
            if (sub.targets) {
                subTargets = TargetSelector.resolve(ctx.machine, sub.targets, ctx);
            }
            impl(ctx, {
                ...(sub.params || {}),
                __sourceActivation: (params as any).__sourceActivation,
            }, subTargets);
        }
    }
};

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
    'RETURN_UNIT_AND_ITEMS_TO_HAND': returnUnitAndItemsToHand,
    'BREAKTHROUGH': breakthrough,
    'RETURN_FROM_TRASH_AT_TURN_END': returnFromTrashAtTurnEnd,
    'DESTROY_UNIT_AND_DRAW_BY_HIT': destroyUnitAndDrawByHit,
    'DESTROY_UNIT_WITH_HIT_COST': destroyUnitWithHitCost,
    'COMPLEX_ACTION': complexAction,
    'SACRIFICE_TO_BUFF': sacrificeToBuff,
    'DESTROY_ITEM': destroyItem,
    'RETURN_ITEM_TO_HAND': returnItemToHand,
    'MOVE_ITEM_TO_DECK_BOTTOM': moveItemToDeckBottom,
    'MOVE_FROM_DAMAGE_TO_HAND': moveFromDamageToHand,
    'MOVE_FROM_HAND_TO_DAMAGE': moveFromHandToDamage,
    'MOVE_FROM_TRASH_TO_DECK_TOP': moveFromTrashToDeckTop,
    'MOVE_FROM_TRASH_TO_DECK_BOTTOM': moveFromTrashToDeckBottom,
    'DRAW_BY_TARGET_HIT': drawByTargetHit,
    'LOCK_ATTACK_UNTIL_TURN_END': lockAttackUntilTurnEnd,
    'APPLY_DUALIST_MARK': applyDualistMark,
    'APPLY_INFILTRATION_MARK': applyInfiltrationMark,
    'REVEAL_TOP_PICK_TO_HAND_THEN_ORDER_BOTTOM': revealTopPickToHandThenOrderBottom,
    'GRANT_EXTRA_ATTACK_THIS_TURN': grantExtraAttackThisTurn,
    'LOCK_SKILL_ID_UNTIL_TURN_END': lockSkillIdUntilTurnEnd,
    'AUTO_ATTACK_IF_ENCOUNTER': autoAttackIfEncounter,
    'DAMAGE': damage,
    'DRAW_THEN_DISCARD': drawThenDiscard,
    'DESTROY_SELF': destroySelf,
    'DESTROY_UNIT_AND_DRAW': destroyUnitAndDraw,
    'NONE': noneAction,
};
