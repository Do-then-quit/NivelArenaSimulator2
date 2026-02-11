import { GameEngine } from '../GameEngine';
import { Card, EngineAction } from '../types';
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
        let steps = 0;

        while (!engine.state.winner && steps < config.maxSteps) {
            const actorPlayerId = engine.state.interactionOwnerPlayerId ?? engine.currentPlayer.id;
            const actorIsPlayer1 = actorPlayerId === engine.state.players[0].id;
            const actor = actorIsPlayer1 ? engine.state.players[0] : engine.state.players[1];
            const actingBot = actorIsPlayer1 ? bot1 : bot2;

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
                };
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
                };
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
        };
    } finally {
        if (muteEngineLogs) {
            console.log = originalLog;
            console.warn = originalWarn;
        }
    }
}
