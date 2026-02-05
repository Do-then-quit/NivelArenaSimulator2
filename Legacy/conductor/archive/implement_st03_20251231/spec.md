# Specification: Implement ST03 Card Effects

## Overview
This track involves implementing the card effects for the ST03 (Storm Attribute) starter deck. This includes 17 unique cards ranging from Leaders to Units, Skills, and Items. The implementation must adhere to the game rules, specifically handling new or verified keywords like `공멸` (Mutual Destruction), `디펜더` (Defender), and `종결` (Termination).

## Functional Requirements
1.  **Card Data Integration:**
    -   Use `packs/ST03.json` as the source of truth for card names, stats, and text.
2.  **Effect Implementation (ST03-001 to ST03-017):**
    -   **ST03-001 (Modernia - Leader):**
        -   Deck Restriction: Only Storm cards.
        -   Awakening: Level 4 or higher.
        -   Awakened Passive: *Your* units with `EXIT` keyword get +1000 Power.
    -   **ST03-002 (Delta - Unit):** No effect.
    -   **ST03-003 (Privaty - Unit):**
        -   Exit: Opponent trashes 1 card from *their* hand.
        -   Trigger: If opponent hand >= 3, opponent trashes 1 card from *their* hand.
    -   **ST03-004 (Uni - Unit):** No effect.
    -   **ST03-005 (Novel - Unit):**
        -   Entry: If encounter unit cost <= 1, trash it.
    -   **ST03-006 (Sakura - Unit):**
        -   Exit: Draw 1 card.
    -   **ST03-007 (D - Unit):**
        -   Exit: `공멸` (Mutual Destruction). If trashed by combat and attacker cost <= 3, trash the attacker.
    -   **ST03-008 (Exia - Unit):**
        -   Passive: *Your* units with `EXIT` keyword get +1000 Power.
    -   **ST03-009 (Maiden - Unit):** No effect.
    -   **ST03-010 (Rosanna - Unit):**
        -   Exit: Return *your* unit with `EXIT` keyword (cost <= 2) from trash to hand.
        -   Trigger: If opponent hand >= 3, opponent trashes 1 card from *their* hand.
    -   **ST03-011 (Modernia - Unit):**
        -   Entry: Trash all *your* hand cards. If 2+ trashed, trash encounter unit.
        -   Trigger: Add to hand.
    -   **ST03-012 (Surprise Attack - Skill):**
        -   Trash 1 card from *your* hand, then opponent trashes 1 card from *their* hand.
    -   **ST03-013 (Blackening - Skill):**
        -   Trash a unit from *your* hand to trash a lower cost unit on field. (Implemented as "Select 1 Unit on Field" (Any), but logically player will choose Opponent's).
    -   **ST03-014 (Sense Sharing - Skill):**
        -   Trash 1 of *your* units on field to draw 2 cards.
    -   **ST03-015 (Come On! - Skill):**
        -   Trash 1 of *your* units on field to trash the unit *encountering it*.
        -   Trigger: Return a unit with `EXIT` keyword from *your* trash to hand.
    -   **ST03-016 (Kevlar Vest - Item):**
        -   Power +3000.
        -   Defender: `종결` (Termination). End attack and trash *this* unit.
    -   **ST03-017 (Rare Metal Amguard - Item):**
        -   Exit: `공멸` (Mutual Destruction).

3.  **New Keyword Support:**
    -   `공멸` (Mutual Destruction): Implement logic to trash the combat opponent if its cost is <= source card cost.
    -   `종결` (Termination): Implement logic to end the attack phase immediately.

## Non-Functional Requirements
-   **TDD:** All card effects must have corresponding unit tests.
-   **Maintainability:** Effects should be registered in `ST03_EFFECTS` within `src/logic/cardEffects/st03.ts`.

## Acceptance Criteria
-   All ST03 cards (001-017) have their effects implemented according to `ST03.json`.
-   Keyword `공멸` works correctly in combat scenarios.
-   Keyword `종결` correctly terminates the attack.
-   Batch tests pass (`tests/st03_001_005.test.ts`, etc.).
-   Full regression test `tests/st03_full_regression.test.ts` passes.

## Out of Scope
-   Graphical UI updates (this track focuses on logic).
-   Implementation of cards from other packs (BT01, etc.).
