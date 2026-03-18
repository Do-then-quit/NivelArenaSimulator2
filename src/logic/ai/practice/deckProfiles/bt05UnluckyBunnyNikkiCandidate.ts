import { Attribute, Card, CardType, Phase, PlayerState } from '../../../types';
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
import { bt05UnluckyBunnyNikkiOpeningProfile } from './bt05UnluckyBunnyNikki';

const BT05_NIKKI_LEADER_ID = 'BT05-032';
const MIRROR_TEMPO_UNIT_IDS = new Set(['BT05-033', 'BT05-034', 'BT05-064', 'BT05-065', 'BT05-066', 'ST09-011']);
const STRONG_ENGINE_BODY_IDS = new Set(['BT05-036', 'BT05-041']);
const HIGH_LEVERAGE_BT05_ACTION_IDS = new Set(['BT05-036', 'BT05-039', 'BT05-041', 'BT05-043', 'BT05-044', 'BT05-072', 'BT05-081', 'BT05-082', 'BT05-046']);

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

    return scoreDelta < 0;
}

function chooseMirrorTempoAction(context: PracticeMainPhaseContext): PracticeMainPhaseAction | null {
    let bestAction: PracticeMainPhaseAction | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    const attributesBefore = getFieldAttributes(context.actor);

    if (hasMixedField(attributesBefore)) {
        return null;
    }

    for (const action of context.actions) {
        if (action.type !== 'PLAY_UNIT') continue;
        const card = context.actor.hand[action.handIndex];
        if (!card) continue;

        const cardKey = getCardKey(card);
        if (!MIRROR_TEMPO_UNIT_IDS.has(cardKey)) continue;

        const zone = context.actor.unitZones[action.zoneIndex];
        if (zone.unit) continue;

        const attributesAfter = getAttributesAfterUnitPlay(context.actor, action, card);
        if (!hasMixedField(attributesAfter)) continue;

        const score = getUnitScore(card)
            + 3200
            + (cardKey === 'BT05-064' || cardKey === 'ST09-011' ? 500 : 0);
        if (score > bestScore) {
            bestScore = score;
            bestAction = action;
        }
    }

    return bestScore > 0 ? bestAction : null;
}

function passThrough<T>(action: T | null | undefined): T | null {
    return action ?? null;
}

function getBaseMainPhaseAction(context: PracticeMainPhaseContext): PracticeMainPhaseAction | null {
    return bt05UnluckyBunnyNikkiOpeningProfile.chooseMainPhaseAction?.(context) ?? null;
}

export const bt05UnluckyBunnyNikkiCandidateProfile: PracticeProfile = {
    id: 'practice-bt05-nikki-candidate-v2',
    label: 'Practice BT05 Nikki Candidate v2',
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
            if (!isObviousNegativeOverwrite(context, baseAction)) {
                return baseAction;
            }

            const mirrorTempoAction = chooseMirrorTempoAction(context);
            if (mirrorTempoAction) {
                return mirrorTempoAction;
            }

            return context.actions.find((action): action is PracticeMainPhaseAction => action.type === 'NEXT_PHASE') ?? baseAction;
        }

        if (baseAction.type === 'NEXT_PHASE') {
            if (hasHighLeverageBt05Action(context)) {
                return baseAction;
            }

            const mirrorTempoAction = chooseMirrorTempoAction(context);
            if (mirrorTempoAction) {
                return mirrorTempoAction;
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
