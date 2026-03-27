# Game UX Harness 준비 요약

## 1. 문서 목적
- 이 문서는 이번 턴에 준비한 `Game UX Harness`의 실제 구현 상태를 한국어로 빠르게 파악하기 위한 요약 문서다.
- 다음 UX 개선 작업에서 planner / generator / evaluator 방식으로 바로 이어서 작업할 수 있도록 현재 준비 범위, 테스트 상태, 남은 관찰 포인트를 정리한다.

## 2. 이번에 준비한 핵심

### 2.1 엔진 쪽
- 기존 엔진 진입점은 유지했다.
  - `step()`
  - `getLegalActions()`
- 여기에 UI 전용 읽기 계약을 추가했다.
  - `getUiSnapshot(actorPlayerId)`
- 새 UI 계약 타입을 추가했다.
  - `Command = EngineAction`
  - `ActionAvailability`
  - `MandatoryQueueItem`
  - `TimingWindow`
  - `AuditTrailEntry`
  - `EngineUiSnapshot`

### 2.2 UI 쪽
- 게임 화면이 이제 엔진이 제공한 snapshot을 직접 렌더링한다.
- 다음 UX 요소를 추가했다.
  - 상단 phase ribbon
  - attack sub-step bar
  - mandatory queue
  - action panel
  - audit trail panel
  - lane 강조/차단 표시
  - active 사용 완료 상태 표시
- UI는 legality를 다시 계산하지 않고, 엔진이 내려준 `visibleActions`와 `mandatoryQueue`를 바탕으로 표시한다.

### 2.3 하네스 쪽
- named checkpoint 기반 deterministic UX 하네스를 만들었다.
  - `P1_MAIN_AFTER_MULLIGAN`
  - `ATTACK_DECLARE_WINDOW`
  - `MANDATORY_TARGET_SELECTION`
- 이 checkpoint들은 다음 작업에서 바로 snapshot 테스트, UI 렌더 테스트, 브라우저 evaluator 기준점으로 사용할 수 있다.

## 3. 추가한 문서/구조

### 3.1 planner hub
- `docs/agent/harness/README.md`
- `docs/agent/harness/rules_snapshot.md`
- `docs/agent/harness/zone_model.md`
- `docs/agent/harness/turn_timing.md`
- `docs/agent/harness/keyword_registry.yaml`
- `docs/agent/harness/rulings_override.yaml`
- `docs/agent/harness/ux_clarity_contract.md`
- `docs/agent/harness/open_questions.md`

### 3.2 evaluator artifact 폴더
- `artifacts/ux-harness/README.md`
- `artifacts/ux-harness/checklist.md`
- 브라우저 평가 결과 파일
  - scorecard
  - findings
  - screenshots

## 4. 구현 내용 상세

### 4.1 `getUiSnapshot()`가 제공하는 정보
- `legalActions`
  - 기계 인터페이스용 실제 합법 행동 목록
- `visibleActions`
  - 보이지만 막혀 있는 행동까지 포함한 UI 행동 목록
  - 비활성 행동에는 reason을 붙인다
- `mandatoryQueue`
  - 현재 반드시 해결해야 하는 상호작용/효과를 상단 queue로 제공
- `timingWindow`
  - 현재 phase
  - combat step
  - interaction mode
  - interaction owner
- `auditTrail`
  - 최근 phase/effect/interaction 관련 이벤트를 정규화해서 제공

### 4.2 reason의 한국어 정규화
- 기존 `RuleValidator`의 영어 reason을 최대한 재사용한다.
- UI 표시 직전 한국어 문구로 변환한다.
- 예:
  - `Not in MAIN phase` -> `메인 페이즈가 아니어서 사용할 수 없습니다.`
  - `Already placed in this zone this turn` -> `이 라인은 이번 턴 일반 배치/업그레이드를 이미 사용했습니다.`
  - `Cost exceeds Size limit` -> `현재 사이즈를 초과합니다.`

### 4.3 강제 흐름 처리
- `pendingEffect`가 있으면 `mandatoryQueue`가 생성된다.
- 멀리건도 강제 queue 항목으로 취급한다.
- 엔트리/타겟 선택/비용 선택/선택형 효과 확인 등을 같은 패턴으로 다룬다.

### 4.4 상태 기반 경고
- 덱 0장 상태는 즉시 패배가 아니라는 룰을 UI 경고로 표현했다.
- 문구:
  - `덱은 0장이지만 즉시 패배는 아닙니다. 다음 드로우 요구가 발생하면 패배합니다.`

## 5. 테스트 하네스 구성

### 5.1 새 테스트
- `tests/ui/game_ux_snapshot.vitest.test.ts`
  - snapshot 계약 검증
  - main / attack / mandatory / end hand adjust / deck zero 경고 검증
- `tests/ui/game_ux_render.vitest.test.ts`
  - phase ribbon 렌더
  - attack step bar 렌더
  - action panel 렌더
  - mandatory queue 렌더
  - audit trail 렌더

### 5.2 새 helper
- `tests/ui/helpers/game_ux_harness.ts`
  - named checkpoint 생성
- `tests/ui/helpers/game_view_test_harness.ts`
  - render-heavy UI 테스트 공통 bootstrap

### 5.3 안정화한 기존 UI 테스트
- `tests/ui/game_log_panel_render.vitest.test.ts`
- `tests/ui/game_view_select_context_info.vitest.test.ts`
- `tests/ui/game_view_selection_zone_highlight.vitest.test.ts`
- `tests/ui/game_view_effect_playback_modal_delay.vitest.test.ts`
- `tests/ui/game_bindings_interaction_owner.vitest.test.ts`

### 5.4 테스트 명령
- 새 하네스 명령:
  - `npm run test:ux-harness`

## 6. 검증 결과

### 6.1 타입체크
- `npx tsc --noEmit` 통과

### 6.2 Vitest 회귀
- 아래 묶음을 통과시켰다.
  - UX snapshot/render 하네스
  - 느렸던 기존 UI 렌더 테스트
  - interaction owner 관련 UI 테스트
  - playback modal delay 테스트
  - `rules_v2_engine_regression`

### 6.3 최종 확인 결과
- 마지막 검증에서 8개 테스트 파일, 28개 테스트가 모두 통과했다.

## 7. 브라우저 evaluator 결과

### 7.1 실제 실행 경로
1. `Quick Play (ST01 vs ST01)`
2. `Keep Hand`
3. `Keep Hand`
4. Player 1 첫 `MAIN` phase 확인

### 7.2 저장한 결과물
- `artifacts/ux-harness/2026-03-27__pre-main-mulligan.png`
- `artifacts/ux-harness/2026-03-27__p1-main-phase.png`
- `artifacts/ux-harness/2026-03-27__scorecard.md`
- `artifacts/ux-harness/2026-03-27__findings.md`

### 7.3 scorecard 요약
- 룰 정확성: `38 / 40`
- 페이즈/스텝 가시성: `19 / 20`
- 행동 가능성 명확성: `17 / 20`
- 타이밍/원인 설명력: `12 / 15`
- 시각적 완성도: `4 / 5`
- 총점: `90 / 100`

## 8. 현재 기준에서 바로 가능한 다음 작업

### 8.1 추천 작업 순서
1. `P1_MAIN_AFTER_MULLIGAN` checkpoint 기준으로 main phase clarity를 더 다듬는다.
2. `ATTACK_DECLARE_WINDOW` 기준으로 attack/block flow readability를 보강한다.
3. `MANDATORY_TARGET_SELECTION` 기준으로 강제 선택 진행률 표시를 단일화한다.

### 8.2 바로 사용할 기준
- planner는 `docs/agent/harness/` 기준 문서를 먼저 갱신한다.
- generator는 `EngineUiSnapshot`을 기준으로만 UI를 수정한다.
- evaluator는
  - `npm run test:ux-harness`
  - 관련 regression
  - 브라우저 checklist
  순서로 검증한다.

## 9. 남아 있는 관찰 포인트
- action panel은 카드 x 라인 조합이 많아질수록 정보량이 빠르게 커질 수 있다.
- phase toast와 상단 ribbon이 동시에 보일 때 시선 분산이 생길 수 있다.
- mandatory 선택 진행률을 queue / banner / action panel 중 어디를 단일 source로 삼을지 추가 결정이 필요하다.

## 10. 한 줄 결론
- 현재 저장소는 이제 `룰 정확성 + UX 가독성`을 같은 계약으로 다루는 game-screen UX harness를 갖췄고, 다음 명령부터는 named checkpoint와 evaluator 루프를 기준으로 바로 반복 개선에 들어갈 수 있는 상태다.
