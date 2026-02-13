# 플레이봇 강화 시도 제안서 (2026-02-13 기준)

## 1. 문서 목적
- 지금까지의 플레이봇 구현 상태를 코드/테스트/아티팩트 기준으로 요약한다.
- `strong-v3` 대비 더 강한 후보를 만들기 위한 우선 시도(실험) 목록을 제안한다.

## 2. 확인한 근거
- 구현 코드:
  - `src/logic/ai/BaselineBot.ts`
  - `src/logic/ai/StrongBot.ts`
  - `src/logic/ai/StrongBotV2.ts`
  - `src/logic/ai/StrongBotV3.ts`
  - `src/logic/ai/eval/ObservationEvaluator.ts`
  - `src/logic/ai/eval/CounterfactualRollout.ts`
  - `src/logic/ai/eval/InteractionValueModel.ts`
  - `src/logic/GameEngine.ts`
- 실행/평가 파이프라인:
  - `scripts/ai/run_match_batch.ts`
  - `scripts/ai/match_harness.ts`
  - `scripts/ai/elo_ladder.ts`
  - `scripts/ai/run_phase4_stress_matrix.ts`
  - `scripts/ai/run_phase41_promotion_gate.ts`
  - `scripts/ai/phase0_manifest.ts`
  - `phase0.manifest.json`
- 테스트:
  - `tests/ai/*.vitest.test.ts`
  - `tests/rules_v2_regression/rules_v2_ai_*.test.ts`
- 성능 아티팩트:
  - `artifacts/ai/bench/phase2_protocol_v1_1_summary.json`
  - `artifacts/ai/bench/phase3_v3_vs_v2_holdout_440_summary_20260212_fix2.json`
  - `artifacts/ai/phase4_1/promotion_gate_latest.json`

## 3. 현재 플레이봇 구현 상태 스냅샷

### 3.1 엔진/AI 인터페이스
- 완료:
  - `getLegalActions(actorPlayerId?)`, `step(action)`, `getObservation(actorPlayerId)`, `getSerializableState()` 경로가 고정되어 있음.
  - `createSimulationFork()` + RNG `clone()`으로 결정론적 포크 시뮬레이션 지원.
  - 상호작용 입력권(`interactionOwnerPlayerId`) 기반 액션 생성/소비가 테스트로 고정됨.
- 의미:
  - 봇 강화 실험을 엔진 변경 최소화로 반복 가능.

### 3.2 봇 계층
- `BaselineBot`:
  - 규칙 기반 우선순위(공격/블록/코스트/타겟 선택) + self-play 루프(`runBaselineSelfPlay`).
- `StrongBot(v1)`:
  - `StateEvaluator + ActionScorer` 조합의 1-step surrogate 스코어링.
  - 상호작용 모드는 baseline fallback.
- `StrongBotV2`:
  - 빔서치(깊이/예산/beam width) + 커버리지 기반 fallback.
  - `SELECT_TARGET/SELECT_COST/SELECT_OPTIONAL` 상호작용 탐색 확장.
- `StrongBotV3`:
  - 관측 기반 스코어링(`ObservationEvaluator`) + 카운터팩추얼 롤아웃.
  - 상호작용 반복 패널티(anti-oscillation).
  - 상대 응답 top-K 집계 옵션(`opponentReplyTopK`, `opponentReplyAggregation`).

### 3.3 평가/게이트 체계
- 배치/라더/회귀/소크가 스크립트화됨.
- KPI 계측 포함:
  - `wasteful_upgrade_rate`
  - `lethal_miss_rate`
  - `self_lethal_open_rate`
- Phase4/4.1 게이트 포함:
  - 안정성(`max_steps/no_action/invalid_action`)
  - 런타임 비열화
  - 성능+CI
  - 전술 KPI 델타

## 4. 최근 성능 상태 (핵심 수치)
- Phase2 v1.1 승격 통과:
  - `225/400 = 56.25%`, CI low `0.5139`
  - 출처: `artifacts/ai/bench/phase2_protocol_v1_1_summary.json`
- Phase3 holdout(수정본) 통과:
  - `250/440 = 56.82%`, CI low `0.5219`
  - 출처: `artifacts/ai/bench/phase3_v3_vs_v2_holdout_440_summary_20260212_fix2.json`
- Phase4.1 승격 게이트 No-Go:
  - 생성 시각: `2026-02-13T11:28:02.673Z`
  - 후보(`strong-v3.1-topk3`) vs 기준(`strong-v3`) 합산: `164/400 = 41.0%`, CI low `0.3618`
  - 안정성/런타임/전술KPI 게이트는 통과, 성능 게이트만 실패
  - 출처: `artifacts/ai/phase4_1/promotion_gate_latest.json`

## 5. 현재 병목 가설
- 가설 A: top-K 상대응답 집계(Phase4.1)가 과보수적으로 작동해 공격 기회를 잃는다.
- 가설 B: 스코어 가중치가 고정값이라 상호작용 상태/턴 템포에 따라 최적값이 달라도 적응하지 못한다.
- 가설 C: 탐색 예산이 상황별로 동일하게 적용되어, 중요한 분기(킬각/필수 상호작용)에 예산 집중이 부족하다.
- 가설 D: KPI는 3종만 있어 "왜 졌는지"를 직접 연결하기 어렵다(라인 단위/상호작용 타입 단위 진단 부족).
- 가설 E: 현재 롤아웃은 깊이와 정책 다양성이 제한적이라, 장기 교환가치(2~3턴 후 이득)를 놓친다.

## 6. 더 강한 봇을 위한 우선 시도 (추천 순서)

### 6.1 1순위: 성능 회복 실험 (Phase4.1 복구)
1. 상태의존 Top-K/집계 동적화
- 아이디어: 항상 `topK=3`이 아니라 분기 수/치명도에 따라 `1~3` 자동 선택.
- 후보 변경점:
  - `src/logic/ai/StrongBotV3.ts`
  - `src/logic/ai/eval/CounterfactualRollout.ts`
- 합격 기준:
  - `strong-v3.1-candidate` vs `strong-v3` side-swapped holdout 200+200에서 `winRate >= 0.53`, `CI low >= 0.50`.

2. 즉시 점수 vs 롤아웃 점수 가중치의 국면별 스케줄링
- 아이디어: MAIN 초반/상호작용 중/킬각 구간에서 `actionScoreWeight`와 `stateScoreWeight`를 다르게 적용.
- 후보 변경점:
  - `src/logic/ai/StrongBotV3.ts`
- 합격 기준:
  - 성능 게이트 상승 + 런타임 게이트 유지.

3. 상호작용 전용 정책 세분화
- 아이디어: `SELECT_TARGET`, `SELECT_COST`, `SELECT_OPTIONAL` 각각 별도 점수 규칙/예산 사용.
- 후보 변경점:
  - `src/logic/ai/eval/InteractionValueModel.ts`
  - `src/logic/ai/eval/ObservationEvaluator.ts`
- 합격 기준:
  - `rules_v2_ai_phase4_interaction_regression` 유지 + holdout 승률 개선.

### 6.2 2순위: 탐색 품질 강화
4. 중요 분기 우선 예산 배분(Progressive Budgeting)
- 아이디어: lethal 가능 턴, 블록 강제 턴, 필수 코스트/타겟 선택에는 깊이/beam 확대.
- 후보 변경점:
  - `src/logic/ai/StrongBotV2.ts`
  - `src/logic/ai/StrongBotV3.ts`
- 합격 기준:
  - 동일 런타임 예산에서 성능 상승, `max_steps/no_action/invalid_action` 0 유지.

5. 2-ply principal variation 고정 탐색
- 아이디어: 현재 root+reply 중심 평가에 "내 다음 응답 1수"를 제한적으로 포함.
- 후보 변경점:
  - `src/logic/ai/eval/CounterfactualRollout.ts`
- 합격 기준:
  - kill-miss/자해 오픈율 악화 없이 win rate 상승.

6. 반복/토글 패널티의 컨텍스트화
- 아이디어: 현재 고정 패널티(`-50000`)를 효과 타입/선택 수 기준으로 차등화.
- 후보 변경점:
  - `src/logic/ai/eval/InteractionValueModel.ts`
- 합격 기준:
  - `rules_v2_ai_seed_2026021312_trash_toggle_regression` 안정성 유지 + 정상 경기 길이 단축.

### 6.3 3순위: 계측/데이터 강화
7. 패배 리플레이 자동 분류기 추가
- 아이디어: 패배 게임을 액션 패턴(킬각 미스, 과잉 업그레이드, optional 오판)으로 자동 라벨링.
- 후보 변경점:
  - `scripts/ai/run_match_batch.ts`
  - `src/logic/ai/BotVsBotReplay.ts`
- 합격 기준:
  - 상위 패배 원인 TOP3를 seed 리스트와 함께 자동 출력.

8. KPI 확장(라인 단위/상호작용 타입 단위)
- 아이디어: 현재 3개 KPI 외에 lane-pressure 손실률, cost-payment 손실률, block 실수율 추가.
- 후보 변경점:
  - `scripts/ai/match_harness.ts`
  - `scripts/ai/run_phase4_stress_matrix.ts`
- 합격 기준:
  - 승격 실패 시 원인을 정량적으로 즉시 설명 가능.

9. 오프라인 데이터셋 적재 파이프라인 착수(로드맵 연계)
- 아이디어: self-play/replay 로그를 학습 가능한 transition 포맷으로 적재.
- 후보 변경점:
  - 신규 `scripts/ai/dataset/*`
- 합격 기준:
  - 동일 seed 재실행 시 동일 dataset hash 재현.

## 7. 실행 프로토콜 (실험 1회당 공통)
1. 단위/회귀 선검증
- `npx vitest run tests/ai/StrongBotV3.vitest.test.ts tests/ai/ActionScorerEffectAware.vitest.test.ts tests/rules_v2_regression/rules_v2_ai_phase4_interaction_regression.test.ts`
2. 전체 AI 회귀
- `AI_REGRESSION_SKIP_SOAK=1 npm run ai:regression`
3. 안정성 소크
- `npm run test:bot-soak`
4. 성능/런타임/전술 매트릭스
- `npm run ai:phase4:matrix`
5. 승격 판정
- `npm run ai:phase4.1:promote`

## 8. 제안하는 다음 2개 실험 (바로 실행 가치 높음)
- 실험 E1: "동적 Top-K + weighted/mean 혼합"
  - 목표: No-Go 원인(성능 게이트) 직접 타격.
  - 기대: 공격 기회 손실 감소.
- 실험 E2: "국면별 가중치 스케줄링 + 중요 분기 예산 집중"
  - 목표: 동일 런타임에서 의사결정 품질 상승.
  - 기대: holdout 승률 개선, KPI 비열화 유지.

---
메모: `artifacts/ai/phase4/stress_matrix_latest.json`은 현재 워크스페이스에 없어, 필요 시 `npm run ai:phase4:matrix`로 재생성해 최신 수치를 동기화한다.
