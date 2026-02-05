# Rule Compliance and Gap Analysis Report

**Date:** 2025-12-25
**Reference:** Nivel Arena Comprehensive Rules Ver.1.6

## 1. Core Mechanics Analysis

### 1.1. Player Size (Rule 4.7)
*   **Rule:** Size = Leader Level + Number of cards in Damage Zone.
*   **Current Implementation:** Partially incorrect. `RuleValidator.canPlayUnit` currently only checks `player.leaderLevel`.
*   **Gap:** Need to update size calculation to include damage zone count.

### 1.2. Deployment and Upgrade (Rule 3.5.5.1)
*   **Rule:** Can replace a unit with a higher-cost unit (Upgrade). This is NOT "trash by effect".
*   **Current Implementation:** Basic placement exists.
*   **Gap:** Explicit "Upgrade" logic and distinguishing it from "Exit" effect triggers (Rule 10.1.7.2.2) needs verification.

### 1.3. Turn Phases (Rule 6.1)
*   **Rule:** Level Up -> Draw -> Main -> Attack -> End.
*   **Current Implementation:** Basic phase switching exists in `GameEngine.ts`.
*   **Gap:** `END` phase logic (Rule 6.6) like trashing skills and hand size limit (7 cards) is missing.

## 2. Combat System (Rule 7)

### 2.1. Combat Steps
*   **Rule:** Attack Declaration -> Defense Declaration -> Combat -> End Combat.
*   **Current Implementation:** `GameEngine.ts` has a combined logic.
*   **Gap:** Missing discrete steps for "Attacker" and "Defender" trigger windows. Currently, triggers might fire at the wrong time or not at all.

### 2.2. Damage Processing (Rule 4.5.4)
*   **Rule:** Damage is processed 1 by 1. Reveal -> Trigger? -> (If trigger, remaining damage becomes 0) -> Move to Damage Zone.
*   **Current Implementation:** Mostly correct in `dealDamage` but needs to ensure the "1 by 1" and "Trigger cancels rest" logic is robust.

## 3. Keywords and Effects (Rule 10)

### 3.1. Implemented Keywords (Basic)
*   `ENTRY`, `ACTIVE` (partial), `TRIGGER` (partial).

### 3.2. Missing Keywords (Critical)
*   `EXIT` (Rule 10.1.7): Triggered on trash.
*   `ARMED` (Rule 10.1.8): Bonus when holding items.
*   `LEVEL LINK` (Rule 10.1.10): Effects active at certain levels.
*   `MIX` (Rule 10.1.12): Effects active with different attributes.
*   `ESCAPE` (Rule 10.1.13): Auto-return to deck at start of turn.
*   `PENETRATION`, `PLUNDER`, `PIERCE`, `DUALIST`: Combat sub-keywords.

## 4. Winning/Losing Conditions (Rule 1.2.2)
*   **Rule:** 10 Damage = Loss. Empty deck when drawing/taking damage = Loss.
*   **Current Implementation:** Basic 10 damage check exists.
*   **Gap:** Empty deck checks on damage processing need more rigorous testing.

## 5. Summary of Action Items
1.  **Correct Size Calculation:** Update `RuleValidator` and `GameEngine`.
2.  **Implement End Phase Logic:** Add hand size trashing and skill cleanup.
3.  **Refactor Combat Flow:** Separate into discrete steps to support Attacker/Defender triggers.
4.  **Keyword Expansion:** Prioritize `EXIT`, `LEVEL LINK`, and `ARMED`.
