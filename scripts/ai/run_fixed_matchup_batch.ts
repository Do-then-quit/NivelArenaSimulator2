import fs from 'node:fs';
import path from 'node:path';
import { Card } from '../../src/logic/types';
import { loadPhase0Manifest, resolvePhase0ManifestPath } from './phase0_manifest';
import { MatchBatchReport, RunMatchBatchConfig, TacticalKpiCounts, runMatchBatch } from './run_match_batch';
import { parseSeedListCsv, resolveSeedSuiteSeeds, SeedSuiteName } from './seed_suites';
import { resolveFixedMatchup } from './fixed_matchup/registry';

export interface RunFixedMatchupBatchConfig {
    matchupId: string;
    gamesPerSide: number;
    maxSteps: number;
    enableMulligan: boolean;
    traceLimit?: number;
    startSeed: number;
    player1BotId: string;
    player2BotId: string;
    measureRuntime: boolean;
    suppressLogs: boolean;
    seedList?: number[];
    seedSuiteName?: SeedSuiteName;
    seedSuitePath?: string;
}

export interface FixedMatchupBatchReport {
    generatedAt: string;
    matchup: {
        id: string;
        label: string;
        description?: string;
        player1DeckId: string;
        player2DeckId: string;
    };
    decks: {
        player1: {
            id: string;
            label: string;
            leaderId: string;
            notes?: string[];
        };
        player2: {
            id: string;
            label: string;
            leaderId: string;
            notes?: string[];
        };
    };
    config: RunFixedMatchupBatchConfig & {
        seedList: number[];
    };
    sides: {
        primary: MatchBatchReport;
        swapped: MatchBatchReport;
    };
    combined: {
        totalGames: number;
        wins: {
            player1Bot: number;
            player2Bot: number;
        };
        winRate: {
            player1Bot: number;
            player2Bot: number;
        };
        unfinished: number;
        avgSteps: number;
        avgTurns: number;
        terminationCounts: MatchBatchReport['summary']['terminationCounts'];
        confidence: {
            player1BotWinRate: MatchBatchReport['summary']['confidence']['player1WinRate'];
            player2BotWinRate: MatchBatchReport['summary']['confidence']['player2WinRate'];
        };
        runtime: MatchBatchReport['summary']['runtime'];
        tacticalKPIs: MatchBatchReport['summary']['tacticalKPIs'];
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

function clamp01(value: number): number {
    if (value < 0) return 0;
    if (value > 1) return 1;
    return value;
}

function computeBinomialRateStats(successes: number, total: number): MatchBatchReport['summary']['confidence']['player1WinRate'] {
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

function mergeTacticalCounts(left: TacticalKpiCounts, right: TacticalKpiCounts): TacticalKpiCounts {
    return {
        upgradeActionCount: left.upgradeActionCount + right.upgradeActionCount,
        wastefulUpgradeCount: left.wastefulUpgradeCount + right.wastefulUpgradeCount,
        lethalOpportunityCount: left.lethalOpportunityCount + right.lethalOpportunityCount,
        lethalMissCount: left.lethalMissCount + right.lethalMissCount,
        selfLethalCheckCount: left.selfLethalCheckCount + right.selfLethalCheckCount,
        selfLethalOpenCount: left.selfLethalOpenCount + right.selfLethalOpenCount,
    };
}

function resolveOutputPath(defaultOutputPath: string): string | undefined {
    const raw = process.env.AI_FIXED_BENCH_OUTPUT;
    if (!raw || raw.trim().length === 0) return defaultOutputPath;
    const normalized = raw.trim().toLowerCase();
    if (normalized === '-' || normalized === 'none' || normalized === 'off') return undefined;
    return raw.trim();
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

function parseSeedSuiteName(raw: string | undefined): SeedSuiteName | undefined {
    if (!raw) return undefined;
    const normalized = raw.trim().toLowerCase();
    if (normalized === 'tuning' || normalized === 'dev' || normalized === 'promotion-holdout') {
        return normalized;
    }
    return undefined;
}

function writeIfRequested(outputPath: string | undefined, report: FixedMatchupBatchReport): void {
    if (!outputPath) return;
    const resolved = path.resolve(outputPath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, JSON.stringify(report, null, 2), 'utf8');
}

function cloneDeckSource(deck: Card[]): Card[] {
    return deck.map(card => ({ ...card }));
}

function resolveSeeds(config: RunFixedMatchupBatchConfig): number[] {
    if (config.seedList && config.seedList.length > 0) {
        return [...config.seedList];
    }

    if (config.seedSuiteName) {
        const suitePath = config.seedSuitePath ?? 'artifacts/ai/seeds/phase3_v1.json';
        const resolved = resolveSeedSuiteSeeds(suitePath, config.seedSuiteName);
        if (resolved.seeds.length < config.gamesPerSide) {
            throw new Error(
                `Seed suite "${config.seedSuiteName}" has only ${resolved.seeds.length} seeds; ${config.gamesPerSide} required.`,
            );
        }
        return resolved.seeds.slice(0, config.gamesPerSide);
    }

    return Array.from({ length: config.gamesPerSide }, (_v, index) => config.startSeed + index);
}

function runSingleSideBatch(
    config: RunFixedMatchupBatchConfig,
    seeds: number[],
    player1Deck: Card[],
    player1Leader: Card,
    player2Deck: Card[],
    player2Leader: Card,
): MatchBatchReport {
    const batchConfig: RunMatchBatchConfig = {
        startSeed: seeds[0] ?? config.startSeed,
        games: seeds.length,
        maxSteps: config.maxSteps,
        enableMulligan: config.enableMulligan,
        traceLimit: config.traceLimit,
        player1BotId: config.player1BotId,
        player2BotId: config.player2BotId,
        measureRuntime: config.measureRuntime,
        suppressLogs: config.suppressLogs,
        seedList: [...seeds],
        seedSuiteName: config.seedSuiteName,
        seedSuitePath: config.seedSuitePath,
        player1Deck: cloneDeckSource(player1Deck),
        player2Deck: cloneDeckSource(player2Deck),
        player1Leader: { ...player1Leader },
        player2Leader: { ...player2Leader },
    };
    return runMatchBatch(batchConfig);
}

export function runFixedMatchupBatch(config: RunFixedMatchupBatchConfig): FixedMatchupBatchReport {
    const seeds = resolveSeeds(config);
    const matchup = resolveFixedMatchup(config.matchupId);

    const primary = runSingleSideBatch(
        config,
        seeds,
        matchup.player1.deck,
        matchup.player1.leader,
        matchup.player2.deck,
        matchup.player2.leader,
    );
    const swapped = runSingleSideBatch(
        config,
        seeds,
        matchup.player2.deck,
        matchup.player2.leader,
        matchup.player1.deck,
        matchup.player1.leader,
    );

    const totalGames = primary.summary.totalGames + swapped.summary.totalGames;
    const winsPlayer1Bot = primary.summary.wins.player1 + swapped.summary.wins.player1;
    const winsPlayer2Bot = primary.summary.wins.player2 + swapped.summary.wins.player2;
    const unfinished = primary.summary.unfinished + swapped.summary.unfinished;
    const totalSteps = primary.matches.reduce((sum, match) => sum + match.steps, 0)
        + swapped.matches.reduce((sum, match) => sum + match.steps, 0);
    const totalTurns = primary.matches.reduce((sum, match) => sum + match.turnCount, 0)
        + swapped.matches.reduce((sum, match) => sum + match.turnCount, 0);
    const runtimeEnabled = primary.summary.runtime.enabled || swapped.summary.runtime.enabled;
    const totalRuntimeMs = primary.summary.runtime.totalMs + swapped.summary.runtime.totalMs;
    const tacticalCounts = mergeTacticalCounts(
        primary.summary.tacticalKPIs.counts,
        swapped.summary.tacticalKPIs.counts,
    );

    const combined: FixedMatchupBatchReport['combined'] = {
        totalGames,
        wins: {
            player1Bot: winsPlayer1Bot,
            player2Bot: winsPlayer2Bot,
        },
        winRate: {
            player1Bot: roundTo(safeDivide(winsPlayer1Bot, totalGames), 4),
            player2Bot: roundTo(safeDivide(winsPlayer2Bot, totalGames), 4),
        },
        unfinished,
        avgSteps: roundTo(safeDivide(totalSteps, totalGames), 2),
        avgTurns: roundTo(safeDivide(totalTurns, totalGames), 2),
        terminationCounts: {
            winner: primary.summary.terminationCounts.winner + swapped.summary.terminationCounts.winner,
            max_steps: primary.summary.terminationCounts.max_steps + swapped.summary.terminationCounts.max_steps,
            no_action: primary.summary.terminationCounts.no_action + swapped.summary.terminationCounts.no_action,
            invalid_action: primary.summary.terminationCounts.invalid_action + swapped.summary.terminationCounts.invalid_action,
        },
        confidence: {
            player1BotWinRate: computeBinomialRateStats(winsPlayer1Bot, totalGames),
            player2BotWinRate: computeBinomialRateStats(winsPlayer2Bot, totalGames),
        },
        runtime: runtimeEnabled
            ? {
                enabled: true,
                totalMs: roundTo(totalRuntimeMs, 2),
                avgMsPerGame: roundTo(safeDivide(totalRuntimeMs, totalGames), 2),
                msPerAction: roundTo(safeDivide(totalRuntimeMs, totalSteps), 4),
            }
            : {
                enabled: false,
                totalMs: 0,
                avgMsPerGame: 0,
                msPerAction: 0,
            },
        tacticalKPIs: {
            wasteful_upgrade_rate: roundTo(
                safeDivide(tacticalCounts.wastefulUpgradeCount, tacticalCounts.upgradeActionCount),
                4,
            ),
            lethal_miss_rate: roundTo(
                safeDivide(tacticalCounts.lethalMissCount, tacticalCounts.lethalOpportunityCount),
                4,
            ),
            self_lethal_open_rate: roundTo(
                safeDivide(tacticalCounts.selfLethalOpenCount, tacticalCounts.selfLethalCheckCount),
                4,
            ),
            counts: tacticalCounts,
            byPlayer: {
                player1: mergeTacticalCounts(
                    primary.summary.tacticalKPIs.byPlayer.player1,
                    swapped.summary.tacticalKPIs.byPlayer.player1,
                ),
                player2: mergeTacticalCounts(
                    primary.summary.tacticalKPIs.byPlayer.player2,
                    swapped.summary.tacticalKPIs.byPlayer.player2,
                ),
            },
        },
    };

    return {
        generatedAt: new Date().toISOString(),
        matchup: {
            id: matchup.definition.id,
            label: matchup.definition.label,
            description: matchup.definition.description,
            player1DeckId: matchup.definition.player1DeckId,
            player2DeckId: matchup.definition.player2DeckId,
        },
        decks: {
            player1: {
                id: matchup.player1.definition.id,
                label: matchup.player1.definition.label,
                leaderId: matchup.player1.definition.leaderId,
                notes: matchup.player1.definition.notes ? [...matchup.player1.definition.notes] : undefined,
            },
            player2: {
                id: matchup.player2.definition.id,
                label: matchup.player2.definition.label,
                leaderId: matchup.player2.definition.leaderId,
                notes: matchup.player2.definition.notes ? [...matchup.player2.definition.notes] : undefined,
            },
        },
        config: {
            ...config,
            seedList: [...seeds],
        },
        sides: {
            primary,
            swapped,
        },
        combined,
    };
}

function runCli(): void {
    const manifest = loadPhase0Manifest(resolvePhase0ManifestPath());
    const seedSuiteRaw = process.env.AI_FIXED_BENCH_SEED_SUITE ?? manifest.fixedMatchupBench.seedSuiteName;
    const seedSuiteName = parseSeedSuiteName(seedSuiteRaw);
    if (seedSuiteRaw && seedSuiteRaw.trim().length > 0 && !seedSuiteName) {
        throw new Error(`Unsupported AI_FIXED_BENCH_SEED_SUITE value: "${seedSuiteRaw}"`);
    }

    const envSeedList = parseSeedListCsv(process.env.AI_FIXED_BENCH_SEED_LIST);
    const config: RunFixedMatchupBatchConfig = {
        matchupId: process.env.AI_FIXED_BENCH_MATCHUP ?? manifest.fixedMatchupBench.matchupId,
        gamesPerSide: parseIntEnv('AI_FIXED_BENCH_GAMES_PER_SIDE', manifest.fixedMatchupBench.gamesPerSide),
        maxSteps: parseIntEnv('AI_FIXED_BENCH_MAX_STEPS', manifest.fixedMatchupBench.maxSteps),
        enableMulligan: parseBoolEnv('AI_FIXED_BENCH_ENABLE_MULLIGAN', manifest.fixedMatchupBench.enableMulligan),
        traceLimit: parseIntEnv('AI_FIXED_BENCH_TRACE_LIMIT', manifest.fixedMatchupBench.traceLimit),
        startSeed: parseIntEnv('AI_FIXED_BENCH_START_SEED', manifest.fixedMatchupBench.startSeed),
        player1BotId: process.env.AI_FIXED_BENCH_P1_BOT ?? manifest.fixedMatchupBench.player1BotId,
        player2BotId: process.env.AI_FIXED_BENCH_P2_BOT ?? manifest.fixedMatchupBench.player2BotId,
        measureRuntime: parseBoolEnv('AI_FIXED_BENCH_MEASURE_RUNTIME', false),
        suppressLogs: parseBoolEnv('AI_FIXED_BENCH_SUPPRESS_LOGS', false),
        seedList: envSeedList,
        seedSuiteName,
        seedSuitePath: seedSuiteName
            ? (process.env.AI_FIXED_BENCH_SEED_SUITE_PATH ?? manifest.fixedMatchupBench.seedSuitePath)
            : undefined,
    };

    const report = runFixedMatchupBatch(config);
    writeIfRequested(resolveOutputPath(manifest.fixedMatchupBench.outputPath), report);
    console.log(JSON.stringify(report, null, 2));
}

const maybeMain = process.argv[1] ?? '';
if (maybeMain.endsWith('run_fixed_matchup_batch.ts') || maybeMain.endsWith('run_fixed_matchup_batch.js')) {
    runCli();
}
