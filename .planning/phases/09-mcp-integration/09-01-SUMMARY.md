---
phase: 09-mcp-integration
plan: 01
subsystem: mcp
tags: [mcp, data-binding, context, entities, connections, tool-registry]

requires:
  - phase: 05-data-entities-erd
    provides: DataEntity, DataBinding, FieldMapping types and document-store-data actions
  - phase: 02-connections-data
    provides: ScreenConnection type and document-store-connections actions

provides:
  - Centralized MCP tool registry (TOOL_DEFINITIONS + handleToolCall)
  - manage_data_binding MCP tool (set/remove/list bindings)
  - set_context and get_context MCP tools (node and page annotations)
  - manage_entities MCP tool (full CRUD with cascade cleanup)
  - manage_connections MCP tool (CRUD with page filtering)
  - add_page type param (screen/erd/component)

affects: [09-02-PLAN, mcp-server, ai-agents]

tech-stack:
  added: []
  patterns: [tool-registry-pattern, load-mutate-save, cascade-cleanup]

key-files:
  created:
    - src/mcp/tool-registry.ts
    - src/mcp/tools/data-binding.ts
    - src/mcp/tools/context.ts
    - src/mcp/tools/entities.ts
    - src/mcp/tools/connections.ts
    - src/mcp/tools/__tests__/data-binding.test.ts
    - src/mcp/tools/__tests__/context.test.ts
    - src/mcp/tools/__tests__/entities.test.ts
    - src/mcp/tools/__tests__/connections.test.ts
  modified:
    - src/mcp/server.ts
    - src/mcp/tools/pages.ts

key-decisions:
  - "Extracted tool registry from server.ts instead of modular per-file registries for simpler import graph"
  - "Re-implemented clearDataBindingInTree in entities.ts (not imported from Zustand store) to keep MCP tools independent of React store layer"
  - "Entity existence validation on set_binding to prevent dangling references"

patterns-established:
  - "Tool registry pattern: TOOL_DEFINITIONS array + handleToolCall switch in tool-registry.ts"
  - "New MCP tools follow load-mutate-save pattern via openDocument/saveDocument"
  - "Cascade cleanup on entity removal: relations + data bindings across all pages"

requirements-completed: [MCP-01, MCP-03, MCP-05]

duration: 9min
completed: 2026-03-20
---

# Phase 09 Plan 01: MCP Tool Registry + Document-Level Tools Summary

**Tool registry extraction + 5 new MCP tools for data-binding, context, entities, connections, and page types via load-mutate-save pattern with entity removal cascade**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-20T17:24:38Z
- **Completed:** 2026-03-20T17:33:41Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Refactored server.ts from 758 to 170 lines by extracting tool definitions into tool-registry.ts
- Implemented 5 new MCP tools: manage_data_binding, set_context, get_context, manage_entities, manage_connections
- Entity removal cascade correctly cleans dangling data bindings and relation fields across all page node trees
- Extended add_page with type param (screen/erd/component)
- 29 unit tests covering all CRUD operations, error cases, and cascade cleanup

## Task Commits

Each task was committed atomically:

1. **Task 1: Refactor server.ts + create tool handlers** - `4b7050c` (feat)
2. **Task 2: Unit tests** - `ab64fc4` (test)

## Files Created/Modified
- `src/mcp/tool-registry.ts` - Centralized TOOL_DEFINITIONS array (32 tools) + handleToolCall dispatch
- `src/mcp/server.ts` - Slimmed to 170 lines, imports from tool-registry
- `src/mcp/tools/data-binding.ts` - set_binding, remove_binding, list_bindings handlers
- `src/mcp/tools/context.ts` - set_context, get_context for nodes and pages
- `src/mcp/tools/entities.ts` - Full entity/field/row/view CRUD with cascade cleanup
- `src/mcp/tools/connections.ts` - Connection CRUD with page-based filtering
- `src/mcp/tools/pages.ts` - Extended AddPageParams with type property
- `src/mcp/tools/__tests__/data-binding.test.ts` - 6 tests for data binding operations
- `src/mcp/tools/__tests__/context.test.ts` - 7 tests for context read/write
- `src/mcp/tools/__tests__/entities.test.ts` - 10 tests for entity CRUD and cascade
- `src/mcp/tools/__tests__/connections.test.ts` - 6 tests for connection CRUD and filtering

## Decisions Made
- Extracted tool registry as single file (not modular per-tool registration) to keep import graph simple and maintain 1:1 mapping with server.ts
- Re-implemented clearDataBindingInTree in entities.ts rather than importing from document-store-data.ts, keeping MCP tools independent of the React/Zustand store layer
- Added entity existence validation in set_binding to prevent creating dangling references
- Used `structuredClone` + load-mutate-save pattern consistently across all tool handlers

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript cast pattern in clearDataBindingInTree**
- **Found during:** Task 1 (entities.ts creation)
- **Issue:** Direct `as Record<string, unknown>` cast on PenNode union type failed TS strict checks
- **Fix:** Used double-cast via `as unknown as Record<string, unknown>` matching existing pattern in document-store-data.ts
- **Files modified:** src/mcp/tools/entities.ts
- **Verification:** `tsc --noEmit` passes for MCP files

**2. [Rule 3 - Blocking] Removed unused imports in entities.ts**
- **Found during:** Task 1 (TypeScript verification)
- **Issue:** getDocChildren/setDocChildren imported but not needed (entity cascade uses doc.pages/doc.children directly); DataFieldType import also unused
- **Fix:** Removed unused imports
- **Files modified:** src/mcp/tools/entities.ts
- **Verification:** TS6192 error resolved

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both auto-fixes necessary for TypeScript compilation. No scope creep.

## Issues Encountered
- `bun --bun vitest run` fails on Windows MSYS with "File URL path must be an absolute path" - used `bun vitest run` (without --bun) which works correctly. This is a pre-existing environment issue, not caused by this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Tool registry pattern established for Plan 02 to add remaining tools
- All document-level MCP tools functional for external AI agent integration
- 29 tests provide regression safety for Plan 02 changes

## Self-Check: PASSED

- All 11 files verified present on disk
- Both task commits (4b7050c, ab64fc4) verified in git log
- 29/29 tests passing
- 0 TypeScript errors in MCP files

---
*Phase: 09-mcp-integration*
*Completed: 2026-03-20*
