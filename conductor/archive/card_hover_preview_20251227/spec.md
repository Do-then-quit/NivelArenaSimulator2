# Specification: Card Hover Preview UI

## Overview
Implement a user interface feature that provides detailed information and a larger visual representation of cards when a user hovers over them in the Hand or Unit Zones. This improves readability and accessibility of card effects and stats during gameplay.

## Functional Requirements
- **Trigger**: The preview should appear when the mouse hovers over a card in the `Hand` or `Unit Zone`.
- **Dismissal**: The preview must disappear immediately when the mouse leaves the card area.
- **Display Style**:
    - A floating panel/tooltip positioned near the hovered card.
    - Combination of visual (enlarged image) and textual information.
- **Information Content**:
    - **Enlarged Card Image**: A high-quality or scaled-up version of the card's artwork.
    - **Base Stats**: Display Cost, Attack (ATK), and Defense (DEF) if applicable.
    - **Effect Text**: Full description of the card's abilities.
    - **Keywords/Traits**: Clearly list keywords like [Penetration], [Dualist], etc.

## Non-Functional Requirements
- **Performance**: The preview should appear/disappear without noticeable lag.
- **UI Consistency**: The tooltip design should match the existing "NivelArena" aesthetic.

## Acceptance Criteria
- [ ] Hovering over any card in the hand displays the preview tooltip.
- [ ] Hovering over any unit in either player's unit zone displays the preview tooltip.
- [ ] The tooltip contains the correct image, stats, effect text, and keywords for the card.
- [ ] The tooltip disappears instantly when the mouse moves off the card.
- [ ] The tooltip does not obstruct the ability to click on cards or interact with other UI elements.

## Out of Scope
- Previewing cards in the Deck, Trash, or Memory zones.
- Displaying "Current Status" (modified stats or equipment details) - this may be added in a future track.
