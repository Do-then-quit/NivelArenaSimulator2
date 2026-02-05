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

    // Group tests by cardId, use first test for scenario, combine all for run
    const byCard = new Map<string, UnifiedTestCase[]>();
    for (const test of module.tests) {
        if (!byCard.has(test.cardId)) {
            byCard.set(test.cardId, []);
        }
        byCard.get(test.cardId)!.push(test);
    }

    for (const [cardId, tests] of byCard) {
        // Setup uses first test's setup
        const firstTest = tests[0];
        setupScenarios[cardId] = (ctx: CardTestContext) => {
            firstTest.setup(ctx.engine, ctx.getCard);
            return firstTest.description;
        };

        // Run combines all tests for this card
        runTests[cardId] = async (ctx: CardTestContext) => {
            for (const test of tests) {
                ctx.log(`Running: ${test.name}`);

                // Re-setup for each test (fresh state)
                // Note: In UI, user already triggered setup, so we skip setup here
                // and just run verify
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
