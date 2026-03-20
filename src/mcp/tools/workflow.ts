// ---------------------------------------------------------------------------
// export_workflow MCP tool — Export workflow diagram in mermaid/SVG/PNG
// ---------------------------------------------------------------------------

import { resolveDocPath, openDocument } from '../document-manager'
import {
  buildWorkflowGraph,
  filterGraphByFocus,
} from '../../services/workflow/graph-builder'
import { generateMermaid } from '../../services/workflow/mermaid-generator'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExportWorkflowParams {
  filePath?: string
  format?: 'mermaid' | 'svg' | 'png'
  focusPageId?: string
}

interface WorkflowResult {
  format: 'mermaid' | 'svg' | 'png'
  content: string
  nodeCount: number
  edgeCount: number
  encoding?: 'base64'
}

// ---------------------------------------------------------------------------
// Tool Definition
// ---------------------------------------------------------------------------

export const WORKFLOW_TOOLS = [
  {
    name: 'export_workflow',
    description:
      'Export the workflow diagram showing screen connections and data flows. ' +
      'Formats: "mermaid" (text, always available), "svg" (base64, requires mermaid-cli), ' +
      '"png" (base64, requires mermaid-cli). Use focusPageId to filter to a specific page ' +
      'and its neighbors.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filePath: {
          type: 'string',
          description: 'Path to .pb/.op file, or omit for live canvas',
        },
        format: {
          type: 'string',
          enum: ['mermaid', 'svg', 'png'],
          description: 'Output format (default: mermaid)',
        },
        focusPageId: {
          type: 'string',
          description:
            'Optional: filter diagram to this page and its direct neighbors',
        },
      },
      required: [],
    },
  },
]

// ---------------------------------------------------------------------------
// Mermaid rendering (SVG/PNG) — optional dependency
// ---------------------------------------------------------------------------

// Cache Puppeteer browser instance for repeated calls
let cachedBrowser: unknown = null

async function renderMermaidToBase64(
  definition: string,
  format: 'svg' | 'png',
): Promise<string> {
  try {
    const { renderMermaid } = await import('@mermaid-js/mermaid-cli')
    const puppeteer = await import('puppeteer')

    if (!cachedBrowser) {
      cachedBrowser = await (puppeteer as any).default.launch({
        headless: 'shell',
      })
    }

    const { data } = await renderMermaid(
      cachedBrowser as any,
      definition,
      format as any,
      { backgroundColor: 'white' },
    )

    return Buffer.from(data).toString('base64')
  } catch (err) {
    throw new Error(
      'SVG/PNG export requires @mermaid-js/mermaid-cli. Install with: bun add @mermaid-js/mermaid-cli. ' +
        `Mermaid text format is always available. Error: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

// Clean up Puppeteer browser on process exit
process.on('exit', () => {
  if (cachedBrowser && typeof (cachedBrowser as any).close === 'function') {
    ;(cachedBrowser as any).close()
  }
})

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handleExportWorkflow(
  params: ExportWorkflowParams,
): Promise<WorkflowResult> {
  const filePath = resolveDocPath(params.filePath)
  const doc = await openDocument(filePath)

  let graph = buildWorkflowGraph(doc)

  // Apply focus mode filter if requested
  if (params.focusPageId) {
    graph = filterGraphByFocus(graph, params.focusPageId)
  }

  const mermaidText = generateMermaid(graph)
  const format = params.format ?? 'mermaid'

  if (format === 'mermaid') {
    return {
      format: 'mermaid',
      content: mermaidText,
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
    }
  }

  // SVG or PNG — render via mermaid-cli
  const base64 = await renderMermaidToBase64(mermaidText, format)

  return {
    format,
    content: base64,
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    encoding: 'base64',
  }
}
