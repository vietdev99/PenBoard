import { nanoid } from 'nanoid'
import type { PenDocument } from '@/types/pen'
import type {
  DataEntity,
  DataField,
  DataRow,
  DataView,
  DataFilter,
  DataSort,
} from '@/types/data-entity'
import { useHistoryStore } from '@/stores/history-store'

export interface DataActions {
  // Entity CRUD
  addEntity: (name: string) => string
  removeEntity: (entityId: string) => void
  updateEntity: (entityId: string, updates: { name?: string }) => void

  // Field CRUD
  addField: (entityId: string, field: Omit<DataField, 'id'>) => string
  removeField: (entityId: string, fieldId: string) => void
  updateField: (entityId: string, fieldId: string, updates: Partial<DataField>) => void
  reorderField: (entityId: string, fieldId: string, newIndex: number) => void

  // Row CRUD
  addRow: (entityId: string) => string
  removeRow: (entityId: string, rowId: string) => void
  updateRowValue: (entityId: string, rowId: string, fieldId: string, value: string | number | boolean | null) => void

  // ERD position
  updateEntityErdPosition: (entityId: string, position: { x: number; y: number }) => void

  // View management
  addView: (entityId: string, name?: string) => string
  removeView: (entityId: string, viewId: string) => void
  updateView: (entityId: string, viewId: string, updates: Partial<DataView>) => void
}

export function createDataActions(
  set: (partial: Partial<{ document: PenDocument; isDirty: boolean }>) => void,
  get: () => { document: PenDocument },
): DataActions {
  /** Helper: map over entities, updating the one matching entityId. */
  function mapEntities(
    entities: DataEntity[],
    entityId: string,
    fn: (entity: DataEntity) => DataEntity,
  ): DataEntity[] {
    return entities.map((e) => (e.id === entityId ? fn(e) : e))
  }

  return {
    addEntity: (name) => {
      const state = get()
      useHistoryStore.getState().pushState(state.document)
      const id = nanoid()
      const newEntity: DataEntity = {
        id,
        name,
        fields: [],
        rows: [],
        views: [],
      }
      const existing = state.document.dataEntities ?? []
      set({
        document: {
          ...state.document,
          dataEntities: [...existing, newEntity],
        },
        isDirty: true,
      })
      return id
    },

    removeEntity: (entityId) => {
      const state = get()
      const existing = state.document.dataEntities ?? []
      if (!existing.some((e) => e.id === entityId)) return
      useHistoryStore.getState().pushState(state.document)

      // Remove the entity AND clean up relation fields in OTHER entities
      const remaining = existing
        .filter((e) => e.id !== entityId)
        .map((e) => ({
          ...e,
          fields: e.fields.filter((f) => f.relatedEntityId !== entityId),
        }))

      set({
        document: {
          ...state.document,
          dataEntities: remaining,
        },
        isDirty: true,
      })
    },

    updateEntity: (entityId, updates) => {
      const state = get()
      const existing = state.document.dataEntities ?? []
      if (!existing.some((e) => e.id === entityId)) return
      useHistoryStore.getState().pushState(state.document)
      set({
        document: {
          ...state.document,
          dataEntities: mapEntities(existing, entityId, (e) => ({
            ...e,
            ...updates,
          })),
        },
        isDirty: true,
      })
    },

    addField: (entityId, field) => {
      const state = get()
      const existing = state.document.dataEntities ?? []
      if (!existing.some((e) => e.id === entityId)) return ''
      useHistoryStore.getState().pushState(state.document)
      const id = nanoid()
      const newField: DataField = { id, ...field }
      set({
        document: {
          ...state.document,
          dataEntities: mapEntities(existing, entityId, (e) => ({
            ...e,
            fields: [...e.fields, newField],
          })),
        },
        isDirty: true,
      })
      return id
    },

    removeField: (entityId, fieldId) => {
      const state = get()
      const existing = state.document.dataEntities ?? []
      if (!existing.some((e) => e.id === entityId)) return
      useHistoryStore.getState().pushState(state.document)
      set({
        document: {
          ...state.document,
          dataEntities: mapEntities(existing, entityId, (e) => ({
            ...e,
            fields: e.fields.filter((f) => f.id !== fieldId),
            rows: e.rows.map((row) => {
              const { [fieldId]: _removed, ...rest } = row.values
              return { ...row, values: rest }
            }),
          })),
        },
        isDirty: true,
      })
    },

    updateField: (entityId, fieldId, updates) => {
      const state = get()
      const existing = state.document.dataEntities ?? []
      if (!existing.some((e) => e.id === entityId)) return
      useHistoryStore.getState().pushState(state.document)
      set({
        document: {
          ...state.document,
          dataEntities: mapEntities(existing, entityId, (e) => ({
            ...e,
            fields: e.fields.map((f) =>
              f.id === fieldId ? { ...f, ...updates, id: fieldId } : f,
            ),
          })),
        },
        isDirty: true,
      })
    },

    reorderField: (entityId, fieldId, newIndex) => {
      const state = get()
      const existing = state.document.dataEntities ?? []
      const entity = existing.find((e) => e.id === entityId)
      if (!entity) return
      const idx = entity.fields.findIndex((f) => f.id === fieldId)
      if (idx === -1 || idx === newIndex) return
      useHistoryStore.getState().pushState(state.document)
      const fields = [...entity.fields]
      const [moved] = fields.splice(idx, 1)
      fields.splice(newIndex, 0, moved)
      set({
        document: {
          ...state.document,
          dataEntities: mapEntities(existing, entityId, (e) => ({
            ...e,
            fields,
          })),
        },
        isDirty: true,
      })
    },

    addRow: (entityId) => {
      const state = get()
      const existing = state.document.dataEntities ?? []
      if (!existing.some((e) => e.id === entityId)) return ''
      useHistoryStore.getState().pushState(state.document)
      const id = nanoid()
      const newRow: DataRow = { id, values: {} }
      set({
        document: {
          ...state.document,
          dataEntities: mapEntities(existing, entityId, (e) => ({
            ...e,
            rows: [...e.rows, newRow],
          })),
        },
        isDirty: true,
      })
      return id
    },

    removeRow: (entityId, rowId) => {
      const state = get()
      const existing = state.document.dataEntities ?? []
      if (!existing.some((e) => e.id === entityId)) return
      useHistoryStore.getState().pushState(state.document)
      set({
        document: {
          ...state.document,
          dataEntities: mapEntities(existing, entityId, (e) => ({
            ...e,
            rows: e.rows.filter((r) => r.id !== rowId),
          })),
        },
        isDirty: true,
      })
    },

    updateRowValue: (entityId, rowId, fieldId, value) => {
      const state = get()
      const existing = state.document.dataEntities ?? []
      if (!existing.some((e) => e.id === entityId)) return
      useHistoryStore.getState().pushState(state.document)
      set({
        document: {
          ...state.document,
          dataEntities: mapEntities(existing, entityId, (e) => ({
            ...e,
            rows: e.rows.map((r) =>
              r.id === rowId ? { ...r, values: { ...r.values, [fieldId]: value } } : r,
            ),
          })),
        },
        isDirty: true,
      })
    },

    updateEntityErdPosition: (entityId, position) => {
      const state = get()
      const existing = state.document.dataEntities ?? []
      if (!existing.some((e) => e.id === entityId)) return
      useHistoryStore.getState().pushState(state.document)
      set({
        document: {
          ...state.document,
          dataEntities: mapEntities(existing, entityId, (e) => ({
            ...e,
            erdPosition: position,
          })),
        },
        isDirty: true,
      })
    },

    addView: (entityId, name) => {
      const state = get()
      const existing = state.document.dataEntities ?? []
      if (!existing.some((e) => e.id === entityId)) return ''
      useHistoryStore.getState().pushState(state.document)
      const id = nanoid()
      const newView: DataView = {
        id,
        name: name ?? 'Default view',
        filters: [],
        sorts: [],
      }
      set({
        document: {
          ...state.document,
          dataEntities: mapEntities(existing, entityId, (e) => ({
            ...e,
            views: [...e.views, newView],
          })),
        },
        isDirty: true,
      })
      return id
    },

    removeView: (entityId, viewId) => {
      const state = get()
      const existing = state.document.dataEntities ?? []
      if (!existing.some((e) => e.id === entityId)) return
      useHistoryStore.getState().pushState(state.document)
      set({
        document: {
          ...state.document,
          dataEntities: mapEntities(existing, entityId, (e) => ({
            ...e,
            views: e.views.filter((v) => v.id !== viewId),
          })),
        },
        isDirty: true,
      })
    },

    updateView: (entityId, viewId, updates) => {
      const state = get()
      const existing = state.document.dataEntities ?? []
      if (!existing.some((e) => e.id === entityId)) return
      useHistoryStore.getState().pushState(state.document)
      set({
        document: {
          ...state.document,
          dataEntities: mapEntities(existing, entityId, (e) => ({
            ...e,
            views: e.views.map((v) =>
              v.id === viewId ? { ...v, ...updates, id: viewId } : v,
            ),
          })),
        },
        isDirty: true,
      })
    },
  }
}

// --- Pure utility functions (not store actions) ---

/** Apply filters to rows. All filters are ANDed together. */
export function applyFilters(
  rows: DataRow[],
  filters: DataFilter[],
  _fields: DataField[],
): DataRow[] {
  if (filters.length === 0) return rows

  return rows.filter((row) => {
    return filters.every((filter) => {
      const val = row.values[filter.fieldId]

      switch (filter.operator) {
        case 'eq':
          return val === filter.value
        case 'neq':
          return val !== filter.value
        case 'contains': {
          if (val == null) return false
          return String(val).toLowerCase().includes(String(filter.value ?? '').toLowerCase())
        }
        case 'gt':
          return typeof val === 'number' && typeof filter.value === 'number' && val > filter.value
        case 'lt':
          return typeof val === 'number' && typeof filter.value === 'number' && val < filter.value
        case 'gte':
          return typeof val === 'number' && typeof filter.value === 'number' && val >= filter.value
        case 'lte':
          return typeof val === 'number' && typeof filter.value === 'number' && val <= filter.value
        case 'isEmpty':
          return val == null || val === ''
        case 'isNotEmpty':
          return val != null && val !== ''
        default:
          return true
      }
    })
  })
}

/** Apply sorts to rows. Multiple sorts are applied in order (first sort is primary). */
export function applySorts(
  rows: DataRow[],
  sorts: DataSort[],
  _fields: DataField[],
): DataRow[] {
  if (sorts.length === 0) return rows

  const sorted = [...rows]
  sorted.sort((a, b) => {
    for (const sort of sorts) {
      const aVal = a.values[sort.fieldId]
      const bVal = b.values[sort.fieldId]

      // Handle null values — always sort to bottom
      if (aVal == null && bVal == null) continue
      if (aVal == null) return 1
      if (bVal == null) return -1

      let cmp = 0
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        cmp = aVal - bVal
      } else {
        cmp = String(aVal).localeCompare(String(bVal))
      }

      if (cmp !== 0) {
        return sort.direction === 'asc' ? cmp : -cmp
      }
    }
    return 0
  })

  return sorted
}
