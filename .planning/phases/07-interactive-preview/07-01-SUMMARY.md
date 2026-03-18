---
phase: 07-interactive-preview
plan: 01
subsystem: preview
tags: [html-generation, csp, semantic-html, data-binding, css-variables, preview-engine]

# Dependency graph
requires:
  - phase: 05-data-entities
    provides: Data binding resolution (resolveDataBinding), DataEntity/DataBinding types
  - phase: 06-context-ai
    provides: Per-element context annotations (used for future AI preview integration)
provides:
  - Preview HTML generation engine (generatePreviewHTML, generatePageHTML)
  - Preview data resolution pipeline (resolvePageForPreview, expandRefNode)
  - Semantic HTML tag mapping (getSemanticTag, ROLE_TAG_MAP)
  - Self-contained HTML documents with CSP, CSS variables, connection attributes
affects: [07-02 (preview server routes), 07-03 (preview toolbar/navigation), 07-04 (preview hot reload)]

# Tech tracking
tech-stack:
  added: []
  patterns: [preview-html-pipeline, csp-sandboxing, semantic-tag-mapping, connection-data-attributes]

key-files:
  created:
    - src/services/preview/preview-html-generator.ts
    - src/services/preview/preview-data-resolver.ts
    - src/services/preview/preview-semantic-tags.ts
    - src/__tests__/preview/preview-html-generator.test.ts
    - src/__tests__/preview/preview-data-resolver.test.ts
    - src/__tests__/preview/preview-security.test.ts
  modified: []

key-decisions:
  - "Replicated CSS helpers from html-generator.ts instead of importing (keeps codegen and preview modules independent)"
  - "CSP policy: default-src 'none' with inline script/style and data:/blob: for images (strict sandboxing)"
  - "Connection attributes use data-nav-click/hover/submit pattern for Plan 03 navigation JS injection"
  - "RefNode expansion happens before data binding and variable resolution in the pipeline"

patterns-established:
  - "Preview pipeline order: expandRefNode -> resolveDataBinding -> resolveNodeForCanvas -> recurse children"
  - "Semantic tag selection: role-based ROLE_TAG_MAP lookup -> text fontSize heuristic -> default div"
  - "Interactive form roles (input, textarea, checkbox, radio, dropdown) generate native HTML form elements"
  - "Preview class naming: pv-{name}-{counter} prefix to avoid CSS conflicts"

requirements-completed: [PREV-01, PREV-03, PREV-04]

# Metrics
duration: 8min
completed: 2026-03-18
---

# Phase 7 Plan 01: Preview HTML Generation Engine Summary

**Self-contained preview HTML engine with CSP sandboxing, semantic tag mapping, data binding resolution, and screen connection attributes for interactive preview rendering**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-18T11:03:41Z
- **Completed:** 2026-03-18T11:11:31Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Built complete preview HTML generation pipeline producing self-contained HTML documents with strict CSP
- Implemented 3-step data resolution: RefNode expansion, data binding injection, $variable resolution
- Semantic HTML output via 25+ role-to-tag mappings (button, nav, article, form, table, etc.)
- Screen connection attributes (data-nav-click/hover/submit) and keyboard accessibility (tabindex)
- Interactive form element generation for input, textarea, checkbox, radio, and dropdown roles
- 24 unit tests covering HTML generation, data resolution, and security

## Task Commits

Each task was committed atomically:

1. **Task 1: Preview data resolver + semantic tags + test scaffolds** - `82fb27e` (feat)
2. **Task 2: Preview HTML generator with full HTML document output** - `e70808d` (feat)

## Files Created/Modified
- `src/services/preview/preview-html-generator.ts` - Core preview engine: generatePreviewHTML produces full HTML documents, generatePageHTML produces page fragments with CSS
- `src/services/preview/preview-data-resolver.ts` - Pre-generation pipeline: expandRefNode, resolvePageForPreview (refs -> data -> variables -> recurse)
- `src/services/preview/preview-semantic-tags.ts` - ROLE_TAG_MAP (25+ mappings) and getSemanticTag with fontSize heuristic
- `src/__tests__/preview/preview-html-generator.test.ts` - 15 tests covering HTML structure, CSP, CSS, semantic tags, connections, form elements
- `src/__tests__/preview/preview-data-resolver.test.ts` - 7 tests covering data binding resolution, variable resolution, RefNode expansion
- `src/__tests__/preview/preview-security.test.ts` - 2 tests verifying CSP meta tag and no external URLs

## Decisions Made
- Replicated CSS helpers from html-generator.ts instead of importing -- keeps codegen and preview modules independent and avoids coupling
- CSP policy uses strict default-src 'none' with only inline script/style and data:/blob: for images
- Connection attributes use data-nav-{event} pattern (not onclick) for clean separation from Plan 03 navigation JS
- RefNode expansion happens first in the pipeline to ensure data bindings and variables resolve on the expanded content

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `bun --bun vitest run` has a path resolution issue on this Windows/MSYS2 environment (TypeError: File URL path must be an absolute path). Used `npx vitest run` instead -- all tests pass correctly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Preview HTML engine is complete and ready for consumption by Plan 02 (server routes) and Plan 03 (toolbar/navigation)
- generatePreviewHTML accepts pageId, frameId, and previewId parameters for full server integration
- SSE hot reload listener is embedded in the generated HTML, ready for Plan 02's event stream endpoint
- Connection data attributes are in place for Plan 03's navigation JavaScript injection

---
*Phase: 07-interactive-preview*
*Completed: 2026-03-18*
