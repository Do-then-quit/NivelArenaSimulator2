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

describe('ST05 representative UI click tests', () => {
    beforeEach(() => {
        vi.resetModules();
        setupUiDom();
    });

    it('[REP][ST05][ST05-013] play skill then click target lane to draw by item count', async () => {
        const engine = createEngine(105013);
        const p1 = engine.currentPlayer;

        p1.leaderLevel = 10;
        p1.hand = [getCard('ST05-013')];
        p1.deck = [getCard('ST05-004'), getCard('ST05-009'), getCard('ST01-002')];
        p1.unitZones[0].unit = getCard('ST05-002');
        p1.unitZones[0].items = [getCard('ST05-015'), getCard('ST05-017')];
        engine.state.phase = Phase.MAIN;

        const playSkill = findAction(engine, p1.id, 'PLAY_SKILL', (action: any) => p1.hand[action.handIndex]?.id.startsWith('ST05-013'));
        expect(playSkill).toBeDefined();
        expect(engine.step(playSkill as any)).toBe(true);

        await setupUiHarness(engine);

        const ownZone = requireElement<HTMLElement>('.current .unit-zone[data-index="0"]');
        ownZone.click();

        expect(p1.hand.length).toBe(2);
        expect(engine.state.interactionMode).toBe('NORMAL');
    });
});
