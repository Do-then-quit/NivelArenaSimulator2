# Phase 4.1 Promotion Protocol (`v3.1 -> v3`)

## Purpose
- Lock one reproducible promotion procedure for advancing a Phase 4.1 candidate to the promoted `strong-v3` profile.

## Fixed Command
- `npm run ai:phase4.1:promote`

## Script
- `scripts/ai/run_phase41_promotion_gate.ts`

## Fixed Evaluation Structure
- Performance (promotion target): `candidate` vs `baseline` side-swapped `200 + 200` using `promotion-holdout` seed suite.
- Tactical KPI delta (control comparison): candidate/baseline each evaluated side-swapped vs `control` bot.
- Runtime gate baseline/threshold: reuse `phase0.manifest.json > phase4.runtimeGate*`.

## Gate Bundle
- Performance + CI:
  - candidate win rate threshold (`minWinRate`)
  - candidate CI low threshold (`minCi95Low`)
- Stability:
  - `max_steps=0`
  - `no_action=0`
  - `invalid_action=0`
- Runtime non-regression:
  - checked by `phase4_runtime_gate` thresholds
- Tactical KPI delta:
  - `lethal_miss_rate` relative-improvement threshold
  - no regression in `self_lethal_open_rate`
  - no regression in `wasteful_upgrade_rate`

## Artifact Naming Convention
- Summary latest:
  - `artifacts/ai/phase4_1/promotion_gate_latest.json`
- Summary tagged:
  - `artifacts/ai/phase4_1/promotion_gate_<artifactTag>.json`
- Run artifacts:
  - `artifacts/ai/phase4_1/runs/<artifactTag>_<runId>.json`
  - `artifacts/ai/phase4_1/runs/latest_<runId>.json`

## Key Environment Overrides
- Profile IDs:
  - `AI_PHASE41_PROMOTION_CANDIDATE_BOT`
  - `AI_PHASE41_PROMOTION_BASELINE_BOT`
  - `AI_PHASE41_PROMOTION_CONTROL_BOT`
- Seed suite:
  - `AI_PHASE41_PROMOTION_SEED_SUITE_PATH`
  - `AI_PHASE41_PROMOTION_SEED_SUITE` (`tuning|dev|promotion-holdout`)
- Games and runtime:
  - `AI_PHASE41_PROMOTION_HOLDOUT_GAMES_PER_ROLE`
  - `AI_PHASE41_PROMOTION_KPI_GAMES_PER_ROLE`
  - `AI_PHASE41_PROMOTION_MAX_STEPS`
  - `AI_PHASE41_PROMOTION_MEASURE_RUNTIME`
- Output:
  - `AI_PHASE41_PROMOTION_OUTPUT`
  - `AI_PHASE41_PROMOTION_ARTIFACT_TAG`
