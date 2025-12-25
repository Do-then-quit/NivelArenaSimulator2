# Decoupling and Architecture Audit Report

**Date:** 2025-12-25
**Scope:** `src/logic` (specifically `GameEngine.ts`, `RuleValidator.ts`, and helper modules)

## 1. Browser Dependencies
The goal is to run the game engine in a headless Node.js environment for AI training.

### Findings:
*   **Global Objects (`window`, `document`):**
    *   **Status:** **CLEAN** (mostly).
    *   No direct access to `window` or `document` was found in the core logic (`GameEngine.ts`, `RuleValidator.ts`, `effects.ts`).
    *   `DebugManager.ts` contains log strings referencing `window.debug`, but does not functionally depend on the `window` object existing (it expects the consumer to handle the assignment).
*   **Console Usage:**
    *   **Status:** **HIGH USAGE**.
    *   `GameEngine.ts`, `DebugManager.ts`, `effectActions.ts`, and `effects.ts` heavily use `console.log`, `console.warn`, and `console.group`.
    *   **Impact:** While `console` exists in Node.js, excessive logging slows down training loops (millions of iterations).
    *   **Recommendation:** Abstract logging behind a `Logger` interface that can be silenced or redirected.

## 2. Import Structure
The goal is to ensure Logic does not import UI.

### Findings:
*   **Status:** **PASS**.
*   All imports in `src/logic` are relative neighbors (e.g., `./types`, `./GameEngine`).
*   No imports were found from `../ui`, `../components`, or `../assets`.
*   The `CardDatabase` imports static data, which is acceptable.

## 3. RNG and Determinism
The goal is to support seeded execution for reproducible replays and AI training.

### Findings:
*   **Status:** **FAIL**.
*   **Shuffling:** `GameEngine.ts` (L49) uses `Math.random()` for deck shuffling.
*   **ID Generation:** `GameEngine.ts`, `effectActions.ts` use `Math.random().toString(36)` to generate UUIDs for buffs and internal objects.
*   **Random Targeting:** `TargetSelector.ts` (L72) uses `Math.random()` to pick random targets (`.sort(() => 0.5 - Math.random())`).
*   **Impact:** It is impossible to replay a game state or seed an AI environment with the current implementation.
*   **Recommendation:** Inject a `RandomProvider` or `PRNG` class into `GameEngine` constructor.

## 4. Summary of Action Items
1.  **Refactor RNG:** Replace all `Math.random()` calls with a seeded generator passed via dependency injection.
2.  **Abstract Logging:** Replace `console.log` with a configurable `GameLogger`.
3.  **State Serialization:** (Upcoming Task) Ensure the unique IDs generated are consistent or serializable.
