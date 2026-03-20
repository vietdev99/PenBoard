# Design: playwright-exhaustive-testing Skill

**Date**: 2026-03-19
**Type**: Discipline-enforcing (rigid)
**Location**: `~/.claude/skills/playwright-exhaustive-testing/`

## Requirements

- **Trigger**: GSD verify-work/add-tests, BMAD testing phase, user request ("test app", "write e2e tests"), detect `playwright.config.*`
- **Scope**: Full stack - E2E + API + Visual Regression + Accessibility
- **Boundary**: Coverage-driven - automate until threshold reached, remainder → human checklist
- **Output**: 2-phase: Spec first (TEST-SPEC.md) → User approve → Code test → Run → Report
- **Global**: Lives in `~/.claude/skills/`, not project-specific

## Approach: Spec-First Exhaustive

### Phase 1: ANALYZE
- Scan app routes/pages/components
- Detect tech stack (React/Vue/Next/Tauri/etc.)
- Check existing test coverage
- Identify testable surfaces (UI, API, forms, auth, navigation)

### Phase 2: SPEC → TEST-SPEC.md
Coverage Layers:
1. **Critical User Journeys** (E2E) - login, CRUD, navigation flows
2. **API Endpoints** (request/response validation)
3. **Visual Regression** (screenshot comparison)
4. **Accessibility** (axe-core integration)
5. **Edge Cases** (error states, empty states, loading, offline)

Each test case:
- ID, name, description
- Layer assignment
- Priority (P0-P3)
- Automatable? (yes/no + reason if no)
- Steps + expected result

Output includes Human Test Remainder section.

**GATE**: User must approve TEST-SPEC.md before Phase 3.

### Phase 3: CODE
- Generate Playwright test files mapping 1:1 to spec
- Organize: `e2e/`, `api/`, `visual/`, `a11y/`
- Setup fixtures, helpers, page objects as needed

### Phase 4: RUN & REPORT
- Execute all tests
- Coverage report
- Output: TEST-REPORT.md + HUMAN-TEST-CHECKLIST.md

## Iron Law

```
NO TEST CODE WITHOUT APPROVED SPEC FIRST
```

## Coverage Boundary

**Automatable**: UI interactions, form validation, navigation, API calls, accessibility checks, visual snapshots
**Not automatable → human**: UX feel quality, design consistency perception, perceived performance, domain-specific business logic edge cases, physical cross-device testing

## Integration

- GSD: `/gsd:verify-work` and `/gsd:add-tests` load this skill
- BMAD: Testing phase triggers
- Standalone: User says "test app" or `playwright.config.*` detected
