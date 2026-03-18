import { describe, expect, it } from 'vitest';
import {
    buildBt05NikkiSelfPlayArtifactPaths,
    formatBt05NikkiSelfPlayExportSummary,
    runBt05NikkiSelfPlayExport,
} from '../../scripts/ai/run_bt05_nikki_selfplay_export';

describe('BT05 Nikki self-play export', () => {
    it('builds deterministic artifact paths for exported trajectories', () => {
        const artifactPaths = buildBt05NikkiSelfPlayArtifactPaths('artifacts/ai/rl/bt05_nikki_selfplay/latest.json', {
            matchupId: 'fm-c-bt05-unlucky-bunny-nikki-mirror',
            player1BotId: 'practice-bt05-nikki-strong-v1',
            player2BotId: 'practice-bt05-nikki-strong-v1',
            seedList: [2026031800, 2026031801],
            seedSuiteName: undefined,
        });

        expect(artifactPaths.latestPath).toContain('bt05_nikki_selfplay');
        expect(artifactPaths.archivePath).toContain('fm-c-bt05-unlucky-bunny-nikki-mirror');
        expect(artifactPaths.archivePath).toContain('practice-bt05-nikki-strong-v1');
        expect(artifactPaths.archivePath).toContain('seed-2026031800-to-2026031801');
    });

    it('exports RL-ready trajectories with stable action metadata', { timeout: 30000 }, () => {
        const report = runBt05NikkiSelfPlayExport({
            matchupId: 'fm-c-bt05-unlucky-bunny-nikki-mirror',
            games: 1,
            maxSteps: 800,
            enableMulligan: true,
            startSeed: 2026031800,
            player1BotId: 'practice-bt05-nikki-strong-v1',
            player2BotId: 'practice-bt05-nikki-strong-v1',
            explorationRate: 0,
            suppressLogs: true,
        });

        expect(report.episodes).toHaveLength(1);
        expect(report.summary.totalGames).toBe(1);
        expect(report.summary.totalTransitions).toBeGreaterThan(0);
        expect(report.summary.decisionSourceCounts.exploreRandom).toBe(0);
        expect(report.summary.decisionSourceCounts.bot).toBe(report.summary.totalTransitions);

        const episode = report.episodes[0];
        expect(episode.reason).toMatch(/winner|max_steps|no_action|invalid_action/);
        expect(episode.transitions.length).toBeGreaterThan(0);

        for (const transition of episode.transitions) {
            expect(transition.legalActionKeys[transition.chosenActionIndex]).toBe(transition.chosenAction.key);
            expect(transition.observation.actorPlayerId).toBe(transition.actorPlayerId);
            expect(transition.returnToGoFromActorPerspective).toBeGreaterThanOrEqual(-1);
            expect(transition.returnToGoFromActorPerspective).toBeLessThanOrEqual(1);
        }

        const lastTransition = episode.transitions[episode.transitions.length - 1];
        expect(lastTransition.terminalReason).toBe(episode.reason);

        const summaryText = formatBt05NikkiSelfPlayExportSummary(report);
        expect(summaryText).toContain('BT05 Nikki RL self-play export');
        expect(summaryText).toContain('transitions=');
    });
});
