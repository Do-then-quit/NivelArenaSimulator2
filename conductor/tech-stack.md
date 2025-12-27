# Tech Stack

## Core Technologies
- **Language:** [TypeScript](https://www.typescriptlang.org/) (v5.2.2+) - Used for both core game logic and UI components to ensure type safety and maintainability.
- **Build Tool / Dev Server:** [Vite](https://vitejs.dev/) (v5.0.0+) - Provides a fast development environment and optimized production builds.

## Game Engine Architecture
- **Domain Logic:** Vanilla TypeScript implementation located in `src/logic/`. This ensures the engine is decoupled from the UI, facilitating headless execution for AI training.
- **Keyword Support:** Built-in logic for core NivelArena keywords like PENETRATION, PLUNDER, DUALIST, and BREAKTHROUGH.
- **State Management:** Centralized state within `GameEngine.ts`, managing phases, resources, and card movements.
- **Card Database:** Modularized database loading multiple [JSON packs](./packs/) with set-specific effect logic organized in `src/logic/cardEffects/`.
- **Testing Infrastructure:** A custom Scenario-Based Test Framework for data-driven rule validation using JSON-defined game states and actions.

## Development & Tooling
- **Package Manager:** [npm](https://www.npmjs.com/)
- **Compiler:** `tsc` for static type checking.
- **Utilities:** `axios` for potential remote data fetching, `ts-node` for running scripts/simulations in Node.js.
