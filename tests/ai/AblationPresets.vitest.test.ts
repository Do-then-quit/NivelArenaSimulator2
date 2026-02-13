import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

interface AblationPresetFile {
    version: string;
    seedSuiteVersion: string;
    presets: Array<{
        id: string;
        botId: string;
        options: Record<string, unknown>;
    }>;
}

describe('AI Ablation Presets', () => {
    it('defines phase3 ablation presets for all major feature toggles', () => {
        const raw = fs.readFileSync('artifacts/ai/ablation/phase3_v1_presets.json', 'utf8');
        const parsed = JSON.parse(raw) as AblationPresetFile;

        expect(parsed.version).toBe('phase3_v1');
        expect(parsed.seedSuiteVersion).toBe('phase3_v1');
        expect(parsed.presets.length).toBeGreaterThanOrEqual(5);

        const presetIds = parsed.presets.map(preset => preset.id);
        expect(presetIds).toContain('v3_full');
        expect(presetIds).toContain('v3_no_interaction_rollout');
        expect(presetIds).toContain('v3_no_opponent_reply');
        expect(presetIds).toContain('v3_no_resource_model');
        expect(presetIds).toContain('v3_no_anti_oscillation');
    });

    it('defines phase4.1 ablation presets with seed-suite budget presets', () => {
        const raw = fs.readFileSync('artifacts/ai/ablation/phase4_1_v1_presets.json', 'utf8');
        const parsed = JSON.parse(raw) as AblationPresetFile & {
            budgetPresets?: Record<string, {
                beamWidth: number;
                interactionRolloutDepth: number;
                opponentReplyTopK: number;
            }>;
        };

        expect(parsed.version).toBe('phase4_1_v1');
        expect(parsed.seedSuiteVersion).toBe('phase3_v1');
        expect(parsed.presets.length).toBeGreaterThanOrEqual(5);

        const presetIds = parsed.presets.map(preset => preset.id);
        expect(presetIds).toContain('v3_baseline_reference');
        expect(presetIds).toContain('v3_1_topk3_weighted');
        expect(presetIds).toContain('v3_1_topk3_mean');
        expect(presetIds).toContain('v3_1_topk5_weighted');
        expect(presetIds).toContain('v3_1_topk3_no_reply_ply');

        const budgets = parsed.budgetPresets;
        expect(budgets).toBeTruthy();
        expect(budgets?.tuning).toBeTruthy();
        expect(budgets?.dev).toBeTruthy();
        expect(budgets?.['promotion-holdout']).toBeTruthy();

        const holdoutBudget = budgets?.['promotion-holdout'];
        expect(holdoutBudget?.beamWidth).toBeGreaterThan(0);
        expect(holdoutBudget?.interactionRolloutDepth).toBeGreaterThan(0);
        expect(holdoutBudget?.opponentReplyTopK).toBeGreaterThanOrEqual(1);
    });
});
