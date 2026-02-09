import { describe, expect, it } from 'vitest';
import { GameEngine } from '../../src/logic/GameEngine';
import { BaselineBot, BaselineTerminationReason } from '../../src/logic/ai/BaselineBot';
import { EngineAction } from '../../src/logic/types';
import {
    buildDeterministicDeckForLeader,
    getImplementedDeckPool,
    getImplementedLeaderPool,
    pickDeterministicLeader,
    validateDeckAgainstLeader,
} from '../../scripts/ai/deck_pool';

const LEADER_POOL = getImplementedLeaderPool();
const DECK_POOL = getImplementedDeckPool();

interface SoakRunReport {
    seed: number;
    reason: BaselineTerminationReason;
    steps: number;
    turnCount: number;
    phase: string;
    interactionMode: string;
    actorPlayerId: string | null;
    pendingActionType: string | null;
    selectedTargetCount: number;
    requiredTargetCount: number | null;
    player1Damage: number;
    player2Damage: number;
    player1LeaderId: string;
    player2LeaderId: string;
    lastActions: string[];
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

function makeEngine(seed: number): GameEngine {
    const leader1 = pickDeterministicLeader(seed, 1, LEADER_POOL);
    const leader2 = pickDeterministicLeader(seed, 2, LEADER_POOL);
    const deck1 = buildDeterministicDeckForLeader(seed + 101, 'P1', leader1, 40, DECK_POOL);
    const deck2 = buildDeterministicDeckForLeader(seed + 202, 'P2', leader2, 40, DECK_POOL);

    const deck1Legality = validateDeckAgainstLeader(deck1, leader1);
    if (!deck1Legality.valid) {
        throw new Error(`Illegal soak deck for P1 seed=${seed}: ${deck1Legality.errors.join(' | ')}`);
    }
    const deck2Legality = validateDeckAgainstLeader(deck2, leader2);
    if (!deck2Legality.valid) {
        throw new Error(`Illegal soak deck for P2 seed=${seed}: ${deck2Legality.errors.join(' | ')}`);
    }

    return new GameEngine('Bot-P1', 'Bot-P2', deck1, deck2, leader1, leader2, {
        seed,
        enableMulligan: true,
    });
}

function snapshot(
    engine: GameEngine,
    seed: number,
    reason: BaselineTerminationReason,
    steps: number,
    actorPlayerId: string | null,
    trace: string[],
): SoakRunReport {
    return {
        seed,
        reason,
        steps,
        turnCount: engine.state.turnCount,
        phase: engine.state.phase,
        interactionMode: engine.state.interactionMode,
        actorPlayerId,
        pendingActionType: engine.state.pendingEffect?.actionType ?? null,
        selectedTargetCount: engine.state.pendingEffect?.selectedTargets?.length ?? 0,
        requiredTargetCount: engine.state.pendingEffect?.targetSchema?.count ?? null,
        player1Damage: engine.state.players[0].damage.length,
        player2Damage: engine.state.players[1].damage.length,
        player1LeaderId: engine.state.players[0].levelZone?.id ?? 'NONE',
        player2LeaderId: engine.state.players[1].levelZone?.id ?? 'NONE',
        lastActions: [...trace],
    };
}

function runInstrumentedSelfPlay(seed: number, maxSteps: number, traceLimit: number = 18): SoakRunReport {
    const engine = makeEngine(seed);
    const bot1 = new BaselineBot('SoakBot-P1');
    const bot2 = new BaselineBot('SoakBot-P2');
    const trace: string[] = [];

    let steps = 0;
    while (!engine.state.winner && steps < maxSteps) {
        const actorPlayerId = engine.state.interactionOwnerPlayerId ?? engine.currentPlayer.id;
        const actorIsP1 = engine.state.players[0].id === actorPlayerId;
        const actorBot = actorIsP1 ? bot1 : bot2;

        const action = actorBot.chooseAction(engine, actorPlayerId);
        if (!action) {
            return snapshot(engine, seed, 'no_action', steps, actorPlayerId, trace);
        }

        trace.push(formatAction(action));
        if (trace.length > traceLimit) {
            trace.shift();
        }

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

function runSoakBatch(startSeed: number, gameCount: number, maxSteps: number): SoakRunReport[] {
    const reports: SoakRunReport[] = [];
    for (let i = 0; i < gameCount; i++) {
        reports.push(runInstrumentedSelfPlay(startSeed + i, maxSteps));
    }
    return reports;
}

function formatFailureReports(reports: SoakRunReport[], limit: number = 10): string {
    return reports
        .slice(0, limit)
        .map(report => {
            const trace = report.lastActions.length > 0 ? report.lastActions.join(' -> ') : '(none)';
            return [
                `seed=${report.seed}`,
                `reason=${report.reason}`,
                `steps=${report.steps}`,
                `turn=${report.turnCount}`,
                `phase=${report.phase}`,
                `mode=${report.interactionMode}`,
                `pending=${report.pendingActionType ?? 'NONE'}`,
                `selected=${report.selectedTargetCount}/${report.requiredTargetCount ?? '-'}`,
                `dmg=${report.player1Damage}:${report.player2Damage}`,
                `leaders=${report.player1LeaderId}/${report.player2LeaderId}`,
                `trace=${trace}`,
            ].join(', ');
        })
        .join('\n');
}

function withMutedEngineLogs<T>(runner: () => T): T {
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

describe('Rules v2 AI Bot Self-Play Soak Regression', () => {
    it('quick soak: bot vs bot should finish without deadlock reasons', () => {
        if (LEADER_POOL.length === 0 || DECK_POOL.length === 0) {
            throw new Error('Implemented card pool is empty. Check CardDatabase loading.');
        }

        const startSeed = Number(process.env.BOT_SOAK_START_SEED ?? '2026020800');
        const gameCount = Number(process.env.BOT_SOAK_QUICK_GAMES ?? '12');
        const maxSteps = Number(process.env.BOT_SOAK_MAX_STEPS ?? '2400');

        const reports = withMutedEngineLogs(() => runSoakBatch(startSeed, gameCount, maxSteps));
        const failures = reports.filter(report => report.reason !== 'winner');
        const reasonCounts = reports.reduce<Record<BaselineTerminationReason, number>>(
            (acc, report) => {
                acc[report.reason] += 1;
                return acc;
            },
            { winner: 0, max_steps: 0, no_action: 0, invalid_action: 0 }
        );

        console.info(`[BOT-SOAK][quick] seeds=${startSeed}..${startSeed + gameCount - 1}, counts=${JSON.stringify(reasonCounts)}`);

        if (failures.length > 0) {
            throw new Error(
                `Detected blocked/unfinished games in quick soak (${failures.length}/${gameCount}).\n` +
                `${formatFailureReports(failures)}`
            );
        }

        expect(failures).toHaveLength(0);
    });

    const runExtended = process.env.BOT_SOAK_ENABLE === '1';
    const extendedTest = runExtended ? it : it.skip;

    extendedTest('extended soak: reports seeds that stall in long self-play batch', () => {
        const startSeed = Number(process.env.BOT_SOAK_START_SEED ?? '2026020800');
        const gameCount = Number(process.env.BOT_SOAK_GAMES ?? '120');
        const maxSteps = Number(process.env.BOT_SOAK_MAX_STEPS ?? '2400');

        const reports = withMutedEngineLogs(() => runSoakBatch(startSeed, gameCount, maxSteps));
        const failures = reports.filter(report => report.reason !== 'winner');
        const reasonCounts = reports.reduce<Record<BaselineTerminationReason, number>>(
            (acc, report) => {
                acc[report.reason] += 1;
                return acc;
            },
            { winner: 0, max_steps: 0, no_action: 0, invalid_action: 0 }
        );

        console.info(`[BOT-SOAK][extended] seeds=${startSeed}..${startSeed + gameCount - 1}, counts=${JSON.stringify(reasonCounts)}`);

        if (failures.length > 0) {
            throw new Error(
                `Detected blocked/unfinished games in extended soak (${failures.length}/${gameCount}).\n` +
                `${formatFailureReports(failures)}`
            );
        }

        expect(failures).toHaveLength(0);
    });
});

