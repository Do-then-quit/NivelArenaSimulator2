# Track Plan: Implement ST02 Card Effects

## Phase 1: Data Integration & Types [checkpoint: 9d19a9c]
- [x] Task: Update `types.ts` to include missing Combat Sub-Keywords (PENETRATION, PLUNDER, DUALIST) [cc40e7a]
- [x] Task: Update `CardDatabase.ts` to map raw `ST02.json` fields to the `Card` interface [2f3185e]
- [ ] Task: Conductor - User Manual Verification 'Data Integration & Types' (Protocol in workflow.md)

## Phase 2: Combat Engine Extension [checkpoint: cf223d9]
- [x] Task: Implement `PENETRATION` logic in `GameEngine.ts` (Damage carry-over) [48bed7a]
- [x] Task: Implement `PLUNDER` logic in `GameEngine.ts` (Draw on kill) [3162969]
- [x] Task: Implement `DUALIST` logic in `GameEngine.ts` (Forced defense) [f2ae691]
- [ ] Task: Conductor - User Manual Verification 'Combat Engine Extension' (Protocol in workflow.md)

## Phase 3: Card Logic - Group A (ST02-001 to ST02-009) [checkpoint: 62bbfd8]
- [x] Task: Implement & Test ST02-001 to ST02-003 [0d51bf2]
- [x] Task: Implement & Test ST02-004 to ST02-006 [a0aa008]
- [x] Task: Implement & Test ST02-007 to ST02-009 [0563ad1]
- [ ] Task: Conductor - User Manual Verification 'Card Logic - Group A' (Protocol in workflow.md)

## Phase 4: Card Logic - Group B (ST02-010 to ST02-017) [checkpoint: 795de2c]
- [x] Task: Implement & Test ST02-010 to ST02-012 [01b6fd3]
- [x] Task: Implement & Test ST02-013 to ST02-015 [6dab654]
- [x] Task: Implement & Test ST02-016 to ST02-017 [88f8536]
- [ ] Task: Conductor - User Manual Verification 'Card Logic - Group B' (Protocol in workflow.md)

## Phase 5: Integration & Final Verification
- [x] Task: Global regression test for all ST02 cards in a single session [fcd9293]
- [ ] Task: Conductor - User Manual Verification 'Integration & Final Verification' (Protocol in workflow.md)
