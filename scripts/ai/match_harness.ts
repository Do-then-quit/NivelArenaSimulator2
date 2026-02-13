import { GameEngine } from '../../src/logic/GameEngine';
import { BaselineBot } from '../../src/logic/ai/BaselineBot';
import { StrongBotV3SearchCoverage } from '../../src/logic/ai/StrongBotV3';
import { Card, EngineAction, PlayerState } from '../../src/logic/types';
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

interface SearchCoverageProvider {
    getSearchCoverage(): StrongBotV3SearchCoverage;
    resetTelemetry?(): void;
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
    tacticalMetrics: MatchTacticalMetrics;
    searchCoverage: StrongBotV3SearchCoverage;
}

const DEFAULT_TRACE_LIMIT = 18;

interface TacticalMetricCounters {
    upgradeActionCount: number;
    wastefulUpgradeCount: number;
    lethalOpportunityCount: number;
    lethalMissCount: number;
    selfLethalCheckCount: number;
    selfLethalOpenCount: number;
}

interface UpgradeActionContext {
    actorPlayerId: string;
    zoneIndex: number;
    oldPower: number;
    oldHit: number;
    laneHadOpponentUnit: boolean;
    opposingPower: number;
    preDirectPotential: number;
    opponentDamage: number;
}

export interface MatchTacticalMetrics {
    upgradeActionCount: number;
    wastefulUpgradeCount: number;
    lethalOpportunityCount: number;
    lethalMissCount: number;
    selfLethalCheckCount: number;
    selfLethalOpenCount: number;
    wastefulUpgradeRate: number;
    lethalMissRate: number;
    selfLethalOpenRate: number;
}

export function createBaselineBotFactory(): BotFactory {
    return (botName: string) => new BaselineBot(botName);
}

function roundTo(value: number, digits: number): number {
    const p = 10 ** digits;
    return Math.round(value * p) / p;
}

function safeDivide(numerator: number, denominator: number): number {
    if (denominator <= 0) return 0;
    return numerator / denominator;
}

function isSearchCoverageProvider(bot: BotLike): bot is BotLike & SearchCoverageProvider {
    return typeof (bot as Partial<SearchCoverageProvider>).getSearchCoverage === 'function';
}


function mergeCoverageEntries(entries: StrongBotV3SearchCoverage[]): StrongBotV3SearchCoverage {
    const aggregate = {
        root: { decisionCount: 0, legalActionCount: 0, exploredActionCount: 0 },
        interaction: { decisionCount: 0, legalActionCount: 0, exploredActionCount: 0 },
    };
    for (const entry of entries) {
        aggregate.root.decisionCount += entry.root.decisionCount;
        aggregate.root.legalActionCount += entry.root.legalActionCount;
        aggregate.root.exploredActionCount += entry.root.exploredActionCount;
        aggregate.interaction.decisionCount += entry.interaction.decisionCount;
        aggregate.interaction.legalActionCount += entry.interaction.legalActionCount;
        aggregate.interaction.exploredActionCount += entry.interaction.exploredActionCount;
    }
    return {
        root: {
            ...aggregate.root,
            exploredRate: roundTo(safeDivide(aggregate.root.exploredActionCount, aggregate.root.legalActionCount), 4),
        },
        interaction: {
            ...aggregate.interaction,
            exploredRate: roundTo(safeDivide(aggregate.interaction.exploredActionCount, aggregate.interaction.legalActionCount), 4),
        },
    };
}

function getPlayerById(engine: GameEngine, playerId: string): PlayerState | null {
    return engine.state.players.find(player => player.id === playerId) ?? null;
}

function getOpponentById(engine: GameEngine, playerId: string): PlayerState | null {
    return engine.state.players.find(player => player.id !== playerId) ?? null;
}

function getDirectUnblockedHitPotential(engine: GameEngine, attacker: PlayerState, defender: PlayerState): number {
    let total = 0;
    for (let lane = 0; lane < attacker.unitZones.length; lane++) {
        const attackerZone = attacker.unitZones[lane];
        if (!attackerZone?.unit) continue;
        if (defender.unitZones[lane]?.unit) continue;
        total += Math.max(0, engine.getUnitHit(attackerZone, attacker));
    }
    return total;
}

function getDirectLethalAttackLanes(engine: GameEngine, actorPlayerId: string): Set<number> {
    const actor = getPlayerById(engine, actorPlayerId);
    const opponent = getOpponentById(engine, actorPlayerId);
    if (!actor || !opponent) return new Set<number>();

    const legalActions = engine.getLegalActions(actorPlayerId);
    const lethalLanes = new Set<number>();

    for (const action of legalActions) {
        if (action.type !== 'ATTACK') continue;
        const lane = action.attackerZoneIndex;
        const attackerZone = actor.unitZones[lane];
        if (!attackerZone?.unit) continue;
        if (opponent.unitZones[lane]?.unit) continue;

        const hit = Math.max(0, engine.getUnitHit(attackerZone, actor));
        if (opponent.damage.length + hit >= 10) {
            lethalLanes.add(lane);
        }
    }

    return lethalLanes;
}

function hasImmediateDirectLethal(engine: GameEngine, actorPlayerId: string): boolean {
    return getDirectLethalAttackLanes(engine, actorPlayerId).size > 0;
}

function captureUpgradeContext(
    engine: GameEngine,
    actorPlayerId: string,
    action: EngineAction,
): UpgradeActionContext | null {
    if (action.type !== 'PLAY_UNIT') return null;
    const actor = getPlayerById(engine, actorPlayerId);
    const opponent = getOpponentById(engine, actorPlayerId);
    if (!actor || !opponent) return null;

    const existingZone = actor.unitZones[action.zoneIndex];
    if (!existingZone?.unit) return null;

    const opposingZone = opponent.unitZones[action.zoneIndex];
    const laneHadOpponentUnit = !!opposingZone?.unit;
    const opposingPower = laneHadOpponentUnit ? engine.getUnitPower(opposingZone, opponent) : 0;

    return {
        actorPlayerId,
        zoneIndex: action.zoneIndex,
        oldPower: engine.getUnitPower(existingZone, actor),
        oldHit: engine.getUnitHit(existingZone, actor),
        laneHadOpponentUnit,
        opposingPower,
        preDirectPotential: getDirectUnblockedHitPotential(engine, actor, opponent),
        opponentDamage: opponent.damage.length,
    };
}

function isWastefulUpgrade(engine: GameEngine, context: UpgradeActionContext): boolean {
    const actor = getPlayerById(engine, context.actorPlayerId);
    const opponent = getOpponentById(engine, context.actorPlayerId);
    if (!actor || !opponent) return true;

    const upgradedZone = actor.unitZones[context.zoneIndex];
    if (!upgradedZone?.unit) return true;

    const newPower = engine.getUnitPower(upgradedZone, actor);
    const newHit = engine.getUnitHit(upgradedZone, actor);
    const postDirectPotential = getDirectUnblockedHitPotential(engine, actor, opponent);

    const immediatePressureImproved = (!context.laneHadOpponentUnit && newHit > context.oldHit)
        || postDirectPotential > context.preDirectPotential;

    const combatSurvivalImproved = context.laneHadOpponentUnit
        && context.oldPower <= context.opposingPower
        && newPower > context.opposingPower;

    const lethalSetupImproved = context.opponentDamage + context.preDirectPotential < 10
        && context.opponentDamage + postDirectPotential >= 10;

    return !(immediatePressureImproved || combatSurvivalImproved || lethalSetupImproved);
}

function buildMatchTacticalMetrics(counters: TacticalMetricCounters): MatchTacticalMetrics {
    return {
        ...counters,
        wastefulUpgradeRate: roundTo(safeDivide(counters.wastefulUpgradeCount, counters.upgradeActionCount), 4),
        lethalMissRate: roundTo(safeDivide(counters.lethalMissCount, counters.lethalOpportunityCount), 4),
        selfLethalOpenRate: roundTo(safeDivide(counters.selfLethalOpenCount, counters.selfLethalCheckCount), 4),
    };
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
    tacticalCounters: TacticalMetricCounters,
    searchCoverage: StrongBotV3SearchCoverage,
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
        tacticalMetrics: buildMatchTacticalMetrics(tacticalCounters),
        searchCoverage,
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
    const telemetryBots = [bot1, bot2].filter(isSearchCoverageProvider);
    for (const bot of telemetryBots) {
        bot.resetTelemetry?.();
    }

    const trace: string[] = [];
    const tacticalCounters: TacticalMetricCounters = {
        upgradeActionCount: 0,
        wastefulUpgradeCount: 0,
        lethalOpportunityCount: 0,
        lethalMissCount: 0,
        selfLethalCheckCount: 0,
        selfLethalOpenCount: 0,
    };
    let steps = 0;
    while (!engine.state.winner && steps < maxSteps) {
        const actorPlayerId = engine.state.interactionOwnerPlayerId ?? engine.currentPlayer.id;
        const actorIsPlayer1 = engine.state.players[0].id === actorPlayerId;
        const actingBot = actorIsPlayer1 ? bot1 : bot2;
        const opponentPlayerId = engine.state.players.find(player => player.id !== actorPlayerId)?.id ?? null;
        const lethalAttackLanes = getDirectLethalAttackLanes(engine, actorPlayerId);
        const hadLethalOpportunity = lethalAttackLanes.size > 0;
        if (hadLethalOpportunity) {
            tacticalCounters.lethalOpportunityCount += 1;
        }
        const preOpponentImmediateLethal = opponentPlayerId ? hasImmediateDirectLethal(engine, opponentPlayerId) : false;

        const action = actingBot.chooseAction(engine, actorPlayerId);
        if (!action) {
            return snapshot(engine, seed, 'no_action', steps, actorPlayerId, trace, tacticalCounters, mergeCoverageEntries(telemetryBots.map(bot => bot.getSearchCoverage())));
        }

        const upgradeContext = captureUpgradeContext(engine, actorPlayerId, action);
        if (upgradeContext) {
            tacticalCounters.upgradeActionCount += 1;
        }

        trace.push(formatAction(action));
        if (trace.length > traceLimit) trace.shift();

        const ok = engine.step(action);
        if (!ok) {
            return snapshot(engine, seed, 'invalid_action', steps, actorPlayerId, trace, tacticalCounters, mergeCoverageEntries(telemetryBots.map(bot => bot.getSearchCoverage())));
        }

        if (hadLethalOpportunity) {
            const resolvedAsLethalAttack = action.type === 'ATTACK' && lethalAttackLanes.has(action.attackerZoneIndex);
            if (!resolvedAsLethalAttack) {
                tacticalCounters.lethalMissCount += 1;
            }
        }

        if (upgradeContext && isWastefulUpgrade(engine, upgradeContext)) {
            tacticalCounters.wastefulUpgradeCount += 1;
        }

        if (opponentPlayerId) {
            const nextActorPlayerId = engine.state.interactionOwnerPlayerId ?? engine.currentPlayer.id;
            if (nextActorPlayerId === opponentPlayerId) {
                tacticalCounters.selfLethalCheckCount += 1;
                const postOpponentImmediateLethal = hasImmediateDirectLethal(engine, opponentPlayerId);
                if (!preOpponentImmediateLethal && postOpponentImmediateLethal) {
                    tacticalCounters.selfLethalOpenCount += 1;
                }
            }
        }

        steps += 1;
    }

    if (engine.state.winner) {
        return snapshot(
            engine,
            seed,
            'winner',
            steps,
            engine.state.interactionOwnerPlayerId ?? engine.currentPlayer.id,
            trace,
            tacticalCounters,
            mergeCoverageEntries(telemetryBots.map(bot => bot.getSearchCoverage())),
        );
    }

    return snapshot(
        engine,
        seed,
        'max_steps',
        steps,
        engine.state.interactionOwnerPlayerId ?? engine.currentPlayer.id,
        trace,
        tacticalCounters,
        mergeCoverageEntries(telemetryBots.map(bot => bot.getSearchCoverage())),
    );
}

export function runSingleMatch(config: SingleMatchConfig): MatchReport {
    if (config.muteEngineLogs ?? true) {
        return withMutedEngineLogs(() => runSingleMatchCore(config));
    }
    return runSingleMatchCore(config);
}
