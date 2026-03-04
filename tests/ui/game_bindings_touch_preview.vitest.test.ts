import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function createCard(id: string, name: string, type: 'UNIT' | 'ITEM' | 'SKILL' = 'UNIT') {
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

function setHoverCapability(canHover: boolean) {
    Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
            matches: canHover && query.includes('hover: hover'),
            media: query,
            onchange: null,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            addListener: vi.fn(),
            removeListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })),
    });
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
        Object.defineProperty(window, 'matchMedia', {
            configurable: true,
            writable: true,
            value: undefined,
        });
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
        expect(dispatchSpy).not.toHaveBeenCalled();
        (document.querySelector('.current .drop-zone-skill') as HTMLElement).click();
        expect(dispatchSpy).toHaveBeenCalledWith({ type: 'PLAY_SKILL', actorPlayerId: 'P1', handIndex: 0 });

        dispatchSpy.mockRestore();
    });

    it('shows preview on long-pressing an attached mini-item card', async () => {
        const { uiState, Screen } = await import('../../src/ui/appState');
        const { renderGame } = await import('../../src/ui/screens/gameView');

        const game = createMockGame({ handType: 'UNIT', legalActions: [] });
        const equippedUnit = createCard('unit-1', 'Equipped Unit', 'UNIT');
        const attachedItem = createCard('item-1', 'Attached Weapon', 'ITEM');
        game.state.players[0].unitZones[0].unit = equippedUnit;
        game.state.players[0].unitZones[0].items = [attachedItem];

        uiState.currentScreen = Screen.GAME;
        uiState.game = game;
        uiState.replaySession = null;
        uiState.onlineSession.room = null;
        uiState.onlineSession.localEnginePlayerId = null;
        uiState.mobileGameView.selectedHandIndex = null;
        uiState.mobileGameView.logSheetOpen = false;
        uiState.render = () => renderGame();

        renderGame();

        const miniItem = document.querySelector('.current .mini-item-card') as HTMLElement;
        const tooltip = document.querySelector('.hover-preview-tooltip') as HTMLElement;

        dispatchPointerEvent(miniItem, 'pointerdown', { pointerId: 9, pointerType: 'touch', clientX: 160, clientY: 360 });
        vi.advanceTimersByTime(360);
        expect(tooltip.style.display).toBe('block');
        expect(tooltip.textContent).toContain('Attached Weapon');

        dispatchPointerEvent(miniItem, 'pointerup', { pointerId: 9, pointerType: 'touch', clientX: 160, clientY: 360 });
        expect(tooltip.style.display).toBe('none');
    });

    it('does not show preview on tap/mouseenter in non-hover mobile environments', async () => {
        setHoverCapability(false);
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

        card.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, cancelable: true, clientX: 120, clientY: 200 }));
        card.click();

        expect(tooltip.style.display).toBe('none');
    });

    it('prevents context menu on touch long-press target in non-hover mobile environments', async () => {
        setHoverCapability(false);
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
        const contextMenuEvent = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
        card.dispatchEvent(contextMenuEvent);

        expect(contextMenuEvent.defaultPrevented).toBe(true);
    });

    it('prevents context menu on damage/selection cards in non-hover mobile environments', async () => {
        setHoverCapability(false);
        const { uiState, Screen } = await import('../../src/ui/appState');
        const { renderGame } = await import('../../src/ui/screens/gameView');

        const game = createMockGame({ handType: 'UNIT', legalActions: [] });
        const damageCard = createCard('dmg-1', 'Damage Card', 'UNIT');
        const trashCard = createCard('trash-1', 'Trash Card', 'UNIT');
        game.state.players[0].damage = [damageCard];
        game.state.players[0].trash = [trashCard];
        game.state.interactionMode = 'SELECT_TARGET';
        game.state.pendingEffect = {
            validTargets: 'MY_DAMAGE',
            selectedTargets: [],
            targetSchema: { count: 1, selectMode: 'MANUAL' },
            sourcePlayerId: 'P1',
            actionType: 'TEST_DAMAGE_SELECT',
        };
        game.getLegalActions = () => [{
            type: 'SELECT_DAMAGE_TARGET',
            actorPlayerId: 'P1',
            targetPlayerId: 'P1',
            damageIndex: 0,
        }];

        uiState.currentScreen = Screen.GAME;
        uiState.game = game;
        uiState.replaySession = null;
        uiState.onlineSession.room = null;
        uiState.onlineSession.localEnginePlayerId = null;
        uiState.mobileGameView.selectedHandIndex = null;
        uiState.mobileGameView.logSheetOpen = false;
        uiState.render = () => renderGame();

        renderGame();

        const damageCardItem = document.querySelector('.current .damage-card-item') as HTMLElement;
        const damageContextMenuEvent = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
        damageCardItem.dispatchEvent(damageContextMenuEvent);
        expect(damageContextMenuEvent.defaultPrevented).toBe(true);

        game.state.pendingEffect = {
            validTargets: 'MY_TRASH',
            selectedTargets: [],
            targetSchema: { count: 1, selectMode: 'MANUAL' },
            sourcePlayerId: 'P1',
            actionType: 'TEST_TRASH_SELECT',
        };
        game.getLegalActions = () => [{
            type: 'SELECT_TRASH_TARGET',
            actorPlayerId: 'P1',
            targetPlayerId: 'P1',
            trashIndex: 0,
        }];
        renderGame();

        const selectionTrashCard = document.querySelector('.selection-modal-overlay .trash-card-item') as HTMLElement;
        const trashContextMenuEvent = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
        selectionTrashCard.dispatchEvent(trashContextMenuEvent);
        expect(trashContextMenuEvent.defaultPrevented).toBe(true);
    });
});
