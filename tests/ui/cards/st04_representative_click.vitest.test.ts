import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Phase } from '../../../src/logic/types';
import {
    createEngine,
    findAction,
    getCard,
    requireElement,
    setupUiDom,
    setupUiHarness,
    zonePower,
} from '../helpers/ui_click_harness';

describe('ST04 representative UI click tests', () => {
    beforeEach(() => {
        vi.resetModules();
        setupUiDom();
    });

    it('[REP][ST04][ST04-012] play skill then click guardian target lane', async () => {
        const engine = createEngine(104012);
        const p1 = engine.currentPlayer;

        p1.leaderLevel = 10;
        p1.hand = [getCard('ST04-012')];
        p1.unitZones[0].unit = getCard('ST04-003');
        engine.state.phase = Phase.MAIN;

        const playSkill = findAction(engine, p1.id, 'PLAY_SKILL', (action: any) => p1.hand[action.handIndex]?.id.startsWith('ST04-012'));
        expect(playSkill).toBeDefined();
        expect(engine.step(playSkill as any)).toBe(true);

        const before = zonePower(engine, p1, 0);
        await setupUiHarness(engine);

        const ownZone = requireElement<HTMLElement>('.current .unit-zone[data-index="0"]');
        ownZone.click();

        const after = zonePower(engine, p1, 0);
        expect(after).toBe(before + 2000);
        expect(engine.state.interactionMode).toBe('NORMAL');
    });
});
