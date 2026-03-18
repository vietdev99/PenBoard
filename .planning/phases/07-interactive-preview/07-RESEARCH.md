# Phase 7: Interactive Preview - Research

**Researched:** 2026-03-18
**Domain:** HTML preview generation, browser tab communication, navigation transitions, sandbox security
**Confidence:** HIGH

## Summary

Phase 7 transforms PenBoard's design canvas output into interactive HTML prototypes served via Nitro server routes and opened in separate browser tabs. The core challenge is extending the existing `html-generator.ts` code generator to produce self-contained, interactive HTML with navigation between screens (via ScreenConnections), live sample data from bound entities, form interactivity, and strict CSP sandboxing -- all without introducing external dependencies.

The architecture is well-constrained by user decisions: Nitro serves preview HTML on a same-origin route (enabling BroadcastChannel for hot reload), the editor POSTs document data to Nitro in-memory storage, and SSE signals the preview tab to re-render. This mirrors the existing MCP sync pattern (`mcp-sync-state.ts` + SSE events) almost exactly, making the server-side implementation straightforward.

The primary complexity lies in the **preview HTML generator** -- a substantial extension of `html-generator.ts` that must handle: (1) role-to-semantic-HTML-tag mapping, (2) ScreenConnection-based navigation with hash routing, (3) data binding resolution before HTML generation, (4) component (RefNode) argument resolution, (5) CSS variable generation, (6) transition animations (push=slide, modal=fade overlay, replace=instant), (7) form element interactivity, (8) downloadable self-contained export. No external libraries are needed -- all of this is pure HTML/CSS/JS generation.

**Primary recommendation:** Build a dedicated `preview-html-generator.ts` that wraps and extends `html-generator.ts` with interactive features, rather than modifying the existing code generator (which serves code-panel export and should remain clean). Use the proven `mcp-sync-state.ts` pattern for the Nitro hot-reload server, and implement all preview interactivity as inline `<script>` blocks within the generated HTML.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Preview Trigger & Entry Point**: Top bar button (Play icon), always visible, one-click. Opens new browser tab via window.open(). In Electron: shell.openExternal() to default browser. Preview scope: selected frame if available, otherwise active page. Only `screen` pages previewable (ERD/component pages not). Multiple preview tabs allowed. No live-update on page switch.
- **Hot Reload**: BroadcastChannel API for same-origin communication. Debounce 500-1000ms. Preview served via Nitro server route (not blob URL). Editor POSTs preview data to Nitro, stores in-memory (no disk I/O). SSE from Nitro signals preview tab to re-render. Replace in-memory data each reload.
- **Navigation Behavior**: push -> slide left, modal -> fade overlay with backdrop dim, replace -> instant swap. Hover state: cursor pointer + subtle highlight border/shadow. Back navigation: browser back + toolbar back button. Hash routing `#page-id`. Only explicit ScreenConnections create navigation. targetFrameId scrolls to frame within page. Missing page: placeholder "Page not found" + Back. Circular connections allowed. Hotspot mode toggle.
- **Data Display**: Tables as full HTML `<table>`, dropdowns clickable with entity options, text nodes show first entity row, empty entity keeps placeholder, images inline base64, icons inline SVG, components (RefNode) fully resolved, variables as CSS custom properties, fonts follow document settings.
- **Sandbox & Security (PREV-04)**: Nitro route `/preview/:id`. Strict CSP via `<meta>` tag blocking external scripts/fonts/images, only inline styles + PenBoard-generated inline scripts. Self-contained HTML. No authentication (local-only).
- **Responsive & Sizing**: Viewport follows frame size. No viewport selector. Overflow: browser scroll. Lazy render per page.
- **Error Handling**: Graceful fallback (missing font -> system, broken image -> placeholder, invalid CSS -> skip). No circular detection needed. Lazy page rendering.
- **Accessibility**: Semantic HTML from node roles. Keyboard navigation with tabindex. Form elements interactive (no state persistence/submission).
- **Preview Toolbar**: Top bar with Back, Breadcrumb (center), Hotspots toggle + Refresh (right). Toggle visibility. Follows OS dark/light mode.
- **Theme in Preview**: Default theme variant only, no theme switcher (v1.1 scope).
- **Export**: Download HTML button exports self-contained .html file with all pages, navigation JS, CSS. Local-only.
- **Form Interactions**: Text inputs typeable, checkboxes checkable, radio buttons toggleable. No state persistence/validation/submission.
- **Loading UX**: Skeleton + progress bar when generating preview. Tab opens immediately.

### Claude's Discretion
- Exact CSS transition durations and easing for navigation animations
- Exact debounce timing within 500-1000ms range
- Skeleton loading design
- BroadcastChannel message format
- Nitro route naming and API shape
- SSE event naming
- Exact toolbar styling and icon choices
- Progress bar implementation
- HTML export bundling approach (single file vs zip)

### Deferred Ideas (OUT OF SCOPE)
- Theme switcher in preview toolbar (v1.2 candidate)
- Viewport responsive presets (mobile/tablet/desktop)
- LAN sharing of preview
- Video/animation preview
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PREV-01 | User can open interactive HTML preview of a parent frame in a separate browser tab | Preview button in top-bar, Nitro route serving HTML, window.open() / shell.openExternal(), preview-html-generator producing interactive HTML from PenNode tree |
| PREV-02 | Preview supports navigation between screens via connections (click to navigate) | ScreenConnection interface provides sourceElementId/targetPageId/triggerEvent/transitionType. Hash routing `#page-id`, inline JS event handlers, CSS transitions for push/modal/replace |
| PREV-03 | Preview displays live sample data from bound entities | resolveDataBinding() applied before HTML generation. Tables -> `<table>` with entity field headers + row data. Dropdowns -> `<select>` with entity options. Text -> first row data |
| PREV-04 | Preview runs in null-origin sandbox to prevent XSS/security issues | CSP `<meta>` tag: `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:`. All resources inline. No external fetches. Nitro route serves localhost only |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Nitro/h3 | (existing) | Server routes for preview HTML serving + SSE hot reload | Already powers all server APIs in PenBoard |
| BroadcastChannel API | Web standard | Same-origin tab communication for hot reload signal | Built-in browser API, no library needed. Same-origin requirement satisfied by Nitro route serving |
| CSS Transitions | Web standard | Navigation animations (slide, fade) | Pure CSS, no library needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | (existing) | Icons for preview toolbar button in editor | Only in editor-side code (top-bar.tsx) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| BroadcastChannel | postMessage to window.open ref | BroadcastChannel is cleaner (no window ref management), requires same-origin (satisfied by Nitro route) |
| SSE for hot reload | WebSocket | SSE is simpler, unidirectional (server->client), matches existing MCP pattern |
| Inline JS in preview | External JS bundle | Inline required by CSP policy -- no external scripts allowed |

**Installation:**
```bash
# No new dependencies needed -- all features use existing stack + browser APIs
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── services/preview/                     # NEW: Preview generation pipeline
│   ├── preview-html-generator.ts         # Core: PenNode tree -> interactive HTML
│   ├── preview-navigation.ts             # Navigation JS generation (hash routing, transitions)
│   ├── preview-data-resolver.ts          # Pre-generation data binding + variable resolution
│   ├── preview-semantic-tags.ts          # Role -> HTML tag mapping
│   └── preview-toolbar.ts               # Preview toolbar HTML generation
├── hooks/
│   └── use-preview.ts                    # NEW: Hook for opening/managing preview tabs
server/
├── api/preview/
│   ├── [id].get.ts                       # GET /api/preview/:id — Serve preview HTML
│   ├── data.post.ts                      # POST /api/preview/data — Receive preview data from editor
│   ├── page.[id].get.ts                  # GET /api/preview/page/:id — Lazy-load individual page HTML
│   └── events.get.ts                     # GET /api/preview/events — SSE for hot reload
├── utils/
│   └── preview-state.ts                  # In-memory preview data store (mirrors mcp-sync-state pattern)
```

### Pattern 1: Preview Data Flow (Editor -> Nitro -> Preview Tab)
**What:** Editor prepares preview data, POSTs to Nitro in-memory store, preview tab GETs rendered HTML from Nitro route
**When to use:** Every preview open + every hot reload cycle

```text
Editor (React)                     Nitro Server                   Preview Tab (Browser)
     │                                  │                               │
     ├─── POST /api/preview/data ──────>│                               │
     │    {doc, pageId, frameId,        │                               │
     │     connections, entities}        │── store in-memory ──>        │
     │                                  │                               │
     ├─── window.open(/api/preview/:id) ────────────────────────────────>│
     │                                  │                               │
     │                                  │<── GET /api/preview/:id ──────│
     │                                  │──> generate HTML ──> serve ───>│
     │                                  │                               │
     │    (document changes...)         │                               │
     │                                  │                               │
     ├─── POST /api/preview/data ──────>│                               │
     │    (debounced 500-1000ms)        │── SSE: preview:update ───────>│
     │                                  │                               │
     │                                  │<── GET /api/preview/:id ──────│
     │                                  │──> re-generate HTML ─────────>│
     │                                  │                               │ (re-render)
```

### Pattern 2: Preview HTML Structure
**What:** Self-contained HTML document with all CSS inline, all JS inline, all images as base64
**When to use:** Every preview render

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:;" />
  <title>Preview - {pageName}</title>
  <style>
    /* Reset + CSS variables from document */
    :root { --color-primary: #3b82f6; /* ... */ }
    /* Generated CSS from PenNode tree */
    .frame-1 { width: 375px; /* ... */ }
    /* Navigation transition styles */
    .page-container { /* ... */ }
    /* Preview toolbar styles */
    .preview-toolbar { /* ... */ }
  </style>
</head>
<body>
  <!-- Preview toolbar -->
  <div class="preview-toolbar">...</div>

  <!-- Page containers (lazy-loaded) -->
  <div id="page-{id}" class="page-container active">
    <!-- Generated HTML from PenNode tree -->
  </div>

  <script>
    // Navigation logic (hash routing, transitions)
    // Hot reload listener (SSE EventSource)
    // Form interaction handlers
    // Hotspot mode toggle
  </script>
</body>
</html>
```

### Pattern 3: MCP-style In-Memory State for Preview (Reuse Pattern)
**What:** Mirror `mcp-sync-state.ts` pattern for preview data
**When to use:** Server-side preview state management

```typescript
// server/utils/preview-state.ts — mirrors mcp-sync-state.ts
import type { ServerResponse } from 'node:http'

interface PreviewData {
  doc: PenDocument
  activePageId: string | null
  selectedFrameId: string | null
  timestamp: number
}

const previews = new Map<string, PreviewData>()
const sseClients = new Map<string, ServerResponse>()

export function setPreviewData(id: string, data: PreviewData): void {
  previews.set(id, data)
  broadcastToPreview(id, { type: 'preview:update' })
}

export function getPreviewData(id: string): PreviewData | undefined {
  return previews.get(id)
}

function broadcastToPreview(id: string, payload: Record<string, unknown>): void {
  const client = sseClients.get(id)
  if (client && !client.closed) {
    client.write(`data: ${JSON.stringify(payload)}\n\n`)
  }
}
```

### Pattern 4: Role-to-Semantic-HTML Mapping
**What:** Map PenNode roles to appropriate HTML tags for accessibility
**When to use:** During preview HTML generation

```typescript
// src/services/preview/preview-semantic-tags.ts
const ROLE_TAG_MAP: Record<string, string> = {
  // Navigation
  'navbar': 'nav',
  'nav-links': 'ul',
  'nav-link': 'li',

  // Interactive
  'button': 'button',
  'icon-button': 'button',
  'input': 'input',
  'form-input': 'input',
  'search-bar': 'div', // wraps input
  'badge': 'span',
  'tag': 'span',

  // Layout
  'section': 'section',
  'form-group': 'form',

  // Content
  'card': 'article',
  'footer': 'footer',
  'header': 'header',

  // Table
  'table': 'table',
  'table-header': 'thead > tr',
  'table-row': 'tr',
  'table-cell': 'td',
}

export function getSemanticTag(role: string | undefined, nodeType: string): string {
  if (role && ROLE_TAG_MAP[role]) return ROLE_TAG_MAP[role]
  // Fallback: text nodes use heading tags based on font size (existing pattern)
  // Default: div
  return 'div'
}
```

### Pattern 5: Navigation JS Generation
**What:** Generate inline JavaScript for hash-based page navigation with transitions
**When to use:** Embedded in preview HTML `<script>` block

```typescript
// Core navigation approach:
// 1. Each page is a <div id="page-{pageId}"> container
// 2. Only current page has .active class (display: block)
// 3. ScreenConnections become data-attributes on source elements
// 4. Hash changes trigger page transitions
// 5. Browser history API for back navigation

// On clickable elements with connections:
// <div data-navigate="page-id" data-transition="push" data-trigger="click"
//      data-target-frame="frame-id" tabindex="0">

// Navigation JS handles:
// - hashchange event listener
// - click/hover/submit event delegation
// - CSS class toggling for transitions
// - history.pushState for push transitions
// - modal overlay creation for modal transitions
// - scrollTo for targetFrameId
```

### Anti-Patterns to Avoid
- **Modifying html-generator.ts directly:** Keep the code-panel generator clean. Build a separate preview-specific generator that imports and extends the utilities (fillToCSS, strokeToCSS, etc.).
- **Using blob: URLs for preview:** Breaks BroadcastChannel (different origin). Must use Nitro server route for same-origin.
- **Loading all pages upfront:** Large documents should lazy-load pages. Only generate HTML for the initial page, fetch others on navigation.
- **External resource loading in preview:** CSP blocks all external resources. Everything must be inline (CSS, JS, images as base64/data URL, SVG icons inline).
- **Persistent state in preview forms:** User decision: no state persistence. Form elements reset on page navigation.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSE broadcasting | Custom WebSocket server | Nitro h3 SSE pattern (existing in `events.get.ts`) | Already proven in MCP sync, simple to replicate |
| CSS variable generation | Manual variable walking | `generateCSSVariables()` from `css-variables-generator.ts` | Already handles themes, default variants, all variable types |
| Data binding resolution | Custom entity data injection | `resolveDataBinding()` from `resolve-data-binding.ts` | Already handles table/dropdown/list/text binding with field mapping |
| Variable resolution | Custom $ref resolver | `resolveNodeForCanvas()` from `resolve-variables.ts` | Already handles all variable types with circular guards |
| Component argument resolution | Custom ref expansion | `applyArgumentValues()` from `argument-apply.ts` | Already handles all binding types |
| CSS fill/stroke/effect generation | Custom CSS property builder | `fillToCSS()`, `strokeToCSS()`, `effectsToCSS()` from `html-generator.ts` | Already handles gradients, variable refs, all fill types |

**Key insight:** The preview pipeline's resolution order matches the canvas rendering pipeline: resolveArguments -> resolveDataBinding -> resolveVariables -> generateHTML. The same pure functions used for canvas rendering are reusable for preview generation.

## Common Pitfalls

### Pitfall 1: BroadcastChannel Requires Same Origin
**What goes wrong:** If preview is served from a different origin (blob:, data:, or different port), BroadcastChannel messages won't be received.
**Why it happens:** BroadcastChannel enforces same-origin policy (protocol + host + port).
**How to avoid:** Serve preview via Nitro route on the same origin as the editor (e.g., `http://localhost:3000/api/preview/:id`). This is already locked in the user decision.
**Warning signs:** Hot reload stops working; no error in console because BroadcastChannel silently ignores cross-origin.

### Pitfall 2: CSP Blocking Needed Resources
**What goes wrong:** Preview renders blank or missing styles because CSP is too restrictive.
**Why it happens:** `default-src 'none'` blocks everything not explicitly allowed. Forgetting to allow `img-src data:` blocks base64 images, forgetting `style-src 'unsafe-inline'` blocks `<style>` tags.
**How to avoid:** Use this exact CSP: `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:;`
**Warning signs:** Browser console shows "Refused to load" CSP violations.

### Pitfall 3: Circular Navigation Causing Memory Leak
**What goes wrong:** User navigates A->B->C->A->B->C... infinitely, building up history entries and DOM nodes.
**Why it happens:** Each push transition creates a new history entry and may keep old page DOM in memory.
**How to avoid:** Only the active page container is displayed; others are hidden (not duplicated). History entries are lightweight (just hash changes). Lazy page rendering means unused pages are not in DOM until visited.
**Warning signs:** Memory usage grows steadily during navigation.

### Pitfall 4: Electron shell.openExternal Not Working
**What goes wrong:** In Electron, clicking Preview opens nothing or opens the wrong URL.
**Why it happens:** Electron's `shell.openExternal()` needs the full URL with `http://` prefix. Also, in production Electron, the Nitro server runs on a random port.
**How to avoid:** Detect Electron environment, get the actual server port, construct full URL: `http://127.0.0.1:${port}/api/preview/${id}`. Use `window.electronAPI` to invoke `shell.openExternal`.
**Warning signs:** Preview button does nothing in Electron; works fine in browser.

### Pitfall 5: RefNode Not Resolved Before HTML Generation
**What goes wrong:** RefNode renders as `<!-- Ref: xxx -->` comment instead of actual component content.
**Why it happens:** `html-generator.ts` currently outputs `<!-- Ref -->` for ref nodes. Preview needs full component resolution.
**How to avoid:** In the preview pipeline, resolve RefNodes by looking up the referenced component, deep-cloning its children, and applying argument values via `applyArgumentValues()` BEFORE passing to HTML generation.
**Warning signs:** Component instances appear as empty/missing in preview.

### Pitfall 6: Hot Reload Debounce Too Aggressive
**What goes wrong:** Preview feels laggy or misses rapid changes.
**Why it happens:** Debounce window too long; or multiple rapid changes cause the preview to show stale intermediate state.
**How to avoid:** Use 500ms debounce (low end of 500-1000ms range). On each debounce fire, POST the complete current document state (not incremental diffs).
**Warning signs:** User makes changes but preview doesn't update for >1 second.

## Code Examples

### Example 1: Preview Button in Top Bar
```typescript
// src/hooks/use-preview.ts
// Source: Extending existing top-bar.tsx pattern + mcp-sync-state pattern

import { useCallback, useRef } from 'react'
import { useDocumentStore } from '@/stores/document-store'
import { useCanvasStore } from '@/stores/canvas-store'
import { isElectron } from '@/utils/file-operations'
import { nanoid } from 'nanoid'

export function usePreview() {
  const previewIdRef = useRef<string>(nanoid(8))

  const openPreview = useCallback(async () => {
    const doc = useDocumentStore.getState().document
    const { activePageId, selection } = useCanvasStore.getState()

    // Determine preview scope
    const selectedFrameId = selection.selectedIds.length === 1
      ? selection.selectedIds[0]
      : null

    // POST preview data to Nitro
    const baseUrl = window.location.origin
    const previewId = previewIdRef.current
    await fetch(`${baseUrl}/api/preview/data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: previewId,
        doc,
        activePageId,
        selectedFrameId,
      }),
    })

    // Open preview tab
    const previewUrl = `${baseUrl}/api/preview/${previewId}`
    if (isElectron()) {
      window.electronAPI?.openExternal?.(previewUrl)
    } else {
      window.open(previewUrl, `preview-${previewId}`)
    }
  }, [])

  return { openPreview }
}
```

### Example 2: Nitro Preview Route (Serve HTML)
```typescript
// server/api/preview/[id].get.ts
// Source: Mirrors server/api/mcp/events.get.ts + document.get.ts patterns

import { defineEventHandler, getRouterParam } from 'h3'
import { getPreviewData } from '../../utils/preview-state'

export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    return new Response('Missing preview ID', { status: 400 })
  }

  const data = getPreviewData(id)
  if (!data) {
    return new Response('Preview not found', { status: 404 })
  }

  // Generate preview HTML from stored document data
  const html = generatePreviewHTML(data.doc, data.activePageId, data.selectedFrameId)

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
})
```

### Example 3: CSP Meta Tag
```html
<!-- Source: MDN Content-Security-Policy documentation -->
<meta http-equiv="Content-Security-Policy"
  content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:;" />
```

This CSP policy:
- `default-src 'none'` -- blocks everything by default
- `script-src 'unsafe-inline'` -- allows only inline `<script>` (PenBoard-generated navigation/interaction JS)
- `style-src 'unsafe-inline'` -- allows only inline `<style>` (PenBoard-generated CSS)
- `img-src data: blob:` -- allows base64 and blob images (self-contained)
- `font-src data:` -- allows embedded fonts as data URLs

### Example 4: Navigation Event Handler (Inline JS)
```javascript
// Generated inline script for preview navigation
(function() {
  // Connection map: sourceElementId -> {targetPageId, targetFrameId, transition, trigger}
  const connections = __CONNECTIONS_JSON__;

  // Page navigation
  function navigateTo(pageId, transition, targetFrameId) {
    const current = document.querySelector('.page-container.active');
    const target = document.getElementById('page-' + pageId);
    if (!target) {
      // Show "Page not found" placeholder
      showNotFound(pageId);
      return;
    }

    if (transition === 'push') {
      current.classList.add('slide-out-left');
      target.classList.add('slide-in-right', 'active');
      history.pushState({ pageId }, '', '#' + pageId);
    } else if (transition === 'modal') {
      // Show as overlay
      target.classList.add('modal-overlay', 'active');
      history.pushState({ pageId, modal: true }, '', '#' + pageId);
    } else {
      // replace: instant swap
      current.classList.remove('active');
      target.classList.add('active');
      history.replaceState({ pageId }, '', '#' + pageId);
    }

    if (targetFrameId) {
      const frame = document.getElementById('frame-' + targetFrameId);
      if (frame) frame.scrollIntoView({ behavior: 'smooth' });
    }
  }

  // Event delegation for connections
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-nav-click]');
    if (el) {
      const conn = connections[el.dataset.navClick];
      if (conn) navigateTo(conn.targetPageId, conn.transition, conn.targetFrameId);
    }
  });

  // Browser back
  window.addEventListener('popstate', (e) => {
    const pageId = e.state?.pageId || getInitialPageId();
    showPage(pageId);
  });

  // SSE hot reload listener
  const evtSource = new EventSource('/api/preview/events?id=' + __PREVIEW_ID__);
  evtSource.onmessage = (e) => {
    const data = JSON.parse(e.data);
    if (data.type === 'preview:update') {
      window.location.reload();
    }
  };
})();
```

### Example 5: Preview Resolution Pipeline
```typescript
// src/services/preview/preview-data-resolver.ts
// Resolution order matches canvas pipeline (per CONTEXT.md code_context)

import { resolveDataBinding } from '@/variables/resolve-data-binding'
import { resolveNodeForCanvas } from '@/variables/resolve-variables'
import { applyArgumentValues } from '@/canvas/skia/argument-apply'
import type { PenDocument, PenNode, PenPage } from '@/types/pen'

export function resolvePageForPreview(
  page: PenPage,
  doc: PenDocument,
): PenNode[] {
  const entities = doc.dataEntities ?? []
  const variables = doc.variables ?? {}
  const defaultTheme = getDefaultTheme(doc.themes)

  return page.children.map((node) => {
    let resolved = node

    // Step 1: Resolve RefNode arguments
    if (resolved.type === 'ref') {
      resolved = expandRefNode(resolved, doc)
    }

    // Step 2: Resolve data bindings (entity data -> node content)
    resolved = resolveDataBinding(resolved, entities)

    // Step 3: Resolve $variable references -> concrete values
    resolved = resolveNodeForCanvas(resolved, variables, defaultTheme)

    // Step 4: Recursively resolve children
    if ('children' in resolved && resolved.children) {
      resolved = {
        ...resolved,
        children: resolved.children.map((child) =>
          resolvePageForPreview(
            { id: '', name: '', children: [child] },
            doc,
          )[0]
        ),
      } as PenNode
    }

    return resolved
  })
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| blob: URL for preview | Nitro server route (same-origin) | User decision | Enables BroadcastChannel for hot reload |
| iframe sandbox | Browser tab with CSP `<meta>` | User decision | Full-page preview, better UX, CSP-enforced security |
| External JS frameworks for transitions | Pure CSS transitions + inline JS | User decision | Self-contained HTML, no dependencies |
| View Transitions API | CSS keyframe animations | Compatibility | View Transitions API is Baseline Newly Available (2025) but inline JS approach is simpler and more compatible for self-contained HTML export |

**Deprecated/outdated:**
- `html-renderer.ts` iframe approach: Used for AI validation screenshots, NOT suitable for interactive preview (needs full browser tab)
- Fabric.js rendering: Legacy, CanvasKit/Skia is the current renderer

## Open Questions

1. **Electron shell.openExternal IPC**
   - What we know: Electron preload.ts exposes `window.electronAPI` with file dialogs and menu actions
   - What's unclear: `openExternal` is not currently exposed in the preload bridge
   - Recommendation: Add `openExternal` to the Electron preload bridge. Simple IPC addition: `ipcRenderer.invoke('shell:openExternal', url)` -> `shell.openExternal(url)` in main process

2. **Preview ID Lifecycle**
   - What we know: In-memory store holds preview data keyed by ID
   - What's unclear: When to clean up stale preview IDs (tab closed, editor closed, session ends)
   - Recommendation: Add a TTL (e.g., 30 minutes) to preview data entries. Clean up on SSE disconnect. Also clean up all previews when a new document is loaded.

3. **Lazy Page Loading Mechanism**
   - What we know: Large documents should not load all pages at once
   - What's unclear: Whether to use separate Nitro route per page or embed all pages in initial HTML with display:none
   - Recommendation: For live preview (served by Nitro), use separate `GET /api/preview/page/:pageId` route for lazy page fetching via fetch(). For exported HTML, embed all pages in single file (since no server available).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (existing) |
| Config file | `vitest.config.ts` |
| Quick run command | `bun --bun vitest run src/__tests__/preview/ -x` |
| Full suite command | `bun --bun run test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PREV-01 | Preview HTML generation from PenNode tree | unit | `bun --bun vitest run src/__tests__/preview/preview-html-generator.test.ts -x` | Wave 0 |
| PREV-01 | Preview button opens correct URL | unit | `bun --bun vitest run src/__tests__/preview/use-preview.test.ts -x` | Wave 0 |
| PREV-02 | Navigation JS generates correct connection map | unit | `bun --bun vitest run src/__tests__/preview/preview-navigation.test.ts -x` | Wave 0 |
| PREV-02 | Hash routing produces correct page transitions | unit | `bun --bun vitest run src/__tests__/preview/preview-navigation.test.ts -x` | Wave 0 |
| PREV-03 | Data binding resolution produces correct HTML | unit | `bun --bun vitest run src/__tests__/preview/preview-data-resolver.test.ts -x` | Wave 0 |
| PREV-03 | Table binding generates `<table>` with entity data | unit | `bun --bun vitest run src/__tests__/preview/preview-html-generator.test.ts -x` | Wave 0 |
| PREV-04 | Generated HTML contains correct CSP meta tag | unit | `bun --bun vitest run src/__tests__/preview/preview-html-generator.test.ts -x` | Wave 0 |
| PREV-04 | No external resource URLs in generated HTML | unit | `bun --bun vitest run src/__tests__/preview/preview-security.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `bun --bun vitest run src/__tests__/preview/ -x`
- **Per wave merge:** `bun --bun run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/preview/preview-html-generator.test.ts` -- covers PREV-01, PREV-03, PREV-04
- [ ] `src/__tests__/preview/preview-navigation.test.ts` -- covers PREV-02
- [ ] `src/__tests__/preview/preview-data-resolver.test.ts` -- covers PREV-03
- [ ] `src/__tests__/preview/preview-security.test.ts` -- covers PREV-04
- [ ] `src/__tests__/preview/use-preview.test.ts` -- covers PREV-01

## Sources

### Primary (HIGH confidence)
- `src/services/codegen/html-generator.ts` -- existing HTML generation code, verified by reading source
- `src/services/codegen/css-variables-generator.ts` -- CSS variable generation, verified by reading source
- `src/variables/resolve-data-binding.ts` -- data binding resolution, verified by reading source
- `src/variables/resolve-variables.ts` -- variable resolution, verified by reading source
- `src/canvas/skia/argument-apply.ts` -- component argument resolution, verified by reading source
- `src/types/pen.ts` -- ScreenConnection, PenDocument, PenNode types, verified by reading source
- `server/utils/mcp-sync-state.ts` -- SSE broadcast pattern, verified by reading source
- `server/api/mcp/events.get.ts` -- SSE endpoint pattern, verified by reading source
- `server/api/mcp/document.post.ts` -- POST data endpoint pattern, verified by reading source
- [BroadcastChannel API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API) -- same-origin requirement confirmed
- [Content-Security-Policy - MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP) -- CSP meta tag syntax
- [Nitro Routing](https://nitro.build/docs/routing) -- dynamic route parameters with `[param]` syntax

### Secondary (MEDIUM confidence)
- [CSS View Transitions](https://developer.mozilla.org/en-US/blog/view-transitions-beginner-guide/) -- modern animation approach (considered but not recommended for self-contained export)
- `src/services/ai/role-definitions/` -- role registry definitions for semantic HTML mapping

### Tertiary (LOW confidence)
- None -- all findings verified against primary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all patterns verified in existing codebase
- Architecture: HIGH -- mirrors proven MCP sync pattern, extends verified html-generator
- Pitfalls: HIGH -- each pitfall derived from verified API constraints (BroadcastChannel same-origin, CSP rules, Electron IPC)
- Navigation/transitions: MEDIUM -- CSS transition approach is straightforward but exact implementation needs tuning during development

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stable domain -- browser APIs and Nitro patterns change slowly)
