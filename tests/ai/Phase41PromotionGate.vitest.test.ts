import { describe, expect, it } from 'vitest';
import {
    evaluatePromotionPerformanceGate,
    evaluatePromotionTacticalKpiGate,
} from '../../scripts/ai/run_phase41_promotion_gate';
import { Phase41TacticalKpiDelta } from '../../scripts/ai/run_phase4_stress_matrix';

describe('Phase4.1 promotion gate', () => {
    it('passes performance gate when win rate and CI low meet thresholds', () => {
        const result = evaluatePromotionPerformanceGate(
            220,
            400,
            {
                minWinRate: 0.53,
                minCi95Low: 0.5,
            },
        );

        expect(result.pass).toBe(true);
        expect(result.winRate).toBe(0.55);
        expect(result.confidence.ci95Low).toBeGreaterThanOrEqual(0.5);
    });

    it('fails performance gate when CI low misses threshold', () => {
        const result = evaluatePromotionPerformanceGate(
            212,
            400,
            {
                minWinRate: 0.53,
                minCi95Low: 0.5,
            },
        );

        expect(result.pass).toBe(false);
        expect(result.reasons.join(' | ')).toContain('CI low gate failed');
    });

    it('passes tactical KPI gate with lethal reduction and no regression', () => {
        const delta: Phase41TacticalKpiDelta = {
            available: true,
            candidateBotId: 'strong-v3.1-topk3',
            baselineBotId: 'strong-v3',
            sharedOpponents: ['strong-v2'],
            candidate: {
                wasteful_upgrade_rate: 0.22,
                lethal_miss_rate: 0.15,
                self_lethal_open_rate: 0.03,
                counts: {
                    upgradeActionCount: 100,
                    wastefulUpgradeCount: 22,
                    lethalOpportunityCount: 100,
                    lethalMissCount: 15,
                    selfLethalCheckCount: 100,
                    selfLethalOpenCount: 3,
                },
            },
            baseline: {
                wasteful_upgrade_rate: 0.25,
                lethal_miss_rate: 0.2,
                self_lethal_open_rate: 0.04,
                counts: {
                    upgradeActionCount: 100,
                    wastefulUpgradeCount: 25,
                    lethalOpportunityCount: 100,
                    lethalMissCount: 20,
                    selfLethalCheckCount: 100,
                    selfLethalOpenCount: 4,
                },
            },
            delta: {
                wasteful_upgrade_rate: -0.03,
                lethal_miss_rate: -0.05,
                self_lethal_open_rate: -0.01,
            },
        };

        const result = evaluatePromotionTacticalKpiGate(delta, {
            minRelativeLethalMissReduction: 0.15,
            allowSelfLethalOpenRegression: false,
            allowWastefulUpgradeRegression: false,
        });
        expect(result.pass).toBe(true);
        expect(result.requiredLethalMissRate).toBe(0.17);
    });

    it('fails tactical KPI gate when lethal reduction is insufficient', () => {
        const delta: Phase41TacticalKpiDelta = {
            available: true,
            candidateBotId: 'strong-v3.1-topk3',
            baselineBotId: 'strong-v3',
            sharedOpponents: ['strong-v2'],
            candidate: {
                wasteful_upgrade_rate: 0.24,
                lethal_miss_rate: 0.18,
                self_lethal_open_rate: 0.04,
                counts: {
                    upgradeActionCount: 100,
                    wastefulUpgradeCount: 24,
                    lethalOpportunityCount: 100,
                    lethalMissCount: 18,
                    selfLethalCheckCount: 100,
                    selfLethalOpenCount: 4,
                },
            },
            baseline: {
                wasteful_upgrade_rate: 0.23,
                lethal_miss_rate: 0.2,
                self_lethal_open_rate: 0.03,
                counts: {
                    upgradeActionCount: 100,
                    wastefulUpgradeCount: 23,
                    lethalOpportunityCount: 100,
                    lethalMissCount: 20,
                    selfLethalCheckCount: 100,
                    selfLethalOpenCount: 3,
                },
            },
            delta: {
                wasteful_upgrade_rate: 0.01,
                lethal_miss_rate: -0.02,
                self_lethal_open_rate: 0.01,
            },
        };

        const result = evaluatePromotionTacticalKpiGate(delta, {
            minRelativeLethalMissReduction: 0.15,
            allowSelfLethalOpenRegression: false,
            allowWastefulUpgradeRegression: false,
        });
        expect(result.pass).toBe(false);
        expect(result.reasons.join(' | ')).toContain('tactical lethal_miss_rate gate failed');
        expect(result.reasons.join(' | ')).toContain('tactical self_lethal_open_rate regression');
        expect(result.reasons.join(' | ')).toContain('tactical wasteful_upgrade_rate regression');
    });
});
