# Track Plan: GUI & Rule Alignment Fixes

## Phase 1: Leader Loyalty & Level Zone Refactor [checkpoint: 3a92e47]
- [x] Task: Update `createDeck` in `CardDatabase.ts` to exclude `LEADER` type cards from the main deck ca7e251
- [x] Task: Write Failing Test: Verify Leader card is in Level Zone and NOT in Deck/Hand fc6c347
- [x] Task: Implement fix in `GameEngine.ts` to correctly initialize `levelZone` without leaders in deck 659286a
- [x] Task: Update `main.ts` UI to display the Leader card at the bottom of the level indicator 338f15e
- [x] Task: Implement Awakening visual (glow/flip) in `renderCard` and `style.css` af5e3cc
- [x] Task: Conductor - User Manual Verification 'Leader Loyalty & Level Zone Refactor' (Protocol in workflow.md) 78b9288

## Phase 2: Item Equipment Implementation [checkpoint: 24980c5]
- [x] Task: Add `canPlayItem` to `RuleValidator.ts` and `playItem` to `GameEngine.ts` b2cbf93
- [x] Task: Write Failing Test: Equip `ST02-016` to a unit via `playItem` and verify stat boost b2cbf93
- [x] Task: Implement Item Equipment logic in `GameEngine.ts` b2cbf93
- [x] Task: Enforce item equipment requirements (e.g. Helmet cost req) in `RuleValidator.ts` 18343b5
- [x] Task: Update `main.ts` drag-and-drop listeners to handle `ITEM` cards and highlight valid `unit-zone` targets b8c381e
- [x] Task: Conductor - User Manual Verification 'Item Equipment Implementation' (Protocol in workflow.md) 24980c5

## Phase 3: Active Effect & Cost Selection Workflow [checkpoint: b8f1ca7]
- [x] Task: Update `types.ts` to include `SELECT_COST` in `interactionMode` and `costSelection` metadata in `PendingEffect` b8f1ca7
- [x] Task: Update `main.ts` to render an "Active" button on unit cards with `ActivationCondition.ACTIVE` b8f1ca7
- [x] Task: Implement `GameEngine.initiateCostSelection` and `GameEngine.selectCost` (to trash hand cards) b8f1ca7
- [x] Task: Write Failing Test: Trigger `ST02-007` effect, pay cost (trash hand), and verify Hit buff on field b8f1ca7
- [x] Task: Implement logic to resume effect execution after cost payment in `EffectManager.ts` b8f1ca7
- [x] Task: Restrict Active effects to once per turn per unit 77b2a20
- [x] Task: Conductor - User Manual Verification 'Active Effect & Cost Selection Workflow' (Protocol in workflow.md) b8f1ca7

## Phase 4: Final Integration & Regression
- [x] Task: Run all automated card tests (`tests/st02_full_regression.test.ts`) 468fda2
- [x] Task: Perform manual GUI walkthrough of all fixed features (Leader flip, Item drop, Active buff) 18343b5
- [ ] Task: Conductor - User Manual Verification 'Final Integration & Regression' (Protocol in workflow.md)
