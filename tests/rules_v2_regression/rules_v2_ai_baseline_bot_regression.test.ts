import { describe, expect, it } from 'vitest';
import { GameEngine } from '../../src/logic/GameEngine';
import { ActivationCondition, Attribute, Card, CardType, Phase } from '../../src/logic/types';
import { BaselineBot, runBaselineSelfPlay } from '../../src/logic/ai/BaselineBot';

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

function createEngine(seed: number = 20260208, p1Leader: Card = makeLeader('P1L'), p2Leader: Card = makeLeader('P2L')): GameEngine {
    const deck1 = Array(30).fill(null).map((_, i) => makeUnit(`P1_${i}`));
    const deck2 = Array(30).fill(null).map((_, i) => makeUnit(`P2_${i}`));
    const engine = new GameEngine('P1', 'P2', deck1, deck2, p1Leader, p2Leader, { seed });
    engine.state.winner = null;
    return engine;
}

describe('Rules v2 AI Baseline Bot Regression', () => {
    it('chooses a valid hand-target interaction action for non-turn player ownership', () => {
        const engine = createEngine();
        const bot = new BaselineBot();
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
        const action = bot.chooseAction(engine, actorId);

        expect(action).not.toBeNull();
        expect(action?.type).toBe('SELECT_HAND_TARGET');
        expect(engine.step(action!)).toBe(true);
        expect(engine.state.interactionMode).toBe('NORMAL');
    });

    it('prioritizes higher-pressure ATTACK action during ATTACK phase', () => {
        const engine = createEngine();
        const bot = new BaselineBot();
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.ATTACK;

        p1.unitZones[0].unit = makeUnit('ATK_LOW', { power: 3000, hit: 1 });
        p1.unitZones[1].unit = makeUnit('ATK_HIGH', { power: 2500, hit: 2 });
        p2.unitZones[0].unit = null;
        p2.unitZones[1].unit = null;

        const action = bot.chooseAction(engine, p1.id);
        expect(action).not.toBeNull();
        expect(action?.type).toBe('ATTACK');
        expect(action?.type === 'ATTACK' ? action.attackerZoneIndex : -1).toBe(1);
    });

    it('runs deterministic baseline self-play without invalid/no-action deadlock', () => {
        const engine = createEngine(77);
        const bot1 = new BaselineBot('P1Baseline');
        const bot2 = new BaselineBot('P2Baseline');

        const result = runBaselineSelfPlay(engine, bot1, bot2, 400);

        expect(result.steps).toBeGreaterThan(0);
        expect(result.terminationReason === 'invalid_action').toBe(false);
        expect(result.terminationReason === 'no_action').toBe(false);
        expect(result.terminationReason === 'winner' || result.terminationReason === 'max_steps').toBe(true);
    });
});
