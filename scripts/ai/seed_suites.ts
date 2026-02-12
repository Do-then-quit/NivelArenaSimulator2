import fs from 'node:fs';
import path from 'node:path';

export type SeedSuiteName = 'tuning' | 'dev' | 'promotion-holdout';

export interface SeedSuiteRange {
    startSeed: number;
    count: number;
    step?: number;
}

export interface SeedSuiteFile {
    version: string;
    description?: string;
    suites: Record<SeedSuiteName, number[] | SeedSuiteRange>;
}

function isFiniteInteger(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value);
}

function expandSeedSuiteEntry(entry: number[] | SeedSuiteRange, suiteName: SeedSuiteName): number[] {
    if (Array.isArray(entry)) {
        if (entry.length === 0) {
            throw new Error(`Seed suite "${suiteName}" is empty.`);
        }
        if (!entry.every(isFiniteInteger)) {
            throw new Error(`Seed suite "${suiteName}" must contain only finite integers.`);
        }
        return [...entry];
    }

    const startSeed = entry.startSeed;
    const count = entry.count;
    const step = entry.step ?? 1;
    if (!isFiniteInteger(startSeed)) {
        throw new Error(`Seed suite "${suiteName}" range.startSeed must be a finite integer.`);
    }
    if (!isFiniteInteger(count) || count <= 0) {
        throw new Error(`Seed suite "${suiteName}" range.count must be a positive integer.`);
    }
    if (!isFiniteInteger(step) || step <= 0) {
        throw new Error(`Seed suite "${suiteName}" range.step must be a positive integer.`);
    }

    return Array.from({ length: count }, (_v, index) => startSeed + index * step);
}

export function parseSeedListCsv(raw: string | undefined): number[] | undefined {
    if (!raw) return undefined;
    const tokens = raw.split(',').map(token => token.trim()).filter(token => token.length > 0);
    if (tokens.length === 0) return undefined;

    const seeds = tokens.map(token => Number.parseInt(token, 10));
    if (!seeds.every(seed => Number.isFinite(seed))) {
        throw new Error(`Invalid AI_BENCH_SEED_LIST value: "${raw}"`);
    }
    return seeds;
}

export function loadSeedSuiteFile(filePath: string): SeedSuiteFile {
    const resolvedPath = path.resolve(filePath);
    const raw = fs.readFileSync(resolvedPath, 'utf8');
    return JSON.parse(raw) as SeedSuiteFile;
}

export function resolveSeedSuiteSeeds(filePath: string, suiteName: SeedSuiteName): { file: SeedSuiteFile; seeds: number[] } {
    const file = loadSeedSuiteFile(filePath);
    const entry = file.suites?.[suiteName];
    if (!entry) {
        throw new Error(`Seed suite "${suiteName}" not found in "${filePath}".`);
    }
    const seeds = expandSeedSuiteEntry(entry, suiteName);
    return { file, seeds };
}
