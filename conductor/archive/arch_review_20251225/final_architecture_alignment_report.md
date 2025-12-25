# Architecture Alignment Report: NivelArenaSimulator2

**Date:** 2025-12-25
**Subject:** Alignment of current codebase with Rule Fidelity and Future Headless AI Simulation.

## 1. Executive Summary
The current `NivelArenaSimulator2` logic is clean and well-separated from the UI, but requires significant improvements in **determinism** and **rule completeness** to become a reliable simulator. We recommend a prioritized refactoring plan focusing on Rule Engine Fidelity first, followed by infrastructure to support automated scenario testing.

## 2. Key Findings

### 2.1. Code Isolation (Phase 1)
*   **Status:** Good.
*   **Summary:** Core logic in `src/logic` has zero dependencies on DOM/UI.
*   **Risk:** High usage of `console.log` which may impact performance in high-speed simulations.

### 2.2. Determinism and RNG (Phase 2)
*   **Status:** Critical Deficiency.
*   **Summary:** Usage of `Math.random()` for shuffling and targeting prevents reproducibility.
*   **Action:** Implement a Seeded PRNG.

### 2.3. Rule Fidelity (Phase 2)
*   **Status:** Needs Expansion.
*   **Summary:** Most core mechanics are present, but many keyword effects (EXIT, ARMED, etc.) and complex turn phase logic (End Phase cleanup) are missing.
*   **Action:** Refactor `GameEngine` to support discrete combat steps and full turn lifecycle.

### 2.4. Testing Infrastructure (Phase 3)
*   **Status:** Strategic Design Ready.
*   **Summary:** A data-driven "Scenario-Based Testing" framework is designed to allow rapid rule verification without boilerplate.

## 3. Prioritized Refactoring Plan

| Priority | Task | Description |
| :--- | :--- | :--- |
| **P0** | **Seeded PRNG** | Replace all `Math.random()` to enable reproducible tests. |
| **P0** | **Scenario Runner** | Build the utility to execute JSON scenarios for rule verification. |
| **P1** | **Combat Refactor** | Split combat into Declaration, Defense, and Combat steps. |
| **P1** | **End Phase Logic** | Implement skill trashing and hand size limits. |
| **P2** | **Keyword Library** | Implement `EXIT`, `ARMED`, `MIX`, `ESCAPE`, and `LEVEL LINK`. |
| **P3** | **Headless Logger** | Abstract `console.log` behind a toggleable `Logger` interface. |

## 4. Impact on Project Tasks
*   `issues.md` and `totaltask.md` should be updated to reflect these P0 and P1 tasks.
*   The "Architecture Review" track is complete with this report.
