---
phase: 01-clone-rebrand-verify
verified: 2026-03-16T17:30:00Z
status: human_needed
score: 7/7 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 5/7
  gaps_closed:
    - "CANVAS-06: Alignment guides not wired — now fixed: activeGuides on SkiaEngine, computeGuides() in drag handler, renderer.drawGuide() called in render loop"
    - "Save dialog showing .op — now fixed: saveDocumentAs accept list contains only ['.pb']"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Open dev server (bun --bun run dev), create two rectangles, drag one near the other slowly"
    expected: "Orange dashed alignment guide lines appear when edges or centers align with the nearby shape. Shape snaps to the guide position."
    why_human: "Guide rendering requires live app interaction. Static analysis confirms the full code path is now wired: computeGuides() runs in drag handler, engine.activeGuides is set, render loop calls renderer.drawGuide() for each guide."
  - test: "Verify browser tab and window title show PenBoard after navigating to http://localhost:3000"
    expected: "Tab title: PenBoard Editor. Redirected to /editor."
    why_human: "Title rendering requires running browser"
  - test: "Press Ctrl+Shift+S (Save As) in browser editor"
    expected: "Save dialog shows only .pb format option — no .op option visible"
    why_human: "Native file dialog behavior is only observable at runtime"
  - test: "Press Ctrl+O in browser — check file dialog filter label"
    expected: "File picker shows 'PenBoard File' accepting .pb, .op, .pen, .json"
    why_human: "File dialog labels are runtime browser/OS behavior"
---

# Phase 1: Clone, Rebrand & Verify — Verification Report

**Phase Goal:** Clone OpenPencil, rebrand to PenBoard, verify all canvas features work
**Verified:** 2026-03-16T17:30:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (plans 01-04, 01-05)

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | All source identifiers use penboard/PenBoard branding (package, appId, MCP name, localStorage keys, window globals) | VERIFIED | package.json name:"penboard"; electron-builder.yml appId:"dev.penboard.app"; MCP_SERVER_NAME='penboard'; all 9 localStorage keys confirmed "penboard-*" prefix |
| 2 | Zero openpencil identifiers remain in source code (excluding intentional origin references) | VERIFIED | grep across all .ts/.tsx in src/ returns zero matches — confirmed no regression |
| 3 | All i18n locales, READMEs, GitHub templates, and docs show PenBoard branding | VERIFIED | src/i18n/locales/en.ts landing.open="Pen", landing.pencil="Board"; README.md header "PenBoard"; LICENSE "PenBoard contributors" |
| 4 | Landing page at / redirects to /editor | VERIFIED | src/routes/index.tsx line 5: `throw redirect({ to: '/editor', replace: true })` |
| 5 | File operations support .pb as default save format and accept .op for backward compatibility | VERIFIED | saveDocumentAs: accept:{'application/json':['.pb']} only; openDocumentFS: accept includes .pb, .op, .pen, .json; openDocument fallback: input.accept='.pb,.op,.pen,.json' |
| 6 | CanvasKit/Skia WebGL canvas engine renders shapes and is wired into the editor | VERIFIED | skia-engine.ts calls ck.MakeWebGLCanvasSurface(); editor-layout.tsx mounts SkiaCanvas; skia-renderer.ts is 1555 lines of GPU draw calls |
| 7 | Alignment guides appear when moving shapes near others | VERIFIED (code path) | computeGuides() defined at skia-canvas.tsx lines 43-129; engine.activeGuides assigned at line 729; render loop draws guides at skia-engine.ts lines 660-663; renderer.drawGuide() wired. Requires human confirmation guides render visually. |

**Score: 7/7 truths verified (automated). Human confirmation pending for truth 7 (visual rendering).**

---

### Required Artifacts

#### Plan 01-01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `package.json` | Package identity "penboard" | VERIFIED | name:"penboard", bin:"penboard-mcp" |
| `electron-builder.yml` | appId "dev.penboard.app" | VERIFIED | appId:dev.penboard.app, productName:PenBoard |
| `electron/constants.ts` | "penboard" references | VERIFIED | GITHUB_REPO:'penboard', PORT_FILE_DIR_NAME:'.penboard' |
| `src/constants/app.ts` | "penboard" references | VERIFIED | PORT_FILE_DIR_NAME:'.penboard' |
| `server/api/ai/mcp-install.ts` | MCP server name "penboard" | VERIFIED | MCP_SERVER_NAME='penboard' at line 30 |

#### Plan 01-02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/i18n/locales/en.ts` | PenBoard branding | VERIFIED | landing.open="Pen", landing.pencil="Board", landing.tagline="Storyboard Design Tool..." |
| `README.md` | PenBoard branding | VERIFIED | H1: "PenBoard", all URLs reference ZSeven-W/penboard |
| `CLAUDE.md` | PenBoard identity | VERIFIED | Line 22: "PenBoard is a storyboard design tool (forked from OpenPencil)" |

#### Plan 01-03 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/routes/index.tsx` | Redirect to /editor | VERIFIED | `throw redirect({ to: '/editor', replace: true })` |
| `electron-builder.yml` | Dual file association .pb + .op | VERIFIED | ext:pb "PenBoard Document" and ext:op "PenBoard Document (Legacy)" both present |
| `src/utils/file-operations.ts` | .pb support in file dialogs, save-only .pb | VERIFIED | suggestedName:'untitled.pb', save accept:['.pb'] only, open accept:['.pb','.op','.pen','.json'] |

#### Plan 01-04 Artifacts (Gap Closure — CANVAS-06)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/canvas/skia/skia-engine.ts` | activeGuides property + render loop calls renderer.drawGuide() | VERIFIED | Line 408: `activeGuides: {...}[] = []`; lines 660-663: render loop iterates activeGuides and calls `this.renderer.drawGuide(canvas, g.x1, g.y1, g.x2, g.y2, this.zoom)` |
| `src/canvas/skia/skia-canvas.tsx` | computeGuides function + called during drag | VERIFIED | Lines 43-129: computeGuides() function definition with 5-axis alignment checking; line 728: `computeGuides(dragBounds, engine.renderNodes, dragAllIds!, threshold)` called in drag handler; line 841: `engine.activeGuides = []` cleared on mouseUp |

#### Plan 01-05 Artifacts (Gap Closure — Save dialog)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/utils/file-operations.ts` | Save dialog accept contains only ['.pb'] | VERIFIED | Line 62: `accept: { 'application/json': ['.pb'] }` — no .op in save accept; open dialog at line 91 still has ['.pb', '.op', '.pen', '.json'] |

---

### Key Link Verification

#### Plan 01-01 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/stores/*.ts` | localStorage | STORAGE_KEY constants "penboard-" | VERIFIED | All 9 keys: penboard-agent-settings, penboard-ai-model-preference, penboard-ai-concurrency, penboard-ai-ui-preferences, penboard-canvas-preferences, penboard-uikits, penboard-theme-presets, penboard-language, penboard-theme |
| `src/types/theme-preset.ts` | `src/mcp/tools/theme-presets.ts` | type literal "penboard-theme-preset" | VERIFIED | Both files use 'penboard-theme-preset' consistently |
| `electron-builder.yml` | `electron/main.ts` | appId, productName, file associations | VERIFIED | Consistent penboard/PenBoard branding in both files |

#### Plan 01-03 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/routes/index.tsx` | `/editor` | TanStack Router redirect in beforeLoad | VERIFIED | `throw redirect({ to: '/editor', replace: true })` confirmed |
| `electron/main.ts` | `electron-builder.yml` | file association + dialog filters | VERIFIED | Both accept .pb/.op/.pen; save defaults to .pb |
| `src/utils/file-operations.ts` | `electron/main.ts` | file extension validation | VERIFIED | Both files: save=.pb only, open=.pb/.op/.pen/.json |

#### Plan 01-04 Key Links (Gap Closure)

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/canvas/skia/skia-canvas.tsx` | `src/canvas/skia/skia-engine.ts` | `engine.activeGuides = computedGuides` during drag | VERIFIED | Line 729: `engine.activeGuides = guides` set in drag handler; line 841: `engine.activeGuides = []` cleared on mouseUp |
| `src/canvas/skia/skia-engine.ts` | `renderer.drawGuide()` | render loop iterates activeGuides | VERIFIED | Lines 660-663: `for (const g of this.activeGuides) { this.renderer.drawGuide(canvas, g.x1, g.y1, g.x2, g.y2, this.zoom) }` |

#### Plan 01-05 Key Links (Gap Closure)

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/utils/file-operations.ts saveDocumentAs()` | Browser showSaveFilePicker | types array with accept filter | VERIFIED | showSaveFilePicker called at line 57 with accept:['.pb'] only — .op removed |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| CANVAS-07 | 01-01 | Canvas renders with CanvasKit/Skia WebGL | VERIFIED | skia-engine.ts calls `ck.MakeWebGLCanvasSurface()` (line 425); SkiaCanvas mounted in editor-layout.tsx; skia-renderer.ts is 1555 lines of substantive GPU draw calls |
| CANVAS-01 | 01-03 | User can place shapes at any x,y on infinite pan/zoom canvas | VERIFIED | canvas-node-creator.ts handles rectangle, frame, ellipse, line, text, path, polygon; zoom/pan in skia-engine.ts; wheel zoom and space+drag panning in skia-canvas.tsx |
| CANVAS-02 | 01-03 | User can select, move, and resize shapes with handles | VERIFIED | skia-canvas.tsx: hitTest for selection, drag logic, resize handle logic, rotation handle |
| CANVAS-03 | 01-03 | User can multi-select via box selection or shift-click | VERIFIED | skia-canvas.tsx: shift+click selection; marquee with searchRect |
| CANVAS-04 | 01-03 | User can undo/redo any operation | VERIFIED | history-store.ts: undoStack/redoStack with pushState; all document mutations call pushState |
| CANVAS-05 | 01-03 | User can copy/paste shapes | VERIFIED | canvas-store.ts: clipboard field, setClipboard; keyboard shortcuts hook wires Ctrl+C/V |
| CANVAS-06 | 01-03 + 01-04 | Shapes snap to grid and show alignment guides | VERIFIED (code path) | computeGuides() in skia-canvas.tsx; engine.activeGuides wired; renderer.drawGuide() called in render loop. Full pipeline now wired. Visual confirmation requires human test. |

**All 7 Phase 1 requirements covered. No orphaned requirements.**

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

No TODO/FIXME/PLACEHOLDER patterns found. No empty stubs. No console.log-only implementations. Previous anti-patterns (dead drawGuide() call site, unused guide constants) have been resolved: renderer.drawGuide() is now called from the render loop, and SNAP_THRESHOLD/GUIDE_* constants are now in active use.

---

### Human Verification Required

All automated checks passed. The following items require a running dev server to confirm visually:

#### 1. Alignment Guides Render Visually (CANVAS-06)

**Test:** Start dev server with `bun --bun run dev`. Open http://localhost:3000 (will redirect to /editor). Create two rectangles. Drag one slowly near the other until edges or centers align.
**Expected:** Orange dashed guide lines should appear on canvas when edges or centers of shapes align with nearby shapes. The dragged shape should snap to the guide position. Guides should disappear when drag ends.
**Why human:** Static code analysis confirms the full pipeline is wired: computeGuides() runs during drag, engine.activeGuides is populated, render loop calls renderer.drawGuide() for each guide. However visual confirmation requires a live interaction test.

#### 2. Window Title Branding

**Test:** Open http://localhost:3000 in browser.
**Expected:** Browser tab shows "PenBoard Editor". Redirect occurs to /editor.
**Why human:** Title rendering is a runtime browser behavior.

#### 3. Save Dialog Extension

**Test:** In the editor, press Ctrl+Shift+S (Save As) in browser.
**Expected:** Save dialog shows ONLY ".pb" format option. No ".op" option should be visible.
**Why human:** Native file dialog behavior is only observable at runtime.

#### 4. Open Dialog Backward Compatibility

**Test:** In the editor, press Ctrl+O.
**Expected:** File picker shows "PenBoard File" accepting .pb, .op, .pen, .json (all four formats).
**Why human:** File dialog labels and filter behavior are runtime browser/OS behavior.

---

### Re-verification Summary

**Both gaps from initial verification are now closed:**

**Gap 1 — CANVAS-06 (Alignment guides not wired)** — CLOSED by plan 01-04:
- `src/canvas/skia/skia-engine.ts`: `activeGuides` property added at line 408; render loop at lines 660-663 iterates `this.activeGuides` and calls `this.renderer.drawGuide()` for each guide
- `src/canvas/skia/skia-canvas.tsx`: `computeGuides()` function added at lines 43-129 with 5-axis edge/center alignment checking; called during drag at line 728 with `SNAP_THRESHOLD / engine.zoom` tolerance; `engine.activeGuides` cleared at line 841 on mouseUp
- The previously dead `renderer.drawGuide()` method (skia-renderer.ts line 1512) is now reachable via the wired render loop

**Gap 2 — Save dialog showing .op** — CLOSED by plan 01-05:
- `src/utils/file-operations.ts` line 62: `accept: { 'application/json': ['.pb'] }` — .op removed from save dialog
- Open dialog (line 91) correctly retains `['.pb', '.op', '.pen', '.json']` for backward compatibility
- Fallback input (line 132) retains `.pb,.op,.pen,.json`

**No regressions detected:** Zero openpencil references remain in src/; all 9 localStorage keys use penboard-* prefix; redirect to /editor confirmed; MCP_SERVER_NAME='penboard' confirmed.

---

*Verified: 2026-03-16T17:30:00Z*
*Verifier: Claude (gsd-verifier)*
*Re-verification: Yes — after plan 01-04 (CANVAS-06 fix) and plan 01-05 (save dialog fix)*
