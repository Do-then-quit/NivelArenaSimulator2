import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Phase } from '../../../src/logic/types';
import {
    clickConfirmTargets,
    clickOptional,
    createEngine,
    findAction,
    getCard,
    requireElement,
    setupUiDom,
    setupUiHarness,
} from '../helpers/ui_click_harness';

describe('BT04 representative UI click tests', () => {
    beforeEach(() => {
        vi.resetModules();
        setupUiDom();
    });

    it('[REP][BT04][BT04-037] play skill then click trash, hand, and zone targets', async () => {
        const engine = createEngine(204037);
        const p1 = engine.currentPlayer;

        p1.leaderLevel = 10;
        p1.hand = [getCard('BT04-037'), getCard('ST06-015'), getCard('ST01-002')];
        p1.trash = [getCard('BT04-003')];
        p1.deck = [getCard('BT04-030')];
        p1.unitZones[0].unit = getCard('ST06-006');
        engine.state.phase = Phase.MAIN;

        engine.playSkill(0);
        await setupUiHarness(engine);

        const recover = findAction(engine, p1.id, 'SELECT_TRASH_TARGET', (action: any) => p1.trash[action.trashIndex]?.id === 'BT04-003') as any;
        expect(recover).toBeDefined();
        requireElement<HTMLElement>(`.trash-card-item[data-index="${recover.trashIndex}"]`).click();

        const discard = findAction(engine, p1.id, 'SELECT_HAND_TARGET', (action: any) => p1.hand[action.handIndex]?.id === 'ST01-002') as any;
        expect(discard).toBeDefined();
        requireElement<HTMLElement>(`.hand-zone .card-in-hand[data-index="${discard.handIndex}"]`).click();

        requireElement<HTMLElement>('.current .unit-zone[data-index="0"]').click();

        const canPlayLockedSkill = engine
            .getLegalActions(p1.id)
            .some((action: any) => action.type === 'PLAY_SKILL' && p1.hand[action.handIndex]?.id === 'ST06-015');

        expect(p1.unitZones[0].unit?.turnCostOverride?.cost).toBe(0);
        expect(p1.hand.some(card => card.id === 'BT04-003')).toBe(true);
        expect(canPlayLockedSkill).toBe(false);
        expect(engine.state.interactionMode).toBe('NORMAL');
    });

    it('[REP][BT04][BT04-066] exit optional confirm then click revealed damage and hand cards', async () => {
        const engine = createEngine(204066);
        const p1 = engine.currentPlayer;

        p1.leaderLevel = 10;
        p1.unitZones[0].unit = getCard('BT04-066');
        p1.deck = [getCard('ST01-002'), getCard('BT04-083'), getCard('ST01-011'), getCard('BT04-076')];
        engine.state.phase = Phase.MAIN;

        engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
        expect(engine.state.interactionMode).toBe('SELECT_OPTIONAL');

        await setupUiHarness(engine);

        clickOptional(true);

        const pickDamage = findAction(
            engine,
            p1.id,
            'SELECT_REVEALED_TARGET',
            (action: any) => engine.state.revealedCards[action.revealedIndex]?.id === 'BT04-076',
        ) as any;
        expect(pickDamage).toBeDefined();
        requireElement<HTMLElement>(`.revealed-card-item[data-index="${pickDamage.revealedIndex}"]`).click();

        const pickHand = findAction(
            engine,
            p1.id,
            'SELECT_REVEALED_TARGET',
            (action: any) => engine.state.revealedCards[action.revealedIndex]?.id === 'ST01-011',
        ) as any;
        expect(pickHand).toBeDefined();
        requireElement<HTMLElement>(`.revealed-card-item[data-index="${pickHand.revealedIndex}"]`).click();

        expect(p1.damage.some(card => card.id === 'BT04-076')).toBe(true);
        expect(p1.hand.some(card => card.id === 'ST01-011')).toBe(true);
        expect(engine.state.interactionMode).toBe('NORMAL');
    });

    it('[REP][BT04][BT04-082] play skill then click three trash targets and confirm', async () => {
        const engine = createEngine(204082);
        const p1 = engine.currentPlayer;

        p1.leaderLevel = 20;
        engine.opponentPlayer.leaderLevel = 20;
        p1.hand = [getCard('BT04-082')];
        p1.trash = [getCard('BT04-052'), getCard('BT04-067'), getCard('ST07-007')];
        engine.state.phase = Phase.MAIN;

        engine.playSkill(0);
        await setupUiHarness(engine);

        const ids = ['BT04-052', 'BT04-067', 'ST07-007'];
        ids.forEach((id) => {
            const action = findAction(engine, p1.id, 'SELECT_TRASH_TARGET', (candidate: any) => p1.trash[candidate.trashIndex]?.id === id) as any;
            expect(action).toBeDefined();
            requireElement<HTMLElement>(`.trash-card-item[data-index="${action.trashIndex}"]`).click();
        });

        clickConfirmTargets();

        const deployedIds = p1.unitZones.map(zone => zone.unit?.id).filter(Boolean);
        expect(deployedIds).toEqual(expect.arrayContaining(ids));
        expect(engine.state.interactionMode).toBe('NORMAL');
    });
});
