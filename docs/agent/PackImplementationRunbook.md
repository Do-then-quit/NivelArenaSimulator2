# Pack Implementation Runbook

## 목적
- 카드 팩 전체 구현을 한 번에 요청할 때, 중간 추가 요구 없이도 같은 품질 기준으로 끝까지 실행되게 만드는 운영 문서다.
- 범위는 `팩 효과 구현 + unified 시나리오 + Card Logic Verification row 분리 + 대표 UI 클릭 테스트 + Playwright 실제 replay 검증 + Deck Builder 노출`까지다.

## 복붙용 원샷 프롬프트
```text
Implement the full <PACK_ID> pack in NivelArenaSimulator2 and do not stop at partial analysis. Follow AGENTS.md, docs/agent/Workflow.md, and docs/agent/PackImplementationRunbook.md.

Requirements:
1. Use NivelArena_Comprehensive_Rules_Ver.2.0.pdf and card text as the source of truth.
2. Split the pack into batches of 4-6 cards and do not move to the next batch until the current batch gate passes.
3. For every card effect, add a unified scenario test in src/logic/cardTests/shared/<PACK_ID>.ts.
4. Card Logic Verification must expose each unified scenario as a separate row, even when one card has multiple effects. Use slightly different display names so each row is distinguishable.
5. Add or update:
   - src/logic/cardEffects/<pack>.ts
   - src/logic/cardTests/shared/<PACK_ID>.ts
   - tests/cards/<pack>/<pack>_unified.test.ts
   - tests/cards/<pack>/<pack>_effects_regression.test.ts
   - tests/ui/cards/<pack>_representative_click.vitest.test.ts
   - registry / CardDatabase wiring
6. If engine support is missing, extend the engine first, but keep changes minimal and rule-driven.
7. Do not expose the pack in Deck Builder until the full pack is green.
8. After full implementation, enable Deck Builder and add related tests.
9. Use playwright-interactive for final browser QA.
10. Final browser QA must do more than press the Play button:
   - open Card Logic Verification
   - filter to <PACK_ID>
   - confirm the expected number of rows
   - for every row, press Play
   - replay the scenario with actual browser interactions where the UI supports it
   - verify the resulting game state matches the recorded expected final state
   - if the verification UI cannot express a required action or effect index, patch the UI so the scenario becomes replayable, then rerun
11. Capture screenshot evidence and report exact commands plus pass/fail counts.

Per-batch gate:
- npx vitest run tests/cards/<pack>/
- npx vitest run tests/ui/cards/<pack>_representative_click.vitest.test.ts
- run touched rules_v2 regressions

Final gate:
- npm test
- final Playwright row-by-row replay verification

Deliver:
- concise summary of implementation changes
- test commands and results
- Playwright verification result with row count
- screenshot paths
```

## 실행 규칙
1. 먼저 팩 구현 계획을 카드 기믹 기준으로 배치화한다.
2. 각 배치마다 `shared/<PACK>.ts`에 실패 테스트를 먼저 추가한다.
3. unified 시나리오는 카드 단위가 아니라 효과 단위로 나눈다.
4. Card Logic Verification display name은 `BT04-001 · 레테 각성`처럼 카드 ID와 시나리오명을 같이 노출한다.
5. 다중 액티브 카드가 있으면 verification UI가 effect index별로 정확히 재생 가능해야 한다.
6. 일반 UI가 특정 시나리오 입력을 표현하지 못하면, verifier 스크립트를 우회 호출로 때우기 전에 verification UI부터 보강한다.
7. Playwright 검증은 row를 여는 것에서 끝내지 말고, 실제 입력 replay와 최종 상태 비교까지 한다.
8. 시나리오 내부에 숨은 상태 준비가 있으면 recorded pre/post state를 이용해 replay 가능하게 만든다.

## 구현 체크리스트
- 팩 effect module 추가
- shared unified scenario module 추가
- unified runner / regression test 추가
- representative click test 추가
- registry / CardDatabase 연결
- 필요 엔진 확장 추가
- Card Logic Verification row 분리 확인
- Deck Builder 노출은 전체 완료 후 반영
- 최종 Playwright replay verifier 추가 또는 갱신

## Playwright 체크리스트
- dev server를 persistent TTY로 띄운다.
- Card Logic Verification에서 대상 팩만 선택한다.
- row 개수가 기대값과 같은지 확인한다.
- 각 row에서 `Play` 후 다음 입력을 실제 UI로 재생한다.
  - `drag/drop` for `PLAY_UNIT`, `PLAY_SKILL`, `PLAY_ITEM`
  - `Active` buttons for leader / unit / item effect index
  - optional / cost / target / confirm / block buttons
- 각 row 종료 후 최종 상태를 recorded expected state와 비교한다.
- 실패 시 첫 row와 diff path를 출력하고, 그 지점부터 재실행 가능한 스크립트 옵션을 둔다.

## 권장 스크립트 인터페이스
- 파일: `scripts/qa/verify_<pack>_play_rows.ts`
- 환경변수:
  - `TARGET_URL`
  - `START_INDEX`

예시:
```bash
TARGET_URL=http://127.0.0.1:5173 START_INDEX=1 npx tsx scripts/qa/verify_bt04_play_rows.ts
```

## 완료 기준
- unified 시나리오가 모든 effect index를 커버한다.
- Card Logic Verification에 effect 단위 row가 전부 노출된다.
- 대표 UI 클릭 Vitest가 통과한다.
- 최종 Playwright replay verification이 전 row `PASS`다.
- Deck Builder 노출과 관련 테스트가 완료된다.
