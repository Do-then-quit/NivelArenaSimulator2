import { expect, test } from '@playwright/test';

type StageMode = 'main' | 'block' | 'revealed';

async function stageMockGame(page: any, mode: StageMode) {
    await page.evaluate((selectedMode) => {
        const testApi = (window as any).__NA_TEST__;
        if (!testApi) throw new Error('__NA_TEST__ hook missing');

        const { uiState, Screen, render } = testApi;
        const makeZone = (unit = null, items: any[] = []) => ({
            unit,
            items,
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
            imageUrl: '',
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
            imageUrl: '',
        };
        const revealedCard = {
            id: 'RV1',
            name: 'Revealed Unit',
            type: 'UNIT',
            attribute: 'FIRE',
            cost: 1,
            power: 1000,
            hit: 1000,
            text: '',
            imageUrl: '',
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
            unitZones: [makeZone(attacker), makeZone(), makeZone()],
            skillZone: [],
        };
        const p2 = {
            id: 'P2',
            name: 'Player 2',
            deck: [],
            hand: [],
            trash: [],
            damage: [revealedCard],
            levelZone: leader,
            leaderLevel: 1,
            unitZones: [makeZone(), makeZone(), makeZone()],
            skillZone: [],
        };

        const legalActions = selectedMode === 'main'
            ? [
                { type: 'ATTACK', actorPlayerId: 'P1', attackerZoneIndex: 0 },
                { type: 'ACTIVATE_EFFECT', actorPlayerId: 'P1', zoneIndex: 0, effectIndex: 0, sourceType: 'UNIT' },
                { type: 'ACTIVATE_EFFECT', actorPlayerId: 'P1', zoneIndex: 0, effectIndex: 0, sourceType: 'LEADER' },
                { type: 'NEXT_PHASE', actorPlayerId: 'P1' },
            ]
            : selectedMode === 'block'
                ? [
                    { type: 'RESOLVE_BLOCK', actorPlayerId: 'P1', shouldBlock: true, blockerZoneIndex: 0 },
                    { type: 'RESOLVE_BLOCK', actorPlayerId: 'P1', shouldBlock: false },
                ]
                : [
                    { type: 'SELECT_REVEALED_TARGET', actorPlayerId: 'P1', revealedIndex: 0 },
                    { type: 'CONFIRM_TARGETS', actorPlayerId: 'P1' },
                ];

        uiState.currentScreen = Screen.GAME;
        uiState.activeMatchConfig = { label: 'HUMAN vs HUMAN', player1Control: 'HUMAN', player2Control: 'HUMAN' };
        uiState.activeMatchViewConfig = { revealBotHand: true };
        uiState.botByPlayerId.clear();
        uiState.botLabelByPlayerId.clear();
        uiState.replaySession = null;
        uiState.verificationSession = null;
        uiState.onlineSession.room = null;
        uiState.onlineSession.role = null;
        uiState.onlineSession.localEnginePlayerId = null;
        uiState.playback.enabled = true;
        uiState.playback.animationEnabled = true;
        uiState.playback.speed = 'NORMAL';
        uiState.playback.queueBusy = selectedMode === 'revealed';
        uiState.playback.modalGateUntilMs = selectedMode === 'revealed' ? Date.now() + 1000 : 0;
        uiState.playback.pendingAutoPhaseActorId = selectedMode === 'main' ? 'P1' : null;
        uiState.playback.toasts = [];
        uiState.playback.logEntries = [];
        uiState.playback.activePulseTargets = [];
        uiState.gameLogView.manualOverride = true;
        uiState.gameLogView.expanded = true;
        uiState.gameLogView.autoCollapsed = false;
        uiState.game = {
            state: {
                players: [p1, p2],
                turnPlayerIndex: 0,
                phase: selectedMode === 'block' ? 'BLOCK' : 'MAIN',
                turnCount: 1,
                winner: null,
                pendingAttackerIndex: selectedMode === 'block' ? 0 : null,
                pendingBlockerZoneIndex: null,
                interactionMode: selectedMode === 'revealed' ? 'SELECT_TARGET' : 'NORMAL',
                interactionOwnerPlayerId: 'P1',
                pendingEffect: selectedMode === 'revealed'
                    ? {
                        sourceCard: leader,
                        sourcePlayerId: 'P1',
                        actionType: 'TAKE_ALL_REVEALED',
                        actionValue: {},
                        validTargets: 'REVEALED',
                        selectedTargets: [],
                        targetSchema: {
                            scope: 'REVEALED',
                            type: 'CARD',
                            count: 1,
                            selectMode: 'MANUAL',
                        },
                    }
                    : null,
                mulliganState: null,
                mulliganResultByPlayerId: {},
                revealedCards: selectedMode === 'revealed' ? [revealedCard] : [],
                effectQueue: [],
                deferredEffectQueue: [],
                damageProcessingDepth: 0,
                globalStep: 0,
                combatStep: selectedMode === 'block' ? 'DEFENSE_DECLARATION' : 'NONE',
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
        };

        render();
    }, mode);
}

test.describe('action fx smoke', () => {
    test('renders attack action fx and phase status anchors on desktop', async ({ page }) => {
        const consoleErrors: string[] = [];
        page.on('console', (msg) => {
            if (msg.type() === 'error') consoleErrors.push(msg.text());
        });

        await page.goto('/');
        await stageMockGame(page, 'main');

        await expect(page.getByTestId('phase-status')).toBeVisible();
        await expect(page.getByTestId('next-phase-btn')).toBeVisible();
        await expect(page.getByTestId('attack-btn-P1-0')).toBeVisible();
        await expect(page.getByTestId('active-btn-P1-0')).toBeVisible();

        await page.evaluate(() => {
            (window as any).__NA_TEST__.enqueuePlaybackBeats([{
                id: 'attack-beat',
                eventType: 'ACTION_FX',
                durationMs: 320,
                modalGateMs: 0,
                toastMessage: 'Player 1 attack',
                pulseTargets: [],
                actionFx: {
                    id: 'attack-fx',
                    kind: 'ATTACK',
                    label: 'ATTACK',
                    sourceAnchorKeys: ['action:button:attack:P1:0', 'action:unit-zone:P1:0'],
                    targetAnchorKeys: ['action:unit-zone:P2:0'],
                    emphasisAnchorKeys: ['action:unit-zone:P1:0'],
                    sourceRect: null,
                    targetRect: null,
                },
            }]);
        });

        await expect(page.locator('.fx-action-shell.is-attack')).toBeVisible();
        await expect(page.locator('.fx-action-badge')).toContainText('ATTACK');
        expect(consoleErrors).toEqual([]);
    });

    test('shows next phase hold state on the phase rail', async ({ page }) => {
        const consoleErrors: string[] = [];
        page.on('console', (msg) => {
            if (msg.type() === 'error') consoleErrors.push(msg.text());
        });

        await page.goto('/');
        await stageMockGame(page, 'main');

        await expect(page.getByTestId('phase-rail')).toBeVisible();

        await page.evaluate(() => {
            (window as any).__NA_TEST__.enqueuePlaybackBeats([{
                id: 'phase-beat',
                eventType: 'ACTION_FX',
                durationMs: 760,
                modalGateMs: 0,
                toastMessage: 'Player 1 draw phase',
                pulseTargets: [],
                actionFx: {
                    id: 'phase-fx',
                    kind: 'NEXT_PHASE',
                    label: 'DRAW',
                    sourceAnchorKeys: ['action:phase-step:MAIN', 'action:status:phase'],
                    targetAnchorKeys: ['action:phase-step:DRAW', 'action:status:phase'],
                    emphasisAnchorKeys: ['action:phase-step:MAIN', 'action:phase-step:DRAW', 'action:status:phase'],
                    phaseFrom: 'MAIN',
                    phaseTo: 'DRAW',
                    sourceRect: null,
                    targetRect: null,
                },
            }]);
        });

        await expect(page.getByTestId('phase-step-main')).toHaveClass(/action-presentation-source/);
        await expect(page.getByTestId('phase-step-draw')).toHaveClass(/action-presentation-target/);
        await expect(page.getByTestId('phase-status')).toHaveClass(/action-presentation-kind-next-phase/);
        expect(consoleErrors).toEqual([]);
    });

    test('renders block action anchors and damage reveal motion', async ({ page }) => {
        const consoleErrors: string[] = [];
        page.on('console', (msg) => {
            if (msg.type() === 'error') consoleErrors.push(msg.text());
        });

        await page.goto('/');
        await stageMockGame(page, 'block');

        await expect(page.getByTestId('block-btn-P1-0')).toBeVisible();
        await expect(page.getByTestId('pass-btn-P1-0')).toBeVisible();

        await page.evaluate(() => {
            const card = (window as any).__NA_TEST__.uiState.game.state.players[1].damage[0];
            (window as any).__NA_TEST__.enqueuePlaybackBeats([
                {
                    id: 'block-beat',
                    eventType: 'ACTION_FX',
                    durationMs: 320,
                    modalGateMs: 0,
                    toastMessage: 'Player 1 block',
                    pulseTargets: [],
                    actionFx: {
                        id: 'block-fx',
                        kind: 'BLOCK',
                        label: 'BLOCK',
                        sourceAnchorKeys: ['action:button:block:P1:0', 'action:unit-zone:P1:0'],
                        targetAnchorKeys: ['action:unit-zone:P2:0'],
                        emphasisAnchorKeys: ['action:unit-zone:P1:0'],
                        sourceRect: null,
                        targetRect: null,
                    },
                },
                {
                    id: 'damage-reveal',
                    eventType: 'CARD_MOTION',
                    durationMs: 320,
                    modalGateMs: 0,
                    toastMessage: 'Damage reveal',
                    pulseTargets: [{ playerId: 'P2', zone: 'DAMAGE' }],
                    motion: {
                        id: 'damage-motion',
                        motionType: 'DAMAGE_REVEAL',
                        motionKey: 'damage-motion-key',
                        card,
                        source: { playerId: 'P2', zone: 'DECK', slotIndex: 0, motionKey: 'damage-motion-key' },
                        target: { playerId: 'P2', zone: 'DAMAGE', slotIndex: 0, motionKey: (document.querySelector('.damage-card-item') as HTMLElement)?.dataset.cardMotionKey || 'damage-motion-key' },
                        sourceFace: 'BACK',
                        flipToFront: true,
                        sourceRect: null,
                        sourceAnchorKeys: ['zone:P2:DECK'],
                        targetAnchorKeys: [(document.querySelector('.damage-card-item') as HTMLElement)?.dataset.motionAnchorKey || 'zone:P2:DAMAGE'],
                    },
                },
            ]);
        });

        await expect(page.locator('.fx-action-shell.is-block')).toBeVisible();
        await expect(page.locator('.fx-motion-card-shell')).toBeVisible();
        await expect(page.locator('.opponent .damage-card-item.motion-target-suppressed')).toHaveCount(1);
        await expect(page.locator('.opponent .damage-count')).toContainText('0');
        expect(consoleErrors).toEqual([]);
    });

    test('renders pass action fx with lane handoff emphasis', async ({ page }) => {
        const consoleErrors: string[] = [];
        page.on('console', (msg) => {
            if (msg.type() === 'error') consoleErrors.push(msg.text());
        });

        await page.goto('/');
        await stageMockGame(page, 'block');

        await page.evaluate(() => {
            (window as any).__NA_TEST__.enqueuePlaybackBeats([{
                id: 'pass-beat',
                eventType: 'ACTION_FX',
                durationMs: 320,
                modalGateMs: 0,
                toastMessage: 'Player 1 pass',
                pulseTargets: [],
                actionFx: {
                    id: 'pass-fx',
                    kind: 'PASS',
                    label: 'PASS',
                    sourceAnchorKeys: ['action:button:pass:P1:0', 'action:player-area:P1'],
                    targetAnchorKeys: ['action:unit-zone:P2:0'],
                    emphasisAnchorKeys: ['action:player-area:P1', 'action:unit-zone:P2:0'],
                    sourceRect: null,
                    targetRect: null,
                },
            }]);
        });

        await expect(page.locator('.fx-action-shell.is-pass')).toBeVisible();
        await expect(page.locator('.fx-action-impact.is-pass')).toBeVisible();
        await expect(page.locator('.fx-action-arrowhead')).toBeVisible();
        await expect(page.locator('.fx-action-badge')).toContainText('PASS');
        expect(consoleErrors).toEqual([]);
    });

    test('shows revealed modal in preparing state and keeps mobile portrait fit', async ({ page }) => {
        const consoleErrors: string[] = [];
        page.on('console', (msg) => {
            if (msg.type() === 'error') consoleErrors.push(msg.text());
        });

        await page.goto('/');
        await stageMockGame(page, 'revealed');

        await expect(page.getByTestId('revealed-selection-modal')).toHaveClass(/is-preparing/);
        await expect(page.getByTestId('revealed-selection-tray')).toBeVisible();

        await page.setViewportSize({ width: 390, height: 844 });
        await stageMockGame(page, 'main');

        await expect(page.getByTestId('next-phase-btn-mobile')).toBeVisible();
        const viewportMetrics = await page.evaluate(() => ({
            width: window.innerWidth,
            height: window.innerHeight,
            scrollWidth: document.documentElement.scrollWidth,
        }));
        expect(viewportMetrics.scrollWidth).toBeLessThanOrEqual(viewportMetrics.width + 1);
        expect(consoleErrors).toEqual([]);
    });
});
