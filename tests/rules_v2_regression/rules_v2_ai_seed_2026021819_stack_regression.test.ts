import { describe, expect, it } from 'vitest';
import { StrongBot } from '../../src/logic/ai/StrongBot';
import { runSingleMatch } from '../../scripts/ai/match_harness';

describe('Rules v2 AI Stack Regression (seed 2026021819)', () => {
    it('does not throw stack overflow for deterministic strong-v1 mirror', () => {
        const run = () =>
            runSingleMatch({
                seed: 2026021819,
                maxSteps: 2400,
                enableMulligan: true,
                player1BotFactory: name => new StrongBot(name),
                player2BotFactory: name => new StrongBot(name),
            });

        expect(run).not.toThrow();
        const report = run();
        expect(report.reason).toBe('winner');
    });
});
