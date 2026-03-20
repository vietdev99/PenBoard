import { describe, it, expect } from 'vitest'
import { buildWorkflowGraph, filterGraphByFocus } from '@/services/workflow/graph-builder'
import type { PenDocument } from '@/types/pen'

function makeDoc(overrides: Partial<PenDocument> = {}): PenDocument {
  return {
    version: '1',
    children: [],
    pages: [],
    connections: [],
    dataEntities: [],
    ...overrides,
  }
}

describe('buildWorkflowGraph', () => {
  it('empty document → empty graph', () => {
    const graph = buildWorkflowGraph(makeDoc())
    expect(graph.nodes).toEqual([])
    expect(graph.edges).toEqual([])
  })

  it('creates screen nodes for non-component pages', () => {
    const doc = makeDoc({
      pages: [
        { id: 'p1', name: 'Home', type: 'screen', children: [] },
        { id: 'p2', name: 'About', type: 'screen', children: [] },
        { id: 'p3', name: 'Button', type: 'component', children: [] },
      ],
    })
    const graph = buildWorkflowGraph(doc)
    expect(graph.nodes).toHaveLength(2)
    expect(graph.nodes.map((n) => n.id)).toEqual(['p1', 'p2'])
    expect(graph.nodes[0].type).toBe('screen')
  })

  it('creates entity nodes from dataEntities', () => {
    const doc = makeDoc({
      dataEntities: [
        { id: 'e1', name: 'Users', fields: [], rows: [], views: [] },
      ],
    })
    const graph = buildWorkflowGraph(doc)
    expect(graph.nodes).toHaveLength(1)
    expect(graph.nodes[0]).toEqual({ id: 'e1', label: 'Users', type: 'entity' })
  })

  it('creates connection edges with labels', () => {
    const doc = makeDoc({
      pages: [
        { id: 'p1', name: 'Home', type: 'screen', children: [] },
        { id: 'p2', name: 'About', type: 'screen', children: [] },
      ],
      connections: [
        {
          id: 'c1',
          sourceElementId: 'btn1',
          sourcePageId: 'p1',
          targetPageId: 'p2',
          triggerEvent: 'click',
          transitionType: 'push',
        },
      ],
    })
    const graph = buildWorkflowGraph(doc)
    expect(graph.edges).toHaveLength(1)
    expect(graph.edges[0]).toEqual({
      source: 'p1',
      target: 'p2',
      type: 'connection',
      label: 'click → push',
    })
  })

  it('creates data binding edges (page → entity)', () => {
    const doc = makeDoc({
      pages: [
        {
          id: 'p1', name: 'Dashboard', type: 'screen',
          children: [
            { id: 'n1', type: 'frame', dataBinding: { entityId: 'e1', fieldMappings: [] }, children: [] } as any,
          ],
        },
      ],
      dataEntities: [
        { id: 'e1', name: 'Orders', fields: [], rows: [], views: [] },
      ],
    })
    const graph = buildWorkflowGraph(doc)
    const bindEdge = graph.edges.find((e) => e.type === 'data-binding')
    expect(bindEdge).toBeDefined()
    expect(bindEdge!.source).toBe('p1')
    expect(bindEdge!.target).toBe('e1')
  })

  it('creates entity relation edges', () => {
    const doc = makeDoc({
      dataEntities: [
        {
          id: 'e1', name: 'Users',
          fields: [{ id: 'f1', name: 'orders', type: 'relation', relatedEntityId: 'e2' }],
          rows: [], views: [],
        },
        { id: 'e2', name: 'Orders', fields: [], rows: [], views: [] },
      ],
    })
    const graph = buildWorkflowGraph(doc)
    const relEdge = graph.edges.find((e) => e.type === 'entity-relation')
    expect(relEdge).toBeDefined()
    expect(relEdge!.source).toBe('e1')
    expect(relEdge!.target).toBe('e2')
  })

  it('deduplicates edges', () => {
    const doc = makeDoc({
      pages: [
        { id: 'p1', name: 'A', type: 'screen', children: [] },
        { id: 'p2', name: 'B', type: 'screen', children: [] },
      ],
      connections: [
        { id: 'c1', sourceElementId: 'x', sourcePageId: 'p1', targetPageId: 'p2', triggerEvent: 'click', transitionType: 'push' },
        { id: 'c2', sourceElementId: 'y', sourcePageId: 'p1', targetPageId: 'p2', triggerEvent: 'hover', transitionType: 'modal' },
      ],
    })
    const graph = buildWorkflowGraph(doc)
    // Same source→target should be deduplicated
    expect(graph.edges.filter((e) => e.type === 'connection')).toHaveLength(1)
  })
})

describe('filterGraphByFocus', () => {
  const graph = {
    nodes: [
      { id: 'p1', label: 'Home', type: 'screen' as const },
      { id: 'p2', label: 'About', type: 'screen' as const },
      { id: 'p3', label: 'Contact', type: 'screen' as const },
      { id: 'p4', label: 'Settings', type: 'screen' as const },
      { id: 'e1', label: 'Users', type: 'entity' as const },
    ],
    edges: [
      { source: 'p1', target: 'p2', type: 'connection' as const, label: 'click → push' },
      { source: 'p2', target: 'p3', type: 'connection' as const, label: 'click → push' },
      { source: 'p3', target: 'p4', type: 'connection' as const, label: 'click → push' },
      { source: 'p1', target: 'e1', type: 'data-binding' as const },
    ],
  }

  it('returns active page + 1-hop neighbors', () => {
    const focused = filterGraphByFocus(graph, 'p2')
    expect(focused.nodes.map((n) => n.id).sort()).toEqual(['e1', 'p1', 'p2', 'p3'])
  })

  it('includes entities connected to visible pages', () => {
    const focused = filterGraphByFocus(graph, 'p1')
    expect(focused.nodes.map((n) => n.id).sort()).toEqual(['e1', 'p1', 'p2'])
  })

  it('isolated page returns just that page', () => {
    const isolated = filterGraphByFocus({
      nodes: [{ id: 'lonely', label: 'Lonely', type: 'screen' }],
      edges: [],
    }, 'lonely')
    expect(isolated.nodes).toHaveLength(1)
  })
})
