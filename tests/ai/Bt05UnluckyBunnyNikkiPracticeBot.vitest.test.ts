import { describe, expect, it } from 'vitest';
import { DUMMY_CARDS } from '../../src/logic/CardDatabase';
import { GameEngine } from '../../src/logic/GameEngine';
import { normalizeBotModelId } from '../../src/logic/ai/BotRegistry';
import { PracticeBot } from '../../src/logic/ai/practice/PracticeBot';
import { bt05UnluckyBunnyNikkiOpeningProfile } from '../../src/logic/ai/practice/deckProfiles/bt05UnluckyBunnyNikki';
import { Attribute, Card, CardType, Phase } from '../../src/logic/types';
import { getAvailableBotIds, resolveBotFactory } from '../../scripts/ai/bot_registry';

function getCard(cardId: string): Card {
    const card = DUMMY_CARDS.find(entry => entry.id === cardId);
    if (!card) {
        throw new Error(`Missing card ${cardId}`);
    }
    return { ...card };
}

function getCardKey(card: Card | null | undefined): string {
    if (!card) return '';
    const match = card.id.match(/^[A-Z]{2}\d{2}-\d{3}/);
    return match?.[0] ?? card.id;
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

function createEngine(options: { enableMulligan?: boolean; seed?: number } = {}): GameEngine {
    const deck1 = Array.from({ length: 40 }, (_, index) => getCard(index % 2 === 0 ? 'BT05-033' : 'BT05-064'));
    const deck2 = Array.from({ length: 40 }, (_, index) => getCard(index % 2 === 0 ? 'ST01-002' : 'ST01-003'));

    return new GameEngine(
        'P1',
        'P2',
        deck1,
        deck2,
        getCard('BT05-032'),
        makeLeader('OPP_LEADER'),
        {
            seed: options.seed ?? 20260312,
            enableMulligan: options.enableMulligan ?? false,
        },
    );
}

function createPracticeBot(): PracticeBot {
    return new PracticeBot('BT05Practice', bt05UnluckyBunnyNikkiOpeningProfile);
}

describe('BT05 Unlucky Bunny Nikki practice bot opening profile', () => {
    it('keeps a hand with an immediate storm-plus-lightning opening plan', () => {
        const engine = createEngine({ enableMulligan: true, seed: 2026031201 });
        const bot = createPracticeBot();
        const p1 = engine.state.players[0];

        p1.hand = [
            getCard('BT05-033'),
            getCard('BT05-064'),
            getCard('BT05-081'),
            getCard('BT05-036'),
            getCard('BT05-041'),
        ];

        const action = bot.chooseAction(engine, p1.id);

        expect(action).not.toBeNull();
        expect(action?.type).toBe('RESOLVE_MULLIGAN');
        expect(action?.type === 'RESOLVE_MULLIGAN' ? action.shouldMulligan : true).toBe(false);
    });

    it('redraws a hand that lacks a realistic early mixed opening', () => {
        const engine = createEngine({ enableMulligan: true, seed: 2026031202 });
        const bot = createPracticeBot();
        const p1 = engine.state.players[0];

        p1.hand = [
            getCard('BT05-041'),
            getCard('BT05-041'),
            getCard('BT05-038'),
            getCard('BT05-040'),
            getCard('BT05-044'),
        ];

        const action = bot.chooseAction(engine, p1.id);

        expect(action).not.toBeNull();
        expect(action?.type).toBe('RESOLVE_MULLIGAN');
        expect(action?.type === 'RESOLVE_MULLIGAN' ? action.shouldMulligan : false).toBe(true);
    });

    it('prefers a 1-cost lightning opener over a slower same-turn curve start on an empty field', () => {
        const engine = createEngine({ seed: 2026031203 });
        const bot = createPracticeBot();
        const p1 = engine.state.players[0];

        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.MAIN;
        engine.state.interactionMode = 'NORMAL';
        engine.state.interactionOwnerPlayerId = p1.id;
        p1.leaderLevel = 2;
        p1.hand = [getCard('ST09-011'), getCard('BT05-064')];

        const action = bot.chooseAction(engine, p1.id);

        expect(action).not.toBeNull();
        expect(action?.type).toBe('PLAY_UNIT');
        if (action?.type === 'PLAY_UNIT') {
            expect(p1.hand[action.handIndex]?.id).toBe('BT05-064');
        }
    });

    it('uses an opposite-attribute connector item before another same-attribute unit when it immediately enables mix', () => {
        const engine = createEngine({ seed: 2026031204 });
        const bot = createPracticeBot();
        const p1 = engine.state.players[0];

        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.MAIN;
        engine.state.interactionMode = 'NORMAL';
        engine.state.interactionOwnerPlayerId = p1.id;
        p1.leaderLevel = 2;
        p1.unitZones[0].unit = getCard('BT05-033');
        p1.hand = [getCard('ST09-011'), getCard('BT05-081')];

        const action = bot.chooseAction(engine, p1.id);

        expect(action).not.toBeNull();
        expect(action?.type).toBe('PLAY_ITEM');
        if (action?.type === 'PLAY_ITEM') {
            expect(p1.hand[action.handIndex]?.id).toBe('BT05-081');
            expect(action.zoneIndex).toBe(0);
        }
    });

    it('prefers BT05-036 as the early 4-cost engine once mix is already active', () => {
        const engine = createEngine({ seed: 2026031205 });
        const bot = createPracticeBot();
        const p1 = engine.state.players[0];

        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.MAIN;
        engine.state.interactionMode = 'NORMAL';
        engine.state.interactionOwnerPlayerId = p1.id;
        p1.leaderLevel = 4;
        p1.damage = [getCard('BT05-081'), getCard('BT05-082')];
        p1.unitZones[0].unit = getCard('BT05-033');
        p1.unitZones[1].unit = getCard('BT05-064');
        p1.hand = [getCard('BT05-036'), getCard('ST09-011')];

        const action = bot.chooseAction(engine, p1.id);

        expect(action).not.toBeNull();
        expect(action?.type).toBe('PLAY_UNIT');
        if (action?.type === 'PLAY_UNIT') {
            expect(p1.hand[action.handIndex]?.id).toBe('BT05-036');
        }
    });

    it('skips BT05-046 in the opening window when it would only create discard pressure', () => {
        const engine = createEngine({ seed: 2026031206 });
        const bot = createPracticeBot();
        const p1 = engine.state.players[0];

        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.MAIN;
        engine.state.interactionMode = 'NORMAL';
        engine.state.interactionOwnerPlayerId = p1.id;
        p1.leaderLevel = 2;
        p1.levelZone = { ...getCard('BT05-032'), id: 'BT05-032_L_2026031206_1' };
        p1.unitZones[0].unit = getCard('BT05-066');
        p1.hand = [getCard('BT05-046')];

        const action = bot.chooseAction(engine, p1.id);

        expect(action).not.toBeNull();
        expect(action?.type).toBe('NEXT_PHASE');
    });

    it('skips BT05-044 in the opening window when trash has no borrow target', () => {
        const engine = createEngine({ seed: 2026031207 });
        const bot = createPracticeBot();
        const p1 = engine.state.players[0];

        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.MAIN;
        engine.state.interactionMode = 'NORMAL';
        engine.state.interactionOwnerPlayerId = p1.id;
        p1.leaderLevel = 2;
        p1.hand = [getCard('BT05-044')];
        p1.trash = [];

        const action = bot.chooseAction(engine, p1.id);

        expect(action).not.toBeNull();
        expect(action?.type).toBe('NEXT_PHASE');
    });

    it('skips BT05-082 active in the opening window when it would only churn hand quality', () => {
        const engine = createEngine({ seed: 2026031208 });
        const bot = createPracticeBot();
        const p1 = engine.state.players[0];

        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.MAIN;
        engine.state.interactionMode = 'NORMAL';
        engine.state.interactionOwnerPlayerId = p1.id;
        p1.leaderLevel = 2;
        p1.unitZones[0].unit = getCard('BT05-033');
        p1.unitZones[0].items = [getCard('BT05-082')];
        p1.hand = [getCard('BT05-036')];

        const action = bot.chooseAction(engine, p1.id);

        expect(action).not.toBeNull();
        expect(action?.type).toBe('NEXT_PHASE');
    });

    it('skips BT05-082 equip in the opening window when it does not improve mix or board quality', () => {
        const engine = createEngine({ seed: 2026031209 });
        const bot = createPracticeBot();
        const p1 = engine.state.players[0];

        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.MAIN;
        engine.state.interactionMode = 'NORMAL';
        engine.state.interactionOwnerPlayerId = p1.id;
        p1.leaderLevel = 2;
        p1.unitZones[0].unit = getCard('BT05-064');
        p1.hand = [getCard('BT05-082')];

        const action = bot.chooseAction(engine, p1.id);

        expect(action).not.toBeNull();
        expect(action?.type).toBe('NEXT_PHASE');
    });

    it('registers the BT05 opening profile in both CLI and UI bot registries', () => {
        expect(getAvailableBotIds()).toContain('practice-bt05-nikki-open-v1');
        expect(normalizeBotModelId('practice-bt05-nikki')).toBe('practice-bt05-nikki-open-v1');

        const bot = resolveBotFactory('practice-bt05-nikki-open-v1')('practice');
        expect(typeof bot.chooseAction).toBe('function');
    });

    it('prefers BT05-044 over a raw BT05-041 body once trash is primed for a strong mixed borrow turn', () => {
        const engine = createEngine({ seed: 2026031210 });
        const bot = createPracticeBot();
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.MAIN;
        engine.state.interactionMode = 'NORMAL';
        engine.state.interactionOwnerPlayerId = p1.id;
        p1.leaderLevel = 6;
        p1.unitZones[0].unit = getCard('BT05-033');
        p1.unitZones[1].unit = getCard('BT05-064');
        p1.hand = [getCard('BT05-041'), getCard('BT05-044')];
        p1.trash = [getCard('BT05-039'), getCard('BT05-064'), getCard('ST09-011')];
        p2.unitZones[0].unit = getCard('ST01-011');

        const action = bot.chooseAction(engine, p1.id);

        expect(action).not.toBeNull();
        expect(action?.type).toBe('PLAY_SKILL');
        if (action?.type === 'PLAY_SKILL') {
            expect(getCardKey(p1.hand[action.handIndex])).toBe('BT05-044');
        }
    });

    it('prioritizes BT05-039 as a borrow target when a mixed redeploy line is ready', () => {
        const engine = createEngine({ seed: 2026031211 });
        const bot = createPracticeBot();
        const p1 = engine.state.players[0];

        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.MAIN;
        engine.state.interactionMode = 'NORMAL';
        engine.state.interactionOwnerPlayerId = p1.id;
        p1.leaderLevel = 6;
        p1.unitZones[0].unit = getCard('BT05-033');
        p1.unitZones[1].unit = getCard('BT05-064');
        p1.hand = [getCard('BT05-044')];
        p1.trash = [getCard('BT05-039'), getCard('ST09-011'), getCard('BT05-064')];

        engine.playSkill(0);
        expect(engine.state.interactionMode).toBe('SELECT_TARGET');

        const action = bot.chooseAction(engine, p1.id);

        expect(action).not.toBeNull();
        expect(action?.type).toBe('SELECT_TRASH_TARGET');
        if (action?.type === 'SELECT_TRASH_TARGET') {
            expect(getCardKey(p1.trash[action.trashIndex])).toBe('BT05-039');
        }
    });

    it('keeps BT05-041 in hand when BT05-043 can use a less valuable discard instead', () => {
        const engine = createEngine({ seed: 2026031212 });
        const bot = createPracticeBot();
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.MAIN;
        engine.state.interactionMode = 'NORMAL';
        engine.state.interactionOwnerPlayerId = p1.id;
        p1.leaderLevel = 6;
        p1.hand = [getCard('BT05-043'), getCard('BT05-041'), getCard('BT05-039')];
        p2.unitZones[0].unit = getCard('BT05-036');

        engine.playSkill(0);
        expect(engine.state.interactionMode).toBe('SELECT_TARGET');

        const action = bot.chooseAction(engine, p1.id);

        expect(action).not.toBeNull();
        expect(action?.type).toBe('SELECT_HAND_TARGET');
        if (action?.type === 'SELECT_HAND_TARGET') {
            expect(getCardKey(p1.hand[action.handIndex])).toBe('BT05-039');
        }
    });

    it('redeploys BT05-064 first from BT05-039 exit when the line needs cheap board plus draw', () => {
        const engine = createEngine({ seed: 2026031213 });
        const bot = createPracticeBot();
        const p1 = engine.state.players[0];

        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.MAIN;
        engine.state.interactionMode = 'NORMAL';
        engine.state.interactionOwnerPlayerId = p1.id;
        p1.leaderLevel = 6;
        p1.hand = [];
        p1.unitZones[0].unit = getCard('BT05-039');
        p1.unitZones[1].unit = getCard('BT05-064');
        p1.trash = [getCard('BT05-064'), getCard('BT05-033')];

        engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');

        const action = bot.chooseAction(engine, p1.id);

        expect(action).not.toBeNull();
        expect(action?.type).toBe('SELECT_TRASH_TARGET');
        if (action?.type === 'SELECT_TRASH_TARGET') {
            expect(getCardKey(p1.trash[action.trashIndex])).toBe('BT05-064');
        }
    });
});
