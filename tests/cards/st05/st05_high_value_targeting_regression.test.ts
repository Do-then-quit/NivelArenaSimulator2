import { describe, expect, it } from 'vitest';
import { DUMMY_CARDS } from '../../../src/logic/CardDatabase';
import { GameEngine } from '../../../src/logic/GameEngine';
import { StrongBotV2 } from '../../../src/logic/ai/StrongBotV2';
import { Card, Phase } from '../../../src/logic/types';

function getCard(id: string): Card {
    const card = DUMMY_CARDS.find(c => c.id === id);
    if (!card) throw new Error(`Card ${id} not found`);
    return JSON.parse(JSON.stringify(card));
}

function createEngine(seed: number): GameEngine {
    const deck1 = Array.from({ length: 30 }, (_v, i) => getCard(i % 2 === 0 ? 'ST01-002' : 'BT01-057'));
    const deck2 = Array.from({ length: 30 }, (_v, i) => getCard(i % 2 === 0 ? 'ST01-002' : 'BT01-057'));
    const engine = new GameEngine('P1', 'P2', deck1, deck2, getCard('ST05-001'), getCard('ST05-001'), { seed });
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

describe('ST05 High Value Targeting Regression', () => {
    it('ST05-014 first target selection only exposes own units with at least 2 equipped items', () => {
        const engine = createEngine(9801);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.leaderLevel = 12;
        p1.hand = [getCard('ST05-014')];

        p1.unitZones[0].unit = getCard('ST05-002');
        p1.unitZones[0].items = [getCard('ST05-015')];

        p1.unitZones[2].unit = getCard('ST05-004');
        p1.unitZones[2].items = [getCard('ST05-015'), getCard('ST05-017')];

        p2.unitZones[1].unit = getCard('ST05-009');

        engine.playSkill(0);
        expect(engine.state.interactionMode).toBe('SELECT_TARGET');

        const legal = engine.getLegalActions(p1.id).filter(action => action.type === 'SELECT_ZONE_TARGET');
        const ownZones = legal
            .filter(action => action.type === 'SELECT_ZONE_TARGET' && action.targetPlayerId === p1.id)
            .map(action => (action.type === 'SELECT_ZONE_TARGET' ? action.zoneIndex : -1));

        expect(ownZones).toEqual([2]);
    });

    it('ST05-013 draw targeting makes bot choose lane with higher item count', () => {
        const engine = createEngine(9802);
        const bot = createSearchOnlyBot('Strong-v2-ST05-013');
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.unitZones[0].unit = getCard('ST05-002');
        p1.unitZones[0].items = [getCard('ST05-015')];

        p1.unitZones[1].unit = getCard('ST05-004');
        p1.unitZones[1].items = [getCard('ST05-015'), getCard('ST05-017')];

        const sourceCard = getCard('ST05-013');
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
