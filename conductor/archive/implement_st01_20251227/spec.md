# Specification: ST01 Card Set Implementation

## Overview
This track involves the full implementation of the ST01 (Starter Deck 01) card set into the NivelArena Simulator engine. This includes registering card data, implementing unique effect logic, and ensuring all keywords and mechanics function according to the rules.

## Functional Requirements
- **Card Database Registration:** Add all 17 cards from `ST01.json` to the internal `CardDatabase`.
- **Keyword Implementation:** Verify and implement (if missing) keywords found in ST01: `PENETRATION`, `PLUNDER`, `DUALIST`, `BREAKTHROUGH`.
- **Effect Logic Implementation:**
    - **Triggered Effects:** Logic for `ON_PLAY`, `ON_ATTACK`, and `ON_RETIRE` triggers.
    - **Continuous Effects:** Passive buffs/debuffs active while the card is on the field.
    - **Skill Cards:** Implementation of one-time effects for Skill cards.
    - **Item Cards:** Implementation of attachment logic and stat modifications for Items.
- **Rule Validation:** Ensure all implemented effects adhere to the `RuleValidator` and `GameEngine` state transitions.

## Implementation Batches (Complexity-Based)
1. **Phase 1 (Basic Units):** ST01-001 through ST01-006 (Standard stats and keywords).
2. **Phase 2 (Triggered Effects):** ST01-007 through ST01-012 (On Play/On Retire logic).
3. **Phase 3 (Passive Effects):** ST01-013 through ST01-015 (Field-wide or continuous logic).
4. **Phase 4 (Non-Unit Cards):** ST01-016 and ST01-017 (Skill and Item mechanics).

## Acceptance Criteria
- All 17 ST01 cards are correctly defined in the system.
- Individual unit tests exist for every card's unique effect.
- A full regression test suite verifies the functionality of all ST01 cards in sequence.
- Code coverage for the new effect logic exceeds 80%.

## Out of Scope
- GUI/Visual implementation for ST01 cards.
- Implementation of cards from other sets (e.g., BT01, BT02).
