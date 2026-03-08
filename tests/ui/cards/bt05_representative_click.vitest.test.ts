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

describe('BT05 representative UI click tests', () => {
    beforeEach(() => {
        vi.resetModules();
        setupUiDom();
    });

    it('[REP][BT05][BT05-077] play skill then click revealed item and equip prompt', async () => {
        const engine = createEngine(205077);
        const p1 = engine.currentPlayer;

        p1.leaderLevel = 10;
        p1.hand = [getCard('BT05-077')];
        p1.unitZones[0].unit = getCard('ST01-002');
        p1.trash = [getCard('BT05-081')];
        engine.state.phase = Phase.MAIN;

        const playSkill = findAction(
            engine,
            p1.id,
            'PLAY_SKILL',
            (action: any) => p1.hand[action.handIndex]?.id.startsWith('BT05-077'),
        );
        expect(playSkill).toBeDefined();
        expect(engine.step(playSkill as any)).toBe(true);

        const pickItem = findAction(
            engine,
            p1.id,
            'SELECT_REVEALED_TARGET',
            (action: any) => engine.state.revealedCards[action.revealedIndex]?.id.startsWith('BT05-081'),
        ) as any;
        expect(pickItem).toBeDefined();

        await setupUiHarness(engine);

        const firstPrompt = requireElement<HTMLElement>(`.revealed-card-item[data-index="${pickItem.revealedIndex}"]`);
        firstPrompt.click();

        const secondPick = findAction(
            engine,
            p1.id,
            'SELECT_ZONE_TARGET',
            (action: any) => action.targetPlayerId === p1.id && action.zoneIndex === 0,
        ) as any;
        expect(secondPick).toBeDefined();
        const targetZone = requireElement<HTMLElement>('.current .unit-zone[data-index="0"]');
        targetZone.click();

        expect(p1.unitZones[0].items.some(item => item.id.startsWith('BT05-081'))).toBe(true);
        expect(p1.trash.some(card => card.id.startsWith('BT05-077'))).toBe(true);
        expect(engine.state.interactionMode).toBe('NORMAL');
    });
});
