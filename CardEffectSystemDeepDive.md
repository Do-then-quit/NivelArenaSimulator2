# NivelArena 카드 및 효과 시스템 심층 분석 (Deep Dive)

이 문서는 NivelArena 시뮬레이터의 핵심인 카드 및 효과 처리 시스템의 내부 작동 방식을 상세히 설명합니다.

## 1. 핵심 철학: 데이터 주도 설계 (Data-Driven Design)

이 프로젝트는 카드의 동작을 코드로 하드코딩하지 않고, **데이터(JSON/Object)** 로 정의하여 엔진이 이를 해석하고 실행하는 방식을 취합니다. 이를 통해 새로운 카드를 추가할 때 엔진 코드를 수정할 필요 없이 데이터 파일만 추가하면 됩니다.

### 주요 데이터 구조 (`types.ts`)

모든 효과는 `Effect` 인터페이스를 따릅니다:

```typescript
interface Effect {
    activation: ActivationCondition; // 언제 발동하는가? (예: ENTRY, ATTACKER)
    condition?: EffectCondition;     // 발동 조건은 무엇인가? (예: 리더 레벨 3 이상)
    cost?: EffectCost;               // 코스트가 필요한가? (예: 패 1장 버리기)
    targets?: TargetSchema;          // 누구에게 영향을 주는가? (예: 상대 유닛 1장)
    action: EffectAction;            // 무엇을 하는가? (예: 파워 -3000)
    duration?: 'TURN_END' | 'PERMANENT'; // 지속 시간
}
```

---

## 2. 효과 처리 라이프사이클 (The Effect Lifecycle)

효과가 발동되어 실제로 게임 상태를 변경하기까지의 과정은 `EffectManager.ts`가 주관하며, 다음 5단계로 이루어집니다.

### 1단계: 트리거 (Triggering)
게임 엔진이 특정 사건이 발생했음을 알립니다.
*   **예**: 플레이어가 유닛을 냄 -> `game.playUnit()` 호출 -> `effectManager.processEffects(ActivationCondition.ENTRY)` 실행.
*   이때 엔진은 현재 상황(Context)을 `EffectManager`에 전달합니다. (누가 냈는지, 어떤 카드인지 등)

### 2단계: 필터링 및 검증 (Filtering & Validation)
`EffectManager`는 해당 카드의 효과 목록 중 트리거 조건(`activation`)이 일치하는 효과를 찾습니다.
그 후 `checkCondition()`을 통해 추가 조건을 확인합니다.
*   **예**: "자신의 턴이라면" (`YOUR_TURN`), "리더 레벨이 5 이상이라면" (`LEADER_LEVEL`) 등.

### 3단계: 코스트 지불 (Cost Payment)
효과에 `cost`가 정의되어 있다면, 엔진은 **상호작용 모드(`currentScreen`는 그대로지만 `interactionMode`가 변경됨)** 로 진입합니다.
*   **모드**: `SELECT_COST`
*   **동작**: 사용자가 UI에서 코스트를 지불할 카드(예: 패의 카드)를 클릭할 때까지 대기합니다.
*   코스트가 지불되면 다시 효과 처리 프로세스로 복귀(`resume`)합니다.

### 4단계: 타겟팅 (Targeting)
효과가 누구에게 적용될지 결정합니다. (`TargetSelector.ts`)
*   **자동 타겟팅 (Auto)**: `selectMode: 'ALL'` 또는 타겟이 명확한 경우(예: `SELF`, `MY_TRASH`). 즉시 타겟 목록을 생성합니다.
*   **수동 타겟팅 (Manual)**: `selectMode: 'MANUAL'`. 엔진은 `SELECT_TARGET` 모드로 진입하여 사용자가 대상을 클릭하기를 기다립니다.
*   **필터링**: `TargetSchema`에 정의된 필터(예: `COST_LIMIT: 2` - 코스트 2 이하만 선택 가능)를 적용하여 유효한 대상만 클릭 가능하게 만듭니다.

### 5단계: 실행 (Execution)
모든 조건이 충족되고 타겟이 확정되면, `ActionRegistry` (`effectActions.ts`)에서 `action.type`에 해당하는 함수를 찾아 실행합니다.
*   **예**: `action.type`이 `BUFF_POWER`라면 `buffPower()` 함수가 호출되어 실제 유닛의 파워 수치를 변경(`buffs` 배열에 추가)합니다.

---

## 3. 상세 분석: TargetSelector 시스템

`TargetSelector`는 매우 유연한 쿼리 시스템을 가지고 있습니다.

*   **Scope (범위)**: 탐색할 영역을 지정합니다.
    *   `MY_FIELD`, `OPP_FIELD`: 필드 유닛
    *   `EnCOUNTER_UNIT`: 현재 교전 중인 상대 유닛
    *   `SHARED_LANE`: 서로 마주보는 유닛이 있는 라인
*   **Filter (필터)**: 대상을 좁힙니다.
    *   `HAS_KEYWORD`: 특정 키워드(예: '어태커')를 가진 유닛
    *   `COST_LOWER_THAN_COST_PAYMENT`: (매우 정교한 필터) 코스트로 지불한 카드보다 코스트가 낮은 유닛 (ST01-013 등에서 사용)

---

## 4. 실제 예시 분석

### 예시 1: 단순 버프 (ST01-003)
**효과**: "어태커 : 이 공격이 끝날 때까지 파워+1000."

```typescript
// 데이터 (st01.ts)
{
    activation: ActivationCondition.ATTACKER,
    action: { type: 'BUFF_POWER', params: { value: 1000 } },
    duration: 'TURN_END'
}
```
**흐름**:
1. 유닛 공격 선언 (`game.attack()`).
2. `processEffects(ATTACKER)` 호출.
3. 조건 없음, 코스트 없음, 타겟 없음(기본값 SELF).
4. 즉시 `buffPower` 액션 실행 -> 해당 유닛에 `+1000` 버프 추가.

### 예시 2: 복잡한 상호작용 (ST01-010)
**효과**: "엑티브 : 자신의 패를 1장 골라 덱에 넣고 섞는다. 조우 유닛의 파워-3000."

```typescript
// 데이터 (st01.ts)
{
    activation: ActivationCondition.ACTIVE,
    cost: { type: 'SHUFFLE_HAND_TO_DECK', amount: 1 },
    targets: { scope: 'ENCOUNTER_UNIT', type: 'UNIT', count: 1, selectMode: 'ALL' },
    action: { type: 'BUFF_POWER', params: { value: -3000 } },
    duration: 'TURN_END'
}
```
**흐름**:
1. 플레이어가 'Active' 버튼 클릭 (`game.activateEffect()`).
2. `EffectManager`가 `processEffect` 시작.
3. **[코스트]**: `cost` 감지 -> `SELECT_COST` 모드 진입. UI에서 패의 카드가 선택 가능해짐.
4. 사용자가 패를 클릭 -> 카드가 덱으로 이동하고 셔플됨 (`GameEngine.selectCost`).
5. **[타겟팅]**: `EffectManager` 재진입. `targets` 확인. `ENCOUNTER_UNIT`은 '자동' 타겟팅이므로, 현재 공격 중인 라인의 상대 유닛을 자동으로 찾습니다.
6. **[실행]**: 타겟인 상대 유닛에게 `BUFF_POWER` (-3000) 적용.

---

## 5. 시스템 확장 가이드

새로운 기능을 추가하려면 어디를 수정해야 할까요?

1.  **새로운 효과 액션 추가 (예: '유닛 소환')**:
    *   `types.ts`: `ActionType`에 `'SUMMON_UNIT'` 추가.
    *   `effectActions.ts`: `summonUnit` 함수 구현 및 `ActionRegistry`에 등록.
2.  **새로운 발동 시점 추가 (예: '턴 개시 시')**:
    *   `types.ts`: `ActivationCondition`에 `'TURN_START'` 추가.
    *   `GameEngine.ts`: 턴 시작 로직 부분에 `effectManager.processEffects(TURN_START)` 호출 추가.
3.  **새로운 타겟팅 조건 추가 (예: '체력이 가장 낮은 유닛')**:
    *   `TargetSelector.ts`: `resolve()` 메서드 내 `LOWEST_HP` 로직 구현. (현재 `LOWEST_POWER`는 존재)
