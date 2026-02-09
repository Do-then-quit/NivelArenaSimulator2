import fs from 'node:fs';
import path from 'node:path';
import { MatchReport, MatchTerminationReason, runSingleMatch } from './match_harness';
import { loadPhase0Manifest, resolvePhase0ManifestPath } from './phase0_manifest';

export interface RunMatchBatchConfig {
    startSeed: number;
    games: number;
    maxSteps: number;
    enableMulligan: boolean;
    traceLimit?: number;
}

export interface MatchBatchReport {
    config: RunMatchBatchConfig;
    matches: MatchReport[];
    summary: {
        totalGames: number;
        wins: {
            player1: number;
            player2: number;
        };
        winRate: {
            player1: number;
            player2: number;
        };
        unfinished: number;
        avgSteps: number;
        avgTurns: number;
        terminationCounts: Record<MatchTerminationReason, number>;
        confidence: {
            player1WinRate: BinomialRateStats;
            player2WinRate: BinomialRateStats;
        };
    };
}

export interface BinomialRateStats {
    pointEstimate: number;
    standardError: number;
    ci95Low: number;
    ci95High: number;
}

function safeDivide(numerator: number, denominator: number): number {
    if (denominator <= 0) return 0;
    return numerator / denominator;
}

function clamp01(value: number): number {
    if (value < 0) return 0;
    if (value > 1) return 1;
    return value;
}

function roundTo(value: number, digits: number): number {
    const p = 10 ** digits;
    return Math.round(value * p) / p;
}

function computeBinomialRateStats(successes: number, total: number): BinomialRateStats {
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

export function runMatchBatch(config: RunMatchBatchConfig): MatchBatchReport {
    const matches: MatchReport[] = [];
    for (let i = 0; i < config.games; i++) {
        matches.push(
            runSingleMatch({
                seed: config.startSeed + i,
                maxSteps: config.maxSteps,
                enableMulligan: config.enableMulligan,
                traceLimit: config.traceLimit,
            }),
        );
    }

    const winsPlayer1 = matches.filter(match => match.reason === 'winner' && match.winnerPlayer === 1).length;
    const winsPlayer2 = matches.filter(match => match.reason === 'winner' && match.winnerPlayer === 2).length;
    const unfinished = matches.length - winsPlayer1 - winsPlayer2;
    const totalSteps = matches.reduce((sum, match) => sum + match.steps, 0);
    const totalTurns = matches.reduce((sum, match) => sum + match.turnCount, 0);
    const player1Confidence = computeBinomialRateStats(winsPlayer1, matches.length);
    const player2Confidence = computeBinomialRateStats(winsPlayer2, matches.length);

    const terminationCounts = matches.reduce<Record<MatchTerminationReason, number>>(
        (acc, match) => {
            acc[match.reason] += 1;
            return acc;
        },
        { winner: 0, max_steps: 0, no_action: 0, invalid_action: 0 },
    );

    return {
        config: { ...config },
        matches,
        summary: {
            totalGames: matches.length,
            wins: {
                player1: winsPlayer1,
                player2: winsPlayer2,
            },
            winRate: {
                player1: roundTo(safeDivide(winsPlayer1, matches.length), 4),
                player2: roundTo(safeDivide(winsPlayer2, matches.length), 4),
            },
            unfinished,
            avgSteps: roundTo(safeDivide(totalSteps, matches.length), 2),
            avgTurns: roundTo(safeDivide(totalTurns, matches.length), 2),
            terminationCounts,
            confidence: {
                player1WinRate: player1Confidence,
                player2WinRate: player2Confidence,
            },
        },
    };
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
    const raw = process.env.AI_BENCH_OUTPUT;
    if (!raw || raw.trim().length === 0) {
        return defaultOutputPath;
    }

    const normalized = raw.trim().toLowerCase();
    if (normalized === '-' || normalized === 'none' || normalized === 'off') {
        return undefined;
    }

    return raw.trim();
}

function writeIfRequested(outputPath: string | undefined, report: MatchBatchReport): void {
    if (!outputPath) return;
    const resolved = path.resolve(outputPath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, JSON.stringify(report, null, 2), 'utf8');
}

function runCli(): void {
    const manifest = loadPhase0Manifest(resolvePhase0ManifestPath());
    const config: RunMatchBatchConfig = {
        startSeed: parseIntEnv('AI_BENCH_START_SEED', manifest.bench.startSeed),
        games: parseIntEnv('AI_BENCH_GAMES', manifest.bench.games),
        maxSteps: parseIntEnv('AI_BENCH_MAX_STEPS', manifest.bench.maxSteps),
        enableMulligan: parseBoolEnv('AI_BENCH_ENABLE_MULLIGAN', manifest.bench.enableMulligan),
        traceLimit: parseIntEnv('AI_BENCH_TRACE_LIMIT', manifest.bench.traceLimit),
    };

    const report = runMatchBatch(config);
    writeIfRequested(resolveOutputPath(manifest.bench.outputPath), report);
    console.log(JSON.stringify(report, null, 2));
}

const maybeMain = process.argv[1] ?? '';
if (maybeMain.endsWith('run_match_batch.ts') || maybeMain.endsWith('run_match_batch.js')) {
    runCli();
}
