---
phase: 02-storyboard-data
plan: 02
subsystem: store, ui, canvas, types
tags: [zustand, data-entities, erd, notion-table, skia, tdd, shadcn, dropdown-menu, dialog, badge, popover]

# Dependency graph
requires:
  - phase: 01-clone-rebrand-verify
    provides: PenBoard branding, PenDocument/PenPage types, document-store, skia-engine, canvas-constants
  - phase: 02-storyboard-data plan 01
    provides: DataEntity/DataField/DataRow/DataView types, PenPage.type, ERD canvas constants, createConnectionActions pattern
provides:
  - Data entity CRUD store actions (createDataActions) with undo support
  - applyFilters and applySorts pure utility functions
  - Data panel floating UI (entity tabs, field management, Notion-like table)
  - DataFieldRow component with type-specific editors and PK/FK badges
  - DataEntityTable Notion-like inline-editable table component
  - DataViewControls with filter/sort configuration
  - SkiaErdRenderer for ERD page visualization (table nodes, relation edges, cardinality markers)
  - ERD page interaction (click select, drag reposition, double-click to data panel)
  - ERD hit testing and auto-layout grid functions
  - Database toolbar button and Ctrl+Shift+D shortcut
  - addPage with optional 'erd' type parameter
  - shadcn dropdown-menu, dialog, badge, popover components
affects: [03-shared-components, 04-e2e-tests]

# Tech tracking
tech-stack:
  added: [shadcn/dropdown-menu, shadcn/dialog, shadcn/badge, shadcn/popover]
  patterns: [createDataActions extracted pattern, ERD page renderer delegation, Notion-like inline table editing, debounced cell updates]

key-files:
  created:
    - src/stores/document-store-data.ts
    - src/components/panels/data-panel.tsx
    - src/components/panels/data-entity-table.tsx
    - src/components/panels/data-field-row.tsx
    - src/components/panels/data-view-controls.tsx
    - src/canvas/skia/skia-erd-renderer.ts
    - src/__tests__/data-entities/data-store.test.ts
    - src/__tests__/data-entities/erd-renderer.test.ts
    - src/components/ui/dropdown-menu.tsx
    - src/components/ui/dialog.tsx
    - src/components/ui/badge.tsx
    - src/components/ui/popover.tsx
  modified:
    - src/stores/document-store.ts
    - src/stores/document-store-pages.ts
    - src/stores/canvas-store.ts
    - src/canvas/skia/skia-engine.ts
    - src/canvas/skia/skia-canvas.tsx
    - src/components/editor/editor-layout.tsx
    - src/components/editor/page-tabs.tsx
    - src/components/editor/toolbar.tsx
    - src/types/data-entity.ts

key-decisions:
  - "Data entity actions follow createDataActions pattern (same as connections and pages)"
  - "ERD page rendering delegated to SkiaErdRenderer class, skipping normal node flattening"
  - "Notion-like table uses debounced cell updates (300ms) for performance"
  - "ERD auto-layout grid: 250px horizontal, 300px vertical spacing, max 3 per row"
  - "Drawing tools disabled on ERD page (select and hand only)"

patterns-established:
  - "createDataActions follows createPageActions/createConnectionActions pattern: extracted action creators with set/get"
  - "SkiaErdRenderer is a dedicated renderer class instantiated by SkiaEngine for ERD page type"
  - "ERD hit testing exported as pure function for unit testability"
  - "Floating data panel follows variables-panel.tsx pattern: absolute positioned, resizable, backdrop-blur"

requirements-completed: [DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, ERD-01, ERD-02, ERD-03, ERD-04]

# Metrics
duration: ~20min
completed: 2026-03-16
---

# Phase 2 Plan 02: Data Entities & ERD Summary

**Notion-like data entity CRUD with typed fields, sample data rows, filter/sort views, and ERD page visualization with draggable table nodes and relation edges**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-03-16T14:14:12Z
- **Completed:** 2026-03-16T14:34:00Z
- **Tasks:** 5 (4 auto + 1 human-verify checkpoint)
- **Files modified:** 23

## Accomplishments
- Full data entity lifecycle: create tables, add typed fields (9 types including relations), enter sample data rows, define views with filter/sort
- Notion-like inline-editable table with Tab/Enter/Escape navigation, debounced cell updates, type-specific editors
- ERD page type with SkiaErdRenderer: blue header, field rows with PK/FK badges, relation edges with cardinality markers (1:1, 1:N, N:M)
- ERD interaction: click to select, drag to reposition (persisted in erdPosition), double-click to open data panel for that entity
- Data panel floating UI following variables-panel pattern: entity tabs, field list, type selectors, PK toggle
- TDD workflow for data store: 17+ unit tests covering CRUD, cascade, filter/sort, undo
- ERD hit test and auto-layout unit tests for pure logic functions
- 4 shadcn components installed (dropdown-menu, dialog, badge, popover)

## Task Commits

Each task was committed atomically:

1. **Task 1 (TDD RED): Failing data entity store tests** - `dc4256c` (test)
2. **Task 1 (TDD GREEN): Data entity store, page tabs ERD support, canvas store toggle** - `6f9e94d` (feat)
3. **Task 2: Data panel shell, entity tabs, field list, toolbar wiring** - `d871eb9` (feat)
4. **Task 3: Notion-like data table and view controls** - `662ba05` (feat)
5. **Task 4: ERD page renderer with table nodes, relation edges, drag interaction** - `224ad1b` (feat)
6. **Task 5: Human-verify checkpoint** - approved (no commit)

_Note: Task 1 used TDD: test commit first (RED), then implementation commit (GREEN)_

## Files Created/Modified
- `src/stores/document-store-data.ts` - NEW: createDataActions with entity/field/row/view CRUD, applyFilters, applySorts
- `src/stores/document-store.ts` - Merged data actions into store
- `src/stores/document-store-pages.ts` - addPage accepts optional 'erd' type parameter
- `src/stores/canvas-store.ts` - dataPanelOpen toggle, dataFocusEntityId state
- `src/types/data-entity.ts` - Extended with any needed type refinements
- `src/components/panels/data-panel.tsx` - NEW: Floating data entity management panel with entity tabs, field list, data table
- `src/components/panels/data-entity-table.tsx` - NEW: Notion-like inline-editable table for sample data
- `src/components/panels/data-field-row.tsx` - NEW: Field row with type icon, name editor, type selector, PK toggle
- `src/components/panels/data-view-controls.tsx` - NEW: View tabs, filter popover, sort popover
- `src/components/editor/toolbar.tsx` - Database icon button for data panel toggle
- `src/components/editor/editor-layout.tsx` - DataPanel conditional rendering
- `src/components/editor/page-tabs.tsx` - Dropdown menu for "Add screen" / "Add ERD page", Database icon on ERD tabs
- `src/canvas/skia/skia-erd-renderer.ts` - NEW: SkiaErdRenderer class with table nodes, relation edges, cardinality markers, hit testing
- `src/canvas/skia/skia-engine.ts` - ERD page detection, delegation to SkiaErdRenderer, isErdPage flag
- `src/canvas/skia/skia-canvas.tsx` - ERD interaction: click select, drag, double-click, tool restriction
- `src/components/ui/dropdown-menu.tsx` - NEW: shadcn dropdown-menu component
- `src/components/ui/dialog.tsx` - NEW: shadcn dialog component
- `src/components/ui/badge.tsx` - NEW: shadcn badge component
- `src/components/ui/popover.tsx` - NEW: shadcn popover component
- `src/__tests__/data-entities/data-store.test.ts` - NEW: Data entity CRUD, filter, sort, cascade unit tests
- `src/__tests__/data-entities/erd-renderer.test.ts` - NEW: ERD hit test and auto-layout unit tests

## Decisions Made
- Data entity actions follow the established createXxxActions pattern (same as connections and pages) for consistency
- ERD rendering delegated to a dedicated SkiaErdRenderer class to keep skia-engine.ts focused
- Notion-like table uses 300ms debounce on cell value updates to avoid excessive store writes
- ERD page auto-layout arranges entities in a grid (250px H x 300px V, max 3 per row) when no erdPosition set
- Drawing tools are disabled on ERD pages (only select and hand tools active)
- Double-click on ERD node opens data panel focused on that entity via dataFocusEntityId

## Deviations from Plan

None - plan executed as written across all 4 implementation tasks.

## Issues Encountered
None - plan executed smoothly.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 2 is now complete (both plans done): screen connections + data entities + ERD
- All 14 Phase 2 requirements (CONN-01..05, DATA-01..05, ERD-01..04) are satisfied
- Ready for Phase 3 (Shared Components & Design Tokens)
- Data entity types and store actions provide foundation for any future entity-aware features

## Self-Check: PASSED

- All 20 key files verified present on disk
- All 5 task commits verified in git log (dc4256c, 6f9e94d, d871eb9, 662ba05, 224ad1b)
- 23 files changed, 3733 insertions, 41 deletions

---
*Phase: 02-storyboard-data*
*Completed: 2026-03-16*
