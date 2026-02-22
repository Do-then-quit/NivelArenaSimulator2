import { beforeEach, describe, expect, it, vi } from 'vitest';

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
        document.body.innerHTML = '<div id="app"></div>';
        Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1920 });
        Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 1080 });
    });

    it('renders panel and Korean category labels', async () => {
        const { uiState, Screen } = await import('../../src/ui/appState');
        const { renderGame } = await import('../../src/ui/screens/gameView');

        uiState.currentScreen = Screen.GAME;
        uiState.game = createMockGame();
        uiState.gameLogFeed.clear();
        uiState.gameLogView.expanded = true;
        uiState.gameLogView.filter = 'ALL';
        uiState.gameLogView.manualOverride = true;
        uiState.gameLogView.autoCollapsed = false;
        uiState.gameLogFeed.pushUiLog('[panel-action] action', 'ACTION');
        uiState.gameLogFeed.pushUiLog('[panel-combat] combat', 'COMBAT');

        renderGame();

        expect(document.querySelector('.game-log-panel')).toBeTruthy();
        expect(document.body.textContent).toContain('게임 로그');
        expect(document.body.textContent).toContain('행동');
        expect(document.body.textContent).toContain('전투');
    });

    it('applies category filter when rendering entries', async () => {
        const { uiState, Screen } = await import('../../src/ui/appState');
        const { renderGame } = await import('../../src/ui/screens/gameView');

        uiState.currentScreen = Screen.GAME;
        uiState.game = createMockGame();
        uiState.gameLogFeed.clear();
        uiState.gameLogView.expanded = true;
        uiState.gameLogView.filter = 'EFFECT';
        uiState.gameLogView.manualOverride = true;
        uiState.gameLogView.autoCollapsed = false;
        uiState.gameLogFeed.pushUiLog('[panel-action-only] action', 'ACTION');
        uiState.gameLogFeed.pushUiLog('[panel-effect-only] effect', 'EFFECT');

        renderGame();

        const messages = Array.from(document.querySelectorAll('.game-log-message'))
            .map(node => (node.textContent || '').trim());
        expect(messages.some(message => message.includes('[panel-effect-only]'))).toBe(true);
        expect(messages.some(message => message.includes('[panel-action-only]'))).toBe(false);
    });

    it('renders collapsed state without log body', async () => {
        const { uiState, Screen } = await import('../../src/ui/appState');
        const { renderGame } = await import('../../src/ui/screens/gameView');

        uiState.currentScreen = Screen.GAME;
        uiState.game = createMockGame();
        uiState.gameLogFeed.clear();
        uiState.gameLogView.expanded = false;
        uiState.gameLogView.filter = 'ALL';
        uiState.gameLogView.manualOverride = true;
        uiState.gameLogView.autoCollapsed = false;
        uiState.gameLogFeed.pushUiLog('[collapsed-check] entry', 'SYSTEM');

        renderGame();

        const panel = document.querySelector('.game-log-panel');
        expect(panel?.classList.contains('collapsed')).toBe(true);
        expect(document.querySelector('.game-log-body')).toBeNull();
    });
});
