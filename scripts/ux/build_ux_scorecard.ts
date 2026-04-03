import fs from 'node:fs';
import path from 'node:path';
import {
    UX_HARNESS_SCENARIOS,
    UX_HARNESS_SCORE_WEIGHTS,
    UX_HARNESS_THRESHOLDS,
    type UxHarnessScenarioDefinition,
} from './uxHarnessScenarios';

const ARTIFACT_ROOT = path.resolve(process.cwd(), 'artifacts', 'ux-harness');
const RAW_DIR = path.join(ARTIFACT_ROOT, 'raw');
const SCORECARD_JSON_PATH = path.join(ARTIFACT_ROOT, 'scorecard.json');
const SCORECARD_MD_PATH = path.join(ARTIFACT_ROOT, 'scorecard.md');

interface ScenarioObservation {
    screenshotPath: string;
    activePhaseText: string;
    phaseRibbonVisible: boolean;
    attackStepVisible: boolean;
    mandatoryQueueVisible: boolean;
    mandatoryQueueReadable: boolean;
    mandatoryProgressVisible: boolean;
    mandatoryProgressText: string;
    actionGroupTestIds: string[];
    actionSubjectCount: number;
    actionRowCount: number;
    disabledSummaryCount: number;
    confirmTargetsVisible: boolean;
    nextPhaseVisible: boolean;
    selectionBadgeCount: number;
    auditTrailCount: number;
    logEntryCount: number;
    toastKinds: string[];
    toastStackInTopBarCount: number;
    toastStackInControlsCount: number;
    mulliganModalVisible: boolean;
    pageErrors: string[];
    consoleErrors: string[];
}

interface RawScenarioReport {
    id: string;
    label: string;
    source: 'quick-play' | 'checkpoint';
    checkpoint: string | null;
    expectations: UxHarnessScenarioDefinition;
    observation: ScenarioObservation;
    assertions: Array<{ id: string; passed: boolean; detail: string }>;
}

interface CategoryScore {
    score: number;
    max: number;
    notes: string[];
}

interface ScenarioScorecard {
    id: string;
    label: string;
    source: 'quick-play' | 'checkpoint';
    checkpoint: string | null;
    screenshotPath: string;
    categoryScores: {
        rulesAccuracy: CategoryScore;
        phaseStepVisibility: CategoryScore;
        actionClarity: CategoryScore;
        timingCausality: CategoryScore;
        visualStability: CategoryScore;
    };
    total: number;
    maxTotal: number;
    failedAssertions: Array<{ id: string; detail: string }>;
    mandatoryHiddenCount: number;
}

function requireRawScenario(id: string): RawScenarioReport {
    const targetPath = path.join(RAW_DIR, `${id}.json`);
    if (!fs.existsSync(targetPath)) {
        throw new Error(`UX harness raw artifact is missing: ${targetPath}`);
    }
    return JSON.parse(fs.readFileSync(targetPath, 'utf8')) as RawScenarioReport;
}

function createCategoryScore(max: number): CategoryScore {
    return { score: 0, max, notes: [] };
}

function clampCategoryScore(category: CategoryScore): CategoryScore {
    category.score = Math.min(category.score, category.max);
    return category;
}

function scoreScenario(raw: RawScenarioReport): ScenarioScorecard {
    const { expectations, observation } = raw;
    const rulesAccuracy = createCategoryScore(UX_HARNESS_SCORE_WEIGHTS.rulesAccuracy);
    const phaseStepVisibility = createCategoryScore(UX_HARNESS_SCORE_WEIGHTS.phaseStepVisibility);
    const actionClarity = createCategoryScore(UX_HARNESS_SCORE_WEIGHTS.actionClarity);
    const timingCausality = createCategoryScore(UX_HARNESS_SCORE_WEIGHTS.timingCausality);
    const visualStability = createCategoryScore(UX_HARNESS_SCORE_WEIGHTS.visualStability);

    if (observation.phaseRibbonVisible) {
        rulesAccuracy.score += 14;
        phaseStepVisibility.score += 8;
    } else {
        rulesAccuracy.notes.push('phase ribbon is not visible');
        phaseStepVisibility.notes.push('phase ribbon is not visible');
    }

    if (observation.activePhaseText.includes(expectations.expectedPhase)) {
        rulesAccuracy.score += 14;
        phaseStepVisibility.score += 4;
    } else {
        rulesAccuracy.notes.push(`active phase mismatch: ${observation.activePhaseText}`);
        phaseStepVisibility.notes.push(`active phase mismatch: ${observation.activePhaseText}`);
    }

    if (observation.actionGroupTestIds.includes(`ux-action-group-${expectations.expectedActionGroup}`)) {
        rulesAccuracy.score += 6;
        actionClarity.score += 6;
    } else {
        rulesAccuracy.notes.push(`missing action group: ${expectations.expectedActionGroup}`);
        actionClarity.notes.push(`missing action group: ${expectations.expectedActionGroup}`);
    }

    if (observation.mandatoryQueueVisible === expectations.expectMandatoryQueue) {
        rulesAccuracy.score += 6;
    } else {
        rulesAccuracy.notes.push(`mandatory queue visibility mismatch: ${observation.mandatoryQueueVisible}`);
    }

    if (observation.attackStepVisible === expectations.expectAttackStep) {
        phaseStepVisibility.score += 4;
    } else {
        phaseStepVisibility.notes.push(`attack-step visibility mismatch: ${observation.attackStepVisible}`);
    }

    if (observation.toastStackInTopBarCount === 0) {
        phaseStepVisibility.score += 4;
    } else {
        phaseStepVisibility.notes.push('toast stack is still rendered inside the top bar');
    }

    if (!expectations.expectAttackStep || observation.attackStepVisible) {
        phaseStepVisibility.score += 4;
    } else {
        phaseStepVisibility.notes.push('attack step bar is missing in a combat timing window');
    }

    if (observation.actionSubjectCount > 0) {
        actionClarity.score += 6;
    } else {
        actionClarity.notes.push('action subjects are not rendered');
    }

    if (observation.actionRowCount > 0) {
        actionClarity.score += 4;
    } else {
        actionClarity.notes.push('action rows are not rendered');
    }

    if (!expectations.expectDisabledSummary || observation.disabledSummaryCount > 0) {
        actionClarity.score += 4;
    } else {
        actionClarity.notes.push('disabled action summary is missing');
    }

    if ((expectations.expectNextPhase && observation.nextPhaseVisible) || (expectations.expectConfirmTargets && observation.confirmTargetsVisible) || (!expectations.expectNextPhase && !expectations.expectConfirmTargets)) {
        actionClarity.score += 6;
    } else {
        actionClarity.notes.push('primary CTA visibility does not match the timing window');
    }

    if (observation.auditTrailCount > 0) {
        timingCausality.score += 5;
    } else {
        timingCausality.notes.push('audit trail entries are missing');
    }

    if (observation.logEntryCount > 0 || observation.toastKinds.length > 0) {
        timingCausality.score += 5;
    } else {
        timingCausality.notes.push('toast/log feedback is missing');
    }

    if (!expectations.expectMandatoryQueue || (observation.mandatoryProgressVisible && observation.mandatoryQueueReadable)) {
        timingCausality.score += 5;
    } else {
        timingCausality.notes.push(`mandatory queue progress is missing or unreadable: ${observation.mandatoryProgressText || 'none'}`);
    }

    const screenshotExists = fs.existsSync(path.resolve(process.cwd(), observation.screenshotPath));
    if (observation.pageErrors.length === 0 && observation.consoleErrors.length === 0) {
        visualStability.score += 3;
    } else {
        visualStability.notes.push(`runtime errors: ${[...observation.pageErrors, ...observation.consoleErrors].join(' | ')}`);
    }

    if (screenshotExists) {
        visualStability.score += 1;
    } else {
        visualStability.notes.push(`screenshot missing: ${observation.screenshotPath}`);
    }

    const mandatoryHiddenCount = observation.mandatoryQueueVisible && !observation.mandatoryQueueReadable ? 1 : 0;
    if (mandatoryHiddenCount === 0) {
        visualStability.score += 1;
    } else {
        visualStability.notes.push('mandatory queue appears hidden behind another layer');
    }

    clampCategoryScore(rulesAccuracy);
    clampCategoryScore(phaseStepVisibility);
    clampCategoryScore(actionClarity);
    clampCategoryScore(timingCausality);
    clampCategoryScore(visualStability);

    const total = rulesAccuracy.score
        + phaseStepVisibility.score
        + actionClarity.score
        + timingCausality.score
        + visualStability.score;

    return {
        id: raw.id,
        label: raw.label,
        source: raw.source,
        checkpoint: raw.checkpoint,
        screenshotPath: observation.screenshotPath,
        categoryScores: {
            rulesAccuracy,
            phaseStepVisibility,
            actionClarity,
            timingCausality,
            visualStability,
        },
        total,
        maxTotal: 100,
        failedAssertions: raw.assertions.filter((assertion) => !assertion.passed),
        mandatoryHiddenCount,
    };
}

function average(values: number[]): number {
    if (values.length === 0) return 0;
    return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

function renderMarkdown(summary: {
    generatedAt: string;
    scenarioCount: number;
    totalAverage: number;
    categoryAverages: Record<string, number>;
    mandatoryHiddenCount: number;
    passes: boolean;
    scenarios: ScenarioScorecard[];
}): string {
    const lines: string[] = [];
    lines.push('# UX Harness Scorecard');
    lines.push('');
    lines.push(`- generatedAt: ${summary.generatedAt}`);
    lines.push(`- scenarios: ${summary.scenarioCount}`);
    lines.push(`- totalAverage: ${summary.totalAverage} / 100`);
    lines.push(`- 룰 정확성: ${summary.categoryAverages.rulesAccuracy} / ${UX_HARNESS_SCORE_WEIGHTS.rulesAccuracy}`);
    lines.push(`- 페이즈/스텝 가시성: ${summary.categoryAverages.phaseStepVisibility} / ${UX_HARNESS_SCORE_WEIGHTS.phaseStepVisibility}`);
    lines.push(`- 행동 명확성: ${summary.categoryAverages.actionClarity} / ${UX_HARNESS_SCORE_WEIGHTS.actionClarity}`);
    lines.push(`- 타이밍/원인 설명력: ${summary.categoryAverages.timingCausality} / ${UX_HARNESS_SCORE_WEIGHTS.timingCausality}`);
    lines.push(`- 시각적 안정성: ${summary.categoryAverages.visualStability} / ${UX_HARNESS_SCORE_WEIGHTS.visualStability}`);
    lines.push(`- mandatoryHiddenCount: ${summary.mandatoryHiddenCount}`);
    lines.push(`- gate: ${summary.passes ? 'PASS' : 'FAIL'}`);
    lines.push('');
    lines.push('| Scenario | Total | Rules | Visibility | Action | Timing | Stability | Screenshot |');
    lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |');
    summary.scenarios.forEach((scenario) => {
        lines.push(`| ${scenario.label} | ${scenario.total} | ${scenario.categoryScores.rulesAccuracy.score} | ${scenario.categoryScores.phaseStepVisibility.score} | ${scenario.categoryScores.actionClarity.score} | ${scenario.categoryScores.timingCausality.score} | ${scenario.categoryScores.visualStability.score} | ${scenario.screenshotPath} |`);
    });
    lines.push('');
    lines.push('## Findings');
    const failingScenarioCount = summary.scenarios.filter((scenario) => scenario.failedAssertions.length > 0).length;
    if (failingScenarioCount === 0) {
        lines.push('- no findings');
    } else {
        summary.scenarios.forEach((scenario) => {
            scenario.failedAssertions.forEach((finding) => {
                lines.push(`- ${scenario.id}: ${finding.id} — ${finding.detail}`);
            });
        });
    }
    return `${lines.join('\n')}\n`;
}

function main(): void {
    fs.mkdirSync(ARTIFACT_ROOT, { recursive: true });
    const scenarios = UX_HARNESS_SCENARIOS.map((definition) => scoreScenario(requireRawScenario(definition.id)));

    const categoryAverages = {
        rulesAccuracy: average(scenarios.map((scenario) => scenario.categoryScores.rulesAccuracy.score)),
        phaseStepVisibility: average(scenarios.map((scenario) => scenario.categoryScores.phaseStepVisibility.score)),
        actionClarity: average(scenarios.map((scenario) => scenario.categoryScores.actionClarity.score)),
        timingCausality: average(scenarios.map((scenario) => scenario.categoryScores.timingCausality.score)),
        visualStability: average(scenarios.map((scenario) => scenario.categoryScores.visualStability.score)),
    };
    const totalAverage = average(scenarios.map((scenario) => scenario.total));
    const mandatoryHiddenCount = scenarios.reduce((sum, scenario) => sum + scenario.mandatoryHiddenCount, 0);
    const passes = totalAverage >= UX_HARNESS_THRESHOLDS.total
        && categoryAverages.rulesAccuracy >= UX_HARNESS_THRESHOLDS.rulesAccuracy
        && categoryAverages.actionClarity >= UX_HARNESS_THRESHOLDS.actionClarity
        && categoryAverages.timingCausality >= UX_HARNESS_THRESHOLDS.timingCausality
        && mandatoryHiddenCount === UX_HARNESS_THRESHOLDS.mandatoryHiddenCount;

    const summary = {
        generatedAt: new Date().toISOString(),
        thresholds: UX_HARNESS_THRESHOLDS,
        weights: UX_HARNESS_SCORE_WEIGHTS,
        scenarioCount: scenarios.length,
        totalAverage,
        categoryAverages,
        mandatoryHiddenCount,
        passes,
        scenarios,
    };

    fs.writeFileSync(SCORECARD_JSON_PATH, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
    fs.writeFileSync(SCORECARD_MD_PATH, renderMarkdown(summary), 'utf8');

    if (!passes) {
        process.exitCode = 1;
    }
}

main();
