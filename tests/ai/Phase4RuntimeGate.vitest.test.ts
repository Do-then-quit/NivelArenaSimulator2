import { describe, expect, it } from 'vitest';
import { MatchBatchReport } from '../../scripts/ai/run_match_batch';
import { checkPhase4RuntimeGate, computePhase4RuntimeStats } from '../../scripts/ai/phase4_runtime_gate';
import { buildPhase4MatrixSummary } from '../../scripts/ai/run_phase4_stress_matrix';

function makeReport(msPerAction: number, avgMsPerGame: number): MatchBatchReport {
    return {
        config: {
            startSeed: 1,
            games: 1,
            maxSteps: 100,
            enableMulligan: true,
            measureRuntime: true,
        },
        matches: [],
        summary: {
            totalGames: 1,
            wins: { player1: 1, player2: 0 },
            winRate: { player1: 1, player2: 0 },
            unfinished: 0,
            avgSteps: 30,
            avgTurns: 8,
            terminationCounts: { winner: 1, max_steps: 0, no_action: 0, invalid_action: 0 },
            confidence: {
                player1WinRate: { pointEstimate: 1, standardError: 0, ci95Low: 1, ci95High: 1 },
                player2WinRate: { pointEstimate: 0, standardError: 0, ci95Low: 0, ci95High: 0 },
            },
            runtime: {
                enabled: true,
                totalMs: avgMsPerGame,
                avgMsPerGame,
                msPerAction,
            },
            tacticalKPIs: {
                wasteful_upgrade_rate: 0.2,
                lethal_miss_rate: 0.1,
                self_lethal_open_rate: 0.05,
                counts: {
                    upgradeActionCount: 10,
                    wastefulUpgradeCount: 2,
                    lethalOpportunityCount: 10,
                    lethalMissCount: 1,
                    selfLethalCheckCount: 20,
                    selfLethalOpenCount: 1,
                },
            },
            searchCoverage: {
                root: {
                    decisionCount: 10,
                    legalActionCount: 40,
                    exploredActionCount: 20,
                    exploredRate: 0.5,
                },
                interaction: {
                    decisionCount: 4,
                    legalActionCount: 16,
                    exploredActionCount: 8,
                    exploredRate: 0.5,
                },
            },
        },
    };
}

describe('Phase4 runtime gate', () => {
    it('computes p50/p95 runtime stats from reports', () => {
        const stats = computePhase4RuntimeStats([
            makeReport(2.0, 200),
            makeReport(3.0, 300),
            makeReport(4.0, 400),
        ]);

        expect(stats.p50MsPerAction).toBe(3);
        expect(stats.p95MsPerAction).toBe(3);
        expect(stats.avgMsPerGame).toBe(300);
    });

    it('passes when all runtime gates stay within threshold multipliers', () => {
        const result = checkPhase4RuntimeGate(
            [makeReport(2.3, 250), makeReport(2.5, 270)],
            { p50MsPerAction: 2.5, p95MsPerAction: 3.0, avgMsPerGame: 260 },
            { p50MsPerActionMultiplier: 1.25, p95MsPerActionMultiplier: 1.6, avgMsPerGameMultiplier: 1.4 },
        );

        expect(result.pass).toBe(true);
        expect(result.reasons).toHaveLength(0);
    });

    it('fails when p95 and avgMsPerGame exceed limits', () => {
        const result = checkPhase4RuntimeGate(
            [makeReport(5.2, 500), makeReport(6.2, 560)],
            { p50MsPerAction: 2.5, p95MsPerAction: 3.0, avgMsPerGame: 260 },
            { p50MsPerActionMultiplier: 1.25, p95MsPerActionMultiplier: 1.6, avgMsPerGameMultiplier: 1.4 },
        );

        expect(result.pass).toBe(false);
        expect(result.reasons.join(' | ')).toContain('p95 ms/action gate failed');
        expect(result.reasons.join(' | ')).toContain('avg ms/game gate failed');
    });

    it('builds matrix summary with tactical and coverage deltas', () => {
        process.env.AI_PHASE4_BASELINE_WASTEFUL_UPGRADE_RATE = '0.1';
        process.env.AI_PHASE4_BASELINE_LETHAL_MISS_RATE = '0.2';
        process.env.AI_PHASE4_BASELINE_SELF_LETHAL_OPEN_RATE = '0.02';
        process.env.AI_PHASE4_BASELINE_ROOT_COVERAGE = '0.45';
        process.env.AI_PHASE4_BASELINE_INTERACTION_COVERAGE = '0.4';

        const reports = [makeReport(2.5, 260), makeReport(2.0, 250)];
        const runs = [
            {
                pairing: { player1BotId: 'strong-v3', player2BotId: 'strong-v2', games: 2 },
                report: {
                    ...makeReport(2.5, 260),
                    summary: {
                        ...makeReport(2.5, 260).summary,
                        totalGames: 2,
                        wins: { player1: 2, player2: 0 },
                    },
                },
            },
        ];

        const summary = buildPhase4MatrixSummary(
            reports,
            runs,
            {
                pass: true,
                reasons: [],
                thresholds: { p50MsPerActionMultiplier: 1.2, p95MsPerActionMultiplier: 1.2, avgMsPerGameMultiplier: 1.2 },
                baseline: { p50MsPerAction: 1, p95MsPerAction: 1, avgMsPerGame: 1 },
                actual: { p50MsPerAction: 1, p95MsPerAction: 1, avgMsPerGame: 1 },
            },
            0.5,
        );

        expect(summary.tacticalKPIDelta.delta.wasteful_upgrade_rate).toBe(0.1);
        expect(summary.tacticalKPIDelta.delta.lethal_miss_rate).toBe(-0.1);
        expect(summary.searchCoverage.delta.rootExploredRate).toBe(0.05);
        expect(summary.searchCoverage.delta.interactionExploredRate).toBe(0.1);
        expect(summary.searchCoverage.counts.rootDecisionCount).toBe(20);
        expect(summary.performanceGate.strongV3WinRateVsStrongV2).toBe(1);

        delete process.env.AI_PHASE4_BASELINE_WASTEFUL_UPGRADE_RATE;
        delete process.env.AI_PHASE4_BASELINE_LETHAL_MISS_RATE;
        delete process.env.AI_PHASE4_BASELINE_SELF_LETHAL_OPEN_RATE;
        delete process.env.AI_PHASE4_BASELINE_ROOT_COVERAGE;
        delete process.env.AI_PHASE4_BASELINE_INTERACTION_COVERAGE;
    });
});
