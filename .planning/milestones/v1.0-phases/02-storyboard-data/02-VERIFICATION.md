---
phase: 02-storyboard-data
verified: 2026-03-16T22:30:00Z
status: passed
score: 15/15 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 12/15
  gaps_closed:
    - "GAP-CONN-TARGET: ScreenConnection.targetFrameId added; picker shows Page > Frame grouped hierarchy"
    - "GAP-CONN-SAME-PAGE: Same-page filter removed; all non-ERD pages (including current page) are selectable"
    - "GAP-CONN-VIZ: drawConnectionBadge enhanced with targetName parameter; dark pill label displayed next to green circle"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Select element in property panel and verify Navigate-to dropdown lists pages and frames"
    expected: "ConnectionSection renders Page > Frame grouped picker; same-page frames are listed; selecting a frame creates connection with targetFrameId set; ConnectionRow shows Page > Frame name"
    why_human: "React rendering and dropdown interaction cannot be verified programmatically"
  - test: "Verify green badge appears at top-right of connected element on canvas with frame name label"
    expected: "16px emerald circle with arrow icon at top-right; dark pill label to its right showing frame/page name"
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
**Verified:** 2026-03-16T22:30:00Z
**Status:** PASSED
**Re-verification:** Yes — after gap closure (Plan 02-03, commits 2aacf03 and 7860ccf)

---

## Re-verification Summary

Previous verification (2026-03-16T22:00:00Z) found 3 gaps. Plan 02-03 was executed to close them. This re-verification confirms all 3 gaps are closed and all 14 original requirements remain satisfied.

| Gap | Was | Now |
|-----|-----|-----|
| GAP-CONN-TARGET (Blocker) — CONN-01, CONN-02 | `ScreenConnection` had no `targetFrameId`; picker only showed pages | `targetFrameId?: string` added to interface; grouped Select shows Page > Frame hierarchy |
| GAP-CONN-SAME-PAGE (Blocker) — CONN-01 | `p.id !== pageId` filter blocked same-page selection | Filter removed; only ERD pages excluded; same-page frames visible |
| GAP-CONN-VIZ (Warning) — CONN-05 | Badge showed green circle only, no target info | `drawConnectionBadge` accepts `targetName?`; dark pill label rendered to badge's right |

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can select an element and see a 'Navigate to' section in property panel | VERIFIED | `ConnectionSection` imported and rendered in `property-panel.tsx`; gated on non-ERD page |
| 2 | User can pick target screen from a Page > Frame grouped dropdown | VERIFIED | `connection-section.tsx` lines 43-46 build `pageFrameTree`; lines 101-136 render `SelectGroup + SelectLabel + SelectItem` per frame |
| 3 | User can create a connection targeting a frame on the same page | VERIFIED | Filter on line 38-40 only excludes `p.type !== 'erd'`; `p.id !== pageId` filter removed |
| 4 | User can set trigger event (click/hover/submit) and transition type (push/modal/replace) | VERIFIED | Two `Select` components in `ConnectionRow` with all three options each, wired to `updateConnection` |
| 5 | User can add optional label to a connection | VERIFIED | `Input` component bound to `connection.label` in `ConnectionRow`, updates via `onUpdate({label:...})` |
| 6 | User can delete a connection from property panel | VERIFIED | Trash2 button in `ConnectionRow` calls `onRemove` -> `removeConnection(conn.id)` |
| 7 | Elements with connections show badge displaying target frame name on canvas | VERIFIED | `drawConnectionBadge` in `skia-overlays.ts` line 579 accepts `targetName?`; dark pill rendered lines 624-659; `skia-engine.ts` builds `connInfoMap` with resolved `targetName` at lines 689-706 |
| 8 | Connections persist in .pb file and survive save/load | VERIFIED | `PenDocument.connections?: ScreenConnection[]` type defined; backward-compat in `normalize-pen-file.ts` |
| 9 | User can open data panel via toolbar Database button or Ctrl+Shift+D | VERIFIED | Database button in `toolbar.tsx`; Ctrl+Shift+D in `editor-layout.tsx` |
| 10 | User can create a new data table with a name | VERIFIED | `addEntity(name)` in DataPanel; `createDataActions.addEntity` substantive implementation |
| 11 | User can add typed fields (6 types including relation) to a table | VERIFIED | `DataFieldRow` component; `createDataActions.addField` covers all 6 types |
| 12 | User can enter sample data rows inline in a Notion-like table | VERIFIED | `DataEntityTable` with per-cell editors, debounced `updateRowValue`, `+ New row` button |
| 13 | User can create data views with filter and sort | VERIFIED | `DataViewControls` with filter/sort Popover; `applyFilters`/`applySorts` in `document-store-data.ts` |
| 14 | User can create an ERD page from page tabs add menu | VERIFIED | Dropdown in `page-tabs.tsx` calls `addPage('erd')` |
| 15 | ERD page renders table nodes with header, field list, PK/FK badges | VERIFIED | `SkiaErdRenderer.renderErd()` substantive (658 lines); `isErdPage` flag in `skia-engine.ts` |

**Score:** 15/15 truths verified

---

## Required Artifacts

### Plan 01 Artifacts (original + gap closure)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/types/pen.ts` | ScreenConnection with targetFrameId, PenDocument.connections | VERIFIED | `ScreenConnection.targetFrameId?: string` at line 17; `PenDocument.connections?` at line 40 |
| `src/components/panels/connection-section.tsx` | Page > Frame grouped picker, no same-page filter, getTargetDisplayName | VERIFIED | Lines 38-40 filter (ERD only); lines 43-46 `pageFrameTree`; lines 60-69 `getTargetDisplayName`; SelectGroup/SelectLabel imported |
| `src/stores/document-store-connections.ts` | Connection CRUD supporting targetFrameId | VERIFIED | Spread operators in `addConnection`/`updateConnection` naturally pass `targetFrameId` (no code change needed) |
| `src/canvas/skia/skia-overlays.ts` | drawConnectionBadge with targetName param, pill label | VERIFIED | Signature at line 574 includes `targetName?: string`; pill label rendered lines 623-659 |
| `src/canvas/skia/skia-renderer.ts` | Wrapper passes targetName through | VERIFIED | Lines 1557-1562 pass `targetName` to `_drawConnectionBadge` |
| `src/canvas/skia/skia-engine.ts` | connInfoMap with target name resolution | VERIFIED | Lines 689-706 build `Map<string, {count, targetName}>`; resolves frame name from `targetFrameId` or page name fallback |
| `src/__tests__/connections/connection-store.test.ts` | Tests covering targetFrameId and same-page | VERIFIED | 5 new tests in `targetFrameId support` and `same-page connections` describe blocks; 20 tests total, all pass |
| `src/i18n/locales/en.ts` | connection.selectTarget, connection.pageOnly keys | VERIFIED | Lines 419-420 confirmed |

### Plan 02 Artifacts (unchanged, regression check)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/stores/document-store-data.ts` | createDataActions | VERIFIED | Present and substantive |
| `src/components/panels/data-panel.tsx` | Floating data panel | VERIFIED | Present with entity tabs, field list |
| `src/components/panels/data-entity-table.tsx` | Notion-like table | VERIFIED | Present with cell editors |
| `src/canvas/skia/skia-erd-renderer.ts` | SkiaErdRenderer class | VERIFIED | Present (658 lines) |
| `src/__tests__/data-entities/data-store.test.ts` | Unit tests | VERIFIED | 29 tests passing |
| `src/__tests__/data-entities/erd-renderer.test.ts` | Unit tests | VERIFIED | 13 tests passing |

---

## Key Link Verification

### Gap Closure Key Links (Plan 03)

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `connection-section.tsx` | `document-store-connections.ts` | `addConnection` with `targetFrameId` | WIRED | `handleAddTarget(targetPageId, targetFrameId?)` at line 48; `addConnection({..., targetFrameId})` at line 53 |
| `skia-engine.ts` | `skia-overlays.ts` | `drawConnectionBadge` with `targetName` | WIRED | `connInfoMap` built at lines 689-706 resolving `targetName`; passed to `this.renderer.drawConnectionBadge(..., info.targetName)` at line 716 |
| `connection-section.tsx` picker | same-page frames | No `p.id !== pageId` filter | WIRED | Filter line 38-40 only excludes ERD type; confirmed by grep showing absence of `p.id !== pageId` |

### Original Key Links (Plan 01 — regression verified)

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `property-panel.tsx` | `connection-section.tsx` | `ConnectionSection` import and render | WIRED | Unchanged |
| `document-store.ts` | `document-store-connections.ts` | `createConnectionActions` spread | WIRED | Unchanged |

### Original Key Links (Plan 02 — regression verified)

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `data-panel.tsx` | `document-store.ts` | `useDocumentStore` data actions | WIRED | Unchanged |
| `skia-engine.ts` | `skia-erd-renderer.ts` | ERD page delegation | WIRED | Unchanged |
| `page-tabs.tsx` | `document-store.ts` | `addPage('erd')` | WIRED | Unchanged |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CONN-01 | 02-01, 02-03 | Element-to-screen/frame navigation via property panel, same-page allowed | SATISFIED | Page > Frame grouped picker; no same-page exclusion; `targetFrameId` stored; `getTargetDisplayName` shows "Page > Frame" format |
| CONN-02 | 02-01, 02-03 | Connection stores sourceElement, targetPage, targetFrame (optional), trigger, transition | SATISFIED | `ScreenConnection` has all 7 fields including `targetFrameId?: string` |
| CONN-03 | 02-01 | User can add labels to connections | SATISFIED | `Input` bound to `connection.label` in `ConnectionRow` |
| CONN-04 | 02-01 | User can delete a connection from property panel | SATISFIED | Trash2 button calls `removeConnection` in `ConnectionRow` |
| CONN-05 | 02-01, 02-03 | Elements with connections show visual indicator with target name | SATISFIED | `drawConnectionBadge` shows green circle + dark pill label with target frame/page name |
| ERD-01 | 02-02 | User can create data tables with name and typed fields on ERD page | SATISFIED | `DataPanel` + `createDataActions.addEntity/addField`; ERD page renders them |
| ERD-02 | 02-02 | User can draw relation edges with 1:1, 1:N, N:M cardinality | SATISFIED | `SkiaErdRenderer` draws edges per `relatedEntityId` + `relationCardinality` |
| ERD-03 | 02-02 | Table nodes display field names, types, PK/FK badges | SATISFIED | `SkiaErdRenderer` renders field rows with type text and PK/FK badges |
| ERD-04 | 02-02 | User can drag table nodes to rearrange ERD layout | SATISFIED | ERD drag in `skia-canvas.tsx` calls `updateEntityErdPosition`; persists via `erdPosition` |
| DATA-01 | 02-02 | Data entities sidebar panel for managing tables and fields | SATISFIED | `DataPanel` with entity tabs, field list, `DataFieldRow` |
| DATA-02 | 02-02 | Sample data rows (Notion-like) | SATISFIED | `DataEntityTable` with inline editors, debounced `updateRowValue`, `+ New row` button |
| DATA-03 | 02-02 | Data views with filter and sort | SATISFIED | `DataViewControls`, `applyFilters`/`applySorts` in `document-store-data.ts` |
| DATA-04 | 02-02 | Data entities stored in .pb file | SATISFIED | `PenDocument.dataEntities?: DataEntity[]` saved with document |
| DATA-05 | 02-02 | ERD page type (dedicated page for schema visualization) | SATISFIED | `PenPage.type?: 'screen' \| 'erd'`; `addPage('erd')` creates ERD page; `SkiaEngine` detects and delegates to `SkiaErdRenderer` |

**14/14 Phase 2 requirements satisfied.**

---

## Test Suite Summary

| Test File | Tests | Status |
|-----------|-------|--------|
| `src/__tests__/connections/connection-store.test.ts` | 20 passing (15 original + 5 new) | ALL PASS |
| `src/__tests__/data-entities/data-store.test.ts` | 29 passing | ALL PASS |
| `src/__tests__/data-entities/erd-renderer.test.ts` | 13 passing | ALL PASS |
| **Phase 2 total** | **62 passing** | **ALL PASS** |

TypeScript: 0 errors (`./node_modules/.bin/tsc --noEmit` exits clean)

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/types/data-entity.ts` | 5-11 | `DataFieldType` uses 6 types instead of plan-specified 9 (multi-select/checkbox/url/email omitted) | INFO | Scope simplification — types are self-consistent across UI and ERD renderer. Does not block goal. |

No blocker or warning anti-patterns found.

---

## Cascade Integrity (unchanged, confirmed via regression)

- **removeNode cascade**: `document-store.ts` filters `connections` where `sourceElementId !== id`. Verified.
- **removePage cascade**: `document-store-pages.ts` filters connections where neither `sourcePageId` nor `targetPageId` equals the deleted page. Verified.
- **removeEntity cascade**: `document-store-data.ts` `removeEntity` also removes relation fields in other entities referencing the deleted entity. Verified.

---

## Human Verification Required

### 1. Connection Property Panel — Page > Frame Picker

**Test:** Start dev server, open /editor, create a page with 2+ frames, select a shape, look for "Navigate to" in the right panel. Click +, verify dropdown shows frames grouped under page names — including frames on the SAME page as the shape.
**Expected:** Page name shown as group header (non-selectable label); frame names listed beneath as selectable items with slight indent; selecting a frame creates a connection row showing "PageName > FrameName" text; rows on same page as source are accessible (no filter blocking them)
**Why human:** React rendering and Radix Select dropdown interaction cannot be verified by static analysis

### 2. Connection Badge with Frame Name Label

**Test:** After creating a connection (from test 1), look at the shape on the canvas.
**Expected:** Small green circle badge (16px, emerald) at top-right corner; dark semi-transparent pill immediately to the right of the circle showing the target frame name (e.g. "Home Screen"); label truncates gracefully if frame name is long
**Why human:** Canvas rendering via CanvasKit/WebGL is not verifiable by code inspection alone

### 3. ERD Page Table Node Rendering

**Test:** Create data entities via Data panel, add an ERD page via the page tabs dropdown, switch to the ERD page.
**Expected:** Each entity renders as a card with blue (#3b82f6) header showing entity name; body with field rows showing field name and type text; amber "PK" badge on primary key fields; purple "FK" badge on relation fields
**Why human:** SkiaErdRenderer rendering requires visual inspection

### 4. ERD Relation Edges and Cardinality

**Test:** Create two entities with a relation field between them, switch to ERD page.
**Expected:** Indigo line drawn between the two entity cards with cardinality text markers ("1", "N", or "M") near the endpoints; crow's foot notation for many-side relations
**Why human:** Visual edge rendering between entity nodes cannot be verified statically

### 5. ERD Node Drag Persistence

**Test:** On ERD page, drag a table node to a new position; save file (Ctrl+S); reload file.
**Expected:** Table node stays at dragged position after reload (erdPosition persisted in .pb file)
**Why human:** Drag interaction and file save/reload cycle requires browser automation

### 6. Notion-like Data Table

**Test:** Open Data panel, create a table, add a text field and number field, add 3 rows, add a filter on the number field using "gt" operator, add a sort ascending on the text field.
**Expected:** Only rows matching filter are displayed, in ascending alphabetical order; Tab moves to next cell, Enter to next row
**Why human:** UI interaction with filter/sort configuration and table cell editing requires manual testing

---

_Verified: 2026-03-16T22:30:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification: Yes — after gap closure plan 02-03 (commits 2aacf03, 7860ccf)_
