# Track Specification: GUI & Rule Alignment Fixes

## 1. Overview
This track addresses several UI/UX blockers and rule-alignment issues identified during manual testing. It focuses on making Active effects usable, enabling item equipment via drag-and-drop, and correctly managing Leader cards in the Level Zone.

## 2. Functional Requirements

### 2.1. Active Effect Workflow (ST02-007 etc.)
- **UI Trigger:** Units in play with `ACTIVE` effects will display an "Active" button.
- **Cost Selection Mode:** 
    - Clicking "Active" enters `SELECT_COST` interaction mode.
    - Valid cards in hand (for trashing) will be highlighted.
- **Execution:** Once the cost is selected and confirmed, the engine executes the effect.

### 2.2. Item Equipment Logic & UX
- **Drag-and-Drop:** Enable dragging cards of type `ITEM` to unit zones.
- **Visual Feedback:** Unit zones will highlight when an item is dragged over them.
- **Logic Integration:** Implement `GameEngine.playItem(cardIndex, zoneIndex)` to handle the `equip` action, ensuring cost/size limits are checked.

### 2.3. Leader Card & Level Zone Refactor
- **Setup Change:** Leaders are no longer part of the 40-card deck. `GameEngine` will initialize the `levelZone` with the provided leader card.
- **Dedicated UI Slot:** A new slot at the bottom of the Level Indicator sidebar will display the Leader card.
- **Awakening Visualization:**
    - When a leader is awakened, the card in the UI will flip or display a "Golden/Glow" effect.
    - The size bonus (implemented in the previous track) will be visually indicated.

## 3. Acceptance Criteria
- [ ] ST02-007 can trigger its Hit buff after the player manually selects a card from hand to trash.
- [ ] Item cards (ST02-016, ST02-017) can be equipped to units via drag-and-drop.
- [ ] The deck count starts at 40 (excluding the leader) if the deck creation logic is updated.
- [ ] The Leader card is permanently visible in the Level Zone and reflects its "Awakened" state.
- [ ] No regression in automated card tests.
