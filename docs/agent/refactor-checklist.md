# Refactor Checklist (Behavior-Preserving)

## Scope
- Goal: split oversized files while preserving game behavior and public engine API.
- No rule/card interpretation changes in this track.
- Keep `GameEngine` public methods and `EngineAction`/`EngineObservation` schema stable.

## Global Invariants (Must Hold)
- `interactionOwnerPlayerId` remains source of input authority.
- Effect queue ordering stays: `creationTime` ascending, then turn-player priority.
- `globalStep` remains the effect creation clock.
- Non-trigger effects created during damage processing continue to go to `deferredEffectQueue`.
- Combat state recovery remains consistent: `combatStep`, `pendingAttackerIndex`, `phase`.
- AI entrypoints remain unchanged:
  - `getLegalActions(actorPlayerId?)`
  - `step(action)`
  - `getObservation(actorPlayerId)`
  - `getSerializableState()`

## Batch Gates (Run Every Batch)
1. Build gate:
   - `npm run build`
2. Required AI/rules regression gates:
   - `npx vitest run tests/rules_v2_regression/rules_v2_ai_ready_stage1_regression.test.ts`
   - `npx vitest run tests/rules_v2_regression/rules_v2_ai_ready_stage2_stage3_regression.test.ts`
   - `npx vitest run tests/rules_v2_regression/rules_v2_ai_baseline_bot_regression.test.ts`
   - `npx vitest run tests/rules_v2_regression/rules_v2_mulligan_regression.test.ts`
   - `npx vitest run tests/rules_v2_regression/rules_v2_bt01_061_targeting_regression.test.ts`

## Additional Gates by Batch
- UI split batch:
  - add/run UI tests under `tests/ui/`.
- Engine targeting/combat split batches:
  - run full rules regression subset related to ownership/targeting/combat.
- Final gate (after all batches):
  - `npm test`
  - `npm run test:bot-soak`

## Rollback Rule
- If any required gate fails after a batch:
  1. Stop progressing to next batch.
  2. Identify first failing area.
  3. Revert only that batch's refactor changes or patch forward with minimal fix.
  4. Re-run required gates before continuing.

## Change Hygiene
- Small batches only.
- No unrelated cleanup mixed in.
- Keep external behavior, ids/classes, event order stable in UI split.

## Execution Status (2026-02-20)
- Batch 0: done
- Batch 1: done
- Batch 2: done
- Batch 3: done
- Batch 4: done
- Batch 5: done
