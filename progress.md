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
