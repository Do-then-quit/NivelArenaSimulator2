# Track Plan: GUI & Rule Alignment Fixes

## Phase 1: Leader Loyalty & Level Zone Refactor
- [x] Task: Update `createDeck` in `CardDatabase.ts` to exclude `LEADER` type cards from the main deck ca7e251
- [x] Task: Write Failing Test: Verify Leader card is in Level Zone and NOT in Deck/Hand fc6c347
- [x] Task: Implement fix in `GameEngine.ts` to correctly initialize `levelZone` without leaders in deck 659286a
- [x] Task: Update `main.ts` UI to display the Leader card at the bottom of the level indicator 338f15e
- [x] Task: Implement Awakening visual (glow/flip) in `renderCard` and `style.css` af5e3cc
- [x] Task: Conductor - User Manual Verification 'Leader Loyalty & Level Zone Refactor' (Protocol in workflow.md) 78b9288

## Phase 2: Item Equipment Implementation
- [ ] Task: Add `canPlayItem` to `RuleValidator.ts` and `playItem` to `GameEngine.ts`
- [ ] Task: Write Failing Test: Equip `ST02-016` to a unit via `playItem` and verify stat boost
- [ ] Task: Implement Item Equipment logic in `GameEngine.ts`
- [ ] Task: Update `main.ts` drag-and-drop listeners to handle `ITEM` cards and highlight valid `unit-zone` targets
- [ ] Task: Conductor - User Manual Verification 'Item Equipment Implementation' (Protocol in workflow.md)

## Phase 3: Active Effect & Cost Selection Workflow
- [ ] Task: Update `types.ts` to include `SELECT_COST` in `interactionMode` and `costSelection` metadata in `PendingEffect`
- [ ] Task: Update `main.ts` to render an "Active" button on unit cards with `ActivationCondition.ACTIVE`
- [ ] Task: Implement `GameEngine.initiateCostSelection` and `GameEngine.selectCost` (to trash hand cards)
- [ ] Task: Write Failing Test: Trigger `ST02-007` effect, pay cost (trash hand), and verify Hit buff on field
- [ ] Task: Implement logic to resume effect execution after cost payment in `EffectManager.ts`
- [ ] Task: Conductor - User Manual Verification 'Active Effect & Cost Selection Workflow' (Protocol in workflow.md)

## Phase 4: Final Integration & Regression
- [ ] Task: Run all automated card tests (`tests/st02_full_regression.test.ts`)
- [ ] Task: Perform manual GUI walkthrough of all fixed features (Leader flip, Item drop, Active buff)
- [ ] Task: Conductor - User Manual Verification 'Final Integration & Regression' (Protocol in workflow.md)
