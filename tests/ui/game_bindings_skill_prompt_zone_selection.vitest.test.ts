import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/ui/gameLoop', () => ({
    canLocalHumanInput: vi.fn(() => true),
    getActionOwnerPlayerId: vi.fn((engine: any) => engine.state.interactionOwnerPlayerId ?? engine.currentPlayer.id),
}));

function createCard(id: string, name: string) {
    return {
        id,
        name,
        type: 'SKILL',
        attribute: 'FIRE',
        cost: 1,
        power: 0,
        hit: 0,
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

describe('game bindings skill prompt zone selection', () => {
    beforeEach(() => {
        vi.resetModules();
        document.body.innerHTML = `
            <div id="app"></div>
            <div class="skill-card-item" data-player="current" data-index="0"></div>
            <div class="skill-card-item" data-player="current" data-index="1"></div>
        `;
    });

    it('dispatches SELECT_REVEALED_TARGET when prompt-mapped skill card is clicked', async () => {
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
            skillZone: [createCard('skill-0', 'Skill 0'), createCard('skill-1', 'Skill 1')],
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
                    actionType: 'BT06_SELECT_SKILL_ZONE_CARD',
                    validTargets: 'REVEALED',
                    actionValue: {
                        options: [
                            { skillZoneIndex: 1 },
                            { skillZoneIndex: 0 },
                        ],
                    },
                    selectedTargets: [],
                },
                players: [p1, p2],
                revealedCards: [createCard('rv-0', 'Prompt Option 0'), createCard('rv-1', 'Prompt Option 1')],
            },
            currentPlayer: p1,
            opponentPlayer: p2,
            getLegalActions: () => [
                { type: 'SELECT_REVEALED_TARGET', actorPlayerId: 'P1', revealedIndex: 0 },
                { type: 'SELECT_REVEALED_TARGET', actorPlayerId: 'P1', revealedIndex: 1 },
            ],
        } as any;
        uiState.replaySession = null;
        uiState.onlineSession.room = null;
        uiState.onlineSession.localEnginePlayerId = null;
        uiState.render = vi.fn();

        attachListeners(() => '<div class="card"></div>');

        const skillCard = document.querySelector('.skill-card-item[data-player="current"][data-index="1"]') as HTMLElement;
        skillCard.click();

        expect(dispatchSpy).toHaveBeenCalledWith({
            type: 'SELECT_REVEALED_TARGET',
            actorPlayerId: 'P1',
            revealedIndex: 0,
        });
        dispatchSpy.mockRestore();
    });
});
