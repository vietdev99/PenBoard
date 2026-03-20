import type { PenDocument, PenNode } from '@/types/pen'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkflowNode {
  id: string
  label: string
  type: 'screen' | 'entity'
}

export interface WorkflowEdge {
  source: string
  target: string
  type: 'connection' | 'data-binding' | 'entity-relation'
  label?: string
}

export interface WorkflowGraph {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}

// ---------------------------------------------------------------------------
// Graph Builder
// ---------------------------------------------------------------------------

/**
 * Extract workflow graph from PenDocument.
 * Nodes = screen pages + data entities.
 * Edges = connections + data bindings + entity relations.
 */
export function buildWorkflowGraph(doc: PenDocument): WorkflowGraph {
  const nodes: WorkflowNode[] = []
  const edges: WorkflowEdge[] = []
  const edgeSet = new Set<string>() // deduplicate edges

  const pages = doc.pages ?? []
  const connections = doc.connections ?? []
  const entities = doc.dataEntities ?? []

  // --- Nodes ---

  // Screen pages (exclude component pages)
  for (const page of pages) {
    if (page.type === 'component') continue
    nodes.push({
      id: page.id,
      label: page.name || 'Untitled',
      type: page.type === 'erd' ? 'entity' : 'screen',
    })
  }

  // Data entities
  for (const entity of entities) {
    nodes.push({
      id: entity.id,
      label: entity.name || 'Untitled Entity',
      type: 'entity',
    })
  }

  // --- Edges ---

  // 1. Screen connections
  for (const conn of connections) {
    const key = `conn:${conn.sourcePageId}→${conn.targetPageId}`
    if (edgeSet.has(key)) continue
    edgeSet.add(key)

    // Only add if both pages exist as nodes
    const srcExists = nodes.some((n) => n.id === conn.sourcePageId)
    const tgtExists = nodes.some((n) => n.id === conn.targetPageId)
    if (!srcExists || !tgtExists) continue

    edges.push({
      source: conn.sourcePageId,
      target: conn.targetPageId,
      type: 'connection',
      label: `${conn.triggerEvent} → ${conn.transitionType}`,
    })
  }

  // 2. Data binding edges (page → entity)\n
  for (const page of pages) {
    if (page.type === 'component') continue
    const boundEntities = new Set<string>()
    collectBoundEntities(page.children, boundEntities)

    for (const entityId of boundEntities) {
      const key = `bind:${page.id}→${entityId}`
      if (edgeSet.has(key)) continue
      edgeSet.add(key)

      // Only add if entity exists as node
      if (!nodes.some((n) => n.id === entityId)) continue

      edges.push({
        source: page.id,
        target: entityId,
        type: 'data-binding',
      })
    }
  }

  // 3. Entity relation edges
  for (const entity of entities) {
    for (const field of entity.fields) {
      if (field.type === 'relation' && field.relatedEntityId) {
        const key = `rel:${sortPair(entity.id, field.relatedEntityId)}`
        if (edgeSet.has(key)) continue
        edgeSet.add(key)

        // Only add if related entity exists
        if (!nodes.some((n) => n.id === field.relatedEntityId)) continue

        edges.push({
          source: entity.id,
          target: field.relatedEntityId!,
          type: 'entity-relation',
        })
      }
    }
  }

  return { nodes, edges }
}

// ---------------------------------------------------------------------------
// Focus Filter
// ---------------------------------------------------------------------------

/**
 * Filter graph to show only activePageId + 1-hop neighbors.
 * Includes data entities connected to any visible page.
 */
export function filterGraphByFocus(
  graph: WorkflowGraph,
  activePageId: string,
): WorkflowGraph {
  // Collect 1-hop neighbor IDs
  const visibleIds = new Set<string>([activePageId])

  for (const edge of graph.edges) {
    if (edge.source === activePageId) visibleIds.add(edge.target)
    if (edge.target === activePageId) visibleIds.add(edge.source)
  }

  // Also include entities connected to any visible page (2nd-pass)
  for (const edge of graph.edges) {
    if (edge.type === 'data-binding') {
      if (visibleIds.has(edge.source)) visibleIds.add(edge.target)
      if (visibleIds.has(edge.target)) visibleIds.add(edge.source)
    }
  }

  const nodes = graph.nodes.filter((n) => visibleIds.has(n.id))
  const nodeIds = new Set(nodes.map((n) => n.id))
  const edges = graph.edges.filter(
    (e) => nodeIds.has(e.source) && nodeIds.has(e.target),
  )

  return { nodes, edges }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Recursively collect entityIds from dataBinding on all nodes */
function collectBoundEntities(nodes: PenNode[], out: Set<string>) {
  for (const node of nodes) {
    if (node.dataBinding?.entityId) {
      out.add(node.dataBinding.entityId)
    }
    if ('children' in node && node.children) {
      collectBoundEntities(node.children, out)
    }
  }
}

/** Sort a pair of IDs for undirected edge deduplication */
function sortPair(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`
}
