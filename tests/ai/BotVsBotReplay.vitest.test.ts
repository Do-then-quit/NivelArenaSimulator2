import { describe, expect, it } from 'vitest';
import {
    createRandomLegalLoadout,
    createReplayPlaybackEngine,
    runBotVsBotReplaySimulation,
} from '../../src/logic/ai/BotVsBotReplay';
import { extractCardIdentifier } from '../../scripts/ai/deck_pool';

describe('BotVsBotReplay', () => {
    it('builds mirror random loadout with equivalent deck identifiers', () => {
        const loadout = createRandomLegalLoadout(2026021101, true);
        expect(loadout.deck1).toHaveLength(40);
        expect(loadout.deck2).toHaveLength(40);

        const p1Identifiers = loadout.deck1.map(card => extractCardIdentifier(card.id)).sort();
        const p2Identifiers = loadout.deck2.map(card => extractCardIdentifier(card.id)).sort();
        expect(p1Identifiers).toEqual(p2Identifiers);
    });

    it('captures deterministic bot-vs-bot action history', async () => {
        const loadout = createRandomLegalLoadout(2026021102, false);
        const config = {
            seed: loadout.seed,
            maxSteps: 320,
            enableMulligan: true,
            player1BotId: 'baseline' as const,
            player2BotId: 'baseline' as const,
            loadout,
        };

        const resultA = await runBotVsBotReplaySimulation(config);
        const resultB = await runBotVsBotReplaySimulation(config);

        expect(resultA.actions.length).toBe(resultA.steps);
        expect(resultA).toEqual(resultB);
        expect(resultA.terminationReason).not.toBe('invalid_action');
        expect(resultA.terminationReason).not.toBe('no_action');
        expect(resultA.tacticalMetrics.wastefulUpgradeRate).toBeGreaterThanOrEqual(0);
        expect(resultA.tacticalMetrics.wastefulUpgradeRate).toBeLessThanOrEqual(1);
        expect(resultA.tacticalMetrics.lethalMissRate).toBeGreaterThanOrEqual(0);
        expect(resultA.tacticalMetrics.lethalMissRate).toBeLessThanOrEqual(1);
        expect(resultA.tacticalMetrics.selfLethalOpenRate).toBeGreaterThanOrEqual(0);
        expect(resultA.tacticalMetrics.selfLethalOpenRate).toBeLessThanOrEqual(1);

        const playback = createReplayPlaybackEngine(loadout, true);
        for (const step of resultA.actions.slice(0, 8)) {
            const ok = playback.step(step.action);
            expect(ok).toBe(true);
        }
    });

    it('stops when max step budget is reached', async () => {
        const loadout = createRandomLegalLoadout(2026021103, false);
        const result = await runBotVsBotReplaySimulation({
            seed: loadout.seed,
            maxSteps: 1,
            enableMulligan: true,
            player1BotId: 'baseline',
            player2BotId: 'baseline',
            loadout,
        });

        expect(result.steps).toBe(1);
        expect(result.actions.length).toBe(1);
        expect(result.terminationReason).toBe('max_steps');
        expect(result.tacticalMetrics.lethalMissRate).toBeGreaterThanOrEqual(0);
    });
});
