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

describe('ST11 representative UI click tests', () => {
    beforeEach(() => {
        vi.resetModules();
        setupUiDom();
    });

    it('[REP][ST11][ST11-001] leader active then click trash target', async () => {
        const engine = createEngine(111001);
        const p1 = engine.currentPlayer;

        p1.levelZone = getCard('ST11-001');
        p1.levelZone.isAwakened = true;
        p1.leaderLevel = 5;
        p1.skillZone = [getCard('ST11-013'), getCard('ST11-014')];
        p1.trash = [getCard('ST11-013'), getCard('ST11-014')];
        engine.state.phase = Phase.MAIN;

        await setupUiHarness(engine);

        const leaderActiveBtn = requireElement<HTMLButtonElement>('.current .leader-active-btn');
        leaderActiveBtn.click();

        const lowCostPick = findAction(engine, p1.id, 'SELECT_TRASH_TARGET', (action: any) => p1.trash[action.trashIndex]?.id.startsWith('ST11-013')) as any;
        const highCostPick = findAction(engine, p1.id, 'SELECT_TRASH_TARGET', (action: any) => p1.trash[action.trashIndex]?.id.startsWith('ST11-014')) as any;
        expect(lowCostPick).toBeDefined();
        expect(highCostPick).toBeUndefined();

        const target = requireElement<HTMLElement>(`.trash-card-item[data-index="${lowCostPick.trashIndex}"]`);
        target.click();

        expect(p1.hand.some(card => card.id.startsWith('ST11-013'))).toBe(true);
        expect(engine.state.interactionMode).toBe('NORMAL');
    });
});
