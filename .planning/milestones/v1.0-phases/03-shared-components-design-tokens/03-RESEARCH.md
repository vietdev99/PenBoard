# Phase 3: Shared Components & Design Tokens - Research

**Researched:** 2026-03-16
**Domain:** Component argument system, instance UX, connection visualization, design token expansion
**Confidence:** HIGH

## Summary

Phase 3 builds on a strong existing foundation. The PenBoard codebase already has a working component system (`reusable: true` frames, `RefNode` instances with `descendants` overrides, `resolveRefs()` + `remapIds()` pipeline), a variables/tokens system (`$variable` references, themed values, VariablePicker), a connection system with canvas badges, and a page type system (screen, erd). The main work areas are:

1. **Component Arguments** -- Adding a rich argument system (text, number, boolean, select, color) with drag-connect binding, argument definitions on reusable frames, and argument value setting on RefNode instances. This requires extending PenNode types, creating a new argument resolution pipeline in the rendering engine, and building UI for defining/binding/setting arguments.

2. **Component Organization & Instance UX** -- Adding a `'component'` page type, double-click-to-navigate on instances, connection highlight mode with focus+dim, and navigate picker redesign from dropdown to tab/list modal.

3. **Token Expansion** -- Grouping the variables panel by type, expanding VariablePicker to size/text fields (width, height, fontSize, fontFamily, lineHeight, letterSpacing, cornerRadius).

**Primary recommendation:** Implement in 4-5 plans: (1) types + component page + badge, (2) argument definitions + bindings on source, (3) argument values on instances + render pipeline, (4) token expansion + variable picker additions, (5) highlight mode + navigate picker redesign.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
**Component Arguments:**
- Argument binding model: **Preset behaviors** -- Arguments change preset behaviors: show/hide elements, change text, switch variant appearance
- Argument types: **All 5 types** -- text, number, boolean, select, color
- Define arguments UX: **Property panel section** -- Select reusable frame -> property panel shows "Component Arguments" section
- Set argument values UX: **Property panel section** -- Select instance -> property panel shows "Arguments" section
- Bind argument to element UX: **Drag-connect** -- From argument definition, drag a wire to element on canvas

**Component Organization:**
- Component location: **Any page + dedicated component page type** (type='component')
- Component page in tabs: **Shared with screen tabs** (different icon, like ERD)
- Component source indicator: **Small faded badge** at corner, low-opacity
- Instance visual: **No visual difference** -- Only recognizable when selected

**Instance UX & Connection Visualization:**
- Double-click instance: **Navigate to source** -- Switch to page containing component source
- Connection arrows: **Highlight mode** (toggle)
- Highlight mode activation: **Toolbar button + keyboard shortcut**
- Highlight mode behavior: **Focus + dim** -- Show flow arrows, dim unrelated
- Navigate picker redesign: **Tab-based instead of dropdown**
- Navigate button on instances: **Show modal navigate**

**Token Coverage & Organization:**
- Variables panel organization: **Group by type** (Colors, Spacing, Typography, Other)
- Spacing token type: **Use existing number type** (naming convention only)
- Variable picker expansion: **Add to size + text fields** (width, height, font-size, font-family, line-height, letter-spacing, corner-radius)
- Variable picker existing: **Keep current** (fill, stroke, gap/padding, opacity)

### Claude's Discretion
- Exact argument resolution pipeline (how to walk tree and apply bindings)
- Drag-connect wire rendering implementation (canvas overlay vs separate layer)
- Highlight mode keyboard shortcut key (suggest H or Ctrl+Shift+H)
- How to auto-detect variable type grouping (by VariableDefinition.type field)
- Navigate tab/list picker exact layout and UX
- Component page icon choice in page tabs

### Deferred Ideas (OUT OF SCOPE)
1. Data-driven design -- Auto-populate UI components with sample data from entities
2. Component variants/states -- Hover, active, disabled states (ADV-01 in v2)
3. Pre-built input controls -- Ready-made text inputs, dropdowns, buttons
4. PenBoard custom logo -- Replace OpenPencil icon
5. Token export -- CSS variables export, design system JSON
6. Formula fields -- Computed data entity fields
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SHARED-01 | User can create shared components on dedicated pages | Component page type ('component' in PenPage.type), addPage('component') action |
| SHARED-02 | User can include shared component instances in any screen | Already working via makeReusable() + duplicateNode() creating RefNode instances |
| SHARED-03 | Shared component instances render with visual distinction | Faded badge at corner (reuse drawConnectionBadge pattern from skia-overlays.ts) |
| SHARED-04 | Editing shared component source propagates to all instances | Already working via resolveRefs() in skia-engine.ts -- RefNodes expand from source |
| SHARED-05 | User can double-click instance to navigate to source | Extend onDblClick in skia-canvas.tsx to detect RefNode hit and navigate to source page |
| SHARED-06 | Shared components support arguments with rich types | New ComponentArgument type on FrameNode, argument definition UI in property panel |
| SHARED-07 | When including a component, user can set argument values | argumentValues on RefNode, argument value UI section in property panel |
| SHARED-08 | Component renders differently based on argument values | Argument resolution pipeline in resolveRefs() that applies bindings before rendering |
| TOKEN-01 | User can create named color tokens | Already working via variables panel setVariable() with type: 'color' |
| TOKEN-02 | User can create spacing and typography tokens | Already working via type: 'number' and type: 'string' -- needs grouping UI |
| TOKEN-03 | Properties panel shows token picker for color/spacing fields | Partially done. VariablePicker exists on color/stroke/gap/padding/opacity. Needs expansion to size + text fields |
| TOKEN-04 | Token references resolve to values at render time | Already working via resolveNodeForCanvas() in resolve-variables.ts |
| TOKEN-05 | Changing a token updates all shapes referencing it | Already working via $ref system + dirty-flag re-render |
</phase_requirements>

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19 | UI framework | Project standard |
| Zustand | v5 | State management | Document-store pattern established |
| CanvasKit/Skia | WASM | Canvas rendering | GPU-accelerated, project standard |
| TypeScript | strict | Type safety | Project standard |
| Tailwind CSS | v4 | Styling | Project standard, shadcn/ui tokens |
| shadcn/ui | latest | UI primitives | Project standard (Button, Select, etc.) |
| lucide-react | latest | Icons | Project standard |
| nanoid | latest | ID generation | Used throughout stores |

### Supporting (No New Dependencies Required)
This phase requires **zero new dependencies**. All features are implemented using existing project infrastructure:
- Canvas overlays: CanvasKit draw calls (existing pattern)
- UI panels: React + shadcn/ui (existing pattern)
- State management: Zustand extracted store pattern (existing pattern)
- Type system: TypeScript interfaces in src/types/ (existing pattern)

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Canvas-drawn wire overlay | HTML/SVG overlay div | Canvas overlay is consistent with existing badge/guide rendering. HTML overlay would need coordinate sync |
| Grouped variables panel | Separate panels per type | Single panel with collapsible sections matches user decision and keeps existing panel structure |

## Architecture Patterns

### Recommended Project Structure (New/Modified Files)
```
src/
  types/
    pen.ts                          # MODIFY: Add arguments/bindings to FrameNode, argumentValues to RefNode, 'component' page type
  stores/
    document-store-components.ts    # NEW: createComponentActions() -- argument CRUD, binding management
    document-store.ts               # MODIFY: Integrate component actions
    canvas-store.ts                 # MODIFY: Add highlightMode, componentBrowserOpen states
  canvas/skia/
    skia-engine.ts                  # MODIFY: Extend resolveRefs() for argument resolution
    skia-canvas.tsx                 # MODIFY: Double-click RefNode navigation, drag-connect wire interaction
    skia-overlays.ts                # MODIFY: Add component badge, highlight mode arrows/dim, wire overlay
  components/panels/
    argument-section.tsx            # NEW: Define arguments on reusable frame
    argument-values-section.tsx     # NEW: Set argument values on instance
    property-panel.tsx              # MODIFY: Add argument sections conditionally
    variables-panel.tsx             # MODIFY: Add type grouping (collapsible sections)
    connection-section.tsx          # MODIFY: Redesign navigate picker to tab/list modal
    navigate-modal.tsx              # NEW: Tab/list navigate picker modal
    size-section.tsx                # MODIFY: Add VariablePicker to width/height/cornerRadius
    text-section.tsx                # MODIFY: Add VariablePicker to fontSize/fontFamily/lineHeight/letterSpacing
    corner-radius-section.tsx       # MODIFY: Add VariablePicker
  components/editor/
    page-tabs.tsx                   # MODIFY: Add 'component' page type with icon
    toolbar.tsx                     # MODIFY: Add highlight mode toggle button
  variables/
    resolve-variables.ts            # MODIFY: Add resolveNumericRef for new fields (width/height/fontSize etc.)
  hooks/
    use-keyboard-shortcuts.ts       # MODIFY: Add highlight mode shortcut
```

### Pattern 1: Extracted Store Actions (Established Pattern)
**What:** Phase-specific store actions are extracted to a separate file and composed via spread into the main document store.
**When to use:** All new CRUD operations for component arguments.
**Example:**
```typescript
// src/stores/document-store-components.ts
// Source: Existing pattern in document-store-connections.ts, document-store-data.ts

import { nanoid } from 'nanoid'
import type { PenDocument, PenNode } from '@/types/pen'
import { useHistoryStore } from '@/stores/history-store'
import { findNodeInTree, updateNodeInTree, getActivePageChildren, setActivePageChildren, getAllChildren } from './document-tree-utils'
import { useCanvasStore } from '@/stores/canvas-store'

interface ComponentActions {
  addArgument: (nodeId: string, arg: Omit<ComponentArgument, 'id'>) => string | null
  removeArgument: (nodeId: string, argId: string) => void
  updateArgument: (nodeId: string, argId: string, updates: Partial<ComponentArgument>) => void
  addArgumentBinding: (nodeId: string, argId: string, binding: ArgumentBinding) => void
  removeArgumentBinding: (nodeId: string, argId: string, targetNodeId: string, targetProperty: string) => void
  setArgumentValue: (instanceId: string, argId: string, value: any) => void
}

export function createComponentActions(
  set: (partial: Partial<{ document: PenDocument; isDirty: boolean }>) => void,
  get: () => { document: PenDocument },
): ComponentActions {
  // Follow exact same pattern as createConnectionActions
  return { /* ... */ }
}
```

### Pattern 2: Ref Resolution with Argument Application
**What:** Extend the existing `resolveRefs()` function to apply argument values from RefNode.argumentValues to the resolved component tree before rendering.
**When to use:** During canvas sync (syncFromDocument) in skia-engine.ts.
**Example:**
```typescript
// In skia-engine.ts resolveRefs() -- after line 180 where remapIds is called
// Apply argument values BEFORE the resolved node is returned

function applyArgumentValues(
  resolvedChildren: PenNode[],
  refNode: RefNode,
  componentNode: PenNode,
): PenNode[] {
  const args = (componentNode as any).arguments as ComponentArgument[] | undefined
  const bindings = (componentNode as any).argumentBindings as Record<string, ArgumentBinding[]> | undefined
  const values = refNode.argumentValues

  if (!args || !bindings || !values) return resolvedChildren

  // For each argument with a value set on the instance:
  for (const arg of args) {
    const value = values[arg.id]
    if (value === undefined) continue
    const argBindings = bindings[arg.id]
    if (!argBindings) continue

    for (const binding of argBindings) {
      // Apply value to target node's target property
      resolvedChildren = applyBindingToTree(resolvedChildren, binding, value, arg.type)
    }
  }
  return resolvedChildren
}
```

### Pattern 3: Canvas Overlay for Badges/Indicators
**What:** Draw overlays (badges, wires, arrows) in the SkiaEngine render loop after all nodes are rendered.
**When to use:** Component source badge, highlight mode arrows, drag-connect wire.
**Example:**
```typescript
// Source: Existing pattern in skia-engine.ts render() method around line 685
// Connection badge is drawn after all renderNodes -- same pattern for component badge

// In render(), after drawing frame labels:
for (const rn of this.renderNodes) {
  if (this.reusableIds.has(rn.node.id)) {
    this.renderer.drawComponentBadge(
      canvas, rn.absX, rn.absY, rn.absW, rn.absH, this.zoom,
    )
  }
}
```

### Pattern 4: Property Panel Section (Established Pattern)
**What:** Self-contained panel sections that receive node + onUpdate handler.
**When to use:** Argument definition section, argument values section.
**Example:**
```typescript
// Source: Existing pattern in fill-section.tsx, layout-section.tsx

interface ArgumentSectionProps {
  node: PenNode  // The reusable frame
  onUpdate: (updates: Partial<PenNode>) => void
}

export default function ArgumentSection({ node, onUpdate }: ArgumentSectionProps) {
  // Read arguments from node
  // Render list of arguments with type-specific editors
  // Add/remove/edit via onUpdate
}
```

### Anti-Patterns to Avoid
- **Modifying RefNode children directly:** RefNode.children should NOT be populated with expanded content. The `resolveRefs()` pipeline does expansion at render time. Arguments must work through the existing `descendants` override mechanism or a new `argumentValues` field.
- **Breaking the virtual ID system:** Instance children have IDs like `${refId}__${child.id}`. Argument bindings must reference ORIGINAL child IDs (not virtual IDs), so bindings remain valid across all instances of the same component.
- **Circular argument resolution:** If an argument value is itself a variable reference, resolve it once only. Add a guard similar to the existing circular ref guard in resolveVariableRef.
- **Mutating the component tree during rendering:** Argument application must create new node objects (spread copies), never mutate the source component's children in place.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ID generation | Custom UUID | `nanoid()` | Already used throughout project |
| Color picker | Custom color picker | Existing `ColorPicker` component in shared/ | Consistent UX |
| Variable binding UI | New variable picker | Extend existing `VariablePicker` component | Already handles bind/unbind lifecycle |
| Modal/popover | Custom modal | shadcn/ui Dialog/Popover | Project standard, consistent styling |
| Node tree traversal | New tree walker | `findNodeInTree`, `updateNodeInTree` from document-tree-utils | Battle-tested, handles all node types |
| History integration | Manual state tracking | `useHistoryStore.getState().pushState()` | Established pattern, undo/redo built-in |

**Key insight:** This phase is primarily about extending well-established patterns (new store actions, new panel sections, new overlay draws) rather than introducing new infrastructure. Every feature has an existing analog to follow.

## Common Pitfalls

### Pitfall 1: Virtual ID Confusion in Argument Bindings
**What goes wrong:** Argument bindings store `targetNodeId` referencing an original child ID (e.g., `"text-abc123"`), but the rendered instance has virtual IDs (e.g., `"ref-xyz__text-abc123"`). If code tries to look up bindings using virtual IDs, it won't find them.
**Why it happens:** The `remapIds()` function in skia-engine.ts transforms all child IDs for instance isolation.
**How to avoid:** Always store and look up bindings using ORIGINAL component child IDs. Apply argument values BEFORE or DURING remapIds, not after.
**Warning signs:** Argument values "don't apply" on instances but work when editing the source component directly.

### Pitfall 2: Argument Resolution Order vs Variable Resolution
**What goes wrong:** Arguments might set a fill color to a specific value, but then variable resolution overwrites it because it runs after argument resolution.
**Why it happens:** The rendering pipeline is: resolveRefs (expand RefNodes) -> resolveNodeForCanvas (resolve $variables) -> flatten to RenderNodes.
**How to avoid:** Argument application should happen INSIDE resolveRefs, as part of the ref expansion step. This way, if an argument sets a property to a $variable ref, variable resolution will then correctly resolve that ref. The pipeline order should be: expand component -> apply argument values -> (later) resolve $variables.
**Warning signs:** Color arguments work but spacing arguments using $variable values don't resolve.

### Pitfall 3: Variables Panel Growing Beyond 800 Lines
**What goes wrong:** The variables-panel.tsx is already 820 lines. Adding type grouping with collapsible sections could push it well over the limit.
**Why it happens:** The panel has extensive theme/variant management, resize handling, and preset logic.
**How to avoid:** Extract grouping logic into a `variable-group.tsx` component. Each group (Colors, Spacing, Typography, Other) is a self-contained collapsible section. The panel itself just maps groups.
**Warning signs:** Panel file exceeds 800 lines during implementation.

### Pitfall 4: Double-Click Navigate Conflicting with Enter-Frame
**What goes wrong:** Double-clicking a RefNode should navigate to its source component, but the existing double-click handler enters frames/groups and selects children.
**Why it happens:** The onDblClick handler in skia-canvas.tsx already has logic for entering frames and editing text.
**How to avoid:** Add a RefNode check BEFORE the frame-enter logic. If the clicked node is a RefNode (check via `instanceIds` set or by looking up the node in the document store), navigate to the source page instead of entering the frame.
**Warning signs:** Double-clicking an instance enters its expanded content instead of navigating to source.

### Pitfall 5: Drag-Connect Wire Rendering During Zoom/Pan
**What goes wrong:** The drag-connect wire (from argument definition to canvas element) uses screen coordinates, but the canvas viewport transforms (zoom/pan) change the mapping.
**Why it happens:** The wire starts from a DOM element (property panel) and ends on a canvas element (scene coordinates).
**How to avoid:** Convert the target canvas element position to screen coordinates using `sceneToScreen()` from skia-viewport.ts. The wire should be rendered as an HTML/SVG overlay on top of the canvas (not drawn in the canvas itself), since it bridges DOM and canvas spaces.
**Warning signs:** Wire endpoint doesn't track the canvas element during zoom/pan.

### Pitfall 6: Component Page Children Visible Across All Pages
**What goes wrong:** Components defined on a 'component' page still appear in other pages' component browser, but the resolveRefs pipeline only searches `allNodes` (all pages' children). If a component is on a component page that gets deleted, instances break.
**Why it happens:** `getAllChildren()` aggregates all page children for cross-page ref resolution.
**How to avoid:** This actually works correctly by design -- `getAllChildren()` already searches all pages. But cascade deletion must also clean up RefNodes referencing deleted components. Add cascade logic in `removePage` for component pages: find all RefNodes across all pages that reference nodes on the deleted page, and either remove or detach them.
**Warning signs:** Deleting a component page leaves orphaned RefNodes that render as empty space.

## Code Examples

### Example 1: Type Extensions for Component Arguments
```typescript
// src/types/pen.ts -- additions to existing types

export interface ComponentArgument {
  id: string
  name: string
  type: 'text' | 'number' | 'boolean' | 'select' | 'color'
  defaultValue: string | number | boolean
  options?: string[]  // For select type only
}

export interface ArgumentBinding {
  targetNodeId: string     // Original child node ID (NOT virtual ID)
  targetProperty: string   // 'content' | 'fill.0.color' | 'visible' | 'opacity' | 'width' | etc.
}

// Extend FrameNode:
export interface FrameNode extends PenNodeBase, ContainerProps {
  type: 'frame'
  reusable?: boolean
  slot?: string[]
  arguments?: ComponentArgument[]
  argumentBindings?: Record<string, ArgumentBinding[]>  // argId -> bindings
}

// Extend RefNode:
export interface RefNode extends PenNodeBase {
  type: 'ref'
  ref: string
  descendants?: Record<string, Partial<PenNode>>
  children?: PenNode[]
  argumentValues?: Record<string, string | number | boolean>  // argId -> value
}

// Extend PenPage:
export interface PenPage {
  id: string
  name: string
  type?: 'screen' | 'erd' | 'component'
  children: PenNode[]
}
```

### Example 2: Argument Resolution in Rendering Pipeline
```typescript
// In skia-engine.ts, modification to resolveRefs() function
// After line 180 (remapIds call), before returning resolvedNode:

function applyBindingToNode(
  node: PenNode,
  targetNodeId: string,
  targetProperty: string,
  value: string | number | boolean,
): PenNode {
  // Check if this is the target node (comparing original IDs)
  const originalId = node.id.includes('__') ? node.id.split('__').pop()! : node.id
  if (originalId === targetNodeId || node.id === targetNodeId) {
    const updated = { ...node } as Record<string, unknown>
    // Handle dot-path properties (e.g., 'fill.0.color')
    if (targetProperty === 'content' && node.type === 'text') {
      updated.content = String(value)
    } else if (targetProperty === 'visible') {
      updated.visible = Boolean(value)
    } else if (targetProperty === 'opacity') {
      updated.opacity = Number(value)
    } else if (targetProperty.startsWith('fill.')) {
      // Deep property path handling
      // ...
    }
    return updated as unknown as PenNode
  }
  // Recurse into children
  if ('children' in node && node.children) {
    const newChildren = node.children.map(child =>
      applyBindingToNode(child, targetNodeId, targetProperty, value)
    )
    return { ...node, children: newChildren } as PenNode
  }
  return node
}
```

### Example 3: Component Badge Drawing
```typescript
// In skia-overlays.ts -- new function following drawConnectionBadge pattern

export function drawComponentBadge(
  ck: CanvasKit, canvas: Canvas,
  x: number, y: number, w: number, _h: number,
  zoom: number,
  isSource: boolean,  // true for reusable frame, false for instance
): void {
  const invZ = 1 / zoom
  const badgeR = 6 * invZ
  const badgeX = x + badgeR * 0.8
  const badgeY = y - badgeR * 0.8

  // Diamond shape for component indicator
  const paint = new ck.Paint()
  paint.setStyle(ck.PaintStyle.Fill)
  paint.setAntiAlias(true)
  paint.setColor(parseColor(ck, isSource ? COMPONENT_COLOR : INSTANCE_COLOR))
  paint.setAlphaf(0.4)  // Faded per user requirement

  const path = new ck.Path()
  path.moveTo(badgeX, badgeY - badgeR)
  path.lineTo(badgeX + badgeR, badgeY)
  path.lineTo(badgeX, badgeY + badgeR)
  path.lineTo(badgeX - badgeR, badgeY)
  path.close()
  canvas.drawPath(path, paint)

  path.delete()
  paint.delete()
}
```

### Example 4: Variable Picker Integration on New Fields
```typescript
// Example: Adding VariablePicker to size-section.tsx width field
// Source: Existing pattern in fill-section.tsx, layout-section.tsx

<div className="flex items-center gap-1">
  <NumberInput
    label="W"
    value={width}
    onChange={(v) => onUpdate({ width: v } as Partial<PenNode>)}
    min={0}
  />
  <VariablePicker
    type="number"
    currentValue={'width' in node ? node.width : undefined}
    onBind={(ref) => onUpdate({ width: ref } as Partial<PenNode>)}
    onUnbind={(val) => onUpdate({ width: val } as Partial<PenNode>)}
  />
</div>
```

### Example 5: Highlight Mode State and Canvas Overlay
```typescript
// canvas-store.ts additions:
highlightMode: boolean
toggleHighlightMode: () => void

// skia-engine.ts render() -- highlight mode overlay:
if (highlightMode && selectedIds.length > 0) {
  // Find all connections from/to selected elements
  const selectedConnections = connections.filter(c =>
    selectedIds.includes(c.sourceElementId)
  )
  const connectedIds = new Set<string>()
  for (const c of selectedConnections) {
    connectedIds.add(c.sourceElementId)
    // Add target frame/page elements
  }

  // Dim all non-connected render nodes
  for (const rn of this.renderNodes) {
    if (!connectedIds.has(rn.node.id) && !selectedIds.includes(rn.node.id)) {
      this.renderer.drawDimOverlay(canvas, rn.absX, rn.absY, rn.absW, rn.absH, 0.6)
    }
  }

  // Draw connection arrows between connected elements
  for (const c of selectedConnections) {
    const sourceRn = this.renderNodes.find(r => r.node.id === c.sourceElementId)
    const targetRn = this.renderNodes.find(r => r.node.id === c.targetFrameId)
    if (sourceRn && targetRn) {
      this.renderer.drawConnectionArrow(canvas, sourceRn, targetRn, this.zoom)
    }
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Fabric.js canvas | CanvasKit/Skia WASM | Already migrated (Phase 1) | All canvas code uses Skia pipeline |
| Single flat variable list | Variables with themes | Already done (OpenPencil) | Theme-aware token system exists |
| No component system | reusable + RefNode | Already done (OpenPencil) | Base component system is functional |
| Simple select dropdown for navigate | Tab/list modal (Phase 3) | This phase | Better scalability for many pages/frames |

**Already working (no changes needed):**
- TOKEN-01: Color token creation via variables panel
- TOKEN-02: Spacing (number) and typography (string) token creation
- TOKEN-04: Token resolution at render time via resolveNodeForCanvas()
- TOKEN-05: Token change propagation (dirty-flag re-render)
- SHARED-02: Including instances via duplicateNode() on reusable frames
- SHARED-04: Source-to-instance propagation via resolveRefs()

## Open Questions

1. **Drag-connect wire rendering layer**
   - What we know: Wire goes from DOM (property panel argument row) to canvas (target element). Must handle zoom/pan.
   - What's unclear: Whether to render as HTML/SVG overlay div or as CanvasKit draw call.
   - Recommendation: Use HTML/SVG overlay. The wire starts in DOM space (property panel) and ends in canvas space. Use `sceneToScreen()` to convert target element position to screen coordinates. This avoids complex coordinate space mixing in the CanvasKit renderer. Create a `<svg>` overlay element positioned absolutely over the canvas area.

2. **Highlight mode: Cross-page connection arrows**
   - What we know: Connections can target elements on different pages. When highlight mode is on, the selected element's connections should be visible.
   - What's unclear: How to show arrows to elements on a different page (they're not rendered on current canvas).
   - Recommendation: Only show arrows for same-page connections in the canvas overlay. For cross-page connections, show a labeled indicator pointing off-screen with the target page/frame name. The navigate modal handles cross-page navigation.

3. **Argument binding property paths**
   - What we know: Bindings need `targetProperty` like 'content', 'visible', 'fill.0.color'. Deep paths are complex.
   - What's unclear: Full set of bindable properties per argument type.
   - Recommendation: Start with a whitelist approach:
     - text -> content (text nodes), name
     - number -> width, height, opacity, fontSize, gap, padding
     - boolean -> visible, enabled
     - select -> variant switching (custom logic)
     - color -> fill.0.color, stroke.fill.0.color
   - Keep the binding system extensible but start with these common patterns.

4. **Highlight mode keyboard shortcut**
   - What we know: User wants toolbar button + keyboard shortcut.
   - Recommendation: Use `H` key (not modified) when no text editing is active. It's intuitive ("H" for highlight), not conflicting with existing shortcuts (existing tools use V, F, R, E, L, P, T). Add a guard: only activate when not editing text.

5. **Component page icon**
   - What we know: ERD pages use `<Database>` icon. Component pages need a distinct icon.
   - Recommendation: Use `<Component>` from lucide-react (already imported in property-panel.tsx). It's a diamond shape that matches the existing component indicator in the property panel header.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.0.5 |
| Config file | None -- uses Vite config directly |
| Quick run command | `bun --bun vitest run --passWithNoTests` |
| Full suite command | `bun --bun vitest run --passWithNoTests` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SHARED-01 | addPage('component') creates component page | unit | `bun --bun vitest run src/__tests__/components/component-page.test.ts -x` | No -- Wave 0 |
| SHARED-02 | RefNode instance creation via duplicateNode | unit | `bun --bun vitest run src/__tests__/components/component-instance.test.ts -x` | No -- Wave 0 |
| SHARED-03 | Component badge overlay renders | manual-only | Visual verification on canvas | N/A |
| SHARED-04 | Source edit propagates to instances | unit | `bun --bun vitest run src/__tests__/components/component-propagation.test.ts -x` | No -- Wave 0 |
| SHARED-05 | Double-click instance navigates to source | manual-only | Visual/interaction verification | N/A |
| SHARED-06 | Argument CRUD on reusable frame | unit | `bun --bun vitest run src/__tests__/components/argument-store.test.ts -x` | No -- Wave 0 |
| SHARED-07 | Set argument values on instance | unit | `bun --bun vitest run src/__tests__/components/argument-store.test.ts -x` | No -- Wave 0 |
| SHARED-08 | Argument values modify rendered output | unit | `bun --bun vitest run src/__tests__/components/argument-resolution.test.ts -x` | No -- Wave 0 |
| TOKEN-01 | Create color tokens | unit | Already covered by existing variable store tests | N/A (already works) |
| TOKEN-02 | Create spacing/typography tokens | unit | Already covered | N/A (already works) |
| TOKEN-03 | VariablePicker on size/text fields | manual-only | Visual verification in property panel | N/A |
| TOKEN-04 | Token refs resolve at render | unit | Already covered by resolveNodeForCanvas tests | N/A (already works) |
| TOKEN-05 | Token change propagates | unit | Already covered | N/A (already works) |

### Sampling Rate
- **Per task commit:** `bun --bun vitest run --passWithNoTests`
- **Per wave merge:** `bun --bun vitest run --passWithNoTests && npx tsc --noEmit`
- **Phase gate:** Full suite green + type check before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/components/argument-store.test.ts` -- covers SHARED-06, SHARED-07 (argument CRUD + value setting)
- [ ] `src/__tests__/components/argument-resolution.test.ts` -- covers SHARED-08 (argument value application in render pipeline)
- [ ] `src/__tests__/components/component-page.test.ts` -- covers SHARED-01 (component page type)
- [ ] Framework install: Already installed (vitest 3.0.5 in devDependencies)

## Sources

### Primary (HIGH confidence)
- `src/types/pen.ts` -- PenNode types, FrameNode.reusable, RefNode structure
- `src/stores/document-store.ts` -- makeReusable(), detachComponent(), variable CRUD
- `src/stores/document-store-connections.ts` -- Pattern for extracted store actions
- `src/stores/document-store-pages.ts` -- Pattern for page type system
- `src/canvas/skia/skia-engine.ts` -- resolveRefs(), remapIds(), render pipeline
- `src/canvas/skia/skia-overlays.ts` -- drawConnectionBadge() pattern
- `src/canvas/skia/skia-canvas.tsx` -- onDblClick handler, event system
- `src/variables/resolve-variables.ts` -- resolveNodeForCanvas(), variable resolution
- `src/components/panels/variables-panel.tsx` -- Variables panel structure (820 lines)
- `src/components/shared/variable-picker.tsx` -- VariablePicker interface and usage
- `src/components/panels/property-panel.tsx` -- Property panel section pattern
- `src/components/editor/page-tabs.tsx` -- Page type system with icons
- `src/components/panels/connection-section.tsx` -- Navigate picker (to be redesigned)
- `src/stores/canvas-store.ts` -- UI state patterns

### Secondary (MEDIUM confidence)
- `.planning/phases/03-shared-components-design-tokens/03-CONTEXT.md` -- User decisions and canonical refs
- `.planning/REQUIREMENTS.md` -- SHARED-01..08, TOKEN-01..05 specifications
- `.planning/STATE.md` -- Project state and completed phases

### Tertiary (LOW confidence)
- None -- all findings are based on direct codebase analysis.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Zero new dependencies, all existing libraries
- Architecture: HIGH -- Every feature has an existing analog in the codebase
- Pitfalls: HIGH -- Based on direct analysis of resolveRefs/remapIds/virtualID system
- Argument resolution pipeline: MEDIUM -- Discretionary design, but constrained by existing pipeline order
- Drag-connect wire rendering: MEDIUM -- Recommendation (SVG overlay) is sound but unverified

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable -- internal architecture, no external dependencies)
