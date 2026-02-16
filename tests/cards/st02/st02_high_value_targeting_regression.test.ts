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
    const engine = new GameEngine('P1', 'P2', deck1, deck2, getCard('ST02-001'), getCard('ST02-001'), { seed });
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

describe('ST02 High Value Targeting Regression', () => {
    it('ST02-009 trigger destroy prioritizes immediate lethal lane threat', () => {
        const engine = createEngine(9501);
        const bot = createSearchOnlyBot('Strong-v2-ST02-009');
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.damage = Array.from({ length: 9 }, (_v, i) => getCard(i % 2 === 0 ? 'ST01-002' : 'BT01-057'));
        p1.unitZones[0].unit = getCard('ST01-002');

        const stableThreat = getCard('ST01-006');
        stableThreat.cost = 3;
        stableThreat.power = 6500;
        stableThreat.hit = 1;
        p2.unitZones[0].unit = stableThreat;

        const lethalThreat = getCard('BT01-057');
        lethalThreat.cost = 1;
        lethalThreat.power = 1500;
        lethalThreat.hit = 2;
        p2.unitZones[1].unit = lethalThreat;

        const sourceCard = getCard('ST02-009');
        const effect = sourceCard.effects?.find(
            e => e.activation === ActivationCondition.DAMAGE_TRIGGER && e.action.type === 'DESTROY_UNIT',
        );
        expect(effect).toBeDefined();
        engine.initiateTargetSelection(effect!, {
            sourceCard,
            player: p1,
            opponent: p2,
            machine: engine,
        } as any);

        expect(engine.state.interactionMode).toBe('SELECT_TARGET');
        const action = bot.chooseAction(engine, p1.id);
        expect(action?.type).toBe('SELECT_ZONE_TARGET');
        expect(action?.type === 'SELECT_ZONE_TARGET' ? action.zoneIndex : -1).toBe(1);
    });

    it('ST02-012 active buff prefers open lethal-pressure own lane target', () => {
        const engine = createEngine(9502);
        const bot = createSearchOnlyBot('Strong-v2-ST02-012');
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p2.damage = Array.from({ length: 8 }, (_v, i) => getCard(i % 2 === 0 ? 'ST01-002' : 'BT01-057'));

        p1.unitZones[0].unit = getCard('ST01-002');
        const openFinisher = getCard('ST01-006');
        openFinisher.cost = 2;
        openFinisher.power = 3000;
        openFinisher.hit = 2;
        p1.unitZones[1].unit = openFinisher;

        const blockedBruiser = getCard('ST01-009');
        blockedBruiser.cost = 6;
        blockedBruiser.power = 9000;
        blockedBruiser.hit = 1;
        p1.unitZones[2].unit = blockedBruiser;

        const oppBlocker = getCard('ST01-009');
        oppBlocker.cost = 6;
        oppBlocker.power = 10000;
        oppBlocker.hit = 1;
        p2.unitZones[2].unit = oppBlocker;

        const sourceCard = getCard('ST02-012');
        const effect = sourceCard.effects?.[0];
        expect(effect).toBeDefined();
        engine.initiateTargetSelection(effect!, {
            sourceCard,
            player: p1,
            opponent: p2,
            machine: engine,
        } as any);

        expect(engine.state.interactionMode).toBe('SELECT_TARGET');
        const action = bot.chooseAction(engine, p1.id);
        expect(action?.type).toBe('SELECT_ZONE_TARGET');
        expect(action?.type === 'SELECT_ZONE_TARGET' ? action.targetPlayerId : '').toBe(p1.id);
        expect(action?.type === 'SELECT_ZONE_TARGET' ? action.zoneIndex : -1).toBe(1);
    });
});
