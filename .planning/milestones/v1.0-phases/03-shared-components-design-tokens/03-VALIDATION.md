---
phase: 03
slug: shared-components-design-tokens
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `bun --bun vitest run src/__tests__/shared-components` |
| **Full suite command** | `bun --bun run test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun --bun vitest run src/__tests__/shared-components`
- **After every plan wave:** Run `bun --bun run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | SHARED-06 | unit | `vitest run src/__tests__/shared-components/component-arguments.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | SHARED-07, SHARED-08 | unit | `vitest run src/__tests__/shared-components/argument-resolution.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 1 | SHARED-01 | unit | `vitest run src/__tests__/shared-components/component-pages.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 1 | SHARED-03, SHARED-05 | unit | `vitest run src/__tests__/shared-components/instance-ux.test.ts` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 2 | TOKEN-01, TOKEN-02 | unit | `vitest run src/__tests__/shared-components/token-grouping.test.ts` | ❌ W0 | ⬜ pending |
| 03-03-02 | 03 | 2 | TOKEN-03 | unit | `vitest run src/__tests__/shared-components/token-picker.test.ts` | ❌ W0 | ⬜ pending |
| 03-04-01 | 04 | 2 | CONN-highlight | unit | `vitest run src/__tests__/shared-components/highlight-mode.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/shared-components/component-arguments.test.ts` — stubs for SHARED-06, SHARED-07, SHARED-08
- [ ] `src/__tests__/shared-components/argument-resolution.test.ts` — argument → node property resolution
- [ ] `src/__tests__/shared-components/component-pages.test.ts` — component page type CRUD
- [ ] `src/__tests__/shared-components/instance-ux.test.ts` — instance navigation, badge
- [ ] `src/__tests__/shared-components/token-grouping.test.ts` — variable grouping by type
- [ ] `src/__tests__/shared-components/token-picker.test.ts` — variable picker in new fields
- [ ] `src/__tests__/shared-components/highlight-mode.test.ts` — connection highlight mode

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drag-connect wire overlay | SHARED-06 | Canvas + DOM bridge, visual verification | Drag from argument to element, verify wire renders |
| Highlight mode dimming | CONN-highlight | GPU render verification | Toggle highlight, verify non-connected frames dim |
| Component badge opacity | SHARED-03 | Visual subtlety check | Mark frame reusable, verify faded badge appears |
| Double-click navigate | SHARED-05 | Canvas interaction test | Double-click instance, verify page switches to source |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
