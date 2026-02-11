import { describe, expect, it } from 'vitest';
import { GameEngine } from '../../src/logic/GameEngine';
import { StrongBotV2 } from '../../src/logic/ai/StrongBotV2';
import { ActivationCondition, Attribute, Card, CardType, EngineAction, Phase } from '../../src/logic/types';

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

function makeSacrificeToBuffUnit(): Card {
    return makeUnit('BT01-061_SIM', {
        cost: 4,
        effects: [
            {
                activation: ActivationCondition.ACTIVE_MAIN,
                description: 'Choose 2 friendly units: trash 1, buff the other by +2000.',
                targets: { scope: 'MY_FIELD', type: 'UNIT', count: 2, selectMode: 'MANUAL' },
                action: { type: 'SACRIFICE_TO_BUFF', params: { powerValue: 2000 } },
            },
        ],
    });
}

function makeCostSelectionUnit(): Card {
    return makeUnit('COST_SELECT_SIM', {
        cost: 2,
        effects: [
            {
                activation: ActivationCondition.ACTIVE_MAIN,
                description: 'Trash 1 hand card as cost, then draw 1.',
                cost: { type: 'TRASH_HAND', amount: 1 },
                action: { type: 'DRAW', params: { value: 1 } },
            },
        ],
    });
}

function makeOptionalSelectionUnit(): Card {
    return makeUnit('OPTIONAL_SELECT_SIM', {
        cost: 2,
        effects: [
            {
                activation: ActivationCondition.ACTIVE_MAIN,
                description: 'You may draw 1.',
                optional: true,
                action: { type: 'DRAW', params: { value: 1 } },
            },
        ],
    });
}

function createEngine(seed: number = 20260211): GameEngine {
    const deck1 = Array.from({ length: 30 }, (_v, i) => makeUnit(`P1_${i}`));
    const deck2 = Array.from({ length: 30 }, (_v, i) => makeUnit(`P2_${i}`));
    const engine = new GameEngine('P1', 'P2', deck1, deck2, makeLeader('P1L'), makeLeader('P2L'), { seed });
    engine.state.winner = null;
    engine.state.turnPlayerIndex = 0;
    engine.state.phase = Phase.MAIN;
    return engine;
}

describe('StrongBotV2 Interaction Search', () => {
    it('creates deterministic simulation forks while SELECT_TARGET interaction is active', () => {
        const engine = createEngine(9101);
        const p1 = engine.state.players[0];
        p1.unitZones[0].unit = makeSacrificeToBuffUnit();
        p1.unitZones[1].unit = makeUnit('LOW', { cost: 1, power: 1000, hit: 1 });
        p1.unitZones[2].unit = makeUnit('HIGH', { cost: 4, power: 6000, hit: 2 });

        engine.activateEffect(0, 0);
        expect(engine.state.interactionMode).toBe('SELECT_TARGET');
        const actorId = p1.id;
        const before = engine.getSerializableState();

        const forkA = engine.createSimulationFork();
        const legalA = forkA.getLegalActions(actorId);
        expect(legalA.length).toBeGreaterThan(0);
        const action = legalA[0];
        expect(forkA.step(action)).toBe(true);

        const forkB = engine.createSimulationFork();
        expect(forkB.step(action)).toBe(true);

        expect(forkA.getSerializableState()).toEqual(forkB.getSerializableState());
        expect(engine.getSerializableState()).toEqual(before);
    });

    it('chooses a legal action in SELECT_TARGET via search even when fallback is unavailable', () => {
        const engine = createEngine(9102);
        const p1 = engine.state.players[0];
        p1.unitZones[0].unit = makeSacrificeToBuffUnit();
        p1.unitZones[1].unit = makeUnit('LOW', { cost: 1, power: 1000, hit: 1 });
        p1.unitZones[2].unit = makeUnit('HIGH', { cost: 4, power: 6000, hit: 2 });
        engine.activateEffect(0, 0);

        const bot = new StrongBotV2('Strong-v2-Interaction-Target', {
            beamWidth: 4,
            maxDepth: 3,
            expansionBudget: 80,
            rolloutVariants: 1,
        });
        (bot as any).fallback = { chooseAction: () => null };

        const action = bot.chooseAction(engine, p1.id);
        expect(action).not.toBeNull();
        expect(engine.getLegalActions(p1.id)).toContainEqual(action as EngineAction);
    });

    it('chooses a legal action in SELECT_COST via search even when fallback is unavailable', () => {
        const engine = createEngine(9103);
        const p1 = engine.state.players[0];
        p1.unitZones[0].unit = makeCostSelectionUnit();
        p1.hand = [
            makeUnit('COST_FODDER_LOW', { cost: 1, power: 1000, hit: 1 }),
            makeUnit('COST_FODDER_HIGH', { cost: 3, power: 5000, hit: 2 }),
        ];

        engine.activateEffect(0, 0);
        expect(engine.state.interactionMode).toBe('SELECT_COST');

        const bot = new StrongBotV2('Strong-v2-Interaction-Cost', {
            beamWidth: 4,
            maxDepth: 3,
            expansionBudget: 80,
            rolloutVariants: 1,
        });
        (bot as any).fallback = { chooseAction: () => null };

        const action = bot.chooseAction(engine, p1.id);
        expect(action).not.toBeNull();
        expect(action?.type).toBe('SELECT_COST_HAND');
        expect(engine.getLegalActions(p1.id)).toContainEqual(action as EngineAction);
    });

    it('chooses a legal action in SELECT_OPTIONAL via search even when fallback is unavailable', () => {
        const engine = createEngine(9104);
        const p1 = engine.state.players[0];
        p1.unitZones[0].unit = makeOptionalSelectionUnit();

        engine.activateEffect(0, 0);
        expect(engine.state.interactionMode).toBe('SELECT_OPTIONAL');

        const bot = new StrongBotV2('Strong-v2-Interaction-Optional', {
            beamWidth: 4,
            maxDepth: 3,
            expansionBudget: 80,
            rolloutVariants: 1,
        });
        (bot as any).fallback = { chooseAction: () => null };

        const action = bot.chooseAction(engine, p1.id);
        expect(action).not.toBeNull();
        expect(action?.type).toBe('RESOLVE_OPTIONAL');
        expect(engine.getLegalActions(p1.id)).toContainEqual(action as EngineAction);
    });
});
