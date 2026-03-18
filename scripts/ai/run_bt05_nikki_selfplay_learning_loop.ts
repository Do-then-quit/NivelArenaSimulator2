import fs from 'node:fs';
import path from 'node:path';
import { PracticeStrongBot } from '../../src/logic/ai/practice/PracticeStrongBot';
import { bt05UnluckyBunnyNikkiOpeningProfile } from '../../src/logic/ai/practice/deckProfiles/bt05UnluckyBunnyNikki';
import { loadBt05NikkiMainPhaseHoldPolicy } from '../../src/logic/ai/practice/Bt05NikkiMainPhaseHoldPolicyLoader';
import { resolveBotFactory } from './bot_registry';
import { BotFactory } from './match_harness';
import {
    Bt05NikkiSelfPlayExportConfig,
    Bt05NikkiSelfPlayExportReport,
    formatBt05NikkiSelfPlayExportSummary,
    runBt05NikkiSelfPlayExport,
} from './run_bt05_nikki_selfplay_export';
import {
    Bt05NikkiMainPhaseHoldPolicyTrainingConfig,
    Bt05NikkiMainPhaseHoldPolicyTrainingReport,
    formatBt05NikkiMainPhaseHoldPolicyTrainingSummary,
    trainBt05NikkiMainPhaseHoldPolicy,
} from './train_bt05_nikki_main_phase_hold_policy';
import {
    NikkiCandidateLoopConfig,
    NikkiCandidateLoopReport,
    runBt05NikkiCandidateLoop,
} from './run_bt05_nikki_candidate_loop';

type NikkiSeedSuiteName = 'promotion-holdout' | 'dev' | 'tuning';

export interface Bt05NikkiLearningBotSpec {
    botId: string;
    label: string;
    policyPath?: string;
}

export interface Bt05NikkiHoldPolicyPreset {
    id: string;
    label: string;
    minSamples: number;
    minHoldRate: number;
    minAverageReturnToGo: number;
}

export interface Bt05NikkiSelfPlayLearningLoopConfig {
    matchupId: string;
    champion: Bt05NikkiLearningBotSpec;
    maxIterations: number;
    maxStalledIterations: number;
    targetDeltaWinRate: number;
    promotionMinDeltaWinRate: number;
    selfPlayGamesPerIteration: number;
    screeningGamesPerSide: number;
    screeningTopK: number;
    screeningSeedSuiteName: NikkiSeedSuiteName;
    screeningSeedSuitePath: string;
    evaluationGamesPerSide: number;
    maxSteps: number;
    enableMulligan: boolean;
    traceLimit?: number;
    selfPlayStartSeed: number;
    selfPlayExplorationRate: number;
    suppressLogs: boolean;
    includeObservations: boolean;
    evaluationSeedSuiteName: NikkiSeedSuiteName;
    evaluationSeedSuitePath: string;
    policyPresets: Bt05NikkiHoldPolicyPreset[];
    outputPath?: string;
}

export interface Bt05NikkiSelfPlayLearningCandidateResult {
    preset: Bt05NikkiHoldPolicyPreset;
    policyArtifactPath: string;
    training: Bt05NikkiMainPhaseHoldPolicyTrainingReport;
    screening: NikkiCandidateLoopReport['summary'] | null;
    evaluation: NikkiCandidateLoopReport['summary'] | null;
}

export interface Bt05NikkiSelfPlayLearningIterationReport {
    iterationIndex: number;
    championBefore: Bt05NikkiLearningBotSpec;
    selfPlayArtifactPath: string;
    selfPlay: Bt05NikkiSelfPlayExportReport['summary'];
    candidateResults: Bt05NikkiSelfPlayLearningCandidateResult[];
    selectedCandidate: Bt05NikkiSelfPlayLearningCandidateResult | null;
    promoted: boolean;
    stalledIterations: number;
    championAfter: Bt05NikkiLearningBotSpec;
}

export interface Bt05NikkiSelfPlayLearningLoopReport {
    generatedAt: string;
    config: Bt05NikkiSelfPlayLearningLoopConfig;
    iterations: Bt05NikkiSelfPlayLearningIterationReport[];
    summary: {
        inProgress: boolean;
        reachedTarget: boolean;
        stoppedBecause: 'target_reached' | 'stalled' | 'max_iterations';
        finalChampion: Bt05NikkiLearningBotSpec;
        bestObservedDeltaWinRate: number;
        totalSelfPlayGames: number;
        totalSelfPlayTransitions: number;
    };
}

interface RunLearningLoopOptions {
    runSelfPlayExport?: (config: Bt05NikkiSelfPlayExportConfig, options: { champion: Bt05NikkiLearningBotSpec }) => Bt05NikkiSelfPlayExportReport;
    trainPolicy?: (config: Bt05NikkiMainPhaseHoldPolicyTrainingConfig) => Bt05NikkiMainPhaseHoldPolicyTrainingReport;
    evaluateCandidate?: (
        config: NikkiCandidateLoopConfig,
        candidate: Bt05NikkiLearningBotSpec,
        incumbent: Bt05NikkiLearningBotSpec,
    ) => NikkiCandidateLoopReport;
    persistPromotedPolicy?: (policyArtifactPath: string) => void;
}

function roundTo(value: number, digits: number): number {
    const p = 10 ** digits;
    return Math.round(value * p) / p;
}

function sanitizeArtifactSegment(value: string): string {
    const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return normalized.replace(/^-+|-+$/g, '') || 'unknown';
}

function parseIntEnv(name: string, fallback: number): number {
    const raw = process.env[name];
    if (!raw) return fallback;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function parseFloatEnv(name: string, fallback: number): number {
    const raw = process.env[name];
    if (!raw) return fallback;
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBoolEnv(name: string, fallback: boolean): boolean {
    const raw = process.env[name];
    if (!raw) return fallback;
    const normalized = raw.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function resolveOutputPath(defaultOutputPath: string): string | undefined {
    const raw = process.env.AI_NIKKI_LEARNING_LOOP_OUTPUT;
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

function defaultPolicyPresets(): Bt05NikkiHoldPolicyPreset[] {
    return [
        {
            id: 'perfect-s1',
            label: 'Perfect hold s1',
            minSamples: 1,
            minHoldRate: 1,
            minAverageReturnToGo: 0,
        },
        {
            id: 'perfect-s2',
            label: 'Perfect hold s2',
            minSamples: 2,
            minHoldRate: 1,
            minAverageReturnToGo: 0,
        },
        {
            id: 'strong-s2',
            label: 'Strong hold s2',
            minSamples: 2,
            minHoldRate: 0.75,
            minAverageReturnToGo: 0,
        },
        {
            id: 'positive-return',
            label: 'Positive-return hold',
            minSamples: 1,
            minHoldRate: 1,
            minAverageReturnToGo: 0.25,
        },
    ];
}

function buildArtifactPaths(outputPath: string): { latestPath: string; runsDir: string } {
    const latestPath = path.resolve(outputPath);
    return {
        latestPath,
        runsDir: path.join(path.dirname(latestPath), 'runs'),
    };
}

function buildBotFactory(spec: Bt05NikkiLearningBotSpec): BotFactory {
    if (spec.botId === 'practice-bt05-nikki-learned-hold-v1' && spec.policyPath) {
        const learnedMainPhaseHoldPolicy = loadBt05NikkiMainPhaseHoldPolicy(spec.policyPath);
        return (name: string) => new PracticeStrongBot(`Practice BT05 Nikki Learned Hold v1 ${name}`, bt05UnluckyBunnyNikkiOpeningProfile, {
            preferPracticeMainPhaseHold: false,
            learnedMainPhaseHoldPolicy,
        });
    }

    return resolveBotFactory(spec.botId);
}

function defaultRunSelfPlayExport(
    config: Bt05NikkiSelfPlayExportConfig,
    options: { champion: Bt05NikkiLearningBotSpec },
): Bt05NikkiSelfPlayExportReport {
    const championFactory = buildBotFactory(options.champion);
    return runBt05NikkiSelfPlayExport(config, {
        player1BotFactory: championFactory,
        player2BotFactory: championFactory,
    });
}

function defaultEvaluateCandidate(
    config: NikkiCandidateLoopConfig,
    candidate: Bt05NikkiLearningBotSpec,
    incumbent: Bt05NikkiLearningBotSpec,
): NikkiCandidateLoopReport {
    return runBt05NikkiCandidateLoop(config, {
        candidateBotFactory: buildBotFactory(candidate),
        incumbentBotFactory: buildBotFactory(incumbent),
    });
}

function defaultPersistPromotedPolicy(policyArtifactPath: string): void {
    const latestPath = path.resolve('artifacts', 'ai', 'rl', 'bt05_nikki_hold_policy', 'latest.json');
    fs.mkdirSync(path.dirname(latestPath), { recursive: true });
    fs.copyFileSync(policyArtifactPath, latestPath);
}

function rankCandidateSummaries(
    left: NikkiCandidateLoopReport['summary'],
    right: NikkiCandidateLoopReport['summary'],
): number {
    if (left.delta.winRate !== right.delta.winRate) {
        return right.delta.winRate - left.delta.winRate;
    }
    if (left.delta.self_lethal_open_rate !== right.delta.self_lethal_open_rate) {
        return left.delta.self_lethal_open_rate - right.delta.self_lethal_open_rate;
    }
    if (left.delta.wasteful_upgrade_rate !== right.delta.wasteful_upgrade_rate) {
        return left.delta.wasteful_upgrade_rate - right.delta.wasteful_upgrade_rate;
    }
    return 0;
}

function rankCandidateResults(
    left: Bt05NikkiSelfPlayLearningCandidateResult,
    right: Bt05NikkiSelfPlayLearningCandidateResult,
): number {
    const leftSummary = left.evaluation ?? left.screening;
    const rightSummary = right.evaluation ?? right.screening;
    if (leftSummary && rightSummary) {
        const ranked = rankCandidateSummaries(leftSummary, rightSummary);
        if (ranked !== 0) {
            return ranked;
        }
    } else if (leftSummary) {
        return -1;
    } else if (rightSummary) {
        return 1;
    }
    return left.preset.id.localeCompare(right.preset.id);
}

function buildLoopReport(
    config: Bt05NikkiSelfPlayLearningLoopConfig,
    iterations: Bt05NikkiSelfPlayLearningIterationReport[],
    champion: Bt05NikkiLearningBotSpec,
    bestObservedDeltaWinRate: number,
    reachedTarget: boolean,
    stoppedBecause: Bt05NikkiSelfPlayLearningLoopReport['summary']['stoppedBecause'],
    inProgress: boolean,
): Bt05NikkiSelfPlayLearningLoopReport {
    const totalSelfPlayGames = iterations.reduce((sum, iteration) => sum + iteration.selfPlay.totalGames, 0);
    const totalSelfPlayTransitions = iterations.reduce((sum, iteration) => sum + iteration.selfPlay.totalTransitions, 0);

    return {
        generatedAt: new Date().toISOString(),
        config,
        iterations,
        summary: {
            inProgress,
            reachedTarget,
            stoppedBecause,
            finalChampion: champion,
            bestObservedDeltaWinRate: roundTo(
                bestObservedDeltaWinRate === Number.NEGATIVE_INFINITY ? 0 : bestObservedDeltaWinRate,
                4,
            ),
            totalSelfPlayGames,
            totalSelfPlayTransitions,
        },
    };
}

export function runBt05NikkiSelfPlayLearningLoop(
    config: Bt05NikkiSelfPlayLearningLoopConfig,
    options: RunLearningLoopOptions = {},
): Bt05NikkiSelfPlayLearningLoopReport {
    const runSelfPlayExport = options.runSelfPlayExport ?? defaultRunSelfPlayExport;
    const trainPolicy = options.trainPolicy ?? trainBt05NikkiMainPhaseHoldPolicy;
    const evaluateCandidate = options.evaluateCandidate ?? defaultEvaluateCandidate;
    const persistPromotedPolicy = options.persistPromotedPolicy ?? defaultPersistPromotedPolicy;
    const artifactPaths = config.outputPath ? buildArtifactPaths(config.outputPath) : undefined;

    let champion = { ...config.champion };
    let bestObservedDeltaWinRate = Number.NEGATIVE_INFINITY;
    let reachedTarget = false;
    let stalledIterations = 0;
    let stoppedBecause: Bt05NikkiSelfPlayLearningLoopReport['summary']['stoppedBecause'] = 'max_iterations';
    const iterations: Bt05NikkiSelfPlayLearningIterationReport[] = [];
    const cumulativeSelfPlayArtifactPaths: string[] = [];

    for (let iterationIndex = 0; iterationIndex < config.maxIterations; iterationIndex += 1) {
        const iterationDir = artifactPaths
            ? path.join(artifactPaths.runsDir, `iteration-${String(iterationIndex + 1).padStart(2, '0')}`)
            : undefined;
        if (iterationDir) {
            fs.mkdirSync(iterationDir, { recursive: true });
        }

        const selfPlayArtifactPath = iterationDir
            ? path.join(iterationDir, 'selfplay.json')
            : path.resolve(`artifacts/ai/rl/bt05_nikki_learning_loop/iteration-${iterationIndex + 1}-selfplay.json`);
        const selfPlayReport = runSelfPlayExport({
            matchupId: config.matchupId,
            games: config.selfPlayGamesPerIteration,
            maxSteps: config.maxSteps,
            enableMulligan: config.enableMulligan,
            startSeed: config.selfPlayStartSeed + iterationIndex * config.selfPlayGamesPerIteration,
            player1BotId: champion.botId,
            player2BotId: champion.botId,
            explorationRate: config.selfPlayExplorationRate,
            suppressLogs: config.suppressLogs,
            includeObservations: config.includeObservations,
            outputPath: undefined,
        }, {
            champion,
        });
        writeJson(selfPlayArtifactPath, selfPlayReport);
        cumulativeSelfPlayArtifactPaths.push(selfPlayArtifactPath);

        const candidateResults: Bt05NikkiSelfPlayLearningCandidateResult[] = [];
        for (const preset of config.policyPresets) {
            const policyArtifactPath = iterationDir
                ? path.join(iterationDir, `policy-${sanitizeArtifactSegment(preset.id)}.json`)
                : path.resolve(`artifacts/ai/rl/bt05_nikki_learning_loop/policy-${preset.id}.json`);
            const training = trainPolicy({
                inputPaths: [...cumulativeSelfPlayArtifactPaths],
                outputPath: undefined,
                minSamples: preset.minSamples,
                minHoldRate: preset.minHoldRate,
                minAverageReturnToGo: preset.minAverageReturnToGo,
                policyId: `bt05-nikki-main-phase-hold-${preset.id}`,
                label: `BT05 Nikki Main Phase Hold ${preset.label}`,
            });
            writeJson(policyArtifactPath, training);
            if (training.summary.retainedEntryCount <= 0) {
                continue;
            }

            candidateResults.push({
                preset,
                policyArtifactPath,
                training,
                screening: null,
                evaluation: null,
            });
        }

        for (const candidateResult of candidateResults) {
            const candidateSpec: Bt05NikkiLearningBotSpec = {
                botId: 'practice-bt05-nikki-learned-hold-v1',
                label: `practice-bt05-nikki-learned-hold-v1__${candidateResult.preset.id}__iter${iterationIndex + 1}`,
                policyPath: candidateResult.policyArtifactPath,
            };
            if (config.screeningGamesPerSide > 0) {
                const screening = evaluateCandidate({
                    matchupId: config.matchupId,
                    incumbentBotId: champion.label,
                    candidateBotId: candidateSpec.label,
                    rounds: 1,
                    gamesPerSide: config.screeningGamesPerSide,
                    maxSteps: config.maxSteps,
                    enableMulligan: config.enableMulligan,
                    traceLimit: 0,
                    startSeed: config.selfPlayStartSeed + 5000 + iterationIndex * 100,
                    seedStride: config.screeningGamesPerSide,
                    measureRuntime: false,
                    suppressLogs: config.suppressLogs,
                    seedSuiteName: config.screeningSeedSuiteName,
                    seedSuitePath: config.screeningSeedSuitePath,
                    outputPath: undefined,
                }, candidateSpec, champion);
                candidateResult.screening = screening.summary;
            }
        }

        const finalists = config.screeningGamesPerSide > 0
            ? [...candidateResults]
                .sort(rankCandidateResults)
                .slice(0, Math.max(1, config.screeningTopK))
            : [...candidateResults];

        for (const finalist of finalists) {
            const candidateSpec: Bt05NikkiLearningBotSpec = {
                botId: 'practice-bt05-nikki-learned-hold-v1',
                label: `practice-bt05-nikki-learned-hold-v1__${finalist.preset.id}__iter${iterationIndex + 1}`,
                policyPath: finalist.policyArtifactPath,
            };
            const evaluation = evaluateCandidate({
                matchupId: config.matchupId,
                incumbentBotId: champion.label,
                candidateBotId: candidateSpec.label,
                rounds: 1,
                gamesPerSide: config.evaluationGamesPerSide,
                maxSteps: config.maxSteps,
                enableMulligan: config.enableMulligan,
                traceLimit: config.traceLimit,
                startSeed: config.selfPlayStartSeed + 10000 + iterationIndex * config.evaluationGamesPerSide,
                seedStride: config.evaluationGamesPerSide,
                measureRuntime: false,
                suppressLogs: config.suppressLogs,
                seedSuiteName: config.evaluationSeedSuiteName,
                seedSuitePath: config.evaluationSeedSuitePath,
                outputPath: undefined,
            }, candidateSpec, champion);
            finalist.evaluation = evaluation.summary;
        }

        candidateResults.sort(rankCandidateResults);
        const evaluatedResults = candidateResults.filter((candidateResult) => candidateResult.evaluation);
        const selectedCandidate = evaluatedResults[0] ?? null;
        if (selectedCandidate?.evaluation) {
            bestObservedDeltaWinRate = Math.max(bestObservedDeltaWinRate, selectedCandidate.evaluation.delta.winRate);
        }

        let promoted = false;
        if (selectedCandidate?.evaluation && selectedCandidate.evaluation.delta.winRate >= config.promotionMinDeltaWinRate) {
            champion = {
                botId: 'practice-bt05-nikki-learned-hold-v1',
                label: `practice-bt05-nikki-learned-hold-v1__${selectedCandidate.preset.id}__iter${iterationIndex + 1}`,
                policyPath: selectedCandidate.policyArtifactPath,
            };
            persistPromotedPolicy(selectedCandidate.policyArtifactPath);
            promoted = true;
            stalledIterations = 0;
        } else {
            stalledIterations += 1;
        }

        iterations.push({
            iterationIndex,
            championBefore: iterationIndex === 0 ? { ...config.champion } : { ...iterations[iterations.length - 1].championAfter },
            selfPlayArtifactPath,
            selfPlay: selfPlayReport.summary,
            candidateResults,
            selectedCandidate,
            promoted,
            stalledIterations,
            championAfter: { ...champion },
        });

        const iterationReachedTarget = selectedCandidate?.evaluation && selectedCandidate.evaluation.delta.winRate >= config.targetDeltaWinRate;
        const currentStoppedBecause = iterationReachedTarget
            ? 'target_reached'
            : stalledIterations >= config.maxStalledIterations
                ? 'stalled'
                : 'max_iterations';
        writeJson(config.outputPath, buildLoopReport(
            config,
            iterations,
            champion,
            bestObservedDeltaWinRate,
            reachedTarget || Boolean(iterationReachedTarget),
            currentStoppedBecause,
            true,
        ));

        if (iterationReachedTarget) {
            reachedTarget = true;
            stoppedBecause = 'target_reached';
            break;
        }

        if (stalledIterations >= config.maxStalledIterations) {
            stoppedBecause = 'stalled';
            break;
        }
    }

    if (!reachedTarget && iterations.length >= config.maxIterations && stoppedBecause !== 'stalled') {
        stoppedBecause = 'max_iterations';
    }

    const report = buildLoopReport(
        config,
        iterations,
        champion,
        bestObservedDeltaWinRate,
        reachedTarget,
        stoppedBecause,
        false,
    );

    writeJson(config.outputPath, report);
    return report;
}

export function formatBt05NikkiSelfPlayLearningLoopSummary(report: Bt05NikkiSelfPlayLearningLoopReport): string {
    const lastIteration = report.iterations[report.iterations.length - 1];
    const lastDelta = lastIteration?.selectedCandidate?.evaluation.delta.winRate ?? 0;
    return [
        'BT05 Nikki self-play learning loop',
        `iterations=${report.iterations.length}`,
        `inProgress=${report.summary.inProgress}`,
        `stoppedBecause=${report.summary.stoppedBecause}`,
        `reachedTarget=${report.summary.reachedTarget}`,
        `bestDelta=${report.summary.bestObservedDeltaWinRate}`,
        `lastDelta=${roundTo(lastDelta, 4)}`,
        `finalChampion=${report.summary.finalChampion.botId}${report.summary.finalChampion.policyPath ? ' (learned)' : ''}`,
        `selfPlayGames=${report.summary.totalSelfPlayGames}`,
        `selfPlayTransitions=${report.summary.totalSelfPlayTransitions}`,
    ].join('\n');
}

function buildConfigFromEnv(): Bt05NikkiSelfPlayLearningLoopConfig {
    const defaultOutputPath = path.join('artifacts', 'ai', 'rl', 'bt05_nikki_learning_loop', 'latest.json');
    const promotionMinDeltaWinRate = process.env.AI_NIKKI_LEARNING_LOOP_PROMOTION_MIN_DELTA
        ? parseFloatEnv('AI_NIKKI_LEARNING_LOOP_PROMOTION_MIN_DELTA', 0.0125)
        : parseFloatEnv('AI_NIKKI_LEARNING_LOOP_PROMOTION_DELTA', 0.0125);
    return {
        matchupId: process.env.AI_NIKKI_LEARNING_LOOP_MATCHUP ?? 'fm-c-bt05-unlucky-bunny-nikki-mirror',
        champion: {
            botId: process.env.AI_NIKKI_LEARNING_LOOP_START_BOT ?? 'practice-bt05-nikki-strong-v1',
            label: process.env.AI_NIKKI_LEARNING_LOOP_START_LABEL ?? 'practice-bt05-nikki-strong-v1',
            policyPath: process.env.AI_NIKKI_LEARNING_LOOP_START_POLICY_PATH,
        },
        maxIterations: parseIntEnv('AI_NIKKI_LEARNING_LOOP_MAX_ITERATIONS', 3),
        maxStalledIterations: parseIntEnv('AI_NIKKI_LEARNING_LOOP_MAX_STALLED', 2),
        targetDeltaWinRate: parseFloatEnv('AI_NIKKI_LEARNING_LOOP_TARGET_DELTA', 0.05),
        promotionMinDeltaWinRate,
        selfPlayGamesPerIteration: parseIntEnv('AI_NIKKI_LEARNING_LOOP_SELFPLAY_GAMES', 20),
        screeningGamesPerSide: parseIntEnv('AI_NIKKI_LEARNING_LOOP_SCREEN_GAMES_PER_SIDE', 10),
        screeningTopK: parseIntEnv('AI_NIKKI_LEARNING_LOOP_SCREEN_TOP_K', 1),
        screeningSeedSuiteName: (process.env.AI_NIKKI_LEARNING_LOOP_SCREEN_SEED_SUITE_NAME as NikkiSeedSuiteName | undefined) ?? 'dev',
        screeningSeedSuitePath: process.env.AI_NIKKI_LEARNING_LOOP_SCREEN_SEED_SUITE_PATH ?? 'artifacts/ai/seeds/phase3_v1.json',
        evaluationGamesPerSide: parseIntEnv('AI_NIKKI_LEARNING_LOOP_EVAL_GAMES_PER_SIDE', 40),
        maxSteps: parseIntEnv('AI_NIKKI_LEARNING_LOOP_MAX_STEPS', 1200),
        enableMulligan: parseBoolEnv('AI_NIKKI_LEARNING_LOOP_ENABLE_MULLIGAN', true),
        traceLimit: parseIntEnv('AI_NIKKI_LEARNING_LOOP_TRACE_LIMIT', 8),
        selfPlayStartSeed: parseIntEnv('AI_NIKKI_LEARNING_LOOP_START_SEED', 2026031800),
        selfPlayExplorationRate: parseFloatEnv('AI_NIKKI_LEARNING_LOOP_EXPLORATION_RATE', 0.02),
        suppressLogs: parseBoolEnv('AI_NIKKI_LEARNING_LOOP_SUPPRESS_LOGS', true),
        includeObservations: parseBoolEnv('AI_NIKKI_LEARNING_LOOP_INCLUDE_OBSERVATIONS', false),
        evaluationSeedSuiteName: 'promotion-holdout',
        evaluationSeedSuitePath: process.env.AI_NIKKI_LEARNING_LOOP_SEED_SUITE_PATH ?? 'artifacts/ai/seeds/phase3_v1.json',
        policyPresets: defaultPolicyPresets(),
        outputPath: resolveOutputPath(defaultOutputPath),
    };
}

function runCli(): void {
    const config = buildConfigFromEnv();
    const report = runBt05NikkiSelfPlayLearningLoop(config);
    console.log(formatBt05NikkiSelfPlayLearningLoopSummary(report));
    console.log(JSON.stringify({
        summary: report.summary,
        lastIteration: report.iterations[report.iterations.length - 1],
    }, null, 2));
}

const maybeMain = process.argv[1] ?? '';
if (maybeMain.endsWith('run_bt05_nikki_selfplay_learning_loop.ts') || maybeMain.endsWith('run_bt05_nikki_selfplay_learning_loop.js')) {
    runCli();
}
