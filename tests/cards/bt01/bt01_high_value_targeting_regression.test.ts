import { describe, expect, it } from 'vitest';
import { DUMMY_CARDS } from '../../../src/logic/CardDatabase';
import { GameEngine } from '../../../src/logic/GameEngine';
import { StrongBotV2 } from '../../../src/logic/ai/StrongBotV2';
import { ActivationCondition, Card, EngineAction, Phase } from '../../../src/logic/types';

function getCard(id: string): Card {
    const card = DUMMY_CARDS.find(c => c.id === id);
    if (!card) throw new Error(`Card ${id} not found`);
    return JSON.parse(JSON.stringify(card));
}

function createEngine(seed: number): GameEngine {
    const deck1 = Array.from({ length: 30 }, (_v, i) => getCard(i % 2 === 0 ? 'ST01-002' : 'BT01-057'));
    const deck2 = Array.from({ length: 30 }, (_v, i) => getCard(i % 2 === 0 ? 'ST01-002' : 'BT01-057'));
    const engine = new GameEngine('P1', 'P2', deck1, deck2, getCard('ST01-001'), getCard('ST01-001'), { seed });
    engine.state.winner = null;
    engine.state.turnPlayerIndex = 0;
    engine.state.phase = Phase.MAIN;
    return engine;
}

function createSearchOnlyBot(name: string): StrongBotV2 {
    const bot = new StrongBotV2(name, {
        beamWidth: 4,
        maxDepth: 3,
        expansionBudget: 100,
        interactionDepth: 3,
        interactionExpansionBudget: 100,
        rolloutVariants: 1,
    });
    (bot as any).fallback = { chooseAction: () => null };
    return bot;
}

describe('BT01 High Value Targeting Regression', () => {
    it('BT01-011 active debuff prioritizes lethal lane threat target', () => {
        const engine = createEngine(9301);
        const bot = createSearchOnlyBot('Strong-v2-BT01-011');
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.damage = Array.from({ length: 9 }, (_v, i) => getCard(i % 2 === 0 ? 'ST01-002' : 'BT01-057'));
        p1.unitZones[0].unit = getCard('BT01-011');

        const stableThreat = getCard('BT01-016');
        stableThreat.hit = 1;
        stableThreat.power = 8000;
        stableThreat.cost = 6;
        p2.unitZones[0].unit = stableThreat;

        const lethalThreat = getCard('BT01-057');
        lethalThreat.hit = 2;
        lethalThreat.power = 1200;
        lethalThreat.cost = 1;
        p2.unitZones[1].unit = lethalThreat;

        engine.activateEffect(0, 0);
        expect(engine.state.interactionMode).toBe('SELECT_TARGET');

        const action = bot.chooseAction(engine, p1.id);
        expect(action?.type).toBe('SELECT_ZONE_TARGET');
        expect(action?.type === 'SELECT_ZONE_TARGET' ? action.zoneIndex : -1).toBe(1);
    });

    it('BT01-078 trigger recovery prefers tempo-playable exit target from trash', () => {
        const engine = createEngine(9302);
        const bot = createSearchOnlyBot('Strong-v2-BT01-078');
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.leaderLevel = 3;
        p1.damage = [];
        p1.unitZones.forEach(zone => {
            zone.unit = null;
            zone.items = [];
        });

        const sourceCard = getCard('BT01-078');
        const triggerEffect = sourceCard.effects?.find(
            e => e.activation === ActivationCondition.DAMAGE_TRIGGER && e.action.type === 'MOVE_FROM_TRASH_TO_HAND',
        );
        expect(triggerEffect).toBeDefined();

        const slowExit = getCard('BT01-068');
        slowExit.cost = 6;
        slowExit.power = 9000;
        slowExit.hit = 2;

        const tempoExit = getCard('BT01-056');
        tempoExit.cost = 2;
        tempoExit.power = 5000;
        tempoExit.hit = 2;

        p1.trash = [slowExit, tempoExit];

        engine.initiateTargetSelection(triggerEffect!, {
            sourceCard,
            player: p1,
            opponent: p2,
            machine: engine,
        } as any);

        expect(engine.state.interactionMode).toBe('SELECT_TARGET');
        expect(engine.state.interactionOwnerPlayerId).toBe(p1.id);

        const action = bot.chooseAction(engine, p1.id);
        expect(action?.type).toBe('SELECT_TRASH_TARGET');
        expect(action?.type === 'SELECT_TRASH_TARGET' ? action.trashIndex : -1).toBe(1);
    });

    it('BT01-073 trigger discard interaction chooses low-value own hand card', () => {
        const engine = createEngine(9303);
        const bot = createSearchOnlyBot('Strong-v2-BT01-073');
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        const sourceCard = getCard('BT01-073');
        const triggerEffect = sourceCard.effects?.find(
            e => e.activation === ActivationCondition.DAMAGE_TRIGGER && e.action.type === 'DISCARD',
        );
        expect(triggerEffect).toBeDefined();

        const lowValue = getCard('ST01-002');
        lowValue.cost = 2;
        lowValue.power = 500;
        lowValue.hit = 1;

        const highValue = getCard('BT01-016');
        highValue.cost = 6;
        highValue.power = 9000;
        highValue.hit = 2;

        p2.hand = [lowValue, highValue];

        engine.initiateTargetSelection(triggerEffect!, {
            sourceCard,
            player: p1,
            opponent: p2,
            machine: engine,
        } as any);

        expect(engine.state.interactionMode).toBe('SELECT_TARGET');
        expect(engine.state.interactionOwnerPlayerId).toBe(p2.id);

        const action = bot.chooseAction(engine, p2.id);
        expect(action?.type).toBe('SELECT_HAND_TARGET');
        expect(action?.type === 'SELECT_HAND_TARGET' ? action.targetPlayerId : '').toBe(p2.id);
        expect(action?.type === 'SELECT_HAND_TARGET' ? action.handIndex : -1).toBe(0);
    });

    it('BT01-078 recovery choice remains deterministic on identical seeds', () => {
        const runScenario = (): EngineAction | null => {
            const engine = createEngine(9304);
            const bot = createSearchOnlyBot('Strong-v2-BT01-078-Deterministic');
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];

            p1.leaderLevel = 3;
            p1.damage = [];
            p1.unitZones.forEach(zone => {
                zone.unit = null;
                zone.items = [];
            });

            const sourceCard = getCard('BT01-078');
            const triggerEffect = sourceCard.effects?.find(
                e => e.activation === ActivationCondition.DAMAGE_TRIGGER && e.action.type === 'MOVE_FROM_TRASH_TO_HAND',
            );
            const slowExit = getCard('BT01-068');
            slowExit.cost = 6;
            slowExit.power = 9000;
            slowExit.hit = 2;
            const tempoExit = getCard('BT01-056');
            tempoExit.cost = 2;
            tempoExit.power = 5000;
            tempoExit.hit = 2;
            p1.trash = [slowExit, tempoExit];

            engine.initiateTargetSelection(triggerEffect!, {
                sourceCard,
                player: p1,
                opponent: p2,
                machine: engine,
            } as any);

            return bot.chooseAction(engine, p1.id);
        };

        expect(runScenario()).toEqual(runScenario());
    });
});
