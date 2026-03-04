import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function createCard(id: string, name: string, type: 'UNIT' | 'SKILL' = 'UNIT') {
    return {
        id,
        name,
        type,
        attribute: 'FIRE',
        cost: 1,
        power: 1000,
        hit: 1000,
        text: '[Test] effect',
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

function createMockGame(options?: { handType?: 'UNIT' | 'SKILL'; legalActions?: any[] }) {
    const handType = options?.handType ?? 'UNIT';
    const legalActions = options?.legalActions ?? [];

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
        getUnitPower: () => 0,
        getUnitHit: () => 0,
        isPendingCardTarget: () => false,
    } as any;
}

function setViewport(width: number, height: number) {
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
    Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: height });
}

function dispatchPointerEvent(
    target: Element,
    type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
    extras: Record<string, unknown>,
) {
    const event = new Event(type, { bubbles: true, cancelable: true }) as any;
    Object.assign(event, extras);
    target.dispatchEvent(event);
}

describe('game bindings mobile long-press preview', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.useFakeTimers();
        document.body.innerHTML = '<div id="app"></div>';
        setViewport(900, 1280);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('shows preview on touch long-press and hides on release', async () => {
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

        const card = document.querySelector('.hand-zone .card-in-hand[data-index="0"]') as HTMLElement;
        const tooltip = document.querySelector('.hover-preview-tooltip') as HTMLElement;

        dispatchPointerEvent(card, 'pointerdown', { pointerId: 1, pointerType: 'touch', clientX: 120, clientY: 240 });
        vi.advanceTimersByTime(360);

        expect(tooltip.style.display).toBe('block');

        dispatchPointerEvent(card, 'pointerup', { pointerId: 1, pointerType: 'touch', clientX: 120, clientY: 240 });
        expect(tooltip.style.display).toBe('none');
    });

    it('suppresses accidental click once after long-press', async () => {
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

        const card = document.querySelector('.hand-zone .card-in-hand[data-index="0"]') as HTMLElement;
        dispatchPointerEvent(card, 'pointerdown', { pointerId: 7, pointerType: 'touch', clientX: 100, clientY: 180 });
        vi.advanceTimersByTime(360);
        dispatchPointerEvent(card, 'pointerup', { pointerId: 7, pointerType: 'touch', clientX: 100, clientY: 180 });

        card.click();
        expect(dispatchSpy).not.toHaveBeenCalled();

        card.click();
        expect(dispatchSpy).toHaveBeenCalledWith({ type: 'PLAY_SKILL', actorPlayerId: 'P1', handIndex: 0 });

        dispatchSpy.mockRestore();
    });
});
