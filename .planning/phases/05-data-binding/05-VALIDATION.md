---
phase: 5
slug: data-binding
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-17
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `bun run vitest run src/__tests__/data-binding/` |
| **Full suite command** | `bun run vitest run --config vitest.config.ts` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun run vitest run src/__tests__/data-binding/`
- **After every plan wave:** Run `bun run vitest run --config vitest.config.ts`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 5-01-01 | 01 | 0 | BIND-01 | unit | `bun run vitest run src/__tests__/data-binding/ -t "setDataBinding"` | ❌ W0 | ⬜ pending |
| 5-01-02 | 01 | 0 | BIND-01 | unit | `bun run vitest run src/__tests__/data-binding/ -t "clearDataBinding"` | ❌ W0 | ⬜ pending |
| 5-01-03 | 01 | 1 | BIND-02 | unit | `bun run vitest run src/__tests__/data-binding/ -t "resolveDataBinding"` | ❌ W0 | ⬜ pending |
| 5-01-04 | 01 | 1 | BIND-02 | unit | `bun run vitest run src/__tests__/data-binding/ -t "entity missing"` | ❌ W0 | ⬜ pending |
| 5-02-01 | 02 | 1 | BIND-03 | unit | `bun run vitest run src/__tests__/data-binding/ -t "fieldMappings"` | ❌ W0 | ⬜ pending |
| 5-02-02 | 02 | 2 | BIND-04 | unit | `bun run vitest run src/__tests__/data-binding/ -t "removeEntity cascade"` | ❌ W0 | ⬜ pending |
| 5-02-03 | 02 | 2 | BIND-04 | unit | `bun run vitest run src/__tests__/data-binding/ -t "cascade nested"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/data-binding/data-binding.test.ts` — stubs for all 7 test cases (BIND-01 through BIND-04)

*Existing Vitest infrastructure fully covers the phase; only the new test stub file needs to be created in Wave 0.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Entity selector modal opens on bound component | BIND-01 | Requires canvas interaction | Select a table/dropdown node → check right panel for "Bind to Data" section → click selector → verify entity list appears |
| Sample rows render on canvas after binding | BIND-02 | Canvas visual output | Bind a table to entity with 3 rows → confirm 3 rows of data visible on canvas |
| "Entity missing" chip shown after cross-doc paste | BIND-03 | Cross-doc scenario | Copy a bound node → paste into new document → confirm warning chip shows in DataBindingSection |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
