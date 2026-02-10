# AI 로드맵: 강한 플레이 봇 + 강한 덱 탐색

## 진행 현황 (2026-02-10)

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
- [~] Phase 2 재평가 완료 (승격 보류)
  - 프로토콜 v1.0 bench 200+200: `213/400 = 53.25%`, 95% CI `[48.36%, 58.14%]`
  - 안정성 게이트: `no_action=0`, `invalid_action=0` (통과)
  - runtime 샘플 50+50: `ms/action=2.4074` (`P1=v2=2.3446`, `P2=v2=2.4726`)
  - ladder 교차 확인 100게임: `57승 43패 (57.0%)`, Elo `1045.36`
  - 결론: 승격 기준(`합산 승률>=55%` + `CI 하한>=50%`) 미충족으로 v2 승격 보류
- [ ] Phase 3 미착수
- [ ] Phase 4 미착수
- [ ] Phase 5 미착수

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

## Phase 3: 덱 탐색 MVP (진화형 탐색)

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

## Phase 4: 공진화(Co-evolution) 및 메타 견고화

- 목표:
  - 단일 상대/단일 덱에 과적합되는 현상 방지
- 구현 우선순위:
  1. 상대 풀 기반 평가
     - baseline, strong v1, strong v2, 과거 체크포인트 포함
  2. 덱 리그 평가
     - 단일 상대 점수 대신 league 기반 스코어링
  3. 개체군 메모리
     - 과거 강한 덱을 다양성 있게 보존
  4. 붕괴 방지 목표
     - fitness에 다양성 보너스 반영
- 완료 기준:
  - 상위 덱이 특정 1매치업이 아닌 상대 풀 전반에서 강함 유지

## Phase 5: RL 통합 (탐색 파이프라인 안정화 이후 선택)

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
  - ST01/ST02/ST03/BT01 카드풀에서 재현 가능한 top deck CLI 확보
- M4 (Phase 4 종료):
  - 덱/상대 리그 전반에서 견고한 공진화 덱 확보
- M5 (선택, Phase 5):
  - RL 정책이 평가 라더에 통합

## 6) 제안 커맨드 세트

- `npm run ai:bench`
  - 고정 seed 기반 bot-vs-bot 벤치마크 및 리포트 생성
- `npm run ai:ladder`
  - 다중 봇 라운드로빈 + Elo 계산
- `npm run ai:deck-search`
  - GA/ES 기반 덱 탐색 실행
- `npm run ai:regression`
  - AI 핵심 회귀 세트 + quick soak 실행

## 7) 단계별 테스트 전략

- 각 단계 구현 전:
  - 실패 테스트 먼저 작성(TDD)
- 각 단계 구현 중:
  - scorer/search/deck legality 단위 테스트
  - interaction ownership/target selection 회귀 테스트
  - deadlock/no-action 탐지 soak 테스트
- 각 단계 완료 후:
  - 전체 `npm test`
  - quick soak 실행
  - seed 목록 + commit hash가 포함된 벤치마크 산출물 보관

## 8) 리스크 및 대응

- 리스크: 샘플 수 부족으로 평가 노이즈 발생
  - 대응: 고정 seed 세트 + 신뢰구간 리포팅
- 리스크: 단일 봇 기준 과적합
  - 대응: 상대 풀 + 리그 기반 fitness
- 리스크: 탐색 시간 폭증
  - 대응: budgeted rollout, beam cap, 조기 종료
- 리스크: AI 최적화 중 룰 회귀 발생
  - 대응: 엄격한 회귀 게이트 통과를 병합 조건으로 유지

## 9) 권장 초기 2주 플랜

- Week 1:
  - Phase 0 완료
  - StrongBot v1 평가기 스켈레톤 + baseline 벤치마크 리포트 확보
- Week 2:
  - StrongBot v1 전술 오버라이드 추가
  - 덱 합법성 모듈 + 랜덤 합법 덱 생성기 추가
  - 소규모 개체군/세대로 덱 탐색 dry-run 수행
