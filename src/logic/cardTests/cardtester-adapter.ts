/**
 * CardTester Adapter for Unified Tests
 * 
 * This module converts UnifiedTestCase definitions into the CardTester format
 * (setupScenarios + runTests) for use in the UI.
 */

import { UnifiedTestCase, UnifiedTestModule } from './shared/types';
import { CardTestModule, CardTestContext } from './types';

/**
 * Convert a UnifiedTestModule into a CardTestModule for use by CardTester.
 */
export function adaptUnifiedModule(module: UnifiedTestModule): CardTestModule {
    const setupScenarios: Record<string, (ctx: CardTestContext) => string> = {};
    const runTests: Record<string, (ctx: CardTestContext) => Promise<void>> = {};

    // Group tests by testId, use first test for scenario, combine all for run
    const byCard = new Map<string, UnifiedTestCase[]>();
    for (const test of module.tests) {
        if (!byCard.has(test.testId)) {
            byCard.set(test.testId, []);
        }
        byCard.get(test.testId)!.push(test);
    }

    for (const [testId, tests] of byCard) {
        // Setup uses first test's setup
        const firstTest = tests[0];
        setupScenarios[testId] = (ctx: CardTestContext) => {
            firstTest.setup(ctx.engine, ctx.getCard);
            return firstTest.description;
        };

        // Run combines all tests for this test ID
        runTests[testId] = async (ctx: CardTestContext) => {
            for (const test of tests) {
                ctx.log(`Running: ${test.name}`);

                // Run each case on a fresh engine to keep UI CardTester
                // behavior aligned with isolated vitest execution.
                ctx.resetEngine?.();
                test.setup(ctx.engine, ctx.getCard);
                const results = test.verify(ctx.engine, ctx.getCard);

                for (const result of results) {
                    ctx.assert(result.pass, result.message);
                }
            }
        };
    }

    return { setupScenarios, runTests };
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
