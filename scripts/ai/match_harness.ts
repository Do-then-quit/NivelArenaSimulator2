import { GameEngine } from '../../src/logic/GameEngine';
import { BaselineBot } from '../../src/logic/ai/BaselineBot';
import { Card, EngineAction } from '../../src/logic/types';
import {
    buildDeterministicDeckForLeader,
    materializeDeckForMatch,
    pickDeterministicLeader,
    validateDeckAgainstLeader,
} from './deck_pool';

export type MatchTerminationReason = 'winner' | 'max_steps' | 'no_action' | 'invalid_action';

export interface BotLike {
    name: string;
    chooseAction(engine: GameEngine, actorPlayerId?: string): EngineAction | null;
}

export type BotFactory = (botName: string) => BotLike;

export interface SingleMatchConfig {
    seed: number;
    maxSteps: number;
    enableMulligan: boolean;
    traceLimit?: number;
    muteEngineLogs?: boolean;
    player1Name?: string;
    player2Name?: string;
    player1Deck?: Card[];
    player2Deck?: Card[];
    player1Leader?: Card;
    player2Leader?: Card;
    player1BotFactory?: BotFactory;
    player2BotFactory?: BotFactory;
}

export interface MatchReport {
    seed: number;
    reason: MatchTerminationReason;
    steps: number;
    turnCount: number;
    phase: string;
    interactionMode: string;
    actorPlayerId: string | null;
    winnerId: string | null;
    winnerPlayer: 1 | 2 | null;
    player1Damage: number;
    player2Damage: number;
    player1LeaderId: string;
    player2LeaderId: string;
    lastActions: string[];
}

const DEFAULT_TRACE_LIMIT = 18;

export function createBaselineBotFactory(): BotFactory {
    return (botName: string) => new BaselineBot(botName);
}

function formatAction(action: EngineAction): string {
    switch (action.type) {
        case 'PLAY_UNIT':
            return `PLAY_UNIT(h:${action.handIndex},z:${action.zoneIndex})`;
        case 'PLAY_ITEM':
            return `PLAY_ITEM(h:${action.handIndex},z:${action.zoneIndex})`;
        case 'PLAY_SKILL':
            return `PLAY_SKILL(h:${action.handIndex})`;
        case 'ACTIVATE_EFFECT':
            return `ACTIVATE_EFFECT(z:${action.zoneIndex},e:${action.effectIndex})`;
        case 'ATTACK':
            return `ATTACK(z:${action.attackerZoneIndex})`;
        case 'RESOLVE_BLOCK':
            return `RESOLVE_BLOCK(${action.shouldBlock ? 'Y' : 'N'})`;
        case 'RESOLVE_MULLIGAN':
            return `RESOLVE_MULLIGAN(${action.shouldMulligan ? 'Y' : 'N'})`;
        case 'SELECT_COST_HAND':
            return `SELECT_COST(h:${action.handIndex})`;
        case 'SELECT_ZONE_TARGET':
            return `SELECT_ZONE_TARGET(p:${action.targetPlayerId.slice(0, 6)},z:${action.zoneIndex})`;
        case 'SELECT_HAND_TARGET':
            return `SELECT_HAND_TARGET(p:${action.targetPlayerId.slice(0, 6)},h:${action.handIndex})`;
        case 'SELECT_TRASH_TARGET':
            return `SELECT_TRASH_TARGET(p:${action.targetPlayerId.slice(0, 6)},t:${action.trashIndex})`;
        case 'SELECT_REVEALED_TARGET':
            return `SELECT_REVEALED_TARGET(r:${action.revealedIndex})`;
        default:
            return action.type;
    }
}

function resolveWinnerPlayer(engine: GameEngine): 1 | 2 | null {
    if (!engine.state.winner) return null;
    return engine.state.players[0].id === engine.state.winner ? 1 : 2;
}

function snapshot(
    engine: GameEngine,
    seed: number,
    reason: MatchTerminationReason,
    steps: number,
    actorPlayerId: string | null,
    trace: string[],
): MatchReport {
    return {
        seed,
        reason,
        steps,
        turnCount: engine.state.turnCount,
        phase: engine.state.phase,
        interactionMode: engine.state.interactionMode,
        actorPlayerId,
        winnerId: engine.state.winner,
        winnerPlayer: resolveWinnerPlayer(engine),
        player1Damage: engine.state.players[0].damage.length,
        player2Damage: engine.state.players[1].damage.length,
        player1LeaderId: engine.state.players[0].levelZone?.id ?? 'NONE',
        player2LeaderId: engine.state.players[1].levelZone?.id ?? 'NONE',
        lastActions: [...trace],
    };
}

export function withMutedEngineLogs<T>(runner: () => T): T {
    const originalLog = console.log;
    const originalWarn = console.warn;
    console.log = () => undefined;
    console.warn = () => undefined;
    try {
        return runner();
    } finally {
        console.log = originalLog;
        console.warn = originalWarn;
    }
}

function runSingleMatchCore(config: SingleMatchConfig): MatchReport {
    const seed = config.seed;
    const maxSteps = config.maxSteps;
    const traceLimit = config.traceLimit ?? DEFAULT_TRACE_LIMIT;

    const player1Leader = config.player1Leader
        ? { ...config.player1Leader, id: `${config.player1Leader.id}_L_${seed}_1` }
        : pickDeterministicLeader(seed, 1);
    const player2Leader = config.player2Leader
        ? { ...config.player2Leader, id: `${config.player2Leader.id}_L_${seed}_2` }
        : pickDeterministicLeader(seed, 2);

    const player1Deck = config.player1Deck
        ? materializeDeckForMatch(config.player1Deck, seed + 101, 'P1')
        : buildDeterministicDeckForLeader(seed + 101, 'P1', player1Leader);
    const player2Deck = config.player2Deck
        ? materializeDeckForMatch(config.player2Deck, seed + 202, 'P2')
        : buildDeterministicDeckForLeader(seed + 202, 'P2', player2Leader);

    const player1DeckLegality = validateDeckAgainstLeader(player1Deck, player1Leader);
    if (!player1DeckLegality.valid) {
        throw new Error(
            `Illegal deck for P1 leader ${player1Leader.id}. errors=${player1DeckLegality.errors.join(' | ')}`,
        );
    }
    const player2DeckLegality = validateDeckAgainstLeader(player2Deck, player2Leader);
    if (!player2DeckLegality.valid) {
        throw new Error(
            `Illegal deck for P2 leader ${player2Leader.id}. errors=${player2DeckLegality.errors.join(' | ')}`,
        );
    }

    const engine = new GameEngine(
        config.player1Name ?? 'Bot-P1',
        config.player2Name ?? 'Bot-P2',
        player1Deck,
        player2Deck,
        player1Leader,
        player2Leader,
        { seed, enableMulligan: config.enableMulligan },
    );

    const player1Factory = config.player1BotFactory ?? createBaselineBotFactory();
    const player2Factory = config.player2BotFactory ?? createBaselineBotFactory();
    const bot1 = player1Factory('P1-Bot');
    const bot2 = player2Factory('P2-Bot');

    const trace: string[] = [];
    let steps = 0;
    while (!engine.state.winner && steps < maxSteps) {
        const actorPlayerId = engine.state.interactionOwnerPlayerId ?? engine.currentPlayer.id;
        const actorIsPlayer1 = engine.state.players[0].id === actorPlayerId;
        const actingBot = actorIsPlayer1 ? bot1 : bot2;

        const action = actingBot.chooseAction(engine, actorPlayerId);
        if (!action) {
            return snapshot(engine, seed, 'no_action', steps, actorPlayerId, trace);
        }

        trace.push(formatAction(action));
        if (trace.length > traceLimit) trace.shift();

        const ok = engine.step(action);
        if (!ok) {
            return snapshot(engine, seed, 'invalid_action', steps, actorPlayerId, trace);
        }

        steps += 1;
    }

    if (engine.state.winner) {
        return snapshot(engine, seed, 'winner', steps, engine.state.interactionOwnerPlayerId ?? engine.currentPlayer.id, trace);
    }

    return snapshot(engine, seed, 'max_steps', steps, engine.state.interactionOwnerPlayerId ?? engine.currentPlayer.id, trace);
}

export function runSingleMatch(config: SingleMatchConfig): MatchReport {
    if (config.muteEngineLogs ?? true) {
        return withMutedEngineLogs(() => runSingleMatchCore(config));
    }
    return runSingleMatchCore(config);
}
