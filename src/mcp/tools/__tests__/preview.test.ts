import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleGeneratePreview } from '../preview'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../document-manager', () => ({
  resolveDocPath: (fp?: string) => fp ?? 'live://canvas',
  openDocument: vi.fn(),
  getSyncUrl: vi.fn(),
}))

vi.mock('../../utils/id', () => ({
  generateId: () => 'test-preview-id',
}))

vi.mock('../../../services/preview/preview-html-generator', () => ({
  generatePreviewHTML: vi.fn(() => '<html>preview</html>'),
}))

import { openDocument, getSyncUrl } from '../../document-manager'

const mockOpenDocument = vi.mocked(openDocument)
const mockGetSyncUrl = vi.mocked(getSyncUrl)

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

function makeDoc(pages: Array<{ id: string; name: string; type?: string }>) {
  return {
    version: '1.0.0',
    pages: pages.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type ?? 'screen',
      children: [
        {
          id: `frame-${p.id}`,
          type: 'frame',
          name: 'Frame',
          width: 1200,
          height: 800,
          children: [],
        },
      ],
    })),
    children: [],
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generate_preview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSyncUrl.mockResolvedValue('http://127.0.0.1:3000')
    // Mock global fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    })
  })

  it('rejects ERD pages', async () => {
    mockOpenDocument.mockResolvedValue(
      makeDoc([{ id: 'page-erd', name: 'ERD Page', type: 'erd' }]) as any,
    )

    await expect(
      handleGeneratePreview({ pageId: 'page-erd' }),
    ).rejects.toThrow('Only screen pages are previewable')
  })

  it('rejects component pages', async () => {
    mockOpenDocument.mockResolvedValue(
      makeDoc([
        { id: 'page-comp', name: 'Components', type: 'component' },
      ]) as any,
    )

    await expect(
      handleGeneratePreview({ pageId: 'page-comp' }),
    ).rejects.toThrow('Only screen pages are previewable')
  })

  it('throws if page not found', async () => {
    mockOpenDocument.mockResolvedValue(
      makeDoc([{ id: 'page-1', name: 'Home' }]) as any,
    )

    await expect(
      handleGeneratePreview({ pageId: 'nonexistent' }),
    ).rejects.toThrow('Page not found: nonexistent')
  })

  it('throws if no PenBoard instance running', async () => {
    mockOpenDocument.mockResolvedValue(
      makeDoc([{ id: 'page-1', name: 'Home' }]) as any,
    )
    mockGetSyncUrl.mockResolvedValue(null)

    await expect(
      handleGeneratePreview({ pageId: 'page-1' }),
    ).rejects.toThrow('No running PenBoard instance found')
  })

  it('generates preview and returns URL for screen page', async () => {
    mockOpenDocument.mockResolvedValue(
      makeDoc([{ id: 'page-1', name: 'Home' }]) as any,
    )

    const result = await handleGeneratePreview({ pageId: 'page-1' })

    expect(result.previewId).toBe('test-preview-id')
    expect(result.url).toBe('http://127.0.0.1:3000/preview/test-preview-id')
    expect(result.pageName).toBe('Home')
    expect(result.pageId).toBe('page-1')
    expect(result.frameId).toBeNull()

    // Verify fetch was called with the preview data
    expect(global.fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:3000/api/preview/data',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  })

  it('passes frameId when provided', async () => {
    mockOpenDocument.mockResolvedValue(
      makeDoc([{ id: 'page-1', name: 'Home' }]) as any,
    )

    const result = await handleGeneratePreview({
      pageId: 'page-1',
      frameId: 'frame-page-1',
    })

    expect(result.frameId).toBe('frame-page-1')
    expect(global.fetch).toHaveBeenCalled()
  })
})
