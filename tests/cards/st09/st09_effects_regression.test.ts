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
    const engine = new GameEngine('P1', 'P2', deck1, deck2, getCard('ST09-001'), getCard('ST01-001'), { seed });
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

describe('ST09 Effects Regression', () => {
    it('ST09-006 passive triggers only once per turn for each Abigail copy', () => {
        const engine = createEngine(90001);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.unitZones[0].unit = getCard('ST09-006');
        p1.unitZones[1].unit = getCard('ST09-002');
        p1.unitZones[2].unit = getCard('ST09-005');
        p1.deck = [getCard('ST01-002')];
        engine.state.phase = Phase.DRAW;

        const firstExpected = getCard('ST09-002').hit || 0;
        const secondExpected = getCard('ST09-005').hit || 0;
        engine.nextPhase();
        const afterFirst = p2.damage.length;

        p1.unitZones[1].unit = getCard('ST09-005');
        engine.enterPhase(Phase.MAIN);
        const afterSecond = p2.damage.length;

        expect(afterFirst).toBe(firstExpected);
        expect(afterSecond).toBe(firstExpected);

        engine.endTurn();
        engine.state.turnPlayerIndex = 0;
        p1.unitZones[1].unit = getCard('ST09-005');
        engine.state.phase = Phase.DRAW;
        engine.nextPhase();

        expect(p2.damage.length).toBe(firstExpected + secondExpected);
    });

    it('ST09-007 draws once when a damage effect resolves and locks itself', () => {
        const engine = createEngine(90002);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.hand = [getCard('ST09-007')];
        p1.deck = [getCard('ST01-011')];

        engine.playSkill(0);

        engine.effectManager.executeEffect(
            {
                activation: 'ACTIVE' as any,
                description: '테스트 효과 대미지',
                action: { type: 'DAMAGE', params: { value: 2 } },
            } as any,
            {
                sourceCard: getCard('ST09-016'),
                player: p1,
                opponent: p2,
                machine: engine,
            } as any,
            [],
        );

        expect(p1.lockedSkillIdsUntilTurnEnd['ST09-007']).toBe(true);
        expect(p1.hand.some(card => card.id.startsWith('ST01-011'))).toBe(true);
        expect(p2.damage.length).toBe(2);
    });

    it('ST09-008 trigger can cast the revealed skill instead of returning it to hand', () => {
        const engine = createEngine(90003);
        const p1 = engine.state.players[0];

        p1.deck = [getCard('ST09-007'), getCard('ST09-008')];
        engine.dealDamage(p1, 1);

        const pickSkill = findAction(
            engine,
            p1.id,
            'SELECT_REVEALED_TARGET',
            (action: any) => engine.state.revealedCards[action.revealedIndex]?.id.startsWith('ST09-007'),
        );
        expect(pickSkill).toBeDefined();
        if (pickSkill) expect(engine.step(pickSkill)).toBe(true);

        expect(p1.lockedSkillIdsUntilTurnEnd['ST09-007']).toBe(true);
        expect(p1.hand.some(card => card.id.startsWith('ST09-007'))).toBe(false);
        expect(p1.trash.some(card => card.id.startsWith('ST09-007'))).toBe(true);
    });

    it('ST09-012 trigger moves the borrowed EXIT unit to deck bottom before resolving', () => {
        const engine = createEngine(90004);
        const p1 = engine.state.players[0];

        p1.deck = [getCard('ST09-012')];
        p1.trash = [getCard('ST09-010')];
        p1.unitZones[1].unit = getCard('ST01-002');

        engine.dealDamage(p1, 1);
        const pickTrash = findAction(
            engine,
            p1.id,
            'SELECT_TRASH_TARGET',
            (action: any) => p1.trash[action.trashIndex]?.id.startsWith('ST09-010'),
        );
        expect(pickTrash).toBeDefined();
        if (pickTrash) expect(engine.step(pickTrash)).toBe(true);

        const pickTarget = findAction(
            engine,
            p1.id,
            'SELECT_ZONE_TARGET',
            (action: any) => action.targetPlayerId === p1.id && action.zoneIndex === 1,
        );
        expect(pickTarget).toBeDefined();
        if (pickTarget) expect(engine.step(pickTarget)).toBe(true);

        expect(p1.deck[0]?.id.startsWith('ST09-010')).toBe(true);
        expect(engine.getUnitHit(p1.unitZones[1], p1)).toBe(2);
    });

    it('ST09-015 requires the opponent unit to have strictly lower cost than the chosen friendly unit', () => {
        const engine = createEngine(90005);
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.hand = [getCard('ST09-015')];
        p1.unitZones[0].unit = getCard('ST09-005'); // cost 5
        p2.unitZones[0].unit = getCard('ST09-005'); // equal cost
        p2.unitZones[1].unit = getCard('ST01-002'); // lower cost

        engine.playSkill(0);

        const pickFriendly = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) => action.targetPlayerId === p1.id && action.zoneIndex === 0);
        expect(pickFriendly).toBeDefined();
        if (pickFriendly) expect(engine.step(pickFriendly)).toBe(true);

        const legalOppTargets = engine
            .getLegalActions(p1.id)
            .filter(action => action.type === 'SELECT_ZONE_TARGET') as Array<any>;
        expect(legalOppTargets.some(action => action.targetPlayerId === p2.id && action.zoneIndex === 0)).toBe(false);
        expect(legalOppTargets.some(action => action.targetPlayerId === p2.id && action.zoneIndex === 1)).toBe(true);
    });
});
