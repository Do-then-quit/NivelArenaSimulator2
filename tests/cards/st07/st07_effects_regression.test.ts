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
    const deck1 = Array.from({ length: 30 }, () => getCard('ST01-002'));
    const deck2 = Array.from({ length: 30 }, () => getCard('ST01-002'));
    const engine = new GameEngine('P1', 'P2', deck1, deck2, getCard('ST07-001'), getCard('ST01-001'), { seed });
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
    const actions = engine.getLegalActions(actorPlayerId);
    return actions.find(action => action.type === type && (!predicate || predicate(action)));
}

describe('ST07 Effects Regression', () => {
    it('trait attack counter includes card-effect attack and keeps count after attacker leaves field', () => {
        const engine = createEngine(70001);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.hand = [getCard('ST07-016')];
        p1.unitZones[0].unit = getCard('ST07-002');
        p1.unitZones[1].unit = getCard('ST07-002');
        p1.deck = [getCard('ST07-013'), getCard('ST07-014'), getCard('ST07-015')];
        p2.unitZones[0].unit = getCard('ST01-002');
        engine.state.phase = Phase.MAIN;

        engine.playSkill(0);
        const forceAttack = findAction(
            engine,
            p1.id,
            'SELECT_ZONE_TARGET',
            (action: any) => action.targetPlayerId === p1.id && action.zoneIndex === 0,
        );
        expect(forceAttack).toBeDefined();
        if (forceAttack) expect(engine.step(forceAttack)).toBe(true);

        const block = findAction(
            engine,
            p2.id,
            'RESOLVE_BLOCK',
            (action: any) => action.shouldBlock && action.blockerZoneIndex === 0,
        );
        expect(block).toBeDefined();
        if (block) expect(engine.step(block)).toBe(true);

        expect(p1.unitZones[0].unit).toBeNull();
        expect(engine.getTraitAttackCountThisTurn(p1.id, '호문클루스')).toBe(1);
        expect(p1.hand.length).toBe(1);

        engine.state.phase = Phase.ATTACK;
        engine.attack(1);
        expect(engine.getTraitAttackCountThisTurn(p1.id, '호문클루스')).toBe(2);

        engine.destroyUnit(p1, p1.unitZones[1], undefined, 'EFFECT');

        expect(p1.hand.length).toBe(3);
    });

    it('field trash count ignores RULE and counts EFFECT plus BATTLE removals', () => {
        const engine = createEngine(70002);
        const p1 = engine.state.players[0];

        p1.unitZones[0].unit = getCard('ST07-012');
        p1.unitZones[1].unit = getCard('ST07-005');
        p1.unitZones[2].unit = getCard('ST07-005');
        engine.state.phase = Phase.MAIN;

        const basePower = engine.getUnitPower(p1.unitZones[0], p1);

        engine.destroyUnit(p1, p1.unitZones[1], undefined, 'RULE');
        expect(engine.getFieldTrashedFriendlyUnitCount(p1.id)).toBe(0);
        expect(engine.getUnitPower(p1.unitZones[0], p1)).toBe(basePower);

        engine.destroyUnit(p1, p1.unitZones[2], undefined, 'EFFECT');
        expect(engine.getFieldTrashedFriendlyUnitCount(p1.id)).toBe(1);
        expect(engine.getUnitPower(p1.unitZones[0], p1)).toBe(basePower + 3000);

        p1.unitZones[2].unit = getCard('ST07-005');
        engine.destroyUnit(p1, p1.unitZones[2], undefined, 'BATTLE');
        expect(engine.getFieldTrashedFriendlyUnitCount(p1.id)).toBe(2);
    });

    it('ST07-011 requires exact count when enough candidates exist', () => {
        const engine = createEngine(70003);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.hand = [getCard('ST07-011')];
        p1.trash = [getCard('ST07-002'), getCard('ST07-003')];
        p2.unitZones[0].unit = getCard('ST07-005');
        engine.state.phase = Phase.MAIN;

        engine.playUnit(0, 0);

        const first = findAction(
            engine,
            p1.id,
            'SELECT_TRASH_TARGET',
            (action: any) => p1.trash[action.trashIndex]?.id.startsWith('ST07-002'),
        );
        expect(first).toBeDefined();
        if (first) expect(engine.step(first)).toBe(true);

        const earlyConfirm = findAction(engine, p1.id, 'CONFIRM_TARGETS');
        expect(earlyConfirm).toBeUndefined();

        const second = findAction(
            engine,
            p1.id,
            'SELECT_TRASH_TARGET',
            (action: any) => p1.trash[action.trashIndex]?.id.startsWith('ST07-003'),
        );
        expect(second).toBeDefined();
        if (second) expect(engine.step(second)).toBe(true);

        const confirm = findAction(engine, p1.id, 'CONFIRM_TARGETS');
        expect(confirm).toBeDefined();
        if (confirm) expect(engine.step(confirm)).toBe(true);

        expect(p2.unitZones[0].unit).toBeNull();
        expect(p1.deck.slice(0, 2).map(card => card.id)).toEqual(['ST07-002', 'ST07-003']);
    });

    it('ST07-011 allows partial confirm only when candidates are insufficient', () => {
        const engine = createEngine(70004);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.hand = [getCard('ST07-011')];
        p1.trash = [getCard('ST07-002')];
        p2.unitZones[0].unit = getCard('ST07-005');
        engine.state.phase = Phase.MAIN;

        engine.playUnit(0, 0);

        const first = findAction(
            engine,
            p1.id,
            'SELECT_TRASH_TARGET',
            (action: any) => p1.trash[action.trashIndex]?.id.startsWith('ST07-002'),
        );
        expect(first).toBeDefined();
        if (first) expect(engine.step(first)).toBe(true);

        const confirm = findAction(engine, p1.id, 'CONFIRM_TARGETS');
        expect(confirm).toBeDefined();
        if (confirm) expect(engine.step(confirm)).toBe(true);

        expect(p2.unitZones[0].unit).toBeNull();
        expect(p1.deck[0]?.id).toBe('ST07-002');
    });

    it('ST07-013 draw remains optional at the 7th damage threshold', () => {
        const engine = createEngine(70005);
        const p1 = engine.state.players[0];

        p1.hand = [getCard('ST07-013')];
        p1.damage = [
            getCard('ST07-002'),
            getCard('ST07-003'),
            getCard('ST07-004'),
            getCard('ST07-005'),
            getCard('ST07-006'),
            getCard('ST07-007'),
        ];
        p1.deck = [getCard('ST07-014'), getCard('ST07-015'), getCard('ST07-016'), getCard('ST07-017'), getCard('ST07-005')];
        engine.state.phase = Phase.MAIN;

        engine.playSkill(0);
        const handAfterSkill = p1.hand.length;
        const move = findAction(
            engine,
            p1.id,
            'SELECT_TRASH_TARGET',
            (action: any) => p1.trash[action.trashIndex]?.id.startsWith('ST07-005'),
        );
        expect(move).toBeDefined();
        if (move) expect(engine.step(move)).toBe(true);

        expect(engine.state.interactionMode).toBe('SELECT_OPTIONAL');

        const skipDraw = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === false);
        expect(skipDraw).toBeDefined();
        if (skipDraw) expect(engine.step(skipDraw)).toBe(true);

        expect(p1.damage.some(card => card.id.startsWith('ST07-005'))).toBe(true);
        expect(p1.hand.length).toBe(handAfterSkill);
    });
});
