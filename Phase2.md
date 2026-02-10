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
  - `Phase2.md`
- 수정
  - `src/logic/random.ts`
  - `src/logic/GameEngine.ts`
  - `scripts/ai/bot_registry.ts`
  - `scripts/ai/phase0_manifest.ts`
  - `phase0.manifest.json`
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
- 예산 초과 시 deterministic fallback (`StrongBot v1`)

2. 노드 평가
- `evaluateState` + `scoreAction` 결합 점수
- 승패 상태 보너스/패널티 반영
- interaction ownership, phase 리스크 보정

3. 안전장치
- fallback 액션 대비 즉시 전술 점수가 크게 불리하면 fallback 유지
- 현재는 안정성을 위해 `ATTACK` phase 중심으로 탐색 적용

## 3.4 하네스/회귀 연동

- `scripts/ai/bot_registry.ts`에 `strong-v2` 등록
- `phase0.manifest.json`/`scripts/ai/phase0_manifest.ts`에
  `tests/ai/StrongBotPhase2.vitest.test.ts` 추가

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
- 결과: 8 파일 27 테스트 통과 + quick soak 통과
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

## 5. 현재 상태 요약

1. 완료
- Phase 2 착수 게이트 문서화
- 시뮬레이션 포크 인프라
- beam 기반 v2 봇 구현
- 회귀/soak/builder 검증 경로 통합

2. 미완료 (수용 기준 대비)
- 목표: `v2 >= 55% vs v1` (side-swapped)
- 현재: 50% (동률)로 미달

3. 안정성 관찰 사항
- seed `2026021819` 포함 시 일부 장기 배치에서
  기존 엔진 경로의 `Maximum call stack size exceeded`가 재현됨
  (`processPassiveGrantedExitEffects`/`checkRuleProcessing` 경유)
- v2 전용 이슈라기보다 엔진 측 재귀/루프 조건 점검 필요

## 6. 다음 단계 제안 (즉시 착수 순서)

1. 엔진 재귀 오버플로우 원인 수정
- 재현 seed: `2026021819`
- 목표: 대량 벤치에서도 stack overflow 0건

2. v2 성능 튜닝
- 탐색 적용 구간 확대/조정 (`MAIN`, `BLOCK` 포함 조건 재검토)
- 노드 평가식 가중치 튜닝
- fallback 임계치 튜닝

3. 평가 지표 보강
- 배치 리포트에 `ms/action` 추가
- Phase 2 수용 기준의 런타임 항목 정량화

4. 재평가 프로토콜 고정
- side-swap 라더 + 고정 역할 벤치를 모두 필수로 사용
- 최소 샘플 수와 CI 기준을 문서에 명문화
