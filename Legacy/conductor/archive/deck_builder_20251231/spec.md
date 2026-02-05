# Specification: Deck Builder UI & Custom Deck Support

## Overview
Implement a comprehensive Deck Builder interface that allows users to browse the NivelArena card library, create custom decks, and use them in the simulator. Currently, the simulator uses fixed starter decks; this feature provides the "Pre-Game" customization layer requested.

## Functional Requirements
1.  **Standalone Deck Builder UI:**
    *   Accessible via a main menu or a dedicated "Deck Builder" button before starting a game.
    *   **Card Library View:** A visual grid displaying cards from all loaded packs (BT, ST, SB).
    *   **Search & Filter:**
        *   Filter by Set/Pack (e.g., ST01, BT01).
        *   Search by Card Name (text input).
        *   Filter by Card Type (Unit, Item, Skill, Leader).
        *   Filter by Color (if applicable in the dataset).
    *   **Current Deck View:** A list or side panel showing the cards currently added to the deck, including counts.

2.  **Deck Management:**
    *   **Selection:** Add/remove cards from the library to the current deck.
    *   **Persistence:** Save and load custom decks using browser `localStorage`.
    *   **Validation (Warning Only):** Display warnings if the deck does not meet standard rules (e.g., 50 cards, 1 Leader, max 4 copies), but do not block the ability to play.

3.  **Game Integration:**
    *   A "Play with this Deck" button that initializes the `GameEngine` with the user's custom deck.
    *   Update the game start logic to accept dynamic deck arrays instead of just pre-defined starter pack IDs.

## Non-Functional Requirements
*   **Performance:** The card grid should handle hundreds of cards efficiently (lazy loading or virtualization if needed).
*   **UI Consistency:** Match the existing visual style and utilize the `HoverPreview` for card details.
*   **Persistence:** Data must survive page refreshes via `localStorage`.

## Acceptance Criteria
*   The user can navigate to the Deck Builder from the initial screen.
*   The card grid correctly filters based on user input (Set, Name, Type).
*   Adding/removing cards updates the "Current Deck" view in real-time.
*   The "Play" button successfully transitions to the game board with the custom cards.
*   Invalid decks trigger a visible warning but still allow the game to start.
*   Saved decks are available after refreshing the browser.

## Out of Scope
*   Online deck sharing or export/import strings (V1).
*   Complex deck statistics (mana curves, color distribution graphs).
*   Deck validation for specific restricted/banned lists.