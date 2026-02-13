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
    startSeed: number;
    pairings: Phase4MatrixPairing[];
    runtimeGate: {
        baseline: Phase4RuntimeBaseline;
        thresholds: Phase4RuntimeGateThresholds;
    };
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

    const matrixReport: Phase4MatrixReport = {
        config,
        runs,
        summary: {
            totalGames,
            terminationTotals,
            runtimeGate,
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
}

runCli();
