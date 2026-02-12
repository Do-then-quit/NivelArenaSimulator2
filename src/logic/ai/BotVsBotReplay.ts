import { GameEngine } from '../GameEngine';
import { Card, EngineAction, PlayerState } from '../types';
import {
    buildDeterministicDeckForLeader,
    materializeDeckForMatch,
    pickDeterministicLeader,
} from '../../../scripts/ai/deck_pool';
import { BotModelId, createBotForModel } from './BotRegistry';

export type ReplayTerminationReason = 'winner' | 'max_steps' | 'no_action' | 'invalid_action';

export interface BotReplayDeckLoadout {
    seed: number;
    leader1: Card;
    leader2: Card;
    deck1: Card[];
    deck2: Card[];
    description: string;
}

export interface BotReplayActionLog {
    step: number;
    actorPlayerId: string;
    actorName: string;
    action: EngineAction;
    summary: string;
}

export interface RunBotReplayConfig {
    seed: number;
    maxSteps: number;
    enableMulligan: boolean;
    player1BotId: BotModelId;
    player2BotId: BotModelId;
    loadout: BotReplayDeckLoadout;
    chunkSize?: number;
    muteEngineLogs?: boolean;
    onProgress?: (steps: number) => void;
}

export interface BotReplaySimulationResult {
    seed: number;
    steps: number;
    terminationReason: ReplayTerminationReason;
    winnerId: string | null;
    finalTurnCount: number;
    finalPhase: string;
    finalInteractionMode: string;
    actions: BotReplayActionLog[];
    tacticalMetrics: ReplayTacticalMetrics;
}

interface ReplayTacticalMetricCounters {
    upgradeActionCount: number;
    wastefulUpgradeCount: number;
    lethalOpportunityCount: number;
    lethalMissCount: number;
    selfLethalCheckCount: number;
    selfLethalOpenCount: number;
}

interface ReplayUpgradeActionContext {
    actorPlayerId: string;
    zoneIndex: number;
    oldPower: number;
    oldHit: number;
    laneHadOpponentUnit: boolean;
    opposingPower: number;
    preDirectPotential: number;
    opponentDamage: number;
}

export interface ReplayTacticalMetrics {
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

function cloneCard(card: Card): Card {
    return JSON.parse(JSON.stringify(card));
}

function cloneDeck(deck: Card[]): Card[] {
    return deck.map(cloneCard);
}

function cloneLoadout(loadout: BotReplayDeckLoadout): BotReplayDeckLoadout {
    return {
        seed: loadout.seed,
        leader1: cloneCard(loadout.leader1),
        leader2: cloneCard(loadout.leader2),
        deck1: cloneDeck(loadout.deck1),
        deck2: cloneDeck(loadout.deck2),
        description: loadout.description,
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
            return `SELECT_COST_HAND(h:${action.handIndex})`;
        case 'RESOLVE_OPTIONAL':
            return `RESOLVE_OPTIONAL(${action.confirm ? 'Y' : 'N'})`;
        case 'SELECT_ZONE_TARGET':
            return `SELECT_ZONE_TARGET(z:${action.zoneIndex})`;
        case 'SELECT_HAND_TARGET':
            return `SELECT_HAND_TARGET(h:${action.handIndex})`;
        case 'SELECT_TRASH_TARGET':
            return `SELECT_TRASH_TARGET(t:${action.trashIndex})`;
        case 'SELECT_REVEALED_TARGET':
            return `SELECT_REVEALED_TARGET(r:${action.revealedIndex})`;
        default:
            return action.type;
    }
}

function sleepFrame(): Promise<void> {
    return new Promise(resolve => {
        globalThis.setTimeout(resolve, 0);
    });
}

function roundTo(value: number, digits: number): number {
    const p = 10 ** digits;
    return Math.round(value * p) / p;
}

function safeDivide(numerator: number, denominator: number): number {
    if (denominator <= 0) return 0;
    return numerator / denominator;
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
): ReplayUpgradeActionContext | null {
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

function isWastefulUpgrade(engine: GameEngine, context: ReplayUpgradeActionContext): boolean {
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

function buildReplayTacticalMetrics(counters: ReplayTacticalMetricCounters): ReplayTacticalMetrics {
    return {
        ...counters,
        wastefulUpgradeRate: roundTo(safeDivide(counters.wastefulUpgradeCount, counters.upgradeActionCount), 4),
        lethalMissRate: roundTo(safeDivide(counters.lethalMissCount, counters.lethalOpportunityCount), 4),
        selfLethalOpenRate: roundTo(safeDivide(counters.selfLethalOpenCount, counters.selfLethalCheckCount), 4),
    };
}

export function createRandomLegalLoadout(seed: number, mirrorDeck: boolean): BotReplayDeckLoadout {
    if (mirrorDeck) {
        const leaderTemplate = pickDeterministicLeader(seed, 1);
        const leader1 = { ...leaderTemplate, id: `${leaderTemplate.id}_L_${seed}_1` };
        const leader2 = { ...leaderTemplate, id: `${leaderTemplate.id}_L_${seed}_2` };
        const mirrorDeckSource = buildDeterministicDeckForLeader(seed + 101, 'MIRROR', leader1);
        const deck1 = materializeDeckForMatch(mirrorDeckSource, seed + 301, 'P1M');
        const deck2 = materializeDeckForMatch(mirrorDeckSource, seed + 302, 'P2M');
        return {
            seed,
            leader1,
            leader2,
            deck1,
            deck2,
            description: `Random legal mirror deck (seed=${seed})`,
        };
    }

    const leader1 = pickDeterministicLeader(seed, 1);
    const leader2 = pickDeterministicLeader(seed, 2);
    const deck1 = buildDeterministicDeckForLeader(seed + 101, 'P1', leader1);
    const deck2 = buildDeterministicDeckForLeader(seed + 202, 'P2', leader2);
    return {
        seed,
        leader1,
        leader2,
        deck1,
        deck2,
        description: `Random legal independent decks (seed=${seed})`,
    };
}

export function createReplayPlaybackEngine(loadout: BotReplayDeckLoadout, enableMulligan: boolean): GameEngine {
    const cloned = cloneLoadout(loadout);
    return new GameEngine(
        'Bot P1',
        'Bot P2',
        cloned.deck1,
        cloned.deck2,
        cloned.leader1,
        cloned.leader2,
        {
            seed: cloned.seed,
            enableMulligan,
        },
    );
}

export async function runBotVsBotReplaySimulation(config: RunBotReplayConfig): Promise<BotReplaySimulationResult> {
    const chunkSize = Math.max(8, Math.trunc(config.chunkSize ?? 32));
    const muteEngineLogs = config.muteEngineLogs ?? true;
    const originalLog = console.log;
    const originalWarn = console.warn;

    if (muteEngineLogs) {
        console.log = () => undefined;
        console.warn = () => undefined;
    }

    try {
        const engine = createReplayPlaybackEngine(config.loadout, config.enableMulligan);
        const bot1 = createBotForModel(config.player1BotId, 'Bot-P1');
        const bot2 = createBotForModel(config.player2BotId, 'Bot-P2');

        const actions: BotReplayActionLog[] = [];
        const tacticalCounters: ReplayTacticalMetricCounters = {
            upgradeActionCount: 0,
            wastefulUpgradeCount: 0,
            lethalOpportunityCount: 0,
            lethalMissCount: 0,
            selfLethalCheckCount: 0,
            selfLethalOpenCount: 0,
        };
        let steps = 0;

        while (!engine.state.winner && steps < config.maxSteps) {
            const actorPlayerId = engine.state.interactionOwnerPlayerId ?? engine.currentPlayer.id;
            const actorIsPlayer1 = actorPlayerId === engine.state.players[0].id;
            const actor = actorIsPlayer1 ? engine.state.players[0] : engine.state.players[1];
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
                return {
                    seed: config.seed,
                    steps,
                    terminationReason: 'no_action',
                    winnerId: engine.state.winner,
                    finalTurnCount: engine.state.turnCount,
                    finalPhase: engine.state.phase,
                    finalInteractionMode: engine.state.interactionMode,
                    actions,
                    tacticalMetrics: buildReplayTacticalMetrics(tacticalCounters),
                };
            }

            const upgradeContext = captureUpgradeContext(engine, actorPlayerId, action);
            if (upgradeContext) {
                tacticalCounters.upgradeActionCount += 1;
            }

            const ok = engine.step(action);
            if (!ok) {
                return {
                    seed: config.seed,
                    steps,
                    terminationReason: 'invalid_action',
                    winnerId: engine.state.winner,
                    finalTurnCount: engine.state.turnCount,
                    finalPhase: engine.state.phase,
                    finalInteractionMode: engine.state.interactionMode,
                    actions,
                    tacticalMetrics: buildReplayTacticalMetrics(tacticalCounters),
                };
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
            actions.push({
                step: steps,
                actorPlayerId,
                actorName: actor.name,
                action,
                summary: `${actor.name}: ${formatAction(action)}`,
            });

            if (config.onProgress) {
                config.onProgress(steps);
            }

            if (steps % chunkSize === 0) {
                await sleepFrame();
            }
        }

        return {
            seed: config.seed,
            steps,
            terminationReason: engine.state.winner ? 'winner' : 'max_steps',
            winnerId: engine.state.winner,
            finalTurnCount: engine.state.turnCount,
            finalPhase: engine.state.phase,
            finalInteractionMode: engine.state.interactionMode,
            actions,
            tacticalMetrics: buildReplayTacticalMetrics(tacticalCounters),
        };
    } finally {
        if (muteEngineLogs) {
            console.log = originalLog;
            console.warn = originalWarn;
        }
    }
}
