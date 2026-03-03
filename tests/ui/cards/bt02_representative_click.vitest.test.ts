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
} from '../helpers/ui_click_harness';

describe('BT02 representative UI click tests', () => {
    beforeEach(() => {
        vi.resetModules();
        setupUiDom();
    });

    it('[REP][BT02][BT02-016] play skill then click opponent item target', async () => {
        const engine = createEngine(202016);
        const p1 = engine.currentPlayer;
        const p2 = engine.opponentPlayer;

        p1.leaderLevel = 10;
        p1.hand = [getCard('BT02-016')];
        p1.unitZones[0].unit = getCard('BT02-003');
        p1.unitZones[0].items = [getCard('BT02-078')];
        p2.unitZones[0].unit = getCard('BT02-003');
        p2.unitZones[0].items = [getCard('BT02-079')];
        engine.state.phase = Phase.MAIN;

        const playSkill = findAction(engine, p1.id, 'PLAY_SKILL', (action: any) => p1.hand[action.handIndex]?.id.startsWith('BT02-016'));
        expect(playSkill).toBeDefined();
        expect(engine.step(playSkill as any)).toBe(true);

        await setupUiHarness(engine);

        const targetItem = requireElement<HTMLElement>('.opponent .mini-item-card[data-zone-index="0"][data-item-index="0"]');
        targetItem.click();

        expect(p2.unitZones[0].items.length).toBe(0);
        expect(engine.state.interactionMode).toBe('NORMAL');
    });

    it('[REP][BT02][BT02-073] play skill then click damage target and hand target', async () => {
        const engine = createEngine(202073);
        const p1 = engine.currentPlayer;

        p1.leaderLevel = 10;
        p1.hand = [getCard('BT02-073'), getCard('ST01-002')];
        p1.damage = [getCard('ST01-002'), getCard('BT02-078')];
        engine.state.phase = Phase.MAIN;

        const playSkill = findAction(engine, p1.id, 'PLAY_SKILL', (action: any) => p1.hand[action.handIndex]?.id.startsWith('BT02-073'));
        expect(playSkill).toBeDefined();
        expect(engine.step(playSkill as any)).toBe(true);

        await setupUiHarness(engine);

        const damageZone = requireElement<HTMLElement>('.current .damage-zone');
        damageZone.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        const damageCard = requireElement<HTMLElement>('.trash-hover-card.overlay-card-selectable[data-index="1"]');
        damageCard.click();

        const pickHand = findAction(
            engine,
            p1.id,
            'SELECT_HAND_TARGET',
            (action: any) => p1.hand[action.handIndex]?.id.startsWith('ST01-002'),
        ) as any;
        expect(pickHand).toBeDefined();
        const handCard = requireElement<HTMLElement>(`.hand-zone .card-in-hand[data-index="${pickHand.handIndex}"]`);
        handCard.click();

        expect(p1.hand.some(card => card.id.startsWith('BT02-078'))).toBe(true);
        expect(p1.damage.some(card => card.id.startsWith('ST01-002'))).toBe(true);
        expect(engine.state.interactionMode).toBe('NORMAL');
    });

    it('[REP][BT02][BT02-077] play skill then revealed selection + confirm + bottom ordering confirm', async () => {
        const engine = createEngine(202077);
        const p1 = engine.currentPlayer;

        p1.leaderLevel = 10;
        p1.hand = [getCard('BT02-077')];
        p1.deck = [
            getCard('ST01-002'),
            getCard('BT02-078'),
            getCard('ST01-002'),
            getCard('BT02-079'),
            getCard('ST01-002'),
        ];
        engine.state.phase = Phase.MAIN;

        const playSkill = findAction(engine, p1.id, 'PLAY_SKILL', (action: any) => p1.hand[action.handIndex]?.id.startsWith('BT02-077'));
        expect(playSkill).toBeDefined();
        expect(engine.step(playSkill as any)).toBe(true);

        await setupUiHarness(engine);

        const firstPick = findAction(engine, p1.id, 'SELECT_REVEALED_TARGET') as any;
        expect(firstPick).toBeDefined();
        const firstCard = requireElement<HTMLElement>(`.revealed-card-item[data-index="${firstPick.revealedIndex}"]`);
        firstCard.click();
        clickConfirmTargets();

        expect(engine.state.pendingEffect?.actionType).toBe('ORDER_REVEALED_BOTTOM');

        const selectedOrderIndexes = new Set<number>();
        let safety = 0;
        while (engine.state.pendingEffect?.actionType === 'ORDER_REVEALED_BOTTOM' && safety < 10) {
            const orderPick = findAction(
                engine,
                p1.id,
                'SELECT_REVEALED_TARGET',
                (action: any) => !selectedOrderIndexes.has(action.revealedIndex),
            ) as any;
            if (!orderPick) break;
            const orderCard = requireElement<HTMLElement>(`.revealed-card-item[data-index="${orderPick.revealedIndex}"]`);
            orderCard.click();
            selectedOrderIndexes.add(orderPick.revealedIndex);
            safety += 1;
        }

        const confirmBtn = requireElement<HTMLButtonElement>('#confirm-targets-btn');
        expect(confirmBtn.disabled).toBe(false);
        clickConfirmTargets();

        expect(engine.state.revealedCards.length).toBe(0);
        expect(p1.hand.some(card => card.id.startsWith('BT02-078') || card.id.startsWith('BT02-079'))).toBe(true);
        expect(engine.state.interactionMode).toBe('NORMAL');
    });
});
