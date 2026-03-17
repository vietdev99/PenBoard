# Phase 5: Data Binding - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can bind ERD data entities to UI components (table, dropdown, text) and see sample data rendered directly on canvas. Includes data source selector modal, field mapping UI, cascade cleanup on entity deletion, and full persistence in .pb files.

</domain>

<decisions>
## Implementation Decisions

### Data Source Selector UX
- Entry points: Property panel button (primary) + canvas context menu (shortcut)
- Entity selection via modal dialog (like Figma Import dialog style — left: entity list, right: field mapping)
- Bound state shown only in property panel (entity name + field mappings), no canvas badge
- Unbind via X button in property panel (primary) + context menu (backup)

### Supported Component Types
- Table + Dropdown + Text nodes support data binding
- Any element type can be bound — not restricted to specific component types
- Dropdown: fills options from entity rows (1 field as label, 1 as value) + shows selected value from first row on canvas

### Sample Data Rendering
- Bound data replaces content directly on canvas — looks real, not placeholder
- Show all sample rows from entity (no limit)
- When entity has no sample rows (empty), keep original design content unchanged
- Resolution happens in rendering pipeline (after argument apply, before variable resolution)

### Field Mapping
- Auto-map by field name/type on initial bind, user can edit via dropdowns
- Initial mapping in modal dialog, subsequent edits in property panel section
- When entity fields change (rename/delete): show warning indicator "field not found" in property panel — user fixes manually

### Undo/Redo
- All binding changes (add/remove/edit) go into full undo/redo history like any other operation
- Uses existing history-store pattern with `pushHistory()`

### Copy/Paste
- Paste keeps binding if entityId still exists in target document
- Paste clears binding if entity doesn't exist (cross-document paste or entity deleted)

### Multiple Bindings
- v1.1: One entity per component only
- Want multiple bindings? Split into separate components

### Claude's Discretion
- Exact modal layout and styling
- Auto-map algorithm details (name similarity, type matching)
- Warning indicator visual design
- Resolution function internal implementation

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Data Entity System
- `src/types/data-entity.ts` — DataEntity, DataField, DataRow, DataView type definitions
- `src/stores/document-store-data.ts` — DataActions CRUD, removeEntity cascade pattern (line 82-87)

### Component Argument System (pattern to follow)
- `src/types/pen.ts` §23-36 — ComponentArgument, ArgumentBinding types
- `src/canvas/skia/argument-apply.ts` — applyPropertyValue(), applyArgumentValues() — reusable for data binding resolution
- `src/stores/document-store-components.ts` — updateNodeAcrossPages pattern, argument CRUD

### Resolution Pipeline
- `src/canvas/skia/skia-engine.ts` §155-190 — resolveRefs flow, insertion point for resolveDataBindings()
- `src/variables/resolve-variables.ts` — resolveNodeForCanvas() pattern

### Property Panel
- `src/components/panels/property-panel.tsx` — Section selection logic, handleUpdate pattern
- `src/components/panels/argument-section.tsx` §19-50 — BINDABLE_PROPERTIES whitelist concept

### Modal/Dialog Patterns
- `src/components/shared/icon-picker-dialog.tsx` — Modal pattern with search and selection
- `src/components/panels/data-panel.tsx` — Floating panel, entity tabs, resize

### Research
- `.planning/research/ARCHITECTURE.md` — Integration architecture decisions
- `.planning/research/PITFALLS.md` — Dangling bindings, history bloat, XSS prevention
- `.planning/research/STACK.md` — No new dependencies needed for this phase

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `argument-apply.ts`: `applyPropertyValue()` can apply data values to node properties using same path syntax (e.g., 'content', 'fill.0.color')
- `document-store-data.ts`: `removeEntity()` already cascades relation cleanup — extend for binding cleanup
- `document-store-components.ts`: `updateNodeAcrossPages()` helper for cross-page mutations
- `icon-picker-dialog.tsx`: Modal dialog pattern with search, selection, and callback
- `data-panel.tsx`: Entity list UI, tabs, context menu patterns

### Established Patterns
- **Store action extraction**: `createXxxActions` pattern for document-store slices — create `createDataBindingActions`
- **Property section**: Each section takes `displayNode` + `onUpdate` callback — follow for `DataBindingSection`
- **Resolution pipeline**: Arguments → DataBindings → Variables → Canvas render — insert resolveDataBindings() after argument apply
- **History integration**: All mutations use `pushHistory()` before state change

### Integration Points
- `src/types/pen.ts` — Add `dataBinding?: DataBinding` to PenNodeBase (all node types)
- `src/canvas/skia/skia-engine.ts` — Add resolveDataBindings() call in syncFromDocument() after argument apply
- `src/components/panels/property-panel.tsx` — Add DataBindingSection conditionally
- `src/stores/document-store-data.ts` — Extend removeEntity() to clean bindings across all pages

</code_context>

<specifics>
## Specific Ideas

- Modal dialog style like Figma Import dialog — left panel lists entities, right panel shows field mapping
- Auto-map should try to match field names first (case-insensitive), then fall back to type matching
- Warning indicator for broken field references — similar to how IDEs show "unresolved reference"

</specifics>

<deferred>
## Deferred Ideas

- Multiple entity bindings per component — v2 candidate
- Canvas badge/overlay for bound components — decided against for v1.1, revisit if users request
- Live database connection for real data — explicitly out of scope (local-first model)
- Two-way data binding — out of scope

</deferred>

---

*Phase: 05-data-binding*
*Context gathered: 2026-03-17*
