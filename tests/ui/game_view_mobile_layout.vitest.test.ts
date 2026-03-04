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

describe('game view mobile portrait layout', () => {
    beforeEach(() => {
        vi.resetModules();
        document.body.innerHTML = '<div id="app"></div>';
        setViewport(900, 1280);
        Object.defineProperty(window, 'visualViewport', {
            configurable: true,
            writable: true,
            value: undefined,
        });
    });

    it('renders floating menu button and mobile actions in portrait mobile viewport', async () => {
        const { uiState, Screen } = await import('../../src/ui/appState');
        const { renderGame } = await import('../../src/ui/screens/gameView');

        uiState.currentScreen = Screen.GAME;
        uiState.game = createMockGame();
        uiState.mobileGameView.logSheetOpen = false;
        uiState.mobileGameView.selectedHandIndex = null;

        renderGame();

        expect(document.querySelector('.game-container.mobile-portrait')).toBeTruthy();
        expect(document.querySelector('.mobile-floating-menu')).toBeTruthy();
        expect(document.getElementById('db-back-to-menu')).toBeTruthy();
        expect(document.querySelector('.mobile-top-hud')).toBeNull();
        expect(document.getElementById('mobile-log-fab')).toBeTruthy();
        expect(document.getElementById('next-phase')).toBeTruthy();
        expect(document.querySelector('.game-side-rail')).toBeNull();
    });

    it('keeps log sheet closed by default and still computes battle scale', async () => {
        const { uiState, Screen } = await import('../../src/ui/appState');
        const { renderGame } = await import('../../src/ui/screens/gameView');

        uiState.currentScreen = Screen.GAME;
        uiState.game = createMockGame();
        uiState.mobileGameView.logSheetOpen = false;
        uiState.mobileGameView.selectedHandIndex = null;

        renderGame();
        await waitForFrame();

        const battleFitContent = document.querySelector('.battle-fit-content') as HTMLElement | null;
        const logSheet = document.querySelector('.mobile-log-sheet');
        expect(uiState.mobileGameView.logSheetOpen).toBe(false);
        expect(logSheet?.classList.contains('open')).toBe(false);
        expect(battleFitContent?.style.getPropertyValue('--battle-scale')).not.toBe('');
    });

    it('binds visualViewport resize and scroll listeners for mobile viewport changes', async () => {
        const addEventListenerSpy = vi.fn();
        const removeEventListenerSpy = vi.fn();
        Object.defineProperty(window, 'visualViewport', {
            configurable: true,
            writable: true,
            value: {
                width: 900,
                height: 1280,
                addEventListener: addEventListenerSpy,
                removeEventListener: removeEventListenerSpy,
            } as any,
        });

        const { uiState, Screen } = await import('../../src/ui/appState');
        const { renderGame } = await import('../../src/ui/screens/gameView');

        uiState.currentScreen = Screen.GAME;
        uiState.game = createMockGame();
        uiState.mobileGameView.logSheetOpen = false;
        uiState.mobileGameView.selectedHandIndex = null;

        renderGame();

        expect(addEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
        expect(addEventListenerSpy).toHaveBeenCalledWith('scroll', expect.any(Function));
        expect(removeEventListenerSpy).not.toHaveBeenCalled();
    });
});
