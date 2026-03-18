import fs from 'node:fs';
import path from 'node:path';
import { Bt05NikkiMainPhaseHoldPolicy } from './Bt05NikkiMainPhaseHoldPolicy';

const DEFAULT_POLICY_ARTIFACT_PATH = path.resolve('artifacts/ai/rl/bt05_nikki_hold_policy/latest.json');

interface HoldPolicyArtifactShape {
    policy?: Bt05NikkiMainPhaseHoldPolicy;
    entries?: Bt05NikkiMainPhaseHoldPolicy['entries'];
}

function isPolicyShape(value: unknown): value is Bt05NikkiMainPhaseHoldPolicy {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<Bt05NikkiMainPhaseHoldPolicy>;
    return typeof candidate.id === 'string'
        && typeof candidate.label === 'string'
        && typeof candidate.minSamples === 'number'
        && typeof candidate.minHoldRate === 'number'
        && typeof candidate.minAverageReturnToGo === 'number'
        && !!candidate.entries
        && typeof candidate.entries === 'object';
}

export function parseBt05NikkiMainPhaseHoldPolicyArtifact(raw: unknown): Bt05NikkiMainPhaseHoldPolicy {
    if (isPolicyShape(raw)) {
        return raw;
    }

    if (raw && typeof raw === 'object' && isPolicyShape((raw as HoldPolicyArtifactShape).policy)) {
        return (raw as HoldPolicyArtifactShape).policy!;
    }

    throw new Error('Invalid BT05 Nikki main-phase hold policy artifact.');
}

export function loadBt05NikkiMainPhaseHoldPolicy(filePath: string): Bt05NikkiMainPhaseHoldPolicy {
    const resolved = path.resolve(filePath);
    const raw = JSON.parse(fs.readFileSync(resolved, 'utf8'));
    return parseBt05NikkiMainPhaseHoldPolicyArtifact(raw);
}

export function resolveBt05NikkiMainPhaseHoldPolicyFromEnv(): Bt05NikkiMainPhaseHoldPolicy | undefined {
    const rawPath = process.env.AI_NIKKI_HOLD_POLICY_PATH;
    if (rawPath && rawPath.trim().length > 0) {
        return loadBt05NikkiMainPhaseHoldPolicy(rawPath.trim());
    }
    if (!fs.existsSync(DEFAULT_POLICY_ARTIFACT_PATH)) return undefined;
    return loadBt05NikkiMainPhaseHoldPolicy(DEFAULT_POLICY_ARTIFACT_PATH);
}
