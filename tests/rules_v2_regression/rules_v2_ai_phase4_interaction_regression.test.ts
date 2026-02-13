import { describe, expect, it } from 'vitest';
import { GameEngine } from '../../src/logic/GameEngine';
import { StrongBotV3 } from '../../src/logic/ai/StrongBotV3';
import { ActivationCondition, Attribute, Card, CardType, Phase } from '../../src/logic/types';

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

function makeEngine(seed: number): GameEngine {
    const deck1 = Array.from({ length: 30 }, (_v, i) => makeUnit(`P1_${i}`));
    const deck2 = Array.from({ length: 30 }, (_v, i) => makeUnit(`P2_${i}`));
    const engine = new GameEngine('P1', 'P2', deck1, deck2, makeLeader('P1L'), makeLeader('P2L'), { seed });
    engine.state.winner = null;
    engine.state.turnPlayerIndex = 0;
    engine.state.phase = Phase.MAIN;
    return engine;
}

describe('Rules v2 AI Phase4 interaction regression', () => {
    it('SELECT_COST: prefers paying with lower tactical-value hand card', () => {
        const engine = makeEngine(9401);
        const actor = engine.state.players[0];
        actor.unitZones[0].unit = makeUnit('COST_SKILLER', {
            effects: [
                {
                    activation: ActivationCondition.ACTIVE_MAIN,
                    description: 'Trash 1 hand: draw 1',
                    cost: { type: 'TRASH_HAND', amount: 1 },
                    action: { type: 'DRAW', params: { amount: 1 } },
                },
            ],
        });
        actor.hand = [
            makeUnit('KEEP_HIGH', { cost: 4, power: 6000, hit: 2 }),
            makeUnit('PAY_LOW', { cost: 1, power: 1000, hit: 1 }),
        ];

        engine.activateEffect(0, 0);
        expect(engine.state.interactionMode).toBe('SELECT_COST');

        const bot = new StrongBotV3('Strong-v3-Phase4-Cost');
        const action = bot.chooseAction(engine, actor.id);
        expect(action).not.toBeNull();
        expect(action?.type).toBe('SELECT_COST_HAND');
        if (action?.type === 'SELECT_COST_HAND') {
            expect(action.handIndex).toBe(1);
        }
    });

    it('SELECT_TARGET: prefers removing higher-value opposing unit for DESTROY_UNIT', () => {
        const engine = makeEngine(9402);
        const actor = engine.state.players[0];
        const opponent = engine.state.players[1];
        actor.unitZones[0].unit = makeUnit('DESTROYER', {
            effects: [
                {
                    activation: ActivationCondition.ACTIVE_MAIN,
                    description: 'Choose 1 enemy unit: destroy it.',
                    targets: { scope: 'OPP_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
                    action: { type: 'DESTROY_UNIT' },
                },
            ],
        });
        opponent.unitZones[0].unit = makeUnit('LOW_THREAT', { cost: 1, power: 1000, hit: 1 });
        opponent.unitZones[2].unit = makeUnit('HIGH_THREAT', { cost: 5, power: 7000, hit: 2 });

        engine.activateEffect(0, 0);
        expect(engine.state.interactionMode).toBe('SELECT_TARGET');

        const bot = new StrongBotV3('Strong-v3-Phase4-Target');
        const action = bot.chooseAction(engine, actor.id);
        expect(action).not.toBeNull();
        expect(action?.type).toBe('SELECT_ZONE_TARGET');
        if (action?.type === 'SELECT_ZONE_TARGET') {
            expect(action.zoneIndex).toBe(2);
            expect(action.targetPlayerId).toBe(opponent.id);
        }
    });

    it('SELECT_OPTIONAL: skips optional TRASH_SELF self-harm line', () => {
        const engine = makeEngine(9403);
        const actor = engine.state.players[0];
        engine.state.interactionMode = 'SELECT_OPTIONAL';
        engine.state.interactionOwnerPlayerId = actor.id;
        engine.state.pendingEffect = {
            sourceCard: makeUnit('SRC'),
            sourcePlayerId: actor.id,
            controllerPlayerId: actor.id,
            actionType: 'TRASH_SELF',
            actionValue: {},
            effectDescription: 'You may trash this card.',
        };

        const bot = new StrongBotV3('Strong-v3-Phase4-Optional');
        const action = bot.chooseAction(engine, actor.id);
        expect(action).not.toBeNull();
        expect(action?.type).toBe('RESOLVE_OPTIONAL');
        if (action?.type === 'RESOLVE_OPTIONAL') {
            expect(action.confirm).toBe(false);
        }
    });
});
