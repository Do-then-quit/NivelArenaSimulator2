# NivelArena 시뮬레이터 분석 리포트

## 1. 프로젝트 개요
**유형:** TypeScript / Node.js 애플리케이션
**빌드 도구:** Vite
**테스트:** Vitest
**아키텍처:** 중앙 집중식 게임 엔진과 반응형 UI 렌더링을 갖춘 바닐라 JS/TS 구조.

## 2. 게임 엔진 아키텍처
핵심 로직은 `src/logic/`에 위치하며, UI와 분리되어 있습니다.

### 핵심 컴포넌트
- **GameEngine (`GameEngine.ts`)**: 중앙 컨트롤러입니다. `GameState`를 관리하고, 페이즈를 전환하며, 플레이어 액션을 처리합니다.
- **GameState (`types.ts`)**: 플레이어, 존(Zone), 페이즈 정보, 턴 기능을 포함하는 단일 가변 상태 트리입니다.
- **RuleValidator (`RuleValidator.ts`)**: 엔진이 액션을 실행하기 전에 해당 액션(예: `canPlayUnit`, `canAttack`)을 검증하는 정적 메서드들을 포함합니다.

### 실행 흐름 (게임 루프)
게임은 `GameEngine.nextPhase()`가 관리하는 엄격한 페이즈 기반 루프를 따릅니다:
1. **LEVEL_UP**: 리더 레벨이 증가합니다 (자동).
2. **DRAW**: 턴 플레이어가 카드를 뽑습니다.
3. **MAIN**: 플레이어가 유닛/아이템/스킬 카드를 플레이합니다.
4. **ATTACK**: 전투 페이즈입니다.
5. **BLOCK**: 공격이 적 유닛이 있는 라인을 대상으로 할 경우 트리거됩니다.
6. **END**: 정리 단계입니다 (핸드 제한, 턴 종료 버프 만료).

## 3. 카드 및 효과 시스템
이 프로젝트는 카드 데이터에 데이터 주도(Data-driven) 방식을, 효과 로직에 조회 테이블(Lookup-table) 방식을 사용합니다.

### 트리거 메커니즘
효과는 `EffectManager.processEffects()`에 `ActivationCondition`을 전달하여 트리거됩니다.
**주요 트리거:**
- `ENTRY`: 유닛이 플레이될 때.
- `ATTACKER`: 유닛이 공격할 때.
- `DEFENDER`: 유닛이 방어하거나 공격당할 때.
- `PASSIVE`: 지속 효과 (스탯 계산 시 동적으로 확인).
- `DAMAGE_TRIGGER`: 데미지를 입어 카드가 패/필드로 이동하기 전 발동.

### 실행 로직 (`EffectManager.ts`)
1. **필터**: 소스 카드에서 현재 트리거 조건과 일치하는 효과를 찾습니다.
2. **조건 확인**: `checkCondition()`이 요구 사항(예: "유닛 3기 이상 보유 시")을 검증합니다.
3. **코스트**: 코스트가 존재할 경우(예: "패에서 카드 1장 트래시"), 엔진은 `SELECT_COST` 상호작용 모드로 진입합니다.
4. **타겟팅**:
   - **자동**: `TargetSelector`를 통해 즉시 해결됩니다 (예: "자신", "모든 상대 유닛").
   - **수동**: 엔진이 `SELECT_TARGET` 상호작용 모드로 진입하여 UI 입력을 기다립니다.
5. **액션**: 검증이 완료되고 코스트가 지불되면 `ActionRegistry`가 효과 로직을 실행합니다.

### 데이터 구조
카드는 다음과 같은 TypeScript 객체(JSON에서 생성된 것으로 보임)로 정의됩니다:
- 기본 스탯 (`cost`, `power`, `hit`, `attribute`).
- `effects`: 효과 객체들의 배열.
  ```typescript
  {
      activation: ActivationCondition.ENTRY,
      condition: { type: 'LEADER_LEVEL', value: 2 },
      action: { type: 'BUFF_POWER', params: { value: 2000 } }
  }
  ```

## 4. 내부 구현 상세
- **UI 렌더링**: `main.ts`는 현재 `GameState`를 기반으로 `document.body.innerHTML`을 완전히 다시 작성하는 `render()` 함수를 사용합니다. 이는 "무식한(brute-force)" 반응형 모델이지만, 이 정도 규모에는 단순하고 효과적입니다.
- **상호작용 모드**: `GameEngine`은 `interactionMode` 상태('NORMAL', 'SELECT_TARGET', 'SELECT_COST')를 가집니다. UI는 이 모드에 따라 이벤트 리스너를 조정합니다 (예: `SELECT_COST` 중에는 카드를 클릭하면 플레이하는 대신 코스트로 지불).
- **확장성**: 새로운 카드 메커니즘을 추가하려면 다음이 필요합니다:
  1. 카드 파일에 효과 정의.
  2. 새로운 액션 타입이라면 `effectActions.ts`에 구현.
  3. 새로운 타겟팅 범위라면 `TargetSelector.ts`에 추가.
