import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    buildNikkiCandidateLoopArtifactPaths,
    resolveNikkiCandidateLoopRoundSeeds,
    runBt05NikkiCandidateLoop,
} from '../../scripts/ai/run_bt05_nikki_candidate_loop';
import { FixedMatchupBatchReport, TacticalKpiCounts } from '../../scripts/ai/run_fixed_matchup_batch';

function emptyCounts(): TacticalKpiCounts {
    return {
        upgradeActionCount: 0,
        wastefulUpgradeCount: 0,
        lethalOpportunityCount: 0,
        lethalMissCount: 0,
        selfLethalCheckCount: 0,
        selfLethalOpenCount: 0,
    };
}

function makeCounts(overrides: Partial<TacticalKpiCounts>): TacticalKpiCounts {
    return {
        ...emptyCounts(),
        ...overrides,
    };
}

function makeRoundReport(
    roundIndex: number,
    candidateWins: number,
    incumbentWins: number,
    candidateCounts: TacticalKpiCounts,
    incumbentCounts: TacticalKpiCounts,
): FixedMatchupBatchReport {
    const totalGames = candidateWins + incumbentWins;
    const totalCounts: TacticalKpiCounts = {
        upgradeActionCount: candidateCounts.upgradeActionCount + incumbentCounts.upgradeActionCount,
        wastefulUpgradeCount: candidateCounts.wastefulUpgradeCount + incumbentCounts.wastefulUpgradeCount,
        lethalOpportunityCount: candidateCounts.lethalOpportunityCount + incumbentCounts.lethalOpportunityCount,
        lethalMissCount: candidateCounts.lethalMissCount + incumbentCounts.lethalMissCount,
        selfLethalCheckCount: candidateCounts.selfLethalCheckCount + incumbentCounts.selfLethalCheckCount,
        selfLethalOpenCount: candidateCounts.selfLethalOpenCount + incumbentCounts.selfLethalOpenCount,
    };

    return {
        generatedAt: `2026-03-18T00:00:0${roundIndex}.000Z`,
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
            gamesPerSide: 1,
            maxSteps: 1200,
            enableMulligan: true,
            traceLimit: 8,
            startSeed: 2026032000 + roundIndex,
            player1BotId: 'practice-bt05-nikki-candidate-v1',
            player2BotId: 'practice-bt05-nikki-strong-v1',
            measureRuntime: false,
            suppressLogs: true,
            seedList: [2026032000 + roundIndex],
        },
        sides: {
            primary: {
                config: {
                    startSeed: 2026032000 + roundIndex,
                    games: 1,
                    maxSteps: 1200,
                    enableMulligan: true,
                    traceLimit: 8,
                    player1BotId: 'practice-bt05-nikki-candidate-v1',
                    player2BotId: 'practice-bt05-nikki-strong-v1',
                    measureRuntime: false,
                    suppressLogs: true,
                    seedList: [2026032000 + roundIndex],
                },
                matches: [
                    { steps: 10, turnCount: 6, reason: 'winner', winnerPlayer: 1 },
                ] as never,
                summary: {
                    totalGames: 1,
                    wins: { player1: candidateWins, player2: incumbentWins },
                    winRate: { player1: candidateWins, player2: incumbentWins },
                    unfinished: 0,
                    avgSteps: 10,
                    avgTurns: 6,
                    terminationCounts: { winner: 1, max_steps: 0, no_action: 0, invalid_action: 0 },
                    confidence: {
                        player1WinRate: { pointEstimate: candidateWins, standardError: 0, ci95Low: candidateWins, ci95High: candidateWins },
                        player2WinRate: { pointEstimate: incumbentWins, standardError: 0, ci95Low: incumbentWins, ci95High: incumbentWins },
                    },
                    runtime: {
                        enabled: false,
                        totalMs: 0,
                        avgMsPerGame: 0,
                        msPerAction: 0,
                    },
                    tacticalKPIs: {
                        wasteful_upgrade_rate: totalCounts.upgradeActionCount === 0 ? 0 : totalCounts.wastefulUpgradeCount / totalCounts.upgradeActionCount,
                        lethal_miss_rate: totalCounts.lethalOpportunityCount === 0 ? 0 : totalCounts.lethalMissCount / totalCounts.lethalOpportunityCount,
                        self_lethal_open_rate: totalCounts.selfLethalCheckCount === 0 ? 0 : totalCounts.selfLethalOpenCount / totalCounts.selfLethalCheckCount,
                        counts: totalCounts,
                        byPlayer: {
                            player1: candidateCounts,
                            player2: incumbentCounts,
                        },
                    },
                },
            },
            swapped: {
                config: {
                    startSeed: 2026032000 + roundIndex,
                    games: 1,
                    maxSteps: 1200,
                    enableMulligan: true,
                    traceLimit: 8,
                    player1BotId: 'practice-bt05-nikki-strong-v1',
                    player2BotId: 'practice-bt05-nikki-candidate-v1',
                    measureRuntime: false,
                    suppressLogs: true,
                    seedList: [2026032000 + roundIndex],
                },
                matches: [
                    { steps: 11, turnCount: 7, reason: 'winner', winnerPlayer: 2 },
                ] as never,
                summary: {
                    totalGames: 1,
                    wins: { player1: incumbentWins, player2: candidateWins },
                    winRate: { player1: incumbentWins, player2: candidateWins },
                    unfinished: 0,
                    avgSteps: 11,
                    avgTurns: 7,
                    terminationCounts: { winner: 1, max_steps: 0, no_action: 0, invalid_action: 0 },
                    confidence: {
                        player1WinRate: { pointEstimate: incumbentWins, standardError: 0, ci95Low: incumbentWins, ci95High: incumbentWins },
                        player2WinRate: { pointEstimate: candidateWins, standardError: 0, ci95Low: candidateWins, ci95High: candidateWins },
                    },
                    runtime: {
                        enabled: false,
                        totalMs: 0,
                        avgMsPerGame: 0,
                        msPerAction: 0,
                    },
                    tacticalKPIs: {
                        wasteful_upgrade_rate: totalCounts.upgradeActionCount === 0 ? 0 : totalCounts.wastefulUpgradeCount / totalCounts.upgradeActionCount,
                        lethal_miss_rate: totalCounts.lethalOpportunityCount === 0 ? 0 : totalCounts.lethalMissCount / totalCounts.lethalOpportunityCount,
                        self_lethal_open_rate: totalCounts.selfLethalCheckCount === 0 ? 0 : totalCounts.selfLethalOpenCount / totalCounts.selfLethalCheckCount,
                        counts: totalCounts,
                        byPlayer: {
                            player1: incumbentCounts,
                            player2: candidateCounts,
                        },
                    },
                },
            },
        },
        combined: {
            totalGames,
            wins: {
                player1Bot: candidateWins,
                player2Bot: incumbentWins,
            },
            winRate: {
                player1Bot: candidateWins / totalGames,
                player2Bot: incumbentWins / totalGames,
            },
            unfinished: 0,
            avgSteps: 10.5,
            avgTurns: 6.5,
            terminationCounts: { winner: 2, max_steps: 0, no_action: 0, invalid_action: 0 },
            confidence: {
                player1BotWinRate: { pointEstimate: candidateWins / totalGames, standardError: 0, ci95Low: 0, ci95High: 1 },
                player2BotWinRate: { pointEstimate: incumbentWins / totalGames, standardError: 0, ci95Low: 0, ci95High: 1 },
            },
            runtime: {
                enabled: false,
                totalMs: 0,
                avgMsPerGame: 0,
                msPerAction: 0,
            },
            tacticalKPIs: {
                wasteful_upgrade_rate: totalCounts.upgradeActionCount === 0 ? 0 : totalCounts.wastefulUpgradeCount / totalCounts.upgradeActionCount,
                lethal_miss_rate: totalCounts.lethalOpportunityCount === 0 ? 0 : totalCounts.lethalMissCount / totalCounts.lethalOpportunityCount,
                self_lethal_open_rate: totalCounts.selfLethalCheckCount === 0 ? 0 : totalCounts.selfLethalOpenCount / totalCounts.selfLethalCheckCount,
                counts: totalCounts,
                byPlayer: {
                    player1: candidateCounts,
                    player2: incumbentCounts,
                },
            },
        },
    } as FixedMatchupBatchReport;
}

describe('BT05 Nikki candidate loop', () => {
    it('resolves round seed windows deterministically from an explicit seed list', () => {
        const config = {
            matchupId: 'fm-c-bt05-unlucky-bunny-nikki-mirror',
            incumbentBotId: 'practice-bt05-nikki-strong-v1',
            candidateBotId: 'practice-bt05-nikki-candidate-v1',
            rounds: 3,
            gamesPerSide: 2,
            maxSteps: 1200,
            enableMulligan: true,
            startSeed: 2026032000,
            seedStride: 10,
            measureRuntime: false,
            suppressLogs: true,
            seedList: [11, 12],
        } satisfies Parameters<typeof runBt05NikkiCandidateLoop>[0];

        expect(resolveNikkiCandidateLoopRoundSeeds(config, 0)).toEqual([11, 12]);
        expect(resolveNikkiCandidateLoopRoundSeeds(config, 1)).toEqual([21, 22]);
        expect(resolveNikkiCandidateLoopRoundSeeds(config, 2)).toEqual([31, 32]);
    });

    it('writes loop artifacts and aggregates incumbent-vs-candidate KPIs across rounds', () => {
        const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nivel-nikki-loop-'));
        const outputPath = path.join(outputDir, 'latest.json');
        const config = {
            matchupId: 'fm-c-bt05-unlucky-bunny-nikki-mirror',
            incumbentBotId: 'practice-bt05-nikki-strong-v1',
            candidateBotId: 'practice-bt05-nikki-candidate-v1',
            rounds: 2,
            gamesPerSide: 1,
            maxSteps: 1200,
            enableMulligan: true,
            startSeed: 2026032000,
            seedStride: 1,
            measureRuntime: false,
            suppressLogs: true,
            outputPath,
        } satisfies Parameters<typeof runBt05NikkiCandidateLoop>[0];

        const roundReports = [
            makeRoundReport(
                0,
                1,
                1,
                makeCounts({ upgradeActionCount: 10, wastefulUpgradeCount: 2, lethalOpportunityCount: 4, lethalMissCount: 1, selfLethalCheckCount: 8, selfLethalOpenCount: 1 }),
                makeCounts({ upgradeActionCount: 8, wastefulUpgradeCount: 3, lethalOpportunityCount: 4, lethalMissCount: 2, selfLethalCheckCount: 8, selfLethalOpenCount: 1 }),
            ),
            makeRoundReport(
                1,
                2,
                0,
                makeCounts({ upgradeActionCount: 12, wastefulUpgradeCount: 3, lethalOpportunityCount: 6, lethalMissCount: 1, selfLethalCheckCount: 10, selfLethalOpenCount: 0 }),
                makeCounts({ upgradeActionCount: 11, wastefulUpgradeCount: 4, lethalOpportunityCount: 6, lethalMissCount: 2, selfLethalCheckCount: 10, selfLethalOpenCount: 1 }),
            ),
        ];
        const runRound = (_config: Parameters<typeof runBt05NikkiCandidateLoop>[0], seedList: number[]) => {
            const seed = seedList[0] ?? 0;
            if (seed === 2026032000) return roundReports[0];
            if (seed === 2026032001) return roundReports[1];
            throw new Error(`Unexpected seed ${seed}`);
        };

        const report = runBt05NikkiCandidateLoop(config, { runRound });

        const artifactPaths = buildNikkiCandidateLoopArtifactPaths(outputPath, config);
        expect(fs.existsSync(artifactPaths.latestPath)).toBe(true);
        expect(fs.existsSync(artifactPaths.archivePath)).toBe(true);
        expect(fs.existsSync(report.rounds[0].artifactPath)).toBe(true);
        expect(fs.existsSync(report.rounds[1].artifactPath)).toBe(true);
        expect(report.summary.rounds).toBe(2);
        expect(report.summary.totalGames).toBe(4);
        expect(report.summary.candidate.wins).toBe(3);
        expect(report.summary.incumbent.wins).toBe(1);
        expect(report.summary.candidate.winRate).toBe(0.75);
        expect(report.summary.delta.winRate).toBe(0.5);
        expect(report.summary.candidate.tacticalKPIs.wasteful_upgrade_rate).toBeCloseTo(0.2273, 4);
        expect(report.summary.incumbent.tacticalKPIs.wasteful_upgrade_rate).toBeCloseTo(0.3684, 4);
        expect(report.summary.delta.wasteful_upgrade_rate).toBeCloseTo(-0.1411, 4);
        expect(report.summary.diagnostics.bucketRoundSize).toBe(1);
        expect(report.summary.diagnostics.roundSlices).toHaveLength(2);
        expect(report.summary.diagnostics.bucketSlices).toHaveLength(2);
        expect(report.rounds.map(round => round.seedList)).toEqual([
            [2026032000],
            [2026032001],
        ]);
    });

    it('adds compact round-bucket diagnostics that highlight improving seed pockets', () => {
        const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nivel-nikki-loop-diagnostics-'));
        const outputPath = path.join(outputDir, 'latest.json');
        const config = {
            matchupId: 'fm-c-bt05-unlucky-bunny-nikki-mirror',
            incumbentBotId: 'practice-bt05-nikki-strong-v1',
            candidateBotId: 'practice-bt05-nikki-candidate-v1',
            rounds: 8,
            gamesPerSide: 1,
            maxSteps: 1200,
            enableMulligan: true,
            startSeed: 2026032000,
            seedStride: 1,
            measureRuntime: false,
            suppressLogs: true,
            outputPath,
        } satisfies Parameters<typeof runBt05NikkiCandidateLoop>[0];

        const roundSpecs = [
            { candidateWins: 0, incumbentWins: 2 },
            { candidateWins: 0, incumbentWins: 2 },
            { candidateWins: 1, incumbentWins: 1 },
            { candidateWins: 1, incumbentWins: 1 },
            { candidateWins: 2, incumbentWins: 0 },
            { candidateWins: 2, incumbentWins: 0 },
            { candidateWins: 1, incumbentWins: 1 },
            { candidateWins: 0, incumbentWins: 2 },
        ];
        const roundReports = roundSpecs.map((spec, roundIndex) => makeRoundReport(
            roundIndex,
            spec.candidateWins,
            spec.incumbentWins,
            makeCounts({ upgradeActionCount: 10 + roundIndex, wastefulUpgradeCount: 2, lethalOpportunityCount: 4, lethalMissCount: 1, selfLethalCheckCount: 8, selfLethalOpenCount: 1 }),
            makeCounts({ upgradeActionCount: 9 + roundIndex, wastefulUpgradeCount: 3, lethalOpportunityCount: 4, lethalMissCount: 2, selfLethalCheckCount: 8, selfLethalOpenCount: 1 }),
        ));
        const runRound = (_config: Parameters<typeof runBt05NikkiCandidateLoop>[0], seedList: number[]) => {
            const seed = seedList[0] ?? 0;
            const roundIndex = seed - 2026032000;
            const roundReport = roundReports[roundIndex];
            if (!roundReport) {
                throw new Error(`Unexpected seed ${seed}`);
            }
            return roundReport;
        };

        const report = runBt05NikkiCandidateLoop(config, { runRound });

        expect(report.summary.diagnostics.bucketRoundSize).toBe(2);
        expect(report.summary.diagnostics.roundSlices).toHaveLength(8);
        expect(report.summary.diagnostics.bucketSlices).toHaveLength(4);
        expect(report.summary.diagnostics.bucketSlices.map(slice => slice.label)).toEqual([
            'rounds 1-2',
            'rounds 3-4',
            'rounds 5-6',
            'rounds 7-8',
        ]);
        expect(report.summary.diagnostics.bucketSlices[2]).toMatchObject({
            roundStartIndex: 4,
            roundEndIndex: 5,
            roundCount: 2,
            candidateWins: 4,
            incumbentWins: 0,
            netWins: 4,
            winRateDelta: 1,
        });
        expect(report.summary.diagnostics.bucketSlices[2].seedLabel).toBe('seed-2026032004-to-2026032005');
        expect(report.summary.diagnostics.bucketSlices[0].winRateDelta).toBe(-1);
    });
});
