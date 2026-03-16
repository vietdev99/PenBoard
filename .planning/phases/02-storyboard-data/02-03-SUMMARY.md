---
phase: 02-storyboard-data
plan: 03
subsystem: canvas, store, panels
tags: [connections, targetFrameId, skia, zustand, page-frame-picker]

# Dependency graph
requires:
  - phase: 02-storyboard-data/02-01
    provides: ScreenConnection type, connection CRUD store, connection-section UI, canvas badge
  - phase: 02-storyboard-data/02-02
    provides: Data entities, ERD page type
provides:
  - ScreenConnection.targetFrameId for frame-level connection targeting
  - Page > Frame grouped picker in connection section
  - Same-page connections support
  - Canvas badge with target frame name label
affects: [03-shared-components, overview-canvas]

# Tech tracking
tech-stack:
  added: []
  patterns: [grouped-select-picker, connInfoMap-pattern]

key-files:
  created: []
  modified:
    - src/types/pen.ts
    - src/stores/document-store-connections.ts
    - src/components/panels/connection-section.tsx
    - src/canvas/skia/skia-overlays.ts
    - src/canvas/skia/skia-renderer.ts
    - src/canvas/skia/skia-engine.ts
    - src/__tests__/connections/connection-store.test.ts
    - src/components/ui/select.tsx
    - src/i18n/locales/*.ts (15 files)

key-decisions:
  - "Use SelectGroup + SelectLabel from Radix for Page > Frame hierarchy"
  - "Value format pageId::frameId with split on '::' for combined select value"
  - "connInfoMap replaces simple count map to carry target name to badge renderer"

patterns-established:
  - "Grouped select pattern: SelectGroup + SelectLabel + indented SelectItems for hierarchical pickers"

requirements-completed: [CONN-01, CONN-02, CONN-05]

# Metrics
duration: 6min
completed: 2026-03-16
---

# Phase 2 Plan 03: Connection Gap Closure Summary

**Page > Frame connection targeting with same-page support and canvas badge showing target frame name**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-16T15:18:47Z
- **Completed:** 2026-03-16T15:25:04Z
- **Tasks:** 2
- **Files modified:** 22

## Accomplishments
- ScreenConnection now supports optional targetFrameId for frame-level targeting within pages
- Connection picker rebuilt as grouped Page > Frame hierarchy (no more same-page filter)
- ConnectionRow displays "Page > Frame" format when targetFrameId is set
- Canvas connection badge shows target frame/page name in dark pill label next to green circle
- 5 new unit tests covering targetFrameId storage, same-page connections, backward compatibility
- All 15 locale files updated with new i18n keys
- SelectLabel exported from shadcn Select component for reuse

## Task Commits

Each task was committed atomically:

1. **Task 1: Add targetFrameId and rebuild Page > Frame picker** - `2aacf03` (feat)
2. **Task 2: Enhance connection badge to show target frame name** - `7860ccf` (feat)

## Files Created/Modified
- `src/types/pen.ts` - Added targetFrameId optional field to ScreenConnection
- `src/stores/document-store-connections.ts` - No changes needed (spread operators handle new field)
- `src/components/panels/connection-section.tsx` - Rebuilt with Page > Frame grouped picker, getTargetDisplayName
- `src/canvas/skia/skia-overlays.ts` - drawConnectionBadge accepts targetName, draws dark pill label
- `src/canvas/skia/skia-renderer.ts` - Wrapper passes targetName through
- `src/canvas/skia/skia-engine.ts` - connInfoMap with target name resolution replaces simple count map
- `src/__tests__/connections/connection-store.test.ts` - 5 new tests for targetFrameId and same-page
- `src/components/ui/select.tsx` - Added SelectLabel export
- `src/i18n/locales/*.ts` - Added connection.selectTarget and connection.pageOnly keys (15 files)

## Decisions Made
- Used `pageId::frameId` format for combined select value with split on '::' separator
- Reused Radix SelectGroup + SelectLabel for hierarchical picker (no custom component needed)
- connInfoMap carries both count and targetName to avoid double-lookup in badge rendering

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `bun --bun vitest run` fails on Windows due to Nitro pipe socket issue; used `npx vitest run` instead (pre-existing issue, not related to this plan)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 2 gap closure complete, all 3 verification issues resolved
- Connection system now supports frame-level targeting and same-page connections
- Ready for Phase 3 (Shared Components & Design Tokens)

---
*Phase: 02-storyboard-data*
*Completed: 2026-03-16*
