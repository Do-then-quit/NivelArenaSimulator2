# Specification: ST01 Card Logic and Rule Processing Fixes

## Overview
This track addresses several logical errors and rule compliance issues identified during testing of the ST01 Starter Deck cards. It also includes a comprehensive validation of all ST01 cards to ensure full rule compliance.

## Functional Requirements

### 1. Rule Processing: Power <= 0 Trashing
- **Requirement:** Implement a global rule check where any unit whose ATK (Power) becomes 0 or less due to an effect or combat must be immediately moved to the Trash Zone.
- **Reference:** Comprehensive Rules Ver. 1.6, Section 1.3.7.3.
- **Impacted Cards:** Noir (ST01-006), Anis (ST01-010), Weakness Insight (ST01-012), Missile (ST01-015).

### 2. Automatic Targeting for "Encounter Unit" Effects
- **Requirement:** Effects that target an "Encounter Unit" (조우 유닛) must automatically identify and apply to the unit in the corresponding lane of the opponent's field. The user should not be prompted to select a target.
- **Impacted Cards:** Noir (ST01-006), Anis (ST01-010).

### 3. Rapi (ST01-001) Leader Awakening
- **Requirement:** Correct the awakening condition logic. Rapi must awaken (flip to her Awakened side) when the player's leader level reaches **5** or higher, not 6.

### 4. Besti (ST01-003) Attacker Logic
- **Requirement:** Ensure Besti's "Attacker: +1000 ATK" effect correctly applies during the combat step so she can successfully trash units with 3000 ATK (2500 + 1000 = 3500).

### 5. Blanc (ST01-008) Passive Logic
- **Requirement:** Refine Blanc's passive effect logic. It must only apply to units that explicitly have the "Attacker" keyword. Blanc herself does not have the "Attacker" keyword, so she should not receive her own power buff.

### 6. Rapi (ST01-011) Penetration Keyword
- **Requirement:** Fix the Penetration [1] effect. It must trigger when Rapi (Unit) trashes an opponent's unit during combat, dealing 1 damage to the opponent's leader.

### 7. Comprehensive ST01 Card Validation
- **Requirement:** Systematically verify the logic of ALL cards in the ST01 pack (ST01-001 to ST01-017) through unit tests. This includes verifying keyword interactions (Attacker, Entry, Active, Passive), triggers, and equipment logic.

## Non-Functional Requirements
- **Maintainability:** Keyword logic should be centralized or follow existing patterns in `src/logic/cardEffects/` to avoid similar bugs in future card packs.
- **Test Coverage:** Ensure >80% code coverage for the logic governing ST01 card effects.

## Acceptance Criteria
- [ ] Rapi (Leader) awakens exactly at Level 5.
- [ ] Noir and Anis effects apply automatically to the encounter unit without a UI prompt.
- [ ] Any unit reaching 0 ATK is immediately moved to the Trash.
- [ ] Besti successfully trashes a 3000 ATK unit when she attacks.
- [ ] Blanc does not increase her own ATK unless granted the "Attacker" keyword by another effect.
- [ ] Rapi (Unit) deals 1 damage to the opponent upon trashing a unit in combat.
- [ ] **Full ST01 Suite:** All 17 cards in ST01 have passing unit tests covering their specific card text.
- [ ] All existing regression tests for ST01 pass.

## Out of Scope
- Fixes for ST02 or later packs (unless they share the underlying logic bug).
- UI/UX improvements not directly related to target selection or effect feedback.
