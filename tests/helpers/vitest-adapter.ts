/**
 * Vitest Adapter for Unified Tests
 * 
 * This adapter converts UnifiedTestCase definitions into vitest test blocks.
 */

import { describe, it, expect } from 'vitest';
import { UnifiedTestCase, UnifiedTestModule } from '../../src/logic/cardTests/shared/types';
import { GameEngine } from '../../src/logic/GameEngine';
import { DUMMY_CARDS } from '../../src/logic/CardDatabase';
import { Card } from '../../src/logic/types';

/**
 * Get a fresh copy of a card from the database.
 */
function getCard(id: string): Card {
    const card = DUMMY_CARDS.find(c => c.id === id);
    if (!card) throw new Error(`Card ${id} not found`);
    return JSON.parse(JSON.stringify(card));
}

/**
 * Create a test engine with default setup.
 */
function createTestEngine(leaderId: string = 'ST01-001'): GameEngine {
    const leader = getCard(leaderId);
    const deck1 = Array(10).fill(null).map(() => getCard('ST01-002'));
    const deck2 = Array(10).fill(null).map(() => getCard('ST01-002'));
    return new GameEngine('P1', 'P2', deck1, deck2, leader, leader);
}

/**
 * Run a single unified test case in vitest.
 */
export function runUnifiedTest(test: UnifiedTestCase): void {
    it(test.name, () => {
        const engine = createTestEngine();

        // Setup
        test.setup(engine, getCard);

        // Verify
        const results = test.verify(engine, getCard);

        // Assert all results
        for (const result of results) {
            expect(result.pass, result.message).toBe(true);
        }
    });
}

/**
 * Run all tests from a unified test module as a vitest describe block.
 */
export function runUnifiedModule(module: UnifiedTestModule): void {
    describe(module.displayName, () => {
        // Group tests by testId
        const byCard = new Map<string, UnifiedTestCase[]>();
        for (const test of module.tests) {
            if (!byCard.has(test.testId)) {
                byCard.set(test.testId, []);
            }
            byCard.get(test.testId)!.push(test);
        }

        // Create nested describe blocks by card
        for (const [testId, tests] of byCard) {
            describe(testId, () => {
                for (const test of tests) {
                    runUnifiedTest(test);
                }
            });
        }
    });
}

/**
 * Run tests for a specific card from a module.
 */
export function runTestsForCard(module: UnifiedTestModule, testId: string): void {
    const tests = module.tests.filter(t => t.testId === testId);
    describe(`${testId} Tests`, () => {
        for (const test of tests) {
            runUnifiedTest(test);
        }
    });
}
