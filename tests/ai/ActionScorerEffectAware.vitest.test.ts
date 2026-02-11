import { describe, expect, it } from 'vitest';
import { GameEngine } from '../../src/logic/GameEngine';
import { scoreAction } from '../../src/logic/ai/eval/ActionScorer';
import {
    Attribute,
    Card,
    CardType,
    EngineAction,
    Phase,
    TargetSchema,
} from '../../src/logic/types';

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

function createEngine(seed: number = 20260221): GameEngine {
    const deck1 = Array.from({ length: 30 }, (_v, i) => makeUnit(`P1_${i}`));
    const deck2 = Array.from({ length: 30 }, (_v, i) => makeUnit(`P2_${i}`));
    const engine = new GameEngine('P1', 'P2', deck1, deck2, makeLeader('P1L'), makeLeader('P2L'), { seed });
    engine.state.winner = null;
    engine.state.turnPlayerIndex = 0;
    engine.state.phase = Phase.MAIN;
    return engine;
}

function makeTargetSchema(scope: TargetSchema['scope']): TargetSchema {
    return {
        scope,
        type: 'UNIT',
        count: 1,
        selectMode: 'MANUAL',
    };
}

describe('ActionScorer Effect-aware Value Function', () => {
    it('prioritizes removing immediate lethal lane threats over raw card stats', () => {
        const engine = createEngine(9201);
        const actor = engine.state.players[0];
        const opponent = engine.state.players[1];

        actor.damage = Array.from({ length: 9 }, (_v, i) => makeUnit(`DMG_${i}`));
        actor.unitZones[0].unit = makeUnit('ALLY_BLOCKER', { cost: 1, power: 4000, hit: 1 });

        opponent.unitZones[0].unit = makeUnit('BIG_SAFE', { cost: 5, power: 7000, hit: 1 });
        opponent.unitZones[1].unit = makeUnit('SMALL_LETHAL', { cost: 1, power: 1000, hit: 2 });

        engine.state.pendingEffect = {
            sourceCard: makeUnit('SRC'),
            sourcePlayerId: actor.id,
            controllerPlayerId: actor.id,
            actionType: 'DESTROY_UNIT',
            actionValue: { value: 0 },
            validTargets: 'ALL_UNITS',
            targetSchema: makeTargetSchema('OPP_FIELD'),
            selectedTargets: [],
        };

        const lane0Action: Extract<EngineAction, { type: 'SELECT_ZONE_TARGET' }> = {
            type: 'SELECT_ZONE_TARGET',
            actorPlayerId: actor.id,
            targetPlayerId: opponent.id,
            zoneIndex: 0,
        };
        const lane1Action: Extract<EngineAction, { type: 'SELECT_ZONE_TARGET' }> = {
            type: 'SELECT_ZONE_TARGET',
            actorPlayerId: actor.id,
            targetPlayerId: opponent.id,
            zoneIndex: 1,
        };

        const lane0Score = scoreAction(engine, actor.id, lane0Action).score;
        const lane1Score = scoreAction(engine, actor.id, lane1Action).score;
        expect(lane1Score).toBeGreaterThan(lane0Score);
    });

    it('prefers tempo-playable recovery targets from trash over expensive slow cards', () => {
        const engine = createEngine(9202);
        const actor = engine.state.players[0];

        actor.leaderLevel = 3;
        actor.damage = [];
        actor.trash = [
            makeUnit('SLOW_HIGH_COST', { cost: 6, power: 1500, hit: 1 }),
            makeUnit('TEMPO_PLAYABLE', { cost: 2, power: 5000, hit: 2 }),
        ];

        engine.state.pendingEffect = {
            sourceCard: makeUnit('SRC'),
            sourcePlayerId: actor.id,
            controllerPlayerId: actor.id,
            actionType: 'MOVE_FROM_TRASH_TO_HAND',
            actionValue: {},
            validTargets: 'MY_TRASH',
            targetSchema: makeTargetSchema('MY_TRASH'),
            selectedTargets: [],
        };

        const slowAction: Extract<EngineAction, { type: 'SELECT_TRASH_TARGET' }> = {
            type: 'SELECT_TRASH_TARGET',
            actorPlayerId: actor.id,
            targetPlayerId: actor.id,
            trashIndex: 0,
        };
        const tempoAction: Extract<EngineAction, { type: 'SELECT_TRASH_TARGET' }> = {
            type: 'SELECT_TRASH_TARGET',
            actorPlayerId: actor.id,
            targetPlayerId: actor.id,
            trashIndex: 1,
        };

        const slowScore = scoreAction(engine, actor.id, slowAction).score;
        const tempoScore = scoreAction(engine, actor.id, tempoAction).score;
        expect(tempoScore).toBeGreaterThan(slowScore);
    });

    it('prefers skipping optional effects that are self-harmful', () => {
        const engine = createEngine(9203);
        const actor = engine.state.players[0];

        engine.state.interactionMode = 'SELECT_OPTIONAL';
        engine.state.pendingEffect = {
            sourceCard: makeUnit('SRC'),
            sourcePlayerId: actor.id,
            controllerPlayerId: actor.id,
            actionType: 'TRASH_SELF',
            actionValue: {},
            effectDescription: 'You may trash this card.',
        };

        const confirmAction: Extract<EngineAction, { type: 'RESOLVE_OPTIONAL' }> = {
            type: 'RESOLVE_OPTIONAL',
            actorPlayerId: actor.id,
            confirm: true,
        };
        const skipAction: Extract<EngineAction, { type: 'RESOLVE_OPTIONAL' }> = {
            type: 'RESOLVE_OPTIONAL',
            actorPlayerId: actor.id,
            confirm: false,
        };

        const confirmScore = scoreAction(engine, actor.id, confirmAction).score;
        const skipScore = scoreAction(engine, actor.id, skipAction).score;
        expect(skipScore).toBeGreaterThan(confirmScore);
    });

    it('prefers CONFIRM_TARGETS over re-selecting an already-selected target in partial confirm state (Rule 1.3.2)', () => {
        const engine = createEngine(9204);
        const actor = engine.state.players[0];
        const opponent = engine.state.players[1];

        opponent.unitZones[0].unit = makeUnit('ONLY_TARGET', { cost: 3, power: 4500, hit: 1 });
        engine.state.interactionMode = 'SELECT_TARGET';
        engine.state.pendingEffect = {
            sourceCard: makeUnit('SRC'),
            sourcePlayerId: actor.id,
            controllerPlayerId: actor.id,
            actionType: 'DESTROY_UNIT',
            actionValue: { value: 0 },
            validTargets: 'ALL_UNITS',
            targetSchema: {
                scope: 'OPP_FIELD',
                type: 'UNIT',
                count: 2,
                selectMode: 'MANUAL',
            },
            selectedTargets: [opponent.unitZones[0]],
        };

        const reselectAction: Extract<EngineAction, { type: 'SELECT_ZONE_TARGET' }> = {
            type: 'SELECT_ZONE_TARGET',
            actorPlayerId: actor.id,
            targetPlayerId: opponent.id,
            zoneIndex: 0,
        };
        const confirmAction: Extract<EngineAction, { type: 'CONFIRM_TARGETS' }> = {
            type: 'CONFIRM_TARGETS',
            actorPlayerId: actor.id,
        };

        const reselectScore = scoreAction(engine, actor.id, reselectAction).score;
        const confirmScore = scoreAction(engine, actor.id, confirmAction).score;
        expect(confirmScore).toBeGreaterThan(reselectScore);
    });

    it('prefers CONFIRM_TARGETS when required selection count is already satisfied', () => {
        const engine = createEngine(9205);
        const actor = engine.state.players[0];
        const opponent = engine.state.players[1];

        actor.unitZones[0].unit = makeUnit('ALLY_A', { cost: 1, power: 1000, hit: 1 });
        actor.unitZones[1].unit = makeUnit('ALLY_B', { cost: 2, power: 2500, hit: 1 });
        actor.unitZones[2].unit = makeUnit('ALLY_C', { cost: 3, power: 4500, hit: 2 });
        opponent.unitZones[0].unit = makeUnit('ENEMY', { cost: 3, power: 3500, hit: 1 });

        engine.state.interactionMode = 'SELECT_TARGET';
        engine.state.pendingEffect = {
            sourceCard: makeUnit('SRC'),
            sourcePlayerId: actor.id,
            controllerPlayerId: actor.id,
            actionType: 'SACRIFICE_TO_BUFF',
            actionValue: { powerValue: 2000 },
            validTargets: 'ALL_UNITS',
            targetSchema: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 2,
                selectMode: 'MANUAL',
            },
            selectedTargets: [actor.unitZones[0], actor.unitZones[1]],
        };

        const overCapSelect: Extract<EngineAction, { type: 'SELECT_ZONE_TARGET' }> = {
            type: 'SELECT_ZONE_TARGET',
            actorPlayerId: actor.id,
            targetPlayerId: actor.id,
            zoneIndex: 2,
        };
        const confirmAction: Extract<EngineAction, { type: 'CONFIRM_TARGETS' }> = {
            type: 'CONFIRM_TARGETS',
            actorPlayerId: actor.id,
        };

        const overCapScore = scoreAction(engine, actor.id, overCapSelect).score;
        const confirmScore = scoreAction(engine, actor.id, confirmAction).score;
        expect(confirmScore).toBeGreaterThan(overCapScore);
    });
});
