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
    const actions = engine.getLegalActions(actorPlayerId);
    return actions.find(action => action.type === type && (!predicate || predicate(action)));
}

describe('BT05 Effects Regression', () => {
    it('BT05-049 discards attacker hit-1 cards and terminates the attack', () => {
        const engine = createEngine(95001);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.unitZones[0].unit = getCard('BT05-023');
        p2.unitZones[0].unit = getCard('BT05-049');
        p2.hand = [getCard('ST01-011')];
        engine.state.phase = Phase.ATTACK;

        engine.attack(0);
        engine.resolveBlock(true, 0);

        const pickHand = findAction(
            engine,
            p1.id,
            'SELECT_HAND_TARGET',
            (action: any) => p2.hand[action.handIndex]?.id.startsWith('ST01-011'),
        );
        expect(pickHand).toBeDefined();
        if (pickHand) expect(engine.step(pickHand)).toBe(true);

        expect(p2.trash.some(card => card.id.startsWith('ST01-011'))).toBe(true);
        expect(p2.unitZones[0].unit?.id.startsWith('BT05-049')).toBe(true);
        expect(p2.damage.length).toBe(0);
        expect(engine.state.combatStep).toBe('NONE');
    });

    it('BT05-053 grants cost-over breakthrough only when a hand card is trashed', () => {
        const engine = createEngine(95002);
        const p1 = engine.state.players[0];

        p1.unitZones[0].unit = getCard('BT05-053');
        p1.hand = [getCard('ST01-011')];
        engine.state.phase = Phase.MAIN;

        engine.activateEffect(0, 0);
        const pickZone = findAction(
            engine,
            p1.id,
            'SELECT_ZONE_TARGET',
            (action: any) => action.targetPlayerId === p1.id && action.zoneIndex === 0,
        );
        expect(pickZone).toBeDefined();
        if (pickZone) expect(engine.step(pickZone)).toBe(true);

        const pickHand = findAction(
            engine,
            p1.id,
            'SELECT_HAND_TARGET',
            (action: any) => p1.hand[action.handIndex]?.id.startsWith('ST01-011'),
        );
        expect(pickHand).toBeDefined();
        if (pickHand) expect(engine.step(pickHand)).toBe(true);

        expect(p1.trash.some(card => card.id.startsWith('ST01-011'))).toBe(true);
        expect(
            p1.unitZones[0].temporaryEffects.some((effect: any) =>
                effect.action?.type === 'BREAKTHROUGH' && effect.action?.params?.mode === 'COST_OVER',
            ),
        ).toBe(true);
    });

    it('BT05-058 lets the opponent decline the return and instead draws by hit', () => {
        const engine = createEngine(95003);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.hand = [getCard('BT05-058')];
        p1.unitZones[0].unit = getCard('BT05-048');
        p1.deck = [getCard('ST01-011')];
        p2.unitZones[0].unit = getCard('ST01-002');
        p2.hand = [];
        engine.state.phase = Phase.MAIN;

        engine.playSkill(0);
        const pickZone = findAction(
            engine,
            p1.id,
            'SELECT_ZONE_TARGET',
            (action: any) => action.targetPlayerId === p1.id && action.zoneIndex === 0,
        );
        expect(pickZone).toBeDefined();
        if (pickZone) expect(engine.step(pickZone)).toBe(true);

        const chooseDraw = findAction(
            engine,
            p2.id,
            'SELECT_REVEALED_TARGET',
            (action: any) => engine.state.revealedCards[action.revealedIndex]?.id === 'BT05_058_DRAW',
        );
        expect(chooseDraw).toBeDefined();
        if (chooseDraw) expect(engine.step(chooseDraw)).toBe(true);

        expect(p1.hand.some(card => card.id.startsWith('ST01-011'))).toBe(true);
        expect(p2.hand.some(card => card.id.startsWith('ST01-002'))).toBe(false);
    });

    it('BT05-070 draws an extra card when two discarded cards are items', () => {
        const engine = createEngine(95004);
        const p1 = engine.state.players[0];

        p1.hand = [getCard('BT05-070'), getCard('BT05-081'), getCard('BT05-082'), getCard('ST01-011')];
        p1.deck = [getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002')];
        engine.state.phase = Phase.MAIN;

        engine.playUnit(0, 0);
        const firstItem = findAction(
            engine,
            p1.id,
            'SELECT_HAND_TARGET',
            (action: any) => p1.hand[action.handIndex]?.id.startsWith('BT05-081'),
        );
        expect(firstItem).toBeDefined();
        if (firstItem) expect(engine.step(firstItem)).toBe(true);

        const secondItem = findAction(
            engine,
            p1.id,
            'SELECT_HAND_TARGET',
            (action: any) => p1.hand[action.handIndex]?.id.startsWith('BT05-082'),
        );
        expect(secondItem).toBeDefined();
        if (secondItem) expect(engine.step(secondItem)).toBe(true);

        const confirm = findAction(engine, p1.id, 'CONFIRM_TARGETS');
        expect(confirm).toBeDefined();
        if (confirm) expect(engine.step(confirm)).toBe(true);

        expect(p1.trash.some(card => card.id.startsWith('BT05-081'))).toBe(true);
        expect(p1.trash.some(card => card.id.startsWith('BT05-082'))).toBe(true);
        expect(p1.hand.length).toBe(4);
    });

    it('BT05-076 recovers up to two distinct item names from trash', () => {
        const engine = createEngine(95005);
        const p1 = engine.state.players[0];

        p1.hand = [getCard('BT05-076'), getCard('ST01-011'), getCard('ST01-002')];
        p1.deck = [getCard('ST01-002'), getCard('ST01-011')];
        p1.trash = [getCard('BT05-081'), getCard('BT05-082'), getCard('BT05-081')];
        engine.state.phase = Phase.MAIN;

        engine.playSkill(0);
        const discardA = findAction(
            engine,
            p1.id,
            'SELECT_HAND_TARGET',
            (action: any) => p1.hand[action.handIndex]?.id.startsWith('ST01-011'),
        );
        expect(discardA).toBeDefined();
        if (discardA) expect(engine.step(discardA)).toBe(true);

        const discardB = findAction(
            engine,
            p1.id,
            'SELECT_HAND_TARGET',
            (action: any) => p1.hand[action.handIndex]?.id.startsWith('ST01-002'),
        );
        expect(discardB).toBeDefined();
        if (discardB) expect(engine.step(discardB)).toBe(true);

        const confirmDiscard = findAction(engine, p1.id, 'CONFIRM_TARGETS');
        expect(confirmDiscard).toBeDefined();
        if (confirmDiscard) expect(engine.step(confirmDiscard)).toBe(true);

        const pick081 = findAction(
            engine,
            p1.id,
            'SELECT_TRASH_TARGET',
            (action: any) => p1.trash[action.trashIndex]?.id.startsWith('BT05-081'),
        );
        expect(pick081).toBeDefined();
        if (pick081) expect(engine.step(pick081)).toBe(true);

        const pick082 = findAction(
            engine,
            p1.id,
            'SELECT_TRASH_TARGET',
            (action: any) => p1.trash[action.trashIndex]?.id.startsWith('BT05-082'),
        );
        expect(pick082).toBeDefined();
        if (pick082) expect(engine.step(pick082)).toBe(true);

        const confirmRecover = findAction(engine, p1.id, 'CONFIRM_TARGETS');
        expect(confirmRecover).toBeDefined();
        if (confirmRecover) expect(engine.step(confirmRecover)).toBe(true);

        expect(p1.hand.some(card => card.id.startsWith('BT05-081'))).toBe(true);
        expect(p1.hand.some(card => card.id.startsWith('BT05-082'))).toBe(true);
        expect(p1.trash.filter(card => card.id.startsWith('BT05-081')).length).toBe(1);
    });

    it('BT05-080 moves a non-Astrape equipped item to another friendly unit', () => {
        const engine = createEngine(95006);
        const p1 = engine.state.players[0];

        p1.unitZones[0].unit = getCard('ST01-002');
        p1.unitZones[1].unit = getCard('ST01-011');
        p1.unitZones[0].items = [getCard('BT05-080'), getCard('BT05-081')];
        engine.state.phase = Phase.ATTACK;

        engine.activateEffect(0, 2, 'ITEM', 0);
        const pickItem = findAction(
            engine,
            p1.id,
            'SELECT_REVEALED_TARGET',
            (action: any) => engine.state.revealedCards[action.revealedIndex]?.id.startsWith('BT05-081'),
        );
        expect(pickItem).toBeDefined();
        if (pickItem) expect(engine.step(pickItem)).toBe(true);

        const pickZone = findAction(
            engine,
            p1.id,
            'SELECT_ZONE_TARGET',
            (action: any) => action.targetPlayerId === p1.id && action.zoneIndex === 1,
        );
        expect(pickZone).toBeDefined();
        if (pickZone) expect(engine.step(pickZone)).toBe(true);

        expect(p1.unitZones[0].items.some(item => item.id.startsWith('BT05-081'))).toBe(false);
        expect(p1.unitZones[1].items.some(item => item.id.startsWith('BT05-081'))).toBe(true);
    });
});
