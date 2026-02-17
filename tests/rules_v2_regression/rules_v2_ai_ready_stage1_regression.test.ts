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

function createEngine(p1Leader: Card = makeLeader('P1L'), p2Leader: Card = makeLeader('P2L')): GameEngine {
    const deck1 = Array(30).fill(null).map((_, i) => makeUnit(`P1_${i}`));
    const deck2 = Array(30).fill(null).map((_, i) => makeUnit(`P2_${i}`));
    const engine = new GameEngine('P1', 'P2', deck1, deck2, p1Leader, p2Leader);
    engine.state.winner = null;
    return engine;
}

describe('Rules v2 AI Ready Stage1 Regression', () => {
    it('exposes defender interaction ownership during BLOCK declaration (Rule 7.3)', () => {
        const engine = createEngine();
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.ATTACK;

        p1.unitZones[0].unit = makeUnit('ATK');
        p2.unitZones[0].unit = makeUnit('BLK');

        engine.attack(0);

        expect(engine.state.phase).toBe(Phase.BLOCK);
        expect(engine.state.interactionOwnerPlayerId).toBe(p2.id);

        const p1Actions = engine.getLegalActions(p1.id);
        const p2Actions = engine.getLegalActions(p2.id);
        expect(p1Actions.some(a => a.type === 'RESOLVE_BLOCK')).toBe(false);
        expect(p2Actions.filter(a => a.type === 'RESOLVE_BLOCK')).toHaveLength(2);
    });

    it('keeps damage-trigger manual target ownership on damaged player after direct attack to empty lane', () => {
        const engine = createEngine();
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.ATTACK;

        p1.unitZones[0].unit = makeUnit('ATK_0', { power: 7000, hit: 1 });
        p2.unitZones.forEach(zone => {
            zone.unit = null;
            zone.items = [];
        });

        const triggerCard = makeUnit('BT01-006_SIM', {
            effects: [
                {
                    activation: ActivationCondition.DAMAGE_TRIGGER,
                    description: '이 카드를 트래시한다.',
                    action: { type: 'TRASH_SELF', params: {} },
                },
                {
                    activation: ActivationCondition.DAMAGE_TRIGGER,
                    description: '필드에 있는 상대 유닛을 1장 골라, 이 턴이 끝날 때까지 파워-5000.',
                    targets: { scope: 'OPP_FIELD', type: 'UNIT', selectMode: 'MANUAL', count: 1 },
                    action: { type: 'BUFF_POWER', params: { value: -5000 } },
                    duration: 'TURN_END',
                },
            ],
        });

        p2.deck = [makeUnit('FILLER'), triggerCard];

        engine.attack(0);

        expect(engine.state.interactionMode).toBe('SELECT_TARGET');
        expect(engine.state.interactionOwnerPlayerId).toBe(p2.id);
        expect(engine.state.pendingEffect?.sourcePlayerId).toBe(p2.id);
        expect(engine.state.pendingEffect?.controllerPlayerId).toBe(p2.id);

        const p1Actions = engine.getLegalActions(p1.id);
        const p2Actions = engine.getLegalActions(p2.id);

        expect(p1Actions.some(a => a.type === 'SELECT_ZONE_TARGET')).toBe(false);
        const botSelectAction = p2Actions.find(
            (a): a is Extract<EngineAction, { type: 'SELECT_ZONE_TARGET' }> =>
                a.type === 'SELECT_ZONE_TARGET' && a.targetPlayerId === p1.id && a.zoneIndex === 0,
        );
        expect(botSelectAction).toBeDefined();

        const beforePower = engine.getUnitPower(p1.unitZones[0], p1);
        expect(engine.step(botSelectAction!)).toBe(true);
        expect(engine.getUnitPower(p1.unitZones[0], p1)).toBe(beforePower - 5000);
    });

    it('enumerates normal-phase legal actions only for turn player', () => {
        const engine = createEngine();
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.MAIN;

        p1.leaderLevel = 10;
        p1.hand = [makeUnit('HAND_UNIT', { cost: 1 })];
        p1.unitZones.forEach(zone => {
            zone.unit = null;
            zone.items = [];
            zone.hasPlacedUnitThisTurn = false;
        });

        const p1Actions = engine.getLegalActions(p1.id);
        const p2Actions = engine.getLegalActions(p2.id);

        expect(p1Actions.some(a => a.type === 'NEXT_PHASE')).toBe(true);
        expect(p1Actions.some(a => a.type === 'PLAY_UNIT')).toBe(true);
        expect(p2Actions.length).toBe(0);
    });

    it('routes SELECT_COST_HAND to the source player, even when not turn player', () => {
        const engine = createEngine();
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.MAIN;

        p2.hand = [makeUnit('COST_CARD')];

        const fakeEffect = {
            activation: ActivationCondition.ACTIVE,
            description: 'Pay 1 card',
            cost: { type: 'TRASH_HAND', amount: 1 },
            action: { type: 'NONE', params: {} }
        };

        engine.initiateCostSelection(fakeEffect, {
            sourceCard: makeUnit('SOURCE'),
            player: p2,
            opponent: p1,
            machine: engine
        });

        expect(engine.state.interactionOwnerPlayerId).toBe(p2.id);

        const costAction = engine
            .getLegalActions(p2.id)
            .find((a): a is Extract<EngineAction, { type: 'SELECT_COST_HAND' }> => a.type === 'SELECT_COST_HAND');

        expect(costAction).toBeDefined();
        expect(engine.step(costAction!)).toBe(true);
        expect(p2.hand.length).toBe(0);
        expect(p2.trash.some(c => c.id === 'COST_CARD')).toBe(true);
    });

    it('supports player-id hand targeting through step() when source is non-turn player', () => {
        const engine = createEngine();
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
        expect(engine.state.interactionOwnerPlayerId).toBe(p1.id);

        const handAction = engine
            .getLegalActions(p1.id)
            .find((a): a is Extract<EngineAction, { type: 'SELECT_HAND_TARGET' }> =>
                a.type === 'SELECT_HAND_TARGET' && a.targetPlayerId === p1.id
            );

        expect(handAction).toBeDefined();
        expect(engine.step(handAction!)).toBe(true);
        expect(p1.hand.length).toBe(1);
        expect(engine.state.interactionMode).toBe('NORMAL');
    });
});
