import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { UX_HARNESS_SCENARIOS, type UxHarnessScenarioDefinition } from '../../scripts/ux/uxHarnessScenarios';

const ARTIFACT_ROOT = path.resolve(process.cwd(), 'artifacts', 'ux-harness');
const RAW_DIR = path.join(ARTIFACT_ROOT, 'raw');
const SCREENSHOT_DIR = path.join(ARTIFACT_ROOT, 'screenshots');

interface ScenarioObservation {
    capturedAt: string;
    screenshotPath: string;
    viewport: { width: number; height: number };
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
    nextPhaseDisabled: boolean;
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

interface ScenarioAssertion {
    id: string;
    passed: boolean;
    detail: string;
}

function ensureArtifactDirs(): void {
    fs.mkdirSync(RAW_DIR, { recursive: true });
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function waitForActivePhase(page: import('@playwright/test').Page, phaseLabel: string): Promise<void> {
    await expect(page.getByTestId('phase-ribbon')).toBeVisible();
    await expect
        .poll(async () => {
            const text = await page.locator('.phase-ribbon-meta strong').textContent();
            return (text ?? '').replace(/\s+/g, ' ').trim();
        }, { timeout: 15_000 })
        .toContain(phaseLabel);
}

async function runQuickPlayFlow(page: import('@playwright/test').Page, phaseLabel: string): Promise<void> {
    await page.goto('/');
    await page.getByTestId('menu-quick-play-btn').click();

    for (let index = 0; index < 2; index += 1) {
        await expect(page.getByTestId('mulligan-keep-cta')).toBeVisible();
        await page.getByTestId('mulligan-keep-cta').click();
        await page.waitForTimeout(150);
    }

    await expect(page.getByTestId('mulligan-keep-cta')).toHaveCount(0, { timeout: 10_000 });
    await waitForActivePhase(page, phaseLabel);
}

async function openCheckpoint(page: import('@playwright/test').Page, checkpoint: string, phaseLabel: string): Promise<void> {
    await page.goto(`/?uxCheckpoint=${checkpoint}`);
    await waitForActivePhase(page, phaseLabel);
    await page.waitForTimeout(450);
}

async function collectObservation(
    page: import('@playwright/test').Page,
    definition: UxHarnessScenarioDefinition,
    pageErrors: string[],
    consoleErrors: string[],
): Promise<ScenarioObservation> {
    const screenshotPath = path.join(SCREENSHOT_DIR, `${definition.id}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    const activePhaseText = ((await page.locator('.phase-ribbon-meta strong').textContent()) ?? '').replace(/\s+/g, ' ').trim();
    const actionGroupTestIds = await page.locator('[data-testid^="ux-action-group-"]').evaluateAll((nodes) => (
        nodes
            .map((node) => node.getAttribute('data-testid'))
            .filter((value): value is string => Boolean(value))
    ));
    const mandatoryQueueVisible = await page.getByTestId('mandatory-queue').count() > 0;
    const mandatoryQueueReadable = mandatoryQueueVisible
        ? await page.getByTestId('mandatory-queue').evaluate((node) => {
            const rect = node.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return false;
            const sampleX = rect.left + Math.min(rect.width / 2, Math.max(rect.width - 8, 8));
            const sampleY = rect.top + Math.min(rect.height / 2, 24);
            const topNode = document.elementFromPoint(sampleX, sampleY);
            return !!topNode && (topNode === node || node.contains(topNode));
        })
        : true;
    const mandatoryProgressLocator = page.getByTestId('mandatory-queue-progress');
    const mandatoryProgressVisible = await mandatoryProgressLocator.count() > 0;
    const mandatoryProgressText = mandatoryProgressVisible
        ? (((await mandatoryProgressLocator.first().textContent()) ?? '').trim())
        : '';
    const toastKinds = await page.getByTestId('ux-toast-item').evaluateAll((nodes) => (
        nodes
            .map((node) => node.getAttribute('data-toast-kind'))
            .filter((value): value is string => Boolean(value))
    ));
    const nextPhaseLocator = page.getByTestId('next-phase-cta');
    const nextPhaseVisible = await nextPhaseLocator.count() > 0;
    const nextPhaseDisabled = nextPhaseVisible
        ? await nextPhaseLocator.evaluate((node) => (node as HTMLButtonElement).disabled)
        : false;
    const viewport = page.viewportSize() ?? { width: 0, height: 0 };

    return {
        capturedAt: new Date().toISOString(),
        screenshotPath: path.relative(process.cwd(), screenshotPath).replace(/\\/g, '/'),
        viewport,
        activePhaseText,
        phaseRibbonVisible: await page.getByTestId('phase-ribbon').isVisible(),
        attackStepVisible: await page.getByTestId('attack-step-bar').count() > 0,
        mandatoryQueueVisible,
        mandatoryQueueReadable,
        mandatoryProgressVisible,
        mandatoryProgressText,
        actionGroupTestIds,
        actionSubjectCount: await page.getByTestId('ux-action-subject').count(),
        actionRowCount: await page.getByTestId('ux-action-row').count(),
        disabledSummaryCount: await page.getByTestId('ux-action-disabled-summary').count(),
        confirmTargetsVisible: await page.getByTestId('confirm-targets-cta').count() > 0,
        nextPhaseVisible,
        nextPhaseDisabled,
        selectionBadgeCount: await page.getByTestId('selection-progress-badge').count(),
        auditTrailCount: await page.locator('.audit-trail-item').count(),
        logEntryCount: await page.locator('.fx-log-entry').count(),
        toastKinds,
        toastStackInTopBarCount: await page.locator('.game-top-bar [data-testid="ux-toast-stack"]').count(),
        toastStackInControlsCount: await page.locator('.game-controls [data-testid="ux-toast-stack"]').count(),
        mulliganModalVisible: await page.getByTestId('mulligan-keep-cta').count() > 0,
        pageErrors,
        consoleErrors,
    };
}

function buildAssertions(definition: UxHarnessScenarioDefinition, observation: ScenarioObservation): ScenarioAssertion[] {
    return [
        {
            id: 'phase-ribbon-visible',
            passed: observation.phaseRibbonVisible,
            detail: 'phase ribbon should be visible on every scenario',
        },
        {
            id: 'phase-match',
            passed: observation.activePhaseText.includes(definition.expectedPhase),
            detail: `expected active phase to include ${definition.expectedPhase}, received: ${observation.activePhaseText}`,
        },
        {
            id: 'action-group',
            passed: observation.actionGroupTestIds.includes(`ux-action-group-${definition.expectedActionGroup}`),
            detail: `expected action group ux-action-group-${definition.expectedActionGroup}`,
        },
        {
            id: 'mandatory-queue',
            passed: observation.mandatoryQueueVisible === definition.expectMandatoryQueue,
            detail: `mandatory queue visible=${observation.mandatoryQueueVisible}, expected=${definition.expectMandatoryQueue}`,
        },
        {
            id: 'attack-step-bar',
            passed: observation.attackStepVisible === definition.expectAttackStep,
            detail: `attack step visible=${observation.attackStepVisible}, expected=${definition.expectAttackStep}`,
        },
        {
            id: 'confirm-targets',
            passed: observation.confirmTargetsVisible === definition.expectConfirmTargets,
            detail: `confirm-targets visible=${observation.confirmTargetsVisible}, expected=${definition.expectConfirmTargets}`,
        },
        {
            id: 'next-phase-cta',
            passed: definition.expectNextPhase
                ? observation.nextPhaseVisible && !observation.nextPhaseDisabled
                : !observation.nextPhaseVisible || observation.nextPhaseDisabled,
            detail: `next-phase visible=${observation.nextPhaseVisible}, disabled=${observation.nextPhaseDisabled}, expectedEnabled=${definition.expectNextPhase}`,
        },
        {
            id: 'disabled-summary',
            passed: definition.expectDisabledSummary ? observation.disabledSummaryCount > 0 : true,
            detail: `disabled summary count=${observation.disabledSummaryCount}`,
        },
        {
            id: 'mandatory-queue-readable',
            passed: definition.expectMandatoryQueue ? observation.mandatoryQueueReadable : true,
            detail: `mandatory queue readable=${observation.mandatoryQueueReadable}`,
        },
        {
            id: 'toast-stack-location',
            passed: observation.toastStackInTopBarCount === 0,
            detail: `toast stack in top bar count=${observation.toastStackInTopBarCount}`,
        },
    ];
}

function persistScenarioReport(
    definition: UxHarnessScenarioDefinition,
    observation: ScenarioObservation,
    assertions: ScenarioAssertion[],
): void {
    const payload = {
        id: definition.id,
        label: definition.label,
        source: definition.source,
        checkpoint: definition.checkpoint ?? null,
        expectations: definition,
        observation,
        assertions,
    };
    const targetPath = path.join(RAW_DIR, `${definition.id}.json`);
    fs.writeFileSync(targetPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

test.describe.serial('game ux harness', () => {
    test.beforeAll(() => {
        ensureArtifactDirs();
    });

    for (const definition of UX_HARNESS_SCENARIOS) {
        test(definition.label, async ({ page }) => {
            const pageErrors: string[] = [];
            const consoleErrors: string[] = [];

            page.on('pageerror', (error) => {
                pageErrors.push(error.message);
            });
            page.on('console', (message) => {
                if (message.type() === 'error') {
                    consoleErrors.push(message.text());
                }
            });

            if (definition.source === 'quick-play') {
                await runQuickPlayFlow(page, definition.expectedPhase);
            } else if (definition.checkpoint) {
                await openCheckpoint(page, definition.checkpoint, definition.expectedPhase);
            }

            if (definition.expectMandatoryQueue) {
                await expect(page.getByTestId('mandatory-queue')).toBeVisible();
            } else {
                await expect(page.getByTestId('mandatory-queue')).toHaveCount(0);
            }

            if (definition.expectAttackStep) {
                await expect(page.getByTestId('attack-step-bar')).toBeVisible();
            }

            if (definition.expectConfirmTargets) {
                await expect(page.getByTestId('confirm-targets-cta')).toBeVisible();
            }

            if (definition.expectNextPhase) {
                await expect(page.getByTestId('next-phase-cta')).toBeEnabled();
            } else if (await page.getByTestId('next-phase-cta').count() > 0) {
                await expect(page.getByTestId('next-phase-cta')).toBeDisabled();
            }

            await expect(page.getByTestId(`ux-action-group-${definition.expectedActionGroup}`)).toBeVisible();

            const observation = await collectObservation(page, definition, pageErrors, consoleErrors);
            const assertions = buildAssertions(definition, observation);
            persistScenarioReport(definition, observation, assertions);

            for (const assertion of assertions) {
                expect(assertion.passed, `${definition.id}: ${assertion.id} - ${assertion.detail}`).toBeTruthy();
            }
        });
    }
});
