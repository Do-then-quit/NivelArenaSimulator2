import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
    DEFAULT_PHASE0_MANIFEST,
    loadPhase0Manifest,
    resolvePhase0ManifestPath,
} from '../../scripts/ai/phase0_manifest';

const tempDirs: string[] = [];

afterEach(() => {
    while (tempDirs.length > 0) {
        const target = tempDirs.pop();
        if (!target) continue;
        fs.rmSync(target, { recursive: true, force: true });
    }
});

describe('Phase0 Manifest', () => {
    it('resolves repository default manifest path when available', () => {
        const resolved = resolvePhase0ManifestPath();
        expect(resolved).toBeTruthy();
        expect(resolved?.endsWith('phase0.manifest.json')).toBe(true);
    });

    it('keeps exported defaults synchronized with repository manifest', () => {
        const resolved = resolvePhase0ManifestPath();
        expect(resolved).toBeTruthy();
        const fromRepo = loadPhase0Manifest(resolved);
        expect(DEFAULT_PHASE0_MANIFEST).toEqual(fromRepo);
    });

    it('loads default values when manifest path is omitted', () => {
        const manifest = loadPhase0Manifest(undefined);
        expect(manifest.version).toBe(DEFAULT_PHASE0_MANIFEST.version);
        expect(manifest.bench.games).toBe(DEFAULT_PHASE0_MANIFEST.bench.games);
        expect(manifest.ladder.entrants).toEqual(DEFAULT_PHASE0_MANIFEST.ladder.entrants);
        expect(manifest.fixedMatchupBench.matchupId).toBe(DEFAULT_PHASE0_MANIFEST.fixedMatchupBench.matchupId);
        expect(manifest.fixedMatchupBench.seedSuiteName).toBe(DEFAULT_PHASE0_MANIFEST.fixedMatchupBench.seedSuiteName);
        expect(manifest.phase4.runtimeGateThresholds).toEqual(DEFAULT_PHASE0_MANIFEST.phase4.runtimeGateThresholds);
        expect(manifest.phase4.performanceGate).toEqual(DEFAULT_PHASE0_MANIFEST.phase4.performanceGate);
        expect(manifest.phase41Promotion.performanceGate).toEqual(DEFAULT_PHASE0_MANIFEST.phase41Promotion.performanceGate);
        expect(manifest.phase41Promotion.tacticalKpiGate).toEqual(DEFAULT_PHASE0_MANIFEST.phase41Promotion.tacticalKpiGate);
    });

    it('merges partial manifest over defaults', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase0-manifest-'));
        tempDirs.push(dir);

        const customPath = path.join(dir, 'manifest.json');
        fs.writeFileSync(
            customPath,
            JSON.stringify({
                version: 'custom-v1',
                bench: {
                    games: 3,
                    outputPath: 'artifacts/custom/bench.json',
                },
                regression: {
                    includeBotSoak: false,
                },
                fixedMatchupBench: {
                    gamesPerSide: 6,
                    player1BotId: 'baseline-a',
                },
                phase4: {
                    stressMatrix: {
                        gamesPerPairing: 8,
                    },
                },
                phase41Promotion: {
                    holdoutGamesPerRole: 40,
                    performanceGate: {
                        minWinRate: 0.54,
                    },
                },
            }),
            'utf8',
        );

        const manifest = loadPhase0Manifest(customPath);
        expect(manifest.version).toBe('custom-v1');
        expect(manifest.bench.games).toBe(3);
        expect(manifest.bench.startSeed).toBe(DEFAULT_PHASE0_MANIFEST.bench.startSeed);
        expect(manifest.regression.includeBotSoak).toBe(false);
        expect(manifest.regression.vitestFiles).toEqual(DEFAULT_PHASE0_MANIFEST.regression.vitestFiles);
        expect(manifest.fixedMatchupBench.gamesPerSide).toBe(6);
        expect(manifest.fixedMatchupBench.player1BotId).toBe('baseline-a');
        expect(manifest.fixedMatchupBench.outputPath).toBe(DEFAULT_PHASE0_MANIFEST.fixedMatchupBench.outputPath);
        expect(manifest.phase4.stressMatrix.gamesPerPairing).toBe(8);
        expect(manifest.phase4.runtimeGateBaseline.avgMsPerGame).toBe(DEFAULT_PHASE0_MANIFEST.phase4.runtimeGateBaseline.avgMsPerGame);
        expect(manifest.phase4.performanceGate.minStrongV3WinRateVsStrongV2)
            .toBe(DEFAULT_PHASE0_MANIFEST.phase4.performanceGate.minStrongV3WinRateVsStrongV2);
        expect(manifest.phase41Promotion.holdoutGamesPerRole).toBe(40);
        expect(manifest.phase41Promotion.performanceGate.minWinRate).toBe(0.54);
        expect(manifest.phase41Promotion.performanceGate.minCi95Low)
            .toBe(DEFAULT_PHASE0_MANIFEST.phase41Promotion.performanceGate.minCi95Low);
        expect(manifest.phase41Promotion.tacticalKpiGate)
            .toEqual(DEFAULT_PHASE0_MANIFEST.phase41Promotion.tacticalKpiGate);
    });
});
