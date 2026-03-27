# Game UX Harness

## 목적
- 게임 화면 전용 UX 하네스를 둔다.
- 엔진의 룰 판정과 UI의 설명력을 같은 품질 축으로 다룬다.
- 다음 작업부터는 planner -> generator -> evaluator 순서로만 UX 개선을 진행한다.

## 현재 구현 기준
- 엔진 계약:
  - `step()`
  - `getLegalActions()`
  - `getUiSnapshot(actorPlayerId)`
- 테스트 체크포인트:
  - `P1_MAIN_AFTER_MULLIGAN`
  - `ATTACK_DECLARE_WINDOW`
  - `MANDATORY_TARGET_SELECTION`
- 하네스 테스트 명령:
  - `npm run test:ux-harness`

## 작업 순서
1. Planner
   - 룰 스냅샷, 존 모델, 타이밍, 키워드, override, UX 계약, open question만 갱신한다.
2. Generator
   - UI는 엔진이 준 `EngineUiSnapshot`만 렌더링한다.
   - 룰 계산을 UI에 재구현하지 않는다.
   - 새 UX는 named checkpoint 하나 이상에 연결한다.
3. Evaluator
   - Vitest로 결정론적 게이트를 통과시킨다.
   - 라이브 브라우저에서 checklist를 따라 직접 눌러 본다.
   - 스크린샷, scorecard, next findings를 `artifacts/ux-harness/`에 남긴다.

## Structured Handoff
- 변경한 룰 축:
- 변경한 checkpoint:
- 추가/수정한 테스트:
- 남은 evaluator finding:
- 다음 스프린트에서 볼 리스크:

## Sprint Contract Template
- 목표 스코프:
- 룰 기준:
- UX 완료 정의:
- checkpoint:
- deterministic tests:
- browser evaluator path:
- 차단 요인 / open question:
