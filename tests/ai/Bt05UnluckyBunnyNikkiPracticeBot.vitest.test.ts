import { describe, expect, it } from 'vitest';
import { DUMMY_CARDS } from '../../src/logic/CardDatabase';
import { GameEngine } from '../../src/logic/GameEngine';
import { normalizeBotModelId } from '../../src/logic/ai/BotRegistry';
import { PracticeBot } from '../../src/logic/ai/practice/PracticeBot';
import { PracticeStrongBot } from '../../src/logic/ai/practice/PracticeStrongBot';
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

function createStrongPracticeBot(): PracticeStrongBot {
    return new PracticeStrongBot('BT05StrongPractice', bt05UnluckyBunnyNikkiOpeningProfile);
}

function setMainPhase(engine: GameEngine, actorPlayerId: string): void {
    engine.state.turnPlayerIndex = engine.state.players.findIndex(player => player.id === actorPlayerId);
    engine.state.phase = Phase.MAIN;
    engine.state.interactionMode = 'NORMAL';
    engine.state.interactionOwnerPlayerId = actorPlayerId;
    engine.state.pendingEffect = null;
    engine.setPendingRuntime(null);
}

function setTargetSelection(engine: GameEngine, actorPlayerId: string, pendingEffect: Record<string, unknown>): void {
    const actor = engine.state.players.find(player => player.id === actorPlayerId)!;
    const opponent = engine.state.players.find(player => player.id !== actorPlayerId)!;
    engine.state.interactionMode = 'SELECT_TARGET';
    engine.state.interactionOwnerPlayerId = actorPlayerId;
    engine.state.pendingEffect = pendingEffect as any;
    engine.setPendingRuntime({
        player: actor,
        opponent,
        sourceCard: pendingEffect.sourceCard as Card,
        machine: engine,
    }, null);
}

function setOptionalSelection(engine: GameEngine, actorPlayerId: string, pendingEffect: Record<string, unknown>): void {
    engine.state.interactionMode = 'SELECT_OPTIONAL';
    engine.state.interactionOwnerPlayerId = actorPlayerId;
    engine.state.pendingEffect = pendingEffect as any;
    engine.setPendingRuntime(null);
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

    it('registers the BT05 strong practice profile in both CLI and UI bot registries', () => {
        expect(getAvailableBotIds()).toContain('practice-bt05-nikki-strong-v1');
        expect(normalizeBotModelId('practice-bt05-nikki-strong')).toBe('practice-bt05-nikki-strong-v1');

        const bot = resolveBotFactory('practice-bt05-nikki-strong-v1')('practice-strong');
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

    it('skips awakened leader active when there is no meaningful destroy or return line', () => {
        const engine = createEngine({ seed: 2026031214 });
        const bot = createPracticeBot();
        const p1 = engine.state.players[0];

        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.MAIN;
        engine.state.interactionMode = 'NORMAL';
        engine.state.interactionOwnerPlayerId = p1.id;
        p1.leaderLevel = 5;
        p1.levelZone = { ...getCard('BT05-032'), isAwakened: true };
        p1.hand = [];
        p1.unitZones[0].unit = getCard('BT05-033');
        p1.unitZones[1].unit = getCard('BT05-064');
        p1.trash = [];

        const action = bot.chooseAction(engine, p1.id);

        expect(action).not.toBeNull();
        expect(action?.type).toBe('NEXT_PHASE');
    });

    it('uses awakened leader active to destroy BT05-041 when stocked trash turns it into immediate finish value', () => {
        const engine = createEngine({ seed: 2026031215 });
        const bot = createPracticeBot();
        const p1 = engine.state.players[0];

        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.MAIN;
        engine.state.interactionMode = 'NORMAL';
        engine.state.interactionOwnerPlayerId = p1.id;
        p1.leaderLevel = 5;
        p1.levelZone = { ...getCard('BT05-032'), isAwakened: true };
        p1.hand = [];
        p1.unitZones[0].unit = getCard('BT05-041');
        p1.unitZones[1].unit = getCard('BT05-064');
        p1.trash = [getCard('BT05-033'), getCard('BT05-064'), getCard('BT05-066')];

        const mainAction = bot.chooseAction(engine, p1.id);
        expect(mainAction?.type).toBe('ACTIVATE_EFFECT');
        expect(engine.step(mainAction!)).toBe(true);

        const optionAction = bot.chooseAction(engine, p1.id);
        expect(optionAction?.type).toBe('SELECT_REVEALED_TARGET');
        if (optionAction?.type === 'SELECT_REVEALED_TARGET') {
            expect(engine.state.revealedCards[optionAction.revealedIndex]?.id).toBe('BT05-032-DESTROY');
        }
        expect(engine.step(optionAction!)).toBe(true);

        const targetAction = bot.chooseAction(engine, p1.id);
        expect(targetAction?.type).toBe('SELECT_ZONE_TARGET');
        if (targetAction?.type === 'SELECT_ZONE_TARGET') {
            expect(targetAction.zoneIndex).toBe(0);
        }
    });

    it('uses awakened leader active to grant return when a finisher recycle line is already available in hand', () => {
        const engine = createEngine({ seed: 2026031216 });
        const bot = createPracticeBot();
        const p1 = engine.state.players[0];

        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.MAIN;
        engine.state.interactionMode = 'NORMAL';
        engine.state.interactionOwnerPlayerId = p1.id;
        p1.leaderLevel = 5;
        p1.levelZone = { ...getCard('BT05-032'), isAwakened: true };
        p1.hand = [getCard('BT05-038')];
        p1.unitZones[0].unit = getCard('BT05-040');
        p1.unitZones[1].unit = getCard('BT05-064');
        p1.trash = [];

        const mainAction = bot.chooseAction(engine, p1.id);
        expect(mainAction?.type).toBe('ACTIVATE_EFFECT');
        expect(engine.step(mainAction!)).toBe(true);

        const optionAction = bot.chooseAction(engine, p1.id);
        expect(optionAction?.type).toBe('SELECT_REVEALED_TARGET');
        if (optionAction?.type === 'SELECT_REVEALED_TARGET') {
            expect(engine.state.revealedCards[optionAction.revealedIndex]?.id).toBe('BT05-032-RETURN');
        }
        expect(engine.step(optionAction!)).toBe(true);

        const targetAction = bot.chooseAction(engine, p1.id);
        expect(targetAction?.type).toBe('SELECT_ZONE_TARGET');
        if (targetAction?.type === 'SELECT_ZONE_TARGET') {
            expect(targetAction.zoneIndex).toBe(0);
        }
    });

    it('declines BT05-065 optional entry when there is no damage card to recover', () => {
        const engine = createEngine({ seed: 2026031217 });
        const bot = createPracticeBot();
        const p1 = engine.state.players[0];

        p1.damage = [];
        p1.deck = [getCard('BT05-033'), getCard('BT05-064'), getCard('BT05-066'), getCard('ST09-011')];
        setOptionalSelection(engine, p1.id, {
            sourceCard: getCard('BT05-065'),
            sourcePlayerId: p1.id,
            controllerPlayerId: p1.id,
            actionType: 'BT05_065_ENTRY_MILL3_AND_RECOVER_DAMAGE',
            actionValue: { stage: 'OPTIONAL' },
            effectDescription: 'BT05-065 optional mill 3 and recover damage',
        });

        const action = bot.chooseAction(engine, p1.id);

        expect(action).not.toBeNull();
        expect(action?.type).toBe('RESOLVE_OPTIONAL');
        if (action?.type === 'RESOLVE_OPTIONAL') {
            expect(action.confirm).toBe(false);
        }
    });

    it('discards BT05-039 before BT05-041 when BT05-082 resolves draw-then-discard', () => {
        const engine = createEngine({ seed: 2026031218 });
        const bot = createPracticeBot();
        const p1 = engine.state.players[0];

        p1.hand = [getCard('BT05-041'), getCard('BT05-039')];
        setTargetSelection(engine, p1.id, {
            sourceCard: getCard('BT05-082'),
            sourcePlayerId: p1.id,
            controllerPlayerId: p1.id,
            actionType: 'DISCARD_FROM_HAND_AFTER_DRAW',
            actionValue: { discardCount: 1 },
            effectDescription: 'Discard 1 card after drawing',
            validTargets: 'MY_HAND',
            targetSchema: {
                scope: 'MY_HAND',
                type: 'CARD',
                count: 1,
                selectMode: 'MANUAL',
            },
            selectedTargets: [],
        });

        const action = bot.chooseAction(engine, p1.id);

        expect(action).not.toBeNull();
        expect(action?.type).toBe('SELECT_HAND_TARGET');
        if (action?.type === 'SELECT_HAND_TARGET') {
            expect(getCardKey(p1.hand[action.handIndex])).toBe('BT05-039');
        }
    });

    it('lets a low-value BT05-064 die instead of pitching BT05-041 to BT05-046 upkeep', () => {
        const engine = createEngine({ seed: 2026031219 });
        const bot = createPracticeBot();
        const p1 = engine.state.players[0];
        const equipped046 = getCard('BT05-046');

        p1.unitZones[0].unit = getCard('BT05-064');
        p1.unitZones[0].items = [equipped046];
        p1.hand = [getCard('BT05-041')];
        setTargetSelection(engine, p1.id, {
            sourceCard: equipped046,
            sourcePlayerId: p1.id,
            controllerPlayerId: p1.id,
            actionType: 'BT05_046_SELECT_HAND',
            actionValue: { allowPartialSelection: true, minSelection: 0, maxSelection: 1 },
            effectDescription: 'Discard 1 hand card or destroy equipped unit',
            validTargets: 'MY_HAND',
            targetSchema: {
                scope: 'MY_HAND',
                type: 'CARD',
                count: 1,
                selectMode: 'MANUAL',
            },
            selectedTargets: [],
        });

        const action = bot.chooseAction(engine, p1.id);

        expect(action).not.toBeNull();
        expect(action?.type).toBe('CONFIRM_TARGETS');
    });

    it('trashes only the positive BT05-072 reveal target and then confirms', () => {
        const engine = createEngine({ seed: 2026031220 });
        const bot = createPracticeBot();
        const p1 = engine.state.players[0];

        engine.state.revealedCards = [getCard('BT05-041'), getCard('BT05-039'), getCard('ST01-002')];
        setTargetSelection(engine, p1.id, {
            sourceCard: getCard('BT05-072'),
            sourcePlayerId: p1.id,
            controllerPlayerId: p1.id,
            actionType: 'BT05_072_SELECT_REVEALED',
            actionValue: { allowPartialSelection: true, minSelection: 0, maxSelection: 3 },
            effectDescription: 'Select revealed cards to trash',
            validTargets: 'REVEALED',
            targetSchema: {
                scope: 'REVEALED',
                type: 'CARD',
                count: 3,
                selectMode: 'MANUAL',
            },
            selectedTargets: [],
        });

        const firstAction = bot.chooseAction(engine, p1.id);
        expect(firstAction?.type).toBe('SELECT_REVEALED_TARGET');
        if (firstAction?.type === 'SELECT_REVEALED_TARGET') {
            expect(getCardKey(engine.state.revealedCards[firstAction.revealedIndex])).toBe('BT05-039');
        }

        engine.state.pendingEffect = {
            ...engine.state.pendingEffect!,
            selectedTargets: [engine.state.revealedCards[1]],
        };
        const confirmAction = bot.chooseAction(engine, p1.id);

        expect(confirmAction).not.toBeNull();
        expect(confirmAction?.type).toBe('CONFIRM_TARGETS');
    });

    it('bottoms filler trash for BT05-041 and confirms once three cards are lined up', () => {
        const engine = createEngine({ seed: 2026031221 });
        const bot = createPracticeBot();
        const p1 = engine.state.players[0];

        p1.trash = [getCard('BT05-046'), getCard('BT05-064'), getCard('BT05-065'), getCard('BT05-041')];
        setTargetSelection(engine, p1.id, {
            sourceCard: getCard('BT05-041'),
            sourcePlayerId: p1.id,
            controllerPlayerId: p1.id,
            actionType: 'BT05_041_SELECT_TRASH',
            actionValue: { allowPartialSelection: true, minSelection: 0, maxSelection: 4 },
            effectDescription: 'Select trash cards to bottom',
            validTargets: 'MY_TRASH',
            targetSchema: {
                scope: 'MY_TRASH',
                type: 'CARD',
                count: 4,
                selectMode: 'MANUAL',
            },
            selectedTargets: [],
        });

        const firstAction = bot.chooseAction(engine, p1.id);
        expect(firstAction?.type).toBe('SELECT_TRASH_TARGET');
        if (firstAction?.type === 'SELECT_TRASH_TARGET') {
            expect(getCardKey(p1.trash[firstAction.trashIndex])).toBe('BT05-046');
        }

        engine.state.pendingEffect = {
            ...engine.state.pendingEffect!,
            selectedTargets: [p1.trash[0], p1.trash[1], p1.trash[2]],
        };
        const confirmAction = bot.chooseAction(engine, p1.id);

        expect(confirmAction).not.toBeNull();
        expect(confirmAction?.type).toBe('CONFIRM_TARGETS');
    });

    it('equips BT05-081 onto BT05-041 in midgame when it is the cleanest pressure upgrade', () => {
        const engine = createEngine({ seed: 2026031222 });
        const bot = createPracticeBot();
        const p1 = engine.state.players[0];

        setMainPhase(engine, p1.id);
        p1.leaderLevel = 9;
        p1.unitZones[0].unit = getCard('BT05-041');
        p1.unitZones[1].unit = getCard('BT05-064');
        p1.hand = [getCard('BT05-081')];

        const action = bot.chooseAction(engine, p1.id);

        expect(action).not.toBeNull();
        expect(action?.type).toBe('PLAY_ITEM');
        if (action?.type === 'PLAY_ITEM') {
            expect(getCardKey(p1.hand[action.handIndex])).toBe('BT05-081');
            expect(action.zoneIndex).toBe(0);
        }
    });

    it('skips BT05-082 active in midgame when hand quality is already too concentrated', () => {
        const engine = createEngine({ seed: 2026031223 });
        const bot = createPracticeBot();
        const p1 = engine.state.players[0];
        const lootItem = getCard('BT05-082');

        setMainPhase(engine, p1.id);
        p1.leaderLevel = 5;
        p1.unitZones[0].unit = getCard('BT05-041');
        p1.unitZones[0].items = [lootItem];
        p1.unitZones[1].unit = getCard('BT05-064');
        p1.hand = [getCard('BT05-041')];

        const action = bot.chooseAction(engine, p1.id);

        expect(action).not.toBeNull();
        expect(action?.type).toBe('NEXT_PHASE');
    });

    it('uses BT05-082 active in midgame when hand has a clear loot discard target', () => {
        const engine = createEngine({ seed: 2026031224 });
        const bot = createPracticeBot();
        const p1 = engine.state.players[0];
        const lootItem = getCard('BT05-082');

        setMainPhase(engine, p1.id);
        p1.leaderLevel = 5;
        p1.unitZones[0].unit = getCard('BT05-041');
        p1.unitZones[0].items = [lootItem];
        p1.unitZones[1].unit = getCard('BT05-064');
        p1.hand = [getCard('BT05-041'), getCard('BT05-039')];

        const action = bot.chooseAction(engine, p1.id);

        expect(action).not.toBeNull();
        expect(action?.type).toBe('ACTIVATE_EFFECT');
    });

    it('strong practice bot preserves the BT05 opening equip preference while using the strong-v3 base', () => {
        const engine = createEngine({ seed: 2026031230 });
        const bot = createStrongPracticeBot();
        const p1 = engine.state.players[0];

        setMainPhase(engine, p1.id);
        p1.leaderLevel = 2;
        p1.unitZones[0].unit = getCard('BT05-033');
        p1.hand = [getCard('ST09-011'), getCard('BT05-081')];

        const action = bot.chooseAction(engine, p1.id);

        expect(action).not.toBeNull();
        expect(action?.type).toBe('PLAY_ITEM');
        if (action?.type === 'PLAY_ITEM') {
            expect(getCardKey(p1.hand[action.handIndex])).toBe('BT05-081');
            expect(action.zoneIndex).toBe(0);
        }
    });

    it('deploys BT05-039 into an empty lane instead of overwriting a live mixed board lane', () => {
        const engine = createEngine({ seed: 2026031225 });
        const bot = createPracticeBot();
        const p1 = engine.state.players[0];

        setMainPhase(engine, p1.id);
        p1.leaderLevel = 14;
        p1.unitZones[0].unit = getCard('BT05-041');
        p1.unitZones[1].unit = getCard('BT05-064');
        p1.hand = [getCard('BT05-039')];
        p1.trash = [getCard('BT05-039'), getCard('BT05-064')];

        const action = bot.chooseAction(engine, p1.id);

        expect(action).not.toBeNull();
        expect(action?.type).toBe('PLAY_UNIT');
        if (action?.type === 'PLAY_UNIT') {
            expect(getCardKey(p1.hand[action.handIndex])).toBe('BT05-039');
            expect(action.zoneIndex).toBe(2);
        }
    });

    it('skips BT05-072 when every legal upgrade lane is a low-value overwrite', () => {
        const engine = createEngine({ seed: 2026031226 });
        const bot = createPracticeBot();
        const p1 = engine.state.players[0];

        setMainPhase(engine, p1.id);
        p1.leaderLevel = 12;
        p1.unitZones[0].unit = getCard('BT05-034');
        p1.unitZones[1].unit = getCard('BT05-034');
        p1.unitZones[2].unit = getCard('BT05-034');
        p1.hand = [getCard('BT05-072')];
        p1.trash = [getCard('BT05-039'), getCard('BT05-040'), getCard('BT05-038'), getCard('ST09-011')];

        const action = bot.chooseAction(engine, p1.id);

        expect(action).not.toBeNull();
        expect(action?.type).toBe('NEXT_PHASE');
    });

    it('places BT05-072 into an empty lane instead of overwriting a live lane when a free lane exists', () => {
        const engine = createEngine({ seed: 2026031226 });
        const bot = createPracticeBot();
        const p1 = engine.state.players[0];

        setMainPhase(engine, p1.id);
        p1.leaderLevel = 12;
        p1.unitZones[0].unit = getCard('BT05-041');
        p1.unitZones[1].unit = getCard('BT05-064');
        p1.hand = [getCard('BT05-072')];
        p1.trash = [getCard('BT05-039'), getCard('BT05-040'), getCard('BT05-038'), getCard('ST09-011')];

        const action = bot.chooseAction(engine, p1.id);

        expect(action).not.toBeNull();
        expect(action?.type).toBe('PLAY_UNIT');
        if (action?.type === 'PLAY_UNIT') {
            expect(getCardKey(p1.hand[action.handIndex])).toBe('BT05-072');
            expect(action.zoneIndex).toBe(2);
        }
    });

    it('keeps strong practice control of BT05-064 midgame placement to preserve mix and take the empty lane', () => {
        const engine = createEngine({ seed: 2026031235 });
        const bot = createStrongPracticeBot();
        const p1 = engine.state.players[0];

        setMainPhase(engine, p1.id);
        p1.leaderLevel = 8;
        p1.unitZones[0].unit = getCard('BT05-033');
        p1.unitZones[2].unit = getCard('BT05-066');
        p1.hand = [getCard('BT05-064')];

        const action = bot.chooseAction(engine, p1.id);

        expect(action).not.toBeNull();
        expect(action?.type).toBe('PLAY_UNIT');
        if (action?.type === 'PLAY_UNIT') {
            expect(getCardKey(p1.hand[action.handIndex])).toBe('BT05-064');
            expect(action.zoneIndex).toBe(1);
        }
    });

    it('uses BT05-043 to destroy the highest-value opposing unit that fits the discarded cost', () => {
        const engine = createEngine({ seed: 2026031227 });
        const bot = createPracticeBot();
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        setMainPhase(engine, p1.id);
        p1.leaderLevel = 6;
        p1.hand = [getCard('BT05-043'), getCard('BT05-040')];
        p2.unitZones[0].unit = getCard('BT05-033');
        p2.unitZones[1].unit = getCard('BT05-036');

        engine.playSkill(0);
        expect(engine.state.interactionMode).toBe('SELECT_TARGET');

        const discardAction = bot.chooseAction(engine, p1.id);
        expect(discardAction?.type).toBe('SELECT_HAND_TARGET');
        expect(engine.step(discardAction!)).toBe(true);
        expect(engine.state.interactionMode).toBe('SELECT_TARGET');

        const destroyAction = bot.chooseAction(engine, p1.id);

        expect(destroyAction).not.toBeNull();
        expect(destroyAction?.type).toBe('SELECT_ZONE_TARGET');
        if (destroyAction?.type === 'SELECT_ZONE_TARGET') {
            expect(destroyAction.targetPlayerId).toBe(p2.id);
            expect(destroyAction.zoneIndex).toBe(1);
        }
    });

    it('sacrifices BT05-041 first for BT05-038 entry when the stocked trash makes it the best payoff', () => {
        const engine = createEngine({ seed: 2026031228 });
        const bot = createPracticeBot();
        const p1 = engine.state.players[0];

        p1.unitZones[0].unit = getCard('BT05-041');
        p1.unitZones[1].unit = getCard('BT05-064');
        p1.trash = [getCard('BT05-033'), getCard('BT05-065'), getCard('ST09-011')];
        setTargetSelection(engine, p1.id, {
            sourceCard: getCard('BT05-038'),
            sourcePlayerId: p1.id,
            controllerPlayerId: p1.id,
            actionType: 'DESTROY_UNIT',
            actionValue: {},
            effectDescription: 'BT05-038 entry destroy 1 friendly unit',
            validTargets: 'MY_FIELD',
            targetSchema: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 1,
                selectMode: 'MANUAL',
            },
            selectedTargets: [],
        });

        const action = bot.chooseAction(engine, p1.id);

        expect(action).not.toBeNull();
        expect(action?.type).toBe('SELECT_ZONE_TARGET');
        if (action?.type === 'SELECT_ZONE_TARGET') {
            expect(action.targetPlayerId).toBe(p1.id);
            expect(action.zoneIndex).toBe(0);
        }
    });

    it('grants BT05-034 return to BT05-041 over a filler body', () => {
        const engine = createEngine({ seed: 2026031229 });
        const bot = createPracticeBot();
        const p1 = engine.state.players[0];

        p1.unitZones[0].unit = getCard('BT05-041');
        p1.unitZones[1].unit = getCard('BT05-064');
        setTargetSelection(engine, p1.id, {
            sourceCard: getCard('BT05-034'),
            sourcePlayerId: p1.id,
            controllerPlayerId: p1.id,
            actionType: 'GRANT_EFFECT',
            actionValue: {},
            effectDescription: 'BT05-034 grant return',
            validTargets: 'MY_FIELD',
            targetSchema: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 1,
                selectMode: 'MANUAL',
            },
            selectedTargets: [],
        });

        const action = bot.chooseAction(engine, p1.id);

        expect(action).not.toBeNull();
        expect(action?.type).toBe('SELECT_ZONE_TARGET');
        if (action?.type === 'SELECT_ZONE_TARGET') {
            expect(action.targetPlayerId).toBe(p1.id);
            expect(action.zoneIndex).toBe(0);
        }
    });
});
