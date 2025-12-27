# Plan: Card Hover Preview UI

## Phase 1: Infrastructure and Basic Component [checkpoint: fc7be29]
- [x] Task: Create `HoverPreview` component structure and styling (Floating Tooltip). 8a505e1
- [x] Task: Implement logic to calculate tooltip position based on mouse coordinates. 8a505e1
- [x] Task: Create a mock preview data structure for testing. 8a505e1
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Infrastructure and Basic Component' (Protocol in workflow.md)

## Phase 2: Data Binding and Content
- [x] Task: Implement `CardPreview` component to render enlarged image, stats, effect text, and keywords. c4318e6
- [x] Task: Integrate `CardDatabase` to fetch full card details for a given card ID. c4318e6
- [x] Task: Add keyword parsing logic to highlight traits in the effect text. c4318e6
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Data Binding and Content' (Protocol in workflow.md)

## Phase 3: Event Integration (Hand & Unit Zone)
- [ ] Task: Attach `mouseenter` and `mouseleave` listeners to cards in the `Hand`.
- [ ] Task: Attach `mouseenter` and `mouseleave` listeners to units in the `Unit Zone`.
- [ ] Task: Implement global `HoverManager` to handle the state of the active preview.
- [ ] Task: Ensure preview disappears instantly on `mouseleave`.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Event Integration (Hand & Unit Zone)' (Protocol in workflow.md)

## Phase 4: Polish and Verification
- [ ] Task: Refine tooltip positioning to avoid screen edge clipping.
- [ ] Task: Perform manual verification of tooltip behavior on various screen sizes.
- [ ] Task: Final regression testing and code cleanup.
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Polish and Verification' (Protocol in workflow.md)
