import { describe, expect, it } from 'vitest';
import { aggregateOpponentReplyScores } from '../../src/logic/ai/eval/CounterfactualRollout';

describe('CounterfactualRollout opponent reply aggregation', () => {
    it('keeps max and mean modes unchanged', () => {
        const scores = [1200, 600, -300];

        expect(aggregateOpponentReplyScores(scores, 'max')).toBe(1200);
        expect(aggregateOpponentReplyScores(scores, 'mean')).toBeCloseTo(500, 10);
    });

    it('penalizes high-variance weighted reply sets more than stable ones', () => {
        const stableScores = [100, 70, 50];
        const volatileScores = [100, 40, 0];

        const stable = aggregateOpponentReplyScores(stableScores, 'weighted');
        const volatile = aggregateOpponentReplyScores(volatileScores, 'weighted');

        expect(stable).toBeCloseTo(77.6666666667, 8);
        expect(volatile).toBeCloseTo(55.3333333333, 8);
        expect(stable).toBeGreaterThan(volatile);
    });
});
