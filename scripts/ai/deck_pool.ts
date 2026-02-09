import { DUMMY_CARDS } from '../../src/logic/CardDatabase';
import { createRandomProvider } from '../../src/logic/random';
import { Card, CardType } from '../../src/logic/types';

export const IMPLEMENTED_PACK_PREFIXES = ['ST01-', 'ST02-', 'ST03-', 'BT01-'] as const;

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
    deckSize: number = 40,
    deckPool: Card[] = getImplementedDeckPool(),
): Card[] {
    if (deckPool.length === 0) {
        throw new Error('No implemented non-leader cards found in card pool.');
    }

    const rng = createRandomProvider(seed);
    const deck: Card[] = [];
    for (let i = 0; i < deckSize; i++) {
        const index = Math.floor(rng.next() * deckPool.length);
        const template = deckPool[index];
        deck.push(cloneCard(template, `${template.id}_${tag}_${seed}_${i}`));
    }
    return deck;
}

export function materializeDeckForMatch(deck: Card[], seed: number, tag: string): Card[] {
    return deck.map((card, index) => cloneCard(card, `${card.id}_${tag}_${seed}_${index}`));
}

