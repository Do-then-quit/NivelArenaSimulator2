import { describe, expect, it } from 'vitest';
import {
    IMPLEMENTED_PACK_PREFIXES,
    buildDeterministicDeck,
    getImplementedCardPool,
    getImplementedDeckPool,
    getImplementedLeaderPool,
    pickDeterministicLeader,
} from '../../scripts/ai/deck_pool';
import { runMatchBatch } from '../../scripts/ai/run_match_batch';
import { runEloLadder } from '../../scripts/ai/elo_ladder';

describe('AI Phase0 Harness', () => {
    it('filters implemented card pool by ST01/ST02/ST03/BT01 prefixes', () => {
        const cards = getImplementedCardPool();
        expect(cards.length).toBeGreaterThan(0);
        expect(cards.every(card => IMPLEMENTED_PACK_PREFIXES.some(prefix => card.id.startsWith(prefix)))).toBe(true);

        const leaders = getImplementedLeaderPool();
        const deckPool = getImplementedDeckPool();
        expect(leaders.length).toBeGreaterThan(0);
        expect(deckPool.length).toBeGreaterThan(0);
    });

    it('builds deterministic leaders and decks for fixed seed', () => {
        const leaderA = pickDeterministicLeader(1001, 1);
        const leaderB = pickDeterministicLeader(1001, 1);
        expect(leaderA).toEqual(leaderB);

        const deckA = buildDeterministicDeck(1001, 'P1');
        const deckB = buildDeterministicDeck(1001, 'P1');
        expect(deckA).toEqual(deckB);
        expect(deckA).toHaveLength(40);
    });

    it('produces deterministic match batch report for same config', () => {
        const config = {
            startSeed: 2026020900,
            games: 4,
            maxSteps: 1600,
            enableMulligan: true,
        };
        const reportA = runMatchBatch(config);
        const reportB = runMatchBatch(config);

        expect(reportA).toEqual(reportB);
        expect(reportA.summary.totalGames).toBe(config.games);
        expect(reportA.matches).toHaveLength(config.games);
        expect(reportA.summary.wins.player1 + reportA.summary.wins.player2 + reportA.summary.unfinished).toBe(config.games);
        expect(reportA.summary.confidence.player1WinRate.ci95Low).toBeGreaterThanOrEqual(0);
        expect(reportA.summary.confidence.player1WinRate.ci95High).toBeLessThanOrEqual(1);
        expect(reportA.summary.confidence.player2WinRate.ci95Low).toBeGreaterThanOrEqual(0);
        expect(reportA.summary.confidence.player2WinRate.ci95High).toBeLessThanOrEqual(1);
        expect(reportA.summary.runtime.enabled).toBe(false);
        expect(reportA.summary.runtime.msPerAction).toBe(0);
    });

    it('reports runtime telemetry when enabled', () => {
        const report = runMatchBatch({
            startSeed: 2026020999,
            games: 2,
            maxSteps: 1200,
            enableMulligan: true,
            measureRuntime: true,
        });

        expect(report.summary.runtime.enabled).toBe(true);
        expect(report.summary.runtime.totalMs).toBeGreaterThan(0);
        expect(report.summary.runtime.avgMsPerGame).toBeGreaterThan(0);
        expect(report.summary.runtime.msPerAction).toBeGreaterThan(0);
    });

    it('produces deterministic elo ladder report for same config', () => {
        const config = {
            startSeed: 2026020950,
            seedsPerPair: 2,
            maxSteps: 1600,
            enableMulligan: true,
            entrants: ['baseline-a', 'baseline-b'],
            kFactor: 24,
            initialRating: 1000,
        };

        const reportA = runEloLadder(config);
        const reportB = runEloLadder(config);

        expect(reportA).toEqual(reportB);
        expect(reportA.entrants).toHaveLength(2);
        expect(reportA.matches.length).toBeGreaterThan(0);
    });
});
