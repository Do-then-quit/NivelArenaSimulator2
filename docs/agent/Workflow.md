# Agent Workflow (Feature Implementation)

- 팩 구현 기본 정책: `docs/agent/PackImplementationPolicy.md`

## 1. 사전 확인
- 룰북 조항 번호와 카드 텍스트를 먼저 확인한다.
- 변경 범위를 최소화하고 무관한 리팩터링을 분리한다.

## 2. 테스트 우선
- 실패 테스트(또는 재현 테스트)를 먼저 작성한다.
- 권장 위치:
  - 룰 시스템: `tests/rules_v2_regression/`
  - 카드 효과: `tests/cards/<pack>/`
  - 재발 방지: `tests/legacy/engine/` 또는 신규 회귀

## 3. 구현
- 작은 단위로 수정하고 즉시 검증한다.
- 룰북 조항 번호를 테스트명/주석/커밋 메시지에 남긴다.

## 4. 검증
- 권장 순서:
  1) 변경 지점 단위 테스트
  2) 관련 회귀 묶음
  3) `npm test` 전체
- AI/봇 변경 시 최소 회귀 세트는 `AGENTS.md`를 따른다.

## 5. 완료 기준
- 테스트 통과
- 문서/포인터 경로 무결성 확인
- 변경 목적과 검증 결과를 커밋/PR에 명확히 기록

## 6. 팩 구현 전용 체크리스트 (기본값)
- 트리거 문구:
  - `"<PACK_ID> 팩 구현"` 또는 `"카드 효과 구현"` 요청은 기본적으로 풀패키지 모드로 처리한다.
- 필수 구현 범위:
  - `src/logic/cardEffects/<pack>.ts` 효과 구현/수정
  - `src/logic/CardDatabase.ts` 효과 등록
  - `src/logic/cardTests/shared/<PACK_ID>.ts` 통합 카드 테스트 구현/수정
  - `tests/cards/<pack>/<pack>_unified.test.ts` 및 registry 연결 반영
- 다중효과 강제 규칙:
  - 효과가 2개 이상인 카드는 suffix 독립 케이스를 추가한다.
  - 표준 suffix: `-Awaken`, `-Passive`, `-Entry`, `-Active`, `-ActiveMain`, `-Attacker`, `-Trigger`
- 트리거 강제 규칙:
  - 트리거에 `TRASH_SELF`가 포함되면 소스 이동과 후속 효과 결과를 모두 assert한다.
- 완료 게이트:
  - 다중효과 커버리지 확인 없이 완료 선언 금지.
  - 최종 보고에 카드 단위 다중효과 커버리지 목록을 포함한다.
- 옵트아웃 처리:
  - 사용자가 `최소`, `빠르게`, `테스트 제외`, `회귀 제외`를 명시한 경우에만 범위 축소.
  - 명시가 없으면 풀패키지 모드를 유지한다.
- 셀프 체크:
  - `"ST06 팩 구현"` 요청 시 다중효과 suffix 테스트가 자동 포함되어야 한다.
  - 다중효과 카드 suffix 커버리지가 누락되면 완료 처리하면 안 된다.
