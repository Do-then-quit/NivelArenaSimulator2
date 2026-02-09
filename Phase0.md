# Phase 0 보고서 (AI 벤치마크/평가 하네스 고도화)

## 1. 목적

Phase 0의 목표는 다음 3가지를 안정적으로 제공하는 것이다.

- 결정론적 매치 배치 평가 (`ai:bench`)
- 결정론적 라운드로빈 Elo 평가 (`ai:ladder`)
- AI 핵심 회귀 + soak를 한 번에 실행하는 게이트 (`ai:regression`)

이 기반이 있어야 Phase 1(StrongBot v1)의 개선을 신뢰 가능한 수치로 비교할 수 있다.

## 2. 범위

- 카드풀: `ST01`, `ST02`, `ST03`, `BT01` 구현 카드
- 봇: 현재 baseline 계열(`BaselineBot`)
- 엔진 진입점: `getLegalActions`, `step`, `getObservation`, `getSerializableState`
- 덱 생성/리더 선택: seed 기반 결정론 유지

## 3. 구현 결과

## 3.1 신규/수정 파일

- 매니페스트/기본값
  - `scripts/ai/phase0_manifest.ts`
  - `phase0.manifest.json`
- 평가 실행기
  - `scripts/ai/match_harness.ts`
  - `scripts/ai/run_match_batch.ts`
  - `scripts/ai/elo_ladder.ts`
  - `scripts/ai/deck_pool.ts`
- 회귀 실행기
  - `scripts/ai/run_ai_regression.ts`
- 테스트
  - `tests/ai/AiPhase0Harness.vitest.test.ts`
  - `tests/ai/Phase0Manifest.vitest.test.ts`
- 스크립트 엔트리
  - `package.json`

## 3.2 핵심 고도화 항목

1. 벤치마크 매니페스트 도입
- 기본 설정을 `phase0.manifest.json`으로 표준화
- 환경변수 `AI_PHASE0_MANIFEST`로 외부 매니페스트 경로 지정 가능
- 파일이 없으면 코드 기본값으로 폴백

2. 배치 리포트 신뢰구간 추가
- `run_match_batch` 요약에 95% 신뢰구간 포함
- 포함 필드:
  - `summary.confidence.player1WinRate`
  - `summary.confidence.player2WinRate`
- 계산:
  - `pointEstimate = wins / games`
  - `standardError = sqrt(p*(1-p)/n)`
  - `ci95 = p ± 1.96*standardError` (0~1 clamp)

3. 아티팩트 경로 표준화
- 기본 산출 경로:
  - bench: `artifacts/ai/bench/latest.json`
  - ladder: `artifacts/ai/ladder/latest.json`
- 비활성화:
  - `AI_BENCH_OUTPUT=none` 또는 `AI_LADDER_OUTPUT=none`

4. 통합 회귀 게이트 추가
- `ai:regression`에서 아래를 순차 실행:
  - AI 핵심 회귀 파일 묶음
  - quick soak (`npm run test:bot-soak`)
- `AI_REGRESSION_SKIP_SOAK=1`로 soak 생략 가능

## 4. 사용 방법

## 4.1 기본 실행

```bash
npm run ai:bench
npm run ai:ladder
npm run ai:regression
```

## 4.2 주요 환경변수

- 공통
  - `AI_PHASE0_MANIFEST`: 매니페스트 경로
- bench
  - `AI_BENCH_START_SEED`
  - `AI_BENCH_GAMES`
  - `AI_BENCH_MAX_STEPS`
  - `AI_BENCH_ENABLE_MULLIGAN`
  - `AI_BENCH_TRACE_LIMIT`
  - `AI_BENCH_OUTPUT` (`none`/`off`/`-`이면 파일 저장 안 함)
- ladder
  - `AI_LADDER_ENTRANTS` (예: `baseline-a,baseline-b`)
  - `AI_LADDER_START_SEED`
  - `AI_LADDER_SEEDS_PER_PAIR`
  - `AI_LADDER_MAX_STEPS`
  - `AI_LADDER_ENABLE_MULLIGAN`
  - `AI_LADDER_K_FACTOR`
  - `AI_LADDER_INITIAL_RATING`
  - `AI_LADDER_OUTPUT` (`none`/`off`/`-`이면 파일 저장 안 함)
- regression
  - `AI_REGRESSION_SKIP_SOAK=1` (quick soak 스킵)

## 5. 검증 결과

2026-02-09 기준 실행 결과:

1. Phase 0 테스트
- `npx vitest run tests/ai/AiPhase0Harness.vitest.test.ts tests/ai/Phase0Manifest.vitest.test.ts`
- 결과: 7/7 통과

2. 통합 회귀
- `npm run ai:regression`
- 결과:
  - AI 핵심 회귀 20/20 통과
  - quick soak 통과 (`winner=12`, `max_steps/no_action/invalid_action=0`)

3. CLI 스모크
- `npm run ai:bench` / `npm run ai:ladder` 정상 출력 확인
- `AI_*_OUTPUT=none` 모드에서 출력 파일 생략 동작 확인

## 6. 산출 리포트 스키마 요약

## 6.1 bench 요약

- `summary.totalGames`
- `summary.wins.player1`, `summary.wins.player2`
- `summary.winRate.player1`, `summary.winRate.player2`
- `summary.unfinished`
- `summary.avgSteps`, `summary.avgTurns`
- `summary.terminationCounts`
- `summary.confidence.player1WinRate`
- `summary.confidence.player2WinRate`

## 6.2 ladder 요약

- `entrants[].rating/games/wins/losses/draws/points`
- `matches[].seed/pair/swapped/reason/winnerEntrantId`

## 7. Phase 1 인수 조건 체크

- 결정론적 실행 경로: 충족
- 벤치/라더 비교 도구: 충족
- 회귀 자동 게이트: 충족
- 카드풀 스코프 고정(ST01/ST02/ST03/BT01): 충족

Phase 1에서 바로 시작 가능한 작업:

1. `StrongBot` 상태 평가 함수 추가
2. 1-step lookahead 액션 점수화
3. baseline 대비 승률 KPI 추적 (`ai:bench`, `ai:ladder` 사용)
