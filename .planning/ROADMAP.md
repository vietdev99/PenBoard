# Roadmap: PenBoard — Storyboard Design Tool

## Overview

PenBoard is a fork of OpenPencil (MIT, CanvasKit/Skia) extended with storyboard intelligence: screen connections, data entities, shared views, and project management. The fork provides a complete design canvas out of the box. Development focuses on adding backend persistence, storyboard-specific features, and data modeling.

## Phases

- [ ] **Phase 1: Clone, Rebrand & Verify** - OpenPencil fork runs as PenBoard, all canvas features verified working
- [ ] **Phase 2: Backend Foundation** - Auth, projects, screens persistence with Prisma + SQLite via Nitro
- [ ] **Phase 3: Storyboard Overview & Connections** - Overview canvas with screen thumbnails, directional arrows, drill-down navigation
- [ ] **Phase 4: Data Entities & ERD** - Visual ERD with tables/relations, data entity shapes on design canvas
- [ ] **Phase 5: Shared Views & Design Tokens** - Reusable layouts via component system, token management UI via variables system
- [ ] **Phase 6: E2E Tests & Polish** - Playwright tests, Electron validation, performance optimization

## Phase Details

### Phase 1: Clone, Rebrand & Verify
**Goal**: PenBoard runs locally with all OpenPencil features working under new brand
**Depends on**: Nothing (first phase)
**Requirements**: CANVAS-01, CANVAS-02, CANVAS-03, CANVAS-04, CANVAS-05, CANVAS-06, CANVAS-07
**Plans:** 5 plans
**Success Criteria**:
  1. `bun run dev` starts PenBoard at localhost:3000 with working canvas
  2. All 11 shape types render, select, resize correctly
  3. Undo/redo, copy/paste, multi-select work
  4. App shows "PenBoard" branding everywhere
  5. Electron desktop build works (`bun run electron:dev`)
  6. MCP server responds with "penboard" identity

Plans:
- [x] 01-01-PLAN.md — Core rebrand: config, Electron, server, and client source code (openpencil → penboard)
- [x] 01-02-PLAN.md — i18n locale files and documentation rebrand (15 locales, 15 READMEs, templates)
- [x] 01-03-PLAN.md — File extension .pb support, landing page redirect, build verification, canvas verification
- [ ] 01-04-PLAN.md — Gap closure: Wire alignment guides into drag handler and render loop (CANVAS-06)
- [ ] 01-05-PLAN.md — Gap closure: Remove .op from save dialog accept list

### Phase 2: Backend Foundation
**Goal**: Users can register, login, create projects, and persist screen designs to database
**Depends on**: Phase 1
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, PROJ-01, PROJ-02, PROJ-03, PROJ-04, SCR-01, SCR-02, SCR-03, SCR-04, SCR-05
**Success Criteria**:
  1. User can register → login → see project dashboard
  2. User can create/rename/delete projects
  3. User can add/rename/delete screens within a project
  4. Screen canvas auto-saves to SQLite via Prisma
  5. Screen canvas loads from database on navigation
  6. User session persists across refresh

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD

### Phase 3: Storyboard Overview & Screen Connections
**Goal**: Users see all screens on overview canvas, draw connections, navigate between screens
**Depends on**: Phase 2 (screens must exist in DB)
**Requirements**: OVER-01, OVER-02, OVER-03, OVER-04, CONN-01, CONN-02, CONN-03, CONN-04, CONN-05
**Success Criteria**:
  1. Overview page shows all project screens as visual thumbnails
  2. User can draw directional arrows between screen shapes with labels
  3. Double-click screen thumbnail navigates to screen editor
  4. Connections store source/target, trigger event, transition type
  5. Screen thumbnails auto-update when screen content changes

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD

### Phase 4: Data Entities & ERD
**Goal**: Users can design data schemas visually and reference them from design canvas
**Depends on**: Phase 2 (data schemas stored in DB)
**Requirements**: ERD-01, ERD-02, ERD-03, ERD-04, DATA-01, DATA-02, DATA-03
**Success Criteria**:
  1. ERD page shows data tables with fields, types, PK/FK badges
  2. User can draw relation edges with cardinality (1:1, 1:N, N:M)
  3. User can place data entity badges on screen design canvas
  4. Clicking badge shows field popover; double-click navigates to ERD

Plans:
- [ ] 04-01: TBD

### Phase 5: Shared Views & Design Tokens
**Goal**: Reusable layout fragments and global design tokens
**Depends on**: Phase 2 (shared views stored in DB)
**Requirements**: SHARED-01, SHARED-02, SHARED-03, SHARED-04, SHARED-05, TOKEN-01, TOKEN-02, TOKEN-03, TOKEN-04, TOKEN-05
**Success Criteria**:
  1. User can create shared view (navbar, sidebar, footer) on dedicated page
  2. Shared view instances on screen canvases update when source is edited
  3. Design tokens panel allows creating color/spacing/typography tokens
  4. Token picker in properties panel, $variable references resolve at render

Plans:
- [ ] 05-01: TBD

### Phase 6: E2E Tests & Polish
**Goal**: Comprehensive test coverage, Electron validation, performance
**Depends on**: All previous phases
**Requirements**: (implicit — testing all features)
**Success Criteria**:
  1. Playwright E2E tests cover auth, projects, canvas, connections, ERD, shared views, tokens
  2. Electron desktop app works correctly
  3. Canvas renders at 60fps (< 16ms per frame)
  4. MCP server works from Claude Code

Plans:
- [ ] 06-01: TBD

## Progress

**Execution Order:** 1 → 2 → 3 → 4 → 5 → 6
Note: Phase 4 (ERD) and Phase 5 (Shared Views) can potentially run in parallel after Phase 2.

| Phase | Plans Complete | Status | Completed |
|-------|---------------|--------|-----------|
| 1. Clone, Rebrand & Verify | 3/5 | Gap closure | - |
| 2. Backend Foundation | 0/2 | Not started | - |
| 3. Storyboard Overview & Connections | 0/2 | Not started | - |
| 4. Data Entities & ERD | 0/1 | Not started | - |
| 5. Shared Views & Design Tokens | 0/1 | Not started | - |
| 6. E2E Tests & Polish | 0/1 | Not started | - |
