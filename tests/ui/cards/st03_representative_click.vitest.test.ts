import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Phase } from '../../../src/logic/types';
import {
    createEngine,
    findAction,
    getCard,
    requireElement,
    setupUiDom,
    setupUiHarness,
} from '../helpers/ui_click_harness';

describe('ST03 representative UI click tests', () => {
    beforeEach(() => {
        vi.resetModules();
        setupUiDom();
    });

    it('[REP][ST03][ST03-012] play skill then click own/opponent hand targets', async () => {
        const engine = createEngine(103012);
        const p1 = engine.currentPlayer;
        const p2 = engine.opponentPlayer;

        p1.leaderLevel = 10;
        p1.hand = [getCard('ST03-012'), getCard('ST03-002')];
        p2.hand = [getCard('ST03-002'), getCard('ST03-002')];
        engine.state.phase = Phase.MAIN;

        const playSkill = findAction(engine, p1.id, 'PLAY_SKILL', (action: any) => p1.hand[action.handIndex]?.id.startsWith('ST03-012'));
        expect(playSkill).toBeDefined();
        expect(engine.step(playSkill as any)).toBe(true);

        const p2HandBefore = p2.hand.length;
        await setupUiHarness(engine);

        const ownDiscardAction = findAction(engine, p1.id, 'SELECT_HAND_TARGET', (action: any) => p1.hand[action.handIndex]?.id.startsWith('ST03-002')) as any;
        expect(ownDiscardAction).toBeDefined();
        const ownHandCard = requireElement<HTMLElement>(`.hand-zone .card-in-hand[data-index="${ownDiscardAction.handIndex}"]`);
        ownHandCard.click();

        expect(engine.state.interactionOwnerPlayerId).toBe(p2.id);

        const oppDiscardAction = findAction(
            engine,
            p2.id,
            'SELECT_HAND_TARGET',
            (action: any) => action.targetPlayerId === p2.id && p2.hand[action.handIndex]?.id.startsWith('ST03-002'),
        ) as any;
        expect(oppDiscardAction).toBeDefined();
        const oppHandCard = requireElement<HTMLElement>(`.opponent-hand-zone .card-in-hand[data-index="${oppDiscardAction.handIndex}"]`);
        oppHandCard.click();

        expect(p2.hand.length).toBe(p2HandBefore - 1);
        expect(engine.state.interactionMode).toBe('NORMAL');
    });
});
