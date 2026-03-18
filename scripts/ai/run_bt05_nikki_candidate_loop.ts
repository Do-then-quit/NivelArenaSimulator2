import fs from 'node:fs';
import path from 'node:path';
import { resolveBotFactory } from './bot_registry';
import { resolveFixedMatchup } from './fixed_matchup/registry';
import { BotFactory, MatchReport, runSingleMatch } from './match_harness';
import { loadPhase0Manifest, resolvePhase0ManifestPath } from './phase0_manifest';
import {
    FixedMatchupBatchReport,
    TacticalKpiCounts,
} from './run_fixed_matchup_batch';
import { parseSeedListCsv, resolveSeedSuiteSeeds, SeedSuiteName } from './seed_suites';

export interface NikkiCandidateLoopConfig {
    matchupId: string;
    incumbentBotId: string;
    candidateBotId: string;
    rounds: number;
    gamesPerSide: number;
    maxSteps: number;
    enableMulligan: boolean;
    traceLimit?: number;
    startSeed: number;
    seedStride: number;
    measureRuntime: boolean;
    suppressLogs: boolean;
    seedList?: number[];
    seedSuiteName?: SeedSuiteName;
    seedSuitePath?: string;
    outputPath?: string;
}

export interface NikkiCandidateLoopRoleSummary {
    games: number;
    wins: number;
    winRate: number;
    confidence: {
        pointEstimate: number;
        standardError: number;
        ci95Low: number;
        ci95High: number;
    };
    tacticalKPIs: {
        wasteful_upgrade_rate: number;
        lethal_miss_rate: number;
        self_lethal_open_rate: number;
        counts: TacticalKpiCounts;
    };
}

export interface NikkiCandidateLoopRoundReport {
    roundIndex: number;
    seedList: number[];
    artifactPath: string;
    report: FixedMatchupBatchReport;
}

export interface NikkiCandidateLoopDiagnosticSlice {
    label: string;
    roundStartIndex: number;
    roundEndIndex: number;
    roundCount: number;
    seedLabel: string;
    totalGames: number;
    candidateWins: number;
    incumbentWins: number;
    candidateWinRate: number;
    incumbentWinRate: number;
    netWins: number;
    winRateDelta: number;
    avgSteps: number;
    avgTurns: number;
}

export interface NikkiCandidateLoopDiagnostics {
    bucketRoundSize: number;
    roundSlices: NikkiCandidateLoopDiagnosticSlice[];
    bucketSlices: NikkiCandidateLoopDiagnosticSlice[];
}

export interface NikkiCandidateLoopReport {
    generatedAt: string;
    config: NikkiCandidateLoopConfig & {
        resolvedRounds: number;
        resolvedGamesPerSide: number;
    };
    rounds: NikkiCandidateLoopRoundReport[];
    summary: {
        rounds: number;
        totalGames: number;
        candidate: NikkiCandidateLoopRoleSummary;
        incumbent: NikkiCandidateLoopRoleSummary;
        delta: {
            winRate: number;
            wasteful_upgrade_rate: number;
            lethal_miss_rate: number;
            self_lethal_open_rate: number;
        };
        terminationCounts: FixedMatchupBatchReport['combined']['terminationCounts'];
        avgSteps: number;
        avgTurns: number;
        diagnostics: NikkiCandidateLoopDiagnostics;
    };
}

interface CandidateLoopArtifactPaths {
    latestPath?: string;
    archivePath?: string;
    runsDir?: string;
}

interface RoundSeedSource {
    seedList: number[];
}

interface RunLoopOptions {
    candidateBotFactory?: BotFactory;
    incumbentBotFactory?: BotFactory;
    runRound?: (config: NikkiCandidateLoopConfig, seedList: number[]) => FixedMatchupBatchReport;
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

function computeBinomialRateStats(successes: number, total: number): NikkiCandidateLoopRoleSummary['confidence'] {
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

function sanitizeArtifactSegment(value: string): string {
    const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return normalized.replace(/^-+|-+$/g, '') || 'unknown';
}

function summarizeSeedList(seedList: number[]): string {
    if (seedList.length === 0) return 'no-seeds';

    const first = seedList[0];
    const last = seedList[seedList.length - 1];
    const isSequential = seedList.every((seed, index) => seed === first + index);

    if (seedList.length === 1) {
        return `seed-${first}`;
    }

    if (isSequential) {
        return `seed-${first}-to-${last}`;
    }

    if (seedList.length <= 4) {
        return `seeds-${seedList.join('-')}`;
    }

    return `seeds-${first}-to-${last}-n${seedList.length}`;
}

function emptyTacticalCounts(): TacticalKpiCounts {
    return {
        upgradeActionCount: 0,
        wastefulUpgradeCount: 0,
        lethalOpportunityCount: 0,
        lethalMissCount: 0,
        selfLethalCheckCount: 0,
        selfLethalOpenCount: 0,
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

function buildTacticalSummary(counts: TacticalKpiCounts): NikkiCandidateLoopRoleSummary['tacticalKPIs'] {
    return {
        wasteful_upgrade_rate: roundTo(safeDivide(counts.wastefulUpgradeCount, counts.upgradeActionCount), 4),
        lethal_miss_rate: roundTo(safeDivide(counts.lethalMissCount, counts.lethalOpportunityCount), 4),
        self_lethal_open_rate: roundTo(safeDivide(counts.selfLethalOpenCount, counts.selfLethalCheckCount), 4),
        counts,
    };
}

function collectUniqueSeeds(rounds: NikkiCandidateLoopRoundReport[]): number[] {
    const uniqueSeeds: number[] = [];
    const seen = new Set<number>();

    for (const round of rounds) {
        for (const seed of round.seedList) {
            if (seen.has(seed)) continue;
            seen.add(seed);
            uniqueSeeds.push(seed);
        }
    }

    return uniqueSeeds;
}

function sumRoundSteps(round: NikkiCandidateLoopRoundReport): number {
    return round.report.sides.primary.matches.reduce((sum, match) => sum + match.steps, 0)
        + round.report.sides.swapped.matches.reduce((sum, match) => sum + match.steps, 0);
}

function sumRoundTurns(round: NikkiCandidateLoopRoundReport): number {
    return round.report.sides.primary.matches.reduce((sum, match) => sum + match.turnCount, 0)
        + round.report.sides.swapped.matches.reduce((sum, match) => sum + match.turnCount, 0);
}

function buildDiagnosticSlice(
    rounds: NikkiCandidateLoopRoundReport[],
    roundStartIndex: number,
    roundEndIndex: number,
    label: string,
): NikkiCandidateLoopDiagnosticSlice {
    let candidateWins = 0;
    let incumbentWins = 0;
    let totalGames = 0;
    let totalSteps = 0;
    let totalTurns = 0;

    for (const round of rounds) {
        const combined = round.report.combined;
        candidateWins += combined.wins.player1Bot;
        incumbentWins += combined.wins.player2Bot;
        totalGames += combined.totalGames;
        totalSteps += sumRoundSteps(round);
        totalTurns += sumRoundTurns(round);
    }

    const seedLabel = summarizeSeedList(collectUniqueSeeds(rounds));
    return {
        label,
        roundStartIndex,
        roundEndIndex,
        roundCount: rounds.length,
        seedLabel,
        totalGames,
        candidateWins,
        incumbentWins,
        candidateWinRate: roundTo(safeDivide(candidateWins, totalGames), 4),
        incumbentWinRate: roundTo(safeDivide(incumbentWins, totalGames), 4),
        netWins: candidateWins - incumbentWins,
        winRateDelta: roundTo(safeDivide(candidateWins - incumbentWins, totalGames), 4),
        avgSteps: roundTo(safeDivide(totalSteps, totalGames), 2),
        avgTurns: roundTo(safeDivide(totalTurns, totalGames), 2),
    };
}

function buildDiagnostics(rounds: NikkiCandidateLoopRoundReport[]): NikkiCandidateLoopDiagnostics {
    const roundSlices = rounds.map(round => buildDiagnosticSlice(
        [round],
        round.roundIndex,
        round.roundIndex,
        `round ${round.roundIndex + 1}`,
    ));
    const bucketRoundSize = Math.max(1, Math.ceil(rounds.length / 4));
    const bucketSlices: NikkiCandidateLoopDiagnosticSlice[] = [];

    for (let start = 0; start < rounds.length; start += bucketRoundSize) {
        const end = Math.min(rounds.length - 1, start + bucketRoundSize - 1);
        bucketSlices.push(buildDiagnosticSlice(
            rounds.slice(start, end + 1),
            start,
            end,
            `rounds ${start + 1}-${end + 1}`,
        ));
    }

    return {
        bucketRoundSize,
        roundSlices,
        bucketSlices,
    };
}

function resolveOutputPath(defaultOutputPath: string): string | undefined {
    const raw = process.env.AI_NIKKI_LOOP_OUTPUT;
    if (!raw || raw.trim().length === 0) return defaultOutputPath;
    const normalized = raw.trim().toLowerCase();
    if (normalized === '-' || normalized === 'none' || normalized === 'off') return undefined;
    return raw.trim();
}

function writeJson(targetPath: string | undefined, value: unknown): void {
    if (!targetPath) return;
    const resolved = path.resolve(targetPath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, JSON.stringify(value, null, 2), 'utf8');
}

function buildArchiveSlug(config: NikkiCandidateLoopConfig): string {
    const seedDescriptor = config.seedSuiteName
        ? `suite-${sanitizeArtifactSegment(config.seedSuiteName)}`
        : summarizeSeedList(config.seedList ?? [config.startSeed]);

    return [
        sanitizeArtifactSegment(config.matchupId),
        `cand-${sanitizeArtifactSegment(config.candidateBotId)}`,
        `inc-${sanitizeArtifactSegment(config.incumbentBotId)}`,
        seedDescriptor,
        `r${config.rounds}`,
        `g${config.gamesPerSide}`,
    ].join('__');
}

export function buildNikkiCandidateLoopArtifactPaths(
    outputPath: string,
    config: NikkiCandidateLoopConfig,
): CandidateLoopArtifactPaths {
    const latestPath = path.resolve(outputPath);
    const runsDir = path.join(path.dirname(latestPath), 'runs');
    const archiveSlug = buildArchiveSlug(config);

    return {
        latestPath,
        archivePath: path.join(runsDir, `${archiveSlug}.json`),
        runsDir,
    };
}

function resolveRoundSeedSource(config: NikkiCandidateLoopConfig, roundIndex: number): RoundSeedSource {
    if (config.seedSuiteName) {
        const suitePath = config.seedSuitePath ?? 'artifacts/ai/seeds/phase3_v1.json';
        const resolved = resolveSeedSuiteSeeds(suitePath, config.seedSuiteName);
        const start = roundIndex * config.gamesPerSide;
        const seedList = resolved.seeds.slice(start, start + config.gamesPerSide);
        if (seedList.length < config.gamesPerSide) {
            throw new Error(
                `Seed suite "${config.seedSuiteName}" has only ${resolved.seeds.length} seeds; `
                + `${config.gamesPerSide * (roundIndex + 1)} required for round ${roundIndex + 1}.`,
            );
        }
        return { seedList };
    }

    if (config.seedList && config.seedList.length > 0) {
        const offset = roundIndex * config.seedStride;
        return { seedList: config.seedList.map(seed => seed + offset) };
    }

    const offset = roundIndex * config.seedStride;
    return {
        seedList: Array.from({ length: config.gamesPerSide }, (_value, index) => config.startSeed + offset + index),
    };
}

export function resolveNikkiCandidateLoopRoundSeeds(
    config: NikkiCandidateLoopConfig,
    roundIndex: number,
): number[] {
    return resolveRoundSeedSource(config, roundIndex).seedList;
}

function buildRoundArtifactPath(runsDir: string, roundIndex: number, seedList: number[]): string {
    const roundSlug = [
        `round-${String(roundIndex + 1).padStart(2, '0')}`,
        summarizeSeedList(seedList),
    ].join('__');
    return path.join(runsDir, `${roundSlug}.json`);
}

function aggregateRoundReports(rounds: NikkiCandidateLoopRoundReport[]): NikkiCandidateLoopReport['summary'] {
    let candidateWins = 0;
    let incumbentWins = 0;
    let candidateCount = emptyTacticalCounts();
    let incumbentCount = emptyTacticalCounts();
    let totalGames = 0;
    let totalSteps = 0;
    let totalTurns = 0;
    const terminationCounts = {
        winner: 0,
        max_steps: 0,
        no_action: 0,
        invalid_action: 0,
    };

    for (const round of rounds) {
        const combined = round.report.combined;
        totalGames += combined.totalGames;
        candidateWins += combined.wins.player1Bot;
        incumbentWins += combined.wins.player2Bot;
        candidateCount = mergeTacticalCounts(candidateCount, combined.tacticalKPIs.byPlayer.player1);
        incumbentCount = mergeTacticalCounts(incumbentCount, combined.tacticalKPIs.byPlayer.player2);
        totalSteps += sumRoundSteps(round);
        totalTurns += sumRoundTurns(round);
        terminationCounts.winner += combined.terminationCounts.winner;
        terminationCounts.max_steps += combined.terminationCounts.max_steps;
        terminationCounts.no_action += combined.terminationCounts.no_action;
        terminationCounts.invalid_action += combined.terminationCounts.invalid_action;
    }

    const candidate = buildTacticalSummary(candidateCount);
    const incumbent = buildTacticalSummary(incumbentCount);
    const candidateConfidence = computeBinomialRateStats(candidateWins, totalGames);
    const incumbentConfidence = computeBinomialRateStats(incumbentWins, totalGames);

    return {
        rounds: rounds.length,
        totalGames,
        candidate: {
            games: totalGames,
            wins: candidateWins,
            winRate: roundTo(safeDivide(candidateWins, totalGames), 4),
            confidence: candidateConfidence,
            tacticalKPIs: candidate,
        },
        incumbent: {
            games: totalGames,
            wins: incumbentWins,
            winRate: roundTo(safeDivide(incumbentWins, totalGames), 4),
            confidence: incumbentConfidence,
            tacticalKPIs: incumbent,
        },
        delta: {
            winRate: roundTo(safeDivide(candidateWins - incumbentWins, totalGames), 4),
            wasteful_upgrade_rate: roundTo(candidate.wasteful_upgrade_rate - incumbent.wasteful_upgrade_rate, 4),
            lethal_miss_rate: roundTo(candidate.lethal_miss_rate - incumbent.lethal_miss_rate, 4),
            self_lethal_open_rate: roundTo(candidate.self_lethal_open_rate - incumbent.self_lethal_open_rate, 4),
        },
        terminationCounts,
        avgSteps: roundTo(safeDivide(totalSteps, totalGames), 2),
        avgTurns: roundTo(safeDivide(totalTurns, totalGames), 2),
        diagnostics: buildDiagnostics(rounds),
    };
}

function summarizeSeatMatches(matches: MatchReport[]): FixedMatchupBatchReport['sides']['primary']['summary'] {
    const winsPlayer1 = matches.filter(match => match.reason === 'winner' && match.winnerPlayer === 1).length;
    const winsPlayer2 = matches.filter(match => match.reason === 'winner' && match.winnerPlayer === 2).length;
    const unfinished = matches.length - winsPlayer1 - winsPlayer2;
    const totalSteps = matches.reduce((sum, match) => sum + match.steps, 0);
    const totalTurns = matches.reduce((sum, match) => sum + match.turnCount, 0);
    const tacticalByPlayer = matches.reduce(
        (acc, match) => {
            acc.player1 = mergeTacticalCounts(acc.player1, match.tacticalMetrics.byPlayer.player1);
            acc.player2 = mergeTacticalCounts(acc.player2, match.tacticalMetrics.byPlayer.player2);
            return acc;
        },
        { player1: emptyTacticalCounts(), player2: emptyTacticalCounts() },
    );
    const tacticalCounts = mergeTacticalCounts(tacticalByPlayer.player1, tacticalByPlayer.player2);
    const terminationCounts = matches.reduce(
        (acc, match) => {
            acc[match.reason] += 1;
            return acc;
        },
        { winner: 0, max_steps: 0, no_action: 0, invalid_action: 0 },
    );

    return {
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
            player1WinRate: computeBinomialRateStats(winsPlayer1, matches.length),
            player2WinRate: computeBinomialRateStats(winsPlayer2, matches.length),
        },
        runtime: {
            enabled: false,
            totalMs: 0,
            avgMsPerGame: 0,
            msPerAction: 0,
        },
        tacticalKPIs: {
            wasteful_upgrade_rate: roundTo(safeDivide(tacticalCounts.wastefulUpgradeCount, tacticalCounts.upgradeActionCount), 4),
            lethal_miss_rate: roundTo(safeDivide(tacticalCounts.lethalMissCount, tacticalCounts.lethalOpportunityCount), 4),
            self_lethal_open_rate: roundTo(safeDivide(tacticalCounts.selfLethalOpenCount, tacticalCounts.selfLethalCheckCount), 4),
            counts: tacticalCounts,
            byPlayer: tacticalByPlayer,
        },
    };
}

function buildHeadToHeadRoundReport(
    config: NikkiCandidateLoopConfig,
    seedList: number[],
    factories: { candidateBotFactory?: BotFactory; incumbentBotFactory?: BotFactory } = {},
): FixedMatchupBatchReport {
    const matchup = resolveFixedMatchup(config.matchupId);
    const candidateFactory = factories.candidateBotFactory ?? resolveBotFactory(config.candidateBotId);
    const incumbentFactory = factories.incumbentBotFactory ?? resolveBotFactory(config.incumbentBotId);
    const primaryMatches: MatchReport[] = [];
    const swappedMatches: MatchReport[] = [];

    for (const seed of seedList) {
        primaryMatches.push(runSingleMatch({
            seed,
            maxSteps: config.maxSteps,
            enableMulligan: config.enableMulligan,
            traceLimit: config.traceLimit,
            player1Deck: matchup.player1.deck,
            player2Deck: matchup.player2.deck,
            player1Leader: matchup.player1.leader,
            player2Leader: matchup.player2.leader,
            player1BotFactory: candidateFactory,
            player2BotFactory: incumbentFactory,
        }));

        swappedMatches.push(runSingleMatch({
            seed,
            maxSteps: config.maxSteps,
            enableMulligan: config.enableMulligan,
            traceLimit: config.traceLimit,
            player1Deck: matchup.player2.deck,
            player2Deck: matchup.player1.deck,
            player1Leader: matchup.player2.leader,
            player2Leader: matchup.player1.leader,
            player1BotFactory: incumbentFactory,
            player2BotFactory: candidateFactory,
        }));
    }

    const primarySummary = summarizeSeatMatches(primaryMatches);
    const swappedSummary = summarizeSeatMatches(swappedMatches);
    const candidateCounts = mergeTacticalCounts(primarySummary.tacticalKPIs.byPlayer.player1, swappedSummary.tacticalKPIs.byPlayer.player2);
    const incumbentCounts = mergeTacticalCounts(primarySummary.tacticalKPIs.byPlayer.player2, swappedSummary.tacticalKPIs.byPlayer.player1);
    const combinedCounts = mergeTacticalCounts(candidateCounts, incumbentCounts);
    const candidateWins = primarySummary.wins.player1 + swappedSummary.wins.player2;
    const incumbentWins = primarySummary.wins.player2 + swappedSummary.wins.player1;
    const totalGames = primarySummary.totalGames + swappedSummary.totalGames;
    const totalSteps = primaryMatches.reduce((sum, match) => sum + match.steps, 0)
        + swappedMatches.reduce((sum, match) => sum + match.steps, 0);
    const totalTurns = primaryMatches.reduce((sum, match) => sum + match.turnCount, 0)
        + swappedMatches.reduce((sum, match) => sum + match.turnCount, 0);

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
            matchupId: config.matchupId,
            gamesPerSide: config.gamesPerSide,
            maxSteps: config.maxSteps,
            enableMulligan: config.enableMulligan,
            traceLimit: config.traceLimit,
            startSeed: seedList[0] ?? config.startSeed,
            player1BotId: config.candidateBotId,
            player2BotId: config.incumbentBotId,
            measureRuntime: config.measureRuntime,
            suppressLogs: config.suppressLogs,
            seedList: [...seedList],
        },
        sides: {
            primary: {
                config: {
                    startSeed: seedList[0] ?? config.startSeed,
                    games: seedList.length,
                    maxSteps: config.maxSteps,
                    enableMulligan: config.enableMulligan,
                    traceLimit: config.traceLimit,
                    player1BotId: config.candidateBotId,
                    player2BotId: config.incumbentBotId,
                    measureRuntime: config.measureRuntime,
                    suppressLogs: config.suppressLogs,
                    seedList: [...seedList],
                },
                matches: primaryMatches,
                summary: primarySummary,
            },
            swapped: {
                config: {
                    startSeed: seedList[0] ?? config.startSeed,
                    games: seedList.length,
                    maxSteps: config.maxSteps,
                    enableMulligan: config.enableMulligan,
                    traceLimit: config.traceLimit,
                    player1BotId: config.incumbentBotId,
                    player2BotId: config.candidateBotId,
                    measureRuntime: config.measureRuntime,
                    suppressLogs: config.suppressLogs,
                    seedList: [...seedList],
                },
                matches: swappedMatches,
                summary: swappedSummary,
            },
        },
        combined: {
            totalGames,
            wins: {
                player1Bot: candidateWins,
                player2Bot: incumbentWins,
            },
            winRate: {
                player1Bot: roundTo(safeDivide(candidateWins, totalGames), 4),
                player2Bot: roundTo(safeDivide(incumbentWins, totalGames), 4),
            },
            unfinished: totalGames - candidateWins - incumbentWins,
            avgSteps: roundTo(safeDivide(totalSteps, totalGames), 2),
            avgTurns: roundTo(safeDivide(totalTurns, totalGames), 2),
            terminationCounts: {
                winner: primarySummary.terminationCounts.winner + swappedSummary.terminationCounts.winner,
                max_steps: primarySummary.terminationCounts.max_steps + swappedSummary.terminationCounts.max_steps,
                no_action: primarySummary.terminationCounts.no_action + swappedSummary.terminationCounts.no_action,
                invalid_action: primarySummary.terminationCounts.invalid_action + swappedSummary.terminationCounts.invalid_action,
            },
            confidence: {
                player1BotWinRate: computeBinomialRateStats(candidateWins, totalGames),
                player2BotWinRate: computeBinomialRateStats(incumbentWins, totalGames),
            },
            runtime: {
                enabled: false,
                totalMs: 0,
                avgMsPerGame: 0,
                msPerAction: 0,
            },
            tacticalKPIs: {
                wasteful_upgrade_rate: roundTo(safeDivide(combinedCounts.wastefulUpgradeCount, combinedCounts.upgradeActionCount), 4),
                lethal_miss_rate: roundTo(safeDivide(combinedCounts.lethalMissCount, combinedCounts.lethalOpportunityCount), 4),
                self_lethal_open_rate: roundTo(safeDivide(combinedCounts.selfLethalOpenCount, combinedCounts.selfLethalCheckCount), 4),
                counts: combinedCounts,
                byPlayer: {
                    player1: candidateCounts,
                    player2: incumbentCounts,
                },
            },
        },
    };
}

export function runBt05NikkiCandidateLoop(
    config: NikkiCandidateLoopConfig,
    options: RunLoopOptions = {},
): NikkiCandidateLoopReport {
    if (config.rounds <= 0) {
        throw new Error('Nikki candidate loop requires at least 1 round.');
    }
    if (config.gamesPerSide <= 0) {
        throw new Error('Nikki candidate loop requires at least 1 game per side.');
    }

    const runRound = options.runRound ?? ((roundConfig: NikkiCandidateLoopConfig, seedList: number[]) => buildHeadToHeadRoundReport(
        roundConfig,
        seedList,
        {
            candidateBotFactory: options.candidateBotFactory,
            incumbentBotFactory: options.incumbentBotFactory,
        },
    ));
    const rounds: NikkiCandidateLoopRoundReport[] = [];
    const artifactPaths = config.outputPath
        ? buildNikkiCandidateLoopArtifactPaths(config.outputPath, config)
        : undefined;

    for (let roundIndex = 0; roundIndex < config.rounds; roundIndex += 1) {
        const seedSource = resolveRoundSeedSource(config, roundIndex);
        const roundReport = runRound(config, seedSource.seedList);

        const artifactPath = artifactPaths?.runsDir
            ? buildRoundArtifactPath(artifactPaths.runsDir, roundIndex, seedSource.seedList)
            : undefined;
        if (artifactPath) {
            writeJson(artifactPath, roundReport);
        }

        rounds.push({
            roundIndex,
            seedList: seedSource.seedList,
            artifactPath: artifactPath ?? '',
            report: roundReport,
        });
    }

    const summary = aggregateRoundReports(rounds);
    const report: NikkiCandidateLoopReport = {
        generatedAt: new Date().toISOString(),
        config: {
            ...config,
            resolvedRounds: config.rounds,
            resolvedGamesPerSide: config.gamesPerSide,
        },
        rounds,
        summary,
    };

    if (artifactPaths?.latestPath && artifactPaths.archivePath) {
        writeJson(artifactPaths.latestPath, report);
        writeJson(artifactPaths.archivePath, report);
    }

    return report;
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

function parseSeedList(raw: string | undefined): number[] | undefined {
    if (!raw || raw.trim().length === 0) return undefined;
    return parseSeedListCsv(raw);
}

function runCli(): void {
    const manifest = loadPhase0Manifest(resolvePhase0ManifestPath());
    const defaultOutputPath = 'artifacts/ai/fixed_matchup/nikki_loop/latest.json';
    const seedSuitePath = process.env.AI_NIKKI_LOOP_SEED_SUITE_PATH ?? manifest.fixedMatchupBench.seedSuitePath;
    const seedSuiteName = parseSeedSuiteName(process.env.AI_NIKKI_LOOP_SEED_SUITE ?? manifest.fixedMatchupBench.seedSuiteName);

    const config: NikkiCandidateLoopConfig = {
        matchupId: process.env.AI_NIKKI_LOOP_MATCHUP ?? 'fm-c-bt05-unlucky-bunny-nikki-mirror',
        incumbentBotId: process.env.AI_NIKKI_LOOP_INCUMBENT_BOT ?? 'practice-bt05-nikki-strong-v1',
        candidateBotId: process.env.AI_NIKKI_LOOP_CANDIDATE_BOT ?? 'practice-bt05-nikki-strong-v1',
        rounds: parseIntEnv('AI_NIKKI_LOOP_ROUNDS', 3),
        gamesPerSide: parseIntEnv('AI_NIKKI_LOOP_GAMES_PER_SIDE', manifest.fixedMatchupBench.gamesPerSide),
        maxSteps: parseIntEnv('AI_NIKKI_LOOP_MAX_STEPS', manifest.fixedMatchupBench.maxSteps),
        enableMulligan: parseBoolEnv('AI_NIKKI_LOOP_ENABLE_MULLIGAN', manifest.fixedMatchupBench.enableMulligan),
        traceLimit: parseIntEnv('AI_NIKKI_LOOP_TRACE_LIMIT', manifest.fixedMatchupBench.traceLimit),
        startSeed: parseIntEnv('AI_NIKKI_LOOP_START_SEED', manifest.fixedMatchupBench.startSeed),
        seedStride: parseIntEnv('AI_NIKKI_LOOP_SEED_STRIDE', Math.max(1, parseIntEnv('AI_NIKKI_LOOP_GAMES_PER_SIDE', manifest.fixedMatchupBench.gamesPerSide))),
        measureRuntime: parseBoolEnv('AI_NIKKI_LOOP_MEASURE_RUNTIME', false),
        suppressLogs: parseBoolEnv('AI_NIKKI_LOOP_SUPPRESS_LOGS', true),
        seedList: parseSeedList(process.env.AI_NIKKI_LOOP_SEED_LIST),
        seedSuiteName,
        seedSuitePath: seedSuiteName ? seedSuitePath : undefined,
        outputPath: resolveOutputPath(defaultOutputPath),
    };

    const report = runBt05NikkiCandidateLoop(config);
    console.log(JSON.stringify(report, null, 2));
}

const maybeMain = process.argv[1] ?? '';
if (maybeMain.endsWith('run_bt05_nikki_candidate_loop.ts') || maybeMain.endsWith('run_bt05_nikki_candidate_loop.js')) {
    runCli();
}
