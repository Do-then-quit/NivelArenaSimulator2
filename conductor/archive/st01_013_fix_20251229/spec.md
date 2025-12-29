# Specification: Fix ST01-013 Skill Logic and Implement Trash Selection UI

## Overview
Currently, the card **ST01-013 "Reinforcement" (전력 보강)** fails to activate its skill because the engine cannot find valid targets in the Trash zone, even when they exist. This track aims to fix the target selection logic for the Trash scope and implement a user interface for manually selecting cards from the Trash.

## Functional Requirements

### 1. Game Logic Fixes (`src/logic/TargetSelector.ts`)
- **Scope Handling:** Update `TargetSelector.resolve` and `isValidTarget` to handle `CardState` objects directly when the scope is `MY_TRASH`.
- **Type Filtering:** Ensure that when `type: 'UNIT'` is specified with `MY_TRASH` scope, it checks the card's `type` property instead of looking for a `unit` property in a zone.
- **Filter Support:** Update `COST_LIMIT` and other filters to correctly access properties on `CardState` when targeting cards in the Trash.

### 2. Interaction Improvements (`src/logic/GameEngine.ts`)
- **New Action:** Add `selectTrashTarget(cardIndex: number)` to `GameEngine` to allow the UI to submit a selection from the Trash.
- **Validation:** Ensure the selected trash card is validated against the effect's requirements before execution.

### 3. UI Implementation (`src/main.ts` & `src/style.css`)
- **Trash Selection Modal:** Implement a simple modal or overlay that appears when the game is in `SELECT_TARGET` mode and the valid scope is `MY_TRASH`.
- **Filtering UI:** Only show cards in the modal that meet the skill's criteria (e.g., Units with cost 2 or less for ST01-013).
- **Styling:** Add necessary CSS for the modal to ensure it is visually distinct and easy to use.

## Non-Functional Requirements
- **Simplicity:** The UI should be a straightforward list or grid of cards, matching the existing "simple modal" preference.
- **Robustness:** Handle cases where the Trash is empty or has no valid targets (the engine should ideally not enter selection mode if no targets exist, which is existing behavior).

## Acceptance Criteria
- Activating ST01-013 with Units of cost 2 or less in the Trash correctly enters `SELECT_TARGET` mode.
- A UI modal appears showing the valid cards from the Trash.
- Selecting a card from the modal correctly moves that card to the player's hand and ends the effect.
- The "No Valid Target For Skill" error no longer appears when valid targets are present.
