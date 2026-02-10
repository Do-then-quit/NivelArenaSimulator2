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

export const DEFAULT_PHASE0_MANIFEST: Phase0Manifest = {
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
            'tests/rules_v2_regression/rules_v2_ai_baseline_bot_regression.test.ts',
            'tests/rules_v2_regression/rules_v2_mulligan_regression.test.ts',
            'tests/rules_v2_regression/rules_v2_bt01_061_targeting_regression.test.ts',
            'tests/ai/AiPhase0Harness.vitest.test.ts',
            'tests/ai/StrongBotPhase1.vitest.test.ts',
            'tests/ai/StrongBotPhase2.vitest.test.ts',
        ],
        includeBotSoak: true,
    },
};

function mergeWithDefaults(input: Partial<Phase0Manifest>): Phase0Manifest {
    return {
        version: input.version ?? DEFAULT_PHASE0_MANIFEST.version,
        bench: {
            ...DEFAULT_PHASE0_MANIFEST.bench,
            ...(input.bench ?? {}),
        },
        ladder: {
            ...DEFAULT_PHASE0_MANIFEST.ladder,
            ...(input.ladder ?? {}),
        },
        regression: {
            ...DEFAULT_PHASE0_MANIFEST.regression,
            ...(input.regression ?? {}),
            vitestFiles: input.regression?.vitestFiles ?? DEFAULT_PHASE0_MANIFEST.regression.vitestFiles,
        },
    };
}

function parseManifestFile(manifestPath: string): Partial<Phase0Manifest> {
    const resolved = path.resolve(manifestPath);
    const raw = fs.readFileSync(resolved, 'utf8');
    return JSON.parse(raw) as Partial<Phase0Manifest>;
}

export function resolvePhase0ManifestPath(): string | undefined {
    const envPath = process.env.AI_PHASE0_MANIFEST;
    if (envPath && envPath.trim().length > 0) {
        return envPath.trim();
    }

    const repoDefaultPath = path.resolve('phase0.manifest.json');
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
