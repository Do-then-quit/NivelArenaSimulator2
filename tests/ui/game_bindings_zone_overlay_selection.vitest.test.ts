import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/ui/gameLoop', () => ({
    canLocalHumanInput: vi.fn(() => true),
    getActionOwnerPlayerId: vi.fn((engine: any) => engine.state.interactionOwnerPlayerId ?? engine.currentPlayer.id),
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

describe('game bindings overlay zone selection', () => {
    beforeEach(() => {
        vi.resetModules();
        document.body.innerHTML = `
            <div id="app"></div>
            <div class="trash-zone" data-player="current"></div>
            <div class="damage-zone summary-mode" data-player="opponent"></div>
        `;
    });

    it('dispatches SELECT_TRASH_TARGET when selectable trash overlay card is clicked', async () => {
        const { uiState } = await import('../../src/ui/appState');
        const { attachListeners } = await import('../../src/ui/screens/gameBindings');
        const controller = await import('../../src/ui/online/onlineMatchController');
        const dispatchSpy = vi.spyOn(controller, 'dispatchEngineAction').mockImplementation(() => true);

        const p1 = {
            id: 'P1',
            name: 'Player 1',
            hand: [],
            trash: [createCard('trash-1', 'Trash Unit')],
            damage: [],
            skillZone: [],
            unitZones: [createZone(), createZone(), createZone()],
            levelZone: createCard('leader-1', 'Leader 1'),
        } as any;
        const p2 = {
            id: 'P2',
            name: 'Player 2',
            hand: [],
            trash: [],
            damage: [],
            skillZone: [],
            unitZones: [createZone(), createZone(), createZone()],
            levelZone: createCard('leader-2', 'Leader 2'),
        } as any;

        uiState.game = {
            state: {
                winner: null,
                interactionMode: 'SELECT_TARGET',
                interactionOwnerPlayerId: 'P1',
                pendingEffect: {
                    sourcePlayerId: 'P1',
                    validTargets: 'MY_TRASH',
                    selectedTargets: [],
                },
                players: [p1, p2],
                revealedCards: [],
            },
            currentPlayer: p1,
            opponentPlayer: p2,
            getLegalActions: () => [
                { type: 'SELECT_TRASH_TARGET', actorPlayerId: 'P1', targetPlayerId: 'P1', trashIndex: 0 },
            ],
        } as any;
        uiState.replaySession = null;
        uiState.onlineSession.room = null;
        uiState.onlineSession.localEnginePlayerId = null;
        uiState.render = vi.fn();

        attachListeners(() => '<div class="card"></div>');

        const trashZone = document.querySelector('.trash-zone') as HTMLElement;
        trashZone.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        const selectableCard = document.querySelector('.trash-hover-card.overlay-card-selectable[data-index="0"]') as HTMLElement;
        selectableCard.click();

        expect(dispatchSpy).toHaveBeenCalledWith({
            type: 'SELECT_TRASH_TARGET',
            actorPlayerId: 'P1',
            targetPlayerId: 'P1',
            trashIndex: 0,
        });
        dispatchSpy.mockRestore();
    });

    it('dispatches SELECT_DAMAGE_TARGET when selectable damage overlay card is clicked', async () => {
        const { uiState } = await import('../../src/ui/appState');
        const { attachListeners } = await import('../../src/ui/screens/gameBindings');
        const controller = await import('../../src/ui/online/onlineMatchController');
        const dispatchSpy = vi.spyOn(controller, 'dispatchEngineAction').mockImplementation(() => true);

        const p1 = {
            id: 'P1',
            name: 'Player 1',
            hand: [],
            trash: [],
            damage: [],
            skillZone: [],
            unitZones: [createZone(), createZone(), createZone()],
            levelZone: createCard('leader-1', 'Leader 1'),
        } as any;
        const p2 = {
            id: 'P2',
            name: 'Player 2',
            hand: [],
            trash: [],
            damage: [createCard('dmg-0', 'Damage 0'), createCard('dmg-1', 'Damage 1')],
            skillZone: [],
            unitZones: [createZone(), createZone(), createZone()],
            levelZone: createCard('leader-2', 'Leader 2'),
        } as any;

        uiState.game = {
            state: {
                winner: null,
                interactionMode: 'SELECT_TARGET',
                interactionOwnerPlayerId: 'P1',
                pendingEffect: {
                    sourcePlayerId: 'P1',
                    validTargets: 'MY_DAMAGE',
                    selectedTargets: [],
                },
                players: [p1, p2],
                revealedCards: [],
            },
            currentPlayer: p1,
            opponentPlayer: p2,
            getLegalActions: () => [
                { type: 'SELECT_DAMAGE_TARGET', actorPlayerId: 'P1', targetPlayerId: 'P2', damageIndex: 1 },
            ],
        } as any;
        uiState.replaySession = null;
        uiState.onlineSession.room = null;
        uiState.onlineSession.localEnginePlayerId = null;
        uiState.render = vi.fn();

        attachListeners(() => '<div class="card"></div>');

        const damageZone = document.querySelector('.damage-zone') as HTMLElement;
        damageZone.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        const selectableCard = document.querySelector('.trash-hover-card.overlay-card-selectable[data-index="1"]') as HTMLElement;
        selectableCard.click();

        expect(dispatchSpy).toHaveBeenCalledWith({
            type: 'SELECT_DAMAGE_TARGET',
            actorPlayerId: 'P1',
            targetPlayerId: 'P2',
            damageIndex: 1,
        });
        dispatchSpy.mockRestore();
    });
});
