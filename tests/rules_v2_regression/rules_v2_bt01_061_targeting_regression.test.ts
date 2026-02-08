import { describe, expect, it } from 'vitest';
import { GameEngine } from '../../src/logic/GameEngine';
import { BaselineBot } from '../../src/logic/ai/BaselineBot';
import { ActivationCondition, Attribute, Card, CardType, EngineAction, Phase } from '../../src/logic/types';

function makeLeader(id: string): Card {
    return {
        id,
        name: id,
        type: CardType.LEADER,
        attribute: Attribute.NONE,
        cost: 0,
        text: '',
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
        ...overrides,
    };
}

function makeBt01061(): Card {
    return makeUnit('BT01-061', {
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

function createEngine(seed: number = 20260208): GameEngine {
    const deck1 = Array(30).fill(null).map((_, i) => makeUnit(`P1_${i}`));
    const deck2 = Array(30).fill(null).map((_, i) => makeUnit(`P2_${i}`));
    const engine = new GameEngine('P1', 'P2', deck1, deck2, makeLeader('P1L'), makeLeader('P2L'), { seed });
    engine.state.winner = null;
    return engine;
}

describe('Rules v2 BT01-061 Targeting Regression', () => {
    it('exposes CONFIRM_TARGETS only after required manual selections or when additional selection is impossible (Rule 1.3.2)', () => {
        const engine = createEngine(401);
        const p1 = engine.state.players[0];

        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.MAIN;
        p1.unitZones[0].unit = makeBt01061();
        p1.unitZones[1].unit = makeUnit('LOW', { cost: 1, power: 1000, hit: 1 });
        p1.unitZones[2].unit = makeUnit('HIGH', { cost: 3, power: 5000, hit: 2 });

        engine.activateEffect(0, 0);
        const actorId = p1.id;

        let actions = engine.getLegalActions(actorId);
        expect(actions.some(action => action.type === 'CONFIRM_TARGETS')).toBe(false);

        const firstSelect = actions.find(
            (action): action is Extract<EngineAction, { type: 'SELECT_ZONE_TARGET' }> =>
                action.type === 'SELECT_ZONE_TARGET' && action.targetPlayerId === p1.id && action.zoneIndex === 1
        );
        expect(firstSelect).toBeDefined();
        expect(engine.step(firstSelect!)).toBe(true);

        actions = engine.getLegalActions(actorId);
        expect(actions.some(action => action.type === 'CONFIRM_TARGETS')).toBe(false);

        const secondSelect = actions.find(
            (action): action is Extract<EngineAction, { type: 'SELECT_ZONE_TARGET' }> =>
                action.type === 'SELECT_ZONE_TARGET' && action.targetPlayerId === p1.id && action.zoneIndex === 2
        );
        expect(secondSelect).toBeDefined();
        expect(engine.step(secondSelect!)).toBe(true);

        actions = engine.getLegalActions(actorId);
        expect(actions.some(action => action.type === 'CONFIRM_TARGETS')).toBe(true);
    });

    it('baseline bot resolves BT01-061 in two distinct picks then confirm (sacrifice -> buff)', () => {
        const engine = createEngine(777);
        const bot = new BaselineBot();
        const p1 = engine.state.players[0];

        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.MAIN;
        p1.unitZones[0].unit = makeBt01061();
        p1.unitZones[1].unit = makeUnit('LOW', { cost: 1, power: 1000, hit: 1 });
        p1.unitZones[2].unit = makeUnit('HIGH', { cost: 4, power: 6000, hit: 2 });

        const buffBefore = engine.getUnitPower(p1.unitZones[2], p1);

        engine.activateEffect(0, 0);
        expect(engine.state.interactionMode).toBe('SELECT_TARGET');

        const action1 = bot.chooseAction(engine, p1.id);
        expect(action1?.type).toBe('SELECT_ZONE_TARGET');
        expect(action1?.type === 'SELECT_ZONE_TARGET' ? action1.zoneIndex : -1).toBe(1);
        expect(engine.step(action1!)).toBe(true);
        expect(engine.state.pendingEffect?.selectedTargets?.length).toBe(1);

        const action2 = bot.chooseAction(engine, p1.id);
        expect(action2?.type).toBe('SELECT_ZONE_TARGET');
        expect(action2?.type === 'SELECT_ZONE_TARGET' ? action2.zoneIndex : -1).toBe(2);
        expect(engine.step(action2!)).toBe(true);
        expect(engine.state.pendingEffect?.selectedTargets?.length).toBe(2);

        const action3 = bot.chooseAction(engine, p1.id);
        expect(action3?.type).toBe('CONFIRM_TARGETS');
        expect(engine.step(action3!)).toBe(true);

        expect(engine.state.interactionMode).toBe('NORMAL');
        expect(p1.unitZones[1].unit).toBeNull();
        expect(engine.getUnitPower(p1.unitZones[2], p1)).toBe(buffBefore + 2000);
    });
});

