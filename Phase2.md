# Phase 2 보고서 (강한 플레이 봇 v2 - 탐색 기반)

## 1. 목적

Phase 2의 목표는 v1 휴리스틱 정책 위에 탐색 기반 의사결정을 추가해,
복잡한 전투/상호작용 구간에서 전술 품질을 높이는 것이다.

이번 작업에서는 다음 3가지를 우선 달성했다.

1. 시뮬레이션 포크 인프라 구축
2. 빔 탐색 기반 `StrongBotV2` 구현
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

## 3.3 StrongBot v2 (빔 탐색)

1. 탐색 정책
- 루트 합법 액션을 기준으로 분기
- 깊이 제한 빔 탐색 수행 (`beamWidth`, `maxDepth`, `expansionBudget`)
- 탐색 적용 페이즈를 `MAIN/BLOCK/ATTACK`으로 확장
- 예산 소진 시에도 루트 커버리지(`evaluatedRootActions / totalRootActions`)가 충분하면
  탐색 결과를 채택하고, 커버리지가 낮을 때만 v1 폴백

2. 노드 평가
- `evaluateState` + `scoreAction` 결합 점수
- 승패 상태 보너스/패널티 반영
- 인터랙션 입력권과 페이즈 리스크 보정
- 루트 액션 집계를 단순 평균에서 `mean + 0.18 * max`로 조정해
  고품질 라인 상단값 반영

3. 안전장치
- 폴백 액션 대비 즉시 전술 점수가 크게 불리하면 폴백 유지
- 폴백 임계치를 페이즈별로 분리
  - `BLOCK=80`, `ATTACK=220`, `MAIN=260`
- 루트 액션 정렬을 사전순에서 전술 점수 우선 정렬로 변경해
  제한 예산에서 유망 분기 우선 탐색

## 3.4 하네스/회귀 연동

- `scripts/ai/bot_registry.ts`에 `strong-v2` 등록
- `phase0.manifest.json`/`scripts/ai/phase0_manifest.ts`에
  `tests/ai/StrongBotPhase2.vitest.test.ts`,
  `tests/rules_v2_regression/rules_v2_ai_seed_2026021819_stack_regression.test.ts` 추가
- `run_match_batch` 요약에 선택적 런타임 KPI 추가:
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
- 결과: 9 파일 29 테스트 통과 + 퀵 소크 통과
  - 퀵 소크: `winner=12`, `max_steps/no_action/invalid_action=0`

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

5. 엔진 안정화 회귀 (스택 오버플로)
- 명령:
  - `npx vitest run tests/rules_v2_regression/rules_v2_ai_seed_2026021819_stack_regression.test.ts`
  - `AI_BENCH_START_SEED=2026021819 AI_BENCH_GAMES=1 AI_BENCH_P1_BOT=strong-v1 AI_BENCH_P2_BOT=strong-v1 npm run ai:bench`
- 결과:
  - 스택 오버플로 재현 없음
  - seed `2026021819` 단건 벤치 정상 종료(`reason=winner`)

6. 런타임 KPI 계측 확인
- 명령:
  - `AI_BENCH_MEASURE_RUNTIME=1 npm run ai:bench`
- 결과:
  - 요약 런타임 필드 출력 확인
  - 예시(seed `2026021819`, 1게임): `totalMs=119.35`, `msPerAction=0.9946`

7. v2 성능 튜닝 재검증 (진영 스왑 고정 시드)
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
- 빔 탐색 기반 v2 봇 구현
- 회귀/soak/builder 검증 경로 통합

2. 수용 기준 관점
- 목표: `v2 >= 55% vs v1` (진영 스왑)
- 최신 튜닝 세트: `66/120 = 55.00%`로 기준선에 도달
- 단, 샘플 확장 전에는 통계 변동 가능성이 있어
  승격 판정은 고정 프로토콜(더 큰 샘플 + CI)로 재확인 필요

3. 안정성 관찰 사항
- 시드 `2026021819` 스택 오버플로 경로 수정 완료
  - `destroyUnit` 재진입 가드 추가
  - `checkRuleProcessing` 재귀 경로를 반복 처리로 평탄화
- 신규 회귀 테스트와 `ai:regression`/bench에서 재현 제거 확인

## 6. 다음 단계 제안 (즉시 착수 순서)

1. 재평가 프로토콜 고정
- 진영 스왑 라더 + 고정 역할 벤치를 모두 필수로 사용
- Phase 2 재평가 프로토콜 v1.0 (고정):
  - Bench(진영 스왑): `AI_BENCH_GAMES=200` x 2회 (P1=v2/P2=v1, P1=v1/P2=v2)
  - 승격 기준:
    - 합산 승률 `v2 >= 55%`
    - 합산 95% CI 하한 `>= 50%`
    - 종료 안정성 `no_action=0`, `invalid_action=0`
  - 런타임 계측:
    - `AI_BENCH_MEASURE_RUNTIME=1`로 50+50 샘플 계측
    - `summary.runtime.msPerAction`, `avgMsPerGame` 기록
  - 라더 교차 확인:
    - `AI_LADDER_SEEDS_PER_PAIR=50` (총 100게임)
    - 승격 판정의 참고 지표로 기록 (필수 하한 조건은 아님)

2. 평가 지표 운영 고정
- 배치 리포트 런타임 KPI(`ms/action`)를 Phase 2 승격 실험의 필수 지표로 사용
- 재현성 실험과 런타임 실험을 분리 운영 (`AI_BENCH_MEASURE_RUNTIME=0/1`)

3. 후속 튜닝 트랙
- 확증 샘플에서 55% 미만으로 내려가면, `BLOCK` 응답 라인과
  `NEXT_PHASE` 페널티 주변 가중치를 우선 재튜닝

## 7. Phase 2 재평가 프로토콜 v1.0 (2026-02-10)

이 섹션은 고정 프로토콜 결과의 기준 요약이다.

### 7.1 벤치 (진영 스왑 200+200)
- 파일:
  - `artifacts/ai/bench/phase2_protocol_v1_p1v2_200.json`
  - `artifacts/ai/bench/phase2_protocol_v1_p2v2_200.json`
- 합산 결과 (v2):
  - 승수: `213 / 400`
  - 승률: `53.25%`
  - 95% 신뢰구간: `[48.36%, 58.14%]`
- 안정성:
  - `no_action = 0`
  - `invalid_action = 0`

### 7.2 런타임 프로파일 (50+50, MEASURE_RUNTIME=1)
- 파일:
  - `artifacts/ai/bench/phase2_protocol_v1_runtime_p1v2_50.json`
  - `artifacts/ai/bench/phase2_protocol_v1_runtime_p2v2_50.json`
- 합산 런타임:
  - `ms/action = 2.4074`
  - `avgMsPerGame = 258.70`
  - 진영별 샘플: `P1=v2 -> 2.3446`, `P2=v2 -> 2.4726`

### 7.3 라더 교차 확인 (100게임)
- 파일: `artifacts/ai/ladder/phase2_protocol_v1_ladder_100.json`
- 결과 (v2): `57-43 (57.0%)`, Elo `1045.36`

### 7.4 게이트 판정
- 승격 기준:
  - 합산 승률 `>= 55%`
  - 합산 95% CI 하한 `>= 50%`
  - 안정성: `no_action=0`, `invalid_action=0`
- 판정:
  - 안정성: 통과
  - 성능 게이트: 실패 (`53.25%`, CI 하한 `48.36%`)
  - 승격: **보류**

### 7.5 집계 요약 산출물
- `artifacts/ai/bench/phase2_protocol_v1_summary.json`

## 8. 덱 탐색 전 Phase 2.1 계획 (우선)

목표: Phase 3 덱 탐색에 들어가기 전에 플레이 봇 완성도를 먼저 끌어올린다.

### 8.1 인터랙션 탐색 범위
- `NORMAL` 외 아래 구간까지 탐색 확장:
  - `SELECT_TARGET`
  - `SELECT_COST`
  - `SELECT_OPTIONAL`
- 분기 확장은 `interactionOwnerPlayerId`가 행동 봇과 일치할 때만 허용.
- 현재 포크 안전 제약 유지 (`pendingRuntime` 상태에서는 포크 금지).

### 8.2 인터랙션 전용 예산
- 분리된 제어값 추가:
  - `interactionDepth`
  - `interactionBudget`
- 인터랙션이 많은 턴에서 메인 탐색 예산이 고갈되지 않도록 보호.
  - 커버리지가 낮거나 예산이 소진되면 결정론적 폴백 유지.

### 8.3 효과 인지형 스코어링
- `pendingEffect` 필드를 기반으로 인터랙션 액션 점수화:
  - `actionType`
  - `actionValue`
  - `targetSchema`
  - `validTargets`
- 효과 의도별 타겟 가치 정책 분리:
  - 제거
  - 버프
  - 부활
  - 핸드 개입
  - 트래시 조작
- `cost/power/hit` 중심 휴리스틱 비중을 낮추고 상태 전이 가치 비중 상향:
  - 킬각 스윙
  - 라인 주도권
  - 핸드 템포

### 8.4 테스트 및 검증
- 인터랙션 탐색 단위 테스트 추가:
  - `tests/ai/StrongBotV2InteractionSearch.vitest.test.ts`
- 카드 레벨 고밸류 타겟 회귀를 `tests/cards/*`에 추가.
- 검증 게이트:
  - `npm run ai:regression`
  - `npm run test:bot-soak`
  - 프로토콜 재실행 (200+200, runtime 50+50, ladder 100)

### 8.5 Phase 2 완료 승격 게이트
- 현행 승격 기준 유지:
  - 합산 승률 `>= 55%`
  - 합산 95% CI 하한 `>= 50%`
  - `no_action = 0`
  - `invalid_action = 0`
- 이 게이트를 통과한 뒤에만 Phase 3 시작.

## 9. Phase 2 재평가 프로토콜 v1.1 (2026-02-11)

이 섹션은 7.4의 기존 합격/불합격 판정을 대체한다.

### 9.1 벤치 (진영 스왑 200+200)
- 파일:
  - `artifacts/ai/bench/phase2_protocol_v1_1_p1v2_200.json`
  - `artifacts/ai/bench/phase2_protocol_v1_1_p2v2_200.json`
- 합산 결과 (v2):
  - 승수: `225 / 400`
  - 승률: `56.25%`
  - 95% 신뢰구간: `[51.39%, 61.11%]`
- 안정성:
  - `max_steps = 0`
  - `no_action = 0`
  - `invalid_action = 0`

### 9.2 런타임 프로파일 (50+50, MEASURE_RUNTIME=1)
- 파일:
  - `artifacts/ai/bench/phase2_protocol_v1_1_runtime_p1v2_50.json`
  - `artifacts/ai/bench/phase2_protocol_v1_1_runtime_p2v2_50.json`
- 합산 런타임:
  - `ms/action = 2.7520`
  - `avgMsPerGame = 273.61`
  - 진영별 샘플: `P1=v2 -> 2.6518`, `P2=v2 -> 2.8567`

### 9.3 라더 교차 확인 (100게임)
- 파일: `artifacts/ai/ladder/phase2_protocol_v1_1_ladder_100.json`
- 결과 (v2): `54-46 (54.0%)`

### 9.4 게이트 판정 (업데이트)
- 승격 기준:
  - 합산 승률 `>= 55%`
  - 합산 95% CI 하한 `>= 50%`
  - 안정성: `no_action=0`, `invalid_action=0`
- 판정:
  - 안정성: 통과
  - 성능 게이트: 통과 (`56.25%`, CI 하한 `51.39%`)
  - 승격: **통과**

### 9.5 56.25% 결과 해석
- 현재 게이트 기준에서 의미 있는 개선으로 본다. 이유:
  - 점추정치가 55%를 상회
  - CI 하한이 50%를 넘어서, 이 샘플 크기에서 통계적으로 동전던지기(50%)보다 우위
  - 동일 실행에서 안전성 카운터가 0 유지
- 실무적 해석:
  - v2가 v1보다 강하지만, 격차는 아직 중간 수준.
  - 일관성을 더 높이려면 효과/인터랙션 밀집 턴 중심의 추가 튜닝이 필요.

### 9.6 장시간 평가 이슈 노트
- 이전 승격 재실행 중 1회 평가가 장시간 실행되어 수동 중단된 사례가 있었다.
- 후속 점검:
  - 고정 프로토콜 설정으로 재현 실행 후 종료 카운터 점검
  - v1.1 공식 재실행 결과 `max_steps=0`, `no_action=0`, `invalid_action=0`
- 현재 판단:
  - 승인된 v1.1 재실행에서는 무한루프 징후가 관측되지 않았다.
  - 운영 프로토콜에서 인터랙션 밀집 seed 모니터링은 계속 유지한다.
