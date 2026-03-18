import fs from 'node:fs';
import path from 'node:path';
import { Bt05NikkiMainPhaseHoldPolicy } from '../../src/logic/ai/practice/Bt05NikkiMainPhaseHoldPolicy';
import { Bt05NikkiSelfPlayExportReport } from './run_bt05_nikki_selfplay_export';

export interface Bt05NikkiMainPhaseHoldPolicyTrainingConfig {
    inputPaths: string[];
    outputPath?: string;
    minSamples: number;
    minHoldRate: number;
    minAverageReturnToGo: number;
    policyId: string;
    label: string;
}

export interface Bt05NikkiMainPhaseHoldPolicyTrainingReport {
    generatedAt: string;
    config: Bt05NikkiMainPhaseHoldPolicyTrainingConfig;
    inputs: Array<{
        path: string;
        episodeCount: number;
        transitionCount: number;
    }>;
    policy: Bt05NikkiMainPhaseHoldPolicy;
    summary: {
        episodeCount: number;
        transitionCount: number;
        eligibleTransitionCount: number;
        signatureCount: number;
        retainedEntryCount: number;
        avgHoldRate: number;
    };
}

interface AggregatedPolicyEntry {
    samples: number;
    holdCount: number;
    continueCount: number;
    returnSum: number;
}

function roundTo(value: number, digits: number): number {
    const p = 10 ** digits;
    return Math.round(value * p) / p;
}

function safeDivide(numerator: number, denominator: number): number {
    if (denominator <= 0) return 0;
    return numerator / denominator;
}

function parseFloatEnv(name: string, fallback: number): number {
    const raw = process.env[name];
    if (!raw) return fallback;
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function parseIntEnv(name: string, fallback: number): number {
    const raw = process.env[name];
    if (!raw) return fallback;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function parseInputPaths(raw: string | undefined): string[] {
    if (!raw) return [];
    return raw.split(',').map(token => token.trim()).filter(token => token.length > 0);
}

function resolveOutputPath(defaultOutputPath: string): string | undefined {
    const raw = process.env.AI_NIKKI_HOLD_POLICY_OUTPUT;
    if (!raw || raw.trim().length === 0) return defaultOutputPath;
    const normalized = raw.trim().toLowerCase();
    if (normalized === '-' || normalized === 'none' || normalized === 'off') return undefined;
    return raw.trim();
}

function readSelfPlayExportReport(filePath: string): Bt05NikkiSelfPlayExportReport {
    const resolved = path.resolve(filePath);
    return JSON.parse(fs.readFileSync(resolved, 'utf8')) as Bt05NikkiSelfPlayExportReport;
}

function writeJson(targetPath: string | undefined, value: unknown): void {
    if (!targetPath) return;
    const resolved = path.resolve(targetPath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, JSON.stringify(value, null, 2), 'utf8');
}

export function trainBt05NikkiMainPhaseHoldPolicy(
    config: Bt05NikkiMainPhaseHoldPolicyTrainingConfig,
): Bt05NikkiMainPhaseHoldPolicyTrainingReport {
    const inputs = config.inputPaths.map(readSelfPlayExportReport);
    const aggregated = new Map<string, AggregatedPolicyEntry>();
    let episodeCount = 0;
    let transitionCount = 0;
    let eligibleTransitionCount = 0;

    for (const input of inputs) {
        episodeCount += input.episodes.length;
        for (const episode of input.episodes) {
            transitionCount += episode.transitions.length;
            for (const transition of episode.transitions) {
                if (!transition.mainPhaseHoldSignature) continue;
                eligibleTransitionCount += 1;
                const current = aggregated.get(transition.mainPhaseHoldSignature) ?? {
                    samples: 0,
                    holdCount: 0,
                    continueCount: 0,
                    returnSum: 0,
                };
                current.samples += 1;
                if (transition.chosenAction.type === 'NEXT_PHASE') {
                    current.holdCount += 1;
                } else {
                    current.continueCount += 1;
                }
                current.returnSum += transition.returnToGoFromActorPerspective;
                aggregated.set(transition.mainPhaseHoldSignature, current);
            }
        }
    }

    const entries = Object.fromEntries(
        [...aggregated.entries()]
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([signature, entry]) => [
                signature,
                {
                    samples: entry.samples,
                    holdCount: entry.holdCount,
                    continueCount: entry.continueCount,
                    holdRate: roundTo(safeDivide(entry.holdCount, entry.samples), 4),
                    avgReturnToGo: roundTo(safeDivide(entry.returnSum, entry.samples), 4),
                },
            ]),
    );

    const policy: Bt05NikkiMainPhaseHoldPolicy = {
        id: config.policyId,
        label: config.label,
        minSamples: config.minSamples,
        minHoldRate: config.minHoldRate,
        minAverageReturnToGo: config.minAverageReturnToGo,
        entries,
    };
    const retainedEntryCount = Object.values(entries).filter(entry => (
        entry.samples >= config.minSamples
        && entry.holdRate >= config.minHoldRate
        && entry.avgReturnToGo >= config.minAverageReturnToGo
    )).length;
    const avgHoldRate = roundTo(
        safeDivide(
            Object.values(entries).reduce((sum, entry) => sum + entry.holdRate, 0),
            Math.max(1, Object.keys(entries).length),
        ),
        4,
    );

    return {
        generatedAt: new Date().toISOString(),
        config,
        inputs: inputs.map((input, index) => ({
            path: path.resolve(config.inputPaths[index]),
            episodeCount: input.episodes.length,
            transitionCount: input.episodes.reduce((sum, episode) => sum + episode.transitions.length, 0),
        })),
        policy,
        summary: {
            episodeCount,
            transitionCount,
            eligibleTransitionCount,
            signatureCount: Object.keys(entries).length,
            retainedEntryCount,
            avgHoldRate,
        },
    };
}

export function formatBt05NikkiMainPhaseHoldPolicyTrainingSummary(
    report: Bt05NikkiMainPhaseHoldPolicyTrainingReport,
): string {
    return [
        `BT05 Nikki main-phase hold policy training`,
        `inputs=${report.inputs.length}`,
        `episodes=${report.summary.episodeCount}`,
        `transitions=${report.summary.transitionCount}`,
        `eligible=${report.summary.eligibleTransitionCount}`,
        `signatures=${report.summary.signatureCount}`,
        `retained=${report.summary.retainedEntryCount}`,
        `avgHoldRate=${report.summary.avgHoldRate}`,
    ].join('\n');
}

function buildConfigFromEnv(): Bt05NikkiMainPhaseHoldPolicyTrainingConfig {
    const defaultOutputPath = path.join('artifacts', 'ai', 'rl', 'bt05_nikki_hold_policy', 'latest.json');
    const inputPaths = parseInputPaths(process.env.AI_NIKKI_HOLD_POLICY_INPUTS);
    if (inputPaths.length === 0) {
        throw new Error('AI_NIKKI_HOLD_POLICY_INPUTS must contain at least one self-play export JSON path.');
    }

    return {
        inputPaths,
        outputPath: resolveOutputPath(defaultOutputPath),
        minSamples: parseIntEnv('AI_NIKKI_HOLD_POLICY_MIN_SAMPLES', 3),
        minHoldRate: Math.max(0, Math.min(1, parseFloatEnv('AI_NIKKI_HOLD_POLICY_MIN_HOLD_RATE', 0.7))),
        minAverageReturnToGo: Math.max(-1, Math.min(1, parseFloatEnv('AI_NIKKI_HOLD_POLICY_MIN_AVG_RETURN', 0))),
        policyId: process.env.AI_NIKKI_HOLD_POLICY_ID ?? 'bt05-nikki-main-phase-hold-v1',
        label: process.env.AI_NIKKI_HOLD_POLICY_LABEL ?? 'BT05 Nikki Main Phase Hold v1',
    };
}

function runCli(): void {
    const config = buildConfigFromEnv();
    const report = trainBt05NikkiMainPhaseHoldPolicy(config);
    writeJson(config.outputPath, report);
    console.log(formatBt05NikkiMainPhaseHoldPolicyTrainingSummary(report));
    if (config.outputPath) {
        console.log(`artifact=${path.resolve(config.outputPath)}`);
    }
}

const maybeMain = process.argv[1] ?? '';
if (maybeMain.endsWith('train_bt05_nikki_main_phase_hold_policy.ts') || maybeMain.endsWith('train_bt05_nikki_main_phase_hold_policy.js')) {
    runCli();
}
