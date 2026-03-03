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

describe('BT01 representative UI click tests', () => {
    beforeEach(() => {
        vi.resetModules();
        setupUiDom();
    });

    it('[REP][BT01][BT01-011] unit active then click opponent zone target', async () => {
        const engine = createEngine(201011);
        const p1 = engine.currentPlayer;
        const p2 = engine.opponentPlayer;

        p1.leaderLevel = 10;
        p1.unitZones[0].unit = getCard('BT01-011');
        p2.unitZones[0].unit = getCard('ST01-002');
        engine.state.phase = Phase.MAIN;

        await setupUiHarness(engine);
        const before = zonePower(engine, p2, 0);

        const activeBtn = requireElement<HTMLButtonElement>('.current .unit-zone[data-index="0"] .active-btn');
        activeBtn.click();

        const targetZone = requireElement<HTMLElement>('.opponent .unit-zone[data-index="0"]');
        targetZone.click();

        const after = p2.unitZones[0].unit ? zonePower(engine, p2, 0) : 0;
        expect(p2.unitZones[0].unit === null || after === before - 1500).toBe(true);
        expect(engine.state.interactionMode).toBe('NORMAL');
    });

    it('[REP][BT01][BT01-038] unit active then click hand cost and ally zone target', async () => {
        const engine = createEngine(201038);
        const p1 = engine.currentPlayer;

        p1.leaderLevel = 10;
        p1.unitZones[0].unit = getCard('BT01-038');
        p1.unitZones[1].unit = getCard('ST01-002');
        p1.hand = [getCard('ST01-002')];
        engine.state.phase = Phase.MAIN;

        const handBefore = p1.hand.length;
        const trashBefore = p1.trash.length;
        const before = zonePower(engine, p1, 1);

        await setupUiHarness(engine);

        const activeBtn = requireElement<HTMLButtonElement>('.current .unit-zone[data-index="0"] .active-btn');
        activeBtn.click();

        const payCost = findAction(engine, p1.id, 'SELECT_COST_HAND') as any;
        expect(payCost).toBeDefined();
        const costCard = requireElement<HTMLElement>(`.hand-zone .card-in-hand[data-index="${payCost.handIndex}"]`);
        costCard.click();

        const pickAlly = requireElement<HTMLElement>('.current .unit-zone[data-index="1"]');
        pickAlly.click();

        const after = zonePower(engine, p1, 1);
        expect(after).toBe(before + 4000);
        expect(p1.hand.length).toBe(handBefore - 1);
        expect(p1.trash.length).toBe(trashBefore + 1);
        expect(engine.state.interactionMode).toBe('NORMAL');
    });

    it('[REP][BT01][BT01-061] unit active then 2 targets + confirm', async () => {
        const engine = createEngine(201061);
        const p1 = engine.currentPlayer;

        p1.unitZones[0].unit = getCard('BT01-061');
        p1.unitZones[1].unit = getCard('ST01-002');
        p1.unitZones[2].unit = getCard('ST01-002');
        engine.state.phase = Phase.MAIN;

        const trashBefore = p1.trash.length;
        const before = zonePower(engine, p1, 2);

        await setupUiHarness(engine);

        const activeBtn = requireElement<HTMLButtonElement>('.current .unit-zone[data-index="0"] .active-btn');
        activeBtn.click();

        const sacrificeTarget = requireElement<HTMLElement>('.current .unit-zone[data-index="1"]');
        sacrificeTarget.click();
        const buffTarget = requireElement<HTMLElement>('.current .unit-zone[data-index="2"]');
        buffTarget.click();
        clickConfirmTargets();

        const after = zonePower(engine, p1, 2);
        expect(p1.unitZones[1].unit).toBeNull();
        expect(after).toBe(before + 2000);
        expect(p1.trash.length).toBe(trashBefore + 1);
        expect(engine.state.interactionMode).toBe('NORMAL');
    });
});
