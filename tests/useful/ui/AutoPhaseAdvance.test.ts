import { describe, expect, it } from 'vitest';
import { canAutoAdvancePhase } from '../../../src/logic/AutoPhaseAdvance';
import { Phase } from '../../../src/logic/types';

describe('Auto phase advance gate', () => {
    it('does not auto-advance LEVEL_UP while an effect interaction is pending', () => {
        const shouldAutoAdvance = canAutoAdvancePhase({
            phase: Phase.LEVEL_UP,
            interactionMode: 'SELECT_TARGET',
            isLocalHumanInput: true,
            hasNextPhaseAction: false,
        });

        expect(shouldAutoAdvance).toBe(false);
    });

    it('auto-advances LEVEL_UP after pending interaction is fully resolved', () => {
        const shouldAutoAdvance = canAutoAdvancePhase({
            phase: Phase.LEVEL_UP,
            interactionMode: 'NORMAL',
            isLocalHumanInput: true,
            hasNextPhaseAction: true,
        });

        expect(shouldAutoAdvance).toBe(true);
    });

    it('does not auto-advance END when hand-adjust discard is still required', () => {
        const shouldAutoAdvance = canAutoAdvancePhase({
            phase: Phase.END,
            interactionMode: 'SELECT_TARGET',
            isLocalHumanInput: true,
            hasNextPhaseAction: false,
        });

        expect(shouldAutoAdvance).toBe(false);
    });
});

