---
phase: 8
slug: workflow-visualization
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `bun --bun vitest run --reporter=verbose` |
| **Full suite command** | `bun --bun run test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun --bun vitest run --reporter=verbose`
- **After every plan wave:** Run `bun --bun run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | WF-01 | unit | `bun --bun vitest run src/services/workflow` | ❌ W0 | ⬜ pending |
| 08-01-02 | 01 | 1 | WF-01 | unit | `bun --bun vitest run src/services/workflow` | ❌ W0 | ⬜ pending |
| 08-02-01 | 02 | 1 | WF-01 | integration | `bun --bun vitest run src/components/panels/workflow` | ❌ W0 | ⬜ pending |
| 08-02-02 | 02 | 1 | WF-02 | unit | `bun --bun vitest run src/services/workflow` | ❌ W0 | ⬜ pending |
| 08-03-01 | 03 | 2 | WF-03 | unit | `bun --bun vitest run src/hooks/use-workflow` | ❌ W0 | ⬜ pending |
| 08-03-02 | 03 | 2 | WF-01 | integration | `bun --bun vitest run src/services/workflow` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/services/workflow/__tests__/` — test directory for workflow graph builder and mermaid generator
- [ ] `src/components/panels/workflow/__tests__/` — test directory for workflow panel components
- [ ] `mermaid` — npm package install (lazy loaded, ~800KB)

*Existing vitest infrastructure covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Mermaid diagram renders visually in bottom panel | WF-01 | SVG rendering requires browser environment | Open editor, create 2+ pages with connections, verify diagram appears in bottom panel |
| Click-to-navigate from diagram node | WF-01 | Requires DOM click event + canvas-store integration | Click a page node in diagram, verify canvas switches to that page |
| Zoom/pan interaction | WF-01 | Mouse wheel + drag events in browser | Scroll to zoom, drag to pan in workflow panel |
| Focus mode visual filtering | WF-02 | Requires visual inspection of filtered diagram | Toggle focus mode, verify only active page + 1-hop neighbors shown |
| Auto-update on connection change | WF-03 | Requires live editing + observing diagram update | Add a connection, verify diagram updates within ~500ms |
| Export PNG rasterization | WF-01 | Canvas-based rasterization requires browser | Click PNG export, verify downloaded file is valid image |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
