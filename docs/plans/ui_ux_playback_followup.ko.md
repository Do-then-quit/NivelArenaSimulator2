# 대전 UI/UX 애니메이션 후속 작업 메모

이 문서는 2026-03-06 기준 대전 가독성 개선 작업의 현재 상태와, 다음 턴에 바로 이어서 진행할 후속 작업을 정리한 메모다.

## 현재 완료 범위

- 카드 이동 playback 1차
  - 드로우: `DECK -> HAND`
  - 데미지 체크: `DECK -> flip -> DAMAGE`
  - 리빌 진입/이탈: `REVEALED` enter/exit motion
- 액션 playback 2차
  - `ATTACK`, `BLOCK`, `ACTIVATE`, `PASS`, `NEXT_PHASE` action beat 추가
  - 버튼 local press feedback 추가
  - source/target/action badge 기반 overlay 추가
- 선택/모달 가시성
  - `INTERACTION_FOCUS` beat 추가
  - selection modal preparing 상태 추가
  - revealed/trash/damage/skill/item/zone 선택 순서 badge 추가
- 자동 페이즈
  - 오프라인/온라인 모두 `dispatchEngineAction({ type: 'NEXT_PHASE' })` 경로로 통일
  - 온라인은 host-only safe auto advance 적용
- QA 인프라
  - Vitest 회귀 추가
  - Playwright smoke 추가
  - `js_repl` Playwright interactive로 desktop/mobile live 확인 가능

## 아직 부족하거나 개선이 필요한 지점

### 1. 액션 연출의 시각 강도

- 현재 action overlay는 동작하지만, 실제 대전 화면에서 첫인상 기준으로는 아직 약하게 느껴질 수 있다.
- 특히 `ATTACK`와 `BLOCK`은 카드 간 관계를 더 강하게 보여줘야 한다.
- 다음 강화 후보:
  - 라인 전체가 잠깐 밝아지는 lane flash
  - 공격 방향 화살표/궤적을 더 두껍게 표시
  - 타격 지점에 짧은 impact burst 추가
  - `PASS`는 현재 너무 조용하므로 턴 양보 느낌의 area fade 또는 흐름 이동 연출 필요

### 2. phase 전환의 게임스러운 감각

- 현재 `NEXT_PHASE`는 status/action beat 수준이라 기능은 충분하지만, “진짜 게임처럼 페이즈가 넘어간다”는 체감은 아직 부족하다.
- 다음 강화 후보:
  - phase rail 또는 phase badge 전용 트랙 UI 추가
  - `LEVEL_UP`, `DRAW`, `MAIN`, `ATTACK`, `BLOCK`, `END`별 진입 모션 차등화
  - `DRAW` phase 진입 시 deck pulse와 draw motion 사이의 리듬을 더 명확히 분리

### 3. 선택 UX의 정보 전달

- preparing modal과 focus beat는 들어갔지만, 실제 선택 과정 전체가 충분히 설명적이지는 않다.
- 다음 강화 후보:
  - 선택 가능 후보 외 나머지 영역 dim을 더 강하게 적용
  - 다중 선택에서 남은 선택 수를 modal 상단에 더 크게 표시
  - confirm 직전 선택 후보가 짧게 재강조되는 confirm pulse 추가
  - source card와 결과 target을 연결하는 “이 효과가 무엇을 고르는지” 설명 배지 강화

### 4. 실제 온라인 대전 QA

- 현재 Playwright smoke는 deterministic staging 기준이다.
- 실제 two-client online room flow에 대해 다음 검증이 필요하다.
  - host 턴 자동 phase advance
  - guest 턴 자동 phase advance
  - block/pass/action commit가 양쪽 화면에서 같은 타이밍으로 보이는지
  - hidden info가 focus/action fx로 새지 않는지

### 5. 테스트용 hook 정리

- 현재 `window.__NA_TEST__`는 Playwright staging을 위해 추가되었다.
- 후속으로 아래 중 하나를 결정해야 한다.
  - 개발/테스트 환경에서만 노출
  - production에서도 harmless debug hook로 유지
- 기본 권장 방향은 `import.meta.env.DEV || import.meta.env.MODE === 'test'` 조건 노출이다.

## 다음 구현 권장 순서

### Step 1. 공격/방어/패스 연출 강화

- `ATTACK`, `BLOCK`, `PASS`를 우선 강화한다.
- 이유:
  - 가장 자주 보이는 액션이다.
  - 현재 체감 부족이 가장 크다.
  - 온라인과 오프라인에서 공통적으로 개선 체감이 크다.

구현 후보:

- unit-zone에 lane flash class 추가
- action trail 대비 강화
- impact burst 또는 directional wedge 추가
- `PASS` 전용 area fade / turn handoff glow 추가

### Step 2. phase rail / phase badge 강화

- side rail 또는 top status 영역에 phase progression을 더 명확하게 보이는 전용 UI를 추가한다.
- `NEXT_PHASE` action fx가 이 rail과 연결되도록 바꾼다.

### Step 3. modal/selection 강화

- focus beat 동안 dim 범위를 늘리고, 후보/선택/확정 상태를 더 분리한다.
- 다중 선택 안내와 confirm 직전 재강조를 넣는다.

### Step 4. 실제 온라인 2클라이언트 QA 추가

- Playwright local smoke와 별도로, 실제 room code 기반 host/guest smoke를 만든다.
- 가능하면 relay dev 서버를 띄우고 두 browser context로 host/guest를 동시에 붙인다.

### Step 5. test hook 정리

- `__NA_TEST__` 노출 범위를 정리하고, e2e staging helper를 별도 util로 분리한다.

## 다음 턴에서 바로 확인할 파일

- playback 생성/순서: `src/ui/playbackOrchestrator.ts`
- overlay 및 시각 연출: `src/ui/playbackMotion.ts`
- 게임 화면 anchor/selection 렌더링: `src/ui/screens/gameView.ts`
- 자동 phase 및 입력 흐름: `src/ui/gameLoop.ts`
- 온라인 commit 경로: `src/ui/online/onlineMatchController.ts`
- e2e smoke: `tests/e2e/action_fx_smoke.spec.ts`

## 다음 턴 시작 시 권장 체크리스트

- `npm test`
- `npm run test:e2e:smoke`
- `npm run build`
- 필요 시 `npm run dev -- --port 4174`
- `js_repl` Playwright로 desktop/mobile live 확인

## 주의할 점

- hidden hand / online visibility 규칙은 계속 최우선이다.
- action fx가 카드 정체를 유추하게 만들면 안 된다.
- auto phase는 host-only를 유지해야 한다.
- modal을 늦추더라도 입력이 먹통처럼 느껴지지 않게, preparing copy와 focus beat는 항상 보여야 한다.
