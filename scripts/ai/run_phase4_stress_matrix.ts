import fs from 'node:fs';
import path from 'node:path';
import { MatchBatchReport, runMatchBatch } from './run_match_batch';
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
}

interface TacticalKPIBaseline {
    wasteful_upgrade_rate: number;
    lethal_miss_rate: number;
    self_lethal_open_rate: number;
}

interface SearchCoverageBaseline {
    rootExploredRate: number;
    interactionExploredRate: number;
}

export interface Phase4MatrixSummary {
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
    tacticalKPIDelta: {
        baseline: TacticalKPIBaseline;
        current: TacticalKPIBaseline;
        delta: TacticalKPIBaseline;
    };
    searchCoverage: {
        baseline: SearchCoverageBaseline;
        current: SearchCoverageBaseline;
        delta: SearchCoverageBaseline;
        counts: {
            rootDecisionCount: number;
            rootLegalActionCount: number;
            rootExploredActionCount: number;
            interactionDecisionCount: number;
            interactionLegalActionCount: number;
            interactionExploredActionCount: number;
        };
    };
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

export function buildPhase4MatrixSummary(
    reports: MatchBatchReport[],
    runs: Phase4MatrixReport['runs'],
    runtimeGate: ReturnType<typeof checkPhase4RuntimeGate>,
    minStrongV3WinRateVsStrongV2: number,
): Phase4MatrixSummary {
    const totalGames = reports.reduce((sum, report) => sum + report.summary.totalGames, 0);
    const terminationTotals = collectTerminationTotals(reports);
    const performanceGate = evaluateStrongV3VsStrongV2Performance(runs, minStrongV3WinRateVsStrongV2);

    const currentTactical: TacticalKPIBaseline = {
        wasteful_upgrade_rate: roundTo(reports.reduce((sum, report) => sum + report.summary.tacticalKPIs.wasteful_upgrade_rate, 0) / Math.max(1, reports.length), 4),
        lethal_miss_rate: roundTo(reports.reduce((sum, report) => sum + report.summary.tacticalKPIs.lethal_miss_rate, 0) / Math.max(1, reports.length), 4),
        self_lethal_open_rate: roundTo(reports.reduce((sum, report) => sum + report.summary.tacticalKPIs.self_lethal_open_rate, 0) / Math.max(1, reports.length), 4),
    };
    const baselineTactical: TacticalKPIBaseline = {
        wasteful_upgrade_rate: parseFloatEnv('AI_PHASE4_BASELINE_WASTEFUL_UPGRADE_RATE', currentTactical.wasteful_upgrade_rate),
        lethal_miss_rate: parseFloatEnv('AI_PHASE4_BASELINE_LETHAL_MISS_RATE', currentTactical.lethal_miss_rate),
        self_lethal_open_rate: parseFloatEnv('AI_PHASE4_BASELINE_SELF_LETHAL_OPEN_RATE', currentTactical.self_lethal_open_rate),
    };

    const currentCoverage: SearchCoverageBaseline = {
        rootExploredRate: roundTo(reports.reduce((sum, report) => sum + report.summary.searchCoverage.root.exploredRate, 0) / Math.max(1, reports.length), 4),
        interactionExploredRate: roundTo(reports.reduce((sum, report) => sum + report.summary.searchCoverage.interaction.exploredRate, 0) / Math.max(1, reports.length), 4),
    };
    const baselineCoverage: SearchCoverageBaseline = {
        rootExploredRate: parseFloatEnv('AI_PHASE4_BASELINE_ROOT_COVERAGE', currentCoverage.rootExploredRate),
        interactionExploredRate: parseFloatEnv('AI_PHASE4_BASELINE_INTERACTION_COVERAGE', currentCoverage.interactionExploredRate),
    };

    const coverageCounts = reports.reduce(
        (acc, report) => {
            acc.rootDecisionCount += report.summary.searchCoverage.root.decisionCount;
            acc.rootLegalActionCount += report.summary.searchCoverage.root.legalActionCount;
            acc.rootExploredActionCount += report.summary.searchCoverage.root.exploredActionCount;
            acc.interactionDecisionCount += report.summary.searchCoverage.interaction.decisionCount;
            acc.interactionLegalActionCount += report.summary.searchCoverage.interaction.legalActionCount;
            acc.interactionExploredActionCount += report.summary.searchCoverage.interaction.exploredActionCount;
            return acc;
        },
        {
            rootDecisionCount: 0,
            rootLegalActionCount: 0,
            rootExploredActionCount: 0,
            interactionDecisionCount: 0,
            interactionLegalActionCount: 0,
            interactionExploredActionCount: 0,
        },
    );

    return {
        totalGames,
        terminationTotals,
        runtimeGate,
        performanceGate,
        tacticalKPIDelta: {
            baseline: baselineTactical,
            current: currentTactical,
            delta: {
                wasteful_upgrade_rate: roundTo(currentTactical.wasteful_upgrade_rate - baselineTactical.wasteful_upgrade_rate, 4),
                lethal_miss_rate: roundTo(currentTactical.lethal_miss_rate - baselineTactical.lethal_miss_rate, 4),
                self_lethal_open_rate: roundTo(currentTactical.self_lethal_open_rate - baselineTactical.self_lethal_open_rate, 4),
            },
        },
        searchCoverage: {
            baseline: baselineCoverage,
            current: currentCoverage,
            delta: {
                rootExploredRate: roundTo(currentCoverage.rootExploredRate - baselineCoverage.rootExploredRate, 4),
                interactionExploredRate: roundTo(currentCoverage.interactionExploredRate - baselineCoverage.interactionExploredRate, 4),
            },
            counts: coverageCounts,
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
    const runtimeGate = checkPhase4RuntimeGate(
        reports,
        config.runtimeGate.baseline,
        config.runtimeGate.thresholds,
    );
    const summary = buildPhase4MatrixSummary(
        reports,
        runs,
        runtimeGate,
        manifest.phase4.performanceGate.minStrongV3WinRateVsStrongV2,
    );

    const matrixReport: Phase4MatrixReport = {
        config,
        runs,
        summary,
    };

    const outputPath = resolveOutputPath(phase4.stressMatrix.outputPath);
    writeIfRequested(outputPath, matrixReport);
    console.log(JSON.stringify(matrixReport, null, 2));

    if (summary.terminationTotals.max_steps > 0 || summary.terminationTotals.no_action > 0 || summary.terminationTotals.invalid_action > 0) {
        throw new Error(
            `Phase4 stress matrix stability gate failed: ${JSON.stringify(summary.terminationTotals)}`,
        );
    }

    if (!runtimeGate.pass) {
        throw new Error(`Phase4 runtime gate failed: ${runtimeGate.reasons.join(' | ')}`);
    }

    if (!summary.performanceGate.pass) {
        throw new Error(
            `Phase4 performance gate failed: strong-v3 winRate vs strong-v2=${summary.performanceGate.strongV3WinRateVsStrongV2.toFixed(4)} `
            + `< required ${summary.performanceGate.minStrongV3WinRateVsStrongV2.toFixed(4)} `
            + `(wins=${summary.performanceGate.wins}, games=${summary.performanceGate.games})`,
        );
    }
}

const maybeMain = process.argv[1] ?? "";
if (maybeMain.endsWith('run_phase4_stress_matrix.ts') || maybeMain.endsWith('run_phase4_stress_matrix.js')) {
    runCli();
}
