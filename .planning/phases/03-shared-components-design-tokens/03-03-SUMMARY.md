---
phase: 03-shared-components-design-tokens
plan: 03
subsystem: canvas, panels
tags: [component-arguments, argument-resolution, refnode, navigate-to-source, property-panel]

# Dependency graph
requires:
  - phase: 03-shared-components-design-tokens
    plan: 02
    provides: ComponentArgument types, argumentBindings, setArgumentValue/removeArgumentValue store actions, ArgumentSection panel
provides:
  - ArgumentValuesSection component for setting argument values on RefNode instances
  - Argument resolution pipeline in resolveRefs (applyArgumentValues -> remapIds -> resolveVariables)
  - Double-click RefNode navigates to source component page
  - Navigate-to-source button in instance property panel
affects: [03-05, 04-e2e-tests]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Argument resolution pipeline: applyArgumentValues BEFORE remapIds BEFORE variable resolution"
    - "Instance property panel shows ArgumentValuesSection with type-specific inputs"
    - "Double-click on RefNode in canvas navigates to source component page"

key-files:
  created:
    - src/components/panels/argument-values-section.tsx
  modified:
    - src/components/panels/property-panel.tsx
    - src/canvas/skia/skia-engine.ts
    - src/canvas/skia/skia-canvas.tsx

key-decisions:
  - "Navigate-to-source uses page search + setActivePageId + setSelection pattern"
  - "Argument resolution happens BEFORE remapIds using original child IDs"
  - "applyPropertyValue supports deep properties: fill.0.color, stroke.fill.0.color"

patterns-established:
  - "Instance argument values UI: type-specific inputs (text, number, boolean, select, color) with reset-to-default"
  - "Argument resolution order: resolveRefs -> applyArgumentValues -> remapIds -> resolveVariables"
  - "Double-click RefNode detection: check node type BEFORE frame-enter logic"

requirements-completed: [SHARED-07, SHARED-08, SHARED-02, SHARED-04, SHARED-05]

# Metrics
duration: 8min
completed: 2026-03-17
---

# Phase 3 Plan 03: Argument Values UI, Resolution Pipeline & Navigate-to-Source Summary

**ArgumentValuesSection with 5-type inputs, argument resolution in resolveRefs pipeline, double-click and button navigate-to-source for component instances**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-16T17:36:00Z
- **Completed:** 2026-03-16T17:44:04Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- ArgumentValuesSection component with type-specific inputs (text, number, boolean, select, color) and reset-to-default buttons
- Navigate-to-source button (ExternalLink icon) in instance property panel that switches to source component page
- Argument resolution pipeline (applyArgumentValues, applyBindingsToTree, applyPropertyValue) inside resolveRefs
- Resolution order enforced: arguments applied BEFORE remapIds (original child IDs) and BEFORE variable resolution
- Double-click on RefNode instance navigates to source component page instead of entering expanded frame

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ArgumentValuesSection with navigate-to-source button, integrate into property panel** - `1e327bc` (feat)
2. **Task 2: Argument resolution pipeline in resolveRefs and double-click navigate to source** - `cef12f3` (feat)

## Files Created/Modified
- `src/components/panels/argument-values-section.tsx` - New component: argument value inputs for RefNode instances with navigate button
- `src/components/panels/property-panel.tsx` - Added ArgumentValuesSection rendering for instance nodes
- `src/canvas/skia/skia-engine.ts` - Added applyArgumentValues/applyBindingsToTree/applyPropertyValue in resolveRefs pipeline
- `src/canvas/skia/skia-canvas.tsx` - Added double-click RefNode detection and navigate-to-source logic

## Decisions Made
- Used ColorPicker component with `{value, onChange}` prop interface (verified from source)
- Navigate-to-source uses `clearSelection -> exitAllFrames -> setActivePageId -> requestAnimationFrame -> setSelection` sequence
- Double-click RefNode check placed BEFORE frame-enter logic to prevent accidentally entering expanded frame
- applyPropertyValue handles both simple properties (content, visible, opacity, width, height, fontSize, gap, name) and deep properties (fill.0.color, stroke.fill.0.color)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Type casting in applyPropertyValue needed `unknown` intermediary to satisfy strict TypeScript mode (PenNode union type cannot be directly cast to Record<string, unknown>)
- Pre-existing test infrastructure failures (7 errors, unrelated to changes)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Component system fully functional: define arguments on reusable frames, bind to child properties, set values on instances, render differently
- SHARED-02 (instance inclusion), SHARED-04 (source propagation), SHARED-05 (navigate to source), SHARED-07 (set argument values), SHARED-08 (render differently) all satisfied
- Ready for Plan 05 (remaining phase 3 plan) and Phase 4 (E2E Tests & Polish)

---
*Phase: 03-shared-components-design-tokens*
*Completed: 2026-03-17*
