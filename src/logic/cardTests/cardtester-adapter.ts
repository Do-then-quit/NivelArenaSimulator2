/**
 * CardTester Adapter for Unified Tests
 * 
 * This module converts UnifiedTestCase definitions into the CardTester format
 * (setupScenarios + runTests) for use in the UI.
 */

import { UnifiedTestModule } from './shared/types';
import { CardTestModule, CardTestContext } from './types';

/**
 * Convert a UnifiedTestModule into a CardTestModule for use by CardTester.
 */
export function adaptUnifiedModule(module: UnifiedTestModule): CardTestModule {
    const setupScenarios: Record<string, (ctx: CardTestContext) => string> = {};
    const runTests: Record<string, (ctx: CardTestContext) => Promise<void>> = {};

    const seenCardIds = new Set<string>();
    for (const test of module.tests) {
        if (seenCardIds.has(test.cardId)) {
            throw new Error(
                `Duplicate cardId detected: ${test.cardId}. Use unique case ids like ${test.cardId}-Trigger.`
            );
        }
        seenCardIds.add(test.cardId);

        setupScenarios[test.cardId] = (ctx: CardTestContext) => {
            test.setup(ctx.engine, ctx.getCard);
            return test.description;
        };

        runTests[test.cardId] = async (ctx: CardTestContext) => {
            ctx.log(`Running: ${test.name}`);
            const results = test.verify(ctx.engine, ctx.getCard);
            for (const result of results) {
                ctx.assert(result.pass, result.message);
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
