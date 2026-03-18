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

    it('takes the mix-completing tempo on the stronger lane', () => {
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

    it('upgrades the stronger occupied lane instead of mirroring the filler line', () => {
        const engine = createEngine({ seed: 20260318032 });
        const candidateBot = createCandidateBot();
        const baseBot = new PracticeStrongBot('BT05BasePractice', bt05UnluckyBunnyNikkiOpeningProfile);
        const p1 = engine.state.players[0];

        setMainPhase(engine, p1.id);
        p1.leaderLevel = 7;
        p1.unitZones[0].unit = getCard('BT05-033');
        p1.hand = [getCard('BT05-065'), getCard('BT05-034')];

        const baseAction = baseBot.chooseAction(engine, p1.id);
        const candidateAction = candidateBot.chooseAction(engine, p1.id);

        expect(baseAction).not.toBeNull();
        expect(baseAction?.type).toBe('PLAY_UNIT');
        if (baseAction?.type === 'PLAY_UNIT') {
            expect(getCardKey(p1.hand[baseAction.handIndex])).toBe('BT05-065');
            expect(baseAction.zoneIndex).toBe(1);
        }
        expect(candidateAction).not.toBeNull();
        expect(candidateAction?.type).toBe('PLAY_UNIT');
        if (candidateAction?.type === 'PLAY_UNIT') {
            expect(getCardKey(p1.hand[candidateAction.handIndex])).toBe('BT05-034');
            expect(candidateAction.zoneIndex).toBe(1);
        }
    });

    it('prefers the stronger occupied lane over a thin overwrite', () => {
        const engine = createEngine({ seed: 20260318033 });
        const candidateBot = createCandidateBot();
        const p1 = engine.state.players[0];

        setMainPhase(engine, p1.id);
        p1.leaderLevel = 7;
        p1.unitZones[0].unit = getCard('BT05-033');
        p1.unitZones[1].unit = getCard('BT05-064');
        p1.hand = [getCard('BT05-033'), getCard('BT05-034')];

        const legalActions = engine.getLegalActions(p1.id);
        const overwriteAction = legalActions.find(action =>
            action.type === 'PLAY_UNIT'
            && action.zoneIndex === 1
            && getCardKey(p1.hand[action.handIndex]) === 'BT05-034'
            && getCardKey(p1.unitZones[action.zoneIndex].unit) === 'BT05-064',
        );

        expect(overwriteAction).not.toBeNull();

        const originalChooseMainPhaseAction = bt05UnluckyBunnyNikkiOpeningProfile.chooseMainPhaseAction;
        bt05UnluckyBunnyNikkiOpeningProfile.chooseMainPhaseAction = () => overwriteAction ?? null;

        try {
            const candidateAction = candidateBot.chooseAction(engine, p1.id);

            expect(candidateAction).not.toBeNull();
            expect(candidateAction?.type).toBe('PLAY_UNIT');
            if (candidateAction?.type === 'PLAY_UNIT') {
                expect(getCardKey(p1.hand[candidateAction.handIndex])).toBe('BT05-034');
                expect(candidateAction.zoneIndex).toBe(2);
            }
        } finally {
            bt05UnluckyBunnyNikkiOpeningProfile.chooseMainPhaseAction = originalChooseMainPhaseAction;
        }
    });

    it('keeps the filler card on the open lane when it remains the best line', () => {
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
        expect(candidateAction?.type).toBe('PLAY_UNIT');
        if (candidateAction?.type === 'PLAY_UNIT' && baseAction?.type === 'PLAY_UNIT') {
            expect(getCardKey(p1.hand[candidateAction.handIndex])).toBe('ST09-011');
            expect(candidateAction.zoneIndex).toBe(2);
            expect(baseAction.zoneIndex).toBe(2);
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
