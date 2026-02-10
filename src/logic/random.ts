export interface RandomProvider {
    next(): number;
    clone?(): RandomProvider;
}

export class NativeRandomProvider implements RandomProvider {
    next(): number {
        return Math.random();
    }

    clone(): RandomProvider {
        return new NativeRandomProvider();
    }
}

// Deterministic PRNG (mulberry32)
export class SeededRandomProvider implements RandomProvider {
    private state: number;

    constructor(seed: number, options?: { fromState?: boolean }) {
        const normalizedSeed = Math.trunc(seed) >>> 0;
        if (options?.fromState) {
            this.state = normalizedSeed;
            return;
        }
        this.state = normalizedSeed === 0 ? 0x6d2b79f5 : normalizedSeed;
    }

    next(): number {
        let t = (this.state += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    clone(): RandomProvider {
        return new SeededRandomProvider(this.state, { fromState: true });
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
