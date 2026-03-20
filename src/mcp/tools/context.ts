// ---------------------------------------------------------------------------
// MCP Tools: set_context, get_context
// Read/write AI-readable context annotations on nodes and pages.
// ---------------------------------------------------------------------------

import { openDocument, saveDocument, resolveDocPath } from '../document-manager'
import {
  findNodeInTree,
  updateNodeInTree,
  getDocChildren,
  setDocChildren,
} from '../utils/node-operations'

// ---------------------------------------------------------------------------
// set_context
// ---------------------------------------------------------------------------

export interface SetContextParams {
  filePath?: string
  nodeId?: string
  pageId?: string
  context: string
}

export async function handleSetContext(
  params: SetContextParams,
): Promise<Record<string, unknown>> {
  const filePath = resolveDocPath(params.filePath)
  let doc = await openDocument(filePath)
  doc = structuredClone(doc)

  if (params.nodeId) {
    // Set context on a node
    const children = getDocChildren(doc, params.pageId)
    const node = findNodeInTree(children, params.nodeId)
    if (!node) throw new Error(`Node not found: ${params.nodeId}`)

    const updated = updateNodeInTree(children, params.nodeId, { context: params.context } as any)
    setDocChildren(doc, updated, params.pageId)
    await saveDocument(filePath, doc)

    return { ok: true, target: params.nodeId, context: params.context }
  }

  if (params.pageId) {
    // Set context on a page
    if (!doc.pages) throw new Error('Document has no pages')
    const page = doc.pages.find((p) => p.id === params.pageId)
    if (!page) throw new Error(`Page not found: ${params.pageId}`)

    page.context = params.context
    await saveDocument(filePath, doc)

    return { ok: true, target: params.pageId, context: params.context }
  }

  throw new Error('Either nodeId or pageId must be provided')
}

// ---------------------------------------------------------------------------
// get_context
// ---------------------------------------------------------------------------

export interface GetContextParams {
  filePath?: string
  nodeId?: string
  pageId?: string
}

export async function handleGetContext(
  params: GetContextParams,
): Promise<Record<string, unknown>> {
  const filePath = resolveDocPath(params.filePath)
  const doc = await openDocument(filePath)

  if (params.nodeId) {
    const children = getDocChildren(doc, params.pageId)
    const node = findNodeInTree(children, params.nodeId)
    if (!node) throw new Error(`Node not found: ${params.nodeId}`)

    return {
      nodeId: params.nodeId,
      name: node.name ?? '',
      context: node.context ?? '',
    }
  }

  if (params.pageId) {
    if (!doc.pages) throw new Error('Document has no pages')
    const page = doc.pages.find((p) => p.id === params.pageId)
    if (!page) throw new Error(`Page not found: ${params.pageId}`)

    return {
      pageId: params.pageId,
      name: page.name,
      context: page.context ?? '',
    }
  }

  throw new Error('Either nodeId or pageId must be provided')
}
