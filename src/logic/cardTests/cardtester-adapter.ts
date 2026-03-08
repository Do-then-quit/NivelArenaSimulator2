/**
 * CardTester Adapter for Unified Tests
 * 
 * This module converts UnifiedTestCase definitions into the CardTester format
 * (setupScenarios + runTests) for use in the UI.
 */

import { UnifiedTestModule } from './shared/types';
import { CardTestModule, CardTestContext } from './types';

function buildScenarioId(testId: string, ordinal: number): string {
    return `${testId}::${String(ordinal).padStart(2, '0')}`;
}

/**
 * Convert a UnifiedTestModule into a CardTestModule for use by CardTester.
 */
export function adaptUnifiedModule(module: UnifiedTestModule): CardTestModule {
    const setupScenarios: Record<string, (ctx: CardTestContext) => string> = {};
    const runTests: Record<string, (ctx: CardTestContext) => Promise<void>> = {};
    const displayNames: Record<string, string> = {};
    const scenarioCountsByCard = new Map<string, number>();

    for (const test of module.tests) {
        const ordinal = (scenarioCountsByCard.get(test.testId) || 0) + 1;
        scenarioCountsByCard.set(test.testId, ordinal);
        const scenarioId = buildScenarioId(test.testId, ordinal);

        setupScenarios[scenarioId] = (ctx: CardTestContext) => {
            test.setup(ctx.engine, ctx.getCard);
            return test.description;
        };

        runTests[scenarioId] = async (ctx: CardTestContext) => {
            ctx.log(`Running: ${test.name}`);

            // Run each case on a fresh engine to keep UI CardTester
            // behavior aligned with isolated vitest execution.
            ctx.resetEngine?.();
            test.setup(ctx.engine, ctx.getCard);
            const results = test.verify(ctx.engine, ctx.getCard);

            for (const result of results) {
                ctx.assert(result.pass, result.message);
            }
        };

        displayNames[scenarioId] = `${test.testId} · ${test.name}`;
    }

    return { setupScenarios, runTests, displayNames };
}

/**
 * Create a combined CardTestModule from multiple unified modules.
 */
export function combineModules(modules: UnifiedTestModule[]): Record<string, CardTestModule> {
    const result: Record<string, CardTestModule> = {};
    for (const module of modules) {
        result[module.packId] = adaptUnifiedModule(module);
    }
    return result;
}
