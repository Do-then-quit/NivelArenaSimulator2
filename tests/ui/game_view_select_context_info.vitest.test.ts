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
        imageUrl: `https://example.com/${id}.png`,
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

    const leader = createCard('leader', 'Leader');
    const sourceCard = createCard('src-1', 'Blaze Knight');

    const p1 = {
        id: 'P1',
        name: 'Player 1',
        deck: [],
        hand: [],
        trash: [],
        damage: [],
        levelZone: leader,
        leaderLevel: 1,
        unitZones: [createZone(), createZone(), createZone()],
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

    return {
        state: {
            players: [p1, p2],
            turnPlayerIndex: 0,
            phase: 'MAIN',
            turnCount: 1,
            winner: null,
            pendingAttackerIndex: null,
            pendingBlockerZoneIndex: null,
            interactionMode: 'SELECT_TARGET',
            interactionOwnerPlayerId: 'P1',
            pendingEffect: {
                sourceCard,
                sourcePlayerId: 'P1',
                controllerPlayerId: 'P1',
                actionType: 'DESTROY_UNIT',
                actionValue: {},
                effectDescription: '대상 유닛을 파괴한다.',
                sourceEffectDescription: '어태커 : 전투 중 상대 유닛 1장을 파괴한다.',
                sourceActivation: 'ATTACKER',
                validTargets: 'OPP_FIELD',
                targetSchema: {
                    scope: 'OPP_FIELD',
                    type: 'UNIT',
                    count: 1,
                    selectMode: 'MANUAL',
                },
                selectedTargets: [],
            },
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
        getLegalActions: () => [{ type: 'CONFIRM_TARGETS' }],
        getUnitPower: () => 0,
        getUnitHit: () => 0,
        isPendingCardTarget: () => false,
    } as any;
}

describe('game view select interaction context', () => {
    beforeEach(() => {
        vi.resetModules();
        document.body.innerHTML = '<div id="app"></div>';
        Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1920 });
        Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 1080 });
    });

    it('renders source/effect/reason context in select target banner', async () => {
        const { uiState, Screen } = await import('../../src/ui/appState');
        const { renderGame } = await import('../../src/ui/screens/gameView');

        uiState.currentScreen = Screen.GAME;
        uiState.game = createMockGame();
        uiState.gameLogView.manualOverride = true;
        uiState.gameLogView.expanded = true;
        uiState.gameLogView.autoCollapsed = false;

        renderGame();

        const text = document.body.textContent || '';
        expect(text).toContain('출처 카드');
        expect(text).toContain('Blaze Knight');
        expect(text).toContain('발동 이유');
        expect(text).toContain('어태커 트리거');
        expect(text).toContain('현재 선택');
        expect(text).toContain('상대 필드에서 1개 지정');
        expect(text).toContain('예정 효과');
        expect(text).toContain('어태커 : 전투 중 상대 유닛 1장을 파괴한다.');
        expect(document.querySelector('#confirm-targets-btn')).toBeTruthy();
    });
});
