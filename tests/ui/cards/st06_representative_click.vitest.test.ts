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

describe('ST06 representative UI click tests', () => {
    beforeEach(() => {
        vi.resetModules();
        setupUiDom();
    });

    it('[REP][ST06][ST06-010] optional confirm -> hand cost click -> friendly target click', async () => {
        const engine = createEngine(106010);
        const p1 = engine.currentPlayer;

        p1.hand = [getCard('ST06-010'), getCard('ST01-002')];
        p1.unitZones[1].unit = getCard('ST06-006');
        p1.leaderLevel = 10;
        engine.state.phase = Phase.MAIN;

        const playUnit = findAction(
            engine,
            p1.id,
            'PLAY_UNIT',
            (action: any) => p1.hand[action.handIndex]?.id === 'ST06-010' && action.zoneIndex === 0,
        );
        expect(playUnit).toBeDefined();
        expect(engine.step(playUnit as any)).toBe(true);

        await setupUiHarness(engine);

        clickOptional(true);

        const payCost = findAction(
            engine,
            p1.id,
            'SELECT_COST_HAND',
            (action: any) => p1.hand[action.handIndex]?.id === 'ST01-002',
        ) as any;
        expect(payCost).toBeDefined();
        requireElement<HTMLElement>(`.hand-zone .card-in-hand[data-index="${payCost.handIndex}"]`).click();

        requireElement<HTMLElement>('.current .unit-zone[data-index="1"]').click();

        const grantedPenetration = p1.unitZones[1].temporaryEffects.some((effect: any) =>
            String(effect.description).includes('관통[1]'),
        );
        expect(grantedPenetration).toBe(true);
        expect(engine.state.interactionMode).toBe('NORMAL');
    });

    it('[REP][ST06][ST06-016-Targeting] first target click only allows own encounter lane', async () => {
        const engine = createEngine(106016);
        const p1 = engine.currentPlayer;
        const p2 = engine.state.players[1];

        p1.hand = [getCard('ST06-016')];
        p1.unitZones[0].unit = getCard('ST06-009');
        p1.unitZones[1].unit = getCard('ST06-006');
        p2.unitZones[0].unit = getCard('ST06-009');
        p1.damage = [getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002')];
        p1.deck = [getCard('ST01-002')];
        p1.leaderLevel = 10;
        engine.state.phase = Phase.MAIN;

        const playSkill = findAction(
            engine,
            p1.id,
            'PLAY_SKILL',
            (action: any) => p1.hand[action.handIndex]?.id === 'ST06-016',
        );
        expect(playSkill).toBeDefined();
        expect(engine.step(playSkill as any)).toBe(true);

        const firstTargets = engine.getLegalActions(p1.id).filter((action: any) => action.type === 'SELECT_ZONE_TARGET');
        expect(firstTargets.some((action: any) => action.targetPlayerId === p1.id && action.zoneIndex === 0)).toBe(true);
        expect(firstTargets.some((action: any) => action.targetPlayerId === p2.id && action.zoneIndex === 0)).toBe(false);
        expect(firstTargets.some((action: any) => action.targetPlayerId === p1.id && action.zoneIndex === 1)).toBe(false);

        await setupUiHarness(engine);

        requireElement<HTMLElement>('.current .unit-zone[data-index="0"]').click();
        requireElement<HTMLElement>('.current .unit-zone[data-index="1"]').click();

        expect((p1.unitZones[0].extraAttackAllowance || 0) >= 1).toBe(true);
        expect(p1.unitZones[1].unit?.turnCostOverride?.cost).toBe(0);
        expect(p1.hand.some((card) => card.id === 'ST01-002')).toBe(true);
        expect(engine.state.interactionMode).toBe('NORMAL');
    });

    it('[REP][ST06][ST06-008-ForcedBlock] target click then attack click removes pass block button', async () => {
        const engine = createEngine(106008);
        const p1 = engine.currentPlayer;
        const p2 = engine.state.players[1];

        p1.hand = [getCard('ST06-008')];
        p1.unitZones[1].unit = getCard('ST06-009');
        p2.unitZones[1].unit = getCard('ST01-002');
        p1.leaderLevel = 10;
        engine.state.phase = Phase.MAIN;

        const playUnit = findAction(
            engine,
            p1.id,
            'PLAY_UNIT',
            (action: any) => p1.hand[action.handIndex]?.id === 'ST06-008' && action.zoneIndex === 0,
        );
        expect(playUnit).toBeDefined();
        expect(engine.step(playUnit as any)).toBe(true);

        const { renderGame } = await setupUiHarness(engine);

        requireElement<HTMLElement>('.current .unit-zone[data-index="1"]').click();

        engine.state.phase = Phase.ATTACK;
        renderGame();

        requireElement<HTMLButtonElement>('.unit-zone[data-player="current"][data-index="1"] .attack-btn').click();

        expect(document.querySelector('.pass-btn')).toBeNull();
        const blockBtn = requireElement<HTMLButtonElement>('.unit-zone[data-player="opponent"][data-index="1"] .block-btn');
        blockBtn.click();

        expect(engine.state.interactionMode).toBe('NORMAL');
    });
});
