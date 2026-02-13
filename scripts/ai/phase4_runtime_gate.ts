import { MatchBatchReport } from './run_match_batch';

export interface Phase4RuntimeGateThresholds {
    p50MsPerActionMultiplier: number;
    p95MsPerActionMultiplier: number;
    avgMsPerGameMultiplier: number;
}

export interface Phase4RuntimeBaseline {
    p50MsPerAction: number;
    p95MsPerAction: number;
    avgMsPerGame: number;
}

export interface Phase4RuntimeStats {
    p50MsPerAction: number;
    p95MsPerAction: number;
    avgMsPerGame: number;
}

export interface Phase4RuntimeGateCheckResult {
    pass: boolean;
    reasons: string[];
    thresholds: Phase4RuntimeGateThresholds;
    baseline: Phase4RuntimeBaseline;
    actual: Phase4RuntimeStats;
}

function roundTo(value: number, digits: number): number {
    const p = 10 ** digits;
    return Math.round(value * p) / p;
}

function percentile(values: number[], ratio: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const clamped = Math.max(0, Math.min(1, ratio));
    const index = Math.min(sorted.length - 1, Math.floor(clamped * (sorted.length - 1)));
    return sorted[index];
}

function ensureNonNegativeFinite(value: number): number {
    if (!Number.isFinite(value) || value < 0) return 0;
    return value;
}

export function computePhase4RuntimeStats(reports: MatchBatchReport[]): Phase4RuntimeStats {
    const perAction: number[] = [];
    const perGame: number[] = [];

    for (const report of reports) {
        if (!report.summary.runtime.enabled) continue;
        const pAction = ensureNonNegativeFinite(report.summary.runtime.msPerAction);
        const pGame = ensureNonNegativeFinite(report.summary.runtime.avgMsPerGame);
        if (pAction > 0) perAction.push(pAction);
        if (pGame > 0) perGame.push(pGame);
    }

    return {
        p50MsPerAction: roundTo(percentile(perAction, 0.5), 4),
        p95MsPerAction: roundTo(percentile(perAction, 0.95), 4),
        avgMsPerGame: roundTo(perGame.length === 0 ? 0 : perGame.reduce((a, b) => a + b, 0) / perGame.length, 2),
    };
}

export function checkPhase4RuntimeGate(
    reports: MatchBatchReport[],
    baseline: Phase4RuntimeBaseline,
    thresholds: Phase4RuntimeGateThresholds,
): Phase4RuntimeGateCheckResult {
    const reasons: string[] = [];
    const actual = computePhase4RuntimeStats(reports);

    if (actual.p50MsPerAction <= 0 || actual.p95MsPerAction <= 0 || actual.avgMsPerGame <= 0) {
        reasons.push('runtime telemetry missing or zero; run with runtime measurement enabled');
    }

    const p50Limit = baseline.p50MsPerAction * thresholds.p50MsPerActionMultiplier;
    const p95Limit = baseline.p95MsPerAction * thresholds.p95MsPerActionMultiplier;
    const avgLimit = baseline.avgMsPerGame * thresholds.avgMsPerGameMultiplier;

    if (actual.p50MsPerAction > p50Limit) {
        reasons.push(`p50 ms/action gate failed: actual=${actual.p50MsPerAction}, limit=${roundTo(p50Limit, 4)}`);
    }
    if (actual.p95MsPerAction > p95Limit) {
        reasons.push(`p95 ms/action gate failed: actual=${actual.p95MsPerAction}, limit=${roundTo(p95Limit, 4)}`);
    }
    if (actual.avgMsPerGame > avgLimit) {
        reasons.push(`avg ms/game gate failed: actual=${actual.avgMsPerGame}, limit=${roundTo(avgLimit, 2)}`);
    }

    return {
        pass: reasons.length === 0,
        reasons,
        thresholds,
        baseline,
        actual,
    };
}
