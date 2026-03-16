---
phase: 03-shared-components-design-tokens
phase_name: "Shared Components & Design Tokens"
created: "2026-03-16"
status: context_complete
---

# Phase 3: Shared Components & Design Tokens — Context

**Phase Goal:** Reusable components with rich arguments (props) and expanded design token management.

**Depends on:** Phase 1 (rebrand), Phase 2 (connections, data entities) — both complete

<domain>
## Phase Boundary

This phase delivers:
1. Component argument system — define args on reusable frames, set values on instances, drag-connect binding
2. Component organization — dedicated component page type, subtle source indicators
3. Instance UX — double-click navigate to source, highlight mode for connection flows
4. Design token expansion — grouped variables panel, variable picker on more property fields

**Already working (from OpenPencil + Phase 2):**
- `reusable: true` frames = component definitions
- RefNode instances auto-update when source changes (SHARED-04 baseline)
- Variables system with $refs, themed values, and variables panel
- Token resolution at render time (TOKEN-04 done)
- Token change propagation (TOKEN-05 done)
- UIKit browser for importing components
- Connection system with Page > Frame targeting

</domain>

<decisions>
## Implementation Decisions

### A. Component Arguments

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Argument binding model | **Preset behaviors** | Arguments change preset behaviors: show/hide elements, change text, switch variant appearance. More intuitive than raw property binding |
| Argument types | **All 5 types** | text (change content), number (change values), boolean (show/hide), select (switch presets), color (change colors) |
| Define arguments UX | **Property panel section** | Select reusable frame → property panel shows "Component Arguments" section to add/edit/remove args. Like Figma |
| Set argument values UX | **Property panel section** | Select instance → property panel shows "Arguments" section with type-specific inputs (text field, number input, color picker, toggle, select dropdown) |
| Bind argument to element UX | **Drag-connect** | From argument definition, drag a wire to element on canvas. Visual like node editor. Creator drags from arg → to element property |

**Type definitions needed:**
```typescript
interface ComponentArgument {
  id: string
  name: string
  type: 'text' | 'number' | 'boolean' | 'select' | 'color'
  defaultValue: string | number | boolean
  options?: string[]  // For select type
}

// On FrameNode (reusable):
arguments?: ComponentArgument[]
argumentBindings?: Record<string, ArgumentBinding[]>  // argId → bindings

interface ArgumentBinding {
  targetNodeId: string     // Which child node
  targetProperty: string   // Which property (content, fill, visible, etc.)
}

// On RefNode (instance):
argumentValues?: Record<string, any>  // argId → value
```

### B. Component Organization

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Component location | **Any page + dedicated component page type** | Components can live on any page. Also supports `type='component'` pages for organized libraries |
| Component page in tabs | **Shared with screen tabs** | Component pages appear in regular page tabs with different icon (like ERD pages have their own icon) |
| Component source indicator | **Small faded badge** | Subtle badge at corner, faded/low-opacity. No borders or visual changes that alter the design appearance |
| Instance visual | **No visual difference** | Instance looks identical to rendered content. Only recognizable when selected (property panel shows instance controls) |

### C. Instance UX & Connection Visualization

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Double-click instance | **Navigate to source** | Double-click → switch to page containing component source, scroll to it, select it (SHARED-05) |
| Connection arrows | **Highlight mode** | Toggle mode that shows connection flow arrows on canvas |
| Highlight mode activation | **Toolbar button + keyboard shortcut** | Both options for accessibility |
| Highlight mode behavior | **Focus + dim** | Select element → show flow arrows (incoming and outgoing connections). Unrelated frames/views dim/fade out. Only the connected flow is highlighted |
| Navigate picker redesign | **Tab-based instead of dropdown** | Current dropdown can't display many pages/frames. Replace with tab/list picker for better scalability |
| Navigate button on instances | **Show modal navigate** | Each bound component/element has a button to quickly open navigate modal |

### D. Token Coverage & Organization

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Variables panel organization | **Group by type** | Auto-group into collapsible sections: Colors, Spacing, Typography, Other. Based on VariableDefinition.type |
| Spacing token type | **Use existing number type** | No new type needed. Naming convention: $spacing-sm, $spacing-md, etc. Keeps system simple |
| Variable picker expansion | **Add to size + text fields** | Add VariablePicker to: width, height, font-size, font-family, line-height, letter-spacing, corner-radius |
| Variable picker existing | **Keep current** | Already on: fill color, stroke color, layout gap/padding, opacity |

### Claude's Discretion

- Exact argument resolution pipeline (how to walk tree and apply bindings)
- Drag-connect wire rendering implementation (canvas overlay vs separate layer)
- Highlight mode keyboard shortcut key (suggest H or Ctrl+Shift+H)
- How to auto-detect variable type grouping (by VariableDefinition.type field)
- Navigate tab/list picker exact layout and UX
- Component page icon choice in page tabs

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Component System
- `src/types/pen.ts` — PenNode types: FrameNode.reusable, RefNode.ref, RefNode.descendants
- `src/stores/document-store.ts` — makeReusable(), detachComponent() actions
- `src/canvas/skia/skia-engine.ts` — resolveRefs(), remapIds() for ref expansion
- `src/uikit/kit-utils.ts` — extractComponentsFromDocument(), findReusableNode(), deepCloneNode()
- `src/components/panels/component-browser-panel.tsx` — Existing component browser UI

### Variables/Tokens System
- `src/types/variables.ts` — VariableDefinition, ThemedValue types
- `src/variables/resolve-variables.ts` — resolveVariableRef(), resolveNodeForCanvas()
- `src/variables/replace-refs.ts` — replaceVariableRefsInTree()
- `src/components/panels/variables-panel.tsx` — Variables management panel (820 lines)
- `src/components/panels/variable-row.tsx` — Individual variable editing
- `src/components/shared/variable-picker.tsx` — Variable picker component for property fields

### Connection System (for highlight mode)
- `src/stores/document-store-connections.ts` — Connection CRUD
- `src/components/panels/connection-section.tsx` — Connection section UI (navigate picker)
- `src/canvas/skia/skia-overlays.ts` — drawConnectionBadge()
- `src/canvas/skia/skia-engine.ts` — connInfoMap rendering

### Canvas & Store Patterns
- `src/stores/document-store-pages.ts` — Page CRUD pattern (for component page type)
- `src/canvas/skia/skia-canvas.tsx` — Event handling, double-click behavior
- `src/components/editor/page-tabs.tsx` — Page tabs with type-specific icons
- `src/components/panels/property-panel.tsx` — Property panel sections

### Requirements
- `.planning/REQUIREMENTS.md` — SHARED-01..08, TOKEN-01..05

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Component system (ref/reusable)**: Full ref expansion pipeline exists — resolveRefs() in skia-engine.ts, makeReusable/detachComponent in document-store
- **Variables panel**: 820-line floating panel with theme tabs, search, CRUD — extend for grouping
- **Variable picker**: VariablePicker component works with color/number/string — add to more fields
- **Connection badge overlay**: drawConnectionBadge() pattern in skia-overlays.ts — reuse for component badges
- **Page type system**: PenPage.type ('screen' | 'erd') — extend with 'component'
- **UIKit system**: Component browser, kit import/export — basis for component library

### Established Patterns
- **Store extraction**: document-store-connections.ts, document-store-pages.ts, document-store-data.ts — follow same pattern for component argument actions
- **Floating panel**: variables-panel.tsx — absolute positioned, resizable, backdrop-blur
- **Canvas overlay**: Dirty-flag rendering, overlay drawn after all nodes
- **Property panel sections**: fill-section, stroke-section, layout-section — template for arguments section
- **Virtual IDs**: `${refId}__${child.id}` — instances have remapped IDs for isolation

### Integration Points
- **PenNode types** (pen.ts): Add arguments/argumentBindings to FrameNode, argumentValues to RefNode
- **skia-engine.ts**: Extend resolveRefs() to apply argument values before rendering
- **skia-canvas.tsx**: Add double-click handler for navigate-to-source on RefNodes
- **skia-overlays.ts**: Add highlight mode rendering (arrows + dim overlay)
- **property-panel.tsx**: Add arguments section for both reusable frames and ref instances
- **page-tabs.tsx**: Add 'component' page type icon and "Add component page" option
- **connection-section.tsx**: Redesign navigate picker from dropdown to tab/list

### Constraints
- **Virtual IDs in instances**: `${refId}__${child.id}` — cannot reference instance internals directly from outside
- **No nested ref resolution**: Circular ref guard limits to depth 1
- **Variables panel size**: 820 lines — may need splitting when adding grouping

</code_context>

<specifics>
## Specific Ideas

- **Navigate picker redesign**: User wants tab-based picker instead of dropdown (dropdown can't show many pages/frames). Each bound element gets a button to show navigate modal
- **Highlight mode**: Select element with connections → show flow arrows (where it comes from, where it goes) → unrelated frames dimmed/faded. Toggle via toolbar button + keyboard shortcut
- **Component source badge**: Must be subtle/faded — user explicitly said "just needs to exist, shouldn't change the overall view appearance"
- **Instance indistinguishable**: Instances should look exactly like their rendered content — differentiation only via property panel when selected
- **Drag-connect for argument binding**: Creator drags wire from argument definition to element on canvas — visual node-editor style

</specifics>

<deferred>
## Deferred Ideas

1. **Data-driven design** — Auto-populate UI components with sample data from entities (from Phase 2 deferred)
2. **Component variants/states** — Hover, active, disabled states per component (ADV-01 in v2)
3. **Pre-built input controls** — Ready-made text inputs, dropdowns, buttons as drag-and-drop components (from Phase 1 deferred)
4. **PenBoard custom logo** — Replace OpenPencil icon (from Phase 1 deferred)
5. **Token export** — CSS variables export, design system JSON (potential future phase)
6. **Formula fields** — Computed data entity fields (from Phase 2 deferred)

</deferred>

---

*Phase: 03-shared-components-design-tokens*
*Context gathered: 2026-03-16*
