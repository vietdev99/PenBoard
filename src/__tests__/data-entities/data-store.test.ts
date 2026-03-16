import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PenDocument } from '@/types/pen'
import type { DataEntity, DataRow, DataFilter, DataSort, DataField } from '@/types/data-entity'

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

import { createDataActions, applyFilters, applySorts } from '@/stores/document-store-data'

function makeDoc(entities?: DataEntity[]): PenDocument {
  return {
    version: '1',
    children: [],
    pages: [
      { id: 'page-1', name: 'Page 1', children: [] },
    ],
    dataEntities: entities,
  }
}

describe('Data Store Actions', () => {
  let state: { document: PenDocument; isDirty: boolean }
  let actions: ReturnType<typeof createDataActions>

  beforeEach(() => {
    mockPushState.mockClear()
    state = { document: makeDoc(), isDirty: false }

    const set = (partial: Partial<typeof state>) => {
      Object.assign(state, partial)
    }
    const get = () => state

    actions = createDataActions(set, get)
  })

  // --- Entity CRUD ---

  describe('addEntity', () => {
    it('creates entity with name, empty fields[], rows[], views[], auto-generated id', () => {
      const id = actions.addEntity('Users')

      expect(id).toBeTruthy()
      expect(typeof id).toBe('string')

      const entities = state.document.dataEntities!
      expect(entities).toHaveLength(1)
      expect(entities[0]).toMatchObject({
        id,
        name: 'Users',
        fields: [],
        rows: [],
        views: [],
      })
      expect(state.isDirty).toBe(true)
    })

    it('calls pushState before mutation for undo support', () => {
      const docBefore = state.document
      actions.addEntity('Test')
      expect(mockPushState).toHaveBeenCalledTimes(1)
      expect(mockPushState).toHaveBeenCalledWith(docBefore)
    })
  })

  describe('removeEntity', () => {
    it('removes entity by id', () => {
      const id = actions.addEntity('Users')
      mockPushState.mockClear()
      actions.removeEntity(id)
      expect(state.document.dataEntities).toHaveLength(0)
      expect(mockPushState).toHaveBeenCalledTimes(1)
    })

    it('also removes relation fields in OTHER entities that reference it', () => {
      const usersId = actions.addEntity('Users')
      const postsId = actions.addEntity('Posts')
      actions.addField(postsId, { name: 'author', type: 'relation', relatedEntityId: usersId })
      actions.addField(postsId, { name: 'title', type: 'text' })

      mockPushState.mockClear()
      actions.removeEntity(usersId)

      const posts = state.document.dataEntities!.find((e) => e.id === postsId)!
      // Only text field should remain — relation to Users was cleaned up
      expect(posts.fields).toHaveLength(1)
      expect(posts.fields[0].name).toBe('title')
    })
  })

  describe('updateEntity', () => {
    it('updates entity name by id', () => {
      const id = actions.addEntity('Users')
      mockPushState.mockClear()
      actions.updateEntity(id, { name: 'Customers' })
      expect(state.document.dataEntities![0].name).toBe('Customers')
      expect(mockPushState).toHaveBeenCalledTimes(1)
    })
  })

  // --- Field CRUD ---

  describe('addField', () => {
    it('adds a typed field to entity, auto-generates id', () => {
      const entityId = actions.addEntity('Users')
      mockPushState.mockClear()
      const fieldId = actions.addField(entityId, { name: 'email', type: 'text' })

      expect(fieldId).toBeTruthy()
      const entity = state.document.dataEntities![0]
      expect(entity.fields).toHaveLength(1)
      expect(entity.fields[0]).toMatchObject({
        id: fieldId,
        name: 'email',
        type: 'text',
      })
      expect(mockPushState).toHaveBeenCalledTimes(1)
    })
  })

  describe('removeField', () => {
    it('removes field by id from entity and cleans up row values', () => {
      const entityId = actions.addEntity('Users')
      const fieldId = actions.addField(entityId, { name: 'email', type: 'text' })
      const rowId = actions.addRow(entityId)
      actions.updateRowValue(entityId, rowId, fieldId, 'test@example.com')

      // Verify value exists before removal
      expect(state.document.dataEntities![0].rows[0].values[fieldId]).toBe('test@example.com')

      mockPushState.mockClear()
      actions.removeField(entityId, fieldId)

      const entity = state.document.dataEntities![0]
      expect(entity.fields).toHaveLength(0)
      // Row value should also be cleaned up
      expect(entity.rows[0].values[fieldId]).toBeUndefined()
      expect(mockPushState).toHaveBeenCalledTimes(1)
    })
  })

  describe('updateField', () => {
    it('updates field properties (name, type, options, isPrimaryKey)', () => {
      const entityId = actions.addEntity('Users')
      const fieldId = actions.addField(entityId, { name: 'status', type: 'text' })

      mockPushState.mockClear()
      actions.updateField(entityId, fieldId, {
        name: 'role',
        type: 'select',
        options: ['admin', 'user'],
        isPrimaryKey: true,
      })

      const field = state.document.dataEntities![0].fields[0]
      expect(field.name).toBe('role')
      expect(field.type).toBe('select')
      expect(field.options).toEqual(['admin', 'user'])
      expect(field.isPrimaryKey).toBe(true)
      expect(mockPushState).toHaveBeenCalledTimes(1)
    })
  })

  // --- Row CRUD ---

  describe('addRow', () => {
    it('creates row with empty values record, auto-generated id', () => {
      const entityId = actions.addEntity('Users')
      mockPushState.mockClear()
      const rowId = actions.addRow(entityId)

      expect(rowId).toBeTruthy()
      const entity = state.document.dataEntities![0]
      expect(entity.rows).toHaveLength(1)
      expect(entity.rows[0]).toMatchObject({
        id: rowId,
        values: {},
      })
      expect(mockPushState).toHaveBeenCalledTimes(1)
    })
  })

  describe('removeRow', () => {
    it('removes row by id from entity', () => {
      const entityId = actions.addEntity('Users')
      const rowId = actions.addRow(entityId)
      mockPushState.mockClear()
      actions.removeRow(entityId, rowId)
      expect(state.document.dataEntities![0].rows).toHaveLength(0)
      expect(mockPushState).toHaveBeenCalledTimes(1)
    })
  })

  describe('updateRowValue', () => {
    it('sets values[fieldId] on a specific row', () => {
      const entityId = actions.addEntity('Users')
      const fieldId = actions.addField(entityId, { name: 'name', type: 'text' })
      const rowId = actions.addRow(entityId)

      mockPushState.mockClear()
      actions.updateRowValue(entityId, rowId, fieldId, 'John Doe')

      const row = state.document.dataEntities![0].rows[0]
      expect(row.values[fieldId]).toBe('John Doe')
      expect(mockPushState).toHaveBeenCalledTimes(1)
    })
  })

  // --- ERD Position ---

  describe('updateEntityErdPosition', () => {
    it('sets erdPosition.x and erdPosition.y', () => {
      const entityId = actions.addEntity('Users')
      mockPushState.mockClear()
      actions.updateEntityErdPosition(entityId, { x: 100, y: 200 })

      const entity = state.document.dataEntities![0]
      expect(entity.erdPosition).toEqual({ x: 100, y: 200 })
      expect(mockPushState).toHaveBeenCalledTimes(1)
    })
  })

  // --- View management ---

  describe('addView', () => {
    it('creates a DataView with default name, empty filters and sorts', () => {
      const entityId = actions.addEntity('Users')
      mockPushState.mockClear()
      const viewId = actions.addView(entityId)

      expect(viewId).toBeTruthy()
      const view = state.document.dataEntities![0].views[0]
      expect(view).toMatchObject({
        id: viewId,
        name: 'Default view',
        filters: [],
        sorts: [],
      })
      expect(mockPushState).toHaveBeenCalledTimes(1)
    })

    it('uses custom name when provided', () => {
      const entityId = actions.addEntity('Users')
      const viewId = actions.addView(entityId, 'Admins only')
      const view = state.document.dataEntities![0].views[0]
      expect(view.name).toBe('Admins only')
    })
  })

  describe('updateView', () => {
    it('updates filter/sort config on a view', () => {
      const entityId = actions.addEntity('Users')
      const viewId = actions.addView(entityId)

      mockPushState.mockClear()
      actions.updateView(entityId, viewId, {
        filters: [{ fieldId: 'f1', operator: 'eq', value: 'admin' }],
        sorts: [{ fieldId: 'f2', direction: 'asc' }],
      })

      const view = state.document.dataEntities![0].views[0]
      expect(view.filters).toHaveLength(1)
      expect(view.sorts).toHaveLength(1)
      expect(mockPushState).toHaveBeenCalledTimes(1)
    })
  })

  describe('removeView', () => {
    it('removes view by id', () => {
      const entityId = actions.addEntity('Users')
      const viewId = actions.addView(entityId)
      mockPushState.mockClear()
      actions.removeView(entityId, viewId)
      expect(state.document.dataEntities![0].views).toHaveLength(0)
      expect(mockPushState).toHaveBeenCalledTimes(1)
    })
  })

  // --- Undo support across all mutations ---

  describe('all mutations call pushState before modifying', () => {
    it('addEntity, removeEntity, updateEntity all call pushState', () => {
      const id = actions.addEntity('Test')
      actions.updateEntity(id, { name: 'Updated' })
      actions.removeEntity(id)
      expect(mockPushState).toHaveBeenCalledTimes(3)
    })

    it('addField, updateField, removeField all call pushState', () => {
      const entityId = actions.addEntity('Test')
      mockPushState.mockClear()
      const fieldId = actions.addField(entityId, { name: 'f', type: 'text' })
      actions.updateField(entityId, fieldId, { name: 'updated' })
      actions.removeField(entityId, fieldId)
      expect(mockPushState).toHaveBeenCalledTimes(3)
    })

    it('addRow, updateRowValue, removeRow all call pushState', () => {
      const entityId = actions.addEntity('Test')
      actions.addField(entityId, { name: 'f', type: 'text' })
      mockPushState.mockClear()
      const rowId = actions.addRow(entityId)
      actions.updateRowValue(entityId, rowId, 'f', 'val')
      actions.removeRow(entityId, rowId)
      expect(mockPushState).toHaveBeenCalledTimes(3)
    })
  })
})

// --- Pure utility functions ---

describe('applyFilters', () => {
  const fields: DataField[] = [
    { id: 'f1', name: 'name', type: 'text' },
    { id: 'f2', name: 'age', type: 'number' },
    { id: 'f3', name: 'active', type: 'boolean' },
  ]

  const rows: DataRow[] = [
    { id: 'r1', values: { f1: 'Alice', f2: 30, f3: true } },
    { id: 'r2', values: { f1: 'Bob', f2: 25, f3: false } },
    { id: 'r3', values: { f1: 'Charlie', f2: 35, f3: true } },
    { id: 'r4', values: { f1: null, f2: null, f3: null } },
  ]

  it('operator "eq" returns matching rows only', () => {
    const filters: DataFilter[] = [{ fieldId: 'f1', operator: 'eq', value: 'Alice' }]
    const result = applyFilters(rows, filters, fields)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('r1')
  })

  it('operator "contains" returns rows where value includes search text', () => {
    const filters: DataFilter[] = [{ fieldId: 'f1', operator: 'contains', value: 'li' }]
    const result = applyFilters(rows, filters, fields)
    expect(result).toHaveLength(2) // Alice, Charlie
  })

  it('operator "isEmpty" returns rows where value is undefined/null/empty string', () => {
    const filters: DataFilter[] = [{ fieldId: 'f1', operator: 'isEmpty' }]
    const result = applyFilters(rows, filters, fields)
    expect(result).toHaveLength(1) // r4
    expect(result[0].id).toBe('r4')
  })

  it('operator "isNotEmpty" returns rows with values', () => {
    const filters: DataFilter[] = [{ fieldId: 'f1', operator: 'isNotEmpty' }]
    const result = applyFilters(rows, filters, fields)
    expect(result).toHaveLength(3) // r1, r2, r3
  })

  it('operator "gt" returns rows with numeric value greater than', () => {
    const filters: DataFilter[] = [{ fieldId: 'f2', operator: 'gt', value: 28 }]
    const result = applyFilters(rows, filters, fields)
    expect(result).toHaveLength(2) // Alice(30), Charlie(35)
  })

  it('operator "lt" returns rows with numeric value less than', () => {
    const filters: DataFilter[] = [{ fieldId: 'f2', operator: 'lt', value: 30 }]
    const result = applyFilters(rows, filters, fields)
    expect(result).toHaveLength(1) // Bob(25)
  })

  it('applies multiple filters (AND logic)', () => {
    const filters: DataFilter[] = [
      { fieldId: 'f2', operator: 'gt', value: 24 },
      { fieldId: 'f3', operator: 'eq', value: true },
    ]
    const result = applyFilters(rows, filters, fields)
    expect(result).toHaveLength(2) // Alice(30,true), Charlie(35,true)
  })
})

describe('applySorts', () => {
  const fields: DataField[] = [
    { id: 'f1', name: 'name', type: 'text' },
    { id: 'f2', name: 'age', type: 'number' },
  ]

  const rows: DataRow[] = [
    { id: 'r1', values: { f1: 'Charlie', f2: 35 } },
    { id: 'r2', values: { f1: 'Alice', f2: 30 } },
    { id: 'r3', values: { f1: 'Bob', f2: 25 } },
  ]

  it('direction "asc" sorts rows by field value ascending', () => {
    const sorts: DataSort[] = [{ fieldId: 'f1', direction: 'asc' }]
    const result = applySorts(rows, sorts, fields)
    expect(result.map((r) => r.values.f1)).toEqual(['Alice', 'Bob', 'Charlie'])
  })

  it('direction "desc" sorts rows by field value descending', () => {
    const sorts: DataSort[] = [{ fieldId: 'f2', direction: 'desc' }]
    const result = applySorts(rows, sorts, fields)
    expect(result.map((r) => r.values.f2)).toEqual([35, 30, 25])
  })

  it('sorts numerically for number fields', () => {
    const sorts: DataSort[] = [{ fieldId: 'f2', direction: 'asc' }]
    const result = applySorts(rows, sorts, fields)
    expect(result.map((r) => r.values.f2)).toEqual([25, 30, 35])
  })
})
