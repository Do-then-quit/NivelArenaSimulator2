import { DUMMY_CARDS } from '../../src/logic/CardDatabase';
import { createRandomProvider } from '../../src/logic/random';
import { Attribute, Card, CardType } from '../../src/logic/types';

export const IMPLEMENTED_PACK_PREFIXES = ['ST01-', 'ST02-', 'ST03-', 'BT01-'] as const;
export const DEFAULT_DECK_SIZE = 40;
export const DEFAULT_MAX_COPIES_PER_IDENTIFIER = 3;
export const DEFAULT_MAX_TRIGGER_CARDS = 8;

const OATH_ATTRIBUTE_TOKEN_TO_ENUM: Record<string, Attribute> = {
    '화염': Attribute.FIRE,
    '대지': Attribute.EARTH,
    '폭풍': Attribute.STORM,
    '파도': Attribute.WATER,
    '번개': Attribute.LIGHTNING,
    'FIRE': Attribute.FIRE,
    'EARTH': Attribute.EARTH,
    'STORM': Attribute.STORM,
    'WATER': Attribute.WATER,
    'LIGHTNING': Attribute.LIGHTNING,
};

export interface LeaderDeckConstraint {
    attribute: Attribute;
    sourceText: string;
    allowSingleOffAttribute?: boolean;
    requirePrimaryAttributeInDeck?: boolean;
}

export interface DeckLegalityReport {
    valid: boolean;
    deckSize: number;
    maxCopiesPerIdentifier: number;
    triggerLimit: number;
    triggerCount: number;
    copyViolations: Array<{ identifier: string; count: number }>;
    oathViolations: Array<{ cardId: string; cardAttribute: Attribute }>;
    errors: string[];
}

function hasImplementedPrefix(cardId: string): boolean {
    return IMPLEMENTED_PACK_PREFIXES.some(prefix => cardId.startsWith(prefix));
}

function cloneCard(template: Card, nextId: string): Card {
    return { ...template, id: nextId };
}

export function getImplementedCardPool(allCards: Card[] = DUMMY_CARDS): Card[] {
    return allCards.filter(card => hasImplementedPrefix(card.id));
}

export function getImplementedLeaderPool(allCards: Card[] = DUMMY_CARDS): Card[] {
    return getImplementedCardPool(allCards).filter(card => card.type === CardType.LEADER);
}

export function getImplementedDeckPool(allCards: Card[] = DUMMY_CARDS): Card[] {
    return getImplementedCardPool(allCards).filter(card => card.type !== CardType.LEADER);
}

function normalizeKeywordText(card: Card): string {
    const rawKeywords = (card as unknown as { keywords?: unknown }).keywords;
    if (Array.isArray(rawKeywords)) {
        return rawKeywords.map(keyword => String(keyword)).join(' ');
    }
    if (typeof rawKeywords === 'string') {
        return rawKeywords;
    }
    return '';
}

function hasTriggerEffectSegment(card: Card): boolean {
    const effectSegments = (card as Card & {
        effectSegments?: Array<{ isTriggerSegment?: boolean }> | unknown;
    }).effectSegments;

    return Array.isArray(effectSegments) && effectSegments.some(segment => segment?.isTriggerSegment === true);
}

function isTriggerCard(card: Card): boolean {
    if (hasTriggerEffectSegment(card)) return true;

    const keywordText = normalizeKeywordText(card).toLowerCase();
    if (keywordText.includes('트리거') || keywordText.includes('trigger')) return true;

    const text = (card.text ?? '').toLowerCase();
    return (
        text.startsWith('[트리거] ')
        || text.startsWith('trigger:')
        || text.includes('\n[트리거] ')
        || text.includes('\ntrigger:')
        || text.includes('. [트리거] ')
        || text.includes('. trigger:')
    );
}

export function extractCardIdentifier(cardId: string): string {
    const match = cardId.match(/^(ST\d{2}-\d+|BT\d{2}-\d+|SB\d{2}-\d+)/i);
    if (match) return match[0].toUpperCase();
    const firstUnderscoreIndex = cardId.indexOf('_');
    if (firstUnderscoreIndex < 0) return cardId;
    return cardId.slice(0, firstUnderscoreIndex);
}

export function resolveLeaderDeckConstraint(leader: Card): LeaderDeckConstraint | null {
    const text = leader.text ?? '';
    const normalizedText = text.replace(/\s+/g, ' ');
    const oathMatch = text.match(
        /서약\s*:\s*자신의\s*덱에\s*([^:\s]+)\s*:\s*카드(?:만\s*넣을\s*수\s*있다|를\s*넣어야\s*한다)/,
    );
    const bracketedAttributeMatch = text.match(/서약[^\[]*\[([^\]]+)\]\s*카드를\s*넣어야\s*한다/);

    const explicitToken = oathMatch?.[1]?.trim() || bracketedAttributeMatch?.[1]?.trim();

    if (explicitToken) {
        const token = explicitToken;
        const mapped = OATH_ATTRIBUTE_TOKEN_TO_ENUM[token];
        if (mapped) {
            return {
                attribute: mapped,
                sourceText: token,
                allowSingleOffAttribute: /이외의\s*카드는\s*모두\s*같은\s*속성이어야\s*한다/.test(normalizedText),
                requirePrimaryAttributeInDeck: true,
            };
        }
    }

    if (text.includes('서약') && leader.attribute !== Attribute.NONE) {
        return {
            attribute: leader.attribute,
            sourceText: leader.attribute,
            allowSingleOffAttribute: /이외의\s*카드는\s*모두\s*같은\s*속성이어야\s*한다/.test(normalizedText),
            requirePrimaryAttributeInDeck: true,
        };
    }

    return null;
}

export function getDeckPoolForLeader(leader: Card, deckPool: Card[] = getImplementedDeckPool()): Card[] {
    const constraint = resolveLeaderDeckConstraint(leader);
    if (!constraint) return deckPool;
    return deckPool.filter(card => card.attribute === constraint.attribute);
}

function pickValidTemplateDeterministically(
    seed: number,
    step: number,
    candidates: Card[],
): Card {
    const rng = createRandomProvider(seed + step * 1315423911);
    const index = Math.floor(rng.next() * candidates.length);
    return candidates[index];
}

function buildDeterministicDeckWithRules(
    seed: number,
    tag: string,
    deckSize: number,
    sourcePool: Card[],
    maxCopiesPerIdentifier: number,
    maxTriggerCards: number,
): Card[] {
    if (sourcePool.length === 0) {
        throw new Error('Deck source pool is empty.');
    }

    const sortedPool = [...sourcePool].sort((a, b) => a.id.localeCompare(b.id));
    const deck: Card[] = [];
    const copyCountByIdentifier = new Map<string, number>();
    let triggerCount = 0;

    for (let i = 0; i < deckSize; i++) {
        const validTemplates = sortedPool.filter(template => {
            const identifier = extractCardIdentifier(template.id);
            const usedCopies = copyCountByIdentifier.get(identifier) ?? 0;
            if (usedCopies >= maxCopiesPerIdentifier) return false;

            const isTrigger = isTriggerCard(template);
            if (isTrigger && triggerCount >= maxTriggerCards) return false;

            return true;
        });

        if (validTemplates.length === 0) {
            throw new Error(
                `Unable to build legal deck: no valid templates at index ${i}. ` +
                `Rules(maxCopies=${maxCopiesPerIdentifier}, maxTrigger=${maxTriggerCards}).`,
            );
        }

        const template = pickValidTemplateDeterministically(seed, i + 1, validTemplates);
        const identifier = extractCardIdentifier(template.id);
        copyCountByIdentifier.set(identifier, (copyCountByIdentifier.get(identifier) ?? 0) + 1);
        if (isTriggerCard(template)) triggerCount += 1;

        deck.push(cloneCard(template, `${template.id}_${tag}_${seed}_${i}`));
    }

    return deck;
}

export function pickDeterministicLeader(
    seed: number,
    salt: number,
    leaderPool: Card[] = getImplementedLeaderPool(),
): Card {
    if (leaderPool.length === 0) {
        throw new Error('No implemented leaders found in card pool.');
    }

    const index = Math.abs((seed * 37 + salt * 1009) % leaderPool.length);
    const template = leaderPool[index];
    return cloneCard(template, `${template.id}_L_${seed}_${salt}`);
}

export function buildDeterministicDeck(
    seed: number,
    tag: string,
    deckSize: number = DEFAULT_DECK_SIZE,
    deckPool: Card[] = getImplementedDeckPool(),
): Card[] {
    return buildDeterministicDeckWithRules(
        seed,
        tag,
        deckSize,
        deckPool,
        DEFAULT_MAX_COPIES_PER_IDENTIFIER,
        DEFAULT_MAX_TRIGGER_CARDS,
    );
}

export function buildDeterministicDeckForLeader(
    seed: number,
    tag: string,
    leader: Card,
    deckSize: number = DEFAULT_DECK_SIZE,
    deckPool: Card[] = getImplementedDeckPool(),
): Card[] {
    const constrainedPool = getDeckPoolForLeader(leader, deckPool);
    if (constrainedPool.length === 0) {
        throw new Error(`No deck cards available for leader constraint: ${leader.id}`);
    }

    return buildDeterministicDeckWithRules(
        seed,
        tag,
        deckSize,
        constrainedPool,
        DEFAULT_MAX_COPIES_PER_IDENTIFIER,
        DEFAULT_MAX_TRIGGER_CARDS,
    );
}

export function materializeDeckForMatch(deck: Card[], seed: number, tag: string): Card[] {
    return deck.map((card, index) => cloneCard(card, `${card.id}_${tag}_${seed}_${index}`));
}

export function validateDeckAgainstLeader(
    deck: Card[],
    leader: Card,
    deckSize: number = DEFAULT_DECK_SIZE,
    maxCopiesPerIdentifier: number = DEFAULT_MAX_COPIES_PER_IDENTIFIER,
    triggerLimit: number = DEFAULT_MAX_TRIGGER_CARDS,
): DeckLegalityReport {
    const errors: string[] = [];
    const constraint = resolveLeaderDeckConstraint(leader);
    const copyCountByIdentifier = new Map<string, number>();
    let triggerCount = 0;
    const oathViolations: Array<{ cardId: string; cardAttribute: Attribute }> = [];
    let primaryAttributeCount = 0;
    let sharedOffAttribute: Attribute | null = null;

    for (const card of deck) {
        const identifier = extractCardIdentifier(card.id);
        copyCountByIdentifier.set(identifier, (copyCountByIdentifier.get(identifier) ?? 0) + 1);
        if (isTriggerCard(card)) triggerCount += 1;

        if (constraint) {
            if (card.attribute === constraint.attribute) {
                primaryAttributeCount += 1;
            } else if (constraint.allowSingleOffAttribute) {
                if (sharedOffAttribute === null) {
                    sharedOffAttribute = card.attribute;
                } else if (card.attribute !== sharedOffAttribute) {
                    oathViolations.push({
                        cardId: card.id,
                        cardAttribute: card.attribute,
                    });
                }
            } else {
                oathViolations.push({
                    cardId: card.id,
                    cardAttribute: card.attribute,
                });
            }
        }
    }

    const copyViolations = [...copyCountByIdentifier.entries()]
        .filter(([_identifier, count]) => count > maxCopiesPerIdentifier)
        .map(([identifier, count]) => ({ identifier, count }));

    if (deck.length !== deckSize) {
        errors.push(`Deck must have exactly ${deckSize} cards. got=${deck.length}`);
    }
    if (copyViolations.length > 0) {
        errors.push(`Deck violates max copies rule (${maxCopiesPerIdentifier}).`);
    }
    if (triggerCount > triggerLimit) {
        errors.push(`Deck violates trigger limit (${triggerLimit}). got=${triggerCount}`);
    }
    if (constraint?.requirePrimaryAttributeInDeck && primaryAttributeCount === 0) {
        errors.push(`Deck violates leader oath constraint (${constraint.attribute} required in deck).`);
    }
    if (oathViolations.length > 0) {
        errors.push(
            `Deck violates leader oath constraint (${constraint?.attribute ?? 'UNKNOWN'}${constraint?.allowSingleOffAttribute ? ' + shared off-attribute' : ''}).`,
        );
    }

    return {
        valid: errors.length === 0,
        deckSize,
        maxCopiesPerIdentifier,
        triggerLimit,
        triggerCount,
        copyViolations,
        oathViolations,
        errors,
    };
}
