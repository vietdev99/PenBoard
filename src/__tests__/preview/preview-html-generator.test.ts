import { describe, expect, it } from 'vitest'
import { generatePreviewHTML, generatePageHTML } from '@/services/preview/preview-html-generator'
import type { PenDocument, PenNode, FrameNode, TextNode, ImageNode, PathNode, RefNode } from '@/types/pen'
import type { ScreenConnection } from '@/types/pen'

/** Helper to build a minimal PenDocument */
function makeDoc(overrides: Partial<PenDocument> = {}): PenDocument {
  return {
    version: '1',
    children: [],
    ...overrides,
  }
}

describe('generatePreviewHTML', () => {
  it('returns a full HTML document with DOCTYPE, html, head, body', () => {
    const doc = makeDoc({
      pages: [
        {
          id: 'p1',
          name: 'Home',
          type: 'screen',
          children: [
            {
              id: 'f1',
              type: 'frame',
              width: 400,
              height: 300,
              children: [
                { id: 't1', type: 'text', content: 'Hello' } as TextNode,
              ],
            } as FrameNode,
          ],
        },
      ],
    })

    const html = generatePreviewHTML(doc, 'p1', null, 'preview-1')
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<html')
    expect(html).toContain('<head>')
    expect(html).toContain('<body>')
    expect(html).toContain('</html>')
  })

  it('contains CSP meta tag with strict policy', () => {
    const doc = makeDoc({
      pages: [
        {
          id: 'p1',
          name: 'Test',
          type: 'screen',
          children: [
            { id: 'f1', type: 'frame', width: 100, height: 100 } as FrameNode,
          ],
        },
      ],
    })

    const html = generatePreviewHTML(doc, 'p1', null, 'preview-1')
    expect(html).toContain('Content-Security-Policy')
    expect(html).toContain("default-src 'none'")
    expect(html).toContain("script-src 'unsafe-inline'")
    expect(html).toContain("style-src 'unsafe-inline'")
    expect(html).toContain('img-src data: blob:')
    expect(html).toContain('font-src data:')
  })

  it('contains <style> block with CSS rules', () => {
    const doc = makeDoc({
      pages: [
        {
          id: 'p1',
          name: 'Test',
          type: 'screen',
          children: [
            {
              id: 'f1',
              type: 'frame',
              width: 200,
              height: 100,
              fill: [{ type: 'solid', color: '#FF0000' }],
            } as FrameNode,
          ],
        },
      ],
    })

    const html = generatePreviewHTML(doc, 'p1', null, 'preview-1')
    expect(html).toContain('<style>')
    expect(html).toContain('</style>')
    // Should have CSS rule for the frame
    expect(html).toContain('#FF0000')
  })

  it('produces :root { --var-name: value } block with document variables', () => {
    const doc = makeDoc({
      variables: {
        'brand-color': { type: 'color', value: '#3366FF' },
        spacing: { type: 'number', value: 16 },
      },
      pages: [
        {
          id: 'p1',
          name: 'Test',
          type: 'screen',
          children: [
            { id: 'f1', type: 'frame', width: 100, height: 100 } as FrameNode,
          ],
        },
      ],
    })

    const html = generatePreviewHTML(doc, 'p1', null, 'preview-1')
    expect(html).toContain(':root')
    expect(html).toContain('--brand-color')
    expect(html).toContain('#3366FF')
  })
})

describe('generatePageHTML', () => {
  it('produces nested div/semantic HTML from frame with children', () => {
    const nodes: PenNode[] = [
      {
        id: 'f1',
        type: 'frame',
        width: 400,
        height: 300,
        children: [
          { id: 't1', type: 'text', content: 'Title', fontSize: 24 } as TextNode,
          {
            id: 'f2',
            type: 'frame',
            width: 200,
            height: 100,
            children: [],
          } as FrameNode,
        ],
      } as FrameNode,
    ]

    const result = generatePageHTML(nodes, [])
    expect(result.html).toContain('Title')
    expect(result.css).toBeTruthy()
  })

  it('generates <button> tag for text nodes with button role', () => {
    const nodes: PenNode[] = [
      {
        id: 'btn1',
        type: 'frame',
        role: 'button',
        width: 120,
        height: 40,
        children: [
          { id: 't1', type: 'text', content: 'Submit' } as TextNode,
        ],
      } as FrameNode,
    ]

    const result = generatePageHTML(nodes, [])
    expect(result.html).toContain('<button')
    expect(result.html).toContain('Submit')
  })

  it('generates <img> tag for image nodes', () => {
    const nodes: PenNode[] = [
      {
        id: 'img1',
        type: 'image',
        name: 'photo',
        src: 'data:image/png;base64,iVBORw0KGgo=',
        width: 200,
        height: 150,
      } as ImageNode,
    ]

    const result = generatePageHTML(nodes, [])
    expect(result.html).toContain('<img')
    expect(result.html).toContain('data:image/png;base64')
    expect(result.html).toContain('alt=')
  })

  it('generates inline SVG for path nodes with iconId', () => {
    const nodes: PenNode[] = [
      {
        id: 'icon1',
        type: 'path',
        iconId: 'lucide:home',
        d: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z',
        width: 24,
        height: 24,
        fill: [{ type: 'solid', color: '#000000' }],
      } as PathNode,
    ]

    const result = generatePageHTML(nodes, [])
    expect(result.html).toContain('<svg')
    expect(result.html).toContain('<path')
    expect(result.html).toContain('M3 9l9-7')
  })

  it('generates <input> for input-role nodes', () => {
    const nodes: PenNode[] = [
      {
        id: 'inp1',
        type: 'frame',
        role: 'input',
        width: 200,
        height: 40,
        children: [
          { id: 't1', type: 'text', content: 'Enter name...' } as TextNode,
        ],
      } as FrameNode,
    ]

    const result = generatePageHTML(nodes, [])
    expect(result.html).toContain('<input')
    expect(result.html).toContain('placeholder=')
  })

  it('generates <textarea> for textarea-role nodes', () => {
    const nodes: PenNode[] = [
      {
        id: 'ta1',
        type: 'frame',
        role: 'textarea',
        width: 300,
        height: 100,
        children: [
          { id: 't1', type: 'text', content: 'Write here...' } as TextNode,
        ],
      } as FrameNode,
    ]

    const result = generatePageHTML(nodes, [])
    expect(result.html).toContain('<textarea')
    expect(result.html).toContain('placeholder=')
  })

  it('generates <select> with <option> for dropdown-role data-bound nodes', () => {
    const nodes: PenNode[] = [
      {
        id: 'dd1',
        type: 'frame',
        role: 'dropdown',
        width: 200,
        height: 40,
        dataBinding: { entityId: 'ent-1', fieldMappings: [] },
        children: [
          { id: 'opt1', type: 'text', content: 'Option A' } as TextNode,
          { id: 'opt2', type: 'text', content: 'Option B' } as TextNode,
        ],
      } as FrameNode,
    ]

    const result = generatePageHTML(nodes, [])
    expect(result.html).toContain('<select')
    expect(result.html).toContain('<option')
    expect(result.html).toContain('Option A')
    expect(result.html).toContain('Option B')
  })

  it('does not produce external resource URLs in output', () => {
    const nodes: PenNode[] = [
      {
        id: 'img1',
        type: 'image',
        src: 'data:image/png;base64,abc123',
        width: 100,
        height: 100,
      } as ImageNode,
    ]

    const result = generatePageHTML(nodes, [])
    expect(result.html).not.toMatch(/https?:\/\//)
  })

  it('adds data-nav-click attribute for click connections', () => {
    const nodes: PenNode[] = [
      {
        id: 'btn1',
        type: 'frame',
        role: 'button',
        width: 100,
        height: 40,
        children: [
          { id: 't1', type: 'text', content: 'Go' } as TextNode,
        ],
      } as FrameNode,
    ]

    const connections: ScreenConnection[] = [
      {
        id: 'c1',
        sourceElementId: 'btn1',
        sourcePageId: 'p1',
        targetPageId: 'p2',
        triggerEvent: 'click',
        transitionType: 'push',
      },
    ]

    const result = generatePageHTML(nodes, connections)
    expect(result.html).toContain('data-nav-click')
    expect(result.html).toContain('tabindex="0"')
  })

  it('adds data-nav-hover attribute for hover connections', () => {
    const nodes: PenNode[] = [
      {
        id: 'card1',
        type: 'frame',
        width: 200,
        height: 150,
      } as FrameNode,
    ]

    const connections: ScreenConnection[] = [
      {
        id: 'c1',
        sourceElementId: 'card1',
        sourcePageId: 'p1',
        targetPageId: 'p3',
        triggerEvent: 'hover',
        transitionType: 'push',
      },
    ]

    const result = generatePageHTML(nodes, connections)
    expect(result.html).toContain('data-nav-hover')
    expect(result.html).toContain('tabindex="0"')
  })

  it('expands RefNodes into actual component markup', () => {
    // This test verifies that by the time generatePageHTML runs,
    // RefNodes should already be expanded by the resolver.
    // If a ref node somehow reaches the generator, it falls back gracefully.
    const nodes: PenNode[] = [
      {
        id: 'ref1',
        type: 'ref',
        ref: 'comp-1',
      } as RefNode,
    ]

    const result = generatePageHTML(nodes, [])
    // Should produce a comment fallback, not crash
    expect(result.html).toContain('Component')
  })
})
