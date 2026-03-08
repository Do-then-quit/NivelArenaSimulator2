import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Phase } from '../../../src/logic/types';
import {
    createEngine,
    requireElement,
    setupUiDom,
    setupUiHarness,
} from '../helpers/ui_click_harness';

describe('ST09 representative UI click tests', () => {
    beforeEach(() => {
        vi.resetModules();
        setupUiDom();
    });

    it('[REP][ST09][ST09-001] leader active grants an escape effect to a friendly unit', async () => {
        const engine = createEngine(119001);
        const p1 = engine.currentPlayer;

        p1.levelZone = JSON.parse(JSON.stringify(p1.levelZone));
        if (p1.levelZone) {
            p1.levelZone.id = 'ST09-001';
            p1.levelZone.name = '트로피컬 디멘션 아비게일';
            p1.levelZone.effects = (await import('../../../src/logic/cardEffects/st09')).ST09_EFFECTS['ST09-001'];
            p1.levelZone.isAwakened = true;
        }
        p1.leaderLevel = 5;
        p1.unitZones[0].unit = JSON.parse(JSON.stringify((await import('../helpers/ui_click_harness')).getCard('ST01-002')));
        engine.state.phase = Phase.MAIN;

        await setupUiHarness(engine);

        const leaderActiveBtn = requireElement<HTMLButtonElement>('.current .leader-active-btn');
        leaderActiveBtn.click();

        const ownZone = requireElement<HTMLElement>('.current .unit-zone[data-index="0"]');
        ownZone.click();

        const granted = p1.unitZones[0].temporaryEffects.some(effect => String(effect.description).includes('상대에게 1대미지'));
        expect(granted).toBe(true);
        expect(engine.state.interactionMode).toBe('NORMAL');
    });
});
