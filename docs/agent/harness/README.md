# Game UX Harness

## 목적
- 데스크톱 `Quick Play`와 브라우저에서 재현 가능한 checkpoint를 같은 UX 게이트로 평가한다.
- 엔진의 `EngineUiSnapshot`을 단일 source of truth로 유지한다.
- 룰 정확성, 설명력, 입력 우선순위를 Vitest + Playwright + scorecard 산출물까지 닫힌 루프로 관리한다.

## 단일 시나리오 정의
- 공통 시나리오/점수 기준은 `scripts/ux/uxHarnessScenarios.ts`를 기준으로 유지한다.
- 현재 포함된 시나리오:
  - `quick-play-main`
  - `P1_MAIN_AFTER_MULLIGAN`
  - `ATTACK_DECLARE_WINDOW`
  - `BLOCK_DECISION_WINDOW`
  - `MANDATORY_TARGET_SELECTION`
  - `END_PHASE_HAND_ADJUST`

## 실행 명령
- deterministic gate: `npm run test:ux-harness`
- browser flow capture: `npm run test:ux-harness:e2e`
- scorecard build: `npm run test:ux-harness:report`

## Dev Checkpoint Loader
- 개발 서버에서 `/?uxCheckpoint=<CHECKPOINT_NAME>`로 직접 checkpoint 화면을 연다.
- 지원 checkpoint:
  - `P1_MAIN_AFTER_MULLIGAN`
  - `ATTACK_DECLARE_WINDOW`
  - `BLOCK_DECISION_WINDOW`
  - `MANDATORY_TARGET_SELECTION`
  - `END_PHASE_HAND_ADJUST`
- loader는 dev 전용이며 `src/main.ts`에서 초기 부팅 시 처리한다.

## 평가 순서
1. Planner
   - 룰 축, checkpoint, 평가 기준, open question을 먼저 고정한다.
2. Generator
   - UI는 `EngineUiSnapshot`만 렌더링한다.
   - legality, priority, timing reasoning을 UI에서 다시 추론하지 않는다.
   - 새 UX는 최소 한 개 이상의 named checkpoint와 연결한다.
3. Evaluator
   - `npm run test:ux-harness`로 계약/렌더 회귀를 통과시킨다.
   - `npm run test:ux-harness:e2e`로 Quick Play 실제 흐름과 checkpoint 화면을 캡처한다.
   - `npm run test:ux-harness:report`로 `artifacts/ux-harness/scorecard.json`과 `scorecard.md`를 생성한다.

## 산출물
- raw browser observations: `artifacts/ux-harness/raw/*.json`
- screenshots: `artifacts/ux-harness/screenshots/*.png`
- score summary: `artifacts/ux-harness/scorecard.json`
- markdown summary: `artifacts/ux-harness/scorecard.md`

## Structured Handoff
- 변경한 룰 축:
- 변경한 checkpoint:
- 추가/수정한 deterministic test:
- 추가/수정한 browser scenario:
- scorecard 결과:
- 남은 evaluator finding:
- 다음 스프린트 리스크:
