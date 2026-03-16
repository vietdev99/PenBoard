import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PenDocument } from '@/types/pen'

// Mock history store
const mockPushState = vi.fn()
vi.mock('@/stores/history-store', () => ({
  useHistoryStore: {
    getState: () => ({ pushState: mockPushState }),
  },
}))

// Mock canvas store
const mockSetActivePageId = vi.fn()
vi.mock('@/stores/canvas-store', () => ({
  useCanvasStore: {
    getState: () => ({
      activePageId: 'page-1',
      setActivePageId: mockSetActivePageId,
    }),
  },
}))

import { createPageActions } from '@/stores/document-store-pages'

function makeDoc(): PenDocument {
  return {
    version: '1',
    children: [],
    pages: [
      {
        id: 'page-1',
        name: 'Page 1',
        children: [],
      },
    ],
  }
}

describe('createPageActions - component pages', () => {
  let state: { document: PenDocument; isDirty: boolean }
  let actions: ReturnType<typeof createPageActions>

  beforeEach(() => {
    mockPushState.mockClear()
    mockSetActivePageId.mockClear()
    state = { document: makeDoc(), isDirty: false }
    const set = (partial: Partial<typeof state>) => { Object.assign(state, partial) }
    const get = () => state
    actions = createPageActions(set, get)
  })

  describe('addPage with type component', () => {
    it('creates a page with type "component"', () => {
      const id = actions.addPage('component')
      expect(id).toBeTruthy()
      const pages = state.document.pages!
      const newPage = pages.find((p) => p.id === id)!
      expect(newPage).toBeDefined()
      expect(newPage.type).toBe('component')
    })

    it('created component page has name "Components"', () => {
      const id = actions.addPage('component')
      const newPage = state.document.pages!.find((p) => p.id === id)!
      expect(newPage.name).toBe('Components')
    })

    it('created component page has an empty children array', () => {
      const id = actions.addPage('component')
      const newPage = state.document.pages!.find((p) => p.id === id)!
      expect(newPage.children).toEqual([])
    })

    it('component page has an id', () => {
      const id = actions.addPage('component')
      const newPage = state.document.pages!.find((p) => p.id === id)!
      expect(newPage.id).toBe(id)
      expect(typeof id).toBe('string')
      expect(id.length).toBeGreaterThan(0)
    })

    it('sets active page to the new component page', () => {
      const id = actions.addPage('component')
      expect(mockSetActivePageId).toHaveBeenCalledWith(id)
    })

    it('marks document as dirty', () => {
      actions.addPage('component')
      expect(state.isDirty).toBe(true)
    })

    it('calls pushState for undo support', () => {
      const docBefore = state.document
      actions.addPage('component')
      expect(mockPushState).toHaveBeenCalledWith(docBefore)
    })
  })

  describe('renamePage for component pages', () => {
    it('renames a component page', () => {
      const id = actions.addPage('component')
      mockPushState.mockClear()
      actions.renamePage(id, 'My Components')
      const page = state.document.pages!.find((p) => p.id === id)!
      expect(page.name).toBe('My Components')
      expect(mockPushState).toHaveBeenCalledTimes(1)
    })
  })

  describe('removePage for component pages', () => {
    it('removes a component page', () => {
      const id = actions.addPage('component')
      const countBefore = state.document.pages!.length
      mockPushState.mockClear()
      actions.removePage(id)
      expect(state.document.pages!).toHaveLength(countBefore - 1)
      expect(state.document.pages!.find((p) => p.id === id)).toBeUndefined()
    })

    it('cannot remove the last page', () => {
      // State has only one page initially
      actions.removePage('page-1')
      // Should still have 1 page
      expect(state.document.pages!).toHaveLength(1)
    })
  })

  describe('addPage without type (defaults to screen)', () => {
    it('creates a screen page with a default frame child', () => {
      const id = actions.addPage()
      const newPage = state.document.pages!.find((p) => p.id === id)!
      expect(newPage.type).toBeUndefined()
      expect(newPage.children).toHaveLength(1)
      expect(newPage.children[0].type).toBe('frame')
    })
  })

  describe('addPage with type erd', () => {
    it('creates an ERD page with type "erd" and empty children', () => {
      const id = actions.addPage('erd')
      const newPage = state.document.pages!.find((p) => p.id === id)!
      expect(newPage.type).toBe('erd')
      expect(newPage.name).toBe('ERD')
      expect(newPage.children).toEqual([])
    })
  })
})
