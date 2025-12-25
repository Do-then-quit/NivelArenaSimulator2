# NivelArena Simulator - Issues & Bug Tracker

검증 과정에서 발견된 로직 오류 및 개별 카드 효과의 오작동 사례를 기록합니다.

## 1. 개별 카드 로직 이슈 (Card Logic Issues)

### [ST02-009] - 대미지 트리거 오작동
- **발견일**: 2025-12-22
- **현상**: 대미지 트리거로 발동 시, '3코스트 이하 상대 유닛'만 선택 가능해야 하나 다음의 로직 오류 발생:
    1. **타겟 범위 오류**: 상대 필드뿐만 아니라 자신의 필드 유닛도 선택 가능함.
    2. **필터링 오류**: 3코스트를 초과하는 유닛도 선택 및 파괴가 가능함.
- **원인 추정**: `GameEngine.ts`의 `selectTarget` 또는 `EffectManager`에서 트리거 효과의 `TargetSchema` (scope: OPP_FIELD, costMax: 3) 검증 로직이 수동 선택(`MANUAL`) 시 완벽하게 구속되지 않음.
- **조치 계획**: `selectTarget` 함수 내에 `TargetSchema.conditions` (costMax 등)에 대한 추가 검증 로직 구현 필요.

## 3. 아키텍처 이슈 (Architectural Issues)

### 비결정론적 로직 (Non-deterministic Logic)
- **현상**: `Math.random`을 사용하여 덱 셔플 및 랜덤 타겟팅을 수행하므로 동일한 상황 재현 불가.
- **해결 방안**: 시드 주입이 가능한 PRNG(Pseudo-Random Number Generator) 도입.

### 전투 단계 구분 미흡
- **현상**: 공격/방어 선언 단계가 명확히 분리되지 않아 '어태커', '디펜더' 키워드 발동 시점이 모호함.
- **해결 방안**: 전투 시스템을 룰북 7.2~7.4에 따라 단계별로 리팩토링.
