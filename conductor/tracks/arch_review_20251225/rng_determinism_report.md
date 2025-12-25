# RNG Determinism Report

## 1. Current State
The simulator currently uses `Math.random()` in several critical areas, making it impossible to reproduce specific game scenarios or bug reports from a sequence of actions alone.

### Locations found:
*   `GameEngine.ts`: `shuffle()` method.
*   `TargetSelector.ts`: `RANDOM` select mode.
*   `GameEngine.ts`: Player ID generation.
*   `effectActions.ts`: Buff/Object ID generation.

## 2. Impact on Testing
*   **Non-deterministic failures:** A test might fail once and never again, making debugging extremely difficult.
*   **Rule Validation:** Verifying "random" effects (like "Apply to a random unit") requires statistical testing rather than precise verification unless the seed is fixed.
*   **Replays:** We cannot support a "Copy Seed" feature for users to share bug reports.

## 3. Proposed Strategy: Seeded PRNG
We should introduce a `RandomProvider` interface and a `SeededRandom` implementation (e.g., using the LCG or Mulberry32 algorithm).

### Implementation Steps:
1.  **Define Interface:**
    ```typescript
    interface RandomProvider {
        next(): number; // Returns 0..1
        shuffle<T>(array: T[]): T[];
        nextId(): string;
    }
    ```
2.  **Inject into GameEngine:**
    Modify the `GameEngine` constructor to accept an optional `seed`. If not provided, use `Date.now()`.
3.  **Refactor Callsites:**
    *   `GameEngine` will use `this.rng.shuffle()`.
    *   `TargetSelector` will receive the engine's RNG via the `context`.
    *   IDs will be generated using a deterministic counter or seeded string generation.

## 4. Recommendation for Immediate Action
Implementing a seeded RNG should be a "Quick Win" prioritized before we start deep rule fidelity checks, as it will make every subsequent test reliable.
