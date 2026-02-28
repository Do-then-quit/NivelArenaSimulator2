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
