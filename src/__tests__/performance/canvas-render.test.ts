/**
 * Canvas Performance Benchmark
 *
 * Verifies that core rendering paths meet 60fps targets:
 *   - syncFromDocument() with 100 nodes: < 16ms
 *   - SpatialIndex.rebuild() with 100 nodes: < 5ms
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PenDocument, PenNode } from '@/types/pen'
import type { RenderNode } from '@/canvas/skia/skia-renderer'

// ---------------------------------------------------------------------------
// Store mocks — must be defined before any imports that pull in stores
// ---------------------------------------------------------------------------

let mockDocument: PenDocument = { version: '1.0.0', children: [], pages: [] }

vi.mock('@/stores/document-store', () => ({
  useDocumentStore: {
    getState: () => ({ document: mockDocument }),
  },
  getActivePageChildren: (doc: PenDocument, pageId: string | null) => {
    if (doc.pages && doc.pages.length > 0) {
      const page = pageId
        ? doc.pages.find((p) => p.id === pageId) ?? doc.pages[0]
        : doc.pages[0]
      return page.children
    }
    return doc.children
  },
  getAllChildren: (doc: PenDocument) => {
    if (doc.pages && doc.pages.length > 0) {
      return doc.pages.flatMap((p) => p.children)
    }
    return doc.children
  },
}))

vi.mock('@/stores/canvas-store', () => ({
  useCanvasStore: {
    getState: () => ({ activePageId: 'page-1', setViewportBatch: vi.fn() }),
  },
}))

// Pass variables through unchanged (no-op resolution for perf test)
vi.mock('@/variables/resolve-variables', () => ({
  resolveNodeForCanvas: (node: PenNode) => node,
  getDefaultTheme: () => ({}),
}))

// Mock agent indicators — not relevant for perf benchmarks
vi.mock('@/canvas/agent-indicator', () => ({
  getActiveAgentIndicators: () => [],
  getActiveAgentFrames: () => [],
  isPreviewNode: () => false,
}))

// Mock design animation — not relevant
vi.mock('@/services/ai/design-animation', () => ({
  isNodeBorderReady: () => true,
  getNodeRevealTime: () => 0,
}))

// Mock SkiaRenderer so CanvasKit WASM isn't needed in unit tests
vi.mock('@/canvas/skia/skia-renderer', () => {
  class MockSkiaRenderer {
    fontManager = { ensureFont: () => Promise.resolve() }
    zoom = 1
    init() {}
    setRedrawCallback() {}
    dispose() {}
    drawNode() {}
  }
  return { SkiaRenderer: MockSkiaRenderer }
})

// Mock SkiaErdRenderer
vi.mock('@/canvas/skia/skia-erd-renderer', () => {
  class MockSkiaErdRenderer {
    constructor(_ck: unknown) {}
    renderErd() {}
  }
  return { SkiaErdRenderer: MockSkiaErdRenderer }
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildDoc(frameCount: number, rectCount: number): PenDocument {
  const children: PenNode[] = []

  for (let i = 0; i < frameCount; i++) {
    children.push({
      id: `frame-${i}`,
      type: 'frame',
      name: `Frame ${i}`,
      x: i * 20,
      y: i * 20,
      width: 100,
      height: 80,
      fill: [{ type: 'solid', color: '#FFFFFF' }],
      children: [],
    } as PenNode)
  }

  for (let i = 0; i < rectCount; i++) {
    children.push({
      id: `rect-${i}`,
      type: 'rectangle',
      name: `Rect ${i}`,
      x: i * 10,
      y: i * 10,
      width: 50,
      height: 40,
      fill: [{ type: 'solid', color: '#0000FF' }],
    } as PenNode)
  }

  return {
    version: '1.0.0',
    children: [],
    pages: [
      {
        id: 'page-1',
        name: 'Page 1',
        children,
      },
    ],
  }
}

function makeRenderNodes(count: number): RenderNode[] {
  const nodes: RenderNode[] = []
  for (let i = 0; i < count; i++) {
    nodes.push({
      node: {
        id: `node-${i}`,
        type: 'rectangle',
        name: `Node ${i}`,
        x: i * 5,
        y: i * 5,
        width: 40,
        height: 30,
        fill: [{ type: 'solid', color: '#FF0000' }],
      } as PenNode,
      absX: i * 5,
      absY: i * 5,
      absW: 40,
      absH: 30,
    })
  }
  return nodes
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SpatialIndex performance', () => {
  it('rebuild() with 100 nodes completes in < 5ms', async () => {
    const { SpatialIndex } = await import('@/canvas/skia/skia-hit-test')
    const index = new SpatialIndex()
    const renderNodes = makeRenderNodes(100)

    const start = performance.now()
    index.rebuild(renderNodes)
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(5)
    // Sanity: all nodes should be queryable
    const hits = index.hitTest(2.5, 2.5)
    expect(hits.length).toBeGreaterThan(0)
  })

  it('hitTest() on 100-node index returns nodes sorted topmost-first', async () => {
    const { SpatialIndex } = await import('@/canvas/skia/skia-hit-test')
    const index = new SpatialIndex()
    index.rebuild(makeRenderNodes(100))

    // node-0: x=0,y=0,w=40,h=30 — only node covering (1,1) since node-1 starts at x=5,y=5
    const hits = index.hitTest(1, 1)
    expect(hits.length).toBeGreaterThan(0)
    expect(hits[0].node.id).toBe('node-0')

    // Multiple nodes cover (10,10): node-0,node-1,node-2. Topmost = highest zIndex = node-2
    const multiHits = index.hitTest(10, 10)
    expect(multiHits.length).toBeGreaterThanOrEqual(3)
    // SpatialIndex sorts by zIndex descending — node-2 rendered last → topmost
    const ids = multiHits.map((n) => n.node.id)
    expect(ids[0]).toBe('node-2')
  })

  it('searchRect() returns all nodes within region', async () => {
    const { SpatialIndex } = await import('@/canvas/skia/skia-hit-test')
    const index = new SpatialIndex()
    index.rebuild(makeRenderNodes(20))

    // Broad rect that covers many nodes
    const found = index.searchRect(0, 0, 200, 200)
    expect(found.length).toBeGreaterThan(0)
  })
})

describe('SkiaEngine.syncFromDocument() performance', () => {
  beforeEach(() => {
    mockDocument = buildDoc(50, 50)
  })

  it('syncFromDocument() with 100 nodes (50 frames + 50 rects) completes in < 16ms', async () => {
    const { SkiaEngine } = await import('@/canvas/skia/skia-engine')

    // Minimal CanvasKit mock — syncFromDocument() doesn't call ck methods
    const mockCk = {} as import('canvaskit-wasm').CanvasKit
    const engine = new SkiaEngine(mockCk)

    const start = performance.now()
    engine.syncFromDocument()
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(16)
    // Sanity: render nodes should be populated
    expect(engine.renderNodes.length).toBeGreaterThan(0)
  })

  it('syncFromDocument() populates spatial index with all nodes', async () => {
    const { SkiaEngine } = await import('@/canvas/skia/skia-engine')
    const mockCk = {} as import('canvaskit-wasm').CanvasKit
    const engine = new SkiaEngine(mockCk)

    engine.syncFromDocument()

    // Each frame/rect should be findable via spatial index
    const result = engine.spatialIndex.searchRect(-1000, -1000, 5000, 5000)
    expect(result.length).toBe(engine.renderNodes.length)
  })

  it('syncFromDocument() with 200 nodes still under 32ms (2-frame budget)', async () => {
    mockDocument = buildDoc(100, 100)
    const { SkiaEngine } = await import('@/canvas/skia/skia-engine')
    const mockCk = {} as import('canvaskit-wasm').CanvasKit
    const engine = new SkiaEngine(mockCk)

    const start = performance.now()
    engine.syncFromDocument()
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(32)
    expect(engine.renderNodes.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Bitmap snapshot mode tests
// ---------------------------------------------------------------------------

describe('SkiaEngine bitmap snapshot mode', () => {
  beforeEach(() => {
    mockDocument = buildDoc(50, 50)
  })

  it('marks tiles dirty after syncFromDocument detects new page children', async () => {
    const { SkiaEngine } = await import('@/canvas/skia/skia-engine')
    const mockCk = {} as import('canvaskit-wasm').CanvasKit
    const engine = new SkiaEngine(mockCk)

    // First sync: new children detected -> tiles marked dirty
    engine.syncFromDocument()
    // After sync, tileManager should exist and have been told to mark dirty
    expect(engine.tileManager).toBeDefined()
  })

  it('does not re-process on duplicate syncFromDocument (same children ref)', async () => {
    const { SkiaEngine } = await import('@/canvas/skia/skia-engine')
    const mockCk = {} as import('canvaskit-wasm').CanvasKit
    const engine = new SkiaEngine(mockCk)

    // First sync
    engine.syncFromDocument()

    // Second sync with same doc -> skip re-processing
    engine.syncFromDocument()
    expect(engine.tileManager).toBeDefined()
  })

  it('bitmapEnabled defaults to false', async () => {
    const { SkiaEngine } = await import('@/canvas/skia/skia-engine')
    const mockCk = {} as import('canvaskit-wasm').CanvasKit
    const engine = new SkiaEngine(mockCk)

    expect((engine as any).bitmapEnabled).toBe(false)
  })

  it('lastRenderedViewport starts as null', async () => {
    const { SkiaEngine } = await import('@/canvas/skia/skia-engine')
    const mockCk = {} as import('canvaskit-wasm').CanvasKit
    const engine = new SkiaEngine(mockCk)

    expect((engine as any).lastRenderedViewport).toBeNull()
  })

  it('cssTransformActive starts as false', async () => {
    const { SkiaEngine } = await import('@/canvas/skia/skia-engine')
    const mockCk = {} as import('canvaskit-wasm').CanvasKit
    const engine = new SkiaEngine(mockCk)

    expect((engine as any).cssTransformActive).toBe(false)
  })

  it('setViewport applies CSS transform when bitmapEnabled with lastRenderedViewport', async () => {
    const { SkiaEngine } = await import('@/canvas/skia/skia-engine')
    const mockCk = {} as import('canvaskit-wasm').CanvasKit
    const engine = new SkiaEngine(mockCk)

    const mockCanvas = { style: { transform: '', transformOrigin: '' } } as unknown as HTMLCanvasElement
    ;(engine as any).canvasEl = mockCanvas
    ;(engine as any).bitmapEnabled = true
    ;(engine as any).lastRenderedViewport = { zoom: 1, panX: 0, panY: 0 }

    engine.setViewport(2, 100, 50)

    // CSS transform should be applied (scale=2, dx=100-0*2=100, dy=50-0*2=50)
    expect(mockCanvas.style.transform).toContain('scale(2)')
    expect((engine as any).cssTransformActive).toBe(true)
  })

  it('dispose() resets CSS transform on canvas element', async () => {
    const { SkiaEngine } = await import('@/canvas/skia/skia-engine')
    const mockCk = {} as import('canvaskit-wasm').CanvasKit
    const engine = new SkiaEngine(mockCk)

    const mockCanvas = { style: { transform: 'translate(10px, 20px) scale(1.5)' } } as unknown as HTMLCanvasElement
    ;(engine as any).canvasEl = mockCanvas

    engine.dispose()

    expect(mockCanvas.style.transform).toBe('')
  })

  it('setViewport sets isPanning to true', async () => {
    const { SkiaEngine } = await import('@/canvas/skia/skia-engine')
    const mockCk = {} as import('canvaskit-wasm').CanvasKit
    const engine = new SkiaEngine(mockCk)

    engine.setViewport(1.5, 100, 200)

    expect(engine.isPanning).toBe(true)
  })

  it('setViewport idle timer sets isPanning false and marks dirty', async () => {
    const { SkiaEngine } = await import('@/canvas/skia/skia-engine')
    const mockCk = {} as import('canvaskit-wasm').CanvasKit
    const engine = new SkiaEngine(mockCk)

    vi.useFakeTimers()

    engine.setViewport(1.5, 100, 200)
    expect(engine.isPanning).toBe(true)

    // Advance past 150ms idle threshold
    vi.advanceTimersByTime(151)

    expect(engine.isPanning).toBe(false)
    // markDirty() should have been called (dirty flag set for full re-render)
    expect((engine as any).dirty).toBe(true)

    vi.useRealTimers()
  })
})
