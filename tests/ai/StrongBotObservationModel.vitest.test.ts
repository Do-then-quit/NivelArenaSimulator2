import { describe, expect, it } from 'vitest';
import { GameEngine } from '../../src/logic/GameEngine';
import { StrongBotV3 } from '../../src/logic/ai/StrongBotV3';
import { Attribute, Card, CardType, Phase } from '../../src/logic/types';

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

function createEngine(seed: number = 20260312): GameEngine {
    const deck1 = Array.from({ length: 30 }, (_v, i) => makeUnit(`P1_${i}`));
    const deck2 = Array.from({ length: 30 }, (_v, i) => makeUnit(`P2_${i}`));
    const engine = new GameEngine('P1', 'P2', deck1, deck2, makeLeader('P1L'), makeLeader('P2L'), {
        seed,
        enableMulligan: true,
    });
    engine.state.winner = null;
    engine.state.phase = Phase.MAIN;
    return engine;
}

describe('StrongBot observation model compliance', () => {
    it('chooses an action without direct engine state reads when actor id is supplied', () => {
        const engine = createEngine(2026031201);
        const actorId = engine.state.interactionOwnerPlayerId ?? engine.currentPlayer.id;
        const bot = new StrongBotV3('Strong-v3-ObsModel');

        const restrictedEngine = {
            getObservation: engine.getObservation.bind(engine),
            createSimulationFork: engine.createSimulationFork.bind(engine),
            get state() {
                throw new Error('direct state read is disallowed in this compliance test');
            },
            get currentPlayer() {
                throw new Error('direct currentPlayer read is disallowed in this compliance test');
            },
        } as unknown as GameEngine;

        const action = bot.chooseAction(restrictedEngine, actorId);
        expect(action).not.toBeNull();
        if (action) {
            expect(engine.getLegalActions(actorId)).toContainEqual(action);
        }
    });

    it('remains deterministic on identical seeds and board states', () => {
        const engineA = createEngine(2026031202);
        const engineB = createEngine(2026031202);
        const actorA = engineA.state.interactionOwnerPlayerId ?? engineA.currentPlayer.id;
        const actorB = engineB.state.interactionOwnerPlayerId ?? engineB.currentPlayer.id;
        const bot = new StrongBotV3('Strong-v3-Deterministic');

        const actionA = bot.chooseAction(engineA, actorA);
        const actionB = bot.chooseAction(engineB, actorB);
        expect(actionA).not.toBeNull();
        expect(actionA).toEqual(actionB);
    });
});
