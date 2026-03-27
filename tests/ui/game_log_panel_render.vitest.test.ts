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

function createMockGame() {
    const createZone = () => ({
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
    });

    const leader1 = {
        id: 'L1',
        name: 'Leader 1',
        type: 'LEADER',
        attribute: 'NONE',
        cost: 0,
        text: '',
        effects: [],
    };
    const leader2 = {
        id: 'L2',
        name: 'Leader 2',
        type: 'LEADER',
        attribute: 'NONE',
        cost: 0,
        text: '',
        effects: [],
    };

    const p1 = {
        id: 'P1',
        name: 'Player 1',
        deck: [],
        hand: [],
        trash: [],
        damage: [],
        levelZone: leader1,
        leaderLevel: 1,
        unitZones: [createZone(), createZone(), createZone()],
        skillZone: [],
    };

    const p2 = {
        id: 'P2',
        name: 'Player 2',
        deck: [],
        hand: [],
        trash: [],
        damage: [],
        levelZone: leader2,
        leaderLevel: 1,
        unitZones: [createZone(), createZone(), createZone()],
        skillZone: [],
    };

    return {
        state: {
            players: [p1, p2],
            turnPlayerIndex: 0,
            phase: 'MAIN',
            turnCount: 3,
            winner: null,
            pendingAttackerIndex: null,
            pendingBlockerZoneIndex: null,
            interactionMode: 'NORMAL',
            interactionOwnerPlayerId: 'P1',
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
            turnStats: {
                effectTrashedFriendlyUnitCountByPlayerId: {},
                handTrashedByEffectCountByPlayerId: {},
                unitAttackCountByPlayerId: {},
            },
        },
        currentPlayer: p1,
        opponentPlayer: p2,
        getLegalActions: () => [],
        getUnitPower: (zone: any) => zone.unit?.power ?? 0,
        getUnitHit: (zone: any) => zone.unit?.hit ?? 0,
        isPendingCardTarget: () => false,
    } as any;
}

describe('game log panel render', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it('renders playback effect logs in side panel', { timeout: 10000 }, async () => {
        const { uiState } = await renderGameViewWithMockGame(createMockGame());
        uiState.playback.logEntries = [
            { id: 'plog-1', message: 'Player 1가 1장 드로우', createdAtMs: Date.now() - 1000 },
            { id: 'plog-2', message: 'Player 2 데미지 공개: Fire Bolt', createdAtMs: Date.now() },
        ];

        uiState.render?.();

        expect(document.querySelector('.game-log-panel')).toBeTruthy();
        expect(document.body.textContent).toContain('효과 로그');
        expect(document.body.textContent).toContain('Player 1가 1장 드로우');
        expect(document.body.textContent).toContain('Player 2 데미지 공개: Fire Bolt');
        expect(document.querySelectorAll('.fx-log-entry')).toHaveLength(2);
    });

    it('shows empty message when playback log history is empty', { timeout: 10000 }, async () => {
        const { uiState } = await renderGameViewWithMockGame(createMockGame());
        uiState.playback.logEntries = [];

        uiState.render?.();

        expect(document.body.textContent).toContain('아직 효과 로그가 없습니다.');
    });

    it('renders collapsed preview without scroll body', { timeout: 10000 }, async () => {
        const { uiState } = await renderGameViewWithMockGame(createMockGame(), {
            gameLogExpanded: false,
        });
        uiState.playback.logEntries = [
            { id: 'plog-preview', message: '미리보기 로그', createdAtMs: Date.now() },
        ];

        uiState.render?.();

        const panel = document.querySelector('.game-log-panel');
        expect(panel?.classList.contains('collapsed')).toBe(true);
        expect(document.querySelector('.game-log-body')).toBeNull();
        expect(document.querySelector('.fx-log-collapsed-preview')?.textContent).toContain('미리보기 로그');
    });
});
