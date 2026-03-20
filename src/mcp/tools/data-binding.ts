// ---------------------------------------------------------------------------
// MCP Tool: manage_data_binding
// Actions: set_binding, remove_binding, list_bindings
// ---------------------------------------------------------------------------

import { openDocument, saveDocument, resolveDocPath } from '../document-manager'
import {
  findNodeInTree,
  updateNodeInTree,
  getDocChildren,
  setDocChildren,
  flattenNodes,
} from '../utils/node-operations'
import type { FieldMapping, DataBinding } from '../../types/data-entity'

export interface ManageDataBindingParams {
  filePath?: string
  action: 'set_binding' | 'remove_binding' | 'list_bindings'
  nodeId?: string
  entityId?: string
  fieldMappings?: FieldMapping[]
  pageId?: string
}

export async function handleManageDataBinding(
  params: ManageDataBindingParams,
): Promise<Record<string, unknown>> {
  const filePath = resolveDocPath(params.filePath)
  let doc = await openDocument(filePath)
  doc = structuredClone(doc)

  switch (params.action) {
    case 'set_binding': {
      if (!params.nodeId) throw new Error('nodeId is required for set_binding')
      if (!params.entityId) throw new Error('entityId is required for set_binding')

      const children = getDocChildren(doc, params.pageId)
      const node = findNodeInTree(children, params.nodeId)
      if (!node) throw new Error(`Node not found: ${params.nodeId}`)

      // Verify entity exists
      const entities = doc.dataEntities ?? []
      if (!entities.some((e) => e.id === params.entityId)) {
        throw new Error(`Entity not found: ${params.entityId}`)
      }

      const binding: DataBinding = {
        entityId: params.entityId,
        fieldMappings: params.fieldMappings ?? [],
      }

      const updated = updateNodeInTree(children, params.nodeId, { dataBinding: binding } as any)
      setDocChildren(doc, updated, params.pageId)
      await saveDocument(filePath, doc)

      return {
        ok: true,
        nodeId: params.nodeId,
        entityId: params.entityId,
        fieldMappings: binding.fieldMappings,
      }
    }

    case 'remove_binding': {
      if (!params.nodeId) throw new Error('nodeId is required for remove_binding')

      const children = getDocChildren(doc, params.pageId)
      const node = findNodeInTree(children, params.nodeId)
      if (!node) throw new Error(`Node not found: ${params.nodeId}`)

      const updated = updateNodeInTree(children, params.nodeId, { dataBinding: undefined } as any)
      setDocChildren(doc, updated, params.pageId)
      await saveDocument(filePath, doc)

      return { ok: true, nodeId: params.nodeId }
    }

    case 'list_bindings': {
      const children = getDocChildren(doc, params.pageId)
      const allNodes = flattenNodes(children)
      const bindings = allNodes
        .filter((n) => n.dataBinding)
        .map((n) => ({
          nodeId: n.id,
          nodeName: n.name ?? '',
          entityId: n.dataBinding!.entityId,
          fieldMappings: n.dataBinding!.fieldMappings,
        }))

      return { bindings }
    }

    default:
      throw new Error(`Unknown action: ${params.action}`)
  }
}
