---
phase: 02-storyboard-data
plan: 01
subsystem: store, types, ui, canvas
tags: [zustand, connections, skia, property-panel, i18n, tdd]

# Dependency graph
requires:
  - phase: 01-clone-rebrand-verify
    provides: PenBoard branding, PenDocument/PenPage types, document-store, skia-engine
provides:
  - ScreenConnection interface and CRUD store actions
  - DataEntity/DataField/DataRow/DataView/DataFilter/DataSort types
  - PenPage.type ('screen'|'erd') for page categorization
  - PenDocument.connections and PenDocument.dataEntities optional fields
  - ConnectionSection property panel component
  - drawConnectionBadge canvas overlay
  - Phase 2 canvas constants (connection badge, ERD node colors)
  - All i18n keys for connections and data entities (15 locales)
  - shadcn Input component
affects: [02-02, 03-shared-components, 04-e2e-tests]

# Tech tracking
tech-stack:
  added: [shadcn/input]
  patterns: [createConnectionActions extracted pattern, connection cascade on delete]

key-files:
  created:
    - src/types/data-entity.ts
    - src/stores/document-store-connections.ts
    - src/components/panels/connection-section.tsx
    - src/components/ui/input.tsx
    - src/__tests__/connections/connection-store.test.ts
  modified:
    - src/types/pen.ts
    - src/stores/document-store.ts
    - src/stores/document-store-pages.ts
    - src/canvas/canvas-constants.ts
    - src/canvas/skia/skia-overlays.ts
    - src/canvas/skia/skia-renderer.ts
    - src/canvas/skia/skia-engine.ts
    - src/components/panels/property-panel.tsx
    - src/utils/normalize-pen-file.ts
    - src/i18n/locales/en.ts (+ 14 other locales)

key-decisions:
  - "ScreenConnection stored at document level (PenDocument.connections[]), not on individual nodes"
  - "Connection cascade: removing a node or page also removes related connections"
  - "ERD pages excluded from connection section and badge rendering"
  - "shadcn Input component added for label editing (also used by future data entity features)"

patterns-established:
  - "createConnectionActions follows createPageActions pattern: extracted action creators with set/get"
  - "Connection badges rendered in overlay pass after agent indicators, before hover outline"
  - "Page type discrimination: PenPage.type defaults to 'screen' when undefined"

requirements-completed: [CONN-01, CONN-02, CONN-03, CONN-04, CONN-05]

# Metrics
duration: 10min
completed: 2026-03-16
---

# Phase 2 Plan 01: Screen Connections Summary

**Screen connection CRUD with property panel UI, canvas badge overlay, and Phase 2 shared types (DataEntity, ScreenConnection)**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-16T14:04:32Z
- **Completed:** 2026-03-16T14:14:12Z
- **Tasks:** 2
- **Files modified:** 29

## Accomplishments
- Full connection workflow: select element, add connection via "Navigate to" dropdown, configure trigger/transition, optional label
- Green badge (16px emerald circle with arrow icon) renders at top-right of connected elements on canvas
- All Phase 2 shared types defined (ScreenConnection, DataEntity, DataField, DataRow, DataView, DataFilter, DataSort)
- 15 unit tests for connection store CRUD with TDD workflow (RED-GREEN)
- Backward-compatible: old .pb files without connections load without errors
- Undo/redo support for all connection operations via history store integration

## Task Commits

Each task was committed atomically:

1. **Task 1 (TDD RED): Failing connection store tests** - `8fd1b43` (test)
2. **Task 1 (TDD GREEN): Phase 2 types, connection store, i18n** - `619d74d` (feat)
3. **Task 2: Connection section UI and canvas badge overlay** - `833585b` (feat)

_Note: Task 1 used TDD: test commit first (RED), then implementation commit (GREEN)_

## Files Created/Modified
- `src/types/pen.ts` - Added ScreenConnection interface, PenPage.type, PenDocument.connections/dataEntities
- `src/types/data-entity.ts` - NEW: DataEntity, DataField, DataRow, DataView, DataFilter, DataSort types
- `src/stores/document-store-connections.ts` - NEW: createConnectionActions (add/remove/update + getters)
- `src/stores/document-store.ts` - Merged connection actions, cascade on removeNode
- `src/stores/document-store-pages.ts` - Cascade connection removal on removePage
- `src/canvas/canvas-constants.ts` - Phase 2 semantic colors (connection badge, ERD nodes)
- `src/canvas/skia/skia-overlays.ts` - drawConnectionBadge function
- `src/canvas/skia/skia-renderer.ts` - drawConnectionBadge wrapper method
- `src/canvas/skia/skia-engine.ts` - Connection badge rendering in overlay pass
- `src/components/panels/connection-section.tsx` - NEW: ConnectionSection with target picker, trigger/transition selects, label input
- `src/components/panels/property-panel.tsx` - Wire ConnectionSection after EffectsSection
- `src/components/ui/input.tsx` - NEW: shadcn Input component
- `src/utils/normalize-pen-file.ts` - Backward-compat comment for connections/dataEntities
- `src/i18n/locales/en.ts` - All connection + data entity i18n keys
- `src/i18n/locales/{de,es,fr,hi,id,ja,ko,pt,ru,th,tr,vi,zh-tw,zh}.ts` - English fallback keys
- `src/__tests__/connections/connection-store.test.ts` - NEW: 15 unit tests

## Decisions Made
- ScreenConnection stored at document level (`PenDocument.connections[]`), not embedded in nodes, for easier querying and cascade deletion
- Connection cascade on node/page delete ensures data integrity without orphaned connections
- ERD pages excluded from connection UI and badge rendering (connections are screen-to-screen only)
- shadcn Input component installed for label editing, reusable across future features

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added i18n keys to all 14 non-English locale files**
- **Found during:** Task 1 (i18n keys)
- **Issue:** TypeScript's TranslationKeys type requires all locale files to have the same keys. Adding keys only to en.ts caused 14 type errors.
- **Fix:** Added English fallback keys to all 14 locale files (de, es, fr, hi, id, ja, ko, pt, ru, th, tr, vi, zh-tw, zh)
- **Files modified:** 14 locale files in src/i18n/locales/
- **Verification:** `tsc --noEmit` passes with 0 errors
- **Committed in:** 619d74d (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary for TypeScript compilation. No scope creep.

## Issues Encountered
None - plan executed smoothly.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Connection types and store are ready for Plan 02 (Data Entities & ERD)
- DataEntity types already defined and exported, ready for Plan 02 CRUD implementation
- PenPage.type field supports 'erd' pages for ERD visualization
- ERD canvas constants (colors) already defined for Plan 02 renderer

## Self-Check: PASSED

- All 14 key files verified present
- All 3 task commits verified in git log (8fd1b43, 619d74d, 833585b)
- TypeScript: 0 errors
- Tests: 58 passing (15 connection-specific)

---
*Phase: 02-storyboard-data*
*Completed: 2026-03-16*
