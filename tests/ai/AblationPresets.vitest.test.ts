import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

interface AblationPresetFile {
    version: string;
    seedSuiteVersion: string;
    presets: Array<{
        id: string;
        botId: string;
        options: Record<string, boolean>;
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
});
