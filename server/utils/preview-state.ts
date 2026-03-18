/**
 * In-memory preview state for Interactive Preview.
 * Mirrors the mcp-sync-state.ts pattern: in-memory store + SSE broadcast.
 *
 * Preview data is stored per preview ID. Each preview tab subscribes
 * via SSE and receives update notifications when the editor pushes new data.
 */

import type { PenDocument } from '../../src/types/pen'
import type { ServerResponse } from 'node:http'

export interface PreviewData {
  doc: PenDocument
  activePageId: string | null
  selectedFrameId: string | null
  timestamp: number
}

interface PreviewSSEClient {
  id: string
  res: ServerResponse
}

const previews = new Map<string, PreviewData>()
const sseClients = new Map<string, Set<PreviewSSEClient>>()

export function setPreviewData(
  previewId: string,
  data: Omit<PreviewData, 'timestamp'>,
): void {
  previews.set(previewId, { ...data, timestamp: Date.now() })
  broadcastToPreview(previewId, { type: 'preview:update' })
}

export function getPreviewData(previewId: string): PreviewData | undefined {
  return previews.get(previewId)
}

export function deletePreviewData(previewId: string): void {
  previews.delete(previewId)
  sseClients.delete(previewId)
}

export function registerPreviewSSE(
  previewId: string,
  clientId: string,
  res: ServerResponse,
): void {
  if (!sseClients.has(previewId)) sseClients.set(previewId, new Set())
  sseClients.get(previewId)!.add({ id: clientId, res })
}

export function unregisterPreviewSSE(
  previewId: string,
  clientId: string,
): void {
  const clients = sseClients.get(previewId)
  if (!clients) return
  for (const c of clients) {
    if (c.id === clientId) {
      clients.delete(c)
      break
    }
  }
}

function broadcastToPreview(
  previewId: string,
  payload: Record<string, unknown>,
): void {
  const clients = sseClients.get(previewId)
  if (!clients) return
  const data = `data: ${JSON.stringify(payload)}\n\n`
  for (const client of clients) {
    try {
      if (!client.res.closed) client.res.write(data)
    } catch {
      clients.delete(client)
    }
  }
}

// TTL cleanup: remove previews older than 30 minutes
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000
  for (const [id, data] of previews) {
    if (data.timestamp < cutoff) {
      previews.delete(id)
      sseClients.delete(id)
    }
  }
}, 5 * 60 * 1000)
