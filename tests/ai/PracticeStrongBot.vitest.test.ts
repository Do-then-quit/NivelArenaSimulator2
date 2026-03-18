import { describe, expect, it } from 'vitest';
import { DUMMY_CARDS } from '../../src/logic/CardDatabase';
import { GameEngine } from '../../src/logic/GameEngine';
import { PracticeStrongBot } from '../../src/logic/ai/practice/PracticeStrongBot';
import { Attribute, Card, CardType, Phase } from '../../src/logic/types';
import { PracticeProfile } from '../../src/logic/ai/practice/types';

function getCard(cardId: string): Card {
    const card = DUMMY_CARDS.find(entry => entry.id === cardId);
    if (!card) {
        throw new Error(`Missing card ${cardId}`);
    }
    return { ...card };
}

function makeLeader(id: string): Card {
    return {
        id,
        name: id,
        type: CardType.LEADER,
        attribute: Attribute.NONE,
        cost: 0,
        text: '',
    };
}

function createEngine(seed: number): GameEngine {
    const deck1 = Array.from({ length: 40 }, (_, index) => getCard(index % 2 === 0 ? 'BT05-033' : 'BT05-064'));
    const deck2 = Array.from({ length: 40 }, (_, index) => getCard(index % 2 === 0 ? 'ST01-002' : 'ST01-003'));

    return new GameEngine(
        'P1',
        'P2',
        deck1,
        deck2,
        getCard('BT05-032'),
        makeLeader('OPP_LEADER'),
        { seed, enableMulligan: false },
    );
}

describe('PracticeStrongBot', () => {
    it('lets the practice profile override a main-phase action before strong-v3 fallback', () => {
        const engine = createEngine(2026031231);
        const actor = engine.state.players[0];
        const profile: PracticeProfile = {
            id: 'test-profile',
            label: 'Test Profile',
            chooseMainPhaseAction(context) {
                return context.actions.find(action => action.type === 'NEXT_PHASE') ?? null;
            },
        };
        const bot = new PracticeStrongBot('PracticeStrongBot-Test', profile);

        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.MAIN;
        engine.state.interactionMode = 'NORMAL';
        engine.state.interactionOwnerPlayerId = actor.id;
        actor.leaderLevel = 2;
        actor.hand = [getCard('BT05-064')];

        const action = bot.chooseAction(engine, actor.id);

        expect(action).not.toBeNull();
        expect(action?.type).toBe('NEXT_PHASE');
    });

    it('can hold main-phase control for Nikki-like profiles on ambiguous early turns instead of handing over to strong-v3', () => {
        const engine = createEngine(2026031233);
        const actor = engine.state.players[0];
        const profile: PracticeProfile = {
            id: 'practice-bt05-nikki-hold-test',
            label: 'Practice BT05 Nikki Hold Test',
            chooseMainPhaseAction() {
                return null;
            },
        };
        const bot = new PracticeStrongBot('PracticeStrongBot-Hold', profile, {
            preferPracticeMainPhaseHold: true,
        });

        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.MAIN;
        engine.state.interactionMode = 'NORMAL';
        engine.state.interactionOwnerPlayerId = actor.id;
        actor.leaderLevel = 2;
        actor.hand = [getCard('BT05-064')];

        const action = bot.chooseAction(engine, actor.id);

        expect(action).not.toBeNull();
        expect(action?.type).toBe('NEXT_PHASE');
    });

    it('keeps the Nikki hold gate narrow by falling back to strong-v3 in late-game turns', () => {
        const engine = createEngine(2026031234);
        const actor = engine.state.players[0];
        const profile: PracticeProfile = {
            id: 'practice-bt05-nikki-hold-test',
            label: 'Practice BT05 Nikki Hold Test',
            chooseMainPhaseAction() {
                return null;
            },
        };
        const bot = new PracticeStrongBot('PracticeStrongBot-Hold-Late', profile, {
            preferPracticeMainPhaseHold: true,
            preferPracticeMainPhaseHoldMaxLeaderLevel: 6,
        });

        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.MAIN;
        engine.state.interactionMode = 'NORMAL';
        engine.state.interactionOwnerPlayerId = actor.id;
        actor.leaderLevel = 8;
        actor.hand = [getCard('BT05-064')];

        const action = bot.chooseAction(engine, actor.id);

        expect(action).not.toBeNull();
        expect(action?.type).not.toBe('NEXT_PHASE');
    });

    it('falls back to strong-v3 when the practice profile has no override', () => {
        const engine = createEngine(2026031232);
        const actor = engine.state.players[0];
        const profile: PracticeProfile = {
            id: 'test-profile-null',
            label: 'Test Profile Null',
            chooseMainPhaseAction() {
                return null;
            },
        };
        const bot = new PracticeStrongBot('PracticeStrongBot-Fallback', profile);

        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.MAIN;
        engine.state.interactionMode = 'NORMAL';
        engine.state.interactionOwnerPlayerId = actor.id;
        actor.leaderLevel = 2;
        actor.hand = [getCard('BT05-064')];

        const action = bot.chooseAction(engine, actor.id);

        expect(action).not.toBeNull();
        expect(engine.getLegalActions(actor.id)).toContainEqual(action);
        expect(action?.type).not.toBe('NEXT_PHASE');
    });
});
