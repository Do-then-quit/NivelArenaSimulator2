import { describe, expect, it } from 'vitest';
import { parseSeedListCsv, resolveSeedSuiteSeeds } from '../../scripts/ai/seed_suites';

describe('AI Seed Suites', () => {
    it('loads phase3 seed suites and expands range entries', () => {
        const { file, seeds } = resolveSeedSuiteSeeds('artifacts/ai/seeds/phase3_v1.json', 'promotion-holdout');
        expect(file.version).toBe('phase3_v1');
        expect(seeds.length).toBe(220);
        expect(seeds[0]).toBe(2026033000);
        expect(seeds[seeds.length - 1]).toBe(2026033219);
    });

    it('parses explicit seed list csv deterministically', () => {
        const parsed = parseSeedListCsv('2026031001, 2026031007,2026031013');
        expect(parsed).toEqual([2026031001, 2026031007, 2026031013]);
    });
});
