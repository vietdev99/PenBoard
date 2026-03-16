---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 3
current_plan: 1
status: not_started
last_updated: "2026-03-16T14:34:00Z"
progress:
  total_phases: 4
  completed_phases: 2
  total_plans: 7
  completed_plans: 7
---

# Project State: PenBoard

**Last Updated:** 2026-03-16T14:34:00Z
**Current Phase:** 3 — Shared Components & Design Tokens
**Current Plan:** Plan 01 (TBD)
**Overall Status:** Phase 2 Complete — Ready for Phase 3

## What's Done

- [x] Phase 1: Clone, Rebrand & Verify (5/5 plans, all verified)
- [x] Resize alignment guides + size matching (bonus feature)
- [x] Phase 2 CONTEXT.md created with all decisions
- [x] Roadmap restructured (removed Backend Foundation phase)
- [x] Requirements updated (removed auth/project/screen, added data entity reqs)
- [x] Phase 2 Plan 01: Screen Connections (types, store CRUD, UI, canvas badge)
- [x] Phase 2 Plan 02: Data Entities & ERD (Notion-like tables, field CRUD, ERD page renderer, filter/sort views)

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
| Connection data | **PenDocument.connections[]** | Detailed: sourceElement, targetPage, trigger, transition |
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

## Context for Next Session

Phase 2 (Storyboard Connections & Data Entities) is fully complete.

All 14 Phase 2 requirements satisfied:

- CONN-01..05: Screen connections via property panel
- DATA-01..05: Data entities panel, Notion-like tables, filter/sort, persistence, ERD page type
- ERD-01..04: ERD page with table nodes, relation edges, PK/FK badges, drag-to-rearrange

Next steps:

1. Plan Phase 3 (Shared Components & Design Tokens) - `/gsd:plan-phase 03`
2. Phase 3 covers: reusable components with args, design token management

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
| `src/components/editor/page-tabs.tsx` | Page tabs (screens + ERD) |
| `.planning/phases/02-storyboard-data/02-CONTEXT.md` | Phase 2 decisions |

## Blockers

None currently.

## Metrics

- Requirements: 35 (v1, was 44 — removed 17, added 8)
- Phases: 4 (was 6 — removed Backend Foundation, merged Storyboard+ERD)
- Phase 1 status: COMPLETE (5/5 plans done)
- Phase 2 status: COMPLETE (2/2 plans done)

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
