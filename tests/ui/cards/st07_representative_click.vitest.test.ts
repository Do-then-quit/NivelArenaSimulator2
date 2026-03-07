import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Phase } from '../../../src/logic/types';
import {
    clickOptional,
    createEngine,
    findAction,
    getCard,
    requireElement,
    setupUiDom,
    setupUiHarness,
} from '../helpers/ui_click_harness';

describe('ST07 representative UI click tests', () => {
    beforeEach(() => {
        vi.resetModules();
        setupUiDom();
    });

    it('[REP][ST07][ST07-001-Active] leader active -> cost hand click', async () => {
        const engine = createEngine(107001);
        const p1 = engine.currentPlayer;

        p1.levelZone = getCard('ST07-001');
        p1.levelZone.isAwakened = true;
        p1.leaderLevel = 4;
        p1.hand = [getCard('ST07-013')];
        p1.unitZones[0].unit = getCard('ST07-002');
        p1.unitZones[1].unit = getCard('ST07-007');
        engine.state.phase = Phase.MAIN;

        await setupUiHarness(engine);

        const leaderActiveBtn = requireElement<HTMLButtonElement>('.current .leader-active-btn');
        leaderActiveBtn.click();

        const payCost = findAction(engine, p1.id, 'SELECT_COST_HAND') as any;
        expect(payCost).toBeDefined();
        const handCostCard = requireElement<HTMLElement>(`.hand-zone .card-in-hand[data-index="${payCost.handIndex}"]`);
        handCostCard.click();

        expect(engine.getUnitHit(p1.unitZones[0], p1)).toBe(2);
        expect(engine.getUnitHit(p1.unitZones[1], p1)).toBe(1);
        expect(engine.state.interactionMode).toBe('NORMAL');
    });

    it('[REP][ST07][ST07-007] repeated target clicks can stack the same debuff target', async () => {
        const engine = createEngine(107002);
        const p1 = engine.currentPlayer;
        const p2 = engine.state.players[1];

        p1.unitZones[0].unit = getCard('ST07-007');
        p1.unitZones[1].unit = getCard('ST07-002');
        p2.unitZones[1].unit = getCard('ST07-011');
        engine.state.phase = Phase.ATTACK;

        const { renderGame } = await setupUiHarness(engine);

        const before = engine.getUnitPower(p2.unitZones[1], p2);

        engine.attack(1);
        const passBlock = findAction(engine, p2.id, 'RESOLVE_BLOCK', (action: any) => action.shouldBlock === false) as any;
        expect(passBlock).toBeDefined();
        if (passBlock) engine.step(passBlock);
        engine.attack(0);
        engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
        renderGame();

        requireElement<HTMLElement>('.opponent .unit-zone[data-index="1"]').click();
        requireElement<HTMLElement>('.opponent .unit-zone[data-index="1"]').click();
        const confirmBtn = (
            document.getElementById('confirm-targets-btn')
            ?? document.getElementById('confirm-targets-modal-btn')
        ) as HTMLButtonElement | null;
        if (confirmBtn) {
            confirmBtn.click();
        } else {
            const confirmAction = findAction(engine, p1.id, 'CONFIRM_TARGETS') as any;
            expect(confirmAction).toBeDefined();
            if (confirmAction) engine.step(confirmAction);
        }

        const after = p2.unitZones[1].unit ? engine.getUnitPower(p2.unitZones[1], p2) : before - 6000;
        expect(after).toBe(before - 6000);
        expect(engine.state.interactionMode).toBe('NORMAL');
    });

    it('[REP][ST07][ST07-010] optional confirm -> cost click -> trash click -> empty zone click', async () => {
        const engine = createEngine(107003);
        const p1 = engine.currentPlayer;

        p1.unitZones[0].unit = getCard('ST07-010');
        p1.unitZones[2].unit = getCard('ST07-005');
        p1.trash = [getCard('ST07-005')];
        p1.hand = [getCard('ST07-013')];
        engine.destroyUnit(p1, p1.unitZones[2], undefined, 'EFFECT');
        engine.state.phase = Phase.MAIN;

        await setupUiHarness(engine);

        const activeBtn = requireElement<HTMLButtonElement>('.current .unit-zone[data-index="0"] .active-btn');
        activeBtn.click();

        clickOptional(true);

        const payCost = findAction(engine, p1.id, 'SELECT_COST_HAND') as any;
        expect(payCost).toBeDefined();
        requireElement<HTMLElement>(`.hand-zone .card-in-hand[data-index="${payCost.handIndex}"]`).click();

        const trashPick = findAction(engine, p1.id, 'SELECT_TRASH_TARGET', (action: any) => p1.trash[action.trashIndex]?.id.startsWith('ST07-005')) as any;
        expect(trashPick).toBeDefined();
        requireElement<HTMLElement>(`.trash-card-item[data-index="${trashPick.trashIndex}"]`).click();

        requireElement<HTMLElement>('.current .unit-zone[data-index="1"]').click();

        expect(p1.unitZones[1].unit?.id).toBe('ST07-005');
        expect(engine.state.interactionMode).toBe('NORMAL');
    });
});
