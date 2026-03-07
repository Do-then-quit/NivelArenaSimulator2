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

function createAnchorMockGame(phase: 'MAIN' | 'BLOCK') {
    const createZone = (unit: any = null) => ({
        unit,
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
        isAwakened: true,
    };

    const attacker = {
        id: 'U1',
        name: 'Attacker',
        type: 'UNIT',
        attribute: 'FIRE',
        cost: 1,
        power: 1000,
        hit: 1000,
        text: '',
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
        unitZones: [createZone(attacker), createZone(), createZone()],
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

    const legalActions = phase === 'MAIN'
        ? [
            { type: 'ATTACK', actorPlayerId: 'P1', attackerZoneIndex: 0 },
            { type: 'ACTIVATE_EFFECT', actorPlayerId: 'P1', zoneIndex: 0, effectIndex: 0, sourceType: 'UNIT' },
            { type: 'ACTIVATE_EFFECT', actorPlayerId: 'P1', zoneIndex: 0, effectIndex: 0, sourceType: 'LEADER' },
            { type: 'NEXT_PHASE', actorPlayerId: 'P1' },
        ]
        : [
            { type: 'RESOLVE_BLOCK', actorPlayerId: 'P1', shouldBlock: true, blockerZoneIndex: 0 },
            { type: 'RESOLVE_BLOCK', actorPlayerId: 'P1', shouldBlock: false },
        ];

    return {
        state: {
            players: [p1, p2],
            turnPlayerIndex: 0,
            phase,
            turnCount: 1,
            winner: null,
            pendingAttackerIndex: phase === 'BLOCK' ? 0 : null,
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
            combatStep: phase === 'BLOCK' ? 'DEFENSE_DECLARATION' : 'NONE',
            combatBlocked: false,
            turnStats: {
                effectTrashedFriendlyUnitCountByPlayerId: {},
                handTrashedByEffectCountByPlayerId: {},
                unitAttackCountByPlayerId: {},
            },
        },
        currentPlayer: p1,
        opponentPlayer: p2,
        getLegalActions: () => legalActions,
        getUnitPower: () => 1000,
        getUnitHit: () => 1000,
        getCardCost: (card: any) => card.cost ?? 0,
        isPendingCardTarget: () => false,
    } as any;
}

describe('game view action fx anchors', () => {
    beforeEach(() => {
        vi.resetModules();
        document.body.innerHTML = '<div id="app"></div>';
        Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1920 });
        Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 1080 });
    });

    it('renders main-phase action anchors and test ids', async () => {
        const { uiState, Screen } = await import('../../src/ui/appState');
        const { renderGame } = await import('../../src/ui/screens/gameView');

        uiState.currentScreen = Screen.GAME;
        uiState.game = createAnchorMockGame('MAIN');
        uiState.playback.enabled = true;
        uiState.playback.pendingAutoPhaseActorId = 'P1';
        uiState.gameLogView.manualOverride = true;

        renderGame();

        expect(document.querySelector('[data-testid="phase-status"]')?.getAttribute('data-action-anchor-key')).toBeTruthy();
        expect(document.querySelector('[data-testid="phase-rail"]')).toBeTruthy();
        expect(document.querySelector('[data-testid="phase-step-main"]')?.getAttribute('data-action-anchor-key')).toBeTruthy();
        expect(document.querySelector('[data-testid="phase-step-draw"]')?.getAttribute('data-action-anchor-key')).toBeTruthy();
        expect(document.querySelector('[data-testid="next-phase-btn"]')?.getAttribute('data-action-anchor-key')).toBeTruthy();
        expect(document.querySelector('[data-testid="unit-zone-P1-0"]')?.getAttribute('data-action-anchor-key')).toBeTruthy();
        expect(document.querySelector('[data-testid="attack-btn-P1-0"]')?.getAttribute('data-action-anchor-key')).toBeTruthy();
        expect(document.querySelector('[data-testid="active-btn-P1-0"]')?.getAttribute('data-action-anchor-key')).toBeTruthy();
        expect(document.querySelector('[data-testid="leader-active-btn-P1"]')?.getAttribute('data-action-anchor-key')).toBeTruthy();
        expect(document.querySelector('[data-testid="auto-phase-indicator"]')?.textContent).toContain('Player 1');
    });

    it('renders block and pass anchors during block resolution', async () => {
        const { uiState, Screen } = await import('../../src/ui/appState');
        const { renderGame } = await import('../../src/ui/screens/gameView');

        uiState.currentScreen = Screen.GAME;
        uiState.game = createAnchorMockGame('BLOCK');
        uiState.playback.enabled = true;
        uiState.playback.pendingAutoPhaseActorId = null;
        uiState.gameLogView.manualOverride = true;

        renderGame();

        expect(document.querySelector('[data-testid="block-btn-P1-0"]')?.getAttribute('data-action-anchor-key')).toBeTruthy();
        expect(document.querySelector('[data-testid="pass-btn-P1-0"]')?.getAttribute('data-action-anchor-key')).toBeTruthy();
        expect(document.querySelector('[data-testid="player-area-P1"]')?.getAttribute('data-action-anchor-key')).toBeTruthy();
    });
});
