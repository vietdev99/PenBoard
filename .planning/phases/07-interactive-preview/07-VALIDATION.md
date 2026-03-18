---
phase: 7
slug: interactive-preview
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (existing) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `bun --bun vitest run src/__tests__/preview/ -x` |
| **Full suite command** | `bun --bun run test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun --bun vitest run src/__tests__/preview/ -x`
- **After every plan wave:** Run `bun --bun run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | PREV-01 | unit | `bun --bun vitest run src/__tests__/preview/preview-html-generator.test.ts -x` | ❌ W0 | ⬜ pending |
| 07-01-02 | 01 | 1 | PREV-01 | unit | `bun --bun vitest run src/__tests__/preview/use-preview.test.ts -x` | ❌ W0 | ⬜ pending |
| 07-02-01 | 02 | 1 | PREV-02 | unit | `bun --bun vitest run src/__tests__/preview/preview-navigation.test.ts -x` | ❌ W0 | ⬜ pending |
| 07-02-02 | 02 | 1 | PREV-02 | unit | `bun --bun vitest run src/__tests__/preview/preview-navigation.test.ts -x` | ❌ W0 | ⬜ pending |
| 07-03-01 | 03 | 1 | PREV-03 | unit | `bun --bun vitest run src/__tests__/preview/preview-data-resolver.test.ts -x` | ❌ W0 | ⬜ pending |
| 07-03-02 | 03 | 1 | PREV-03 | unit | `bun --bun vitest run src/__tests__/preview/preview-html-generator.test.ts -x` | ❌ W0 | ⬜ pending |
| 07-04-01 | 04 | 1 | PREV-04 | unit | `bun --bun vitest run src/__tests__/preview/preview-html-generator.test.ts -x` | ❌ W0 | ⬜ pending |
| 07-04-02 | 04 | 1 | PREV-04 | unit | `bun --bun vitest run src/__tests__/preview/preview-security.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/preview/preview-html-generator.test.ts` — stubs for PREV-01, PREV-03, PREV-04
- [ ] `src/__tests__/preview/preview-navigation.test.ts` — stubs for PREV-02
- [ ] `src/__tests__/preview/preview-data-resolver.test.ts` — stubs for PREV-03
- [ ] `src/__tests__/preview/preview-security.test.ts` — stubs for PREV-04
- [ ] `src/__tests__/preview/use-preview.test.ts` — stubs for PREV-01

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Preview opens in new browser tab | PREV-01 | Requires browser environment | Click Preview button, verify new tab opens with rendered HTML |
| Navigation transitions are smooth | PREV-02 | Visual animation quality | Navigate between screens, verify slide/fade/instant transitions |
| Hotspot mode highlights clickable elements | PREV-02 | Visual overlay verification | Toggle hotspot mode, verify blue highlights on connected elements |
| CSP blocks external resources | PREV-04 | Requires browser dev tools | Open DevTools → Console, verify no CSP violation warnings for self-contained content |
| Hot reload updates preview in real-time | PREV-01 | Requires editor + preview tab interaction | Modify design in editor, verify preview tab updates within 1s |
| Electron shell.openExternal works | PREV-01 | Requires Electron runtime | Test Preview button in Electron app |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
