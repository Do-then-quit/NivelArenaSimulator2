# Track Plan: GUI & Rule Alignment Fixes

## Phase 1: Leader Loyalty & Level Zone Refactor
- [x] Task: Update `createDeck` in `CardDatabase.ts` to exclude `LEADER` type cards from the main deck ca7e251
- [ ] Task: Write Failing Test: Verify Leader card is in Level Zone and NOT in Deck/Hand
- [ ] Task: Implement fix in `GameEngine.ts` to correctly initialize `levelZone` without leaders in deck
- [ ] Task: Update `main.ts` UI to display the Leader card at the bottom of the level indicator
- [ ] Task: Implement Awakening visual (glow/flip) in `renderCard` and `style.css`
- [ ] Task: Conductor - User Manual Verification 'Leader Loyalty & Level Zone Refactor' (Protocol in workflow.md)

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
