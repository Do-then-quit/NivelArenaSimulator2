import { describe, expect, it } from 'vitest';
import {
    evaluateObservedState,
    scoreObservedAction,
} from '../../src/logic/ai/eval/ObservationEvaluator';
import { Attribute, Card, CardType, EngineAction, GameState, Phase } from '../../src/logic/types';

function makeLeader(id: string): Card {
    return {
        id,
        name: id,
        type: CardType.LEADER,
        attribute: Attribute.NONE,
        cost: 0,
        text: '',
        effects: [],
    };
}

function makeUnit(id: string, overrides: Partial<Card> = {}): Card {
    return {
        id,
        name: id,
        type: CardType.UNIT,
        attribute: Attribute.NONE,
        cost: 1,
        power: 1000,
        hit: 1,
        text: '',
        effects: [],
        ...overrides,
    };
}

function makeBaseState(): GameState {
    const p1Id = 'P1';
    const p2Id = 'P2';
    return {
        players: [
            {
                id: p1Id,
                name: 'P1',
                deck: [],
                hand: [],
                trash: [],
                damage: [],
                levelZone: makeLeader('P1L'),
                leaderLevel: 5,
                unitZones: [
                    {
                        unit: makeUnit('ALLY_OLD', { cost: 2, power: 1000, hit: 1 }),
                        items: [],
                        buffs: [],
                        isExhausted: false,
                        hasAttacked: false,
                        hasPlacedUnitThisTurn: false,
                        hasActivatedEffectThisTurn: false,
                        activatedEffectKeys: {},
                        temporaryEffects: [],
                    },
                    {
                        unit: null,
                        items: [],
                        buffs: [],
                        isExhausted: false,
                        hasAttacked: false,
                        hasPlacedUnitThisTurn: false,
                        hasActivatedEffectThisTurn: false,
                        activatedEffectKeys: {},
                        temporaryEffects: [],
                    },
                    {
                        unit: null,
                        items: [],
                        buffs: [],
                        isExhausted: false,
                        hasAttacked: false,
                        hasPlacedUnitThisTurn: false,
                        hasActivatedEffectThisTurn: false,
                        activatedEffectKeys: {},
                        temporaryEffects: [],
                    },
                ],
                skillZone: [],
            },
            {
                id: p2Id,
                name: 'P2',
                deck: [],
                hand: [],
                trash: [],
                damage: [],
                levelZone: makeLeader('P2L'),
                leaderLevel: 5,
                unitZones: [
                    {
                        unit: null,
                        items: [],
                        buffs: [],
                        isExhausted: false,
                        hasAttacked: false,
                        hasPlacedUnitThisTurn: false,
                        hasActivatedEffectThisTurn: false,
                        activatedEffectKeys: {},
                        temporaryEffects: [],
                    },
                    {
                        unit: null,
                        items: [],
                        buffs: [],
                        isExhausted: false,
                        hasAttacked: false,
                        hasPlacedUnitThisTurn: false,
                        hasActivatedEffectThisTurn: false,
                        activatedEffectKeys: {},
                        temporaryEffects: [],
                    },
                    {
                        unit: null,
                        items: [],
                        buffs: [],
                        isExhausted: false,
                        hasAttacked: false,
                        hasPlacedUnitThisTurn: false,
                        hasActivatedEffectThisTurn: false,
                        activatedEffectKeys: {},
                        temporaryEffects: [],
                    },
                ],
                skillZone: [],
            },
        ],
        turnPlayerIndex: 0,
        phase: Phase.MAIN,
        turnCount: 1,
        winner: null,
        pendingAttackerIndex: null,
        pendingDefenderIndex: null,
        interactionMode: 'NORMAL',
        interactionOwnerPlayerId: null,
        pendingEffect: null,
        mulliganState: null,
        mulliganResultByPlayerId: {},
        revealedCards: [],
        effectQueue: [],
        deferredEffectQueue: [],
        damageProcessingDepth: 0,
        globalStep: 0,
        combatStep: 'NONE',
        combatBlocked: false,
    };
}

describe('ObservationEvaluator Phase3 heuristics', () => {
    it('penalizes wasteful upgrade in empty lane relative to pressure-positive deployment', () => {
        const state = makeBaseState();
        const actor = state.players[0];
        actor.hand = [
            makeUnit('WASTEFUL_UPGRADE', { cost: 4, power: 1000, hit: 1 }),
            makeUnit('PRESSURE_UNIT', { cost: 2, power: 1000, hit: 2 }),
        ];

        const upgradeAction: EngineAction = {
            type: 'PLAY_UNIT',
            actorPlayerId: actor.id,
            handIndex: 0,
            zoneIndex: 0,
        };
        const pressureAction: EngineAction = {
            type: 'PLAY_UNIT',
            actorPlayerId: actor.id,
            handIndex: 1,
            zoneIndex: 1,
        };

        const options = {
            enableResourceEconomyModel: true,
            enableAntiOscillationPenalty: true,
        };

        const upgradeScore = scoreObservedAction(state, actor.id, upgradeAction, options).score;
        const pressureScore = scoreObservedAction(state, actor.id, pressureAction, options).score;
        expect(pressureScore).toBeGreaterThan(upgradeScore);
    });

    it('adds positive resource economy component only when enabled', () => {
        const state = makeBaseState();
        const actor = state.players[0];
        const opponent = state.players[1];
        actor.hand = [makeUnit('A1'), makeUnit('A2')];
        opponent.hand = [];
        opponent.unitZones[0].unit = null;

        const disabled = evaluateObservedState(state, actor.id, {
            enableResourceEconomyModel: false,
            enableAntiOscillationPenalty: true,
        });
        const enabled = evaluateObservedState(state, actor.id, {
            enableResourceEconomyModel: true,
            enableAntiOscillationPenalty: true,
        });

        expect(enabled.resourceEconomy).toBeGreaterThan(0);
        expect(disabled.resourceEconomy).toBe(0);
        expect(enabled.total).toBeGreaterThan(disabled.total);
    });
});
