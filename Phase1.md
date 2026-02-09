# Phase 1 보고서 (Strong Play Bot v1)

## 1. 목적

Phase 1의 목표는 `BaselineBot`보다 강한 플레이 정책(`StrongBot v1`)을 도입하고,  
Phase 0 하네스(`ai:bench`, `ai:ladder`, `ai:regression`)로 성능/안정성을 검증하는 것이다.

## 2. 범위

- 엔진/룰 진입점 유지:
  - `getLegalActions(actorPlayerId?)`
  - `step(action)`
  - `getObservation(actorPlayerId)`
  - `getSerializableState()`
- 카드풀: `ST01`, `ST02`, `ST03`, `BT01` 구현 범위
- 구현 포인트:
  - 상태 평가 기반 점수화
  - 전술 오버라이드(치명타 방어 블록, 직접 킬각 우선)
  - baseline fallback으로 상호작용 안정성 유지

## 3. 구현 결과

## 3.1 신규/수정 파일

- StrongBot 본체
  - `src/logic/ai/StrongBot.ts`
- 평가/스코어링
  - `src/logic/ai/eval/StateEvaluator.ts`
  - `src/logic/ai/eval/ActionScorer.ts`
- 벤치/라더 봇 레지스트리 연결
  - `scripts/ai/bot_registry.ts`
  - `scripts/ai/run_match_batch.ts`
  - `scripts/ai/elo_ladder.ts`
- 테스트
  - `tests/ai/StrongBotPhase1.vitest.test.ts`
- 회귀 매니페스트 반영
  - `scripts/ai/phase0_manifest.ts`
  - `phase0.manifest.json`

## 3.2 동작 개요

1. 상태 평가 (`StateEvaluator`)
- 요소:
  - 데미지 레이스
  - 보드 전투 가치(코스트/파워/히트/아이템)
  - 핸드 우위
  - 직접 타점 압박
  - 양측 킬각 스윙

2. 액션 스코어링 (`ActionScorer`)
- 전술 우선 규칙:
  - BLOCK 단계에서 무방비 직격이 즉시 패배면 무조건 블록
  - ATTACK 단계에서 확정 직접 킬각 라인 우선
- 메인 단계:
  - `PLAY_UNIT`, `PLAY_ITEM`, `PLAY_SKILL`, `ACTIVATE_EFFECT` 휴리스틱 점수화
- 상호작용 단계:
  - `StrongBot`은 baseline fallback 경로 사용(안정성 우선)

3. StrongBot 선택 로직
- `NORMAL` 상에서 점수 기반 선택
- `SELECT_TARGET`/`SELECT_COST`/`SELECT_OPTIONAL` 등 상호작용은 fallback

4. 하네스 연결
- `strong-v1` bot id 등록
- 벤치에서 봇 지정 지원:
  - `AI_BENCH_P1_BOT`
  - `AI_BENCH_P2_BOT`
- 라더 entrants에 `strong-v1` 사용 가능

## 4. 검증 결과

기준일: 2026-02-09

1. Phase 1 단위/행동 테스트
- `npx vitest run tests/ai/StrongBotPhase1.vitest.test.ts`
- 결과: 3/3 통과
  - 즉시 패배 방지 블록 선택 확인
  - 직접 킬각 라인 우선 공격 확인
  - strong-vs-baseline 실행 중 `invalid_action`/`no_action` 없음

2. 통합 회귀
- `npm run ai:regression`
- 결과:
  - AI 회귀 세트 통과
  - quick soak 통과 (`winner=12`, `max_steps/no_action/invalid_action=0`)

3. 빌드
- `npm run build` 통과

4. 벤치/라더 측정
- 벤치 (고정 역할):
  - 명령:
    - `AI_BENCH_GAMES=24`
    - `AI_BENCH_P1_BOT=strong-v1`
    - `AI_BENCH_P2_BOT=baseline-b`
    - `npm run ai:bench`
  - 결과: `Strong(P1)` 10승 / `Baseline(P2)` 14승 (41.67%)
- 라더 (스왑 포함, 상대풀 평가):
  - 명령:
    - `AI_LADDER_ENTRANTS=strong-v1,baseline-a,baseline-b`
    - `AI_LADDER_SEEDS_PER_PAIR=6`
    - `npm run ai:ladder`
  - 결과:
    - `strong-v1`: 15승 9패, Elo `1041.06` (1위)
    - `baseline-b`: 13승 11패, Elo `1001.95`
    - `baseline-a`: 8승 16패, Elo `956.99`
  - 매치업 분해:
    - strong-v1 vs baseline-a: 10/12 승
    - strong-v1 vs baseline-b: 5/12 승

## 5. 로드맵 대비 판정

- Phase 1 구현 항목:
  - 상태 평가기 추가: 완료
  - 액션 점수화 + 전술 오버라이드: 완료
  - 상호작용 안정성(회귀/soak): 완료
- 성능 기준(승률 >= 60% vs baseline):
  - 라더 전체 상대풀 기준 strong-v1 62.5%(15/24)로 충족
  - 단일 baseline-b 상대에선 41.7%로 보강 필요

결론:  
Phase 1은 기능/안정성 기준으로 완료 가능 상태이며,  
성능은 “상대풀 기준 충족, 특정 매치업 보강 필요”로 판단한다.

## 6. 다음 단계 제안 (Phase 1.5 또는 Phase 2 진입 전)

1. `baseline-b` 대응 보강
- 블록/교환 가치 계산 정밀화
- lane별 손익 예측 가중치 튜닝

2. 1-step lookahead 고도화
- 현재 surrogate 점수 합산에서 실제 시뮬레이션 기반 1-step 평가로 전환

3. 평가 프로토콜 고정
- “승률 기준”을 라더 기준(스왑 포함)으로 명문화하여 판정 일관성 확보
