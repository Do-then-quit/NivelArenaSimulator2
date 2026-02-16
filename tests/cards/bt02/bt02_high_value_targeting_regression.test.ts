import { describe, expect, it } from 'vitest';
import { DUMMY_CARDS } from '../../../src/logic/CardDatabase';
import { GameEngine } from '../../../src/logic/GameEngine';
import { Card, Phase } from '../../../src/logic/types';

function getCard(id: string): Card {
    const card = DUMMY_CARDS.find(c => c.id === id);
    if (!card) throw new Error(`Card ${id} not found`);
    return JSON.parse(JSON.stringify(card));
}

function createEngine(seed: number): GameEngine {
    const deck1 = Array.from({ length: 30 }, (_v, i) => getCard(i % 2 === 0 ? 'ST01-002' : 'BT01-057'));
    const deck2 = Array.from({ length: 30 }, (_v, i) => getCard(i % 2 === 0 ? 'ST01-002' : 'BT01-057'));
    const engine = new GameEngine('P1', 'P2', deck1, deck2, getCard('BT02-028'), getCard('BT02-055'), { seed });
    engine.state.winner = null;
    engine.state.turnPlayerIndex = 0;
    engine.state.phase = Phase.MAIN;
    engine.state.players[0].leaderLevel = 10;
    engine.state.players[1].leaderLevel = 10;
    return engine;
}

describe('BT02 High Value Targeting Regression', () => {
    it('BT02-016 exposes item-only target interactions', () => {
        const engine = createEngine(10201);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.hand = [getCard('BT02-016')];
        p1.unitZones[0].unit = getCard('BT02-003');
        p1.unitZones[0].items = [getCard('BT02-078')];
        p2.unitZones[0].unit = getCard('BT02-003');
        p2.unitZones[0].items = [getCard('BT02-079')];

        engine.playSkill(0);
        expect(engine.state.interactionMode).toBe('SELECT_TARGET');

        const legal = engine.getLegalActions(p1.id);
        const itemTargets = legal.filter(action => action.type === 'SELECT_ITEM_TARGET');
        const zoneTargets = legal.filter(action => action.type === 'SELECT_ZONE_TARGET');

        expect(itemTargets.length).toBeGreaterThan(0);
        expect(zoneTargets.length).toBe(0);
    });

    it('BT02-073 resolves as damage target first then hand target', () => {
        const engine = createEngine(10202);
        const p1 = engine.state.players[0];

        p1.hand = [getCard('BT02-073'), getCard('ST01-002')];
        p1.damage = [getCard('BT02-078')];

        engine.playSkill(0);
        expect(engine.state.interactionMode).toBe('SELECT_TARGET');

        const damageAction = engine.getLegalActions(p1.id).find(action => action.type === 'SELECT_DAMAGE_TARGET');
        expect(damageAction).toBeDefined();
        expect(damageAction?.type).toBe('SELECT_DAMAGE_TARGET');

        if (damageAction?.type === 'SELECT_DAMAGE_TARGET') {
            expect(engine.step(damageAction)).toBe(true);
        }

        const handAction = engine.getLegalActions(p1.id).find(action => action.type === 'SELECT_HAND_TARGET');
        expect(handAction).toBeDefined();
    });

    it('BT02-077 supports second-stage bottom ordering interaction', () => {
        const engine = createEngine(10203);
        const p1 = engine.state.players[0];

        p1.hand = [getCard('BT02-077')];
        p1.deck = [
            getCard('ST01-002'),
            getCard('BT02-078'),
            getCard('ST01-002'),
            getCard('BT02-079'),
            getCard('ST01-002'),
        ];

        engine.playSkill(0);
        expect(engine.state.interactionMode).toBe('SELECT_TARGET');
        expect(engine.state.pendingEffect?.actionType).toBe('PICK_REVEALED_ORDER_BOTTOM');

        const pickActions = engine
            .getLegalActions(p1.id)
            .filter(action => action.type === 'SELECT_REVEALED_TARGET') as Array<{ type: 'SELECT_REVEALED_TARGET'; actorPlayerId: string; revealedIndex: number }>;
        expect(pickActions.length).toBeGreaterThan(0);

        // Pick one revealed item, then confirm to move into ordering stage.
        expect(engine.step(pickActions[0])).toBe(true);
        const confirm = engine.getLegalActions(p1.id).find(action => action.type === 'CONFIRM_TARGETS');
        expect(confirm).toBeDefined();
        if (confirm) {
            expect(engine.step(confirm)).toBe(true);
        }

        expect(engine.state.interactionMode).toBe('SELECT_TARGET');
        expect(engine.state.pendingEffect?.actionType).toBe('ORDER_REVEALED_BOTTOM');
        expect(engine.state.pendingEffect?.validTargets).toBe('REVEALED');
    });
});
