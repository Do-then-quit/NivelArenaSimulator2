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

describe('ST10 representative UI click tests', () => {
    beforeEach(() => {
        vi.resetModules();
        setupUiDom();
    });

    it('[REP][ST10][ST10-001-Active] leader active -> cost hand click -> target lane click', async () => {
        const engine = createEngine(110001);
        const p1 = engine.currentPlayer;

        p1.levelZone = getCard('ST10-001');
        p1.levelZone.isAwakened = true;
        p1.leaderLevel = 5;
        p1.hand = [getCard('ST01-002')];
        p1.unitZones[0].unit = getCard('ST10-005');
        p1.unitZones[1].unit = getCard('ST10-005');
        engine.state.phase = Phase.ATTACK;

        await setupUiHarness(engine);

        const leaderActiveBtn = requireElement<HTMLButtonElement>('.current .leader-active-btn');
        leaderActiveBtn.click();

        const payCost = findAction(engine, p1.id, 'SELECT_COST_HAND') as any;
        expect(payCost).toBeDefined();
        const handCostCard = requireElement<HTMLElement>(`.hand-zone .card-in-hand[data-index="${payCost.handIndex}"]`);
        handCostCard.click();

        const pickZone = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) => action.targetPlayerId === p1.id && action.zoneIndex === 0) as any;
        expect(pickZone).toBeDefined();
        const ownZone = requireElement<HTMLElement>(`.current .unit-zone[data-index="${pickZone.zoneIndex}"]`);
        ownZone.click();

        const canAttack = engine
            .getLegalActions(p1.id)
            .some(action => action.type === 'ATTACK' && action.attackerZoneIndex === 0);

        expect(canAttack).toBe(true);
        expect(p1.trash.some(card => card.id.startsWith('ST01-002'))).toBe(true);
        expect(engine.state.interactionMode).toBe('NORMAL');
    });
});
