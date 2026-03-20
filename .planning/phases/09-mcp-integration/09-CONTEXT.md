# Phase 9: MCP Integration - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

External AI agents can programmatically access all v1.1 capabilities via MCP tools. This wraps data binding, context annotations, interactive preview, and workflow visualization into MCP tools that any MCP client (Claude Code, Codex, Gemini CLI, etc.) can call. Extends the existing 20+ MCP tool server.

Requirements: MCP-01, MCP-02, MCP-03, MCP-04, MCP-05

</domain>

<decisions>
## Implementation Decisions

### Area A: Preview for Agents (MCP-02)
- **Output**: MCP generates preview HTML server-side via `generatePreviewHTML()`, POSTs to Nitro route, returns **URL** (`http://localhost:PORT/preview/ID`). Agent decides whether to open it
- **Scope param**: Tool accepts `pageId` (required) + optional `frameId` — agent chooses to preview entire page or a specific frame
- **Mode**: Static HTML snapshot — no SSE hot reload. Each tool call generates a fresh preview. Agent calls again when document changes
- **Page type guard**: Only `screen` pages are previewable (ERD/component pages return error)

### Area B: ERD & Connection Scope (MCP-05)
- **Data entities**: Full CRUD — add/update/remove entity, add/update/remove field, add/update/remove sample row, manage views
- **Connections**: Full CRUD — add/update/remove connection, list connections (filterable by page or node)
- **Tool design**: Grouped by domain with `action` param (not separate tools per operation):
  - `manage_entities` — action: add_entity, update_entity, remove_entity, add_field, update_field, remove_field, add_row, update_row, remove_row, list_entities, get_entity
  - `manage_connections` — action: add_connection, update_connection, remove_connection, list_connections
- **Page type awareness**: `add_page` already exists — extend with `type` param to support creating ERD/component pages. No separate tools for page types

### Area C: Workflow Export (MCP-04)
- **Formats**: All three — mermaid text + SVG + PNG
- **SVG/PNG rendering**: Requires server-side mermaid rendering. Use `@mermaid-js/mermaid-cli` (mmdc) or equivalent headless rendering
- **Focus mode**: Optional `focusPageId` param — when provided, filters graph via `filterGraphByFocus()` (already implemented in Phase 8). Omit for full graph
- **Tool**: `export_workflow` with `format` param (mermaid | svg | png) + optional `focusPageId`
- **SVG/PNG output**: Return as base64-encoded string in tool response (not file path). Agent decodes and saves if needed

### Data Binding Tools (MCP-01)
- **Read**: `batch_get` already returns `dataBinding` field on nodes — no new read tool needed
- **Write**: `manage_data_binding` tool with actions: set_binding (nodeId + entityId + fieldMappings), remove_binding (nodeId), list_bindings (pageId)
- **Field mapping**: Accepts array of `{ sourceField, targetProperty }` pairs — same structure as existing `FieldMapping` type

### Context Tools (MCP-03)
- **Read**: `batch_get` already returns `context` field on nodes — no new read tool needed
- **Write**: `update_node` already supports partial merge — `{ context: "..." }` works. BUT add a dedicated convenience tool `set_context` for ergonomics:
  - `set_context` — nodeId + context (string). Also supports pageId for page-level context
  - `get_context` — nodeId or pageId. Returns context string + node name for confirmation
- **Page context**: Supported — pass `pageId` without `nodeId` to read/write page-level context

### Claude's Discretion
- Exact error message wording for invalid operations
- Internal code organization (one file per tool group or split further)
- Validation depth (how much input validation per tool)
- Response format details (what metadata to include alongside results)
- Mermaid CLI installation and caching strategy
- Whether to bundle SVG/PNG rendering as optional (graceful fallback to mermaid-only if mmdc not available)

</decisions>

<specifics>
## Specific Ideas

- Tool naming should follow existing MCP convention (snake_case, short names)
- `manage_entities` and `manage_connections` should feel like a mini-API — agents can build entire projects programmatically
- Preview URL should work immediately when opened in browser (no additional setup needed)
- Workflow SVG/PNG should be high quality enough to paste into documentation or presentations
- Consider making SVG/PNG rendering optional with graceful degradation to mermaid text if @mermaid-js/mermaid-cli is not installed

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### MCP Server (existing infrastructure)
- `src/mcp/server.ts` — MCP server entry point, TOOL_DEFINITIONS array, handleToolCall switch, stdio + HTTP dual mode
- `src/mcp/document-manager.ts` — Document read/write/cache, live canvas sync via Nitro, `openDocument()`, `saveDocument()`, `fetchLiveSelection()`
- `src/mcp/utils/node-operations.ts` — `getDocChildren`/`setDocChildren` page-aware utilities
- `src/mcp/utils/sanitize.ts` — Object sanitization for document data

### MCP Tool Patterns (follow these)
- `src/mcp/tools/node-crud.ts` — CRUD tool pattern: load doc → mutate → save → return result
- `src/mcp/tools/pages.ts` — Multiple handlers in one file with shared utility pattern
- `src/mcp/tools/batch-design.ts` — DSL-based batch operations pattern
- `src/mcp/tools/variables.ts` — get/set pattern for document-level data

### Data Binding (MCP-01)
- `src/types/pen.ts` — `DataBinding` type on PenNodeBase, `FieldMapping` type
- `src/types/data-entity.ts` — DataEntity, DataField, DataRow, DataView types
- `src/stores/document-store-data.ts` — `setDataBinding()`, entity CRUD actions, cascade cleanup on entity removal
- `src/variables/resolve-data-binding.ts` — `resolveDataBinding()` pure function, `BINDABLE_ROLES` list

### Preview (MCP-02)
- `src/services/preview/preview-html-generator.ts` — `generatePreviewHTML()` — generates full interactive HTML
- `src/hooks/use-preview.ts` — Client-side preview flow (reference for server-side adaptation)
- `server/api/preview/data.post.ts` — Nitro POST route for preview data
- `server/api/preview/[id].get.ts` — Nitro GET route to serve preview HTML

### Context (MCP-03)
- `src/types/pen.ts` line 45 — `context?: string` on PenNodeBase
- `src/types/pen.ts` line 87 — `context?: string` on PenPage
- `src/components/panels/ai-chat-handlers.ts` — `buildContextString()` shows how context is used in AI prompts

### Workflow (MCP-04)
- `src/services/workflow/graph-builder.ts` — `buildWorkflowGraph()`, `filterGraphByFocus()`
- `src/services/workflow/mermaid-generator.ts` — `generateMermaid()`
- `src/hooks/use-workflow.ts` — Workflow hook (reference for how UI consumes workflow data)

### Connections (MCP-05)
- `src/types/pen.ts` — `ScreenConnection` interface (sourceElementId, sourcePageId, targetPageId, targetFrameId, triggerEvent, transitionType)
- `src/types/pen.ts` — `PenDocument.connections` array
- `src/stores/document-store.ts` — Connection CRUD actions

### Prior Phase Contexts
- `.planning/phases/05-data-binding/05-CONTEXT.md` — Data binding decisions (field mapping, cascade, CRUD scope)
- `.planning/phases/06-context-ai/06-CONTEXT.md` — Context annotation decisions (tab, AI injection, page context)
- `.planning/phases/07-interactive-preview/07-CONTEXT.md` — Preview decisions (Nitro routes, sandbox, hot reload)
- `.planning/phases/08-workflow-visualization/08-CONTEXT.md` — Workflow decisions (mermaid, focus mode, panel)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`generatePreviewHTML()`** (`preview-html-generator.ts`): Server-side callable — takes PenDocument + pageId, returns complete HTML string. MCP tool can call directly
- **`buildWorkflowGraph()` + `generateMermaid()`**: Pure functions — take PenDocument, return WorkflowGraph/mermaid string. MCP tool wraps directly
- **`filterGraphByFocus()`**: Takes graph + focusPageId, returns filtered graph. Already built for Phase 8
- **`resolveDataBinding()`**: Pure function — takes PenNode + entities, returns resolved node. Already available for read operations
- **`setDataBinding()`** (`document-store-data.ts`): Zustand action — MCP must replicate the tree mutation logic (not call Zustand directly since MCP runs in separate process)
- **`document-manager.ts`**: `openDocument()` / `saveDocument()` with live canvas push — all MCP tools follow this load→mutate→save pattern
- **Entity/connection arrays on PenDocument**: `dataEntities[]` and `connections[]` are document-level — easy to read/write via document-manager

### Established Patterns
- **Tool registration**: Add to `TOOL_DEFINITIONS` array + `handleToolCall` switch in `server.ts`
- **Handler pattern**: `async function handleXxx(args) → result` — load doc, validate, mutate, save, return
- **Live canvas sync**: `saveDocument()` auto-pushes to Electron canvas. No extra code needed for live updates
- **Page-aware operations**: Use `getDocChildren(doc, pageId)` / `setDocChildren(doc, pageId, children)` from `node-operations.ts`
- **Error handling**: Throw `Error` with descriptive message — server.ts catches and returns `isError: true`

### Integration Points
- `src/mcp/server.ts` — Add new tool definitions + handlers to switch statement
- `src/mcp/tools/` — New handler files: `data-binding.ts`, `connections.ts`, `entities.ts`, `preview.ts`, `workflow.ts`, `context.ts`
- `server/api/preview/` — Existing Nitro routes for preview HTML storage/serving
- `package.json` — Add `@mermaid-js/mermaid-cli` dependency for SVG/PNG rendering

</code_context>

<deferred>
## Deferred Ideas

- **MCP resource subscriptions** (SSE notifications when document changes) — could enable agents to watch for changes. Complexity doesn't justify for v1.1
- **MCP authentication** — tokens/API keys for multi-user MCP access. Not needed for local-only app model
- **Bulk operations** (e.g., set context on all selected nodes at once) — agents can loop; batch convenience is v2
- **Design system token export via MCP** — could expose CSS variables as structured tokens. Separate from v1.1 scope

</deferred>

---

*Phase: 09-mcp-integration*
*Context gathered: 2026-03-20*
