# NivelArena Simulator Project Context

## 1. General Principles (Agentic Coding Guidelines)

*   **Simplicity First:** 복잡한 추상화나 상속보다는 명확하고 긴 함수 이름을 선호합니다. "작동하는 가장 단순한 코드"를 작성하십시오[1].
*   **Observability:** 모든 중요 이벤트(효과 발동, 페이즈 변경, 상태 변화)는 로그 파일이나 콘솔에 명확하게 기록되어야 합니다. 디버깅 시 AI가 로그만 보고 상황을 파악할 수 있어야 합니다[2][3].
*   **Stability:** 라이브러리나 의존성을 함부로 업그레이드하지 마십시오. 기존 코드가 깨지지 않는 것이 우선입니다[4].
*   **Test-Driven:** 변경 사항을 만들 때마다 관련된 테스트를 실행하거나 새로운 테스트를 작성하여 검증하십시오. 테스트 실행 명령어는 빠르고 간결해야 합니다[5][6].

## 2. Core Architecture: Effect Engine (Based on Rule 8)

니벨아레나의 규칙은 효과 처리 순서가 매우 엄격합니다. 다음 아키텍처를 반드시 준수하십시오.
모호하다면 규칙을 확인하고 처리하십시오. 규칙은 NivelArena_Comprehensive_Rules_Ver.2.0.pdf 에 있습니다.

### 2.1. Timestamp System (Global Clock)

*   게임 내 상태가 변하는 모든 행동(Atomic Action)마다 `GlobalStep`을 1씩 증가시키십시오.
*   모든 효과 객체(`Effect`)는 생성 시점의 `CreationTime` (Timestamp)을 가져야 합니다.

### 2.2. Priority Queue & Interruption Logic (Rule 8.4.1)

효과 처리 큐(Queue)는 **우선순위 큐**여야 합니다. 

1.  **정렬 기준:** `CreationTime` (오름차순, 먼저 생성된 효과 우선) -> `Turn Player` (우선) -> `Non-Turn Player`.
2.  **끼어들기 처리 (Rule 8.4.1):** 
    *   턴 플레이어(TP)와 상대 플레이어(NTP)의 효과가 동시에 발동 조건을 만족하여 큐에 들어갑니다 (Batch 1).
    *   TP의 효과를 먼저 처리합니다.
    *   이 처리로 인해 TP의 **새로운 효과**가 발동 조건을 만족하더라도 (Batch 2), 큐에 **NTP의 처리되지 않은 효과(Batch 1)**가 남아있다면 **NTP의 효과를 먼저 처리**해야 합니다.
    *   즉, "동시 발생한 효과들(Simultaneous Batch)"을 양쪽 플레이어 모두 처리하는 것이, "새로 발생한 파생 효과(New Batch)"보다 우선순위가 높습니다.

### 2.3. Effect Types (Rule 8.1.3)

*   **Active (기동):** 메인 페이즈/어택 페이즈에 턴 플레이어가 임의로 발동. (`[액티브]`, 스킬 카드).
*   **Auto (자동):** 조건 만족 시 자동 발동. (`[엔트리]`, `[어태커]`, `[디펜더]`, `[엑시트]`, `[이스케이프]`, `[각성]`, `[침투]` 등).
    *   *Rule 8.1.3.2.1:* 발동 전 카드가 다른 영역으로 이동하면 불발.
*   **Continuous (지속):** 조건 만족 시 상시 적용. 큐에 들어가지 않고 상태 계산에 즉시 반영. (`[패시브]`, `[암드]`, `[전선구축]`, `[레벨링크]`, `[믹스]`, `[광전사]`, `[크레딧]`).
*   **Trigger (트리거):** 대미지 처리 중 공개되었을 때 발동 (`[트리거]`).

## 3. Game Flow & Rules Summary

### 3.1. Phase Sequence (Rule 6)

1.  **Level Up:** 리더 레벨 +1 (최대 10). (리더 레벨 10이면 스킵).
2.  **Draw:** 1장 드로우 (선공 1턴 스킵).
3.  **Main:** 유닛 배치/업그레이드, 스킬/액티브 사용.
    *   `[이스케이프]`는 메인 페이즈 **시작 시** 발동 (Rule 10.1.13).
4.  **Attack:** 전투 진행 (Rule 7 참조).
5.  **End:** `[이 턴이 끝날 때]` 효과 처리 -> `[~까지]` 효과 만료 -> 스킬 존 비우기 -> 패 조정(7장으로) (Rule 6.6).

### 3.2. Combat Steps (Rule 7)

**7.1. Attack Declaration Step**
*   턴 플레이어는 `[공격 선언]`을 하지 않은 유닛으로 공격 선언.
*   `[어태커]` 효과 발동.
*   `[돌파(Breakthrough)]`: 조건 만족 시 상대는 방어 선언 불가.
*   `[듀얼리스트]`: 조우 유닛(Encounter Unit)만 방어 가능, 조우 유닛은 반드시 방어해야 함.
*   `[침투(Infiltrate)]`: 방어 유닛이 없으면 드로우.

**7.2. Defense Declaration Step**
*   상대 플레이어는 공격 유닛과 **같은 레인(조우 유닛)**에 있는 유닛으로 방어 선언 가능.
*   `[가디언]`: 인접 레인의 유닛이 대신 방어 선언 가능 (Rule 10.2.6.3).
*   방어 선언 시 `[디펜더]` 효과 발동.
*   `[종결(Terminate)]`: 방어 선언 시 전투를 즉시 종료하고 해당 방어 유닛 트래시 (Rule 10.2.4.2).

**7.3. Battle Step**
*   **If Attacker moved zones:** Battle ends immediately (Rule 7.4.1).
*   **No Defender:** Attacker gives Damage equal to **Hit** to opponent (Rule 7.4.2).
*   **Defender Exists:** Compare **Power**.
    *   Attacker Power >= Defender Power: Defender Trashed.
    *   Attacker Power < Defender Power: Attacker Trashed.
*   **Sub-keywords Resolution:**
    *   `[관통(Penetrate)]`: 전투로 상대 유닛 트래시 시, 수치만큼 상대에게 대미지.
    *   `[약탈(Plunder)]`: 전투로 상대 유닛 트래시 시, 수치만큼 드로우.
    *   `[공멸(Mutual Destruction)]`: 전투로 트래시될 때, 상대 유닛도 트래시 (코스트 비교 조건 있음).
    *   `[귀환(Return)]`: 전투/효과로 트래시될 때, 엔드 페이즈에 패로 복귀.

**7.4. Battle End Step**
*   어태커/디펜더 효과 무효화.
*   전투 종료.

### 3.3. Critical Rules

*   **Power 0 Rule (Rule 1.3.7.3):** 유닛의 파워가 0이 되면 **즉시** 트래시됩니다. 이는 효과 처리 도중에도 발생할 수 있습니다.
*   **Deck Out (Rule 9.2.1.3):** 드로우해야 하거나 대미지를 받아야 할 때 덱이 0장이면 **즉시 패배**합니다.
*   **Damage Check (Rule 4.5.4):** 대미지를 1씩 처리 -> 트리거 확인 -> 반복. 대미지 존 10장 이상 시 패배.

## 4. Keywords & Mechanics Reference (Rule 10)

### 4.1. Basic Keywords
*   **[엔트리 (Entry)]**: 배치 시 자동 발동.
*   **[패시브 (Passive)]**: 필드/레벨 존 지속 효과.
*   **[액티브 (Active)]**: 메인/어택 페이즈 기동 효과. (아이콘에 따라 페이즈 제한)
*   **[어태커 (Attacker)]**: 공격 선언 시 발동 (전투 종료 시까지 유지).
*   **[디펜더 (Defender)]**: 방어 선언 시 발동 (전투 종료 시까지 유지).
*   **[엑시트 (Exit)]**: 전투/효과로 트래시될 때 발동. (업그레이드로 인한 트래시는 제외).
*   **[암드 (Armed)]**: 특정 아이템 장착 시 유효한 지속 효과.
*   **[전선구축 (Frontline)]**: 모든 유닛 존(3곳)에 유닛 존재 시 지속 효과.
*   **[레벨링크 (Level Link)]**: 리더 레벨 N 이상일 때 지속 효과.
*   **[트리거 (Trigger)]**: 대미지 존에서 공개될 때 발동.
*   **[믹스 (Mix)]**: 필드에 다른 속성 카드가 있을 때 지속 효과.
*   **[이스케이프 (Escape)]**: 내 턴 메인 페이즈 시작 시 발동 -> 덱 맨 아래로 이동.

### 4.2. Sub-keywords (Keyword triggers)
*   **[관통 (Penetrate)]**: `[어태커]` 하위. 전투로 유닛 트래시 -> 플레이어 대미지.
*   **[약탈 (Plunder)]**: `[어태커]` 하위. 전투로 유닛 트래시 -> 드로우.
*   **[돌파 (Breakthrough)]**: `[어태커]` 하위. 조건 만족 상대 유닛은 방어 불가.
*   **[듀얼리스트 (Dualist)]**: `[어태커]` 하위. 조우 유닛만 방어 가능 & 강제 방어.
*   **[침투 (Infiltrate)]**: `[어태커]` 하위. 방어 유닛 없으면 드로우. . 한 유닛이 복수의 침투를 가지고 있을 경우 가장 수치가 높은 침투 하나만 발동합니다
*   **[종결 (Terminate)]**: `[디펜더]` 하위. 방어 시 전투 강제 종료 & 방어유닛 트래시.
*   **[공멸 (Mutual Destruction)]**: `[엑시트]` 하위. 전투로 트래시 시, 코스트 비교하여 상대도 트래시.
*   **[귀환 (Return)]**: `[엑시트]` 하위. 트래시 시 엔드 페이즈에 패로 복귀.

### 4.3. Other Keywords
*   **[각성 (Awakening)]**: 리더 레벨 조건 달성 시 리더 뒤집기 (Auto).
*   **[광전사 (Berserk)]**: 공격 가능하면 반드시 공격 (Continuous). 턴 종료 불가.
*   **[가디언 (Guardian)]**: 인접 레인 방어 가능 (Condition). 방어 선언 시 해당 유닛이 방어 유닛이 됨.
    *   *방벽 (Barrier):* 패를 버리고 발동.
    *   *희생 (Sacrifice):* 다른 아군 유닛 트래시하고 발동.
*   **[크레딧 (Credit)]**: 배치 시 드로우, 필드에서 트래시 시 패 버림 (Continuous triggers Auto logic?). *Note: Rule 10.2.6.4 describes it as Continuous effect that triggers on Enter/Exit events.*

## 5. Coding Style & Tools

*   **Language:** TypeScript
*   **Testing:** `npm test` (Uses vitest)
*   **Linting:** `npm run lint`
*   **Logging:** `src/logic/DebugManager.ts`를 사용하여 `debug.log`에 기록.