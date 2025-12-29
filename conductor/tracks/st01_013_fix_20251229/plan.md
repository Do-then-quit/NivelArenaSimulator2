# Plan: Fix ST01-013 Skill Logic and Implement Trash Selection UI

## Phase 1: Core Logic Fixes (TDD) [checkpoint: 555a503]
- [x] Task: Write failing test for ST01-013 Trash selection logic. ed27e52
- [x] Task: Implement `TargetSelector` fix for `MY_TRASH` scope. ed27e52
- [x] Task: Verify ST01-013 Trash logic with tests. ed27e52
- [x] Task: Conductor - User Manual Verification 'Core Logic Fixes' (Protocol in workflow.md)

## Phase 2: Engine & Interaction Refinement [checkpoint: 3a905c4]
- [x] Task: Write test for `selectTrashTarget` action in `GameEngine`. b50af14
- [x] Task: Implement `selectTrashTarget` and update `SELECT_TARGET` handling for Trash. b50af14
- [x] Task: Refactor `EffectManager` to support Trash target selection flow. b50af14
- [x] Task: Conductor - User Manual Verification 'Engine & Interaction Refinement' (Protocol in workflow.md)

## Phase 3: UI Implementation [checkpoint: 31c039c]

- [x] Task: Create `TrashSelectionModal` component/logic in `main.ts`.

- [x] Task: Implement modal display logic when `SELECT_TARGET` mode has `MY_TRASH` scope.

- [x] Task: Add CSS styling for the Trash selection modal.

- [x] Task: Integrate `selectTrashTarget` call with UI selection.

- [x] Task: Conductor - User Manual Verification 'UI Implementation' (Protocol in workflow.md)

## Phase 4: Final Verification & Cleanup
- [ ] Task: Run full regression tests for ST01.
- [ ] Task: Perform manual verification of ST01-013 in the browser.
- [ ] Task: Conductor - User Manual Verification 'Final Verification & Cleanup' (Protocol in workflow.md)
