# BT01 Card Implementation Plan

This plan tracks the implementation of cards from the BT01 pack, categorized by their implementation requirements.

## 🔴 Phase 1: Engine Features (New Mechanics)

These tasks require modifying `GameEngine.ts`, `RuleValidator.ts`, or `EffectManager.ts` to support new mechanics before specific cards can be implemented.

- [ ] **1-A. Dynamic Effect Granting System**
    - **1-A-1. Golden Sample: BT01-072 (Modernia)**
        - *Goal:* Implement the architecture for one unit granting a functional effect to another.
        - *Card Logic:* Passive: All other friendly units gain "Exit: Draw 1".
        - [x] **Test:** Create `tests/BT01_072_Modernia.test.ts`. Verify Unit B draws a card when trashed *only if* Modernia is on field. e05750f
        - [x] **Engine:** Update `UnitZoneState` to include `grantedEffects: Effect[]`. e05750f
        - [x] **Engine:** Update `GameEngine` or `EffectManager` to recalculate `grantedEffects` when the board state changes (or check dynamically). e05750f
        - [x] **Engine:** Update `EffectManager.processEffects` to include `grantedEffects` when searching for triggers. e05750f
        - [x] **Manual Test** Manual GUI Test Confirm.
    - **1-A-2. System Rollout**
        - *Goal:* Apply the system to the rest of the group.
        - [x] **Keywords:** Implement granting of Keywords (e.g., Penetration) for BT01-019, BT01-046, BT01-020.
        - [x] **Temporary Granting:** Implement "Entry: Gain X until end of turn" for BT01-012, BT01-019.
        - [x] **Items:** Implement Items granting effects to their holder (BT01-026, etc.).

- [x] **1-B. Mandatory & Restricted Actions**
    - *Goal:* Enforce rules for "Must Attack" and "Cost to Attack".
    - *Target Cards:* BT01-005, BT01-014 (Berserk), BT01-060, BT01-065 (Attack Cost).
    - [x] Implement `mustAttack` validation in `RuleValidator` (actually handled in `GameEngine.nextPhase`).
    - [x] Implement `attackCost` payment logic in `GameEngine` (handle UI selection for discard).

- [x] **1-C. Specific Condition Keywords**
    - *Goal:* Implement state-check logic for specific keywords.
    - *Target Cards:* BT01-030, 037 (Frontline Construction), BT01-040 (Level Link).
    - [x] Implement `checkFrontline` helper in `RuleValidator` or `GameEngine` (Implemented as `FRONTLINE_CONSTRUCTION` condition in `EffectManager`).
    - [x] Implement `checkLevelLink` condition in `EffectManager` (Used existing `LEADER_LEVEL` condition).

- [ ] **1-D. Opponent Interaction (Forced Selection)**
    - *Goal:* Allow effects to force the *opponent* to make a selection during the current player's turn.
    - *Target Cards:* BT01-066, BT01-073.
    - [ ] Update `GameState` to handle "Waiting for Opponent" state.
    - [ ] Implement UI flow for opponent selection modal.

- [ ] **1-E. Complex Targeting**
    - *Goal:* Support selecting multiple targets based on a sum of properties (e.g., Total Cost <= 4).
    - *Target Cards:* BT01-078.
    - [ ] Enhance `TargetSelector` to support `SUM_CONSTRAINT` logic.

- [ ] **1-F. Special Combat Logic: Termination**
    - *Goal:* Implement "Termination" (종결) logic where combat ends immediately.
    - *Target Cards:* BT01-058, BT01-070.
    - [ ] Update `GameEngine` combat resolution to check for `TERMINATION` keyword on defender.
    - [ ] Ensure attack is effectively cancelled/ended and defender is trashed.

## 🟢 Phase 2: Data Entry (Existing Mechanics)

These cards can be implemented using the existing engine features once Phase 1 is complete (or in parallel for those not dependent on Phase 1).

- [ ] **2-A. Vanilla Units** (BT01-003, 007, 010, 031, 042, 043, 057, 059, 062)
- [ ] **2-B. Simple Buffs/Debuffs** (BT01-002, 009, 013, 016, 029, 033, 038, 039, 041, 056, 061)
- [ ] **2-C. Existing Keywords** (Penetration: BT01-004, Plunder: BT01-006, Breakthrough: BT01-035, Mutual Destruction: BT01-067)
- [ ] **2-D. Global Passives** (BT01-008, 018, 028, etc.)
- [ ] **2-E. Search & Salvage** (BT01-014, 025, 044, 051, 079)
- [ ] **2-F. Leaders** (BT01-001, 028, 055)

## 🔵 Phase 3: Integration & Verification

- [ ] **3-A. Full Pack Test**
    - [ ] Create a test suite that loads all BT01 cards.
    - [ ] Verify no loading errors.
- [ ] **3-B. Scenario Tests**
    - [ ] Create scenario tests for complex mechanics (Termination, Granting Effects, Opponent Choice).
