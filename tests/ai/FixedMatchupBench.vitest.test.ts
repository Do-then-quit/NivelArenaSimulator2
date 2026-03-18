import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    buildFixedMatchupArtifactPaths,
    runFixedMatchupBatch,
    writeFixedMatchupArtifacts,
} from '../../scripts/ai/run_fixed_matchup_batch';

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

    it('runs a BT05 cross matchup against fire-redhood without stability regressions', () => {
        const report = runFixedMatchupBatch({
            matchupId: 'fm-d-bt05-vs-fire-redhood',
            gamesPerSide: 1,
            maxSteps: 1200,
            enableMulligan: true,
            traceLimit: 8,
            startSeed: 2026032018,
            player1BotId: 'practice-bt05-nikki-strong-v1',
            player2BotId: 'strong-v3',
            measureRuntime: false,
            suppressLogs: false,
        });

        expect(report.matchup.id).toBe('fm-d-bt05-vs-fire-redhood');
        expect(report.combined.totalGames).toBe(2);
        expect(report.combined.unfinished).toBe(0);
        expect(report.combined.terminationCounts.max_steps).toBe(0);
        expect(report.combined.terminationCounts.no_action).toBe(0);
        expect(report.combined.terminationCounts.invalid_action).toBe(0);
    }, 15000);

    it('writes a deterministic archive artifact path alongside the latest report', () => {
        const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nivel-fixed-matchup-'));
        const latestPath = path.join(outputDir, 'latest.json');
        const report = {
            generatedAt: '2026-03-18T00:00:00.000Z',
            matchup: {
                id: 'fm-c-bt05-unlucky-bunny-nikki-mirror',
                label: 'FM-C BT05 Unlucky Bunny Nikki Mirror',
                description: 'Mirror matchup for the curated BT05 Unlucky Bunny Nikki meta deck.',
                player1DeckId: 'bt05-unlucky-bunny-nikki-meta-v1',
                player2DeckId: 'bt05-unlucky-bunny-nikki-meta-v1',
            },
            decks: {
                player1: {
                    id: 'bt05-unlucky-bunny-nikki-meta-v1',
                    label: 'BT05 Unlucky Bunny Nikki Meta v1',
                    leaderId: 'BT05-032',
                },
                player2: {
                    id: 'bt05-unlucky-bunny-nikki-meta-v1',
                    label: 'BT05 Unlucky Bunny Nikki Meta v1',
                    leaderId: 'BT05-032',
                },
            },
            config: {
                matchupId: 'fm-c-bt05-unlucky-bunny-nikki-mirror',
                gamesPerSide: 2,
                maxSteps: 1200,
                enableMulligan: true,
                traceLimit: 8,
                startSeed: 2026032010,
                player1BotId: 'practice-bt05-nikki-strong-v1',
                player2BotId: 'practice-bt05-nikki-strong-v1',
                measureRuntime: false,
                suppressLogs: false,
                seedList: [2026032010, 2026032011],
            },
            sides: {
                primary: { summary: { totalGames: 2 } },
                swapped: { summary: { totalGames: 2 } },
            },
            combined: {
                totalGames: 4,
                wins: {
                    player1Bot: 2,
                    player2Bot: 2,
                },
                winRate: {
                    player1Bot: 0.5,
                    player2Bot: 0.5,
                },
                unfinished: 0,
                avgSteps: 0,
                avgTurns: 0,
                terminationCounts: {
                    winner: 4,
                    max_steps: 0,
                    no_action: 0,
                    invalid_action: 0,
                },
                confidence: {
                    player1BotWinRate: {
                        pointEstimate: 0.5,
                        standardError: 0,
                        ci95Low: 0,
                        ci95High: 1,
                    },
                    player2BotWinRate: {
                        pointEstimate: 0.5,
                        standardError: 0,
                        ci95Low: 0,
                        ci95High: 1,
                    },
                },
                runtime: {
                    enabled: false,
                    totalMs: 0,
                    avgMsPerGame: 0,
                    msPerAction: 0,
                },
                tacticalKPIs: {
                    wasteful_upgrade_rate: 0,
                    lethal_miss_rate: 0,
                    self_lethal_open_rate: 0,
                    counts: {
                        upgradeActionCount: 0,
                        wastefulUpgradeCount: 0,
                        lethalOpportunityCount: 0,
                        lethalMissCount: 0,
                        selfLethalCheckCount: 0,
                        selfLethalOpenCount: 0,
                    },
                },
            },
        } as const;

        const artifactPaths = buildFixedMatchupArtifactPaths(latestPath, report);
        writeFixedMatchupArtifacts(latestPath, report as never);

        expect(fs.existsSync(artifactPaths.latestPath)).toBe(true);
        expect(fs.existsSync(artifactPaths.archivePath)).toBe(true);
        expect(fs.readFileSync(artifactPaths.latestPath, 'utf8')).toBe(fs.readFileSync(artifactPaths.archivePath, 'utf8'));
        expect(path.basename(artifactPaths.archivePath)).toContain('fm-c-bt05-unlucky-bunny-nikki-mirror');
        expect(path.basename(artifactPaths.archivePath)).toContain('practice-bt05-nikki-strong-v1');
        expect(path.basename(artifactPaths.archivePath)).toContain('seed-2026032010-to-2026032011');
    });
});
