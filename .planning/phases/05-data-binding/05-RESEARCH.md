# Phase 5: Data Binding - Research

**Researched:** 2026-03-17
**Domain:** Data binding system — connecting ERD DataEntity to PenNode components, with canvas rendering of sample rows
**Confidence:** HIGH (all findings from direct codebase inspection, no external dependencies needed)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BIND-01 | User can select a data source (entity from ERD) for supported components (table, dropdown) via modal selector | DataEntity[] already on PenDocument; `dataBinding` field to be added to PenNodeBase; modal pattern from Dialog/VariablePicker |
| BIND-02 | Component renders sample rows from bound entity, falls back to placeholder when no data | `resolveNodeForCanvas()` precedent — resolve bindings at render time; skia-renderer receives flat RenderNode |
| BIND-03 | User can map specific entity fields to component columns/options via field mapping UI | FieldMappingSection in property panel, following ArgumentSection pattern; `fieldMappings` stored on node |
| BIND-04 | Deleting an entity auto-cleans all data binding references on bound components | Extend `removeEntity` in document-store-data.ts to walk all pages' node trees and strip `dataBinding` matching entityId |
</phase_requirements>

---

## Summary

Phase 5 builds on a complete, well-structured foundation. `DataEntity` (fields + rows), `DataRow`, and `DataField` types are already defined in `src/types/data-entity.ts`. The document store already persists `PenDocument.dataEntities`. All store mutations push undo state via `history-store`. The data panel UI is already fully functional.

What is missing is the *binding layer*: a way for a PenNode to reference a `DataEntity` and specify which fields map to which display slots (e.g., table column headers, dropdown option text). Once binding is stored on the node, a resolver function (analogous to `resolveNodeForCanvas`) can produce concrete display content from `entity.rows` for canvas rendering.

The cleanest design stores `dataBinding` directly on `PenNodeBase` (nullable), following the same pattern as `role`, `opacity`, and other cross-cutting node fields. Binding cascade-cleanup on entity deletion follows the exact pattern already used for connection cascade-cleanup in `removeNode` and the relation-field cleanup inside `removeEntity`.

**Primary recommendation:** Add `dataBinding?: DataBinding` to `PenNodeBase`, add `setDataBinding`/`clearDataBinding` store actions, write `resolveDataBinding()` pure function, then build three UI pieces: entity selector (Dialog), field mapping section (property panel), and a canvas rendering hint (sample row injected into child text nodes at render time).

---

## Standard Stack

### Core (all already in project — no new installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Zustand v5 | installed | Store actions for binding CRUD | All store actions use this pattern |
| nanoid | installed | Generate IDs for FieldMapping entries | Used everywhere for IDs |
| React 19 | installed | UI components (selector modal, mapping section) | Project framework |
| shadcn/ui Dialog | installed | Entity selector modal | VariablePicker uses popover; Dialog used for delete-confirm in data-panel |
| shadcn/ui Select | installed | Field-to-slot dropdown in mapping UI | Used extensively in argument-section |
| Vitest | installed | Unit tests for binding logic | Project test framework |
| TailwindCSS v4 | installed | Styling | Project styling system |

### No New Dependencies

Zero new packages needed. The binding system is a pure composition of existing types, store patterns, and UI primitives.

**Installation:**
```bash
# No new packages — all libraries already installed
```

---

## Architecture Patterns

### Type Design — DataBinding on PenNodeBase

```typescript
// Source: src/types/data-entity.ts (new additions)

/** Maps a component's display slot to a DataField id on the bound entity */
export interface FieldMapping {
  /** The component slot name (e.g. 'col-0', 'option-text', 'label') */
  slotKey: string
  /** The DataField.id on the bound entity to pull values from */
  fieldId: string
}

/** Data binding configuration stored directly on a PenNode */
export interface DataBinding {
  /** DataEntity.id this node is bound to */
  entityId: string
  /**
   * Field-to-slot mappings. If empty, the canvas renderer uses positional
   * matching (field[0] -> slot[0], etc.) as a default.
   */
  fieldMappings: FieldMapping[]
  /**
   * Max number of sample rows to render. Default: 3.
   * Capped to entity.rows.length.
   */
  previewRowCount?: number
}
```

```typescript
// Source: src/types/pen.ts — add to PenNodeBase
export interface PenNodeBase {
  // ... existing fields ...
  dataBinding?: DataBinding   // NEW: optional data binding config
}
```

### Recommended Project Structure (new files)

```
src/
├── types/
│   └── data-entity.ts          # add FieldMapping + DataBinding types
├── types/
│   └── pen.ts                  # add dataBinding?: DataBinding to PenNodeBase
├── stores/
│   └── document-store-data.ts  # extend removeEntity + add binding actions
├── variables/
│   └── resolve-data-binding.ts # NEW: resolveDataBinding() pure function
├── components/
│   └── panels/
│       ├── data-binding-section.tsx   # NEW: entity selector + field mapping
│       └── property-panel.tsx         # add DataBindingSection
└── __tests__/
    └── data-binding/
        └── data-binding.test.ts        # NEW: unit tests
```

### Pattern 1: DataBinding Stored on PenNodeBase (Document-Level)

**What:** `dataBinding` is an optional field on every `PenNode` (via `PenNodeBase`), stored directly in the `.pb` JSON. No separate store.

**When to use:** Always — this follows the established pattern for all other cross-cutting node properties (`role`, `opacity`, `locked`, `visible`, `theme`).

**Why NOT a separate binding store:** `ScreenConnection[]` lives on `PenDocument` because connections span two nodes. `DataBinding` belongs to ONE node, so it belongs on the node itself. This makes undo/redo, copy/paste, and duplicate free (they already clone the whole node object).

**Example:**
```typescript
// Source: direct codebase study — PenNodeBase in src/types/pen.ts
const node: FrameNode = {
  id: 'node-abc',
  type: 'frame',
  name: 'UserTable',
  role: 'table',
  dataBinding: {
    entityId: 'entity-xyz',
    fieldMappings: [
      { slotKey: 'col-0', fieldId: 'field-name' },
      { slotKey: 'col-1', fieldId: 'field-email' },
    ],
    previewRowCount: 3,
  }
}
```

### Pattern 2: Store Actions Follow document-store-data.ts Conventions

**What:** `setDataBinding` and `clearDataBinding` are new actions in `document-store-data.ts` (or a new `document-store-binding.ts`), wired into `document-store.ts` via spread.

**Pattern:**
```typescript
// Source: document-store-data.ts pattern (every action)
setDataBinding: (nodeId, binding) => {
  const state = get()
  useHistoryStore.getState().pushState(state.document)
  set((s) => ({
    document: _setChildren(
      s.document,
      updateNodeInTree(_children(s), nodeId, { dataBinding: binding } as Partial<PenNode>),
    ),
    isDirty: true,
  }))
},

clearDataBinding: (nodeId) => {
  // same as above with { dataBinding: undefined }
},
```

**Critical:** All binding mutations MUST call `useHistoryStore.getState().pushState()` before mutation — this is the invariant for all store actions.

### Pattern 3: Cascade Cleanup on Entity Deletion

**What:** When `removeEntity(entityId)` is called, the store must also walk all pages' node trees and remove `dataBinding` from every node whose `dataBinding.entityId === entityId`.

**Precedent in codebase:**
1. `removeEntity` already cleans up relation fields in other entities (lines 82-91 of `document-store-data.ts`)
2. `removeNode` cascades `connections` cleanup (lines 185-201 of `document-store.ts`)

**Implementation:**
```typescript
// Extend removeEntity in document-store-data.ts
removeEntity: (entityId) => {
  const state = get()
  const existing = state.document.dataEntities ?? []
  if (!existing.some((e) => e.id === entityId)) return
  useHistoryStore.getState().pushState(state.document)

  const remaining = existing
    .filter((e) => e.id !== entityId)
    .map((e) => ({
      ...e,
      fields: e.fields.filter((f) => f.relatedEntityId !== entityId),
    }))

  // NEW: walk all pages' node trees to clear dangling bindings
  const cleanedPages = (state.document.pages ?? []).map((page) => ({
    ...page,
    children: clearDataBindingInTree(page.children, entityId),
  }))

  set({
    document: {
      ...state.document,
      dataEntities: remaining,
      pages: cleanedPages.length > 0 ? cleanedPages : state.document.pages,
    },
    isDirty: true,
  })
},
```

```typescript
// Pure tree walker (add to document-store-data.ts or document-tree-utils.ts)
function clearDataBindingInTree(nodes: PenNode[], entityId: string): PenNode[] {
  return nodes.map((node) => {
    const cleared = node.dataBinding?.entityId === entityId
      ? { ...node, dataBinding: undefined }
      : node
    if ('children' in cleared && cleared.children) {
      return { ...cleared, children: clearDataBindingInTree(cleared.children, entityId) }
    }
    return cleared
  })
}
```

### Pattern 4: Canvas Rendering — Resolve at Sync Time

**What:** `resolveDataBinding()` is a pure function that, given a node with `dataBinding` and the document's `dataEntities`, returns the concrete content to display. It is called in `use-canvas-sync.ts` during node flattening (the same layer where `resolveNodeForCanvas()` is called for variables).

**Approach:** For nodes with `role === 'table'` or `role === 'table-row'`, inject sample row data into child text nodes. The renderer does not need to know about bindings — it only sees the resolved content.

**Design constraint:** Canvas renderer (`skia-renderer.ts`) is GPU-accelerated and receives flat `RenderNode[]`. The binding resolution MUST happen upstream in `syncFromDocument()` / `use-canvas-sync.ts`, not in the renderer. This mirrors exactly how `$variable` refs are resolved in `resolveNodeForCanvas()`.

```typescript
// Source: new file src/variables/resolve-data-binding.ts
import type { PenNode } from '@/types/pen'
import type { DataEntity } from '@/types/data-entity'

/**
 * Returns up to previewRowCount copies of a table-role node, each with
 * child text nodes populated from the matching entity row.
 * Returns the node unchanged if no binding or entity not found.
 */
export function resolveDataBinding(
  node: PenNode,
  entities: DataEntity[],
): PenNode {
  if (!node.dataBinding) return node
  const { entityId, fieldMappings, previewRowCount = 3 } = node.dataBinding
  const entity = entities.find((e) => e.id === entityId)
  if (!entity || entity.rows.length === 0) return node
  // Resolve logic here — inject row values into child text nodes
  // ...
  return resolvedNode
}
```

### Pattern 5: Supported Component Roles

Only components with structured, repeating content need special binding treatment. Initial set (BIND-01):

| Role | Binding Strategy | Canvas Output |
|------|-----------------|---------------|
| `table` | Repeat row template N times with entity row values | N child row frames |
| `table-row` | Fill each cell's text child from field mappings | Text content replaced |
| `dropdown` / `select` | Fill option text from first text field | Options list |

**Simple heuristic for "supported component":** A node is bindable if `node.role` is in a defined set (`BINDABLE_ROLES = ['table', 'table-row', 'list', 'dropdown']`), OR if the user explicitly enables binding via the UI. This avoids false positives.

### Anti-Patterns to Avoid

- **Storing binding outside the node:** Do NOT add a `PenDocument.dataBindings: Record<nodeId, DataBinding>` at the document level. Binding belongs on the node so copy/paste/duplicate/undo work for free.
- **Resolving in the Skia renderer:** Do NOT resolve binding data inside `skia-renderer.ts`. Resolution must happen in the sync layer, keeping the renderer pure.
- **Mutating entity rows during binding:** The entity data is the source of truth; the canvas shows a read-only sample. Never write back to entity rows from the binding resolver.
- **Building a live query engine:** Entities are static sample data in a design tool, not a live DB. A simple array slice (`entity.rows.slice(0, previewRowCount)`) is sufficient — no reactive subscription system needed.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Persistent undo/redo for bindings | Custom undo system | `useHistoryStore.getState().pushState()` before every mutation | Already handles 300-state max, batching, `applyHistoryState` |
| Tree walker for cascade cleanup | Custom recursion | Extend `clearDataBindingInTree` following `replaceVariableRefsInTree` in `replace-refs.ts` | Pattern already proven |
| Copy/paste binding persistence | Special copy handler | Nothing — `dataBinding` on node is cloned when node is duplicated (done in `duplicateNode` via `cloneWithNewIds`) | Free via structural cloning |
| Dialog for entity picker | Custom modal | `shadcn/ui Dialog` (already in project, used in data-panel.tsx) | Consistent UX, accessible |
| Dropdown for field mapping | Custom select | `shadcn/ui Select` (already in project) | Used in argument-section.tsx |
| Node tree update | `updateNodeInTree` rebuild | `updateNodeInTree` from `document-tree-utils.ts` | Already handles deep tree |

**Key insight:** Because `dataBinding` is on the node, every existing infrastructure (undo, redo, copy, paste, duplicate, save, load, MCP sync) handles it for free. The cost is zero extra infrastructure; the implementation is purely new types + new UI sections + one new resolver function.

---

## Common Pitfalls

### Pitfall 1: Dangling Bindings After Entity Deletion

**What goes wrong:** A node has `dataBinding.entityId = 'old-entity'`. User deletes the entity. Canvas tries to resolve binding — entity not found — undefined access crash or stale data displayed.

**Why it happens:** The cascade cleanup is not wired into `removeEntity`.

**How to avoid:** Extend `removeEntity` (BIND-04) to call `clearDataBindingInTree` for all pages before the set() call. This is a single-location fix.

**Warning signs:** Any call to `resolveDataBinding()` where `entity` is undefined — guard with early return (`if (!entity) return node`) so the resolver is safe even if cleanup lags.

### Pitfall 2: Copy/Paste Carrying a Stale entityId

**What goes wrong:** User binds a table to EntityA, copies to a different document that doesn't have EntityA. Binding resolves to nothing, no error but also no data.

**Why it happens:** `entityId` is a document-local nanoid; it is meaningless in another document.

**How to avoid:** In `resolveDataBinding()`, always guard with `entities.find(e => e.id === entityId)` and fall back gracefully to placeholder content. No crash, just placeholder.

**Warning signs:** `entity` is undefined after find — expected cross-document behavior. Acceptable for v1.1.

### Pitfall 3: Undo Skipped for Binding Changes

**What goes wrong:** User sets a binding, then Ctrl+Z — binding is not removed.

**Why it happens:** Forgot to call `useHistoryStore.getState().pushState(state.document)` before the `set()` call in the new action.

**How to avoid:** Copy the action template from any existing action in `document-store-data.ts` exactly. The `pushState` call is line 1 inside every action.

**Warning signs:** Undo stack does not revert binding.

### Pitfall 4: Canvas Infinite Sync Loop via Binding Resolution

**What goes wrong:** `resolveDataBinding()` modifies node objects — if it produces new object references on every call, `syncFromDocument()` sees "changed" nodes every frame and re-renders continuously.

**Why it happens:** `canvas-sync-lock.ts` exists specifically because canvas events write to the store, triggering a re-render, which triggers canvas events. Binding resolution must not write back to the store.

**How to avoid:** `resolveDataBinding()` must be a pure function — takes nodes, returns resolved copy without calling `set()`. The resolved nodes are used only for rendering, never stored back. Follow the same discipline as `resolveNodeForCanvas()`.

### Pitfall 5: Binding UI Shown for All Node Types

**What goes wrong:** Every node (rectangles, ellipses, paths) shows a "Bind to Data" section in the property panel, confusing users.

**Why it happens:** Unconditionally rendering `DataBindingSection` for all nodes.

**How to avoid:** Only show the binding UI when `node.role` is in `BINDABLE_ROLES` OR when `node.dataBinding` is already set (so users can always unbind).

---

## Code Examples

Verified patterns from codebase inspection:

### Store Action Template (copy from removeEntity)

```typescript
// Source: src/stores/document-store-data.ts, line 75-96 pattern
setDataBinding: (nodeId, binding) => {
  const state = get()
  useHistoryStore.getState().pushState(state.document)  // ALWAYS first
  set((s) => ({
    document: _setChildren(
      s.document,
      updateNodeInTree(_children(s), nodeId, { dataBinding: binding } as Partial<PenNode>),
    ),
    isDirty: true,
  }))
},
```

### Tree Walk for Cascade Cleanup

```typescript
// Source: pattern from src/variables/replace-refs.ts (replaceVariableRefsInTree)
function clearDataBindingInTree(nodes: PenNode[], entityId: string): PenNode[] {
  return nodes.map((node) => {
    let cleaned = node
    if (node.dataBinding?.entityId === entityId) {
      const { dataBinding: _, ...rest } = node
      cleaned = rest as PenNode
    }
    if ('children' in cleaned && cleaned.children) {
      return { ...cleaned, children: clearDataBindingInTree(cleaned.children, entityId) }
    }
    return cleaned
  })
}
```

### Entity Selector Modal Pattern

```typescript
// Source: data-panel.tsx delete confirmation dialog (lines 419-437)
// Apply same Dialog pattern from shadcn/ui
<Dialog open={selectorOpen} onOpenChange={setSelectorOpen}>
  <DialogContent className="max-w-[400px]">
    <DialogHeader>
      <DialogTitle>Bind to Data Entity</DialogTitle>
    </DialogHeader>
    {entities.map((entity) => (
      <button key={entity.id} onClick={() => handleBind(entity.id)}>
        {entity.name} ({entity.fields.length} fields, {entity.rows.length} rows)
      </button>
    ))}
  </DialogContent>
</Dialog>
```

### Property Panel Section Wiring (follow ArgumentSection pattern)

```typescript
// Source: src/components/panels/property-panel.tsx, lines 251-258
// Add DataBindingSection after ArgumentSection:
{(isContainer || nodeIsInstance) && node.role && BINDABLE_ROLES.includes(node.role) && (
  <>
    <Separator />
    <div className="px-3 py-2">
      <DataBindingSection node={displayNode} onUpdate={handleUpdate} />
    </div>
  </>
)}
```

### Resolver Guard Pattern

```typescript
// Source: src/variables/resolve-variables.ts pattern — always guard lookups
export function resolveDataBinding(node: PenNode, entities: DataEntity[]): PenNode {
  if (!node.dataBinding) return node  // not bound
  const entity = entities.find((e) => e.id === node.dataBinding!.entityId)
  if (!entity || entity.rows.length === 0) return node  // entity gone or empty
  // safe to resolve
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Binding stored at document level (connections pattern) | Binding stored on node (variables pattern) | Design decision for Phase 5 | Undo/copy/paste free; no separate index needed |
| Full rendering in React DOM | All canvas rendering via CanvasKit/Skia WASM | v1.0 (existing) | Binding resolution must happen in sync layer, not renderer |
| Separate variable picker component | `VariablePicker` inline popover | v1.0 (existing) | Entity picker can use same popover or Dialog from data-panel |

**Deprecated/outdated:**
- Fabric.js canvas: still in dependencies but no longer used for rendering. Do not add binding rendering hooks to Fabric layer.

---

## Open Questions

1. **Which node roles are "bindable" in v1.1?**
   - What we know: BIND-01 says "table, dropdown" explicitly
   - What's unclear: Are there other roles where binding is useful (list, card grid)?
   - Recommendation: Start with `BINDABLE_ROLES = ['table', 'table-row', 'list', 'dropdown', 'select']`. Expand in later phases.

2. **How does the canvas render "repeated rows" for a table?**
   - What we know: The canvas flattens nodes to a `RenderNode[]` array. There is no "repeat" primitive in SkiaEngine.
   - What's unclear: For a table frame with N row template children, do we clone the template N times? Or do we just replace text content in existing children?
   - Recommendation: For v1.1, use the simpler approach — replace text node content in existing children (row 1 of entity data → first row template, row 2 → second template, etc.). Do NOT dynamically insert/remove child nodes in the canvas sync layer — this could trigger layout recalculation loops. Cloning row templates is a stretch goal.

3. **What happens when `dataBinding` is set on a node that is copy-pasted to a document without the source entity?**
   - What we know: The resolver already guards with `entity?.find()` returning undefined.
   - What's unclear: Should the UI show a warning ("entity not found") or silently show placeholder?
   - Recommendation: Show a subtle warning chip ("Entity missing") in the `DataBindingSection` if `entityId` is set but entity not found. No error thrown.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (vitest.config.ts at project root) |
| Config file | `vitest.config.ts` |
| Quick run command | `bun --bun vitest run src/__tests__/data-binding/` |
| Full suite command | `bun --bun run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BIND-01 | `setDataBinding(nodeId, binding)` stores binding on node with undo | unit | `bun --bun vitest run src/__tests__/data-binding/data-binding.test.ts -t "setDataBinding"` | Wave 0 |
| BIND-01 | `clearDataBinding(nodeId)` removes binding with undo | unit | `bun --bun vitest run src/__tests__/data-binding/data-binding.test.ts -t "clearDataBinding"` | Wave 0 |
| BIND-02 | `resolveDataBinding()` returns sample rows from entity | unit | `bun --bun vitest run src/__tests__/data-binding/data-binding.test.ts -t "resolveDataBinding"` | Wave 0 |
| BIND-02 | `resolveDataBinding()` returns node unchanged when entity not found | unit | `bun --bun vitest run src/__tests__/data-binding/data-binding.test.ts -t "resolveDataBinding entity missing"` | Wave 0 |
| BIND-03 | `setDataBinding` with fieldMappings stores correct field-to-slot mappings | unit | `bun --bun vitest run src/__tests__/data-binding/data-binding.test.ts -t "fieldMappings"` | Wave 0 |
| BIND-04 | `removeEntity` also clears all dataBinding references in node tree | unit | `bun --bun vitest run src/__tests__/data-binding/data-binding.test.ts -t "removeEntity cascade"` | Wave 0 |
| BIND-04 | Cascade cleanup walks nested children (not just top-level nodes) | unit | `bun --bun vitest run src/__tests__/data-binding/data-binding.test.ts -t "cascade nested"` | Wave 0 |

### Sampling Rate

- **Per task commit:** `bun --bun vitest run src/__tests__/data-binding/data-binding.test.ts`
- **Per wave merge:** `bun --bun run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/__tests__/data-binding/data-binding.test.ts` — covers all 7 test cases above (BIND-01 through BIND-04)
- [ ] No framework install gap — Vitest already configured

*(Existing test infrastructure fully covers the phase; only the new test file is missing)*

---

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection — `src/types/data-entity.ts` — DataEntity, DataField, DataRow, DataBinding types
- Direct codebase inspection — `src/types/pen.ts` — PenNodeBase, PenDocument structure
- Direct codebase inspection — `src/stores/document-store-data.ts` — store action patterns, removeEntity cascade
- Direct codebase inspection — `src/stores/document-store.ts` — removeNode connection cascade (lines 185-201)
- Direct codebase inspection — `src/stores/document-store-connections.ts` — document-level vs node-level pattern
- Direct codebase inspection — `src/variables/resolve-variables.ts` / `replace-refs.ts` — resolver + tree walk patterns
- Direct codebase inspection — `src/components/shared/variable-picker.tsx` — binding UI pattern (popover)
- Direct codebase inspection — `src/components/panels/argument-section.tsx` — field mapping UI pattern (Select)
- Direct codebase inspection — `src/components/panels/property-panel.tsx` — section wiring pattern
- Direct codebase inspection — `src/components/panels/data-panel.tsx` — Dialog usage pattern
- Direct codebase inspection — `src/__tests__/data-entities/data-store.test.ts` — test structure and mock conventions

### Secondary (MEDIUM confidence)

- None required — all research was from direct codebase inspection

### Tertiary (LOW confidence)

- None

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no new packages; all existing libraries verified in package usage
- Architecture: HIGH — DataBinding-on-node design verified against all existing precedents (variables, connections, component arguments)
- Pitfalls: HIGH — all identified from direct inspection of the existing cascade cleanup, sync lock, and history patterns in the codebase

**Research date:** 2026-03-17
**Valid until:** 2026-09-17 (stable — no external dependencies; only codebase-internal patterns)
