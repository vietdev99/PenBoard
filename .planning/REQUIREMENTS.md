# Requirements: PenBoard

**Defined:** 2026-03-15
**Core Value:** Visual design canvas + storyboard intelligence — design screens, connect flows, link data models, generate code.

## v1 Requirements

### Backend & Auth

- [ ] **AUTH-01**: User can register with email and password
- [ ] **AUTH-02**: User can login and receive session token
- [ ] **AUTH-03**: User session persists across browser refresh
- [ ] **AUTH-04**: User can logout

### Project Management

- [ ] **PROJ-01**: User can create a new project with name and description
- [ ] **PROJ-02**: User can view list of their projects on dashboard
- [ ] **PROJ-03**: User can delete a project
- [ ] **PROJ-04**: User can rename a project

### Screen Management

- [ ] **SCR-01**: User can create new screens within a project
- [ ] **SCR-02**: User can rename and reorder screens
- [ ] **SCR-03**: User can delete screens
- [ ] **SCR-04**: Screen canvas auto-saves to server
- [ ] **SCR-05**: Screen canvas loads from server on navigation

### Canvas (inherited from OpenPencil — already working)

- [ ] **CANVAS-01**: User can place shapes at any x,y position on infinite pan/zoom canvas
- [ ] **CANVAS-02**: User can select, move, and resize shapes with handles
- [ ] **CANVAS-03**: User can multi-select via box selection or shift-click
- [ ] **CANVAS-04**: User can undo/redo any operation
- [ ] **CANVAS-05**: User can copy/paste shapes within and across screens
- [ ] **CANVAS-06**: Shapes snap to grid and show alignment guides
- [x] **CANVAS-07**: Canvas renders with CanvasKit/Skia WebGL

### Storyboard Overview

- [ ] **OVER-01**: Overview canvas displays all project screens as thumbnail previews
- [ ] **OVER-02**: User can double-click a screen thumbnail to navigate into that screen's editor
- [ ] **OVER-03**: User can drag screen thumbnails to rearrange positions
- [ ] **OVER-04**: Screen thumbnails auto-update when screen content changes

### Screen Connections

- [ ] **CONN-01**: User can draw arrows between screen thumbnails on overview canvas
- [ ] **CONN-02**: Each arrow stores source/target screen, trigger event, and transition type
- [ ] **CONN-03**: User can add labels to connection arrows
- [ ] **CONN-04**: User can delete a connection by selecting arrow + Delete
- [ ] **CONN-05**: User can assign component-to-screen navigation via properties panel

### Data Entities & ERD

- [ ] **ERD-01**: User can create data tables with name and typed fields on ERD page
- [ ] **ERD-02**: User can draw relation edges showing 1:1, 1:N, N:M cardinality
- [ ] **ERD-03**: Table nodes display field names, types, and PK/FK badges
- [ ] **ERD-04**: User can drag table nodes to rearrange ERD layout
- [ ] **DATA-01**: User can place data entity shapes on screen design canvas
- [ ] **DATA-02**: Clicking a data entity shape shows popover with schema fields
- [ ] **DATA-03**: Double-clicking data entity navigates to ERD page

### Shared Views

- [ ] **SHARED-01**: User can create shared views (navbar, sidebar, footer) on dedicated pages
- [ ] **SHARED-02**: User can attach shared view instances to any screen
- [ ] **SHARED-03**: Shared view instances render as read-only with visual distinction
- [ ] **SHARED-04**: Editing shared view source propagates to all instances
- [ ] **SHARED-05**: User can double-click instance to navigate to source

### Design Tokens

- [ ] **TOKEN-01**: User can create named color tokens in design tokens panel
- [ ] **TOKEN-02**: User can create spacing and typography tokens
- [ ] **TOKEN-03**: Properties panel shows token picker for color/spacing fields
- [ ] **TOKEN-04**: Token references resolve to values at render time
- [ ] **TOKEN-05**: Changing a token updates all shapes referencing it

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
| Real-time collaboration | Single-user must be solid first |
| Animation timeline | Not needed for wireframing |
| Plugin marketplace | MCP is the extensibility model |
| Custom vector pen tool | Already inherited from OpenPencil |
| Code generation | Already inherited from OpenPencil |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 2 | Pending |
| AUTH-02 | Phase 2 | Pending |
| AUTH-03 | Phase 2 | Pending |
| AUTH-04 | Phase 2 | Pending |
| PROJ-01 | Phase 2 | Pending |
| PROJ-02 | Phase 2 | Pending |
| PROJ-03 | Phase 2 | Pending |
| PROJ-04 | Phase 2 | Pending |
| SCR-01 | Phase 2 | Pending |
| SCR-02 | Phase 2 | Pending |
| SCR-03 | Phase 2 | Pending |
| SCR-04 | Phase 2 | Pending |
| SCR-05 | Phase 2 | Pending |
| CANVAS-01 | Phase 1 | Pending |
| CANVAS-02 | Phase 1 | Pending |
| CANVAS-03 | Phase 1 | Pending |
| CANVAS-04 | Phase 1 | Pending |
| CANVAS-05 | Phase 1 | Pending |
| CANVAS-06 | Phase 1 | Pending |
| CANVAS-07 | Phase 1 | Pending |
| OVER-01 | Phase 3 | Pending |
| OVER-02 | Phase 3 | Pending |
| OVER-03 | Phase 3 | Pending |
| OVER-04 | Phase 3 | Pending |
| CONN-01 | Phase 3 | Pending |
| CONN-02 | Phase 3 | Pending |
| CONN-03 | Phase 3 | Pending |
| CONN-04 | Phase 3 | Pending |
| CONN-05 | Phase 3 | Pending |
| ERD-01 | Phase 4 | Pending |
| ERD-02 | Phase 4 | Pending |
| ERD-03 | Phase 4 | Pending |
| ERD-04 | Phase 4 | Pending |
| DATA-01 | Phase 4 | Pending |
| DATA-02 | Phase 4 | Pending |
| DATA-03 | Phase 4 | Pending |
| SHARED-01 | Phase 5 | Pending |
| SHARED-02 | Phase 5 | Pending |
| SHARED-03 | Phase 5 | Pending |
| SHARED-04 | Phase 5 | Pending |
| SHARED-05 | Phase 5 | Pending |
| TOKEN-01 | Phase 5 | Pending |
| TOKEN-02 | Phase 5 | Pending |
| TOKEN-03 | Phase 5 | Pending |
| TOKEN-04 | Phase 5 | Pending |
| TOKEN-05 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 44 total
- Mapped to phases: 44
- Unmapped: 0

---
*Requirements defined: 2026-03-15*
*Last updated: 2026-03-15 after project initialization*
