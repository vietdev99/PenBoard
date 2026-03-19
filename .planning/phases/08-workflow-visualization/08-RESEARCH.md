# Phase 8: Workflow Visualization - Research

**Researched:** 2026-03-19
**Domain:** Diagram rendering (Mermaid.js), reactive panel UI, document graph derivation
**Confidence:** HIGH

## Summary

Phase 8 implements a read-only workflow diagram panel that visualizes screen connections, data binding edges, and entity relationships from the existing PenDocument model. The data model is already complete -- `PenDocument.connections[]` (ScreenConnection), `PenDocument.dataEntities[]` (DataEntity with relation fields), and `PenNode.dataBinding` are all available in document-store. The main engineering work is: (1) deriving a graph model from these sources, (2) rendering it with Mermaid.js, (3) building the bottom panel UI with zoom/pan/focus, and (4) wiring reactive auto-updates.

Mermaid.js v11.x provides a programmatic `mermaid.render()` API that returns raw SVG strings, which is ideal for React integration. It supports flowchart syntax with `classDef` styling, click callbacks, edge labels, image nodes (via `@{ img: ... }` syntax), and multiple layout directions (LR/TB). The CONTEXT.md notes that thumbnails in Mermaid nodes may have limitations -- research confirms that Mermaid's image nodes work with URL-based images (including base64 data URLs), but sizing control is limited and images don't render inline with text well. The recommended approach is: use Mermaid for graph layout/rendering, then optionally enhance with a lightweight SVG overlay for thumbnail-quality page previews.

**Primary recommendation:** Use `mermaid` npm package (v11.x) directly with `mermaid.render()` API. No wrapper library needed -- a custom React hook of ~50 lines handles rendering. Build the bottom panel as a new docked component in `editor-layout.tsx` with CSS transform zoom/pan on the rendered SVG.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Three edge types**: Screen connections (solid arrows with trigger->transition labels), data binding edges (dashed lines from entities to pages), entity relation edges (lines between entity nodes)
- **Node types**: Screen pages (with page name + thumbnail) and Data entities (different style/color)
- **Mermaid.js** for diagram generation
- **Dedicated bottom panel** below canvas area, resizable height, collapsible
- **Focus mode enabled by default**: active page + 1-hop neighbors + connected entities
- **Click-to-navigate**: Click page node -> setActivePageId(), click entity -> navigate to ERD page
- **Zoom & Pan**: Scroll zoom + drag pan on SVG, CSS transform approach
- **Export**: Mermaid text (clipboard), SVG download, PNG download
- **Auto-update debounced 500ms**: Subscribe to document-store changes
- Panel header with: title "Workflow", focus mode toggle, export buttons, zoom controls

### Claude's Discretion
- Mermaid graph direction (TB/LR) -- recommend LR for storyboard layouts
- Color scheme for node/edge types -- use existing design tokens
- Entity node shape/style differentiation from screen nodes
- Thumbnail size and quality settings

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| WF-01 | Panel/tab displays auto-generated mermaid diagram from screen connections and data flows | Mermaid.js v11.x `mermaid.render()` API generates SVG from flowchart syntax; graph model derives from `PenDocument.connections[]`, `PenDocument.dataEntities[]`, `PenNode.dataBinding` |
| WF-02 | Focus mode shows only connections of active page to avoid layout explosion | Graph filtering function: given `activePageId`, collect 1-hop neighbor pages via connections, plus entities bound to visible pages; regenerate mermaid syntax with filtered subset |
| WF-03 | Workflow diagram updates automatically when connections or data bindings change | Zustand `useDocumentStore.subscribe()` with 500ms debounce pattern (proven in `use-preview.ts`) triggers diagram regeneration |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| mermaid | ^11.13.0 | Diagram rendering (flowchart -> SVG) | De facto standard for text-to-diagram; supports click callbacks, classDef, image nodes, programmatic render API |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zustand | ^5.0.11 (existing) | Reactive state for panel open/close, focus mode, zoom | Already in project, consistent with all other panels |
| lucide-react | ^0.545.0 (existing) | Panel header icons (Workflow, Focus, Export, Zoom) | Already in project, consistent with toolbar/panels |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| mermaid.js | D3.js / ReactFlow / Dagre | D3/ReactFlow are more flexible but require building all graph rendering from scratch; Mermaid provides layout + rendering + export syntax in one package, matching the requirement for "mermaid diagram" export |
| react-x-mermaid | Direct mermaid API | Wrapper libraries add abstraction without value; direct API is simpler and avoids stale dependency risk |
| Custom SVG renderer | Mermaid layout + custom overlay | Full custom would give better thumbnail control but 5x the work for v1.1; can enhance later |

**Installation:**
```bash
bun add mermaid
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── services/workflow/
│   ├── workflow-graph-builder.ts      # Derive graph model from PenDocument
│   ├── workflow-mermaid-generator.ts  # Convert graph model to Mermaid syntax string
│   └── workflow-export.ts             # SVG/PNG/Mermaid text export utilities
├── hooks/
│   └── use-workflow-diagram.ts        # React hook: subscribe, debounce, render
├── components/panels/
│   └── workflow-panel.tsx             # Bottom panel UI (header, SVG container, zoom/pan)
├── stores/
│   └── canvas-store.ts               # Add workflowPanelOpen toggle + workflowFocusMode state
└── components/editor/
    └── editor-layout.tsx              # Integration point for bottom panel
```

### Pattern 1: Graph Model Derivation
**What:** Pure function that reads PenDocument and produces a typed graph model (nodes + edges)
**When to use:** Every time the diagram needs regeneration
**Example:**
```typescript
// Source: Custom pattern based on existing PenDocument model

interface WorkflowNode {
  id: string
  type: 'page' | 'entity'
  label: string
  pageType?: 'screen' | 'erd' | 'component'
}

interface WorkflowEdge {
  id: string
  source: string
  target: string
  type: 'connection' | 'data-binding' | 'entity-relation'
  label?: string  // "click -> push" for connections
}

interface WorkflowGraph {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}

function buildWorkflowGraph(doc: PenDocument): WorkflowGraph {
  const nodes: WorkflowNode[] = []
  const edges: WorkflowEdge[] = []

  // 1. Pages -> nodes
  for (const page of doc.pages ?? []) {
    nodes.push({ id: page.id, type: 'page', label: page.name, pageType: page.type })
  }

  // 2. Data entities -> nodes
  for (const entity of doc.dataEntities ?? []) {
    nodes.push({ id: entity.id, type: 'entity', label: entity.name })
  }

  // 3. Screen connections -> edges
  for (const conn of doc.connections ?? []) {
    edges.push({
      id: conn.id,
      source: conn.sourcePageId,
      target: conn.targetPageId,
      type: 'connection',
      label: `${conn.triggerEvent} -> ${conn.transitionType}`,
    })
  }

  // 4. Data bindings -> edges (scan all pages for nodes with dataBinding)
  // Walk each page's children, find nodes with dataBinding.entityId
  // Create edge from entityId -> page.id (deduplicated per entity-page pair)

  // 5. Entity relations -> edges
  // Walk entity.fields, find type='relation' with relatedEntityId
  // Create edge from entity.id -> relatedEntityId

  return { nodes, edges }
}
```

### Pattern 2: Mermaid Syntax Generation
**What:** Convert WorkflowGraph to Mermaid flowchart string
**When to use:** After graph model is built, before render
**Example:**
```typescript
// Source: Mermaid flowchart syntax docs (https://mermaid.js.org/syntax/flowchart.html)

function generateMermaidSyntax(
  graph: WorkflowGraph,
  direction: 'LR' | 'TB' = 'LR',
): string {
  const lines: string[] = [`flowchart ${direction}`]

  // Class definitions for styling
  lines.push('  classDef pageNode fill:var(--card),stroke:var(--border),color:var(--foreground)')
  lines.push('  classDef entityNode fill:var(--accent),stroke:var(--border),color:var(--accent-foreground),stroke-dasharray:5 5')
  lines.push('  classDef activePage fill:var(--primary),stroke:var(--primary),color:var(--primary-foreground)')

  // Nodes
  for (const node of graph.nodes) {
    if (node.type === 'page') {
      lines.push(`  ${node.id}["${escapeLabel(node.label)}"]:::pageNode`)
    } else {
      lines.push(`  ${node.id}[("${escapeLabel(node.label)}")]:::entityNode`)
    }
  }

  // Edges
  for (const edge of graph.edges) {
    if (edge.type === 'connection') {
      lines.push(`  ${edge.source} -->|"${escapeLabel(edge.label ?? '')}"| ${edge.target}`)
    } else if (edge.type === 'data-binding') {
      lines.push(`  ${edge.source} -.-> ${edge.target}`)
    } else if (edge.type === 'entity-relation') {
      lines.push(`  ${edge.source} --- ${edge.target}`)
    }
  }

  return lines.join('\n')
}
```

### Pattern 3: React Hook for Mermaid Rendering
**What:** Custom hook that manages the full render lifecycle
**When to use:** In WorkflowPanel component
**Example:**
```typescript
// Source: Mermaid API docs (https://mermaid.js.org/config/usage.html)

import mermaid from 'mermaid'

// Initialize once
mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'loose',  // Required for click callbacks
  theme: 'base',           // Use base theme + custom classDef colors
  flowchart: { curve: 'basis' },
})

function useWorkflowDiagram() {
  const svgRef = useRef<string>('')
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)
  const renderIdRef = useRef(0)

  // Subscribe to document changes
  useEffect(() => {
    const unsub = useDocumentStore.subscribe(() => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => regenerate(), 500)
    })
    return () => { unsub(); if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [])

  async function regenerate() {
    const doc = useDocumentStore.getState().document
    const graph = buildWorkflowGraph(doc)
    // Apply focus filter if needed
    const filtered = focusMode ? filterToFocusGraph(graph, activePageId) : graph
    const syntax = generateMermaidSyntax(filtered)
    const id = `wf-${++renderIdRef.current}`
    const { svg, bindFunctions } = await mermaid.render(id, syntax)
    svgRef.current = svg
    // bindFunctions will be called after inserting SVG into DOM
  }
}
```

### Pattern 4: Bottom Panel Layout (Docked, Resizable)
**What:** Panel docked below the canvas, not floating like variables-panel
**When to use:** This is the main UI container
**Example:**
```typescript
// Integration in editor-layout.tsx
// The panel sits between the canvas area and the bottom of the editor

<div className="flex-1 flex flex-col overflow-hidden">
  <div className="flex-1 flex overflow-hidden">
    {/* existing: layer panel, canvas, right panel */}
  </div>
  {/* NEW: Bottom workflow panel */}
  {workflowPanelOpen && <WorkflowPanel />}
</div>
```

The panel should use a vertical resize handle on its top edge:
```typescript
// Panel structure
<div style={{ height: panelHeight }} className="border-t border-border bg-card flex flex-col">
  {/* Resize handle */}
  <div className="h-1.5 cursor-ns-resize hover:bg-primary/10" onPointerDown={...} />
  {/* Header: title, focus toggle, export, zoom */}
  <div className="h-10 flex items-center px-4 border-b border-border/40">...</div>
  {/* SVG container with zoom/pan */}
  <div className="flex-1 overflow-hidden" ref={containerRef}>
    <div style={{ transform: `scale(${zoom}) translate(${panX}px, ${panY}px)` }}
         dangerouslySetInnerHTML={{ __html: svgContent }} />
  </div>
</div>
```

### Pattern 5: Focus Mode Graph Filtering
**What:** Filter full graph to active page + 1-hop neighbors
**When to use:** When focus mode is enabled (default)
**Example:**
```typescript
function filterToFocusGraph(graph: WorkflowGraph, activePageId: string): WorkflowGraph {
  // Find 1-hop neighbor page IDs via edges
  const neighborIds = new Set<string>([activePageId])
  for (const edge of graph.edges) {
    if (edge.source === activePageId) neighborIds.add(edge.target)
    if (edge.target === activePageId) neighborIds.add(edge.source)
  }

  // Include entity nodes connected to visible pages
  const visibleNodeIds = new Set(neighborIds)
  for (const edge of graph.edges) {
    if (edge.type === 'data-binding' || edge.type === 'entity-relation') {
      if (neighborIds.has(edge.source)) visibleNodeIds.add(edge.target)
      if (neighborIds.has(edge.target)) visibleNodeIds.add(edge.source)
    }
  }

  const filteredNodes = graph.nodes.filter(n => visibleNodeIds.has(n.id))
  const filteredEdges = graph.edges.filter(
    e => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)
  )
  return { nodes: filteredNodes, edges: filteredEdges }
}
```

### Anti-Patterns to Avoid
- **Mutating SVG DOM directly in React**: Always use `dangerouslySetInnerHTML` or ref-based insertion; never mix React virtual DOM with direct Mermaid DOM manipulation
- **Re-rendering on every keystroke**: Debounce at 500ms is critical; Mermaid render is async and ~50-200ms for medium graphs
- **Embedding full Mermaid in bundle without tree-shaking**: Import only `mermaid` core; diagram types are auto-registered. The mermaid package is ~800KB gzipped -- consider lazy loading
- **Using mermaid.run() for dynamic content**: `mermaid.run()` scans DOM elements; use `mermaid.render()` for programmatic control in React
- **Storing SVG in Zustand state**: SVG strings can be large; store in local ref, not global state

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Graph layout algorithm | Custom force-directed / DAG layout | Mermaid.js internal Dagre/ELK layout | Graph layout is deceptively complex; Mermaid handles it with battle-tested algorithms |
| SVG rendering of nodes/edges | Custom SVG path generation | Mermaid flowchart renderer | Edge routing, label placement, arrow heads are all handled |
| Mermaid syntax parsing/validation | Custom parser | `mermaid.parse()` API | Built-in validation before render |
| SVG to PNG conversion | Custom Canvas rasterization | Standard SVG -> Canvas -> Blob pipeline | Well-known pattern: create Image from SVG blob URL, draw to Canvas, toBlob() |

**Key insight:** Mermaid.js encapsulates the entire diagram pipeline (syntax -> layout -> SVG). Hand-rolling any part would multiply scope significantly. The only custom code needed is: graph model extraction from PenDocument, mermaid syntax string building, and the panel UI shell.

## Common Pitfalls

### Pitfall 1: Mermaid Node ID Conflicts
**What goes wrong:** Mermaid node IDs must be unique within a diagram and cannot contain special characters. PenBoard uses nanoid-generated IDs that may start with numbers or contain characters Mermaid doesn't allow.
**Why it happens:** Mermaid parses IDs as part of its syntax and has reserved words.
**How to avoid:** Sanitize all IDs before inserting into Mermaid syntax. Prefix with `p_` for pages, `e_` for entities. Maintain a bidirectional map (mermaidId <-> originalId) for click callbacks.
**Warning signs:** Mermaid `parse()` errors, nodes not rendering, click handlers firing with wrong IDs.

### Pitfall 2: React + Mermaid DOM Conflict
**What goes wrong:** Mermaid renders SVG by inserting elements into the real DOM. React's reconciler doesn't know about these changes and may remove/conflict with them.
**Why it happens:** Two systems (React + Mermaid) try to own the same DOM subtree.
**How to avoid:** Use `mermaid.render(id, syntax)` which returns SVG as a string WITHOUT inserting into DOM. Then use `dangerouslySetInnerHTML={{ __html: svg }}` or insert via `ref.current.innerHTML = svg` followed by `bindFunctions(ref.current)` for click events.
**Warning signs:** Diagram disappears after React re-render, click handlers stop working.

### Pitfall 3: Mermaid Bundle Size
**What goes wrong:** Mermaid.js is ~800KB gzipped due to including all diagram types (sequence, gantt, etc.).
**Why it happens:** We only need flowchart, but the package bundles everything.
**How to avoid:** Use dynamic `import('mermaid')` to lazy-load the library only when the workflow panel opens for the first time. This keeps the initial bundle clean.
**Warning signs:** Increased build size, slower initial page load.

### Pitfall 4: CSS Variable Resolution in SVG
**What goes wrong:** Mermaid `classDef` styles use CSS values, but SVG elements may not inherit CSS custom properties from the host document depending on how they're embedded.
**Why it happens:** Inline SVG inherits CSS; `<img src="blob:...">` does not.
**How to avoid:** Insert SVG as inline HTML (dangerouslySetInnerHTML), NOT as an `<img>` source. This ensures CSS custom properties (`var(--card)`, `var(--border)`) resolve correctly from the host page's styles.
**Warning signs:** All nodes appear with default Mermaid colors instead of the application theme.

### Pitfall 5: Empty Graph / No Connections
**What goes wrong:** If user has no connections or entities, Mermaid render fails or produces empty output.
**Why it happens:** Mermaid requires at least one node in a flowchart.
**How to avoid:** Detect empty graph before render and show an empty state placeholder ("No connections yet. Add connections between pages to see the workflow diagram.") instead of calling mermaid.render().
**Warning signs:** Console errors from Mermaid, blank panel.

### Pitfall 6: Focus Mode Auto-Update Race
**What goes wrong:** When user clicks a page node to navigate, `activePageId` changes, which triggers both page switch AND focus mode re-filter, causing a brief flash of wrong content.
**Why it happens:** Two state updates (activePageId + diagram regeneration) happen asynchronously.
**How to avoid:** Batch the navigation + regeneration: first update activePageId, then the 500ms debounce will naturally pick up the new focus context. Don't regenerate synchronously on click.
**Warning signs:** Diagram flashes between full view and focus view during navigation.

## Code Examples

### Mermaid Initialization and Rendering
```typescript
// Source: Mermaid API docs (https://mermaid.js.org/config/usage.html)
import mermaid from 'mermaid'

mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'loose',
  theme: 'base',
  themeVariables: {
    // Will be overridden by classDef, but set sensible defaults
    primaryColor: 'hsl(var(--card))',
    primaryBorderColor: 'hsl(var(--border))',
    lineColor: 'hsl(var(--muted-foreground))',
  },
  flowchart: {
    curve: 'basis',
    padding: 20,
    nodeSpacing: 60,
    rankSpacing: 80,
  },
})

// Render returns SVG string, does NOT touch DOM
const { svg, bindFunctions } = await mermaid.render('wf-1', syntaxString)

// Insert into DOM via React ref
containerRef.current.innerHTML = svg
// Bind click callbacks AFTER insertion
if (bindFunctions) bindFunctions(containerRef.current)
```

### Click Callback Registration in Mermaid Syntax
```typescript
// Source: Mermaid flowchart docs (https://mermaid.js.org/syntax/flowchart.html)

// Define callback function globally (Mermaid requires window-scoped callbacks)
;(window as any).__wfNavigate = (nodeId: string) => {
  const originalId = mermaidIdMap.get(nodeId)
  if (!originalId) return
  // Navigate to page or entity
  const doc = useDocumentStore.getState().document
  const page = doc.pages?.find(p => p.id === originalId)
  if (page) {
    useCanvasStore.getState().setActivePageId(originalId)
  } else {
    // Entity node -- navigate to ERD page
    const erdPage = doc.pages?.find(p => p.type === 'erd')
    if (erdPage) useCanvasStore.getState().setActivePageId(erdPage.id)
  }
}

// In generated syntax, add click directives:
// click p_abc123 __wfNavigate
```

### SVG to PNG Export
```typescript
// Source: Standard Web API pattern

async function exportDiagramAsPng(svgElement: SVGElement): Promise<Blob> {
  const svgData = new XMLSerializer().serializeToString(svgElement)
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)

  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = reject
    img.src = url
  })

  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth * 2  // 2x for retina
  canvas.height = img.naturalHeight * 2
  const ctx = canvas.getContext('2d')!
  ctx.scale(2, 2)
  ctx.drawImage(img, 0, 0)
  URL.revokeObjectURL(url)

  return new Promise((resolve) => canvas.toBlob(resolve!, 'image/png'))
}
```

### Zoom/Pan with CSS Transform
```typescript
// Source: Common pattern used across design tools

function useZoomPan(containerRef: React.RefObject<HTMLDivElement>) {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const isPanning = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setZoom(z => Math.max(0.1, Math.min(5, z * delta)))
  }, [])

  const handlePointerDown = useCallback((e: PointerEvent) => {
    isPanning.current = true
    lastPos.current = { x: e.clientX, y: e.clientY }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [])

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!isPanning.current) return
    const dx = e.clientX - lastPos.current.x
    const dy = e.clientY - lastPos.current.y
    lastPos.current = { x: e.clientX, y: e.clientY }
    setPan(p => ({ x: p.x + dx, y: p.y + dy }))
  }, [])

  const handlePointerUp = useCallback(() => { isPanning.current = false }, [])

  // "Fit to view" resets zoom and centers
  const fitToView = useCallback(() => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [])

  return { zoom, pan, fitToView, handleWheel, handlePointerDown, handlePointerMove, handlePointerUp }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `mermaidAPI.render(id, def, callback)` | `mermaid.render(id, def)` returns Promise | Mermaid v10+ (2023) | Must use await, not callback |
| `mermaid.init()` scans DOM | `mermaid.run({ querySelector })` or `mermaid.render()` | Mermaid v10+ (2023) | Prefer render() for React |
| `flowchart.htmlLabels` config | Root-level `htmlLabels` config | Mermaid v11 (2024) | Old key deprecated |
| Mermaid CSS theme classes | `classDef` + `:::className` inline | Stable since v8 | Use classDef for node styling |
| Image in node via `<img>` HTML | `@{ img: "url" }` shape syntax | Mermaid v11+ (2024) | Native image node support |

**Deprecated/outdated:**
- `mermaid.init()` -- use `mermaid.run()` or `mermaid.render()` instead
- `flowchart.htmlLabels` config key -- use root-level `htmlLabels`
- Callback-based render API -- use Promise-based `mermaid.render()`

## Design Decisions (Claude's Discretion)

### Graph Direction: LR (Left-to-Right)
**Rationale:** Storyboard workflows naturally read left-to-right (screen flow = user journey progression). LR layout maps to how designers think about screen sequences. TB would work but wastes horizontal space in the bottom panel.

### Color Scheme (using existing design tokens)
| Element | Style |
|---------|-------|
| Screen page node | `bg-card`, `border-border`, `text-foreground` (standard card appearance) |
| Active page node | `bg-primary`, `border-primary`, `text-primary-foreground` (highlighted) |
| Entity node | `bg-accent`, `border-border`, dashed stroke (visually distinct) |
| Connection edge | Solid arrow, `stroke: hsl(var(--foreground))` |
| Data binding edge | Dashed line, `stroke: hsl(var(--muted-foreground))` |
| Entity relation edge | Dotted line, `stroke: hsl(var(--muted-foreground))` |

### Entity Node Shape
Use cylindrical shape (database icon) in Mermaid: `entityId[("Entity Name")]` -- this is the standard Mermaid shape for databases/data stores and immediately communicates "data" vs "screen."

### Thumbnails
For v1.1, use text-only nodes (page name + icon). The `design-screenshot.ts` currently returns null (pending CanvasKit migration), and building offscreen CanvasKit rendering is out of scope. Text labels with the active page highlighted are sufficient for navigation. Thumbnails can be added in a future enhancement when CanvasKit offscreen rendering is available.

## Open Questions

1. **Mermaid theme integration with Tailwind CSS v4**
   - What we know: Mermaid `classDef` supports CSS values; inline SVG inherits host CSS custom properties
   - What's unclear: Whether `hsl(var(--card))` syntax works directly in Mermaid's `classDef fill:` property, or if we need to resolve values at render time
   - Recommendation: Test during implementation. If CSS variables don't resolve, compute actual color values from `getComputedStyle()` and inject into classDef. Fallback is straightforward.

2. **Mermaid bundle size impact**
   - What we know: ~800KB gzipped, includes all diagram types
   - What's unclear: Whether Vite tree-shaking eliminates unused diagram types
   - Recommendation: Use dynamic `import('mermaid')` on first panel open. Measure bundle impact after implementation.

3. **Large graph performance**
   - What we know: Mermaid layout algorithm is O(n log n) for Dagre; typical PenBoard projects have 5-20 pages
   - What's unclear: Performance with 50+ pages and 100+ connections
   - Recommendation: Focus mode (default) naturally limits rendered nodes. If full view is slow for large projects, add a max node count warning.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x |
| Config file | `vitest.config.ts` |
| Quick run command | `bun --bun vitest run src/__tests__/workflow/ -x` |
| Full suite command | `bun --bun run test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WF-01 | Graph model builds correctly from PenDocument (connections, entities, bindings) | unit | `bun --bun vitest run src/__tests__/workflow/workflow-graph-builder.test.ts -x` | Wave 0 |
| WF-01 | Mermaid syntax generated correctly from graph model | unit | `bun --bun vitest run src/__tests__/workflow/workflow-mermaid-generator.test.ts -x` | Wave 0 |
| WF-02 | Focus mode filters graph to active page + 1-hop neighbors | unit | `bun --bun vitest run src/__tests__/workflow/workflow-focus-filter.test.ts -x` | Wave 0 |
| WF-03 | Debounced auto-update triggers regeneration on document changes | unit | `bun --bun vitest run src/__tests__/workflow/workflow-auto-update.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `bun --bun vitest run src/__tests__/workflow/ -x`
- **Per wave merge:** `bun --bun run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/workflow/workflow-graph-builder.test.ts` -- covers WF-01 (graph derivation)
- [ ] `src/__tests__/workflow/workflow-mermaid-generator.test.ts` -- covers WF-01 (syntax generation)
- [ ] `src/__tests__/workflow/workflow-focus-filter.test.ts` -- covers WF-02 (focus mode filtering)
- [ ] `src/__tests__/workflow/workflow-auto-update.test.ts` -- covers WF-03 (debounced updates)

## Sources

### Primary (HIGH confidence)
- [Mermaid Flowchart Syntax](https://mermaid.js.org/syntax/flowchart.html) -- node shapes, edge labels, click handlers, classDef, image nodes, layout directions
- [Mermaid Usage / API](https://mermaid.js.org/config/usage.html) -- `mermaid.render()` API, securityLevel, configuration, bindFunctions
- [Mermaid npm package](https://www.npmjs.com/package/mermaid) -- latest version 11.13.0
- PenBoard codebase -- `src/types/pen.ts` (ScreenConnection, PenDocument.connections, PenDocument.dataEntities), `src/types/data-entity.ts` (DataEntity, DataField.relatedEntityId), `src/stores/document-store-connections.ts` (getConnectionsForPage pattern), `src/hooks/use-preview.ts` (debounced document subscription pattern), `src/components/panels/variables-panel.tsx` (resizable panel pattern), `src/components/editor/editor-layout.tsx` (editor layout integration point), `src/stores/canvas-store.ts` (panel toggle pattern)

### Secondary (MEDIUM confidence)
- [Mermaid GitHub Issues #1133, #5010](https://github.com/mermaid-js/mermaid/issues/1133) -- image in node limitations, inline display issues
- [Mermaid Custom SVG Shapes](https://mermaid.js.org/adding-new-shape.html) -- `@{ img: }` syntax documentation
- [DEV.to React+Mermaid integration](https://dev.to/navdeepm20/how-i-rendered-mermaid-diagrams-in-react-and-built-a-library-for-it-c4d) -- React virtual DOM conflict patterns and solutions

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Mermaid.js is the de facto standard; user explicitly locked this choice; API is well-documented
- Architecture: HIGH -- All data sources exist in PenDocument; patterns (panel toggle, debounced subscription) are proven in codebase
- Pitfalls: HIGH -- Mermaid+React conflicts are well-documented in community; bundle size and CSS inheritance are known issues with clear solutions

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable technology, 30-day window)
