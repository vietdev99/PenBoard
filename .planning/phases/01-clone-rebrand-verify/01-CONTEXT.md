# Phase 1: Clone, Rebrand & Verify - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

OpenPencil fork runs as PenBoard with consistent branding across all touchpoints. All inherited canvas features verified working. Clean git starting point. No new features — only rebrand and verify.

</domain>

<decisions>
## Implementation Decisions

### Branding Identity
- App name: **PenBoard**
- Tagline: **"Storyboard Design Tool"** with subtitle "Design screens, connect flows, model data"
- Landing page route (`/`): **Redirect to `/editor`** — this is a desktop app, no marketing landing page
- Logo/icon files: **Keep OpenPencil icons as-is** — new logo deferred to future phase
- Window titles, dialog headers, error messages: All show "PenBoard"

### Rebrand Scope — Full Depth
- **Package identity**: `openpencil` → `penboard` in package.json (name + bin entry)
- **Electron app ID**: `dev.openpencil.app` → `dev.penboard.app`
- **Electron productName**: `OpenPencil` → `PenBoard`
- **MIME type**: `application/x-openpencil` → `application/x-penboard`
- **localStorage keys**: All 6 prefixed keys `openpencil-*` → `penboard-*`
  - `openpencil-agent-settings` → `penboard-agent-settings`
  - `openpencil-ai-model-preference` → `penboard-ai-model-preference`
  - `openpencil-ai-concurrency` → `penboard-ai-concurrency`
  - `openpencil-ai-ui-preferences` → `penboard-ai-ui-preferences`
  - `openpencil-canvas-preferences` → `penboard-canvas-preferences`
  - `openpencil-theme-presets` → `penboard-theme-presets`
  - `openpencil-uikits` → `penboard-uikits`
  - `openpencil-theme` → `penboard-theme`
- **Hidden directories**: `~/.openpencil/` → `~/.penboard/`, `.openpencil-tmp/` → `.penboard-tmp/`
- **Temp dir prefixes**: All `openpencil-*` temp dirs → `penboard-*`
- **MCP server**: Name `openpencil` → `penboard`, binary `openpencil-mcp` → `penboard-mcp`
- **Theme preset type**: `openpencil-theme-preset` → `penboard-theme-preset`
- **AI prompts**: All "OpenPencil" references in system prompts → "PenBoard"
- **i18n strings**: `landing.open` + `landing.pencil` → updated for PenBoard
- **README files**: Find-replace "OpenPencil" → "PenBoard" in all 15 translated files
- **CI/CD**: Keep workflows and issue templates, update all references
- **Copyright**: Update to "PenBoard contributors"

### File Extension Strategy
- **Support both `.op` and `.pb`** for opening files
- **Default save format: `.pb`** (PenBoard native)
- File dialog filters show: "PenBoard Files (*.pb, *.op)"
- Electron file association registers both extensions

### Git & Repository Strategy
- **Fresh `git init`** after all rebrand changes are complete
- First commit message: `"init: PenBoard v0.1.0 — fork of OpenPencil v0.4.1"`
- GitHub remote: **Not in Phase 1 scope** — create later
- `.cta.json` projectName: `openpencil` → `penboard`

### Claude's Discretion
- Exact ordering of find-replace operations (as long as all 118 references are covered)
- How to handle the landing page redirect (React Router redirect vs removing the route)
- i18n key naming for new tagline strings
- Whether to update `.planning/` docs references (OpenPencil → PenBoard) or leave as historical context

</decisions>

<specifics>
## Specific Ideas

- User previously worked on `D:\Workspace\Messi\Code\OpenBoard` but found OpenPencil as a better foundation — PenBoard is a fresh start built on proven canvas tech
- The app's future direction is storyboard intelligence: screen flow connections, data entities for component data binding, pre-built input controls
- User explicitly views this as a desktop-first app (Electron), not a web service

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Branding references are concentrated** in ~40 files with 118 total references (detailed list from codebase scout available)
- **i18n system** (`src/i18n/locales/`) already supports 13 languages — rebrand requires touching all locale files
- **Constants centralized** in `src/constants/app.ts` and `electron/constants.ts` — good entry points for config changes

### Established Patterns
- **Storage keys defined as constants** at top of each store file — clean find-replace targets
- **Electron config** in `electron-builder.yml` — single file for app ID, product name, file associations, MIME types
- **MCP server name** defined in `server/api/ai/mcp-install.ts` as `MCP_SERVER_NAME` constant

### Integration Points
- **File open/save dialogs** (`electron/main.ts` lines 212, 233) — need `.pb` extension added alongside `.op`
- **Port file location** (`server/plugins/port-file.ts`, `src/constants/app.ts`) — `.openpencil` dir reference
- **Route `/`** (`src/routes/index.tsx`) — needs redirect to `/editor`

</code_context>

<deferred>
## Deferred Ideas

1. **Pre-built input controls** — User wants ready-made UI controls (text inputs, dropdowns, buttons, toggles, etc.) as drag-and-drop components for faster screen design. Candidate for new roadmap phase between Phase 2 and Phase 3, or as part of Phase 5 (Shared Views).
2. **PenBoard custom logo/icon** — Replace OpenPencil's pencil icon with PenBoard-specific design. Can be done anytime.
3. **Landing page for web distribution** — If PenBoard is ever offered as a web app, will need a proper marketing page.

</deferred>

---

*Phase: 01-clone-rebrand-verify*
*Context gathered: 2026-03-16*
