# Product Guide

## Initial Concept
A computer simulator for the NivelArena TCG, implemented with TypeScript and Vite.

## Target Audience
1. **Competitive Players:** Users testing specific deck strategies and meta-gaming.
2. **Casual Learners:** Newcomers needing a rules-enforced sandbox to learn the game mechanics.
3. **AI Researchers:** Long-term users utilizing the engine for Reinforcement Learning (RL) and win-rate analysis (AlphaGo-style).

## Core Value Proposition
A dual-purpose platform delivering a polished, browser-based experience for human players and a high-performance, headless environment for AI training and simulation.

## Key Features
- **Full Rule Engine:** Comprehensive implementation of NivelArena rules (Phases, Stack Resolution, Unit Combat, Leader/Damage mechanics).
- **Universal Card Database:** Support for loading and using cards from all released packs (BT01-05, ST01-09, SB01).
- **Custom Deck Builder:** A dedicated interface for users to browse the library, create custom decks, and save them for future play.
- **Interactive Card Previews:** Real-time detailed card information and enlarged artwork display on hover to improve accessibility and readability.
- **Hybrid Architecture:**
  - **Web GUI:** A user-friendly, browser-based interface for interactive play.
  - **Headless Mode:** A Node.js-compatible simulation layer optimized for speed, allowing for thousands of games per second for AI data generation.
- **Data-Driven Design:** Architecture supports logging game states and outcomes to facilitate future Machine Learning integrations.
- **Comprehensive Scenario Testing:** An extensive suite of in-browser scenarios via `DebugManager` for manual verification of card effects and game rules.

## User Experience
- **Players:** Easy access via a web link or local server, with clear visual feedback on game states.
- **Developers/AI:** Programmatic access to the game engine via API for running batch simulations and extracting statistical data.