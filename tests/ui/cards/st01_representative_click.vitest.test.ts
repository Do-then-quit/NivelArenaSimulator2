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

describe('ST01 representative UI click tests', () => {
    beforeEach(() => {
        vi.resetModules();
        setupUiDom();
    });

    it('[REP][ST01][ST01-013] play skill then click trash target (unit-only filter)', async () => {
        const engine = createEngine(101013);
        const p1 = engine.currentPlayer;

        const trashUnit = getCard('ST01-002');
        trashUnit.cost = 1;
        const trashSkill = getCard('ST01-012');
        trashSkill.cost = 2;

        p1.leaderLevel = 10;
        p1.hand = [getCard('ST01-013')];
        p1.trash = [trashUnit, trashSkill];
        engine.state.phase = Phase.MAIN;

        const playSkill = findAction(engine, p1.id, 'PLAY_SKILL', (action: any) => p1.hand[action.handIndex]?.id.startsWith('ST01-013'));
        expect(playSkill).toBeDefined();
        expect(engine.step(playSkill as any)).toBe(true);

        const legalTrashActions = engine.getLegalActions(p1.id).filter(action => action.type === 'SELECT_TRASH_TARGET') as Array<any>;
        expect(legalTrashActions.some(action => p1.trash[action.trashIndex]?.id.startsWith('ST01-002'))).toBe(true);
        expect(legalTrashActions.some(action => p1.trash[action.trashIndex]?.id.startsWith('ST01-012'))).toBe(false);

        await setupUiHarness(engine);

        const trashTarget = requireElement<HTMLElement>('.trash-card-item[data-index="0"]');
        trashTarget.click();

        expect(p1.hand.some(card => card.id.startsWith('ST01-002'))).toBe(true);
        expect(engine.state.interactionMode).toBe('NORMAL');
    });
});
