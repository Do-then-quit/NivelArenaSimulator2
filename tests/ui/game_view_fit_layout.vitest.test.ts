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

function createCard(id: string, name: string) {
    return {
        id,
        name,
        type: 'UNIT',
        attribute: 'FIRE',
        cost: 1,
        power: 1000,
        hit: 1000,
        text: '',
    } as any;
}

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

    const p1 = {
        id: 'P1',
        name: 'Player 1',
        deck: [],
        hand: [createCard('p1-hand-1', 'P1 Hand Card')],
        trash: [],
        damage: [],
        levelZone: createCard('p1-leader', 'P1 Leader'),
        leaderLevel: 1,
        unitZones: [createZone(), createZone(), createZone()],
        skillZone: [],
    };

    const p2 = {
        id: 'P2',
        name: 'Player 2',
        deck: [],
        hand: [createCard('p2-hand-1', 'P2 Hand Card')],
        trash: [],
        damage: [],
        levelZone: createCard('p2-leader', 'P2 Leader'),
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
        getUnitPower: () => 0,
        getUnitHit: () => 0,
        isPendingCardTarget: () => false,
    } as any;
}

function setViewport(width: number, height: number) {
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
    Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: height });
}

async function waitForFrame() {
    await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()));
}

describe('game view fit layout', () => {
    beforeEach(() => {
        vi.resetModules();
        document.body.innerHTML = '<div id="app"></div>';
        setViewport(1920, 1080);
    });

    it('returns scale 1 on sufficiently large viewport', async () => {
        const { computeBattleScale } = await import('../../src/ui/screens/gameView');
        const scale = computeBattleScale({
            naturalWidth: 1000,
            naturalHeight: 700,
            availableWidth: 1200,
            availableHeight: 900,
        });
        expect(scale).toBe(1);
    });

    it('clamps scale to minimum when viewport is very small', async () => {
        const { computeBattleScale } = await import('../../src/ui/screens/gameView');
        const scale = computeBattleScale({
            naturalWidth: 1800,
            naturalHeight: 1400,
            availableWidth: 300,
            availableHeight: 220,
        });
        expect(scale).toBeGreaterThanOrEqual(0.58);
        expect(scale).toBe(0.58);
    });

    it('applies expected auto-collapse threshold policy', async () => {
        const { shouldAutoCollapseLog } = await import('../../src/ui/screens/gameView');
        expect(shouldAutoCollapseLog({ viewportWidth: 1920, viewportHeight: 1080 })).toBe(false);
        expect(shouldAutoCollapseLog({ viewportWidth: 1536, viewportHeight: 860 })).toBe(true);
    });

    it('auto-collapses log on small viewport and sets battle scale style', async () => {
        setViewport(1536, 860);
        const { uiState, Screen } = await import('../../src/ui/appState');
        const { renderGame } = await import('../../src/ui/screens/gameView');

        uiState.currentScreen = Screen.GAME;
        uiState.game = createMockGame();
        uiState.gameLogView.manualOverride = false;
        uiState.gameLogView.expanded = true;
        uiState.gameLogView.autoCollapsed = false;

        renderGame();
        await waitForFrame();

        const panel = document.querySelector('.game-log-panel');
        const battleFitContent = document.querySelector('.battle-fit-content') as HTMLElement | null;

        expect(panel?.classList.contains('collapsed')).toBe(true);
        expect(uiState.gameLogView.autoCollapsed).toBe(true);
        expect(battleFitContent?.style.getPropertyValue('--battle-scale')).not.toBe('');
    });

    it('keeps user-selected log state when manual override is enabled', async () => {
        setViewport(1536, 860);
        const { uiState, Screen } = await import('../../src/ui/appState');
        const { renderGame } = await import('../../src/ui/screens/gameView');

        uiState.currentScreen = Screen.GAME;
        uiState.game = createMockGame();
        uiState.gameLogView.manualOverride = true;
        uiState.gameLogView.expanded = true;
        uiState.gameLogView.autoCollapsed = false;

        renderGame();

        const panel = document.querySelector('.game-log-panel');
        expect(panel?.classList.contains('collapsed')).toBe(false);
        expect(uiState.gameLogView.expanded).toBe(true);
        expect(uiState.gameLogView.autoCollapsed).toBe(true);
    });

    it('renders text fallback for revealed prompt cards without imageUrl', async () => {
        const { uiState, Screen } = await import('../../src/ui/appState');
        const { renderGame } = await import('../../src/ui/screens/gameView');

        const game = createMockGame();
        game.state.revealedCards = [{
            id: 'BT06_EFFECT_OPTION_0_0',
            name: 'Option 1',
            type: 'SKILL',
            attribute: 'NONE',
            cost: 0,
            text: 'Activate selected [ACTIVE:ATTACK] effect.',
        }];
        game.state.interactionMode = 'SELECT_TARGET';
        game.state.pendingEffect = {
            validTargets: 'REVEALED',
            selectedTargets: [],
            targetSchema: { count: 1, selectMode: 'MANUAL' },
        };

        uiState.currentScreen = Screen.GAME;
        uiState.game = game;
        uiState.gameLogView.manualOverride = true;
        uiState.gameLogView.expanded = true;
        uiState.gameLogView.autoCollapsed = false;

        renderGame();

        const fallbackName = document.querySelector('.revealed-card-item .card-fallback-name');
        const fallbackText = document.querySelector('.revealed-card-item .card-fallback-text');

        expect(fallbackName?.textContent).toContain('Option 1');
        expect(fallbackText?.textContent).toContain('Activate selected [ACTIVE:ATTACK] effect.');
    });

    it('renders a modal confirm button for multi-select revealed targeting when confirm action is legal', async () => {
        const { uiState, Screen } = await import('../../src/ui/appState');
        const { renderGame } = await import('../../src/ui/screens/gameView');

        const game = createMockGame();
        const cardA = createCard('r-1', 'Revealed A');
        const cardB = createCard('r-2', 'Revealed B');
        const cardC = createCard('r-3', 'Revealed C');
        game.state.revealedCards = [cardA, cardB, cardC];
        game.state.interactionMode = 'SELECT_TARGET';
        game.state.pendingEffect = {
            validTargets: 'REVEALED',
            selectedTargets: [cardA, cardB, cardC],
            targetSchema: { count: 3, selectMode: 'MANUAL' },
        };
        game.getLegalActions = () => [{ type: 'CONFIRM_TARGETS', actorPlayerId: 'P1' }];

        uiState.currentScreen = Screen.GAME;
        uiState.game = game;
        uiState.gameLogView.manualOverride = true;
        uiState.gameLogView.expanded = true;
        uiState.gameLogView.autoCollapsed = false;

        renderGame();

        const confirmBtn = document.getElementById('confirm-targets-modal-btn') as HTMLButtonElement | null;
        expect(confirmBtn).not.toBeNull();
        expect(confirmBtn?.disabled).toBe(false);
    });
});
