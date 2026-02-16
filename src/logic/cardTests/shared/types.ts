/**
 * Unified Test Types
 * 
 * These types allow the same test definitions to be used by both:
 * - Vitest (console/CI testing)
 * - CardTester (UI interactive testing)
 */

import { GameEngine } from '../../GameEngine';
import { Card, Phase } from '../../types';

/** Function type for getting cards from database */
export type GetCardFn = (id: string) => Card;

/** Result of a single assertion in a test */
export interface TestResult {
    pass: boolean;
    message: string;
}

/**
 * Unified test case that can be run by any test runner.
 * 
 * @example
 * ```ts
 * const test: UnifiedTestCase = {
 *     testId: 'BT01-001',
 *     name: 'Leader Awakening',
 *     description: '레벨업하여 리더 각성 확인',
 *     setup: (engine, getCard) => {
 *         engine.currentPlayer.leaderLevel = 5;
 *         engine.state.phase = Phase.LEVEL_UP;
 *     },
 *     verify: (engine) => {
 *         engine.nextPhase();
 *         return [{ pass: engine.currentPlayer.levelZone?.isAwakened, message: '각성됨' }];
 *     }
 * };
 * ```
 */
export interface UnifiedTestCase {
    /** Test ID shown and used by runners (e.g., 'BT01-001-Trigger') */
    testId: string;

    /** Short test name */
    name: string;

    /** Description shown in UI - instructions for manual testing */
    description: string;

    /** 
     * Setup the game state for this test.
     * Called before user interaction or auto-verification.
     */
    setup: (engine: GameEngine, getCard: GetCardFn) => void;

    /**
     * Verify the expected outcomes.
     * Can perform actions (like nextPhase) and return assertion results.
     * @returns Array of test results (all should pass for test to pass)
     */
    verify: (engine: GameEngine, getCard: GetCardFn) => TestResult[];
}

/**
 * A collection of unified tests, organized by pack/attribute.
 */
export interface UnifiedTestModule {
    packId: string;
    displayName: string;
    tests: UnifiedTestCase[];
}

// Re-export Phase for convenience in test files
export { Phase };
