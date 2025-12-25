# Track Plan: Architecture Review and Alignment

## Phase 1: Core Logic Isolation Analysis [checkpoint: c8ec7b9]
- [x] Task: Audit `src/logic` for Browser Dependencies [c8019d6]
    - [ ] Subtask: Scan `GameEngine.ts` and `RuleValidator.ts` for usages of `window`, `document`, or `console.log` (which might slow down training).
    - [ ] Subtask: Check imports to ensure no UI components are imported into the logic layer.
    - [ ] Subtask: Create a "Decoupling Report" listing any violations found.

## Phase 2: Rule Engine Fidelity Assessment [checkpoint: 73974c6]
- [x] Task: Evaluate RNG Determinism (for Reproducible Testing) [e5c3381]
    - [ ] Subtask: Analyze randomization to ensure test cases are reproducible.
    - [ ] Subtask: Propose a seeded RNG strategy for debugging.
- [x] Task: Rule Implementation Gap Analysis [dd47ef2]
    - [ ] Subtask: Compare `src/logic` implementation against `NivelArena_Comprehensive_Rules_Ver.1.6.pdf`.
    - [ ] Subtask: Identify missing core mechanics (e.g., specific timing priorities, complex targeting, interrupt windows).
    - [ ] Subtask: Create a "Rule Compliance Report".

## Phase 3: Testing Infrastructure Strategy
- [x] Task: Design Scenario-Based Test Framework [b11ae69]
    - [ ] Subtask: Review existing `DebugManager` tests.
    - [ ] Subtask: Design a standard JSON/Script format for defining game scenarios (Setup -> Action -> Expected Outcome) to allow rapid rule verification.

## Phase 4: Final Report Generation
- [ ] Task: Compile "Architecture Alignment Report"
    - [ ] Subtask: Synthesize findings from previous phases.
    - [ ] Subtask: Create a prioritized list of refactoring tasks (e.g., "Refactor RNG," "Rule Gaps").
    - [ ] Subtask: Update `issues.md` or `totaltask.md` with new architectural tasks.
- [ ] Task: Conductor - User Manual Verification 'Final Report Generation' (Protocol in workflow.md)
