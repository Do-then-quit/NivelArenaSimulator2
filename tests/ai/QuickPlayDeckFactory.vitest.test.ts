import { describe, expect, it } from 'vitest';
import { createQuickPlayLoadout } from '../../src/logic/ai/QuickPlayDeckFactory';
import { validateDeckAgainstLeader } from '../../scripts/ai/deck_pool';

describe('QuickPlayDeckFactory', () => {
    it('builds legal quick-play decks for ST01 leader by default', () => {
        const loadout = createQuickPlayLoadout(2026021101);

        expect(loadout.leader1.id.startsWith('ST01-001')).toBe(true);
        expect(loadout.leader2.id.startsWith('ST01-001')).toBe(true);
        expect(loadout.deck1).toHaveLength(40);
        expect(loadout.deck2).toHaveLength(40);

        const p1Report = validateDeckAgainstLeader(loadout.deck1, loadout.leader1);
        const p2Report = validateDeckAgainstLeader(loadout.deck2, loadout.leader2);
        expect(p1Report.valid).toBe(true);
        expect(p2Report.valid).toBe(true);
    });

    it('is deterministic for the same seed', () => {
        const first = createQuickPlayLoadout(2026021102);
        const second = createQuickPlayLoadout(2026021102);
        expect(first).toEqual(second);
    });
});

