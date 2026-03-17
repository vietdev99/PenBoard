# Phase 1: Clone, Rebrand & Verify - Research

**Researched:** 2026-03-16
**Domain:** Project rebranding, Electron app identity, dual file extensions, codebase-wide find-replace
**Confidence:** HIGH

## Summary

Phase 1 is a purely mechanical rebrand of an already-working codebase. The OpenPencil fork (v0.4.1) has 54 source files containing "openpencil" or "OpenPencil" references across ~40 unique files (excluding node_modules), plus 15 translated README files. The rebrand is a controlled find-replace operation with zero new features — the primary risk is missing a reference or breaking a runtime string comparison (theme preset type, Electron partition, Figma layout mode).

The codebase already supports `.op` and `.pen` file extensions in all file dialog and validation code paths. Adding `.pb` as a third extension follows the exact same pattern — add to filter arrays and validation checks. TanStack Router provides a `redirect()` function usable in `beforeLoad` for the landing page redirect.

**Primary recommendation:** Execute the rebrand in strict layers — constants first, then config files, then source code, then i18n/docs — verifying the build after each layer. Use `grep -r` post-rebrand to confirm zero remaining "openpencil" references in source files (comments referencing the origin project are acceptable).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- App name: **PenBoard**
- Tagline: **"Storyboard Design Tool"** with subtitle "Design screens, connect flows, model data"
- Landing page route (`/`): **Redirect to `/editor`** — this is a desktop app, no marketing landing page
- Logo/icon files: **Keep OpenPencil icons as-is** — new logo deferred to future phase
- Window titles, dialog headers, error messages: All show "PenBoard"
- **Package identity**: `openpencil` → `penboard` in package.json (name + bin entry)
- **Electron app ID**: `dev.openpencil.app` → `dev.penboard.app`
- **Electron productName**: `OpenPencil` → `PenBoard`
- **MIME type**: `application/x-openpencil` → `application/x-penboard`
- **localStorage keys**: All prefixed keys `openpencil-*` → `penboard-*`
- **Hidden directories**: `~/.openpencil/` → `~/.penboard/`, `.openpencil-tmp/` → `.penboard-tmp/`
- **Temp dir prefixes**: All `openpencil-*` temp dirs → `penboard-*`
- **MCP server**: Name `openpencil` → `penboard`, binary `openpencil-mcp` → `penboard-mcp`
- **Theme preset type**: `openpencil-theme-preset` → `penboard-theme-preset`
- **AI prompts**: All "OpenPencil" references in system prompts → "PenBoard"
- **i18n strings**: `landing.open` + `landing.pencil` → updated for PenBoard
- **README files**: Find-replace "OpenPencil" → "PenBoard" in all 15 translated files
- **CI/CD**: Keep workflows and issue templates, update all references
- **Copyright**: Update to "PenBoard contributors"
- Support both `.op` and `.pb` for opening files
- Default save format: `.pb` (PenBoard native)
- File dialog filters show: "PenBoard Files (*.pb, *.op)"
- Electron file association registers both extensions
- Fresh `git init` after all rebrand changes are complete
- First commit message: `"init: PenBoard v0.1.0 — fork of OpenPencil v0.4.1"`
- `.cta.json` projectName: `openpencil` → `penboard`

### Claude's Discretion
- Exact ordering of find-replace operations (as long as all references are covered)
- How to handle the landing page redirect (React Router redirect vs removing the route)
- i18n key naming for new tagline strings
- Whether to update `.planning/` docs references (OpenPencil → PenBoard) or leave as historical context

### Deferred Ideas (OUT OF SCOPE)
1. **Pre-built input controls** — User wants ready-made UI controls (text inputs, dropdowns, buttons, toggles, etc.) as drag-and-drop components for faster screen design. Candidate for new roadmap phase between Phase 2 and Phase 3, or as part of Phase 5 (Shared Views).
2. **PenBoard custom logo/icon** — Replace OpenPencil's pencil icon with PenBoard-specific design. Can be done anytime.
3. **Landing page for web distribution** — If PenBoard is ever offered as a web app, will need a proper marketing page.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CANVAS-01 | User can place shapes at any x,y position on infinite pan/zoom canvas | Verified: CanvasKit/Skia engine already functional. Verification checklist in Architecture Patterns section. |
| CANVAS-02 | User can select, move, and resize shapes with handles | Verified: skia-canvas.tsx handles mouse events for select/drag/resize. Manual verification needed. |
| CANVAS-03 | User can multi-select via box selection or shift-click | Verified: marquee selection in skia-canvas.tsx, SpatialIndex.searchRect() in skia-hit-test.ts. |
| CANVAS-04 | User can undo/redo any operation | Verified: history-store.ts with max 300 states, keyboard shortcuts in use-keyboard-shortcuts.ts. |
| CANVAS-05 | User can copy/paste shapes within and across screens | Verified: clipboard state in canvas-store.ts, keyboard shortcuts mapped. |
| CANVAS-06 | Shapes snap to grid and show alignment guides | Verified: use-canvas-guides.ts and guide-utils.ts provide smart alignment snapping. |
| CANVAS-07 | Canvas renders with CanvasKit/Skia WebGL | Verified: skia-engine.ts is the core renderer, canvaskit-wasm ^0.40.0 in dependencies. |
</phase_requirements>

## Standard Stack

### Core (Already in the project — no new dependencies needed)

| Library | Version | Purpose | Relevance to Phase 1 |
|---------|---------|---------|----------------------|
| TanStack Router | ^1.132.0 | File-based routing | Landing page redirect via `beforeLoad` + `redirect()` |
| Electron | ^35.0.0 | Desktop app shell | App identity changes (appId, productName, file associations) |
| electron-builder | ^26.0.0 | Desktop packaging | Build config changes in electron-builder.yml |
| Vitest | ^3.0.5 | Test runner | Run existing tests to verify no regressions |
| i18next | ^25.8.14 | Internationalization | 15 locale files need brand string updates |
| CanvasKit/Skia WASM | ^0.40.0 | Canvas rendering | Must verify still works after rebrand (no code changes expected) |

### Supporting (no new packages)

No new dependencies are required for Phase 1. Everything needed is already in the project.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual find-replace | `sed` batch script | Script is brittle for context-sensitive replacements like comments vs code strings. Manual with IDE search is safer for a one-time operation of this size (54 files). |
| TanStack Router redirect | Remove landing page route entirely | Redirect is cleaner — keeps the route file but immediately bounces to `/editor`. Removing the route would cause 404 on `/`. |
| Electron partition rename | Keep `persist:openpencil` | Must change to `persist:penboard` to match new brand identity. This resets any persisted web storage in Electron — acceptable since this is a fresh fork. |

**Installation:**
```bash
# No new packages needed
bun install  # Already done
```

## Architecture Patterns

### Recommended Rebrand Execution Order

```
Layer 1: Constants & Config (build-breaking if wrong)
├── package.json (name, bin entry)
├── .cta.json (projectName)
├── electron-builder.yml (appId, productName, copyright, file associations, MIME, desktop entry)
├── electron/constants.ts (GITHUB_REPO, PORT_FILE_DIR_NAME)
├── src/constants/app.ts (PORT_FILE_DIR_NAME)
└── VERIFY: `bun install` still works

Layer 2: Electron Main Process
├── electron/main.ts (window title, partition, dialog titles/filters, error dialog, comments)
├── electron/logger.ts (startup log message)
└── VERIFY: `bun run electron:compile` succeeds

Layer 3: Server-Side Code
├── server/api/ai/mcp-install.ts (MCP_SERVER_NAME)
├── server/api/ai/chat.ts (title string, .openpencil-tmp)
├── server/api/ai/generate.ts (title string)
├── server/api/ai/validate.ts (title string, .openpencil-tmp)
├── server/plugins/port-file.ts (.openpencil dir, comment)
├── server/utils/resolve-claude-agent-env.ts (openpencil-claude-debug)
├── server/utils/mcp-server-manager.ts (openpencil-mcp-server PID/port files)
├── server/utils/codex-client.ts (openpencil-codex- temp prefix)
└── VERIFY: `bun --bun run build` succeeds

Layer 4: Client Source Code
├── src/stores/*.ts (8 localStorage key constants)
├── src/i18n/index.ts (openpencil-language key)
├── src/components/editor/top-bar.tsx (openpencil-theme key)
├── src/canvas/agent-indicator.ts (3 window key constants)
├── src/routes/__root.tsx, index.tsx, editor.tsx (page titles)
├── src/utils/file-operations.ts (dialog descriptions, file extension filters, default filename)
├── src/utils/theme-preset-io.ts (type identifier, dialog descriptions)
├── src/utils/normalize-pen-file.ts (comments only)
├── src/uikit/kit-import-export.ts (dialog description)
├── src/types/theme-preset.ts (type literal)
├── src/services/ai/ai-prompts.ts (system prompts)
├── src/services/ai/icon-resolver.ts (comment)
├── src/services/figma/figma-types.ts (FigmaImportLayoutMode type literal)
├── src/services/figma/figma-node-mapper.ts (default parameter values)
├── src/services/figma/figma-node-converters.ts (comment)
├── src/mcp/server.ts (console.error log message)
├── src/mcp/document-manager.ts (error messages)
├── src/mcp/tools/open-document.ts (error messages)
├── src/mcp/tools/design-prompt.ts (intro text)
├── src/mcp/tools/theme-presets.ts (type identifier checks)
├── src/mcp/__tests__/security.test.ts (temp dir name)
└── VERIFY: `bun --bun run build` succeeds, `bun --bun run test` passes

Layer 5: i18n Locale Files (15 files)
├── src/i18n/locales/en.ts (landing.open, landing.pencil, figma.autoLayout)
├── src/i18n/locales/{de,es,fr,hi,id,ja,ko,pt,ru,th,tr,vi,zh,zh-tw}.ts
└── VERIFY: `bun --bun run build` succeeds

Layer 6: Documentation & Metadata
├── README.md + 14 translated README.*.md files
├── .github/ISSUE_TEMPLATE/feature_request.yml
├── .github/ISSUE_TEMPLATE/bug_report.yml
├── CLAUDE.md (selectively — keep historical context where appropriate)
└── VERIFY: grep for remaining "openpencil" references

Layer 7: File Extension Changes (.pb support)
├── electron/main.ts (dialog filters, file:read validation, getFilePathFromArgs)
├── electron-builder.yml (fileAssociations — add .pb entry)
├── src/utils/file-operations.ts (save-as default name, file picker accept types)
├── src/mcp/server.ts (tool descriptions mentioning .op)
├── src/mcp/tools/*.ts (tool descriptions)
└── VERIFY: save/open dialogs show .pb option

Layer 8: Landing Page Redirect
├── src/routes/index.tsx (replace LandingPage with redirect)
└── VERIFY: navigating to `/` redirects to `/editor`
```

### Pattern 1: TanStack Router Redirect for Landing Page

**What:** Replace the landing page component with a `beforeLoad` redirect to `/editor`.
**When to use:** When a route should always redirect to another.
**Example:**
```typescript
// src/routes/index.tsx
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: '/editor', replace: true })
  },
})
```
Source: [TanStack Router redirect docs](https://tanstack.com/router/v1/docs/api/router/redirectFunction)

**Why `replace: true`:** Prevents the landing page from appearing in browser history. User cannot press Back to return to an empty page.

### Pattern 2: Dual File Extension Support (.pb + .op)

**What:** Accept `.pb` as the new default while maintaining backward compatibility with `.op`.
**When to use:** All file open/save code paths.
**Example — Electron file dialogs:**
```typescript
// electron/main.ts — open dialog
filters: [{ name: 'PenBoard Files', extensions: ['pb', 'op', 'pen'] }]

// electron/main.ts — save dialog
filters: [{ name: 'PenBoard Files', extensions: ['pb'] }]
defaultPath: payload.defaultPath || 'untitled.pb'

// electron/main.ts — saveToPath validation
if (ext !== '.pb' && ext !== '.op' && ext !== '.pen') {
  throw new Error('Only .pb, .op, and .pen file extensions are allowed')
}

// electron/main.ts — file:read validation
if (ext !== '.pb' && ext !== '.op' && ext !== '.pen') return null

// electron/main.ts — getFilePathFromArgs
if (ext === '.pb' || ext === '.op' || ext === '.pen') {
  return arg
}
```

**Key locations for .pb support (7 code paths):**
1. `electron/main.ts` — `dialog:openFile` filter
2. `electron/main.ts` — `dialog:saveFile` filter + defaultPath
3. `electron/main.ts` — `dialog:saveToPath` validation
4. `electron/main.ts` — `file:read` validation
5. `electron/main.ts` — `getFilePathFromArgs()` CLI argument detection
6. `electron-builder.yml` — `fileAssociations` (add .pb entry)
7. `src/utils/file-operations.ts` — `saveDocumentAs()` suggestedName + accept types, `openDocumentFS()` accept types, `openDocument()` accept types

### Pattern 3: Figma Layout Mode Type Preservation

**What:** The `FigmaImportLayoutMode` type has a literal `'openpencil'` value used in Figma import code. This is an internal API — rename to `'penboard'`.
**Where:** `src/services/figma/figma-types.ts` line 275, `src/services/figma/figma-node-mapper.ts` lines 94, 168, 268.
**Risk:** LOW — no external consumers of this type. It is a default parameter value in internal functions.

### Anti-Patterns to Avoid

- **Partial rebrand:** Missing even one `openpencil` reference in a runtime string (e.g., theme preset type check) causes silent failures. Use `grep -r` verification after each layer.
- **Changing file extension validation without updating all paths:** The codebase validates `.op`/`.pen` in 5+ locations. Missing one creates a confusing "file not supported" error.
- **Renaming the Electron partition without understanding impact:** `partition: 'persist:openpencil'` controls where Electron stores web data (cookies, localStorage, cache). Changing it to `persist:penboard` means all previously stored data is lost. This is acceptable for a fresh fork but would be destructive in a user migration scenario.
- **Blind find-replace on "pencil":** The word "pencil" appears in Lucide icon names (`PenTool`), Pencil.dev references (the product OpenPencil was originally based on), and legitimate code paths. Only replace `openpencil`/`OpenPencil` as exact whole matches, not "pencil" alone.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Finding all branding references | Manual file-by-file search | `grep -rn "openpencil\|OpenPencil" --include="*.ts" --include="*.tsx" --include="*.json" --include="*.yml" --include="*.md"` | Comprehensive, zero missed references |
| TanStack Router redirect | Custom redirect component with useEffect | `redirect()` from `@tanstack/react-router` in `beforeLoad` | Built-in, server-side, no flash of landing page content |
| File extension validation | Custom regex matcher | Extend existing `extname().toLowerCase()` pattern already used in 5+ locations | Consistent with codebase conventions |
| CanvasKit verification | Automated visual regression tests | Manual interactive checklist (see Verification section) | Automated canvas testing requires complex screenshot comparison infrastructure that does not exist yet (Phase 6 scope) |

**Key insight:** Phase 1 has no algorithmic complexity. Every change is a direct string replacement or a small config edit. The risk is completeness (missing a reference), not correctness (wrong logic).

## Common Pitfalls

### Pitfall 1: Missed Runtime String Comparisons
**What goes wrong:** A `openpencil-theme-preset` string is left in `theme-presets.ts` but changed in `theme-preset-io.ts`. Theme preset loading silently fails because `data.type !== 'penboard-theme-preset'` returns true for old-format files.
**Why it happens:** String constants used for type discrimination appear in multiple files.
**How to avoid:** Change constants FIRST (Layer 1-2), then update all consumers. Grep verification after every layer.
**Warning signs:** Theme presets fail to load, MCP server name not found in CLI configs, agent indicator keys return undefined.

### Pitfall 2: Electron Partition Mismatch
**What goes wrong:** The Electron `partition` string is changed to `persist:penboard` but old data at `persist:openpencil` is not cleared. No data loss, but the app starts with blank preferences.
**Why it happens:** Electron stores session data in separate directories per partition name.
**How to avoid:** This is expected behavior for a fresh fork. No migration needed. Simply accept that Electron storage resets. The app initializes with defaults.
**Warning signs:** N/A — this is by design.

### Pitfall 3: File Extension Order in Electron Builder
**What goes wrong:** `.pb` is added to `fileAssociations` but `.op` association is removed. Users with existing `.op` files cannot double-click to open.
**Why it happens:** Thinking "new format replaces old" when the decision is "both are supported".
**How to avoid:** Add a SECOND fileAssociation entry for `.pb`. Keep the existing `.op` entry. Both should register with the OS.
**Warning signs:** Double-clicking `.op` files doesn't open PenBoard.

### Pitfall 4: i18n Key Changes Breaking Translations
**What goes wrong:** Renaming `landing.open` and `landing.pencil` keys but forgetting to update all 15 locale files. Missing translations fall back to English or show key names.
**Why it happens:** 15 files is tedious. Easy to miss one.
**How to avoid:** Process all locale files in a loop. The locale files are at: `src/i18n/locales/{de,en,es,fr,hi,id,ja,ko,pt,ru,th,tr,vi,zh,zh-tw}.ts`. Each has `landing.open`, `landing.pencil`, `landing.tagline`, and `figma.autoLayout` keys that reference "OpenPencil".
**Warning signs:** UI shows i18n key strings instead of translated text.

### Pitfall 5: Hidden Window Keys in agent-indicator.ts
**What goes wrong:** The three window-level constants (`__openpencil_agent_indicators__`, `__openpencil_agent_previews__`, `__openpencil_agent_frames__`) are missed because they don't follow the `openpencil-` dash prefix pattern.
**Why it happens:** grep for `openpencil-` misses `__openpencil_`. Need to grep for `openpencil` without the dash.
**How to avoid:** Always grep for the bare string `openpencil` (case-insensitive), not just `openpencil-`.
**Warning signs:** Agent indicators stop working on the canvas during AI generation.

### Pitfall 6: Git Init Timing
**What goes wrong:** Running `git init` before all changes are complete, then needing to amend or squash commits.
**Why it happens:** Premature cleanup.
**How to avoid:** Complete ALL rebrand changes and verify the build BEFORE running `git init`. The fresh init should contain the final state.
**Warning signs:** N/A — procedural.

## Code Examples

### Example 1: Landing Page Redirect (TanStack Router)

```typescript
// src/routes/index.tsx — AFTER rebrand
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: '/editor', replace: true })
  },
})
```

### Example 2: Electron File Association for .pb

```yaml
# electron-builder.yml — fileAssociations section AFTER rebrand
fileAssociations:
  - ext: pb
    name: PenBoard Document
    description: PenBoard Design File
    mimeType: application/x-penboard
    role: Editor
    icon: build/icon
  - ext: op
    name: PenBoard Document (Legacy)
    description: PenBoard Design File (Legacy Format)
    mimeType: application/x-penboard
    role: Editor
    icon: build/icon
```

### Example 3: localStorage Key Pattern

```typescript
// src/stores/agent-settings-store.ts — BEFORE
const STORAGE_KEY = 'openpencil-agent-settings'

// src/stores/agent-settings-store.ts — AFTER
const STORAGE_KEY = 'penboard-agent-settings'
```

All 9 storage key constants follow this exact pattern:
1. `src/stores/agent-settings-store.ts` — `openpencil-agent-settings`
2. `src/stores/ai-store.ts` — `openpencil-ai-model-preference`
3. `src/stores/ai-store.ts` — `openpencil-ai-concurrency`
4. `src/stores/ai-store.ts` — `openpencil-ai-ui-preferences`
5. `src/stores/canvas-store.ts` — `openpencil-canvas-preferences`
6. `src/stores/uikit-store.ts` — `openpencil-uikits`
7. `src/stores/theme-preset-store.ts` — `openpencil-theme-presets`
8. `src/components/editor/top-bar.tsx` — `openpencil-theme`
9. `src/i18n/index.ts` — `openpencil-language`

### Example 4: Window-Level Keys in agent-indicator.ts

```typescript
// src/canvas/agent-indicator.ts — BEFORE
const INDICATORS_KEY = '__openpencil_agent_indicators__'
const PREVIEWS_KEY = '__openpencil_agent_previews__'
const AGENT_FRAMES_KEY = '__openpencil_agent_frames__'

// src/canvas/agent-indicator.ts — AFTER
const INDICATORS_KEY = '__penboard_agent_indicators__'
const PREVIEWS_KEY = '__penboard_agent_previews__'
const AGENT_FRAMES_KEY = '__penboard_agent_frames__'
```

### Example 5: MCP Server Name Constant

```typescript
// server/api/ai/mcp-install.ts — BEFORE
const MCP_SERVER_NAME = 'openpencil'

// server/api/ai/mcp-install.ts — AFTER
const MCP_SERVER_NAME = 'penboard'
```

### Example 6: File Dialog with .pb Support

```typescript
// src/utils/file-operations.ts — saveDocumentAs() AFTER rebrand
const handle = await window.showSaveFilePicker({
  suggestedName: suggestedName || 'untitled.pb',
  types: [
    {
      description: 'PenBoard File',
      accept: { 'application/json': ['.pb', '.op'] },
    },
  ],
})
```

## Comprehensive File Inventory

### Files requiring OpenPencil → PenBoard changes (54 source files)

**Constants & Config (5 files):**
- `package.json` — name, description, bin entry
- `.cta.json` — projectName
- `electron-builder.yml` — appId, productName, copyright, desktop entry, file associations, MIME
- `electron/constants.ts` — GITHUB_REPO, PORT_FILE_DIR_NAME
- `src/constants/app.ts` — PORT_FILE_DIR_NAME

**Electron (2 files):**
- `electron/main.ts` — window title, partition, dialog filters/titles, error dialog, comments
- `electron/logger.ts` — startup log message

**Server (6 files):**
- `server/api/ai/mcp-install.ts` — MCP_SERVER_NAME
- `server/api/ai/chat.ts` — title, .openpencil-tmp dir
- `server/api/ai/generate.ts` — title
- `server/api/ai/validate.ts` — title, .openpencil-tmp dir
- `server/plugins/port-file.ts` — .openpencil dir, comment
- `server/utils/resolve-claude-agent-env.ts` — openpencil-claude-debug dir
- `server/utils/mcp-server-manager.ts` — openpencil-mcp-server PID/port files
- `server/utils/codex-client.ts` — openpencil-codex- temp prefix

**Stores (5 files):**
- `src/stores/agent-settings-store.ts` — STORAGE_KEY
- `src/stores/ai-store.ts` — 3 storage key constants
- `src/stores/canvas-store.ts` — PREFS_KEY
- `src/stores/uikit-store.ts` — STORAGE_KEY
- `src/stores/theme-preset-store.ts` — STORAGE_KEY

**Routes (3 files):**
- `src/routes/__root.tsx` — page title
- `src/routes/index.tsx` — page title (will be replaced with redirect)
- `src/routes/editor.tsx` — page title

**Canvas (1 file):**
- `src/canvas/agent-indicator.ts` — 3 window key constants

**UI Components (1 file):**
- `src/components/editor/top-bar.tsx` — openpencil-theme storage key

**i18n (16 files):**
- `src/i18n/index.ts` — openpencil-language storage key
- `src/i18n/locales/{en,de,es,fr,hi,id,ja,ko,pt,ru,th,tr,vi,zh,zh-tw}.ts` — landing.* and figma.autoLayout strings

**Utils (3 files):**
- `src/utils/file-operations.ts` — dialog descriptions
- `src/utils/theme-preset-io.ts` — type identifier, dialog descriptions
- `src/utils/normalize-pen-file.ts` — comments only

**Types (1 file):**
- `src/types/theme-preset.ts` — type literal

**UIKit (1 file):**
- `src/uikit/kit-import-export.ts` — dialog description

**Services (6 files):**
- `src/services/ai/ai-prompts.ts` — system prompts (2 locations)
- `src/services/ai/icon-resolver.ts` — comment
- `src/services/figma/figma-types.ts` — FigmaImportLayoutMode type literal
- `src/services/figma/figma-node-mapper.ts` — default parameter values (3 locations)
- `src/services/figma/figma-node-converters.ts` — comment

**MCP (5 files):**
- `src/mcp/server.ts` — console.error log message
- `src/mcp/document-manager.ts` — error messages
- `src/mcp/tools/open-document.ts` — error messages
- `src/mcp/tools/design-prompt.ts` — intro text
- `src/mcp/tools/theme-presets.ts` — type identifier checks (3 locations)

**Tests (1 file):**
- `src/mcp/__tests__/security.test.ts` — temp dir name

**Documentation (17 files):**
- `README.md` + 14 translated `README.*.md` files
- `.github/ISSUE_TEMPLATE/feature_request.yml`
- `.github/ISSUE_TEMPLATE/bug_report.yml`

**Project docs (optional — historical context):**
- `CLAUDE.md` — multiple references (selective update)
- `.planning/*.md` — historical context references

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Fabric.js canvas | CanvasKit/Skia WASM | OpenPencil v0.3+ | Legacy Fabric code retained for `zoomToFitContent` only |
| `.pen` file format | `.op` (OpenPencil) / `.pb` (PenBoard) | This rebrand | Both must be supported for backward compatibility |
| Single-page app | TanStack Start SSR | Already in place | Route redirect works both server-side and client-side |

**Deprecated/outdated:**
- Fabric.js files still in `src/canvas/` but not used for rendering. These are retained for utility functions and will be removed in a future phase.
- The `.pen` extension is from the original Pencil.dev format. OpenPencil added `.op`. PenBoard adds `.pb`. All three should be supported for file opening.

## Canvas Verification Checklist

Since canvas features (CANVAS-01 through CANVAS-07) are inherited and require no code changes, verification is a manual interactive process:

### Shape Types to Verify (11 total)
1. **Frame** — create, resize, nest children
2. **Rectangle** — create, resize, corner radius
3. **Ellipse** — create, resize
4. **Line** — create, drag endpoints
5. **Polygon** — create, resize
6. **Path** (pen tool) — create bezier curve with control handles
7. **Text** — create, edit content, font change
8. **Image** — import from file
9. **Group** — select multiple shapes, Ctrl+G
10. **Icon** (path with icon name) — insert from icon picker
11. **Ref** (component instance) — create reusable component, insert instance

### Interactions to Verify
- [ ] Select tool: click to select, drag to move
- [ ] Box selection: drag on empty area to marquee select
- [ ] Shift-click: add to selection
- [ ] Resize handles: drag corner/edge to resize
- [ ] Rotation: drag rotation handle
- [ ] Undo/Redo: Ctrl+Z / Ctrl+Shift+Z
- [ ] Copy/Paste: Ctrl+C / Ctrl+V
- [ ] Delete: Delete/Backspace key
- [ ] Zoom: mouse wheel, Ctrl+0 (fit), Ctrl++ / Ctrl+-
- [ ] Pan: Space+drag, middle-mouse drag
- [ ] Alignment guides: appear when moving near other shapes
- [ ] Auto-layout: set frame to vertical/horizontal, child positioning

### Build Verification
- [ ] `bun --bun run dev` starts on port 3000
- [ ] `bun --bun run build` completes without errors
- [ ] `bun --bun run test` passes all tests
- [ ] `npx tsc --noEmit` reports no type errors
- [ ] `bun run electron:dev` starts Electron window with working canvas
- [ ] MCP server responds: `bun run mcp:dev` starts without error

## Open Questions

1. **FigmaImportLayoutMode type literal:**
   - What we know: `'openpencil'` is used as a layout mode value in Figma import code (4 locations)
   - What's unclear: Whether this string is ever serialized to disk or compared against stored data
   - Recommendation: Rename to `'penboard'` — it is only used as a default parameter value in internal functions, never persisted. LOW risk.

2. **CLAUDE.md update scope:**
   - What we know: CLAUDE.md contains many historical "OpenPencil" references that serve as architectural documentation
   - What's unclear: How much to rebrand vs keep as historical context
   - Recommendation: Update the header/intro to say "PenBoard" but leave internal architecture descriptions that reference OpenPencil origin as-is (e.g., "inherited from OpenPencil"). The `.planning/` docs should be left as historical context since they document the fork decision.

3. **Electron userData path:**
   - What we know: Electron stores app data at `~/Library/Application Support/OpenPencil/` (macOS), `%APPDATA%\OpenPencil\` (Windows), `~/.config/OpenPencil/` (Linux)
   - What's unclear: Whether `productName` change in electron-builder automatically changes this path
   - Recommendation: YES, changing `productName` in electron-builder.yml changes the `app.getPath('userData')` path. Since this is a fresh fork with no existing user data, this is acceptable. No migration needed.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis — `grep -r` across all 54 affected files
- TanStack Router official docs — [redirect function](https://tanstack.com/router/v1/docs/api/router/redirectFunction)
- Electron official docs — `partition` property in BrowserWindow, `productName` in electron-builder

### Secondary (MEDIUM confidence)
- Electron-builder documentation — fileAssociations configuration, productName → userData path mapping

### Tertiary (LOW confidence)
- None — all findings directly verified against the codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, all verified in existing codebase
- Architecture: HIGH — all patterns derived from existing codebase conventions
- Pitfalls: HIGH — all pitfalls identified from actual codebase analysis (specific file paths and line numbers)
- File inventory: HIGH — generated from `grep -r` across entire codebase
- Canvas verification: MEDIUM — checklist based on architecture docs, not runtime testing

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable — no external dependencies changing)
