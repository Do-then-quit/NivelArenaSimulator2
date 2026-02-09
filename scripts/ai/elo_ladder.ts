import fs from 'node:fs';
import path from 'node:path';
import { BaselineBot } from '../../src/logic/ai/BaselineBot';
import { BotFactory, MatchTerminationReason, runSingleMatch } from './match_harness';

export interface RunEloLadderConfig {
    entrants: string[];
    startSeed: number;
    seedsPerPair: number;
    maxSteps: number;
    enableMulligan: boolean;
    kFactor: number;
    initialRating: number;
}

export interface EloEntrantReport {
    entrantId: string;
    rating: number;
    games: number;
    wins: number;
    losses: number;
    draws: number;
    points: number;
}

export interface EloMatchReport {
    seed: number;
    pair: [string, string];
    swapped: boolean;
    reason: MatchTerminationReason;
    winnerEntrantId: string | null;
    steps: number;
    turnCount: number;
}

export interface EloLadderReport {
    config: RunEloLadderConfig;
    entrants: EloEntrantReport[];
    matches: EloMatchReport[];
}

const BOT_REGISTRY: Record<string, BotFactory> = {
    baseline: (name: string) => new BaselineBot(name),
    'baseline-a': (name: string) => new BaselineBot(name),
    'baseline-b': (name: string) => new BaselineBot(name),
};

function expectedScore(ra: number, rb: number): number {
    return 1 / (1 + 10 ** ((rb - ra) / 400));
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

function roundTo(value: number, digits: number): number {
    const p = 10 ** digits;
    return Math.round(value * p) / p;
}

function resolveEntrantFactory(entrantId: string): BotFactory {
    const direct = BOT_REGISTRY[entrantId];
    if (direct) return direct;
    if (entrantId.startsWith('baseline')) return BOT_REGISTRY.baseline;
    throw new Error(`Unknown entrant id: ${entrantId}`);
}

function toScore(
    winnerEntrantId: string | null,
    aEntrantId: string,
    bEntrantId: string,
): [number, number] {
    if (winnerEntrantId === null) return [0.5, 0.5];
    if (winnerEntrantId === aEntrantId) return [1, 0];
    if (winnerEntrantId === bEntrantId) return [0, 1];
    return [0.5, 0.5];
}

function safeSortedEntrants(items: EloEntrantReport[]): EloEntrantReport[] {
    return [...items].sort((a, b) => {
        if (b.rating !== a.rating) return b.rating - a.rating;
        return a.entrantId.localeCompare(b.entrantId);
    });
}

export function runEloLadder(config: RunEloLadderConfig): EloLadderReport {
    if (config.entrants.length < 2) {
        throw new Error('Elo ladder requires at least 2 entrants.');
    }

    const entrantState = new Map<string, EloEntrantReport>();
    config.entrants.forEach(id => {
        entrantState.set(id, {
            entrantId: id,
            rating: config.initialRating,
            games: 0,
            wins: 0,
            losses: 0,
            draws: 0,
            points: 0,
        });
    });

    const matches: EloMatchReport[] = [];
    let seedCursor = config.startSeed;

    for (let i = 0; i < config.entrants.length; i++) {
        for (let j = i + 1; j < config.entrants.length; j++) {
            const entrantA = config.entrants[i];
            const entrantB = config.entrants[j];
            const factoryA = resolveEntrantFactory(entrantA);
            const factoryB = resolveEntrantFactory(entrantB);

            for (let k = 0; k < config.seedsPerPair; k++) {
                const seed = seedCursor++;
                const pairGames = [
                    {
                        swapped: false,
                        player1Entrant: entrantA,
                        player2Entrant: entrantB,
                        player1Factory: factoryA,
                        player2Factory: factoryB,
                    },
                    {
                        swapped: true,
                        player1Entrant: entrantB,
                        player2Entrant: entrantA,
                        player1Factory: factoryB,
                        player2Factory: factoryA,
                    },
                ];

                for (const game of pairGames) {
                    const result = runSingleMatch({
                        seed,
                        maxSteps: config.maxSteps,
                        enableMulligan: config.enableMulligan,
                        player1BotFactory: game.player1Factory,
                        player2BotFactory: game.player2Factory,
                    });

                    const winnerEntrantId = result.reason === 'winner'
                        ? (result.winnerPlayer === 1 ? game.player1Entrant : game.player2Entrant)
                        : null;
                    const [scoreA, scoreB] = toScore(winnerEntrantId, entrantA, entrantB);

                    const stateA = entrantState.get(entrantA);
                    const stateB = entrantState.get(entrantB);
                    if (!stateA || !stateB) {
                        throw new Error('Entrant state missing while processing ladder.');
                    }

                    const expectedA = expectedScore(stateA.rating, stateB.rating);
                    const expectedB = 1 - expectedA;
                    stateA.rating += config.kFactor * (scoreA - expectedA);
                    stateB.rating += config.kFactor * (scoreB - expectedB);

                    stateA.games += 1;
                    stateB.games += 1;
                    stateA.points += scoreA;
                    stateB.points += scoreB;

                    if (scoreA === 1) {
                        stateA.wins += 1;
                        stateB.losses += 1;
                    } else if (scoreB === 1) {
                        stateB.wins += 1;
                        stateA.losses += 1;
                    } else {
                        stateA.draws += 1;
                        stateB.draws += 1;
                    }

                    matches.push({
                        seed,
                        pair: [entrantA, entrantB],
                        swapped: game.swapped,
                        reason: result.reason,
                        winnerEntrantId,
                        steps: result.steps,
                        turnCount: result.turnCount,
                    });
                }
            }
        }
    }

    const entrants = safeSortedEntrants(
        [...entrantState.values()].map(entry => ({
            ...entry,
            rating: roundTo(entry.rating, 2),
            points: roundTo(entry.points, 2),
        })),
    );

    return {
        config: { ...config, entrants: [...config.entrants] },
        entrants,
        matches,
    };
}

function writeIfRequested(outputPath: string | undefined, report: EloLadderReport): void {
    if (!outputPath) return;
    const resolved = path.resolve(outputPath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, JSON.stringify(report, null, 2), 'utf8');
}

function runCli(): void {
    const entrantsRaw = process.env.AI_LADDER_ENTRANTS ?? 'baseline-a,baseline-b';
    const entrants = entrantsRaw
        .split(',')
        .map(token => token.trim())
        .filter(token => token.length > 0);

    const config: RunEloLadderConfig = {
        entrants,
        startSeed: parseIntEnv('AI_LADDER_START_SEED', 2026020900),
        seedsPerPair: parseIntEnv('AI_LADDER_SEEDS_PER_PAIR', 6),
        maxSteps: parseIntEnv('AI_LADDER_MAX_STEPS', 2400),
        enableMulligan: parseBoolEnv('AI_LADDER_ENABLE_MULLIGAN', true),
        kFactor: parseFloatEnv('AI_LADDER_K_FACTOR', 24),
        initialRating: parseFloatEnv('AI_LADDER_INITIAL_RATING', 1000),
    };

    const report = runEloLadder(config);
    writeIfRequested(process.env.AI_LADDER_OUTPUT, report);
    console.log(JSON.stringify(report, null, 2));
}

const maybeMain = process.argv[1] ?? '';
if (maybeMain.endsWith('elo_ladder.ts') || maybeMain.endsWith('elo_ladder.js')) {
    runCli();
}

