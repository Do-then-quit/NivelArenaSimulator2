# 팩 구현 정책 (자동 인지 기본값)

## 목적
- 팩 구현 요청에 대한 에이전트 기본 동작을 고정한다.
- `"다중효과 테스트도 추가해줘"` 같은 후속 지시가 필요 없도록 완료 기준을 강제한다.

## 트리거 문구
- 아래 의도의 요청은 기본적으로 팩 구현 자동 인지 모드로 처리한다.
  - `"<PACK_ID> 팩 구현"`
  - `"카드 효과 구현"`
- 기본 대상 범위는 `STxx`, `BTxx`, `SBxx` 팩이다.

## 기본 모드: 풀패키지
- 사용자가 명시적으로 범위 축소를 요청하지 않으면 다음을 모두 수행한다.
  - 효과 구현
  - 효과 등록
  - 카드 테스트 구현
  - 다중효과 독립 테스트 커버리지 확보
  - 회귀 검증
  - 커버리지 요약을 포함한 완료 보고

## 필수 파일 작업 범위
- 효과 정의:
  - `src/logic/cardEffects/<pack>.ts`
- 효과 등록:
  - `src/logic/CardDatabase.ts`
- 공유 통합 카드 테스트:
  - `src/logic/cardTests/shared/<PACK_ID>.ts`
- Vitest 러너:
  - `tests/cards/<pack>/<pack>_unified.test.ts`
- CardTester 모듈 연결 (현재 팩 구조상 필요한 경우):
  - `src/logic/cardTests/registry.ts`

## 다중효과 커버리지 규칙
- 카드에 발동/효과가 2개 이상이면 독립 테스트 케이스를 반드시 만든다.
- 발동/효과별 suffix 케이스 ID를 사용한다.
  - `-Awaken`
  - `-Passive`
  - `-Entry`
  - `-Active`
  - `-ActiveMain`
  - `-Attacker`
  - `-Trigger`
- 기본 카드 테스트를 유지하고, 효과별 테스트를 추가하는 혼합 전략을 사용한다.

## 트리거 검증 규칙
- 트리거에 `TRASH_SELF`가 포함되면 테스트에서 반드시 둘 다 검증한다.
  - 소스 이동 (예: damage -> trash)
  - 후속 결과 (draw/search/bounce/destroy 등)

## 검증 게이트
- 팩 단위 최소 게이트:
  - `npx vitest run tests/cards/<pack>/<pack>_unified.test.ts`
- 필수 규칙/AI 회귀 게이트:
  - `tests/rules_v2_regression/rules_v2_guardian_regression.test.ts`
  - `tests/rules_v2_regression/rules_v2_ai_ready_stage1_regression.test.ts`
  - `tests/rules_v2_regression/rules_v2_ai_ready_stage2_stage3_regression.test.ts`
  - `tests/rules_v2_regression/rules_v2_ai_baseline_bot_regression.test.ts`
  - `tests/rules_v2_regression/rules_v2_mulligan_regression.test.ts`
  - `tests/rules_v2_regression/rules_v2_bt01_061_targeting_regression.test.ts`
- 최종 권장 게이트:
  - `npm test`

## 셀프 체크 시나리오
- 시나리오 점검:
  - `"ST06 팩 구현"` 요청 시 다중효과 suffix 테스트를 포함한 풀패키지 범위를 기본으로 제시/실행해야 한다.
- 누락 방지:
  - 다중효과 카드가 있는 팩에서 suffix 독립 케이스가 없으면 완료 처리하면 안 된다.
- 옵트아웃 동작:
  - `최소`, `빠르게`, `테스트 제외`, `회귀 제외`가 명시되면 축소 범위를 출력에 명확히 적어야 한다.
- 일관성 점검:
  - `AGENTS.md`, `docs/agent/Workflow.md`, 본 정책 문서가 항상 같은 기준을 유지해야 한다.

## 완료 게이트 (강제)
- 아래 조건을 모두 만족하지 않으면 완료 선언 금지:
  - 다중효과 카드 목록 식별 완료
  - 다중효과 카드별 suffix 독립 케이스 추가 완료
  - 해당되는 `TRASH_SELF` 이중 assert 완료
  - 필수 검증 명령 실행 완료 (또는 불가 사유 명시)
- 완료 메시지에는 반드시 `"다중효과 커버리지 목록"` 섹션을 포함한다.

## 옵트아웃 정책
- 아래를 사용자가 명시한 경우에만 범위를 축소할 수 있다.
  - `최소`
  - `빠르게`
  - `테스트 제외`
  - `회귀 제외`
- 명시적 옵트아웃이 없으면 항상 풀패키지 모드를 유지한다.

## 보고 템플릿
- 완료 보고에 아래를 포함한다.
  - 구현한 효과 파일
  - 수정한 등록 지점
  - 추가/수정한 테스트
  - 다중효과 커버리지 목록 (`card -> suffix cases`)
  - 실행한 검증 명령과 결과 요약

## 수용 기준
- 팩 구현 요청 시 후속 지시 없이 다중효과 독립 테스트가 기본 포함된다.
- 트리거/다중효과 테스트가 누락된 상태에서는 완료 처리하지 않는다.
- 최종 보고에 다중효과 커버리지 목록이 항상 포함된다.
- 사용자의 명시적 옵트아웃이 없으면 풀패키지 모드가 일관되게 적용된다.
