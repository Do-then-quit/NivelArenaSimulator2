import { describe, expect, it } from 'vitest';
import { GameEngine } from '../../src/logic/GameEngine';
import { BaselineBot } from '../../src/logic/ai/BaselineBot';
import { StrongBot } from '../../src/logic/ai/StrongBot';
import { Attribute, Card, CardType, Phase } from '../../src/logic/types';
import { runSingleMatch } from '../../scripts/ai/match_harness';

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

function createEngine(seed: number = 20260209): GameEngine {
    const deck1 = Array.from({ length: 30 }, (_v, i) => makeUnit(`P1_${i}`));
    const deck2 = Array.from({ length: 30 }, (_v, i) => makeUnit(`P2_${i}`));
    const engine = new GameEngine('P1', 'P2', deck1, deck2, makeLeader('P1L'), makeLeader('P2L'), { seed });
    engine.state.winner = null;
    return engine;
}

describe('StrongBot Phase1', () => {
    it('forces block to prevent immediate lethal damage during BLOCK phase', () => {
        const engine = createEngine();
        const strongBot = new StrongBot('Strong-P2');
        const baselineBot = new BaselineBot('Baseline-P2');
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.ATTACK;
        p2.damage = Array.from({ length: 9 }, (_v, i) => makeUnit(`D_${i}`));
        p1.unitZones[0].unit = makeUnit('ATTACKER', { power: 6000, hit: 1 });
        p2.unitZones[0].unit = makeUnit('DEFENDER', { power: 1000, hit: 1 });

        engine.attack(0);

        const strongAction = strongBot.chooseAction(engine, p2.id);
        const baselineAction = baselineBot.chooseAction(engine, p2.id);

        expect(strongAction?.type).toBe('RESOLVE_BLOCK');
        expect(strongAction && strongAction.type === 'RESOLVE_BLOCK' ? strongAction.shouldBlock : null).toBe(true);
        expect(baselineAction?.type).toBe('RESOLVE_BLOCK');
        expect(baselineAction && baselineAction.type === 'RESOLVE_BLOCK' ? baselineAction.shouldBlock : null).toBe(false);
    });

    it('prioritizes guaranteed lethal direct attack over blocked high-hit attack', () => {
        const engine = createEngine();
        const strongBot = new StrongBot('Strong-P1');
        const baselineBot = new BaselineBot('Baseline-P1');
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.ATTACK;
        p2.damage = Array.from({ length: 9 }, (_v, i) => makeUnit(`D_${i}`));
        p1.unitZones[0].unit = makeUnit('BLOCKED_HIGH_HIT', { power: 7000, hit: 2 });
        p1.unitZones[1].unit = makeUnit('DIRECT_LETHAL', { power: 1000, hit: 1 });
        p2.unitZones[0].unit = makeUnit('WALL', { power: 9000, hit: 1 });
        p2.unitZones[1].unit = null;

        const strongAction = strongBot.chooseAction(engine, p1.id);
        const baselineAction = baselineBot.chooseAction(engine, p1.id);

        expect(strongAction?.type).toBe('ATTACK');
        expect(strongAction && strongAction.type === 'ATTACK' ? strongAction.attackerZoneIndex : -1).toBe(1);
        expect(baselineAction?.type).toBe('ATTACK');
        expect(baselineAction && baselineAction.type === 'ATTACK' ? baselineAction.attackerZoneIndex : -1).toBe(0);
    });

    it('runs strong-vs-baseline self-play without invalid/no-action terminations', () => {
        const seeds = [2201, 2202, 2203, 2204];
        const reports = seeds.map(seed =>
            runSingleMatch({
                seed,
                maxSteps: 1800,
                enableMulligan: true,
                player1BotFactory: name => new StrongBot(name),
                player2BotFactory: name => new BaselineBot(name),
            }),
        );

        expect(reports.every(r => r.reason !== 'invalid_action')).toBe(true);
        expect(reports.every(r => r.reason !== 'no_action')).toBe(true);
    });
});

