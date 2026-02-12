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

function makeSacrificeToBuffUnit(): Card {
    return makeUnit('BT01-061_V3', {
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

function createEngine(seed: number = 20260314): GameEngine {
    const deck1 = Array.from({ length: 30 }, (_v, i) => makeUnit(`P1_${i}`));
    const deck2 = Array.from({ length: 30 }, (_v, i) => makeUnit(`P2_${i}`));
    const engine = new GameEngine('P1', 'P2', deck1, deck2, makeLeader('P1L'), makeLeader('P2L'), { seed });
    engine.state.winner = null;
    engine.state.turnPlayerIndex = 0;
    engine.state.phase = Phase.MAIN;
    return engine;
}

describe('StrongBotV3', () => {
    it('prefers sacrificing the lower-value unit first in SACRIFICE_TO_BUFF interaction', () => {
        const engine = createEngine(9301);
        const p1 = engine.state.players[0];
        p1.unitZones[0].unit = makeSacrificeToBuffUnit();
        p1.unitZones[1].unit = makeUnit('LOW', { cost: 1, power: 1000, hit: 1 });
        p1.unitZones[2].unit = makeUnit('HIGH', { cost: 4, power: 6000, hit: 2 });

        engine.activateEffect(0, 0);
        expect(engine.state.interactionMode).toBe('SELECT_TARGET');

        const bot = new StrongBotV3('Strong-v3-Sacrifice-Test', {
            beamWidth: 4,
            enableInteractionRollout: true,
            enableOpponentReplyPly: true,
        });

        const action = bot.chooseAction(engine, p1.id);
        expect(action).not.toBeNull();
        expect(action?.type).toBe('SELECT_ZONE_TARGET');
        if (action?.type === 'SELECT_ZONE_TARGET') {
            expect(action.zoneIndex).toBe(1);
        }
    });

    it('skips optional self-harm effects when actionType is TRASH_SELF', () => {
        const engine = createEngine(9302);
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

        const bot = new StrongBotV3('Strong-v3-Optional-Test');
        const action = bot.chooseAction(engine, actor.id);
        expect(action).not.toBeNull();
        expect(action?.type).toBe('RESOLVE_OPTIONAL');
        if (action?.type === 'RESOLVE_OPTIONAL') {
            expect(action.confirm).toBe(false);
        }
    });
});
