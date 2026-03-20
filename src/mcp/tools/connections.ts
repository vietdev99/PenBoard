// ---------------------------------------------------------------------------
// MCP Tool: manage_connections
// CRUD for screen connections (navigation arrows between pages).
// ---------------------------------------------------------------------------

import { openDocument, saveDocument, resolveDocPath } from '../document-manager'
import { generateId } from '../utils/id'
import type { ScreenConnection } from '../../types/pen'

export interface ManageConnectionsParams {
  filePath?: string
  action: 'add_connection' | 'update_connection' | 'remove_connection' | 'list_connections'
  connectionId?: string
  sourceElementId?: string
  sourcePageId?: string
  targetPageId?: string
  targetFrameId?: string
  label?: string
  triggerEvent?: 'click' | 'hover' | 'submit'
  transitionType?: 'push' | 'modal' | 'replace'
  updates?: Partial<ScreenConnection>
  pageId?: string
}

export async function handleManageConnections(
  params: ManageConnectionsParams,
): Promise<Record<string, unknown>> {
  const filePath = resolveDocPath(params.filePath)
  let doc = await openDocument(filePath)
  doc = structuredClone(doc)

  // Ensure connections array
  if (!doc.connections) doc.connections = []

  switch (params.action) {
    case 'add_connection': {
      if (!params.sourceElementId) throw new Error('sourceElementId is required for add_connection')
      if (!params.sourcePageId) throw new Error('sourcePageId is required for add_connection')
      if (!params.targetPageId) throw new Error('targetPageId is required for add_connection')
      if (!params.triggerEvent) throw new Error('triggerEvent is required for add_connection')
      if (!params.transitionType) throw new Error('transitionType is required for add_connection')

      const id = generateId()
      const connection: ScreenConnection = {
        id,
        sourceElementId: params.sourceElementId,
        sourcePageId: params.sourcePageId,
        targetPageId: params.targetPageId,
        triggerEvent: params.triggerEvent,
        transitionType: params.transitionType,
      }
      if (params.targetFrameId) connection.targetFrameId = params.targetFrameId
      if (params.label) connection.label = params.label

      doc.connections.push(connection)
      await saveDocument(filePath, doc)

      return { connectionId: id, connectionCount: doc.connections.length }
    }

    case 'update_connection': {
      if (!params.connectionId) throw new Error('connectionId is required for update_connection')
      const conn = doc.connections.find((c) => c.id === params.connectionId)
      if (!conn) throw new Error(`Connection not found: ${params.connectionId}`)

      if (params.updates) {
        Object.assign(conn, params.updates)
        conn.id = params.connectionId // Protect ID
      }
      await saveDocument(filePath, doc)

      return { ok: true }
    }

    case 'remove_connection': {
      if (!params.connectionId) throw new Error('connectionId is required for remove_connection')
      const idx = doc.connections.findIndex((c) => c.id === params.connectionId)
      if (idx === -1) throw new Error(`Connection not found: ${params.connectionId}`)

      doc.connections.splice(idx, 1)
      await saveDocument(filePath, doc)

      return { ok: true, remainingConnections: doc.connections.length }
    }

    case 'list_connections': {
      let connections = doc.connections
      if (params.pageId) {
        connections = connections.filter(
          (c) => c.sourcePageId === params.pageId || c.targetPageId === params.pageId,
        )
      }
      return { connections }
    }

    default:
      throw new Error(`Unknown action: ${params.action}`)
  }
}
