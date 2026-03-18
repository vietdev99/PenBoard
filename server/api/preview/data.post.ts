import { defineEventHandler, readBody, setResponseHeaders } from 'h3'
import { setPreviewData } from '../../utils/preview-state'
import type { PenDocument } from '../../../src/types/pen'

interface PostBody {
  id: string
  doc: PenDocument
  activePageId: string | null
  selectedFrameId: string | null
}

/** POST /api/preview/data -- Receives preview data from the editor. */
export default defineEventHandler(async (event) => {
  setResponseHeaders(event, { 'Content-Type': 'application/json' })
  const body = await readBody<PostBody>(event)

  if (!body?.id || !body?.doc) {
    return new Response(
      JSON.stringify({ error: 'Missing id or doc in request body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const { doc } = body
  if (!doc.version || (!Array.isArray(doc.children) && !Array.isArray(doc.pages))) {
    return new Response(
      JSON.stringify({ error: 'Invalid document format' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  setPreviewData(body.id, {
    doc: body.doc,
    activePageId: body.activePageId,
    selectedFrameId: body.selectedFrameId,
  })

  return { ok: true }
})
