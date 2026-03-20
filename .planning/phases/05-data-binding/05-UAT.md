---
status: testing
phase: 05-data-binding
source:
  - 05-01-SUMMARY.md
  - 05-02-SUMMARY.md
  - 05-03-SUMMARY.md
started: "2026-03-18T02:25:00.000Z"
updated: "2026-03-18T02:25:00.000Z"
---

## Current Test

number: 1
name: Data Binding section visible on Table
expected: |
  1. Insert a NEW Table from UIKit (the old one won't have role='table')
  2. Select the Table in layer panel
  3. Scroll down in the right property panel
  4. A "Data Binding" section should appear with a "Bind to data entity..." button
awaiting: user response

## Tests

### 1. Data Binding section visible on Table
expected: Select a Table (with role='table') in the layer panel. A "Data Binding" section should appear in the property panel with "Bind to data entity..." button (or "No entities available" if no ERD entities exist).
result: [pending]

### 2. Create entity in ERD and bind to Table
expected: Go to ERD page, create an entity (e.g. "Users" with fields Name, Status, Amount). Go back to Page 1, select the Table, click "Bind to data entity...". A dialog shows the "Users" entity. Click it to bind. The Data Binding section now shows entity name, field count, and field mapping dropdowns.
result: [pending]

### 3. Field mapping auto-populated on bind
expected: After binding, the "Field mappings" area should show each entity field with a dropdown. Fields should be auto-mapped by matching names (e.g. "Name" field -> "Name" slot).
result: [pending]

### 4. Canvas renders entity row data
expected: After binding, the Table's text cells on canvas should update to show the entity's sample row data (from the ERD rows you created).
result: [pending]

### 5. Context menu "Bind to data..." on Table
expected: Right-click the Table in the layer panel. A "Bind to data..." menu item should appear. Clicking it opens the entity selector dialog.
result: [pending]

### 6. Unbind via property panel
expected: With a bound Table selected, click "Remove binding" button in the Data Binding section. The binding is removed, entity info disappears, and the "Bind to data entity..." button reappears.
result: [pending]

### 7. Context menu "Remove binding" on bound Table
expected: Right-click a bound Table. "Remove binding" menu item appears. Clicking it removes the binding.
result: [pending]

### 8. Stale binding warning
expected: Bind a Table to an entity, then delete that entity from the ERD. Select the Table again. A warning "Entity not found - binding is stale" should appear in the Data Binding section.
result: [pending]

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0

## Gaps

[none yet]
