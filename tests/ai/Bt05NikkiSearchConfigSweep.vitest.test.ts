import { describe, expect, it } from 'vitest';
import {
    Bt05NikkiSearchConfigSweepCandidateSpec,
    Bt05NikkiSearchConfigSweepConfig,
    Bt05NikkiSearchConfigSweepSuiteSummary,
    buildBt05NikkiSearchConfigSweepArtifactPaths,
    defaultBt05NikkiSearchConfigCandidates,
    formatBt05NikkiSearchConfigSweepSummary,
    runBt05NikkiSearchConfigSweep,
} from '../../scripts/ai/run_bt05_nikki_search_config_sweep';
import { TacticalKpiCounts } from '../../scripts/ai/run_fixed_matchup_batch';

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

function makeRoleSummary(
    wins: number,
    totalGames: number,
    counts: TacticalKpiCounts,
): Bt05NikkiSearchConfigSweepSuiteSummary['candidate'] {
    const winRate = totalGames > 0 ? wins / totalGames : 0;
    return {
        games: totalGames,
        wins,
        winRate,
        confidence: {
            pointEstimate: winRate,
            standardError: 0,
            ci95Low: winRate,
            ci95High: winRate,
        },
        tacticalKPIs: {
            wasteful_upgrade_rate: counts.upgradeActionCount > 0 ? counts.wastefulUpgradeCount / counts.upgradeActionCount : 0,
            lethal_miss_rate: counts.lethalOpportunityCount > 0 ? counts.lethalMissCount / counts.lethalOpportunityCount : 0,
            self_lethal_open_rate: counts.selfLethalCheckCount > 0 ? counts.selfLethalOpenCount / counts.selfLethalCheckCount : 0,
            counts,
        },
    };
}

function makeSuiteSummary(
    suiteName: Bt05NikkiSearchConfigSweepConfig['seedSuiteNames'][number],
    seedList: number[],
    candidateWins: number,
    incumbentWins: number,
    candidateCounts: TacticalKpiCounts,
    incumbentCounts: TacticalKpiCounts,
): Bt05NikkiSearchConfigSweepSuiteSummary {
    const totalGames = candidateWins + incumbentWins;
    const candidate = makeRoleSummary(candidateWins, totalGames, candidateCounts);
    const incumbent = makeRoleSummary(incumbentWins, totalGames, incumbentCounts);
    return {
        suiteName,
        seedLabel: `suite-${suiteName}`,
        seedList,
        totalGames,
        totalSteps: totalGames * 10,
        totalTurns: totalGames * 5,
        candidate,
        incumbent,
        delta: {
            winRate: totalGames > 0 ? (candidateWins - incumbentWins) / totalGames : 0,
            wasteful_upgrade_rate: candidate.tacticalKPIs.wasteful_upgrade_rate - incumbent.tacticalKPIs.wasteful_upgrade_rate,
            lethal_miss_rate: candidate.tacticalKPIs.lethal_miss_rate - incumbent.tacticalKPIs.lethal_miss_rate,
            self_lethal_open_rate: candidate.tacticalKPIs.self_lethal_open_rate - incumbent.tacticalKPIs.self_lethal_open_rate,
        },
        avgSteps: 10,
        avgTurns: 5,
    };
}

describe('BT05 Nikki search-config sweep', () => {
    it('exposes actionable built-in candidate presets', () => {
        const presets = defaultBt05NikkiSearchConfigCandidates();
        const presetIds = presets.map(preset => preset.id);

        expect(presets.length).toBeGreaterThanOrEqual(6);
        expect(presetIds).toContain('baseline-reference');
        expect(presetIds).toContain('hold-main-early');
        expect(presetIds).toContain('beam8-depth4');
        expect(presetIds).toContain('topk3-mean');
    });

    it('ranks candidates by combined gain and seed-pocket stability', () => {
        const config: Bt05NikkiSearchConfigSweepConfig = {
            matchupId: 'fm-c-bt05-unlucky-bunny-nikki-mirror',
            incumbentBotId: 'practice-bt05-nikki-strong-v1',
            candidateProfileId: 'practice-bt05-nikki-open-v1',
            seedSuiteNames: ['tuning', 'dev'],
            seedSuitePath: 'artifacts/ai/seeds/phase3_v1.json',
            maxSeedsPerSuite: 1,
            maxSteps: 1200,
            enableMulligan: true,
            traceLimit: 8,
            suppressLogs: true,
            topK: 2,
            candidateSpecs: [
                {
                    id: 'baseline-reference',
                    label: 'Baseline reference',
                    options: {},
                },
                {
                    id: 'beam8-depth4',
                    label: 'Beam 8 depth 4',
                    options: { beamWidth: 8, interactionRolloutDepth: 4 },
                },
                {
                    id: 'topk3-mean',
                    label: 'Top-k 3 mean',
                    options: { beamWidth: 6, interactionRolloutDepth: 4, opponentReplyTopK: 3, opponentReplyAggregation: 'mean' },
                },
            ],
        };

        const suiteTable: Record<string, Record<string, Bt05NikkiSearchConfigSweepSuiteSummary>> = {
            'baseline-reference': {
                tuning: makeSuiteSummary(
                    'tuning',
                    [2026031000],
                    1,
                    1,
                    makeCounts({ upgradeActionCount: 10, wastefulUpgradeCount: 2, lethalOpportunityCount: 4, lethalMissCount: 1, selfLethalCheckCount: 8, selfLethalOpenCount: 1 }),
                    makeCounts({ upgradeActionCount: 10, wastefulUpgradeCount: 2, lethalOpportunityCount: 4, lethalMissCount: 1, selfLethalCheckCount: 8, selfLethalOpenCount: 1 }),
                ),
                dev: makeSuiteSummary(
                    'dev',
                    [2026032000],
                    1,
                    1,
                    makeCounts({ upgradeActionCount: 12, wastefulUpgradeCount: 3, lethalOpportunityCount: 5, lethalMissCount: 1, selfLethalCheckCount: 8, selfLethalOpenCount: 1 }),
                    makeCounts({ upgradeActionCount: 12, wastefulUpgradeCount: 3, lethalOpportunityCount: 5, lethalMissCount: 1, selfLethalCheckCount: 8, selfLethalOpenCount: 1 }),
                ),
            },
            'beam8-depth4': {
                tuning: makeSuiteSummary(
                    'tuning',
                    [2026031000],
                    4,
                    0,
                    makeCounts({ upgradeActionCount: 10, wastefulUpgradeCount: 1, lethalOpportunityCount: 4, lethalMissCount: 0, selfLethalCheckCount: 8, selfLethalOpenCount: 0 }),
                    makeCounts({ upgradeActionCount: 10, wastefulUpgradeCount: 3, lethalOpportunityCount: 4, lethalMissCount: 2, selfLethalCheckCount: 8, selfLethalOpenCount: 1 }),
                ),
                dev: makeSuiteSummary(
                    'dev',
                    [2026032000],
                    2,
                    2,
                    makeCounts({ upgradeActionCount: 12, wastefulUpgradeCount: 2, lethalOpportunityCount: 5, lethalMissCount: 1, selfLethalCheckCount: 8, selfLethalOpenCount: 0 }),
                    makeCounts({ upgradeActionCount: 12, wastefulUpgradeCount: 3, lethalOpportunityCount: 5, lethalMissCount: 1, selfLethalCheckCount: 8, selfLethalOpenCount: 1 }),
                ),
            },
            'topk3-mean': {
                tuning: makeSuiteSummary(
                    'tuning',
                    [2026031000],
                    3,
                    1,
                    makeCounts({ upgradeActionCount: 10, wastefulUpgradeCount: 1, lethalOpportunityCount: 4, lethalMissCount: 0, selfLethalCheckCount: 8, selfLethalOpenCount: 0 }),
                    makeCounts({ upgradeActionCount: 10, wastefulUpgradeCount: 3, lethalOpportunityCount: 4, lethalMissCount: 2, selfLethalCheckCount: 8, selfLethalOpenCount: 1 }),
                ),
                dev: makeSuiteSummary(
                    'dev',
                    [2026032000],
                    3,
                    1,
                    makeCounts({ upgradeActionCount: 12, wastefulUpgradeCount: 2, lethalOpportunityCount: 5, lethalMissCount: 1, selfLethalCheckCount: 8, selfLethalOpenCount: 0 }),
                    makeCounts({ upgradeActionCount: 12, wastefulUpgradeCount: 3, lethalOpportunityCount: 5, lethalMissCount: 1, selfLethalCheckCount: 8, selfLethalOpenCount: 1 }),
                ),
            },
        };

        const report = runBt05NikkiSearchConfigSweep(config, {
            runSuite(candidate, suiteName) {
                return suiteTable[candidate.id][suiteName];
            },
        });

        expect(report.summary.candidateCount).toBe(3);
        expect(report.summary.suiteCount).toBe(2);
        expect(report.suites.map(suite => suite.seedCount)).toEqual([1, 1]);
        expect(report.candidates.map(candidate => candidate.id)).toEqual([
            'topk3-mean',
            'beam8-depth4',
            'baseline-reference',
        ]);
        expect(report.topCandidates.map(candidate => candidate.id)).toEqual([
            'topk3-mean',
            'beam8-depth4',
        ]);
        expect(report.candidates[0].suiteDeltaSpread).toBe(0);
        expect(report.candidates[1].suiteDeltaSpread).toBeGreaterThan(0);

        const summaryText = formatBt05NikkiSearchConfigSweepSummary(report);
        expect(summaryText).toContain('BT05 Nikki search-config sweep');
        expect(summaryText).toContain('tuning:+');
        expect(summaryText).toContain('dev:+');
        expect(summaryText).toContain('Top-k 3 mean');
        expect(summaryText).toContain('Beam 8 depth 4');
    });

    it('builds a deterministic archive artifact path for the configured sweep', () => {
        const config: Bt05NikkiSearchConfigSweepConfig = {
            matchupId: 'fm-c-bt05-unlucky-bunny-nikki-mirror',
            incumbentBotId: 'practice-bt05-nikki-strong-v1',
            candidateProfileId: 'practice-bt05-nikki-open-v1',
            seedSuiteNames: ['tuning', 'dev'],
            seedSuitePath: 'artifacts/ai/seeds/phase3_v1.json',
            maxSeedsPerSuite: 1,
            maxSteps: 1200,
            enableMulligan: true,
            traceLimit: 8,
            suppressLogs: true,
            topK: 2,
            candidateSpecs: [{
                id: 'baseline-reference',
                label: 'Baseline reference',
                options: {},
            }],
        };

        const artifactPaths = buildBt05NikkiSearchConfigSweepArtifactPaths('artifacts/ai/fixed_matchup/nikki_search_sweep/latest.json', config);

        expect(artifactPaths.latestPath).toContain('nikki_search_sweep');
        expect(artifactPaths.archivePath).toContain('fm-c-bt05-unlucky-bunny-nikki-mirror');
        expect(artifactPaths.archivePath).toContain('suites-tuning-dev');
        expect(artifactPaths.archivePath).toContain('k2');
    });

    it('runs the default suite evaluator without a custom runSuite override', () => {
        const config: Bt05NikkiSearchConfigSweepConfig = {
            matchupId: 'fm-c-bt05-unlucky-bunny-nikki-mirror',
            incumbentBotId: 'practice-bt05-nikki-strong-v1',
            candidateProfileId: 'practice-bt05-nikki-open-v1',
            seedSuiteNames: ['tuning'],
            seedSuitePath: 'artifacts/ai/seeds/phase3_v1.json',
            maxSeedsPerSuite: 1,
            maxSteps: 1200,
            enableMulligan: true,
            traceLimit: 8,
            suppressLogs: true,
            topK: 1,
            candidateSpecs: [{
                id: 'baseline-reference',
                label: 'Baseline reference',
                options: {},
            }],
        };

        const report = runBt05NikkiSearchConfigSweep(config);

        expect(report.summary.candidateCount).toBe(1);
        expect(report.summary.suiteCount).toBe(1);
        expect(report.candidates[0].combined.totalGames).toBe(2);
        expect(report.candidates[0].id).toBe('baseline-reference');
    }, 30000);
});
