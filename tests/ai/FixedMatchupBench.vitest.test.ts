import { describe, expect, it } from 'vitest';
import { runFixedMatchupBatch } from '../../scripts/ai/run_fixed_matchup_batch';

describe('Fixed matchup bench', () => {
    it('runs deterministic side-swapped reports for a fixed matchup', () => {
        const config = {
            matchupId: 'fm-b-fire-vs-storm',
            gamesPerSide: 2,
            maxSteps: 1200,
            enableMulligan: true,
            traceLimit: 12,
            startSeed: 2026032000,
            player1BotId: 'baseline-a',
            player2BotId: 'baseline-b',
            measureRuntime: false,
            suppressLogs: false,
        } as const;

        const reportA = runFixedMatchupBatch(config);
        const reportB = runFixedMatchupBatch(config);

        expect({ ...reportA, generatedAt: 'IGNORED' }).toEqual({ ...reportB, generatedAt: 'IGNORED' });
        expect(reportA.matchup.id).toBe('fm-b-fire-vs-storm');
        expect(reportA.config.seedList).toEqual([2026032000, 2026032001]);
        expect(reportA.sides.primary.summary.totalGames).toBe(2);
        expect(reportA.sides.swapped.summary.totalGames).toBe(2);
        expect(reportA.combined.totalGames).toBe(4);
        expect(
            reportA.combined.wins.player1Bot
            + reportA.combined.wins.player2Bot
            + reportA.combined.unfinished,
        ).toBe(4);
        expect(reportA.combined.confidence.player1BotWinRate.ci95Low).toBeGreaterThanOrEqual(0);
        expect(reportA.combined.confidence.player1BotWinRate.ci95High).toBeLessThanOrEqual(1);
        expect(reportA.combined.runtime.enabled).toBe(false);
        expect(reportA.combined.tacticalKPIs.wasteful_upgrade_rate).toBeGreaterThanOrEqual(0);
        expect(reportA.combined.tacticalKPIs.wasteful_upgrade_rate).toBeLessThanOrEqual(1);
    }, 15000);

    it('can source seeds from a named suite while truncating to gamesPerSide', () => {
        const report = runFixedMatchupBatch({
            matchupId: 'fm-a-fire-redhood-mirror',
            gamesPerSide: 3,
            maxSteps: 1000,
            enableMulligan: true,
            traceLimit: 10,
            startSeed: 1,
            player1BotId: 'baseline-a',
            player2BotId: 'baseline-b',
            measureRuntime: false,
            suppressLogs: false,
            seedSuiteName: 'dev',
            seedSuitePath: 'artifacts/ai/seeds/phase3_v1.json',
        });

        expect(report.config.seedList).toEqual([2026032000, 2026032001, 2026032002]);
        expect(report.sides.primary.matches.map(match => match.seed)).toEqual([2026032000, 2026032001, 2026032002]);
        expect(report.sides.swapped.matches.map(match => match.seed)).toEqual([2026032000, 2026032001, 2026032002]);
    }, 15000);

    it('runs the curated BT05 meta mirror without early-turn deadlock regressions', () => {
        const report = runFixedMatchupBatch({
            matchupId: 'fm-c-bt05-unlucky-bunny-nikki-mirror',
            gamesPerSide: 2,
            maxSteps: 1200,
            enableMulligan: true,
            traceLimit: 8,
            startSeed: 2026032010,
            player1BotId: 'baseline-a',
            player2BotId: 'baseline-b',
            measureRuntime: false,
            suppressLogs: false,
        });

        expect(report.matchup.id).toBe('fm-c-bt05-unlucky-bunny-nikki-mirror');
        expect(report.combined.totalGames).toBe(4);
        expect(report.combined.unfinished).toBe(0);
        expect(report.combined.terminationCounts.max_steps).toBe(0);
        expect(report.combined.terminationCounts.no_action).toBe(0);
        expect(report.combined.terminationCounts.invalid_action).toBe(0);
        expect(report.combined.avgTurns).toBeGreaterThan(1);
    }, 15000);

    it('runs the BT05 opening practice profile in the curated mirror without stability regressions', () => {
        const report = runFixedMatchupBatch({
            matchupId: 'fm-c-bt05-unlucky-bunny-nikki-mirror',
            gamesPerSide: 1,
            maxSteps: 1200,
            enableMulligan: true,
            traceLimit: 8,
            startSeed: 2026032014,
            player1BotId: 'practice-bt05-nikki-open-v1',
            player2BotId: 'practice-bt05-nikki-open-v1',
            measureRuntime: false,
            suppressLogs: false,
        });

        expect(report.combined.totalGames).toBe(2);
        expect(report.combined.unfinished).toBe(0);
        expect(report.combined.terminationCounts.max_steps).toBe(0);
        expect(report.combined.terminationCounts.no_action).toBe(0);
        expect(report.combined.terminationCounts.invalid_action).toBe(0);
    }, 15000);

    it('runs the BT05 strong practice profile in the curated mirror without stability regressions', () => {
        const report = runFixedMatchupBatch({
            matchupId: 'fm-c-bt05-unlucky-bunny-nikki-mirror',
            gamesPerSide: 1,
            maxSteps: 1200,
            enableMulligan: true,
            traceLimit: 8,
            startSeed: 2026032016,
            player1BotId: 'practice-bt05-nikki-strong-v1',
            player2BotId: 'practice-bt05-nikki-strong-v1',
            measureRuntime: false,
            suppressLogs: false,
        });

        expect(report.combined.totalGames).toBe(2);
        expect(report.combined.unfinished).toBe(0);
        expect(report.combined.terminationCounts.max_steps).toBe(0);
        expect(report.combined.terminationCounts.no_action).toBe(0);
        expect(report.combined.terminationCounts.invalid_action).toBe(0);
    }, 15000);
});
