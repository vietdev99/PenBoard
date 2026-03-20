# Phase 9: MCP Integration - Research

**Researched:** 2026-03-20
**Domain:** MCP tool implementation wrapping v1.1 features (data binding, preview, context, workflow, ERD/connections)
**Confidence:** HIGH

## Summary

Phase 9 extends PenBoard's existing MCP server (currently 27 tools across 16 files) with 6 new tool groups exposing all v1.1 capabilities to external AI agents. The implementation follows well-established patterns: the codebase already has a mature MCP tool architecture with clear load-mutate-save cycles, page-aware operations, and live canvas sync.

The core challenge is straightforward -- all the underlying functions already exist as pure, importable utilities (`generatePreviewHTML`, `buildWorkflowGraph`, `generateMermaid`, `filterGraphByFocus`, etc.). Each new MCP tool is essentially a thin wrapper: validate input, load document, call existing function, save if needed, return result.

The one genuinely new technical concern is server-side mermaid-to-SVG/PNG rendering for `export_workflow`. This requires `@mermaid-js/mermaid-cli` which uses Puppeteer (headless Chromium) under the hood. The decision notes make SVG/PNG optional with graceful fallback, which is the right approach given the heavyweight dependency.

**Primary recommendation:** Implement tools in 3 waves: (1) simple document-level tools (context, data-binding, connections, entities), (2) preview generation, (3) workflow export with optional mermaid CLI rendering. All follow the existing handler pattern in `src/mcp/tools/`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Preview (MCP-02):** Server-side HTML generation via `generatePreviewHTML()`, POST to Nitro route, return URL. Static snapshots only, no SSE. `pageId` required, optional `frameId`. Only `screen` pages previewable.
- **ERD & Connections (MCP-05):** Full CRUD via `manage_entities` (action param) and `manage_connections` (action param). Extend `add_page` with `type` param. Page-type-aware operations.
- **Workflow Export (MCP-04):** Three formats: mermaid text + SVG + PNG. Use `@mermaid-js/mermaid-cli` for SVG/PNG. Optional `focusPageId` via `filterGraphByFocus()`. Return SVG/PNG as base64.
- **Data Binding (MCP-01):** `batch_get` already returns `dataBinding`. New `manage_data_binding` tool with set_binding/remove_binding/list_bindings actions.
- **Context (MCP-03):** `batch_get` already returns `context`. New `set_context` and `get_context` convenience tools. Support page-level context via `pageId`.

### Claude's Discretion
- Exact error message wording for invalid operations
- Internal code organization (one file per tool group or split further)
- Validation depth (how much input validation per tool)
- Response format details (what metadata to include alongside results)
- Mermaid CLI installation and caching strategy
- Whether to bundle SVG/PNG rendering as optional (graceful fallback to mermaid-only if mmdc not available)

### Deferred Ideas (OUT OF SCOPE)
- MCP resource subscriptions (SSE notifications when document changes)
- MCP authentication (tokens/API keys for multi-user)
- Bulk operations (set context on all selected nodes at once)
- Design system token export via MCP
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MCP-01 | MCP tools to set/get data bindings on nodes | `batch_get` already returns `dataBinding` field; new `manage_data_binding` tool wraps `updateNodeInTree` for set/clear; `DataBinding` and `FieldMapping` types from `data-entity.ts` |
| MCP-02 | MCP tool to trigger preview generation | `generatePreviewHTML(doc, pageId, frameId, previewId)` is a pure function callable from MCP; existing Nitro routes `/api/preview/data` (POST) and `/api/preview/:id` (GET) handle storage/serving |
| MCP-03 | MCP tools to read/write element context | `context?: string` exists on `PenNodeBase` and `PenPage`; `update_node` already supports partial merge including `context`; new `set_context`/`get_context` tools for ergonomics |
| MCP-04 | MCP tool to export workflow diagram (mermaid/SVG) | `buildWorkflowGraph()` + `generateMermaid()` are pure functions; `filterGraphByFocus()` for focus mode; `@mermaid-js/mermaid-cli@11.12.0` `renderMermaid()` API returns `Uint8Array` for SVG/PNG |
| MCP-05 | MCP full support for navigation, context, ERD, and component pages | `doc.dataEntities[]` and `doc.connections[]` are document-level arrays; CRUD patterns match existing `document-store-data.ts` and `document-store-connections.ts`; `add_page` needs `type` param extension |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@modelcontextprotocol/sdk` | 1.12.1+ (installed) | MCP server framework | Already in use, provides Server, StdioServerTransport, StreamableHTTPServerTransport |
| `@mermaid-js/mermaid-cli` | 11.12.0 | Server-side mermaid to SVG/PNG rendering | Official CLI with Node.js API (`renderMermaid()`), returns Uint8Array -- no file I/O needed |
| `puppeteer` | (peer of mermaid-cli) | Headless Chromium for mermaid rendering | Required by mermaid-cli, provides Browser instance for `renderMermaid()` |

### Supporting (already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `nanoid` | (installed) | ID generation | For connection/entity IDs in MCP handlers |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@mermaid-js/mermaid-cli` | `mermaid` + JSDOM/server-side DOM | Mermaid requires browser APIs; JSDOM insufficient; CLI wraps Puppeteer correctly |
| Spawning `mmdc` CLI binary | `renderMermaid()` Node.js API | API is in-process, no subprocess overhead, returns buffer directly |

**Installation:**
```bash
bun add @mermaid-js/mermaid-cli
```

**Note:** `@mermaid-js/mermaid-cli` pulls in puppeteer (~300MB). Since SVG/PNG export is optional (mermaid text always works), this should be an `optionalDependencies` or lazy-loaded. Recommended: add as regular dependency but lazy-import with try/catch so the MCP server starts even without Chromium installed.

## Architecture Patterns

### Recommended Project Structure
```
src/mcp/tools/
  (existing files unchanged)
  data-binding.ts      # MCP-01: manage_data_binding handler
  context.ts           # MCP-03: set_context, get_context handlers
  preview.ts           # MCP-02: generate_preview handler
  workflow.ts          # MCP-04: export_workflow handler
  entities.ts          # MCP-05: manage_entities handler
  connections.ts       # MCP-05: manage_connections handler
src/mcp/
  server.ts            # Add new tool definitions + handlers (CAUTION: 758 lines)
```

### Pattern 1: Action-Param Tool (manage_entities, manage_connections, manage_data_binding)
**What:** Single MCP tool with `action` string parameter that dispatches to sub-handlers
**When to use:** When a domain has multiple CRUD operations but they share the same document context
**Example:**
```typescript
// Source: CONTEXT.md decision + existing pattern from pages.ts
export async function handleManageEntities(params: ManageEntitiesParams) {
  const filePath = resolveDocPath(params.filePath)
  let doc = await openDocument(filePath)
  doc = structuredClone(doc)

  switch (params.action) {
    case 'add_entity': {
      const id = generateId()
      const entity: DataEntity = { id, name: params.name ?? 'Entity', fields: [], rows: [], views: [] }
      doc.dataEntities = [...(doc.dataEntities ?? []), entity]
      await saveDocument(filePath, doc)
      return { entityId: id, entityCount: (doc.dataEntities ?? []).length }
    }
    case 'list_entities':
      return { entities: (doc.dataEntities ?? []).map(e => ({ id: e.id, name: e.name, fieldCount: e.fields.length, rowCount: e.rows.length })) }
    // ... other actions
  }
}
```

### Pattern 2: Pure Function Wrapper (preview, workflow)
**What:** MCP tool that loads document, calls an existing pure function, returns result
**When to use:** When the feature's core logic already exists as a pure function
**Example:**
```typescript
// Source: existing preview-html-generator.ts + CONTEXT.md decision
import { generatePreviewHTML } from '../../services/preview/preview-html-generator'
import { getSyncUrl } from '../document-manager'

export async function handleGeneratePreview(params: GeneratePreviewParams) {
  const filePath = resolveDocPath(params.filePath)
  const doc = await openDocument(filePath)

  // Validate page type
  const page = doc.pages?.find(p => p.id === params.pageId)
  if (!page) throw new Error(`Page not found: ${params.pageId}`)
  if (page.type === 'erd' || page.type === 'component') {
    throw new Error(`Only screen pages are previewable. Page "${page.name}" is type "${page.type}"`)
  }

  const previewId = generateId()
  const html = generatePreviewHTML(doc, params.pageId, params.frameId ?? null, previewId)

  // POST to Nitro preview endpoint
  const syncUrl = await getSyncUrl()
  if (!syncUrl) throw new Error('No running PenBoard instance found')
  await fetch(`${syncUrl}/api/preview/data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: previewId, html }),
  })

  return { previewId, url: `${syncUrl}/preview/${previewId}`, pageName: page.name }
}
```

### Pattern 3: Node-Level Convenience Tool (set_context, get_context)
**What:** Thin tool wrapping `findNodeInTree` + `updateNodeInTree` for a single property
**When to use:** When ergonomics matter -- agents should not need to remember `update_node({ nodeId, data: { context: "..." } })`

### Anti-Patterns to Avoid
- **Importing Zustand stores in MCP tools:** MCP runs in a separate Node.js process (not the React app). Never import `useDocumentStore`. Use `document-manager.ts` for all document I/O.
- **Creating separate tools per CRUD action:** Per CONTEXT.md, use grouped tools with `action` param (`manage_entities`, `manage_connections`, `manage_data_binding`).
- **Synchronous Puppeteer launch:** The mermaid rendering browser should be lazy-launched and cached. Don't launch Puppeteer on every `export_workflow` call.
- **Exceeding 800-line limit in server.ts:** At 758 lines, server.ts is nearly full. New tool definitions should be extracted to a separate file or the switch statement refactored.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Preview HTML generation | Custom HTML builder | `generatePreviewHTML()` from `preview-html-generator.ts` | 800+ line generator with CSP, CSS variables, navigation, data binding resolution |
| Workflow graph extraction | Custom document walker | `buildWorkflowGraph()` from `graph-builder.ts` | Already handles pages, connections, data bindings, entity relations, deduplication |
| Mermaid syntax generation | String template | `generateMermaid()` from `mermaid-generator.ts` | Handles ID sanitization, label escaping, class definitions, edge types |
| Focus mode filtering | Custom node filter | `filterGraphByFocus()` from `graph-builder.ts` | 1-hop neighbors + connected entities logic already implemented |
| SVG/PNG from mermaid | Custom renderer | `renderMermaid()` from `@mermaid-js/mermaid-cli` | Handles Puppeteer lifecycle, IIFE injection, output format, returns Uint8Array |
| Document load/save with sync | File I/O wrapper | `openDocument()` / `saveDocument()` from `document-manager.ts` | Handles caching, live canvas push, validation |
| Node tree mutations | Manual tree walk | `findNodeInTree`, `updateNodeInTree` from `node-operations.ts` | Recursive tree operations, already battle-tested |
| Data binding cascade cleanup | Manual sweep | `clearDataBindingInTree()` from `document-store-data.ts` | Recursively cleans dangling bindings when entity removed |

**Key insight:** Phase 9 is almost entirely "glue code." Every significant computation already exists as a pure function. The MCP handlers are thin wrappers: validate -> load doc -> call function -> save -> return.

## Common Pitfalls

### Pitfall 1: server.ts 800-Line Limit
**What goes wrong:** Adding 6+ new tool definitions and handler cases to an already 758-line file pushes it over the project's 800-line style limit.
**Why it happens:** Each tool definition is 15-30 lines of schema, plus switch case and import.
**How to avoid:** Extract tool definitions to a separate file (e.g., `tool-definitions-v11.ts`) or create a registration pattern that auto-discovers tools. At minimum, extract the TOOL_DEFINITIONS array.
**Warning signs:** File exceeds 800 lines after adding first tool.

### Pitfall 2: MCP Process Cannot Import Preview Dependencies
**What goes wrong:** `generatePreviewHTML` imports from `@/services/preview/preview-data-resolver`, `@/services/preview/preview-navigation`, etc. which may have browser-only dependencies or heavy transitive imports.
**Why it happens:** The MCP server compiles to a CJS bundle via esbuild (`mcp:compile` script). Tree-shaking may not eliminate all browser APIs.
**How to avoid:** Test MCP compile after adding preview tool. If imports fail, create a lightweight wrapper that calls the Nitro endpoint directly instead of importing the generator.
**Warning signs:** `mcp:compile` errors, runtime crashes in MCP with "window is not defined" or similar.

### Pitfall 3: Puppeteer Browser Not Available
**What goes wrong:** `@mermaid-js/mermaid-cli` depends on Puppeteer which needs Chromium. In CI, Electron builds, or minimal installs, Chromium may not be available.
**Why it happens:** Puppeteer auto-downloads Chromium on install, but this can fail behind firewalls or in containers.
**How to avoid:** Make SVG/PNG rendering optional. Try/catch the import of mermaid-cli. Return clear error: "SVG/PNG export requires @mermaid-js/mermaid-cli. Install with: bun add @mermaid-js/mermaid-cli. Mermaid text format is always available."
**Warning signs:** `Error: Could not find Chrome` at runtime.

### Pitfall 4: Preview URL Requires Running PenBoard Instance
**What goes wrong:** MCP tool calls `generatePreviewHTML()` and POSTs to Nitro, but returns a URL like `http://localhost:3000/preview/abc123`. If PenBoard is not running, the URL is dead.
**Why it happens:** Preview is served by the running Nitro server, not persisted to disk.
**How to avoid:** Check `getSyncUrl()` before attempting preview. If no instance is running, throw a clear error. The tool should also document this requirement in its description.
**Warning signs:** 404 when agent opens the returned URL.

### Pitfall 5: Entity Removal Requires Cascade Cleanup
**What goes wrong:** Agent removes an entity via `manage_entities`, but nodes still reference it via `dataBinding.entityId`.
**Why it happens:** MCP operates on raw document JSON, not Zustand actions that have cascade logic built in.
**How to avoid:** Replicate the cascade cleanup from `document-store-data.ts` `removeEntity` action: (1) filter out the entity, (2) clean relation fields in other entities, (3) walk all page node trees with `clearDataBindingInTree()`. Import the pure `clearDataBindingInTree` function directly.
**Warning signs:** Stale `dataBinding` references after entity deletion.

### Pitfall 6: Connection IDs Generated Without nanoid
**What goes wrong:** Using `generateId()` (from `src/mcp/utils/id.ts`) for connections but the Zustand store uses `nanoid()`.
**Why it happens:** Two different ID generators exist in the codebase.
**How to avoid:** Use `generateId()` consistently within MCP tools (it already uses nanoid internally). Check that the MCP util `generateId` produces IDs compatible with the rest of the document.
**Warning signs:** ID format mismatch between MCP-created and UI-created entities/connections.

## Code Examples

### MCP Tool Registration Pattern (existing, verified)
```typescript
// Source: src/mcp/server.ts lines 47-529
// Tool definition in TOOL_DEFINITIONS array:
{
  name: 'manage_data_binding',
  description: 'Set, remove, or list data bindings on nodes. ...',
  inputSchema: {
    type: 'object' as const,
    properties: {
      filePath: { type: 'string', description: '...' },
      action: { type: 'string', enum: ['set_binding', 'remove_binding', 'list_bindings'] },
      nodeId: { type: 'string', description: 'Node ID (for set/remove)' },
      entityId: { type: 'string', description: 'Entity ID (for set_binding)' },
      fieldMappings: { type: 'array', description: 'Field mappings (for set_binding)' },
      pageId: { type: 'string', description: 'Page ID (for list_bindings)' },
    },
    required: ['action'],
  },
}
```

### Document Load-Mutate-Save Pattern (existing, verified)
```typescript
// Source: src/mcp/tools/node-crud.ts lines 122-171
const filePath = resolveDocPath(params.filePath)
let doc = await openDocument(filePath)
doc = structuredClone(doc)  // CRITICAL: always clone before mutation
// ... mutate doc ...
await saveDocument(filePath, doc)  // Auto-pushes to live canvas
```

### Workflow Mermaid Generation (existing, verified)
```typescript
// Source: src/services/workflow/graph-builder.ts + mermaid-generator.ts
import { buildWorkflowGraph, filterGraphByFocus } from '../../services/workflow/graph-builder'
import { generateMermaid } from '../../services/workflow/mermaid-generator'

const doc = await openDocument(filePath)
let graph = buildWorkflowGraph(doc)
if (params.focusPageId) {
  graph = filterGraphByFocus(graph, params.focusPageId)
}
const mermaidText = generateMermaid(graph)
```

### Mermaid to SVG/PNG via renderMermaid API
```typescript
// Source: @mermaid-js/mermaid-cli documentation + DeepWiki analysis
// NOTE: Low-level API not covered by semver -- pin version
import { renderMermaid } from '@mermaid-js/mermaid-cli'
import puppeteer from 'puppeteer'

let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null

async function getMermaidBrowser() {
  if (!browser) browser = await puppeteer.launch({ headless: 'shell' })
  return browser
}

async function renderMermaidToFormat(
  definition: string,
  format: 'svg' | 'png',
): Promise<string> {
  const b = await getMermaidBrowser()
  const { data } = await renderMermaid(b, definition, format, {
    backgroundColor: 'white',
  })
  return Buffer.from(data).toString('base64')
}
```

### Preview Generation from MCP
```typescript
// Source: src/services/preview/preview-html-generator.ts line 798
// + src/hooks/use-preview.ts lines 38-54
import { generatePreviewHTML } from '../../services/preview/preview-html-generator'

const previewId = generateId()
const html = generatePreviewHTML(doc, pageId, frameId, previewId)

// POST to running Nitro instance
const syncUrl = await getSyncUrl()
await fetch(`${syncUrl}/api/preview/data`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ id: previewId, html }),
})
// Return URL for agent
const url = `${syncUrl}/preview/${previewId}`
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate MCP tools per CRUD op | Action-param grouped tools | Phase 9 decision | Fewer tools in list, agents remember fewer names |
| File-based mermaid CLI (`mmdc`) | In-process `renderMermaid()` API | mermaid-cli 11.x | No subprocess spawn, returns buffer directly |
| Client-only preview | Server-side HTML generation | Phase 7 | MCP can now generate previews without browser |

**Important version notes:**
- `@mermaid-js/mermaid-cli` Node.js API is NOT covered by semver (follows mermaid's versioning). Pin the exact version.
- `@modelcontextprotocol/sdk@1.12.1+` is already installed and working with StreamableHTTPServerTransport.

## Open Questions

1. **server.ts line budget**
   - What we know: Currently 758 lines, limit is 800. Adding 6 tool definitions (~20 lines each) + 6 switch cases (~3 lines each) = ~138 lines.
   - What's unclear: Best refactoring approach.
   - Recommendation: Extract `TOOL_DEFINITIONS` array and `handleToolCall` switch to a separate `tool-registry.ts` file, leaving `server.ts` focused on server setup and transport.

2. **Preview HTML generator in MCP bundle**
   - What we know: `generatePreviewHTML` imports from multiple preview sub-modules. The MCP compile target is `--platform=node`.
   - What's unclear: Whether all transitive imports are Node.js compatible (no `window`, `document`, etc.)
   - Recommendation: Test `mcp:compile` early after adding the import. If it fails, use HTTP call to Nitro's `/api/preview/data` route instead of direct import.

3. **Puppeteer browser lifecycle**
   - What we know: `renderMermaid` needs an active Browser instance. Launching Puppeteer takes 1-3 seconds.
   - What's unclear: Should the browser be kept alive for the MCP server lifetime, or launched/closed per render?
   - Recommendation: Lazy launch + keep alive with 5-minute idle timeout. Close on MCP server shutdown.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (via `vitest.config.ts`) |
| Config file | `vitest.config.ts` |
| Quick run command | `bun --bun vitest run src/mcp/__tests__/ --passWithNoTests` |
| Full suite command | `bun --bun run test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MCP-01 | set/get data bindings via MCP | unit | `bun --bun vitest run src/mcp/__tests__/data-binding.test.ts -x` | Wave 0 |
| MCP-02 | trigger preview generation | unit | `bun --bun vitest run src/mcp/__tests__/preview.test.ts -x` | Wave 0 |
| MCP-03 | read/write element context | unit | `bun --bun vitest run src/mcp/__tests__/context.test.ts -x` | Wave 0 |
| MCP-04 | export workflow diagram | unit | `bun --bun vitest run src/mcp/__tests__/workflow.test.ts -x` | Wave 0 |
| MCP-05 | entity/connection/page-type CRUD | unit | `bun --bun vitest run src/mcp/__tests__/entities-connections.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `bun --bun vitest run src/mcp/__tests__/ --passWithNoTests`
- **Per wave merge:** `bun --bun run test`
- **Phase gate:** Full suite green + `npx tsc --noEmit`

### Wave 0 Gaps
- [ ] `src/mcp/__tests__/data-binding.test.ts` -- covers MCP-01
- [ ] `src/mcp/__tests__/preview.test.ts` -- covers MCP-02 (mock Nitro endpoint)
- [ ] `src/mcp/__tests__/context.test.ts` -- covers MCP-03
- [ ] `src/mcp/__tests__/workflow.test.ts` -- covers MCP-04 (mermaid text only, skip SVG/PNG in unit tests)
- [ ] `src/mcp/__tests__/entities-connections.test.ts` -- covers MCP-05

## Sources

### Primary (HIGH confidence)
- `src/mcp/server.ts` -- existing MCP server, 27 tools, 758 lines (verified by reading)
- `src/mcp/tools/node-crud.ts` -- handler pattern: resolveDocPath, openDocument, structuredClone, mutate, saveDocument
- `src/mcp/tools/pages.ts` -- multi-handler file pattern, page CRUD
- `src/mcp/tools/variables.ts` -- get/set pattern for document-level data
- `src/mcp/document-manager.ts` -- openDocument/saveDocument/getSyncUrl APIs
- `src/mcp/utils/node-operations.ts` -- page-aware getDocChildren/setDocChildren + tree utilities
- `src/types/pen.ts` -- PenDocument, PenNode, ScreenConnection, PenPage (with type and context fields)
- `src/types/data-entity.ts` -- DataEntity, DataField, DataRow, DataBinding, FieldMapping types
- `src/stores/document-store-data.ts` -- entity/binding CRUD actions and cascade cleanup logic
- `src/stores/document-store-connections.ts` -- connection CRUD actions
- `src/services/preview/preview-html-generator.ts` -- `generatePreviewHTML(doc, pageId, frameId, previewId)` signature
- `src/services/workflow/graph-builder.ts` -- `buildWorkflowGraph()`, `filterGraphByFocus()` pure functions
- `src/services/workflow/mermaid-generator.ts` -- `generateMermaid()` pure function
- `src/variables/resolve-data-binding.ts` -- `resolveDataBinding()` and `BINDABLE_ROLES`
- `server/api/preview/data.post.ts` -- Nitro POST endpoint for preview HTML storage
- `server/api/preview/[id].get.ts` -- Nitro GET endpoint serving preview HTML
- `server/utils/preview-state.ts` -- in-memory preview state with TTL cleanup

### Secondary (MEDIUM confidence)
- [DeepWiki mermaid-cli rendering pipeline](https://deepwiki.com/mermaid-js/mermaid-cli/3.2-rendering-pipeline) -- `renderMermaid()` API signature: `(browser, definition, format, opts) => Promise<{title, desc, data: Uint8Array}>`
- [GitHub mermaid-js/mermaid-cli](https://github.com/mermaid-js/mermaid-cli) -- Node.js API via `run()` function, not covered by semver
- `npm view @mermaid-js/mermaid-cli version` -- 11.12.0 (verified 2026-03-20)
- `npm view @modelcontextprotocol/sdk version` -- 1.27.1 (latest, installed 1.12.1+)

### Tertiary (LOW confidence)
- `renderMermaid()` exact options interface may differ between versions -- pin dependency version and test

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all core libs already installed except mermaid-cli; mermaid-cli version verified
- Architecture: HIGH -- existing codebase has 16 tool files with consistent patterns; all target functions verified as pure/importable
- Pitfalls: HIGH -- based on direct code reading of 758-line server.ts limit, MCP compile pipeline, and Puppeteer dependency chain

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable -- MCP SDK and tool patterns are mature in this codebase)
