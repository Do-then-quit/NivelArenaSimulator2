# Scenario-Based Testing Framework Design

## 1. Goal
To provide a data-driven way to verify Nivel Arena game rules, allowing complex interactions to be tested with minimal boilerplate.

## 2. Scenario Schema (Proposed)
A scenario consists of three parts: **Setup**, **Action**, and **Expectations**.

```json
{
  "name": "Guilty Trigger Destruction",
  "setup": {
    "turnPlayer": 0,
    "players": [
      {
        "index": 0,
        "field": [null, "ST02-004", null] 
      },
      {
        "index": 1,
        "deck": ["ST02-009"]
      }
    ]
  },
  "actions": [
    { "type": "DEAL_DAMAGE", "player": 1, "amount": 1 },
    { "type": "SELECT_TARGET", "playerIndex": 0, "zoneIndex": 1 }
  ],
  "expectations": {
    "player0": {
      "field": [null, null, null]
    },
    "player1": {
      "trash": ["ST02-009"]
    },
    "interactionMode": "NORMAL"
  }
}
```

## 3. Implementation Components

### 3.1. `GameScenarioRunner`
A utility class that:
1.  Instantiates a `GameEngine`.
2.  Parses the `setup` block to populate the `GameState`.
3.  Sequentially executes the `actions`.
4.  Validates the final state against the `expectations`.

### 3.2. Integration with `DebugManager`
The `DebugManager` can be updated to "Export Scenario" from the current GUI state, making it easy to turn a manually found bug into a regression test.

## 4. Benefits
*   **Rule Coverage:** We can quickly write 100+ scenarios covering every keyword in the rulebook.
*   **Readability:** Scenarios serve as documentation for how cards should interact.
*   **Regression Testing:** Ensures that fixing one rule gap doesn't break existing implemented rules.

## 5. Next Steps
*   Prototype the `GameScenarioRunner`.
*   Convert existing `DebugManager` tests into this JSON format.
