import { describe, expect, it } from 'vitest';
import { GameEngine } from '../../src/logic/GameEngine';
import { StrongBot } from '../../src/logic/ai/StrongBot';
import { StrongBotV2 } from '../../src/logic/ai/StrongBotV2';
import { Attribute, Card, CardType, Phase } from '../../src/logic/types';
import { runMatchBatch } from '../../scripts/ai/run_match_batch';

function makeLeader(id: string): Card {
    return {
        id,
        name: id,
        type: CardType.LEADER,
        attribute: Attribute.NONE,
        cost: 0,
        text: '',
        effects: [],
    };
}

function makeUnit(id: string, overrides: Partial<Card> = {}): Card {
    return {
        id,
        name: id,
        type: CardType.UNIT,
        attribute: Attribute.NONE,
        cost: 1,
        power: 1000,
        hit: 1,
        text: '',
        effects: [],
        ...overrides,
    };
}

function createEngine(seed: number = 20260210): GameEngine {
    const deck1 = Array.from({ length: 30 }, (_v, i) => makeUnit(`P1_${i}`));
    const deck2 = Array.from({ length: 30 }, (_v, i) => makeUnit(`P2_${i}`));
    const engine = new GameEngine('P1', 'P2', deck1, deck2, makeLeader('P1L'), makeLeader('P2L'), { seed });
    engine.state.winner = null;
    engine.state.phase = Phase.MAIN;
    return engine;
}

describe('StrongBot Phase2', () => {
    it('creates deterministic simulation fork without mutating original state', () => {
        const engine = createEngine(6001);
        const actorId = engine.state.interactionOwnerPlayerId ?? engine.currentPlayer.id;
        const before = engine.getSerializableState();

        const forkA = engine.createSimulationFork();
        const actions = forkA.getLegalActions(actorId);
        expect(actions.length).toBeGreaterThan(0);

        const action = actions[0];
        const okA = forkA.step(action);
        expect(okA).toBe(true);

        const forkB = engine.createSimulationFork();
        const okB = forkB.step(action);
        expect(okB).toBe(true);

        expect(forkA.getSerializableState()).toEqual(forkB.getSerializableState());
        expect(engine.getSerializableState()).toEqual(before);
    });

    it('selects deterministic legal action via beam search on equal seeds', () => {
        const engineA = createEngine(6002);
        const engineB = createEngine(6002);
        const bot = new StrongBotV2('Strong-v2-Test', {
            beamWidth: 4,
            maxDepth: 3,
            expansionBudget: 72,
            rolloutVariants: 2,
        });

        const actorA = engineA.state.interactionOwnerPlayerId ?? engineA.currentPlayer.id;
        const actorB = engineB.state.interactionOwnerPlayerId ?? engineB.currentPlayer.id;
        const actionA = bot.chooseAction(engineA, actorA);
        const actionB = bot.chooseAction(engineB, actorB);
        expect(actionA).not.toBeNull();
        expect(actionA).toEqual(actionB);
        if (actionA) {
            expect(engineA.getLegalActions(actorA)).toContainEqual(actionA);
        }
    });

    it('runs v2 vs v1 batch without invalid/no_action terminations', () => {
        const report = runMatchBatch({
            startSeed: 2026021600,
            games: 8,
            maxSteps: 2000,
            enableMulligan: true,
            player1BotId: 'strong-v2',
            player2BotId: 'strong-v1',
        });

        expect(report.summary.totalGames).toBe(8);
        expect(report.summary.terminationCounts.invalid_action).toBe(0);
        expect(report.summary.terminationCounts.no_action).toBe(0);
    }, 15000);

    it('keeps v1 bot available for fallback compatibility', () => {
        const engine = createEngine(6003);
        const bot = new StrongBot('Strong-v1-Compat');
        const actorId = engine.state.interactionOwnerPlayerId ?? engine.currentPlayer.id;
        const action = bot.chooseAction(engine, actorId);
        expect(action).not.toBeNull();
    });
});
