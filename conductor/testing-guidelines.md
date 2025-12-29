# Testing Guidelines

## Overview
NivelArena uses a combination of automated unit tests (Vitest) and manual scenario tests (DebugManager). Scenario tests are essential for verifying visual feedback, UI interactions, and complex game states that are difficult to fully automate or require human-in-the-loop verification.

## Scenario Tests (DebugManager)

### Definition
A "Scenario Test" is a predefined game state setup in the `DebugManager.ts` that allows a developer to immediately verify a specific card's mechanics or a game rule in the browser environment.

### Naming Convention
All scenario setup methods in `DebugManager` must follow this pattern:
`setup[CardID]_Scenario()`
Example: `setupST01_013_Scenario()`

### Implementation Template
When implementing a new card or fixing a bug, you MUST add a corresponding scenario in `src/logic/DebugManager.ts`.

```typescript
setup[CardID]_Scenario() {
    console.log("Setting up [Card Name] ([CardID]) Scenario...");

    // 1. Reset/Prepare Players
    const p0 = this.game.state.players[0];
    const p1 = this.game.state.players[1];
    
    // Clear fields, hands, trash, etc.
    p0.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
    p1.unitZones.forEach(z => { z.unit = null; z.items = []; z.buffs = []; });
    p0.trash = []; p1.trash = [];
    p0.hand = []; p1.hand = [];
    p0.damage = []; p1.damage = [];

    // 2. Configure Specific State
    p0.leaderLevel = 5; 
    this.game.state.turnPlayerIndex = 0;
    this.game.state.phase = Phase.MAIN;

    // 3. Add Cards
    const card = this.getCard("[CardID]");
    if (card) p0.hand.push(card);

    // 4. Setup Targets (if applicable)
    // const target = this.getCard("ST01-002");
    // if (target) p1.unitZones[0].unit = target;

    // 5. Finalize
    this.renderCallback();
    console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
    console.log("1. Description of setup.");
    console.log("2. Instructions for verification (e.g., 'Drag card to zone X').");
}
```

### Mandatory Requirements
1. **Initial State:** Scenarios MUST reset relevant player states to ensure reproducibility.
2. **Logging:** Scenarios MUST log a clear "SCENARIO READY" message followed by numbered steps for verification.
3. **Accessibility:** All scenarios MUST be accessible via `window.debug` in the browser console.

## Automated Tests (Vitest)
- Unit tests for core logic should reside in the `tests/` directory.
- Use `npx vitest run` to execute all tests.
- High coverage (>80%) is required for logic-heavy modules like `TargetSelector` and `GameEngine`.

## Workflow Integration
1. **TDD:** Write unit tests first.
2. **Implementation:** Code the logic.
3. **Scenario Creation:** Add a `setup_Scenario` method to `DebugManager`.
4. **Manual Verification:** Run the scenario in the browser and confirm behavior.
5. **Phase Completion:** Automated tests and manual scenarios must all pass before a phase is considered complete.
