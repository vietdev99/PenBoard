---
phase: 05-data-binding
plan: 03
subsystem: panels
tags: [react, zustand, shadcn-dialog, data-binding, ui, context-menu, paste-validation]

# Dependency graph
requires:
  - "05-02: Data binding infrastructure (store actions, resolver, canvas pipeline)"
provides:
  - "DataBindingSection UI component with entity selector, auto-map, per-field warnings"
  - "Context menu bind/unbind integration via pendingBindNodeId on canvasStore"
  - "Copy/paste binding validation via clearStaleBindingsInTree"
  - "i18n keys for layerMenu.bindToData and layerMenu.removeBinding"
affects: [05-data-binding]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "pendingBindNodeId pattern: canvasStore flag triggers Dialog open in property panel section"
    - "Binding UI visibility: BINDABLE_ROLES check OR existing dataBinding"
    - "Paste validation: clearStaleBindingsInTree after clone, before addNode"

key-files:
  created:
    - src/components/panels/data-binding-section.tsx
    - src/utils/binding-utils.ts
  modified:
    - src/components/panels/property-panel.tsx
    - src/components/panels/layer-context-menu.tsx
    - src/components/panels/layer-panel.tsx
    - src/stores/document-store.ts
    - src/stores/canvas-store.ts
    - src/hooks/use-keyboard-shortcuts.ts
    - src/i18n/locales/en.ts (and all 14 locale files)

key-decisions:
  - "Used pendingBindNodeId on canvasStore for context menu -> property panel Dialog bridge"
  - "DataBindingSection handles own visibility logic (returns null for non-bindable roles)"
  - "Select uses __none__ sentinel value instead of empty string (shadcn/ui Select limitation)"

patterns-established:
  - "Cross-panel communication via canvasStore flags (pendingBindNodeId -> DataBindingSection useEffect)"
  - "Paste validation pattern: binding utilities called between clone and addNode"

requirements-completed: [BIND-01, BIND-02, BIND-03]

# Metrics
duration: 11min
completed: 2026-03-17
---

# Phase 05 Plan 03: Data Binding UI Summary

**DataBindingSection component with entity selector dialog, auto-mapped fields on initial bind, per-field warnings, context menu integration, and copy/paste binding validation**

## Performance

- **Duration:** 11 min
- **Started:** 2026-03-17T17:13:27Z
- **Completed:** 2026-03-17T17:24:42Z
- **Tasks:** 4 (auto) + 1 (checkpoint pending)
- **Files modified:** 24

## Accomplishments
- Created DataBindingSection with entity selector Dialog, auto-map on bind, and per-field missing-field warnings
- Added "Bind to data..." and "Remove binding" context menu items with proper visibility filtering
- Implemented paste binding validation that clears stale bindings referencing non-existent entities
- All 7 existing data-binding tests continue passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Create binding-utils.ts** - `9d0ebbf` (feat)
2. **Task 2: Create DataBindingSection component** - `adabe14` (feat)
3. **Task 3: Add context menu bind/unbind** - `e498a0b` (feat)
4. **Task 4: Add paste binding validation** - `569bba1` (feat)

**Task 5:** Checkpoint (human-verify) -- pending

## Files Created/Modified
- `src/utils/binding-utils.ts` - buildAutoFieldMappings (auto-map fields on bind) and clearStaleBindingsInTree (paste validation)
- `src/components/panels/data-binding-section.tsx` - DataBindingSection UI: entity selector Dialog, field mapping dropdowns, entity missing warning, per-field warnings
- `src/components/panels/property-panel.tsx` - Wired DataBindingSection after ArgumentValuesSection
- `src/stores/document-store.ts` - Added setDataBinding/clearDataBinding to DocumentStoreState type
- `src/stores/canvas-store.ts` - Added pendingBindNodeId state and setPendingBindNodeId action
- `src/components/panels/layer-context-menu.tsx` - Added bind-data/unbind-data menu items with Database icon
- `src/components/panels/layer-panel.tsx` - Computes isBindable/hasBoundData, handles bind-data/unbind-data actions
- `src/hooks/use-keyboard-shortcuts.ts` - Validates bindings on paste via clearStaleBindingsInTree
- `src/i18n/locales/*.ts` (15 files) - Added layerMenu.bindToData and layerMenu.removeBinding keys

## Decisions Made
- Used `pendingBindNodeId` flag on canvasStore for context menu to trigger entity selector Dialog in DataBindingSection -- this avoids coupling the layer panel to the data binding UI
- DataBindingSection self-manages visibility (returns null if role not in BINDABLE_ROLES and no existing binding) -- simplifies property-panel.tsx wiring
- Used `__none__` sentinel value for "no field" in Select dropdowns because shadcn/ui Select doesn't support empty string values

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All UI components built and wired
- Human verification checkpoint pending (Task 5) to validate the full flow end-to-end
- Data binding phase (05) will be complete after verification passes

## Self-Check: PASSED

- [x] `src/utils/binding-utils.ts` exists
- [x] `src/components/panels/data-binding-section.tsx` exists
- [x] `src/components/panels/property-panel.tsx` exists (modified)
- [x] `src/components/panels/layer-context-menu.tsx` exists (modified)
- [x] `src/components/panels/layer-panel.tsx` exists (modified)
- [x] `src/stores/document-store.ts` exists (modified)
- [x] `src/stores/canvas-store.ts` exists (modified)
- [x] `src/hooks/use-keyboard-shortcuts.ts` exists (modified)
- [x] Commit `9d0ebbf` exists (Task 1)
- [x] Commit `adabe14` exists (Task 2)
- [x] Commit `e498a0b` exists (Task 3)
- [x] Commit `569bba1` exists (Task 4)
- [x] All 7 data-binding tests pass
- [x] `.planning/phases/05-data-binding/05-03-SUMMARY.md` exists
