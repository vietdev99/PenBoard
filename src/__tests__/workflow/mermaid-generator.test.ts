import { describe, it, expect } from 'vitest'
import { generateMermaid } from '@/services/workflow/mermaid-generator'
import type { WorkflowGraph } from '@/services/workflow/graph-builder'

describe('generateMermaid', () => {
  it('empty graph → placeholder', () => {
    const result = generateMermaid({ nodes: [], edges: [] })
    expect(result).toContain('graph LR')
    expect(result).toContain('No pages')
  })

  it('screen nodes use rectangle shape', () => {
    const graph: WorkflowGraph = {
      nodes: [{ id: 'p1', label: 'Home', type: 'screen' }],
      edges: [],
    }
    const result = generateMermaid(graph)
    expect(result).toContain('["Home"]')
    expect(result).toContain(':::screen')
  })

  it('entity nodes use cylinder shape', () => {
    const graph: WorkflowGraph = {
      nodes: [{ id: 'e1', label: 'Users', type: 'entity' }],
      edges: [],
    }
    const result = generateMermaid(graph)
    expect(result).toContain('[("Users")]')
    expect(result).toContain(':::entity')
  })

  it('connection edges have labels', () => {
    const graph: WorkflowGraph = {
      nodes: [
        { id: 'p1', label: 'Home', type: 'screen' },
        { id: 'p2', label: 'About', type: 'screen' },
      ],
      edges: [
        { source: 'p1', target: 'p2', type: 'connection', label: 'click → push' },
      ],
    }
    const result = generateMermaid(graph)
    expect(result).toContain('-->|')
    expect(result).toContain('click')
  })

  it('data binding edges are dashed', () => {
    const graph: WorkflowGraph = {
      nodes: [
        { id: 'p1', label: 'Dash', type: 'screen' },
        { id: 'e1', label: 'Table', type: 'entity' },
      ],
      edges: [
        { source: 'p1', target: 'e1', type: 'data-binding' },
      ],
    }
    const result = generateMermaid(graph)
    expect(result).toContain('-.->') // dashed arrow
  })

  it('entity relation edges are plain', () => {
    const graph: WorkflowGraph = {
      nodes: [
        { id: 'e1', label: 'Users', type: 'entity' },
        { id: 'e2', label: 'Orders', type: 'entity' },
      ],
      edges: [
        { source: 'e1', target: 'e2', type: 'entity-relation' },
      ],
    }
    const result = generateMermaid(graph)
    expect(result).toContain(' --- ') // plain line
  })

  it('escapes special characters in labels', () => {
    const graph: WorkflowGraph = {
      nodes: [{ id: 'p1', label: 'Page "One" [test]', type: 'screen' }],
      edges: [],
    }
    const result = generateMermaid(graph)
    // Should not contain raw " or [ ]
    expect(result).not.toContain('Page "One"')
    expect(result).not.toContain('[test]')
  })

  it('produces valid mermaid with mixed content', () => {
    const graph: WorkflowGraph = {
      nodes: [
        { id: 'p1', label: 'Home', type: 'screen' },
        { id: 'p2', label: 'Dashboard', type: 'screen' },
        { id: 'e1', label: 'Users', type: 'entity' },
      ],
      edges: [
        { source: 'p1', target: 'p2', type: 'connection', label: 'click → push' },
        { source: 'p2', target: 'e1', type: 'data-binding' },
      ],
    }
    const result = generateMermaid(graph)
    expect(result).toMatch(/^graph LR/)
    expect(result).toContain('classDef screen')
    expect(result).toContain('classDef entity')
  })
})
