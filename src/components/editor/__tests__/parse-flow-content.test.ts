import { describe, it, expect } from 'vitest'
import { parseFlowContent } from '../flow-section'

describe('parseFlowContent', () => {
  it('extracts a single mermaid block and description', () => {
    const content = '# Auth Flow\n\nLogin process description.\n\n```mermaid\nflowchart TD\n  A-->B\n```\n\n## Notes\n\nSome notes here.'
    const result = parseFlowContent(content)
    expect(result.mermaidBlocks).toEqual(['flowchart TD\n  A-->B'])
    expect(result.description).toContain('Login process description.')
    expect(result.description).toContain('Some notes here.')
    // H1 title should be stripped from description
    expect(result.description).not.toContain('# Auth Flow')
  })

  it('extracts multiple mermaid blocks in order', () => {
    const content = '# Multi\n\nIntro.\n\n```mermaid\nflowchart TD\n  A-->B\n```\n\nMiddle text.\n\n```mermaid\nsequenceDiagram\n  Alice->>Bob: Hi\n```'
    const result = parseFlowContent(content)
    expect(result.mermaidBlocks).toHaveLength(2)
    expect(result.mermaidBlocks[0]).toContain('flowchart TD')
    expect(result.mermaidBlocks[1]).toContain('sequenceDiagram')
  })

  it('returns empty mermaidBlocks when no mermaid fences', () => {
    const content = '# Title\n\nJust plain markdown with no diagrams.'
    const result = parseFlowContent(content)
    expect(result.mermaidBlocks).toEqual([])
    expect(result.description).toContain('Just plain markdown')
  })

  it('handles empty content', () => {
    const result = parseFlowContent('')
    expect(result.mermaidBlocks).toEqual([])
    expect(result.description).toBe('')
  })

  it('strips H1 title from description', () => {
    const content = '# My Flow Title\n\nBody text here.'
    const result = parseFlowContent(content)
    expect(result.description).not.toMatch(/^#\s+My Flow Title/m)
    expect(result.description).toContain('Body text here.')
  })

  it('does not strip H2 or lower headings', () => {
    const content = '# Title\n\n## Section One\n\nContent.'
    const result = parseFlowContent(content)
    expect(result.description).toContain('## Section One')
  })
})
