import { describe, expect, it } from 'vitest';
import { MatchBatchReport } from '../../scripts/ai/run_match_batch';
import { checkPhase4RuntimeGate, computePhase4RuntimeStats } from '../../scripts/ai/phase4_runtime_gate';

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
});
