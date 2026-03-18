import { describe, expect, it } from 'vitest'
import { generatePreviewHTML } from '@/services/preview/preview-html-generator'
import type { PenDocument, FrameNode, ImageNode, TextNode } from '@/types/pen'

function makeDoc(overrides: Partial<PenDocument> = {}): PenDocument {
  return {
    version: '1',
    children: [],
    ...overrides,
  }
}

describe('Preview security', () => {
  it('generated HTML contains CSP meta tag with strict policy', () => {
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
              children: [
                { id: 't1', type: 'text', content: 'Hello' } as TextNode,
              ],
            } as FrameNode,
          ],
        },
      ],
    })

    const html = generatePreviewHTML(doc, 'p1', null, 'sec-test-1')

    expect(html).toContain('Content-Security-Policy')
    expect(html).toContain("default-src 'none'")
    expect(html).toContain("script-src 'unsafe-inline'")
    expect(html).toContain("style-src 'unsafe-inline'")
    expect(html).toContain('img-src data: blob:')
    expect(html).toContain('font-src data:')
  })

  it('generated HTML contains no external http:// or https:// URLs in src/href attributes', () => {
    const doc = makeDoc({
      pages: [
        {
          id: 'p1',
          name: 'Test',
          type: 'screen',
          children: [
            {
              id: 'img1',
              type: 'image',
              name: 'photo',
              src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ',
              width: 200,
              height: 150,
            } as ImageNode,
            {
              id: 'f1',
              type: 'frame',
              width: 400,
              height: 300,
              children: [
                { id: 't1', type: 'text', content: 'Sample text' } as TextNode,
              ],
            } as FrameNode,
          ],
        },
      ],
    })

    const html = generatePreviewHTML(doc, 'p1', null, 'sec-test-2')

    // Remove the SSE EventSource URL (that's an internal API path, not an external URL)
    // and the CSP meta tag line (which contains policy keywords, not external URLs)
    const htmlWithoutScript = html.replace(/<script>[\s\S]*?<\/script>/, '')

    // Should contain no external http/https URLs
    const externalUrlPattern = /(?:src|href)\s*=\s*["']https?:\/\//i
    expect(htmlWithoutScript).not.toMatch(externalUrlPattern)
  })
})
