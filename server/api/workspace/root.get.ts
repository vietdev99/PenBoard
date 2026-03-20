import { defineEventHandler, setResponseHeaders } from 'h3'
import { getSyncFilePath } from '../../utils/mcp-sync-state'
import { dirname } from 'node:path'

/** GET /api/workspace/root -- Returns the workspace root directory (dirname of current .pb file). */
export default defineEventHandler((event) => {
  setResponseHeaders(event, { 'Content-Type': 'application/json' })
  const filePath = getSyncFilePath()
  if (!filePath) {
    return new Response(
      JSON.stringify({ error: 'No file path available. Save the document first.' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
    )
  }
  return { root: dirname(filePath) }
})
