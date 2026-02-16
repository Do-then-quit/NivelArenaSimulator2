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

function createEngine(leader1 = 'ST04-001', leader2 = 'ST04-001', seed = 9901): GameEngine {
    const deck1 = Array.from({ length: 30 }, (_v, i) => getCard(i % 2 === 0 ? 'ST01-002' : 'BT01-057'));
    const deck2 = Array.from({ length: 30 }, (_v, i) => getCard(i % 2 === 0 ? 'ST01-002' : 'BT01-057'));
    const engine = new GameEngine('P1', 'P2', deck1, deck2, getCard(leader1), getCard(leader2), { seed });
    engine.state.winner = null;
    engine.state.turnPlayerIndex = 0;
    return engine;
}

describe('Rules v2 ST04/ST05 Mechanics Regression', () => {
    it('supports guardian adjacent-lane block with barrier cost payment', () => {
        const engine = createEngine();
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        engine.state.phase = Phase.ATTACK;
        p1.unitZones[1].unit = getCard('ST04-004');
        p1.unitZones[1].unit!.power = 3000;

        p2.unitZones[0].unit = getCard('ST04-003');
        p2.unitZones[0].unit!.power = 2500;
        p2.hand = [getCard('ST04-002')];

        const damageBefore = p2.damage.length;
        const trashBefore = p2.trash.length;

        engine.attack(1);

        const blockAction = engine
            .getLegalActions(p2.id)
            .find(a => a.type === 'RESOLVE_BLOCK' && a.shouldBlock && a.blockerZoneIndex === 0);
        expect(blockAction).toBeDefined();

        expect(engine.step(blockAction!)).toBe(true);
        expect(engine.state.interactionMode).toBe('SELECT_COST');

        engine.selectCostForPlayerId(0, p2.id);

        expect(p2.trash.length).toBeGreaterThanOrEqual(trashBefore + 1);
        expect(p2.trash.some(card => card.id === 'ST04-002')).toBe(true);
        expect(p2.damage.length).toBe(damageBefore);
    });

    it('applies ST04-007 breakthrough costMin rule (4+ cost blockers cannot block)', () => {
        const engine = createEngine();
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        engine.state.phase = Phase.ATTACK;
        p1.unitZones[0].unit = getCard('ST04-007');
        p2.unitZones[0].unit = getCard('ST04-009');
        p2.unitZones[0].unit!.cost = 5;

        const damageBefore = p2.damage.length;
        engine.attack(0);

        expect(p2.damage.length).toBe(damageBefore + 1);
        expect(p2.unitZones[0].unit).not.toBeNull();
    });

    it('grants ALL breakthrough from ST04-015 and prevents all blocking that turn', () => {
        const engine = createEngine();
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        engine.state.phase = Phase.MAIN;
        p1.leaderLevel = 10;
        p1.hand = [getCard('ST04-015')];
        p1.unitZones[0].unit = getCard('ST04-003');
        p2.unitZones[0].unit = getCard('ST04-004');

        const damageBefore = p2.damage.length;

        engine.playSkill(0);
        expect(engine.state.interactionMode).toBe('SELECT_TARGET');
        engine.selectTarget(0, false);

        engine.state.phase = Phase.ATTACK;
        engine.attack(0);

        expect(p2.damage.length).toBe(damageBefore + 1);
        expect(p2.unitZones[0].unit).not.toBeNull();
    });

    it('ST04-015 trigger targets lowest-cost opponent only and returns unit plus equipped items', () => {
        const engine = createEngine();
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        engine.state.phase = Phase.MAIN;
        p1.deck = [getCard('ST04-015')];

        p2.unitZones[0].unit = getCard('ST04-002');
        p2.unitZones[0].unit!.cost = 1;
        p2.unitZones[0].items = [getCard('ST04-016')];

        p2.unitZones[1].unit = getCard('ST04-009');
        p2.unitZones[1].unit!.cost = 5;

        engine.dealDamage(p1, 1);
        expect(engine.state.interactionMode).toBe('SELECT_TARGET');

        const legalZones = engine
            .getLegalActions(p1.id)
            .filter(action => action.type === 'SELECT_ZONE_TARGET')
            .map(action => (action.type === 'SELECT_ZONE_TARGET' ? action.zoneIndex : -1));
        expect(legalZones).toEqual([0]);

        engine.selectTarget(0, true);

        expect(p2.unitZones[0].unit).toBeNull();
        expect(p2.hand.some(c => c.id === 'ST04-002')).toBe(true);
        expect(p2.hand.some(c => c.id === 'ST04-016')).toBe(true);
        expect(p2.unitZones[1].unit).not.toBeNull();
    });

    it('exposes and resolves item ACTIVE_MAIN actions (ST04-017)', () => {
        const engine = createEngine();
        const p1 = engine.state.players[0];

        engine.state.phase = Phase.MAIN;
        p1.unitZones[0].unit = getCard('ST04-006');
        p1.unitZones[0].items = [getCard('ST04-017')];
        p1.deck = [getCard('ST04-002')];

        const handBefore = p1.hand.length;

        const itemActive = engine.getLegalActions(p1.id).find(action =>
            action.type === 'ACTIVATE_EFFECT' &&
            action.sourceType === 'ITEM' &&
            action.itemIndex === 0 &&
            action.effectIndex === 1
        );

        expect(itemActive).toBeDefined();
        expect(engine.step(itemActive!)).toBe(true);
        expect(p1.hand.length).toBe(handBefore + 1);
    });

    it('enforces equip keyword conditions for ST04-017 and ST05-016', () => {
        const engine = createEngine('ST04-001', 'ST05-001');
        const p1 = engine.state.players[0];

        engine.state.phase = Phase.MAIN;
        p1.leaderLevel = 10;

        p1.hand = [getCard('ST04-017')];
        p1.unitZones[0].unit = getCard('ST04-005'); // no defender
        expect(RuleValidator.canPlayItem(engine, p1, 0, 0).valid).toBe(false);

        p1.hand = [getCard('ST05-016')];
        p1.unitZones[0].unit = getCard('ST05-002'); // no armed
        expect(RuleValidator.canPlayItem(engine, p1, 0, 0).valid).toBe(false);

        p1.unitZones[0].unit = getCard('ST05-005'); // armed
        expect(RuleValidator.canPlayItem(engine, p1, 0, 0).valid).toBe(true);
    });

    it('resolves ST05-006 deck search with manual revealed selection and deck return', () => {
        const engine = createEngine('ST05-001', 'ST05-001');
        const p1 = engine.state.players[0];

        engine.state.phase = Phase.MAIN;
        p1.leaderLevel = 10;
        p1.hand = [getCard('ST05-006')];
        p1.deck = [getCard('ST01-002'), getCard('ST05-015'), getCard('ST05-016')];

        const deckBefore = p1.deck.length;

        engine.playUnit(0, 0);

        expect(engine.state.interactionMode).toBe('SELECT_TARGET');
        expect(engine.state.revealedCards.length).toBe(deckBefore);

        const pickActions = engine.getLegalActions(p1.id).filter(action => action.type === 'SELECT_REVEALED_TARGET');
        expect(pickActions.length).toBe(1);

        const pick = pickActions[0];
        expect(pick.type === 'SELECT_REVEALED_TARGET' ? engine.state.revealedCards[pick.revealedIndex].id : '').toBe('ST05-016');

        expect(engine.step(pick)).toBe(true);

        expect(p1.hand.some(card => card.id === 'ST05-016')).toBe(true);
        expect(engine.state.revealedCards.length).toBe(0);
        expect(p1.deck.length).toBe(deckBefore - 1);
    });

    it('applies armed checks and item-count scaling for ST05 units', () => {
        const engine = createEngine('ST05-001', 'ST05-001');
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        engine.state.phase = Phase.MAIN;

        p1.unitZones[0].unit = getCard('ST05-005');
        const base005 = p1.unitZones[0].unit!.power || 0;
        expect(engine.getUnitPower(p1.unitZones[0], p1)).toBe(base005);

        p1.unitZones[0].items = [getCard('ST05-015')];
        expect(engine.getUnitPower(p1.unitZones[0], p1)).toBe(base005 + 2500);

        p1.unitZones[1].unit = getCard('ST05-007');
        p1.unitZones[1].items = [getCard('ST05-015'), getCard('ST05-017')];
        const base007 = p1.unitZones[1].unit!.power || 0;
        expect(engine.getUnitPower(p1.unitZones[1], p1)).toBe(base007 + 6000);

        const noItemEngine = createEngine('ST05-001', 'ST05-001', 9902);
        noItemEngine.state.phase = Phase.ATTACK;
        noItemEngine.state.turnPlayerIndex = 0;
        noItemEngine.state.players[0].unitZones[0].unit = getCard('ST05-011');
        noItemEngine.state.players[1].hand = [getCard('ST05-002'), getCard('ST05-004')];
        noItemEngine.attack(0);
        expect(noItemEngine.state.players[1].hand.length).toBe(2);

        engine.state.phase = Phase.ATTACK;
        engine.state.turnPlayerIndex = 0;
        p1.unitZones[2].unit = getCard('ST05-011');
        p1.unitZones[2].items = [getCard('ST05-015')];
        p2.hand = [getCard('ST05-002'), getCard('ST05-004')];

        engine.attack(2);
        expect(engine.state.interactionMode).toBe('SELECT_TARGET');
        const oppHandBefore = p2.hand.length;
        engine.selectHandTarget(0, true);
        expect(p2.hand.length).toBe(oppHandBefore - 1);
    });

    it('draws dynamically by selected target item count (ST05-013)', () => {
        const engine = createEngine('ST05-001', 'ST05-001');
        const p1 = engine.state.players[0];

        engine.state.phase = Phase.MAIN;
        p1.leaderLevel = 12;
        p1.hand = [getCard('ST05-013')];
        p1.deck = [getCard('ST05-002'), getCard('ST05-004'), getCard('ST05-009')];

        p1.unitZones[0].unit = getCard('ST05-002');
        p1.unitZones[0].items = [getCard('ST05-015'), getCard('ST05-016')];

        engine.playSkill(0);
        expect(engine.state.interactionMode).toBe('SELECT_TARGET');

        engine.selectTarget(0, false);

        expect(p1.hand.length).toBe(2);
    });

    it('enforces ST05-014 first target item_count_min and then destroys opponent unit', () => {
        const engine = createEngine('ST05-001', 'ST05-001');
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        engine.state.phase = Phase.MAIN;
        p1.leaderLevel = 12;
        p1.hand = [getCard('ST05-014')];

        p1.unitZones[0].unit = getCard('ST05-002');
        p1.unitZones[0].items = [getCard('ST05-015')];

        p1.unitZones[1].unit = getCard('ST05-004');
        p1.unitZones[1].items = [getCard('ST05-015'), getCard('ST05-017')];

        p2.unitZones[2].unit = getCard('ST05-009');

        engine.playSkill(0);
        expect(engine.state.interactionMode).toBe('SELECT_TARGET');

        const firstStageTargets = engine
            .getLegalActions(p1.id)
            .filter(action => action.type === 'SELECT_ZONE_TARGET' && action.targetPlayerId === p1.id)
            .map(action => (action.type === 'SELECT_ZONE_TARGET' ? action.zoneIndex : -1));
        expect(firstStageTargets).toEqual([1]);

        engine.selectTarget(1, false);
        expect(engine.state.interactionMode).toBe('SELECT_TARGET');

        engine.selectTarget(2, true);

        expect(p1.unitZones[1].unit).toBeNull();
        expect(p2.unitZones[2].unit).toBeNull();
    });
});
