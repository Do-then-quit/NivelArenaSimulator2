import { describe, expect, it } from 'vitest';
import { DUMMY_CARDS } from '../../../src/logic/CardDatabase';
import { GameEngine } from '../../../src/logic/GameEngine';
import { Card, Phase } from '../../../src/logic/types';

function getCard(id: string): Card {
    const card = DUMMY_CARDS.find(entry => entry.id === id);
    if (!card) throw new Error(`Card ${id} not found`);
    return JSON.parse(JSON.stringify(card));
}

function createEngine(seed: number): GameEngine {
    const deck1 = Array.from({ length: 30 }, () => getCard('ST01-002'));
    const deck2 = Array.from({ length: 30 }, () => getCard('ST01-002'));
    const engine = new GameEngine('P1', 'P2', deck1, deck2, getCard('ST01-001'), getCard('ST01-001'), { seed });
    engine.state.turnPlayerIndex = 0;
    engine.state.phase = Phase.MAIN;
    engine.state.winner = null;
    engine.state.players[0].leaderLevel = 10;
    engine.state.players[1].leaderLevel = 10;
    return engine;
}

function findAction(
    engine: GameEngine,
    actorPlayerId: string,
    type: string,
    predicate?: (action: any) => boolean,
) {
    return engine
        .getLegalActions(actorPlayerId)
        .find((action: any) => action.type === type && (!predicate || predicate(action)));
}

describe('BT04 Effects Regression', () => {
    it('BT04-031 active draws and grants turn damage-count bonus in one skill resolution', () => {
        const engine = createEngine(4031);
        const p1 = engine.currentPlayer;

        p1.hand = [getCard('BT04-031'), getCard('BT04-012')];
        p1.damage = Array.from({ length: 5 }, () => getCard('ST01-002'));
        p1.deck = [getCard('ST01-011')];
        p1.trash = [getCard('BT04-028'), getCard('BT04-029')];

        engine.playSkill(0);
        expect(p1.hand.some(card => card.id === 'ST01-011')).toBe(true);

        const unitIndex = p1.hand.findIndex(card => card.id === 'BT04-012');
        expect(unitIndex).toBeGreaterThanOrEqual(0);
        engine.playUnit(unitIndex, 0);

        const legal = engine.getLegalActions(p1.id).filter(action => action.type === 'SELECT_TRASH_TARGET') as Array<any>;
        const selectableIds = legal.map(action => p1.trash[action.trashIndex]?.id);
        expect(selectableIds).toContain('BT04-029');

        const pickCost8 = legal.find(action => p1.trash[action.trashIndex]?.id === 'BT04-029');
        expect(pickCost8).toBeDefined();
        if (pickCost8) expect(engine.step(pickCost8)).toBe(true);

        expect(p1.hand.some(card => card.id === 'BT04-029')).toBe(true);
    });

    it('BT04-063 does not count trash-to-damage placement toward its draw condition', () => {
        const engine = createEngine(4063);
        const p1 = engine.currentPlayer;

        p1.unitZones[0].unit = getCard('BT04-063');
        p1.hand = [getCard('BT04-064')];
        p1.trash = [getCard('BT04-030')];

        engine.playUnit(0, 1);
        const confirmOptional = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
        expect(confirmOptional).toBeDefined();
        if (confirmOptional) expect(engine.step(confirmOptional)).toBe(true);

        const pickTrash = findAction(engine, p1.id, 'SELECT_TRASH_TARGET', (action: any) => p1.trash[action.trashIndex]?.id === 'BT04-030');
        expect(pickTrash).toBeDefined();
        if (pickTrash) expect(engine.step(pickTrash)).toBe(true);

        const bt04063Active = findAction(engine, p1.id, 'ACTIVATE_EFFECT', (action: any) => action.zoneIndex === 0 && action.effectIndex === 0);
        expect(bt04063Active).toBeUndefined();
    });

    it('BT04-063 counts hand-to-damage placement toward its draw condition', () => {
        const engine = createEngine(4064);
        const p1 = engine.currentPlayer;

        p1.unitZones[0].unit = getCard('BT04-063');
        p1.hand = [getCard('BT04-051'), getCard('ST01-002')];
        p1.deck = [getCard('BT04-030'), getCard('ST01-011')];

        engine.playUnit(0, 1);
        const pickHand = findAction(engine, p1.id, 'SELECT_HAND_TARGET', (action: any) => p1.hand[action.handIndex]?.id === 'ST01-002');
        expect(pickHand).toBeDefined();
        if (pickHand) expect(engine.step(pickHand)).toBe(true);

        const active = findAction(engine, p1.id, 'ACTIVATE_EFFECT', (action: any) => action.zoneIndex === 0 && action.effectIndex === 0);
        expect(active).toBeDefined();
        const handBefore = p1.hand.length;
        engine.activateEffect(0, 0);

        expect(p1.hand.length).toBe(handBefore + 1);
    });

    it('BT04-082 selection enforces distinct card names', () => {
        const engine = createEngine(4082);
        const p1 = engine.currentPlayer;

        p1.leaderLevel = 20;
        engine.opponentPlayer.leaderLevel = 20;
        p1.hand = [getCard('BT04-082')];
        p1.trash = [getCard('BT04-052'), getCard('BT04-052'), getCard('BT04-067'), getCard('ST07-007')];

        engine.playSkill(0);

        const first052 = findAction(engine, p1.id, 'SELECT_TRASH_TARGET', (action: any) => action.trashIndex === 0);
        expect(first052).toBeDefined();
        if (first052) expect(engine.step(first052)).toBe(true);

        const remaining = engine.getLegalActions(p1.id).filter(action => action.type === 'SELECT_TRASH_TARGET') as Array<any>;
        const remainingIds = remaining.map(action => p1.trash[action.trashIndex]?.id);
        const duplicateSelections = remaining.filter(action => p1.trash[action.trashIndex]?.id === 'BT04-052');

        expect(duplicateSelections).toHaveLength(1);
        expect(remainingIds).toContain('BT04-067');
        expect(remainingIds).toContain('ST07-007');
    });

    it('BT04-084 item exit revives the trashed equipped unit to an empty zone', () => {
        const engine = createEngine(4084);
        const p1 = engine.currentPlayer;

        p1.unitZones[0].unit = getCard('BT04-005');
        p1.unitZones[0].items = [getCard('BT04-084')];
        p1.unitZones[1].unit = getCard('ST01-002');

        engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');

        const pickZone = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) =>
            action.targetPlayerId === p1.id && action.zoneIndex === 2
        );
        expect(pickZone).toBeDefined();
        if (pickZone) expect(engine.step(pickZone)).toBe(true);

        expect(p1.unitZones[2].unit?.id).toBe('BT04-005');
    });
});
