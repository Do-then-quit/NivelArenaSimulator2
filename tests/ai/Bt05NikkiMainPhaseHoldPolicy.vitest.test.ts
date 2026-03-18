import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DUMMY_CARDS } from '../../src/logic/CardDatabase';
import { GameEngine } from '../../src/logic/GameEngine';
import {
    buildBt05NikkiMainPhaseHoldSignature,
    Bt05NikkiMainPhaseHoldPolicy,
    shouldApplyBt05NikkiMainPhaseHoldPolicy,
} from '../../src/logic/ai/practice/Bt05NikkiMainPhaseHoldPolicy';
import { PracticeStrongBot } from '../../src/logic/ai/practice/PracticeStrongBot';
import { PracticeProfile } from '../../src/logic/ai/practice/types';
import { Attribute, Card, CardType, Phase } from '../../src/logic/types';
import {
    formatBt05NikkiMainPhaseHoldPolicyTrainingSummary,
    trainBt05NikkiMainPhaseHoldPolicy,
} from '../../scripts/ai/train_bt05_nikki_main_phase_hold_policy';

function getCard(cardId: string): Card {
    const card = DUMMY_CARDS.find(entry => entry.id === cardId);
    if (!card) throw new Error(`Missing card ${cardId}`);
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

describe('BT05 Nikki main-phase hold policy', () => {
    it('builds a stable signature and can drive PracticeStrongBot main-phase holds', () => {
        const engine = createEngine(2026031811);
        const actor = engine.state.players[0];
        const profile: PracticeProfile = {
            id: 'test-policy-profile',
            label: 'Test Policy Profile',
            chooseMainPhaseAction() {
                return null;
            },
        };

        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.MAIN;
        engine.state.interactionMode = 'NORMAL';
        engine.state.interactionOwnerPlayerId = actor.id;
        actor.leaderLevel = 2;
        actor.hand = [getCard('BT05-064')];

        const actions = engine.getLegalActions(actor.id);
        const signature = buildBt05NikkiMainPhaseHoldSignature(engine.state, actor.id, actions);
        expect(signature).toContain('lvl=0-2');

        const policy: Bt05NikkiMainPhaseHoldPolicy = {
            id: 'test-policy',
            label: 'Test Policy',
            minSamples: 2,
            minHoldRate: 0.75,
            minAverageReturnToGo: 0,
            entries: {
                [signature!]: {
                    samples: 5,
                    holdCount: 5,
                    continueCount: 0,
                    holdRate: 1,
                    avgReturnToGo: 0.4,
                },
            },
        };

        expect(shouldApplyBt05NikkiMainPhaseHoldPolicy(policy, signature)).toBe(true);

        const bot = new PracticeStrongBot('PracticeStrongBot-LearnedHold', profile, {
            learnedMainPhaseHoldPolicy: policy,
        });
        const action = bot.chooseAction(engine, actor.id);
        expect(action?.type).toBe('NEXT_PHASE');
    });

    it('trains a hold policy table from exported self-play transitions', () => {
        const signature = 'lvl=0-2|md=0|od=0|mh=0-2|oh=0-2|mf=0|of=0|direct=0|oppDirect=0|playU=1|upgradeU=0|emptyLaneU=1|playI=0|playS=0|act=0';
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nikki-hold-policy-'));
        const inputPath = path.join(tempDir, 'selfplay.json');

        try {
            const syntheticReport = {
                generatedAt: new Date().toISOString(),
                matchup: {
                    id: 'fm-c-bt05-unlucky-bunny-nikki-mirror',
                    label: 'mirror',
                    player1DeckId: 'a',
                    player2DeckId: 'a',
                },
                decks: {
                    player1: { id: 'a', label: 'a', leaderId: 'L1' },
                    player2: { id: 'a', label: 'a', leaderId: 'L2' },
                },
                config: {
                    matchupId: 'fm-c-bt05-unlucky-bunny-nikki-mirror',
                    games: 1,
                    maxSteps: 100,
                    enableMulligan: true,
                    startSeed: 1,
                    player1BotId: 'practice-bt05-nikki-strong-v1',
                    player2BotId: 'practice-bt05-nikki-strong-v1',
                    explorationRate: 0,
                    suppressLogs: true,
                    seedList: [1],
                },
                episodes: [{
                    id: 'episode-1',
                    seed: 1,
                    matchupId: 'fm-c-bt05-unlucky-bunny-nikki-mirror',
                    player1BotId: 'practice-bt05-nikki-strong-v1',
                    player2BotId: 'practice-bt05-nikki-strong-v1',
                    explorationRate: 0,
                    steps: 2,
                    turnCount: 1,
                    reason: 'winner',
                    winnerId: 'P1',
                    winnerPlayer: 1,
                    lastActionKeys: [],
                    transitions: [
                        {
                            stepIndex: 0,
                            actorPlayerId: 'P1',
                            actorSeat: 1,
                            actorBotId: 'practice-bt05-nikki-strong-v1',
                            actorBotName: 'P1-Bot',
                            turnCount: 1,
                            phase: 'MAIN',
                            interactionMode: 'NORMAL',
                            decisionSource: 'bot',
                            observation: {
                                actorPlayerId: 'P1',
                                canAct: true,
                                interactionOwnerPlayerId: 'P1',
                                legalActions: [],
                                state: {},
                            },
                            legalActionKeys: [],
                            chosenActionIndex: 0,
                            chosenAction: {
                                type: 'NEXT_PHASE',
                                key: 'NEXT_PHASE|actorPlayerId=P1',
                                payload: { actorPlayerId: 'P1' },
                            },
                            mainPhaseHoldSignature: signature,
                            nextObservation: null,
                            done: false,
                            terminalReason: null,
                            winnerPlayer: null,
                            rewardFromActorPerspective: 0,
                            returnToGoFromActorPerspective: 1,
                        },
                        {
                            stepIndex: 1,
                            actorPlayerId: 'P1',
                            actorSeat: 1,
                            actorBotId: 'practice-bt05-nikki-strong-v1',
                            actorBotName: 'P1-Bot',
                            turnCount: 1,
                            phase: 'MAIN',
                            interactionMode: 'NORMAL',
                            decisionSource: 'bot',
                            observation: {
                                actorPlayerId: 'P1',
                                canAct: true,
                                interactionOwnerPlayerId: 'P1',
                                legalActions: [],
                                state: {},
                            },
                            legalActionKeys: [],
                            chosenActionIndex: 0,
                            chosenAction: {
                                type: 'NEXT_PHASE',
                                key: 'NEXT_PHASE|actorPlayerId=P1',
                                payload: { actorPlayerId: 'P1' },
                            },
                            mainPhaseHoldSignature: signature,
                            nextObservation: null,
                            done: true,
                            terminalReason: 'winner',
                            winnerPlayer: 1,
                            rewardFromActorPerspective: 1,
                            returnToGoFromActorPerspective: 1,
                        },
                    ],
                }],
                summary: {
                    totalGames: 1,
                    totalTransitions: 2,
                    avgSteps: 2,
                    avgTurns: 1,
                    wins: { player1: 1, player2: 0 },
                    winRate: { player1: 1, player2: 0 },
                    terminationCounts: { winner: 1, max_steps: 0, no_action: 0, invalid_action: 0 },
                    decisionSourceCounts: { bot: 2, exploreRandom: 0 },
                },
            };
            fs.writeFileSync(inputPath, JSON.stringify(syntheticReport), 'utf8');

            const report = trainBt05NikkiMainPhaseHoldPolicy({
                inputPaths: [inputPath],
                outputPath: undefined,
                minSamples: 2,
                minHoldRate: 0.6,
                minAverageReturnToGo: 0,
                policyId: 'bt05-hold-test',
                label: 'BT05 Hold Test',
            });

            expect(report.summary.episodeCount).toBe(1);
            expect(report.summary.eligibleTransitionCount).toBe(2);
            expect(report.summary.signatureCount).toBe(1);
            expect(report.summary.retainedEntryCount).toBe(1);
            expect(report.policy.entries[signature].holdRate).toBe(1);
            expect(report.policy.entries[signature].avgReturnToGo).toBe(1);

            const summaryText = formatBt05NikkiMainPhaseHoldPolicyTrainingSummary(report);
            expect(summaryText).toContain('retained=1');
            expect(summaryText).toContain('eligible=2');
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });
});
