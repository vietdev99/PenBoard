---
status: testing
phase: 08-workflow-visualization
source: [08-01-PLAN.md, 08-02-PLAN.md, 08-CONTEXT.md]
started: 2026-03-20T13:09:19+07:00
updated: 2026-03-20T13:09:19+07:00
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 1
name: Open Workflow Panel
expected: |
  Click the GitBranch icon (⑃) in the top-bar right section (next to Preview ▶ button), or press Cmd+Shift+W.
  A bottom panel appears below the canvas with title "Workflow", a Focus toggle, Fit button, export buttons (Mermaid/SVG/PNG), and a close ✕ button.
  The panel should be resizable by dragging the top edge.
awaiting: user response

## Tests

### 1. Open Workflow Panel
expected: Click GitBranch icon in top-bar or press Cmd+Shift+W. A resizable bottom panel appears with header toolbar (Workflow title, Focus ✓, Fit, Mermaid, SVG, PNG, ✕).
result: [pending]

### 2. Mermaid Diagram Renders (WF-01)
expected: With a .pb file open that has screen pages and connections, the workflow panel shows a Mermaid flowchart diagram. Screen pages appear as blue rectangles, connections show as labeled arrows (e.g. "click → push").
result: [pending]

### 3. Data Entity Nodes in Diagram (WF-01)
expected: If the document has data entities (from ERD), they appear as orange cylinder-shaped nodes. If pages have data bindings, dashed arrows connect pages to their bound entities. Entity relations show as plain lines between entities.
result: [pending]

### 4. Focus Mode — Active Page + Neighbors (WF-02)
expected: With Focus ✓ enabled (default), the diagram shows only the active page and its 1-hop connected neighbors. Switching to a different page auto-updates the diagram to center on the new active page.
result: [pending]

### 5. Full View Mode (WF-02)
expected: Click the "Focus" button to toggle it off (loses the ✓). The diagram expands to show ALL pages and connections in the entire project.
result: [pending]

### 6. Click-to-Navigate
expected: Click a page node (blue rectangle) in the diagram. The canvas navigates to that page (activePageId changes). If Focus mode is on, the diagram re-centers on the clicked page.
result: [pending]

### 7. Zoom & Pan
expected: Scroll wheel in the diagram area zooms in/out. Mouse drag pans across the diagram. Click "Fit" button resets zoom/pan to default.
result: [pending]

### 8. Export — Mermaid to Clipboard
expected: Click "Mermaid" button. The mermaid text is copied to clipboard. Paste in a text editor to verify valid mermaid syntax starting with "graph LR".
result: [pending]

### 9. Auto-Update on Changes (WF-03)
expected: While the workflow panel is open, add or delete a connection/page. The diagram updates automatically within ~500ms reflecting the new structure.
result: [pending]

### 10. Panel Persist & Keyboard Shortcut
expected: Close and reopen the app. The workflow panel state (open/closed) is remembered. Cmd+Shift+W toggles the panel open/closed.
result: [pending]

## Summary

total: 10
passed: 0
issues: 0
pending: 10
skipped: 0

## Gaps

[none yet]
