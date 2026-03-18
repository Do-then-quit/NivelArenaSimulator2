# BT05 Unlucky Bunny Nikki Self-Play Learning Notes (2026-03-18)

## 목적

- BT05 Nikki mirror 전용 봇 강화를 위해 self-play export, hold-policy training, 자동 learning loop를 연결한 작업 로그다.
- 이번 라운드의 목표는 "휴리스틱 튜닝만이 아니라 self-play 기반 학습 파이프를 실제 승격 루프에 연결할 수 있는가"를 확인하는 것이었다.

## 이번에 추가한 것

### 1. RL-ready self-play export

- `scripts/ai/run_bt05_nikki_selfplay_export.ts`
  - BT05 Nikki mirror self-play trajectory를 JSON으로 내보낸다.
  - legal action metadata, stable action key, return-to-go, main-phase hold signature를 함께 저장한다.
- `src/logic/ai/StableActionCodec.ts`
  - action key를 안정적으로 직렬화하는 공용 codec을 제공한다.

### 2. Main-phase hold policy training / loading

- `scripts/ai/train_bt05_nikki_main_phase_hold_policy.ts`
  - self-play export를 읽어 BT05 Nikki용 main-phase hold policy를 학습한다.
- `src/logic/ai/practice/Bt05NikkiMainPhaseHoldPolicy.ts`
  - hold signature, policy schema, policy 적용 판정을 정의한다.
- `src/logic/ai/practice/Bt05NikkiMainPhaseHoldPolicyLoader.ts`
  - 런타임에서 policy artifact를 읽는다.
  - 기본 fallback path는 `artifacts/ai/rl/bt05_nikki_hold_policy/latest.json` 이다.
- `src/logic/ai/practice/PracticeStrongBot.ts`
  - 학습된 hold policy가 있으면 `NEXT_PHASE`를 data-driven 방식으로 선택할 수 있다.

### 3. 자동 self-play learning loop

- `scripts/ai/run_bt05_nikki_selfplay_learning_loop.ts`
  - champion self-play -> cumulative training -> candidate screening -> holdout promotion 을 자동으로 반복한다.
  - 2026-03-18 추가 개선:
    - `dev` seed suite screening 후 상위 후보만 holdout 평가
    - iteration checkpoint를 `latest.json`에 중간 저장
    - `AI_NIKKI_LEARNING_LOOP_PROMOTION_MIN_DELTA` 환경변수 지원
- `scripts/ai/run_bt05_nikki_candidate_loop.ts`
  - custom bot factory를 직접 주입할 수 있도록 확장해서 learned policy 후보 비교에 사용한다.
- `scripts/ai/run_bt05_nikki_selfplay_export.ts`
  - self-play export에도 custom bot factory를 주입할 수 있도록 확장했다.

## 검증

### 테스트

- `npx vitest run tests/ai/StableActionCodec.vitest.test.ts tests/ai/StrongBotV3.vitest.test.ts tests/ai/CounterfactualRollout.vitest.test.ts tests/ai/Bt05NikkiSelfPlayLearningLoop.vitest.test.ts tests/ai/Bt05NikkiCandidateLoop.vitest.test.ts tests/ai/Bt05NikkiSelfPlayExport.vitest.test.ts tests/ai/Bt05NikkiMainPhaseHoldPolicy.vitest.test.ts tests/ai/Bt05NikkiMainPhaseHoldPolicyLoader.vitest.test.ts tests/ai/PracticeStrongBot.vitest.test.ts tests/ai/BotRegistryPhase41.vitest.test.ts`
- `npx tsc --noEmit`

### 실측 루프

- 자동 루프 실행:
  - `selfPlayGames=20`
  - `screenGamesPerSide=8`
  - `screenTopK=1`
  - `holdoutGamesPerSide=40`
  - `targetDelta=0.05`
- 결과:
  - 총 2 iteration 완료
  - 총 self-play 40게임
  - 총 transition 6525
  - 최종 champion: `practice-bt05-nikki-learned-hold-v1__perfect-s1__iter1`

## 측정 결과

### 기존 best learned-hold 후보

- `artifacts/ai/rl/bt05_nikki_hold_policy/latest.json` 기반 `practice-bt05-nikki-learned-hold-v1`
- `practice-bt05-nikki-strong-v1` 상대로 80게임 holdout 기준 `41-39`
- win-rate delta: `+0.025`
- self-lethal-open-rate: 양쪽 모두 `0.0006`

### 자동 self-play learning loop (2026-03-18)

- iteration 1
  - selected preset: `perfect-s1`
  - screening delta: `+0.25`
  - 80게임 holdout delta: `+0.025`
  - 승격 성공
- iteration 2
  - selected preset: `perfect-s1`
  - screening delta: `0`
  - 80게임 holdout delta: `0`
  - 추가 승격 실패

### plateau 확인

- iteration 2 cumulative data 기준으로 아래 preset들을 current champion과 80게임 holdout으로 직접 다시 비교했다.
  - `perfect-s2`
  - `positive-return`
  - `strong-s2`
  - `majority-60`
  - `majority-50`
- 결과는 전부 `40-40`, win-rate delta `0` 이었다.
- tactical KPI도 사실상 동일해서, 현재 hold-only policy family는 첫 승격 이후 behaviorally equivalent 상태로 수렴한 것으로 보인다.

## 해석

- self-play learning 파이프 자체는 정상 동작한다.
- 실제로 first promotion(`+0.025`)까지는 만들었다.
- 하지만 현재 학습 head는 `NEXT_PHASE` 여부만 다루는 binary hold policy라서, 첫 승격 이후에는 추가 candidate들이 거의 같은 행동으로 수렴했다.
- 즉 "데이터를 더 모으면 자동으로 계속 강해지는 구조"까지는 아직 아니다.
- 다음 단계에서 더 큰 승률 차이를 만들려면 학습 대상 action family를 넓혀야 한다.

## 다음에 해볼 작업

### 우선순위 1. hold-only 에서 벗어나기

- `NEXT_PHASE` binary 결정만 학습하지 말고,
  - main-phase action prior
  - upgrade veto / upgrade pressure head
  - placement / overwrite 관련 action family
  중 하나를 추가로 학습 대상에 넣는다.

### 우선순위 2. learning loop screening 고도화

- 현재는 top-1만 holdout으로 올리므로 screening tie 상황에서 후보 다양성이 빨리 사라진다.
- 다음 단계에서는
  - tie-aware finalist selection
  - top-K with tie expansion
  - screening score margin 기준 finalist 확장
  중 하나를 넣는 것이 좋다.

### 우선순위 3. stronger search + learned policy 조합 재검증

- learned policy를 `practice-bt05-nikki-strong-v2` 계열 search 세팅과 결합한 variant를 별도 bot id로 정식화한다.
- 단, 80게임 holdout에서 실제 delta가 명확히 벌어질 때만 승격한다.

### 우선순위 4. artifact / report hygiene

- `artifacts/ai/rl/bt05_nikki_learning_loop/` 하위 산출물은 크기가 커서 기본 커밋 대상보다는 로컬 실험 산출물로 두는 편이 낫다.
- 정식 승격 artifact는 runtime에서 직접 쓰는 `artifacts/ai/rl/bt05_nikki_hold_policy/latest.json` 중심으로 관리한다.
