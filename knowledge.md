# NivelArena Simulator Project Knowledge

## 1. Project Overview
Project Name: **NivelArenaSimulator2**
Purpose: A computer simulator for the NivelArena TCG.
Core Tech: TypeScript, Vite.

## 2. Game Rules (Summary of Ver 1.6)

### Basic Rules
- **Players**: 2 players.
- **Victory**: Opponent reaches 10 damage or deck-out (cannot draw).
- **Resources**: 
  - **Leader Level**: Starts at 1, increases by 1 each turn (max 10).
  - **Size**: `Leader Level + # of cards in Damage Zone`.
  - **Cost**: Total cost of units, skills, and items on the field cannot exceed **Size**.

### Game Flow
1. **Level Up Phase**: Leader Level +1.
2. **Draw Phase**: Draw 1 (First turn player skips).
3. **Main Phase**: Play units/skills/items, activate [Active] effects.
4. **Attack Phase**: Attack with units. Resolve combat or deal direct damage.
5. **End Phase**: Cleanup, hand limit (7), discard skills.

### Key Terms
- **Phases**: Level Up -> Draw -> Main -> Attack -> End.
- **Keywords**:
  - `Entry` / `Exit`: When unit enters/leaves the zone.
  - `Attacker` / `Defender`: During combat declaration.
  - `Active`: Manual activation in Main/Attack phases.
  - `Passive`: Continuous effect while in zone.
  - `Trigger`: Activation when card is revealed during damage check.
- **Mechanics**:
  - **Upgrade**: Play a higher-cost unit over a lower-cost one (lower one is trashed).
  - **Encounter**: Combat occurs if a unit attacks while an opponent unit is in the same lane.

## 3. Implementation Analysis

### Completed Features ✅
- **Phase Management**: Engine correctly cycles through phases.
- **Resource Logic**: Size calculation (`leaderLevel + damage.length`) and cost checking.
- **Basic Actions**: `playUnit`, `attack`, `drawCard`.
- **Combat Logic**: Power comparison and unit destruction.
- **Damage Handling**: Deck reveal and adding to damage zone.

### Missing / Pending Features 🚧
- **Skill & Item Usage**: `playSkill` and `playItem` are not yet implemented in `GameEngine.ts`.
- **Trigger System**: Reveal-and-resolve logic for Damage triggers.
- **Complex Effect Keywords**: Keywords like `Pierce` (Gwantsong), `Plunder` (Yaktal), `Duelist` need specific logic in `resolveCombat`.
- **Awaken (각성)**: Leader cards flipping at Level 6+ logic.
- **Hand Mulligan**: Start-of-game hand replacement rule.
- **Effect Interruption**: Passive power adjustments aren't fully integrated into power checks yet.

## 4. Technical Details

### File Structure
- `src/logic/types.ts`: Core data interfaces and enums.
- `src/logic/GameEngine.ts`: Game state and logic transitions.
- `src/logic/effects.ts`: Trigger-based effect resolution.
- `ST02.json`: Card database (Structured JSON).

### Knowledge Data Mapping
- **Units**: Cost, Power, Hit, Traits.
- **Lanes**: 3 vertical lanes for unit placement and alignment.

---
*Created by Antigravity based on rules_text.txt and current codebase.*

## 5. Card Effect System

### Design Principle: Trigger-Cost-Action
To avoid hardcoding individual card effects, we use a structured data model:
- **Activation (Trigger)**: When the effect occurs (e.g., `ENTRY`, `EXIT`, `ATTACKER`).
- **Condition**: Requirements for the effect to activate (e.g., `LEADER_LEVEL >= 3`).
- **Cost**: Resources spent to activate (e.g., `TRASH_HAND: 1`).
- **Action**: The actual result (e.g., `GAIN_LEVEL: 1`, `DRAW: 1`).

### Naming Conventions
- **System Level**: We use `processEffects` and `ActivationCondition` to refer to the technical "triggering" of code.
- **Game Level**: The keyword **"TRIGGER"** in NivelArena refers specifically to effects that activate when a card is revealed during damage check (`DAMAGE_TRIGGER`).

### Implementation Details
- Located in `src/logic/effects.ts` and managed by `EffectManager`.
- Actions are resolved through common handlers to ensure consistency.
- Costs must be validated and paid before actions resolve.
