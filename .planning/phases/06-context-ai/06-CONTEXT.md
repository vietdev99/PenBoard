# Phase 6: Context & AI - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Add per-element context annotations that persist in .pb files and are injected into AI prompts. Users describe what each element represents/does via a dedicated Context tab in the right panel. AI uses this context to generate more accurate designs and modifications.

Requirements: CTX-01, CTX-02, CTX-03

</domain>

<decisions>
## Implementation Decisions

### Area A: Context UX

- **Dedicated tab** in right panel: Design | Navigate | **Context** | Code
- **Always-visible textarea** (not collapsible) with markdown support
- **Tab toggle sub-tabs**: Edit | Preview — Edit shows textarea, Preview shows rendered markdown
- **No character limit** — user has full freedom
- **AI Suggest button** — calls AI with node properties (type, name, role, children, fill, size) to auto-suggest context description
- **Multi-select behavior** — shows collapsed list, each element has its own expandable section with name + context textarea
- **Empty state (no selection)** — shows **page context** (each PenPage also has context)
- **Plain text fallback** — markdown is optional; plain text works fine for simple annotations

### Area B: AI Injection Strategy

- **Inject scope**: selected elements + parent frames (walk up tree to collect ancestor context)
- **Format in prompt**: inline with node info — e.g. `Selected: Button "Submit" (120x40) — Context: Primary action, triggers purchase flow`
- **Parent context format**: hierarchical inline — `Parent: Card "Product" — Context: Product display card > Selected: Button "Buy" — Context: Purchase action`
- **Generation mode**: do NOT inject existing element contexts when generating new designs from scratch
- **Modification mode**: inject selected element context + parent context when modifying existing designs
- **AI Suggest implementation**: call existing AI chat endpoint with node properties as prompt, return suggested context text. Use lightweight model (haiku) for speed

### Area C: Context Scope

- **Pages have context** — `context?: string` on PenPage type. Shown in Context tab when no element selected
- **Components (reusable) have context** — stored on the reusable node. Instances inherit component context but can override with their own
- **Frame inheritance**: implicit via AI prompt hierarchy. No code-level inheritance — AI receives parent contexts in prompt and infers relationship naturally
- **Instance context resolution**: if instance has own context → use it. If not → use component's context. Display both in Context tab (component context as read-only reference)

### Claude's Discretion

- Exact markdown rendering library choice (react-markdown, marked, etc.)
- Debounce timing for context textarea saves
- AI Suggest prompt wording and model selection
- Context tab icon choice
- Exact styling of collapsed multi-select list

</decisions>

<specifics>
## Specific Ideas

- Context tab should feel lightweight — just a textarea where you jot notes about what this element is for
- AI Suggest should be a small sparkle/wand icon button, not a full dialog
- When editing context for a component instance, show the inherited component context above as dimmed/read-only reference
- Markdown preview should use the same styling as the rest of the app (shadcn/ui tokens, dark mode compatible)

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements are fully captured in decisions above and in:

### Requirements
- `.planning/REQUIREMENTS.md` §CTX-01, CTX-02, CTX-03 — Context feature requirements

### Existing AI integration
- `src/components/panels/ai-chat-handlers.ts` — `buildContextString()` function where context injection happens
- `src/services/ai/ai-prompts.ts` — System prompts that need context awareness
- `src/services/ai/ai-service.ts` — AI chat API wrapper

### Type system
- `src/types/pen.ts` — PenNodeBase (add `context?: string`), PenPage (add `context?: string`)

### Right panel structure
- `src/components/panels/right-panel.tsx` — Tab system (add Context tab)
- `src/stores/canvas-store.ts` — `RightPanelTab` type (add 'context')

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Right panel tab system** (`right-panel.tsx`): Already has Design|Navigate|Code tabs with `RightPanelTab` type in canvas-store. Adding Context tab is straightforward — add to type union + tab array + content switch
- **`buildContextString()`** (`ai-chat-handlers.ts`): Already collects selected node info. Perfect injection point for element context
- **`updateNode()`** (`document-store.ts`): Accepts `Partial<PenNode>` — context saves work automatically with no store changes
- **`structuredClone()` / spread operator**: All clone/copy/paste paths preserve arbitrary properties — context persistence in copy/paste is automatic
- **JSON serialization**: .pb files are JSON — `context` field persists automatically with no I/O changes
- **`SectionHeader` component**: Reusable collapsible section header used in property panel — can reuse for collapsed multi-select list

### Established Patterns
- **Panel section pattern**: Each section is a separate component file (`fill-section.tsx`, `text-section.tsx`) imported into parent panel
- **Store subscription pattern**: Components use `useDocumentStore((s) => s.someAction)` for actions
- **i18n pattern**: All UI text uses `useTranslation()` with `t('key')` — Context tab labels need i18n entries
- **RefNode handling**: Property panel already handles ref node overrides (`property-panel.tsx:81-112`) — context override for instances follows same pattern

### Integration Points
- **PenNodeBase** (`src/types/pen.ts`) — Add `context?: string`
- **PenPage** (`src/types/pen.ts`) — Add `context?: string`
- **RightPanelTab** (`src/stores/canvas-store.ts`) — Add `'context'` to union
- **right-panel.tsx** — Add Context tab + component
- **ai-chat-handlers.ts** — Inject context into `buildContextString()`
- **ai-prompts.ts** — Add context awareness to system prompts
- **MCP batch-get** — Context auto-exposed (no changes needed)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-context-ai*
*Context gathered: 2026-03-18*
