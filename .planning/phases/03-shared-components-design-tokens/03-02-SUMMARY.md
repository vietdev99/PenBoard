---
phase: 03-shared-components-design-tokens
plan: 02
subsystem: panels
tags: [react, zustand, skia, component-arguments, drag-connect, property-panel]

# Dependency graph
requires:
  - phase: 03-shared-components-design-tokens
    provides: ComponentArgument types, FrameNode arguments/argumentBindings, document-store-components CRUD actions, component badge
provides:
  - ArgumentSection property panel component for defining component arguments
  - DragConnectOverlay SVG wire for binding arguments to canvas elements
  - dragConnectState in canvas-store for cross-panel-canvas communication
  - BINDABLE_PROPERTIES whitelist for type-safe argument bindings
affects: [03-shared-components-design-tokens, instance-overrides, design-tokens]

# Tech tracking
tech-stack:
  added: []
  patterns: [drag-connect-overlay, cross-panel-canvas-binding, per-type-default-value-editors]

key-files:
  created:
    - src/components/panels/argument-section.tsx
  modified:
    - src/components/panels/property-panel.tsx
    - src/stores/canvas-store.ts
    - src/canvas/skia/skia-canvas.tsx

key-decisions:
  - "SVG overlay for drag-connect wire (bridges DOM property panel and SkiaCanvas coordinate spaces)"
  - "DragConnectOverlay as separate component (owns its own mouse tracking, avoids polluting main event loop)"
  - "BINDABLE_PROPERTIES whitelist approach per argument type for type-safe bindings"

patterns-established:
  - "DragConnectOverlay pattern: separate React component for cross-panel-canvas interactions using global mouse listeners"
  - "Per-type default value editors: Switch for boolean, NumberInput for number, color input for color, text input for text/select"

requirements-completed: [SHARED-06]

# Metrics
duration: 8min
completed: 2026-03-16
---

# Phase 3 Plan 02: Component Argument UI & Drag-Connect Binding Summary

**ArgumentSection panel with 5-type argument CRUD and SVG drag-connect wire for binding arguments to canvas elements**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-16T17:23:39Z
- **Completed:** 2026-03-16T17:31:51Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- ArgumentSection component renders in property panel for reusable frames with full CRUD for 5 argument types
- Drag-connect wire overlay bridges property panel DOM and SkiaCanvas with hit-test-based binding creation
- Per-type default value editors (text input, number input, boolean switch, comma-separated select options, color picker)
- Binding display with target node name resolution and inline unbind button

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ArgumentSection component** - `c3ddef8` (feat)
2. **Task 2: Drag-connect wire and canvas drop target** - `7ff7a76` (feat)

## Files Created/Modified
- `src/components/panels/argument-section.tsx` - ArgumentSection component with argument rows, default value editors, binding display, drag handle
- `src/components/panels/property-panel.tsx` - Conditionally renders ArgumentSection for reusable frames
- `src/stores/canvas-store.ts` - DragConnectState type and dragConnectState/setDragConnectState state+action
- `src/canvas/skia/skia-canvas.tsx` - DragConnectOverlay component (SVG wire), getDefaultBindingProperty helper, mouseMove/mouseUp guards

## Decisions Made
- Used SVG overlay for drag-connect wire instead of CanvasKit drawing because it bridges DOM (panel) and canvas coordinate spaces naturally
- Implemented DragConnectOverlay as a separate React component with its own global mouse listeners to keep main canvas event loop clean
- Used BINDABLE_PROPERTIES whitelist per argument type for safety (text->content/name, number->width/height/opacity/fontSize/gap, etc.)
- Strip virtual ID prefix (split '__') before storing binding to ensure original child IDs are persisted

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed hitTest method access on SkiaEngine**
- **Found during:** Task 2 (DragConnectOverlay)
- **Issue:** Plan referenced `engine.hitTest()` but SkiaEngine exposes `engine.spatialIndex.hitTest()` returning RenderNode[]
- **Fix:** Changed to `engine.spatialIndex.hitTest(scene.x, scene.y)` and pick last hit (topmost node)
- **Files modified:** src/canvas/skia/skia-canvas.tsx
- **Verification:** tsc --noEmit passes with 0 errors
- **Committed in:** 7ff7a76 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Trivial API access correction. No scope creep.

## Issues Encountered
- Pre-existing tsc errors in size-section.tsx (unrelated to our changes, cleared on rerun)
- Pre-existing test infrastructure issue (Nitro vite pipe ENOENT) - tests have no actual test cases, all failures are infrastructure

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Argument definition and binding creation complete for component creators
- Ready for Plan 03 (Instance Overrides) which will consume these bindings at instance level
- Plans 04-05 (Design Tokens) can proceed independently

---

## Self-Check: PASSED

- All 4 created/modified files verified on disk
- Both task commits (c3ddef8, 7ff7a76) verified in git log
- tsc --noEmit exits 0

---
*Phase: 03-shared-components-design-tokens*
*Completed: 2026-03-16*
