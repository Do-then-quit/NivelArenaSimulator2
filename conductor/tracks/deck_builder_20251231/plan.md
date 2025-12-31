# Plan: Deck Builder UI & Custom Deck Support

Implement a deck builder interface to allow users to create and save custom decks, and use them in the game simulator.

## Phase 1: Foundation & Data Layer [checkpoint: 91c8a2f]
- [x] Task: Update `CardDatabase.ts` to comprehensively load all available card packs from `packs/*.json`. [d8bb95a]
- [x] Task: Create `DeckPersistence` service in `src/logic/DeckPersistence.ts` to manage `localStorage` saving/loading. [968ab7c]
- [x] Task: Conductor - User Manual Verification 'Foundation & Data Layer' (Protocol in workflow.md)
- [ ] Task: Conductor - User Manual Verification 'Foundation & Data Layer' (Protocol in workflow.md)

## Phase 2: Deck Builder Logic & State [checkpoint: 76c4524]
- [x] Task: Implement `DeckBuilderLogic` in `src/logic/DeckBuilderLogic.ts` for filtering, searching, and managing the current deck state. [85012b5]
- [x] Task: Implement Deck Validation logic (1 Leader, 40 cards, max 3 copies) with warning outputs. [4d8f82e]
- [x] Task: Conductor - User Manual Verification 'Deck Builder Logic & State' (Protocol in workflow.md)
- [ ] Task: Conductor - User Manual Verification 'Deck Builder Logic & State' (Protocol in workflow.md)

## Phase 3: Deck Builder UI Implementation
- [x] Task: Create `DeckBuilderUI` component/renderer in `src/DeckBuilderUI.ts`. [5bcce8f]
- [x] Task: Implement Card Library grid with filtering and search controls, integrating `HoverPreview`. [5bcce8f]
- [x] Task: Implement "Current Deck" side panel with add/remove functionality. [5bcce8f]
- [ ] Task: Conductor - User Manual Verification 'Deck Builder UI Implementation' (Protocol in workflow.md)
- [ ] Task: Conductor - User Manual Verification 'Deck Builder UI Implementation' (Protocol in workflow.md)

## Phase 4: Game Integration & Main Menu
- [ ] Task: Refactor `main.ts` to support screen switching (Main Menu, Deck Builder, Game).
- [ ] Task: Implement "Main Menu" with "Deck Builder" and "Start Game" buttons.
- [ ] Task: Update Game Initialization logic to use the deck selected/built in the UI.
- [ ] Task: Conductor - User Manual Verification 'Game Integration & Main Menu' (Protocol in workflow.md)
