# Phase 2: Storyboard Connections & Data Entities - Research

**Researched:** 2026-03-16
**Domain:** PenDocument type extension, Zustand store CRUD, property panel UI, CanvasKit/Skia overlays, ERD page rendering, Notion-like data management
**Confidence:** HIGH

## Summary

Phase 2 extends PenBoard's document model with two new top-level data structures (`connections: ScreenConnection[]` and `dataEntities: DataEntity[]`) and builds corresponding UI for managing storyboard connections via the property panel and data entities via a new sidebar panel plus dedicated ERD page type.

The codebase already has strong established patterns for all integration points: the type system (`pen.ts`), document store (`document-store.ts`), page system (`document-store-pages.ts`), property panel sections (fill/stroke/layout sections), floating panels (variables-panel.tsx), canvas overlays (skia-overlays.ts), and file normalization (normalize-pen-file.ts). Phase 2 follows these existing patterns — no new frameworks or libraries are needed.

The core challenge is threefold: (1) extending PenDocument safely with backward-compatible optional fields, (2) building a rich data entity management UI with inline editing (Notion-like table), and (3) rendering ERD table nodes with relation edges on a dedicated canvas page type.

**Primary recommendation:** Follow existing Zustand + PenDocument patterns exactly. Add `connections` and `dataEntities` as optional top-level fields. Build connection UI as a new property panel section. Build data entity UI as a floating panel (like variables-panel). ERD page is a standard PenPage with `type: 'erd'` marker and custom rendering logic.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Server persistence | **None** | App runs local-only. No auth, no DB server |
| Auth | **Removed** | Not needed for local desktop/dev tool |
| Data storage | **In .pb file** | Everything stored in PenDocument JSON. Portable, single file |
| Save mechanism | **Unchanged** | Ctrl+S -> file save (FS Access API / Electron IPC). No changes needed |
| Screen model | **Page = Screen** | Existing PenPage is a storyboard screen. No new abstraction needed |
| Connection workflow | **Property panel** | Select element -> "Navigate to" section in property panel -> pick target screen from dropdown |
| Overview canvas | **Not needed** | Page tabs + property panel connections are sufficient |
| Connection data model | **PenDocument.connections[]** | New top-level array on PenDocument type |
| Connection fields | **Detailed** | `sourceElementId`, `targetPageId`, `label`, `triggerEvent`, `transitionType` |
| Visual indicator | On canvas element | Elements with connections show a visual badge/indicator |
| Data entity storage | **In .pb file** | `PenDocument.dataEntities[]` - new top-level array |
| Data entity features | **Full Notion-like** | Tables + typed fields + sample data rows + relations + views |
| Data entity UI: management | **Panel (sidebar)** | Sidebar panel for quick management |
| Data entity UI: visualization | **ERD page** | Dedicated page type for schema visualization |
| Data entity UI: combined | **Both panel + ERD** | Panel for quick management, ERD page for visual schema design |
| Field types | text, number, date, select, multi-select, checkbox, url, email, relation | Formula deferred |

### Claude's Discretion
- Implementation details within each component (internal state management, animation choices, exact layout of ERD nodes)
- Order of implementation within the phase
- Granularity of store action splitting (e.g., separate connection-store vs extending document-store)
- ERD rendering approach (pure canvas overlays vs PenNode-based)

### Deferred Ideas (OUT OF SCOPE)
1. **Overview canvas** - Bird's-eye view of all screens with connection arrows
2. **Formula fields** - Computed field values in data entities
3. **Real-time preview** - Show target screen preview when hovering connection
4. **Data-driven design** - Auto-populate UI components with sample data
5. **Auth/DB** - Server-side persistence, user accounts
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CONN-01 | User can assign element-to-screen navigation via property panel "Navigate to" section | Property panel section pattern (fill-section, layout-section), page list from document store |
| CONN-02 | Each connection stores sourceElement, targetPage, trigger event, and transition type | PenDocument type extension with ScreenConnection interface |
| CONN-03 | User can add labels to connections | ScreenConnection.label optional field |
| CONN-04 | User can delete a connection from property panel | Store action removeConnection + UI delete button |
| CONN-05 | Elements with connections show visual indicator badge on canvas | Skia overlay rendering (skia-overlays.ts pattern) |
| ERD-01 | User can create data tables with name and typed fields on ERD page | DataEntity CRUD in document store + ERD page type |
| ERD-02 | User can draw relation edges showing 1:1, 1:N, N:M cardinality | ERD canvas rendering with edge drawing + cardinality labels |
| ERD-03 | Table nodes display field names, types, and PK/FK badges | ERD node rendering in skia-renderer |
| ERD-04 | User can drag table nodes to rearrange ERD layout | ERD page stores node positions in DataEntity.erdPosition |
| DATA-01 | Data entities sidebar panel for managing tables and fields | Floating panel pattern (variables-panel.tsx) |
| DATA-02 | Sample data rows (Notion-like: enter data into table rows) | DataRow CRUD in document store + inline editing UI |
| DATA-03 | Data views with filter and sort | DataView with filter/sort logic in store |
| DATA-04 | Data entities stored in .pb file (PenDocument.dataEntities[]) | PenDocument type extension, normalization |
| DATA-05 | ERD page type (dedicated page for schema visualization) | PenPage.type field extension, page-tabs icon |
</phase_requirements>

## Standard Stack

### Core (No new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Zustand | v5 | State management for connections + data entities | Already used for all stores |
| React 19 | 19.x | UI components | Already the framework |
| CanvasKit/Skia WASM | current | Canvas rendering for connection badges + ERD | Already the render engine |
| nanoid | current | ID generation for connections, entities, fields, rows | Already used everywhere |
| lucide-react | current | Icons for connection badges, data types, ERD | Already the icon library |
| shadcn/ui | current | UI primitives (Select, Button, Input) | Already used for all panels |
| Tailwind CSS v4 | current | Styling | Already the CSS framework |
| react-i18next | current | Translations for new UI strings | Already used for all UI text |

### Supporting (No new dependencies needed)

All functionality can be built with the existing stack. No additional libraries are required.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom ERD rendering in Skia | React-based ERD (e.g., ReactFlow) | ReactFlow would add a large dependency and mix rendering paradigms. Skia rendering keeps consistency with existing canvas |
| Zustand for data entity state | Separate store library | Unnecessary. Zustand handles this perfectly |
| Complex table component (AG Grid, TanStack Table) | Custom inline table | Custom is simpler, lighter, matches existing panel patterns. Data entity tables are small (design-time, not production data) |

## Architecture Patterns

### Recommended Project Structure

```
src/
├── types/
│   ├── pen.ts                    # Add ScreenConnection, update PenDocument + PenPage
│   └── data-entity.ts            # NEW: DataEntity, DataField, DataRow, DataView types
├── stores/
│   ├── document-store.ts         # Add connection + data entity CRUD actions
│   ├── document-store-connections.ts  # NEW: extracted connection actions
│   └── document-store-data.ts    # NEW: extracted data entity actions
├── canvas/
│   ├── skia/
│   │   ├── skia-overlays.ts      # Add drawConnectionBadge overlay
│   │   └── skia-renderer.ts      # Add ERD node rendering
│   └── canvas-constants.ts       # Add connection badge colors
├── components/
│   ├── panels/
│   │   ├── connection-section.tsx   # NEW: property panel "Navigate to" section
│   │   ├── data-panel.tsx           # NEW: floating data entities management panel
│   │   ├── data-entity-table.tsx    # NEW: Notion-like table view for entity
│   │   ├── data-field-row.tsx       # NEW: field row in entity editor
│   │   └── data-view-controls.tsx   # NEW: filter/sort controls
│   └── editor/
│       └── page-tabs.tsx          # Modify: ERD page icon, connection indicators
├── utils/
│   └── normalize-pen-file.ts     # Add connections + dataEntities normalization
└── i18n/
    └── locales/en.ts             # Add connection + data entity translations
```

### Pattern 1: Document Type Extension

**What:** Add optional fields to PenDocument for backward compatibility
**When to use:** Every new top-level data structure
**Example:**
```typescript
// src/types/pen.ts — extend PenDocument
export interface PenDocument {
  version: string
  name?: string
  themes?: Record<string, string[]>
  variables?: Record<string, VariableDefinition>
  pages?: PenPage[]
  children: PenNode[]
  // Phase 2 additions
  connections?: ScreenConnection[]
  dataEntities?: DataEntity[]
}

// Extend PenPage with optional type indicator
export interface PenPage {
  id: string
  name: string
  children: PenNode[]
  type?: 'screen' | 'erd'  // default is 'screen'
}
```

### Pattern 2: Extracted Store Actions (like document-store-pages.ts)

**What:** Extract domain-specific store actions into separate files that merge into the main store
**When to use:** When adding substantial CRUD operations to document-store
**Example:**
```typescript
// src/stores/document-store-connections.ts
export function createConnectionActions(
  set: (partial: Partial<{ document: PenDocument; isDirty: boolean }>) => void,
  get: () => { document: PenDocument },
): ConnectionActions {
  return {
    addConnection: (conn: Omit<ScreenConnection, 'id'>) => {
      const state = get()
      useHistoryStore.getState().pushState(state.document)
      const newConn: ScreenConnection = { ...conn, id: nanoid() }
      const connections = [...(state.document.connections ?? []), newConn]
      set({ document: { ...state.document, connections }, isDirty: true })
      return newConn.id
    },
    removeConnection: (connectionId: string) => { /* ... */ },
    updateConnection: (id: string, updates: Partial<ScreenConnection>) => { /* ... */ },
    getConnectionsForElement: (elementId: string) => {
      return (get().document.connections ?? [])
        .filter(c => c.sourceElementId === elementId)
    },
    getConnectionsForPage: (pageId: string) => {
      return (get().document.connections ?? [])
        .filter(c => c.sourcePageId === pageId || c.targetPageId === pageId)
    },
  }
}
```

### Pattern 3: Property Panel Section (like fill-section.tsx)

**What:** Self-contained section component that receives node data and emits updates
**When to use:** Adding new sections to the property panel
**Example:**
```typescript
// src/components/panels/connection-section.tsx
export default function ConnectionSection({
  nodeId,
  pageId,
}: {
  nodeId: string
  pageId: string
}) {
  const connections = useDocumentStore(s =>
    (s.document.connections ?? []).filter(c => c.sourceElementId === nodeId)
  )
  const pages = useDocumentStore(s => s.document.pages ?? [])
  const addConnection = useDocumentStore(s => s.addConnection)
  const removeConnection = useDocumentStore(s => s.removeConnection)

  // Dropdown of target pages (excluding current page)
  const targetPages = pages.filter(p => p.id !== pageId && p.type !== 'erd')

  return (
    <div>
      <SectionHeader title={t('connection.navigateTo')} />
      {connections.map(conn => (
        <ConnectionRow key={conn.id} connection={conn} onDelete={() => removeConnection(conn.id)} />
      ))}
      <AddConnectionDropdown targets={targetPages} onSelect={...} />
    </div>
  )
}
```

### Pattern 4: Floating Panel (like variables-panel.tsx)

**What:** Resizable floating panel with header, content, and resize handles
**When to use:** Data entities management panel
**Example:**
```typescript
// The data panel follows the exact same structure as variables-panel:
// - Absolute positioned within canvas container
// - Background with backdrop-blur, rounded corners, shadow
// - Resize handles (right, bottom, corner)
// - Header with tabs (one per entity) + close button
// - Scrollable content area
```

### Pattern 5: Skia Canvas Overlay (like drawAgentBadge)

**What:** Draw visual indicators on canvas nodes using CanvasKit
**When to use:** Connection badge on elements that have connections
**Example:**
```typescript
// src/canvas/skia/skia-overlays.ts — add connection indicator
export function drawConnectionBadge(
  ck: CanvasKit, canvas: Canvas,
  x: number, y: number, w: number, h: number,
  zoom: number,
) {
  const invZ = 1 / zoom
  const badgeSize = 16 * invZ
  const bx = x + w - badgeSize / 2
  const by = y - badgeSize / 2

  // Small arrow-circle badge at top-right corner of element
  const bgPaint = new ck.Paint()
  bgPaint.setStyle(ck.PaintStyle.Fill)
  bgPaint.setAntiAlias(true)
  bgPaint.setColor(parseColor(ck, CONNECTION_BADGE_COLOR))
  canvas.drawCircle(bx, by, badgeSize / 2, bgPaint)
  bgPaint.delete()

  // Arrow icon inside badge (simplified)
  const arrowPaint = new ck.Paint()
  arrowPaint.setStyle(ck.PaintStyle.Stroke)
  arrowPaint.setAntiAlias(true)
  arrowPaint.setStrokeWidth(1.5 * invZ)
  arrowPaint.setColor(ck.WHITE)
  // draw small arrow lines
  arrowPaint.delete()
}
```

### Pattern 6: ERD Page Rendering

**What:** Dedicated rendering mode for ERD pages showing table nodes with relation edges
**When to use:** When active page is type 'erd'
**Key approach:**
- ERD page is a normal PenPage with `type: 'erd'`
- Table nodes are rendered as custom shapes by the Skia renderer (not as PenNode types)
- Each DataEntity has `erdPosition?: { x: number, y: number }` for layout on ERD page
- Relation edges are drawn as lines between table nodes with cardinality markers
- ERD rendering logic lives in a new `skia-erd-renderer.ts` file
- The canvas event handler (`skia-canvas.tsx`) detects ERD page and routes drag events to update `erdPosition`

### Anti-Patterns to Avoid

- **Don't create a new node type for ERD tables:** ERD tables are not PenNodes. They are DataEntity visualizations rendered directly by a custom ERD renderer. Mixing them into the PenNode tree would break canvas sync, export, and code generation.
- **Don't store connection data on PenNode:** Connections reference nodes by ID but live in a separate `connections[]` array. This avoids polluting the node tree and makes connection management independent.
- **Don't use a separate data store:** Data entities are part of the document (PenDocument). Using a separate Zustand store would break undo/redo, file save, and file load. Extend `document-store.ts` following the page actions pattern.
- **Don't hand-roll complex table UI:** The data entity table should be simple inline editable rows (like Notion's property editor), not a full spreadsheet component. Keep it lightweight.
- **Don't render ERD on design pages:** ERD visualization only appears on ERD-type pages. Design pages show the normal canvas.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ID generation | UUID function | `nanoid()` | Already used everywhere, short IDs, no dependencies |
| State management | Custom event system | Zustand `create()` | Already the standard, integrates with history |
| UI primitives | Custom dropdowns/buttons | shadcn/ui Select, Button, Input | Consistent with existing panels |
| Icon rendering | SVG paths manually | lucide-react icons | Already the icon library |
| Color parsing | Regex color parser | Existing `parseColor` in skia-paint-utils | Already handles all formats |
| Canvas text | CanvasKit font loading | `drawText2D` in skia-overlays | Already solved with Canvas 2D rasterization |

## Common Pitfalls

### Pitfall 1: Breaking Backward Compatibility on File Load
**What goes wrong:** Old .pb files without `connections` or `dataEntities` fail to load or crash
**Why it happens:** Code assumes these arrays always exist
**How to avoid:** All new PenDocument fields MUST be optional (`?`). Always use `doc.connections ?? []` and `doc.dataEntities ?? []`. The `normalizePenDocument` function should gracefully handle missing fields.
**Warning signs:** Any code that accesses `doc.connections.filter(...)` without null check

### Pitfall 2: Undo/Redo Not Covering New Operations
**What goes wrong:** Adding/removing connections or data entities is not undoable
**Why it happens:** Forgetting to call `useHistoryStore.getState().pushState(doc)` before mutations
**How to avoid:** Every store action that modifies document state MUST push to history first. Follow the exact pattern in `document-store.ts` (every action starts with pushState).
**Warning signs:** Operations that modify `document` without a preceding `pushState` call

### Pitfall 3: ERD Page Confusion with Design Canvas
**What goes wrong:** ERD page renders design nodes, or design page shows ERD overlay
**Why it happens:** No clear separation between ERD and design rendering paths
**How to avoid:** Check `page.type === 'erd'` early in the render pipeline. ERD pages should skip normal node rendering and use dedicated ERD renderer. Design pages should skip ERD rendering entirely.
**Warning signs:** ERD content appearing when switching to a design page

### Pitfall 4: Connection Orphans After Node/Page Deletion
**What goes wrong:** Deleting a node or page leaves dangling connections that reference non-existent IDs
**Why it happens:** Delete operations don't cascade to connections
**How to avoid:** When removing a node, also remove all connections where `sourceElementId === nodeId`. When removing a page, also remove connections where `sourcePageId === pageId || targetPageId === pageId`. Add cleanup logic to `removeNode` and `removePage`.
**Warning signs:** Console errors or blank connection rows in property panel

### Pitfall 5: Data Entity Relation Circular References
**What goes wrong:** Entity A relates to Entity B which relates back to Entity A, causing infinite loops in ERD rendering
**Why it happens:** No validation when creating relations
**How to avoid:** Relations are just ID references — they don't need recursive resolution for display. ERD renderer draws edges between entities without traversing the relation graph. Just draw a line from A to B.
**Warning signs:** Stack overflow in ERD rendering

### Pitfall 6: Performance with Large DataRow Collections
**What goes wrong:** Hundreds of sample data rows make the data panel sluggish
**Why it happens:** Re-rendering all rows on every keystroke
**How to avoid:** Virtualize the table rows if count exceeds ~50. Use `React.memo` on row components. Debounce input changes before writing to store.
**Warning signs:** Typing lag in data entity table

### Pitfall 7: Canvas Overlay Z-Order for Connection Badges
**What goes wrong:** Connection badges render behind other nodes or get clipped
**Why it happens:** Drawing badges during normal node rendering pass instead of overlay pass
**How to avoid:** Draw connection badges in the overlay pass (after all nodes), similar to how selection handles and agent indicators are drawn. Check the render order in `skia-engine.ts` — overlays are drawn last.
**Warning signs:** Badges disappearing behind overlapping frames

### Pitfall 8: Missing i18n Keys Across 15 Locale Files
**What goes wrong:** New UI strings show raw keys instead of translations
**Why it happens:** Adding keys to `en.ts` but forgetting other locale files
**How to avoid:** Add keys to `en.ts` first (English is the source of truth). Other locale files can use English as fallback — i18next handles this. But for a complete product, add at minimum to `en.ts` and note the others need translation.
**Warning signs:** Keys like `connection.navigateTo` appearing in the UI

## Code Examples

### Example 1: ScreenConnection Type (from CONTEXT.md, verified)

```typescript
// src/types/pen.ts — add to file
interface ScreenConnection {
  id: string
  sourceElementId: string   // PenNode id on source page
  sourcePageId: string      // PenPage id where element lives
  targetPageId: string      // PenPage id to navigate to
  label?: string            // Optional label (e.g., "Login Success")
  triggerEvent: 'click' | 'hover' | 'submit'
  transitionType: 'push' | 'modal' | 'replace'
}
```

### Example 2: DataEntity Types (from CONTEXT.md, verified)

```typescript
// src/types/data-entity.ts — NEW file
export interface DataEntity {
  id: string
  name: string
  fields: DataField[]
  rows: DataRow[]
  views: DataView[]
  erdPosition?: { x: number; y: number }  // Position on ERD page
}

export interface DataField {
  id: string
  name: string
  type: 'text' | 'number' | 'date' | 'select' | 'multi-select' | 'checkbox' | 'url' | 'email' | 'relation'
  options?: string[]         // For select/multi-select
  relationEntityId?: string  // For relation type
  relationCardinality?: '1:1' | '1:N' | 'N:M'
  isPrimaryKey?: boolean
}

export interface DataRow {
  id: string
  values: Record<string, any>  // fieldId -> value
}

export interface DataView {
  id: string
  name: string
  filters: DataFilter[]
  sorts: DataSort[]
  groupBy?: string  // fieldId
}

export interface DataFilter {
  fieldId: string
  operator: 'equals' | 'contains' | 'gt' | 'lt' | 'isEmpty' | 'isNotEmpty'
  value: any
}

export interface DataSort {
  fieldId: string
  direction: 'asc' | 'desc'
}
```

### Example 3: Connection Store Actions Pattern (following document-store-pages.ts)

```typescript
// src/stores/document-store-connections.ts
import { nanoid } from 'nanoid'
import type { PenDocument } from '@/types/pen'
import type { ScreenConnection } from '@/types/pen'
import { useHistoryStore } from '@/stores/history-store'

interface ConnectionActions {
  addConnection: (conn: Omit<ScreenConnection, 'id'>) => string
  removeConnection: (connectionId: string) => void
  updateConnection: (id: string, updates: Partial<ScreenConnection>) => void
}

export function createConnectionActions(
  set: (partial: Partial<{ document: PenDocument; isDirty: boolean }>) => void,
  get: () => { document: PenDocument },
): ConnectionActions {
  return {
    addConnection: (conn) => {
      const state = get()
      useHistoryStore.getState().pushState(state.document)
      const newConn: ScreenConnection = { ...conn, id: nanoid() }
      const connections = [...(state.document.connections ?? []), newConn]
      set({ document: { ...state.document, connections }, isDirty: true })
      return newConn.id
    },
    removeConnection: (connectionId) => {
      const state = get()
      const connections = state.document.connections ?? []
      if (!connections.some(c => c.id === connectionId)) return
      useHistoryStore.getState().pushState(state.document)
      set({
        document: {
          ...state.document,
          connections: connections.filter(c => c.id !== connectionId),
        },
        isDirty: true,
      })
    },
    updateConnection: (id, updates) => {
      const state = get()
      const connections = state.document.connections ?? []
      const idx = connections.findIndex(c => c.id === id)
      if (idx === -1) return
      useHistoryStore.getState().pushState(state.document)
      const updated = [...connections]
      updated[idx] = { ...updated[idx], ...updates }
      set({ document: { ...state.document, connections: updated }, isDirty: true })
    },
  }
}
```

### Example 4: Connection Cascade on Node Delete

```typescript
// In document-store.ts removeNode action — add cascade:
removeNode: (id) => {
  useHistoryStore.getState().pushState(get().document)
  set((s) => {
    const doc = s.document
    // Remove node from tree
    const newChildren = removeNodeFromTree(_children(s), id)
    // Cascade: remove connections referencing this node
    const connections = (doc.connections ?? [])
      .filter(c => c.sourceElementId !== id)
    return {
      document: {
        ..._setChildren(doc, newChildren),
        connections: connections.length > 0 ? connections : undefined,
      },
      isDirty: true,
    }
  })
},
```

### Example 5: ERD Page Detection in Page Tabs

```typescript
// In page-tabs.tsx — show different icon for ERD pages
import { Database, FileText } from 'lucide-react'

// In the page list rendering:
{pages.map((page) => {
  const isERD = page.type === 'erd'
  return (
    <button key={page.id} /* ... */>
      {isERD ? <Database size={12} className="shrink-0 mr-1" /> : null}
      <span className="flex-1 text-left truncate">{page.name}</span>
      {/* ... */}
    </button>
  )
})}
```

### Example 6: Integration into Property Panel

```typescript
// In property-panel.tsx — add ConnectionSection after AppearanceSection:
import ConnectionSection from './connection-section'

// Inside the render, after the Appearance section:
<Separator />
<div className="px-3 py-2">
  <ConnectionSection nodeId={node.id} pageId={activePageId!} />
</div>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| PenDocument has only children + pages + variables + themes | Add connections + dataEntities | Phase 2 | Document format v1.1, backward compatible |
| PenPage is just id + name + children | Add optional `type` field | Phase 2 | ERD pages distinguished from screen pages |
| Property panel only shows shape properties | Add connection section | Phase 2 | Storyboard intelligence in property panel |
| Left panel only has layers + pages | Add data entities panel | Phase 2 | New floating panel for data management |
| Canvas only renders design nodes | ERD page renders tables + edges | Phase 2 | Dual rendering mode |

## Open Questions

1. **ERD rendering approach: pure overlay vs PenNode-based**
   - What we know: ERD tables should NOT be PenNodes (would break export/code gen). They should be rendered as custom shapes by a dedicated ERD renderer.
   - What's unclear: Should ERD rendering completely replace the normal canvas on ERD pages, or overlay on top of an empty canvas?
   - Recommendation: Completely replace. ERD pages have their own render pipeline. The SkiaEngine detects `page.type === 'erd'` and delegates to `SkiaErdRenderer` instead of normal `syncFromDocument + render` flow. This is cleaner than overlaying.

2. **Connection badge interaction**
   - What we know: Elements with connections show a visual badge. The badge should be clickable.
   - What's unclear: Should clicking the badge navigate to the target page, or open the connection section in the property panel?
   - Recommendation: Clicking the badge should navigate to the target page (switch active page). This is the most intuitive UX — it simulates the storyboard flow. The property panel section is for editing connections.

3. **ERD page creation workflow**
   - What we know: ERD is a dedicated page type. Users create it from page tabs.
   - What's unclear: Should there be an "Add ERD page" option, or should it be created automatically when the first data entity is created?
   - Recommendation: Add an explicit "Add ERD Page" option in the page tabs context menu / add button dropdown. Auto-creation is confusing.

4. **Data entity field type editing after data entry**
   - What we know: Fields have types. Rows have values.
   - What's unclear: What happens when you change a field type after rows have data?
   - Recommendation: Allow type change. Clear incompatible values (e.g., changing "number" to "date" clears number values that aren't valid dates). Show a confirmation dialog if rows have data.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x |
| Config file | `vite.config.ts` (test section) |
| Quick run command | `bun --bun vitest run --passWithNoTests` |
| Full suite command | `bun --bun vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CONN-01 | Add connection from property panel | unit | `bun --bun vitest run src/stores/document-store-connections.test.ts -x` | Wave 0 |
| CONN-02 | Connection stores all required fields | unit | `bun --bun vitest run src/types/data-entity.test.ts -x` | Wave 0 |
| CONN-03 | Connection label support | unit | `bun --bun vitest run src/stores/document-store-connections.test.ts -x` | Wave 0 |
| CONN-04 | Delete connection | unit | `bun --bun vitest run src/stores/document-store-connections.test.ts -x` | Wave 0 |
| CONN-05 | Visual badge on connected elements | manual-only | Visual verification on canvas | N/A |
| ERD-01 | Create data tables with typed fields | unit | `bun --bun vitest run src/stores/document-store-data.test.ts -x` | Wave 0 |
| ERD-02 | Relation edges with cardinality | manual-only | Visual verification on ERD page | N/A |
| ERD-03 | Table nodes display fields + PK badges | manual-only | Visual verification on ERD page | N/A |
| ERD-04 | Drag table nodes on ERD page | manual-only | Visual verification on ERD page | N/A |
| DATA-01 | Data entities sidebar panel | manual-only | Visual verification | N/A |
| DATA-02 | Sample data rows CRUD | unit | `bun --bun vitest run src/stores/document-store-data.test.ts -x` | Wave 0 |
| DATA-03 | Data views with filter/sort | unit | `bun --bun vitest run src/stores/document-store-data.test.ts -x` | Wave 0 |
| DATA-04 | Data entities in .pb file | unit | `bun --bun vitest run src/utils/normalize-pen-file.test.ts -x` | Wave 0 |
| DATA-05 | ERD page type | unit | `bun --bun vitest run src/stores/document-store-data.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `bun --bun vitest run --passWithNoTests`
- **Per wave merge:** `bun --bun vitest run && npx tsc --noEmit`
- **Phase gate:** Full suite green + type check before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/stores/document-store-connections.test.ts` -- covers CONN-01, CONN-02, CONN-03, CONN-04
- [ ] `src/stores/document-store-data.test.ts` -- covers ERD-01, DATA-02, DATA-03, DATA-04, DATA-05
- [ ] `src/utils/normalize-pen-file.test.ts` -- covers DATA-04 (backward compat normalization)

## Sources

### Primary (HIGH confidence)
- **Project source code** — Direct reading of `pen.ts`, `document-store.ts`, `document-store-pages.ts`, `document-tree-utils.ts`, `property-panel.tsx`, `page-tabs.tsx`, `skia-renderer.ts`, `skia-overlays.ts`, `skia-engine.ts`, `canvas-store.ts`, `editor-layout.tsx`, `variables-panel.tsx`, `right-panel.tsx`, `canvas-constants.ts`, `normalize-pen-file.ts`, `variables.ts`, `en.ts`
- **CONTEXT.md** — User decisions with exact type definitions for ScreenConnection and DataEntity
- **REQUIREMENTS.md** — Requirement IDs and descriptions
- **CLAUDE.md** — Project conventions, architecture documentation

### Secondary (MEDIUM confidence)
- **Zustand v5 patterns** — Standard create/set/get patterns confirmed by existing codebase usage
- **CanvasKit overlay patterns** — Confirmed by existing `drawAgentBadge`, `drawConnectionBadge` patterns in `skia-overlays.ts`

### Tertiary (LOW confidence)
- None — all findings are based on direct codebase analysis

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — No new dependencies needed, all patterns exist in codebase
- Architecture: HIGH — Direct extension of existing PenDocument + store + panel patterns
- Pitfalls: HIGH — Identified from analyzing existing code patterns and potential integration issues
- ERD rendering: MEDIUM — Approach is sound but implementation details (custom renderer separation) need validation during development

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable — patterns are internal to project, not external dependency)
