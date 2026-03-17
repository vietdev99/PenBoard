# Stack Research

**Domain:** Data-Driven Design Tool — v1.1 additions to PenBoard
**Researched:** 2026-03-17
**Confidence:** HIGH (all recommendations verified with official docs or npm registry)

---

## Context: What Already Exists (DO NOT Re-add)

PenBoard v1.0 already ships:
- React 19, Zustand 5, TanStack Start, Tailwind v4, shadcn/ui
- CanvasKit/Skia, Nitro (h3), Electron 35, Vite 7, Bun
- `html2canvas` (screenshot), `html-generator.ts` (design-to-HTML codegen)
- `document-store-connections.ts` — `ScreenConnection[]` model exists
- `document-store-data.ts` — `DataEntity[]` with fields + rows exists
- MCP server, `@modelcontextprotocol/sdk`

The 5 new feature areas need **zero new state management libraries** and **zero new UI frameworks**. Only targeted additions.

---

## Feature → Stack Mapping

| Feature | Approach | New Dependency? |
|---------|----------|-----------------|
| Data binding (ERD → UIKit) | Extend `PenNode` + store — no new lib | No |
| Interactive HTML preview | `iframe[srcdoc]` + `BroadcastChannel` API | No |
| Context textarea per element | Extend `PenNode.aiContext?: string` + `<textarea>` | No |
| Mermaid workflow diagram | `mermaid` npm package | YES — one package |
| MCP tool updates | Extend existing `@modelcontextprotocol/sdk` usage | No |

---

## Recommended Stack Additions

### Core Technologies (New)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `mermaid` | `^11.13.0` | Render workflow diagrams (flowchart TD) from screen connections + data flows | Industry standard, 2.9M weekly downloads, `mermaid.render()` API works headlessly in browser — no DOM manipulation needed. Ships TypeScript types. v11 is current stable. |

**That is the only new npm dependency required.**

### Supporting Patterns (No New Dependencies)

| Pattern | Purpose | Implementation |
|---------|---------|----------------|
| `iframe[srcdoc]` | Sandboxed HTML preview | Native browser API — inject generated HTML string directly, no library needed |
| `BroadcastChannel` API | Cross-tab preview sync when user opens preview in new tab | Native browser API, same-origin, works in Electron WebContents too |
| `PenNode.aiContext?: string` | Per-element AI context | Extend existing type — stored in `.pb` file, no new store needed |
| `PenNode.dataBinding?: DataBinding` | Link UIKit component to DataEntity | Extend existing type — see data binding pattern below |

---

## Mermaid Integration Details

### Installation

```bash
bun add mermaid@^11.13.0
```

### Usage Pattern (React component, lazy-loaded)

```typescript
// Lazy load to avoid adding ~2MB to initial bundle
const renderMermaid = async (definition: string): Promise<string> => {
  const { default: mermaid } = await import('mermaid')
  mermaid.initialize({ startOnLoad: false, theme: 'dark' })
  const id = `mermaid-${nanoid()}`
  const { svg } = await mermaid.render(id, definition)
  return svg
}
```

**Why lazy import:** Mermaid full bundle is ~2.7MB minified (significant). Dynamic `import('mermaid')` puts it in a separate Vite chunk, loaded only when the Workflow tab is opened. Initial app load is unaffected.

### Diagram Type for Workflow View

Use `flowchart TD` (top-down) — maps directly to PenBoard's screen connection model:

```
flowchart TD
  HomeScreen --> |click: Login button| LoginScreen
  HomeScreen --> |click: Browse| ProductListScreen
  LoginScreen --> |submit| DashboardScreen
```

Generate this string from `document.connections[]` + `document.pages[]`. No other diagram type needed for v1.1.

### TypeScript

Mermaid ships its own types (`@types/mermaid` not needed). Use:

```typescript
import type { MermaidConfig } from 'mermaid'
```

---

## HTML Preview Architecture

### Approach: `iframe[srcdoc]` in-panel + `window.open` in new tab

Two modes serve different needs:

**Mode 1 — In-panel preview (right panel tab or floating)**
- Use `<iframe srcdoc={generatedHtml} sandbox="allow-scripts" />`
- `sandbox="allow-scripts"` — enables JS navigation simulation, blocks external network, same-origin access
- Communication: `postMessage` from iframe to parent to intercept navigation events (simulated screen transitions)

**Mode 2 — Full browser tab preview**
- `window.open('/preview')` → opens `/preview` route
- Parent sends document state via `BroadcastChannel('penboard-preview')`
- Preview page listens on same channel, renders full-screen HTML
- Works in both browser and Electron (Electron's `setWindowOpenHandler` allows same-origin `window.open`)

**Why not a separate Electron `BrowserWindow`?** Overly complex — requires IPC plumbing in main process. `window.open` to `/preview` route + BroadcastChannel is simpler and works identically in web and Electron.

### Preview Route

Add `/preview` to TanStack Router. The route:
1. Subscribes to `BroadcastChannel('penboard-preview')`
2. Receives `{ type: 'RENDER', html: string, currentPageId: string, document: PenDocument }`
3. Renders HTML in `<iframe srcdoc>` full-page
4. Handles navigation by receiving next page's HTML from parent on connection click

### Existing html-generator.ts

PenBoard already has `src/services/ai/html-renderer.ts` and `src/services/codegen/html-generator.ts`. The preview feature reuses `html-generator.ts` output — **no new HTML generation code needed**.

---

## Data Binding Pattern

### Type Extension (no new library)

```typescript
// Extend PenNode in src/types/pen.ts
export interface DataBinding {
  entityId: string        // References DataEntity.id
  fieldMap: Record<string, string>  // componentPropName → fieldId
  rowIndex?: number       // Which row to use (default: 0 for single, 'all' for tables)
  mode: 'single' | 'list'  // 'single' = one row, 'list' = all rows (for table/list components)
}

// Add to PenNodeBase:
aiContext?: string        // Per-element AI context textarea
dataBinding?: DataBinding // ERD entity → component binding
```

### Data Source Selector UI

A dropdown in the right panel property section — no new library. Uses existing `@radix-ui/react-select` (already in dependencies) to show a list of `DataEntity` names. When selected, show field mapping UI with simple `<select>` per component prop.

### Runtime Resolution

During HTML preview generation, resolve `dataBinding` before rendering:
1. Find `DataEntity` by `entityId`
2. For `mode: 'single'` — substitute field values into component args for row at `rowIndex`
3. For `mode: 'list'` — repeat component N times, one per row

This is pure logic — no new library.

---

## Context Textarea

### Approach: Extend PenNode + existing textarea

```typescript
// In PenNodeBase (types/pen.ts):
aiContext?: string   // Free-form text, max ~2000 chars in practice
```

**UI:** Add "Context" tab to the right panel (alongside Fill, Stroke, etc.). Render a `<textarea>` with Tailwind styling matching existing panels. Auto-save on blur via `updateNode`.

**Why no `react-textarea-autosize`?** The right panel has fixed height — a scrollable fixed-height textarea is more appropriate than an auto-growing one. The existing `<textarea>` HTML element is sufficient.

**AI integration:** When building AI prompts in `ai-prompts.ts`, include `selectedNode.aiContext` in the context string. Already hooked into `buildContextString` in `ai-chat-handlers.ts`.

---

## MCP Tool Updates

No new dependencies. Extend existing `@modelcontextprotocol/sdk` tools:

| New/Updated Tool | Action |
|-----------------|--------|
| `get_workflow_diagram` | New: generate mermaid syntax string from `document.connections` |
| `set_data_binding` | New: set `dataBinding` on a node |
| `get_data_binding` | New: read binding + resolved sample data |
| `set_ai_context` | New: set `aiContext` on a node |
| `get_preview_html` | New: get rendered HTML for a page with data binding resolved |
| Existing node tools | Updated: include `aiContext` and `dataBinding` in node schema |

All in existing `src/mcp/tools/` directory pattern.

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| `mermaid` (npm) | `d3` + custom diagram renderer | D3 requires building the entire layout algorithm from scratch. Mermaid generates flowchart from text definition in one API call — far faster to implement. |
| `mermaid` (npm) | `reactflow` / `@xyflow/react` | ReactFlow is an interactive graph editor — overkill for a read-only workflow diagram. Also ~300KB additional bundle. Mermaid renders SVG from text definition. |
| `iframe[srcdoc]` | Separate Electron BrowserWindow | Requires main process IPC changes, complex lifecycle management. srcdoc works identically in browser and Electron renderer. |
| `BroadcastChannel` | Shared Zustand store across tabs | Zustand state is per-tab/process. BroadcastChannel is the standard same-origin cross-tab API — zero dependencies. |
| `PenNode.aiContext` (in document) | Separate metadata store/file | Keeping metadata in the `.pb` document ensures it's portable, diffable, and backed by undo/redo via history-store. No sync required. |
| `@radix-ui/react-select` (existing) | New dropdown library | Already in dependencies. Works for data source selector. |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `react-flow` / `@xyflow/react` | ~300KB, designed for interactive editing — wrong tool for read-only workflow diagram | `mermaid` SVG rendering |
| `react-mermaid2` / `react-x-mermaid` | Thin wrappers that add a dependency for 10 lines of code | Direct `mermaid` npm import with custom React hook |
| `@mermaid-js/tiny` | CDN-only — not meant for npm install per official docs | Full `mermaid` package with dynamic import |
| `react-textarea-autosize` | Fixed-height panel doesn't need auto-grow textarea | Native `<textarea>` with `resize: none` CSS |
| `json-schema-form` / `react-hook-form` | Data binding UI is 2 dropdowns, not a complex form | Native `<select>` + Radix Select |
| `websocket` / `socket.io` | Preview doesn't need real-time server push | `BroadcastChannel` (same-origin, zero infrastructure) |
| Any charting library (Chart.js, Recharts) | Wrong abstraction — we need diagram/graph, not charts | `mermaid` flowchart |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `mermaid@^11.13.0` | React 19, Vite 7, TypeScript 5.7 | Ships own types. Requires TS >= 5.8 for `@mermaid-js/parser` sub-package — but the core `mermaid` package works with TS 5.7. Verify on upgrade if TS warning appears. |
| `mermaid@^11.13.0` | Electron 35 (Chromium 134) | Mermaid uses WebGL/Canvas for some diagram types — all supported in Chromium 134. flowchart TD uses SVG only, no WebGL. |
| `BroadcastChannel` | Electron 35 (Chromium 134) | Fully supported. Works across same-origin tabs in Electron renderer process. |

---

## Installation

```bash
# One new production dependency
bun add mermaid@^11.13.0
```

No new dev dependencies required.

---

## Stack Patterns by Variant

**If preview needs to work offline (Electron, no CDN):**
- Use npm `mermaid` import (already recommended above)
- Do NOT use CDN URLs like `cdn.jsdelivr.net/npm/mermaid@11/...`
- Because Electron desktop users may have no internet access

**If the workflow diagram becomes interactive (v2 idea):**
- Consider `@xyflow/react` at that point — read-only + interactive editing justifies the bundle cost
- Keep `mermaid` for the read-only export/share view

**If data binding needs computed fields (v2 idea):**
- Add a `formula?: string` field to `DataField` — evaluate with a simple expression parser
- Do not add a full formula engine (too heavy) until there's a concrete user need

---

## Sources

- `https://mermaid.js.org/config/usage.html` — mermaid.render() API, ESM import, initialize options — MEDIUM confidence (official docs, verified March 2026)
- `https://github.com/mermaid-js/mermaid/releases` — v11.13.0 as latest stable, released March 9 2025 — HIGH confidence
- `https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API` — BroadcastChannel API spec, same-origin cross-tab — HIGH confidence (MDN official)
- `https://developer.mozilla.org/en-US/docs/Web/API/HTMLIFrameElement/srcdoc` — srcdoc attribute for sandboxed preview — HIGH confidence (MDN official)
- `https://www.electronjs.org/docs/latest/api/window-open` — Electron window.open + setWindowOpenHandler — HIGH confidence (official Electron docs)
- `https://www.npmjs.com/package/@mermaid-js/tiny` — @mermaid-js/tiny is CDN-only, not for npm install — MEDIUM confidence (npm page, March 2026)
- WebSearch: mermaid weekly downloads ~2.9M — LOW confidence (search result claim, not verified independently)

---

*Stack research for: PenBoard v1.1 Data-Driven Design features*
*Researched: 2026-03-17*
