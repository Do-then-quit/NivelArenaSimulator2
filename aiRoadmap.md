# AI Roadmap: Strong Play Bot + Strong Deck Search

## Progress Status (2026-02-12)

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
- [~] Phase 2 implementation started
  - Evidence: `Phase2.md`
  - Added:
    - simulation fork infra (`GameEngine.createSimulationFork`, RNG clone)
    - `StrongBotV2` (beam search + deterministic v1 fallback)
    - phase2 regression test (`tests/ai/StrongBotPhase2.vitest.test.ts`)
    - engine stack-overflow hotfix (`seed=2026021819`) + regression
      (`tests/rules_v2_regression/rules_v2_ai_seed_2026021819_stack_regression.test.ts`)
    - runtime KPI telemetry in batch summary (`summary.runtime.msPerAction`)
      via `AI_BENCH_MEASURE_RUNTIME=1`
    - v2 tuning applied (search-phase expansion, coverage-based fallback, aggregation rebalance)
- [x] Phase 2 re-evaluation completed (promotion passed in protocol v1.1)
  - protocol v1.0 (reference): `213/400 = 53.25%`, 95% CI `[48.36%, 58.14%]` -> deferred
  - protocol v1.1 bench 200+200: `225/400 = 56.25%`, 95% CI `[51.39%, 61.11%]`
  - safety gate: `max_steps=0`, `no_action=0`, `invalid_action=0` (pass)
  - runtime sample 50+50: `ms/action=2.7520`, `avgMsPerGame=273.61`
  - ladder cross-check 100 games: `54-46 (54.0%)`
  - conclusion: promotion criteria (`combined >=55%` and `CI low >=50%`) met
- [~] Phase 2.1 interaction/effect-aware upgrade pass 1 applied
  - `StrongBotV2` search scope:
    - added interaction-branch search for `SELECT_TARGET` / `SELECT_COST` / `SELECT_OPTIONAL`
    - gated by `interactionOwnerPlayerId` ownership with separate interaction budget
  - `ActionScorer` refinement:
    - stronger `pendingEffect`-aware scoring (`actionType`, `actionValue`, `targetSchema`, `validTargets`)
    - lethal-lane removal priority, tempo-aware trash recovery, optional self-harm skip preference
  - validation:
    - `tests/ai/StrongBotV2InteractionSearch.vitest.test.ts`
    - `tests/ai/ActionScorerEffectAware.vitest.test.ts`
- [x] Phase 3 entry gate completed (2026-02-12)
  - Seed-suite freeze:
    - `artifacts/ai/seeds/phase3_v1.json` (`tuning`, `dev`, `promotion-holdout`)
    - bench runner now supports seed suite controls:
      - `AI_BENCH_SEED_SUITE`
      - `AI_BENCH_SEED_SUITE_PATH`
      - `AI_BENCH_SEED_LIST`
  - Observation-model compliance:
    - added `tests/ai/StrongBotObservationModel.vitest.test.ts`
  - Tactical KPI pipeline readiness:
    - batch report now includes `summary.tacticalKPIs`:
      - `wasteful_upgrade_rate`
      - `lethal_miss_rate`
      - `self_lethal_open_rate`
    - replay report now includes `tacticalMetrics` with the same KPI family
  - Ablation preset readiness:
    - added `artifacts/ai/ablation/phase3_v1_presets.json`
    - added validation tests:
      - `tests/ai/SeedSuites.vitest.test.ts`
      - `tests/ai/AblationPresets.vitest.test.ts`
- [~] Phase 3 started (Play bot v3 uplift)
  - Added observation-limited v3 scaffold:
    - `src/logic/ai/StrongBotV3.ts`
    - `src/logic/ai/eval/ObservationEvaluator.ts`
  - Registered `strong-v3` in bot registries:
    - `src/logic/ai/BotRegistry.ts`
    - `scripts/ai/bot_registry.ts`
  - Validation (2026-02-12):
    - `npm run build`
    - `npm test`
    - `AI_REGRESSION_SKIP_SOAK=1 npm run ai:regression`
  - Phase 3 stability hotfix applied (interaction stall / oscillation):
    - `src/logic/GameEngine.ts`: `getSerializableState()` now remaps `pendingEffect.selectedTargets` references for cloned simulation state (including `REVEALED` mapping support).
    - `src/logic/ai/eval/InteractionValueModel.ts`: heavy unselect-toggle penalty (`-50000`) added for `SELECT_HAND_TARGET` / `SELECT_ZONE_TARGET` / `SELECT_TRASH_TARGET` / `SELECT_REVEALED_TARGET`.
    - `tests/ai/StrongBotV3.vitest.test.ts`:
      - added partial-target confirm fallback regression (Rule 1.3.2)
      - added distinct second-target selection regression for `count=2` effects
  - Promotion-holdout checkpoint rerun (2026-02-12, `fix2`, side-swapped 220+220):
    - `250/440 = 56.82%`, 95% CI `[52.19%, 61.45%]`
    - termination safety: `winner=440`, `max_steps=0`, `no_action=0`, `invalid_action=0`
    - artifacts:
      - `artifacts/ai/bench/phase3_v3_vs_v2_p1v3_holdout_220_20260212_fix2.json`
      - `artifacts/ai/bench/phase3_v3_vs_v2_p2v3_holdout_220_20260212_fix2.json`
      - `artifacts/ai/bench/phase3_v3_vs_v2_holdout_440_summary_20260212_fix2.json`
- [ ] Phase 4 not started (Play bot hardening gate)
- [ ] Phase 5 not started (Deck search MVP)
- [ ] Phase 6 not started
- [ ] Phase 7 not started

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
- Information-model guardrail (Phase 3+ promotion profiles):
  - Promoted play bots are observation-limited. Decision logic must be based on `getObservation(actorPlayerId)` + legal actions + deterministic rollout outputs.
  - Direct reads of hidden opponent zones from live engine state (for example opponent hand or unrevealed deck order) are not allowed for promotion benchmarks.
  - If full-information debug bots are needed, keep them as explicit `*-omniscient` profiles and exclude them from promotion/ladders.
- Evaluation seed governance (Phase 3+):
  - Maintain three fixed seed suites: `tuning`, `dev`, `promotion-holdout`.
  - Promotion Go/No-Go decisions must use `promotion-holdout` only.
  - Seed suites must be versioned and stored as artifacts (recommended: `artifacts/ai/seeds/phase3_v1.json`).
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

## Phase 2 Entry Gate (Go/No-Go)

- Gate date baseline: 2026-02-10
- Must satisfy all checks before Phase 2 implementation starts:
  1. Stability gate is green:
     - `npm run ai:regression` passes.
     - `npm run test:bot-soak` quick mode has `no_action=0` and `invalid_action=0`.
  2. Measurement gate is reproducible:
     - `npm run ai:bench` and `npm run ai:ladder` are deterministic on same seed/config.
     - Keep benchmark artifacts under `artifacts/ai/`.
  3. Performance baseline for v1 is recorded:
     - Keep one role-fixed bench artifact and one side-swapped ladder artifact.
     - Record confidence interval from bench (`summary.confidence.*`).
  4. Phase 2 simulation prerequisite is implemented first:
     - Engine simulation fork path (`clone/snapshot-restore`) exists and is tested.
     - Forked simulation does not mutate the original engine state.
     - RNG state is forkable/reproducible for branch simulation.
  5. Fallback safety is enforced:
     - Search bot must fall back deterministically to v1 scorer when budget is exhausted and root-coverage is low.
     - No new `no_action` / `invalid_action` regressions in v2-vs-v1 batch.

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
  - v2 >= 55% win rate vs v1 on same deck set (side-swapped evaluation).
  - Runtime budget respected (node/step budget mandatory, ms/action tracking in batch mode).
  - No regression in termination safety (`no_action=0`, `invalid_action=0` on phase benchmark config).

## Phase 2 Next Work (Immediate)

1. [x] Engine stabilization completed:
   - fixed passive/exit recursion stack-overflow path (seed example: `2026021819`).
   - added regression: `tests/rules_v2_regression/rules_v2_ai_seed_2026021819_stack_regression.test.ts`.
2. [x] Runtime KPI instrumentation completed:
   - added `summary.runtime.msPerAction` telemetry to batch reports.
   - kept reproducibility by defaulting runtime measurement off (`AI_BENCH_MEASURE_RUNTIME=0`).
3. [x] v2 strength tuning:
   - expanded search phases to `MAIN/BLOCK/ATTACK`.
   - applied coverage-based fallback and root aggregation rebalance (`mean + 0.18 * max`).
   - reached `55.00%` in side-swapped 120-game run.
4. [x] Re-evaluation protocol v1.0 executed and recorded:
   - Side-swapped bench 200+200:
     - artifacts: `artifacts/ai/bench/phase2_protocol_v1_p1v2_200.json`,
       `artifacts/ai/bench/phase2_protocol_v1_p2v2_200.json`
     - result: `213/400 = 53.25%`, 95% CI `[48.36%, 58.14%]`
   - Safety criteria: `no_action=0`, `invalid_action=0` (pass)
   - Runtime 50+50:
     - artifacts: `artifacts/ai/bench/phase2_protocol_v1_runtime_p1v2_50.json`,
       `artifacts/ai/bench/phase2_protocol_v1_runtime_p2v2_50.json`
     - result: `ms/action=2.4074`, `avgMsPerGame=258.70`
   - Ladder cross-check 100 games:
     - artifact: `artifacts/ai/ladder/phase2_protocol_v1_ladder_100.json`
     - result: `57-43 (57.0%)`, Elo `1045.36`
   - Aggregated summary: `artifacts/ai/bench/phase2_protocol_v1_summary.json`
   - Decision: keep v2 as non-promoted until criteria (`>=55%` and CI low `>=50%`) are met
5. [x] Phase 2.1 interaction-search expansion (play strength first):
   - include `SELECT_TARGET` / `SELECT_COST` / `SELECT_OPTIONAL` in search space
   - expand branches only when `interactionOwnerPlayerId` is the bot actor
   - separate interaction budget (`interactionDepth`, `interactionBudget`) to protect main search budget
6. [x] Effect-aware decision upgrade:
   - score interaction actions from `pendingEffect` (`actionType`, `actionValue`, `targetSchema`, `validTargets`)
   - split target-value policies by effect intent (removal / buff / revive / hand-disruption / trash)
   - reduce pure `cost/power/hit` bias and increase state-transition value (lethal swing / lane control / hand tempo)
7. [x] Add tests and regression gates:
   - interaction-search unit tests (`tests/ai/StrongBotV2InteractionSearch.vitest.test.ts`)
   - effect-aware scoring unit tests (`tests/ai/ActionScorerEffectAware.vitest.test.ts`)
   - high-value target selection regressions:
     - `tests/cards/st01/st01_high_value_targeting_regression.test.ts`
     - `tests/cards/st02/st02_high_value_targeting_regression.test.ts`
     - `tests/cards/st03/st03_high_value_targeting_regression.test.ts`
     - `tests/cards/bt01/bt01_high_value_targeting_regression.test.ts`
   - included in `phase0.manifest.json` AI regression list
   - validated on 2026-02-11: `npm run ai:regression`, `npm run build`
   - stress symptom review completed:
     - prior long-running evaluation traced to interaction oscillation risk under `SELECT_TARGET`
     - no infinite-loop repro on fixed protocol rerun (`max_steps=0` in v1.1 summary)
8. [x] Promotion re-evaluation (v1.1):
   - bench 200+200 + runtime 50+50 + ladder 100 rerun completed
   - artifacts:
     - `artifacts/ai/bench/phase2_protocol_v1_1_p1v2_200.json`
     - `artifacts/ai/bench/phase2_protocol_v1_1_p2v2_200.json`
     - `artifacts/ai/bench/phase2_protocol_v1_1_runtime_p1v2_50.json`
     - `artifacts/ai/bench/phase2_protocol_v1_1_runtime_p2v2_50.json`
     - `artifacts/ai/ladder/phase2_protocol_v1_1_ladder_100.json`
     - `artifacts/ai/bench/phase2_protocol_v1_1_summary.json`
   - result:
     - combined win rate `56.25%` (`225/400`)
     - 95% CI `[51.39%, 61.11%]`
     - `max_steps=0`, `no_action=0`, `invalid_action=0`
   - decision: Phase 2 promotion gate passed (Phase 3 can be planned)

## Phase 3 Entry Gate (Go/No-Go)

- Must satisfy all checks before Phase 3 promotion evaluation:
  1. Seed-suite freeze:
     - lock `tuning`, `dev`, `promotion-holdout` suites with version tag (for example `phase3_v1`)
     - store suite file and generation rule under `artifacts/ai/seeds/`
  2. Observation-model compliance:
     - promoted bot profile must not rely on hidden-opponent information from live engine state
     - add compliance regression for representative hidden-info scenarios
  3. Tactical KPI pipeline readiness:
     - bench/replay report must include at least `wasteful_upgrade_rate`, `lethal_miss_rate`, `self_lethal_open_rate`
  4. Ablation preset readiness:
     - prepare reproducible on/off presets for each major v3 feature and output schema under `artifacts/ai/ablation/`

## Phase 3: Strong Play Bot v3 (Card-Effect Aware Multi-Turn Search)

- Objective:
  - Improve play strength before deck search by increasing effect comprehension and interaction precision.
  - Minimize tactical misses in `SELECT_TARGET` / `SELECT_COST` / optional-response turns.
- Implementation priority:
  1. Observation-limited policy boundary:
     - route decision features through actor observation view, not raw omniscient state reads.
     - keep explicit debug-only profile for omniscient experiments (`*-omniscient`).
  2. Interaction rollout expansion:
     - deepen branch evaluation for `SELECT_TARGET`, `SELECT_COST`, `SELECT_OPTIONAL`, `RESOLVE_OPTIONAL`.
     - bundle tactical action + interaction response as a single scored decision package.
  3. Opponent-response lookahead:
     - add lightweight opponent 1-ply reply in critical combat/interaction nodes.
     - penalize lines that open immediate lethal or high-value tempo loss.
  4. Card-effect outcome modeling:
     - extend `pendingEffect`-aware scoring with zone transition value (field/hand/trash/damage).
     - add lane-pressure and follow-up playable-value features.
  5. Resource-economy value modeling (card advantage aware):
     - explicitly score board-hand advantage proxy: `(# own units on board + # own hand cards) - (# opp units + # opp hand cards)`.
     - add a "wasteful upgrade" penalty when an upgrade consumes a hand card but does not improve:
       immediate damage pressure, combat survival probability, or next-turn lethal setup.
     - add "empty-lane over-upgrade" penalty for upgrades into an uncontested lane with low incremental value.
  6. Anti-oscillation / anti-stall safeguards:
     - detect repetitive interaction loops in search branches and down-rank them.
     - keep deterministic fallback path when branch confidence is low.
- Suggested files:
  - `src/logic/ai/StrongBotV3.ts`
  - `src/logic/ai/eval/InteractionValueModel.ts`
  - `src/logic/ai/eval/CounterfactualRollout.ts`
  - `tests/ai/StrongBotObservationModel.vitest.test.ts`
  - `tests/ai/StrongBotV3.vitest.test.ts`
- Acceptance:
  - v3 >= 55% vs v2 (side-swapped bench 200+200, promotion-holdout suite) with CI low >= 50%.
  - v3 >= 60% vs strong-v1 (side-swapped bench 200+200, promotion-holdout suite).
  - `max_steps=0`, `no_action=0`, `invalid_action=0` on promotion protocol.
  - tactical KPI improvement on replay audit holdout:
    - `wasteful_upgrade_rate <= v2 baseline`
    - `lethal_miss_rate <= v2 * 0.85`
    - `self_lethal_open_rate <= v2 * 0.80`
  - ablation report is produced and stored; each major v3 feature must be non-negative on dev suite (or explicitly rolled back).

## Phase 4: Play Bot Hardening and Pre-Deck-Search Gate

- Objective:
  - Freeze a robust play bot checkpoint before starting deck search.
  - Convert recent card-effect and interaction improvements into hard regression gates.
- Implementation priority:
  1. Regression expansion:
     - broaden high-value targeting regressions across ST01/ST02/ST03/BT01.
     - add optional/cost-choice regressions for high-impact card effects.
     - add no-value-upgrade regressions (empty lane / no damage gain / no survivability gain cases).
  2. Stress and soak matrix:
     - run long-horizon soak across bot pairs (`baseline`, `strong-v1`, `strong-v2`, `strong-v3`).
     - include heavy-interaction seed suites and monitor termination reasons.
  3. Runtime/quality release gate:
     - track p50/p95 `ms/action`, `avgMsPerGame`, and safety counters.
     - quantitative gate vs v2 promotion baseline:
       - `p50 ms/action <= 1.25x`
       - `p95 ms/action <= 1.60x`
       - `avgMsPerGame <= 1.40x`
     - keep `max_steps=0`, `no_action=0`, `invalid_action=0` on stress matrix.
  4. Checkpoint freeze:
     - register promoted `strong-v3` profile in bot registry and benchmark manifest.
- Acceptance:
  - `npm run ai:regression` and strengthened soak matrix pass.
  - `strong-v3` outperforms `strong-v2` on fixed protocol and remains stable under stress.
  - runtime gate passes with the quantitative thresholds above.
  - Pre-deck-search gate signed off with reproducible artifact set under `artifacts/ai/`.

## Phase 5: Deck Search MVP (Evolutionary Search)

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

## Phase 6: Co-evolution and Meta Robustness

- Objective:
  - Prevent overfitting to one opponent bot or one deck.
- Implementation priority:
  1. Opponent pool evaluation:
     - baseline, strong v1/v2/v3, previous checkpoints.
  2. Deck league:
     - league scoring instead of single-opponent score.
  3. Population memory:
     - keep historically diverse strong decks.
  4. Anti-collapse objective:
     - include diversity bonus in fitness.
- Acceptance:
  - Top decks maintain strength across opponent pool, not one matchup only.

## Phase 7: RL Integration (Optional after search is stable)

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
  - Observation-limited StrongBot v3 beats v2 on fixed protocol with interaction/effect-aware multi-turn gains.
- M4 (end of Phase 4):
  - Play-bot hardening gate passed (runtime/tactical KPI gates included) and `strong-v3` checkpoint frozen for deck search.
- M5 (end of Phase 5):
  - Deck search CLI returns reproducible top decks from ST01/ST02/ST03/BT01 pool.
- M6 (end of Phase 6):
  - Co-evolved decks robust across deck/opponent league.
- M7 (Phase 7 optional):
  - RL policy integrated into evaluation ladder.

## 6) Proposed Command Set

- `npm run ai:bench`:
  - bot-vs-bot benchmark with fixed seeds and report output.
- `npm run ai:ladder`:
  - multi-bot round robin with Elo.
- `npm run ai:deck-search`:
  - run GA/ES deck search with config (placeholder CLI until Phase 5 implementation is complete).
- `npm run ai:regression`:
  - AI-required regression subset + soak quick run.

## 7) Test Strategy per Phase

- Before each phase implementation:
  - Add failing tests first (rule/behavior specific).
- During each phase:
  - Unit tests for scorer/search/deck legality.
  - Observation-model compliance tests for promoted bot profiles.
  - Regression tests for interaction ownership and target selection.
  - Soak tests for deadlock/no-action detection.
- After each phase:
  - Run full `npm test`.
  - Run quick soak.
  - Store benchmark artifact with seed suite version + commit hash.
  - For Phase 3+, store ablation report and tactical KPI summary with the same seed suite version.

## 8) Risks and Mitigations

- Risk: Evaluation noise due to small sample sizes.
  - Mitigation: fixed seed suites + confidence interval reporting.
- Risk: Play-bot search complexity hurts iteration speed.
  - Mitigation: phase-specific runtime budgets, p95 monitoring, deterministic fallback.
- Risk: Deck search overfits one bot.
  - Mitigation: opponent pool and league-based fitness.
- Risk: Runtime explosion in search.
  - Mitigation: budgeted rollout, beam cap, early cutoff.
- Risk: Rule regression while optimizing AI.
  - Mitigation: keep AI changes behind strict regression gate.

## 9) Recommended First 2 Weeks

- Week 1:
  - Phase 3 kickoff: v3 interaction rollout + opponent 1-ply response scaffold.
  - Build v3-v2 fixed-protocol benchmark script preset.
- Week 2:
  - Phase 4 kickoff: expand high-value target/optional/cost regression set.
  - Run strengthened soak matrix and freeze candidate `strong-v3` checkpoint.
