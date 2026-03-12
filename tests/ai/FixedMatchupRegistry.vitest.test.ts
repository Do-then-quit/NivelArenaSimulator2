import { describe, expect, it } from 'vitest';
import { DEFAULT_DECK_SIZE, validateDeckAgainstLeader } from '../../scripts/ai/deck_pool';
import {
    getFixedDeckDefinition,
    listFixedDecks,
    listFixedMatchups,
    resolveFixedDeck,
    resolveFixedMatchup,
} from '../../scripts/ai/fixed_matchup/registry';

describe('Fixed matchup deck registry', () => {
    it('exposes at least two fixed decks and one cross matchup', () => {
        const decks = listFixedDecks();
        const matchups = listFixedMatchups();

        expect(decks.length).toBeGreaterThanOrEqual(2);
        expect(matchups.find(matchup => matchup.id === 'fm-b-fire-vs-storm')).toBeTruthy();
    });

    it('materializes legal static decks with exact size', () => {
        for (const deckDefinition of listFixedDecks()) {
            const resolved = resolveFixedDeck(deckDefinition.id);
            expect(resolved.deck).toHaveLength(DEFAULT_DECK_SIZE);
            expect(resolved.leader.id).toBe(deckDefinition.leaderId);

            const legality = validateDeckAgainstLeader(resolved.deck, resolved.leader);
            expect(legality.valid).toBe(true);
        }
    });

    it('preserves declared per-card copy counts', () => {
        const definition = getFixedDeckDefinition('fire-redhood-prototype-v1');
        const resolved = resolveFixedDeck(definition.id);

        for (const entry of definition.cards) {
            expect(resolved.deck.filter(card => card.id === entry.cardId)).toHaveLength(entry.copies);
        }
    });

    it('exposes the curated BT05 meta deck and its mirror matchup', () => {
        const definition = getFixedDeckDefinition('bt05-unlucky-bunny-nikki-meta-v1');
        const resolved = resolveFixedDeck(definition.id);
        expect(resolved.leader.id).toBe('BT05-032');
        expect(resolved.deck.filter(card => card.id === 'BT05-065')).toHaveLength(3);
        expect(resolved.deck.filter(card => card.id === 'BT05-072')).toHaveLength(3);

        const mirror = resolveFixedMatchup('fm-c-bt05-unlucky-bunny-nikki-mirror');
        expect(mirror.player1.definition.id).toBe('bt05-unlucky-bunny-nikki-meta-v1');
        expect(mirror.player2.definition.id).toBe('bt05-unlucky-bunny-nikki-meta-v1');

        const cross = resolveFixedMatchup('fm-d-bt05-vs-fire-redhood');
        expect(cross.player1.definition.id).toBe('bt05-unlucky-bunny-nikki-meta-v1');
        expect(cross.player2.definition.id).toBe('fire-redhood-prototype-v1');
    });

    it('resolves matchup decks and mirror matchups correctly', () => {
        const mirror = resolveFixedMatchup('fm-a-fire-redhood-mirror');
        expect(mirror.player1.definition.id).toBe('fire-redhood-prototype-v1');
        expect(mirror.player2.definition.id).toBe('fire-redhood-prototype-v1');

        const cross = resolveFixedMatchup('fm-b-fire-vs-storm');
        expect(cross.player1.definition.id).toBe('fire-redhood-prototype-v1');
        expect(cross.player2.definition.id).toBe('storm-modernia-prototype-v1');
    });
});
