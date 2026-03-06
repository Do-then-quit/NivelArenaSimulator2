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

function createModalDelayMockGame() {
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

    const leader = {
        id: 'L1',
        name: 'Leader',
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
        levelZone: leader,
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
        levelZone: leader,
        leaderLevel: 1,
        unitZones: [createZone(), createZone(), createZone()],
        skillZone: [],
    };

    return {
        state: {
            players: [p1, p2],
            turnPlayerIndex: 0,
            phase: 'MAIN',
            turnCount: 1,
            winner: null,
            pendingAttackerIndex: null,
            pendingBlockerZoneIndex: null,
            interactionMode: 'SELECT_OPTIONAL',
            interactionOwnerPlayerId: 'P1',
            pendingEffect: {
                sourceCard: leader,
                sourcePlayerId: 'P1',
                actionType: 'DRAW',
                actionValue: {},
                effectDescription: 'Optional draw',
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
        getLegalActions: () => [],
        getUnitPower: () => 0,
        getUnitHit: () => 0,
        isPendingCardTarget: () => false,
    } as any;
}

function createRevealedSelectionMockGame() {
    const game = createModalDelayMockGame();
    const revealedCard = {
        id: 'RV1',
        name: 'Revealed Unit',
        type: 'UNIT',
        attribute: 'FIRE',
        cost: 1,
        power: 1000,
        hit: 1000,
        text: '',
    };

    game.state.interactionMode = 'SELECT_TARGET';
    game.state.pendingEffect = {
        sourceCard: game.state.players[0].levelZone,
        sourcePlayerId: 'P1',
        actionType: 'TAKE_ALL_REVEALED',
        actionValue: {},
        validTargets: 'REVEALED',
        selectedTargets: [],
        targetSchema: {
            scope: 'REVEALED',
            type: 'CARD',
            count: 1,
            selectMode: 'MANUAL',
        },
    };
    game.state.revealedCards = [revealedCard];
    game.getLegalActions = () => [
        { type: 'SELECT_REVEALED_TARGET', actorPlayerId: 'P1', revealedIndex: 0 },
        { type: 'CONFIRM_TARGETS', actorPlayerId: 'P1' },
    ];
    return game;
}

describe('game view modal delay during playback', () => {
    beforeEach(() => {
        vi.resetModules();
        document.body.innerHTML = '<div id="app"></div>';
        Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1920 });
        Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 1080 });
    });

    it('hides optional modal until modal gate elapses', async () => {
        const { uiState, Screen } = await import('../../src/ui/appState');
        const { renderGame } = await import('../../src/ui/screens/gameView');

        uiState.currentScreen = Screen.GAME;
        uiState.game = createModalDelayMockGame();
        uiState.gameLogView.manualOverride = true;
        uiState.gameLogView.expanded = true;
        uiState.gameLogView.autoCollapsed = false;
        uiState.playback.enabled = true;
        uiState.playback.animationEnabled = true;
        uiState.playback.queueBusy = true;
        uiState.playback.modalGateUntilMs = Date.now() + 1000;

        renderGame();

        expect(document.querySelector('#opt-confirm')).toBeNull();
        expect(document.body.textContent).toContain('효과 처리 중');

        uiState.playback.queueBusy = false;
        uiState.playback.modalGateUntilMs = Date.now() - 1;
        renderGame();

        expect(document.querySelector('#opt-confirm')).toBeTruthy();
        expect(document.querySelector('#opt-skip')).toBeTruthy();
    });

    it('shows optional modal immediately when animation playback is disabled', async () => {
        const { uiState, Screen } = await import('../../src/ui/appState');
        const { renderGame } = await import('../../src/ui/screens/gameView');

        uiState.currentScreen = Screen.GAME;
        uiState.game = createModalDelayMockGame();
        uiState.gameLogView.manualOverride = true;
        uiState.gameLogView.expanded = true;
        uiState.gameLogView.autoCollapsed = false;
        uiState.playback.enabled = true;
        uiState.playback.animationEnabled = false;
        uiState.playback.queueBusy = true;
        uiState.playback.modalGateUntilMs = Date.now() + 1000;

        renderGame();

        expect(document.querySelector('#opt-confirm')).toBeTruthy();
        expect(document.querySelector('#opt-skip')).toBeTruthy();
        expect(document.querySelector('.fx-processing-banner')).toBeNull();
    });

    it('renders revealed selection modal in preparing state during modal gate', async () => {
        const { uiState, Screen } = await import('../../src/ui/appState');
        const { renderGame } = await import('../../src/ui/screens/gameView');

        uiState.currentScreen = Screen.GAME;
        uiState.game = createRevealedSelectionMockGame();
        uiState.gameLogView.manualOverride = true;
        uiState.gameLogView.expanded = true;
        uiState.gameLogView.autoCollapsed = false;
        uiState.playback.enabled = true;
        uiState.playback.animationEnabled = true;
        uiState.playback.queueBusy = true;
        uiState.playback.modalGateUntilMs = Date.now() + 1000;

        renderGame();

        const modal = document.querySelector('[data-testid="revealed-selection-modal"]');
        expect(modal).toBeTruthy();
        expect(modal?.className).toContain('is-preparing');
        expect(document.querySelector('[data-testid="revealed-selection-tray"]')).toBeTruthy();
        expect((document.getElementById('confirm-targets-modal-btn') as HTMLButtonElement | null)?.disabled).toBe(true);
    });
});
