# Product Guidelines

## Prose Style and Tone
- **Formal and Instructional:** Communication must prioritize clarity and precision. Use established NivelArena TCG terminology (e.g., "Main Phase", "Trash", "Damage Zone") without flair.
- **Rule-Centric:** Every interaction should reinforce the player's understanding of the official ruleset (Ver 1.6).

## Visual Identity
- **Data-Dense Philosophy:** The UI should prioritize information density over aesthetic whitespace. The goal is to provide a comprehensive view of the game state (Hand, Field, Damage, Leader Level, and Event Log) at all times.
- **High-Contrast Design:** Use color and contrast to differentiate card types (Units, Skills, Items) and game states (Active/Exhausted).
- **Functional Layout:** Elements should be arranged to minimize clicking and scrolling, favoring a "dashboard" feel for the playmat.

## User Interaction and Feedback
- **Strict Rule Enforcement:** The engine acts as the final arbiter. Actions that violate the game rules must be blocked at the UI level.
- **Explicit Error Handling:** When an action is blocked (e.g., playing a card without sufficient Leader Level/Size), provide a concise, non-intrusive tooltip or status message explaining the specific rule violation.
- **Log Transparency:** Maintain a detailed, scrollable event log that records every action, state change, and effect resolution, aiding both human players and developers debugging AI logic.

## Rule Compliance Principle
- **Source of Truth:** All game mechanics, card effects, and system behaviors MUST strictly adhere to the official NivelArena TCG rules.
- **Reference Material:** Always refer to `rules_text.txt` or `NivelArena_Comprehensive_Rules_Ver.1.6.pdf` (whichever is more accessible/readable for the current task) when implementing or debugging game logic.
- **Priority:** If there is any discrepancy between the current implementation and the rules defined in the reference documents, the reference documents take precedence.
- **Verification:** Every new feature or logic fix should be verified against the rules to ensure consistency and accuracy.
