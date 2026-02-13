# Phase 4 첫 PR 최소 작업 세트

## 목표
- Phase 4 시작 기준 중 **회귀 세트 확장**을 가장 작은 단위로 선반영한다.
- 대상은 상호작용 의사결정 중 빈번한 실수 축(`SELECT_COST`, `SELECT_TARGET`, `SELECT_OPTIONAL`)이다.

## 테스트 파일
- `tests/rules_v2_regression/rules_v2_ai_phase4_interaction_regression.test.ts`

## 시나리오
1. `SELECT_COST`: 코스트 지불 시 저가치 카드를 우선 선택해야 한다.
2. `SELECT_TARGET`: `DESTROY_UNIT` 수동 타겟팅에서 더 고가치 적 유닛을 우선 선택해야 한다.
3. `SELECT_OPTIONAL`: `TRASH_SELF` 옵션은 기본적으로 거절(스킵)해야 한다.

## 수용 기준
- 위 3개 시나리오가 모두 통과한다.
- `ai:regression` 매니페스트에 본 테스트가 포함되어 Phase 4 게이트 준비 항목으로 자동 실행된다.
