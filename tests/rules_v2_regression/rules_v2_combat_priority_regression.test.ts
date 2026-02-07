import { describe, expect, it } from 'vitest';
import { ActionRegistry } from '../../src/logic/effectActions';
import { GameEngine } from '../../src/logic/GameEngine';
import { ActivationCondition, Attribute, Card, CardType, Phase } from '../../src/logic/types';

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

function makeItem(id: string, overrides: Partial<Card> = {}): Card {
    return {
        id,
        name: id,
        type: CardType.ITEM,
        attribute: Attribute.NONE,
        cost: 1,
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

describe('Rules v2 Combat/Priority Regression', () => {
    it('enters DEFENSE_DECLARATION and BLOCK phase when encounter exists', () => {
        const engine = createEngine();
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];
        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.ATTACK;

        p1.unitZones[0].unit = makeUnit('ATK');
        p2.unitZones[0].unit = makeUnit('BLK');

        engine.attack(0);

        expect(engine.state.combatStep).toBe('DEFENSE_DECLARATION');
        expect(engine.state.phase).toBe(Phase.BLOCK);
        expect(engine.state.pendingAttackerIndex).toBe(0);
    });

    it('completes blocked battle and returns to ATTACK phase with combat state reset', () => {
        const engine = createEngine();
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];
        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.ATTACK;

        p1.unitZones[0].unit = makeUnit('ATK', { power: 5000, hit: 1 });
        p2.unitZones[0].unit = makeUnit('BLK', { power: 3000, hit: 1 });
        const damageBefore = p2.damage.length;

        engine.attack(0);
        engine.resolveBlock(true);

        expect(p2.unitZones[0].unit).toBeNull();
        expect(p1.unitZones[0].unit).not.toBeNull();
        expect(p2.damage.length).toBe(damageBefore);
        expect(engine.state.combatStep).toBe('NONE');
        expect(engine.state.phase).toBe(Phase.ATTACK);
        expect(engine.state.pendingAttackerIndex).toBeNull();
    });

    it('skips BLOCK when no encounter and deals direct damage before ending combat', () => {
        const engine = createEngine();
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];
        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.ATTACK;

        p1.unitZones[1].unit = makeUnit('ATK', { hit: 2 });
        const damageBefore = p2.damage.length;

        engine.attack(1);

        expect(p2.damage.length).toBe(damageBefore + 2);
        expect(engine.state.combatStep).toBe('NONE');
        expect(engine.state.phase).toBe(Phase.ATTACK);
        expect(engine.state.pendingAttackerIndex).toBeNull();
    });

    it('queues ATTACKER effects from unit+item in one simultaneous batch', () => {
        const engine = createEngine();
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];
        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.ATTACK;

        p1.unitZones[0].unit = makeUnit('ATK', {
            effects: [{
                activation: ActivationCondition.ATTACKER,
                description: 'UNIT_ATTACKER',
                action: { type: 'NONE', params: {} }
            }]
        });
        p1.unitZones[0].items = [
            makeItem('ATK_ITEM', {
                effects: [{
                    activation: ActivationCondition.ATTACKER,
                    description: 'ITEM_ATTACKER',
                    action: { type: 'NONE', params: {} }
                }]
            })
        ];
        p2.unitZones[0].unit = makeUnit('BLK');

        const originalProcessQueue = engine.effectManager.processQueue.bind(engine.effectManager);
        engine.effectManager.processQueue = () => 'PAUSED';
        try {
            engine.attack(0);
        } finally {
            engine.effectManager.processQueue = originalProcessQueue;
        }

        expect(engine.state.effectQueue.length).toBe(2);
        expect(engine.state.effectQueue[0].creationTime).toBe(engine.state.effectQueue[1].creationTime);
        expect(engine.state.effectQueue[0].effect.description).toBe('UNIT_ATTACKER');
        expect(engine.state.effectQueue[1].effect.description).toBe('ITEM_ATTACKER');
    });

    it('queues DEFENDER effects from unit+item in one simultaneous batch', () => {
        const engine = createEngine();
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];
        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.ATTACK;

        p1.unitZones[0].unit = makeUnit('ATK');
        p2.unitZones[0].unit = makeUnit('BLK', {
            effects: [{
                activation: ActivationCondition.DEFENDER,
                description: 'UNIT_DEFENDER',
                action: { type: 'NONE', params: {} }
            }]
        });
        p2.unitZones[0].items = [
            makeItem('BLK_ITEM', {
                effects: [{
                    activation: ActivationCondition.DEFENDER,
                    description: 'ITEM_DEFENDER',
                    action: { type: 'NONE', params: {} }
                }]
            })
        ];

        engine.attack(0);
        expect(engine.state.phase).toBe(Phase.BLOCK);

        const originalProcessQueue = engine.effectManager.processQueue.bind(engine.effectManager);
        engine.effectManager.processQueue = () => 'PAUSED';
        try {
            engine.resolveBlock(true);
        } finally {
            engine.effectManager.processQueue = originalProcessQueue;
        }

        expect(engine.state.effectQueue.length).toBe(2);
        expect(engine.state.effectQueue[0].creationTime).toBe(engine.state.effectQueue[1].creationTime);
        expect(engine.state.effectQueue[0].effect.description).toBe('UNIT_DEFENDER');
        expect(engine.state.effectQueue[1].effect.description).toBe('ITEM_DEFENDER');
    });

    it('resolves same-timestamp TURN_END triggers with turn-player priority', () => {
        const p1Leader = makeLeader('P1L', [{
            activation: ActivationCondition.TURN_END,
            description: 'P1_TURN_END',
            action: { type: 'NONE', params: {} }
        }]);
        const p2Leader = makeLeader('P2L', [{
            activation: ActivationCondition.TURN_END,
            description: 'P2_TURN_END',
            action: { type: 'NONE', params: {} }
        }]);
        const engine = createEngine(p1Leader, p2Leader);
        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.END;

        const originalProcessQueue = engine.effectManager.processQueue.bind(engine.effectManager);
        engine.effectManager.processQueue = () => 'PAUSED';
        try {
            engine.nextPhase();
        } finally {
            engine.effectManager.processQueue = originalProcessQueue;
        }

        const turnEndDescriptions = engine.state.effectQueue.map(item => item.effect.description);
        expect(turnEndDescriptions.length).toBeGreaterThanOrEqual(2);
        expect(turnEndDescriptions[0]).toBe('P1_TURN_END');
        expect(turnEndDescriptions[1]).toBe('P2_TURN_END');
    });

    it('keeps older queued effects ahead of newly generated chained effects', () => {
        const executionOrder: string[] = [];
        const originalNone = ActionRegistry.NONE;
        ActionRegistry.NONE = (ctx, params, targets) => {
            if (params?.marker) executionOrder.push(params.marker);
            originalNone(ctx, params, targets);
        };

        try {
            const p2Leader = makeLeader('P2L', [{
                activation: ActivationCondition.UNIT_TRASHED,
                description: 'P2_UNIT_TRASHED',
                action: { type: 'NONE', params: { marker: 'UT' } }
            }]);
            const engine = createEngine(makeLeader('P1L'), p2Leader);
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.ATTACK;

            p1.unitZones[0].unit = makeUnit('ATK', {
                effects: [
                    {
                        activation: ActivationCondition.ATTACKER,
                        description: 'ATTACKER_DESTROY',
                        targets: { scope: 'OPP_FIELD', type: 'UNIT', count: 0, selectMode: 'ALL' },
                        action: { type: 'DESTROY_UNIT', params: {} }
                    },
                    {
                        activation: ActivationCondition.ATTACKER,
                        description: 'ATTACKER_AFTER',
                        action: { type: 'NONE', params: { marker: 'A_AFTER' } }
                    }
                ]
            });
            p2.unitZones[0].unit = makeUnit('VICTIM');

            engine.attack(0);

            expect(executionOrder).toEqual(['A_AFTER', 'UT']);
        } finally {
            ActionRegistry.NONE = originalNone;
        }
    });
});

