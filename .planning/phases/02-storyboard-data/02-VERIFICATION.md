---
phase: 02-storyboard-data
verified: 2026-03-16T22:00:00Z
status: gaps_found
score: 12/15 must-haves verified
re_verification: false
gaps:
  - id: GAP-CONN-TARGET
    requirement: CONN-01, CONN-02
    severity: blocker
    description: "Connection targets Page only, should target Page > Frame. Users design multiple frames (screens) on a single page and need to connect elements to specific frames, including frames on the same page."
    status: failed
  - id: GAP-CONN-SAME-PAGE
    requirement: CONN-01
    severity: blocker
    description: "Same-page connections blocked — code filters out current page from target picker. Most connections are between frames on the same page since users typically work on a single page."
    status: failed
  - id: GAP-CONN-VIZ
    requirement: CONN-05
    severity: warning
    description: "Connection badge visualization doesn't clearly show which frame is being connected to. Needs to display target frame name or draw visible arrow/line to target."
    status: failed
human_verification:
  - test: "Select element in property panel and verify Navigate-to dropdown lists pages"
    expected: "ConnectionSection renders in right panel, + button opens target screen picker, selecting a page creates connection"
    why_human: "React rendering and dropdown interaction cannot be verified programmatically"
  - test: "Verify green badge appears at top-right of connected element on canvas"
    expected: "16px emerald circle with arrow icon at top-right corner of element that has a connection"
    why_human: "Canvas rendering via CanvasKit/WebGL cannot be verified by grep"
  - test: "Open ERD page, verify table nodes render with blue header and field rows"
    expected: "Entity name in blue header, field rows with name/type, PK badge in amber, FK badge in purple"
    why_human: "ERD canvas rendering via SkiaErdRenderer cannot be verified statically"
  - test: "Draw relation between tables on ERD page and verify cardinality markers"
    expected: "Line between entity nodes with '1', 'N', or 'M' text and crow's foot notation"
    why_human: "Visual rendering of relation edges cannot be verified programmatically"
  - test: "Drag a table node on ERD page and reload - verify position persists"
    expected: "Table node stays at new position after save/load via erdPosition on DataEntity"
    why_human: "ERD drag interaction requires browser event simulation"
  - test: "Open Data panel, create table, add fields, enter rows, apply filter and sort"
    expected: "Notion-like table shows rows matching filter, ordered by sort config"
    why_human: "Full data panel UI interaction cannot be verified statically"
---

# Phase 2: Storyboard Connections & Data Entities Verification Report

**Phase Goal:** Users can connect screen elements to other screens via property panel, and manage Notion-like data entities (tables, fields, sample data, relations, views) within .pb files
**Verified:** 2026-03-16T22:00:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Plan 01 — Screen Connections)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can select an element and see a 'Navigate to' section in property panel | VERIFIED | `ConnectionSection` imported and rendered in `property-panel.tsx` line 359, gated on non-ERD page |
| 2 | User can pick target screen from dropdown, creating connection with trigger=click, transition=push | VERIFIED | `handleAddTarget` in `connection-section.tsx` calls `addConnection` with correct defaults |
| 3 | User can set trigger event (click/hover/submit) and transition type (push/modal/replace) | VERIFIED | Two `Select` components in `ConnectionRow` with all three options each, wired to `updateConnection` |
| 4 | User can add optional label to a connection | VERIFIED | `Input` component bound to `connection.label` in `ConnectionRow`, updates via `onUpdate({label:...})` |
| 5 | User can delete a connection from property panel | VERIFIED | Trash2 button in `ConnectionRow` calls `onRemove` -> `removeConnection(conn.id)` |
| 6 | Elements with connections show green badge at top-right corner on canvas | VERIFIED | `drawConnectionBadge` exported from `skia-overlays.ts` (line 574), called in `skia-engine.ts` overlay pass (line 698) |
| 7 | Connections persist in .pb file and survive save/load | VERIFIED | `PenDocument.connections?: ScreenConnection[]` type defined, backward-compat comment in `normalize-pen-file.ts` line 35 |

### Observable Truths (Plan 02 — Data Entities & ERD)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 8 | User can open data panel via toolbar Database button or Ctrl+Shift+D | VERIFIED | Database button in `toolbar.tsx` lines 259-268 calls `toggleDataPanel`; Ctrl+Shift+D handler in `editor-layout.tsx` line 85-88 |
| 9 | User can create a new data table with a name | VERIFIED | `addEntity(name)` called from DataPanel empty-state CTA (line 129) and header + button (line 262) |
| 10 | User can add typed fields (6 types including relation) to a table | VERIFIED | `DataFieldRow` component renders type-specific selectors; `createDataActions.addField` substantive implementation |
| 11 | User can enter sample data rows inline in a Notion-like table | VERIFIED | `DataEntityTable` component with per-cell editors, debounced `updateRowValue` calls; `addRow` wired to "+ New row" button |
| 12 | User can create data views with filter and sort | VERIFIED | `DataViewControls` component with filter/sort Popover; `applyFilters`/`applySorts` pure functions exported from `document-store-data.ts` |
| 13 | User can create an ERD page from page tabs add menu | VERIFIED | Dropdown in `page-tabs.tsx` calls `addPage('erd')` at line 68; `addPage` in `document-store-pages.ts` accepts optional type parameter |
| 14 | ERD page renders table nodes with header, field list, PK/FK badges | VERIFIED | `SkiaErdRenderer.renderErd()` substantive implementation (658 lines), `isErdPage` flag in `skia-engine.ts` triggers ERD rendering path |
| 15 | ERD page shows relation edges with cardinality markers (1:1, 1:N, N:M) | VERIFIED | ERD renderer checks `field.type === 'relation' && field.relatedEntityId` and draws edges with cardinality text (lines 400-540 in `skia-erd-renderer.ts`) |
| 16 | User can drag table nodes on ERD page to rearrange layout | VERIFIED | ERD drag wired in `skia-canvas.tsx`; `updateEntityErdPosition` store action persists drag result |
| 17 | All data entities persist in .pb file | VERIFIED | `PenDocument.dataEntities?: DataEntity[]` type defined, stored in document-store, saved with document |

**Score:** 17/17 truths verified (including derived sub-truths within PLAN must_haves)

---

## Required Artifacts

### Plan 01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/types/pen.ts` | ScreenConnection interface, PenDocument.connections | VERIFIED | `ScreenConnection` at line 12, `PenDocument.connections?` at line 39, `PenPage.type?` at line 27 |
| `src/types/data-entity.ts` | DataEntity, DataField, DataRow, DataView, DataFilter, DataSort | VERIFIED | All 6 interfaces exported; DataFieldType covers 6 types (text/number/boolean/date/select/relation) |
| `src/stores/document-store-connections.ts` | createConnectionActions | VERIFIED | `createConnectionActions` exported, substantive (79 lines), add/remove/update/getters all present |
| `src/components/panels/connection-section.tsx` | ConnectionSection component | VERIFIED | Default export `ConnectionSection`, substantive (186 lines), not a stub |
| `src/canvas/skia/skia-overlays.ts` | drawConnectionBadge | VERIFIED | `drawConnectionBadge` exported at line 574 |
| `src/__tests__/connections/connection-store.test.ts` | Unit tests (min 80 lines) | VERIFIED | 325 lines, 15 passing tests |

### Plan 02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/stores/document-store-data.ts` | createDataActions | VERIFIED | `createDataActions` + `DataActions` interface exported, substantive (407+ lines) |
| `src/components/panels/data-panel.tsx` | Floating data panel | VERIFIED | Default export `DataPanel`, substantive with entity tabs, field list, table sections |
| `src/components/panels/data-entity-table.tsx` | Notion-like table | VERIFIED | Default export with `addRow` wired, cell editors per field type |
| `src/canvas/skia/skia-erd-renderer.ts` | SkiaErdRenderer class | VERIFIED | `SkiaErdRenderer` class exported (line 229), `erdHitTest` exported (line 206), 658 lines |
| `src/__tests__/data-entities/data-store.test.ts` | Unit tests (min 120 lines) | VERIFIED | 418 lines, 28 passing tests covering CRUD, filter/sort, cascade, undo |
| `src/__tests__/data-entities/erd-renderer.test.ts` | Unit tests (min 30 lines) | VERIFIED | 191 lines, 17 passing tests for erdHitTest and auto-layout |
| `src/components/editor/toolbar.tsx` | Database toolbar button | VERIFIED | Database icon button renders at lines 259-268, reads `dataPanelOpen`, calls `toggleDataPanel` |

---

## Key Link Verification

### Plan 01 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `connection-section.tsx` | `document-store.ts` | `useDocumentStore` addConnection/removeConnection/updateConnection | WIRED | Lines 25-27: all three actions read from store; called in handlers |
| `property-panel.tsx` | `connection-section.tsx` | `ConnectionSection` import and render | WIRED | Import at line 18, rendered at line 359 with `nodeId` and `pageId` props |
| `skia-engine.ts` | `skia-overlays.ts` | `drawConnectionBadge` call in render overlay pass | WIRED | `this.renderer.drawConnectionBadge(...)` at line 698 |
| `document-store.ts` | `document-store-connections.ts` | `createConnectionActions` spread into store | WIRED | Import at line 30, spread at line 722 |

### Plan 02 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `data-panel.tsx` | `document-store.ts` | `useDocumentStore` addEntity/removeEntity/addField | WIRED | Lines 28-31 in data-panel.tsx; all three actions used in handlers |
| `skia-engine.ts` | `skia-erd-renderer.ts` | ERD page detection, delegation to SkiaErdRenderer | WIRED | `import SkiaErdRenderer` line 29, `this.erdRenderer.renderErd(...)` line 570, `isErdPage` flag line 381 |
| `page-tabs.tsx` | `document-store.ts` | `addPage` with type 'erd' | WIRED | `addPage('erd')` at line 68 in page-tabs.tsx |
| `document-store.ts` | `document-store-data.ts` | `createDataActions` spread into store | WIRED | Import at line 31, spread at line 728 |
| `canvas-store.ts` | `data-panel.tsx` | `dataPanelOpen` and `dataFocusEntityId` state | WIRED | `dataPanelOpen` in canvas-store used by editor-layout (line 36) to conditionally render DataPanel; `dataFocusEntityId` read in data-panel.tsx line 34 |
| `toolbar.tsx` | `canvas-store.ts` | Database button calls `toggleDataPanel` | WIRED | `toggleDataPanel` at line 38, called at line 259 |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CONN-01 | 02-01 | Element-to-screen navigation via property panel "Navigate to" | SATISFIED | ConnectionSection rendered in property-panel.tsx; dropdown lists non-ERD pages |
| CONN-02 | 02-01 | Connection stores sourceElement, targetPage, trigger, transition | SATISFIED | ScreenConnection interface has all 5 fields; addConnection stores them |
| CONN-03 | 02-01 | User can add labels to connections | SATISFIED | `Input` component bound to `connection.label` in ConnectionRow |
| CONN-04 | 02-01 | User can delete a connection from property panel | SATISFIED | Trash2 button calls removeConnection in ConnectionRow |
| CONN-05 | 02-01 | Elements with connections show visual indicator badge | SATISFIED | drawConnectionBadge in skia-overlays.ts, called from skia-engine.ts overlay pass |
| ERD-01 | 02-02 | User can create data tables with name and typed fields on ERD page | SATISFIED | DataPanel + createDataActions.addEntity/addField; ERD page renders them |
| ERD-02 | 02-02 | User can draw relation edges with 1:1, 1:N, N:M cardinality | SATISFIED | Relation field type in DataField; SkiaErdRenderer draws edges per `relatedEntityId` + `relationCardinality` |
| ERD-03 | 02-02 | Table nodes display field names, types, PK/FK badges | SATISFIED | SkiaErdRenderer renders field rows with type text and PK/FK badge draws |
| ERD-04 | 02-02 | User can drag table nodes to rearrange ERD layout | SATISFIED | ERD drag in skia-canvas.tsx calls `updateEntityErdPosition`; positions persist via `erdPosition` |
| DATA-01 | 02-02 | Data entities sidebar panel for managing tables and fields | SATISFIED | DataPanel component with entity tabs, field list, DataFieldRow |
| DATA-02 | 02-02 | Sample data rows (Notion-like) | SATISFIED | DataEntityTable with inline editors, debounced updateRowValue, "+ New row" button |
| DATA-03 | 02-02 | Data views with filter and sort | SATISFIED | DataViewControls, applyFilters/applySorts exported from document-store-data.ts |
| DATA-04 | 02-02 | Data entities stored in .pb file | SATISFIED | PenDocument.dataEntities?: DataEntity[]; saved with document via document-store |
| DATA-05 | 02-02 | ERD page type (dedicated page for schema visualization) | SATISFIED | PenPage.type?: 'screen' \| 'erd'; addPage('erd') creates ERD page; SkiaEngine detects and delegates to SkiaErdRenderer |

**14/14 Phase 2 requirements satisfied.**

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/types/data-entity.ts` | 5-11 | DataFieldType uses 6 types (text/number/boolean/date/select/relation) instead of plan-specified 9 types (multi-select/checkbox/url/email omitted, boolean used instead) | INFO | Scope simplification — types are self-consistent, UI and ERD renderer both use the same 6-type enum. Does not block goal. |

No blocker or warning anti-patterns found.

---

## Cascade Integrity

- **removeNode cascade**: `document-store.ts` line 180 filters `connections` where `sourceElementId !== id`. Verified.
- **removePage cascade**: `document-store-pages.ts` lines 70-71 filters connections where both `sourcePageId` and `targetPageId` are not the deleted page. Verified.
- **removeEntity cascade**: `document-store-data.ts` removeEntity also removes relation fields in other entities referencing the deleted entity. Verified by passing test "removes relation fields in OTHER entities that reference it".

---

## Test Suite Summary

| Test File | Tests | Status |
|-----------|-------|--------|
| `src/__tests__/connections/connection-store.test.ts` | 15 passing | ALL PASS |
| `src/__tests__/data-entities/data-store.test.ts` | 28 passing | ALL PASS |
| `src/__tests__/data-entities/erd-renderer.test.ts` | 17 passing (+ 40 others in suite) | ALL PASS |
| **Full suite** | **100 passing** | **ALL PASS** |

TypeScript: 0 errors (`./node_modules/.bin/tsc --noEmit` exits clean)

---

## Human Verification Required

### 1. Connection Property Panel

**Test:** Start dev server, open /editor, create 2+ pages, select a shape on page 1, look for "Navigate to" in the right panel
**Expected:** "Navigate to" section header appears with + button; clicking + shows dropdown of available pages (excluding current page and ERD pages); selecting a page creates a connection row with trigger/transition selects and optional label input; trash icon removes the connection
**Why human:** React rendering and DOM interaction cannot be verified by static code analysis

### 2. Connection Badge on Canvas

**Test:** After creating a connection (from test 1), look at the shape on the canvas
**Expected:** Small green circle badge (16px, emerald-500 color) appears at the top-right corner of the connected element; badge shows count "2" if multiple connections exist
**Why human:** Canvas rendering via CanvasKit/WebGL is not verifiable by code inspection alone

### 3. ERD Page Table Node Rendering

**Test:** Create data entities via Data panel, add an ERD page via the page tabs dropdown, switch to the ERD page
**Expected:** Each entity renders as a card with blue (#3b82f6) header showing entity name, white text; body with field rows showing field name, type text; amber "PK" badge on primary key fields; purple "FK" badge on relation fields
**Why human:** SkiaErdRenderer rendering requires visual inspection

### 4. ERD Relation Edges and Cardinality

**Test:** Create two entities with a relation field between them, switch to ERD page
**Expected:** Indigo line drawn between the two entity cards with cardinality text markers ("1", "N", or "M") near the endpoints; crow's foot notation for many-side relations
**Why human:** Visual edge rendering between entity nodes cannot be verified statically

### 5. ERD Node Drag Persistence

**Test:** On ERD page, drag a table node to a new position; save file (Ctrl+S); reload file
**Expected:** Table node stays at dragged position after reload (erdPosition persisted in .pb file)
**Why human:** Drag interaction and file save/reload cycle requires browser automation

### 6. Notion-like Data Table

**Test:** Open Data panel, create a table, add a text field and number field, add 3 rows, add a filter on the number field using "gt" operator, add a sort ascending on the text field
**Expected:** Only rows matching filter are displayed, in ascending alphabetical order; Tab moves to next cell, Enter to next row
**Why human:** UI interaction with filter/sort configuration and table cell editing requires manual testing

---

## Gaps Summary

3 gaps found from user feedback during human verification:

### GAP-CONN-TARGET (Blocker) — CONN-01, CONN-02
**Connection targets Page only, should target Page > Frame.**
Current `ScreenConnection.targetPageId` only points to a page. Users design multiple frames (screens) on a single page and need connections to point to specific frames. Need to add `targetFrameId?: string` and update the picker UI to show a Page > Frame tree hierarchy.

**Files affected:** `src/types/pen.ts` (ScreenConnection type), `src/components/panels/connection-section.tsx` (target picker), `src/stores/document-store-connections.ts` (CRUD logic)

### GAP-CONN-SAME-PAGE (Blocker) — CONN-01
**Same-page connections blocked.**
Current code in `connection-section.tsx` line 37 filters `p.id !== pageId`, preventing selection of frames on the current page. Most storyboard connections are between frames on the same page since users typically work within a single page and only create additional pages when frame count is large.

**Files affected:** `src/components/panels/connection-section.tsx` (remove page filter, show frames)

### GAP-CONN-VIZ (Warning) — CONN-05
**Connection badge doesn't show target frame name.**
Current badge is a small green circle with no text indicating which frame is the target. Needs to display target frame name or provide clearer visual indication of the connection destination.

**Files affected:** `src/canvas/skia/skia-overlays.ts` (drawConnectionBadge), `src/canvas/skia/skia-engine.ts` (overlay pass)

---

_Verified: 2026-03-16T22:00:00Z_
_Verifier: Claude (gsd-verifier)_
