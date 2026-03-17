# Pitfalls Research

**Domain:** Data-driven design tool — adding data binding, interactive preview, AI context tab, workflow visualization to existing CanvasKit/Skia app
**Researched:** 2026-03-17
**Confidence:** HIGH (based on source code analysis + verified patterns from design tool ecosystem)

---

## Critical Pitfalls

### Pitfall 1: Dangling Data Bindings After Entity Deletion

**What goes wrong:**
A node has `dataBinding: { entityId: "user", fieldId: "name" }`. The user deletes the `User` entity from the data panel. The binding stays in the node. On next render/preview, code tries to resolve `entityId: "user"` → crashes or silently shows empty. If nodes are duplicated before deletion, multiple nodes share orphaned bindings.

**Why it happens:**
Connections in the existing system use document-level `connections[]` arrays with cascade-on-delete logic inside `removeConnection`. But data bindings will likely be stored directly on PenNode (like `RefNode.argumentValues`). The `removeEntity` action in `document-store-data.ts` currently only removes the entity from `document.dataEntities[]` — it does NOT walk the node tree to clean up binding references on individual nodes.

**How to avoid:**
In `removeEntity` (and `removeField`), walk the full node tree via `flattenNodes()` and call `updateNode()` for any node whose `dataBinding.entityId` (or `fieldId`) matches the deleted item. This is the same pattern used by `replaceVariableRefsInTree` in `src/variables/replace-refs.ts` — reuse that traversal pattern. Add a dedicated `cleanDataBindingsForEntity(entityId)` helper in `document-store-data.ts`.

**Warning signs:**
- Preview renders empty columns/values for some fields
- TypeScript errors when accessing `entity.fields.find(f => f.id === fieldId)` and getting `undefined`
- No crash on deletion but broken preview — the silent failure type

**Phase to address:** Data Binding phase (first phase of v1.1)

---

### Pitfall 2: Circular Reference in Data Binding Resolution

**What goes wrong:**
Entity `User` has a `relation` field pointing to `Order`. Entity `Order` has a `relation` field back to `User`. If the binding resolution code naively follows relations to render preview data, it enters infinite recursion. The existing `resolveVariableRef` in `resolve-variables.ts` already has a `visited: Set<string>` guard for variable circular refs — but data binding resolution is a new code path that will NOT inherit this guard automatically.

**Why it happens:**
`DataField.relatedEntityId` enables many-to-many or bidirectional relations (e.g., `1:N` and `N:M` cardinalities in `data-entity.ts`). Developers building the preview renderer will traverse relation fields to show nested data and forget to track visited entity IDs.

**How to avoid:**
Pass a `visitedEntityIds: Set<string>` parameter into any recursive data resolution function. Cap relation traversal at depth 2 for preview purposes — showing `User.name` and `User.orders[0].id` is enough; do not recurse into `User.orders[0].user`. Follow the guard pattern from `resolve-variables.ts` lines 40-55.

**Warning signs:**
- Browser tab freezes when a node has a relation field binding
- "Maximum call stack size exceeded" errors in the console during preview generation
- Works fine until a user adds a circular relation in the ERD

**Phase to address:** Data Binding phase

---

### Pitfall 3: Undo/Redo History Bloat From Context Textarea

**What goes wrong:**
Every keystroke in the "Context" textarea pushes a full `PenDocument` snapshot into `historyStore.undoStack`. With 300 max states and the user typing a 200-character context string, that consumes 200 undo slots — leaving only 100 slots for actual design operations. Worse: `structuredClone(doc)` on each keypress means serializing the entire document tree on every character typed. A document with 100 nodes, 50 data entity rows, and sample data could be 300KB+. 200 keystrokes × 300KB = 60MB allocated in one typing session.

**Why it happens:**
`history-store.ts` has a 300ms debounce (`DEBOUNCE_MS`), but typing in a textarea fires input events well under 300ms bursts. The debounce only skips the SECOND push within the window, not sustained fast typing. The `areDocumentsEqual` check uses `JSON.stringify` comparison which is O(n) on document size.

**How to avoid:**
Context textarea changes must use a debounce of at least 2000ms before pushing to history. Better: store `aiContext` as a separate map (`nodeId -> string`) in `canvasStore` (NOT in `document-store`), and only flush it to the document on explicit save or when switching nodes. This keeps it out of the undo stack entirely during editing. Only write to the document (and history) when the user finishes typing. Use `historyStore.startBatch()`/`endBatch()` to wrap the flush.

**Warning signs:**
- Undo stepping through individual characters instead of semantic operations
- Memory usage grows noticeably when editing context text
- `historyStore.undoStack.length` is always near 300 even after a single typing session

**Phase to address:** Context Tab phase

---

### Pitfall 4: Interactive Preview XSS — No Sandbox Isolation

**What goes wrong:**
The HTML preview opens a new browser tab (per the v1.1 spec). If the generated HTML is served from the same origin as the app (e.g., `http://localhost:3000/preview`), any JavaScript in the generated HTML has full access to `window.parent`, `localStorage`, the document store Zustand state, and the Nitro API. A malicious node name containing `<script>alert(document.cookie)</script>` would execute with app privileges.

**Why it happens:**
The code generation pipeline (`html-generator.ts`, `react-generator.ts`) takes node properties (names, text content) and interpolates them into HTML/JS strings. These are currently designed for copy-paste into editors, not for live execution. Using them as-is for a live preview browser tab skips all output sanitization.

**How to avoid:**
Serve the preview from a null-origin sandbox. Options in order of security:
1. `<iframe sandbox="allow-scripts">` (NOT `allow-same-origin`) — blocks all parent access. Use `postMessage` from app → iframe to pass data.
2. A separate Electron `BrowserView` or `webContents` with `contextIsolation: true` and no `nodeIntegration`.
3. A `data:` URI or `blob:` URL so the content has no origin at all.

Never serve preview HTML as a same-origin route. Always sanitize node text content (names, text node content) before injecting into preview templates using DOMPurify or equivalent. Figma uses null-origin iframes for exactly this reason (verified via Figma blog).

**Warning signs:**
- Preview opens as `/preview` or `/preview/[id]` route on the same origin
- Node names appear literally in `<title>` or HTML attributes without escaping
- Any `eval()` or `innerHTML =` calls in the preview renderer

**Phase to address:** Interactive Preview phase

---

### Pitfall 5: Stale Preview After Document Changes

**What goes wrong:**
User edits a screen (changes text, repositions a frame), switches to the preview tab, and sees the old design. The preview is a separate browser tab, so it has no reactive connection to the Zustand store in the editor tab. The user has no way to tell if the preview is current or stale.

**Why it happens:**
Zustand state does not cross browser tab boundaries. The preview tab receives a one-time snapshot of the document at the time of preview generation. Changes in the editor do not propagate. The existing Nitro SSE mechanism (used by MCP) could theoretically broadcast to the preview tab, but the preview tab is a different browsing context.

**How to avoid:**
Use one of these sync strategies:
1. **On-demand refresh**: Add a "Refresh Preview" button. Show a visible "preview may be stale" banner whenever `document.isDirty` changes after the last preview generation. This is the simplest and most explicit approach.
2. **Auto-refresh with debounce**: When `isDirty` flips true, schedule a preview refresh after 2 seconds of inactivity (use `useDebounce`). Store the last-rendered document hash; only re-render if hash changed.
3. **Do NOT attempt live-sync via SharedWorker or BroadcastChannel without rate limiting** — every canvas drag event triggers `isDirty`, which would spam re-renders.

The banner approach (option 1) is recommended for v1.1 because it matches user mental model: preview is a point-in-time snapshot, not a live mirror.

**Warning signs:**
- No visual indicator that preview is stale after edits
- Preview tab auto-refreshes on every mouse move (too aggressive)
- Users report "preview doesn't match what I see in the editor"

**Phase to address:** Interactive Preview phase

---

### Pitfall 6: Mermaid Workflow Diagram Layout Explosion

**What goes wrong:**
A project with 15 screens and 30+ connections generates a Mermaid flowchart with 45+ nodes and edges. Mermaid's default `dagre` layout engine produces a sprawling diagram that overflows its container horizontally, with nodes overlapping and arrows crossing unpredictably. With 500+ edges, Mermaid throws `"Too many edges"` errors (confirmed: default `maxEdges` limit is 500, per GitHub issue #5042). Users with 20+ screens hit visual degradation well before hitting the hard limit.

**Why it happens:**
Mermaid is designed for documentation diagrams, not workflow maps of arbitrary-complexity app navigation. The auto-layout has no concept of "page groups" or screen clusters. The diagram is generated from `document.connections[]` which can grow to O(screens²) in worst-case navigation flows.

**How to avoid:**
1. Set `maxEdges: 2000` in Mermaid config explicitly.
2. Limit rendered connections: if `connections.length > 30`, show a warning and render only the first 30 or provide a filter (e.g., "show connections from selected page only").
3. Use `graph LR` (left-to-right) layout for linear flows; it handles long chains better than top-down.
4. Provide "focus mode": render only connections involving the currently active page.
5. Consider `elk` layout (Mermaid supports `%%{init: {'flowchart': {'defaultRenderer': 'elk'}}}%%`) for large graphs — ELK handles density better than dagre.

**Warning signs:**
- Mermaid diagram is wider than viewport for projects with 10+ screens
- Rendering takes 3+ seconds for projects with 20+ connections
- "Too many edges" console error

**Phase to address:** Workflow Visualization phase

---

### Pitfall 7: MCP Tool Breaking Changes Silently Break AI Agents

**What goes wrong:**
New MCP tools are added for data binding (`bind_data_source`, `get_data_entities`) and the workflow view (`get_workflow_diagram`). Existing tools (`batch_get`, `insert_node`) have their `inputSchema` modified to add new optional fields. AI agents (Claude Code, Codex CLI) that cached the tool manifest from v1.0 still use the old schema. If the new field has no default value, the tool call fails. If an existing tool is renamed, all cached agent prompts break silently.

**Why it happens:**
MCP protocol (version 2025-11-25) specifies that tool names are stable identifiers and tool versions must be bumped for breaking changes. However, the current PenBoard MCP server has no versioning — all tools are exposed under the server version from `package.json`. Adding fields without defaults or renaming tools is easy to do accidentally.

**How to avoid:**
- Never rename existing tool names (e.g., `batch_get` stays `batch_get` forever).
- New optional parameters MUST have sensible defaults in the handler so old callers without the parameter still work.
- New tools get new names (additive, never replace).
- When modifying `inputSchema`, only add optional properties — never remove or rename required properties.
- Add a `CHANGELOG.md` entry for every tool schema change.
- Verified pattern from MCP specification: "Servers must not change the behavior of an existing (name, version) pair without bumping the version."

**Warning signs:**
- An existing AI agent test starts failing after adding a new MCP tool
- A new required parameter was added to an existing tool
- Tool names were changed to "improve clarity"

**Phase to address:** MCP Updates phase (last, after all features are stable)

---

### Pitfall 8: Context Loss on Node Copy/Paste/Duplicate

**What goes wrong:**
A node has AI context text: "This button triggers the checkout flow. Must be disabled when cart is empty." User duplicates the node to create a second button. The duplicate has the same `id` initially (before ID remapping), then gets a new ID. The `aiContext` map (if stored as `nodeId -> string`) now has no entry for the new ID — context is lost. Similarly, `duplicateNode` in `document-store.ts` deep-clones the node tree but does NOT copy any external metadata stored by node ID.

**Why it happens:**
`duplicateNode` calls `deepCloneWithNewIds` which reassigns all node IDs. Any external map keyed by old node IDs becomes stale. This is the same problem that would affect data bindings if stored externally. The existing `argumentValues` in `RefNode` survives duplication because it's stored inside the node JSON, but external metadata does not.

**How to avoid:**
Store `aiContext` directly on `PenNodeBase` as an optional field: `aiContext?: string`. This means it lives inside the node JSON, survives all tree operations (duplicate, copy-paste, move, undo/redo) automatically, and is included in `.pb` file exports without extra code. The tradeoff is slight `.pb` file size increase for nodes with context, but this is acceptable. Do NOT store it in `canvasStore` or any external map.

**Warning signs:**
- Context text disappears after duplicating a node
- Pasting a node from clipboard loses its context annotation
- Undo restores the node but not its context text

**Phase to address:** Context Tab phase

---

### Pitfall 9: History Store Full-Snapshot Memory Scaling With Large Data Entities

**What goes wrong:**
The `historyStore` stores up to 300 full `PenDocument` snapshots via `structuredClone`. With v1.1, `PenDocument.dataEntities[]` may contain multiple entities with 50+ sample rows each. A document with 5 entities × 50 rows × 10 fields = 2500 data cells. Each `structuredClone` for history now copies all of this. At 300 history states, this could consume 300 × (canvas nodes + all data entity rows) in memory — potentially 50-100MB for a moderately complex project.

**Why it happens:**
The history system was designed before data entities existed. `structuredClone(doc)` clones the entire `PenDocument` including all `dataEntities`. Every node drag, resize, or property change pushes a full clone. The 300ms debounce helps, but a user doing 5 minutes of design work still accumulates hundreds of states.

**How to avoid:**
Option 1 (recommended for v1.1): Exclude `dataEntities` from undo history. Data entity edits (add/remove/update rows) should use a separate undo mechanism or not be undoable. This is reasonable — users don't expect `Ctrl+Z` to undo "I added a row to the User table". Implement by storing `dataEntities` separately from the main document snapshot. In `historyStore.pushState`, shallow-clone `dataEntities` reference rather than deep-cloning.

Option 2: Keep full snapshots but reduce max history from 300 to 50 when `dataEntities` are present and exceed a size threshold.

**Warning signs:**
- Memory usage grows to 200MB+ after 10 minutes of editing in a data-heavy document
- Performance degrades noticeably when pressing Ctrl+Z (clone takes 50ms+)
- Browser tab crashes with OOM on large projects

**Phase to address:** Data Binding phase (when `dataEntities` first gets populated with real data)

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store `aiContext` in `canvasStore` (React state) instead of in the node | Faster to implement — no type changes | Lost on every document reload, undo, or copy-paste | Never — use `PenNodeBase.aiContext?: string` instead |
| Serve HTML preview from same origin (`/preview` route) | One less routing complexity | XSS risk — generated HTML runs with app privileges | Never — use null-origin iframe or data: URI |
| Generate Mermaid diagram synchronously on every connection change | Always current | Blocks UI thread when connections > 20; layout takes 200-500ms | Only if connections < 10 and it's behind a lazy-load |
| Add new required parameters to existing MCP tools | Cleaner API surface | Breaks all existing AI agent integrations silently | Never — new params must be optional with defaults |
| Deep-clone `dataEntities` in every undo snapshot | Simple implementation | Memory bloat at scale | Only acceptable during initial prototype; must be addressed before shipping |
| Binding stored as `nodeId -> entityId` in a separate map | Decoupled from node | Binding orphaned on duplicate/copy/undo | Never — store binding inside the node JSON |

---

## Integration Gotchas

Common mistakes when connecting new v1.1 features to the existing system.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Data binding + CanvasKit renderer | Trying to resolve live entity data inside `syncFromDocument()` | Resolve bindings to concrete placeholder values BEFORE `syncFromDocument()` is called; never async-resolve inside the render pipeline |
| Context tab + history store | Calling `updateNode()` on every textarea keypress | Debounce 2000ms, or use `startBatch()`/`endBatch()` wrapping the final blur event |
| Mermaid + React | Importing mermaid at top-level | Use `const mermaid = await import('mermaid')` (dynamic import) to avoid 300KB blocking main bundle |
| Preview tab + Nitro server | Opening `/preview` as a same-origin page | Generate preview as `blob:` URL or serve with strict CSP + isolated origin |
| Data entity deletion + node bindings | Only removing from `document.dataEntities[]` | Also walk node tree and null out `dataBinding` refs pointing to deleted entity |
| MCP + new data tools | Adding new tools to the existing `TOOL_DEFINITIONS` array without backward compat check | Verify no existing tool name conflicts; new tools are additive only |
| Context textarea + RefNode | Context applied to a `ref` node instance | Make clear whether context belongs to the RefNode instance or the component definition (FrameNode); recommend instance-level for specificity |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Calling `flattenNodes()` to scan for binding cleanup on every entity update | 10ms delay per update with small docs | Cache flat node list or use indexed lookup by entity ID | Docs with 200+ nodes (breaks at ~150 nodes) |
| Regenerating Mermaid diagram on every `connections` array change | Visible re-render flicker every time a connection is selected | Debounce Mermaid regeneration 500ms; memoize with `useMemo(connections)` | More than 5 connections (visible at any scale) |
| Serializing full document to JSON for preview generation | Preview takes 2-3 seconds to open | Only serialize pages needed for preview; exclude ERD pages | Docs with 5+ data entities and 100+ rows |
| `JSON.stringify` equality check in `areDocumentsEqual` with large `dataEntities` | Undo check blocks UI thread 100ms+ | Either skip the equality check (always push) or compare only `pages[]` and ignore `dataEntities` for undo comparison | Entities with 50+ rows each |
| Rendering all connections in workflow diagram by default | Diagram unreadable for projects with 15+ screens | Default to "focus: active page" mode; full view is opt-in | 10+ screens / 20+ connections |

---

## Security Mistakes

Domain-specific security issues for the interactive preview feature.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Serving preview HTML on same origin | XSS — generated script accesses Zustand store, Nitro API, user files | Null-origin iframe: `<iframe sandbox="allow-scripts">` with NO `allow-same-origin` |
| No output encoding of node text in preview HTML | Node named `<script>alert(1)</script>` executes | Escape all node content via `textContent` assignment, never `innerHTML` |
| Passing Electron `ipcMain` handles to preview window | Any script in preview can access native file system | Electron `BrowserView` for preview must have `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` |
| postMessage without origin validation in preview | Malicious iframe can send messages pretending to be the app | Always check `event.origin` in `message` event listener; use a nonce in the message handshake |
| Embedding base64 images from `ImageNode.src` directly in preview | Large documents generate preview HTML > 50MB | Use object URLs (`URL.createObjectURL`) or limit preview to low-res thumbnails |

---

## UX Pitfalls

Common user experience mistakes for the v1.1 features.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Context tab shows one global textarea for the whole page | Users expect per-element AI context for targeted generation | Context tab shows the context for the currently selected node; falls back to page-level context when nothing is selected |
| Data binding UI requires knowing entity and field IDs | Non-technical users cannot use the feature | Show entity/field names in a dropdown with search; never expose raw IDs |
| Mermaid diagram is view-only with no way to navigate to a screen | Diagram is informational but not actionable | Clicking a node in the Mermaid diagram navigates to that page in the editor |
| Preview opens in a new tab but has no "back to editor" affordance | Users get lost; close the tab and lose the URL | Add "Open in Editor" link to the preview HTML header; use `window.opener.postMessage` to signal the editor |
| No visual indicator of which nodes have data bindings | Users forget they set up bindings and are confused by preview data | Show a small database icon badge on canvas nodes that have active data bindings (similar to connection badge already implemented) |
| Workflow diagram auto-generates even when user hasn't set up connections | Empty diagram is confusing | Show an empty state: "Add screen connections to generate the workflow diagram" |

---

## "Looks Done But Isn't" Checklist

Things that appear complete in demos but are missing critical pieces for real usage.

- [ ] **Data Binding:** Binding UI works — verify binding SURVIVES entity rename, field rename, node duplicate, and undo/redo
- [ ] **Data Binding:** Preview shows sample data — verify it shows correct data when multiple entities are bound on the same page
- [ ] **Interactive Preview:** Preview opens — verify it opens with null-origin sandbox, not same-origin route
- [ ] **Interactive Preview:** Navigation works in preview — verify clicking a button with a screen connection actually navigates (not just renders)
- [ ] **Interactive Preview:** Preview generates correctly — verify it handles `RefNode` instances (component references must be resolved before HTML generation)
- [ ] **Context Tab:** Context saves — verify context is preserved through save/reload of `.pb` file, not just in memory
- [ ] **Context Tab:** Context survives duplicate — verify duplicated node carries its context
- [ ] **Mermaid Diagram:** Diagram renders — verify it renders correctly with 0 connections (empty state), 1 connection, and 15+ connections
- [ ] **Mermaid Diagram:** Diagram is current — verify diagram updates after adding/removing a connection, not stale
- [ ] **MCP Tools:** New tools work — verify existing tools `batch_get`, `insert_node` still work unchanged after adding new tools
- [ ] **MCP Tools:** Backwards compat — verify Claude Code connected at v1.0 can still call v1.0 tools without errors after v1.1 update

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Dangling bindings after entity deletion | LOW | Add a document migration: scan all nodes, null bindings pointing to non-existent entities. Run on `loadDocument`. |
| History bloat from context textarea | MEDIUM | Clear history on document load (already supported by `historyStore.clear()`). Add telemetry to detect before it becomes user-visible. |
| Preview XSS on same origin | HIGH | Requires routing change, CSP headers, and re-architecture of preview serving. Catch this in code review before shipping. |
| Stale Mermaid diagram | LOW | Add a "Regenerate" button; regeneration is idempotent and fast (<200ms for <20 nodes). |
| MCP tool breaking change | MEDIUM | Version bump the broken tool, keep the old name working with deprecated behavior for one minor version. Document in CHANGELOG. |
| Context lost on copy-paste | MEDIUM | If stored in canvasStore, requires a document migration to move context into node JSON. If caught early (before v1.1 ships), cost is LOW — just change storage location. |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Dangling bindings after entity deletion | Data Binding phase | Delete an entity that has bound nodes; verify nodes show empty state gracefully, not crash |
| Circular reference in binding resolution | Data Binding phase | Create A→B→A relation; verify preview does not freeze |
| History bloat from context textarea | Context Tab phase | Type 200 chars in context; verify `undoStack.length < 10` after |
| Preview XSS — no sandbox | Interactive Preview phase | Inspect preview iframe's sandbox attribute; verify `allow-same-origin` is absent |
| Stale preview after edits | Interactive Preview phase | Edit a node after opening preview; verify stale banner appears |
| Mermaid layout explosion | Workflow Visualization phase | Create 20 screens with connections; verify diagram renders in <2s without overflow |
| MCP backwards compat | MCP Updates phase (last) | Run existing Claude Code integration test against new server; verify zero regressions |
| Context lost on copy-paste | Context Tab phase | Set context on a node, duplicate it, verify duplicate has same context |
| History bloat from data entity snapshots | Data Binding phase | Load document with 5 entities × 50 rows; perform 50 design edits; measure memory |

---

## Sources

- Figma plugin system blog (iframe sandboxing, null-origin security): https://www.figma.com/blog/how-we-built-the-figma-plugin-system/
- Mermaid GitHub issue — "Too many edges" limit: https://github.com/mermaid-js/mermaid/issues/5042
- MCP specification versioning: https://modelcontextprotocol.io/specification/versioning
- MCP tool naming conventions issue (SEP-986/SEP-1575): https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1915
- Iframe security best practices 2025: https://qrvey.com/blog/iframe-security/
- Angular two-way binding infinite loop pattern: https://github.com/sveltejs/svelte/issues/398
- PenBoard source — `resolve-variables.ts` (circular guard pattern to replicate)
- PenBoard source — `history-store.ts` (snapshot strategy analysis)
- PenBoard source — `document-store-data.ts` (entity deletion gap analysis)
- PenBoard source — `src/types/pen.ts` (node type system — where to store context)

---

*Pitfalls research for: PenBoard v1.1 Data-Driven Design — data binding, interactive preview, AI context tab, workflow visualization*
*Researched: 2026-03-17*
