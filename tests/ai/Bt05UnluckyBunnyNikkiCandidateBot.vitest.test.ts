import { describe, expect, it } from 'vitest';
import { DUMMY_CARDS } from '../../src/logic/CardDatabase';
import { GameEngine } from '../../src/logic/GameEngine';
import { PracticeStrongBot } from '../../src/logic/ai/practice/PracticeStrongBot';
import { bt05UnluckyBunnyNikkiOpeningProfile } from '../../src/logic/ai/practice/deckProfiles/bt05UnluckyBunnyNikki';
import { bt05UnluckyBunnyNikkiCandidateProfile } from '../../src/logic/ai/practice/deckProfiles/bt05UnluckyBunnyNikkiCandidate';
import { Attribute, Card, CardType, Phase } from '../../src/logic/types';

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
            seed: options.seed ?? 20260318,
            enableMulligan: options.enableMulligan ?? false,
        },
    );
}

function createCandidateBot(): PracticeStrongBot {
    return new PracticeStrongBot('BT05CandidatePractice', bt05UnluckyBunnyNikkiCandidateProfile);
}

function setMainPhase(engine: GameEngine, actorPlayerId: string): void {
    engine.state.turnPlayerIndex = engine.state.players.findIndex(player => player.id === actorPlayerId);
    engine.state.phase = Phase.MAIN;
    engine.state.interactionMode = 'NORMAL';
    engine.state.interactionOwnerPlayerId = actorPlayerId;
    engine.state.pendingEffect = null;
    engine.setPendingRuntime(null);
}

describe('BT05 Unlucky Bunny Nikki candidate profile', () => {
    it('preserves the v1 opening mulligan keep for a strong mixed hand', () => {
        const engine = createEngine({ enableMulligan: true, seed: 2026031801 });
        const bot = createCandidateBot();
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

    it('defers to the v1 BT05-039 redeploy line instead of forcing a tempo overlay', () => {
        const engine = createEngine({ seed: 2026031802 });
        const bot = createCandidateBot();
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

    it('takes empty-lane tempo only when it completes the missing storm-lightning mix', () => {
        const engine = createEngine({ seed: 2026031803 });
        const bot = createCandidateBot();
        const p1 = engine.state.players[0];

        setMainPhase(engine, p1.id);
        p1.leaderLevel = 7;
        p1.unitZones[0].unit = getCard('BT05-064');
        p1.unitZones[1].unit = getCard('BT05-065');
        p1.hand = [getCard('ST09-011')];

        const action = bot.chooseAction(engine, p1.id);

        expect(action).not.toBeNull();
        expect(action?.type).toBe('PLAY_UNIT');
        if (action?.type === 'PLAY_UNIT') {
            expect(getCardKey(p1.hand[action.handIndex])).toBe('ST09-011');
            expect(action.zoneIndex).toBe(2);
        }
    });

    it('defers when the field is already mixed and only filler tempo remains', () => {
        const engine = createEngine({ seed: 20260318031 });
        const p1 = engine.state.players[0];

        setMainPhase(engine, p1.id);
        p1.leaderLevel = 7;
        p1.unitZones[0].unit = getCard('BT05-033');
        p1.unitZones[1].unit = getCard('BT05-064');
        p1.hand = [getCard('ST09-011')];

        const candidateAction = createCandidateBot().chooseAction(engine, p1.id);
        const baseAction = new PracticeStrongBot('BT05BasePractice', bt05UnluckyBunnyNikkiOpeningProfile).chooseAction(engine, p1.id);

        expect(candidateAction).not.toBeNull();
        expect(baseAction).not.toBeNull();
        expect(candidateAction?.type).toBe(baseAction?.type);
        if (candidateAction?.type === 'PLAY_UNIT' && baseAction?.type === 'PLAY_UNIT') {
            expect(candidateAction.handIndex).toBe(baseAction.handIndex);
            expect(candidateAction.zoneIndex).toBe(baseAction.zoneIndex);
        }
    });

    it('defers to the base profile when a higher-leverage BT05 engine action is available', () => {
        const engine = createEngine({ seed: 2026031804 });
        const bot = createCandidateBot();
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        setMainPhase(engine, p1.id);
        p1.leaderLevel = 6;
        p1.unitZones[0].unit = getCard('BT05-033');
        p1.unitZones[1].unit = getCard('BT05-064');
        p1.hand = [getCard('BT05-044'), getCard('ST09-011')];
        p1.trash = [getCard('BT05-039'), getCard('BT05-064'), getCard('ST09-011')];
        p2.unitZones[0].unit = getCard('ST01-011');

        const action = bot.chooseAction(engine, p1.id);

        expect(action).not.toBeNull();
        expect(action?.type).toBe('PLAY_SKILL');
        if (action?.type === 'PLAY_SKILL') {
            expect(getCardKey(p1.hand[action.handIndex])).toBe('BT05-044');
        }
    });
});
