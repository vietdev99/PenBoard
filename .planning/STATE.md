---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 3
current_plan: 5 of 5
status: in-progress
last_updated: "2026-03-16T17:30:30.191Z"
progress:
  total_phases: 4
  completed_phases: 2
  total_plans: 13
  completed_plans: 11
---

# Project State: PenBoard

**Last Updated:** 2026-03-16T17:30:30Z
**Current Phase:** 3
**Current Plan:** 5 of 5
**Overall Status:** Phase 3 In Progress — Plan 02 & 04 Complete (Argument UI, Design Token Panel)

## What's Done

- [x] Phase 1: Clone, Rebrand & Verify (5/5 plans, all verified)
- [x] Resize alignment guides + size matching (bonus feature)
- [x] Phase 2 CONTEXT.md created with all decisions
- [x] Roadmap restructured (removed Backend Foundation phase)
- [x] Requirements updated (removed auth/project/screen, added data entity reqs)
- [x] Phase 2 Plan 01: Screen Connections (types, store CRUD, UI, canvas badge)
- [x] Phase 2 Plan 02: Data Entities & ERD (Notion-like tables, field CRUD, ERD page renderer, filter/sort views)
- [x] Phase 2 Plan 03: Connection Gap Closure (targetFrameId, same-page connections, badge target name)
- [x] Phase 3 Plan 01: Component Types, Store & Badge (ComponentArgument types, store CRUD, component page, diamond badge)
- [x] Phase 3 Plan 02: Component Argument UI & Drag-Connect Binding (ArgumentSection panel, SVG wire overlay, binding creation)
- [x] Phase 3 Plan 04: Design Token Panel & Picker Expansion (grouped variables panel, VariablePicker on 7 new fields, numeric $ref resolution)

## Roadmap Change (2026-03-16)

**Removed Phase 2 (Backend Foundation)** — App is local-only, file-based. No auth, no database, no server persistence.

**New roadmap:**
1. Clone, Rebrand & Verify (DONE)
2. Storyboard Connections & Data Entities (DONE)
3. Shared Components & Design Tokens (NEXT)
4. E2E Tests & Polish

## Active Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Canvas engine | CanvasKit/Skia (from OpenPencil) | Full source, MIT, GPU-accelerated |
| Base project | Fork OpenPencil v0.4.1 | Already has canvas, shapes, MCP, code gen |
| Package manager | Bun | OpenPencil default, fast |
| File format | .pb (default), .op (legacy) | .pb is PenBoard native; .op for backward compat |
| Save dialog | .pb only | .op removed from save accept list |
| Landing page | Redirect to /editor | No landing page needed for dev tool |
| App model | **Local-only, file-based** | No auth, no DB, no server persistence |
| Screen model | **Page = Screen** | Existing PenPage is a storyboard screen |
| Connections | **Property panel** | Select element -> "Navigate to" -> pick target screen |
| Connection data | **PenDocument.connections[]** | Detailed: sourceElement, targetPage/Frame, trigger, transition |
| Connection target | **Page > Frame picker** | Grouped hierarchy, same-page allowed, pageId::frameId format |
| Data entities | **In .pb file** | PenDocument.dataEntities[] — Notion-like tables |
| Data entity features | **Full** | Tables + fields + sample data + relations + views |
| Data entity UI | **Panel + ERD page** | Sidebar panel for management, ERD page for visualization |
| Shared components | **With rich args** | Props: text, number, boolean, select, color (Phase 3) |
| Connection storage | **Document-level array** | PenDocument.connections[] for easy querying and cascade |
| Connection cascade | **Auto-delete on node/page remove** | Ensures data integrity without orphaned connections |
| ERD page exclusion | **No connections on ERD** | Connections are screen-to-screen only |
| Data actions pattern | **createDataActions extracted** | Same pattern as connections and pages for consistency |
| ERD renderer | **Dedicated SkiaErdRenderer class** | Keeps skia-engine.ts focused, clean delegation |
| ERD auto-layout | **Grid: 250px H x 300px V, 3/row** | Sensible defaults when no erdPosition set |
| ERD tool restriction | **Select + hand only** | Drawing tools disabled on ERD pages |
| Component args | **5 types: text/number/boolean/select/color** | Rich arg system per SHARED-01 |
| Component badge | **Faded purple diamond (0.4 alpha)** | Low-opacity corner badge per user decision |
| Component store pattern | **createComponentActions with updater-function tree traversal** | Cross-page node lookup for argument mutations |
| Variable grouping | **Name-based heuristic** | font/size/line/letter -> Typography, rest -> Spacing |
| VariablePicker placement | **Adjacent flex container (gap-0.5)** | Matches existing fill-section/appearance-section pattern |
| Drag-connect wire | **SVG overlay** | Bridges DOM panel and SkiaCanvas coordinate spaces |
| DragConnectOverlay | **Separate React component** | Owns mouse tracking, avoids polluting main canvas event loop |
| Binding properties | **BINDABLE_PROPERTIES whitelist** | Type-safe bindings per argument type |

## Context for Next Session

Phase 3 Plans 01, 02, 04 complete. Component system and design token expansion done.

What was built in Plan 02:
- ArgumentSection property panel for reusable frames (5-type argument CRUD)
- DragConnectOverlay SVG wire for binding arguments to canvas elements
- dragConnectState in canvas-store for cross-panel-canvas communication
- BINDABLE_PROPERTIES whitelist for type-safe argument bindings

SHARED-06 requirement satisfied by this plan.

What was built in Plan 04:
- VariableGroup collapsible component (Colors/Spacing/Typography/Other sections)
- Variables panel now shows grouped variables instead of flat list
- VariablePicker added to: width, height, cornerRadius, fontSize, fontFamily, lineHeight, letterSpacing
- resolveNodeForCanvas extended to resolve $variable refs on all new numeric/string fields

Next steps:
1. Execute remaining Phase 3 plans (03, 05)
2. Phase 4: E2E Tests & Polish

## Key File Locations

| File | Purpose |
|------|---------|
| `package.json` | Dependencies, scripts |
| `vite.config.ts` | Vite + TanStack Start + Nitro config |
| `electron/main.ts` | Electron main process |
| `src/canvas/skia/skia-engine.ts` | Canvas rendering engine (+ ERD delegation) |
| `src/canvas/skia/skia-canvas.tsx` | Canvas component + event handling (+ ERD interaction) |
| `src/canvas/skia/skia-erd-renderer.ts` | ERD page renderer (table nodes, edges) |
| `src/stores/document-store.ts` | Document state management |
| `src/stores/document-store-data.ts` | Data entity CRUD actions |
| `src/stores/document-store-connections.ts` | Connection CRUD actions |
| `src/stores/document-store-pages.ts` | Multi-page management (screen + erd types) |
| `src/stores/canvas-store.ts` | UI state (dataPanelOpen, dataFocusEntityId) |
| `src/types/pen.ts` | Document model types |
| `src/types/data-entity.ts` | DataEntity/DataField/DataRow/DataView types |
| `src/components/panels/data-panel.tsx` | Data entities floating panel |
| `src/components/panels/data-entity-table.tsx` | Notion-like inline table |
| `src/components/panels/connection-section.tsx` | Connection section UI |
| `src/stores/document-store-components.ts` | Component argument CRUD actions |
| `src/components/panels/variable-group.tsx` | Collapsible group component for variables panel |
| `src/components/editor/page-tabs.tsx` | Page tabs (screens + ERD + component) |
| `.planning/phases/02-storyboard-data/02-CONTEXT.md` | Phase 2 decisions |

## Blockers

None currently.

## Metrics

- Requirements: 35 (v1, was 44 — removed 17, added 8)
- Phases: 4 (was 6 — removed Backend Foundation, merged Storyboard+ERD)
- Phase 1 status: COMPLETE (5/5 plans done)
- Phase 2 status: COMPLETE (3/3 plans done, including gap closure)
- Phase 3 status: IN PROGRESS (3/5 plans done)

## Performance Metrics

| Phase-Plan | Duration | Tasks | Files |
|-----------|----------|-------|-------|
| 01-01 | 25min | 2 | 42 |
| 01-02 | 5min | 2 | 34 |
| 01-03 | 35min | 4 | 11 |
| 01-04 | 3min | 2 | 2 |
| 01-05 | 1min | 1 | 1 |
| 02-01 | 10min | 2 | 29 |
| 02-02 | 20min | 5 | 23 |
| 02-03 | 6min | 2 | 22 |
| 03-01 | 6min | 2 | 8 |
| 03-02 | 8min | 2 | 4 |
| 03-04 | 5min | 2 | 6 |
