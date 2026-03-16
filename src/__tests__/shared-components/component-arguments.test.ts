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
vi.mock('@/stores/canvas-store', () => ({
  useCanvasStore: {
    getState: () => ({
      activePageId: 'page-1',
      setActivePageId: vi.fn(),
    }),
  },
}))

import { createComponentActions } from '@/stores/document-store-components'

function makeDoc(): PenDocument {
  return {
    version: '1',
    children: [],
    pages: [
      {
        id: 'page-1',
        name: 'Components',
        type: 'component',
        children: [
          {
            id: 'frame-1',
            type: 'frame' as const,
            name: 'MyButton',
            x: 0, y: 0, width: 120, height: 40,
            fill: [{ type: 'solid', color: '#0000FF' }],
            children: [
              { id: 'text-1', type: 'text' as const, name: 'Label', content: 'Click me', x: 0, y: 0, width: 80, height: 20 },
            ],
          } as any,
        ],
      },
    ],
  }
}

describe('createComponentActions', () => {
  let state: { document: PenDocument; isDirty: boolean }
  let actions: ReturnType<typeof createComponentActions>

  beforeEach(() => {
    mockPushState.mockClear()
    state = { document: makeDoc(), isDirty: false }
    const set = (partial: Partial<typeof state>) => { Object.assign(state, partial) }
    const get = () => state
    actions = createComponentActions(set, get)
  })

  describe('addArgument', () => {
    it('adds a text argument and returns an id', () => {
      const id = actions.addArgument('frame-1', {
        name: 'label',
        type: 'text',
        defaultValue: 'Button',
      })

      expect(id).toBeTruthy()
      const frame = state.document.pages![0].children[0] as any
      expect(frame.arguments).toHaveLength(1)
      expect(frame.arguments[0]).toMatchObject({ name: 'label', type: 'text', defaultValue: 'Button' })
      expect(state.isDirty).toBe(true)
    })

    it('adds a number argument', () => {
      const id = actions.addArgument('frame-1', { name: 'size', type: 'number', defaultValue: 16 })
      expect(id).toBeTruthy()
      const frame = state.document.pages![0].children[0] as any
      expect(frame.arguments[0].type).toBe('number')
      expect(frame.arguments[0].defaultValue).toBe(16)
    })

    it('adds a boolean argument', () => {
      const id = actions.addArgument('frame-1', { name: 'visible', type: 'boolean', defaultValue: true })
      expect(id).toBeTruthy()
      const frame = state.document.pages![0].children[0] as any
      expect(frame.arguments[0].type).toBe('boolean')
    })

    it('adds a select argument with options', () => {
      const id = actions.addArgument('frame-1', {
        name: 'variant',
        type: 'select',
        defaultValue: 'primary',
        options: ['primary', 'secondary', 'danger'],
      })
      expect(id).toBeTruthy()
      const frame = state.document.pages![0].children[0] as any
      expect(frame.arguments[0].type).toBe('select')
      expect(frame.arguments[0].options).toEqual(['primary', 'secondary', 'danger'])
    })

    it('adds a color argument', () => {
      const id = actions.addArgument('frame-1', { name: 'bgColor', type: 'color', defaultValue: '#FF0000' })
      expect(id).toBeTruthy()
      const frame = state.document.pages![0].children[0] as any
      expect(frame.arguments[0].type).toBe('color')
      expect(frame.arguments[0].defaultValue).toBe('#FF0000')
    })

    it('returns null for non-frame node', () => {
      const id = actions.addArgument('text-1', { name: 'label', type: 'text', defaultValue: 'x' })
      expect(id).toBeNull()
    })

    it('calls pushState before mutation', () => {
      const docBefore = state.document
      actions.addArgument('frame-1', { name: 'x', type: 'text', defaultValue: '' })
      expect(mockPushState).toHaveBeenCalledWith(docBefore)
    })

    it('generates unique ids for each argument', () => {
      const id1 = actions.addArgument('frame-1', { name: 'a', type: 'text', defaultValue: '' })
      const id2 = actions.addArgument('frame-1', { name: 'b', type: 'text', defaultValue: '' })
      expect(id1).not.toBe(id2)
      const frame = state.document.pages![0].children[0] as any
      expect(frame.arguments).toHaveLength(2)
    })
  })

  describe('removeArgument', () => {
    it('removes an argument by id', () => {
      const id = actions.addArgument('frame-1', { name: 'label', type: 'text', defaultValue: '' })!
      mockPushState.mockClear()
      actions.removeArgument('frame-1', id)
      const frame = state.document.pages![0].children[0] as any
      expect(frame.arguments).toHaveLength(0)
      expect(mockPushState).toHaveBeenCalledTimes(1)
    })

    it('also removes associated bindings', () => {
      const argId = actions.addArgument('frame-1', { name: 'label', type: 'text', defaultValue: '' })!
      actions.addArgumentBinding('frame-1', argId, { targetNodeId: 'text-1', targetProperty: 'content' })
      actions.removeArgument('frame-1', argId)
      const frame = state.document.pages![0].children[0] as any
      expect(frame.argumentBindings?.[argId]).toBeUndefined()
    })
  })

  describe('updateArgument', () => {
    it('updates argument name and defaultValue', () => {
      const argId = actions.addArgument('frame-1', { name: 'old', type: 'text', defaultValue: 'x' })!
      mockPushState.mockClear()
      actions.updateArgument('frame-1', argId, { name: 'new', defaultValue: 'y' })
      const frame = state.document.pages![0].children[0] as any
      const arg = frame.arguments.find((a: any) => a.id === argId)
      expect(arg.name).toBe('new')
      expect(arg.defaultValue).toBe('y')
      expect(arg.id).toBe(argId)
    })
  })

  describe('addArgumentBinding / removeArgumentBinding', () => {
    it('adds a binding for an argument', () => {
      const argId = actions.addArgument('frame-1', { name: 'label', type: 'text', defaultValue: '' })!
      mockPushState.mockClear()
      actions.addArgumentBinding('frame-1', argId, { targetNodeId: 'text-1', targetProperty: 'content' })
      const frame = state.document.pages![0].children[0] as any
      expect(frame.argumentBindings[argId]).toHaveLength(1)
      expect(frame.argumentBindings[argId][0]).toMatchObject({ targetNodeId: 'text-1', targetProperty: 'content' })
    })

    it('removes a specific binding by targetNodeId and targetProperty', () => {
      const argId = actions.addArgument('frame-1', { name: 'label', type: 'text', defaultValue: '' })!
      actions.addArgumentBinding('frame-1', argId, { targetNodeId: 'text-1', targetProperty: 'content' })
      actions.addArgumentBinding('frame-1', argId, { targetNodeId: 'text-1', targetProperty: 'visible' })
      mockPushState.mockClear()
      actions.removeArgumentBinding('frame-1', argId, 'text-1', 'content')
      const frame = state.document.pages![0].children[0] as any
      expect(frame.argumentBindings[argId]).toHaveLength(1)
      expect(frame.argumentBindings[argId][0].targetProperty).toBe('visible')
    })
  })

  describe('setArgumentValue / removeArgumentValue', () => {
    it('sets an argument value on a ref node', () => {
      state.document = {
        ...state.document,
        pages: [
          ...state.document.pages!,
          {
            id: 'page-2',
            name: 'Page 2',
            children: [
              { id: 'ref-1', type: 'ref' as const, name: 'MyButtonInstance', ref: 'frame-1', x: 0, y: 0 } as any,
            ],
          },
        ],
      }
      const set = (partial: any) => { Object.assign(state, partial) }
      const get = () => state
      const freshActions = createComponentActions(set, get)
      freshActions.setArgumentValue('ref-1', 'arg-x', 'Hello World')
      const refNode = state.document.pages![1].children[0] as any
      expect(refNode.argumentValues['arg-x']).toBe('Hello World')
    })

    it('removes an argument value from a ref node', () => {
      state.document = {
        ...state.document,
        pages: [
          ...state.document.pages!,
          {
            id: 'page-2',
            name: 'Page 2',
            children: [
              {
                id: 'ref-1', type: 'ref' as const, name: 'Inst', ref: 'frame-1', x: 0, y: 0,
                argumentValues: { 'arg-x': 'SomeValue' },
              } as any,
            ],
          },
        ],
      }
      const set = (partial: any) => { Object.assign(state, partial) }
      const get = () => state
      const freshActions = createComponentActions(set, get)
      freshActions.removeArgumentValue('ref-1', 'arg-x')
      const refNode = state.document.pages![1].children[0] as any
      expect(refNode.argumentValues['arg-x']).toBeUndefined()
    })
  })
})
