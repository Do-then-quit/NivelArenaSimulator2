import { describe, expect, it } from 'vitest';
import { runSingleMatch } from '../../scripts/ai/match_harness';
import { resolveBotFactory } from '../../scripts/ai/bot_registry';

describe('Rules v2 AI seed regression (2026021312 trash-target toggle)', () => {
    it('does not stall with repeated SELECT_TRASH_TARGET toggles in strong-v3 vs strong-v2', () => {
        const report = runSingleMatch({
            seed: 2026021312,
            maxSteps: 2600,
            enableMulligan: true,
            traceLimit: 40,
            muteEngineLogs: true,
            player1BotFactory: resolveBotFactory('strong-v3'),
            player2BotFactory: resolveBotFactory('strong-v2'),
        });

        expect(report.reason).toBe('winner');
        expect(report.lastActions.filter(action => action.startsWith('SELECT_TRASH_TARGET')).length).toBeLessThan(10);
    });
});
