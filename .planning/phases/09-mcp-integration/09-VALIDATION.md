---
phase: 9
slug: mcp-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `bun --bun vitest run src/mcp/tools/__tests__` |
| **Full suite command** | `bun --bun run test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun --bun vitest run src/mcp/tools/__tests__`
- **After every plan wave:** Run `bun --bun run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | MCP-01 | unit | `bun --bun vitest run src/mcp/tools/__tests__/data-binding.test.ts` | ❌ W0 | ⬜ pending |
| 09-01-02 | 01 | 1 | MCP-03 | unit | `bun --bun vitest run src/mcp/tools/__tests__/context.test.ts` | ❌ W0 | ⬜ pending |
| 09-01-03 | 01 | 1 | MCP-05 | unit | `bun --bun vitest run src/mcp/tools/__tests__/entities.test.ts` | ❌ W0 | ⬜ pending |
| 09-01-04 | 01 | 1 | MCP-05 | unit | `bun --bun vitest run src/mcp/tools/__tests__/connections.test.ts` | ❌ W0 | ⬜ pending |
| 09-02-01 | 02 | 2 | MCP-02 | unit | `bun --bun vitest run src/mcp/tools/__tests__/preview.test.ts` | ❌ W0 | ⬜ pending |
| 09-02-02 | 02 | 2 | MCP-04 | unit | `bun --bun vitest run src/mcp/tools/__tests__/workflow.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/mcp/tools/__tests__/data-binding.test.ts` — stubs for MCP-01
- [ ] `src/mcp/tools/__tests__/context.test.ts` — stubs for MCP-03
- [ ] `src/mcp/tools/__tests__/entities.test.ts` — stubs for MCP-05 (entity CRUD)
- [ ] `src/mcp/tools/__tests__/connections.test.ts` — stubs for MCP-05 (connection CRUD)
- [ ] `src/mcp/tools/__tests__/preview.test.ts` — stubs for MCP-02
- [ ] `src/mcp/tools/__tests__/workflow.test.ts` — stubs for MCP-04
- [ ] Test helpers: mock `openDocument`/`saveDocument` for isolated MCP tool testing

*Existing vitest infrastructure covers framework setup.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Preview URL opens in browser | MCP-02 | Requires running PenBoard + real browser | 1. Start dev server 2. Call `generate_preview` via MCP 3. Open returned URL in browser 4. Verify HTML renders correctly |
| SVG/PNG workflow export quality | MCP-04 | Visual quality verification | 1. Call `export_workflow` with format=svg 2. Decode base64, open in viewer 3. Verify diagram legibility and edge labels |
| Live canvas sync after MCP mutations | MCP-01, MCP-05 | Requires running Electron app | 1. Open PenBoard 2. Call entity/binding MCP tools 3. Verify canvas updates in real-time |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
