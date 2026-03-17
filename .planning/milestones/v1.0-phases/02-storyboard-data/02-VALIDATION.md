---
phase: 02
slug: storyboard-data
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts (via vite.config.ts) |
| **Quick run command** | `bun vitest run --reporter=verbose` |
| **Full suite command** | `bun vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun vitest run --reporter=verbose`
- **After every plan wave:** Run `bun vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | CONN-01,02 | unit | `bun vitest run src/__tests__/connections` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | CONN-03,04 | unit | `bun vitest run src/__tests__/connections` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 1 | CONN-05 | manual | Visual badge on canvas | N/A | ⬜ pending |
| 02-02-01 | 02 | 1 | DATA-04 | unit | `bun vitest run src/__tests__/data-entities` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 1 | ERD-01,03 | unit | `bun vitest run src/__tests__/data-entities` | ❌ W0 | ⬜ pending |
| 02-02-03 | 02 | 1 | DATA-01,02 | manual | Panel UI interaction | N/A | ⬜ pending |
| 02-02-04 | 02 | 1 | ERD-02,04 | manual | ERD page interaction | N/A | ⬜ pending |
| 02-02-05 | 02 | 1 | DATA-03 | unit | `bun vitest run src/__tests__/data-entities` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/connections/` — test directory for connection store actions
- [ ] `src/__tests__/data-entities/` — test directory for data entity store actions
- [ ] Test stubs for connection CRUD (add, update, remove, getByElement, getByPage)
- [ ] Test stubs for data entity CRUD (addEntity, addField, addRow, removeEntity, filter, sort)

*Existing vitest infrastructure is available; only test files need creation.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Connection badge renders on canvas element | CONN-05 | SkiaEngine rendering requires live canvas | Create connection, verify badge appears on source element |
| ERD page renders table nodes correctly | ERD-01, ERD-03 | SkiaEngine rendering requires live canvas | Create ERD page, add entity, verify table node renders with fields |
| ERD relation edges render with cardinality | ERD-02 | Canvas rendering | Create relation, verify arrow with cardinality label |
| ERD node drag repositioning | ERD-04 | Canvas interaction | Drag table node on ERD page, verify position persists |
| Data entity panel UI works | DATA-01, DATA-02 | Panel UI interaction | Open panel, create table, add fields, enter sample data |
| Data view filter/sort | DATA-03 | Panel UI interaction | Create view with filters, verify data rows are filtered |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
