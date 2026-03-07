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
  - `ATTACK`, `BLOCK`, `PASS` 연출 강화
    - 더 두꺼운 trail
    - 방향 arrowhead
    - target impact burst
    - zone/player-area kind-specific 강조
  - `PASS`의 lane handoff target 연결
  - action/focus highlight class cleanup 정리
- 유지형 presentation 3차
  - `activeActionPresentation` 상태 추가
  - beat 동안 lane/phase 의미를 DOM 상태로 유지
  - `NEXT_PHASE` 전용 phase rail 추가
  - `ATTACK`/`BLOCK`/`PASS`의 source/target lane hold highlight 추가
- motion target suppress
  - damage reveal / draw / reveal enter-exit에서 target 카드가 DOM에 먼저 나타나던 중복 표시 수정
  - active motion 동안 target card는 placeholder만 유지하고 시각적으로 숨김
  - damage summary count도 motion 중에는 이전 count 기준으로 유지
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

- 2026-03-07 기준 `ATTACK`/`BLOCK`/`PASS`의 기본 강화는 적용되었다.
- 현재 남은 쟁점은 “더 보이게”가 아니라 “강도 균형 조정”이다.
- 특히 `PASS`와 `BLOCK`은 장면 전체가 조금 과하게 물드는지 한 번 더 조정할 여지가 있다.
- 다음 미세조정 후보:
  - `PASS` source player-area glow 범위를 조금 줄이기
  - `BLOCK`/`PASS` wash opacity를 낮추고 contrast는 유지하기
  - arrowhead 크기를 lane 길이에 비례해 조금 더 작게 clamp하기
  - lane 전체 flash를 별도 overlay로 분리할지 검토하기

### 2. phase 전환의 게임스러운 감각

- 2026-03-07 기준 phase rail은 추가되었고, `NEXT_PHASE`는 버튼 flash보다 rail/source/target hold 중심으로 바뀌었다.
- 현재 남은 것은 rail 자체의 polish다.
- 다음 강화 후보:
  - rail source -> target sweep overlay 추가
  - `DRAW` 진입 시 rail hold 다음 beat로 deck pulse / draw motion 리듬을 더 분명하게 분리
  - current phase / next phase / auto advance 상태를 더 또렷하게 분리
  - 모바일 rail 레이아웃 미세조정

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

- 완료. 다음 턴에는 미세조정만 남아 있다.

적용된 항목:

- unit-zone / player-area kind-specific highlight
- action trail 대비 강화
- target impact burst
- directional arrowhead
- `PASS` lane handoff 연결

남은 후보:

- `PASS` area tint 범위/opacity 미세조정
- lane flash를 element class가 아니라 전용 overlay로 분리할지 판단

### Step 2. phase rail / phase badge 강화

- 1차 완료.

적용된 항목:

- side rail phase progression UI 추가
- 모바일 compact rail 추가
- `NEXT_PHASE`가 current/target phase chip과 status panel에 hold state를 남김

남은 후보:

- chip 간 sweep motion
- auto phase actor와 rail 관계를 더 직관적으로 보이게 표시
- `DRAW` beat와 rail beat 사이 리듬 분리

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
