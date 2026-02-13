# AI 로드맵: 강한 플레이 봇 + 강한 덱 탐색

## 진행 현황 (2026-02-13)

- [x] Phase 0 완료
  - 근거 문서: `Phase0.md`
  - 반영: 매니페스트 기반 평가, 신뢰구간, `ai:regression` 게이트
- [x] Phase 1 구현 완료 (StrongBot v1)
  - 근거 문서: `Phase1.md`
  - 반영: `src/logic/ai/StrongBot.ts`, evaluator/scorer, bot registry 연동
- [~] Phase 1 성능 목표 부분 안정화
  - 라더(진영 스왑 포함, entrants=`strong-v1,baseline-a,baseline-b`, seedsPerPair=6):
    - `strong-v1` 15승 9패(62.5%), Elo 1041.06
  - 고정 역할 벤치에서 `baseline-b` 상대 성능은 추가 튜닝 필요
- [~] Phase 2 구현 착수
  - 근거 문서: `Phase2.md`
  - 반영:
    - 시뮬레이션 포크 인프라(`GameEngine.createSimulationFork`, RNG clone)
    - `StrongBotV2` (beam search + 결정론적 v1 fallback)
    - Phase2 회귀 테스트(`tests/ai/StrongBotPhase2.vitest.test.ts`)
    - 엔진 stack overflow hotfix(`seed=2026021819`) + 회귀 추가
      (`tests/rules_v2_regression/rules_v2_ai_seed_2026021819_stack_regression.test.ts`)
    - 배치 리포트 runtime KPI(`summary.runtime.msPerAction`) 계측 추가
      (`AI_BENCH_MEASURE_RUNTIME=1`)
    - v2 튜닝(탐색 phase 확장/커버리지 기반 fallback/집계식 보정) 반영
- [x] Phase 2 재평가 완료 (v1.1에서 승격 통과)
  - 프로토콜 v1.0(참고): `213/400 = 53.25%`, 95% CI `[48.36%, 58.14%]` -> 승격 보류
  - 프로토콜 v1.1 bench 200+200: `225/400 = 56.25%`, 95% CI `[51.39%, 61.11%]`
  - 안정성 게이트: `max_steps=0`, `no_action=0`, `invalid_action=0` (통과)
  - runtime 샘플 50+50: `ms/action=2.7520`, `avgMsPerGame=273.61`
  - ladder 교차 확인 100게임: `54승 46패 (54.0%)`
  - 결론: 승격 기준(`합산 승률>=55%` + `CI 하한>=50%`) 충족
- [~] Phase 2.1 인터랙션/효과 인지 강화 1차 반영
  - `StrongBotV2` 탐색 상태 확장:
    - `SELECT_TARGET` / `SELECT_COST` / `SELECT_OPTIONAL` 탐색 분기 활성화
    - `interactionOwnerPlayerId` 일치 시에만 탐색 허용 + 인터랙션 예산 분리
  - `ActionScorer` 세분화:
    - `pendingEffect(actionType/actionValue/targetSchema/validTargets)` 기반 가치 계산 강화
    - 치명 위협 라인 우선 제거, 트래시 복구 시 템포(즉시 플레이 가능성) 반영, optional 자해 효과 스킵 반영
  - 검증:
    - `tests/ai/StrongBotV2InteractionSearch.vitest.test.ts`
    - `tests/ai/ActionScorerEffectAware.vitest.test.ts`
- [x] Phase 3 착수 게이트 완료 (2026-02-12)
  - Seed 세트 동결:
    - `artifacts/ai/seeds/phase3_v1.json` (`tuning`, `dev`, `promotion-holdout`)
    - bench 실행기의 seed 세트 입력 지원 추가:
      - `AI_BENCH_SEED_SUITE`
      - `AI_BENCH_SEED_SUITE_PATH`
      - `AI_BENCH_SEED_LIST`
  - 관측 모델 준수:
    - `tests/ai/StrongBotObservationModel.vitest.test.ts` 추가
  - 전술 KPI 파이프라인 준비:
    - 배치 리포트에 `summary.tacticalKPIs` 추가:
      - `wasteful_upgrade_rate`
      - `lethal_miss_rate`
      - `self_lethal_open_rate`
    - 리플레이 리포트에 동일 KPI 계열 `tacticalMetrics` 추가
  - Ablation 프리셋 준비:
    - `artifacts/ai/ablation/phase3_v1_presets.json` 추가
    - 검증 테스트 추가:
      - `tests/ai/SeedSuites.vitest.test.ts`
      - `tests/ai/AblationPresets.vitest.test.ts`
- [~] Phase 3 착수 (플레이 봇 v3 강화)
  - 관측 기반 v3 스캐폴드 추가:
    - `src/logic/ai/StrongBotV3.ts`
    - `src/logic/ai/eval/ObservationEvaluator.ts`
  - `strong-v3` bot registry 연동:
    - `src/logic/ai/BotRegistry.ts`
    - `scripts/ai/bot_registry.ts`
  - 검증(2026-02-12):
    - `npm run build`
    - `npm test`
    - `AI_REGRESSION_SKIP_SOAK=1 npm run ai:regression`
  - Phase 3 안정성 핫픽스 반영 (인터랙션 정체/진동 대응):
    - `src/logic/GameEngine.ts`: `getSerializableState()`에서 시뮬레이션 clone 상태의 `pendingEffect.selectedTargets` 참조를 재매핑하도록 보강(`REVEALED` 매핑 포함).
    - `src/logic/ai/eval/InteractionValueModel.ts`: `SELECT_HAND_TARGET` / `SELECT_ZONE_TARGET` / `SELECT_TRASH_TARGET` / `SELECT_REVEALED_TARGET`에 대해 unselect-toggle 강한 패널티(`-50000`) 적용.
    - `tests/ai/StrongBotV3.vitest.test.ts`:
      - 부분 타겟 선택 후 confirm fallback 회귀 추가 (Rule 1.3.2)
      - `count=2` 선택에서 동일 타겟 토글 대신 서로 다른 2번째 타겟 선택 회귀 추가
  - 승격 holdout 체크포인트 재실행 (2026-02-12, `fix2`, 진영 스왑 220+220):
    - `250/440 = 56.82%`, 95% CI `[52.19%, 61.45%]`
    - 종료 안정성: `winner=440`, `max_steps=0`, `no_action=0`, `invalid_action=0`
    - 산출물:
      - `artifacts/ai/bench/phase3_v3_vs_v2_p1v3_holdout_220_20260212_fix2.json`
      - `artifacts/ai/bench/phase3_v3_vs_v2_p2v3_holdout_220_20260212_fix2.json`
      - `artifacts/ai/bench/phase3_v3_vs_v2_holdout_440_summary_20260212_fix2.json`
- [x] Phase 4 완료 (플레이 봇 하드닝 게이트)
  - PR1 최소 작업 세트 문서화:
    - `docs/ai/phase4_pr1_minimum.md`
  - Phase 4 상호작용 회귀 추가:
    - `tests/rules_v2_regression/rules_v2_ai_phase4_interaction_regression.test.ts`
    - 커버 축: `SELECT_COST` / `SELECT_TARGET` / `SELECT_OPTIONAL`
  - AI 회귀 파이프라인 편입:
    - `phase0.manifest.json`
    - `scripts/ai/phase0_manifest.ts`
  - 검증(quick):
    - `npx vitest run tests/rules_v2_regression/rules_v2_ai_phase4_interaction_regression.test.ts`
    - `AI_REGRESSION_SKIP_SOAK=1 npm run ai:regression`
  - Phase 4 하드닝 자동화(스트레스 매트릭스 + 런타임 게이트) 추가:
    - `scripts/ai/run_phase4_stress_matrix.ts`
    - `scripts/ai/phase4_runtime_gate.ts`
    - `docs/ai/phase4_completion_runbook.md`
    - `phase0.manifest.json`, `scripts/ai/phase0_manifest.ts`(`phase4` 설정 추가)
  - 실행 커맨드 추가:
    - `npm run ai:phase4:matrix`
  - 검증:
    - `npx vitest run tests/ai/Phase0Manifest.vitest.test.ts tests/ai/Phase4RuntimeGate.vitest.test.ts tests/rules_v2_regression/rules_v2_ai_phase4_interaction_regression.test.ts`
    - `AI_PHASE4_MATRIX_PAIRINGS='strong-v3:baseline-a:2' AI_PHASE4_GATE_P50_MULT=2 AI_PHASE4_MATRIX_OUTPUT='-' npm run ai:phase4:matrix`
  - Phase 4 완료 게이트 실측(기본 설정, 120 games):
    - `npm run ai:phase4:matrix`
    - 종료 안정성: `winner=120`, `max_steps=0`, `no_action=0`, `invalid_action=0`
    - 런타임 게이트(actual): `p50=5.8075`, `p95=7.667`, `avgMsPerGame=680.75` (통과)
    - 성능 게이트: `strong-v3 vs strong-v2 = 30/48 (62.5%)` (통과)
    - 산출물: `artifacts/ai/phase4/stress_matrix_latest.json`
- [ ] Phase 5 미착수 (덱 탐색 MVP)
- [ ] Phase 6 미착수
- [ ] Phase 7 미착수

## 1) 범위

- 목표 A: 현재 `BaselineBot`보다 더 강한 인게임 플레이 봇 구축
- 목표 B: 더 강한 덱을 탐색/구성하는 덱 빌딩 봇 구축
- 카드풀 범위: 구현된 `ST01`, `ST02`, `ST03`, `BT01` 카드만 사용
- 룰 기준 우선순위:
  - 카드 텍스트 우선 (Rule 1.3.1)
  - `NivelArena_Comprehensive_Rules_Ver.2.0.pdf`
  - `tests/rules_v2_regression/`의 기존 회귀 기대 동작

## 2) 제약 및 가드레일

- AI용 엔진 진입점은 고정 유지:
  - `getLegalActions(actorPlayerId?)`
  - `step(action)`
  - `getObservation(actorPlayerId)`
  - `getSerializableState()`
- 벤치마크 결정론 보장:
  - seed 기반 RNG 경로는 안정적으로 유지
  - 동일 `seed + action sequence`는 동일 상태를 재현해야 함
- 정보 모델 가드레일 (Phase 3+ 승격 프로파일):
  - 승격 대상 플레이 봇은 관측 기반(Observation-limited)으로 동작해야 한다. 의사결정은 `getObservation(actorPlayerId)` + 합법 액션 + 결정론적 롤아웃 결과만 사용한다.
  - 라이브 엔진 상태에서 상대 비공개 정보(예: 상대 손패, 미공개 덱 순서)를 직접 읽는 로직은 승격 벤치에서 금지한다.
  - 완전정보 실험이 필요하면 `*-omniscient` 디버그 프로파일로 분리하고 승격/라더 산출물에서 제외한다.
- 평가 seed 운영 규칙 (Phase 3+):
  - 고정 seed 세트를 `tuning`, `dev`, `promotion-holdout` 3종으로 분리 유지한다.
  - 승격 Go/No-Go 판정은 `promotion-holdout` 세트만 사용한다.
  - seed 세트는 버전 태그와 함께 산출물로 관리한다(권장: `artifacts/ai/seeds/phase3_v1.json`).
- 덱 탐색 시 덱 합법성 규칙 강제:
  - 리더 1 + 덱 40장 (Rule 5.1.2)
  - 동일 식별번호 최대 3장 (Rule 5.1.2.2)
  - 트리거 카드 최대 8장 (Rule 5.1.2.3)
- AI 변경 시 아래 회귀 게이트는 반드시 통과:
  - `tests/rules_v2_regression/rules_v2_ai_ready_stage1_regression.test.ts`
  - `tests/rules_v2_regression/rules_v2_ai_ready_stage2_stage3_regression.test.ts`
  - `tests/rules_v2_regression/rules_v2_ai_baseline_bot_regression.test.ts`
  - `tests/rules_v2_regression/rules_v2_mulligan_regression.test.ts`
  - `tests/rules_v2_regression/rules_v2_bt01_061_targeting_regression.test.ts`
  - `npm run test:bot-soak`

## 3) 프로그램 구조

- Track P (Play strength): 고정 덱 기준 플레이 정책 강화
- Track D (Deck strength): 합법 덱 탐색/생성 강화
- Track S (Shared infra): 평가 하네스, 리플레이/로그 포맷, 메트릭 공통화

## 4) 우선순위 로드맵

## Phase 0: 벤치마크 및 평가 하네스 (최우선)

- 선행 이유:
  - 안정적인 측정 없이 개선 방향을 검증할 수 없음
- 산출물:
  - `scripts/ai/run_match_batch.ts`: 결정론적 배치 매치 평가기
  - `scripts/ai/elo_ladder.ts`: 라운드로빈 + Elo 리포트
  - `scripts/ai/deck_pool.ts`: 구현 카드풀 필터 (`ST01-`, `ST02-`, `ST03-`, `BT01-`)
  - 결과 스키마: 승률, 평균 턴수, 데드락률, invalid action 비율
- 완료 기준:
  - 같은 seed 세트 재실행 시 동일 리포트 재현
  - quick soak 통과 유지

## Phase 1: Strong Play Bot v1 (휴리스틱 + 1수 탐색)

- 목표:
  - 고정 덱 미러전/교차전에서 `BaselineBot`을 안정적으로 상회
- 구현 우선순위:
  1. 명시적 상태 평가함수 추가
     - 데미지 레이스, 보드 템포, 핸드 이득, 킬각 위협, 라인 컨트롤
  2. 1-step lookahead 추가
     - 합법 액션별 즉시 도달 상태를 점수화
  3. 전술 오버라이드 규칙 추가
     - 즉시 킬각 감지
     - 자멸 라인 회피
     - 손해 최소화 블록 판단
  4. 상호작용 액션 견고성 유지
     - `SELECT_TARGET`, `SELECT_COST`, `RESOLVE_OPTIONAL`, mulligan
- 권장 파일:
  - `src/logic/ai/StrongBot.ts`
  - `src/logic/ai/eval/StateEvaluator.ts`
  - `src/logic/ai/eval/ActionScorer.ts`
- 완료 기준:
  - 고정 벤치마크 세트에서 `StrongBot`이 `BaselineBot` 대비 승률 60% 이상
  - `no_action` / `invalid_action` 종료 증가 없음

## Phase 2 착수 게이트 (Go/No-Go)

- 기준일: 2026-02-10
- Phase 2 구현 착수 전 아래 조건을 모두 충족해야 함:
  1. 안정성 게이트 통과:
     - `npm run ai:regression` 통과
     - `npm run test:bot-soak` quick에서 `no_action=0`, `invalid_action=0`
  2. 측정 재현성 확보:
     - 동일 seed/config에서 `npm run ai:bench`, `npm run ai:ladder` 결과 재현
     - 벤치 아티팩트를 `artifacts/ai/`에 보관
  3. v1 기준선 기록:
     - 역할 고정 bench 1개 + 진영 스왑 ladder 1개를 기준선으로 저장
     - bench 신뢰구간(`summary.confidence.*`) 포함
  4. 시뮬레이션 선행 요건 구현:
     - 엔진 포크 경로(`clone/snapshot-restore`)를 먼저 구현/테스트
     - 포크 시뮬레이션이 원본 엔진 상태를 오염시키지 않아야 함
     - 분기 시뮬레이션용 RNG 상태 포크/재현 가능해야 함
  5. fallback 안전장치:
     - 탐색 예산 소진 시 루트 커버리지가 낮으면 v1 스코어러로 결정론적 fallback
     - v2-vs-v1 배치에서 `no_action` / `invalid_action` 회귀 없음

## Phase 2: Strong Play Bot v2 (탐색 기반)

- 목표:
  - 복잡한 상호작용/숨겨진 정보 상황에서 전술 품질 향상
- 구현 우선순위:
  1. 롤아웃 시뮬레이션 래퍼 추가
     - 빠른 분기를 위한 clone/snapshot-restore 경로
  2. 깊이 제한 탐색 추가
     - beam search 또는 경량 MCTS부터 시작
  3. 확률 분기 처리 추가
     - 랜덤 분기 다중 seed 롤아웃
  4. 시간/스텝 예산 도입
     - 예산 초과 시 v1 스코어러로 결정론적 fallback
- 완료 기준:
  - 동일 덱 세트(진영 스왑 평가)에서 v2가 v1 대비 승률 55% 이상
  - 런타임 예산 준수(노드/스텝 예산 필수, 배치에서 ms/action 추적)
  - 종료 안정성 회귀 없음(`no_action=0`, `invalid_action=0`)

## Phase 2 다음 즉시 작업

1. [x] 엔진 안정화 선행 완료:
   - passive/exit 재귀 체인의 stack overflow 재현 경로(예: seed `2026021819`) 수정
   - 신규 회귀: `tests/rules_v2_regression/rules_v2_ai_seed_2026021819_stack_regression.test.ts`
2. [x] 런타임 KPI 계측 완료:
   - 배치 리포트에 `summary.runtime.msPerAction` 추가
   - 재현성 보존을 위해 기본값은 비활성(`AI_BENCH_MEASURE_RUNTIME=0`)
3. [x] v2 성능 튜닝:
   - 탐색 적용 구간을 `MAIN/BLOCK/ATTACK`으로 확장
   - 루트 커버리지 기반 fallback, 노드 집계식(`mean + 0.18 * max`) 적용
   - side-swapped 120게임에서 `55.00%` 달성
4. [x] 재평가 프로토콜 v1.0 실행 및 결과 정리:
   - Bench(진영 스왑) 200+200:
     - 산출물: `artifacts/ai/bench/phase2_protocol_v1_p1v2_200.json`,
       `artifacts/ai/bench/phase2_protocol_v1_p2v2_200.json`
     - 결과: `213/400 = 53.25%`, 95% CI `[48.36%, 58.14%]`
   - 안정성 기준: `no_action=0`, `invalid_action=0` (통과)
   - Runtime 50+50:
     - 산출물: `artifacts/ai/bench/phase2_protocol_v1_runtime_p1v2_50.json`,
       `artifacts/ai/bench/phase2_protocol_v1_runtime_p2v2_50.json`
     - 결과: `ms/action=2.4074`, `avgMsPerGame=258.70`
   - Ladder 교차 확인 100게임:
     - 산출물: `artifacts/ai/ladder/phase2_protocol_v1_ladder_100.json`
     - 결과: `57승 43패 (57.0%)`, Elo `1045.36`
   - 집계 요약: `artifacts/ai/bench/phase2_protocol_v1_summary.json`
   - 판정: 승격 기준(`합산 승률>=55%` + `CI 하한>=50%`) 미충족으로 v2 승격 보류
5. [x] Phase 2.1 인터랙션 탐색 확장 (플레이 봇 완성 우선):
   - `SELECT_TARGET`/`SELECT_COST`/`SELECT_OPTIONAL` 구간도 탐색 대상으로 포함
   - 입력권(`interactionOwnerPlayerId`)이 봇 자신일 때만 분기 확장
   - 인터랙션 전용 예산(`interactionDepth`, `interactionBudget`)을 분리해 메인 탐색 예산 보호
6. [x] 카드 효과 인지형 의사결정 강화:
   - `pendingEffect` 기반 점수화(`actionType`, `actionValue`, `targetSchema`, `validTargets`)
   - 타겟 가치 함수 분리(제거/버프/부활/핸드개입/트래시)
   - 기존 `cost/power/hit` 편향을 낮추고, 상태 변화(킬각/라인 주도권/핸드 템포) 비중 상향
7. [x] 테스트/회귀 게이트 추가:
   - 인터랙션 탐색 단위 테스트(`tests/ai/StrongBotV2InteractionSearch.vitest.test.ts`)
   - 효과 인지형 가치함수 단위 테스트(`tests/ai/ActionScorerEffectAware.vitest.test.ts`)
   - 카드별 고밸류 타겟 선택 회귀:
     - `tests/cards/st01/st01_high_value_targeting_regression.test.ts`
     - `tests/cards/st02/st02_high_value_targeting_regression.test.ts`
     - `tests/cards/st03/st03_high_value_targeting_regression.test.ts`
     - `tests/cards/bt01/bt01_high_value_targeting_regression.test.ts`
   - `phase0.manifest.json` 회귀 목록에 새 테스트 반영
   - 2026-02-11 검증 통과: `npm run ai:regression`, `npm run build`
   - 장기 실행처럼 보였던 재평가 점검 완료:
     - `SELECT_TARGET` 구간 상호작용 진동 리스크를 추적/완화
     - v1.1 고정 프로토콜에서는 `max_steps=0`으로 무한루프 징후 미검출
8. [x] 승격 재평가 (v1.1):
   - 200+200 + runtime 50+50 + ladder 100 재측정 완료
   - 산출물:
     - `artifacts/ai/bench/phase2_protocol_v1_1_p1v2_200.json`
     - `artifacts/ai/bench/phase2_protocol_v1_1_p2v2_200.json`
     - `artifacts/ai/bench/phase2_protocol_v1_1_runtime_p1v2_50.json`
     - `artifacts/ai/bench/phase2_protocol_v1_1_runtime_p2v2_50.json`
     - `artifacts/ai/ladder/phase2_protocol_v1_1_ladder_100.json`
     - `artifacts/ai/bench/phase2_protocol_v1_1_summary.json`
   - 결과:
     - 합산 승률 `56.25%` (`225/400`)
     - 95% CI `[51.39%, 61.11%]`
     - `max_steps=0`, `no_action=0`, `invalid_action=0`
   - 판정: Phase 2 승격 게이트 통과 (Phase 3 착수 계획 가능)

## Phase 3 착수 게이트 (Go/No-Go)

- Phase 3 승격 평가 전에 아래를 모두 충족:
  1. Seed 세트 동결:
     - `tuning`, `dev`, `promotion-holdout`를 버전 태그(예: `phase3_v1`)로 고정
     - 세트 파일과 생성 규칙을 `artifacts/ai/seeds/`에 보관
  2. 관측 모델 준수:
     - 승격 대상 봇 프로파일은 라이브 엔진의 상대 비공개 정보에 의존하지 않아야 함
     - 대표적인 숨은 정보 시나리오에 대한 준수 회귀 테스트 추가
  3. 전술 KPI 파이프라인 준비:
     - bench/replay 리포트에 최소 `wasteful_upgrade_rate`, `lethal_miss_rate`, `self_lethal_open_rate` 집계 포함
  4. Ablation 프리셋 준비:
     - v3 핵심 기능별 on/off 재현 프리셋과 결과 스키마를 `artifacts/ai/ablation/`에 정리

## Phase 3: Strong Play Bot v3 (카드 효과 인지형 다중 턴 탐색)

- 목표:
  - 덱 탐색 전에 플레이 강도를 추가로 끌어올리기 위해, 카드 효과 이해와 인터랙션 정밀도를 강화한다.
  - `SELECT_TARGET` / `SELECT_COST` / optional 응답 구간에서 전술 미스를 최소화한다.
- 구현 우선순위:
  1. 관측 기반 정책 경계 확립
     - 의사결정 feature 입력을 actor 관측 뷰 기준으로 정리하고, 원시 완전정보 상태 직접 참조를 배제
     - 완전정보 실험은 `*-omniscient` 디버그 프로파일로 분리
  2. 인터랙션 롤아웃 확장
     - `SELECT_TARGET`, `SELECT_COST`, `SELECT_OPTIONAL`, `RESOLVE_OPTIONAL` 분기 깊이 강화
     - 전술 액션 + 인터랙션 응답을 하나의 의사결정 패키지로 묶어 점수화
  3. 상대 응답 1수 예측
     - 전투/인터랙션 핵심 노드에서 경량 1-ply 상대 응답 탐색 추가
     - 즉시 킬각 허용/고밸류 템포 손실 라인에 패널티 부여
  4. 카드 효과 결과 모델링
     - `pendingEffect` 기반 점수화에 영역 전이 가치(필드/핸드/트래시/데미지) 반영
     - 라인 압박과 후속 플레이 가능 가치(feature) 추가
  5. 자원 경제성 가치 모델링(아드 인지)
     - 보드-핸드 아드 프록시를 명시적으로 점수화:
       `(#내 필드 유닛 + #내 핸드) - (#상대 필드 유닛 + #상대 핸드)`
     - 업그레이드에 패 1장을 소모했는데 아래 항목이 개선되지 않으면 "무의미 업그레이드" 패널티 부여:
       즉시 데미지 압박, 전투 생존 확률, 다음 턴 킬각 세팅.
     - 상대 유닛이 없는 라인에서 증가 가치가 낮은 과투자 업그레이드(빈 라인 과업글) 패널티 추가.
  6. 진동/정체 방지 안전장치
     - 탐색 분기 내 반복 인터랙션 루프를 감지해 감점
     - 분기 신뢰도가 낮을 때 결정론적 폴백 유지
- 권장 파일:
  - `src/logic/ai/StrongBotV3.ts`
  - `src/logic/ai/eval/InteractionValueModel.ts`
  - `src/logic/ai/eval/CounterfactualRollout.ts`
  - `tests/ai/StrongBotObservationModel.vitest.test.ts`
  - `tests/ai/StrongBotV3.vitest.test.ts`
- 완료 기준:
  - v3가 v2 대비 side-swapped 200+200(승격 holdout seed 세트)에서 승률 `>=55%`, CI 하한 `>=50%`
  - v3가 strong-v1 대비 side-swapped 200+200(승격 holdout seed 세트)에서 승률 `>=60%`
  - 승격 프로토콜에서 `max_steps=0`, `no_action=0`, `invalid_action=0`
  - 전술 KPI 개선:
    - `wasteful_upgrade_rate <= v2 기준선`
    - `lethal_miss_rate <= v2 * 0.85`
    - `self_lethal_open_rate <= v2 * 0.80`
  - Ablation 리포트 산출 및 보관, v3 핵심 기능별 dev 세트 비열화(열화 시 롤백 근거 기록)

## Phase 4: 플레이 봇 하드닝 및 덱 탐색 전 게이트

- 목표:
  - 덱 탐색 착수 전에 견고한 플레이 봇 체크포인트를 고정한다.
  - 최근 카드 효과/인터랙션 개선을 강제 회귀 게이트로 승격한다.
- 구현 우선순위:
  1. 회귀 세트 확장
     - ST01/ST02/ST03/BT01 전반으로 고밸류 타겟팅 회귀 확대
     - 고영향 카드 효과의 optional/cost 선택 회귀 추가
     - 무가치 업그레이드 회귀 추가(빈 라인 / 데미지 증가 없음 / 생존성 증가 없음 케이스)
  2. 스트레스/소크 매트릭스
     - 봇 조합(`baseline`, `strong-v1`, `strong-v2`, `strong-v3`) 장기 소크 실행
     - 인터랙션 밀집 seed 묶음을 포함해 종료 사유 모니터링
  3. 런타임/품질 릴리스 게이트
     - p50/p95 `ms/action`, `avgMsPerGame`, 안전성 카운터 추적
     - v2 승격 기준선 대비 정량 게이트 적용:
       - `p50 ms/action <= 1.25x`
       - `p95 ms/action <= 1.60x`
       - `avgMsPerGame <= 1.40x`
     - 스트레스 매트릭스에서도 `max_steps=0`, `no_action=0`, `invalid_action=0` 유지
  4. 체크포인트 동결
     - 승격된 `strong-v3` 프로파일을 bot registry/manifest에 반영
- 완료 기준:
  - `npm run ai:regression` 및 강화된 소크 매트릭스 통과
  - `strong-v3`가 고정 프로토콜에서 `strong-v2`를 상회하고 스트레스 조건에서도 안정
  - 런타임 정량 게이트 충족
  - `artifacts/ai/`에 재현 가능한 산출물 세트와 함께 덱 탐색 전 게이트 승인

## Phase 5: 덱 탐색 MVP (진화형 탐색)

- 목표:
  - 리더 고정 덱부터 시작해 전체 리더 풀까지 강한 합법 덱 탐색
- 구현 우선순위:
  1. 덱 인코딩
     - 리더 ID + 카드 ID 멀티셋(genome)
  2. 합법 덱 생성기
     - 1/40/3장/트리거<=8 제약 엄격 적용
  3. 변이/교차 연산자
     - N장 교체, 희귀도 비의존, 합법성 보정(repair)
  4. 적합도 함수
     - 기준 봇 군집 대비 승률 + 불안정 결과 패널티
- 권장 파일:
  - `src/logic/ai/deck/DeckCodec.ts`
  - `src/logic/ai/deck/DeckLegality.ts`
  - `src/logic/ai/deck/DeckSearchGA.ts`
  - `scripts/ai/run_deck_search.ts`
- 완료 기준:
  - seed 기준 재현 가능한 top-K 합법 덱 출력
  - 탐색 최상위 덱이 기준 스타터 덱 대비 목표 승률 향상 달성

## Phase 6: 공진화(Co-evolution) 및 메타 견고화

- 목표:
  - 단일 상대/단일 덱에 과적합되는 현상 방지
- 구현 우선순위:
  1. 상대 풀 기반 평가
     - baseline, strong v1/v2/v3, 과거 체크포인트 포함
  2. 덱 리그 평가
     - 단일 상대 점수 대신 league 기반 스코어링
  3. 개체군 메모리
     - 과거 강한 덱을 다양성 있게 보존
  4. 붕괴 방지 목표
     - fitness에 다양성 보너스 반영
- 완료 기준:
  - 상위 덱이 특정 1매치업이 아닌 상대 풀 전반에서 강함 유지

## Phase 7: RL 통합 (탐색 파이프라인 안정화 이후 선택)

- 위치:
  - RL은 유효하지만, 강한 평가/탐색 파이프라인 이후가 효율적
- 구현 우선순위:
  1. self-play 및 덱 탐색 매치 로그의 오프라인 데이터셋 추출
  2. 강한 정책 트레이스로 behavior cloning 워밍업
  3. legal-action masking 기반 PPO 파인튜닝
  4. 상대 체크포인트 샘플링 기반 self-play
- 완료 기준:
  - 데드락 회귀 없이 RL 정책이 탐색 기반 봇을 통제된 평가장에서 상회

## 5) 마일스톤 및 종료 기준

- M1 (Phase 1 종료):
  - StrongBot v1 코드 반영 + 벤치마크 하네스 사용 가능
- M2 (Phase 2 종료):
  - 런타임 예산이 안정적인 탐색 기반 플레이 봇 확보
- M3 (Phase 3 종료):
  - 관측 기반(Observation-limited) StrongBot v3가 고정 프로토콜에서 v2를 상회(카드 효과 인지형 다중 턴 의사결정 강화)
- M4 (Phase 4 종료):
  - 플레이 봇 하드닝 게이트(런타임/전술 KPI 포함) 통과 + `strong-v3` 체크포인트 동결 완료
- M5 (Phase 5 종료):
  - ST01/ST02/ST03/BT01 카드풀에서 재현 가능한 top deck CLI 확보
- M6 (Phase 6 종료):
  - 덱/상대 리그 전반에서 견고한 공진화 덱 확보
- M7 (선택, Phase 7):
  - RL 정책이 평가 라더에 통합

## 6) 제안 커맨드 세트

- `npm run ai:bench`
  - 고정 seed 기반 bot-vs-bot 벤치마크 및 리포트 생성
- `npm run ai:ladder`
  - 다중 봇 라운드로빈 + Elo 계산
- `npm run ai:deck-search`
  - GA/ES 기반 덱 탐색 실행(Phase 5 전까지는 placeholder CLI)
- `npm run ai:regression`
  - AI 핵심 회귀 세트 + quick soak 실행

## 7) 단계별 테스트 전략

- 각 단계 구현 전:
  - 실패 테스트 먼저 작성(TDD)
- 각 단계 구현 중:
  - scorer/search/deck legality 단위 테스트
  - 승격 대상 봇의 관측 모델 준수 테스트
  - interaction ownership/target selection 회귀 테스트
  - deadlock/no-action 탐지 soak 테스트
- 각 단계 완료 후:
  - 전체 `npm test`
  - quick soak 실행
  - seed 세트 버전 + commit hash가 포함된 벤치마크 산출물 보관
  - Phase 3+에서는 ablation 결과와 전술 KPI 요약도 동일 seed 세트 버전으로 보관

## 8) 리스크 및 대응

- 리스크: 샘플 수 부족으로 평가 노이즈 발생
  - 대응: 고정 seed 세트 + 신뢰구간 리포팅
- 리스크: 플레이 봇 탐색 복잡도 증가로 반복 속도 저하
  - 대응: 단계별 런타임 예산, p95 모니터링, 결정론적 폴백 유지
- 리스크: 단일 봇 기준 과적합
  - 대응: 상대 풀 + 리그 기반 fitness
- 리스크: 탐색 시간 폭증
  - 대응: budgeted rollout, beam cap, 조기 종료
- 리스크: AI 최적화 중 룰 회귀 발생
  - 대응: 엄격한 회귀 게이트 통과를 병합 조건으로 유지

## 9) 권장 초기 2주 플랜

- Week 1:
  - Phase 3 착수: v3 인터랙션 롤아웃 + 상대 1수 응답 스캐폴드 구축
  - v3-v2 고정 프로토콜 벤치 프리셋 스크립트 정리
- Week 2:
  - Phase 4 착수: 고밸류 타겟/optional/cost 회귀 세트 확장
  - 강화된 소크 매트릭스 실행 후 `strong-v3` 후보 체크포인트 동결
