import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    clickOptional,
    createEngine,
    findAction,
    getCard,
    requireElement,
    setupUiDom,
    setupUiHarness,
} from '../helpers/ui_click_harness';
import { Phase } from '../../../src/logic/types';

describe('ST08 representative UI click tests', () => {
    beforeEach(() => {
        vi.resetModules();
        setupUiDom();
    });

    it('[REP][ST08][ST08-002-Exit] exit hand-target click discards chosen card', async () => {
        const engine = createEngine(118002);
        const p1 = engine.currentPlayer;

        p1.unitZones[0].unit = getCard('ST08-002');
        p1.hand = [getCard('ST01-002'), getCard('ST01-011')];

        const { renderGame } = await setupUiHarness(engine);

        engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
        renderGame();

        const pick = findAction(engine, p1.id, 'SELECT_HAND_TARGET', (action: any) => p1.hand[action.handIndex]?.id === 'ST01-011') as any;
        expect(pick).toBeDefined();

        const handCard = requireElement<HTMLElement>(`.hand-zone .card-in-hand[data-index="${pick.handIndex}"]`);
        handCard.click();

        expect(p1.trash.some(card => card.id === 'ST01-011')).toBe(true);
        expect(engine.state.interactionMode).toBe('NORMAL');
    });

    it('[REP][ST08][ST08-009] skill reveal deploy then click empty lane', async () => {
        const engine = createEngine(118009);
        const p1 = engine.currentPlayer;

        p1.leaderLevel = 10;
        p1.hand = [getCard('ST08-009')];
        p1.deck = [getCard('ST01-002')];
        engine.state.phase = Phase.MAIN;

        const { renderGame } = await setupUiHarness(engine);

        engine.playSkill(0);
        renderGame();

        const pickZone = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) => action.targetPlayerId === p1.id && action.zoneIndex === 0) as any;
        expect(pickZone).toBeDefined();
        expect(document.querySelector('.selection-modal-overlay')).toBeNull();

        const ownZone = requireElement<HTMLElement>(`.current .unit-zone[data-index="${pickZone.zoneIndex}"]`);
        ownZone.click();

        expect(p1.unitZones[0].unit?.id).toBe('ST01-002');
        expect(engine.state.interactionMode).toBe('NORMAL');
    });

    it('[REP][ST08][ST08-001-AwakenDraw] opponent optional confirm click draws 1', async () => {
        const engine = createEngine(118101);
        const p1 = engine.currentPlayer;
        const p2 = engine.state.players[1];

        p1.levelZone = getCard('ST08-001');
        p1.leaderLevel = 7;
        p1.skillZone = [getCard('ST08-015')];
        p2.deck = [getCard('ST01-002')];

        const { renderGame } = await setupUiHarness(engine);

        engine.checkAwakening(0);
        renderGame();

        clickOptional(true);

        expect(p1.levelZone?.isAwakened).toBe(true);
        expect(p2.hand.some(card => card.id === 'ST01-002')).toBe(true);
        expect(engine.state.interactionMode).toBe('NORMAL');
    });

    it('[REP][ST08][ST08-004] unit active then click hand card and empty lane', async () => {
        const engine = createEngine(118104);
        const p1 = engine.currentPlayer;

        p1.leaderLevel = 4;
        p1.unitZones[0].unit = getCard('ST08-004');
        p1.hand = [getCard('ST01-002')];
        engine.state.phase = Phase.MAIN;

        await setupUiHarness(engine);

        const activeBtn = requireElement<HTMLButtonElement>('.current .unit-zone[data-index="0"] .active-btn');
        activeBtn.click();

        const pickHand = findAction(engine, p1.id, 'SELECT_HAND_TARGET', (action: any) => p1.hand[action.handIndex]?.id === 'ST01-002') as any;
        expect(pickHand).toBeDefined();
        requireElement<HTMLElement>(`.hand-zone .card-in-hand[data-index="${pickHand.handIndex}"]`).click();

        requireElement<HTMLElement>('.current .unit-zone[data-index="1"]').click();

        expect(p1.unitZones[1].unit?.id).toBe('ST01-002');
        expect(engine.state.interactionMode).toBe('NORMAL');
    });

    it('[REP][ST08][ST08-006] escape reveal card click then empty lane click', async () => {
        const engine = createEngine(118206);
        const p1 = engine.currentPlayer;

        p1.unitZones[0].unit = getCard('ST08-006');
        p1.leaderLevel = 8;
        p1.deck = [getCard('ST08-015'), getCard('ST08-008'), getCard('ST01-002')];
        engine.state.phase = Phase.DRAW;

        const { renderGame } = await setupUiHarness(engine);

        engine.nextPhase();
        renderGame();

        const unitPick = findAction(engine, p1.id, 'SELECT_REVEALED_TARGET', (action: any) =>
            engine.state.revealedCards[action.revealedIndex]?.id === 'ST01-002'
        ) as any;
        expect(unitPick).toBeDefined();
        requireElement<HTMLElement>(`.revealed-card-item[data-index="${unitPick.revealedIndex}"]`).click();
        expect(document.querySelector('.selection-modal-overlay')).toBeNull();

        requireElement<HTMLElement>('.current .unit-zone[data-index="0"]').click();

        expect(p1.unitZones[0].unit?.id).toBe('ST01-002');
        expect(engine.state.interactionMode).toBe('NORMAL');
    });
});
