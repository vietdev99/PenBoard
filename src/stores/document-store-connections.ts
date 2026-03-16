import { nanoid } from 'nanoid'
import type { PenDocument, ScreenConnection } from '@/types/pen'
import { useHistoryStore } from '@/stores/history-store'

interface ConnectionActions {
  addConnection: (conn: Omit<ScreenConnection, 'id'>) => string
  removeConnection: (connectionId: string) => void
  updateConnection: (id: string, updates: Partial<ScreenConnection>) => void
  getConnectionsForElement: (elementId: string) => ScreenConnection[]
  getConnectionsForPage: (pageId: string) => ScreenConnection[]
}

export function createConnectionActions(
  set: (partial: Partial<{ document: PenDocument; isDirty: boolean }>) => void,
  get: () => { document: PenDocument },
): ConnectionActions {
  return {
    addConnection: (conn) => {
      const state = get()
      useHistoryStore.getState().pushState(state.document)
      const id = nanoid()
      const newConnection: ScreenConnection = { id, ...conn }
      const existing = state.document.connections ?? []
      set({
        document: {
          ...state.document,
          connections: [...existing, newConnection],
        },
        isDirty: true,
      })
      return id
    },

    removeConnection: (connectionId) => {
      const state = get()
      const existing = state.document.connections ?? []
      if (!existing.some((c) => c.id === connectionId)) return
      useHistoryStore.getState().pushState(state.document)
      set({
        document: {
          ...state.document,
          connections: existing.filter((c) => c.id !== connectionId),
        },
        isDirty: true,
      })
    },

    updateConnection: (id, updates) => {
      const state = get()
      const existing = state.document.connections ?? []
      if (!existing.some((c) => c.id === id)) return
      useHistoryStore.getState().pushState(state.document)
      set({
        document: {
          ...state.document,
          connections: existing.map((c) =>
            c.id === id ? { ...c, ...updates, id } : c,
          ),
        },
        isDirty: true,
      })
    },

    getConnectionsForElement: (elementId) => {
      const { document } = get()
      return (document.connections ?? []).filter(
        (c) => c.sourceElementId === elementId,
      )
    },

    getConnectionsForPage: (pageId) => {
      const { document } = get()
      return (document.connections ?? []).filter(
        (c) => c.sourcePageId === pageId || c.targetPageId === pageId,
      )
    },
  }
}
