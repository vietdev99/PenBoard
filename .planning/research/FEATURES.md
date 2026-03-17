# Feature Research

**Domain:** Data-Driven Design Tool (v1.1 milestone — adding data binding, preview, AI context, workflow visualization)
**Researched:** 2026-03-17
**Confidence:** MEDIUM (industry patterns from Figma/Framer/Webflow; implementation notes derived from PenBoard's existing codebase)

---

## Context: What Already Exists

PenBoard v1.0 ships with:
- Screen connections (property panel, canvas badges, highlight mode, navigate modal)
- Data entities with 9 field types, sample rows, filter/sort views, ERD page visualization
- Reusable components with 5 argument types and drag-connect binding
- Design tokens (grouped variables, VariablePicker on 7+ fields)
- Canvas context menu, component sidebar, insert from components
- Multi-page architecture (screen, erd, component page types)
- Code generation to 9 frameworks
- MCP server with 20+ tools

This research focuses **only** on v1.1 new features:
1. Data binding (components get entity data sources)
2. Interactive HTML preview
3. Context tab per element on right sidebar
4. Workflow visualization (Mermaid from connections + data flows)
5. MCP updates for new capabilities

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist in a data-driven design tool. Missing these makes the feature feel incomplete or unusable.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Data source selector on components | Any tool linking data to UI must let user pick which entity to bind | MEDIUM | Property panel addition; modal or dropdown UI to pick entity from ERD |
| Render component with sample rows | Binding is useless if preview stays static with placeholder text | MEDIUM | Table/list/dropdown components iterate over `DataEntity.sampleRows`; needs template slot concept |
| Fallback/placeholder when entity unbound | Components without binding must still render gracefully, not crash or show empty | LOW | Show placeholder text like "No data source" or gray empty state |
| Preview opens in separate browser tab | Users expect prototype preview isolated from editor (Figma pattern) | MEDIUM | `window.open()` with serialized document state passed via `postMessage` or URL param |
| Navigate between screens in preview | Core prototype behavior — clicking buttons/links navigates to connected screens | MEDIUM | Reads `PenDocument.connections[]`, renders each screen as HTML, router between them |
| Preview renders with sample data | Static HTML preview is not enough if data binding exists | MEDIUM | Preview renderer resolves data bindings using entity sample rows before rendering |
| Context/notes field per element | Annotation is expected in professional tools for handoff and AI context | LOW | Textarea in right panel; stored as `PenNode.context?: string` |
| Workflow view shows screen-to-screen flow | After building connections, users need a map view to verify the flow makes sense | MEDIUM | Read `PenDocument.connections[]`, render as Mermaid flowchart or similar |
| MCP tools expose new capabilities | External AI agents must be able to query/set data bindings, read context notes | MEDIUM | New MCP tools: `get_data_bindings`, `set_data_binding`, `get_node_context`, `set_node_context` |

### Differentiators (Competitive Advantage)

Features that set PenBoard apart. Rare in competing tools or done in a meaningfully better way.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Data binding tied to ERD entities (not external CMS) | Framer/Webflow bind to external CMS. PenBoard's entities live in the same `.pb` file — zero external dependency, works offline | HIGH | The entity schema is already in `PenDocument.dataEntities[]`; binding is a first-class local concept |
| Workflow diagram auto-generated from connections | Most tools show connections on the canvas. Auto-generating a Mermaid diagram from connections + data flows is rare and adds documentation value | MEDIUM | Parse `connections[]` and data bindings to emit `mermaid` flowchart syntax; render with `mermaid` npm package |
| Context tab feeds AI generation directly | A textarea per element that AI reads when generating/modifying that element creates a tight design-intent loop absent from Figma/Framer | LOW-MEDIUM | `PenNode.context` field + AI chat panel reads it when node is selected; MCP exposes it |
| Preview uses PenBoard's own HTML codegen | Preview is not a separate renderer; it reuses the existing `html-generator.ts` + data resolution — consistent with export | HIGH | Needs data-binding-aware codegen: table template rows expanded with sample data; requires changes to `html-generator.ts` |
| Data flow shown in workflow diagram | Showing which screens use which entities in the workflow diagram gives developers a data-dependency map rare in UX tools | MEDIUM | Extend Mermaid output with `entity → screen` edges based on data bindings |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems for this milestone.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Live/real database connection for preview | "Use real data, not sample data" | Requires auth, network, CORS, server-side secrets — completely breaks the local-first model | Use sample rows defined in the ERD entity. They are editable and good enough for prototype validation |
| Two-way data binding (preview edits propagate back to entity) | "Edit data in preview" | Massively increases complexity; breaks separation between design-time and preview-time | Preview is read-only; users edit entity sample rows in the entity panel |
| Custom Mermaid diagram editing | "Let me rearrange the workflow diagram" | The diagram is generated from connection data; letting users edit it disconnects it from the source of truth | Show a read-only rendered Mermaid diagram; for structural changes, edit connections on the canvas |
| Full browser emulation in preview (JavaScript execution) | "Make the preview feel like a real app" | Executing arbitrary JavaScript in a preview tab expands attack surface and complexity far beyond the milestone | Render static interactive HTML with click-to-navigate; AI-generated code panel handles real code needs |
| Persistence/sync of context notes to external knowledge base | "Export annotations to Notion/Confluence" | Out of scope for v1.1; adds integration complexity | Context notes live in the `.pb` file; export is handled by code generation and MCP tools |
| Workflow diagram as an editable page type | "Make it a canvas page like ERD" | ERD renderer (`SkiaErdRenderer`) was complex to build; a third special renderer for workflow adds significant scope | Render Mermaid as an HTML panel or floating panel overlay using the `mermaid` npm library |

---

## Feature Dependencies

```
[Data Binding: entity selector on component]
    └──requires──> [DataEntity schema already in PenDocument]  ← EXISTS in v1.0
    └──requires──> [ComponentArgument or new binding field on PenNode]
    └──enables──>  [Preview renders with sample data]
    └──enables──>  [Workflow diagram shows data flows]

[Interactive HTML Preview]
    └──requires──> [Data binding: entity selector]  (for data-populated preview)
    └──requires──> [PenDocument.connections[]]  ← EXISTS in v1.0
    └──requires──> [html-generator.ts extended for data binding]  ← partial, needs update
    └──requires──> [Screen renderer: serializes document to preview tab]

[Context Tab per element]
    └──requires──> [PenNode gains `context?: string` field]
    └──enables──>  [AI chat reads selected node context]
    └──enables──>  [MCP `get_node_context` / `set_node_context` tools]

[Workflow Visualization (Mermaid)]
    └──requires──> [PenDocument.connections[]]  ← EXISTS in v1.0
    └──enhanced-by──> [Data binding completed]  (adds entity→screen edges)
    └──requires──> [mermaid npm package or equivalent renderer]

[MCP updates]
    └──requires──> [Data binding API finalized]
    └──requires──> [Context field on PenNode finalized]
    └──requires──> [Workflow diagram generation function]
```

### Dependency Notes

- **Preview requires data binding:** Without resolving bindings, preview renders placeholder text. Ship preview and data binding in the same phase to avoid a half-working feature.
- **Context tab is independent:** It only needs a `PenNode.context` string field — can be built standalone without data binding or preview.
- **Workflow visualization can ship partially:** Even without data flows (before binding is done), it can render screen-to-screen connections from existing `connections[]` data. Ship basic version early, add entity edges after binding.
- **MCP updates should be last:** They wrap all other features; implement after data binding, context, and workflow are stable.
- **html-generator.ts must be extended:** Currently generates static HTML. For preview + data binding, it needs a mode where table/list components expand sample rows. This is the highest-risk coupling point.

---

## MVP Definition

### Launch With (v1.1)

Minimum viable for "Data-Driven Design" milestone.

- [ ] **Data binding: entity selector on component frame** — The core promise of v1.1; a component that can be bound to an entity is the fundamental new capability
- [ ] **Component renders with entity sample rows in canvas** — Binding is only meaningful if the canvas updates to show real data shape (even if approximate)
- [ ] **Interactive HTML preview in browser tab** — Designers need to click through screens with data; static export is not enough for stakeholder review
- [ ] **Preview navigates via connections** — Without this, preview is just a single-screen static export already available via export-section
- [ ] **Context tab (textarea per node)** — Low complexity, high value for AI workflows; quick win
- [ ] **Workflow diagram panel showing screen connections** — Gives immediate value from existing `connections[]` without requiring data binding to be complete

### Add After Validation (v1.1.x)

- [ ] **Data edges in workflow diagram** — Add entity→screen relationships once binding is stable; trigger: binding ships and is used
- [ ] **MCP: `set_data_binding`, `get_node_context`, `set_node_context`** — Trigger: AI-assisted design workflows are actively used with v1.1
- [ ] **Preview: data binding resolution for non-table components** — Initially, only table/list components are data-aware; extend to dropdowns, text nodes after feedback

### Future Consideration (v2+)

- [ ] **Component variants/states (hover, active, disabled)** — Orthogonal to data binding; complex; already listed in PROJECT.md as deferred
- [ ] **Responsive breakpoints in preview** — Useful for web designs; significant complexity
- [ ] **Animation/transition between screens in preview** — Improves preview fidelity significantly; scope is large
- [ ] **Export workflow diagram as SVG/PNG** — Nice for documentation; low priority vs. core features

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Data binding: entity selector on component | HIGH | MEDIUM | P1 |
| Canvas renders sample rows in bound component | HIGH | HIGH | P1 |
| Interactive HTML preview (navigate screens) | HIGH | HIGH | P1 |
| Context tab per node (textarea) | MEDIUM | LOW | P1 |
| Workflow diagram (screen connections → Mermaid) | MEDIUM | MEDIUM | P1 |
| Workflow diagram data edges (entity→screen) | MEDIUM | LOW (after binding) | P2 |
| MCP tools for new capabilities | MEDIUM | MEDIUM | P2 |
| Preview resolves data binding for all component types | HIGH | HIGH | P2 |
| Export workflow diagram | LOW | LOW | P3 |
| Live database connection for preview | LOW | VERY HIGH | P3 (anti-feature) |

**Priority key:**
- P1: Must have for v1.1 launch
- P2: Should have, add after core is stable
- P3: Nice to have / future

---

## Competitor Feature Analysis

| Feature | Figma | Framer | PenBoard v1.1 Approach |
|---------|-------|--------|------------------------|
| Data binding | Variables + CMS via plugins (not native ERD) | Native CMS with field mapping to component props | First-class local ERD entity binding — no external service |
| Interactive preview | Prototype mode, click-through, transitions | Full interactive site preview in browser | HTML preview tab with navigation via `connections[]` |
| Annotation per element | Comments (team-oriented, not AI-oriented) | No per-element AI context field | Context tab: AI-readable textarea stored in `PenNode.context` |
| Workflow visualization | No auto-generated flow diagram from connections | No auto-generated flow diagram | Auto-generated Mermaid from `connections[]` + binding edges |
| MCP / AI tool integration | Figma MCP (read-only design inspection) | None | Full read-write MCP with data binding + context tools |

---

## Expected User Behaviors and Edge Cases

### Data Binding

**Happy path:** User selects a table component → opens data source picker → picks `User` entity → component shows 3 sample rows with real field names.

**Edge cases:**
- Entity has 0 sample rows → show empty state with "Add rows in entity panel" hint
- Entity is deleted after binding → binding becomes a dangling reference; show warning badge on component, fallback to placeholder
- Entity field types change after binding → mismatched types (e.g. field was `text`, now `date`) → silently fall back to string rendering, no crash
- Component has no `children` template slot → binding has nothing to iterate over; show error in property panel: "Component must have a repeating child to bind"
- Multiple bindings on nested components (table inside table) → limit to one level deep in v1.1; document limitation

### Interactive Preview

**Happy path:** User clicks Preview → new browser tab opens → screen 1 renders → user clicks a button with a connection → navigates to screen 2.

**Edge cases:**
- Screen has no connections (dead end) → preview shows the screen but no clickable navigation; add a "Back" button or breadcrumb
- Multiple connections from same element (conditional flow) → in v1.1 show first connection only; conditional routing is v2+
- CanvasKit WASM not available in preview tab → preview uses HTML codegen, not CanvasKit; no dependency on WASM in preview
- Very large document (50+ screens) → serialize only visited screens lazily, not all at once
- Mixed page types (erd, component pages) → preview only includes `screen` type pages; erd and component pages are excluded

### Context Tab

**Happy path:** User selects a frame → types intent in Context tab → AI chat generates content for that frame using the context as additional instructions.

**Edge cases:**
- User selects multiple nodes → show aggregate context or disable the tab with "Select one element" message
- Context text is very long (>2000 chars) → truncate when injecting into AI prompt to avoid token overflow; warn user
- Node is deleted while context tab is open → panel gracefully empties or shows "No selection"

### Workflow Visualization

**Happy path:** User opens Workflow tab → sees a Mermaid flowchart with all screens as nodes and connections as directed edges.

**Edge cases:**
- No connections defined → show empty state: "Add connections between screens to visualize your flow"
- Cyclic connections (A→B→A) → Mermaid handles cycles natively; no special handling needed
- Very many connections (20+ screens) → Mermaid diagram becomes crowded; add zoom/scroll in the panel or suggest grouping
- Screen names have special characters → sanitize screen names before feeding to Mermaid syntax

---

## Sources

- [Framer CMS data binding patterns](https://www.framersnippets.com/articles/linking-cms-data-to-framer-components) — MEDIUM confidence (community article, verified against Framer behavior)
- [Figma prototype navigation patterns](https://help.figma.com/hc/en-us/articles/360040314193-Guide-to-prototyping-in-Figma) — HIGH confidence (official Figma docs)
- [Mermaid diagram syntax and user journey](https://mermaid.js.org/syntax/userJourney.html) — HIGH confidence (official Mermaid docs)
- [UX data table patterns](https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-data-tables) — MEDIUM confidence (design article)
- [Edge cases and fallback UX patterns](https://www.uxpin.com/studio/blog/prototyping-for-edge-cases/) — MEDIUM confidence (design article)
- [UI data binding Wikipedia](https://en.wikipedia.org/wiki/UI_data_binding) — HIGH confidence (foundational pattern definition)
- PenBoard v1.0 source code (`PROJECT.md`, `CLAUDE.md`) — HIGH confidence (direct inspection)

---

*Feature research for: PenBoard v1.1 — Data-Driven Design*
*Researched: 2026-03-17*
