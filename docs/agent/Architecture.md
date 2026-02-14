# Agent Architecture Notes

## 목적
엔진/데이터/UI/테스트 경계를 빠르게 파악하기 위한 요약 문서.

## 코드 구조
- 엔진 핵심 (`src/logic/`)
  - `types.ts`: 도메인 타입/상태 스키마
  - `GameEngine.ts`: 턴/페이즈/전투 오케스트레이션
  - `effects.ts`, `effectActions.ts`: 효과 큐/실행
  - `RuleValidator.ts`: 합법성 검증
  - `TargetSelector.ts`: 타겟 계산
- AI (`src/logic/ai/`)
  - baseline/strong bot 및 평가 로직
- 카드 데이터
  - `packs/*.json`, `src/logic/cardEffects/*.ts`
- UI
  - `src/main.ts`, `src/SetupUI.ts`, `src/DeckBuilderUI.ts`
- 테스트
  - `tests/rules_v2_regression/`(룰 게이트), `tests/cards/`, `tests/legacy/`

## 엔진 불변조건(상세)
- 효과 큐 정렬은 `creationTime` 오름차순 + 턴 플레이어 우선
- 효과 생성 기준 시계는 `globalStep`
- 대미지 처리 중 비트리거 효과는 `deferredEffectQueue`로 지연
- 입력권은 `interactionOwnerPlayerId` 기준
- 시뮬레이션/자동플레이는 `getLegalActions` + `step` 단일 진입점
- 관측/재현은 `getObservation` + `getSerializableState` 사용

## 소스 우선순위
1) 카드 텍스트 2) 룰북 PDF 3) 룰 회귀 테스트 4) 구현 코드 5) 보조 문서
