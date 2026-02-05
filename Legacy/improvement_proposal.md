# NivelArena Simulator 개선 및 리팩토링 제안서

이 문서는 프로젝트의 현재 상태를 분석하고, 유지보수성, 성능, 확장성을 향상시키기 위한 개선 사항을 제안합니다.

## 1. 아키텍처 및 디자인 패턴 (Architecture & Patterns)

### 🔴 상태 관리 시스템 개선 (State Management)
*   **현재:** `GameEngine` 내부에 거대한 `state` 객체가 있고, 이를 UI가 직접 참조하거나 변조할 위험이 있음. 변경 사항 추적이 어려워 UI 갱신이 비효율적(`render()`로 전체 다시 그리기).
*   **제안:**
    *   **Action/Reducer 패턴 도입:** 상태 변경을 예측 가능한 Action으로만 가능하게 제한 (Redux 스타일).
    *   **Immutability (불변성) 적용:** 상태 변경 시 새로운 객체를 반환하여, 변경된 부분만 UI가 감지할 수 있도록 유도.
    *   **이점:** 디버깅 용이(Time Travel Debugging 가능), UI 최적화(React/Vue 도입 시 필수).

### 🟡 의존성 주입 (Dependency Injection)
*   **현재:** `GameEngine`이 `EffectManager`를 직접 생성(`new`)하고 강하게 결합됨.
*   **제안:** 인터페이스를 통한 의존성 주입으로 변경. 테스트 시 Mocking이 쉬워짐.

## 2. 코드 품질 및 타입 안전성 (Code Quality)

### 🔴 `any` 타입 제거 및 엄격한 타입 체크
*   **현재:** `(this.state.pendingEffect as any)._fullEffect`와 같은 단언문(`as any`)이 코드 곳곳에 존재. 런타임 에러의 주범.
*   **제안:**
    *   `GameState` 인터페이스를 더 정교하게 정의 (Union Type 활용).
    *   `PendingEffect` 타입에 제네릭이나 구체적인 서브타입 도입.

### 🟡 매직 넘버/스트링 제거
*   **현재:** `st01.ts` 등에 하드코딩된 문자열 ID나 텍스트가 산재.
*   **제안:** 상수 파일(`constants.ts`)로 분리 관리.

## 3. UI/UX 및 렌더링 (Frontend)

### 🔴 프레임워크 도입 (React / Vue)
*   **현재:** `element.innerHTML`을 통째로 교체하는 방식.
    *   **문제점:** DOM 조작 비용이 높고, 입력 포커스가 끊기며, 애니메이션 구현이 매우 어려움.
*   **제안:** **React** 또는 **Vue** 도입 권장.
    *   현재의 데이터 주도 설계(State -> View)와 매우 잘 맞음.
    *   컴포넌트 단위 개발로 `main.ts`의 복잡도 해소 가능.

### 🟡 인터랙션 피드백 강화
*   **제안:**
    *   Target Selection 시 가능한 대상 외에는 `dimmed` 처리.
    *   카드 이동 시 애니메이션 파이프라인 구축 (현재는 즉시 이동).

## 4. 테스트 및 품질 보증 (Testing)

### 🟢 현재 상태 (Good)
*   `vitest` 기반의 유닛 테스트가 `game mechanics` (전투, 효과 발동 등)에 대해 충실히 작성되어 있음.

### 🟡 E2E / 통합 테스트 추가
*   **제안:** 실제 시나리오(게임 시작부터 종료까지)를 시뮬레이션하는 통합 테스트 추가.
*   **AI 대전:** 랜덤 행동을 하는 봇을 만들어 수천 판을 돌려보는 스트레스 테스트/밸런스 테스트 도입.

## 5. 확장성 (Extensibility)

### 🟡 효과 플러그인 시스템
*   **현재:** 새 효과를 추가하려면 `effectActions.ts`를 수정해야 함.
*   **제안:** 효과(Action)를 별도 파일로 분리하고, 런타임에 동적으로 등록할 수 있는 구조(`ActionProvider`)로 변경. 모드(Mod) 지원 가능성 열림.

---

## 📅 우선순위 제안 (Roadmap)

1.  **Phase 1 (기반 다지기)**: `any` 타입 제거 및 `GameEngine` 리팩토링 (상태 관리 분리).
2.  **Phase 2 (UI 현대화)**: React/Vue 로의 마이그레이션. (가장 시급한 사용자 경험 개선).
3.  **Phase 3 (안정화)**: 통합 테스트 및 자동화 봇 추가.
