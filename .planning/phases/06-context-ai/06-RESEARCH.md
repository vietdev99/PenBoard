# Phase 6: Context & AI - Research

**Researched:** 2026-03-18
**Domain:** Per-element context annotations + AI prompt injection
**Confidence:** HIGH

## Summary

Phase 6 adds a `context?: string` field to every PenNode and PenPage, a dedicated Context tab in the right panel for editing these annotations, and injection of context notes into AI prompts during design modification. The implementation is straightforward because PenBoard's architecture already supports this pattern: `updateNode()` accepts `Partial<PenNode>`, JSON serialization preserves unknown fields, `structuredClone` in copy/paste preserves all properties, and `buildContextString()` is the exact function where AI context injection happens.

The primary technical challenges are: (1) adding a new right-panel tab with sub-tabs (Edit/Preview) including markdown rendering, (2) building the AI Suggest feature that calls a lightweight model, and (3) ensuring context is properly injected into modification prompts with parent hierarchy. All three are well-scoped with clear integration points in existing code.

**Primary recommendation:** Add `context?: string` to PenNodeBase and PenPage, create a `context-panel.tsx` component with textarea + markdown preview, wire it into `right-panel.tsx` as a fourth tab, and inject context into `buildContextString()` and `generateDesignModification()`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Area A: Context UX**
- Dedicated tab in right panel: Design | Navigate | **Context** | Code
- Always-visible textarea (not collapsible) with markdown support
- Tab toggle sub-tabs: Edit | Preview -- Edit shows textarea, Preview shows rendered markdown
- No character limit -- user has full freedom
- AI Suggest button -- calls AI with node properties (type, name, role, children, fill, size) to auto-suggest context description
- Multi-select behavior -- shows collapsed list, each element has its own expandable section with name + context textarea
- Empty state (no selection) -- shows page context (each PenPage also has context)
- Plain text fallback -- markdown is optional; plain text works fine for simple annotations

**Area B: AI Injection Strategy**
- Inject scope: selected elements + parent frames (walk up tree to collect ancestor context)
- Format in prompt: inline with node info -- e.g. `Selected: Button "Submit" (120x40) -- Context: Primary action, triggers purchase flow`
- Parent context format: hierarchical inline -- `Parent: Card "Product" -- Context: Product display card > Selected: Button "Buy" -- Context: Purchase action`
- Generation mode: do NOT inject existing element contexts when generating new designs from scratch
- Modification mode: inject selected element context + parent context when modifying existing designs
- AI Suggest implementation: call existing AI chat endpoint with node properties as prompt, return suggested context text. Use lightweight model (haiku) for speed

**Area C: Context Scope**
- Pages have context -- `context?: string` on PenPage type. Shown in Context tab when no element selected
- Components (reusable) have context -- stored on the reusable node. Instances inherit component context but can override with their own
- Frame inheritance: implicit via AI prompt hierarchy. No code-level inheritance -- AI receives parent contexts in prompt and infers relationship naturally
- Instance context resolution: if instance has own context -> use it. If not -> use component's context. Display both in Context tab (component context as read-only reference)

### Claude's Discretion
- Exact markdown rendering library choice (react-markdown, marked, etc.)
- Debounce timing for context textarea saves
- AI Suggest prompt wording and model selection
- Context tab icon choice
- Exact styling of collapsed multi-select list

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CTX-01 | Every element has a context textarea in right sidebar panel | Type system extension (`PenNodeBase.context`, `PenPage.context`), new Context tab in right-panel.tsx, context-panel.tsx component with Edit/Preview sub-tabs |
| CTX-02 | Element context is injected into AI prompts when generating/reading designs | `buildContextString()` in ai-chat-handlers.ts for chat mode, `generateDesignModification()` for modification mode, parent hierarchy walking via `getParentOf()` |
| CTX-03 | Context persists in .pb file (on PenNode), survives copy/paste/duplicate | Automatic via JSON serialization (`.pb` files are JSON), `structuredClone` in copy/paste, `cloneWithNewIds` spread operator in duplicate |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-markdown | ^9.x | Markdown rendering in Preview sub-tab | De facto React markdown renderer; safe by default (no dangerouslySetInnerHTML), supports component overrides for shadcn/ui styling, CommonMark compliant |
| remark-gfm | ^4.x | GitHub Flavored Markdown support | Tables, strikethrough, task lists -- commonly expected markdown features |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zustand | 5.x (existing) | Store `context` field via `updateNode` | Already used; no new store needed |
| react-i18next | (existing) | i18n for Context tab labels | All UI text must be translated |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-markdown | marked + dangerouslySetInnerHTML | Unsafe by default, no React component integration, harder to style with shadcn tokens |
| react-markdown | @mdx-js/react | Overkill for read-only preview, MDX is for JSX-in-markdown |
| react-markdown | Custom regex parser | Fragile, reinventing the wheel, edge cases in markdown spec |

**Recommendation:** Use `react-markdown` + `remark-gfm`. It is the standard approach, safe by default, and supports custom component overrides which allows styling with shadcn/ui design tokens.

**Installation:**
```bash
bun add react-markdown remark-gfm
```

## Architecture Patterns

### Integration Points (Existing Code)

```
src/types/pen.ts           -- Add context?: string to PenNodeBase and PenPage
src/stores/canvas-store.ts -- Add 'context' to RightPanelTab union
src/components/panels/
  right-panel.tsx           -- Add Context tab (4th tab)
  context-panel.tsx         -- NEW: Main context panel component
src/components/panels/
  ai-chat-handlers.ts      -- Inject context into buildContextString()
src/services/ai/
  design-generator.ts      -- Inject context into modification prompt
src/i18n/locales/*.ts      -- Add context tab translation keys
```

### Pattern 1: Type Extension (Minimal Invasive)
**What:** Add `context?: string` to `PenNodeBase` interface
**When to use:** This is the correct pattern because all PenNode types extend PenNodeBase
**Example:**
```typescript
// src/types/pen.ts - PenNodeBase
export interface PenNodeBase {
  id: string
  type: PenNodeType
  name?: string
  role?: string
  context?: string  // NEW: AI-readable context annotation
  // ... existing fields
}

// src/types/pen.ts - PenPage
export interface PenPage {
  id: string
  name: string
  type?: 'screen' | 'erd' | 'component'
  context?: string  // NEW: Page-level context
  children: PenNode[]
}
```

### Pattern 2: Right Panel Tab (Follow Existing Pattern)
**What:** Add Context tab following exact same pattern as Design/Navigate/Code tabs
**When to use:** For the Context tab in right-panel.tsx
**Example:**
```typescript
// src/stores/canvas-store.ts
export type RightPanelTab = 'design' | 'navigate' | 'context' | 'code'

// src/components/panels/right-panel.tsx
const tabs: { key: RightPanelTab; label: string }[] = [
  { key: 'design', label: t('rightPanel.design') },
  { key: 'navigate', label: t('rightPanel.navigate', 'Navigate') },
  { key: 'context', label: t('rightPanel.context', 'Context') },
  { key: 'code', label: t('rightPanel.code') },
]

// In content switch:
activeTab === 'context' ? <ContextPanel /> : ...
```

### Pattern 3: Context Panel Structure (New Component)
**What:** Standalone panel component with Edit/Preview sub-tabs
**When to use:** For the context-panel.tsx file
**Example:**
```typescript
// src/components/panels/context-panel.tsx
export default function ContextPanel() {
  const activeId = useCanvasStore((s) => s.selection.activeId)
  const selectedIds = useCanvasStore((s) => s.selection.selectedIds)
  const activePageId = useCanvasStore((s) => s.activePageId)

  // No selection -> show page context
  if (selectedIds.length === 0) return <PageContextEditor pageId={activePageId} />

  // Multi-select -> collapsed list with individual editors
  if (selectedIds.length > 1) return <MultiSelectContextList ids={selectedIds} />

  // Single selection -> full editor
  return <SingleNodeContextEditor nodeId={activeId!} />
}
```

### Pattern 4: Context Injection into AI Prompts
**What:** Walk up tree to collect ancestor context, format hierarchically
**When to use:** In `buildContextString()` and `generateDesignModification()`
**Example:**
```typescript
// In ai-chat-handlers.ts buildContextString()
function collectAncestorContext(nodeId: string): string[] {
  const parts: string[] = []
  const { getNodeById, getParentOf } = useDocumentStore.getState()

  // Walk up to collect parent contexts
  let currentId: string | undefined = nodeId
  while (currentId) {
    const node = getNodeById(currentId)
    if (node?.context) {
      const dims = 'width' in node && 'height' in node
        ? ` (${node.width}x${node.height})`
        : ''
      parts.unshift(`${node.type}:"${node.name ?? node.id}"${dims} -- Context: ${node.context}`)
    }
    const parent = getParentOf(currentId)
    currentId = parent?.id
  }
  return parts
}
```

### Pattern 5: RefNode Context Resolution (Instance Inheritance)
**What:** Instance uses own context if set, falls back to component context
**When to use:** When displaying context in the panel for RefNode instances
**Example:**
```typescript
// In context-panel.tsx for RefNode instances
const refNode = node as RefNode
const component = getNodeById(refNode.ref)
const instanceContext = refNode.context ?? ''
const componentContext = component?.context ?? ''
const effectiveContext = instanceContext || componentContext

// Display: show component context as read-only reference above the edit area
```

### Pattern 6: Debounced Save (Store Update)
**What:** Debounce textarea changes before calling `updateNode`
**When to use:** For the context textarea to avoid excessive history pushes
**Recommended timing:** 500ms debounce (matches typical typing pause, not too aggressive)
**Example:**
```typescript
const [localContext, setLocalContext] = useState(node.context ?? '')
const debouncedSave = useMemo(
  () => debounce((value: string) => {
    updateNode(nodeId, { context: value || undefined } as Partial<PenNode>)
  }, 500),
  [nodeId, updateNode]
)

// On change:
setLocalContext(value)
debouncedSave(value)
```

### Anti-Patterns to Avoid
- **Do NOT add context to ContainerProps:** Context belongs on PenNodeBase, not ContainerProps, because ALL node types can have context annotations (text, ellipse, line, etc.)
- **Do NOT create a separate context store:** Context is a node property, stored in document-store. No new Zustand store needed.
- **Do NOT inject context in generation mode:** Per user decision, new design generation from scratch should NOT include existing element contexts
- **Do NOT resolve $variable refs in context:** Context is plain text, not a styled property. No variable resolution needed.
- **Do NOT add context field to the CanvasKit renderer:** Context is metadata only -- it has no visual representation on canvas

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown rendering | Custom regex-based parser | react-markdown + remark-gfm | Markdown spec has hundreds of edge cases; react-markdown handles them all safely |
| Debounce function | Custom setTimeout wrapper | lodash-es/debounce or custom hook | Cleanup on unmount, proper cancellation |
| Tree walking for ancestors | Recursive manual traversal | `getParentOf()` chain from document-store | Already exists, handles all page contexts |

**Key insight:** The `context` field is just a string property on PenNode. PenBoard's existing infrastructure (JSON serialization, structuredClone, updateNode, history) handles persistence and undo/redo automatically. The only new code needed is the UI panel and AI injection logic.

## Common Pitfalls

### Pitfall 1: History Spam from Textarea
**What goes wrong:** Every keystroke in the context textarea calls `updateNode`, which pushes to history store. User types 50 characters = 50 undo steps.
**Why it happens:** `updateNode` always calls `useHistoryStore.getState().pushState()`.
**How to avoid:** Debounce the `updateNode` call (500ms recommended). Use local React state for immediate UI updates, only persist to store after debounce.
**Warning signs:** Undo steps correspond to individual keystrokes rather than meaningful edits.

### Pitfall 2: Context Tab Not Persisting in Preferences
**What goes wrong:** User selects Context tab, refreshes, tab reverts to Design.
**Why it happens:** The `hydrate()` function in canvas-store validates `rightPanelTab` against a hardcoded set: `'design' || 'code' || 'navigate'`. Adding `'context'` to the union type is not enough -- the hydrate validation must also include it.
**How to avoid:** Update the hydrate validation in canvas-store.ts to include `'context'`.
**Warning signs:** Tab selection not preserved across page refresh.

### Pitfall 3: Missing Context on Multi-Page Walk
**What goes wrong:** `getParentOf()` only searches the active page's children. If a node is on a different page (edge case with component refs), parent lookup fails silently.
**Why it happens:** `getParentOf` calls `findParentInTree(_children(get()))` which scopes to active page.
**How to avoid:** For context injection, always use the active page context (which is the current selection's page). No cross-page parent walking needed because selections are always on the active page.
**Warning signs:** Parent context missing for nodes inside entered frames.

### Pitfall 4: AI Suggest Blocking UI
**What goes wrong:** AI Suggest button freezes the textarea while waiting for response.
**Why it happens:** Not using async state management properly.
**How to avoid:** Show a loading spinner on the button, disable it during request, use AbortController for cancellation if user navigates away.
**Warning signs:** UI freezes for 2-5 seconds when clicking AI Suggest.

### Pitfall 5: Context Lost on RefNode Detach
**What goes wrong:** When detaching a component instance, the `context` field on the RefNode is not carried over to the detached node.
**Why it happens:** The `detachComponent` function in document-store.ts iterates over RefNode entries but skips certain keys (`type`, `ref`, `descendants`, `children`, `id`). Since `context` is not in the skip list, it WILL be carried over. But the component's context (on the referenced node) might also need to be considered.
**How to avoid:** Verify the detach flow preserves context. The current code already does this correctly via the `for...of Object.entries(node)` loop that copies all non-skipped properties.
**Warning signs:** Context disappears after detaching an instance.

### Pitfall 6: Markdown Preview XSS
**What goes wrong:** User pastes HTML/script tags into context, markdown preview renders them.
**Why it happens:** Some markdown renderers allow raw HTML by default.
**How to avoid:** react-markdown is safe by default -- it does NOT render raw HTML unless you explicitly enable `allowedElements` or use `rehype-raw`. Keep defaults.
**Warning signs:** HTML tags rendered literally in preview.

## Code Examples

### Context Field on PenNodeBase (Verified from existing pen.ts)
```typescript
// Source: src/types/pen.ts - Add to existing PenNodeBase interface
export interface PenNodeBase {
  id: string
  type: PenNodeType
  name?: string
  role?: string
  context?: string  // AI-readable context annotation
  x?: number
  y?: number
  // ... rest unchanged
}
```

### Right Panel Tab Extension (Verified from existing canvas-store.ts)
```typescript
// Source: src/stores/canvas-store.ts
export type RightPanelTab = 'design' | 'navigate' | 'context' | 'code'

// In hydrate():
if (
  data.rightPanelTab === 'design' ||
  data.rightPanelTab === 'code' ||
  data.rightPanelTab === 'navigate' ||
  data.rightPanelTab === 'context'
) {
  set({ rightPanelTab: data.rightPanelTab })
}
```

### Context Injection in buildContextString (Verified from existing ai-chat-handlers.ts)
```typescript
// Source: src/components/panels/ai-chat-handlers.ts
// Add context injection after the existing selectedSummary construction
if (selectedIds.length > 0) {
  const selectedNodes = selectedIds
    .map((id) => useDocumentStore.getState().getNodeById(id))
    .filter(Boolean)

  const selectedSummary = selectedNodes
    .map((n) => {
      const dims = 'width' in n! && 'height' in n!
        ? ` (${n!.width}x${n!.height})`
        : ''
      const ctx = n!.context ? ` -- Context: ${n!.context}` : ''
      return `${n!.type}:${n!.name ?? n!.id}${dims}${ctx}`
    })
    .join(', ')
  parts.push(`Selected: ${selectedSummary}`)

  // Collect parent contexts for hierarchy
  for (const id of selectedIds) {
    const ancestors = collectAncestorContext(id)
    if (ancestors.length > 0) {
      parts.push(`Hierarchy: ${ancestors.join(' > ')}`)
    }
  }
}
```

### Markdown Preview with shadcn Styling
```typescript
// Source: react-markdown docs + project styling conventions
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

function ContextPreview({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      className="prose prose-sm dark:prose-invert max-w-none text-foreground"
      components={{
        // Override elements to use shadcn design tokens
        h1: ({ children }) => <h1 className="text-lg font-bold text-foreground">{children}</h1>,
        h2: ({ children }) => <h2 className="text-base font-semibold text-foreground">{children}</h2>,
        p: ({ children }) => <p className="text-xs text-foreground/80 leading-relaxed">{children}</p>,
        a: ({ href, children }) => (
          <a href={href} className="text-primary underline" target="_blank" rel="noopener">
            {children}
          </a>
        ),
        code: ({ children }) => (
          <code className="bg-secondary px-1 py-0.5 rounded text-[10px]">{children}</code>
        ),
      }}
    />
  )
}
```

### AI Suggest Implementation Pattern
```typescript
// Call existing /api/ai/generate endpoint with node properties
async function suggestContext(node: PenNode): Promise<string> {
  const nodeInfo = {
    type: node.type,
    name: node.name,
    role: (node as any).role,
    width: (node as any).width,
    height: (node as any).height,
    childCount: 'children' in node ? (node.children?.length ?? 0) : 0,
  }

  const response = await fetch('/api/ai/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system: 'You are a UI/UX context annotator. Given a design element, write a brief 1-3 sentence description of its purpose and behavior. Be specific and actionable.',
      message: `Describe the purpose of this element:\n${JSON.stringify(nodeInfo, null, 2)}`,
      model: currentModel, // Use lightweight model (haiku-class)
      provider: currentProvider,
    }),
  })

  const data = await response.json()
  return data.text?.trim() ?? ''
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Comments in code only | In-tool annotations per element | Current trend | Designers annotate directly in design tools (Figma comments, Sketch annotations) |
| Flat context strings | Hierarchical context (parent > child) | PenBoard design decision | AI gets richer understanding of element relationships |

**No deprecated patterns to note** -- this is a new feature addition, not a migration.

## Open Questions

1. **Debounce timing for context saves**
   - What we know: Need debounce to avoid history spam. 500ms is a common default.
   - What's unclear: Whether 500ms feels responsive enough or too laggy for fast typists.
   - Recommendation: Start with 500ms, adjust based on user feedback. Easy to change.

2. **AI Suggest model selection**
   - What we know: User wants lightweight model (haiku-class) for speed.
   - What's unclear: Which specific model to target when user has multiple providers configured.
   - Recommendation: Use the currently selected model in the AI panel. If it's a heavy model, the latency is acceptable for a one-shot suggest action. Could add a preference later.

3. **Context tab icon**
   - What we know: Need an icon for the tab (or just text label like existing tabs).
   - What's unclear: Whether to use icon or text.
   - Recommendation: Use text label "Context" matching existing tab style (Design, Navigate, Code are all text-only). Keep consistency.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (existing) |
| Config file | `vitest.config.ts` |
| Quick run command | `bun --bun vitest run --reporter=verbose` |
| Full suite command | `bun --bun run test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CTX-01 | context field exists on PenNodeBase, can be set/get via updateNode | unit | `bun --bun vitest run src/__tests__/context/context-store.test.ts -x` | Wave 0 |
| CTX-02 | buildContextString includes element context, parent hierarchy context injected in modification mode | unit | `bun --bun vitest run src/__tests__/context/context-injection.test.ts -x` | Wave 0 |
| CTX-03 | context survives copy/paste (structuredClone), duplicate (cloneWithNewIds), save/load (JSON), undo/redo | unit | `bun --bun vitest run src/__tests__/context/context-persistence.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `bun --bun vitest run src/__tests__/context/ -x`
- **Per wave merge:** `bun --bun run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/context/context-store.test.ts` -- covers CTX-01 (updateNode with context, PenPage context)
- [ ] `src/__tests__/context/context-injection.test.ts` -- covers CTX-02 (buildContextString output, ancestor context collection)
- [ ] `src/__tests__/context/context-persistence.test.ts` -- covers CTX-03 (copy/paste, duplicate, JSON round-trip, undo/redo)

## Sources

### Primary (HIGH confidence)
- **Codebase analysis** - Direct reading of `src/types/pen.ts`, `src/stores/canvas-store.ts`, `src/stores/document-store.ts`, `src/components/panels/right-panel.tsx`, `src/components/panels/property-panel.tsx`, `src/components/panels/ai-chat-handlers.ts`, `src/services/ai/design-generator.ts`, `src/services/ai/ai-prompts.ts`, `src/hooks/use-keyboard-shortcuts.ts`, `src/utils/node-clone.ts`
- **CONTEXT.md** - User decisions from `/gsd:discuss-phase` for all locked implementation choices
- [react-markdown npm](https://www.npmjs.com/package/react-markdown) - Package capabilities, safety model, component overrides

### Secondary (MEDIUM confidence)
- [react-markdown GitHub](https://github.com/remarkjs/react-markdown) - API reference, plugin ecosystem

### Tertiary (LOW confidence)
- None -- all findings verified from codebase or official sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - react-markdown is the de facto standard; existing codebase patterns are clear from direct reading
- Architecture: HIGH - All integration points verified in actual source code; patterns follow established project conventions
- Pitfalls: HIGH - Identified from actual code analysis (history store behavior, hydrate validation, structuredClone in clipboard)

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stable domain, no fast-moving dependencies)
