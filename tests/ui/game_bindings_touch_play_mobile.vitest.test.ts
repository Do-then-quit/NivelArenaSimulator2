import { beforeEach, describe, expect, it, vi } from 'vitest';

function createCard(id: string, name: string, type: 'UNIT' | 'ITEM' | 'SKILL' = 'UNIT') {
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

function createMockGame(options?: {
    handType?: 'UNIT' | 'ITEM' | 'SKILL';
    legalActions?: any[];
    interactionOwnerPlayerId?: string;
}) {
    const handType = options?.handType ?? 'UNIT';
    const legalActions = options?.legalActions ?? [];
    const interactionOwnerPlayerId = options?.interactionOwnerPlayerId ?? 'P1';

    const p1 = {
        id: 'P1',
        name: 'Player 1',
        deck: [],
        hand: [createCard('p1-hand-1', 'P1 Hand Card', handType)],
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
            interactionOwnerPlayerId,
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
        getUnitPower: () => 0,
        getUnitHit: () => 0,
        isPendingCardTarget: () => false,
    } as any;
}

function setViewport(width: number, height: number) {
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
    Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: height });
}

describe('game bindings mobile touch play', () => {
    beforeEach(() => {
        vi.resetModules();
        document.body.innerHTML = '<div id="app"></div>';
        setViewport(900, 1280);
    });

    it('plays unit by tap-selecting hand then tapping a valid lane', async () => {
        const { uiState, Screen } = await import('../../src/ui/appState');
        const { renderGame } = await import('../../src/ui/screens/gameView');
        const controller = await import('../../src/ui/online/onlineMatchController');
        const dispatchSpy = vi.spyOn(controller, 'dispatchEngineAction').mockImplementation(() => true);

        uiState.currentScreen = Screen.GAME;
        uiState.game = createMockGame({
            handType: 'UNIT',
            legalActions: [{ type: 'PLAY_UNIT', actorPlayerId: 'P1', handIndex: 0, zoneIndex: 1 }],
        });
        uiState.replaySession = null;
        uiState.onlineSession.room = null;
        uiState.onlineSession.localEnginePlayerId = null;
        uiState.mobileGameView.selectedHandIndex = null;
        uiState.mobileGameView.logSheetOpen = false;
        uiState.render = () => renderGame();

        renderGame();

        (document.querySelector('.hand-zone .card-in-hand[data-index="0"]') as HTMLElement).click();
        (document.querySelector('.drop-zone[data-index="1"]') as HTMLElement).click();

        expect(dispatchSpy).toHaveBeenCalledWith({ type: 'PLAY_UNIT', actorPlayerId: 'P1', handIndex: 0, zoneIndex: 1 });
        dispatchSpy.mockRestore();
    });

    it('opens and closes the mobile log bottom sheet via FAB and backdrop', async () => {
        const { uiState, Screen } = await import('../../src/ui/appState');
        const { renderGame } = await import('../../src/ui/screens/gameView');

        uiState.currentScreen = Screen.GAME;
        uiState.game = createMockGame({ handType: 'UNIT', legalActions: [] });
        uiState.replaySession = null;
        uiState.onlineSession.room = null;
        uiState.onlineSession.localEnginePlayerId = null;
        uiState.mobileGameView.selectedHandIndex = null;
        uiState.mobileGameView.logSheetOpen = false;
        uiState.render = () => renderGame();

        renderGame();
        expect(uiState.mobileGameView.logSheetOpen).toBe(false);

        (document.getElementById('mobile-log-fab') as HTMLButtonElement).click();
        expect(uiState.mobileGameView.logSheetOpen).toBe(true);
        expect(document.querySelector('.mobile-log-sheet')?.classList.contains('open')).toBe(true);

        (document.getElementById('mobile-log-sheet-backdrop') as HTMLElement).click();
        expect(uiState.mobileGameView.logSheetOpen).toBe(false);
        expect(document.querySelector('.mobile-log-sheet')?.classList.contains('open')).toBe(false);
    });

    it('cancels tap selection on re-tap and does not dispatch play action', async () => {
        const { uiState, Screen } = await import('../../src/ui/appState');
        const { renderGame } = await import('../../src/ui/screens/gameView');
        const controller = await import('../../src/ui/online/onlineMatchController');
        const dispatchSpy = vi.spyOn(controller, 'dispatchEngineAction').mockImplementation(() => true);

        uiState.currentScreen = Screen.GAME;
        uiState.game = createMockGame({
            handType: 'UNIT',
            legalActions: [{ type: 'PLAY_UNIT', actorPlayerId: 'P1', handIndex: 0, zoneIndex: 0 }],
        });
        uiState.replaySession = null;
        uiState.onlineSession.room = null;
        uiState.onlineSession.localEnginePlayerId = null;
        uiState.mobileGameView.selectedHandIndex = null;
        uiState.mobileGameView.logSheetOpen = false;
        uiState.render = () => renderGame();

        renderGame();

        const handCard = document.querySelector('.hand-zone .card-in-hand[data-index="0"]') as HTMLElement;
        handCard.click();
        handCard.click();
        (document.querySelector('.drop-zone[data-index="0"]') as HTMLElement).click();

        expect(uiState.mobileGameView.selectedHandIndex).toBeNull();
        expect(dispatchSpy).not.toHaveBeenCalled();
        dispatchSpy.mockRestore();
    });

    it('plays skill immediately on tap in mobile portrait mode', async () => {
        const { uiState, Screen } = await import('../../src/ui/appState');
        const { renderGame } = await import('../../src/ui/screens/gameView');
        const controller = await import('../../src/ui/online/onlineMatchController');
        const dispatchSpy = vi.spyOn(controller, 'dispatchEngineAction').mockImplementation(() => true);

        uiState.currentScreen = Screen.GAME;
        uiState.game = createMockGame({
            handType: 'SKILL',
            legalActions: [{ type: 'PLAY_SKILL', actorPlayerId: 'P1', handIndex: 0 }],
        });
        uiState.replaySession = null;
        uiState.onlineSession.room = null;
        uiState.onlineSession.localEnginePlayerId = null;
        uiState.mobileGameView.selectedHandIndex = null;
        uiState.mobileGameView.logSheetOpen = false;
        uiState.render = () => renderGame();

        renderGame();
        (document.querySelector('.hand-zone .card-in-hand[data-index="0"]') as HTMLElement).click();

        expect(dispatchSpy).toHaveBeenCalledWith({ type: 'PLAY_SKILL', actorPlayerId: 'P1', handIndex: 0 });
        dispatchSpy.mockRestore();
    });

    it('blocks local touch play when online interaction owner is remote', async () => {
        const { uiState, Screen } = await import('../../src/ui/appState');
        const { renderGame } = await import('../../src/ui/screens/gameView');
        const controller = await import('../../src/ui/online/onlineMatchController');
        const dispatchSpy = vi.spyOn(controller, 'dispatchEngineAction').mockImplementation(() => true);

        uiState.currentScreen = Screen.GAME;
        uiState.game = createMockGame({
            handType: 'UNIT',
            legalActions: [{ type: 'PLAY_UNIT', actorPlayerId: 'P2', handIndex: 0, zoneIndex: 1 }],
            interactionOwnerPlayerId: 'P2',
        });
        uiState.replaySession = null;
        uiState.onlineSession.room = {
            roomCode: '123456',
            phase: 'IN_GAME',
            hostClientId: 'client-host',
            players: [],
            matchSessionId: 'session-1',
        } as any;
        uiState.onlineSession.localEnginePlayerId = 'P1';
        uiState.mobileGameView.selectedHandIndex = null;
        uiState.mobileGameView.logSheetOpen = false;
        uiState.render = () => renderGame();

        renderGame();

        (document.querySelector('.hand-zone .card-in-hand[data-index="0"]') as HTMLElement).click();
        (document.querySelector('.drop-zone[data-index="1"]') as HTMLElement | null)?.click();

        expect(dispatchSpy).not.toHaveBeenCalled();
        dispatchSpy.mockRestore();
    });
});
