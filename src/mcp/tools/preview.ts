// ---------------------------------------------------------------------------
// generate_preview MCP tool — Generate interactive HTML preview for a screen page
// ---------------------------------------------------------------------------

import { resolveDocPath, openDocument, getSyncUrl } from '../document-manager'
import { generateId } from '../utils/id'
import type { PenPage } from '../../types/pen'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GeneratePreviewParams {
  filePath?: string
  pageId: string
  frameId?: string
}

interface PreviewResult {
  previewId: string
  url: string
  pageName: string
  pageId: string
  frameId: string | null
}

// ---------------------------------------------------------------------------
// Tool Definition
// ---------------------------------------------------------------------------

export const PREVIEW_TOOLS = [
  {
    name: 'generate_preview',
    description:
      'Generate an interactive HTML preview for a screen page and return its URL. ' +
      'Requires a running PenBoard instance. Only screen pages are previewable ' +
      '(ERD and component pages return an error). Each call generates a fresh static snapshot.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filePath: {
          type: 'string',
          description: 'Path to .pb/.op file, or omit for live canvas',
        },
        pageId: {
          type: 'string',
          description: 'ID of the page to preview (must be a screen page)',
        },
        frameId: {
          type: 'string',
          description:
            'Optional: preview only this specific frame instead of the entire page',
        },
      },
      required: ['pageId'],
    },
  },
]

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handleGeneratePreview(
  params: GeneratePreviewParams,
): Promise<PreviewResult> {
  const filePath = resolveDocPath(params.filePath)
  const doc = await openDocument(filePath)

  // Validate page exists
  const page = doc.pages?.find((p: PenPage) => p.id === params.pageId)
  if (!page) {
    throw new Error(`Page not found: ${params.pageId}`)
  }

  // Page type guard: only screen pages are previewable
  if (page.type === 'erd' || page.type === 'component') {
    throw new Error(
      `Only screen pages are previewable. Page "${page.name}" is type "${page.type}"`,
    )
  }

  // Require a running PenBoard instance for preview hosting
  const syncUrl = await getSyncUrl()
  if (!syncUrl) {
    throw new Error(
      'No running PenBoard instance found. Start PenBoard or the dev server, then try again.',
    )
  }

  const previewId = generateId()

  // Dynamic import to avoid browser-only dependency issues in MCP bundle
  const { generatePreviewHTML } = await import(
    '../../services/preview/preview-html-generator'
  )

  const html = generatePreviewHTML(
    doc,
    params.pageId,
    params.frameId ?? null,
    previewId,
  )

  // POST preview HTML to running PenBoard instance
  const res = await fetch(`${syncUrl}/api/preview/data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: previewId, html }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as Record<string, unknown>)
    throw new Error(
      `Failed to post preview data: ${(body as { error?: string }).error ?? res.status}`,
    )
  }

  return {
    previewId,
    url: `${syncUrl}/preview/${previewId}`,
    pageName: page.name,
    pageId: params.pageId,
    frameId: params.frameId ?? null,
  }
}
