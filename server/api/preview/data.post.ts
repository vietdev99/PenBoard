import { defineEventHandler, readBody, setResponseHeaders } from 'h3'
import { setPreviewData } from '../../utils/preview-state'

interface PostBody {
  id: string
  html: string
}

/** POST /api/preview/data -- Receives pre-generated preview HTML from the editor. */
export default defineEventHandler(async (event) => {
  setResponseHeaders(event, { 'Content-Type': 'application/json' })
  const body = await readBody<PostBody>(event)

  if (!body?.id || !body?.html) {
    return new Response(
      JSON.stringify({ error: 'Missing id or html in request body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  setPreviewData(body.id, body.html)

  return { ok: true }
})
