# Requirements: PenBoard

**Defined:** 2026-03-17
**Core Value:** Visual design canvas + storyboard intelligence with data-driven design

## v1.1 Requirements

Requirements for v1.1 Data-Driven Design milestone. Each maps to roadmap phases.

### Data Binding

- [x] **BIND-01**: User can select a data source (entity from ERD) for supported components (table, dropdown) via modal selector
- [x] **BIND-02**: Component renders sample rows from bound entity, falls back to placeholder when no data
- [x] **BIND-03**: User can map specific entity fields to component columns/options via field mapping UI
- [x] **BIND-04**: Deleting an entity auto-cleans all data binding references on bound components

### Interactive Preview

- [x] **PREV-01**: User can open interactive HTML preview of a parent frame in a separate browser tab
- [x] **PREV-02**: Preview supports navigation between screens via connections (click to navigate)
- [ ] **PREV-03**: Preview displays live sample data from bound entities
- [x] **PREV-04**: Preview runs in null-origin sandbox to prevent XSS/security issues

### Context & AI

- [x] **CTX-01**: Every element has a context textarea in right sidebar panel
- [ ] **CTX-02**: Element context is injected into AI prompts when generating/reading designs
- [x] **CTX-03**: Context persists in .pb file (on PenNode), survives copy/paste/duplicate

### Workflow

- [ ] **WF-01**: Panel/tab displays auto-generated mermaid diagram from screen connections and data flows
- [ ] **WF-02**: Focus mode shows only connections of active page to avoid layout explosion
- [ ] **WF-03**: Workflow diagram updates automatically when connections or data bindings change

### MCP

- [x] **MCP-01**: MCP tools to set/get data bindings on nodes
- [x] **MCP-02**: MCP tool to trigger preview generation
- [x] **MCP-03**: MCP tools to read/write element context
- [x] **MCP-04**: MCP tool to export workflow diagram (mermaid/SVG)
- [x] **MCP-05**: MCP full support for navigation, context, ERD, and component pages

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
| BIND-01 | Phase 5 | Complete |
| BIND-02 | Phase 5 | Complete |
| BIND-03 | Phase 5 | Complete |
| BIND-04 | Phase 5 | Complete |
| PREV-01 | Phase 7 | Complete |
| PREV-02 | Phase 7 | Complete |
| PREV-03 | Phase 7 | Pending |
| PREV-04 | Phase 7 | Complete |
| CTX-01 | Phase 6 | Complete |
| CTX-02 | Phase 6 | Pending |
| CTX-03 | Phase 6 | Complete |
| WF-01 | Phase 8 | Pending |
| WF-02 | Phase 8 | Pending |
| WF-03 | Phase 8 | Pending |
| MCP-01 | Phase 9 | Complete |
| MCP-02 | Phase 9 | Complete |
| MCP-03 | Phase 9 | Complete |
| MCP-04 | Phase 9 | Complete |
| MCP-05 | Phase 9 | Complete |

**Coverage:**

- v1.1 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0

---

*Requirements defined: 2026-03-17*
*Last updated: 2026-03-17 after roadmap creation -- all 19 requirements mapped to phases 5-9*
