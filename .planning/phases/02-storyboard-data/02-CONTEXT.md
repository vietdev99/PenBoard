---
phase: 02-storyboard-data
phase_name: "Storyboard Connections & Data Entities"
created: "2026-03-16"
status: context_complete
---

# Phase 2: Storyboard Connections & Data Entities — Context

**Phase Goal:** Users can connect screens via property panel and manage data entities (Notion-like tables with fields, sample data, relations, views) within .pb files.

**Depends on:** Phase 1 (Clone, Rebrand & Verify) — complete

## Scope Change from Original Roadmap

Original Phase 2 (Backend Foundation: Auth, Projects, Screen Persistence) has been **removed entirely**. The app is local-only, file-based. No auth, no database server, no server-side persistence.

This phase combines the original Phase 3 (Storyboard Connections) and Phase 4 (Data Entities) with significant scope adjustments:
- No overview canvas (removed)
- Connections via property panel (not separate canvas)
- Data entities as Notion-like databases within .pb file

## Decisions

### A. Architecture — Local-Only, File-Based

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Server persistence | **None** | App runs local-only. No auth, no DB server |
| Auth | **Removed** | Not needed for local desktop/dev tool |
| Data storage | **In .pb file** | Everything stored in PenDocument JSON. Portable, single file |
| Save mechanism | **Unchanged** | Ctrl+S → file save (FS Access API / Electron IPC). No changes needed |
| Screen model | **Page = Screen** | Existing PenPage is a storyboard screen. No new abstraction needed |

### B. Storyboard Connections

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Connection workflow | **Property panel** | Select element → "Navigate to" section in property panel → pick target screen from dropdown. Similar to Figma prototyping |
| Overview canvas | **Not needed** | Page tabs + property panel connections are sufficient. No bird's-eye view |
| Connection data model | **PenDocument.connections[]** | New top-level array on PenDocument type |
| Connection fields | **Detailed** | `sourceElementId`, `targetPageId`, `label`, `triggerEvent` (click/hover/submit), `transitionType` (push/modal/replace) |
| Visual indicator | On canvas element | Elements with connections show a visual badge/indicator (e.g., arrow icon) |

**Connection type definition:**
```typescript
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

### C. Data Entities — Notion-like Database

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Storage | **In .pb file** | `PenDocument.dataEntities[]` — new top-level array |
| Feature scope | **Full Notion-like** | Tables + typed fields + sample data rows + relations + views (filter/sort) |
| UI: management | **Panel (sidebar)** | Sidebar panel to list/create/edit tables and fields quickly |
| UI: visualization | **ERD page** | Dedicated page type showing all tables as nodes with relation edges |
| UI: combined | **Both panel + ERD** | Panel for quick management, ERD page for visual schema design |

**Field types:** text, number, date, select, multi-select, checkbox, url, email, relation, formula (later)

**Data entity type definition:**
```typescript
interface DataEntity {
  id: string
  name: string
  fields: DataField[]
  rows: DataRow[]
  views: DataView[]
}

interface DataField {
  id: string
  name: string
  type: 'text' | 'number' | 'date' | 'select' | 'multi-select' | 'checkbox' | 'url' | 'email' | 'relation'
  options?: string[]         // For select/multi-select
  relationEntityId?: string  // For relation type
  relationCardinality?: '1:1' | '1:N' | 'N:M'  // For relation type
  isPrimaryKey?: boolean
}

interface DataRow {
  id: string
  values: Record<string, any>  // fieldId → value
}

interface DataView {
  id: string
  name: string
  filters: DataFilter[]
  sorts: DataSort[]
  groupBy?: string  // fieldId
}
```

### D. Requirements Mapping

**Removed requirements (no longer needed):**
- AUTH-01 through AUTH-04 (no auth)
- PROJ-01 through PROJ-04 (no project management — single file)
- SCR-01 through SCR-05 (screen = page, already working)

**Retained/modified requirements:**
- CONN-01 → Connect elements to screens via property panel (not overview arrows)
- CONN-02 → Connection stores sourceElement, targetPage, trigger, transition
- CONN-03 → Connection label support
- CONN-04 → Delete connection from property panel
- CONN-05 → Assign element-to-screen navigation via property panel (primary method)
- ERD-01 → Create data tables with typed fields
- ERD-02 → Draw relation edges on ERD page (1:1, 1:N, N:M)
- ERD-03 → Table nodes display field names, types, PK badges
- ERD-04 → Drag table nodes on ERD page
- DATA-01 → Data entities sidebar panel
- DATA-02 → Sample data rows (Notion-like)
- DATA-03 → Views with filter/sort

**New requirements:**
- DATA-04 → Data entities stored in .pb file (PenDocument.dataEntities[])
- DATA-05 → ERD page type (dedicated page for schema visualization)

## Code Context

### Integration Points

| Component | Current State | Phase 2 Change |
|-----------|--------------|----------------|
| `src/types/pen.ts` → PenDocument | No connections or dataEntities | Add `connections: ScreenConnection[]` and `dataEntities: DataEntity[]` |
| `src/types/pen.ts` → PenPage | Basic page model | Add page type indicator (screen vs ERD) |
| `src/components/panels/property-panel.tsx` | Shape properties only | Add "Navigate to" section for connections |
| `src/stores/document-store.ts` | Node CRUD only | Add connection CRUD + data entity CRUD |
| `src/components/editor/page-tabs.tsx` | Basic page tabs | Show connection badge, ERD page icon |
| Panel system | Layer + Property + AI + Code | Add Data Entities panel |
| Canvas rendering | Shapes only | Add connection indicator badges on elements |

### Existing Assets to Reuse

- **Multi-page system** (`document-store-pages.ts`) — screens are pages, already working
- **Page tabs UI** (`page-tabs.tsx`) — navigation between screens
- **Property panel pattern** — existing fill/stroke/layout sections as template for connection section
- **PenNode type:connection** — already exists in type system (line type with start/end points)
- **Canvas engine** — SkiaEngine + renderer for ERD page rendering

## Deferred Ideas

1. **Overview canvas** — Bird's-eye view of all screens with connection arrows. Not needed now, can add later.
2. **Formula fields** — Computed field values in data entities. Notion feature, complex to implement.
3. **Real-time preview** — Show target screen preview when hovering connection in property panel.
4. **Data-driven design** — Auto-populate UI components with sample data from entities.
5. **Auth/DB** — Server-side persistence, user accounts. Removed from roadmap entirely.

## Success Criteria

1. User can select any element → property panel shows "Navigate to" → pick target screen
2. Connections persist in .pb file and reload correctly
3. Visual indicator on elements that have connections
4. Data entities panel: create tables, add typed fields, enter sample data rows
5. ERD page: tables as visual nodes, drag to arrange, draw relation edges
6. Relations display cardinality (1:1, 1:N, N:M)
7. Data views with filter and sort
8. All data persists in .pb file
