import { describe, expect, it } from 'vitest';
import { MatchBatchReport, TacticalKpiCounts } from '../../scripts/ai/run_match_batch';
import { evaluatePhase41TacticalKpiDelta } from '../../scripts/ai/run_phase4_stress_matrix';

function safeDivide(numerator: number, denominator: number): number {
    if (denominator <= 0) return 0;
    return numerator / denominator;
}

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

function makeReport(player1: TacticalKpiCounts, player2: TacticalKpiCounts): MatchBatchReport {
    const counts: TacticalKpiCounts = {
        upgradeActionCount: player1.upgradeActionCount + player2.upgradeActionCount,
        wastefulUpgradeCount: player1.wastefulUpgradeCount + player2.wastefulUpgradeCount,
        lethalOpportunityCount: player1.lethalOpportunityCount + player2.lethalOpportunityCount,
        lethalMissCount: player1.lethalMissCount + player2.lethalMissCount,
        selfLethalCheckCount: player1.selfLethalCheckCount + player2.selfLethalCheckCount,
        selfLethalOpenCount: player1.selfLethalOpenCount + player2.selfLethalOpenCount,
    };

    return {
        config: {
            startSeed: 1,
            games: 1,
            maxSteps: 200,
            enableMulligan: true,
        },
        matches: [],
        summary: {
            totalGames: 1,
            wins: { player1: 1, player2: 0 },
            winRate: { player1: 1, player2: 0 },
            unfinished: 0,
            avgSteps: 50,
            avgTurns: 7,
            terminationCounts: { winner: 1, max_steps: 0, no_action: 0, invalid_action: 0 },
            confidence: {
                player1WinRate: { pointEstimate: 1, standardError: 0, ci95Low: 1, ci95High: 1 },
                player2WinRate: { pointEstimate: 0, standardError: 0, ci95Low: 0, ci95High: 0 },
            },
            runtime: {
                enabled: false,
                totalMs: 0,
                avgMsPerGame: 0,
                msPerAction: 0,
            },
            tacticalKPIs: {
                wasteful_upgrade_rate: safeDivide(counts.wastefulUpgradeCount, counts.upgradeActionCount),
                lethal_miss_rate: safeDivide(counts.lethalMissCount, counts.lethalOpportunityCount),
                self_lethal_open_rate: safeDivide(counts.selfLethalOpenCount, counts.selfLethalCheckCount),
                counts,
                byPlayer: {
                    player1,
                    player2,
                },
            },
        },
    };
}

function makeRun(
    player1BotId: string,
    player2BotId: string,
    player1Counts: TacticalKpiCounts,
    player2Counts: TacticalKpiCounts,
): { pairing: { player1BotId: string; player2BotId: string; games: number }; report: MatchBatchReport } {
    return {
        pairing: {
            player1BotId,
            player2BotId,
            games: 1,
        },
        report: makeReport(player1Counts, player2Counts),
    };
}

describe('Phase4 stress matrix tactical KPI delta', () => {
    it('isolates tactical KPI counts to evaluated bot position', () => {
        const runs = [
            makeRun(
                'strong-v3.1-topk3',
                'strong-v2',
                { upgradeActionCount: 10, wastefulUpgradeCount: 2, lethalOpportunityCount: 8, lethalMissCount: 1, selfLethalCheckCount: 20, selfLethalOpenCount: 1 },
                { upgradeActionCount: 100, wastefulUpgradeCount: 90, lethalOpportunityCount: 100, lethalMissCount: 90, selfLethalCheckCount: 100, selfLethalOpenCount: 90 },
            ),
            makeRun(
                'strong-v2',
                'strong-v3',
                { upgradeActionCount: 100, wastefulUpgradeCount: 80, lethalOpportunityCount: 100, lethalMissCount: 80, selfLethalCheckCount: 100, selfLethalOpenCount: 70 },
                { upgradeActionCount: 10, wastefulUpgradeCount: 3, lethalOpportunityCount: 8, lethalMissCount: 2, selfLethalCheckCount: 20, selfLethalOpenCount: 2 },
            ),
            makeRun(
                'strong-v3.1-topk3',
                'baseline-a',
                { upgradeActionCount: 10, wastefulUpgradeCount: 1, lethalOpportunityCount: 2, lethalMissCount: 0, selfLethalCheckCount: 10, selfLethalOpenCount: 0 },
                emptyCounts(),
            ),
            makeRun(
                'strong-v3',
                'baseline-a',
                { upgradeActionCount: 10, wastefulUpgradeCount: 2, lethalOpportunityCount: 2, lethalMissCount: 1, selfLethalCheckCount: 10, selfLethalOpenCount: 1 },
                emptyCounts(),
            ),
        ];

        const result = evaluatePhase41TacticalKpiDelta(runs, 'strong-v3.1-topk3', 'strong-v3');
        expect(result.available).toBe(true);
        expect(result.sharedOpponents).toEqual(['baseline-a', 'strong-v2']);
        expect(result.candidate?.wasteful_upgrade_rate).toBe(0.15);
        expect(result.candidate?.lethal_miss_rate).toBe(0.1);
        expect(result.baseline?.wasteful_upgrade_rate).toBe(0.25);
        expect(result.baseline?.lethal_miss_rate).toBe(0.3);
        expect(result.delta).toEqual({
            wasteful_upgrade_rate: -0.1,
            lethal_miss_rate: -0.2,
            self_lethal_open_rate: -0.0667,
        });
    });

    it('returns unavailable when candidate and baseline do not share evaluated opponents', () => {
        const runs = [
            makeRun(
                'strong-v3.1-topk3',
                'strong-v2',
                { upgradeActionCount: 5, wastefulUpgradeCount: 1, lethalOpportunityCount: 5, lethalMissCount: 1, selfLethalCheckCount: 10, selfLethalOpenCount: 1 },
                emptyCounts(),
            ),
            makeRun(
                'strong-v3',
                'baseline-a',
                { upgradeActionCount: 5, wastefulUpgradeCount: 2, lethalOpportunityCount: 5, lethalMissCount: 2, selfLethalCheckCount: 10, selfLethalOpenCount: 2 },
                emptyCounts(),
            ),
        ];

        const result = evaluatePhase41TacticalKpiDelta(runs, 'strong-v3.1-topk3', 'strong-v3');
        expect(result.available).toBe(false);
        expect(result.sharedOpponents).toEqual([]);
        expect(result.delta).toBeNull();
        expect(result.note).toContain('No shared opponents');
    });
});
