export interface RandomProvider {
    next(): number;
}

export class NativeRandomProvider implements RandomProvider {
    next(): number {
        return Math.random();
    }
}

// Deterministic PRNG (mulberry32)
export class SeededRandomProvider implements RandomProvider {
    private state: number;

    constructor(seed: number) {
        const normalizedSeed = Math.trunc(seed) >>> 0;
        this.state = normalizedSeed === 0 ? 0x6d2b79f5 : normalizedSeed;
    }

    next(): number {
        let t = (this.state += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
}

export function createRandomProvider(seed?: number, provider?: RandomProvider): RandomProvider {
    if (provider) {
        return provider;
    }

    if (seed === undefined) {
        return new NativeRandomProvider();
    }

    return new SeededRandomProvider(seed);
}
