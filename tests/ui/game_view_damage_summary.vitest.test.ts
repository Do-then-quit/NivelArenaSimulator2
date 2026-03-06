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

function createMockGame(selectionMode = false) {
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
        damage: [createCard('p1-dmg-1', 'P1 D1'), createCard('p1-dmg-2', 'P1 D2')],
        levelZone: createCard('p1-leader', 'P1 Leader'),
        leaderLevel: 1,
        unitZones: [createZone(), createZone(), createZone()],
        skillZone: [createCard('p1-skill-1', 'P1 Skill')],
    };

    const p2 = {
        id: 'P2',
        name: 'Player 2',
        deck: [],
        hand: [createCard('p2-hand-1', 'P2 Hand Card')],
        trash: [],
        damage: [createCard('p2-dmg-1', 'P2 D1'), createCard('p2-dmg-2', 'P2 D2')],
        levelZone: createCard('p2-leader', 'P2 Leader'),
        leaderLevel: 1,
        unitZones: [createZone(), createZone(), createZone()],
        skillZone: [createCard('p2-skill-1', 'P2 Skill')],
    };

    p1.unitZones[0].unit = createCard('p1-unit-1', 'P1 Unit');
    p2.unitZones[0].unit = createCard('p2-unit-1', 'P2 Unit');
    (p1.unitZones[0].unit as any).turnCostOverride = { cost: 0, turnCount: 1 };
    (p1.skillZone[0] as any).turnCostOverride = { cost: 0, turnCount: 1 };

    const legalActions = selectionMode
        ? [{ type: 'SELECT_DAMAGE_TARGET', actorPlayerId: 'P1', targetPlayerId: 'P2', damageIndex: 0 }]
        : [];

    return {
        state: {
            players: [p1, p2],
            turnPlayerIndex: 0,
            phase: 'MAIN',
            turnCount: 1,
            winner: null,
            pendingAttackerIndex: null,
            pendingBlockerZoneIndex: null,
            interactionMode: selectionMode ? 'SELECT_TARGET' : 'NORMAL',
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
        getLegalActions: () => legalActions,
        getUnitPower: (zone: any) => zone.unit?.power ?? 0,
        getUnitHit: (zone: any) => zone.unit?.hit ?? 0,
        getCardCost: (card: any) => {
            const override = card?.turnCostOverride;
            if (
                override &&
                typeof override === 'object' &&
                override.turnCount === 1 &&
                typeof override.cost === 'number'
            ) {
                return Math.max(0, override.cost);
            }
            return Math.max(0, Number(card?.cost || 0));
        },
        isPendingCardTarget: () => false,
    } as any;
}

describe('game view damage zone summary', () => {
    beforeEach(() => {
        vi.resetModules();
        document.body.innerHTML = '<div id="app"></div>';
        Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1920 });
        Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 1080 });
    });

    it('renders damage zone in summary mode and wraps skill cards with markers', async () => {
        const { uiState, Screen } = await import('../../src/ui/appState');
        const { renderGame } = await import('../../src/ui/screens/gameView');

        uiState.currentScreen = Screen.GAME;
        uiState.game = createMockGame(false);
        uiState.gameLogView.manualOverride = true;
        uiState.gameLogView.expanded = true;
        uiState.gameLogView.autoCollapsed = false;

        renderGame();

        const currentDamageCount = document.querySelector('.current .damage-zone.summary-mode .damage-count');
        const opponentDamageCount = document.querySelector('.opponent .damage-zone.summary-mode .damage-count');
        const damageCards = document.querySelectorAll('.damage-zone.summary-mode .damage-card-item');
        const damageCardStrip = document.querySelector('.current .damage-zone.summary-mode .damage-card-strip') as HTMLElement | null;
        const skillCards = document.querySelectorAll('.skill-card-item');
        const skillCosts = Array.from(document.querySelectorAll('.skill-card-item .skill-cost'));
        const unitStats = Array.from(document.querySelectorAll('.unit-zone .stats'));

        expect(currentDamageCount?.textContent?.trim()).toBe('2');
        expect(opponentDamageCount?.textContent?.trim()).toBe('2');
        expect(damageCards.length).toBe(4);
        expect(damageCardStrip?.style.getPropertyValue('--damage-step')).not.toBe('');
        expect(skillCards.length).toBe(2);
        expect(skillCosts.length).toBe(2);
        expect(skillCosts.some(node => node.textContent?.trim() === 'C 0')).toBe(true);
        expect(skillCosts.some(node => node.textContent?.trim() === 'C 1')).toBe(true);
        expect(unitStats.length).toBe(2);
        expect(unitStats.some(node => node.textContent?.includes('C 0 | 1000 / 1000'))).toBe(true);
        expect(unitStats.some(node => node.textContent?.includes('C 1 | 1000 / 1000'))).toBe(true);
    });

    it('keeps summary damage zone and highlights candidate state when damage targets are legal', async () => {
        const { uiState, Screen } = await import('../../src/ui/appState');
        const { renderGame } = await import('../../src/ui/screens/gameView');

        uiState.currentScreen = Screen.GAME;
        uiState.game = createMockGame(true);
        uiState.gameLogView.manualOverride = true;
        uiState.gameLogView.expanded = true;
        uiState.gameLogView.autoCollapsed = false;

        renderGame();

        const opponentSelectionZone = document.querySelector('.opponent .damage-zone.summary-mode.selection-zone-candidate');
        const selectableDamageCards = document.querySelectorAll('.opponent .damage-zone .damage-card-item');
        const progressBadge = document.querySelector('.opponent .damage-zone .selection-progress-badge');
        expect(opponentSelectionZone).toBeTruthy();
        expect(selectableDamageCards.length).toBe(2);
        expect(progressBadge?.textContent).toContain('selected 0/1');
    });

    it('adds motion anchor attributes to hand, deck, damage, and revealed cards', async () => {
        const { uiState, Screen } = await import('../../src/ui/appState');
        const { renderGame } = await import('../../src/ui/screens/gameView');

        uiState.currentScreen = Screen.GAME;
        uiState.game = createMockGame(false);
        uiState.game.state.revealedCards = [createCard('rv-1', 'Revealed Card')];
        uiState.gameLogView.manualOverride = true;
        uiState.gameLogView.expanded = true;
        uiState.gameLogView.autoCollapsed = false;

        renderGame();

        const currentHandZone = document.querySelector('.hand-zone[data-motion-zone="HAND"][data-player-id="P1"]');
        const currentDeckZone = document.querySelector('.current .deck-zone[data-motion-zone="DECK"][data-player-id="P1"]');
        const currentDamageCard = document.querySelector('.current .damage-card-item[data-card-motion-key]');
        const revealedCard = document.querySelector('.revealed-card-item[data-card-motion-key]');

        expect(currentHandZone).toBeTruthy();
        expect(currentDeckZone).toBeTruthy();
        expect(currentDamageCard?.getAttribute('data-motion-anchor-key')).toMatch(/^card:/);
        expect(revealedCard?.getAttribute('data-motion-zone')).toBe('REVEALED');
    });
});
