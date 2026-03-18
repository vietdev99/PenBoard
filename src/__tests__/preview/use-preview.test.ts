// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePreview } from '@/hooks/use-preview'
import { useDocumentStore } from '@/stores/document-store'
import { useCanvasStore } from '@/stores/canvas-store'
import type { PenDocument } from '@/types/pen'

// Mock generatePreviewHTML to return a deterministic string
vi.mock('@/services/preview/preview-html-generator', () => ({
  generatePreviewHTML: vi.fn(
    (_doc: any, _pageId: any, _frameId: any, previewId: string) =>
      `<html><body>preview-${previewId}</body></html>`,
  ),
}))

// Mock fetch globally
const mockFetch = vi.fn().mockResolvedValue({ ok: true })
vi.stubGlobal('fetch', mockFetch)

// Mock window.open
const mockWindowOpen = vi.fn()
vi.stubGlobal('open', mockWindowOpen)

// Minimal document for testing
function makeDoc(overrides: Partial<PenDocument> = {}): PenDocument {
  return {
    version: '1',
    children: [{ id: 'frame-1', type: 'frame' as const }],
    ...overrides,
  } as PenDocument
}

describe('usePreview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset stores to clean state
    useDocumentStore.setState({
      document: makeDoc(),
    })
    useCanvasStore.setState({
      activePageId: null,
      selection: { selectedIds: [], activeId: null, hoveredId: null, enteredFrameId: null, enteredFrameStack: [] },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns openPreview function and previewId string', () => {
    const { result } = renderHook(() => usePreview())

    expect(typeof result.current.openPreview).toBe('function')
    expect(typeof result.current.previewId).toBe('string')
    expect(result.current.previewId.length).toBeGreaterThan(0)
  })

  it('POSTs generated HTML when openPreview is called', async () => {
    const doc = makeDoc({ name: 'Test Doc' })
    useDocumentStore.setState({ document: doc })
    useCanvasStore.setState({
      activePageId: 'page-1',
      selection: { selectedIds: ['frame-1'], activeId: 'frame-1', hoveredId: null, enteredFrameId: null, enteredFrameStack: [] },
    })

    const { result } = renderHook(() => usePreview())

    await act(async () => {
      await result.current.openPreview()
    })

    // Should POST to /api/preview/data
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/preview/data'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    // Parse the body and verify shape: { id, html }
    const call = mockFetch.mock.calls[0]
    const body = JSON.parse(call[1].body)
    expect(body).toHaveProperty('id')
    expect(body).toHaveProperty('html')
    expect(body.html).toContain('<html>')
    expect(body.html).toContain('preview-')
  })

  it('filters out non-screen page types (e.g. ERD pages)', async () => {
    const doc = makeDoc({
      pages: [
        { id: 'erd-page', name: 'ERD', type: 'erd', children: [] },
      ],
    })
    useDocumentStore.setState({ document: doc })
    useCanvasStore.setState({
      activePageId: 'erd-page',
      selection: { selectedIds: [], activeId: null, hoveredId: null, enteredFrameId: null, enteredFrameStack: [] },
    })

    const { result } = renderHook(() => usePreview())

    await act(async () => {
      await result.current.openPreview()
    })

    // fetch should NOT be called because the page type is 'erd'
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('opens preview in new browser tab for non-Electron', async () => {
    useDocumentStore.setState({ document: makeDoc() })

    const { result } = renderHook(() => usePreview())

    await act(async () => {
      await result.current.openPreview()
    })

    // window.open should be called with a preview URL
    expect(mockWindowOpen).toHaveBeenCalledWith(
      expect.stringContaining('/api/preview/'),
      expect.stringContaining('preview-'),
    )
  })

  it('debounces document change subscriptions at 500ms', async () => {
    vi.useFakeTimers()
    const doc = makeDoc()
    useDocumentStore.setState({ document: doc })

    const { unmount } = renderHook(() => usePreview())

    // Wait for any pending timers from mount, then clear
    await act(async () => {
      vi.runAllTimers()
    })

    // Track calls from this point only
    const callCountBefore = mockFetch.mock.calls.length

    // Trigger multiple document updates rapidly
    act(() => {
      useDocumentStore.setState({ document: makeDoc({ name: 'Update 1' }) })
    })
    act(() => {
      useDocumentStore.setState({ document: makeDoc({ name: 'Update 2' }) })
    })
    act(() => {
      useDocumentStore.setState({ document: makeDoc({ name: 'Update 3' }) })
    })

    // No new fetch calls yet (debounced, 500ms hasn't elapsed)
    const callsAfterUpdates = mockFetch.mock.calls.length - callCountBefore
    expect(callsAfterUpdates).toBe(0)

    // Advance time past debounce window
    await act(async () => {
      vi.advanceTimersByTime(600)
    })

    // After 600ms, debounce fires -- at least 1 new call
    const callsAfterDebounce = mockFetch.mock.calls.length - callCountBefore
    expect(callsAfterDebounce).toBeGreaterThanOrEqual(1)

    unmount()
    vi.useRealTimers()
  })
})
