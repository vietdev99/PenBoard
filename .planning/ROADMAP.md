# Roadmap: PenBoard — Storyboard Design Tool

## Overview

PenBoard is a fork of OpenPencil (MIT, CanvasKit/Skia) extended with storyboard intelligence: screen connections, data entities, shared views, and design tokens. The app is local-only and file-based (.pb files). Development focuses on adding storyboard-specific features and data modeling to the existing design canvas.

## Phases

- [x] **Phase 1: Clone, Rebrand & Verify** - OpenPencil fork runs as PenBoard, all canvas features verified working
- [ ] **Phase 2: Storyboard Connections & Data Entities** - Screen connections via property panel, Notion-like data tables with ERD visualization
- [ ] **Phase 3: Shared Views & Design Tokens** - Reusable layouts via component system, token management UI via variables system
- [ ] **Phase 4: E2E Tests & Polish** - Playwright tests, Electron validation, performance optimization

## Removed Phases

- ~~Backend Foundation (Auth, Projects, Screen Persistence)~~ — Removed. App is local-only, file-based. No auth, no database, no server persistence needed.

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
- [x] 01-04-PLAN.md — Gap closure: Wire alignment guides into drag handler and render loop (CANVAS-06)
- [x] 01-05-PLAN.md — Gap closure: Remove .op from save dialog accept list

### Phase 2: Storyboard Connections & Data Entities
**Goal**: Users can connect screen elements to other screens via property panel, and manage Notion-like data entities (tables, fields, sample data, relations, views) within .pb files
**Depends on**: Phase 1
**Requirements**: CONN-01, CONN-02, CONN-03, CONN-04, CONN-05, ERD-01, ERD-02, ERD-03, ERD-04, DATA-01, DATA-02, DATA-03, DATA-04, DATA-05
**Success Criteria**:
  1. Select element → property panel "Navigate to" → pick target screen
  2. Connections persist in .pb file and reload correctly
  3. Visual indicator on elements that have connections
  4. Data entities panel: create tables, add typed fields, enter sample data rows
  5. ERD page: tables as visual nodes, drag to arrange, draw relation edges
  6. Relations display cardinality (1:1, 1:N, N:M)
  7. Data views with filter and sort
  8. All data persists in .pb file

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD

### Phase 3: Shared Components & Design Tokens
**Goal**: Reusable components with arguments (props) and global design tokens
**Depends on**: Phase 1 (no DB dependency — file-based)
**Requirements**: SHARED-01, SHARED-02, SHARED-03, SHARED-04, SHARED-05, SHARED-06, SHARED-07, SHARED-08, TOKEN-01, TOKEN-02, TOKEN-03, TOKEN-04, TOKEN-05
**Success Criteria**:
  1. User can create shared component (navbar, sidebar, footer) on dedicated page
  2. Shared component instances on screen canvases update when source is edited
  3. Components support rich arguments (text, number, boolean, select, color)
  4. User can set argument values when including component (e.g., Sidebar with activeItem="Dashboard")
  5. Design tokens panel allows creating color/spacing/typography tokens
  6. Token picker in properties panel, $variable references resolve at render

Plans:
- [ ] 03-01: TBD

### Phase 4: E2E Tests & Polish
**Goal**: Comprehensive test coverage, Electron validation, performance
**Depends on**: All previous phases
**Requirements**: (implicit — testing all features)
**Success Criteria**:
  1. Playwright E2E tests cover canvas, connections, ERD, shared views, tokens
  2. Electron desktop app works correctly
  3. Canvas renders at 60fps (< 16ms per frame)
  4. MCP server works from Claude Code

Plans:
- [ ] 04-01: TBD

## Progress

**Execution Order:** 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|---------------|--------|-----------|
| 1. Clone, Rebrand & Verify | 5/5 | Complete | 2026-03-16 |
| 2. Storyboard Connections & Data Entities | 0/2 | Not started | - |
| 3. Shared Views & Design Tokens | 0/1 | Not started | - |
| 4. E2E Tests & Polish | 0/1 | Not started | - |
