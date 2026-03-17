# Requirements: PenBoard

**Defined:** 2026-03-17
**Core Value:** Visual design canvas + storyboard intelligence with data-driven design

## v1.1 Requirements

Requirements for v1.1 Data-Driven Design milestone. Each maps to roadmap phases.

### Data Binding

- [ ] **BIND-01**: User can select a data source (entity from ERD) for supported components (table, dropdown) via modal selector
- [ ] **BIND-02**: Component renders sample rows from bound entity, falls back to placeholder when no data
- [ ] **BIND-03**: User can map specific entity fields to component columns/options via field mapping UI
- [ ] **BIND-04**: Deleting an entity auto-cleans all data binding references on bound components

### Interactive Preview

- [ ] **PREV-01**: User can open interactive HTML preview of a parent frame in a separate browser tab
- [ ] **PREV-02**: Preview supports navigation between screens via connections (click to navigate)
- [ ] **PREV-03**: Preview displays live sample data from bound entities
- [ ] **PREV-04**: Preview runs in null-origin sandbox to prevent XSS/security issues

### Context & AI

- [ ] **CTX-01**: Every element has a context textarea in right sidebar panel
- [ ] **CTX-02**: Element context is injected into AI prompts when generating/reading designs
- [ ] **CTX-03**: Context persists in .pb file (on PenNode), survives copy/paste/duplicate

### Workflow

- [ ] **WF-01**: Panel/tab displays auto-generated mermaid diagram from screen connections and data flows
- [ ] **WF-02**: Focus mode shows only connections of active page to avoid layout explosion
- [ ] **WF-03**: Workflow diagram updates automatically when connections or data bindings change

### MCP

- [ ] **MCP-01**: MCP tools to set/get data bindings on nodes
- [ ] **MCP-02**: MCP tool to trigger preview generation
- [ ] **MCP-03**: MCP tools to read/write element context
- [ ] **MCP-04**: MCP tool to export workflow diagram (mermaid/SVG)
- [ ] **MCP-05**: MCP full support for navigation, context, ERD, and component pages

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Collaboration

- **COLLAB-01**: Multiple users can edit simultaneously
- **COLLAB-02**: Real-time cursor presence indicators

### Component States

- **STATE-01**: Components support variant states (hover, active, disabled)
- **STATE-02**: State transitions can be previewed

### Responsive

- **RESP-01**: Responsive breakpoints for different screen sizes
- **RESP-02**: Components adapt layout per breakpoint

## Out of Scope

| Feature | Reason |
|---------|--------|
| Live database connection | Breaks local-first model, high complexity |
| Two-way data binding | Over-engineering for design tool, v2+ candidate |
| Editable workflow canvas | Workflow is derived view, not a design surface |
| Animation transitions | Separate feature, deferred to v2 |
| Custom PenBoard logo | Cosmetic, not functional priority |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| BIND-01 | — | Pending |
| BIND-02 | — | Pending |
| BIND-03 | — | Pending |
| BIND-04 | — | Pending |
| PREV-01 | — | Pending |
| PREV-02 | — | Pending |
| PREV-03 | — | Pending |
| PREV-04 | — | Pending |
| CTX-01 | — | Pending |
| CTX-02 | — | Pending |
| CTX-03 | — | Pending |
| WF-01 | — | Pending |
| WF-02 | — | Pending |
| WF-03 | — | Pending |
| MCP-01 | — | Pending |
| MCP-02 | — | Pending |
| MCP-03 | — | Pending |
| MCP-04 | — | Pending |
| MCP-05 | — | Pending |

**Coverage:**
- v1.1 requirements: 19 total
- Mapped to phases: 0
- Unmapped: 19 (pending roadmap creation)

---
*Requirements defined: 2026-03-17*
*Last updated: 2026-03-17 after initial definition*
