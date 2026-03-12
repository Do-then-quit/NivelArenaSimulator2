import { Attribute, Card, CardType, EngineAction, Phase, PlayerState } from '../../../types';
import {
    PracticeHandTargetAction,
    PracticeHandTargetContext,
    PracticeMainPhaseAction,
    PracticeMainPhaseContext,
    PracticeMulliganContext,
    PracticeProfile,
    PracticeRevealedTargetAction,
    PracticeRevealedTargetContext,
    PracticeTrashTargetAction,
    PracticeTrashTargetContext,
    PracticeZoneTargetAction,
    PracticeZoneTargetContext,
} from '../types';

type PlayFieldAction = Extract<EngineAction, { type: 'PLAY_UNIT' | 'PLAY_ITEM' }>;
type PlaySkillAction = Extract<EngineAction, { type: 'PLAY_SKILL' }>;
type ActivateEffectAction = Extract<EngineAction, { type: 'ACTIVATE_EFFECT' }>;

const BT05_NIKKI_LEADER_ID = 'BT05-032';
const LOW_COST_STORM_OPENERS = new Set(['BT05-033', 'ST09-011']);
const LOW_COST_LIGHTNING_OPENERS = new Set(['BT05-064', 'BT05-065', 'BT05-066']);
const MIX_CONNECTOR_ITEMS = new Set(['BT05-046', 'BT05-081', 'BT05-082']);
const EARLY_PAYOFF_IDS = new Set(['BT05-038', 'BT05-039', 'BT05-040', 'BT05-041']);
const BT05_BORROW_SOURCE_IDS = new Set(['BT05-033', 'ST09-011', 'BT05-038', 'BT05-039', 'BT05-040', 'BT05-041']);
const BT05_LOW_COST_REDEPLOY_IDS = new Set(['BT05-033', 'BT05-034', 'BT05-064', 'BT05-066', 'ST09-011']);
const BT05_FINISHER_IDS = new Set(['BT05-038', 'BT05-039', 'BT05-040', 'BT05-041']);
const BT05_DISCARD_SAFE_IDS = new Set(['BT05-064', 'BT05-065', 'BT05-066']);
const BT05_LEADER_RETURN_OPTION_ID = 'BT05-032-RETURN';
const BT05_LEADER_DESTROY_OPTION_ID = 'BT05-032-DESTROY';

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

function getOpponent(engine: PracticeMainPhaseContext['engine'] | PracticeHandTargetContext['engine'] | PracticeTrashTargetContext['engine'], actorPlayerId: string): PlayerState | null {
    return engine.state.players.find(player => player.id !== actorPlayerId) ?? null;
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

function countBottomableNonTriggerTrashCards(cards: Card[]): number {
    return cards.filter(card => !String(card.text ?? '').includes('트리거')).length;
}

function countLowCostRedeployUnits(cards: Card[]): number {
    return cards.filter(card =>
        card.type === CardType.UNIT
        && card.cost <= 2
        && !String(card.text ?? '').includes('트리거'),
    ).length;
}

function countNamedLowCostRedeployUnits(cards: Card[]): number {
    return cards.filter(card => BT05_LOW_COST_REDEPLOY_IDS.has(getCardKey(card))).length;
}

function countEmptyUnitZones(actor: PlayerState): number {
    return actor.unitZones.filter(zone => !zone.unit).length;
}

function countOpponentUnits(opponent: PlayerState | null): number {
    if (!opponent) return 0;
    return opponent.unitZones.filter(zone => !!zone.unit).length;
}

function countOpponentNonEncounterUnits(actor: PlayerState, opponent: PlayerState | null): number {
    if (!opponent) return 0;

    let count = 0;
    for (let zoneIndex = 0; zoneIndex < opponent.unitZones.length; zoneIndex += 1) {
        if (opponent.unitZones[zoneIndex]?.unit && !actor.unitZones[zoneIndex]?.unit) {
            count += 1;
        }
    }
    return count;
}

function countLeaderActiveDestroyOutletsInHand(actor: PlayerState): number {
    return actor.hand.reduce((count, card) => {
        const cardKey = getCardKey(card);
        if (cardKey === 'BT05-045') return count + 1;
        if (cardKey === 'BT05-038') return count + 1;
        if (cardKey === 'BT05-040') return count + 1;
        return count;
    }, 0);
}

function hasValuableReturnTarget(actor: PlayerState): boolean {
    return actor.unitZones.some(zone => {
        const unit = zone.unit;
        if (!unit) return false;
        return BT05_FINISHER_IDS.has(getCardKey(unit)) || getCardKey(unit) === 'BT05-036';
    });
}

function canBt05043DestroyAnyUnit(opponent: PlayerState | null, discardCard: Card): boolean {
    if (!opponent) return false;
    return opponent.unitZones.some(zone => !!zone.unit && (zone.unit?.cost ?? 0) < discardCard.cost);
}

function getHighestDestroyableOpponentCost(opponent: PlayerState | null, discardCard: Card): number {
    if (!opponent) return Number.NEGATIVE_INFINITY;
    return opponent.unitZones.reduce((best, zone) => {
        const cost = zone.unit?.cost ?? Number.NEGATIVE_INFINITY;
        return cost < discardCard.cost ? Math.max(best, cost) : best;
    }, Number.NEGATIVE_INFINITY);
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

function getActionCard(actor: PlayerState, action: PracticeMainPhaseAction): Card | null {
    if (action.type === 'PLAY_UNIT' || action.type === 'PLAY_ITEM' || action.type === 'PLAY_SKILL') {
        return actor.hand[action.handIndex] ?? null;
    }
    if (action.type === 'ACTIVATE_EFFECT') {
        return getActivateEffectSourceCard(actor, action);
    }
    return null;
}

function isBt05LeaderActivateAction(actor: PlayerState, action: PracticeMainPhaseAction): boolean {
    return action.type === 'ACTIVATE_EFFECT'
        && action.sourceType === 'LEADER'
        && getCardKey(getActivateEffectSourceCard(actor, action)) === BT05_NIKKI_LEADER_ID;
}

function scoreBorrowTarget(actor: PlayerState, opponent: PlayerState | null, card: Card): number {
    const cardKey = getCardKey(card);
    const mixedActive = hasMixedField(getFieldAttributes(actor));
    const emptyZoneCount = countEmptyUnitZones(actor);
    const lowCostRedeployCount = countLowCostRedeployUnits(actor.trash);
    const namedRedeployCount = countNamedLowCostRedeployUnits(actor.trash);
    const opponentUnitCount = countOpponentUnits(opponent);
    const opponentNonEncounterCount = countOpponentNonEncounterUnits(actor, opponent);

    switch (cardKey) {
        case 'BT05-039':
            if (!mixedActive || emptyZoneCount <= 0 || lowCostRedeployCount <= 0) return -6000;
            return 7600 + Math.min(1200, namedRedeployCount * 250);
        case 'BT05-040':
            if (!mixedActive || opponentUnitCount <= 0) return -5500;
            return 7000 + Math.min(600, opponentUnitCount * 200);
        case 'BT05-038':
            if (!mixedActive || opponentNonEncounterCount <= 0) return -5200;
            return 6700 + Math.min(600, opponentNonEncounterCount * 200);
        case 'ST09-011':
            return 5200 + (actor.hand.length <= 2 ? 1800 : 400);
        case 'BT05-033':
            if (opponentUnitCount <= 0) return -3200;
            return 4300 + (mixedActive ? 900 : 0);
        case 'BT05-041':
            return -14000;
        default:
            if (!BT05_BORROW_SOURCE_IDS.has(cardKey)) return -8000;
            return 1200 + Math.max(0, card.cost) * 100;
    }
}

function getBestBorrowTargetScore(actor: PlayerState, opponent: PlayerState | null): number {
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const card of actor.trash) {
        if (!isBorrowableExitUnit(card)) continue;
        bestScore = Math.max(bestScore, scoreBorrowTarget(actor, opponent, card));
    }

    return bestScore;
}

function getSecondBestBorrowTargetScore(actor: PlayerState, opponent: PlayerState | null): number {
    const scores = actor.trash
        .filter(card => isBorrowableExitUnit(card))
        .map(card => scoreBorrowTarget(actor, opponent, card))
        .sort((a, b) => b - a);

    return scores[1] ?? Number.NEGATIVE_INFINITY;
}

function scoreBt05043DiscardTarget(actor: PlayerState, opponent: PlayerState | null, card: Card): number {
    const cardKey = getCardKey(card);
    const canDestroyAnyUnit = canBt05043DestroyAnyUnit(opponent, card);
    const highestDestroyableCost = getHighestDestroyableOpponentCost(opponent, card);
    const exactnessPenalty = highestDestroyableCost > Number.NEGATIVE_INFINITY
        ? Math.max(0, card.cost - highestDestroyableCost - 1) * 300
        : 0;

    let score = canDestroyAnyUnit ? 7000 : -9000;

    if (cardKey === 'BT05-041') score -= 9000;
    else if (cardKey === 'BT05-039') score -= 6000;
    else if (cardKey === 'BT05-038' || cardKey === 'BT05-040') score -= 5000;
    else if (cardKey === 'BT05-036') score -= 4200;
    else if (cardKey === 'BT05-034') score -= 3800;
    else if (cardKey === 'ST09-011') score -= 2400;
    else if (cardKey === 'BT05-033') score -= 1800;
    else if (BT05_DISCARD_SAFE_IDS.has(cardKey)) score += 1800;

    score -= exactnessPenalty;
    score -= card.cost * 120;
    return score;
}

function scoreLeaderDestroyTarget(actor: PlayerState, opponent: PlayerState | null, card: Card): number {
    const cardKey = getCardKey(card);
    const mixedActive = hasMixedField(getFieldAttributes(actor));
    const opponentUnitCount = countOpponentUnits(opponent);
    const opponentNonEncounterCount = countOpponentNonEncounterUnits(actor, opponent);
    const emptyZoneCount = countEmptyUnitZones(actor);
    const lowCostRedeployCount = countLowCostRedeployUnits(actor.trash);
    const bottomableTrashCount = countBottomableNonTriggerTrashCards(actor.trash) + 1;

    switch (cardKey) {
        case 'BT05-041':
            if (!mixedActive || bottomableTrashCount < 3) return -16000;
            return 18000 + Math.floor(bottomableTrashCount / 3) * 2200;
        case 'BT05-039':
            if (!mixedActive || emptyZoneCount <= 0 || lowCostRedeployCount <= 0) return -12000;
            return 14800 + Math.min(1200, lowCostRedeployCount * 250);
        case 'BT05-038':
            if (!mixedActive || opponentNonEncounterCount <= 0) return -11500;
            return 13600 + opponentNonEncounterCount * 250;
        case 'BT05-040':
            if (!mixedActive || opponentUnitCount <= 0) return -11200;
            return 13200 + opponentUnitCount * 200;
        case 'ST09-011':
            return actor.hand.length <= 2 ? 5200 : -4500;
        case 'BT05-033':
            return opponentUnitCount > 0 ? 4200 : -5200;
        default:
            return BT05_FINISHER_IDS.has(cardKey) ? -14000 : -7000;
    }
}

function scoreLeaderReturnTarget(actor: PlayerState, card: Card, hasReturnOutlet: boolean): number {
    if (!hasReturnOutlet) return Number.NEGATIVE_INFINITY;

    const cardKey = getCardKey(card);
    const mixedActive = hasMixedField(getFieldAttributes(actor));
    const lowCostRedeployCount = countLowCostRedeployUnits(actor.trash);

    switch (cardKey) {
        case 'BT05-040':
            return 15400;
        case 'BT05-038':
            return 15000;
        case 'BT05-039':
            return mixedActive && lowCostRedeployCount > 0 ? 14600 : 11800;
        case 'BT05-036':
            return 13400;
        case 'BT05-041':
            return mixedActive ? -5000 : 9000;
        default:
            return BT05_FINISHER_IDS.has(cardKey) ? 7800 : Number.NEGATIVE_INFINITY;
    }
}

function getBestLeaderDestroyPlan(actor: PlayerState, opponent: PlayerState | null): { card: Card; zoneIndex: number; score: number } | null {
    let bestPlan: { card: Card; zoneIndex: number; score: number } | null = null;

    for (let zoneIndex = 0; zoneIndex < actor.unitZones.length; zoneIndex += 1) {
        const unit = actor.unitZones[zoneIndex].unit;
        if (!unit) continue;

        const score = scoreLeaderDestroyTarget(actor, opponent, unit);
        if (!bestPlan || score > bestPlan.score) {
            bestPlan = { card: unit, zoneIndex, score };
        }
    }

    return bestPlan;
}

function getBestLeaderReturnPlan(actor: PlayerState, hasReturnOutlet: boolean): { card: Card; zoneIndex: number; score: number } | null {
    let bestPlan: { card: Card; zoneIndex: number; score: number } | null = null;

    for (let zoneIndex = 0; zoneIndex < actor.unitZones.length; zoneIndex += 1) {
        const unit = actor.unitZones[zoneIndex].unit;
        if (!unit) continue;

        const score = scoreLeaderReturnTarget(actor, unit, hasReturnOutlet);
        if (!bestPlan || score > bestPlan.score) {
            bestPlan = { card: unit, zoneIndex, score };
        }
    }

    return bestPlan;
}

function hasPlayableLeaderReturnOutlet(context: PracticeMainPhaseContext): boolean {
    return context.actions.some(action => {
        if (action.type === 'PLAY_SKILL') {
            const card = context.actor.hand[action.handIndex];
            return getCardKey(card) === 'BT05-045';
        }
        if (action.type === 'PLAY_UNIT') {
            const card = context.actor.hand[action.handIndex];
            const cardKey = getCardKey(card);
            return cardKey === 'BT05-038' || cardKey === 'BT05-040';
        }
        return false;
    });
}

function chooseLeaderMode(actor: PlayerState, opponent: PlayerState | null, hasReturnOutlet: boolean): 'RETURN' | 'DESTROY' | null {
    const bestDestroy = getBestLeaderDestroyPlan(actor, opponent);
    const bestReturn = getBestLeaderReturnPlan(actor, hasReturnOutlet);
    const destroyScore = bestDestroy?.score ?? Number.NEGATIVE_INFINITY;
    const returnScore = bestReturn?.score ?? Number.NEGATIVE_INFINITY;
    const bestScore = Math.max(destroyScore, returnScore);

    if (bestScore < 12000) return null;
    return destroyScore >= returnScore ? 'DESTROY' : 'RETURN';
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
            return EARLY_PAYOFF_IDS.has(getCardKey(card)) ? -5000 : 0;
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

function scoreMidgameAction(context: PracticeMainPhaseContext, action: PracticeMainPhaseAction): number {
    const card = getActionCard(context.actor, action);
    const opponent = getOpponent(context.engine, context.actorPlayerId);
    const bestBorrowScore = getBestBorrowTargetScore(context.actor, opponent);
    const secondBorrowScore = getSecondBestBorrowTargetScore(context.actor, opponent);
    const mixedActive = hasMixedField(getFieldAttributes(context.actor));
    const emptyZoneCount = countEmptyUnitZones(context.actor);
    const lowCostRedeployCount = countLowCostRedeployUnits(context.actor.trash);

    if (action.type === 'PLAY_SKILL' && card) {
        const cardKey = getCardKey(card);
        if (cardKey === 'BT05-044') {
            if (bestBorrowScore < 3500) return Number.NEGATIVE_INFINITY;
            let score = 9500 + bestBorrowScore;
            if (mixedActive && secondBorrowScore > 0) score += secondBorrowScore;
            if (!mixedActive) score -= 1200;
            return score;
        }

        if (cardKey === 'BT05-043') {
            const bestDiscardScore = context.actor.hand
                .filter(handCard => handCard.type === CardType.UNIT)
                .map(handCard => scoreBt05043DiscardTarget(context.actor, opponent, handCard))
                .sort((a, b) => b - a)[0] ?? Number.NEGATIVE_INFINITY;
            if (bestDiscardScore < 2500) return Number.NEGATIVE_INFINITY;
            return 7200 + bestDiscardScore;
        }

        return Number.NEGATIVE_INFINITY;
    }

    if (action.type === 'PLAY_UNIT' && card) {
        const cardKey = getCardKey(card);
        if (cardKey === 'BT05-036') {
            if (bestBorrowScore < 3000) return Number.NEGATIVE_INFINITY;
            return 8800 + bestBorrowScore;
        }
        if (cardKey === 'BT05-039') {
            if (bestBorrowScore < 3000) return Number.NEGATIVE_INFINITY;
            return 8200 + bestBorrowScore + (mixedActive && emptyZoneCount > 0 && lowCostRedeployCount > 0 ? 2200 : 0);
        }
    }

    if (isBt05LeaderActivateAction(context.actor, action)) {
        const hasReturnOutlet = hasPlayableLeaderReturnOutlet(context) || countLeaderActiveDestroyOutletsInHand(context.actor) > 0;
        const leaderMode = chooseLeaderMode(context.actor, opponent, hasReturnOutlet);
        if (!leaderMode) return Number.NEGATIVE_INFINITY;

        if (leaderMode === 'DESTROY') {
            return getBestLeaderDestroyPlan(context.actor, opponent)?.score ?? Number.NEGATIVE_INFINITY;
        }

        return getBestLeaderReturnPlan(context.actor, hasReturnOutlet)?.score ?? Number.NEGATIVE_INFINITY;
    }

    return Number.NEGATIVE_INFINITY;
}

function chooseBestMidgameAction(context: PracticeMainPhaseContext): PracticeMainPhaseAction | null {
    const handledActions = context.actions.filter(action => {
        const card = getActionCard(context.actor, action);
        if (!card) return false;
        const cardKey = getCardKey(card);

        if (action.type === 'PLAY_SKILL') {
            return cardKey === 'BT05-043' || cardKey === 'BT05-044';
        }

        if (action.type === 'PLAY_UNIT') {
            return cardKey === 'BT05-036' || cardKey === 'BT05-039';
        }

        if (isBt05LeaderActivateAction(context.actor, action)) {
            return true;
        }

        return false;
    });

    if (handledActions.length === 0) return null;

    let bestAction: PracticeMainPhaseAction | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const action of handledActions) {
        const score = scoreMidgameAction(context, action);
        if (score > bestScore) {
            bestAction = action;
            bestScore = score;
        }
    }

    if (bestScore >= 9000) return bestAction;

    const hasLeaderAction = context.actions.some(action => isBt05LeaderActivateAction(context.actor, action));
    const hasOtherProgressAction = context.actions.some(action => {
        if (action.type === 'NEXT_PHASE') return false;
        return !isBt05LeaderActivateAction(context.actor, action);
    });
    if (hasLeaderAction && !hasOtherProgressAction) {
        return context.actions.find((action): action is PracticeMainPhaseAction => action.type === 'NEXT_PHASE') ?? null;
    }

    return null;
}

function scoreLowCostRedeployTarget(actor: PlayerState, opponent: PlayerState | null, card: Card): number {
    const cardKey = getCardKey(card);

    switch (cardKey) {
        case 'BT05-034':
            return hasValuableReturnTarget(actor) ? 6800 : 3600;
        case 'BT05-064':
            return 6200 + (actor.hand.length <= 2 ? 1000 : 300);
        case 'BT05-066':
            return 5900 + (countBorrowableExitUnits(actor.trash) < 3 ? 900 : 200);
        case 'ST09-011':
            return 5600 + (actor.hand.length <= 2 ? 1400 : 200);
        case 'BT05-033':
            return 5000 + (countOpponentUnits(opponent) > 0 ? 400 : 0);
        default:
            return BT05_LOW_COST_REDEPLOY_IDS.has(cardKey) ? 3000 : -6000;
    }
}

function isBorrowTrashSelection(context: PracticeTrashTargetContext): boolean {
    const pending = context.engine.state.pendingEffect;
    if (!pending) return false;

    if (pending.actionType === 'BT05_044_SELECT_TRASH_UNIT') return true;
    return pending.actionType === 'COMPLEX_ACTION'
        && pending.actionValue?.mode === 'PROMPT_SELECT_TARGET_EFFECT_TO_ACTIVATE'
        && String(pending.actionValue?.activation ?? '') === 'EXIT'
        && pending.actionValue?.targetArea === 'TRASH';
}

function chooseBt05BorrowTrashAction(context: PracticeTrashTargetContext): PracticeTrashTargetAction | null {
    const opponent = getOpponent(context.engine, context.actorPlayerId);

    let bestAction: PracticeTrashTargetAction | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const action of context.actions) {
        const targetPlayer = context.engine.state.players.find(player => player.id === action.targetPlayerId);
        const card = targetPlayer?.trash[action.trashIndex];
        if (!card) continue;

        const score = scoreBorrowTarget(context.actor, opponent, card);
        if (score > bestScore) {
            bestAction = action;
            bestScore = score;
        }
    }

    return bestScore > Number.NEGATIVE_INFINITY ? bestAction : null;
}

function chooseBt05RedeployTrashAction(context: PracticeTrashTargetContext): PracticeTrashTargetAction | null {
    const pending = context.engine.state.pendingEffect;
    if (pending?.actionType !== 'BT05_STORM_SELECT_TRASH_UNIT') return null;
    const opponent = getOpponent(context.engine, context.actorPlayerId);

    let bestAction: PracticeTrashTargetAction | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const action of context.actions) {
        const targetPlayer = context.engine.state.players.find(player => player.id === action.targetPlayerId);
        const card = targetPlayer?.trash[action.trashIndex];
        if (!card) continue;

        const score = scoreLowCostRedeployTarget(context.actor, opponent, card);
        if (score > bestScore) {
            bestAction = action;
            bestScore = score;
        }
    }

    return bestScore > Number.NEGATIVE_INFINITY ? bestAction : null;
}

function chooseBt05043DiscardAction(context: PracticeHandTargetContext): PracticeHandTargetAction | null {
    const pending = context.engine.state.pendingEffect;
    if (pending?.actionType !== 'BT05_043_SELECT_HAND_UNIT') return null;
    const opponent = getOpponent(context.engine, context.actorPlayerId);

    let bestAction: PracticeHandTargetAction | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const action of context.actions) {
        const targetPlayer = context.engine.state.players.find(player => player.id === action.targetPlayerId);
        const card = targetPlayer?.hand[action.handIndex];
        if (!card) continue;

        const score = scoreBt05043DiscardTarget(context.actor, opponent, card);
        if (score > bestScore) {
            bestAction = action;
            bestScore = score;
        }
    }

    return bestScore > Number.NEGATIVE_INFINITY ? bestAction : null;
}

function chooseBt05LeaderOptionAction(context: PracticeRevealedTargetContext): PracticeRevealedTargetAction | null {
    const pending = context.engine.state.pendingEffect;
    if (pending?.actionType !== 'BT05_032_SELECT_OPTION') return null;

    const opponent = getOpponent(context.engine, context.actorPlayerId);
    const hasReturnOutlet = countLeaderActiveDestroyOutletsInHand(context.actor) > 0;
    const preferredMode = chooseLeaderMode(context.actor, opponent, hasReturnOutlet);
    if (!preferredMode) return null;

    const preferredCardId = preferredMode === 'DESTROY' ? BT05_LEADER_DESTROY_OPTION_ID : BT05_LEADER_RETURN_OPTION_ID;
    return context.actions.find(action => context.engine.state.revealedCards[action.revealedIndex]?.id === preferredCardId) ?? null;
}

function chooseBt05LeaderZoneAction(context: PracticeZoneTargetContext): PracticeZoneTargetAction | null {
    const pending = context.engine.state.pendingEffect;
    const opponent = getOpponent(context.engine, context.actorPlayerId);

    if (pending?.actionType === 'BT05_032_SELECT_FRIENDLY_DESTROY') {
        const bestPlan = getBestLeaderDestroyPlan(context.actor, opponent);
        if (!bestPlan) return null;
        return context.actions.find(action => action.targetPlayerId === context.actorPlayerId && action.zoneIndex === bestPlan.zoneIndex) ?? null;
    }

    if (pending?.actionType === 'BT05_032_SELECT_FRIENDLY_RETURN') {
        const bestPlan = getBestLeaderReturnPlan(context.actor, countLeaderActiveDestroyOutletsInHand(context.actor) > 0);
        if (!bestPlan) return null;
        return context.actions.find(action => action.targetPlayerId === context.actorPlayerId && action.zoneIndex === bestPlan.zoneIndex) ?? null;
    }

    return null;
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
        if (isOpeningWindow(context)) {
            return chooseBestOpeningAction(context);
        }
        return chooseBestMidgameAction(context);
    },
    chooseHandTargetAction(context: PracticeHandTargetContext): PracticeHandTargetAction | null {
        if (!isBt05NikkiLeader(context.actor)) return null;
        return chooseBt05043DiscardAction(context);
    },
    chooseTrashTargetAction(context: PracticeTrashTargetContext): PracticeTrashTargetAction | null {
        if (!isBt05NikkiLeader(context.actor)) return null;
        if (isBorrowTrashSelection(context)) {
            return chooseBt05BorrowTrashAction(context);
        }
        return chooseBt05RedeployTrashAction(context);
    },
    chooseZoneTargetAction(context: PracticeZoneTargetContext): PracticeZoneTargetAction | null {
        if (!isBt05NikkiLeader(context.actor)) return null;
        return chooseBt05LeaderZoneAction(context);
    },
    chooseRevealedTargetAction(context: PracticeRevealedTargetContext): PracticeRevealedTargetAction | null {
        if (!isBt05NikkiLeader(context.actor)) return null;
        return chooseBt05LeaderOptionAction(context);
    },
};
