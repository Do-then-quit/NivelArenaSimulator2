# NivelArena Simulator Context

## 1. Project Overview
**NivelArena Simulator** is a high-performance, web-based simulator for the NivelArena TCG. It serves two main purposes:
1.  **Web GUI:** A polished, interactive browser experience for human players.
2.  **Headless Engine:** A fast, logic-only mode for AI training and simulations.

**Tech Stack:**
*   **Core:** TypeScript (v5.2+)
*   **Build:** Vite (v5.0+)
*   **Testing:** Vitest (v4.0+)
*   **Styling:** Vanilla CSS (Glassmorphism, responsive)

## 2. Architecture
The project follows a **Hybrid Architecture** decoupling logic from presentation:

*   **`src/logic/`**: Contains the pure game engine (`GameEngine.ts`), rule validation (`RuleValidator.ts`), and effect handling (`EffectManager`). This layer has *no* DOM dependencies.
*   **`src/logic/cardEffects/`**: Modularized card effect definitions.
*   **`src/`**: Contains the UI layer (`main.ts`, `SetupUI.ts`) which consumes the logic layer.
*   **`tests/`**: Contains unit and scenario-based tests.

## 3. Workflow: "Conductor"
This project adheres to a strict development workflow known as **Conductor**.

### Core Principles
*   **Plan is Truth:** All work is tracked in `plan.md` (or specific track plans).
*   **Official Rules:** If you need to refer to the official NivelArena rules during implementation, consult the `rules_text.txt` file.
*   **TDD is Mandatory:** Write failing tests *before* implementation.
*   **Quality Gates:** >80% coverage, strict linting.

### Task Lifecycle
1.  **Mark In Progress:** Update the plan to mark the task as `[~]`.
2.  **Red (Test):** Write a failing test case in `tests/`.
3.  **Green (Implement):** Write minimal code to pass the test.
4.  **Refactor:** Optimize without changing behavior.
5.  **Verify:** Ensure standard adherence and coverage.
6.  **Document & Commit:** Update `tech-stack.md` if needed. Commit with strict message format (`type(scope): message`).
7.  **Git Note:** Attach a detailed summary to the commit using `git notes`.
8.  **Update Plan:** Mark as `[x]` with the commit SHA in the plan.

### Note on Plans
If a user refers to a "plan", they likely mean a file within **`conductor/tracks/`** (e.g., `conductor/tracks/<track_id>/plan.md`) or the master tracking file **`conductor/tracks.md`**. Always verify which plan is active.

## 4. Key Commands
*   **Start Dev Server:** `npm run dev`
*   **Run Tests:** `npm test` (runs Vitest)
*   **Build:** `npm run build`
*   **Preview Build:** `npm run preview`

## 5. Coding Conventions (TypeScript)
*   **No `any`:** Use strict typing or `unknown`.
*   **Variables:** `const` by default. No `var`.
*   **Visibility:** Explicit `private`/`protected`.
*   **Style:** Google TypeScript Style Guide.
*   **Idioms:** Functional approach where possible, immutability preferred for state updates.

## 6. Directory Map
*   `conductor/`: Project management, guidelines, and plans.
*   `src/logic/`: Game mechanics (Engine, Rules, Effects).
*   `packs/`: JSON data for card sets.
*   `public/assets/`: Images and static resources.
