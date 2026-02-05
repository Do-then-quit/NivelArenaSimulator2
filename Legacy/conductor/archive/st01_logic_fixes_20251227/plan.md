# Plan: ST01 Card Logic and Rule Processing Fixes

This plan addresses the identified logic bugs in ST01 cards and ensures all cards in the pack are correctly implemented according to the NivelArena Comprehensive Rules Ver. 1.6.

## Phase 1: Core Rule Engine Adjustments

### Task: Implement ATK <= 0 Trashing Rule
- [x] **Write Failing Test:** Create a test case where a unit's power is reduced to 0 by an effect (e.g., Noir) and verify it is not currently trashed.
- [x] **Implement:** Update `GameEngine.ts` or `RuleValidator.ts` to check unit power after every effect application and move units with <= 0 ATK to the Trash.
- [x] **Verify:** Run the test and confirm the unit is trashed.

### Task: Automate "Encounter Unit" Target Selection
- [x] **Write Failing Test:** Create a test for Noir (ST01-006) that expects the effect to apply without requiring a `TargetSelector` choice.
- [x] **Implement:** Modify `TargetSelector.ts` or the specific card effect logic in `src/logic/cardEffects/` to automatically resolve "Encounter Unit" targets based on lane position.
- [x] **Verify:** Run the test and confirm no manual selection is prompted.

### Task: Conductor - User Manual Verification 'Phase 1: Core Rule Engine' (Protocol in workflow.md)
- [x] Task: Conductor - User Manual Verification 'Phase 1: Core Rule Engine' (Protocol in workflow.md)

## Phase 2: ST01 Card Logic Fixes

### Task: Fix Rapi (ST01-001) Leader Awakening
- [x] **Write Failing Test:** Verify Rapi does not awaken at level 5 currently.
- [x] **Implement:** Update the awakening logic for ST01-001 to trigger at level 5.
- [x] **Verify:** Confirm awakening occurs at exactly level 5.

### Task: Fix Besti (ST01-003) & Attacker Keywords
- [x] **Write Failing Test:** Verify Besti's power increase doesn't resolve in time for combat trashing.
- [x] **Implement:** Ensure `Attacker` keyword power buffs are correctly calculated during the power comparison in `GameEngine.ts`.
- [x] **Verify:** Besti (2500) trashes a 3000 ATK unit.

### Task: Fix Blanc (ST01-008) Passive Logic
- [x] **Write Failing Test:** Confirm Blanc incorrectly buffs herself.
- [x] **Implement:** Update Blanc's passive effect to filter for units that actually possess the `Attacker` keyword.
- [x] **Verify:** Blanc's ATK remains base unless she gains the keyword.

### Task: Fix Rapi (ST01-011) Penetration
- [x] **Write Failing Test:** Verify trashing a unit with Rapi doesn't deal damage to the opponent.
- [x] **Implement:** Fix the `PENETRATION` sub-keyword trigger in `effectActions.ts` or combat resolution logic.
- [x] **Verify:** Opponent takes 1 damage when Rapi trashes a unit.

### Task: Conductor - User Manual Verification 'Phase 2: Card Fixes' (Protocol in workflow.md)
- [x] Task: Conductor - User Manual Verification 'Phase 2: Card Fixes' (Protocol in workflow.md)

## Phase 3: Comprehensive ST01 Validation & Regression

### Task: Audit and Test All ST01 Cards
- [x] **Task:** Create/Update tests for each card from ST01-001 to ST01-017.
- [x] **Verify:** Ensure every card's text effect is covered by at least one unit test.

### Task: Final Regression & Standards Check
- [x] **Action:** Run all tests in the project.
- [x] **Action:** Run linting and type checking (`npm run lint`, `tsc`).

### Task: Conductor - User Manual Verification 'Phase 3: Validation' (Protocol in workflow.md)
- [x] Task: Conductor - User Manual Verification 'Phase 3: Validation' (Protocol in workflow.md)