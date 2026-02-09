import { DUMMY_CARDS } from '../CardDatabase';
import { Card, CardType } from '../types';
import { buildDeterministicDeckForLeader, validateDeckAgainstLeader } from '../../../scripts/ai/deck_pool';

export interface QuickPlayLoadout {
    leader1: Card;
    leader2: Card;
    deck1: Card[];
    deck2: Card[];
}

const DEFAULT_QUICK_PLAY_LEADER_ID = 'ST01-001';

function cloneCard(template: Card, id: string): Card {
    return { ...template, id };
}

function resolveQuickPlayLeaderTemplate(leaderId: string): Card {
    const preferred = DUMMY_CARDS.find(card => card.id === leaderId && card.type === CardType.LEADER);
    if (preferred) return preferred;

    const fallbackLeader = DUMMY_CARDS.find(card => card.type === CardType.LEADER);
    if (fallbackLeader) return fallbackLeader;

    if (DUMMY_CARDS.length === 0) {
        throw new Error('Card database is empty. Cannot build quick play loadout.');
    }
    return DUMMY_CARDS[0];
}

export function createQuickPlayLoadout(
    seed: number,
    leaderId: string = DEFAULT_QUICK_PLAY_LEADER_ID,
): QuickPlayLoadout {
    const leaderTemplate = resolveQuickPlayLeaderTemplate(leaderId);
    const leader1 = cloneCard(leaderTemplate, `${leaderTemplate.id}_L_${seed}_1`);
    const leader2 = cloneCard(leaderTemplate, `${leaderTemplate.id}_L_${seed}_2`);

    const deck1 = buildDeterministicDeckForLeader(seed + 101, 'QP1', leader1);
    const deck2 = buildDeterministicDeckForLeader(seed + 202, 'QP2', leader2);

    const deck1Legality = validateDeckAgainstLeader(deck1, leader1);
    if (!deck1Legality.valid) {
        throw new Error(`Quick Play P1 deck is illegal: ${deck1Legality.errors.join(' | ')}`);
    }
    const deck2Legality = validateDeckAgainstLeader(deck2, leader2);
    if (!deck2Legality.valid) {
        throw new Error(`Quick Play P2 deck is illegal: ${deck2Legality.errors.join(' | ')}`);
    }

    return {
        leader1,
        leader2,
        deck1,
        deck2,
    };
}

