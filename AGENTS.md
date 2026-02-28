# NivelArenaSimulator2 Agent Guide (Compact)

## 0) 목적
- 이 문서는 **짧은 허브 문서**다. 상세 규칙/구조/계획은 하단 포인터 문서를 우선 참조한다.
- 구현/테스트/리팩터링은 항상 `NivelArena_Comprehensive_Rules_Ver.2.0.pdf` 기준으로 진행한다.
- 룰 해석이 애매하면 코드 관성보다 룰북 조항 번호를 우선한다.
- AI 작업은 아래 **활성 로드맵**을 우선 적용한다:
  - `docs/roadmaps/aiRoadmap.fixed_matchup.ko.md`
  - 기본 원칙: 단기에는 고정 매치업 플레이 봇 강화에 집중하고, 덱 탐색/메타 생성은 장기 백로그로 분리한다.

## 1) Project Overview
- 프로젝트명: `NivelArenaSimulator2`
- 목적: 니벨아레나 TCG 규칙 기반 시뮬레이터 (엔진 + UI + 회귀 테스트)
- 핵심 스택: TypeScript, Vite, Vitest
- 실행 명령:
  - 개발 서버: `npm run dev`
  - 빌드: `npm run build`
  - 프리뷰 서버: `npm run preview`
  - 전체 테스트: `npm test`
  - 부분 테스트: `npx vitest run <파일경로>`
  - Bot soak: `npm run test:bot-soak`
  - 온라인 릴레이(개발): `npm run relay:dev`
  - 온라인 릴레이(실행): `npm run relay:start` (또는 `npm run start`)
  - AI 회귀 게이트: `npm run ai:regression`
  - AI 벤치/라더: `npm run ai:bench`, `npm run ai:ladder`
  - AI 고급 게이트: `npm run ai:phase4:matrix`, `npm run ai:phase4.1:promote`
  - TODO: 로드맵 placeholder 커맨드(`ai:fixed:*`)가 실제 스크립트로 연결되면 별칭 정리

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
   - 카드 팩 일괄 구현 요청도 배치 단위로 분할 (권장 5장, 허용 4~6장)
4. 배치 게이트: 변경 지점 테스트 → 관련 회귀 → (필요 시) 전체 테스트 통과 전 다음 배치 진행 금지
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
- 카드 팩 구현 시 배치마다 아래 순서를 반복:
  1. 배치 카드에 대한 실패 테스트 작성
  2. 구현 후 변경 지점 테스트 실행 (`npx vitest run tests/cards/<pack>/...`)
  3. 관련 `tests/rules_v2_regression/` 회귀 실행
  4. 모두 통과 시에만 다음 배치 진행
- 권장: 팩 전체 배치 완료 시 `npm test`로 최종 게이트
- AI/봇 변경 시 최소 회귀:
  - `tests/rules_v2_regression/rules_v2_ai_ready_stage1_regression.test.ts`
  - `tests/rules_v2_regression/rules_v2_ai_ready_stage2_stage3_regression.test.ts`
  - `tests/rules_v2_regression/rules_v2_ai_baseline_bot_regression.test.ts`
  - `tests/rules_v2_regression/rules_v2_mulligan_regression.test.ts`
  - `tests/rules_v2_regression/rules_v2_bt01_061_targeting_regression.test.ts`

## 7) Task-specific Guidance Pointers
- 아키텍처 상세: `docs/agent/Architecture.md`
- 기능 구현 워크플로우 상세: `docs/agent/Workflow.md`
- AI 계획/로드맵 포인터: `docs/agent/Plans.md`
- AI 활성 실행 로드맵(최우선):
  - `docs/roadmaps/aiRoadmap.fixed_matchup.ko.md`
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

## 9) 최근 변경 컨텍스트 스냅샷 (2026-02-22 기준)
- 아래 커밋군의 핵심 맥락을 유지한다:
  - ST10 구현: `bd6cc5b`, `470794a`, `f2121a1`
  - ST11 구현: `06b9dc5`
  - 멀티플레이(Room Code): `d281ebd`
  - UI 레이아웃/버그 수정: `2ba830b`, `d6a9930`, `d286f89`, `97626fd`

### 9.1 ST10/ST11 카드 구현 위치
- 효과 정의:
  - `src/logic/cardEffects/st10.ts`
  - `src/logic/cardEffects/st11.ts`
- 카드 DB 연결/타입 및 규칙 연동 주요 지점:
  - `src/logic/CardDatabase.ts`
  - `src/logic/types.ts`
  - `src/logic/RuleValidator.ts`
  - `src/logic/TargetSelector.ts`
  - `src/logic/effectActions/core.ts`
  - `src/logic/engine/combat/CombatFlow.ts`
- 통합 카드 테스트 모듈/레지스트리:
  - `src/logic/cardTests/shared/ST10.ts`
  - `src/logic/cardTests/shared/ST11.ts`
  - `src/logic/cardTests/registry.ts`
- 회귀 테스트:
  - `tests/cards/st10/st10_unified.test.ts`
  - `tests/cards/st10/st10_effects_regression.test.ts`
  - `tests/cards/st11/st11_unified.test.ts`
  - `tests/cards/st11/st11_effects_regression.test.ts`
- 카드 이미지:
  - `public/assets/cards/ST10-001.jpg` ~ `ST10-017.jpg`
  - `public/assets/cards/ST11-001.jpg` ~ `ST11-017.jpg`

### 9.2 온라인 멀티플레이(Room Code) 구현 위치
- 프로토콜/타입 단일 소스:
  - `src/shared/onlineProtocol.ts`
- 릴레이 서버(MVP, host-authoritative):
  - `server/index.ts`
- 클라이언트 온라인 제어:
  - `src/ui/online/OnlineClient.ts`
  - `src/ui/online/onlineMatchController.ts`
  - `src/ui/online/hash.ts`
- 화면/상태/라우팅:
  - `src/ui/screens/onlineRoom.ts`
  - `src/ui/screens/menu.ts`
  - `src/main.ts`
  - `src/ui/appState.ts` (`Screen.ONLINE_ROOM`, `onlineSession`)
  - `src/ui/playerPerspective.ts`
- 문서:
  - `docs/online-multiplayer.md`
- 관련 테스트 묶음:
  - `tests/network/`
  - `tests/ui/game_loop_online_visibility.vitest.test.ts`
  - `tests/ui/game_view_online_perspective.vitest.test.ts`
  - `tests/ui/player_perspective_online.vitest.test.ts`
  - `tests/ui/online_room_state_transitions.vitest.test.ts`

### 9.3 최근 UI 변경 포인트
- 게임 화면/입력 바인딩 중심:
  - `src/ui/screens/gameView.ts`
  - `src/ui/screens/gameBindings.ts`
- 레이아웃/스타일:
  - `src/style.css`
- 상태/루프:
  - `src/ui/appState.ts`
  - `src/ui/gameLoop.ts`
  - `src/main.ts`
- 관련 회귀:
  - `tests/ui/game_view_fit_layout.vitest.test.ts`
  - `tests/ui/game_log_panel_render.vitest.test.ts`
  - `tests/ui/game_view_damage_summary.vitest.test.ts`
