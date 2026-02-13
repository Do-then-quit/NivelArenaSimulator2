import fs from 'node:fs';
import path from 'node:path';
import { MatchBatchReport, runMatchBatch } from './run_match_batch';
import { loadPhase0Manifest, resolvePhase0ManifestPath } from './phase0_manifest';
import { checkPhase4RuntimeGate } from './phase4_runtime_gate';
import { resolveSeedSuiteSeeds, SeedSuiteName } from './seed_suites';
import { evaluatePhase41TacticalKpiDelta, Phase41TacticalKpiDelta } from './run_phase4_stress_matrix';

interface PromotionRunSpec {
    id: string;
    player1BotId: string;
    player2BotId: string;
    seedList: number[];
    maxSteps: number;
    enableMulligan: boolean;
    measureRuntime: boolean;
    suppressLogs: boolean;
}

interface PromotionRunResult {
    spec: PromotionRunSpec;
    report: MatchBatchReport;
    artifactPath: string;
    latestArtifactPath: string;
}

interface PromotionGateReport {
    generatedAt: string;
    config: {
        artifactTag: string;
        candidateBotId: string;
        baselineBotId: string;
        controlBotId: string;
        seedSuitePath: string;
        seedSuiteName: SeedSuiteName;
        holdoutGamesPerRole: number;
        kpiComparisonGamesPerRole: number;
        maxSteps: number;
        enableMulligan: boolean;
        measureRuntime: boolean;
        suppressLogs: boolean;
        outputPath: string;
    };
    runs: Array<{
        id: string;
        player1BotId: string;
        player2BotId: string;
        games: number;
        artifactPath: string;
        latestArtifactPath: string;
        summary: MatchBatchReport['summary'];
    }>;
    gates: {
        performance: PromotionPerformanceGateResult;
        stability: {
            pass: boolean;
            terminationTotals: {
                winner: number;
                max_steps: number;
                no_action: number;
                invalid_action: number;
            };
            reasons: string[];
        };
        runtime: ReturnType<typeof checkPhase4RuntimeGate>;
        tacticalKpi: PromotionTacticalKpiGateResult;
    };
    overall: {
        pass: boolean;
        reasons: string[];
    };
}

export interface PromotionPerformanceGateConfig {
    minWinRate: number;
    minCi95Low: number;
}

export interface PromotionPerformanceGateResult {
    pass: boolean;
    wins: number;
    games: number;
    winRate: number;
    confidence: {
        pointEstimate: number;
        standardError: number;
        ci95Low: number;
        ci95High: number;
    };
    thresholds: PromotionPerformanceGateConfig;
    reasons: string[];
}

export interface PromotionTacticalKpiGateConfig {
    minRelativeLethalMissReduction: number;
    allowSelfLethalOpenRegression: boolean;
    allowWastefulUpgradeRegression: boolean;
}

export interface PromotionTacticalKpiGateResult {
    pass: boolean;
    thresholds: PromotionTacticalKpiGateConfig;
    available: boolean;
    reasons: string[];
    baselineRates: {
        wasteful_upgrade_rate: number;
        lethal_miss_rate: number;
        self_lethal_open_rate: number;
    } | null;
    candidateRates: {
        wasteful_upgrade_rate: number;
        lethal_miss_rate: number;
        self_lethal_open_rate: number;
    } | null;
    requiredLethalMissRate: number | null;
    delta: Phase41TacticalKpiDelta['delta'];
}

function roundTo(value: number, digits: number): number {
    const p = 10 ** digits;
    return Math.round(value * p) / p;
}

function clamp01(value: number): number {
    if (value < 0) return 0;
    if (value > 1) return 1;
    return value;
}

function parseIntEnv(name: string, fallback: number): number {
    const raw = process.env[name];
    if (!raw) return fallback;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBoolEnv(name: string, fallback: boolean): boolean {
    const raw = process.env[name];
    if (!raw) return fallback;
    const normalized = raw.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function parseStringEnv(name: string, fallback: string): string {
    const raw = process.env[name];
    if (!raw) return fallback;
    const normalized = raw.trim();
    return normalized.length > 0 ? normalized : fallback;
}

function parseSeedSuiteNameEnv(name: string, fallback: SeedSuiteName): SeedSuiteName {
    const raw = process.env[name];
    if (!raw) return fallback;
    const normalized = raw.trim().toLowerCase();
    if (normalized === 'tuning' || normalized === 'dev' || normalized === 'promotion-holdout') {
        return normalized;
    }
    return fallback;
}

function computeBinomialConfidence(successes: number, total: number): PromotionPerformanceGateResult['confidence'] {
    if (total <= 0) {
        return {
            pointEstimate: 0,
            standardError: 0,
            ci95Low: 0,
            ci95High: 0,
        };
    }

    const pointEstimate = successes / total;
    const standardError = Math.sqrt(pointEstimate * (1 - pointEstimate) / total);
    const margin = 1.96 * standardError;
    return {
        pointEstimate: roundTo(pointEstimate, 4),
        standardError: roundTo(standardError, 4),
        ci95Low: roundTo(clamp01(pointEstimate - margin), 4),
        ci95High: roundTo(clamp01(pointEstimate + margin), 4),
    };
}

export function evaluatePromotionPerformanceGate(
    wins: number,
    games: number,
    thresholds: PromotionPerformanceGateConfig,
): PromotionPerformanceGateResult {
    const reasons: string[] = [];
    const confidence = computeBinomialConfidence(wins, games);
    const winRate = confidence.pointEstimate;

    if (games <= 0) {
        reasons.push('no games played for promotion performance gate');
    }
    if (winRate < thresholds.minWinRate) {
        reasons.push(`win rate gate failed: actual=${winRate}, required>=${thresholds.minWinRate}`);
    }
    if (confidence.ci95Low < thresholds.minCi95Low) {
        reasons.push(`CI low gate failed: actual=${confidence.ci95Low}, required>=${thresholds.minCi95Low}`);
    }

    return {
        pass: reasons.length === 0,
        wins,
        games,
        winRate,
        confidence,
        thresholds,
        reasons,
    };
}

export function evaluatePromotionTacticalKpiGate(
    deltaResult: Phase41TacticalKpiDelta,
    thresholds: PromotionTacticalKpiGateConfig,
): PromotionTacticalKpiGateResult {
    const reasons: string[] = [];
    if (!deltaResult.available || !deltaResult.candidate || !deltaResult.baseline || !deltaResult.delta) {
        reasons.push(deltaResult.note ?? 'tactical KPI delta unavailable');
        return {
            pass: false,
            thresholds,
            available: false,
            reasons,
            baselineRates: null,
            candidateRates: null,
            requiredLethalMissRate: null,
            delta: null,
        };
    }

    const baselineRates = {
        wasteful_upgrade_rate: deltaResult.baseline.wasteful_upgrade_rate,
        lethal_miss_rate: deltaResult.baseline.lethal_miss_rate,
        self_lethal_open_rate: deltaResult.baseline.self_lethal_open_rate,
    };
    const candidateRates = {
        wasteful_upgrade_rate: deltaResult.candidate.wasteful_upgrade_rate,
        lethal_miss_rate: deltaResult.candidate.lethal_miss_rate,
        self_lethal_open_rate: deltaResult.candidate.self_lethal_open_rate,
    };

    const baselineLethal = baselineRates.lethal_miss_rate;
    const candidateLethal = candidateRates.lethal_miss_rate;
    const requiredLethalMissRate = baselineLethal > 0
        ? roundTo(baselineLethal * (1 - thresholds.minRelativeLethalMissReduction), 4)
        : baselineLethal;
    if (candidateLethal > requiredLethalMissRate) {
        reasons.push(
            `tactical lethal_miss_rate gate failed: actual=${candidateLethal}, required<=${requiredLethalMissRate}`,
        );
    }

    if (!thresholds.allowSelfLethalOpenRegression && candidateRates.self_lethal_open_rate > baselineRates.self_lethal_open_rate) {
        reasons.push(
            `tactical self_lethal_open_rate regression: candidate=${candidateRates.self_lethal_open_rate}, baseline=${baselineRates.self_lethal_open_rate}`,
        );
    }

    if (!thresholds.allowWastefulUpgradeRegression && candidateRates.wasteful_upgrade_rate > baselineRates.wasteful_upgrade_rate) {
        reasons.push(
            `tactical wasteful_upgrade_rate regression: candidate=${candidateRates.wasteful_upgrade_rate}, baseline=${baselineRates.wasteful_upgrade_rate}`,
        );
    }

    return {
        pass: reasons.length === 0,
        thresholds,
        available: true,
        reasons,
        baselineRates,
        candidateRates,
        requiredLethalMissRate,
        delta: deltaResult.delta,
    };
}

function writeJson(targetPath: string, value: unknown): void {
    const resolved = path.resolve(targetPath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, JSON.stringify(value, null, 2), 'utf8');
}

function runPromotionBatch(spec: PromotionRunSpec): MatchBatchReport {
    return runMatchBatch({
        startSeed: spec.seedList[0] ?? 1,
        games: spec.seedList.length,
        maxSteps: spec.maxSteps,
        enableMulligan: spec.enableMulligan,
        measureRuntime: spec.measureRuntime,
        suppressLogs: spec.suppressLogs,
        player1BotId: spec.player1BotId,
        player2BotId: spec.player2BotId,
        seedList: spec.seedList,
    });
}

function toPairingRuns(runs: PromotionRunResult[]): Array<{ pairing: { player1BotId: string; player2BotId: string; games: number }; report: MatchBatchReport }> {
    return runs.map(run => ({
        pairing: {
            player1BotId: run.spec.player1BotId,
            player2BotId: run.spec.player2BotId,
            games: run.report.summary.totalGames,
        },
        report: run.report,
    }));
}

function buildTerminationTotals(reports: MatchBatchReport[]): PromotionGateReport['gates']['stability']['terminationTotals'] {
    return reports.reduce(
        (acc, report) => {
            acc.winner += report.summary.terminationCounts.winner;
            acc.max_steps += report.summary.terminationCounts.max_steps;
            acc.no_action += report.summary.terminationCounts.no_action;
            acc.invalid_action += report.summary.terminationCounts.invalid_action;
            return acc;
        },
        { winner: 0, max_steps: 0, no_action: 0, invalid_action: 0 },
    );
}

function runCli(): void {
    const manifest = loadPhase0Manifest(resolvePhase0ManifestPath());
    const cfg = manifest.phase41Promotion;

    const artifactTag = parseStringEnv('AI_PHASE41_PROMOTION_ARTIFACT_TAG', cfg.artifactTag);
    const outputPath = parseStringEnv('AI_PHASE41_PROMOTION_OUTPUT', cfg.outputPath);
    const runsDir = path.join(path.dirname(outputPath), 'runs');

    const candidateBotId = parseStringEnv('AI_PHASE41_PROMOTION_CANDIDATE_BOT', cfg.candidateBotId);
    const baselineBotId = parseStringEnv('AI_PHASE41_PROMOTION_BASELINE_BOT', cfg.baselineBotId);
    const controlBotId = parseStringEnv('AI_PHASE41_PROMOTION_CONTROL_BOT', cfg.controlBotId);
    const seedSuitePath = parseStringEnv('AI_PHASE41_PROMOTION_SEED_SUITE_PATH', cfg.seedSuitePath);
    const seedSuiteName = parseSeedSuiteNameEnv('AI_PHASE41_PROMOTION_SEED_SUITE', cfg.seedSuiteName);
    const holdoutGamesPerRole = parseIntEnv('AI_PHASE41_PROMOTION_HOLDOUT_GAMES_PER_ROLE', cfg.holdoutGamesPerRole);
    const kpiComparisonGamesPerRole = parseIntEnv('AI_PHASE41_PROMOTION_KPI_GAMES_PER_ROLE', cfg.kpiComparisonGamesPerRole);
    const maxSteps = parseIntEnv('AI_PHASE41_PROMOTION_MAX_STEPS', cfg.maxSteps);
    const enableMulligan = parseBoolEnv('AI_PHASE41_PROMOTION_ENABLE_MULLIGAN', cfg.enableMulligan);
    const measureRuntime = parseBoolEnv('AI_PHASE41_PROMOTION_MEASURE_RUNTIME', cfg.measureRuntime);
    const suppressLogs = parseBoolEnv('AI_PHASE41_PROMOTION_SUPPRESS_LOGS', cfg.suppressLogs);

    const resolvedSuite = resolveSeedSuiteSeeds(seedSuitePath, seedSuiteName);
    if (resolvedSuite.seeds.length < holdoutGamesPerRole || resolvedSuite.seeds.length < kpiComparisonGamesPerRole) {
        throw new Error(
            `Seed suite "${seedSuiteName}" has only ${resolvedSuite.seeds.length} seeds, `
            + `but holdout=${holdoutGamesPerRole}, kpi=${kpiComparisonGamesPerRole} are required.`,
        );
    }
    const holdoutSeeds = resolvedSuite.seeds.slice(0, holdoutGamesPerRole);
    const kpiSeeds = resolvedSuite.seeds.slice(0, kpiComparisonGamesPerRole);

    const runSpecs: PromotionRunSpec[] = [
        {
            id: 'candidate_vs_baseline_p1',
            player1BotId: candidateBotId,
            player2BotId: baselineBotId,
            seedList: holdoutSeeds,
            maxSteps,
            enableMulligan,
            measureRuntime,
            suppressLogs,
        },
        {
            id: 'baseline_vs_candidate_p1',
            player1BotId: baselineBotId,
            player2BotId: candidateBotId,
            seedList: holdoutSeeds,
            maxSteps,
            enableMulligan,
            measureRuntime,
            suppressLogs,
        },
        {
            id: 'candidate_vs_control_p1',
            player1BotId: candidateBotId,
            player2BotId: controlBotId,
            seedList: kpiSeeds,
            maxSteps,
            enableMulligan,
            measureRuntime,
            suppressLogs,
        },
        {
            id: 'control_vs_candidate_p1',
            player1BotId: controlBotId,
            player2BotId: candidateBotId,
            seedList: kpiSeeds,
            maxSteps,
            enableMulligan,
            measureRuntime,
            suppressLogs,
        },
        {
            id: 'baseline_vs_control_p1',
            player1BotId: baselineBotId,
            player2BotId: controlBotId,
            seedList: kpiSeeds,
            maxSteps,
            enableMulligan,
            measureRuntime,
            suppressLogs,
        },
        {
            id: 'control_vs_baseline_p1',
            player1BotId: controlBotId,
            player2BotId: baselineBotId,
            seedList: kpiSeeds,
            maxSteps,
            enableMulligan,
            measureRuntime,
            suppressLogs,
        },
    ];

    const runResults: PromotionRunResult[] = [];
    for (const spec of runSpecs) {
        const report = runPromotionBatch(spec);
        const artifactPath = path.join(runsDir, `${artifactTag}_${spec.id}.json`);
        const latestArtifactPath = path.join(runsDir, `latest_${spec.id}.json`);
        writeJson(artifactPath, report);
        writeJson(latestArtifactPath, report);
        runResults.push({
            spec,
            report,
            artifactPath,
            latestArtifactPath,
        });
    }

    const performanceRuns = runResults.filter(run =>
        run.spec.id === 'candidate_vs_baseline_p1' || run.spec.id === 'baseline_vs_candidate_p1',
    );
    const kpiRuns = runResults.filter(run =>
        run.spec.id === 'candidate_vs_control_p1'
        || run.spec.id === 'control_vs_candidate_p1'
        || run.spec.id === 'baseline_vs_control_p1'
        || run.spec.id === 'control_vs_baseline_p1',
    );

    const candidateWins =
        (performanceRuns.find(run => run.spec.id === 'candidate_vs_baseline_p1')?.report.summary.wins.player1 ?? 0)
        + (performanceRuns.find(run => run.spec.id === 'baseline_vs_candidate_p1')?.report.summary.wins.player2 ?? 0);
    const performanceGames = performanceRuns.reduce((sum, run) => sum + run.report.summary.totalGames, 0);
    const performanceGate = evaluatePromotionPerformanceGate(
        candidateWins,
        performanceGames,
        cfg.performanceGate,
    );

    const allReports = runResults.map(run => run.report);
    const terminationTotals = buildTerminationTotals(allReports);
    const stabilityReasons: string[] = [];
    if (terminationTotals.max_steps > 0) stabilityReasons.push(`max_steps=${terminationTotals.max_steps}`);
    if (terminationTotals.no_action > 0) stabilityReasons.push(`no_action=${terminationTotals.no_action}`);
    if (terminationTotals.invalid_action > 0) stabilityReasons.push(`invalid_action=${terminationTotals.invalid_action}`);
    const stabilityGate = {
        pass: stabilityReasons.length === 0,
        terminationTotals,
        reasons: stabilityReasons,
    };

    const runtimeGate = checkPhase4RuntimeGate(
        performanceRuns.map(run => run.report),
        manifest.phase4.runtimeGateBaseline,
        manifest.phase4.runtimeGateThresholds,
    );

    const tacticalDelta = evaluatePhase41TacticalKpiDelta(
        toPairingRuns(kpiRuns),
        candidateBotId,
        baselineBotId,
    );
    const tacticalKpiGate = evaluatePromotionTacticalKpiGate(tacticalDelta, cfg.tacticalKpiGate);

    const overallReasons: string[] = [];
    if (!performanceGate.pass) overallReasons.push(...performanceGate.reasons);
    if (!stabilityGate.pass) overallReasons.push(`stability gate failed: ${stabilityGate.reasons.join(' | ')}`);
    if (!runtimeGate.pass) overallReasons.push(`runtime gate failed: ${runtimeGate.reasons.join(' | ')}`);
    if (!tacticalKpiGate.pass) overallReasons.push(`tactical KPI gate failed: ${tacticalKpiGate.reasons.join(' | ')}`);
    const overallPass = overallReasons.length === 0;

    const report: PromotionGateReport = {
        generatedAt: new Date().toISOString(),
        config: {
            artifactTag,
            candidateBotId,
            baselineBotId,
            controlBotId,
            seedSuitePath,
            seedSuiteName,
            holdoutGamesPerRole,
            kpiComparisonGamesPerRole,
            maxSteps,
            enableMulligan,
            measureRuntime,
            suppressLogs,
            outputPath,
        },
        runs: runResults.map(run => ({
            id: run.spec.id,
            player1BotId: run.spec.player1BotId,
            player2BotId: run.spec.player2BotId,
            games: run.report.summary.totalGames,
            artifactPath: run.artifactPath,
            latestArtifactPath: run.latestArtifactPath,
            summary: run.report.summary,
        })),
        gates: {
            performance: performanceGate,
            stability: stabilityGate,
            runtime: runtimeGate,
            tacticalKpi: tacticalKpiGate,
        },
        overall: {
            pass: overallPass,
            reasons: overallReasons,
        },
    };

    writeJson(outputPath, report);
    writeJson(path.join(path.dirname(outputPath), `promotion_gate_${artifactTag}.json`), report);
    console.log(JSON.stringify(report, null, 2));

    if (!overallPass) {
        throw new Error(`Phase4.1 promotion gate failed: ${overallReasons.join(' | ')}`);
    }
}

const maybeMain = process.argv[1] ?? '';
if (maybeMain.endsWith('run_phase41_promotion_gate.ts') || maybeMain.endsWith('run_phase41_promotion_gate.js')) {
    runCli();
}
