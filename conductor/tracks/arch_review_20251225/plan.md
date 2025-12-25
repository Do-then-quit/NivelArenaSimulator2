# Track Plan: Architecture Review and Alignment

## Phase 1: Core Logic Isolation Analysis
- [x] Task: Audit `src/logic` for Browser Dependencies [c8019d6]
    - [ ] Subtask: Scan `GameEngine.ts` and `RuleValidator.ts` for usages of `window`, `document`, or `console.log` (which might slow down training).
    - [ ] Subtask: Check imports to ensure no UI components are imported into the logic layer.
    - [ ] Subtask: Create a "Decoupling Report" listing any violations found.

## Phase 2: AI Readiness Assessment
- [ ] Task: Evaluate RNG Determinism
    - [ ] Subtask: Analyze how randomization (shuffling, critical hits) is currently handled.
    - [ ] Subtask: Propose a strategy for injecting a seeded RNG generator into `GameEngine`.
- [ ] Task: Assess State Serialization
    - [ ] Subtask: Review the `GameState` interface.
    - [ ] Subtask: Prototype a `serializeState()` function to see if all necessary data (including hidden info like decks) can be captured cleanly.
    - [ ] Subtask: Identify any circular references or non-serializable objects (like function closures) in the state.

## Phase 3: Performance and Logging Strategy
- [ ] Task: Performance Bottleneck Prediction
    - [ ] Subtask: Analyze the complexity of `processEffects` and main loop execution.
    - [ ] Subtask: Flag any O(N^2) or expensive operations that might run frequently.
- [ ] Task: Logging and Observation Design
    - [ ] Subtask: Draft a schema for `GameActionLog` that is machine-readable (not just human-readable strings).

## Phase 4: Final Report Generation
- [ ] Task: Compile "Architecture Alignment Report"
    - [ ] Subtask: Synthesize findings from previous phases.
    - [ ] Subtask: Create a prioritized list of refactoring tasks (e.g., "Refactor RNG," "Split UI from Logic").
    - [ ] Subtask: Update `issues.md` or `totaltask.md` with new architectural tasks.
- [ ] Task: Conductor - User Manual Verification 'Final Report Generation' (Protocol in workflow.md)
