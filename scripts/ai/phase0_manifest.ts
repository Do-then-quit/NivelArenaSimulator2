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

export interface Phase0Manifest {
    version: string;
    bench: Phase0BenchDefaults;
    ladder: Phase0LadderDefaults;
    regression: Phase0RegressionConfig;
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
            'tests/cards/st01/st01_high_value_targeting_regression.test.ts',
            'tests/cards/st02/st02_high_value_targeting_regression.test.ts',
            'tests/cards/st03/st03_high_value_targeting_regression.test.ts',
            'tests/cards/bt01/bt01_high_value_targeting_regression.test.ts',
            'tests/ai/StrongBotV2InteractionSearch.vitest.test.ts',
        ],
        includeBotSoak: true,
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
