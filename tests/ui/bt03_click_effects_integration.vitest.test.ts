import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DUMMY_CARDS } from '../../src/logic/CardDatabase';
import { GameEngine } from '../../src/logic/GameEngine';
import { Card, Phase, PlayerState } from '../../src/logic/types';

function getCard(id: string): Card {
    const card = DUMMY_CARDS.find((entry) => entry.id === id);
    if (!card) {
        throw new Error(`Card not found: ${id}`);
    }
    return JSON.parse(JSON.stringify(card));
}

function createEngine(seed: number = 20260303): GameEngine {
    const leader1 = getCard('ST01-001');
    const leader2 = getCard('ST01-001');
    const deck1 = Array.from({ length: 30 }, () => getCard('ST01-002'));
    const deck2 = Array.from({ length: 30 }, () => getCard('ST01-002'));
    return new GameEngine('P1', 'P2', deck1, deck2, leader1, leader2, {
        enableMulligan: false,
        seed,
    });
}

function zonePower(engine: GameEngine, player: PlayerState, zoneIndex: number): number {
    const zone = player.unitZones[zoneIndex];
    if (!zone?.unit) return 0;
    return engine.getUnitPower(zone, player);
}

function findAction(
    engine: GameEngine,
    actorPlayerId: string,
    type: string,
    predicate?: (action: any) => boolean,
) {
    return engine
        .getLegalActions(actorPlayerId)
        .find((action: any) => action.type === type && (!predicate || predicate(action)));
}

async function setupUiHarness(engine: GameEngine) {
    const { uiState, Screen } = await import('../../src/ui/appState');
    const { renderGame } = await import('../../src/ui/screens/gameView');

    uiState.currentScreen = Screen.GAME;
    uiState.game = engine;
    uiState.replaySession = null;
    uiState.verificationSession = null;
    uiState.onlineSession.room = null;
    uiState.onlineSession.role = null;
    uiState.onlineSession.localEnginePlayerId = null;
    uiState.botByPlayerId.clear();
    uiState.playback.enabled = false;
    uiState.playback.queueBusy = false;
    uiState.playback.modalGateUntilMs = 0;

    uiState.render = () => {
        renderGame();
    };

    renderGame();
    return { uiState, renderGame };
}

describe('BT03 click effects UI integration', () => {
    beforeEach(() => {
        vi.resetModules();
        document.body.innerHTML = '<div id="app"></div>';
        Object.defineProperty(window, 'innerWidth', {
            configurable: true,
            writable: true,
            value: 1920,
        });
        Object.defineProperty(window, 'innerHeight', {
            configurable: true,
            writable: true,
            value: 1080,
        });
    });

    it('[REP][BT03][BT03-001] awakened leader active applies -2000 via click target selection', async () => {
        const engine = createEngine(20260303);
        const p1 = engine.currentPlayer;
        const p2 = engine.opponentPlayer;

        p1.levelZone = getCard('BT03-001');
        p1.levelZone.isAwakened = true;
        p1.leaderLevel = 6;
        p1.skillZone = [getCard('ST10-015')];
        p2.unitZones[0].unit = getCard('ST01-011');
        engine.state.phase = Phase.MAIN;

        const before = zonePower(engine, p2, 0);
        await setupUiHarness(engine);

        const leaderActiveBtn = document.querySelector('.current .leader-active-btn') as HTMLButtonElement | null;
        expect(leaderActiveBtn).toBeTruthy();
        leaderActiveBtn!.click();

        const targetZone = document.querySelector('.opponent .unit-zone[data-index="0"]') as HTMLElement | null;
        expect(targetZone).toBeTruthy();
        targetZone!.click();

        const after = p2.unitZones[0].unit ? zonePower(engine, p2, 0) : 0;
        expect(p2.unitZones[0].unit === null || after === before - 2000).toBe(true);
        expect(engine.state.interactionMode).toBe('NORMAL');
    });

    it('[REP][BT03][BT03-003] attacker applies -2000 on encounter via attack button click', async () => {
        const engine = createEngine(20260304);
        const p1 = engine.currentPlayer;
        const p2 = engine.opponentPlayer;

        p1.unitZones[0].unit = getCard('BT03-003');
        p2.unitZones[0].unit = getCard('ST01-011');
        engine.state.phase = Phase.ATTACK;

        const before = zonePower(engine, p2, 0);
        await setupUiHarness(engine);

        const attackBtn = document.querySelector('.current .unit-zone[data-index="0"] .attack-btn') as HTMLButtonElement | null;
        expect(attackBtn).toBeTruthy();
        attackBtn!.click();

        const after = p2.unitZones[0].unit ? zonePower(engine, p2, 0) : 0;
        expect(p2.unitZones[0].unit === null || after === before - 2000).toBe(true);
    });

    it('[REP][BT03][BT03-013] hand-diff debuff resolves by UI target click after PLAY_SKILL pre-step', async () => {
        const engine = createEngine(20260305);
        const p1 = engine.currentPlayer;
        const p2 = engine.opponentPlayer;

        p1.hand = [getCard('BT03-013')];
        p2.hand = [getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002')];
        p2.unitZones[0].unit = getCard('ST01-011');
        p1.leaderLevel = 10;
        p2.leaderLevel = 10;
        engine.state.phase = Phase.MAIN;

        const playSkillAction = engine
            .getLegalActions(p1.id)
            .find((action) => action.type === 'PLAY_SKILL' && action.handIndex === 0);
        expect(playSkillAction).toBeTruthy();
        expect(engine.step(playSkillAction!)).toBe(true);

        const before = zonePower(engine, p2, 0);
        const { renderGame } = await setupUiHarness(engine);
        renderGame();

        const targetZone = document.querySelector('.opponent .unit-zone[data-index="0"]') as HTMLElement | null;
        expect(targetZone).toBeTruthy();
        targetZone!.click();

        const after = p2.unitZones[0].unit ? zonePower(engine, p2, 0) : 0;
        expect(p2.unitZones[0].unit === null || after === before - 3000).toBe(true);
        expect(engine.state.interactionMode).toBe('NORMAL');
    });

    it('[REP][BT03][BT03-006] PLAY_UNIT pre-step then optional confirm + skill-zone prompt click', async () => {
        const engine = createEngine(20260306);
        const p1 = engine.currentPlayer;

        p1.leaderLevel = 10;
        p1.hand = [getCard('BT03-006')];
        p1.skillZone = [getCard('ST10-015')];
        p1.deck = [getCard('ST01-002')];
        engine.state.phase = Phase.MAIN;

        const playUnitAction = findAction(
            engine,
            p1.id,
            'PLAY_UNIT',
            (action: any) => p1.hand[action.handIndex]?.id.startsWith('BT03-006') && action.zoneIndex === 0,
        );
        expect(playUnitAction).toBeDefined();
        expect(engine.step(playUnitAction as any)).toBe(true);
        expect(engine.state.interactionMode).toBe('SELECT_OPTIONAL');

        await setupUiHarness(engine);

        const optionalConfirm = document.getElementById('opt-confirm') as HTMLButtonElement | null;
        expect(optionalConfirm).toBeTruthy();
        optionalConfirm!.click();

        const skillCard = document.querySelector('.current .skill-card-item[data-index="0"]') as HTMLElement | null;
        expect(skillCard).toBeTruthy();
        skillCard!.click();

        expect(p1.skillZone.length).toBe(0);
        expect(p1.trash.some(card => card.id.startsWith('ST10-015'))).toBe(true);
        expect(p1.hand.some(card => card.id.startsWith('ST01-002'))).toBe(true);
        expect(engine.state.interactionMode).toBe('NORMAL');
    });

    it('[REP][BT03][BT03-011] unit active then optional confirm + two revealed selections', async () => {
        const engine = createEngine(20260307);
        const p1 = engine.currentPlayer;

        p1.unitZones[0].unit = getCard('BT03-011');
        p1.skillZone = [getCard('ST10-016')];
        p1.trash = [getCard('ST01-002')];
        engine.state.phase = Phase.MAIN;

        await setupUiHarness(engine);

        const activeBtn = document.querySelector('.current .unit-zone[data-index="0"] .active-btn') as HTMLButtonElement | null;
        expect(activeBtn).toBeTruthy();
        activeBtn!.click();

        const optionalConfirm = document.getElementById('opt-confirm') as HTMLButtonElement | null;
        expect(optionalConfirm).toBeTruthy();
        optionalConfirm!.click();

        const skillCard = document.querySelector('.current .skill-card-item[data-index="0"]') as HTMLElement | null;
        expect(skillCard).toBeTruthy();
        skillCard!.click();

        const recoveredCard = document.querySelector('.revealed-card-item[data-index="0"]') as HTMLElement | null;
        expect(recoveredCard).toBeTruthy();
        recoveredCard!.click();

        expect(p1.hand.some(card => card.id.startsWith('ST01-002'))).toBe(true);
        expect(engine.state.interactionMode).toBe('NORMAL');
    });

    it('[REP][BT03][BT03-015] PLAY_SKILL pre-step then optional confirm + target + hand cost click', async () => {
        const engine = createEngine(20260308);
        const p1 = engine.currentPlayer;
        const p2 = engine.opponentPlayer;

        p1.leaderLevel = 10;
        p1.hand = [getCard('BT03-015'), getCard('ST01-011')];
        p2.unitZones[0].unit = getCard('ST01-011');
        engine.state.phase = Phase.MAIN;

        const playSkillAction = findAction(
            engine,
            p1.id,
            'PLAY_SKILL',
            (action: any) => p1.hand[action.handIndex]?.id.startsWith('BT03-015'),
        );
        expect(playSkillAction).toBeDefined();
        expect(engine.step(playSkillAction as any)).toBe(true);

        const before = zonePower(engine, p2, 0);
        await setupUiHarness(engine);

        const optionalConfirm = document.getElementById('opt-confirm') as HTMLButtonElement | null;
        expect(optionalConfirm).toBeTruthy();
        optionalConfirm!.click();

        const targetZone = document.querySelector('.opponent .unit-zone[data-index="0"]') as HTMLElement | null;
        expect(targetZone).toBeTruthy();
        targetZone!.click();

        const payCost = findAction(
            engine,
            p1.id,
            'SELECT_COST_HAND',
            (action: any) => p1.hand[action.handIndex]?.id.startsWith('ST01-011'),
        ) as any;
        expect(payCost).toBeDefined();
        const costCard = document.querySelector(`.hand-zone .card-in-hand[data-index="${payCost.handIndex}"]`) as HTMLElement | null;
        expect(costCard).toBeTruthy();
        costCard!.click();

        const discardedUnit = p1.trash.find(card => card.id.startsWith('ST01-011'));
        const expectedDebuff = discardedUnit?.power || 0;
        const after = p2.unitZones[0].unit ? zonePower(engine, p2, 0) : 0;
        expect(p2.unitZones[0].unit === null || after === before - expectedDebuff).toBe(true);
        expect(engine.state.interactionMode).toBe('NORMAL');
    });
});
