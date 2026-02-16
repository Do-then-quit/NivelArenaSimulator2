import { describe, expect, it } from 'vitest';
import { DUMMY_CARDS } from '../../src/logic/CardDatabase';
import { GameEngine } from '../../src/logic/GameEngine';
import { RuleValidator } from '../../src/logic/RuleValidator';
import { Card, Phase } from '../../src/logic/types';

function getCard(id: string): Card {
    const card = DUMMY_CARDS.find(c => c.id === id);
    if (!card) throw new Error(`Card ${id} not found`);
    return JSON.parse(JSON.stringify(card));
}

function createEngine(seed = 12001): GameEngine {
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

describe('Rules v2 BT02 Mechanics Regression', () => {
    it('supports item-only target selection for DESTROY_ITEM/RETURN_ITEM/MOVE_ITEM actions', () => {
        const engine = createEngine(12011);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.hand = [getCard('BT02-016')];
        p1.unitZones[0].unit = getCard('BT02-003');
        p1.unitZones[0].items = [getCard('BT02-078')];
        p2.unitZones[0].unit = getCard('BT02-003');
        p2.unitZones[0].items = [getCard('BT02-079')];

        engine.playSkill(0);
        expect(engine.state.interactionMode).toBe('SELECT_TARGET');
        expect(engine.state.interactionOwnerPlayerId).toBe(p1.id);

        const itemActions = engine.getLegalActions(p1.id).filter(action => action.type === 'SELECT_ITEM_TARGET');
        expect(itemActions.length).toBe(2);
    });

    it('supports damage-zone targeting and hand exchange flow (BT02-058/073)', () => {
        const engine = createEngine(12012);
        const p1 = engine.state.players[0];

        p1.hand = [getCard('BT02-073'), getCard('ST01-002')];
        p1.damage = [getCard('BT02-078')];

        engine.playSkill(0);
        expect(engine.state.interactionMode).toBe('SELECT_TARGET');

        const damageAction = engine.getLegalActions(p1.id).find(action => action.type === 'SELECT_DAMAGE_TARGET');
        expect(damageAction).toBeDefined();
        if (damageAction) {
            expect(engine.step(damageAction)).toBe(true);
        }

        const handAction = engine.getLegalActions(p1.id).find(action => action.type === 'SELECT_HAND_TARGET');
        expect(handAction).toBeDefined();
        if (handAction) {
            expect(engine.step(handAction)).toBe(true);
        }

        expect(p1.hand.some(card => card.id.startsWith('BT02-078'))).toBe(true);
        expect(p1.damage.some(card => card.id.startsWith('ST01-002'))).toBe(true);
    });

    it('enters bottom-ordering stage after revealed pick effects (BT02-077)', () => {
        const engine = createEngine(12013);
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
        expect(engine.state.pendingEffect?.actionType).toBe('PICK_REVEALED_ORDER_BOTTOM');

        const pickAction = engine.getLegalActions(p1.id).find(action => action.type === 'SELECT_REVEALED_TARGET');
        expect(pickAction).toBeDefined();
        if (pickAction) {
            expect(engine.step(pickAction)).toBe(true);
        }

        const confirm = engine.getLegalActions(p1.id).find(action => action.type === 'CONFIRM_TARGETS');
        expect(confirm).toBeDefined();
        if (confirm) {
            expect(engine.step(confirm)).toBe(true);
        }

        expect(engine.state.interactionMode).toBe('SELECT_TARGET');
        expect(engine.state.pendingEffect?.actionType).toBe('ORDER_REVEALED_BOTTOM');
    });

    it('counts friendly units trashed by effect/rule during the turn', () => {
        const engine = createEngine(12014);
        const p1 = engine.state.players[0];

        p1.unitZones[0].unit = getCard('BT02-022');
        p1.unitZones[1].unit = getCard('ST01-002');
        p1.unitZones[2].unit = getCard('ST01-002');

        engine.destroyUnit(p1, p1.unitZones[1], undefined, 'EFFECT');
        engine.destroyUnit(p1, p1.unitZones[2], undefined, 'RULE');

        expect(engine.getEffectTrashedFriendlyUnitCount(p1.id)).toBeGreaterThanOrEqual(2);

        const p2 = engine.state.players[1];
        p2.deck = [getCard('ST01-002'), getCard('ST01-002')];
        const before = p2.damage.length;
        engine.activateEffect(0, 0);
        expect(p2.damage.length).toBe(before + 1);
    });

    it('fires HAND_TRASHED once-per-turn draw only once for BT02-045', () => {
        const engine = createEngine(12015);
        const p1 = engine.state.players[0];
        p1.unitZones[0].unit = getCard('BT02-045');
        p1.hand = [getCard('ST01-002'), getCard('ST01-002')];
        p1.deck = [getCard('ST01-002'), getCard('ST01-002')];

        const first = p1.hand.shift()!;
        p1.trash.push(first);
        engine.notifyHandTrashed(p1, [first], { flags: { handTrashByEffect: true } });
        const afterFirst = p1.hand.length;

        const second = p1.hand.shift()!;
        p1.trash.push(second);
        engine.notifyHandTrashed(p1, [second], { flags: { handTrashByEffect: true } });

        expect(afterFirst).toBe(2);
        expect(p1.hand.length).toBe(1);
    });

    it('handles destruction replacement accept/decline for BT02-069 and BT02-081', () => {
        const engine = createEngine(12016);
        const p1 = engine.state.players[0];

        p1.unitZones[0].unit = getCard('BT02-069');
        p1.unitZones[0].items = [getCard('BT02-078')];
        engine.destroyUnit(p1, p1.unitZones[0], undefined, 'BATTLE');
        expect(engine.state.interactionMode).toBe('SELECT_OPTIONAL');
        engine.resolveOptionalEffect(false);
        expect(p1.unitZones[0].unit).toBeNull();

        p1.unitZones[1].unit = getCard('BT02-069');
        p1.unitZones[1].items = [getCard('BT02-081')];
        p1.hand = [getCard('ST01-002'), getCard('ST01-002')];

        engine.destroyUnit(p1, p1.unitZones[1], undefined, 'BATTLE');
        expect(engine.state.interactionMode).toBe('SELECT_OPTIONAL');

        // 1st replacement (BT02-069) decline -> 2nd replacement (BT02-081) prompt.
        engine.resolveOptionalEffect(false);
        expect(engine.state.interactionMode).toBe('SELECT_OPTIONAL');
        engine.resolveOptionalEffect(true);
        expect(engine.state.interactionMode).toBe('SELECT_COST');

        const firstCost = engine.getLegalActions(p1.id).find(a => a.type === 'SELECT_COST_HAND');
        expect(firstCost).toBeDefined();
        if (firstCost && firstCost.type === 'SELECT_COST_HAND') {
            engine.step(firstCost);
        }
        const secondCost = engine.getLegalActions(p1.id).find(a => a.type === 'SELECT_COST_HAND');
        expect(secondCost).toBeDefined();
        if (secondCost && secondCost.type === 'SELECT_COST_HAND') {
            engine.step(secondCost);
        }

        expect(p1.unitZones[1].unit?.id.startsWith('BT02-069')).toBe(true);
    });

    it('validates BT02 equip conditions (LTE / HAS_TRAIT)', () => {
        const engine = createEngine(12017);
        const p1 = engine.state.players[0];
        engine.state.phase = Phase.MAIN;

        p1.hand = [getCard('BT02-009')];
        p1.unitZones[0].unit = getCard('BT02-013'); // cost 4
        expect(RuleValidator.canPlayItem(engine, p1, 0, 0).valid).toBe(false);

        p1.unitZones[0].unit = getCard('BT02-003'); // cost 3
        expect(RuleValidator.canPlayItem(engine, p1, 0, 0).valid).toBe(true);

        p1.hand = [getCard('BT02-018')];
        p1.unitZones[1].unit = getCard('BT01-031'); // base
        expect(RuleValidator.canPlayItem(engine, p1, 0, 1).valid).toBe(true);

        p1.unitZones[1].unit = getCard('BT02-013');
        expect(RuleValidator.canPlayItem(engine, p1, 0, 1).valid).toBe(false);
    });
});
