# Agent Workflow (Feature Implementation)

## 1. 사전 확인
- 룰북 조항 번호와 카드 텍스트를 먼저 확인한다.
- 변경 범위를 최소화하고 무관한 리팩터링을 분리한다.

## 2. 테스트 우선
- 실패 테스트(또는 재현 테스트)를 먼저 작성한다.
- 권장 위치:
  - 룰 시스템: `tests/rules_v2_regression/`
  - 카드 효과: `tests/cards/<pack>/`
  - 대표 UI 클릭 회귀: `tests/ui/cards/`
  - 재발 방지: `tests/legacy/engine/` 또는 신규 회귀
- 카드팩 구현 시 필수:
  - `src/logic/cardTests/shared/<PACK>.ts`에 카드별 테스트를 먼저 추가한다.
  - 각 카드의 **효과 단위** 테스트를 분리한다. (예: `ST10-001`, `ST10-001-Active`처럼 `testId`를 카드/효과 기준으로 분할)
  - 참고 패턴: `src/logic/cardTests/shared/ST10.ts`, `src/logic/cardTests/shared/ST11.ts`
  - Vitest 러너 파일(`tests/cards/<pack>/<pack>_unified.test.ts`)과 효과 회귀(`tests/cards/<pack>/<pack>_effects_regression.test.ts`)를 함께 유지한다.
  - 대표 카드 UI 클릭 테스트를 반드시 포함한다.
    - ST 팩: 대표 카드 최소 1장
    - BT/SB 팩: 대표 카드 최소 3장
  - 대표 카드 선정 기준:
    - 새 상호작용 타입 우선
    - 다단 선택/확정(`SELECT_*` + `CONFIRM_TARGETS`) 흐름 우선
    - 최근 회귀/버그 카드 우선
  - JSDOM 제약으로 드래그/드롭 자체는 직접 검증하지 않고, `PLAY_*` 선행 후 선택/옵션/확정 클릭을 검증한다.

## 3. 카드 팩 구현 배치 전략
- 대규모 카드 팩(예: 80장+)은 한 번에 구현하지 않는다.
- 기본 배치 크기: 5장
- 허용 범위: 4~6장 (난이도 높으면 더 작게 쪼갠다)
- 한 배치의 검증이 끝나기 전에는 다음 배치 구현을 시작하지 않는다.
- 배치 루프:
  1) 배치 카드 목록 확정 (예: `BT01-001`~`BT01-005`)
  2) 카드 텍스트와 룰북 조항 매핑
  3) 실패 테스트 먼저 작성
     - `src/logic/cardTests/shared/<PACK>.ts`: 카드별 + 효과별 테스트 케이스 작성
     - `tests/cards/<pack>/`: unified 러너/효과 회귀 파일 반영
     - 필요한 `tests/rules_v2_regression/` 회귀 추가
  4) 효과 구현 (`src/logic/cardEffects/`, 필요 시 엔진 수정)
  5) 변경 지점 테스트 실행
     - `npx vitest run tests/cards/<pack>/`
  6) 대표 카드 UI 클릭 테스트 실행
     - `npx vitest run tests/ui/cards/<pack>_representative_click.vitest.test.ts`
     - BT03은 기존 통합 파일도 포함: `npx vitest run tests/ui/bt03_click_effects_integration.vitest.test.ts`
  7) 관련 `tests/rules_v2_regression/` 실행
  8) 통과 시 다음 배치 진행
- 권장 명령:
  - `npx vitest run tests/cards/<pack>/`
  - `npx vitest run tests/ui/cards/<pack>_representative_click.vitest.test.ts`
  - `npx vitest run tests/rules_v2_regression/<관련파일>.test.ts`
  - 배치 여러 개 누적 완료 또는 팩 완료 시 `npm test`

## 4. 구현
- 작은 단위로 수정하고 즉시 검증한다.
- 룰북 조항 번호를 테스트명/주석/커밋 메시지에 남긴다.

## 5. 검증
- 권장 순서:
  1) 변경 지점 단위 테스트
  2) 관련 회귀 묶음
  3) `npm test` 전체
- AI/봇 변경 시 최소 회귀 세트는 `AGENTS.md`를 따른다.

## 6. 완료 기준
- 테스트 통과
- 팩 효과 구현 완료 전 대표 카드 UI 클릭 테스트 통과
- 문서/포인터 경로 무결성 확인
- 변경 목적과 검증 결과를 커밋/PR에 명확히 기록
