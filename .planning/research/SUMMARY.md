# Project Research Summary

**Project:** PenBoard v1.1 — Data-Driven Design
**Domain:** Design tool extension — data binding, interactive preview, AI context, workflow visualization
**Researched:** 2026-03-17
**Confidence:** HIGH

## Executive Summary

PenBoard v1.1 extends an already-complete design tool (React 19, CanvasKit/Skia, Zustand, Nitro, Electron) with four new data-driven capabilities: data binding between ERD entities and UI components, interactive HTML prototype preview, per-element AI context annotations, and an auto-generated workflow diagram from screen connections. The codebase already contains `ScreenConnection[]`, `DataEntity[]`, `PenPage` with multi-type pages, and a 20+ tool MCP server — these are the foundations the new features build on. The research confirms that only **one new npm dependency is required** (`mermaid@^11.13.0`), and all other features are achieved by extending existing types, stores, and patterns.

The recommended approach is to treat v1.1 as a pipeline extension, not a new architecture. Data binding inserts a pure resolver step into the existing `syncFromDocument()` render pipeline — modeled after the variable resolution step already present. Context notes become a first-class field on `PenNodeBase`, stored in the `.pb` document to survive copy/paste, undo, and reload. Interactive preview generates ephemeral HTML via a Blob URL (never served from the same origin to avoid XSS). Workflow visualization derives a Mermaid diagram from `document.connections[]` with a lazy-loaded Mermaid library.

The key risks are architectural decisions that seem minor but have cascading consequences: storing AI context in React state instead of on the node (causes context loss on duplicate/undo), serving preview HTML from the same origin (XSS risk), calling `updateNode` on every textarea keystroke (history bloat), and omitting cascade-delete logic when entities are removed (dangling bindings crash preview silently). All four risks have clear preventions documented in PITFALLS.md and must be addressed in the first implementation phase they appear in.

---

## Key Findings

### Recommended Stack

PenBoard v1.0 is already fully provisioned with the right technology. The v1.1 feature set requires zero new frameworks, zero new state management libraries, and zero new UI component libraries. The only addition is `mermaid@^11.13.0` (2.9M weekly downloads, official TypeScript types, `flowchart TD` mode renders SVG from a text definition in one API call). It must be **dynamically imported** (`const m = await import('mermaid')`) to keep it out of the initial bundle — the full Mermaid package is ~2.7MB and should only load when the Workflow panel is opened.

Preview functionality is implemented via `<iframe sandbox="allow-scripts">` with a Blob URL (null origin), using the browser's native `BroadcastChannel` API for cross-tab sync when needed. The existing `html-generator.ts` provides the rendering foundation — no new HTML generation logic is required, only an extension for data-binding-aware output.

**Core technologies (existing, unchanged):**

- React 19 + Zustand 5: all state, all panels, all stores
- CanvasKit/Skia: rendering pipeline where data binding resolution hooks in
- Nitro (h3): server API and MCP server
- `@radix-ui/react-select`: data source selector UI (already in dependencies)
- `argument-apply.ts` → `applyPropertyValue()`: reused by data binding resolver

**New dependency:**

- `mermaid@^11.13.0`: workflow diagram rendering — lazy-loaded, ships own TS types, compatible with React 19 / Vite 7 / Electron 35

**Patterns (zero new dependencies):**

- `iframe[srcdoc]` / Blob URL: sandboxed preview
- `BroadcastChannel`: cross-tab preview sync
- `PenNode.contextNote?: string`: per-element AI context stored in document
- `PenNode.dataBinding?: DataBindingConfig`: entity binding stored in document

### Expected Features

The research establishes a clear priority split: features the user expects to exist at launch (table stakes) vs. features that differentiate PenBoard from Figma/Framer (competitive), vs. features that create more problems than they solve at this milestone (anti-features).

**Must have (table stakes) for v1.1 launch:**

- Data source selector on components — pick which `DataEntity` drives a component
- Component renders with entity sample rows in canvas — binding visible immediately on canvas
- Interactive HTML preview in separate browser tab — click-through prototype with real data
- Preview navigates via screen connections — clicking connected elements changes screens
- Context textarea per element — annotate any node with AI-readable intent notes
- Workflow diagram panel showing screen-to-screen flow — validate the navigation structure

**Should have (competitive differentiators), add after core is stable:**

- Data edges in workflow diagram (entity to screen relationships, extends the Mermaid output)
- MCP tools for all new capabilities (`set_data_binding`, `get_node_context`, `get_workflow_diagram`)
- Preview data binding resolution for non-table components (text nodes, dropdowns)
- Fallback/placeholder when entity is unbound or deleted

**Defer to v2+:**

- Component variants and states (hover, active, disabled) — orthogonal to data binding
- Responsive breakpoints in preview — significant scope increase
- Animation/transition between screens — high complexity, low immediate value
- Live database connection for preview — breaks local-first model, requires auth/CORS/secrets
- Two-way data binding from preview back to entity — separating design-time and preview-time is the correct model
- Workflow diagram as editable canvas page type — Mermaid is the correct tool for read-only derived views

### Architecture Approach

The v1.1 architecture follows one guiding principle: **extend, don't replace**. The four new features each add a narrow slice to an existing layer. Data binding adds one step (`resolveDataBindingsInTree`) to the `syncFromDocument()` pipeline between argument resolution and text pre-measurement — a pure function with no side effects, modeled on `resolve-variables.ts`. Context notes extend `PenNodeBase` with a single optional string field. Preview is a new `src/services/preview/` module that generates HTML and opens it as a Blob URL. Workflow visualization is a new `src/services/workflow/` module that derives Mermaid syntax from document data.

**Major components and their responsibilities:**

1. `src/types/data-binding.ts` (NEW) — `DataBindingConfig` type: `entityId`, `fieldMap`, `rowIndex`, `mode`
2. `src/data-binding/resolve-data-binding.ts` (NEW) — pure resolver: node tree + entities to resolved node tree with concrete values; mirrors `resolve-variables.ts`; reuses `applyPropertyValue` from `argument-apply.ts`
3. `src/components/panels/data-binding-section.tsx` (NEW) — UI: entity dropdown + field mapping; uses existing `@radix-ui/react-select`
4. `src/components/panels/context-section.tsx` (NEW) — textarea for `PenNode.contextNote`; auto-saves on blur
5. `src/components/panels/workflow-panel.tsx` (NEW) — displays Mermaid SVG; lazy-loads `mermaid`; updates on `document.connections` change
6. `src/services/preview/preview-generator.ts` (NEW) — `PenDocument` to HTML string with inlined sample data and navigation JS
7. `src/services/preview/preview-bridge.ts` (NEW) — `window.open(blobUrl)` + Blob URL lifecycle management
8. `src/services/workflow/workflow-generator.ts` (NEW) — `PenDocument` to Mermaid flowchart string
9. `src/canvas/skia/skia-engine.ts` (MODIFIED) — one new call to `resolveDataBindingsInTree` in pipeline
10. `src/types/pen.ts` (MODIFIED) — add `contextNote?: string` and `dataBinding?: DataBindingConfig` to `PenNodeBase`
11. `src/stores/document-store-data.ts` (MODIFIED) — `removeEntity` must cascade-clean node bindings via `replaceVariableRefsInTree` pattern
12. `src/services/ai/ai-chat-handlers.ts` (MODIFIED) — `buildContextString()` reads `node.contextNote`
13. `src/mcp/tools/` (NEW: 4 files) — `data-binding.ts`, `preview.ts`, `context.ts`, `workflow.ts`

**State management decisions:**

- `PenNode.dataBinding` and `PenNode.contextNote` live in the `.pb` document — survive all tree operations (undo, copy-paste, duplicate, reload)
- Preview HTML is ephemeral — generated on demand, never persisted in the document
- Mermaid diagram is derived — recomputed from `document.connections[]` on demand, never stored
- No new Zustand stores — `documentStore.updateNode()` handles all saves

### Critical Pitfalls

The nine pitfalls identified span four categories: data integrity, security, performance, and backward compatibility. The five most critical (HIGH recovery cost or silent failures) are:

1. **Dangling bindings after entity deletion** — `removeEntity` does not currently walk the node tree. Prevention: extend `removeEntity` in `document-store-data.ts` to call `cleanDataBindingsForEntity(entityId)` using the `replaceVariableRefsInTree` traversal pattern. Without this, deleted entities leave orphaned bindings that crash the preview silently.

2. **Preview XSS — no sandbox isolation** — Serving generated HTML from the same origin (`/preview` route) gives generated scripts access to the Zustand store, Nitro API, and Electron file system. Prevention: use `<iframe sandbox="allow-scripts">` (NO `allow-same-origin`) with a Blob URL — null origin — and escape all node text content via `textContent`, never `innerHTML`.

3. **History store bloat from context textarea** — Every keystroke in the context textarea clones the full `PenDocument` into the undo stack (300 slots x full document). Prevention: debounce `updateNode` calls from the textarea at 2000ms, or use `historyStore.startBatch()`/`endBatch()` to group the entire typing session into one undo slot.

4. **Context lost on node copy/paste/duplicate** — If `contextNote` is stored in `canvasStore` (React state) keyed by node ID, `duplicateNode`'s ID remapping orphans the context entry. Prevention: store `contextNote` directly on `PenNodeBase` inside the node JSON — it then survives all tree operations automatically.

5. **History bloat from large `dataEntities` snapshots** — `historyStore` clones the full `PenDocument` on every design operation. With 5 entities x 50 rows, each undo slot is significantly larger. Prevention: exclude `dataEntities` from undo history — entity edits are not expected to be undone via Ctrl+Z. Implement by shallow-cloning the `dataEntities` reference in `historyStore.pushState`.

---

## Implications for Roadmap

Based on the dependency analysis in FEATURES.md and the build order from ARCHITECTURE.md, the feature set maps naturally to four phases. The first two must ship together (data binding + canvas renders it), and preview depends on both being stable. Context and workflow can ship independently.

### Phase 1: Data Binding Foundation

**Rationale:** Data binding is the root dependency for preview (preview renders entity data) and workflow (workflow shows entity-to-screen edges). It must be built first. It is also the most architecturally constrained feature — inserting into the `syncFromDocument()` pipeline requires careful ordering relative to existing resolution steps.

**Delivers:** `DataBindingConfig` type, pure resolver (`resolve-data-binding.ts`), `DataBindingSection` UI, canvas renders bound entity sample rows, cascade-delete logic in `removeEntity`.

**Addresses features from FEATURES.md:**

- Data source selector on components (P1)
- Component renders with entity sample rows (P1)

**Must avoid from PITFALLS.md:**

- Dangling bindings on entity deletion (cascade-delete from day 1)
- Circular reference in binding resolution (add `visitedEntityIds: Set<string>` guard)
- History bloat from `dataEntities` snapshots (shallow-clone entities in history)
- Never store binding config outside the node JSON

### Phase 2: Context Tab

**Rationale:** Context tab is the lowest-dependency feature — one optional field on `PenNodeBase`, one textarea component, one change to `buildContextString()`. It can be built in parallel with Phase 1 or immediately after. It is low-risk and high-value for the AI workflow use case.

**Delivers:** `PenNode.contextNote?: string`, `ContextSection` component, 'context' tab in `RightPanel`, `buildContextString()` extended to include selected node context.

**Addresses features from FEATURES.md:**

- Context/notes field per element (P1)

**Must avoid from PITFALLS.md:**

- History bloat from textarea keystrokes (debounce 2000ms or batch)
- Context loss on copy/paste/duplicate (store in node JSON, not external map)

### Phase 3: Interactive Preview

**Rationale:** Preview requires data binding to be stable (it resolves entity sample rows into the HTML output). It is also the highest-security-risk feature — the XSS sandbox decision must be made here, not retrofitted later. The `preview-generator.ts` logic is independent of the canvas renderer, but it must understand `DataBindingConfig` to inline correct data.

**Delivers:** `preview-generator.ts` (PenDocument to interactive HTML), `preview-bridge.ts` (Blob URL lifecycle), "Preview" button in toolbar/top-bar, screen-to-screen navigation in preview HTML, null-origin sandbox isolation.

**Addresses features from FEATURES.md:**

- Interactive HTML preview in browser tab (P1)
- Preview navigates via connections (P1)
- Preview renders with sample data (P1 — requires Phase 1)

**Must avoid from PITFALLS.md:**

- Preview XSS — null-origin Blob URL only, never same-origin route
- Stale preview — add "Refresh Preview" button + stale indicator banner
- Preview HTML size explosion — serialize screen pages only (exclude ERD, component pages)

### Phase 4: Workflow Visualization

**Rationale:** Workflow diagram is a pure derivation from existing document data (`connections[]`, `dataEntities[]`, `pages[]`). It benefits from data binding being in place to show entity-to-screen edges. Mermaid lazy-loading must be implemented correctly to avoid bundle size regression.

**Delivers:** `workflow-generator.ts` (PenDocument to Mermaid string), `WorkflowPanel` component, lazy-loaded Mermaid rendering, `mermaid@^11.13.0` dependency addition, basic empty-state handling.

**Addresses features from FEATURES.md:**

- Workflow view shows screen-to-screen flow (P1)
- Data edges in workflow diagram (P2 — enhanced by Phase 1 data binding)

**Must avoid from PITFALLS.md:**

- Mermaid layout explosion — implement connection limit (30 max by default), use `graph LR`, set `maxEdges: 2000`, provide "focus: active page" mode
- Mermaid blocking main bundle — dynamic import only (`await import('mermaid')`)
- Mermaid regenerating on every connection change — debounce 500ms, memoize with `useMemo`

### Phase 5: MCP Tools

**Rationale:** MCP tools are thin wrappers over all features built in Phases 1-4. They must be built last to avoid backward compatibility breaks during iteration. Existing tools (`batch_get`, `insert_node`) must remain unchanged — only additive new tools.

**Delivers:** 4 new MCP tools (`data-binding.ts`, `preview.ts`, `context.ts`, `workflow.ts`), MCP server registration, backward compatibility validation.

**Addresses features from FEATURES.md:**

- MCP tools expose new capabilities (P2)

**Must avoid from PITFALLS.md:**

- MCP tool breaking changes — new tools only, existing tool names frozen, all new parameters optional with defaults

### Phase Ordering Rationale

- **Phases 1 and 2 are independent** and can be worked in parallel by two engineers if needed. Phase 1 (data binding) takes longer; Phase 2 (context tab) is a half-day task.
- **Phase 3 must follow Phase 1** because `generatePreviewHtml` needs to resolve `PenNode.dataBinding` to inline correct sample data. A preview without data resolution would be a half-working feature.
- **Phase 4 is independent** but produces richer output after Phase 1 (entity-to-screen edges in diagram). Can ship a basic version (screen connections only) before Phase 1, then add entity edges after.
- **Phase 5 must be last** — it wraps all other features and any changes to the underlying APIs (data binding config shape, context field name) will break MCP tool schemas.

### Research Flags

Phases likely needing deeper research during planning:

- **Phase 3 (Interactive Preview):** The `html-generator.ts` extension for data-binding-aware output is the highest-risk coupling point. Research needed on how `RefNode` instances (component references) are resolved before HTML generation — ARCHITECTURE.md flags this as a gap.
- **Phase 3 (Interactive Preview):** Electron `window.open` behavior with Blob URLs needs validation in the Electron 35 renderer context — STACK.md notes it works but flags it as MEDIUM confidence.

Phases with standard patterns (skip research-phase):

- **Phase 1 (Data Binding):** Pure function added to an existing pipeline. Pattern is directly modeled on `resolve-variables.ts` which already exists and works. No novel patterns.
- **Phase 2 (Context Tab):** Single optional field + textarea. No research needed — straightforward implementation.
- **Phase 4 (Workflow Visualization):** Mermaid integration is well-documented. The `mermaid.render()` API is stable and the flowchart syntax is fixed.
- **Phase 5 (MCP Tools):** MCP tool implementation pattern is established across 20+ existing tools in the codebase.

---

## Confidence Assessment

| Area | Confidence | Notes |
| --- | --- | --- |
| Stack | HIGH | One new dependency (`mermaid`). All other patterns use existing tools verified in the codebase. BroadcastChannel and iframe srcdoc are MDN-documented APIs. |
| Features | MEDIUM | Table stakes and differentiators verified against Figma/Framer patterns. Edge cases derived from first principles, not observed in a live system. |
| Architecture | HIGH | All integration points verified directly against source code (skia-engine.ts, resolve-variables.ts, argument-apply.ts, history-store.ts, document-store-data.ts). |
| Pitfalls | HIGH | 6 of 9 pitfalls verified from source code analysis. 2 verified from official docs (Mermaid maxEdges, MCP versioning). 1 (Preview XSS) verified from Figma engineering blog. |

**Overall confidence:** HIGH

### Gaps to Address

- **`RefNode` resolution in preview HTML:** ARCHITECTURE.md notes that `preview-generator.ts` "reimplements traversal for HTML output, does not call react-generator directly." It is unclear whether the existing `resolveRefs()` logic (which expands `RefNode` into `FrameNode` content) will be reused or re-implemented. This must be clarified at the start of Phase 3 — getting this wrong means preview renders component placeholder boxes instead of actual component content.

- **`html-generator.ts` extension scope:** The feature research notes that `html-generator.ts` must be extended for data-binding-aware output (table/list components expanded with sample rows). The exact API surface for this extension is not defined — it could be a new function parameter, a new mode flag, or a separate `preview-html-generator.ts`. This gap should be resolved in Phase 3 planning.

- **`dataEntities` in undo history:** PITFALLS.md recommends excluding `dataEntities` from undo history to prevent memory bloat, but does not specify the exact `historyStore.pushState` change needed. This may require `historyStore` API changes that could affect other features. Validate the implementation approach at the start of Phase 1.

- **Mermaid `elk` renderer in Electron:** PITFALLS.md suggests using the ELK layout engine for large graphs, but ELK is loaded as a separate Mermaid worker. Worker availability in Electron's renderer process at Chromium 134 needs verification before relying on it as a mitigation.

---

## Sources

### Primary (HIGH confidence)

- `d:/Workspace/Messi/Code/PenBoard/src/types/pen.ts` — PenNodeBase type system, existing fields
- `d:/Workspace/Messi/Code/PenBoard/src/canvas/skia/skia-engine.ts` — syncFromDocument() pipeline structure
- `d:/Workspace/Messi/Code/PenBoard/src/canvas/skia/argument-apply.ts` — applyPropertyValue() reuse
- `d:/Workspace/Messi/Code/PenBoard/src/variables/resolve-variables.ts` — circular guard pattern to replicate
- `d:/Workspace/Messi/Code/PenBoard/src/stores/history-store.ts` — snapshot strategy analysis
- `d:/Workspace/Messi/Code/PenBoard/src/stores/document-store-data.ts` — entity deletion gap
- `d:/Workspace/Messi/Code/PenBoard/src/mcp/server.ts` — existing tool registry pattern
- `https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API` — BroadcastChannel API
- `https://developer.mozilla.org/en-US/docs/Web/API/HTMLIFrameElement/srcdoc` — srcdoc sandbox
- `https://www.electronjs.org/docs/latest/api/window-open` — Electron window.open behavior
- `https://modelcontextprotocol.io/specification/versioning` — MCP tool versioning rules

### Secondary (MEDIUM confidence)

- `https://mermaid.js.org/config/usage.html` — mermaid.render() API
- `https://github.com/mermaid-js/mermaid/releases` — v11.13.0 as current stable
- `https://www.figma.com/blog/how-we-built-the-figma-plugin-system/` — iframe null-origin sandboxing
- `https://help.figma.com/hc/en-us/articles/360040314193` — Figma prototype navigation patterns
- `https://www.framersnippets.com/articles/linking-cms-data-to-framer-components` — Framer data binding patterns
- `https://github.com/mermaid-js/mermaid/issues/5042` — Mermaid maxEdges limit (500 default)

### Tertiary (LOW confidence)

- WebSearch: mermaid weekly downloads ~2.9M — not independently verified
- `https://qrvey.com/blog/iframe-security/` — iframe security patterns 2025

---

*Research completed: 2026-03-17*
*Ready for roadmap: yes*
