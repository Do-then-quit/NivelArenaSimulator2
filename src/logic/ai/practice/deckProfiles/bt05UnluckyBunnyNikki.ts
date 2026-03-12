import { Attribute, Card, CardType, EngineAction, Phase, PlayerState } from '../../../types';
import {
    PracticeConfirmTargetsAction,
    PracticeConfirmTargetsContext,
    PracticeHandTargetAction,
    PracticeHandTargetContext,
    PracticeMainPhaseAction,
    PracticeMainPhaseContext,
    PracticeMulliganContext,
    PracticeOptionalAction,
    PracticeOptionalContext,
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
const BT05_REVEAL_TRASH_PRIORITY_IDS = new Set(['BT05-033', 'ST09-011', 'BT05-038', 'BT05-039', 'BT05-040', 'BT05-064', 'BT05-065', 'BT05-066', 'BT05-081', 'BT05-082', 'BT05-046']);
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

function getOpponent(
    engine:
    | PracticeMainPhaseContext['engine']
    | PracticeHandTargetContext['engine']
    | PracticeTrashTargetContext['engine']
    | PracticeZoneTargetContext['engine']
    | PracticeRevealedTargetContext['engine']
    | PracticeOptionalContext['engine']
    | PracticeConfirmTargetsContext['engine'],
    actorPlayerId: string,
): PlayerState | null {
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

function countHandCopies(actor: PlayerState, cardKey: string): number {
    return actor.hand.filter(card => getCardKey(card) === cardKey).length;
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

function findSourceItemLane(actor: PlayerState, sourceCard: Card | null | undefined): number | null {
    if (!sourceCard) return null;

    for (let zoneIndex = 0; zoneIndex < actor.unitZones.length; zoneIndex += 1) {
        if (actor.unitZones[zoneIndex].items.some(item => item === sourceCard || item.id === sourceCard.id)) {
            return zoneIndex;
        }
    }

    return null;
}

function getUnitStrategicValue(actor: PlayerState, unit: Card | null | undefined): number {
    if (!unit) return Number.NEGATIVE_INFINITY;

    const cardKey = getCardKey(unit);
    switch (cardKey) {
        case 'BT05-041':
            return 14000;
        case 'BT05-040':
            return 11800;
        case 'BT05-038':
            return 11200;
        case 'BT05-039':
            return 10800;
        case 'BT05-036':
            return 9800;
        case 'BT05-034':
            return 7600;
        case 'ST09-011':
            return actor.hand.length <= 2 ? 6200 : 4800;
        case 'BT05-033':
            return 4400;
        case 'BT05-066':
            return 4100;
        case 'BT05-065':
            return 3900;
        case 'BT05-064':
            return 3600;
        default:
            return (unit.cost ?? 0) * 1000 + (unit.hit ?? 0) * 300 + (unit.power ?? 0);
    }
}

type Bt05DiscardMode = 'UPKEEP' | 'LOOT' | 'GENERIC';

function scoreDiscardCandidate(actor: PlayerState, card: Card, mode: Bt05DiscardMode): number {
    const cardKey = getCardKey(card);
    const mixedActive = hasMixedField(getFieldAttributes(actor));
    const duplicateCount = countHandCopies(actor, cardKey);
    let score = 0;

    if (mode === 'LOOT') {
        switch (cardKey) {
            case 'BT05-039':
                score += 7600;
                break;
            case 'BT05-040':
                score += 7200;
                break;
            case 'BT05-038':
                score += 6800;
                break;
            case 'ST09-011':
                score += 5600;
                break;
            case 'BT05-033':
                score += 5200;
                break;
            case 'BT05-066':
                score += 4200;
                break;
            case 'BT05-065':
            case 'BT05-064':
                score += 3500;
                break;
            case 'BT05-082':
            case 'BT05-081':
            case 'BT05-046':
                score += 1800;
                break;
            case 'BT05-041':
                score -= 12000;
                break;
            case 'BT05-044':
                score -= 9000;
                break;
            case 'BT05-036':
                score -= 5000;
                break;
            case 'BT05-072':
                score -= 3000;
                break;
            default:
                score += Math.max(0, (3 - (card.cost ?? 0))) * 300;
                break;
        }
    } else {
        switch (cardKey) {
            case 'BT05-046':
                score += 7200;
                break;
            case 'BT05-082':
                score += 6400;
                break;
            case 'BT05-081':
                score += 5600;
                break;
            case 'BT05-066':
                score += 5200;
                break;
            case 'BT05-065':
                score += 5000;
                break;
            case 'BT05-064':
                score += 4600;
                break;
            case 'BT05-033':
                score += 3600;
                break;
            case 'ST09-011':
                score += 3200;
                break;
            case 'BT05-072':
                score += 1500;
                break;
            case 'BT05-039':
                score -= 6500;
                break;
            case 'BT05-040':
            case 'BT05-038':
                score -= 7800;
                break;
            case 'BT05-041':
                score -= 11000;
                break;
            case 'BT05-044':
                score -= 9000;
                break;
            case 'BT05-036':
                score -= 5200;
                break;
            default:
                score += Math.max(0, 3 - (card.cost ?? 0)) * 250;
                break;
        }
    }

    if (duplicateCount > 1) score += (duplicateCount - 1) * 700;
    if (!mixedActive && card.attribute !== Attribute.NONE) score += 200;
    return score;
}

function scoreRevealTrashCandidate(card: Card): number {
    const cardKey = getCardKey(card);

    if (!BT05_REVEAL_TRASH_PRIORITY_IDS.has(cardKey)) return -3000;
    if (cardKey === 'BT05-041') return -12000;
    if (cardKey === 'BT05-044') return -9500;
    if (cardKey === 'BT05-036') return -5200;
    if (cardKey === 'BT05-039') return 7600;
    if (cardKey === 'BT05-040') return 7100;
    if (cardKey === 'BT05-038') return 6800;
    if (cardKey === 'ST09-011') return 5600;
    if (cardKey === 'BT05-033') return 5300;
    if (cardKey === 'BT05-066') return 4500;
    if (cardKey === 'BT05-065' || cardKey === 'BT05-064') return 3900;
    if (cardKey === 'BT05-082' || cardKey === 'BT05-081' || cardKey === 'BT05-046') return 2500;
    return 1200;
}

function scoreBt05041BottomCandidate(card: Card): number {
    const cardKey = getCardKey(card);

    switch (cardKey) {
        case 'BT05-044':
            return -12000;
        case 'BT05-041':
            return -9000;
        case 'BT05-039':
            return -6000;
        case 'BT05-040':
        case 'BT05-038':
            return -5200;
        case 'BT05-036':
            return -3600;
        case 'BT05-046':
        case 'BT05-082':
        case 'BT05-081':
            return 5800;
        case 'BT05-066':
        case 'BT05-065':
        case 'BT05-064':
            return 5400;
        case 'ST09-011':
        case 'BT05-033':
            return 4200;
        default:
            return !String(card.text ?? '').includes('트리거') ? 2200 : -4000;
    }
}

function getBt05041DesiredSelectionCount(actor: PlayerState): number {
    const positiveCount = actor.trash.filter(card => scoreBt05041BottomCandidate(card) > 0).length;
    return Math.min(9, Math.max(0, Math.floor(positiveCount / 3) * 3));
}

function getBestDiscardScoreFromHand(actor: PlayerState, mode: Bt05DiscardMode, excludedHandIndex: number | null = null): number {
    let bestScore = Number.NEGATIVE_INFINITY;

    for (let handIndex = 0; handIndex < actor.hand.length; handIndex += 1) {
        if (excludedHandIndex !== null && handIndex === excludedHandIndex) continue;
        const card = actor.hand[handIndex];
        if (!card) continue;
        bestScore = Math.max(bestScore, scoreDiscardCandidate(actor, card, mode));
    }

    return bestScore;
}

function getBestSelectableHandAction(
    context: PracticeHandTargetContext,
    scoreCard: (card: Card) => number,
): { action: PracticeHandTargetAction; score: number } | null {
    const pendingSelectedTargets = context.engine.state.pendingEffect?.selectedTargets ?? [];
    let bestAction: PracticeHandTargetAction | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const action of context.actions) {
        const targetPlayer = context.engine.state.players.find(player => player.id === action.targetPlayerId);
        const card = targetPlayer?.hand[action.handIndex];
        if (!card || pendingSelectedTargets.includes(card)) continue;

        const score = scoreCard(card);
        if (score > bestScore) {
            bestAction = action;
            bestScore = score;
        }
    }

    return bestAction ? { action: bestAction, score: bestScore } : null;
}

function getBestSelectableTrashAction(
    context: PracticeTrashTargetContext,
    scoreCard: (card: Card) => number,
): { action: PracticeTrashTargetAction; score: number } | null {
    const pendingSelectedTargets = context.engine.state.pendingEffect?.selectedTargets ?? [];
    let bestAction: PracticeTrashTargetAction | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const action of context.actions) {
        const targetPlayer = context.engine.state.players.find(player => player.id === action.targetPlayerId);
        const card = targetPlayer?.trash[action.trashIndex];
        if (!card || pendingSelectedTargets.includes(card)) continue;

        const score = scoreCard(card);
        if (score > bestScore) {
            bestAction = action;
            bestScore = score;
        }
    }

    return bestAction ? { action: bestAction, score: bestScore } : null;
}

function getBestSelectableRevealedAction(
    context: PracticeRevealedTargetContext,
    scoreCard: (card: Card) => number,
): { action: PracticeRevealedTargetAction; score: number } | null {
    const pendingSelectedTargets = context.engine.state.pendingEffect?.selectedTargets ?? [];
    let bestAction: PracticeRevealedTargetAction | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const action of context.actions) {
        const card = context.engine.state.revealedCards[action.revealedIndex];
        if (!card || pendingSelectedTargets.includes(card)) continue;

        const score = scoreCard(card);
        if (score > bestScore) {
            bestAction = action;
            bestScore = score;
        }
    }

    return bestAction ? { action: bestAction, score: bestScore } : null;
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

function scoreBt05043DiscardTarget(opponent: PlayerState | null, card: Card): number {
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

function scoreMidgamePlayItemAction(
    context: PracticeMainPhaseContext,
    action: Extract<PracticeMainPhaseAction, { type: 'PLAY_ITEM' }>,
    card: Card,
): number {
    const zone = context.actor.unitZones[action.zoneIndex];
    const unit = zone?.unit;
    if (!zone || !unit) return Number.NEGATIVE_INFINITY;

    const unitValue = getUnitStrategicValue(context.actor, unit);
    const existingItemPenalty = zone.items.length * 2200;
    const attributesBefore = getFieldAttributes(context.actor);
    const mixedBefore = hasMixedField(attributesBefore);
    const attributesAfter = new Set(attributesBefore);
    if (card.attribute !== Attribute.NONE) {
        attributesAfter.add(card.attribute);
    }
    const mixedAfter = hasMixedField(attributesAfter);

    switch (getCardKey(card)) {
        case 'BT05-081': {
            if (unitValue < 4200 && !mixedAfter) return Number.NEGATIVE_INFINITY;
            let score = 3200 + Math.floor(unitValue * 0.55) - existingItemPenalty;
            if (!mixedBefore && mixedAfter) score += 2400;
            if (mixedAfter) score += 1400;
            return score;
        }
        case 'BT05-082': {
            const bestLootScore = getBestDiscardScoreFromHand(context.actor, 'LOOT', action.handIndex);
            if (bestLootScore < 2800) return Number.NEGATIVE_INFINITY;
            let score = 2600 + Math.floor(unitValue * 0.45) - existingItemPenalty + Math.min(3200, Math.floor(bestLootScore * 0.45));
            if (!mixedBefore && mixedAfter) score += 2000;
            return score;
        }
        case 'BT05-046': {
            const bestUpkeepScore = getBestDiscardScoreFromHand(context.actor, 'UPKEEP', action.handIndex);
            if (bestUpkeepScore < 2200 && unitValue < 9000) return Number.NEGATIVE_INFINITY;
            return 2400 + Math.floor(unitValue * 0.45) - existingItemPenalty + Math.min(3000, Math.floor(bestUpkeepScore * 0.5));
        }
        default:
            return Number.NEGATIVE_INFINITY;
    }
}

function scoreMidgameActivateEffectAction(context: PracticeMainPhaseContext, card: Card): number {
    if (getCardKey(card) !== 'BT05-082') return Number.NEGATIVE_INFINITY;

    const bestLootScore = getBestDiscardScoreFromHand(context.actor, 'LOOT');
    if (bestLootScore < 3000) return Number.NEGATIVE_INFINITY;

    const sourceLane = findSourceItemLane(context.actor, card);
    const sourceUnit = sourceLane !== null ? context.actor.unitZones[sourceLane]?.unit ?? null : null;
    const unitValue = Math.max(0, getUnitStrategicValue(context.actor, sourceUnit));
    return 3600 + bestLootScore + Math.floor(unitValue * 0.1);
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
                .map(handCard => scoreBt05043DiscardTarget(opponent, handCard))
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

    if (action.type === 'PLAY_ITEM' && card) {
        return scoreMidgamePlayItemAction(context, action, card);
    }

    if (action.type === 'ACTIVATE_EFFECT' && card && !isBt05LeaderActivateAction(context.actor, action)) {
        return scoreMidgameActivateEffectAction(context, card);
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

        if (action.type === 'PLAY_ITEM') {
            return cardKey === 'BT05-046' || cardKey === 'BT05-081' || cardKey === 'BT05-082';
        }

        if (action.type === 'ACTIVATE_EFFECT') {
            return cardKey === 'BT05-082' || isBt05LeaderActivateAction(context.actor, action);
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

    const hasUnhandledProgressAction = context.actions.some(action => {
        if (action.type === 'NEXT_PHASE') return false;
        return !handledActions.includes(action);
    });
    if (!hasUnhandledProgressAction) {
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
    return getBestSelectableTrashAction(context, card => scoreBorrowTarget(context.actor, opponent, card))?.action ?? null;
}

function chooseBt05RedeployTrashAction(context: PracticeTrashTargetContext): PracticeTrashTargetAction | null {
    const pending = context.engine.state.pendingEffect;
    if (pending?.actionType !== 'BT05_STORM_SELECT_TRASH_UNIT') return null;
    const opponent = getOpponent(context.engine, context.actorPlayerId);
    return getBestSelectableTrashAction(context, card => scoreLowCostRedeployTarget(context.actor, opponent, card))?.action ?? null;
}

function chooseBt05041BottomTrashAction(context: PracticeTrashTargetContext): PracticeTrashTargetAction | null {
    const pending = context.engine.state.pendingEffect;
    if (pending?.actionType !== 'BT05_041_SELECT_TRASH') return null;

    const bestSelection = getBestSelectableTrashAction(context, scoreBt05041BottomCandidate);
    if (!bestSelection || bestSelection.score <= 0) return null;
    return bestSelection.action;
}

function chooseBt05DiscardByMode(context: PracticeHandTargetContext, mode: Bt05DiscardMode): PracticeHandTargetAction | null {
    return getBestSelectableHandAction(context, card => scoreDiscardCandidate(context.actor, card, mode))?.action ?? null;
}

function chooseBt05043DiscardAction(context: PracticeHandTargetContext): PracticeHandTargetAction | null {
    const opponent = getOpponent(context.engine, context.actorPlayerId);
    return getBestSelectableHandAction(context, card => scoreBt05043DiscardTarget(opponent, card))?.action ?? null;
}

function chooseBt05HandTargetAction(context: PracticeHandTargetContext): PracticeHandTargetAction | null {
    const pending = context.engine.state.pendingEffect;
    if (!pending) return null;

    if (pending.actionType === 'BT05_043_SELECT_HAND_UNIT') {
        return chooseBt05043DiscardAction(context);
    }

    if (pending.actionType === 'BT05_046_SELECT_HAND') {
        return chooseBt05DiscardByMode(context, 'UPKEEP');
    }

    if (pending.actionType === 'DISCARD_FROM_HAND_AFTER_DRAW') {
        return chooseBt05DiscardByMode(context, 'LOOT');
    }

    if (pending.actionType === 'DISCARD' && getCardKey(pending.sourceCard) === 'BT05-040') {
        return chooseBt05DiscardByMode(context, 'GENERIC');
    }

    return null;
}

function chooseBt05072RevealTrashAction(context: PracticeRevealedTargetContext): PracticeRevealedTargetAction | null {
    const pending = context.engine.state.pendingEffect;
    if (pending?.actionType !== 'BT05_072_SELECT_REVEALED') return null;

    const bestSelection = getBestSelectableRevealedAction(context, scoreRevealTrashCandidate);
    if (!bestSelection || bestSelection.score <= 0) return null;
    return bestSelection.action;
}

function chooseBt05OptionalAction(context: PracticeOptionalContext): PracticeOptionalAction | null {
    const pending = context.engine.state.pendingEffect;
    if (pending?.actionType !== 'BT05_065_ENTRY_MILL3_AND_RECOVER_DAMAGE') return null;

    const shouldConfirm = context.actor.damage.length > 0 && context.actor.deck.length > 3;
    return context.actions.find(action => action.confirm === shouldConfirm) ?? null;
}

function chooseBt05ConfirmTargetsAction(context: PracticeConfirmTargetsContext): PracticeConfirmTargetsAction | null {
    const confirmAction = context.actions[0] ?? null;
    if (!confirmAction) return null;

    const pending = context.engine.state.pendingEffect;
    if (!pending) return null;

    if (pending.actionType === 'BT05_046_SELECT_HAND') {
        const selectedCount = pending.selectedTargets?.length ?? 0;
        if (selectedCount > 0) return null;

        const legalActions = context.engine.getLegalActions(context.actorPlayerId);
        const handActions = legalActions.filter((action): action is PracticeHandTargetAction => action.type === 'SELECT_HAND_TARGET');
        const handContext: PracticeHandTargetContext = {
            engine: context.engine,
            actorPlayerId: context.actorPlayerId,
            actor: context.actor,
            actions: handActions,
        };
        const bestDiscardAction = getBestSelectableHandAction(handContext, card => scoreDiscardCandidate(context.actor, card, 'UPKEEP'));
        const bestDiscardScore = bestDiscardAction?.score ?? Number.NEGATIVE_INFINITY;
        const sourceLane = findSourceItemLane(context.actor, pending.sourceCard ?? null);
        const sourceUnit = sourceLane !== null ? context.actor.unitZones[sourceLane]?.unit ?? null : null;
        const sourceUnitValue = Math.max(0, getUnitStrategicValue(context.actor, sourceUnit));

        if (!sourceUnit || sourceUnitValue <= 4500) return confirmAction;
        if (bestDiscardScore < 2600 && sourceUnitValue < 9000) return confirmAction;
        if (bestDiscardScore < 1200 && context.actor.hand.length <= 1) return confirmAction;
        return null;
    }

    if (pending.actionType === 'BT05_072_SELECT_REVEALED') {
        const legalActions = context.engine.getLegalActions(context.actorPlayerId);
        const revealedActions = legalActions.filter((action): action is PracticeRevealedTargetAction => action.type === 'SELECT_REVEALED_TARGET');
        const revealedContext: PracticeRevealedTargetContext = {
            engine: context.engine,
            actorPlayerId: context.actorPlayerId,
            actor: context.actor,
            actions: revealedActions,
        };
        const bestSelection = getBestSelectableRevealedAction(revealedContext, scoreRevealTrashCandidate);
        if (!bestSelection || bestSelection.score <= 0) return confirmAction;
        return null;
    }

    if (pending.actionType === 'BT05_041_SELECT_TRASH') {
        const desiredSelectionCount = getBt05041DesiredSelectionCount(context.actor);
        const selectedCount = pending.selectedTargets?.length ?? 0;
        if (selectedCount >= desiredSelectionCount) return confirmAction;

        const legalActions = context.engine.getLegalActions(context.actorPlayerId);
        const trashActions = legalActions.filter((action): action is PracticeTrashTargetAction => action.type === 'SELECT_TRASH_TARGET');
        const trashContext: PracticeTrashTargetContext = {
            engine: context.engine,
            actorPlayerId: context.actorPlayerId,
            actor: context.actor,
            actions: trashActions,
        };
        const bestSelection = getBestSelectableTrashAction(trashContext, scoreBt05041BottomCandidate);
        if (desiredSelectionCount <= 0 || !bestSelection || bestSelection.score <= 0) return confirmAction;
    }

    return null;
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
        return chooseBt05HandTargetAction(context);
    },
    chooseTrashTargetAction(context: PracticeTrashTargetContext): PracticeTrashTargetAction | null {
        if (!isBt05NikkiLeader(context.actor)) return null;
        if (isBorrowTrashSelection(context)) {
            return chooseBt05BorrowTrashAction(context);
        }
        return chooseBt05041BottomTrashAction(context) ?? chooseBt05RedeployTrashAction(context);
    },
    chooseZoneTargetAction(context: PracticeZoneTargetContext): PracticeZoneTargetAction | null {
        if (!isBt05NikkiLeader(context.actor)) return null;
        return chooseBt05LeaderZoneAction(context);
    },
    chooseRevealedTargetAction(context: PracticeRevealedTargetContext): PracticeRevealedTargetAction | null {
        if (!isBt05NikkiLeader(context.actor)) return null;
        return chooseBt05LeaderOptionAction(context) ?? chooseBt05072RevealTrashAction(context);
    },
    chooseOptionalAction(context: PracticeOptionalContext): PracticeOptionalAction | null {
        if (!isBt05NikkiLeader(context.actor)) return null;
        return chooseBt05OptionalAction(context);
    },
    chooseConfirmTargetsAction(context: PracticeConfirmTargetsContext): PracticeConfirmTargetsAction | null {
        if (!isBt05NikkiLeader(context.actor)) return null;
        return chooseBt05ConfirmTargetsAction(context);
    },
};
