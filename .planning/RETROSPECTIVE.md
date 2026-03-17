# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — PenBoard MVP

**Shipped:** 2026-03-17
**Phases:** 4 | **Plans:** 16 | **Sessions:** ~8

### What Was Built

- Full rebrand from OpenPencil to PenBoard (42 files, 15 locales)
- Screen connection system with property panel, canvas badges, and undo/redo
- Notion-like data entity management with 9 field types, ERD page visualization
- Reusable component system with 5 argument types and drag-connect binding
- Connection highlight mode with focus+dim arrows and navigate modal
- Design token panel with grouped variables and VariablePicker expansion
- Canvas context menu, component sidebar, insert-from-components workflow
- E2E tests (Playwright), unit tests, performance benchmarks

### What Worked

- **Fork strategy**: Starting from OpenPencil v0.4.1 saved enormous time — canvas, components, variables, MCP, code gen all inherited
- **GSD workflow**: Structured phases with research → plan → execute → verify kept momentum high
- **Incremental delivery**: Each phase produced testable features, not abstract infrastructure
- **Gap closure pattern**: Dedicated gap closure plans after verification caught real UX issues
- **Yolo mode**: Auto-approval on scope verification eliminated bottlenecks in solo dev
- **Wave-based execution**: Parallel plan execution within phases maximized throughput

### What Was Inefficient

- **Phase 4 had no disk artifacts**: E2E tests and performance plans were done in-session without standard PLAN.md/SUMMARY.md files, making gsd-tools tracking incomplete (showed 13/16 plans)
- **Post-phase polish**: Several UX issues (canvas context menu, component sidebar, frame hit-test) discovered after Phase 3 verification required extra sessions
- **Rename churn**: Some renames (highlightMode → showConnections) happened across sessions causing partial updates

### Patterns Established

- **Store action extraction**: `createXxxActions` pattern for document-store slices (connections, data, components, pages)
- **Dedicated renderers**: SkiaErdRenderer pattern for page-type-specific rendering delegation
- **Canvas overlay strategy**: SVG overlays for DOM↔canvas bridging (drag-connect wires)
- **Component badge convention**: Faded colored diamond (0.4 alpha) for reusable node indicators
- **Variable grouping heuristic**: Name-based categorization (font→Typography, gap→Spacing)

### Key Lessons

1. **Always create disk artifacts for all phases** — Phase 4 skipped PLAN.md files and broke gsd-tools tracking. Future phases must have standard files regardless of simplicity.
2. **Verify UX with real interaction, not just code review** — Canvas right-click hit-test bug wasn't caught until manual testing. Automated tests can't fully replace interactive validation.
3. **Keep renames atomic** — When renaming across codebase, do it in one commit to avoid partial updates across sessions.
4. **Gap closure is a feature, not overhead** — The 3 gap closure plans (01-04, 01-05, 02-03) fixed real user-facing issues that would have degraded v1.0 quality.

### Cost Observations

- Model mix: ~90% opus, ~10% sonnet/haiku (quality profile)
- Sessions: ~8 across 2 days
- Notable: 16 plans completed in 2 days — fork strategy enabled rapid feature development on solid foundation

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
| --------- | -------- | ------ | ---------- |
| v1.0 | ~8 | 4 | Initial GSD workflow, fork-based development |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
| --------- | ----- | -------- | ------------------ |
| v1.0 | 82+ (61 E2E + 21 MCP) | Core stores + E2E flows | 0 |

### Top Lessons (Verified Across Milestones)

1. Fork strategy + structured phases = rapid delivery (2 days for full MVP)
2. Gap closure plans are essential for production quality
