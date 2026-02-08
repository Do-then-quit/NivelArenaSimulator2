import { describe, expect, it } from 'vitest';
import { GameEngine } from '../../src/logic/GameEngine';
import { Attribute, Card, CardType } from '../../src/logic/types';
import { BaselineBot } from '../../src/logic/ai/BaselineBot';

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

function makeUnit(id: string, cost: number = 1): Card {
    return {
        id,
        name: id,
        type: CardType.UNIT,
        attribute: Attribute.NONE,
        cost,
        power: 1000,
        hit: 1,
        text: '',
    };
}

function createEngine(seed: number = 20260208): GameEngine {
    const deck1 = Array(30).fill(null).map((_, i) => makeUnit(`P1_${i}`, (i % 5) + 1));
    const deck2 = Array(30).fill(null).map((_, i) => makeUnit(`P2_${i}`, (i % 5) + 1));
    return new GameEngine('P1', 'P2', deck1, deck2, makeLeader('L1'), makeLeader('L2'), {
        seed,
        enableMulligan: true,
    });
}

describe('Rules v2 Mulligan Regression (Rule 5.1.6)', () => {
    it('enters mulligan window after initial 5-card draw', () => {
        const engine = createEngine();
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        expect(p1.hand.length).toBe(5);
        expect(p2.hand.length).toBe(5);
        expect(engine.state.interactionMode).toBe('SELECT_MULLIGAN');
        expect(engine.state.interactionOwnerPlayerId).toBe(p1.id);

        const p1MulliganActions = engine
            .getLegalActions(p1.id)
            .filter(action => action.type === 'RESOLVE_MULLIGAN');
        expect(p1MulliganActions).toHaveLength(2);
        expect(engine.getLegalActions(p2.id).some(action => action.type === 'RESOLVE_MULLIGAN')).toBe(false);
    });

    it('resolves one mulligan decision per player and exits mulligan mode', () => {
        const engine = createEngine(7);
        const [p1, p2] = engine.state.players;

        expect(engine.step({ type: 'RESOLVE_MULLIGAN', actorPlayerId: p1.id, shouldMulligan: false })).toBe(true);
        expect(engine.state.interactionOwnerPlayerId).toBe(p2.id);

        expect(engine.step({ type: 'RESOLVE_MULLIGAN', actorPlayerId: p2.id, shouldMulligan: true })).toBe(true);
        expect(engine.state.interactionMode).toBe('NORMAL');
        expect(engine.state.interactionOwnerPlayerId).toBe(engine.currentPlayer.id);

        expect(engine.state.mulliganResultByPlayerId[p1.id]).toBe(false);
        expect(engine.state.mulliganResultByPlayerId[p2.id]).toBe(true);

        expect(engine.step({ type: 'RESOLVE_MULLIGAN', actorPlayerId: p2.id, shouldMulligan: false })).toBe(false);
    });

    it('allows baseline bot to choose mulligan action and proceed', () => {
        const engine = createEngine(77);
        const bot = new BaselineBot();

        const actor1 = engine.state.interactionOwnerPlayerId!;
        const action1 = bot.chooseAction(engine, actor1);
        expect(action1).not.toBeNull();
        expect(action1?.type).toBe('RESOLVE_MULLIGAN');
        expect(engine.step(action1!)).toBe(true);

        const actor2 = engine.state.interactionOwnerPlayerId!;
        const action2 = bot.chooseAction(engine, actor2);
        expect(action2).not.toBeNull();
        expect(action2?.type).toBe('RESOLVE_MULLIGAN');
        expect(engine.step(action2!)).toBe(true);

        expect(engine.state.interactionMode).toBe('NORMAL');
    });
});
