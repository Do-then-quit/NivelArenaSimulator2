# AI Roadmap: Strong Play Bot + Strong Deck Search

## Progress Status (2026-02-09)

- [x] Phase 0 complete
  - Evidence: `Phase0.md`
  - Added: manifest-based eval, confidence intervals, `ai:regression` gate
- [x] Phase 1 implementation complete (StrongBot v1)
  - Evidence: `Phase1.md`
  - Added: `src/logic/ai/StrongBot.ts`, evaluator/scorer, bot registry integration
- [~] Phase 1 performance target partially stabilized
  - Ladder with side swaps (`strong-v1, baseline-a, baseline-b`, seedsPerPair=6):
    - `strong-v1` 15-9 (62.5%), Elo 1041.06
  - Head-to-head vs `baseline-b` in fixed-role bench needs tuning
- [ ] Phase 2 not started
- [ ] Phase 3 not started
- [ ] Phase 4 not started
- [ ] Phase 5 not started

## 1) Scope

- Goal A: Build a stronger in-game play bot than current `BaselineBot`.
- Goal B: Build a deck-construction bot that searches stronger decks.
- Card pool scope: `ST01`, `ST02`, `ST03`, `BT01` implemented cards only.
- Rule source of truth:
  - Card text first (Rule 1.3.1)
  - `NivelArena_Comprehensive_Rules_Ver.2.0.pdf`
  - Existing regression expectations under `tests/rules_v2_regression/`

## 2) Constraints and Guardrails

- Keep engine entry points for AI fixed:
  - `getLegalActions(actorPlayerId?)`
  - `step(action)`
  - `getObservation(actorPlayerId)`
  - `getSerializableState()`
- Preserve deterministic behavior for benchmarking:
  - Seeded RNG path must remain stable.
  - Same `seed + action sequence` must produce same state.
- Deck legality rules (must be enforced by deck search):
  - Leader 1 + deck 40 (Rule 5.1.2)
  - Max 3 copies of same identifier (Rule 5.1.2.2)
  - Trigger cards max 8 (Rule 5.1.2.3)
- Any AI change must keep these regression gates green:
  - `tests/rules_v2_regression/rules_v2_ai_ready_stage1_regression.test.ts`
  - `tests/rules_v2_regression/rules_v2_ai_ready_stage2_stage3_regression.test.ts`
  - `tests/rules_v2_regression/rules_v2_ai_baseline_bot_regression.test.ts`
  - `tests/rules_v2_regression/rules_v2_mulligan_regression.test.ts`
  - `tests/rules_v2_regression/rules_v2_bt01_061_targeting_regression.test.ts`
  - `npm run test:bot-soak`

## 3) Program Structure

- Track P (Play strength): stronger policy for a fixed deck.
- Track D (Deck strength): search/generate stronger legal decks.
- Shared infra track S: evaluation harness, replay/log format, metrics.

## 4) Priority Roadmap

## Phase 0: Benchmark and Eval Harness (Highest Priority)

- Why first:
  - No reliable progress without stable measurement.
- Deliverables:
  - `scripts/ai/run_match_batch.ts`: deterministic batch evaluator.
  - `scripts/ai/elo_ladder.ts`: round-robin and Elo report.
  - `scripts/ai/deck_pool.ts`: implemented card pool filter (`ST01-`, `ST02-`, `ST03-`, `BT01-`).
  - Result schema: win rate, average turns, deadlock rate, action invalid rate.
- Acceptance:
  - Re-running same seed set returns identical reports.
  - Quick soak remains green.

## Phase 1: Strong Play Bot v1 (Heuristic + Lookahead)

- Objective:
  - Beat `BaselineBot` with fixed decks in mirror and cross-deck scenarios.
- Implementation priority:
  1. Add explicit state evaluator:
     - damage race, board tempo, hand advantage, lethal threat, lane control.
  2. Add 1-step lookahead:
     - score legal actions by simulated immediate state value.
  3. Add tactical override rules:
     - lethal-now detection
     - avoid self-lethal lines
     - value-preserving block decisions
  4. Keep interaction actions robust:
     - `SELECT_TARGET`, `SELECT_COST`, `RESOLVE_OPTIONAL`, mulligan.
- Suggested files:
  - `src/logic/ai/StrongBot.ts`
  - `src/logic/ai/eval/StateEvaluator.ts`
  - `src/logic/ai/eval/ActionScorer.ts`
- Acceptance:
  - `StrongBot` >= 60% win rate vs `BaselineBot` over fixed benchmark suite.
  - No increase in `no_action` / `invalid_action` terminations.

## Phase 2: Strong Play Bot v2 (Search-based)

- Objective:
  - Improve tactical quality in complex interactions and hidden information.
- Implementation priority:
  1. Add simulation wrapper for rollout:
     - clone/snapshot-restore path for fast branching.
  2. Add depth-limited search:
     - start with beam search or light MCTS.
  3. Add stochastic handling:
     - multi-seed rollouts for random branches.
  4. Add time/step budget:
     - deterministic fallback to v1 scorer when budget exceeded.
- Acceptance:
  - v2 >= 55% win rate vs v1 on same deck set.
  - Runtime budget respected (target ms/action cap in batch mode).

## Phase 3: Deck Search MVP (Evolutionary Search)

- Objective:
  - Find stronger legal decks for a fixed leader and then for full leader pool.
- Implementation priority:
  1. Deck encoding:
     - genome as multiset of card IDs + leader ID.
  2. Legal deck generator:
     - strictly enforce 1/40/3copy/trigger<=8.
  3. Mutation/crossover operators:
     - swap N cards, rarity-agnostic, legality-preserving repair.
  4. Fitness function:
     - win rate vs baseline gauntlet + penalty for unstable outcomes.
- Suggested files:
  - `src/logic/ai/deck/DeckCodec.ts`
  - `src/logic/ai/deck/DeckLegality.ts`
  - `src/logic/ai/deck/DeckSearchGA.ts`
  - `scripts/ai/run_deck_search.ts`
- Acceptance:
  - Search run produces top-K legal decks with reproducible ranking by seed.
  - Best found deck > reference starter deck win rate by target margin.

## Phase 4: Co-evolution and Meta Robustness

- Objective:
  - Prevent overfitting to one opponent bot or one deck.
- Implementation priority:
  1. Opponent pool evaluation:
     - baseline, strong v1, strong v2, previous checkpoints.
  2. Deck league:
     - league scoring instead of single-opponent score.
  3. Population memory:
     - keep historically diverse strong decks.
  4. Anti-collapse objective:
     - include diversity bonus in fitness.
- Acceptance:
  - Top decks maintain strength across opponent pool, not one matchup only.

## Phase 5: RL Integration (Optional after search is stable)

- Positioning:
  - RL is valuable, but should come after strong evaluator + search pipeline.
- Implementation priority:
  1. Offline dataset export from self-play and deck-search matches.
  2. Behavior cloning warm start on strong policy traces.
  3. PPO fine-tuning with legal-action masking.
  4. Self-play with opponent checkpoint sampling.
- Acceptance:
  - RL policy beats search-based bot in controlled arena without deadlock regressions.

## 5) Milestones and Exit Criteria

- M1 (end of Phase 1):
  - StrongBot v1 in codebase and benchmark harness available.
- M2 (end of Phase 2):
  - Search-based play bot with stable runtime budget.
- M3 (end of Phase 3):
  - Deck search CLI returns reproducible top decks from ST01/ST02/ST03/BT01 pool.
- M4 (end of Phase 4):
  - Co-evolved decks robust across deck/opponent league.
- M5 (Phase 5 optional):
  - RL policy integrated into evaluation ladder.

## 6) Proposed Command Set

- `npm run ai:bench`:
  - bot-vs-bot benchmark with fixed seeds and report output.
- `npm run ai:ladder`:
  - multi-bot round robin with Elo.
- `npm run ai:deck-search`:
  - run GA/ES deck search with config.
- `npm run ai:regression`:
  - AI-required regression subset + soak quick run.

## 7) Test Strategy per Phase

- Before each phase implementation:
  - Add failing tests first (rule/behavior specific).
- During each phase:
  - Unit tests for scorer/search/deck legality.
  - Regression tests for interaction ownership and target selection.
  - Soak tests for deadlock/no-action detection.
- After each phase:
  - Run full `npm test`.
  - Run quick soak.
  - Store benchmark artifact with seed list and commit hash.

## 8) Risks and Mitigations

- Risk: Evaluation noise due to small sample sizes.
  - Mitigation: fixed seed suites + confidence interval reporting.
- Risk: Deck search overfits one bot.
  - Mitigation: opponent pool and league-based fitness.
- Risk: Runtime explosion in search.
  - Mitigation: budgeted rollout, beam cap, early cutoff.
- Risk: Rule regression while optimizing AI.
  - Mitigation: keep AI changes behind strict regression gate.

## 9) Recommended First 2 Weeks

- Week 1:
  - Phase 0 complete.
  - StrongBot v1 evaluator skeleton + benchmark baseline report.
- Week 2:
  - StrongBot v1 tactical overrides.
  - Deck legality module + random legal deck generator.
  - First deck search dry-run with small population and short generations.
