import { describe, expect, it } from 'vitest';
import { DUMMY_CARDS } from '../../src/logic/CardDatabase';
import { Card } from '../../src/logic/types';
import {
    buildDeterministicDeckForLeader,
    getImplementedLeaderPool,
    pickDeterministicLeader,
    resolveLeaderDeckConstraint,
    validateDeckAgainstLeader,
} from '../../scripts/ai/deck_pool';

function buildDeck(entries: Array<[string, number]>): Card[] {
    const deck: Card[] = [];
    for (const [cardId, copies] of entries) {
        const template = DUMMY_CARDS.find(card => card.id === cardId);
        expect(template, `Missing card template: ${cardId}`).toBeTruthy();
        if (!template) continue;
        for (let i = 0; i < copies; i++) {
            deck.push({ ...template });
        }
    }
    return deck;
}

describe('Leader Deck Constraint', () => {
    it('builds legal oath-compliant deck for every implemented leader', () => {
        const leaders = getImplementedLeaderPool();
        expect(leaders.length).toBeGreaterThan(0);

        leaders.forEach((leader, index) => {
            const deck = buildDeterministicDeckForLeader(2026021090 + index, `ALL${index}`, leader);
            const report = validateDeckAgainstLeader(deck, leader);
            expect(report.valid, `${leader.id}: ${report.errors.join(' | ')}`).toBe(true);
        });
    });

    it('builds legal 40-card deck that satisfies leader oath constraints', () => {
        const leader = pickDeterministicLeader(2026021001, 1);
        const deck = buildDeterministicDeckForLeader(2026021001, 'P1', leader);
        const report = validateDeckAgainstLeader(deck, leader);

        expect(deck).toHaveLength(40);
        expect(report.valid).toBe(true);
        expect(report.copyViolations).toHaveLength(0);
        expect(report.triggerCount).toBeLessThanOrEqual(8);
        expect(report.oathViolations).toHaveLength(0);
    });

    it('respects BT01 leader oath: BT01-001 must only include FIRE attribute cards', () => {
        const leader = getImplementedLeaderPool().find(card => card.id === 'BT01-001');
        expect(leader).toBeTruthy();
        if (!leader) return;

        const constraint = resolveLeaderDeckConstraint(leader);
        expect(constraint).not.toBeNull();
        expect(constraint?.attribute).toBe('FIRE');

        const deck = buildDeterministicDeckForLeader(2026021002, 'P1', leader);
        const report = validateDeckAgainstLeader(deck, leader);
        expect(report.valid).toBe(true);
        expect(report.oathViolations).toHaveLength(0);
    });

    it('keeps deterministic output for same leader/seed', () => {
        const leader = pickDeterministicLeader(2026021003, 2);
        const deckA = buildDeterministicDeckForLeader(2026021003, 'P2', leader);
        const deckB = buildDeterministicDeckForLeader(2026021003, 'P2', leader);
        expect(deckA).toEqual(deckB);
    });

    it('supports BT05-032 storm oath with one shared off-attribute and counts only real trigger cards', () => {
        const leader = DUMMY_CARDS.find(card => card.id === 'BT05-032');
        expect(leader).toBeTruthy();
        if (!leader) return;

        const deck = buildDeck([
            ['BT05-065', 3],
            ['BT05-041', 2],
            ['BT05-044', 3],
            ['BT05-033', 3],
            ['BT05-064', 3],
            ['ST09-011', 3],
            ['BT05-034', 1],
            ['BT05-066', 2],
            ['BT05-036', 3],
            ['BT05-072', 3],
            ['BT05-038', 3],
            ['BT05-039', 2],
            ['BT05-040', 3],
            ['BT05-043', 1],
            ['BT05-046', 2],
            ['BT05-081', 2],
            ['BT05-082', 1],
        ]);

        const report = validateDeckAgainstLeader(deck, leader);
        expect(deck).toHaveLength(40);
        expect(report.valid, report.errors.join(' | ')).toBe(true);
        expect(report.triggerCount).toBe(8);
        expect(report.oathViolations).toHaveLength(0);
    });

    it('rejects BT05-032 deck when non-storm cards span multiple attributes', () => {
        const leader = DUMMY_CARDS.find(card => card.id === 'BT05-032');
        expect(leader).toBeTruthy();
        if (!leader) return;

        const deck = buildDeck([
            ['BT05-065', 3],
            ['BT05-041', 2],
            ['BT05-044', 3],
            ['BT05-033', 3],
            ['BT05-064', 3],
            ['ST09-011', 3],
            ['BT05-034', 1],
            ['BT05-066', 2],
            ['BT05-036', 3],
            ['BT05-072', 3],
            ['BT05-038', 3],
            ['BT05-039', 2],
            ['BT05-040', 3],
            ['BT05-043', 1],
            ['BT05-046', 2],
            ['BT05-081', 1],
            ['BT05-082', 1],
            ['BT01-004', 1],
        ]);

        const report = validateDeckAgainstLeader(deck, leader);
        expect(deck).toHaveLength(40);
        expect(report.valid).toBe(false);
        expect(report.oathViolations.length).toBeGreaterThan(0);
    });
});
