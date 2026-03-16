import { nanoid } from 'nanoid'
import type { PenDocument, PenNode, ComponentArgument, ArgumentBinding } from '@/types/pen'
import { useHistoryStore } from '@/stores/history-store'
import { findNodeInTree } from './document-tree-utils'

// --- Updater-based tree update (needed for complex mutations) ---

function updateNodeInTreeFn(
  nodes: PenNode[],
  id: string,
  updater: (n: PenNode) => PenNode,
): PenNode[] {
  return nodes.map((n) => {
    if (n.id === id) return updater(n)
    if ('children' in n && n.children) {
      return {
        ...n,
        children: updateNodeInTreeFn(n.children, id, updater),
      } as PenNode
    }
    return n
  })
}

// --- Component Actions ---

interface ComponentActions {
  addArgument: (nodeId: string, arg: Omit<ComponentArgument, 'id'>) => string | null
  removeArgument: (nodeId: string, argId: string) => void
  updateArgument: (nodeId: string, argId: string, updates: Partial<ComponentArgument>) => void
  addArgumentBinding: (nodeId: string, argId: string, binding: ArgumentBinding) => void
  removeArgumentBinding: (nodeId: string, argId: string, targetNodeId: string, targetProperty: string) => void
  setArgumentValue: (instanceId: string, argId: string, value: string | number | boolean) => void
  removeArgumentValue: (instanceId: string, argId: string) => void
}

export function createComponentActions(
  set: (partial: Partial<{ document: PenDocument; isDirty: boolean }>) => void,
  get: () => { document: PenDocument },
): ComponentActions {
  // Helper: find node across all pages
  const findNodeAcrossPages = (doc: PenDocument, nodeId: string): PenNode | null => {
    for (const page of doc.pages ?? []) {
      const found = findNodeInTree(page.children, nodeId)
      if (found) return found
    }
    return findNodeInTree(doc.children, nodeId) ?? null
  }

  // Helper: update node across all pages using an updater function
  const updateNodeAcrossPages = (doc: PenDocument, nodeId: string, updater: (n: PenNode) => PenNode): PenDocument => {
    const pages = doc.pages?.map(page => ({
      ...page,
      children: updateNodeInTreeFn(page.children, nodeId, updater),
    }))
    return {
      ...doc,
      pages,
      children: updateNodeInTreeFn(doc.children, nodeId, updater),
    }
  }

  return {
    addArgument: (nodeId, arg) => {
      const state = get()
      const node = findNodeAcrossPages(state.document, nodeId)
      if (!node || node.type !== 'frame') return null
      useHistoryStore.getState().pushState(state.document)
      const id = nanoid()
      const newArg: ComponentArgument = { id, ...arg }
      const newDoc = updateNodeAcrossPages(state.document, nodeId, (n) => ({
        ...n,
        arguments: [...((n as any).arguments ?? []), newArg],
      }))
      set({ document: newDoc, isDirty: true })
      return id
    },

    removeArgument: (nodeId, argId) => {
      const state = get()
      useHistoryStore.getState().pushState(state.document)
      const newDoc = updateNodeAcrossPages(state.document, nodeId, (n) => {
        const frame = n as any
        const newArgs = (frame.arguments ?? []).filter((a: ComponentArgument) => a.id !== argId)
        const newBindings = { ...(frame.argumentBindings ?? {}) }
        delete newBindings[argId]
        return { ...n, arguments: newArgs, argumentBindings: newBindings }
      })
      set({ document: newDoc, isDirty: true })
    },

    updateArgument: (nodeId, argId, updates) => {
      const state = get()
      useHistoryStore.getState().pushState(state.document)
      const newDoc = updateNodeAcrossPages(state.document, nodeId, (n) => {
        const frame = n as any
        const newArgs = (frame.arguments ?? []).map((a: ComponentArgument) =>
          a.id === argId ? { ...a, ...updates, id: argId } : a
        )
        return { ...n, arguments: newArgs }
      })
      set({ document: newDoc, isDirty: true })
    },

    addArgumentBinding: (nodeId, argId, binding) => {
      const state = get()
      useHistoryStore.getState().pushState(state.document)
      const newDoc = updateNodeAcrossPages(state.document, nodeId, (n) => {
        const frame = n as any
        const bindings = { ...(frame.argumentBindings ?? {}) }
        bindings[argId] = [...(bindings[argId] ?? []), binding]
        return { ...n, argumentBindings: bindings }
      })
      set({ document: newDoc, isDirty: true })
    },

    removeArgumentBinding: (nodeId, argId, targetNodeId, targetProperty) => {
      const state = get()
      useHistoryStore.getState().pushState(state.document)
      const newDoc = updateNodeAcrossPages(state.document, nodeId, (n) => {
        const frame = n as any
        const bindings = { ...(frame.argumentBindings ?? {}) }
        bindings[argId] = (bindings[argId] ?? []).filter(
          (b: ArgumentBinding) => !(b.targetNodeId === targetNodeId && b.targetProperty === targetProperty)
        )
        return { ...n, argumentBindings: bindings }
      })
      set({ document: newDoc, isDirty: true })
    },

    setArgumentValue: (instanceId, argId, value) => {
      const state = get()
      useHistoryStore.getState().pushState(state.document)
      const newDoc = updateNodeAcrossPages(state.document, instanceId, (n) => {
        if (n.type !== 'ref') return n
        return {
          ...n,
          argumentValues: { ...((n as any).argumentValues ?? {}), [argId]: value },
        }
      })
      set({ document: newDoc, isDirty: true })
    },

    removeArgumentValue: (instanceId, argId) => {
      const state = get()
      useHistoryStore.getState().pushState(state.document)
      const newDoc = updateNodeAcrossPages(state.document, instanceId, (n) => {
        if (n.type !== 'ref') return n
        const values = { ...((n as any).argumentValues ?? {}) }
        delete values[argId]
        return { ...n, argumentValues: values }
      })
      set({ document: newDoc, isDirty: true })
    },
  }
}
