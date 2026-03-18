import { defineEventHandler, getQuery } from 'h3'
import { randomUUID } from 'node:crypto'
import type { ServerResponse } from 'node:http'
import { registerPreviewSSE, unregisterPreviewSSE } from '../../utils/preview-state'

/** GET /api/preview/events?id=xxx -- SSE stream for preview hot reload. */
export default defineEventHandler((event) => {
  const { id } = getQuery(event) as { id?: string }
  if (!id) {
    return new Response('Missing preview id query parameter', {
      status: 400,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  const clientId = randomUUID()

  // Write headers directly on the raw Node.js response for h3 v2 compatibility.
  const res = event.node!.res! as ServerResponse
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  })

  // Send client ID
  res.write(`data: ${JSON.stringify({ type: 'client:id', clientId })}\n\n`)

  registerPreviewSSE(id, clientId, res)

  // Keep-alive heartbeat every 30 seconds
  const heartbeat = setInterval(() => {
    if (!res.closed) res.write(': heartbeat\n\n')
  }, 30_000)

  res.on('close', () => {
    clearInterval(heartbeat)
    unregisterPreviewSSE(id, clientId)
  })

  // Return a promise that resolves on close to prevent h3 from ending the response
  return new Promise<void>((resolve) => {
    res.on('close', resolve)
  })
})
