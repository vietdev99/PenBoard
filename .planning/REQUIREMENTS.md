# Requirements: PenBoard

**Defined:** 2026-03-15
**Last updated:** 2026-03-16 — Removed auth/project/screen-persistence requirements (app is local-only file-based)
**Core Value:** Visual design canvas + storyboard intelligence — design screens, connect flows, link data models, generate code.

## v1 Requirements

### Canvas (inherited from OpenPencil — already working)

- [x] **CANVAS-01**: User can place shapes at any x,y position on infinite pan/zoom canvas
- [x] **CANVAS-02**: User can select, move, and resize shapes with handles
- [x] **CANVAS-03**: User can multi-select via box selection or shift-click
- [x] **CANVAS-04**: User can undo/redo any operation
- [x] **CANVAS-05**: User can copy/paste shapes within and across screens
- [x] **CANVAS-06**: Shapes snap to grid and show alignment guides
- [x] **CANVAS-07**: Canvas renders with CanvasKit/Skia WebGL

### Screen Connections

- [x] **CONN-01**: User can assign element-to-screen navigation via property panel "Navigate to" section
- [x] **CONN-02**: Each connection stores sourceElement, targetPage, trigger event, and transition type
- [x] **CONN-03**: User can add labels to connections
- [x] **CONN-04**: User can delete a connection from property panel
- [x] **CONN-05**: Elements with connections show visual indicator badge on canvas

### Data Entities & ERD

- [x] **ERD-01**: User can create data tables with name and typed fields on ERD page
- [x] **ERD-02**: User can draw relation edges showing 1:1, 1:N, N:M cardinality
- [x] **ERD-03**: Table nodes display field names, types, and PK/FK badges
- [x] **ERD-04**: User can drag table nodes to rearrange ERD layout
- [x] **DATA-01**: Data entities sidebar panel for managing tables and fields
- [x] **DATA-02**: Sample data rows (Notion-like: enter data into table rows)
- [x] **DATA-03**: Data views with filter and sort
- [x] **DATA-04**: Data entities stored in .pb file (PenDocument.dataEntities[])
- [x] **DATA-05**: ERD page type (dedicated page for schema visualization)

### Shared Components

- [x] **SHARED-01**: User can create shared components (navbar, sidebar, footer) on dedicated pages
- [ ] **SHARED-02**: User can include shared component instances in any screen
- [x] **SHARED-03**: Shared component instances render with visual distinction (e.g., border/badge)
- [ ] **SHARED-04**: Editing shared component source propagates to all instances
- [ ] **SHARED-05**: User can double-click instance to navigate to source
- [x] **SHARED-06**: Shared components support arguments (props) with rich types (text, number, boolean, select, color)
- [ ] **SHARED-07**: When including a component, user can set argument values (e.g., Sidebar with activeItem="Dashboard")
- [ ] **SHARED-08**: Component renders differently based on argument values

### Design Tokens

- [ ] **TOKEN-01**: User can create named color tokens in design tokens panel
- [ ] **TOKEN-02**: User can create spacing and typography tokens
- [x] **TOKEN-03**: Properties panel shows token picker for color/spacing fields
- [x] **TOKEN-04**: Token references resolve to values at render time
- [x] **TOKEN-05**: Changing a token updates all shapes referencing it

## Removed Requirements

The following requirements were removed because the app is local-only and file-based:

| Requirement | Original Description | Reason Removed |
|-------------|---------------------|----------------|
| AUTH-01 | Register with email/password | No auth needed — local app |
| AUTH-02 | Login and receive session token | No auth needed |
| AUTH-03 | Session persists across refresh | No auth needed |
| AUTH-04 | Logout | No auth needed |
| PROJ-01 | Create project with name/description | No project management — single file |
| PROJ-02 | View project list on dashboard | No dashboard needed |
| PROJ-03 | Delete project | No project management |
| PROJ-04 | Rename project | No project management |
| SCR-01 | Create screens within project | Screens = pages (already working) |
| SCR-02 | Rename and reorder screens | Page rename/reorder (already working) |
| SCR-03 | Delete screens | Page delete (already working) |
| SCR-04 | Auto-save canvas to server | File save only (already working) |
| SCR-05 | Load canvas from server | File open only (already working) |
| OVER-01 | Overview displays screen thumbnails | No overview canvas needed |
| OVER-02 | Double-click thumbnail to navigate | Page tabs sufficient |
| OVER-03 | Drag thumbnails to rearrange | Page tabs have reorder |
| OVER-04 | Thumbnails auto-update | Not applicable |

## v2 Requirements (Deferred)

### Collaboration

- **COLLAB-01**: Multiple users can edit same canvas simultaneously
- **COLLAB-02**: Cursor presence shows other users

### Advanced Design

- **ADV-01**: Component variants/states (hover, active, disabled)
- **ADV-02**: Responsive breakpoints
- **ADV-03**: Animation transitions

### Workflow Integration

- **FLOW-01**: BMAD workflow integration
- **FLOW-02**: AI chat panel for planning
- **FLOW-03**: Entity hub with cross-referencing

## Out of Scope

| Feature | Reason |
|---------|--------|
| Auth / user accounts | App is local-only, single-user |
| Server-side persistence | File-based (.pb) is sufficient |
| Real-time collaboration | Single-user must be solid first |
| Animation timeline | Not needed for wireframing |
| Plugin marketplace | MCP is the extensibility model |
| Custom vector pen tool | Already inherited from OpenPencil |
| Code generation | Already inherited from OpenPencil |
| Formula fields in data entities | Deferred to later iteration |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CANVAS-01 | Phase 1 | Complete |
| CANVAS-02 | Phase 1 | Complete |
| CANVAS-03 | Phase 1 | Complete |
| CANVAS-04 | Phase 1 | Complete |
| CANVAS-05 | Phase 1 | Complete |
| CANVAS-06 | Phase 1 | Complete |
| CANVAS-07 | Phase 1 | Complete |
| CONN-01 | Phase 2 | Complete |
| CONN-02 | Phase 2 | Complete |
| CONN-03 | Phase 2 | Complete |
| CONN-04 | Phase 2 | Complete |
| CONN-05 | Phase 2 | Complete |
| ERD-01 | Phase 2 | Complete |
| ERD-02 | Phase 2 | Complete |
| ERD-03 | Phase 2 | Complete |
| ERD-04 | Phase 2 | Complete |
| DATA-01 | Phase 2 | Complete |
| DATA-02 | Phase 2 | Complete |
| DATA-03 | Phase 2 | Complete |
| DATA-04 | Phase 2 | Complete |
| DATA-05 | Phase 2 | Complete |
| SHARED-01 | Phase 3 | Complete |
| SHARED-02 | Phase 3 | Pending |
| SHARED-03 | Phase 3 | Complete |
| SHARED-04 | Phase 3 | Pending |
| SHARED-05 | Phase 3 | Pending |
| SHARED-06 | Phase 3 | Complete |
| SHARED-07 | Phase 3 | Pending |
| SHARED-08 | Phase 3 | Pending |
| TOKEN-01 | Phase 3 | Pending |
| TOKEN-02 | Phase 3 | Pending |
| TOKEN-03 | Phase 3 | Complete |
| TOKEN-04 | Phase 3 | Complete |
| TOKEN-05 | Phase 3 | Complete |

**Coverage:**
- v1 requirements: 35 total (was 44, removed 17 auth/project/screen/overview, added 5 new data reqs + 3 shared component args reqs)
- Mapped to phases: 32
- Unmapped: 0

---
*Requirements defined: 2026-03-15*
*Last updated: 2026-03-16 — SHARED-01, SHARED-03 complete (Phase 3 Plan 01)*
