import fs from 'node:fs';
import path from 'node:path';
import { resolveFixedMatchup } from './fixed_matchup/registry';
import { BotFactory, MatchReport, runSingleMatch } from './match_harness';
import { loadPhase0Manifest, resolvePhase0ManifestPath } from './phase0_manifest';
import { resolveSeedSuiteSeeds, SeedSuiteName } from './seed_suites';
import { PracticeStrongBot, PracticeStrongBotOptions } from '../../src/logic/ai/practice/PracticeStrongBot';
import { bt05UnluckyBunnyNikkiOpeningProfile } from '../../src/logic/ai/practice/deckProfiles/bt05UnluckyBunnyNikki';
import { TacticalKpiCounts } from './run_fixed_matchup_batch';
import { resolveBotFactory } from './bot_registry';

export interface Bt05NikkiSearchConfigSweepCandidateSpec {
    id: string;
    label: string;
    options: Partial<PracticeStrongBotOptions>;
}

export interface Bt05NikkiSearchConfigSweepConfig {
    matchupId: string;
    incumbentBotId: string;
    candidateProfileId: string;
    seedSuiteNames: SeedSuiteName[];
    seedSuitePath?: string;
    maxSeedsPerSuite?: number;
    maxSteps: number;
    enableMulligan: boolean;
    traceLimit?: number;
    suppressLogs: boolean;
    topK: number;
    outputPath?: string;
    candidateSpecs: Bt05NikkiSearchConfigSweepCandidateSpec[];
}

export interface Bt05NikkiSearchConfigSweepRoleSummary {
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

export interface Bt05NikkiSearchConfigSweepSuiteSummary {
    suiteName: SeedSuiteName;
    seedLabel: string;
    seedList: number[];
    totalGames: number;
    totalSteps: number;
    totalTurns: number;
    candidate: Bt05NikkiSearchConfigSweepRoleSummary;
    incumbent: Bt05NikkiSearchConfigSweepRoleSummary;
    delta: {
        winRate: number;
        wasteful_upgrade_rate: number;
        lethal_miss_rate: number;
        self_lethal_open_rate: number;
    };
    avgSteps: number;
    avgTurns: number;
}

export interface Bt05NikkiSearchConfigSweepAggregateSummary {
    suites: number;
    totalGames: number;
    candidate: Bt05NikkiSearchConfigSweepRoleSummary;
    incumbent: Bt05NikkiSearchConfigSweepRoleSummary;
    delta: {
        winRate: number;
        wasteful_upgrade_rate: number;
        lethal_miss_rate: number;
        self_lethal_open_rate: number;
    };
    avgSteps: number;
    avgTurns: number;
}

export interface Bt05NikkiSearchConfigSweepCandidateResult {
    id: string;
    label: string;
    options: Partial<PracticeStrongBotOptions>;
    suiteSummaries: Bt05NikkiSearchConfigSweepSuiteSummary[];
    combined: Bt05NikkiSearchConfigSweepAggregateSummary;
    suiteDeltaSpread: number;
    rank: number;
}

export interface Bt05NikkiSearchConfigSweepReport {
    generatedAt: string;
    config: Bt05NikkiSearchConfigSweepConfig;
    suites: Array<{
        suiteName: SeedSuiteName;
        seedCount: number;
        seedLabel: string;
        seedList: number[];
    }>;
    candidates: Bt05NikkiSearchConfigSweepCandidateResult[];
    topCandidates: Bt05NikkiSearchConfigSweepCandidateResult[];
    summary: {
        candidateCount: number;
        suiteCount: number;
        totalGames: number;
        topK: number;
    };
}

interface CandidateSweepArtifactPaths {
    latestPath?: string;
    archivePath?: string;
    runsDir?: string;
}

interface SweepRunOptions {
    runSuite?: (
        candidate: Bt05NikkiSearchConfigSweepCandidateSpec,
        suiteName: SeedSuiteName,
        seedList: number[],
        config: Bt05NikkiSearchConfigSweepConfig,
    ) => Bt05NikkiSearchConfigSweepSuiteSummary;
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

function computeBinomialRateStats(successes: number, total: number): Bt05NikkiSearchConfigSweepRoleSummary['confidence'] {
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

    if (seedList.length === 1) return `seed-${first}`;
    if (isSequential) return `seed-${first}-to-${last}`;
    if (seedList.length <= 4) return `seeds-${seedList.join('-')}`;
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

function buildTacticalSummary(counts: TacticalKpiCounts): Bt05NikkiSearchConfigSweepRoleSummary['tacticalKPIs'] {
    return {
        wasteful_upgrade_rate: roundTo(safeDivide(counts.wastefulUpgradeCount, counts.upgradeActionCount), 4),
        lethal_miss_rate: roundTo(safeDivide(counts.lethalMissCount, counts.lethalOpportunityCount), 4),
        self_lethal_open_rate: roundTo(safeDivide(counts.selfLethalOpenCount, counts.selfLethalCheckCount), 4),
        counts,
    };
}

function summarizeSeatMatches(matches: MatchReport[]): {
    totalGames: number;
    wins: { player1: number; player2: number };
    avgSteps: number;
    avgTurns: number;
    terminationCounts: { winner: number; max_steps: number; no_action: number; invalid_action: number };
    tacticalKPIs: {
        byPlayer: { player1: TacticalKpiCounts; player2: TacticalKpiCounts };
    };
} {
    const winsPlayer1 = matches.filter(match => match.reason === 'winner' && match.winnerPlayer === 1).length;
    const winsPlayer2 = matches.filter(match => match.reason === 'winner' && match.winnerPlayer === 2).length;
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
        avgSteps: roundTo(safeDivide(totalSteps, matches.length), 2),
        avgTurns: roundTo(safeDivide(totalTurns, matches.length), 2),
        terminationCounts,
        tacticalKPIs: {
            byPlayer: tacticalByPlayer,
        },
    };
}

function buildRoleSummary(wins: number, totalGames: number, counts: TacticalKpiCounts): Bt05NikkiSearchConfigSweepRoleSummary {
    const tacticalKPIs = buildTacticalSummary(counts);
    return {
        games: totalGames,
        wins,
        winRate: roundTo(safeDivide(wins, totalGames), 4),
        confidence: computeBinomialRateStats(wins, totalGames),
        tacticalKPIs,
    };
}

function buildSuiteSummary(
    suiteName: SeedSuiteName,
    seedList: number[],
    primaryMatches: MatchReport[],
    swappedMatches: MatchReport[],
): Bt05NikkiSearchConfigSweepSuiteSummary {
    const primarySummary = summarizeSeatMatches(primaryMatches);
    const swappedSummary = summarizeSeatMatches(swappedMatches);

    const candidateWins = primarySummary.wins.player1 + swappedSummary.wins.player2;
    const incumbentWins = primarySummary.wins.player2 + swappedSummary.wins.player1;
    const totalGames = primarySummary.totalGames + swappedSummary.totalGames;
    const candidateCounts = mergeTacticalCounts(primarySummary.tacticalKPIs.byPlayer.player1, swappedSummary.tacticalKPIs.byPlayer.player2);
    const incumbentCounts = mergeTacticalCounts(primarySummary.tacticalKPIs.byPlayer.player2, swappedSummary.tacticalKPIs.byPlayer.player1);
    const combinedSteps = primaryMatches.reduce((sum, match) => sum + match.steps, 0)
        + swappedMatches.reduce((sum, match) => sum + match.steps, 0);
    const combinedTurns = primaryMatches.reduce((sum, match) => sum + match.turnCount, 0)
        + swappedMatches.reduce((sum, match) => sum + match.turnCount, 0);

    const candidate = buildRoleSummary(candidateWins, totalGames, candidateCounts);
    const incumbent = buildRoleSummary(incumbentWins, totalGames, incumbentCounts);

    return {
        suiteName,
        seedLabel: summarizeSeedList(seedList),
        seedList: [...seedList],
        totalGames,
        totalSteps: combinedSteps,
        totalTurns: combinedTurns,
        candidate,
        incumbent,
        delta: {
            winRate: roundTo(safeDivide(candidateWins - incumbentWins, totalGames), 4),
            wasteful_upgrade_rate: roundTo(candidate.tacticalKPIs.wasteful_upgrade_rate - incumbent.tacticalKPIs.wasteful_upgrade_rate, 4),
            lethal_miss_rate: roundTo(candidate.tacticalKPIs.lethal_miss_rate - incumbent.tacticalKPIs.lethal_miss_rate, 4),
            self_lethal_open_rate: roundTo(candidate.tacticalKPIs.self_lethal_open_rate - incumbent.tacticalKPIs.self_lethal_open_rate, 4),
        },
        avgSteps: roundTo(safeDivide(combinedSteps, totalGames), 2),
        avgTurns: roundTo(safeDivide(combinedTurns, totalGames), 2),
    };
}

function combineRoleSummaries(summaries: Bt05NikkiSearchConfigSweepRoleSummary[]): Bt05NikkiSearchConfigSweepRoleSummary {
    const totalGames = summaries.reduce((sum, summary) => sum + summary.games, 0);
    const wins = summaries.reduce((sum, summary) => sum + summary.wins, 0);
    const counts = summaries.reduce(
        (acc, summary) => mergeTacticalCounts(acc, summary.tacticalKPIs.counts),
        emptyTacticalCounts(),
    );
    return buildRoleSummary(wins, totalGames, counts);
}

function combineSuiteSummaries(summaries: Bt05NikkiSearchConfigSweepSuiteSummary[]): Bt05NikkiSearchConfigSweepAggregateSummary {
    const totalGames = summaries.reduce((sum, summary) => sum + summary.totalGames, 0);
    const candidate = combineRoleSummaries(summaries.map(summary => summary.candidate));
    const incumbent = combineRoleSummaries(summaries.map(summary => summary.incumbent));
    const totalSteps = summaries.reduce((sum, summary) => sum + summary.totalSteps, 0);
    const totalTurns = summaries.reduce((sum, summary) => sum + summary.totalTurns, 0);

    return {
        suites: summaries.length,
        totalGames,
        candidate,
        incumbent,
        delta: {
            winRate: roundTo(safeDivide(candidate.wins - incumbent.wins, totalGames), 4),
            wasteful_upgrade_rate: roundTo(candidate.tacticalKPIs.wasteful_upgrade_rate - incumbent.tacticalKPIs.wasteful_upgrade_rate, 4),
            lethal_miss_rate: roundTo(candidate.tacticalKPIs.lethal_miss_rate - incumbent.tacticalKPIs.lethal_miss_rate, 4),
            self_lethal_open_rate: roundTo(candidate.tacticalKPIs.self_lethal_open_rate - incumbent.tacticalKPIs.self_lethal_open_rate, 4),
        },
        avgSteps: roundTo(safeDivide(totalSteps, totalGames), 2),
        avgTurns: roundTo(safeDivide(totalTurns, totalGames), 2),
    };
}

function buildSearchBotFactory(options: Partial<PracticeStrongBotOptions>): BotFactory {
    return (name: string) => new PracticeStrongBot(`Practice BT05 Nikki Strong Sweep ${name}`, bt05UnluckyBunnyNikkiOpeningProfile, options);
}

function buildIncumbentBotFactory(botId: string): BotFactory {
    if (botId.startsWith('practice-bt05-nikki-strong')) {
        return buildSearchBotFactory({});
    }
    return resolveBotFactory(botId);
}

function parseSeedSuiteNames(raw: string | undefined): SeedSuiteName[] {
    if (!raw || raw.trim().length === 0) return ['tuning', 'dev'];
    const parts = raw.split(',').map(part => part.trim().toLowerCase()).filter(part => part.length > 0);
    const suites: SeedSuiteName[] = [];
    for (const part of parts) {
        if (part === 'tuning' || part === 'dev' || part === 'promotion-holdout') {
            suites.push(part);
            continue;
        }
        throw new Error(`Unsupported AI_NIKKI_SWEEP_SEED_SUITES value: "${raw}"`);
    }
    return suites.length > 0 ? suites : ['tuning', 'dev'];
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
    const raw = process.env.AI_NIKKI_SWEEP_OUTPUT;
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

function buildArchiveSlug(config: Bt05NikkiSearchConfigSweepConfig): string {
    const suiteDescriptor = config.seedSuiteNames.map(name => sanitizeArtifactSegment(name)).join('-');
    const maxSeedDescriptor = config.maxSeedsPerSuite ? `m${config.maxSeedsPerSuite}` : 'full';
    return [
        sanitizeArtifactSegment(config.matchupId),
        `inc-${sanitizeArtifactSegment(config.incumbentBotId)}`,
        `profile-${sanitizeArtifactSegment(config.candidateProfileId)}`,
        `suites-${suiteDescriptor}`,
        maxSeedDescriptor,
        `c${config.candidateSpecs.length}`,
        `k${config.topK}`,
    ].join('__');
}

export function buildBt05NikkiSearchConfigSweepArtifactPaths(
    outputPath: string,
    config: Bt05NikkiSearchConfigSweepConfig,
): CandidateSweepArtifactPaths {
    const latestPath = path.resolve(outputPath);
    const runsDir = path.join(path.dirname(latestPath), 'runs');
    const archiveSlug = buildArchiveSlug(config);
    return {
        latestPath,
        archivePath: path.join(runsDir, `${archiveSlug}.json`),
        runsDir,
    };
}

function summarizeOptionTag(options: Partial<PracticeStrongBotOptions>): string {
    const parts: string[] = [];
    if (typeof options.beamWidth === 'number') parts.push(`beam${options.beamWidth}`);
    if (typeof options.interactionRolloutDepth === 'number') parts.push(`depth${options.interactionRolloutDepth}`);
    if (typeof options.opponentReplyTopK === 'number') parts.push(`topk${options.opponentReplyTopK}`);
    if (options.opponentReplyAggregation) parts.push(options.opponentReplyAggregation);
    if (typeof options.preferPracticeMainPhaseHold === 'boolean') parts.push(`hold=${options.preferPracticeMainPhaseHold ? 'y' : 'n'}`);
    return parts.length > 0 ? parts.join(' ') : 'baseline';
}

export function defaultBt05NikkiSearchConfigCandidates(): Bt05NikkiSearchConfigSweepCandidateSpec[] {
    return [
        {
            id: 'baseline-reference',
            label: 'Baseline reference',
            options: {},
        },
        {
            id: 'hold-main-early',
            label: 'Hold main early',
            options: {
                preferPracticeMainPhaseHold: true,
                preferPracticeMainPhaseHoldMaxLeaderLevel: 5,
            },
        },
        {
            id: 'beam4-depth4',
            label: 'Beam 4 depth 4',
            options: {
                beamWidth: 4,
                interactionRolloutDepth: 4,
                opponentReplyTopK: 1,
                opponentReplyAggregation: 'weighted',
                opponentReplyBlend: 0.62,
                rolloutDisagreementPenaltyWeight: 0.03,
                closeBoardOvercommitPenaltyWeight: 0.018,
            },
        },
        {
            id: 'beam8-depth4',
            label: 'Beam 8 depth 4',
            options: {
                beamWidth: 8,
                interactionRolloutDepth: 4,
                opponentReplyTopK: 1,
                opponentReplyAggregation: 'weighted',
                opponentReplyBlend: 0.62,
                rolloutDisagreementPenaltyWeight: 0.02,
                closeBoardOvercommitPenaltyWeight: 0.012,
            },
        },
        {
            id: 'topk3-weighted',
            label: 'Top-k 3 weighted',
            options: {
                beamWidth: 6,
                interactionRolloutDepth: 4,
                opponentReplyTopK: 3,
                opponentReplyAggregation: 'weighted',
                opponentReplyBlend: 0.62,
            },
        },
        {
            id: 'topk3-mean',
            label: 'Top-k 3 mean',
            options: {
                beamWidth: 6,
                interactionRolloutDepth: 4,
                opponentReplyTopK: 3,
                opponentReplyAggregation: 'mean',
                opponentReplyBlend: 0.62,
            },
        },
    ];
}

function parseCandidateSpecs(raw: string | undefined): Bt05NikkiSearchConfigSweepCandidateSpec[] | undefined {
    if (!raw || raw.trim().length === 0) return undefined;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
        throw new Error('AI_NIKKI_SWEEP_CANDIDATES_JSON must be a JSON array.');
    }

    return parsed.map((entry, index) => {
        const candidate = entry as Partial<Bt05NikkiSearchConfigSweepCandidateSpec> & { options?: Record<string, unknown> };
        const id = String(candidate.id ?? '').trim();
        const label = String(candidate.label ?? candidate.id ?? `candidate-${index + 1}`).trim();
        if (id.length === 0) {
            throw new Error(`Candidate at index ${index} is missing an id.`);
        }

        return {
            id,
            label: label.length > 0 ? label : id,
            options: (candidate.options ?? {}) as Partial<PracticeStrongBotOptions>,
        };
    });
}

function resolveSeedListForSuite(
    seedSuitePath: string,
    suiteName: SeedSuiteName,
    maxSeedsPerSuite?: number,
): number[] {
    const resolved = resolveSeedSuiteSeeds(seedSuitePath, suiteName);
    if (resolved.seeds.length === 0) {
        throw new Error(`Seed suite "${suiteName}" is empty.`);
    }
    return typeof maxSeedsPerSuite === 'number' && maxSeedsPerSuite > 0
        ? resolved.seeds.slice(0, maxSeedsPerSuite)
        : resolved.seeds;
}

function runSuiteEvaluation(
    config: Bt05NikkiSearchConfigSweepConfig,
    candidate: Bt05NikkiSearchConfigSweepCandidateSpec,
    suiteName: SeedSuiteName,
    seedList: number[],
): Bt05NikkiSearchConfigSweepSuiteSummary {
    const matchup = resolveFixedMatchup(config.matchupId);
    const candidateFactory = buildSearchBotFactory(candidate.options);
    const incumbentFactory = buildIncumbentBotFactory(config.incumbentBotId);
    const primaryMatches: MatchReport[] = [];
    const swappedMatches: MatchReport[] = [];

    for (const seed of seedList) {
        primaryMatches.push(runSingleMatch({
            seed,
            maxSteps: config.maxSteps,
            enableMulligan: config.enableMulligan,
            traceLimit: config.traceLimit,
            muteEngineLogs: config.suppressLogs,
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
            muteEngineLogs: config.suppressLogs,
            player1Deck: matchup.player2.deck,
            player2Deck: matchup.player1.deck,
            player1Leader: matchup.player2.leader,
            player2Leader: matchup.player1.leader,
            player1BotFactory: incumbentFactory,
            player2BotFactory: candidateFactory,
        }));
    }

    return buildSuiteSummary(suiteName, seedList, primaryMatches, swappedMatches);
}

function rankCandidates(
    candidateResults: Array<Omit<Bt05NikkiSearchConfigSweepCandidateResult, 'rank'>>,
): Bt05NikkiSearchConfigSweepCandidateResult[] {
    return [...candidateResults]
        .sort((left, right) => {
            if (left.combined.delta.winRate !== right.combined.delta.winRate) {
                return right.combined.delta.winRate - left.combined.delta.winRate;
            }
            if (left.combined.delta.lethal_miss_rate !== right.combined.delta.lethal_miss_rate) {
                return left.combined.delta.lethal_miss_rate - right.combined.delta.lethal_miss_rate;
            }
            if (left.suiteDeltaSpread !== right.suiteDeltaSpread) {
                return left.suiteDeltaSpread - right.suiteDeltaSpread;
            }
            return left.label.localeCompare(right.label);
        })
        .map((candidate, index) => ({
            ...candidate,
            rank: index + 1,
        }));
}

export function formatBt05NikkiSearchConfigSweepSummary(
    report: Pick<Bt05NikkiSearchConfigSweepReport, 'config' | 'summary' | 'topCandidates'>,
): string {
    const lines = [
        'BT05 Nikki search-config sweep',
        `matchup=${report.config.matchupId} suites=${report.config.seedSuiteNames.join(',')} candidates=${report.summary.candidateCount} top=${report.summary.topK}`,
    ];

    for (const candidate of report.topCandidates.slice(0, report.summary.topK)) {
        const suiteBits = candidate.suiteSummaries.map(suite => `${suite.suiteName}:${suite.delta.winRate >= 0 ? '+' : ''}${suite.delta.winRate.toFixed(4)}`).join(' ');
        lines.push(
            `${candidate.rank}. ${candidate.label} [${candidate.id}] `
            + `combined=${candidate.combined.delta.winRate >= 0 ? '+' : ''}${candidate.combined.delta.winRate.toFixed(4)} `
            + `spread=${candidate.suiteDeltaSpread.toFixed(4)} `
            + `opts=${summarizeOptionTag(candidate.options)} `
            + `${suiteBits}`,
        );
    }

    return lines.join('\n');
}

function parseCandidateSpecsEnv(raw: string | undefined): Bt05NikkiSearchConfigSweepCandidateSpec[] {
    return parseCandidateSpecs(raw) ?? defaultBt05NikkiSearchConfigCandidates();
}

function runCandidates(
    config: Bt05NikkiSearchConfigSweepConfig,
    options: SweepRunOptions = {},
): Bt05NikkiSearchConfigSweepReport {
    const runSuite = options.runSuite ?? ((candidate, suiteName, seedList, suiteConfig) => (
        runSuiteEvaluation(suiteConfig, candidate, suiteName, seedList)
    ));
    const suiteEvaluations = config.seedSuiteNames.map(suiteName => {
        const seedList = resolveSeedListForSuite(
            config.seedSuitePath ?? 'artifacts/ai/seeds/phase3_v1.json',
            suiteName,
            config.maxSeedsPerSuite,
        );
        return {
            suiteName,
            seedCount: seedList.length,
            seedLabel: summarizeSeedList(seedList),
            seedList,
        };
    });

    const candidateResults = config.candidateSpecs.map(candidate => {
        const suiteSummaries = suiteEvaluations.map(suite => runSuite(candidate, suite.suiteName, suite.seedList, config));
        const combined = combineSuiteSummaries(suiteSummaries);
        const suiteDeltaSpread = roundTo(
            Math.max(...suiteSummaries.map(summary => summary.delta.winRate))
            - Math.min(...suiteSummaries.map(summary => summary.delta.winRate)),
            4,
        );

        return {
            id: candidate.id,
            label: candidate.label,
            options: { ...candidate.options },
            suiteSummaries,
            combined,
            suiteDeltaSpread,
        };
    });

    const rankedCandidates = rankCandidates(candidateResults);
    const topCandidates = rankedCandidates.slice(0, config.topK);
    const totalGames = rankedCandidates.reduce((sum, candidate) => sum + candidate.combined.totalGames, 0);

    return {
        generatedAt: new Date().toISOString(),
        config,
        suites: suiteEvaluations,
        candidates: rankedCandidates,
        topCandidates,
        summary: {
            candidateCount: rankedCandidates.length,
            suiteCount: suiteEvaluations.length,
            totalGames,
            topK: config.topK,
        },
    };
}

export function runBt05NikkiSearchConfigSweep(
    config: Bt05NikkiSearchConfigSweepConfig,
    options: SweepRunOptions = {},
): Bt05NikkiSearchConfigSweepReport {
    if (config.candidateSpecs.length === 0) {
        throw new Error('BT05 Nikki search-config sweep requires at least 1 candidate.');
    }
    if (config.seedSuiteNames.length === 0) {
        throw new Error('BT05 Nikki search-config sweep requires at least 1 seed suite.');
    }
    if (config.topK <= 0) {
        throw new Error('BT05 Nikki search-config sweep requires topK >= 1.');
    }

    return runCandidates(config, options);
}

function runCli(): void {
    const manifest = loadPhase0Manifest(resolvePhase0ManifestPath());
    const defaultOutputPath = 'artifacts/ai/fixed_matchup/nikki_search_sweep/latest.json';
    const seedSuitePath = process.env.AI_NIKKI_SWEEP_SEED_SUITE_PATH ?? manifest.fixedMatchupBench.seedSuitePath;
    const seedSuiteNames = parseSeedSuiteNames(process.env.AI_NIKKI_SWEEP_SEED_SUITES);
    const candidateSpecs = parseCandidateSpecsEnv(process.env.AI_NIKKI_SWEEP_CANDIDATES_JSON);

    const config: Bt05NikkiSearchConfigSweepConfig = {
        matchupId: process.env.AI_NIKKI_SWEEP_MATCHUP ?? 'fm-c-bt05-unlucky-bunny-nikki-mirror',
        incumbentBotId: process.env.AI_NIKKI_SWEEP_INCUMBENT_BOT ?? 'practice-bt05-nikki-strong-v1',
        candidateProfileId: bt05UnluckyBunnyNikkiOpeningProfile.id,
        seedSuiteNames,
        seedSuitePath,
        maxSeedsPerSuite: parseIntEnv('AI_NIKKI_SWEEP_MAX_SEEDS_PER_SUITE', 0) || undefined,
        maxSteps: parseIntEnv('AI_NIKKI_SWEEP_MAX_STEPS', manifest.fixedMatchupBench.maxSteps),
        enableMulligan: parseBoolEnv('AI_NIKKI_SWEEP_ENABLE_MULLIGAN', manifest.fixedMatchupBench.enableMulligan),
        traceLimit: parseIntEnv('AI_NIKKI_SWEEP_TRACE_LIMIT', manifest.fixedMatchupBench.traceLimit),
        suppressLogs: parseBoolEnv('AI_NIKKI_SWEEP_SUPPRESS_LOGS', true),
        topK: parseIntEnv('AI_NIKKI_SWEEP_TOP_K', 3),
        outputPath: resolveOutputPath(defaultOutputPath),
        candidateSpecs,
    };

    const report = runBt05NikkiSearchConfigSweep(config);
    const artifactPaths = config.outputPath ? buildBt05NikkiSearchConfigSweepArtifactPaths(config.outputPath, config) : undefined;
    if (artifactPaths?.latestPath && artifactPaths.archivePath) {
        writeJson(artifactPaths.latestPath, report);
        writeJson(artifactPaths.archivePath, report);
    }
    if (artifactPaths?.latestPath) {
        console.log(formatBt05NikkiSearchConfigSweepSummary(report));
        console.log(JSON.stringify(report, null, 2));
        return;
    }

    console.log(formatBt05NikkiSearchConfigSweepSummary(report));
    console.log(JSON.stringify(report, null, 2));
}

const maybeMain = process.argv[1] ?? '';
if (maybeMain.endsWith('run_bt05_nikki_search_config_sweep.ts') || maybeMain.endsWith('run_bt05_nikki_search_config_sweep.js')) {
    runCli();
}
