import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PenDocument, FrameNode, PenNode } from '@/types/pen'
import type { DataEntity } from '@/types/data-entity'
import type { DataBinding, FieldMapping } from '@/types/data-entity'

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

import { createDataActions } from '@/stores/document-store-data'
import { resolveDataBinding } from '@/variables/resolve-data-binding'

// --- Helpers ---

function makeDoc(entities?: DataEntity[], pageChildren?: PenNode[]): PenDocument {
  return {
    version: '1',
    children: [],
    pages: [
      { id: 'page-1', name: 'Page 1', children: pageChildren ?? [] },
    ],
    dataEntities: entities,
  }
}

function makeBoundFrame(id: string, entityId: string): FrameNode {
  return {
    id,
    type: 'frame',
    name: 'TestTable',
    role: 'table',
    dataBinding: { entityId, fieldMappings: [] },
    children: [
      {
        id: `${id}-row`,
        type: 'frame',
        role: 'table-row',
        children: [
          { id: `${id}-cell`, type: 'text', content: 'placeholder' },
        ],
      },
    ],
  } as unknown as FrameNode
}

function makeEntity(id: string): DataEntity {
  return {
    id,
    name: 'Users',
    fields: [{ id: 'fld-name', name: 'Name', type: 'text' }],
    rows: [
      { id: 'row-1', values: { 'fld-name': 'Alice' } },
      { id: 'row-2', values: { 'fld-name': 'Bob' } },
    ],
    views: [],
  }
}

// --- Tests ---

describe('Data Binding — store actions', () => {
  let state: { document: PenDocument; isDirty: boolean }
  let actions: ReturnType<typeof createDataActions>

  beforeEach(() => {
    mockPushState.mockClear()
    const frame = makeBoundFrame('node-1', 'entity-x')
    state = { document: makeDoc([], [frame]), isDirty: false }
    const set = (p: Partial<typeof state>) => Object.assign(state, p)
    const get = () => state
    actions = createDataActions(set, get)
  })

  it('setDataBinding stores binding on node with undo', () => {
    const binding: DataBinding = { entityId: 'entity-1', fieldMappings: [] }
    // setDataBinding not yet added to createDataActions — this test will fail
    expect((actions as Record<string, unknown>).setDataBinding).toBeDefined()
    ;(actions as unknown as { setDataBinding: (id: string, b: DataBinding) => void }).setDataBinding('node-1', binding)
    const stored = state.document.pages![0].children[0] as FrameNode
    expect((stored as unknown as { dataBinding: DataBinding }).dataBinding).toEqual(binding)
    expect(mockPushState).toHaveBeenCalledOnce()
  })

  it('clearDataBinding removes binding with undo', () => {
    expect((actions as Record<string, unknown>).clearDataBinding).toBeDefined()
    ;(actions as unknown as { clearDataBinding: (id: string) => void }).clearDataBinding('node-1')
    const stored = state.document.pages![0].children[0] as FrameNode
    expect((stored as unknown as { dataBinding?: DataBinding }).dataBinding).toBeUndefined()
    expect(mockPushState).toHaveBeenCalledOnce()
  })

  it('fieldMappings stores correct field-to-slot mappings', () => {
    const mapping: FieldMapping = { slotKey: 'col-0', fieldId: 'fld-name' }
    const binding: DataBinding = { entityId: 'entity-1', fieldMappings: [mapping] }
    expect((actions as Record<string, unknown>).setDataBinding).toBeDefined()
    ;(actions as unknown as { setDataBinding: (id: string, b: DataBinding) => void }).setDataBinding('node-1', binding)
    const stored = state.document.pages![0].children[0] as FrameNode
    expect((stored as unknown as { dataBinding: DataBinding }).dataBinding?.fieldMappings[0]).toEqual(mapping)
  })
})

describe('Data Binding — resolver', () => {
  it('resolveDataBinding returns all sample rows from entity', () => {
    const entity = makeEntity('entity-1')
    const node = makeBoundFrame('n-1', 'entity-1')
    const result = resolveDataBinding(node, [entity])
    // After resolve, the resolver (not yet created) will inject row values
    // Test that result !== node (changed)
    expect(result).not.toBe(node)
  })

  it('resolveDataBinding entity missing returns node unchanged', () => {
    const node = makeBoundFrame('n-2', 'non-existent')
    const result = resolveDataBinding(node, [])
    expect(result).toBe(node) // Same reference — no copy made
  })
})

describe('Data Binding — cascade cleanup', () => {
  it('removeEntity cascade clears all dataBinding references', () => {
    const entity = makeEntity('entity-del')
    const bound1 = makeBoundFrame('node-a', 'entity-del')
    const bound2 = makeBoundFrame('node-b', 'entity-del')
    const doc = {
      version: '1',
      children: [],
      pages: [
        { id: 'page-1', name: 'P1', children: [bound1] },
        { id: 'page-2', name: 'P2', children: [bound2] },
      ],
      dataEntities: [entity],
    } as PenDocument
    const s = { document: doc, isDirty: false }
    const actions2 = createDataActions(
      (p) => Object.assign(s, p),
      () => s,
    )
    actions2.removeEntity('entity-del')
    const n1 = s.document.pages![0].children[0] as FrameNode
    const n2 = s.document.pages![1].children[0] as FrameNode
    expect((n1 as unknown as { dataBinding?: DataBinding }).dataBinding).toBeUndefined()
    expect((n2 as unknown as { dataBinding?: DataBinding }).dataBinding).toBeUndefined()
  })

  it('cascade nested clears dataBinding in deeply nested children', () => {
    const entity = makeEntity('entity-deep')
    const grandchild: FrameNode = {
      id: 'gc-1',
      type: 'frame',
      dataBinding: { entityId: 'entity-deep', fieldMappings: [] },
      children: [],
    } as unknown as FrameNode
    const parent: FrameNode = {
      id: 'p-1',
      type: 'frame',
      children: [grandchild],
    } as unknown as FrameNode
    const doc = {
      version: '1',
      children: [],
      pages: [{ id: 'page-1', name: 'P1', children: [parent] }],
      dataEntities: [entity],
    } as PenDocument
    const s = { document: doc, isDirty: false }
    const actions3 = createDataActions(
      (p) => Object.assign(s, p),
      () => s,
    )
    actions3.removeEntity('entity-deep')
    const resolvedParent = s.document.pages![0].children[0] as FrameNode
    const resolvedGc = resolvedParent.children![0] as FrameNode
    expect((resolvedGc as unknown as { dataBinding?: DataBinding }).dataBinding).toBeUndefined()
  })
})
