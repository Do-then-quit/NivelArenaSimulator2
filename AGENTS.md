# NivelArenaSimulator2 Agent Guide (Compact)

## 0) 목적
- 이 문서는 **짧은 허브 문서**다. 상세 규칙/구조/계획은 하단 포인터 문서를 우선 참조한다.
- 구현/테스트/리팩터링은 항상 `NivelArena_Comprehensive_Rules_Ver.2.0.pdf` 기준으로 진행한다.
- 룰 해석이 애매하면 코드 관성보다 룰북 조항 번호를 우선한다.
- 문서/코드 파일을 편집할 때 인코딩은 항상 `UTF-8`을 사용한다. (권장: `UTF-8 without BOM`)

## 1) Project Overview
- 프로젝트명: `NivelArenaSimulator2`
- 목적: 니벨아레나 TCG 규칙 기반 시뮬레이터 (엔진 + UI + 회귀 테스트)
- 핵심 스택: TypeScript, Vite, Vitest
- 실행 명령:
  - 개발 서버: `npm run dev`
  - 빌드: `npm run build`
  - 전체 테스트: `npm test`
  - 부분 테스트: `npx vitest run <파일경로>`
  - Bot soak: `npm run test:bot-soak`

## 2) Source of Truth
1. 카드 텍스트 (룰 1.3.1)
2. `NivelArena_Comprehensive_Rules_Ver.2.0.pdf`
3. `tests/rules_v2_regression/`
4. `src/logic/`
5. 보조 문서 (`docs/reference/GEMINI.md`, `docs/reference/knowledge.md`, `Legacy/`)

## 3) Project Structure (요약)
- 엔진 핵심: `src/logic/`
  - `GameEngine.ts`, `effects.ts`, `effectActions.ts`, `RuleValidator.ts`, `TargetSelector.ts`
  - AI: `src/logic/ai/`
- 데이터: `packs/*.json`, `src/logic/cardEffects/`
- UI: `src/main.ts`, `src/SetupUI.ts`, `src/DeckBuilderUI.ts`
- 테스트:
  - 룰 회귀 게이트: `tests/rules_v2_regression/`
  - 카드 회귀: `tests/cards/`
  - 레거시 회귀: `tests/legacy/`

## 4) Workflow for Implementing a Feature
1. 관련 룰북 조항/카드 텍스트 확인
2. 실패 테스트(또는 재현 테스트) 먼저 작성
3. 작은 단위로 구현
4. 변경 지점 테스트 → 관련 회귀 → 필요 시 전체 테스트
5. 무관한 리팩터링 혼합 금지, 커밋/PR에 근거 명시

## 5) Engine Invariants (핵심만)
- 효과 큐 정렬: `creationTime` 오름차순 후 턴 플레이어 우선
- 효과 생성 시계: `globalStep`
- 대미지 처리 중 비트리거 효과: `deferredEffectQueue`로 지연
- 전투 종료 시 전투 상태(`combatStep`, `pendingAttackerIndex`, `phase`) 정합 복구
- 입력권 판정은 `interactionOwnerPlayerId` 기준
- AI 실행 진입점: `getLegalActions(actorPlayerId?)` + `step(action)`
- 관측/재현: `getObservation(actorPlayerId)`, `getSerializableState()`

## 6) Test Policy
- 테스트 없이 룰/효과 동작 변경 금지
- 권장 순서: 변경 지점 테스트 → 관련 회귀 묶음 → `npm test`
- AI/봇 변경 시 최소 회귀:
  - `tests/rules_v2_regression/rules_v2_ai_ready_stage1_regression.test.ts`
  - `tests/rules_v2_regression/rules_v2_ai_ready_stage2_stage3_regression.test.ts`
  - `tests/rules_v2_regression/rules_v2_ai_baseline_bot_regression.test.ts`
  - `tests/rules_v2_regression/rules_v2_mulligan_regression.test.ts`
  - `tests/rules_v2_regression/rules_v2_bt01_061_targeting_regression.test.ts`

## 7) Task-specific Guidance Pointers
- 아키텍처 상세: `docs/agent/Architecture.md`
- 기능 구현 워크플로우 상세: `docs/agent/Workflow.md`
- 팩 구현 자동 인지 정책: `docs/agent/PackImplementationPolicy.md`
- AI 계획/로드맵 포인터: `docs/agent/Plans.md`
- AI 체크리스트/실행 단계:
  - `docs/plans/AiReadyTask.md`
  - `docs/plans/phases/Phase0.md`
  - `docs/plans/phases/Phase1.md`
  - `docs/plans/phases/Phase2.md`
- AI 로드맵:
  - `docs/roadmaps/aiRoadmap.md`
  - `docs/roadmaps/aiRoadmap.ko.md`

## 8) UI 운영 메모
- `HUMAN vs BASELINE BOT`에서 시작 시 봇 핸드 공개/비공개 선택 가능
- 입력 권한은 UI 표시와 동일하게 `interactionOwnerPlayerId` 기준으로 처리

## 9) 팩 구현 자동 인지 (기본값)
- 기본 트리거:
  - `"<PACK_ID> 팩 구현"` 또는 `"카드 효과 구현"` 요청은 기본적으로 풀패키지 모드로 진입한다.
- 기본 풀패키지 범위 (ST/BT/SB):
  - 팩 카드 효과 구현, 등록, 카드 테스트, 다중효과 독립 테스트, 회귀 검증, 결과 보고까지 포함한다.
- 다중효과 강제 규칙:
  - 카드에 효과가 2개 이상이면 발동/효과별 독립 suffix 케이스를 반드시 만든다.
  - 표준 suffix: `-Awaken`, `-Passive`, `-Entry`, `-Active`, `-ActiveMain`, `-Attacker`, `-Trigger`
- 트리거 강제 규칙:
  - `TRASH_SELF`가 포함된 트리거는 소스 이동과 후속 결과를 모두 assert해야 한다.
- 종료 게이트:
  - 다중효과 커버리지 확인 없이 완료 선언 금지.
  - 완료 보고에는 팩의 다중효과 커버리지 목록을 반드시 포함한다.
- 옵트아웃(사용자 명시 시에만):
  - 사용자가 `최소`, `빠르게`, `테스트 제외`, `회귀 제외`를 명시한 경우에만 범위를 축소할 수 있다.
  - 명시적 옵트아웃이 없으면 항상 풀패키지 모드를 유지한다.
