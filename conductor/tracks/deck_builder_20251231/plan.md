# Plan: Deck Builder UI & Custom Deck Support

Implement a deck builder interface to allow users to create and save custom decks, and use them in the game simulator.

## Phase 1: Foundation & Data Layer
- [x] Task: Update `CardDatabase.ts` to comprehensively load all available card packs from `packs/*.json`. [d8bb95a]
- [ ] Task: Create `DeckPersistence` service in `src/logic/DeckPersistence.ts` to manage `localStorage` saving/loading.
- [ ] Task: Conductor - User Manual Verification 'Foundation & Data Layer' (Protocol in workflow.md)

## Phase 2: Deck Builder Logic & State
- [ ] Task: Implement `DeckBuilderLogic` in `src/logic/DeckBuilderLogic.ts` for filtering, searching, and managing the current deck state.
- [ ] Task: Implement Deck Validation logic (1 Leader, 50 cards, max 4 copies) with warning outputs.
- [ ] Task: Conductor - User Manual Verification 'Deck Builder Logic & State' (Protocol in workflow.md)

## Phase 3: Deck Builder UI Implementation
- [ ] Task: Create `DeckBuilderUI` component/renderer in `src/DeckBuilderUI.ts`.
- [ ] Task: Implement Card Library grid with filtering and search controls, integrating `HoverPreview`.
- [ ] Task: Implement "Current Deck" side panel with add/remove functionality.
- [ ] Task: Conductor - User Manual Verification 'Deck Builder UI Implementation' (Protocol in workflow.md)

## Phase 4: Game Integration & Main Menu
- [ ] Task: Refactor `main.ts` to support screen switching (Main Menu, Deck Builder, Game).
- [ ] Task: Implement "Main Menu" with "Deck Builder" and "Start Game" buttons.
- [ ] Task: Update Game Initialization logic to use the deck selected/built in the UI.
- [ ] Task: Conductor - User Manual Verification 'Game Integration & Main Menu' (Protocol in workflow.md)
