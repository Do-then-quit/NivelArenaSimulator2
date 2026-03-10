import fs from 'node:fs';
import path from 'node:path';

export interface Phase0BenchDefaults {
    startSeed: number;
    games: number;
    maxSteps: number;
    enableMulligan: boolean;
    traceLimit: number;
    outputPath: string;
}

export interface Phase0LadderDefaults {
    entrants: string[];
    startSeed: number;
    seedsPerPair: number;
    maxSteps: number;
    enableMulligan: boolean;
    kFactor: number;
    initialRating: number;
    outputPath: string;
}

export interface Phase0RegressionConfig {
    vitestFiles: string[];
    includeBotSoak: boolean;
}

export interface FixedMatchupBenchDefaults {
    matchupId: string;
    gamesPerSide: number;
    maxSteps: number;
    enableMulligan: boolean;
    traceLimit: number;
    startSeed: number;
    player1BotId: string;
    player2BotId: string;
    seedSuiteName: 'tuning' | 'dev' | 'promotion-holdout' | '';
    seedSuitePath: string;
    outputPath: string;
}

export interface Phase4StressMatrixPairing {
    player1BotId: string;
    player2BotId: string;
    games: number;
}

export interface Phase4StressMatrixConfig {
    startSeed: number;
    gamesPerPairing: number;
    maxSteps: number;
    enableMulligan: boolean;
    measureRuntime: boolean;
    outputPath: string;
    pairings: Phase4StressMatrixPairing[];
}

export interface Phase4RuntimeGateThresholds {
    p50MsPerActionMultiplier: number;
    p95MsPerActionMultiplier: number;
    avgMsPerGameMultiplier: number;
}

export interface Phase4RuntimeGateBaseline {
    p50MsPerAction: number;
    p95MsPerAction: number;
    avgMsPerGame: number;
}

export interface Phase0Phase4Config {
    stressMatrix: Phase4StressMatrixConfig;
    runtimeGateThresholds: Phase4RuntimeGateThresholds;
    runtimeGateBaseline: Phase4RuntimeGateBaseline;
    performanceGate: {
        minStrongV3WinRateVsStrongV2: number;
    };
}

export interface Phase41PromotionPerformanceGateConfig {
    minWinRate: number;
    minCi95Low: number;
}

export interface Phase41PromotionTacticalKpiGateConfig {
    minRelativeLethalMissReduction: number;
    allowSelfLethalOpenRegression: boolean;
    allowWastefulUpgradeRegression: boolean;
}

export interface Phase41PromotionConfig {
    candidateBotId: string;
    baselineBotId: string;
    controlBotId: string;
    seedSuitePath: string;
    seedSuiteName: 'tuning' | 'dev' | 'promotion-holdout';
    holdoutGamesPerRole: number;
    kpiComparisonGamesPerRole: number;
    maxSteps: number;
    enableMulligan: boolean;
    measureRuntime: boolean;
    suppressLogs: boolean;
    outputPath: string;
    artifactTag: string;
    performanceGate: Phase41PromotionPerformanceGateConfig;
    tacticalKpiGate: Phase41PromotionTacticalKpiGateConfig;
}

export interface Phase0Manifest {
    version: string;
    bench: Phase0BenchDefaults;
    ladder: Phase0LadderDefaults;
    regression: Phase0RegressionConfig;
    fixedMatchupBench: FixedMatchupBenchDefaults;
    phase4: Phase0Phase4Config;
    phase41Promotion: Phase41PromotionConfig;
}

const REPO_DEFAULT_MANIFEST_FILENAME = 'phase0.manifest.json';

const FALLBACK_PHASE0_MANIFEST: Phase0Manifest = {
    version: 'phase0-v1',
    bench: {
        startSeed: 2026020900,
        games: 12,
        maxSteps: 2400,
        enableMulligan: true,
        traceLimit: 18,
        outputPath: 'artifacts/ai/bench/latest.json',
    },
    ladder: {
        entrants: ['baseline-a', 'baseline-b'],
        startSeed: 2026020900,
        seedsPerPair: 6,
        maxSteps: 2400,
        enableMulligan: true,
        kFactor: 24,
        initialRating: 1000,
        outputPath: 'artifacts/ai/ladder/latest.json',
    },
    regression: {
        vitestFiles: [
            'tests/rules_v2_regression/rules_v2_ai_ready_stage1_regression.test.ts',
            'tests/rules_v2_regression/rules_v2_ai_ready_stage2_stage3_regression.test.ts',
            'tests/rules_v2_regression/rules_v2_ai_phase4_interaction_regression.test.ts',
            'tests/rules_v2_regression/rules_v2_ai_baseline_bot_regression.test.ts',
            'tests/rules_v2_regression/rules_v2_mulligan_regression.test.ts',
            'tests/rules_v2_regression/rules_v2_bt01_061_targeting_regression.test.ts',
            'tests/rules_v2_regression/rules_v2_ai_seed_2026021819_stack_regression.test.ts',
            'tests/ai/AiPhase0Harness.vitest.test.ts',
            'tests/ai/StrongBotPhase1.vitest.test.ts',
            'tests/ai/StrongBotPhase2.vitest.test.ts',
            'tests/ai/ActionScorerEffectAware.vitest.test.ts',
            'tests/ai/StrongBotObservationModel.vitest.test.ts',
            'tests/ai/SeedSuites.vitest.test.ts',
            'tests/ai/AblationPresets.vitest.test.ts',
            'tests/ai/BotRegistryPhase41.vitest.test.ts',
            'tests/ai/Phase4StressMatrix.vitest.test.ts',
            'tests/ai/Phase41PromotionGate.vitest.test.ts',
            'tests/cards/st01/st01_high_value_targeting_regression.test.ts',
            'tests/cards/st02/st02_high_value_targeting_regression.test.ts',
            'tests/cards/st03/st03_high_value_targeting_regression.test.ts',
            'tests/cards/bt01/bt01_high_value_targeting_regression.test.ts',
            'tests/ai/StrongBotV2InteractionSearch.vitest.test.ts',
            'tests/rules_v2_regression/rules_v2_ai_seed_2026021312_trash_toggle_regression.test.ts',
        ],
        includeBotSoak: true,
    },
    fixedMatchupBench: {
        matchupId: 'fm-b-fire-vs-storm',
        gamesPerSide: 12,
        maxSteps: 2400,
        enableMulligan: true,
        traceLimit: 18,
        startSeed: 2026032000,
        player1BotId: 'strong-v3',
        player2BotId: 'strong-v3',
        seedSuiteName: 'dev',
        seedSuitePath: 'artifacts/ai/seeds/phase3_v1.json',
        outputPath: 'artifacts/ai/fixed_matchup/bench/latest.json',
    },
    phase4: {
        stressMatrix: {
            startSeed: 2026021301,
            gamesPerPairing: 24,
            maxSteps: 2600,
            enableMulligan: true,
            measureRuntime: true,
            outputPath: 'artifacts/ai/phase4/stress_matrix_latest.json',
            pairings: [
                { player1BotId: 'strong-v3', player2BotId: 'baseline-a', games: 24 },
                { player1BotId: 'strong-v3', player2BotId: 'baseline-b', games: 24 },
                { player1BotId: 'strong-v3', player2BotId: 'strong-v1', games: 24 },
                { player1BotId: 'strong-v3', player2BotId: 'strong-v2', games: 24 },
                { player1BotId: 'strong-v2', player2BotId: 'strong-v3', games: 24 },
            ],
        },
        runtimeGateThresholds: {
            p50MsPerActionMultiplier: 1.25,
            p95MsPerActionMultiplier: 1.6,
            avgMsPerGameMultiplier: 1.4,
        },
        runtimeGateBaseline: {
            p50MsPerAction: 7.1877,
            p95MsPerAction: 8.2,
            avgMsPerGame: 801.88,
        },
        performanceGate: {
            minStrongV3WinRateVsStrongV2: 0.5,
        },
    },
    phase41Promotion: {
        candidateBotId: 'strong-v3.1-topk3',
        baselineBotId: 'strong-v3',
        controlBotId: 'strong-v2',
        seedSuitePath: 'artifacts/ai/seeds/phase3_v1.json',
        seedSuiteName: 'promotion-holdout',
        holdoutGamesPerRole: 200,
        kpiComparisonGamesPerRole: 200,
        maxSteps: 2600,
        enableMulligan: true,
        measureRuntime: true,
        suppressLogs: true,
        outputPath: 'artifacts/ai/phase4_1/promotion_gate_latest.json',
        artifactTag: 'phase4_1_v1',
        performanceGate: {
            minWinRate: 0.53,
            minCi95Low: 0.5,
        },
        tacticalKpiGate: {
            minRelativeLethalMissReduction: 0.15,
            allowSelfLethalOpenRegression: false,
            allowWastefulUpgradeRegression: false,
        },
    },
};

function mergeManifest(base: Phase0Manifest, input: Partial<Phase0Manifest>): Phase0Manifest {
    return {
        version: input.version ?? base.version,
        bench: {
            ...base.bench,
            ...(input.bench ?? {}),
        },
        ladder: {
            ...base.ladder,
            ...(input.ladder ?? {}),
        },
        regression: {
            ...base.regression,
            ...(input.regression ?? {}),
            vitestFiles: input.regression?.vitestFiles ?? base.regression.vitestFiles,
        },
        fixedMatchupBench: {
            ...base.fixedMatchupBench,
            ...(input.fixedMatchupBench ?? {}),
        },
        phase4: {
            ...base.phase4,
            ...(input.phase4 ?? {}),
            stressMatrix: {
                ...base.phase4.stressMatrix,
                ...(input.phase4?.stressMatrix ?? {}),
                pairings: input.phase4?.stressMatrix?.pairings ?? base.phase4.stressMatrix.pairings,
            },
            runtimeGateThresholds: {
                ...base.phase4.runtimeGateThresholds,
                ...(input.phase4?.runtimeGateThresholds ?? {}),
            },
            runtimeGateBaseline: {
                ...base.phase4.runtimeGateBaseline,
                ...(input.phase4?.runtimeGateBaseline ?? {}),
            },
            performanceGate: {
                ...base.phase4.performanceGate,
                ...(input.phase4?.performanceGate ?? {}),
            },
        },
        phase41Promotion: {
            ...base.phase41Promotion,
            ...(input.phase41Promotion ?? {}),
            performanceGate: {
                ...base.phase41Promotion.performanceGate,
                ...(input.phase41Promotion?.performanceGate ?? {}),
            },
            tacticalKpiGate: {
                ...base.phase41Promotion.tacticalKpiGate,
                ...(input.phase41Promotion?.tacticalKpiGate ?? {}),
            },
        },
    };
}

function parseManifestFile(manifestPath: string): Partial<Phase0Manifest> {
    const resolved = path.resolve(manifestPath);
    const raw = fs.readFileSync(resolved, 'utf8');
    return JSON.parse(raw) as Partial<Phase0Manifest>;
}

function loadRepositoryDefaultManifest(): Phase0Manifest {
    const repoDefaultPath = path.resolve(REPO_DEFAULT_MANIFEST_FILENAME);
    if (!fs.existsSync(repoDefaultPath)) {
        return mergeManifest(FALLBACK_PHASE0_MANIFEST, {});
    }

    try {
        const parsed = parseManifestFile(repoDefaultPath);
        return mergeManifest(FALLBACK_PHASE0_MANIFEST, parsed);
    } catch (error) {
        const details = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to load repository default phase0 manifest "${repoDefaultPath}": ${details}`);
    }
}

export const DEFAULT_PHASE0_MANIFEST: Phase0Manifest = loadRepositoryDefaultManifest();

function mergeWithDefaults(input: Partial<Phase0Manifest>): Phase0Manifest {
    return mergeManifest(DEFAULT_PHASE0_MANIFEST, input);
}

export function resolvePhase0ManifestPath(): string | undefined {
    const envPath = process.env.AI_PHASE0_MANIFEST;
    if (envPath && envPath.trim().length > 0) {
        return envPath.trim();
    }

    const repoDefaultPath = path.resolve(REPO_DEFAULT_MANIFEST_FILENAME);
    if (fs.existsSync(repoDefaultPath)) {
        return repoDefaultPath;
    }

    return undefined;
}

export function loadPhase0Manifest(manifestPath?: string): Phase0Manifest {
    if (!manifestPath) {
        return mergeWithDefaults({});
    }

    try {
        const parsed = parseManifestFile(manifestPath);
        return mergeWithDefaults(parsed);
    } catch (error) {
        const details = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to load phase0 manifest from "${manifestPath}": ${details}`);
    }
}
