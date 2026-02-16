import { describe, expect, it } from 'vitest';
import { DUMMY_CARDS } from '../../../src/logic/CardDatabase';
import { GameEngine } from '../../../src/logic/GameEngine';
import { StrongBotV2 } from '../../../src/logic/ai/StrongBotV2';
import { ActivationCondition, Card, Phase } from '../../../src/logic/types';

function getCard(id: string): Card {
    const card = DUMMY_CARDS.find(c => c.id === id);
    if (!card) throw new Error(`Card ${id} not found`);
    return JSON.parse(JSON.stringify(card));
}

function createEngine(seed: number): GameEngine {
    const deck1 = Array.from({ length: 30 }, (_v, i) => getCard(i % 2 === 0 ? 'ST01-002' : 'BT01-057'));
    const deck2 = Array.from({ length: 30 }, (_v, i) => getCard(i % 2 === 0 ? 'ST01-002' : 'BT01-057'));
    const engine = new GameEngine('P1', 'P2', deck1, deck2, getCard('ST04-001'), getCard('ST04-001'), { seed });
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

describe('ST04 High Value Targeting Regression', () => {
    it('ST04-015 trigger allows selecting only lowest-cost opponent units', () => {
        const engine = createEngine(9701);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        const lowA = getCard('ST04-002');
        lowA.cost = 1;
        const lowB = getCard('ST04-004');
        lowB.cost = 1;
        const high = getCard('ST04-009');
        high.cost = 5;

        p2.unitZones[0].unit = lowA;
        p2.unitZones[1].unit = lowB;
        p2.unitZones[2].unit = high;

        const sourceCard = getCard('ST04-015');
        const effect = sourceCard.effects?.find(
            e => e.activation === ActivationCondition.DAMAGE_TRIGGER && e.action.type === 'RETURN_UNIT_AND_ITEMS_TO_HAND',
        );
        expect(effect).toBeDefined();

        engine.initiateTargetSelection(effect!, {
            sourceCard,
            player: p1,
            opponent: p2,
            machine: engine,
        } as any);

        expect(engine.state.interactionMode).toBe('SELECT_TARGET');

        const legal = engine.getLegalActions(p1.id).filter(action => action.type === 'SELECT_ZONE_TARGET');
        const zoneIndexes = legal.map(action => (action.type === 'SELECT_ZONE_TARGET' ? action.zoneIndex : -1)).sort();
        expect(zoneIndexes).toEqual([0, 1]);
    });

    it('ST04-012 guardian-only targeting makes bot pick the only valid guardian lane', () => {
        const engine = createEngine(9702);
        const bot = createSearchOnlyBot('Strong-v2-ST04-012');
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.unitZones[0].unit = getCard('ST04-003'); // Guardian
        p1.unitZones[1].unit = getCard('ST04-004'); // Non-guardian

        const sourceCard = getCard('ST04-012');
        const effect = sourceCard.effects?.[0];
        expect(effect).toBeDefined();

        engine.initiateTargetSelection(effect!, {
            sourceCard,
            player: p1,
            opponent: p2,
            machine: engine,
        } as any);

        expect(engine.state.interactionMode).toBe('SELECT_TARGET');
        expect(engine.state.interactionOwnerPlayerId).toBe(p1.id);

        const action = bot.chooseAction(engine, p1.id);
        expect(action?.type).toBe('SELECT_ZONE_TARGET');
        expect(action?.type === 'SELECT_ZONE_TARGET' ? action.targetPlayerId : '').toBe(p1.id);
        expect(action?.type === 'SELECT_ZONE_TARGET' ? action.zoneIndex : -1).toBe(0);
    });
});
