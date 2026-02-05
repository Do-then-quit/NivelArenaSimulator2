# Specification: Comprehensive Scenario Testing for ST01 & ST02

## Overview
To ensure the long-term reliability of the NivelArena simulator and facilitate rapid verification of card mechanics, this track will implement a comprehensive suite of scenario-based tests for every card in the ST01 and ST02 sets. These scenarios will be accessible via the `DebugManager` and documented in a new `testing-guidelines.md` file to ensure consistency in future card implementations.

## Functional Requirements

### 1. Scenario Implementation (`src/logic/DebugManager.ts`)
- **Coverage:** Implement a `setup[CardID]_Scenario` method for **every card** defined in `packs/ST01.json` and `packs/ST02.json`.
- **State Setup:** Each scenario must precisely configure the following for both players:
    - Hand, Trash, and Damage Zone contents.
    - Field states (Units, Items, Buffs).
    - Leader Levels and Awakening states.
    - Current Phase and Turn Player.
- **Goal-Oriented:** Each scenario should be designed to immediately demonstrate the card's unique mechanics (e.g., triggering an Active effect, showing a Passive buff, or executing a Keyword like Penetration).

### 2. Documentation (`conductor/testing-guidelines.md`)
- **New Document:** Create `conductor/testing-guidelines.md` to serve as the source of truth for testing protocols.
- **Content:**
    - Definition and purpose of "Scenario Tests".
    - Template/Example for implementing new scenario tests in `DebugManager.ts`.
    - Mandatory requirement for future tracks to include corresponding scenario tests for any new or modified card logic.
    - Integration with the manual verification process.

## Acceptance Criteria
- Every card in `ST01.json` and `ST02.json` (approx. 34 unique IDs) has a dedicated `setup_Scenario` method in `DebugManager`.
- Executing any of these methods in the browser console (e.g., `window.debug.setupST01_005_Scenario()`) correctly prepares the game state for immediate verification.
- `conductor/testing-guidelines.md` is created and clearly outlines the requirement for scenarios in future card implementations.
- All newly created scenario methods are functional and do not break the existing debug functionality.

## Out of Scope
- Implementing scenarios for cards outside of ST01 and ST02.
- Automating the execution of these scenarios in CI (this track focus is on setup and manual verification infrastructure).
