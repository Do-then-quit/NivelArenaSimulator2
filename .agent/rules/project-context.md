---
trigger: always_on
---

# NivelArena Simulator Project Context

## 1. General Principles (Agentic Coding Guidelines)
*   **Simplicity First:** 복잡한 추상화나 상속보다는 명확하고 긴 함수 이름을 선호합니다. "작동하는 가장 단순한 코드"를 작성하십시오[1].
*   **Observability:** 모든 중요 이벤트(효과 발동, 페이즈 변경, 상태 변화)는 로그 파일이나 콘솔에 명확하게 기록되어야 합니다. 디버깅 시 AI가 로그만 보고 상황을 파악할 수 있어야 합니다[2][3].
*   **Stability:** 라이브러리나 의존성을 함부로 업그레이드하지 마십시오. 기존 코드가 깨지지 않는 것이 우선입니다[4].
*   **Test-Driven:** 변경 사항을 만들 때마다 관련된 테스트를 실행하거나 새로운 테스트를 작성하여 검증하십시오. 테스트 실행 명령어는 빠르고 간결해야 합니다[5][6].

## 2. Core Architecture: Effect Engine
니벨아레나의 규칙은 효과 처리 순서가 매우 엄격합니다. 다음 아키텍처를 반드시 준수하십시오.
모호하다면 규칙을 확인하고 처리하십시오. 규칙은 NivelArena_Comprehensive_Rules_Ver.2.0.pdf 에 있습니다.

### 2.1. Timestamp System (Global Clock)
*   게임 내 상태가 변하는 모든 행동(Atomic Action)마다 `GlobalStep`을 1씩 증가시키십시오.
*   모든 효과 객체(`Effect`)는 생성 시점의 `CreationTime` (Timestamp)을 가져야 합니다. 이는 "동시 발동"과 "끼어들기"를 구분하는 핵심 키입니다.

### 2.2. Priority Queue & Interruption Logic (Rule 8.4.1)
효과 처리 큐(Queue)는 단순한 FIFO가 아닌 **우선순위 큐**여야 합니다.
1.  **정렬 기준:** `CreationTime` (오름차순) -> `Turn Player` (우선) -> `Non-Turn Player`.
2.  **끼어들기 처리:** 턴 플레이어가 효과를 처리하여 **새로운 효과(New Stamp)**가 큐에 들어왔더라도, 큐에 **이전 타임스탬프(Old Stamp)**를 가진 상대방의 효과가 남아있다면, **상대방의 효과를 먼저 처리**해야 합니다[7].

### 2.3. Effect Types & Parsing
`cards.txt` 데이터를 파싱할 때 다음 타입을 구분하여 객체화하십시오.
*   **Auto (자동):** 조건 충족 시 이벤트 리스너가 감지하여 큐에 등록 (`[엔트리]`, `[엑시트]`, `[어태커]` 등)[8].
*   **Activated (기동):** 플레이어가 직접 클릭하여 발동. 코스트 지불 가능 여부 체크 필요 (`[액티브]`, 스킬 카드)[8].
*   **Continuous (지속):** `StatCalculator` 레이어에서 실시간 계산 (`[패시브]`, `[암드]`). 큐에 들어가지 않음[9].

## 3. Game Flow & Rules Summary

### 3.1. Phase Sequence
1.  **Level Up:** 리더 레벨 +1 (최대 10)[10].
2.  **Draw:** 1장 드로우 (선공 1턴 제외)[11].
3.  **Main:** 유닛 배치, 스킬 사용, 액티브 효과 사용.
    *   *주의:* `[이스케이프]` 효과는 **메인 페이즈 시작 시**에 처리됩니다 (엔드 페이즈 아님)[12].
4.  **Attack:** 전투 진행.
5.  **End:** 종료 시 효과 -> 지속 효과 만료 -> 스킬 존 비우기 -> 패 조정(7장)[13].

### 3.2. Combat Steps
1.  **Attack Declaration:** `[어태커]` 발동 -> `[돌파]`/`[듀얼리스트]` 체크[14].
2.  **Defense Declaration:**
    *   `[가디언]` 조건 체크 (자동 방어)[15].
    *   없다면 플레이어 방어 선택 -> `[디펜더]` 발동 -> `[종결]` 체크[16].
3.  **Battle Resolution:**
    *   방어 없음: `[침투]` 체크 -> 플레이어 대미지 -> `[트리거]` 체크[16][17].
    *   방어 있음: Power 비교 -> 패배 유닛 트래시 -> `[공멸]` 체크[18].
4.  **End of Battle:** `[관통]`/`[약탈]` 등의 결과 효과 처리[19].

### 3.3. Critical Rules (Rule Checks)
*   **Power 0:** 유닛의 파워가 0이 되는 즉시(효과 처리 도중이라도) 트래시 존으로 보냅니다[20].
*   **Deck Out:** 드로우해야 하거나 대미지를 받아야 할 때 덱이 0장이면 즉시 패배합니다[21].

## 4. Coding Style & Tools
*   **Language:** [사용하는 언어, 예: Python/C#/TypeScript]
*   **Testing:** Run tests using `[테스트 명령어, 예: pytest]`
*   **Linting:** Use `[린팅 툴]` for style checks.
*   **Logging:** 로그는 `debug.log` 파일에 쌓이도록 설정하십시오. 에러 발생 시 스택 트레이스와 현재 게임 상태(State Dump)를 함께 출력하십시오.
--------------------------------------------------------------------------------