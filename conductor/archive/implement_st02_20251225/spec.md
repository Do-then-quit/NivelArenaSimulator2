# Track Specification: Implement ST02 Card Effects

## 1. Overview
This track focuses on making the "ST02" starter deck fully playable by implementing the effects and mechanics for all cards contained within `ST02.json`. This involves bridging the raw data from the JSON file to the game engine, implementing missing combat sub-keywords, and writing dedicated logic and tests for each card.

## 2. Functional Requirements

### 2.1. Data Integration
-   **Source:** `ST02.json` (treated as raw scraped data).
-   **Task:** Update `src/logic/CardDatabase.ts` to correctly parse and map the raw JSON fields into the strict `Card` interface used by the `GameEngine`.
-   **Validation:** Ensure all cards load without type errors.

### 2.2. Missing Mechanics Implementation
-   **Combat Sub-Keywords:** Implement support for the following keywords in the combat resolution logic (likely `GameEngine.ts` or `RuleValidator.ts`):
    -   `PENETRATION` (Damage through blocks)
    -   `PLUNDER` (Steal/Gain resources on hit)
    -   `DUALIST` (Forced combat interactions)
    -   `PIERCE` (if applicable)

### 2.3. Card Logic Implementation
-   **Scope:** All card types (Units, Skills, Items, Leaders) in ST02.
-   **Implementation:** Map effect IDs/descriptions from the JSON to executable code in `src/logic/effectActions.ts`.

## 3. Testing & Verification
-   **Strategy:** Per-Card Unit Testing.
-   **Requirement:** Create a test file for *every* card ID (e.g., `tests/cards/ST02-001.test.ts`) using the Scenario-Based Testing Framework.
-   **Success Condition:** Each test must verify the card's specific activation conditions, effect resolution, and state updates.

## 4. Acceptance Criteria
-   [ ] `CardDatabase` successfully loads and validates all entries from `ST02.json`.
-   [ ] All 17 cards (ST02-001 to ST02-017) have corresponding logic implemented.
-   [ ] Combat keywords (`PENETRATION`, `PLUNDER`, `DUALIST`) function correctly in combat scenarios.
-   [ ] Automated tests exist and pass for every single card in the ST02 pack.
