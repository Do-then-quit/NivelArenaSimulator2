# Phase 2 보고서 (Strong Play Bot v2 - Search-based)

## 1. 목적

Phase 2의 목표는 v1 휴리스틱 정책 위에 탐색 기반 의사결정을 추가해,
복잡한 전투/상호작용 구간에서 전술 품질을 높이는 것이다.

이번 작업에서는 다음 3가지를 우선 달성했다.

1. 시뮬레이션 포크 인프라 구축
2. Beam search 기반 `StrongBotV2` 구현
3. 회귀/안정성 검증 경로 통합

## 2. 범위

- 엔진 AI 진입점 유지:
  - `getLegalActions(actorPlayerId?)`
  - `step(action)`
  - `getObservation(actorPlayerId)`
  - `getSerializableState()`
- 카드풀 범위: `ST01`, `ST02`, `ST03`, `BT01`
- 룰/회귀 게이트 유지:
  - `tests/rules_v2_regression/*` AI 관련 핵심 세트
  - `npm run test:bot-soak`

## 3. 구현 결과

## 3.1 신규/수정 파일

- 신규
  - `src/logic/ai/StrongBotV2.ts`
  - `tests/ai/StrongBotPhase2.vitest.test.ts`
  - `tests/rules_v2_regression/rules_v2_ai_seed_2026021819_stack_regression.test.ts`
  - `Phase2.md`
- 수정
  - `src/logic/random.ts`
  - `src/logic/GameEngine.ts`
  - `scripts/ai/bot_registry.ts`
  - `scripts/ai/run_match_batch.ts`
  - `scripts/ai/phase0_manifest.ts`
  - `phase0.manifest.json`
  - `tests/ai/AiPhase0Harness.vitest.test.ts`
  - `aiRoadmap.md`
  - `aiRoadmap.ko.md`

## 3.2 시뮬레이션 인프라

1. RNG 포크 지원
- `RandomProvider`에 `clone()` 확장
- `SeededRandomProvider` 상태 복제 지원

2. 엔진 포크 API 추가
- `GameEngine.createSimulationFork()`
  - 현재 엔진 상태를 복제한 독립 시뮬레이터 반환
  - 원본 엔진 상태 오염 없이 분기 시뮬레이션 가능
- `GameEngine.advanceRandomState(steps)`
  - 롤아웃 분기별 난수 오프셋 제어

3. 안전 조건
- `pendingRuntime`이 있는 상호작용 중에는 포크 차단
  - 불완전 런타임 문맥을 복제해 생기는 비결정성/참조 꼬임 방지

## 3.3 StrongBot v2 (Beam Search)

1. 탐색 정책
- 루트 legal action을 기준으로 분기
- 깊이 제한 beam search 수행 (`beamWidth`, `maxDepth`, `expansionBudget`)
- 탐색 적용 phase를 `MAIN/BLOCK/ATTACK`으로 확장
- 예산 소진 시에도 루트 커버리지(`evaluatedRootActions / totalRootActions`)가 충분하면
  탐색 결과를 채택하고, 커버리지가 낮을 때만 v1 fallback

2. 노드 평가
- `evaluateState` + `scoreAction` 결합 점수
- 승패 상태 보너스/패널티 반영
- interaction ownership, phase 리스크 보정
- 루트 액션 집계를 단순 평균에서 `mean + 0.18 * max`로 조정해
  고품질 라인 상단값 반영

3. 안전장치
- fallback 액션 대비 즉시 전술 점수가 크게 불리하면 fallback 유지
- fallback 임계치를 phase별로 분리
  - `BLOCK=80`, `ATTACK=220`, `MAIN=260`
- 루트 액션 정렬을 사전순에서 전술 점수 우선 정렬로 변경해
  제한 예산에서 유망 분기 우선 탐색

## 3.4 하네스/회귀 연동

- `scripts/ai/bot_registry.ts`에 `strong-v2` 등록
- `phase0.manifest.json`/`scripts/ai/phase0_manifest.ts`에
  `tests/ai/StrongBotPhase2.vitest.test.ts`,
  `tests/rules_v2_regression/rules_v2_ai_seed_2026021819_stack_regression.test.ts` 추가
- `run_match_batch` summary에 선택적 runtime KPI 추가:
  - `summary.runtime.enabled`
  - `summary.runtime.totalMs`
  - `summary.runtime.avgMsPerGame`
  - `summary.runtime.msPerAction`

## 4. 검증 결과

기준일: 2026-02-10

1. Phase 2 단위/행동 테스트
- 명령: `npx vitest run tests/ai/StrongBotPhase2.vitest.test.ts`
- 결과: 4/4 통과
  - 포크 결정론 + 원본 불변성
  - v2 액션 결정론
  - v2-vs-v1 소규모 배치에서 `invalid_action/no_action=0`

2. 통합 회귀 게이트
- 명령: `npm run ai:regression`
- 결과: 9 파일 29 테스트 통과 + quick soak 통과
  - quick soak: `winner=12`, `max_steps/no_action/invalid_action=0`

3. 빌드
- 명령: `npm run build`
- 결과: 통과

4. 성능/안정성 벤치
- 라더 (진영 스왑, v2 vs v1):
  - 명령:
    - `AI_LADDER_ENTRANTS=strong-v2,strong-v1`
    - `AI_LADDER_SEEDS_PER_PAIR=20`
    - `AI_LADDER_START_SEED=2026021700`
    - `npm run ai:ladder`
  - 산출물: `artifacts/ai/ladder/strong_v2_vs_v1_phase2.json`
  - 결과: `strong-v2` 20승 20패 (50%), `strong-v1` 20승 20패 (50%)

- 고정 역할 벤치 (P1=v2, P2=v1):
  - 명령:
    - `AI_BENCH_START_SEED=2026021700`
    - `AI_BENCH_GAMES=119`
    - `AI_BENCH_P1_BOT=strong-v2`
    - `AI_BENCH_P2_BOT=strong-v1`
    - `npm run ai:bench`
  - 산출물: `artifacts/ai/bench/strong_v2_vs_v1_phase2_fixedrole.json`
  - 결과:
    - v2 56승 / v1 63승 (`47.06%`)
    - `no_action=0`, `invalid_action=0`
    - v2 승률 95% CI: `[0.3809, 0.5603]`

- baseline 대비 (P1=baseline, P2=strong-v2):
  - 산출물: `artifacts/ai/bench/baseline_vs_strong-v2.json`
  - 결과: strong-v2 64% (200게임), `no_action=0`, `invalid_action=0`
  - 참고: `artifacts/ai/bench/baseline_vs_strong-v1.json`와 동일 수치

5. 엔진 안정화 회귀 (stack overflow)
- 명령:
  - `npx vitest run tests/rules_v2_regression/rules_v2_ai_seed_2026021819_stack_regression.test.ts`
  - `AI_BENCH_START_SEED=2026021819 AI_BENCH_GAMES=1 AI_BENCH_P1_BOT=strong-v1 AI_BENCH_P2_BOT=strong-v1 npm run ai:bench`
- 결과:
  - stack overflow 재현 없음
  - seed `2026021819` 단건 벤치 정상 종료(`reason=winner`)

6. 런타임 KPI 계측 확인
- 명령:
  - `AI_BENCH_MEASURE_RUNTIME=1 npm run ai:bench`
- 결과:
  - summary runtime 필드 출력 확인
  - 예시(seed `2026021819`, 1게임): `totalMs=119.35`, `msPerAction=0.9946`

7. v2 성능 튜닝 재검증 (진영 스왑 고정 seed)
- 명령:
  - `AI_BENCH_START_SEED=2026022000 AI_BENCH_GAMES=60 AI_BENCH_P1_BOT=strong-v2 AI_BENCH_P2_BOT=strong-v1 npm run ai:bench`
  - `AI_BENCH_START_SEED=2026022000 AI_BENCH_GAMES=60 AI_BENCH_P1_BOT=strong-v1 AI_BENCH_P2_BOT=strong-v2 npm run ai:bench`
- 산출물:
  - `artifacts/ai/bench/strong_v2_vs_v1_tune_baseline_p1v2.json`
  - `artifacts/ai/bench/strong_v2_vs_v1_tune_baseline_p2v2.json`
  - `artifacts/ai/bench/strong_v2_vs_v1_tune_after_p1v2.json`
  - `artifacts/ai/bench/strong_v2_vs_v1_tune_after_p2v2.json`
- 결과:
  - 튜닝 전(양방향 합산): `60/120 = 50.00%`
  - 튜닝 후(양방향 합산): `66/120 = 55.00%`
  - 종료 안정성: `no_action=0`, `invalid_action=0` 유지
  - 교차 확인 라더(40게임, seedsPerPair=20):
    - 산출물: `artifacts/ai/ladder/strong_v2_vs_v1_tune_after_ladder.json`
    - 결과: `strong-v2` 21승 19패 (`52.5%`)

## 5. 현재 상태 요약

1. 완료
- Phase 2 착수 게이트 문서화
- 시뮬레이션 포크 인프라
- beam 기반 v2 봇 구현
- 회귀/soak/builder 검증 경로 통합

2. 수용 기준 관점
- 목표: `v2 >= 55% vs v1` (side-swapped)
- 최신 튜닝 세트: `66/120 = 55.00%`로 기준선에 도달
- 단, 샘플 확장 전에는 통계 변동 가능성이 있어
  승격 판정은 고정 프로토콜(더 큰 샘플 + CI)로 재확인 필요

3. 안정성 관찰 사항
- seed `2026021819` stack overflow 경로 수정 완료
  - `destroyUnit` 재진입 가드 추가
  - `checkRuleProcessing` 재귀 경로를 반복 처리로 평탄화
- 신규 회귀 테스트와 `ai:regression`/bench에서 재현 제거 확인

## 6. 다음 단계 제안 (즉시 착수 순서)

1. 재평가 프로토콜 고정
- side-swap 라더 + 고정 역할 벤치를 모두 필수로 사용
- Phase 2 재평가 프로토콜 v1.0 (고정):
  - Bench(진영 스왑): `AI_BENCH_GAMES=200` x 2회 (P1=v2/P2=v1, P1=v1/P2=v2)
  - 승격 기준:
    - 합산 승률 `v2 >= 55%`
    - 합산 95% CI 하한 `>= 50%`
    - 종료 안정성 `no_action=0`, `invalid_action=0`
  - Runtime 계측:
    - `AI_BENCH_MEASURE_RUNTIME=1`로 50+50 샘플 계측
    - `summary.runtime.msPerAction`, `avgMsPerGame` 기록
  - Ladder 교차 확인:
    - `AI_LADDER_SEEDS_PER_PAIR=50` (총 100게임)
    - 승격 판정의 참고 지표로 기록 (필수 하한 조건은 아님)

2. 평가 지표 운영 고정
- 배치 리포트 runtime KPI(`ms/action`)를 Phase 2 승격 실험의 필수 지표로 사용
- 재현성 실험과 runtime 실험을 분리 운영 (`AI_BENCH_MEASURE_RUNTIME=0/1`)

3. 후속 튜닝 트랙
- 확증 샘플에서 55% 미만으로 내려가면, `BLOCK` 응답 라인과
  `NEXT_PHASE` 페널티 주변 가중치를 우선 재튜닝

## 7. Phase 2 Re-evaluation Protocol v1.0 (2026-02-10)

This section is the canonical summary for the fixed protocol results.

### 7.1 Bench (Side-Swapped 200+200)
- Files:
  - `artifacts/ai/bench/phase2_protocol_v1_p1v2_200.json`
  - `artifacts/ai/bench/phase2_protocol_v1_p2v2_200.json`
- Combined result (v2):
  - wins: `213 / 400`
  - win rate: `53.25%`
  - 95% CI: `[48.36%, 58.14%]`
- Safety:
  - `no_action = 0`
  - `invalid_action = 0`

### 7.2 Runtime Profile (50+50, MEASURE_RUNTIME=1)
- Files:
  - `artifacts/ai/bench/phase2_protocol_v1_runtime_p1v2_50.json`
  - `artifacts/ai/bench/phase2_protocol_v1_runtime_p2v2_50.json`
- Combined runtime:
  - `ms/action = 2.4074`
  - `avgMsPerGame = 258.70`
  - per-role sample: `P1=v2 -> 2.3446`, `P2=v2 -> 2.4726`

### 7.3 Ladder Cross-check (100 games)
- File: `artifacts/ai/ladder/phase2_protocol_v1_ladder_100.json`
- Result (v2): `57-43 (57.0%)`, Elo `1045.36`

### 7.4 Gate Decision
- Promotion criteria:
  - combined win rate `>= 55%`
  - combined 95% CI lower bound `>= 50%`
  - stability: `no_action=0`, `invalid_action=0`
- Decision:
  - stability: pass
  - performance gate: fail (`53.25%`, CI low `48.36%`)
  - promotion: **deferred**

### 7.5 Aggregated Summary Artifact
- `artifacts/ai/bench/phase2_protocol_v1_summary.json`
