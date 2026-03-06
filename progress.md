Original prompt: [$playwright-interactive](C:\\Users\\DE8PC1\\.codex\\skills\\playwright-interactive\\SKILL.md) 를 사용해서 현재 이 니벨아레나 시뮬레이터를 테스트를 해보자. 직접 이런저런 테스트를 하면서 ui상에서 미리보기가 없어지지 않거나 하는 경우를 찾아서 고치거나, 디버깅 시나리오를 짜봐. 어떻게 하면 좋을까?

2026-03-06
- Active focus: in-game preview and overlay lifecycle only.
- Constraint: current Codex session does not expose `js_repl`, so QA will use local Playwright + browser automation fallback instead of the interactive REPL workflow.
- Baseline before edits:
  - `npm run build` passes.
  - `tests/ui/game_bindings_touch_preview.vitest.test.ts` times out.
  - `tests/ui/game_bindings_zone_overlay_selection.vitest.test.ts` times out.
- Intended QA inventory:
  - Desktop hand hover show/hide.
  - Unit <-> mini-item hover transitions.
  - Trash/damage overlay open, anchor switching, hide cleanup.
  - Mobile long-press preview release/cancel cleanup.
  - Resize/scroll/screen-change dismissal.
- TODO:
  - Diagnose current preview/overlay lifecycle gaps.
  - Add targeted regression tests for dismissal and anchor cleanup.
  - Install Playwright locally and run browser QA fallback.

2026-03-06 update
- Implemented UI lifecycle fixes without touching engine/rules:
  - `src/HoverPreview.ts`
    - global dismiss on `blur`, `resize`, `orientationchange`, `scroll`, `visibilitychange`, `visualViewport.resize`, `visualViewport.scroll`
    - debug state helpers for visibility/card/position
  - `src/TrashHoverOverlay.ts`
    - same global dismiss path
    - active anchor cleanup on switch/hide
    - touch long-press cleanup via pointer capture + window `pointerup`/`pointercancel`/`blur`
    - hover preview cleared when overlay opens/hides
  - `src/ui/screens/gameBindings.ts`
    - touch long-press preview now cleans up even if release happens outside original element
    - mini-item -> unit hover return now restores unit preview immediately
  - `src/ui/screens/gameView.ts`
    - resize/orientation/scroll path hides hover preview and overlay before reflow
  - `src/main.ts`
    - added `window.__naPreviewDebug` QA hooks
    - added `render_game_to_text` and `advanceTime`
    - added `showOverlayFixture`/fixture stats helper for mobile overlay-card QA

- Added/updated regression coverage:
  - `tests/useful/ui/HoverPreview.test.ts`
  - `tests/useful/ui/TrashHoverOverlay.test.ts`
  - `tests/ui/game_bindings_touch_preview.vitest.test.ts`
  - `tests/ui/game_bindings_zone_overlay_selection.vitest.test.ts`
  - `tests/ui/game_view_fit_layout.vitest.test.ts` (timeout stabilization)
  - `tests/ui/game_view_mobile_layout.vitest.test.ts` (timeout stabilization)

- Local Playwright/browser QA fallback completed because this session has no `js_repl`:
  - installed `playwright` locally
  - installed Chromium via `npx playwright install chromium`
  - ran `scripts/qa/preview_overlay_qa.mjs`
  - artifacts saved under `artifacts/preview-overlay-qa/`
  - no console/page errors during desktop/mobile signoff

- Browser signoff covered:
  - desktop hand hover show/hide
  - unit <-> mini-item preview switching and rapid boundary movement
  - trash/damage overlay open/hold/close and anchor switching
  - resize dismissal
  - screen transition dismissal
  - mobile tap vs long-press on hand
  - mobile long-press on mini-item
  - mobile overlay-card long-press, outside release, single-click suppression, contextmenu prevention

- Relevant gate results:
  - `npx vitest run tests/useful/ui/HoverPreview.test.ts tests/useful/ui/TrashHoverOverlay.test.ts tests/ui/game_bindings_touch_preview.vitest.test.ts tests/ui/game_bindings_zone_overlay_selection.vitest.test.ts` -> pass
  - `npx vitest run tests/ui/game_view_fit_layout.vitest.test.ts tests/ui/game_view_mobile_layout.vitest.test.ts` -> pass
  - `npx vitest run tests/ui/cards/bt01_representative_click.vitest.test.ts tests/ui/cards/bt02_representative_click.vitest.test.ts` -> pass
  - `npm run build` -> pass

- Remaining note:
  - If a future session enables `js_repl`, the same scenarios can be re-run interactively with `$playwright-interactive`, but this pass already has reproducible local Playwright coverage and screenshots.
