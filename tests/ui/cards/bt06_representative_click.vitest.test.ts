import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Phase } from '../../../src/logic/types';
import {
    clickConfirmTargets,
    createEngine,
    findAction,
    getCard,
    requireElement,
    setupUiDom,
    setupUiHarness,
    zonePower,
} from '../helpers/ui_click_harness';

describe('BT06 representative UI click tests', () => {
    beforeEach(() => {
        vi.resetModules();
        setupUiDom();
    });

    it('[REP][BT06][BT06-027] play skill then click revealed target', async () => {
        const engine = createEngine(206027);
        const p1 = engine.currentPlayer;

        p1.leaderLevel = 10;
        p1.hand = [getCard('BT06-027')];
        p1.deck = [getCard('ST10-015'), getCard('ST01-002')];
        engine.state.phase = Phase.MAIN;

        const playSkill = findAction(engine, p1.id, 'PLAY_SKILL', (action: any) => p1.hand[action.handIndex]?.id.startsWith('BT06-027'));
        expect(playSkill).toBeDefined();
        expect(engine.step(playSkill as any)).toBe(true);

        const unitPick = findAction(
            engine,
            p1.id,
            'SELECT_REVEALED_TARGET',
            (action: any) => engine.state.revealedCards[action.revealedIndex]?.id.startsWith('ST01-002'),
        ) as any;
        expect(unitPick).toBeDefined();

        await setupUiHarness(engine);

        const revealed = requireElement<HTMLElement>(`.revealed-card-item[data-index="${unitPick.revealedIndex}"]`);
        revealed.click();

        expect(p1.hand.some(card => card.id.startsWith('ST01-002'))).toBe(true);
        expect(p1.trash.some(card => card.id.startsWith('ST10-015'))).toBe(true);
        expect(engine.state.interactionMode).toBe('NORMAL');
    });

    it('[REP][BT06][BT06-029] play skill then click hand target and confirm', async () => {
        const engine = createEngine(206029);
        const p1 = engine.currentPlayer;

        p1.leaderLevel = 10;
        p1.hand = [getCard('BT06-029'), getCard('ST10-015'), getCard('ST01-002'), getCard('ST01-002')];
        p1.deck = [getCard('ST01-002'), getCard('ST01-002')];
        engine.state.phase = Phase.MAIN;

        const playSkill = findAction(engine, p1.id, 'PLAY_SKILL', (action: any) => p1.hand[action.handIndex]?.id.startsWith('BT06-029'));
        expect(playSkill).toBeDefined();
        expect(engine.step(playSkill as any)).toBe(true);

        const keepAction = findAction(
            engine,
            p1.id,
            'SELECT_HAND_TARGET',
            (action: any) => p1.hand[action.handIndex]?.id.startsWith('ST10-015'),
        ) as any;
        expect(keepAction).toBeDefined();

        await setupUiHarness(engine);

        const keepCard = requireElement<HTMLElement>(`.hand-zone .card-in-hand[data-index="${keepAction.handIndex}"]`);
        keepCard.click();
        clickConfirmTargets();

        expect(p1.hand.length).toBe(3);
        expect(p1.hand.some(card => card.id.startsWith('ST10-015'))).toBe(true);
        expect(p1.trash.length).toBeGreaterThanOrEqual(2);
        expect(engine.state.interactionMode).toBe('NORMAL');
    });

    it('[REP][BT06][BT06-038] play skill then click opponent zone target and confirm', async () => {
        const engine = createEngine(206038);
        const p1 = engine.currentPlayer;
        const p2 = engine.opponentPlayer;

        p1.leaderLevel = 10;
        p1.hand = [getCard('BT06-038')];
        p2.unitZones[0].unit = getCard('ST01-011');
        p2.unitZones[1].unit = getCard('ST01-011');
        engine.state.phase = Phase.MAIN;

        const playSkill = findAction(engine, p1.id, 'PLAY_SKILL', (action: any) => p1.hand[action.handIndex]?.id.startsWith('BT06-038'));
        expect(playSkill).toBeDefined();
        expect(engine.step(playSkill as any)).toBe(true);

        const before0 = zonePower(engine, p2, 0);
        const before1 = zonePower(engine, p2, 1);

        await setupUiHarness(engine);

        const oppZone0 = requireElement<HTMLElement>('.opponent .unit-zone[data-index="0"]');
        oppZone0.click();
        clickConfirmTargets();

        const after0 = zonePower(engine, p2, 0);
        const after1 = zonePower(engine, p2, 1);
        expect(after0).toBe(before0 - 3000);
        expect(after1).toBe(before1);
        expect(engine.state.interactionMode).toBe('NORMAL');
    });
});
