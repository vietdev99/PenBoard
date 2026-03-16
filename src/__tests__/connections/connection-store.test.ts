import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PenDocument, ScreenConnection } from '@/types/pen'

// Mock history store
const mockPushState = vi.fn()
vi.mock('@/stores/history-store', () => ({
  useHistoryStore: {
    getState: () => ({ pushState: mockPushState }),
  },
}))

// Mock canvas store
vi.mock('@/stores/canvas-store', () => ({
  useCanvasStore: {
    getState: () => ({
      activePageId: 'page-1',
      setActivePageId: vi.fn(),
    }),
  },
}))

import { createConnectionActions } from '@/stores/document-store-connections'

function makeDoc(connections?: ScreenConnection[]): PenDocument {
  return {
    version: '1',
    children: [],
    pages: [
      {
        id: 'page-1',
        name: 'Page 1',
        children: [
          { id: 'frame-1a', type: 'frame' as const, name: 'Login Screen' },
          { id: 'frame-1b', type: 'frame' as const, name: 'Signup Screen' },
        ] as any,
      },
      {
        id: 'page-2',
        name: 'Page 2',
        children: [
          { id: 'frame-2a', type: 'frame' as const, name: 'Dashboard' },
        ] as any,
      },
      { id: 'page-3', name: 'Page 3', children: [] },
    ],
    connections,
  }
}

describe('Connection Store Actions', () => {
  let state: { document: PenDocument; isDirty: boolean }
  let actions: ReturnType<typeof createConnectionActions>

  beforeEach(() => {
    mockPushState.mockClear()
    state = { document: makeDoc(), isDirty: false }

    const set = (partial: Partial<typeof state>) => {
      Object.assign(state, partial)
    }
    const get = () => state

    actions = createConnectionActions(set, get)
  })

  describe('addConnection', () => {
    it('creates a connection with all fields and auto-generated id', () => {
      const id = actions.addConnection({
        sourceElementId: 'elem-1',
        sourcePageId: 'page-1',
        targetPageId: 'page-2',
        triggerEvent: 'click',
        transitionType: 'push',
      })

      expect(id).toBeTruthy()
      expect(typeof id).toBe('string')
      expect(id.length).toBeGreaterThan(0)

      const connections = state.document.connections!
      expect(connections).toHaveLength(1)
      expect(connections[0]).toMatchObject({
        id,
        sourceElementId: 'elem-1',
        sourcePageId: 'page-1',
        targetPageId: 'page-2',
        triggerEvent: 'click',
        transitionType: 'push',
      })
      expect(state.isDirty).toBe(true)
    })

    it('preserves optional label field', () => {
      const id = actions.addConnection({
        sourceElementId: 'elem-1',
        sourcePageId: 'page-1',
        targetPageId: 'page-2',
        triggerEvent: 'hover',
        transitionType: 'modal',
        label: 'Go to settings',
      })

      const conn = state.document.connections!.find((c) => c.id === id)!
      expect(conn.label).toBe('Go to settings')
    })

    it('calls pushState before mutation for undo support', () => {
      const docBefore = state.document
      actions.addConnection({
        sourceElementId: 'elem-1',
        sourcePageId: 'page-1',
        targetPageId: 'page-2',
        triggerEvent: 'click',
        transitionType: 'push',
      })

      expect(mockPushState).toHaveBeenCalledTimes(1)
      expect(mockPushState).toHaveBeenCalledWith(docBefore)
    })

    it('generates unique IDs for each connection', () => {
      const id1 = actions.addConnection({
        sourceElementId: 'elem-1',
        sourcePageId: 'page-1',
        targetPageId: 'page-2',
        triggerEvent: 'click',
        transitionType: 'push',
      })

      const id2 = actions.addConnection({
        sourceElementId: 'elem-2',
        sourcePageId: 'page-1',
        targetPageId: 'page-3',
        triggerEvent: 'hover',
        transitionType: 'replace',
      })

      expect(id1).not.toBe(id2)
      expect(state.document.connections).toHaveLength(2)
    })
  })

  describe('removeConnection', () => {
    it('removes connection by id', () => {
      const id = actions.addConnection({
        sourceElementId: 'elem-1',
        sourcePageId: 'page-1',
        targetPageId: 'page-2',
        triggerEvent: 'click',
        transitionType: 'push',
      })

      mockPushState.mockClear()
      actions.removeConnection(id)

      expect(state.document.connections).toHaveLength(0)
      expect(mockPushState).toHaveBeenCalledTimes(1)
      expect(state.isDirty).toBe(true)
    })

    it('does nothing if id not found', () => {
      actions.addConnection({
        sourceElementId: 'elem-1',
        sourcePageId: 'page-1',
        targetPageId: 'page-2',
        triggerEvent: 'click',
        transitionType: 'push',
      })

      mockPushState.mockClear()
      actions.removeConnection('nonexistent-id')

      // Should still have 1 connection
      expect(state.document.connections).toHaveLength(1)
    })
  })

  describe('updateConnection', () => {
    it('updates partial fields by id', () => {
      const id = actions.addConnection({
        sourceElementId: 'elem-1',
        sourcePageId: 'page-1',
        targetPageId: 'page-2',
        triggerEvent: 'click',
        transitionType: 'push',
      })

      mockPushState.mockClear()
      actions.updateConnection(id, {
        label: 'Navigate',
        triggerEvent: 'submit',
        transitionType: 'modal',
      })

      const conn = state.document.connections!.find((c) => c.id === id)!
      expect(conn.label).toBe('Navigate')
      expect(conn.triggerEvent).toBe('submit')
      expect(conn.transitionType).toBe('modal')
      expect(conn.sourceElementId).toBe('elem-1') // unchanged
      expect(mockPushState).toHaveBeenCalledTimes(1)
    })

    it('does nothing if connection id not found', () => {
      actions.addConnection({
        sourceElementId: 'elem-1',
        sourcePageId: 'page-1',
        targetPageId: 'page-2',
        triggerEvent: 'click',
        transitionType: 'push',
      })

      mockPushState.mockClear()
      actions.updateConnection('nonexistent', { label: 'test' })

      // pushState should not be called for nonexistent connection
      expect(mockPushState).not.toHaveBeenCalled()
    })
  })

  describe('getConnectionsForElement', () => {
    it('returns only connections where sourceElementId matches', () => {
      actions.addConnection({
        sourceElementId: 'elem-1',
        sourcePageId: 'page-1',
        targetPageId: 'page-2',
        triggerEvent: 'click',
        transitionType: 'push',
      })
      actions.addConnection({
        sourceElementId: 'elem-2',
        sourcePageId: 'page-1',
        targetPageId: 'page-3',
        triggerEvent: 'hover',
        transitionType: 'modal',
      })
      actions.addConnection({
        sourceElementId: 'elem-1',
        sourcePageId: 'page-1',
        targetPageId: 'page-3',
        triggerEvent: 'submit',
        transitionType: 'replace',
      })

      const conns = actions.getConnectionsForElement('elem-1')
      expect(conns).toHaveLength(2)
      expect(conns.every((c) => c.sourceElementId === 'elem-1')).toBe(true)
    })

    it('returns empty array when no connections match', () => {
      const conns = actions.getConnectionsForElement('nonexistent')
      expect(conns).toEqual([])
    })
  })

  describe('getConnectionsForPage', () => {
    it('returns connections where sourcePageId or targetPageId matches', () => {
      actions.addConnection({
        sourceElementId: 'elem-1',
        sourcePageId: 'page-1',
        targetPageId: 'page-2',
        triggerEvent: 'click',
        transitionType: 'push',
      })
      actions.addConnection({
        sourceElementId: 'elem-2',
        sourcePageId: 'page-2',
        targetPageId: 'page-3',
        triggerEvent: 'hover',
        transitionType: 'modal',
      })
      actions.addConnection({
        sourceElementId: 'elem-3',
        sourcePageId: 'page-3',
        targetPageId: 'page-1',
        triggerEvent: 'click',
        transitionType: 'push',
      })

      const conns = actions.getConnectionsForPage('page-2')
      expect(conns).toHaveLength(2) // one where sourcePageId=page-2, one where targetPageId=page-2
    })
  })

  describe('targetFrameId support', () => {
    it('stores targetFrameId when provided', () => {
      const id = actions.addConnection({
        sourceElementId: 'elem-1',
        sourcePageId: 'page-1',
        targetPageId: 'page-2',
        targetFrameId: 'frame-2a',
        triggerEvent: 'click',
        transitionType: 'push',
      })

      const conn = state.document.connections!.find((c) => c.id === id)!
      expect(conn.targetFrameId).toBe('frame-2a')
      expect(conn.targetPageId).toBe('page-2')
    })

    it('backward compat: connection without targetFrameId has undefined', () => {
      const id = actions.addConnection({
        sourceElementId: 'elem-1',
        sourcePageId: 'page-1',
        targetPageId: 'page-2',
        triggerEvent: 'click',
        transitionType: 'push',
      })

      const conn = state.document.connections!.find((c) => c.id === id)!
      expect(conn.targetFrameId).toBeUndefined()
    })

    it('updateConnection can set targetFrameId', () => {
      const id = actions.addConnection({
        sourceElementId: 'elem-1',
        sourcePageId: 'page-1',
        targetPageId: 'page-2',
        triggerEvent: 'click',
        transitionType: 'push',
      })

      actions.updateConnection(id, { targetFrameId: 'frame-2a' })

      const conn = state.document.connections!.find((c) => c.id === id)!
      expect(conn.targetFrameId).toBe('frame-2a')
    })

    it('getConnectionsForElement returns connections with targetFrameId intact', () => {
      actions.addConnection({
        sourceElementId: 'elem-1',
        sourcePageId: 'page-1',
        targetPageId: 'page-2',
        targetFrameId: 'frame-2a',
        triggerEvent: 'click',
        transitionType: 'push',
      })

      const conns = actions.getConnectionsForElement('elem-1')
      expect(conns).toHaveLength(1)
      expect(conns[0].targetFrameId).toBe('frame-2a')
    })
  })

  describe('same-page connections', () => {
    it('allows same-page connection (sourcePageId === targetPageId)', () => {
      const id = actions.addConnection({
        sourceElementId: 'elem-1',
        sourcePageId: 'page-1',
        targetPageId: 'page-1',
        targetFrameId: 'frame-1b',
        triggerEvent: 'click',
        transitionType: 'push',
      })

      const conn = state.document.connections!.find((c) => c.id === id)!
      expect(conn.sourcePageId).toBe('page-1')
      expect(conn.targetPageId).toBe('page-1')
      expect(conn.targetFrameId).toBe('frame-1b')
    })
  })

  describe('connections defaults', () => {
    it('defaults to empty array when doc.connections is undefined', () => {
      state.document = makeDoc(undefined) // no connections field
      const conns = actions.getConnectionsForElement('anything')
      expect(conns).toEqual([])
    })

    it('adding connection to doc with no connections field creates array', () => {
      state.document = makeDoc(undefined)
      const id = actions.addConnection({
        sourceElementId: 'elem-1',
        sourcePageId: 'page-1',
        targetPageId: 'page-2',
        triggerEvent: 'click',
        transitionType: 'push',
      })

      expect(state.document.connections).toBeDefined()
      expect(state.document.connections).toHaveLength(1)
      expect(state.document.connections![0].id).toBe(id)
    })
  })
})

describe('normalizePenDocument backward compatibility', () => {
  it('preserves existing connections array', async () => {
    const { normalizePenDocument } = await import('@/utils/normalize-pen-file')
    const doc: PenDocument = {
      version: '1',
      children: [],
      connections: [
        {
          id: 'c1',
          sourceElementId: 'e1',
          sourcePageId: 'p1',
          targetPageId: 'p2',
          triggerEvent: 'click',
          transitionType: 'push',
        },
      ],
    }
    const normalized = normalizePenDocument(doc)
    expect(normalized.connections).toEqual(doc.connections)
  })

  it('does not add empty connections array for missing field', async () => {
    const { normalizePenDocument } = await import('@/utils/normalize-pen-file')
    const doc: PenDocument = {
      version: '1',
      children: [],
    }
    const normalized = normalizePenDocument(doc)
    expect(normalized.connections).toBeUndefined()
  })
})
