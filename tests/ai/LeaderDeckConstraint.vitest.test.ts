import { describe, expect, it } from 'vitest';
import {
    buildDeterministicDeckForLeader,
    getImplementedLeaderPool,
    pickDeterministicLeader,
    resolveLeaderDeckConstraint,
    validateDeckAgainstLeader,
} from '../../scripts/ai/deck_pool';

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
});
