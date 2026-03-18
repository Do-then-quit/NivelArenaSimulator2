import { describe, expect, it } from 'vitest';
import {
    Bt05NikkiMainPhaseHoldPolicyTrainingReport,
} from '../../scripts/ai/train_bt05_nikki_main_phase_hold_policy';
import {
    Bt05NikkiSelfPlayExportReport,
} from '../../scripts/ai/run_bt05_nikki_selfplay_export';
import {
    Bt05NikkiSelfPlayLearningLoopConfig,
    formatBt05NikkiSelfPlayLearningLoopSummary,
    runBt05NikkiSelfPlayLearningLoop,
} from '../../scripts/ai/run_bt05_nikki_selfplay_learning_loop';

function makeSelfPlaySummary(games: number, transitions: number): Bt05NikkiSelfPlayExportReport {
    return {
        generatedAt: '2026-03-18T00:00:00.000Z',
        matchup: {
            id: 'fm-c-bt05-unlucky-bunny-nikki-mirror',
            label: 'mirror',
            player1DeckId: 'a',
            player2DeckId: 'a',
        },
        decks: {
            player1: { id: 'a', label: 'a', leaderId: 'L1' },
            player2: { id: 'a', label: 'a', leaderId: 'L2' },
        },
        config: {
            matchupId: 'fm-c-bt05-unlucky-bunny-nikki-mirror',
            games,
            maxSteps: 1200,
            enableMulligan: true,
            startSeed: 1,
            player1BotId: 'practice-bt05-nikki-strong-v1',
            player2BotId: 'practice-bt05-nikki-strong-v1',
            explorationRate: 0.02,
            suppressLogs: true,
            includeObservations: false,
            seedList: [1],
        },
        episodes: [],
        summary: {
            totalGames: games,
            totalTransitions: transitions,
            avgSteps: 10,
            avgTurns: 5,
            wins: { player1: Math.floor(games / 2), player2: games - Math.floor(games / 2) },
            winRate: { player1: 0.5, player2: 0.5 },
            terminationCounts: { winner: games, max_steps: 0, no_action: 0, invalid_action: 0 },
            decisionSourceCounts: { bot: transitions, exploreRandom: 0 },
        },
    };
}

function makeTrainingReport(retainedEntryCount: number): Bt05NikkiMainPhaseHoldPolicyTrainingReport {
    return {
        generatedAt: '2026-03-18T00:00:00.000Z',
        config: {
            inputPaths: [],
            outputPath: undefined,
            minSamples: 1,
            minHoldRate: 1,
            minAverageReturnToGo: 0,
            policyId: 'policy',
            label: 'policy',
        },
        inputs: [],
        policy: {
            id: 'policy',
            label: 'policy',
            minSamples: 1,
            minHoldRate: 1,
            minAverageReturnToGo: 0,
            entries: {},
        },
        summary: {
            episodeCount: 1,
            transitionCount: 10,
            eligibleTransitionCount: 2,
            signatureCount: 1,
            retainedEntryCount,
            avgHoldRate: 1,
        },
    };
}

describe('BT05 Nikki self-play learning loop', () => {
    it('promotes improved learned policies and stops when the target gap is reached', () => {
        const config: Bt05NikkiSelfPlayLearningLoopConfig = {
            matchupId: 'fm-c-bt05-unlucky-bunny-nikki-mirror',
            champion: {
                botId: 'practice-bt05-nikki-strong-v1',
                label: 'strong-v1',
            },
            maxIterations: 3,
            maxStalledIterations: 2,
            targetDeltaWinRate: 0.05,
            promotionMinDeltaWinRate: 0.0125,
            selfPlayGamesPerIteration: 4,
            screeningGamesPerSide: 1,
            screeningTopK: 1,
            screeningSeedSuiteName: 'dev',
            screeningSeedSuitePath: 'artifacts/ai/seeds/phase3_v1.json',
            evaluationGamesPerSide: 2,
            maxSteps: 1200,
            enableMulligan: true,
            traceLimit: 8,
            selfPlayStartSeed: 1,
            selfPlayExplorationRate: 0.02,
            suppressLogs: true,
            includeObservations: false,
            evaluationSeedSuiteName: 'promotion-holdout',
            evaluationSeedSuitePath: 'artifacts/ai/seeds/phase3_v1.json',
            policyPresets: [
                { id: 'p1', label: 'P1', minSamples: 1, minHoldRate: 1, minAverageReturnToGo: 0 },
                { id: 'p2', label: 'P2', minSamples: 1, minHoldRate: 1, minAverageReturnToGo: 0 },
            ],
            outputPath: undefined,
        };

        const persisted: string[] = [];
        let iterationCallCount = 0;
        const report = runBt05NikkiSelfPlayLearningLoop(config, {
            runSelfPlayExport() {
                iterationCallCount += 1;
                return makeSelfPlaySummary(4, 40);
            },
            trainPolicy(trainingConfig) {
                return makeTrainingReport(trainingConfig.policyId.includes('p1') ? 1 : 0);
            },
            evaluateCandidate(loopConfig, candidate) {
                const delta = loopConfig.incumbentBotId === 'strong-v1' ? 0.025 : 0.0625;
                return {
                    generatedAt: '2026-03-18T00:00:00.000Z',
                    config: {
                        ...loopConfig,
                        resolvedRounds: 1,
                        resolvedGamesPerSide: loopConfig.gamesPerSide,
                    },
                    rounds: [],
                    summary: {
                        rounds: 1,
                        totalGames: loopConfig.gamesPerSide * 2,
                        candidate: {
                            games: loopConfig.gamesPerSide * 2,
                            wins: 0,
                            winRate: 0,
                            confidence: { pointEstimate: 0, standardError: 0, ci95Low: 0, ci95High: 0 },
                            tacticalKPIs: {
                                wasteful_upgrade_rate: 0.4,
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
                        incumbent: {
                            games: loopConfig.gamesPerSide * 2,
                            wins: 0,
                            winRate: 0,
                            confidence: { pointEstimate: 0, standardError: 0, ci95Low: 0, ci95High: 0 },
                            tacticalKPIs: {
                                wasteful_upgrade_rate: 0.41,
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
                        delta: {
                            winRate: delta,
                            wasteful_upgrade_rate: -0.01,
                            lethal_miss_rate: 0,
                            self_lethal_open_rate: 0,
                        },
                        terminationCounts: { winner: loopConfig.gamesPerSide * 2, max_steps: 0, no_action: 0, invalid_action: 0 },
                        avgSteps: 10,
                        avgTurns: 5,
                        diagnostics: {
                            bucketRoundSize: 1,
                            roundSlices: [],
                            bucketSlices: [],
                        },
                    },
                };
            },
            persistPromotedPolicy(policyArtifactPath) {
                persisted.push(policyArtifactPath);
            },
        });

        expect(iterationCallCount).toBe(2);
        expect(report.summary.inProgress).toBe(false);
        expect(report.summary.reachedTarget).toBe(true);
        expect(report.summary.stoppedBecause).toBe('target_reached');
        expect(report.summary.bestObservedDeltaWinRate).toBe(0.0625);
        expect(report.summary.finalChampion.botId).toBe('practice-bt05-nikki-learned-hold-v1');
        expect(persisted).toHaveLength(2);
        expect(report.iterations[0]?.candidateResults[0]?.screening?.delta.winRate).toBe(0.025);

        const summaryText = formatBt05NikkiSelfPlayLearningLoopSummary(report);
        expect(summaryText).toContain('inProgress=false');
        expect(summaryText).toContain('reachedTarget=true');
        expect(summaryText).toContain('bestDelta=0.0625');
    });
});
