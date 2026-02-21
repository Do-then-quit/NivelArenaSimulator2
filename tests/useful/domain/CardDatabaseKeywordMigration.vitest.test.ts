import { describe, expect, it } from 'vitest';
import { DUMMY_CARDS } from '../../../src/logic/CardDatabase';

function getCard(cardId: string) {
    const card = DUMMY_CARDS.find(c => c.id === cardId);
    expect(card, `${cardId} should exist in DUMMY_CARDS`).toBeDefined();
    return card!;
}

describe('CardDatabase keyword migration', () => {
    it('loads newly added packs', () => {
        expect(DUMMY_CARDS.some(card => card.id.startsWith('ST10-'))).toBe(true);
        expect(DUMMY_CARDS.some(card => card.id.startsWith('ST11-'))).toBe(true);
        expect(DUMMY_CARDS.some(card => card.id.startsWith('BT06-'))).toBe(true);
    });

    it('uses keyword list/header keywords and avoids body mention pollution', () => {
        const bt06056 = getCard('BT06-056');
        expect(bt06056.keywords).toContain('디펜더');

        const bt06046 = getCard('BT06-046');
        expect(bt06046.keywords).toContain('액티브');
        expect(bt06046.keywords).not.toContain('디펜더');

        const bt06077 = getCard('BT06-077');
        expect(bt06077.keywords).not.toContain('디펜더');
        expect(bt06077.keywords).not.toContain('어태커');

        const st11007 = getCard('ST11-007');
        expect(st11007.keywords).toContain('패시브');
        expect(st11007.keywords).not.toContain('디펜더');
    });

    it('adds trigger keyword when present in effect segment headers', () => {
        const bt02011 = getCard('BT02-011');
        expect(bt02011.keywords).toContain('트리거');
    });
});

