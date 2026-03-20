---
phase: 09-mcp-integration
plan: 02
subsystem: mcp
tags: [mcp, preview, workflow, mermaid, puppeteer, svg, png]

requires:
  - phase: 09-mcp-integration
    provides: Tool registry pattern (TOOL_DEFINITIONS + handleToolCall in tool-registry.ts)
  - phase: 07-interactive-preview
    provides: generatePreviewHTML, Nitro preview routes (/api/preview/data, /preview/:id)
  - phase: 08-workflow-visualization
    provides: buildWorkflowGraph, filterGraphByFocus, generateMermaid pure functions

provides:
  - generate_preview MCP tool (HTML preview URL generation for screen pages)
  - export_workflow MCP tool (mermaid/SVG/PNG workflow diagram export)
  - Page type guard for preview (rejects ERD/component pages)
  - Focus mode support for workflow export via focusPageId
  - Graceful SVG/PNG fallback when mermaid-cli unavailable

affects: [mcp-server, ai-agents, external-tooling]

tech-stack:
  added: ["@mermaid-js/mermaid-cli"]
  patterns: [dynamic-import-for-optional-deps, puppeteer-browser-caching]

key-files:
  created:
    - src/mcp/tools/preview.ts
    - src/mcp/tools/workflow.ts
    - src/mcp/tools/__tests__/preview.test.ts
    - src/mcp/tools/__tests__/workflow.test.ts
  modified:
    - src/mcp/tool-registry.ts
    - package.json
    - bun.lock

key-decisions:
  - "Dynamic import for preview-html-generator to avoid browser-only dependency issues in MCP bundle"
  - "Puppeteer browser caching at module level for repeated mermaid-cli SVG/PNG renders"
  - "Graceful error with helpful message when mermaid-cli rendering fails (not hard crash)"

patterns-established:
  - "Dynamic import pattern for optional heavy dependencies in MCP tools"
  - "Process exit cleanup for cached resources (Puppeteer browser)"

requirements-completed: [MCP-02, MCP-04]

duration: 5min
completed: 2026-03-20
---

# Phase 09 Plan 02: Preview Generation + Workflow Export MCP Tools Summary

**generate_preview and export_workflow MCP tools wrapping existing pure functions with page type guards, focus mode, and optional mermaid-cli SVG/PNG rendering**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-20T17:38:25Z
- **Completed:** 2026-03-20T17:43:17Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- Implemented generate_preview MCP tool: validates page type (screen-only), calls generatePreviewHTML, POSTs to running PenBoard instance, returns preview URL
- Implemented export_workflow MCP tool: builds workflow graph, generates mermaid text, optionally renders SVG/PNG via mermaid-cli with Puppeteer
- Added focus mode support for workflow export via filterGraphByFocus
- 13 unit tests covering validation, generation, format defaults, focus mode, and graceful fallback
- All 337 tests pass, MCP compile succeeds, server.ts stays at 170 lines

## Task Commits

Each task was committed atomically:

1. **Task 1: Create preview and workflow MCP tool handlers** - `c5565da` (feat)
2. **Task 2: Unit tests for preview and workflow tools** - `3b4dcd4` (test)
3. **Task 3: Full test suite validation and MCP compile check** - (validation only, no code changes)

## Files Created/Modified
- `src/mcp/tools/preview.ts` - generate_preview handler: page validation, preview HTML generation, URL return
- `src/mcp/tools/workflow.ts` - export_workflow handler: graph building, mermaid text/SVG/PNG export with Puppeteer caching
- `src/mcp/tool-registry.ts` - Added PREVIEW_TOOLS + WORKFLOW_TOOLS definitions and handler switch cases
- `src/mcp/tools/__tests__/preview.test.ts` - 6 tests: ERD/component rejection, page not found, no PenBoard instance, URL generation, frameId passthrough
- `src/mcp/tools/__tests__/workflow.test.ts` - 7 tests: mermaid format, connections, entities, focus mode, empty doc, default format, SVG graceful fallback
- `package.json` - Added @mermaid-js/mermaid-cli dependency
- `bun.lock` - Updated lockfile

## Decisions Made
- Used dynamic import for preview-html-generator.ts to avoid potential browser-only dependency issues when MCP server runs as Node.js process
- Cached Puppeteer browser instance at module level with process exit cleanup to avoid spawning new browsers per SVG/PNG render call
- SVG/PNG rendering wrapped in try/catch with helpful error message suggesting install command -- always falls back gracefully to mermaid text

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 7 new MCP tools from Phase 09 are now functional (5 from Plan 01 + 2 from Plan 02)
- Tool registry contains 34+ tool definitions covering full PenBoard capability surface
- External AI agents can now generate previews, export workflows, manage data bindings, set context, and CRUD entities/connections via MCP
- Phase 09 complete

## Self-Check: PASSED

- All 7 files verified present on disk
- Both task commits (c5565da, 3b4dcd4) verified in git log
- 337/337 tests passing (13 new + 324 existing)
- 0 TypeScript errors in new MCP files
- MCP compile (esbuild) succeeds

---
*Phase: 09-mcp-integration*
*Completed: 2026-03-20*
