import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('game bindings interaction owner', () => {
    beforeEach(() => {
        vi.resetModules();
        document.body.innerHTML = `
            <div id="app"></div>
            <button id="mulligan-keep-btn"></button>
            <button id="mulligan-redraw-btn"></button>
        `;
    });

    it('uses interactionOwnerPlayerId for mulligan action owner', async () => {
        const { uiState } = await import('../../src/ui/appState');
        const { attachListeners } = await import('../../src/ui/screens/gameBindings');

        const p1 = { id: 'P1', hand: [], unitZones: [], damage: [], trash: [], skillZone: [], levelZone: null } as any;
        const p2 = { id: 'P2', hand: [], unitZones: [], damage: [], trash: [], skillZone: [], levelZone: null } as any;
        const stepSpy = vi.fn(() => true);

        uiState.game = {
            state: {
                winner: null,
                interactionMode: 'SELECT_MULLIGAN',
                interactionOwnerPlayerId: 'P2',
                players: [p1, p2],
                pendingEffect: null,
                revealedCards: [],
            },
            currentPlayer: p1,
            opponentPlayer: p2,
            step: stepSpy,
        } as any;
        uiState.replaySession = null;
        uiState.botByPlayerId.clear();
        uiState.render = vi.fn();

        attachListeners(() => '');

        (document.getElementById('mulligan-keep-btn') as HTMLButtonElement).click();

        expect(stepSpy).toHaveBeenCalledTimes(1);
        expect(stepSpy).toHaveBeenCalledWith({
            type: 'RESOLVE_MULLIGAN',
            actorPlayerId: 'P2',
            shouldMulligan: false,
        });
    });
});
