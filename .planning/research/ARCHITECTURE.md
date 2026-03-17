# Architecture Research

**Domain:** Data-Driven Design Tool (PenBoard v1.1 integration)
**Researched:** 2026-03-17
**Confidence:** HIGH (source code verified directly)

## Standard Architecture

### System Overview — Existing v1.0

```
┌─────────────────────────────────────────────────────────────────────┐
│                          React UI Layer                              │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │  Toolbar  │  │  LayerPanel  │  │ RightPanel   │  │  AIChat    │  │
│  │  TopBar   │  │  PageTabs    │  │  ├─ design   │  │  Panel     │  │
│  └──────────┘  └──────────────┘  │  ├─ navigate │  └────────────┘  │
│                                  │  └─ code     │                   │
│                                  └──────────────┘                   │
├─────────────────────────────────────────────────────────────────────┤
│                        Canvas Layer                                  │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  SkiaCanvas (React component: events + overlays)             │   │
│  │  SkiaEngine (sync, layout, flatten, render loop)             │   │
│  │  SkiaRenderer (GPU draw calls via CanvasKit/WASM)            │   │
│  │  SkiaErdRenderer (ERD page — table nodes + relation edges)   │   │
│  │  SpatialIndex (R-tree hit test + marquee selection)          │   │
│  └──────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│                        State Layer                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐               │
│  │ documentStore│  │  canvasStore  │  │ historyStore │               │
│  │ (PenDocument │  │ (selection,  │  │ (undo/redo   │               │
│  │  CRUD + tree)│  │  viewport,   │  │  300 states) │               │
│  │              │  │  activePageId│  │              │               │
│  └──────┬───────┘  └──────────────┘  └─────────────┘               │
├─────────┼───────────────────────────────────────────────────────────┤
│         │               Data Model Layer                             │
│         ▼                                                           │
│  PenDocument                                                         │
│    ├── pages: PenPage[]  (type: screen | erd | component)           │
│    ├── connections: ScreenConnection[]                               │
│    ├── dataEntities: DataEntity[]                                    │
│    ├── variables: Record<string, VariableDefinition>                 │
│    └── children: PenNode[]  (legacy fallback)                        │
├─────────────────────────────────────────────────────────────────────┤
│                        Server Layer (Nitro)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │  /api/ai/*   │  │  MCP Server  │  │  SSE broadcast           │  │
│  │  (chat, gen, │  │  (stdio+HTTP)│  │  (mcp-sync-state.ts)     │  │
│  │   validate)  │  │  20+ tools   │  │                          │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### v1.1 Extension Points — Where New Features Plug In

```
┌─────────────────────────────────────────────────────────────────────┐
│                    NEW: v1.1 Integration Points                      │
│                                                                      │
│  RightPanel tabs: design | navigate | code | [context NEW]          │
│                                                    │                 │
│  PropertyPanel sections:                           ▼                 │
│    ConnectionSection (existing)          ContextSection (new)        │
│    [DataBindingSection NEW]              PenNode.contextNote field   │
│                                                                      │
│  Resolution pipeline extension:                                      │
│  resolveRefs → resolveArguments → resolveVariables                   │
│    → [resolveDataBinding NEW] → premeasureText → flatten → render   │
│                                                                      │
│  New standalone page type: 'workflow' (Mermaid viewer)              │
│  Reuse existing 'erd' page infrastructure pattern.                   │
│                                                                      │
│  Preview: separate browser window (window.open + postMessage)        │
│  Generates HTML from react-generator.ts, injects sample data.       │
│                                                                      │
│  MCP: 4 new tools (data_binding, preview, context, workflow)        │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | v1.1 Change |
|-----------|----------------|-------------|
| `PenNode` (type system) | Node data model | Add optional `contextNote?: string`, `dataBinding?: DataBindingConfig` |
| `documentStore` | PenDocument CRUD + history | Add `updateNodeContext`, `setDataBinding` actions |
| `resolveVariables.ts` | $var → concrete value | No change needed |
| `argument-apply.ts` | Argument binding to nodes | Extend for data binding resolution |
| `SkiaEngine` | Render pipeline orchestration | Add `resolveDataBindings()` step before flatten |
| `RightPanel` | Tab container | Add 'context' tab |
| `PropertyPanel` | Element properties | Add `DataBindingSection` |
| `react-generator.ts` | Code output | Extend to emit data binding as props |
| `html-renderer.ts` | HTML → screenshot (validation) | Reuse for interactive preview |
| MCP `server.ts` | Tool registry | Add 4 new tools |

## Recommended Project Structure for v1.1 Additions

```
src/
├── types/
│   ├── pen.ts                  # MODIFIED: add contextNote, dataBinding fields
│   └── data-binding.ts         # NEW: DataBindingConfig, DataBindingSource types
│
├── data-binding/               # NEW module
│   ├── resolve-data-binding.ts # Pure resolver: node + entity + row → concrete values
│   └── data-binding-utils.ts   # Helpers: find entity, apply row values to node tree
│
├── components/panels/
│   ├── data-binding-section.tsx # NEW: UI to select entity + field mapping per node
│   ├── context-section.tsx      # NEW: textarea for per-element AI context note
│   ├── workflow-panel.tsx       # NEW: Mermaid diagram view in right panel or standalone
│   └── right-panel.tsx          # MODIFIED: add 'context' tab
│
├── services/
│   ├── preview/                 # NEW module
│   │   ├── preview-generator.ts # NEW: PenDocument → interactive HTML string
│   │   └── preview-bridge.ts    # NEW: window.open + postMessage channel management
│   └── codegen/
│       └── react-generator.ts   # MODIFIED: emit data binding as useState/props
│
├── canvas/skia/
│   └── skia-engine.ts           # MODIFIED: add resolveDataBindings() in pipeline
│
├── mcp/tools/
│   ├── data-binding.ts          # NEW MCP tool: get/set data bindings
│   ├── preview.ts               # NEW MCP tool: trigger interactive preview
│   ├── context.ts               # NEW MCP tool: read/write element context notes
│   └── workflow.ts              # NEW MCP tool: generate workflow mermaid
│
└── stores/
    └── document-store-data-binding.ts  # NEW: createDataBindingActions
```

### Structure Rationale

- **`src/data-binding/`:** Isolated module mirrors pattern of `src/variables/` (resolve-variables.ts, replace-refs.ts). Keeps resolution logic pure and testable without canvas deps.
- **`src/services/preview/`:** Extends `src/services/codegen/` and `src/services/ai/html-renderer.ts` without modifying them. Preview is a separate concern from code export.
- **`src/components/panels/`:** All panels colocated. New sections follow existing naming pattern (`*-section.tsx`).
- **`document-store-data-binding.ts`:** Follows existing pattern of modular store slices (document-store-connections.ts, document-store-data.ts, document-store-components.ts).

## Architectural Patterns

### Pattern 1: Resolution Pipeline Extension (Data Binding)

**What:** Insert a new pure resolution step between argument resolution and text pre-measurement. When a node has `dataBinding`, look up the bound DataEntity + current sample row, apply field values to node properties (like argument-apply does but driven by entity data).

**When to use:** Any time a node's content or style should reflect entity data.

**Trade-offs:** Pure function, no side effects, easy to test. Performance concern: runs on every `syncFromDocument()` call, so must be fast O(nodes). Since sample rows are small (< 100 rows per entity), this is acceptable.

**Example:**
```typescript
// src/data-binding/resolve-data-binding.ts

export interface DataBindingConfig {
  entityId: string
  // Optional: which row index to use (default: 0)
  rowIndex?: number
  // Mapping: PenNode property path → DataField id
  // e.g. { 'content': 'field-name-id', 'fill.0.color': 'field-color-id' }
  fieldMap: Record<string, string>
}

export function resolveDataBindingsInTree(
  nodes: PenNode[],
  entities: DataEntity[],
): PenNode[] {
  return nodes.map((node) => {
    const binding = (node as PenNodeBase & { dataBinding?: DataBindingConfig }).dataBinding
    if (!binding) {
      // Recurse into children
      if ('children' in node && node.children) {
        return { ...node, children: resolveDataBindingsInTree(node.children, entities) }
      }
      return node
    }
    const entity = entities.find((e) => e.id === binding.entityId)
    if (!entity) return node
    const row = entity.rows[binding.rowIndex ?? 0]
    if (!row) return node
    // Build applications list
    const applications = Object.entries(binding.fieldMap)
      .map(([property, fieldId]) => ({
        targetNodeId: node.id,
        targetProperty: property,
        value: row.values[fieldId] ?? '',
      }))
      .filter((a) => a.value !== undefined && a.value !== null)
    // Reuse existing applyPropertyValue
    let resolved = node
    for (const app of applications) {
      resolved = applyPropertyValue(resolved, app.targetProperty, app.value as string | number | boolean)
    }
    return resolved
  })
}
```

**Integration point in SkiaEngine:**
```typescript
// In syncFromDocument(), add BEFORE premeasureTextHeights:
let resolvedNodes = applyArgumentValues(resolvedNodes, ...)
resolvedNodes = resolveDataBindingsInTree(resolvedNodes, doc.dataEntities ?? [])  // NEW
resolvedNodes = premeasureTextHeights(resolvedNodes)
```

### Pattern 2: Context Note as PenNode Field

**What:** Add `contextNote?: string` to `PenNodeBase`. Stored in the .pb file per node. Not rendered by SkiaEngine (skipped like `locked`/`name`). Used by AI chat as additional context when generating designs.

**When to use:** User wants to give AI hints about what a specific element represents ("this card shows a product listing from the Product entity").

**Trade-offs:** Simplest possible approach. No new types, no new store slices. One field on PenNodeBase. The AI chat panel's `buildContextString()` helper reads it when building the prompt. Downside: visible in .pb JSON (acceptable — it's a design file not production code).

**Example:**
```typescript
// In PenNodeBase (pen.ts):
contextNote?: string  // Per-element AI context / annotation

// In ai-chat-handlers.ts buildContextString():
if (node.contextNote) {
  context += `\nElement "${node.name ?? node.id}": ${node.contextNote}`
}

// New ContextSection component:
export function ContextSection({ nodeId }: { nodeId: string }) {
  const node = useDocumentStore(s => s.getNodeById(nodeId))
  const updateNode = useDocumentStore(s => s.updateNode)
  return (
    <textarea
      value={(node as PenNodeBase)?.contextNote ?? ''}
      onChange={(e) => updateNode(nodeId, { contextNote: e.target.value })}
      placeholder="Describe this element for AI..."
    />
  )
}
```

### Pattern 3: Interactive Preview via Separate Window

**What:** Generate complete interactive HTML from PenDocument (reusing react-generator.ts logic but outputting self-contained HTML with sample data inlined), then open in a new browser tab via `window.open()`. Communication via `postMessage`.

**When to use:** User clicks "Preview" button in toolbar or top-bar.

**Trade-offs:**
- Pros: No iframe security issues, full browser features, navigation works naturally
- Cons: Cannot sync live changes without explicit re-trigger (acceptable for MVP)
- Alternative (iframe): Simpler but sandboxed — navigation between screens requires custom routing
- Decision: Separate window is correct for v1.1 because navigation simulation requires `window.location` changes

**Architecture:**
```typescript
// src/services/preview/preview-generator.ts

export async function generatePreviewHtml(doc: PenDocument): Promise<string> {
  const pages = doc.pages ?? []
  const screenPages = pages.filter(p => p.type === 'screen' || !p.type)

  // Generate one HTML section per screen
  // Use react-generator output logic but emit vanilla HTML + CSS instead
  // Inject navigation handlers that switch active screen on click
  // Inline sample data from dataEntities as JSON script tag

  const screenHtmlBlocks = screenPages.map(page => generateScreenHtml(page, doc))
  return wrapInPreviewShell(screenHtmlBlocks, doc.connections ?? [])
}

// src/services/preview/preview-bridge.ts

export function openPreview(html: string) {
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const win = window.open(url, '_blank')
  // Revoke after a delay to allow load
  setTimeout(() => URL.revokeObjectURL(url), 5000)
  return win
}
```

**Navigation in preview HTML:**
- Connections define triggers (click, hover, submit) and targets (pageId)
- Generated HTML injects a `<script>` with navigation map: `{ elementId: targetPageId }`
- Click handlers show/hide screen divs based on connections

### Pattern 4: Workflow Diagram via Mermaid

**What:** Derive a Mermaid flowchart definition from `PenDocument.connections[]` and `PenDocument.dataEntities[]`. Display in a panel using `@mermaid-js/mermaid` (already likely available or easy to add). No new page type needed — use a tab in the Navigate panel or a dedicated WorkflowPanel.

**When to use:** User wants to see the app flow and data model in one overview.

**Trade-offs:**
- Mermaid is 460KB but can be lazy-loaded
- Generated Mermaid is purely derived from document data — no storage needed (recomputed on demand)
- Simpler than a new 'workflow' page type with custom Skia renderer

**Example:**
```typescript
// src/services/workflow/workflow-generator.ts

export function generateWorkflowMermaid(doc: PenDocument): string {
  const pages = doc.pages ?? []
  const connections = doc.connections ?? []
  const entities = doc.dataEntities ?? []

  const lines: string[] = ['flowchart LR']

  // Add screen nodes
  for (const page of pages.filter(p => p.type === 'screen' || !p.type)) {
    lines.push(`  ${page.id}["${page.name}"]`)
  }

  // Add connection edges
  for (const conn of connections) {
    const trigger = conn.triggerEvent
    const transition = conn.transitionType
    lines.push(`  ${conn.sourcePageId} -->|${trigger}:${transition}| ${conn.targetPageId}`)
  }

  // Add entity subgraph if any entities exist
  if (entities.length > 0) {
    lines.push('  subgraph Data')
    for (const entity of entities) {
      lines.push(`    ${entity.id}[("${entity.name}")]`)
    }
    lines.push('  end')
  }

  return lines.join('\n')
}
```

## Data Flow

### Existing Rendering Pipeline (v1.0)

```
User action (canvas/panel)
    │
    ▼
documentStore.updateNode()  ──→  historyStore.pushState()
    │
    ▼
SkiaEngine.syncFromDocument()
    │
    ▼
1. resolveRefs()           (RefNode → FrameNode content)
    │
    ▼
2. applyArgumentValues()   (ComponentArgument bindings)
    │
    ▼
3. resolveNodeForCanvas()  ($variable refs → concrete values)
    │
    ▼
4. premeasureTextHeights()  (Canvas 2D for text wrapping)
    │
    ▼
5. computeLayoutPositions() (Auto-layout: flexbox-like)
    │
    ▼
6. flattenToRenderNodes()   (Tree → absolute-coords flat list)
    │
    ▼
7. SkiaRenderer.draw()     (GPU draw calls, WebGL surface)
    │
    ▼
SpatialIndex.rebuild()     (R-tree for hit testing)
```

### Extended Pipeline for v1.1 Data Binding

```
documentStore.updateNode() / setDataBinding()
    │
    ▼
SkiaEngine.syncFromDocument()
    │
    ▼
1. resolveRefs()
    │
    ▼
2. applyArgumentValues()
    │
    ▼
3. resolveNodeForCanvas()    ($variable refs)
    │
    ▼
4. resolveDataBindings()     [NEW] (DataEntity rows → property values)
    │
    ▼
5. premeasureTextHeights()
    │   ... rest unchanged
```

### State Management for New Features

```
PenNode.dataBinding (in .pb file)
    │
    ├── SET via: documentStore.updateNode(id, { dataBinding: config })
    │           (uses existing updateNode — no new store action needed)
    │
    └── READ via: SkiaEngine.syncFromDocument() → resolveDataBindings()
                  DataBindingSection UI component

PenNode.contextNote (in .pb file)
    │
    ├── SET via: documentStore.updateNode(id, { contextNote: text })
    │
    └── READ via: ContextSection UI, ai-chat-handlers.ts buildContextString()

Preview HTML (ephemeral, not stored)
    │
    └── GENERATED: preview-generator.ts(doc) → HTML string → Blob URL → window.open()

Workflow Mermaid (derived, not stored)
    │
    └── GENERATED: workflow-generator.ts(doc) → Mermaid string → mermaid.render() → SVG
```

### Key Data Flows for Each Feature

1. **Data Binding setup:** User selects node → DataBindingSection renders entity selector → user picks entity + field mappings → `updateNode(id, { dataBinding: { entityId, fieldMap } })` → documentStore saves → SkiaEngine re-renders with bound values.

2. **Data Binding resolution:** `syncFromDocument()` calls `resolveDataBindingsInTree(nodes, doc.dataEntities)` → returns modified node tree with concrete values from sample row → rest of pipeline renders normally.

3. **Interactive Preview:** User clicks Preview button → `generatePreviewHtml(doc)` builds HTML with all screens and inlined navigation map → `openPreview(html)` opens Blob URL in new tab → browser renders interactive HTML app.

4. **Context Tab:** User selects element → clicks "Context" tab in RightPanel → `ContextSection` renders `PenNode.contextNote` in a textarea → changes call `updateNode(id, { contextNote })` → saved in document → AI chat reads it in `buildContextString()`.

5. **Workflow View:** User opens Workflow panel → `generateWorkflowMermaid(doc)` produces Mermaid string → Mermaid library renders to SVG → displayed in panel → auto-updates when document changes.

## Integration Points

### New vs. Modified: Explicit Breakdown

| Item | Type | What Changes |
|------|------|--------------|
| `src/types/pen.ts` | **MODIFIED** | Add `contextNote?: string`, `dataBinding?: DataBindingConfig` to `PenNodeBase` |
| `src/types/data-binding.ts` | **NEW** | `DataBindingConfig`, `DataBindingSource` type definitions |
| `src/data-binding/resolve-data-binding.ts` | **NEW** | Pure resolver function, mirrors `resolve-variables.ts` pattern |
| `src/canvas/skia/skia-engine.ts` | **MODIFIED** | Insert `resolveDataBindings()` call in `syncFromDocument()` pipeline (1 line + import) |
| `src/canvas/skia/argument-apply.ts` | **UNCHANGED** | `applyPropertyValue` reused as-is by data binding resolver |
| `src/components/panels/right-panel.tsx` | **MODIFIED** | Add 'context' tab + RightPanelTab type |
| `src/stores/canvas-store.ts` | **MODIFIED** | Add 'context' to `RightPanelTab` union type |
| `src/components/panels/property-panel.tsx` | **MODIFIED** | Add `DataBindingSection` and `ContextSection` rendering |
| `src/components/panels/data-binding-section.tsx` | **NEW** | Entity selector + field mapping UI |
| `src/components/panels/context-section.tsx` | **NEW** | contextNote textarea UI |
| `src/components/panels/workflow-panel.tsx` | **NEW** | Mermaid diagram display |
| `src/services/preview/preview-generator.ts` | **NEW** | PenDocument → interactive HTML |
| `src/services/preview/preview-bridge.ts` | **NEW** | window.open + Blob URL management |
| `src/services/workflow/workflow-generator.ts` | **NEW** | PenDocument → Mermaid string |
| `src/services/ai/ai-chat-handlers.ts` | **MODIFIED** | `buildContextString()` reads `node.contextNote` |
| `src/mcp/server.ts` | **MODIFIED** | Register 4 new tools |
| `src/mcp/tools/data-binding.ts` | **NEW** | MCP tool: get/set bindings for a node |
| `src/mcp/tools/preview.ts` | **NEW** | MCP tool: trigger preview generation |
| `src/mcp/tools/context.ts` | **NEW** | MCP tool: read/write contextNote |
| `src/mcp/tools/workflow.ts` | **NEW** | MCP tool: get workflow Mermaid |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `data-binding/` ↔ `canvas/skia/` | Function import (pure → impure) | resolver is pure, called from SkiaEngine |
| `data-binding/` ↔ `types/data-entity.ts` | Type import only | `DataEntity`, `DataRow` used as-is |
| `data-binding/` ↔ `canvas/skia/argument-apply.ts` | Function import | reuse `applyPropertyValue` |
| `preview/` ↔ `services/codegen/` | Pattern reuse (not direct import) | preview-generator reimplements traversal for HTML output, does not call react-generator directly |
| `workflow/` ↔ `types/pen.ts` | Type imports only | reads `PenDocument.connections`, `PenDocument.dataEntities`, `PenDocument.pages` |
| `context-section.tsx` ↔ `document-store` | `updateNode()` action | existing action handles all node field updates |
| `ai-chat-handlers.ts` ↔ `context-section` | Via document model | handler reads from `node.contextNote` directly, no coupling to UI |

### External Services / Dependencies

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Mermaid JS (`mermaid`) | Lazy import + `mermaid.render()` | Must be lazy-loaded to avoid ~460KB bundle impact on initial load |
| `html2canvas` (existing) | Already imported in `html-renderer.ts` | Preview generation does NOT use html2canvas — it generates actual HTML/CSS strings, not screenshots |

## Scaling Considerations

Since PenBoard is a **local-first, file-based** app, "scaling" means handling larger .pb files, not server load.

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1-10 screens, 1-5 entities | Current approach is fine; no optimizations needed |
| 10-50 screens, 10+ entities | `resolveDataBindingsInTree` should short-circuit when no bindings exist (check before iterating). Keep O(nodes) not O(nodes * entities). |
| 50+ screens | Preview generator must page-partition HTML (lazy screen init) or use same-page show/hide JS |

### Scaling Priorities

1. **First bottleneck:** `resolveDataBindingsInTree` called on every `syncFromDocument()`. Mitigation: cache entity lookup by id in a Map at the start of the call, and skip entirely if `doc.dataEntities` is empty.

2. **Second bottleneck:** Preview HTML generation with many screens. Mitigation: only generate the active screen + lazy-load others on navigation.

## Anti-Patterns

### Anti-Pattern 1: Storing Preview HTML in Document

**What people do:** Add `previewHtml?: string` to PenDocument and regenerate + store it.

**Why it's wrong:** Preview is a derived artifact, not source data. Storing it bloats the .pb file, creates stale cache issues, and couples the document model to a rendering concern.

**Do this instead:** Generate preview HTML on-demand (pure function, fast enough), open as Blob URL, never persist.

### Anti-Pattern 2: Adding New Data Binding Types Instead of Reusing Argument Apply

**What people do:** Implement a completely separate binding resolution system with its own property path parser.

**Why it's wrong:** `argument-apply.ts` already has `applyPropertyValue()` which handles all the property paths needed (`content`, `fill.0.color`, `visible`, `opacity`, `width`, `height`, `fontSize`, `gap`, etc.). Duplicating this is unnecessary complexity.

**Do this instead:** Import `applyPropertyValue` from `argument-apply.ts` in the new `resolve-data-binding.ts`. The two systems (ComponentArguments and DataBinding) are architecturally similar — both map abstract references to concrete node property values.

### Anti-Pattern 3: New Zustand Store for Data Binding State

**What people do:** Create `data-binding-store.ts` with its own state and actions.

**Why it's wrong:** Data binding configuration is part of the document (it lives in PenNode.dataBinding in the .pb file). It belongs in the document model, not in a separate store. The existing `documentStore.updateNode()` action already handles all node field updates with history.

**Do this instead:** Store binding config in `PenNode.dataBinding` field. Access via existing `documentStore.getNodeById()` and `documentStore.updateNode()`. No new store needed.

### Anti-Pattern 4: Extending ScreenConnection for Data Flow

**What people do:** Try to represent data flows (entity → screen) as connections by adding fields to `ScreenConnection`.

**Why it's wrong:** `ScreenConnection` models UI navigation (screen A click → goes to screen B). Data flow (entity X feeds component Y) is a different concern with different semantics. Mixing them creates an ambiguous model.

**Do this instead:** Data flows are expressed through `PenNode.dataBinding.entityId` on individual nodes. The workflow generator derives the data flow diagram from these bindings, not from connections.

### Anti-Pattern 5: Implementing Workflow as a New Page Type with Skia Rendering

**What people do:** Add `type: 'workflow'` to PenPage and implement a `SkiaWorkflowRenderer` similar to `SkiaErdRenderer`.

**Why it's wrong:** The workflow diagram is a derived read-only view, not an editable canvas. Building a full Skia renderer for it is 3-4x the work of using Mermaid. Mermaid handles layout automatically. The ERD renderer exists because ERD items need to be interactive (draggable, editable positions).

**Do this instead:** Use Mermaid in a React panel (lazy-loaded). Display as SVG. This is the correct tool for the job.

## Suggested Build Order

Based on dependencies between features:

1. **Data Binding types + resolver** (`data-binding.ts`, `resolve-data-binding.ts`) — Pure foundation, no UI deps. Other features (MCP tools, preview) depend on this being correct.

2. **DataBindingSection UI + SkiaEngine integration** — Connects the resolver to the canvas pipeline. Users can see data bound designs immediately. Validates the resolver against real data.

3. **Context Note field + ContextSection + AI chat integration** — Simple field on PenNode, minimal changes. Delivers AI context improvement early. No deps on data binding.

4. **Interactive Preview** — Depends on understanding how data binding resolves (step 1) so preview can inline correct sample data. The HTML generator must handle both bound and unbound nodes.

5. **Workflow Diagram** — Depends on all connections being final. Pure derivation from existing document data. Can be built at any point but benefits from having data binding in place to show entity→screen relationships.

6. **MCP tools for all 4 features** — Add last, after all UI flows are working. MCP tools are thin wrappers over the same logic used by the UI.

## Sources

- Source code: `D:\Workspace\Messi\Code\PenBoard\src\types\pen.ts` (verified 2026-03-17)
- Source code: `D:\Workspace\Messi\Code\PenBoard\src\types\data-entity.ts` (verified 2026-03-17)
- Source code: `D:\Workspace\Messi\Code\PenBoard\src\canvas\skia\argument-apply.ts` (verified 2026-03-17)
- Source code: `D:\Workspace\Messi\Code\PenBoard\src\canvas\skia\skia-engine.ts` (verified 2026-03-17)
- Source code: `D:\Workspace\Messi\Code\PenBoard\src\variables\resolve-variables.ts` (verified 2026-03-17)
- Source code: `D:\Workspace\Messi\Code\PenBoard\src\components\panels\right-panel.tsx` (verified 2026-03-17)
- Source code: `D:\Workspace\Messi\Code\PenBoard\src\stores\canvas-store.ts` (verified 2026-03-17)
- Source code: `D:\Workspace\Messi\Code\PenBoard\src\mcp\server.ts` (verified 2026-03-17)
- Source code: `D:\Workspace\Messi\Code\PenBoard\src\services\ai\html-renderer.ts` (verified 2026-03-17)
- Source code: `D:\Workspace\Messi\Code\PenBoard\src\stores\document-store-connections.ts` (verified 2026-03-17)
- Source code: `D:\Workspace\Messi\Code\PenBoard\src\stores\document-store-data.ts` (verified 2026-03-17)

---
*Architecture research for: PenBoard v1.1 Data-Driven Design feature integration*
*Researched: 2026-03-17*
