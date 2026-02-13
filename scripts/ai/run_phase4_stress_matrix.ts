import fs from 'node:fs';
import path from 'node:path';
import { MatchBatchReport, runMatchBatch, TacticalKpiCounts } from './run_match_batch';
import { loadPhase0Manifest, resolvePhase0ManifestPath } from './phase0_manifest';
import { checkPhase4RuntimeGate, Phase4RuntimeBaseline, Phase4RuntimeGateThresholds } from './phase4_runtime_gate';

interface Phase4MatrixPairing {
    player1BotId: string;
    player2BotId: string;
    games: number;
}

interface Phase4MatrixConfig {
    maxSteps: number;
    enableMulligan: boolean;
    measureRuntime: boolean;
    suppressLogs: boolean;
    startSeed: number;
    pairings: Phase4MatrixPairing[];
    runtimeGate: {
        baseline: Phase4RuntimeBaseline;
        thresholds: Phase4RuntimeGateThresholds;
    };
    phase41KpiDelta: {
        candidateBotId: string;
        baselineBotId: string;
    };
}

interface TacticalKpiSnapshot {
    wasteful_upgrade_rate: number;
    lethal_miss_rate: number;
    self_lethal_open_rate: number;
    counts: TacticalKpiCounts;
}

export interface Phase41TacticalKpiDelta {
    available: boolean;
    candidateBotId: string;
    baselineBotId: string;
    sharedOpponents: string[];
    candidate: TacticalKpiSnapshot | null;
    baseline: TacticalKpiSnapshot | null;
    delta: {
        wasteful_upgrade_rate: number;
        lethal_miss_rate: number;
        self_lethal_open_rate: number;
    } | null;
    note?: string;
}

interface Phase4MatrixSummary {
    totalGames: number;
    terminationTotals: {
        winner: number;
        max_steps: number;
        no_action: number;
        invalid_action: number;
    };
    runtimeGate: ReturnType<typeof checkPhase4RuntimeGate>;
    performanceGate: {
        pass: boolean;
        minStrongV3WinRateVsStrongV2: number;
        strongV3WinRateVsStrongV2: number;
        wins: number;
        games: number;
    };
    phase41TacticalKpiDelta: Phase41TacticalKpiDelta;
}

interface Phase4MatrixReport {
    config: Phase4MatrixConfig;
    runs: Array<{
        pairing: Phase4MatrixPairing;
        report: MatchBatchReport;
    }>;
    summary: Phase4MatrixSummary;
}

function parseFloatEnv(name: string, fallback: number): number {
    const raw = process.env[name];
    if (!raw) return fallback;
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
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

function resolveOutputPath(defaultOutputPath: string): string | undefined {
    const raw = process.env.AI_PHASE4_MATRIX_OUTPUT;
    if (!raw || raw.trim().length === 0) return defaultOutputPath;
    const normalized = raw.trim().toLowerCase();
    if (normalized === '-' || normalized === 'none' || normalized === 'off') return undefined;
    return raw.trim();
}

function writeIfRequested(outputPath: string | undefined, report: Phase4MatrixReport): void {
    if (!outputPath) return;
    const resolved = path.resolve(outputPath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, JSON.stringify(report, null, 2), 'utf8');
}

function parsePairings(raw: string | undefined, fallbackGames: number): Phase4MatrixPairing[] | null {
    if (!raw || raw.trim().length === 0) return null;
    const chunks = raw.split(',').map(v => v.trim()).filter(Boolean);
    if (chunks.length === 0) return null;

    return chunks.map(chunk => {
        const [left, right, gamesRaw] = chunk.split(':').map(v => v.trim());
        if (!left || !right) {
            throw new Error(`Invalid AI_PHASE4_MATRIX_PAIRINGS entry: "${chunk}". Format: p1:p2[:games]`);
        }
        const games = gamesRaw ? Math.max(1, Number.parseInt(gamesRaw, 10)) : fallbackGames;
        return { player1BotId: left, player2BotId: right, games: Number.isFinite(games) ? games : fallbackGames };
    });
}

function collectTerminationTotals(reports: MatchBatchReport[]): Phase4MatrixSummary['terminationTotals'] {
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

function evaluateStrongV3VsStrongV2Performance(
    runs: Phase4MatrixReport['runs'],
    minStrongV3WinRateVsStrongV2: number,
): Phase4MatrixSummary['performanceGate'] {
    let wins = 0;
    let games = 0;

    for (const run of runs) {
        const p1 = run.pairing.player1BotId;
        const p2 = run.pairing.player2BotId;
        if (!((p1 === 'strong-v3' && p2 === 'strong-v2') || (p1 === 'strong-v2' && p2 === 'strong-v3'))) continue;

        games += run.report.summary.totalGames;
        wins += (p1 === 'strong-v3')
            ? run.report.summary.wins.player1
            : run.report.summary.wins.player2;
    }

    const strongV3WinRateVsStrongV2 = games > 0 ? wins / games : 0;
    return {
        pass: games > 0 && strongV3WinRateVsStrongV2 >= minStrongV3WinRateVsStrongV2,
        minStrongV3WinRateVsStrongV2,
        strongV3WinRateVsStrongV2,
        wins,
        games,
    };
}

function roundTo(value: number, digits: number): number {
    const p = 10 ** digits;
    return Math.round(value * p) / p;
}

function safeDivide(numerator: number, denominator: number): number {
    if (denominator <= 0) return 0;
    return numerator / denominator;
}

function emptyTacticalKpiCounts(): TacticalKpiCounts {
    return {
        upgradeActionCount: 0,
        wastefulUpgradeCount: 0,
        lethalOpportunityCount: 0,
        lethalMissCount: 0,
        selfLethalCheckCount: 0,
        selfLethalOpenCount: 0,
    };
}

function mergeTacticalKpiCounts(left: TacticalKpiCounts, right: TacticalKpiCounts): TacticalKpiCounts {
    return {
        upgradeActionCount: left.upgradeActionCount + right.upgradeActionCount,
        wastefulUpgradeCount: left.wastefulUpgradeCount + right.wastefulUpgradeCount,
        lethalOpportunityCount: left.lethalOpportunityCount + right.lethalOpportunityCount,
        lethalMissCount: left.lethalMissCount + right.lethalMissCount,
        selfLethalCheckCount: left.selfLethalCheckCount + right.selfLethalCheckCount,
        selfLethalOpenCount: left.selfLethalOpenCount + right.selfLethalOpenCount,
    };
}

function buildTacticalKpiSnapshot(counts: TacticalKpiCounts): TacticalKpiSnapshot {
    return {
        wasteful_upgrade_rate: roundTo(safeDivide(counts.wastefulUpgradeCount, counts.upgradeActionCount), 4),
        lethal_miss_rate: roundTo(safeDivide(counts.lethalMissCount, counts.lethalOpportunityCount), 4),
        self_lethal_open_rate: roundTo(safeDivide(counts.selfLethalOpenCount, counts.selfLethalCheckCount), 4),
        counts,
    };
}

function collectTacticalCountsByOpponent(
    runs: Phase4MatrixReport['runs'],
    botId: string,
): Map<string, TacticalKpiCounts> {
    const map = new Map<string, TacticalKpiCounts>();

    for (const run of runs) {
        const pairing = run.pairing;
        let opponentId: string | null = null;
        if (pairing.player1BotId === botId) {
            opponentId = pairing.player2BotId;
        } else if (pairing.player2BotId === botId) {
            opponentId = pairing.player1BotId;
        }

        if (!opponentId) continue;

        const counts = pairing.player1BotId === botId
            ? run.report.summary.tacticalKPIs.byPlayer.player1
            : run.report.summary.tacticalKPIs.byPlayer.player2;
        const previous = map.get(opponentId) ?? emptyTacticalKpiCounts();
        map.set(opponentId, mergeTacticalKpiCounts(previous, counts));
    }

    return map;
}

export function evaluatePhase41TacticalKpiDelta(
    runs: Phase4MatrixReport['runs'],
    candidateBotId: string,
    baselineBotId: string,
): Phase41TacticalKpiDelta {
    const candidateByOpponent = collectTacticalCountsByOpponent(runs, candidateBotId);
    const baselineByOpponent = collectTacticalCountsByOpponent(runs, baselineBotId);

    const sharedOpponents = [...candidateByOpponent.keys()]
        .filter(opponent => baselineByOpponent.has(opponent))
        .sort();

    if (sharedOpponents.length === 0) {
        return {
            available: false,
            candidateBotId,
            baselineBotId,
            sharedOpponents: [],
            candidate: null,
            baseline: null,
            delta: null,
            note: `No shared opponents between candidate="${candidateBotId}" and baseline="${baselineBotId}" runs.`,
        };
    }

    let candidateCounts = emptyTacticalKpiCounts();
    let baselineCounts = emptyTacticalKpiCounts();

    for (const opponentId of sharedOpponents) {
        candidateCounts = mergeTacticalKpiCounts(candidateCounts, candidateByOpponent.get(opponentId) ?? emptyTacticalKpiCounts());
        baselineCounts = mergeTacticalKpiCounts(baselineCounts, baselineByOpponent.get(opponentId) ?? emptyTacticalKpiCounts());
    }

    const candidate = buildTacticalKpiSnapshot(candidateCounts);
    const baseline = buildTacticalKpiSnapshot(baselineCounts);

    return {
        available: true,
        candidateBotId,
        baselineBotId,
        sharedOpponents,
        candidate,
        baseline,
        delta: {
            wasteful_upgrade_rate: roundTo(candidate.wasteful_upgrade_rate - baseline.wasteful_upgrade_rate, 4),
            lethal_miss_rate: roundTo(candidate.lethal_miss_rate - baseline.lethal_miss_rate, 4),
            self_lethal_open_rate: roundTo(candidate.self_lethal_open_rate - baseline.self_lethal_open_rate, 4),
        },
    };
}

function runCli(): void {
    const manifest = loadPhase0Manifest(resolvePhase0ManifestPath());
    const phase4 = manifest.phase4;
    const fallbackGames = phase4.stressMatrix.gamesPerPairing;

    const pairings = parsePairings(process.env.AI_PHASE4_MATRIX_PAIRINGS, fallbackGames)
        ?? phase4.stressMatrix.pairings;
    const config: Phase4MatrixConfig = {
        maxSteps: parseIntEnv('AI_PHASE4_MATRIX_MAX_STEPS', phase4.stressMatrix.maxSteps),
        enableMulligan: parseBoolEnv('AI_PHASE4_MATRIX_ENABLE_MULLIGAN', phase4.stressMatrix.enableMulligan),
        measureRuntime: parseBoolEnv('AI_PHASE4_MATRIX_MEASURE_RUNTIME', phase4.stressMatrix.measureRuntime),
        suppressLogs: parseBoolEnv('AI_PHASE4_MATRIX_SUPPRESS_LOGS', true),
        startSeed: parseIntEnv('AI_PHASE4_MATRIX_START_SEED', phase4.stressMatrix.startSeed),
        pairings,
        runtimeGate: {
            baseline: {
                p50MsPerAction: parseFloatEnv('AI_PHASE4_GATE_BASELINE_P50_MS_PER_ACTION', phase4.runtimeGateBaseline.p50MsPerAction),
                p95MsPerAction: parseFloatEnv('AI_PHASE4_GATE_BASELINE_P95_MS_PER_ACTION', phase4.runtimeGateBaseline.p95MsPerAction),
                avgMsPerGame: parseFloatEnv('AI_PHASE4_GATE_BASELINE_AVG_MS_PER_GAME', phase4.runtimeGateBaseline.avgMsPerGame),
            },
            thresholds: {
                p50MsPerActionMultiplier: parseFloatEnv('AI_PHASE4_GATE_P50_MULT', phase4.runtimeGateThresholds.p50MsPerActionMultiplier),
                p95MsPerActionMultiplier: parseFloatEnv('AI_PHASE4_GATE_P95_MULT', phase4.runtimeGateThresholds.p95MsPerActionMultiplier),
                avgMsPerGameMultiplier: parseFloatEnv('AI_PHASE4_GATE_AVG_GAME_MULT', phase4.runtimeGateThresholds.avgMsPerGameMultiplier),
            },
        },
        phase41KpiDelta: {
            candidateBotId: parseStringEnv('AI_PHASE4_KPI_DELTA_CANDIDATE_BOT', 'strong-v3.1-topk3'),
            baselineBotId: parseStringEnv('AI_PHASE4_KPI_DELTA_BASELINE_BOT', 'strong-v3'),
        },
    };

    const runs: Phase4MatrixReport['runs'] = [];
    let nextSeed = config.startSeed;
    for (const pairing of config.pairings) {
        const report = runMatchBatch({
            startSeed: nextSeed,
            games: pairing.games,
            maxSteps: config.maxSteps,
            enableMulligan: config.enableMulligan,
            measureRuntime: config.measureRuntime,
            suppressLogs: config.suppressLogs,
            player1BotId: pairing.player1BotId,
            player2BotId: pairing.player2BotId,
        });
        runs.push({ pairing, report });
        nextSeed += pairing.games;
    }

    const reports = runs.map(run => run.report);
    const totalGames = reports.reduce((sum, report) => sum + report.summary.totalGames, 0);
    const terminationTotals = collectTerminationTotals(reports);
    const runtimeGate = checkPhase4RuntimeGate(
        reports,
        config.runtimeGate.baseline,
        config.runtimeGate.thresholds,
    );
    const performanceGate = evaluateStrongV3VsStrongV2Performance(
        runs,
        manifest.phase4.performanceGate.minStrongV3WinRateVsStrongV2,
    );
    const phase41TacticalKpiDelta = evaluatePhase41TacticalKpiDelta(
        runs,
        config.phase41KpiDelta.candidateBotId,
        config.phase41KpiDelta.baselineBotId,
    );

    const matrixReport: Phase4MatrixReport = {
        config,
        runs,
        summary: {
            totalGames,
            terminationTotals,
            runtimeGate,
            performanceGate,
            phase41TacticalKpiDelta,
        },
    };

    const outputPath = resolveOutputPath(phase4.stressMatrix.outputPath);
    writeIfRequested(outputPath, matrixReport);
    console.log(JSON.stringify(matrixReport, null, 2));

    if (terminationTotals.max_steps > 0 || terminationTotals.no_action > 0 || terminationTotals.invalid_action > 0) {
        throw new Error(
            `Phase4 stress matrix stability gate failed: ${JSON.stringify(terminationTotals)}`,
        );
    }

    if (!runtimeGate.pass) {
        throw new Error(`Phase4 runtime gate failed: ${runtimeGate.reasons.join(' | ')}`);
    }

    if (!performanceGate.pass) {
        throw new Error(
            `Phase4 performance gate failed: strong-v3 winRate vs strong-v2=${performanceGate.strongV3WinRateVsStrongV2.toFixed(4)} `
            + `< required ${performanceGate.minStrongV3WinRateVsStrongV2.toFixed(4)} `
            + `(wins=${performanceGate.wins}, games=${performanceGate.games})`,
        );
    }
}

const maybeMain = process.argv[1] ?? '';
if (maybeMain.endsWith('run_phase4_stress_matrix.ts') || maybeMain.endsWith('run_phase4_stress_matrix.js')) {
    runCli();
}
