import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Phase } from '../../../src/logic/types';
import {
    clickConfirmTargets,
    clickOptional,
    createEngine,
    findAction,
    getCard,
    requireElement,
    setupUiDom,
    setupUiHarness,
} from '../helpers/ui_click_harness';

describe('SB01 representative UI click tests', () => {
    beforeEach(() => {
        vi.resetModules();
        setupUiDom();
    });

    it('[REP][SB01][SB01-007] destroy trigger path with optional+revealed+hand+zone clicks', async () => {
        const engine = createEngine(301007);
        const p1 = engine.currentPlayer;

        p1.unitZones[0].unit = getCard('SB01-007');
        p1.unitZones[2].unit = getCard('ST11-006');
        p1.hand = [getCard('ST01-002'), getCard('SB01-004')];
        p1.deck = [getCard('ST11-006')];
        engine.state.phase = Phase.MAIN;

        engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
        expect(engine.state.interactionMode).toBe('SELECT_OPTIONAL');

        await setupUiHarness(engine);

        clickOptional(true);
        const revealedCard = requireElement<HTMLElement>('.revealed-card-item[data-index="0"]');
        revealedCard.click();

        const maybeConfirm = document.getElementById('confirm-targets-btn') as HTMLButtonElement | null;
        if (maybeConfirm) {
            maybeConfirm.click();
        }

        const discardAction = findAction(
            engine,
            p1.id,
            'SELECT_HAND_TARGET',
            (action: any) => p1.hand[action.handIndex]?.id === 'ST01-002',
        ) as any;
        expect(discardAction).toBeDefined();
        const discardCard = requireElement<HTMLElement>(`.hand-zone .card-in-hand[data-index="${discardAction.handIndex}"]`);
        discardCard.click();

        const laneAction = findAction(
            engine,
            p1.id,
            'SELECT_ZONE_TARGET',
            (action: any) => action.targetPlayerId === p1.id && action.zoneIndex === 1,
        ) as any;
        expect(laneAction).toBeDefined();
        const lane = requireElement<HTMLElement>('.current .unit-zone[data-index="1"]');
        lane.click();

        expect(p1.trash.some(card => card.id === 'ST01-002')).toBe(true);
        expect(p1.unitZones[1].unit?.id).toBe('ST11-006');
        expect(engine.state.interactionMode).toBe('NORMAL');
    });

    it('[REP][SB01][SB01-020] destroy replacement optional confirm then hand cost click', async () => {
        const engine = createEngine(301020);
        const p1 = engine.currentPlayer;
        const p2 = engine.opponentPlayer;

        p1.unitZones[0].unit = getCard('SB01-020');
        p1.unitZones[0].buffs.push({
            id: 'sb01-020-power-buff',
            type: 'POWER',
            value: 1000,
            duration: 'PERMANENT',
        } as any);
        p1.hand = [getCard('ST01-002')];
        p2.unitZones[0].unit = getCard('ST10-005');
        engine.state.phase = Phase.MAIN;

        engine.destroyUnit(p1, p1.unitZones[0], p2.unitZones[0].unit!, 'EFFECT');
        expect(engine.state.interactionMode).toBe('SELECT_OPTIONAL');

        await setupUiHarness(engine);

        clickOptional(true);
        const payCost = findAction(engine, p1.id, 'SELECT_COST_HAND') as any;
        expect(payCost).toBeDefined();
        const costCard = requireElement<HTMLElement>(`.hand-zone .card-in-hand[data-index="${payCost.handIndex}"]`);
        costCard.click();

        expect(p1.unitZones[0].unit?.id).toBe('SB01-020');
        expect(p1.trash.some(card => card.id === 'SB01-020')).toBe(false);
        expect(engine.state.interactionMode).toBe('NORMAL');
    });

    it('[REP][SB01][SB01-025] play skill then hand target click enables confirm', async () => {
        const engine = createEngine(301025);
        const p1 = engine.currentPlayer;

        p1.leaderLevel = 10;
        p1.hand = [getCard('SB01-025'), getCard('ST10-017'), getCard('ST10-017')];
        p1.deck = [getCard('ST01-002'), getCard('ST01-002')];
        engine.state.phase = Phase.MAIN;

        const playSkill = findAction(engine, p1.id, 'PLAY_SKILL', (action: any) => p1.hand[action.handIndex]?.id === 'SB01-025');
        expect(playSkill).toBeDefined();
        expect(engine.step(playSkill as any)).toBe(true);

        await setupUiHarness(engine);

        const confirmButtonBefore = requireElement<HTMLButtonElement>('#confirm-targets-btn');
        expect(confirmButtonBefore.disabled).toBe(true);

        const pickItem = findAction(
            engine,
            p1.id,
            'SELECT_HAND_TARGET',
            (action: any) => p1.hand[action.handIndex]?.type === 'ITEM',
        ) as any;
        expect(pickItem).toBeDefined();

        const handCard = requireElement<HTMLElement>(`.hand-zone .card-in-hand[data-index="${pickItem.handIndex}"]`);
        handCard.click();

        const confirmButtonAfter = requireElement<HTMLButtonElement>('#confirm-targets-btn');
        expect(confirmButtonAfter.disabled).toBe(false);
        clickConfirmTargets();

        expect(engine.state.interactionMode).toBe('NORMAL');
    });
});
