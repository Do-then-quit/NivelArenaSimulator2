Original prompt: 현재 대전중에 너무 효과들이 확확 지나가서 보기 어렵다는 이야기가 있었어. 특히 데미지를 체크할때 어떤 카드가 나왔는지 알기가 어렵고 현재 각 효과 처리 사이에 딜레이를 주기는 했는데 어쨋든 툭툭 끊어져서 진행되니까 보기가 어렵나봐. 애니메이션을 주는게 어떤가 싶네. 드로우 할때나, 데미지 체크할때도 한장씩 진짜 덱에서 카드가 뒤집어져서 공개가 되고 데미지존으로 이동하거나 효과를 처리할떄도 다 애니메이션을 넣어서 카드들의 이동을 표현하는게 어떤가 싶네. attack, block, pass, activate같은 것들도 버튼을 눌렀을떄 애니메이션이 나와서 스르륵 움직이면 더 보기가 좋지 않을까?

- 2026-03-06: Started phase 1 implementation for card-motion playback overlay.
- 2026-03-06: Scope fixed to draw, damage reveal, revealed entry/exit, settings persistence, and DOM anchor contract.
- 2026-03-06: Added playback motion registry/overlay, DOM motion anchors, animation toggle persistence, and animation-aware modal gating.
- 2026-03-06: Added playback regression tests for draw/damage/revealed motion beats, animation-off flush, modal delay bypass, and anchor attributes.
- 2026-03-06: Verified with targeted UI suites, `npm run build`, and full `npm test` (114 files, 966 passed, 1 skipped).
- 2026-03-06: Playwright skill client could not be executed in this environment because the bundled skill script resolves `playwright` from its own external path and no compatible package was available there.
