import { defineEventHandler, getRouterParam } from 'h3'
import { getPreviewData } from '../../utils/preview-state'

/**
 * GET /api/preview/:id -- Serves the pre-generated preview HTML.
 *
 * The editor generates self-contained HTML via generatePreviewHTML()
 * and POSTs it to /api/preview/data. This route simply serves the
 * stored HTML string.
 */
export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    return new Response('Missing preview ID', {
      status: 400,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  const data = getPreviewData(id)
  if (!data) {
    return new Response(
      'Preview not found. Open preview from the editor.',
      { status: 404, headers: { 'Content-Type': 'text/plain' } },
    )
  }

  return new Response(data.html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
})
