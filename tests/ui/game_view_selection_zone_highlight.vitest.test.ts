import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderGameViewWithMockGame } from './helpers/game_view_test_harness';

vi.mock('../../src/ui/screens/gameBindings', () => ({
    attachListeners: vi.fn(),
}));

vi.mock('../../src/ui/gameLoop', () => ({
    canLocalHumanInput: vi.fn(() => true),
    clearAutoPhaseAdvanceTimer: vi.fn(),
    getActionOwnerPlayerId: vi.fn((engine: any) => engine.state.interactionOwnerPlayerId ?? engine.currentPlayer.id),
    getBotLabelForPlayerId: vi.fn(() => 'Bot'),
    isBotControlledPlayer: vi.fn(() => false),
    scheduleAutoPhaseAdvance: vi.fn(),
    scheduleBotStep: vi.fn(),
    shouldRevealHandForPlayer: vi.fn(() => true),
}));

function createCard(id: string, name: string, type: 'UNIT' | 'SKILL' = 'UNIT') {
    return {
        id,
        name,
        type,
        attribute: 'FIRE',
        cost: 1,
        power: 1000,
        hit: 1000,
        text: '',
    } as any;
}

function createZone() {
    return {
        unit: null,
        items: [],
        buffs: [],
        temporaryEffects: [],
        isExhausted: false,
        hasAttacked: false,
        hasPlacedUnitThisTurn: false,
        hasActivatedEffectThisTurn: false,
        activatedEffectKeys: {},
        attackCountThisTurn: 0,
        extraAttackAllowance: 0,
    };
}

function createBasePlayers() {
    const p1 = {
        id: 'P1',
        name: 'Player 1',
        deck: [],
        hand: [],
        trash: [createCard('p1-trash-0', 'P1 Trash 0')],
        damage: [createCard('p1-dmg-0', 'P1 Damage 0')],
        levelZone: createCard('p1-leader', 'P1 Leader'),
        leaderLevel: 1,
        unitZones: [createZone(), createZone(), createZone()],
        skillZone: [createCard('p1-skill-0', 'P1 Skill 0', 'SKILL'), createCard('p1-skill-1', 'P1 Skill 1', 'SKILL')],
    } as any;
    const p2 = {
        id: 'P2',
        name: 'Player 2',
        deck: [],
        hand: [],
        trash: [createCard('p2-trash-0', 'P2 Trash 0')],
        damage: [createCard('p2-dmg-0', 'P2 Damage 0'), createCard('p2-dmg-1', 'P2 Damage 1')],
        levelZone: createCard('p2-leader', 'P2 Leader'),
        leaderLevel: 1,
        unitZones: [createZone(), createZone(), createZone()],
        skillZone: [createCard('p2-skill-0', 'P2 Skill 0', 'SKILL')],
    } as any;
    return { p1, p2 };
}

describe('game view selection zone highlight', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it('marks damage/trash zones as selection candidates from legal actions', { timeout: 10000 }, async () => {
        const { p1, p2 } = createBasePlayers();

        const game = {
            state: {
                players: [p1, p2],
                turnPlayerIndex: 0,
                phase: 'MAIN',
                turnCount: 1,
                winner: null,
                pendingAttackerIndex: null,
                pendingBlockerZoneIndex: null,
                interactionMode: 'SELECT_TARGET',
                interactionOwnerPlayerId: 'P1',
                pendingEffect: {
                    sourceCard: p1.levelZone,
                    sourcePlayerId: 'P1',
                    actionType: 'TEST_SELECT',
                    actionValue: {},
                    validTargets: 'MY_TRASH',
                    targetSchema: { scope: 'MY_TRASH', type: 'CARD', count: 1, selectMode: 'MANUAL' },
                    selectedTargets: [],
                },
                mulliganState: null,
                mulliganResultByPlayerId: {},
                revealedCards: [],
                effectQueue: [],
                deferredEffectQueue: [],
                damageProcessingDepth: 0,
                globalStep: 0,
                combatStep: 'NONE',
                combatBlocked: false,
                turnStats: {
                    effectTrashedFriendlyUnitCountByPlayerId: {},
                    handTrashedByEffectCountByPlayerId: {},
                    unitAttackCountByPlayerId: {},
                },
            },
            currentPlayer: p1,
            opponentPlayer: p2,
            getLegalActions: () => [
                { type: 'SELECT_TRASH_TARGET', actorPlayerId: 'P1', targetPlayerId: 'P2', trashIndex: 0 },
                { type: 'SELECT_DAMAGE_TARGET', actorPlayerId: 'P1', targetPlayerId: 'P2', damageIndex: 0 },
            ],
            getUnitPower: (zone: any) => zone.unit?.power ?? 0,
            getUnitHit: (zone: any) => zone.unit?.hit ?? 0,
            isPendingCardTarget: () => false,
        } as any;
        await renderGameViewWithMockGame(game);

        expect(document.querySelector('.opponent .damage-zone.selection-zone-candidate')).toBeTruthy();
        expect(document.querySelector('.opponent .trash-zone.selection-zone-candidate')).toBeTruthy();
        expect(document.querySelectorAll('.selection-progress-badge').length).toBeGreaterThan(0);
    });

    it('maps skill prompt selection to skill cards and hides revealed modal', { timeout: 10000 }, async () => {
        const { p1, p2 } = createBasePlayers();
        const revealedOption0 = createCard('rv-0', 'Option 0', 'SKILL');
        const revealedOption1 = createCard('rv-1', 'Option 1', 'SKILL');

        const game = {
            state: {
                players: [p1, p2],
                turnPlayerIndex: 0,
                phase: 'MAIN',
                turnCount: 1,
                winner: null,
                pendingAttackerIndex: null,
                pendingBlockerZoneIndex: null,
                interactionMode: 'SELECT_TARGET',
                interactionOwnerPlayerId: 'P1',
                pendingEffect: {
                    sourceCard: p1.levelZone,
                    sourcePlayerId: 'P1',
                    actionType: 'BT06_SELECT_SKILL_ZONE_CARD',
                    actionValue: {
                        options: [{ skillZoneIndex: 1 }, { skillZoneIndex: 0 }],
                    },
                    validTargets: 'REVEALED',
                    targetSchema: { scope: 'REVEALED', type: 'CARD', count: 1, selectMode: 'MANUAL' },
                    selectedTargets: [revealedOption0],
                },
                mulliganState: null,
                mulliganResultByPlayerId: {},
                revealedCards: [revealedOption0, revealedOption1],
                effectQueue: [],
                deferredEffectQueue: [],
                damageProcessingDepth: 0,
                globalStep: 0,
                combatStep: 'NONE',
                combatBlocked: false,
                turnStats: {
                    effectTrashedFriendlyUnitCountByPlayerId: {},
                    handTrashedByEffectCountByPlayerId: {},
                    unitAttackCountByPlayerId: {},
                },
            },
            currentPlayer: p1,
            opponentPlayer: p2,
            getLegalActions: () => [
                { type: 'SELECT_REVEALED_TARGET', actorPlayerId: 'P1', revealedIndex: 0 },
                { type: 'SELECT_REVEALED_TARGET', actorPlayerId: 'P1', revealedIndex: 1 },
            ],
            getUnitPower: (zone: any) => zone.unit?.power ?? 0,
            getUnitHit: (zone: any) => zone.unit?.hit ?? 0,
            isPendingCardTarget: () => false,
        } as any;
        await renderGameViewWithMockGame(game);

        expect(document.querySelector('.current .skill-card-item[data-index="1"].target-candidate')).toBeTruthy();
        expect(document.querySelector('.current .skill-card-item[data-index="1"].selected-target')).toBeTruthy();
        expect(document.querySelector('.revealed-card-item')).toBeNull();
        expect(document.getElementById('selection-modal-toggle-btn')).toBeNull();
    });
});
