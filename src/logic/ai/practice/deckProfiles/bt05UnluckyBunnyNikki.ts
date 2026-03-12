import { Attribute, Card, CardType, EngineAction, Phase, PlayerState } from '../../../types';
import { PracticeMainPhaseAction, PracticeMainPhaseContext, PracticeMulliganContext, PracticeProfile } from '../types';

type PlayFieldAction = Extract<EngineAction, { type: 'PLAY_UNIT' | 'PLAY_ITEM' }>;
type PlaySkillAction = Extract<EngineAction, { type: 'PLAY_SKILL' }>;
type ActivateEffectAction = Extract<EngineAction, { type: 'ACTIVATE_EFFECT' }>;
type NextPhaseAction = Extract<EngineAction, { type: 'NEXT_PHASE' }>;

const BT05_NIKKI_LEADER_ID = 'BT05-032';
const LOW_COST_STORM_OPENERS = new Set(['BT05-033', 'ST09-011']);
const LOW_COST_LIGHTNING_OPENERS = new Set(['BT05-064', 'BT05-065', 'BT05-066']);
const MIX_CONNECTOR_ITEMS = new Set(['BT05-046', 'BT05-081', 'BT05-082']);
const EARLY_PAYOFF_IDS = new Set(['BT05-038', 'BT05-039', 'BT05-040', 'BT05-041']);

function getCardKey(card: Card | null | undefined): string {
    if (!card) return '';
    const match = card.id.match(/^[A-Z]{2}\d{2}-\d{3}/);
    return match?.[0] ?? card.id;
}

function isBt05NikkiLeader(actor: PlayerState | null | undefined): boolean {
    return getCardKey(actor?.levelZone ?? null) === BT05_NIKKI_LEADER_ID;
}

function getHandCard(actor: PlayerState, action: PlayFieldAction): Card | null {
    return actor.hand[action.handIndex] ?? null;
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

function addsMissingAttribute(attributes: Set<Attribute>, attribute: Attribute): boolean {
    if (attribute === Attribute.NONE) return false;
    if (attributes.size === 0) return false;
    if (attributes.has(Attribute.STORM) && !attributes.has(Attribute.LIGHTNING)) {
        return attribute === Attribute.LIGHTNING;
    }
    if (attributes.has(Attribute.LIGHTNING) && !attributes.has(Attribute.STORM)) {
        return attribute === Attribute.STORM;
    }
    return false;
}

function getOpenUnitCountByAttribute(hand: Card[], attribute: Attribute): number {
    return hand.filter(card => card.type === CardType.UNIT && card.attribute === attribute && card.cost <= 2).length;
}

function getConnectorItemCountByAttribute(hand: Card[], attribute: Attribute): number {
    return hand.filter(card => card.type === CardType.ITEM && card.attribute === attribute && card.cost <= 1).length;
}

function hasMixedOpeningPlan(hand: Card[]): boolean {
    const stormUnitCount = getOpenUnitCountByAttribute(hand, Attribute.STORM);
    const lightningUnitCount = getOpenUnitCountByAttribute(hand, Attribute.LIGHTNING);
    const stormItemCount = getConnectorItemCountByAttribute(hand, Attribute.STORM);
    const lightningItemCount = getConnectorItemCountByAttribute(hand, Attribute.LIGHTNING);

    return (
        (stormUnitCount > 0 && lightningUnitCount > 0)
        || (stormUnitCount > 0 && lightningItemCount > 0)
        || (lightningUnitCount > 0 && stormItemCount > 0)
    );
}

function getLowCurveCount(hand: Card[]): number {
    return hand.filter(card => (card.type === CardType.UNIT || card.type === CardType.ITEM) && card.cost <= 2).length;
}

function getHeavyCardCount(hand: Card[]): number {
    return hand.filter(card => card.cost >= 4).length;
}

function isOpeningWindow(context: PracticeMainPhaseContext): boolean {
    return context.engine.state.phase === Phase.MAIN
        && context.engine.state.interactionMode === 'NORMAL'
        && context.actor.leaderLevel <= 4;
}

function isBorrowableExitUnit(card: Card | null | undefined): boolean {
    if (!card || card.type !== CardType.UNIT) return false;
    const keywords = String(card.keywords ?? '');
    const text = String(card.text ?? '');
    return keywords.includes('엑시트') && !text.includes('트리거');
}

function countBorrowableExitUnits(cards: Card[]): number {
    return cards.filter(card => isBorrowableExitUnit(card)).length;
}

function getActivateEffectSourceCard(actor: PlayerState, action: ActivateEffectAction): Card | null {
    if (action.sourceType === 'LEADER') {
        return actor.levelZone ?? null;
    }

    const zone = actor.unitZones[action.zoneIndex];
    if (!zone) return null;

    if (action.sourceType === 'ITEM') {
        if (typeof action.itemIndex !== 'number') return null;
        return zone.items[action.itemIndex] ?? null;
    }

    return zone.unit ?? null;
}

function getCardSpecificOpeningScore(card: Card, actor: PlayerState, mixedBefore: boolean, mixedAfter: boolean): number {
    switch (getCardKey(card)) {
        case 'BT05-033':
            return 2100 + (mixedAfter && !mixedBefore ? 500 : 0);
        case 'ST09-011':
            return 1800 + (mixedAfter && !mixedBefore ? 400 : 0);
        case 'BT05-064':
            return 2600 + (mixedAfter ? 500 : 0);
        case 'BT05-065':
            return (mixedAfter ? 3100 : 900) + (actor.damage.length > 0 ? 500 : 0);
        case 'BT05-066':
            return (mixedAfter ? 2400 : 1300);
        case 'BT05-034':
            return mixedAfter ? 1300 : 700;
        case 'BT05-036':
            return mixedAfter || mixedBefore
                ? (actor.leaderLevel >= 4 ? 11000 : 5000)
                : 1000;
        case 'BT05-046':
            return mixedAfter ? 250 : -1200;
        case 'BT05-081':
            return mixedAfter ? 1100 : 150;
        case 'BT05-082':
            return mixedAfter ? 700 : -2200;
        default:
            return EARLY_PAYOFF_IDS.has(card.id) ? -5000 : 0;
    }
}

function getLaneScoreForItem(actor: PlayerState, zoneIndex: number): number {
    const zone = actor.unitZones[zoneIndex];
    if (!zone?.unit) return Number.NEGATIVE_INFINITY;
    return (zone.unit.power ?? 0) + (zone.unit.hit ?? 0) * 1000;
}

function scoreOpeningAction(context: PracticeMainPhaseContext, action: PlayFieldAction): number {
    const card = getHandCard(context.actor, action);
    if (!card) return Number.NEGATIVE_INFINITY;
    const cardKey = getCardKey(card);

    if (action.type === 'PLAY_ITEM' && cardKey === 'BT05-046') {
        // BT05-046 spends future hand resources for a small early stat bump.
        // In the opening window we want bodies and clean mix setup first.
        return -4000;
    }

    const attributesBefore = getFieldAttributes(context.actor);
    const mixedBefore = hasMixedField(attributesBefore);
    const attributesAfter = new Set(attributesBefore);
    if (card.attribute !== Attribute.NONE) {
        attributesAfter.add(card.attribute);
    }
    const mixedAfter = hasMixedField(attributesAfter);

    if (action.type === 'PLAY_ITEM' && cardKey === 'BT05-082' && !mixedAfter) {
        return -4000;
    }

    let score = 0;

    if (!mixedBefore && mixedAfter) score += 100000;
    if (!mixedBefore && addsMissingAttribute(attributesBefore, card.attribute)) score += 20000;
    if (attributesBefore.size === 0 && action.type === 'PLAY_UNIT') score += 5000;
    if (card.cost <= 2) score += 6000 - card.cost * 300;
    if (action.type === 'PLAY_UNIT') score += 1200;
    if (action.type === 'PLAY_ITEM') score += getLaneScoreForItem(context.actor, action.zoneIndex);

    if (LOW_COST_STORM_OPENERS.has(cardKey) || LOW_COST_LIGHTNING_OPENERS.has(cardKey)) {
        score += 1200;
    }
    if (MIX_CONNECTOR_ITEMS.has(cardKey)) {
        score += mixedAfter ? 400 : -200;
    }

    score += getCardSpecificOpeningScore(card, context.actor, mixedBefore, mixedAfter);
    return score;
}

function scoreOpeningSkillAction(context: PracticeMainPhaseContext, action: PlaySkillAction): number {
    const card = context.actor.hand[action.handIndex];
    if (!card) return Number.NEGATIVE_INFINITY;

    if (getCardKey(card) === 'BT05-044') {
        const borrowableExitCount = countBorrowableExitUnits(context.actor.trash);
        if (borrowableExitCount === 0) return -5000;
        return -1000;
    }

    return -3000;
}

function scoreOpeningActivateEffectAction(context: PracticeMainPhaseContext, action: ActivateEffectAction): number {
    const sourceCard = getActivateEffectSourceCard(context.actor, action);
    if (!sourceCard) return Number.NEGATIVE_INFINITY;

    if (getCardKey(sourceCard) === 'BT05-082') {
        return -4500;
    }

    return -3500;
}

function scoreOpeningMainAction(context: PracticeMainPhaseContext, action: PracticeMainPhaseAction): number {
    switch (action.type) {
        case 'PLAY_UNIT':
        case 'PLAY_ITEM':
            return scoreOpeningAction(context, action);
        case 'PLAY_SKILL':
            return scoreOpeningSkillAction(context, action);
        case 'ACTIVATE_EFFECT':
            return scoreOpeningActivateEffectAction(context, action);
        case 'NEXT_PHASE':
            return 0;
        default:
            return Number.NEGATIVE_INFINITY;
    }
}

function chooseBestOpeningAction(context: PracticeMainPhaseContext): PracticeMainPhaseAction | null {
    if (context.actions.length === 0) return null;

    let bestAction: PracticeMainPhaseAction | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const action of context.actions) {
        const score = scoreOpeningMainAction(context, action);
        if (score > bestScore) {
            bestAction = action;
            bestScore = score;
        }
    }

    return bestAction;
}

export const bt05UnluckyBunnyNikkiOpeningProfile: PracticeProfile = {
    id: 'practice-bt05-nikki-open-v1',
    label: 'Practice BT05 Nikki Open v1',
    chooseMulliganAction(context: PracticeMulliganContext) {
        if (!isBt05NikkiLeader(context.actor)) return null;
        if (!context.keepAction || !context.redrawAction) return context.keepAction ?? context.redrawAction;

        const hand = context.actor.hand;
        const lowCurveCount = getLowCurveCount(hand);
        const heavyCardCount = getHeavyCardCount(hand);
        const mixedOpeningPlan = hasMixedOpeningPlan(hand);
        const hasNamedOpeners = hand.some(card =>
            LOW_COST_STORM_OPENERS.has(getCardKey(card))
            || LOW_COST_LIGHTNING_OPENERS.has(getCardKey(card))
            || MIX_CONNECTOR_ITEMS.has(getCardKey(card)),
        );

        const shouldMulligan = !mixedOpeningPlan || lowCurveCount < 2 || !hasNamedOpeners || heavyCardCount >= 3;
        return shouldMulligan ? context.redrawAction : context.keepAction;
    },
    chooseMainPhaseAction(context: PracticeMainPhaseContext): PracticeMainPhaseAction | null {
        if (!isBt05NikkiLeader(context.actor)) return null;
        if (!isOpeningWindow(context)) return null;
        return chooseBestOpeningAction(context);
    },
};
