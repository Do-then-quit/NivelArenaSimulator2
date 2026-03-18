import { Attribute, Card, Phase, PlayerState } from '../../../types';
import {
    PracticeConfirmTargetsContext,
    PracticeHandTargetContext,
    PracticeMainPhaseAction,
    PracticeMainPhaseContext,
    PracticeMulliganContext,
    PracticeOptionalContext,
    PracticeProfile,
    PracticeRevealedTargetContext,
    PracticeTrashTargetContext,
    PracticeZoneTargetContext,
} from '../types';
import { evaluateState } from '../../../ai/eval/StateEvaluator';
import { bt05UnluckyBunnyNikkiOpeningProfile } from './bt05UnluckyBunnyNikki';

const BT05_NIKKI_LEADER_ID = 'BT05-032';
const MIRROR_TEMPO_UNIT_IDS = new Set(['BT05-033', 'BT05-034', 'BT05-064', 'BT05-065', 'BT05-066', 'ST09-011']);
const STRONG_ENGINE_BODY_IDS = new Set(['BT05-036', 'BT05-041']);
const HIGH_LEVERAGE_BT05_ACTION_IDS = new Set(['BT05-036', 'BT05-039', 'BT05-041', 'BT05-043', 'BT05-044', 'BT05-072', 'BT05-081', 'BT05-082', 'BT05-046']);
const WEAK_FILLER_TEMPO_SCORE_LIMIT = 6000;
const OVERWRITE_MARGIN_SCORE = 2500;
const OCCUPIED_LANE_PREFERENCE_MARGIN = 900;

function getCardKey(card: Card | null | undefined): string {
    if (!card) return '';
    const match = card.id.match(/^[A-Z]{2}\d{2}-\d{3}/);
    return match?.[0] ?? card.id;
}

function isBt05NikkiLeader(actor: PlayerState | null | undefined): boolean {
    return getCardKey(actor?.levelZone ?? null) === BT05_NIKKI_LEADER_ID;
}

function getFieldAttributes(actor: PlayerState): Set<Attribute> {
    const attributes = new Set<Attribute>();

    for (const zone of actor.unitZones) {
        const unitAttribute = zone.unit?.attribute;
        if (unitAttribute && unitAttribute !== Attribute.NONE) {
            attributes.add(unitAttribute);
        }

        for (const item of zone.items) {
            if (item.attribute !== Attribute.NONE) {
                attributes.add(item.attribute);
            }
        }
    }

    return attributes;
}

function hasMixedField(attributes: Set<Attribute>): boolean {
    return attributes.has(Attribute.STORM) && attributes.has(Attribute.LIGHTNING);
}

function getAttributesAfterUnitPlay(
    actor: PlayerState,
    action: Extract<PracticeMainPhaseAction, { type: 'PLAY_UNIT' }>,
    card: Card,
): Set<Attribute> {
    const attributes = new Set<Attribute>();

    for (let zoneIndex = 0; zoneIndex < actor.unitZones.length; zoneIndex += 1) {
        const zone = actor.unitZones[zoneIndex];
        const unit = zoneIndex === action.zoneIndex ? card : zone.unit;
        const unitAttribute = unit?.attribute;
        if (unitAttribute && unitAttribute !== Attribute.NONE) {
            attributes.add(unitAttribute);
        }

        for (const item of zone.items) {
            if (item.attribute !== Attribute.NONE) {
                attributes.add(item.attribute);
            }
        }
    }

    return attributes;
}

function countEmptyUnitZones(actor: PlayerState): number {
    return actor.unitZones.filter(zone => !zone.unit).length;
}

function getUnitScore(card: Card): number {
    return (card.cost ?? 0) * 1000 + (card.power ?? 0) * 4 + (card.hit ?? 0) * 700;
}

function previewStateAfterUnitPlay(
    context: PracticeMainPhaseContext,
    action: Extract<PracticeMainPhaseAction, { type: 'PLAY_UNIT' }>,
    card: Card,
): number {
    const zone = context.actor.unitZones[action.zoneIndex];
    const originalUnit = zone.unit;
    const originalBuffs = zone.buffs;
    const originalTemporaryEffects = zone.temporaryEffects;

    zone.unit = card;
    zone.buffs = [];
    zone.temporaryEffects = [];

    try {
        return evaluateState(context.engine, context.actorPlayerId).total;
    } finally {
        zone.unit = originalUnit;
        zone.buffs = originalBuffs;
        zone.temporaryEffects = originalTemporaryEffects;
    }
}

function getOpponent(
    engine: PracticeMainPhaseContext['engine'],
    actorPlayerId: string,
): PlayerState | null {
    return engine.state.players.find(player => player.id !== actorPlayerId) ?? null;
}

function hasHighLeverageBt05Action(context: PracticeMainPhaseContext): boolean {
    return context.actions.some(action => {
        if (action.type === 'NEXT_PHASE') return false;
        if (action.type === 'ACTIVATE_EFFECT') {
            return true;
        }
        if (!('handIndex' in action)) return false;
        const card = context.actor.hand[action.handIndex];
        return HIGH_LEVERAGE_BT05_ACTION_IDS.has(getCardKey(card));
    });
}

function isObviousNegativeOverwrite(
    context: PracticeMainPhaseContext,
    action: Extract<PracticeMainPhaseAction, { type: 'PLAY_UNIT' }>,
): boolean {
    const zone = context.actor.unitZones[action.zoneIndex];
    if (!zone.unit) return false;
    if (countEmptyUnitZones(context.actor) === 0) return false;

    const card = context.actor.hand[action.handIndex];
    if (!card) return false;

    const attributesBefore = getFieldAttributes(context.actor);
    const attributesAfter = getAttributesAfterUnitPlay(context.actor, action, card);
    if (hasMixedField(attributesBefore) && !hasMixedField(attributesAfter)) {
        return true;
    }

    const occupantKey = getCardKey(zone.unit);
    const scoreDelta = getUnitScore(card) - getUnitScore(zone.unit);
    if (STRONG_ENGINE_BODY_IDS.has(occupantKey)) {
        return true;
    }

    return scoreDelta < OVERWRITE_MARGIN_SCORE;
}

function scoreMirrorUnitAction(
    context: PracticeMainPhaseContext,
    action: Extract<PracticeMainPhaseAction, { type: 'PLAY_UNIT' }>,
): number {
    const zone = context.actor.unitZones[action.zoneIndex];
    if (!zone) return Number.NEGATIVE_INFINITY;

    const card = context.actor.hand[action.handIndex];
    if (!card) return Number.NEGATIVE_INFINITY;

    const cardKey = getCardKey(card);
    const emptyZoneCount = countEmptyUnitZones(context.actor);
    const baselineStateScore = evaluateState(context.engine, context.actorPlayerId).total;
    const postPlayStateScore = previewStateAfterUnitPlay(context, action, card);
    const attributesBefore = getFieldAttributes(context.actor);
    const attributesAfter = getAttributesAfterUnitPlay(context.actor, action, card);
    const mixedBefore = hasMixedField(attributesBefore);
    const mixedAfter = hasMixedField(attributesAfter);
    const opponent = getOpponent(context.engine, context.actorPlayerId);
    const opposingUnit = opponent?.unitZones[action.zoneIndex]?.unit ?? null;
    const stateDeltaScore = postPlayStateScore - baselineStateScore;
    let score = getUnitScore(card) + Math.round(stateDeltaScore * 80);

    if (zone.unit) {
        const occupant = zone.unit;
        const occupantKey = getCardKey(occupant);
        const overwriteDelta = getUnitScore(card) - getUnitScore(occupant);

        if (STRONG_ENGINE_BODY_IDS.has(occupantKey)) {
            score -= 9000;
        } else {
            score += overwriteDelta >= 0
                ? 1800 + Math.min(2400, Math.floor(overwriteDelta * 0.7))
                : Math.max(-4000, Math.floor(overwriteDelta * 1.2)) - 1800;

            if (emptyZoneCount > 0) {
                score -= 2200 + emptyZoneCount * 650;
                if (overwriteDelta < OVERWRITE_MARGIN_SCORE) {
                    score -= 2600;
                }
            }
        }
    } else {
        score += 1300 + (emptyZoneCount > 0 ? 250 : 0);
        if (score <= WEAK_FILLER_TEMPO_SCORE_LIMIT) {
            score -= 1800;
        }
    }

    if (!mixedBefore && mixedAfter) score += 7200;
    else if (mixedBefore && !mixedAfter) score -= 11000;
    else if (mixedAfter) score += 900;

    if (opposingUnit) {
        const laneDelta = getUnitScore(card) - getUnitScore(opposingUnit);
        score += laneDelta >= 0
            ? 900 + Math.min(1800, laneDelta)
            : Math.max(-2500, laneDelta);
    }

    switch (cardKey) {
        case 'BT05-064':
        case 'ST09-011':
            score += 450;
            break;
        case 'BT05-066':
            score += 250;
            break;
        case 'BT05-034':
            score += 150;
            break;
        default:
            break;
    }

    if (MIRROR_TEMPO_UNIT_IDS.has(cardKey)) {
        score += 250;
    }

    return score;
}

function chooseMirrorTempoAction(context: PracticeMainPhaseContext): { action: PracticeMainPhaseAction; score: number } | null {
    let bestAction: PracticeMainPhaseAction | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    let bestOccupiedAction: PracticeMainPhaseAction | null = null;
    let bestOccupiedScore = Number.NEGATIVE_INFINITY;
    let bestEmptyAction: PracticeMainPhaseAction | null = null;
    let bestEmptyScore = Number.NEGATIVE_INFINITY;

    for (const action of context.actions) {
        if (action.type !== 'PLAY_UNIT') continue;
        const score = scoreMirrorUnitAction(context, action);
        if (score > bestScore) {
            bestScore = score;
            bestAction = action;
        }

        const zone = context.actor.unitZones[action.zoneIndex];
        if (zone?.unit) {
            if (score > bestOccupiedScore) {
                bestOccupiedScore = score;
                bestOccupiedAction = action;
            }
        } else if (score > bestEmptyScore) {
            bestEmptyScore = score;
            bestEmptyAction = action;
        }
    }

    if (bestOccupiedAction && bestEmptyAction && bestOccupiedScore >= bestEmptyScore - OCCUPIED_LANE_PREFERENCE_MARGIN) {
        return { action: bestOccupiedAction, score: bestOccupiedScore };
    }

    return bestAction && bestScore > Number.NEGATIVE_INFINITY ? { action: bestAction, score: bestScore } : null;
}

function passThrough<T>(action: T | null | undefined): T | null {
    return action ?? null;
}

function getBaseMainPhaseAction(context: PracticeMainPhaseContext): PracticeMainPhaseAction | null {
    return bt05UnluckyBunnyNikkiOpeningProfile.chooseMainPhaseAction?.(context) ?? null;
}

export const bt05UnluckyBunnyNikkiCandidateProfile: PracticeProfile = {
    id: 'practice-bt05-nikki-candidate-v3',
    label: 'Practice BT05 Nikki Candidate v3',
    chooseMulliganAction(context: PracticeMulliganContext) {
        return passThrough(bt05UnluckyBunnyNikkiOpeningProfile.chooseMulliganAction?.(context));
    },
    chooseMainPhaseAction(context: PracticeMainPhaseContext) {
        if (!isBt05NikkiLeader(context.actor)) {
            return passThrough(getBaseMainPhaseAction(context));
        }

        if (context.engine.state.phase !== Phase.MAIN || context.engine.state.interactionMode !== 'NORMAL') {
            return passThrough(getBaseMainPhaseAction(context));
        }

        const baseAction = getBaseMainPhaseAction(context);
        if (!baseAction) {
            return null;
        }

        if (baseAction.type === 'PLAY_UNIT') {
            const mirrorTempoPlan = chooseMirrorTempoAction(context);
            const baseScore = scoreMirrorUnitAction(context, baseAction);

            if (mirrorTempoPlan && mirrorTempoPlan.action !== baseAction) {
                if (isObviousNegativeOverwrite(context, baseAction) || baseScore < 0) {
                    if (mirrorTempoPlan.score > 0) {
                        return mirrorTempoPlan.action;
                    }
                } else if (mirrorTempoPlan.score >= baseScore + 350) {
                    return mirrorTempoPlan.action;
                }
            }

            if (baseScore < 0) {
                return context.actions.find((action): action is PracticeMainPhaseAction => action.type === 'NEXT_PHASE') ?? baseAction;
            }

            return baseAction;
        }

        if (baseAction.type === 'NEXT_PHASE') {
            if (hasHighLeverageBt05Action(context)) {
                return baseAction;
            }

            const mirrorTempoPlan = chooseMirrorTempoAction(context);
            if (mirrorTempoPlan && mirrorTempoPlan.score >= 6500) {
                return mirrorTempoPlan.action;
            }
        }

        return baseAction;
    },
    chooseHandTargetAction(context: PracticeHandTargetContext) {
        return passThrough(bt05UnluckyBunnyNikkiOpeningProfile.chooseHandTargetAction?.(context));
    },
    chooseTrashTargetAction(context: PracticeTrashTargetContext) {
        return passThrough(bt05UnluckyBunnyNikkiOpeningProfile.chooseTrashTargetAction?.(context));
    },
    chooseZoneTargetAction(context: PracticeZoneTargetContext) {
        return passThrough(bt05UnluckyBunnyNikkiOpeningProfile.chooseZoneTargetAction?.(context));
    },
    chooseRevealedTargetAction(context: PracticeRevealedTargetContext) {
        return passThrough(bt05UnluckyBunnyNikkiOpeningProfile.chooseRevealedTargetAction?.(context));
    },
    chooseOptionalAction(context: PracticeOptionalContext) {
        return passThrough(bt05UnluckyBunnyNikkiOpeningProfile.chooseOptionalAction?.(context));
    },
    chooseConfirmTargetsAction(context: PracticeConfirmTargetsContext) {
        return passThrough(bt05UnluckyBunnyNikkiOpeningProfile.chooseConfirmTargetsAction?.(context));
    },
};
