import { describe, it, expect } from 'vitest'
import { isMermaidContent, wrapBareMermaid } from '../flow-section'

describe('isMermaidContent', () => {
  it('detects flowchart keyword', () => {
    expect(isMermaidContent('flowchart TD\n  A-->B')).toBe(true)
  })

  it('detects graph keyword', () => {
    expect(isMermaidContent('graph LR\n  A-->B')).toBe(true)
  })

  it('detects sequenceDiagram keyword', () => {
    expect(isMermaidContent('sequenceDiagram\n  Alice->>Bob: Hi')).toBe(true)
  })

  it('detects erDiagram keyword', () => {
    expect(isMermaidContent('erDiagram\n  USER ||--o{ ORDER : places')).toBe(true)
  })

  it('detects gantt keyword', () => {
    expect(isMermaidContent('gantt\n  title A Gantt')).toBe(true)
  })

  it('detects mindmap keyword', () => {
    expect(isMermaidContent('mindmap\n  root((Root))')).toBe(true)
  })

  it('returns false for plain text', () => {
    expect(isMermaidContent('Hello world')).toBe(false)
  })

  it('returns false for code that is not mermaid', () => {
    expect(isMermaidContent('const x = 1;\nconsole.log(x);')).toBe(false)
  })

  it('handles leading whitespace', () => {
    expect(isMermaidContent('  flowchart TD\n  A-->B')).toBe(true)
  })
})

describe('wrapBareMermaid', () => {
  it('wraps bare mermaid blocks in code fences', () => {
    const input = 'Some text\n\nflowchart TD\n  A-->B\n  B-->C\n\nMore text'
    const result = wrapBareMermaid(input)
    expect(result).toContain('```mermaid')
    expect(result).toContain('flowchart TD')
    expect(result).toContain('```')
    expect(result).toContain('Some text')
    expect(result).toContain('More text')
  })

  it('does not double-wrap already fenced mermaid blocks', () => {
    const input = 'Text\n\n```mermaid\nflowchart TD\n  A-->B\n```\n\nMore'
    const result = wrapBareMermaid(input)
    // Count occurrences of ```mermaid
    const mermaidFences = (result.match(/```mermaid/g) || []).length
    expect(mermaidFences).toBe(1)
  })

  it('wraps multiple bare mermaid blocks', () => {
    const input = 'flowchart TD\n  A-->B\n\nsequenceDiagram\n  Alice->>Bob: Hi'
    const result = wrapBareMermaid(input)
    const mermaidFences = (result.match(/```mermaid/g) || []).length
    expect(mermaidFences).toBe(2)
  })

  it('handles empty content', () => {
    expect(wrapBareMermaid('')).toBe('')
  })

  it('handles content with no mermaid blocks', () => {
    const input = '# Title\n\nJust plain markdown.'
    const result = wrapBareMermaid(input)
    expect(result).toBe(input)
    expect(result).not.toContain('```mermaid')
  })

  it('stops bare mermaid block at blank line', () => {
    const input = 'flowchart TD\n  A-->B\n\nThis is a paragraph'
    const result = wrapBareMermaid(input)
    // The paragraph should NOT be inside the mermaid fence
    const lines = result.split('\n')
    const mermaidEndIndex = lines.indexOf('```')
    const paragraphIndex = lines.indexOf('This is a paragraph')
    expect(paragraphIndex).toBeGreaterThan(mermaidEndIndex)
  })

  it('stops bare mermaid block at heading', () => {
    const input = 'flowchart TD\n  A-->B\n## Section'
    const result = wrapBareMermaid(input)
    const lines = result.split('\n')
    const closeFenceIdx = lines.indexOf('```')
    const sectionIdx = lines.indexOf('## Section')
    expect(sectionIdx).toBeGreaterThan(closeFenceIdx)
  })
})
