# Roadmap: PenBoard — Storyboard Design Tool

## Overview

PenBoard is a fork of OpenPencil (MIT, CanvasKit/Skia) extended with storyboard intelligence: screen connections, data entities, shared views, and design tokens. The app is local-only and file-based (.pb files).

## Milestones

- ✅ **v1.0 PenBoard MVP** — Phases 1-4 (shipped 2026-03-17)
- 🚧 **v1.1 Data-Driven Design** — Phases 5-9 (in progress)

## Phases

<details>
<summary>✅ v1.0 PenBoard MVP (Phases 1-4) — SHIPPED 2026-03-17</summary>

- [x] Phase 1: Clone, Rebrand & Verify (5/5 plans) — completed 2026-03-16
- [x] Phase 2: Storyboard Connections & Data Entities (3/3 plans) — completed 2026-03-16
- [x] Phase 3: Shared Components & Design Tokens (5/5 plans) — completed 2026-03-16
- [x] Phase 4: E2E Tests & Polish (3/3 plans) — completed 2026-03-17

Full details: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

</details>

### 🚧 v1.1 Data-Driven Design (In Progress)

**Milestone Goal:** Make designs come alive with real data, interactive preview, AI context, and workflow visualization.

- [ ] **Phase 5: Data Binding** - Bind ERD entities to UI components with field mapping and cascade cleanup
- [ ] **Phase 6: Context & AI** - Per-element context annotations that persist in .pb and feed AI prompts
- [ ] **Phase 7: Interactive Preview** - Sandboxed HTML preview with navigation and live sample data
- [ ] **Phase 8: Workflow Visualization** - Auto-generated mermaid diagram from connections and data flows
- [ ] **Phase 9: MCP Integration** - MCP tools exposing all v1.1 capabilities to external agents

## Phase Details

### Phase 5: Data Binding

**Goal**: Users can bind ERD data entities to UI components and see sample data rendered on canvas
**Depends on**: Phase 4 (v1.0 complete -- existing DataEntity[], PenNode, document-store-data.ts)
**Requirements**: BIND-01, BIND-02, BIND-03, BIND-04
**Success Criteria** (what must be TRUE):

1. User can open a data source selector on a supported component and pick an entity from the ERD
2. Component on canvas renders sample rows from the bound entity instead of placeholder content
3. User can map specific entity fields to component columns/options via a field mapping UI
4. Deleting an entity in the ERD automatically removes all data binding references on previously bound components (no dangling bindings)
5. Data binding configuration persists in the .pb file and survives undo/redo, copy/paste, and reload

**Plans**: 3 plans

Plans:

- [x] 05-01-PLAN.md — Wave 0 test scaffold: 7 failing stubs for BIND-01 through BIND-04
- [x] 05-02-PLAN.md — Core binding layer: types, store actions, cascade cleanup, resolveDataBinding + canvas integration
- [x] 05-03-PLAN.md — UI layer: DataBindingSection component, entity selector modal, field mapping, property panel wiring (checkpoint pending)

### Phase 6: Context & AI

**Goal**: Every design element carries AI-readable context annotations that persist across all operations
**Depends on**: Phase 4 (v1.0 complete -- no dependency on Phase 5)
**Requirements**: CTX-01, CTX-02, CTX-03
**Success Criteria** (what must be TRUE):

1. User can select any element and see/edit a context textarea in the right sidebar panel
2. When AI generates or reads a design, element context notes are included in the prompt (visible in AI behavior)
3. Context notes survive copy, paste, duplicate, undo/redo, and file save/reload without loss

**Plans**: 2 plans

Plans:

- [x] 06-01-PLAN.md — Type system + Context panel UI + test scaffolds (CTX-01, CTX-03)
- [x] 06-02-PLAN.md — AI prompt injection + real test coverage + human verification (CTX-02, CTX-03)

### Phase 7: Interactive Preview

**Goal**: Users can preview their designs as interactive HTML prototypes with real data and screen navigation
**Depends on**: Phase 5 (data binding must be stable -- preview resolves bound entity data into HTML output)
**Requirements**: PREV-01, PREV-02, PREV-03, PREV-04
**Success Criteria** (what must be TRUE):

1. User can click a "Preview" button and see the current parent frame rendered as interactive HTML in a separate browser tab
2. Clicking connected elements in the preview navigates to the target screen (connections work as navigation)
3. Preview displays live sample data from bound entities (tables show entity rows, dropdowns show entity options)
4. Preview runs in a null-origin sandbox -- no access to the main app's origin, stores, or file system (verified by dev tools inspection)

**Plans**: 4 plans

Plans:

- [x] 07-01-PLAN.md — Preview HTML generator: data resolver, semantic tags, core HTML generation engine (PREV-01, PREV-03, PREV-04)
- [x] 07-02-PLAN.md — Server infrastructure: Nitro routes, preview state, use-preview hook, top-bar button, Electron IPC (PREV-01, PREV-04)
- [x] 07-03-PLAN.md — Navigation + toolbar: connection-based navigation JS, transitions, toolbar, hotspot mode, HTML export (PREV-01, PREV-02)
- [x] 07-04-PLAN.md — Human verification: end-to-end preview testing in browser (PREV-01, PREV-02, PREV-03, PREV-04)

### Phase 07.2: Canvas offthread sync and worker-based document processing (INSERTED)

**Goal:** Eliminate canvas jank during document sync and zoom/pan with large files (70K+ nodes) via viewport-filtered rendering, frame-level LOD, chunked async sync, and panel isolation
**Requirements**: N/A (performance optimization)
**Depends on:** Phase 07
**Plans:** 3/3 plans executed

Plans:
- [x] 07.2-01-PLAN.md — Viewport-filtered render list (R-tree queryViewport) + frame-level LOD at zoom <30%
- [x] 07.2-02-PLAN.md — Panel isolation (selective Zustand subscriptions + useIdleSelector hook)
- [x] 07.2-03-PLAN.md — Chunked yield syncFromDocument (5-stage async + rebuildAsync)

### Phase 07.3: Tile-Based Rendering + Adaptive LOD

**Goal:** Figma-style tile-based rendering engine with adaptive LOD for buttery smooth canvas at any zoom/node count
**Requirements**: N/A (performance optimization - Figma-inspired architecture)
**Depends on:** Phase 07.2
**Success Criteria** (what must be TRUE):

1. Canvas renders smoothly at 60fps with 500+ frames visible (zoom 1-3%)
2. Pan/zoom uses cached tile bitmaps — only dirty tiles re-render
3. Adaptive LOD selects render tier based on hardware benchmark + visible node count
4. Drag operations use delta tile invalidation (not full re-render)
5. `canvas.quickReject()` eliminates off-screen draw calls natively

**Plans:** 0 plans (run /gsd-plan-phase 07.3 to break down)

Key implementation areas:
- Tile grid system (256x256 scene units, SkSurface per tile)
- Tile bitmap cache (SkImage) with dirty invalidation
- Adaptive LOD tiers (T0 Full -> T1 Quick -> T2 Tile) based on hardware budget
- SkPicture recording per root frame for instant replay
- `canvas.quickReject()` integration for native CanvasKit culling
- Delta tile invalidation during drag/edit operations

### Phase 07.1: Canvas Zoom Performance — Bitmap Snapshot During Gesture (INSERTED)

**Goal:** Eliminate canvas freeze during zoom/pan on large documents by replacing per-frame re-rendering with a bitmap snapshot approach during active gestures
**Requirements**: N/A (urgent inserted phase -- performance optimization)
**Depends on:** Phase 7
**Plans:** 1/2 plans executed

Plans:

- [ ] 07.1-01-PLAN.md — Core bitmap engine: snapshot capture/display in SkiaEngine, auto-detect threshold, gesture state machine, cleanup and timing fix
- [ ] 07.1-02-PLAN.md — Unit tests for bitmap mode + human verification of zoom/pan performance

### Phase 8: Workflow Visualization

**Goal**: Users can see an auto-generated diagram of their screen flow and data relationships
**Depends on**: Phase 5 (data binding edges enrich the diagram), Phase 6 not required
**Requirements**: WF-01, WF-02, WF-03
**Success Criteria** (what must be TRUE):

1. A workflow panel/tab displays a mermaid diagram showing screen-to-screen connections and data entity relationships
2. Focus mode filters the diagram to show only connections of the active page (avoids layout explosion on large projects)
3. Diagram updates automatically when the user adds, removes, or modifies connections or data bindings (no manual refresh)

**Plans**: 2 plans

Plans:

- [ ] 08-01-PLAN.md — Core logic: graph builder, mermaid syntax generator, focus filter, export utilities + unit tests (WF-01, WF-02)
- [ ] 08-02-PLAN.md — UI layer: workflow panel component, store integration, editor layout wiring, auto-update hook + human verify (WF-01, WF-02, WF-03)

### Phase 9: MCP Integration

**Goal**: External AI agents can programmatically access all v1.1 capabilities via MCP tools
**Depends on**: Phase 5, Phase 6, Phase 7, Phase 8 (wraps all prior features after APIs stabilize)
**Requirements**: MCP-01, MCP-02, MCP-03, MCP-04, MCP-05
**Success Criteria** (what must be TRUE):

1. An MCP client can set and get data bindings on nodes (entity selection and field mapping)
2. An MCP client can trigger preview generation and receive a URL or confirmation
3. An MCP client can read and write element context notes on any node
4. An MCP client can export the workflow diagram as mermaid text or SVG
5. MCP tools for navigation, context, ERD, and component pages work correctly (full page-type coverage)

**Plans**: 2 plans

Plans:

- [x] 09-01-PLAN.md — Refactor server.ts + document-level tools: data binding, context, entities, connections, page type (MCP-01, MCP-03, MCP-05)
- [x] 09-02-PLAN.md — Preview generation + workflow export tools with mermaid-cli SVG/PNG (MCP-02, MCP-04)

## Progress

**Execution Order:**
Phases execute in numeric order: 5 -> 6 -> 7 -> 7.1 -> 7.2 -> 7.3 -> 8 -> 9
Note: Phases 5 and 6 are independent and could execute in either order. Phase 7 requires Phase 5. Phases 7.1-7.3 are urgent performance inserts. Phase 9 must be last.

| Phase | Milestone | Plans Complete | Status | Completed |
| ----- | --------- | -------------- | ------ | --------- |
| 1. Clone, Rebrand & Verify | v1.0 | 5/5 | Complete | 2026-03-16 |
| 2. Storyboard Connections & Data Entities | v1.0 | 3/3 | Complete | 2026-03-16 |
| 3. Shared Components & Design Tokens | v1.0 | 5/5 | Complete | 2026-03-16 |
| 4. E2E Tests & Polish | v1.0 | 3/3 | Complete | 2026-03-17 |
| 5. Data Binding | v1.1 | 3/3 | Checkpoint | - |
| 6. Context & AI | v1.1 | 2/2 | Complete | 2026-03-18 |
| 7. Interactive Preview | v1.1 | 4/4 | Complete | 2026-03-19 |
| 7.1 Canvas Zoom Performance | v1.1 | 0/2 | Planned | - |
| 7.2 Canvas Offthread Sync | v1.1 | 3/3 | Complete | 2026-03-20 |
| 7.3 Tile-Based Rendering | v1.1 | — | Complete | 2026-03-20 |
| 8. Workflow Visualization | v1.1 | 2/2 | Complete | 2026-03-20 |
| 9. MCP Integration | v1.1 | 2/2 | Complete | 2026-03-20 |

### Phase 09.1: PenBoard Workspace & External Mermaid Docs (INSERTED)

**Goal:** Externalize business flow diagrams from .pb files into a .penboard/ workspace directory with MCP tools for AI read/write access, and add a Canvas/Flow tab UI for viewing rendered mermaid diagrams alongside UI designs
**Requirements**: N/A (inserted phase, no mapped requirements)
**Depends on:** Phase 9
**Plans:** 2 plans

Plans:
- [ ] 09.1-01-PLAN.md -- Backend: PenDocument.workspace type, 5 MCP workspace tools (write_flow, read_flow, list_flows, write_doc, read_doc), server API endpoints, unit tests
- [ ] 09.1-02-PLAN.md -- Frontend: Canvas/Flow tab system, FlowView with mermaid rendering, TOC navigation, editor-layout integration, human verification
