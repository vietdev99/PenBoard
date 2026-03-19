# Phase 8: Workflow Visualization - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Auto-generated workflow diagram showing screen connections, data binding relationships, and entity relations. Displayed in a dedicated bottom panel with focus mode, zoom/pan, click-to-navigate, and export (mermaid/SVG/PNG). The diagram is a derived read-only view — not an editable canvas.

Requirements: WF-01, WF-02, WF-03

</domain>

<decisions>
## Implementation Decisions

### Diagram Content & Edges
- **Three edge types** in the diagram:
  1. **Screen connections** (ScreenConnection[]) — arrows between pages with trigger+transition labels (e.g. "click -> push")
  2. **Data binding edges** — dashed lines from DataEntity nodes to pages containing bound components
  3. **Entity relation edges** — lines between DataEntity nodes showing relation fields
- **Node types**:
  - Screen pages = nodes with page name + thumbnail screenshot
  - Data entities = separate entity nodes (different style/color from screen nodes)
- **Edge labels**: Show `trigger -> transition` for screen connections (e.g. "click -> push", "hover -> modal")
- **No edge labels** for data binding and entity relation edges (style/color differentiates)

### Rendering Technology
- **Mermaid.js** for diagram generation — renders flowchart/graph syntax to SVG
- **Thumbnails**: Canvas screenshots from SkiaEngine for each page, embedded in diagram nodes
- Note: Mermaid.js has limited support for images in nodes — researcher should investigate hybrid approach (mermaid for layout + custom SVG overlay for thumbnails, or alternative like mermaid with HTML nodes)

### Panel Placement
- **Dedicated bottom panel** below the canvas area
- Resizable height (drag handle on top edge)
- Collapsible (toggle button to show/hide)
- Panel header with: title "Workflow", focus mode toggle, export buttons, zoom controls

### Focus Mode
- **Enabled by default** when panel opens
- Shows **active page + 1-hop neighbors** (pages directly connected in either direction)
- Data entities connected to visible pages also shown
- **Toggle button** in panel header to switch between focus and full view
- Full view shows entire project graph
- Focus mode auto-updates when user switches pages (activePageId changes)

### Click-to-Navigate
- **Click a page node** in diagram -> `setActivePageId()` -> canvas switches to that page
- Click an entity node -> navigate to ERD page (if exists)
- Focus mode re-centers on the newly active page after navigation

### Zoom & Pan
- **Scroll to zoom** in diagram panel
- **Drag to pan** across the diagram
- CSS transform on SVG element for smooth zoom/pan
- "Fit to view" button to reset zoom

### Export
- **Mermaid text** — copy mermaid syntax to clipboard (for docs, README, etc.)
- **SVG export** — download rendered SVG file
- **PNG export** — rasterize SVG to PNG and download
- Export buttons in panel header toolbar

### Auto-Update (WF-03)
- Diagram re-generates when connections, data bindings, or entities change
- **Debounced** (500ms) to avoid excessive re-renders during editing
- Subscribe to document-store changes (same pattern as preview hot reload)

### Claude's Discretion
- Mermaid graph direction (TB/LR) — pick based on typical storyboard layouts
- Color scheme for different node/edge types — use existing design tokens
- Entity node shape/style differentiation from screen nodes
- Thumbnail size and quality settings

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Data Model
- `src/types/pen.ts` — ScreenConnection interface, PenDocument.connections[], PenDocument.dataEntities[]
- `src/types/data-entity.ts` — DataEntity, DataBinding, DataRelation types

### Existing Connection Code
- `src/components/panels/navigate-panel.tsx` — Connection management UI (has page/entity querying patterns)
- `src/components/panels/connection-section.tsx` — Connection property editing
- `src/stores/document-store.ts` — Connection CRUD actions, document subscriptions

### Canvas Screenshot
- `src/services/ai/design-screenshot.ts` — Existing canvas screenshot capture utility
- `src/canvas/skia/skia-engine.ts` — SkiaEngine class, potential for per-page screenshot

### Panel Patterns
- `src/components/panels/variables-panel.tsx` — Floating/resizable panel pattern
- `src/components/editor/editor-layout.tsx` — Editor layout structure (where bottom panel would go)

### Preview Hot Reload Pattern
- `src/hooks/use-preview.ts` — Document subscription + debounced update pattern (reuse for auto-update)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ScreenConnection[]` and `DataEntity[]` already on PenDocument — data source ready
- `navigate-panel.tsx` has page querying/connection listing logic — patterns to reuse
- `design-screenshot.ts` has canvas capture — can adapt for page thumbnails
- `use-preview.ts` has document subscription + debounce pattern — reuse for auto-update
- `variables-panel.tsx` has resizable floating panel pattern
- `editor-layout.tsx` manages canvas + panel layout — integration point for bottom panel

### Established Patterns
- Zustand store subscriptions for reactive updates (document-store → UI)
- Debounced 500ms for expensive operations (preview hot reload precedent)
- Panel toggle state in canvas-store (variablesPanelOpen pattern)
- Active page tracking via canvas-store.activePageId

### Integration Points
- `editor-layout.tsx` — Add bottom panel container below canvas
- `canvas-store.ts` — Add `workflowPanelOpen` toggle state
- `document-store.ts` — Subscribe to connection/entity changes for auto-update
- Phase 9 (MCP) — Mermaid text export will be consumed by MCP-04 tool

</code_context>

<specifics>
## Specific Ideas

- Diagram should feel like a "project map" — users see their entire app flow at a glance
- Thumbnails make nodes recognizable without reading labels (visual recognition)
- Entity nodes should look distinct from screen nodes (different shape or color)
- The bottom panel approach is similar to browser DevTools — familiar pattern

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-workflow-visualization*
*Context gathered: 2026-03-19*
