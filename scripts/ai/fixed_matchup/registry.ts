import { DUMMY_CARDS } from '../../../src/logic/CardDatabase';
import { Card, CardType } from '../../../src/logic/types';
import {
    DEFAULT_DECK_SIZE,
    DEFAULT_MAX_COPIES_PER_IDENTIFIER,
    extractCardIdentifier,
    validateDeckAgainstLeader,
} from '../deck_pool';

export interface FixedDeckCardEntry {
    cardId: string;
    copies: number;
}

export interface FixedDeckDefinition {
    id: string;
    label: string;
    leaderId: string;
    cards: FixedDeckCardEntry[];
    notes?: string[];
}

export interface FixedMatchupDefinition {
    id: string;
    label: string;
    player1DeckId: string;
    player2DeckId: string;
    description?: string;
}

export interface ResolvedFixedDeck {
    definition: FixedDeckDefinition;
    leader: Card;
    deck: Card[];
}

export interface ResolvedFixedMatchup {
    definition: FixedMatchupDefinition;
    player1: ResolvedFixedDeck;
    player2: ResolvedFixedDeck;
}

const FIXED_DECKS: FixedDeckDefinition[] = [
    {
        id: 'fire-redhood-prototype-v1',
        label: 'Fire Red Hood Prototype v1',
        leaderId: 'BT01-001',
        notes: [
            'Initial static prototype for fixed-matchup scaffolding.',
            'Seed-derived from deterministic legal deck generation (seed=20260310).',
            'Replace with manually curated meta list after replay audit.',
        ],
        cards: [
            { cardId: 'BT01-004', copies: 1 },
            { cardId: 'BT01-005', copies: 3 },
            { cardId: 'BT01-007', copies: 1 },
            { cardId: 'BT01-008', copies: 2 },
            { cardId: 'BT01-009', copies: 2 },
            { cardId: 'BT01-010', copies: 2 },
            { cardId: 'BT01-011', copies: 2 },
            { cardId: 'BT01-012', copies: 1 },
            { cardId: 'BT01-014', copies: 1 },
            { cardId: 'BT01-015', copies: 2 },
            { cardId: 'BT01-017', copies: 3 },
            { cardId: 'BT01-018', copies: 1 },
            { cardId: 'BT01-019', copies: 2 },
            { cardId: 'BT01-020', copies: 3 },
            { cardId: 'BT01-021', copies: 1 },
            { cardId: 'BT01-025', copies: 1 },
            { cardId: 'ST01-002', copies: 1 },
            { cardId: 'ST01-004', copies: 3 },
            { cardId: 'ST01-006', copies: 1 },
            { cardId: 'ST01-011', copies: 1 },
            { cardId: 'ST01-014', copies: 2 },
            { cardId: 'ST01-015', copies: 3 },
            { cardId: 'ST01-016', copies: 1 },
        ],
    },
    {
        id: 'storm-modernia-prototype-v1',
        label: 'Storm Modernia Prototype v1',
        leaderId: 'ST03-001',
        notes: [
            'Initial static prototype for fixed-matchup scaffolding.',
            'Seed-derived from deterministic legal deck generation (seed=20260310).',
            'Replace with manually curated meta list after replay audit.',
        ],
        cards: [
            { cardId: 'BT01-058', copies: 1 },
            { cardId: 'BT01-059', copies: 3 },
            { cardId: 'BT01-060', copies: 1 },
            { cardId: 'BT01-061', copies: 1 },
            { cardId: 'BT01-062', copies: 3 },
            { cardId: 'BT01-063', copies: 2 },
            { cardId: 'BT01-064', copies: 2 },
            { cardId: 'BT01-065', copies: 1 },
            { cardId: 'BT01-066', copies: 1 },
            { cardId: 'BT01-067', copies: 1 },
            { cardId: 'BT01-068', copies: 1 },
            { cardId: 'BT01-069', copies: 3 },
            { cardId: 'BT01-071', copies: 1 },
            { cardId: 'BT01-072', copies: 1 },
            { cardId: 'BT01-073', copies: 2 },
            { cardId: 'BT01-074', copies: 2 },
            { cardId: 'BT01-075', copies: 1 },
            { cardId: 'BT01-079', copies: 1 },
            { cardId: 'BT01-081', copies: 1 },
            { cardId: 'ST03-004', copies: 3 },
            { cardId: 'ST03-006', copies: 1 },
            { cardId: 'ST03-011', copies: 1 },
            { cardId: 'ST03-014', copies: 3 },
            { cardId: 'ST03-015', copies: 2 },
            { cardId: 'ST03-016', copies: 1 },
        ],
    },
];

const FIXED_MATCHUPS: FixedMatchupDefinition[] = [
    {
        id: 'fm-a-fire-redhood-mirror',
        label: 'FM-A Fire Red Hood Mirror',
        player1DeckId: 'fire-redhood-prototype-v1',
        player2DeckId: 'fire-redhood-prototype-v1',
        description: 'Mirror matchup for the current fire prototype deck.',
    },
    {
        id: 'fm-a-storm-modernia-mirror',
        label: 'FM-A Storm Modernia Mirror',
        player1DeckId: 'storm-modernia-prototype-v1',
        player2DeckId: 'storm-modernia-prototype-v1',
        description: 'Mirror matchup for the current storm prototype deck.',
    },
    {
        id: 'fm-b-fire-vs-storm',
        label: 'FM-B Fire vs Storm',
        player1DeckId: 'fire-redhood-prototype-v1',
        player2DeckId: 'storm-modernia-prototype-v1',
        description: 'Cross matchup for the initial fire and storm prototype decks.',
    },
];

function cloneCard(template: Card): Card {
    return { ...template };
}

function findCardTemplate(cardId: string, expectedType?: CardType): Card {
    const template = DUMMY_CARDS.find(card => card.id === cardId && (!expectedType || card.type === expectedType));
    if (!template) {
        const withType = expectedType ? ` (${expectedType})` : '';
        throw new Error(`Card template not found: ${cardId}${withType}`);
    }
    return template;
}

function validateFixedDeckDefinition(definition: FixedDeckDefinition): void {
    const totalCards = definition.cards.reduce((sum, entry) => sum + entry.copies, 0);
    if (totalCards !== DEFAULT_DECK_SIZE) {
        throw new Error(`Fixed deck ${definition.id} has invalid size ${totalCards}; expected ${DEFAULT_DECK_SIZE}.`);
    }

    const seen = new Set<string>();
    for (const entry of definition.cards) {
        if (!Number.isInteger(entry.copies) || entry.copies <= 0) {
            throw new Error(`Fixed deck ${definition.id} has invalid copies for ${entry.cardId}: ${entry.copies}`);
        }
        if (entry.copies > DEFAULT_MAX_COPIES_PER_IDENTIFIER) {
            throw new Error(
                `Fixed deck ${definition.id} exceeds max copies for ${entry.cardId}: ${entry.copies} > ${DEFAULT_MAX_COPIES_PER_IDENTIFIER}`,
            );
        }
        if (seen.has(entry.cardId)) {
            throw new Error(`Fixed deck ${definition.id} contains duplicate entry for ${entry.cardId}`);
        }
        seen.add(entry.cardId);
    }
}

function buildDeckFromDefinition(definition: FixedDeckDefinition): Card[] {
    validateFixedDeckDefinition(definition);
    const deck: Card[] = [];
    for (const entry of definition.cards) {
        const template = findCardTemplate(entry.cardId);
        if (template.type === CardType.LEADER) {
            throw new Error(`Fixed deck ${definition.id} references leader card in deck body: ${entry.cardId}`);
        }
        for (let i = 0; i < entry.copies; i++) {
            deck.push(cloneCard(template));
        }
    }
    return deck;
}

function summarizeDeckEntries(deck: Card[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const card of deck) {
        const identifier = extractCardIdentifier(card.id);
        counts.set(identifier, (counts.get(identifier) ?? 0) + 1);
    }
    return counts;
}

export function listFixedDecks(): FixedDeckDefinition[] {
    return FIXED_DECKS.map(deck => ({
        ...deck,
        cards: deck.cards.map(entry => ({ ...entry })),
        notes: deck.notes ? [...deck.notes] : undefined,
    }));
}

export function listFixedMatchups(): FixedMatchupDefinition[] {
    return FIXED_MATCHUPS.map(matchup => ({ ...matchup }));
}

export function getFixedDeckDefinition(deckId: string): FixedDeckDefinition {
    const definition = FIXED_DECKS.find(deck => deck.id === deckId);
    if (!definition) {
        throw new Error(`Unknown fixed deck id: ${deckId}`);
    }
    return {
        ...definition,
        cards: definition.cards.map(entry => ({ ...entry })),
        notes: definition.notes ? [...definition.notes] : undefined,
    };
}

export function getFixedMatchupDefinition(matchupId: string): FixedMatchupDefinition {
    const definition = FIXED_MATCHUPS.find(matchup => matchup.id === matchupId);
    if (!definition) {
        throw new Error(`Unknown fixed matchup id: ${matchupId}`);
    }
    return { ...definition };
}

export function resolveFixedDeck(deckId: string): ResolvedFixedDeck {
    const definition = getFixedDeckDefinition(deckId);
    const leader = cloneCard(findCardTemplate(definition.leaderId, CardType.LEADER));
    const deck = buildDeckFromDefinition(definition);
    const validation = validateDeckAgainstLeader(deck, leader);
    if (!validation.valid) {
        throw new Error(`Fixed deck ${deckId} is illegal: ${validation.errors.join(' | ')}`);
    }

    const countedCards = summarizeDeckEntries(deck);
    for (const entry of definition.cards) {
        if ((countedCards.get(entry.cardId) ?? 0) !== entry.copies) {
            throw new Error(`Fixed deck ${deckId} failed materialization consistency for ${entry.cardId}`);
        }
    }

    return {
        definition,
        leader,
        deck,
    };
}

export function resolveFixedMatchup(matchupId: string): ResolvedFixedMatchup {
    const definition = getFixedMatchupDefinition(matchupId);
    return {
        definition,
        player1: resolveFixedDeck(definition.player1DeckId),
        player2: resolveFixedDeck(definition.player2DeckId),
    };
}
