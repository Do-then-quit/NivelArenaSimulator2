# Plan: Implement ST03 Card Effects

## Phase 1: Infrastructure & Keyword Support [checkpoint: d200552]
Implement the core logic for the new keywords `공멸` (Mutual Destruction) and `종결` (Termination) within the `GameEngine` or `ActionRegistry`.

- [x] Task: Implement `MUTUAL_DESTRUCTION` logic in `GameEngine` (handle during combat resolution).
- [x] Task: Implement `TERMINATE_ATTACK` action in `ActionRegistry`.
- [x] Task: Verify `EXIT` activation triggers correctly for all unit removal scenarios (combat, effects).
- [x] Task: Conductor - User Manual Verification 'Infrastructure & Keyword Support' (Protocol in workflow.md)

## Phase 2: ST03-001 to ST03-005 (Leaders & Low Cost Units)
- [ ] Task: Create `src/logic/cardEffects/st03.ts` and register it in `CardDatabase.ts`.
- [ ] Task: Implement `ST03-001` (Modernia Leader) - Awakening and Passive.
- [ ] Task: Implement `ST03-003` (Privaty) - Exit and Trigger (Hand Trash).
- [ ] Task: Implement `ST03-005` (Novel) - Entry (Encounter Trash).
- [ ] Task: Create `tests/st03_001_005.test.ts` and verify effects.
- [ ] Task: Conductor - User Manual Verification 'ST03-001 to ST03-005' (Protocol in workflow.md)

## Phase 3: ST03-006 to ST03-010 (Mid Cost Units)
- [ ] Task: Implement `ST03-006` (Sakura) - Exit (Draw).
- [ ] Task: Implement `ST03-007` (D) - Exit (Mutual Destruction).
- [ ] Task: Implement `ST03-008` (Exia) - Passive (Exit Power Buff).
- [ ] Task: Implement `ST03-010` (Rosanna) - Exit (Trash to Hand) and Trigger.
- [ ] Task: Create `tests/st03_006_010.test.ts` and verify effects.
- [ ] Task: Conductor - User Manual Verification 'ST03-006 to ST03-010' (Protocol in workflow.md)

## Phase 4: ST03-011 to ST03-017 (High Cost & Support)
- [ ] Task: Implement `ST03-011` (Modernia Unit) - Entry (Hand Trash for Kill).
- [ ] Task: Implement `ST03-012` (Surprise Attack) - Skill (Hand Trash).
- [ ] Task: Implement `ST03-013` (Blackening) - Skill (Hand Trash to Field Trash).
- [ ] Task: Implement `ST03-014` (Sense Sharing) - Skill (Field Trash to Draw).
- [ ] Task: Implement `ST03-015` (Come On!) - Skill (Field Trash to Encounter Trash).
- [ ] Task: Implement `ST03-016` (Kevlar Vest) - Item (Power & Termination).
- [ ] Task: Implement `ST03-017` (Rare Metal Amguard) - Item (Exit Mutual Destruction).
- [ ] Task: Create `tests/st03_011_017.test.ts` and verify effects.
- [ ] Task: Conductor - User Manual Verification 'ST03-011 to ST03-017' (Protocol in workflow.md)

## Phase 5: Final Integration & Regression
- [ ] Task: Create `tests/st03_full_regression.test.ts` with comprehensive scenarios.
- [ ] Task: Run all ST03 tests and ensure 100% pass rate.
- [ ] Task: Verify deck validation rules for ST03-001 (Storm cards only).
- [ ] Task: Conductor - User Manual Verification 'Final Integration & Regression' (Protocol in workflow.md)
