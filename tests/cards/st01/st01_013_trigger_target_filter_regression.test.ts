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
    return engine;
}

describe('ST01-013 Trigger Target Filter Regression', () => {
    it('트리거 회수 대상은 2코 이하 유닛만 선택 가능하다', () => {
        const engine = createEngine(9501);
        const p1 = engine.state.players[0];

        p1.deck = [getCard('ST01-002'), getCard('ST01-013')];
        p1.trash = [getCard('ST01-002'), getCard('ST01-012')];

        engine.dealDamage(p1, 1);

        expect(engine.state.interactionMode).toBe('SELECT_TARGET');

        const legal = engine
            .getLegalActions(p1.id)
            .filter(action => action.type === 'SELECT_TRASH_TARGET');

        const canSelectUnit = legal.some(action =>
            action.type === 'SELECT_TRASH_TARGET' &&
            p1.trash[action.trashIndex]?.id.startsWith('ST01-002')
        );
        const canSelectSkill = legal.some(action =>
            action.type === 'SELECT_TRASH_TARGET' &&
            p1.trash[action.trashIndex]?.id.startsWith('ST01-012')
        );

        expect(canSelectUnit).toBe(true);
        expect(canSelectSkill).toBe(false);
    });
});
