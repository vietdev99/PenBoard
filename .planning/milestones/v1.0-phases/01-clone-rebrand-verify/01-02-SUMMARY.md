---
phase: 01-clone-rebrand-verify
plan: 02
subsystem: docs
tags: [i18n, readme, branding, documentation, metadata]

# Dependency graph
requires:
  - phase: 01-clone-rebrand-verify/01
    provides: "Config files and code rebranded to PenBoard"
provides:
  - "All 15 i18n locale files rebranded to PenBoard"
  - "All 15 README files rebranded to PenBoard"
  - "GitHub issue templates rebranded to PenBoard"
  - "CLAUDE.md identifies project as PenBoard"
  - "LICENSE updated to PenBoard contributors"
affects: [01-clone-rebrand-verify/03]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - src/i18n/locales/*.ts (15 files)
    - README*.md (15 files)
    - .github/ISSUE_TEMPLATE/bug_report.yml
    - .github/ISSUE_TEMPLATE/feature_request.yml
    - CLAUDE.md
    - LICENSE

key-decisions:
  - "Kept landing.open='Pen' and landing.pencil='Board' structure instead of restructuring to landing.appName for minimal change across 15 files"
  - "Preserved OpenPencil fork origin references in CLAUDE.md intro and architecture sections as historical context"
  - "Updated GitHub repo URLs from ZSeven-W/openpencil to ZSeven-W/penboard in all READMEs"

patterns-established:
  - "PenBoard is the brand name everywhere user-facing; OpenPencil preserved only as historical fork origin"

requirements-completed: []

# Metrics
duration: 5min
completed: 2026-03-16
---

# Phase 01 Plan 02: Rebrand i18n, Documentation & Metadata Summary

**Replaced all OpenPencil branding with PenBoard across 34 files: 15 i18n locales, 15 READMEs, 2 GitHub templates, CLAUDE.md, and LICENSE**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-16T08:11:33Z
- **Completed:** 2026-03-16T08:16:53Z
- **Tasks:** 2
- **Files modified:** 34

## Accomplishments
- All 15 i18n locale files rebranded: landing.open="Pen", landing.pencil="Board", localized taglines for "Storyboard Design Tool", figma.autoLayout references PenBoard
- All 15 README files fully rebranded: titles, headings, image alt text, section headers, GitHub URLs (ZSeven-W/openpencil -> ZSeven-W/penboard), star history, contributor links
- GitHub issue templates updated to reference PenBoard
- CLAUDE.md architecture section updated to identify PenBoard as primary project while preserving fork history
- LICENSE copyright updated to "PenBoard contributors"

## Task Commits

Each task was committed atomically:

1. **Task 1: Rebrand i18n locale files (15 files)** - `b9fe585` (feat)
2. **Task 2: Rebrand documentation, GitHub templates, and project metadata** - `fe1dd8d` (feat)

## Files Created/Modified
- `src/i18n/locales/en.ts` through `zh-tw.ts` (15 files) - Updated landing.open, landing.pencil, landing.tagline, figma.autoLayout
- `README.md` through `README.zh-TW.md` (15 files) - Full OpenPencil->PenBoard and openpencil->penboard replacement
- `.github/ISSUE_TEMPLATE/bug_report.yml` - Version description references PenBoard
- `.github/ISSUE_TEMPLATE/feature_request.yml` - Intro text references PenBoard
- `CLAUDE.md` - Architecture section identifies PenBoard; preserved fork history
- `LICENSE` - Copyright to PenBoard contributors

## Decisions Made
- Kept `landing.open` = "Pen" and `landing.pencil` = "Board" structure (minimal change across 15 files vs restructuring to `landing.appName`)
- Updated localized taglines to natural translations of "Storyboard Design Tool. Design screens, connect flows, model data."
- Preserved OpenPencil references in CLAUDE.md intro (line 5) and architecture section (line 22) as historical context per plan instructions
- Left `.planning/` documents untouched as historical context per plan instructions

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All documentation and i18n strings now reference PenBoard
- Ready for plan 01-03 (build verification) to confirm the rebranded app compiles and runs correctly

## Self-Check: PASSED

- FOUND: 01-02-SUMMARY.md
- FOUND: b9fe585 (Task 1 commit)
- FOUND: fe1dd8d (Task 2 commit)

---
*Phase: 01-clone-rebrand-verify*
*Completed: 2026-03-16*
