---
phase: 06
slug: context-ai
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 06 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `bun --bun vitest run src/__tests__/context/` |
| **Full suite command** | `bun --bun run test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun --bun vitest run src/__tests__/context/`
- **After every plan wave:** Run `bun --bun run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | CTX-03 | unit | `bun --bun vitest run src/__tests__/context/context-persistence.test.ts` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | CTX-01 | unit | `bun --bun vitest run src/__tests__/context/context-panel.test.ts` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 2 | CTX-02 | unit | `bun --bun vitest run src/__tests__/context/context-injection.test.ts` | ❌ W0 | ⬜ pending |
| 06-02-02 | 02 | 2 | CTX-01 | manual | N/A | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/context/context-persistence.test.ts` — stubs for CTX-03 (copy/paste/duplicate/save/load preserve context)
- [ ] `src/__tests__/context/context-panel.test.ts` — stubs for CTX-01 (context panel renders, textarea works)
- [ ] `src/__tests__/context/context-injection.test.ts` — stubs for CTX-02 (buildContextString includes element context)

*Existing vitest infrastructure covers all framework needs. Only test files need creation.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Markdown preview renders correctly | CTX-01 | Visual rendering, browser-specific | Open Context tab, type markdown, switch to Preview, verify rendered output |
| AI Suggest returns relevant context | CTX-02 | Depends on AI model response quality | Select element, click AI Suggest, verify suggestion is relevant to element type |
| Context tab shows page context when no selection | CTX-01 | UI state interaction | Deselect all elements, switch to Context tab, verify page context textarea shown |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
