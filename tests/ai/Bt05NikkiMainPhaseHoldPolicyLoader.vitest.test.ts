import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
    loadBt05NikkiMainPhaseHoldPolicy,
    parseBt05NikkiMainPhaseHoldPolicyArtifact,
    resolveBt05NikkiMainPhaseHoldPolicyFromEnv,
} from '../../src/logic/ai/practice/Bt05NikkiMainPhaseHoldPolicyLoader';

const envBackup = process.env.AI_NIKKI_HOLD_POLICY_PATH;

afterEach(() => {
    if (envBackup === undefined) {
        delete process.env.AI_NIKKI_HOLD_POLICY_PATH;
        return;
    }
    process.env.AI_NIKKI_HOLD_POLICY_PATH = envBackup;
});

describe('BT05 Nikki main-phase hold policy loader', () => {
    it('parses either a raw policy or a training report wrapper', () => {
        const policy = {
            id: 'policy-1',
            label: 'Policy 1',
            minSamples: 2,
            minHoldRate: 0.8,
            minAverageReturnToGo: 0,
            entries: {
                foo: {
                    samples: 2,
                    holdCount: 2,
                    continueCount: 0,
                    holdRate: 1,
                    avgReturnToGo: 0.5,
                },
            },
        };

        expect(parseBt05NikkiMainPhaseHoldPolicyArtifact(policy)).toEqual(policy);
        expect(parseBt05NikkiMainPhaseHoldPolicyArtifact({ policy })).toEqual(policy);
    });

    it('loads a policy artifact from env-backed file path', () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nikki-hold-loader-'));
        const filePath = path.join(tempDir, 'policy.json');
        const policy = {
            policy: {
                id: 'policy-2',
                label: 'Policy 2',
                minSamples: 1,
                minHoldRate: 1,
                minAverageReturnToGo: 0,
                entries: {},
            },
        };

        try {
            fs.writeFileSync(filePath, JSON.stringify(policy), 'utf8');
            process.env.AI_NIKKI_HOLD_POLICY_PATH = filePath;

            expect(loadBt05NikkiMainPhaseHoldPolicy(filePath).id).toBe('policy-2');
            expect(resolveBt05NikkiMainPhaseHoldPolicyFromEnv()?.id).toBe('policy-2');
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });
});
