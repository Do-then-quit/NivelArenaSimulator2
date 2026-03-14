Original prompt: BT05의 unifiedtest를 BT04의 테스트를 참고해서 저렇게 만들어주고, 그걸 최종적으로는 playwright로 테스트하라는 뜻이었어.

2026-03-08
- Follow-up request: expose BT05 pack cards in the deck builder.
- Initial finding: `CardDatabase` already includes BT05, but `src/logic/DeckBuilderCardPool.ts` does not allow the `BT05` prefix, so the deck builder filters/pool omit the pack entirely.
- Plan: add BT05 to the deck-builder allow list, extend deck-builder domain/UI tests, then verify with targeted tests and a browser check.
- Implemented: added `BT05` to `DECK_BUILDER_ALLOWED_PACKS`.
- Implemented: updated deck-builder domain expectations and added UI checks that `BT05` appears in desktop/mobile pack filters.
- Verified: `npx vitest run tests/useful/domain/DeckBuilderCardPool.vitest.test.ts tests/ui/deck_builder_mobile_layout.vitest.test.ts tests/ui/deck_builder_mobile_interaction.vitest.test.ts` passed (`14` tests).
- Verified in browser: opened deck builder, selected `BT05`, confirmed the pack option exists and the visible library rows start with `BT05-001` through `BT05-012`.
- Note: the shared `develop-web-game` Playwright client could not resolve `playwright` from the skill directory in this session, so browser verification used the repository's local Playwright dependency instead.
- Follow-up request: also expose `ST07` and `ST09` in deck-builder filters.
- Initial finding: `ST07` and `ST09` were missing from the same `DECK_BUILDER_ALLOWED_PACKS` array, so they were excluded from the deck-builder card pool and pack dropdowns.
- Implemented: added `ST07` and `ST09` to `DECK_BUILDER_ALLOWED_PACKS`.
- Implemented: widened deck-builder tests so desktop/mobile filters assert `ST07` and `ST09` options are present.
- Verified: reran the deck-builder Vitest subset and it passed (`14` tests).
- Verified in browser: selected `ST07` and `ST09` in the pack filter and confirmed the visible card rows switch to `ST07-*` and `ST09-*` entries.
- Follow-up request: fill missing `BT05` image files for deck builder rendering.
- Root cause confirmed: local assets for `BT05-001.jpg` through `BT05-018.jpg` were missing while `CardDatabase` still referenced `/assets/cards/${raw.id}.jpg` for every card.
- Implemented: downloaded the missing 18 BT05 images from the per-card `imageUrl` fields already stored in `packs/BT05.json`.
- Verified: local BT05 asset scan now reports `missingCount: 0`, and browser checks show `BT05-001` through `BT05-006` loading with non-zero `naturalWidth`/`naturalHeight`.

2026-03-14
- Follow-up request: expose `Custom vs Selected Bot` so a human can directly play against non-baseline bot profiles.
- Initial finding: menu/setup flow only exposed `Custom vs Baseline Bot`, while UI bot registry already knew `practice-bt05-nikki-strong-v1`.
- Implemented: added bot model selection to `SetupUI` for human-vs-bot setup, including live title/header updates and preserved hand-visibility choice.
- Implemented: added `createHumanVsBotConfig` helper and changed the menu button label to `Custom vs Selected Bot`.
- Added UI regression test `tests/ui/setup_bot_model_selection.vitest.test.ts` for selector visibility and pending-config updates.
- Verified: `npx vitest run tests/ui/setup_bot_model_selection.vitest.test.ts tests/ui/main_screen_routing.vitest.test.ts tests/ui/replay_setup_state_transitions.vitest.test.ts` passed (`6` tests).
- Verified: `npx tsc --noEmit --pretty false --incremental false` passed.
- Verified in browser: menu showed `Custom vs Selected Bot`, setup displayed opponent bot dropdown with `Practice BT05 Nikki Strong v1`, switching the model updated the setup title/header, and with temporary localStorage decks the flow reached the game screen in `HUMAN vs Practice BT05 Nikki Strong v1` mode without console errors.
