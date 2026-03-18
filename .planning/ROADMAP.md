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

- [ ] 06-01-PLAN.md — Type system + Context panel UI + test scaffolds (CTX-01, CTX-03)
- [ ] 06-02-PLAN.md — AI prompt injection + real test coverage + human verification (CTX-02, CTX-03)

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
- [ ] 07-02-PLAN.md — Server infrastructure: Nitro routes, preview state, use-preview hook, top-bar button, Electron IPC (PREV-01, PREV-04)
- [ ] 07-03-PLAN.md — Navigation + toolbar: connection-based navigation JS, transitions, toolbar, hotspot mode, HTML export (PREV-01, PREV-02)
- [ ] 07-04-PLAN.md — Human verification: end-to-end preview testing in browser (PREV-01, PREV-02, PREV-03, PREV-04)

### Phase 8: Workflow Visualization

**Goal**: Users can see an auto-generated diagram of their screen flow and data relationships
**Depends on**: Phase 5 (data binding edges enrich the diagram), Phase 6 not required
**Requirements**: WF-01, WF-02, WF-03
**Success Criteria** (what must be TRUE):

1. A workflow panel/tab displays a mermaid diagram showing screen-to-screen connections and data entity relationships
2. Focus mode filters the diagram to show only connections of the active page (avoids layout explosion on large projects)
3. Diagram updates automatically when the user adds, removes, or modifies connections or data bindings (no manual refresh)

**Plans**: TBD

Plans:

- [ ] 08-01: TBD

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

**Plans**: TBD

Plans:

- [ ] 09-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 5 -> 6 -> 7 -> 8 -> 9
Note: Phases 5 and 6 are independent and could execute in either order. Phase 7 requires Phase 5. Phase 9 must be last.

| Phase | Milestone | Plans Complete | Status | Completed |
| ----- | --------- | -------------- | ------ | --------- |
| 1. Clone, Rebrand & Verify | v1.0 | 5/5 | Complete | 2026-03-16 |
| 2. Storyboard Connections & Data Entities | v1.0 | 3/3 | Complete | 2026-03-16 |
| 3. Shared Components & Design Tokens | v1.0 | 5/5 | Complete | 2026-03-16 |
| 4. E2E Tests & Polish | v1.0 | 3/3 | Complete | 2026-03-17 |
| 5. Data Binding | v1.1 | 3/3 | Checkpoint | - |
| 6. Context & AI | v1.1 | 0/2 | Planned | - |
| 7. Interactive Preview | 2/4 | In Progress|  | - |
| 8. Workflow Visualization | v1.1 | 0/0 | Not started | - |
| 9. MCP Integration | v1.1 | 0/0 | Not started | - |
