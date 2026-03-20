import type { WorkflowGraph } from './graph-builder'

// ---------------------------------------------------------------------------
// Mermaid Syntax Generator
// ---------------------------------------------------------------------------

/**
 * Convert WorkflowGraph to valid Mermaid flowchart syntax.
 * Direction: LR (left-to-right — fits storyboard flow).
 */
export function generateMermaid(graph: WorkflowGraph): string {
  if (graph.nodes.length === 0) {
    return 'graph LR\n  empty["No pages or connections"]'
  }

  const lines: string[] = ['graph LR']

  // Class definitions for styling
  lines.push('  classDef screen fill:#e3f2fd,stroke:#1976d2,stroke-width:2px,color:#0d47a1')
  lines.push('  classDef entity fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#bf360c')

  // Node definitions
  for (const node of graph.nodes) {
    const safeLabel = escapeMermaid(node.label)
    if (node.type === 'screen') {
      lines.push(`  ${sanitizeId(node.id)}["${safeLabel}"]:::screen`)
    } else {
      // Entity: cylinder shape
      lines.push(`  ${sanitizeId(node.id)}[("${safeLabel}")]:::entity`)
    }
  }

  // Edge definitions
  for (const edge of graph.edges) {
    const src = sanitizeId(edge.source)
    const tgt = sanitizeId(edge.target)

    switch (edge.type) {
      case 'connection': {
        const label = escapeMermaid(edge.label ?? '')
        lines.push(`  ${src} -->|"${label}"| ${tgt}`)
        break
      }
      case 'data-binding':
        lines.push(`  ${src} -.-> ${tgt}`)
        break
      case 'entity-relation':
        lines.push(`  ${src} --- ${tgt}`)
        break
    }
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Escape special mermaid characters in labels */
function escapeMermaid(text: string): string {
  return text
    .replace(/"/g, "'")
    .replace(/[[\](){}#&]/g, ' ')
    .replace(/\n/g, ' ')
    .trim()
}

/** Sanitize node ID for mermaid (must be alphanumeric + underscores) */
function sanitizeId(id: string): string {
  // Replace non-alphanumeric with underscore, ensure starts with letter
  const safe = id.replace(/[^a-zA-Z0-9_]/g, '_')
  return /^[a-zA-Z]/.test(safe) ? safe : `n_${safe}`
}
