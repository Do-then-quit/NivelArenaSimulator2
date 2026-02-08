import { describe, expect, it } from 'vitest';
import { GameEngine } from '../../src/logic/GameEngine';
import { ActivationCondition, Attribute, Card, CardType, EngineAction, Phase } from '../../src/logic/types';

function makeLeader(id: string, effects: any[] = []): Card {
    return {
        id,
        name: id,
        type: CardType.LEADER,
        attribute: Attribute.NONE,
        cost: 0,
        text: '',
        effects
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
        ...overrides
    };
}

function createEngine(seed: number, p1Leader: Card = makeLeader('P1L'), p2Leader: Card = makeLeader('P2L')): GameEngine {
    const deck1 = Array(30).fill(null).map((_, i) => makeUnit(`P1_${i}`));
    const deck2 = Array(30).fill(null).map((_, i) => makeUnit(`P2_${i}`));
    const engine = new GameEngine('P1', 'P2', deck1, deck2, p1Leader, p2Leader, { seed });
    engine.state.winner = null;
    return engine;
}

describe('Rules v2 AI Ready Stage2/Stage3 Regression', () => {
    it('reproduces identical state with same seed and action sequence', () => {
        const e1 = createEngine(20260208);
        const e2 = createEngine(20260208);

        e1.nextPhase();
        e2.nextPhase();
        e1.nextPhase();
        e2.nextPhase();
        e1.nextPhase();
        e2.nextPhase();

        expect(e1.getSerializableState()).toEqual(e2.getSerializableState());
    });

    it('resolves RANDOM target selection deterministically with identical seeds', () => {
        const randomBuffer = makeUnit('RANDOM_BUFFER', {
            effects: [{
                activation: ActivationCondition.ENTRY,
                description: 'Random buff to ally',
                targets: {
                    scope: 'MY_FIELD',
                    type: 'UNIT',
                    count: 1,
                    filters: [{ type: 'EXCLUDE_SELF' }],
                    selectMode: 'RANDOM'
                },
                action: { type: 'BUFF_POWER', params: { value: 500 } }
            }]
        });

        const runScenario = () => {
            const engine = createEngine(77);
            const p1 = engine.state.players[0];
            engine.state.phase = Phase.MAIN;
            p1.leaderLevel = 10;
            p1.hand = [randomBuffer];
            p1.unitZones[1].unit = makeUnit('ALLY_1');
            p1.unitZones[2].unit = makeUnit('ALLY_2');
            engine.playUnit(0, 0);
            return p1.unitZones.map(z => z.buffs.length);
        };

        const resultA = runScenario();
        const resultB = runScenario();
        expect(resultA).toEqual(resultB);
    });

    it('keeps pending interaction state serializable without runtime context references', () => {
        const engine = createEngine(11);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.MAIN;

        p1.hand = [makeUnit('H1'), makeUnit('H2')];
        p2.unitZones[0].unit = makeUnit('EXITER', {
            effects: [{
                activation: ActivationCondition.EXIT,
                description: 'Opponent chooses opponent hand to discard',
                targets: { scope: 'OPP_HAND', type: 'CARD', count: 1, selectMode: 'MANUAL' },
                action: { type: 'DISCARD', params: { target: 'OPPONENT', count: 1 } }
            }]
        });

        engine.destroyUnit(p2, p2.unitZones[0]);

        expect(engine.state.interactionMode).toBe('SELECT_TARGET');
        expect(engine.state.pendingEffect?.targetSchema?.scope).toBe('OPP_HAND');

        const serialized = JSON.stringify(engine.getSerializableState());
        expect(serialized.includes('_context')).toBe(false);
        expect(serialized.includes('_fullEffect')).toBe(false);
    });

    it('exposes observation+legal actions through AI interface during interaction', () => {
        const engine = createEngine(15);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.MAIN;

        p1.hand = [makeUnit('H1'), makeUnit('H2')];
        p2.unitZones[0].unit = makeUnit('EXITER', {
            effects: [{
                activation: ActivationCondition.EXIT,
                description: 'Opponent chooses opponent hand to discard',
                targets: { scope: 'OPP_HAND', type: 'CARD', count: 1, selectMode: 'MANUAL' },
                action: { type: 'DISCARD', params: { target: 'OPPONENT', count: 1 } }
            }]
        });

        engine.destroyUnit(p2, p2.unitZones[0]);

        const actorId = engine.state.interactionOwnerPlayerId!;
        const obs = engine.getObservation(actorId);
        expect(obs.canAct).toBe(true);
        expect(obs.interactionOwnerPlayerId).toBe(actorId);
        expect(obs.state).not.toBe(engine.state);

        const handAction = obs.legalActions.find(
            (a): a is Extract<EngineAction, { type: 'SELECT_HAND_TARGET' }> => a.type === 'SELECT_HAND_TARGET'
        );

        expect(handAction).toBeDefined();
        expect(engine.step(handAction!)).toBe(true);
        expect(engine.state.interactionMode).toBe('NORMAL');
    });
});
