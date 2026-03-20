// ---------------------------------------------------------------------------
// Workspace MCP tools — Read/write flow & doc files in .penboard/ directory
// ---------------------------------------------------------------------------

import { resolveDocPath, openDocument, saveDocument, LIVE_CANVAS_PATH, getSyncUrl } from '../document-manager'
import { dirname, join } from 'node:path'
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkspaceManifest {
  version: string
  flows: { name: string; title: string; updatedAt: string }[]
  docs: { category: string; name: string; title: string; updatedAt: string }[]
}

interface WriteFlowParams { filePath?: string; name: string; content: string }
interface ReadFlowParams { filePath?: string; name: string }
interface ListFlowsParams { filePath?: string }
interface WriteDocParams { filePath?: string; category: string; name: string; content: string }
interface ReadDocParams { filePath?: string; category: string; name: string }

// ---------------------------------------------------------------------------
// Workspace path resolution
// ---------------------------------------------------------------------------

async function resolveWorkspaceRoot(filePath?: string): Promise<string> {
  const docPath = resolveDocPath(filePath)

  if (docPath === LIVE_CANVAS_PATH) {
    // For live canvas: fetch workspace root from Nitro sync API
    const syncUrl = await getSyncUrl()
    if (!syncUrl) throw new Error('No running PenBoard instance. Start the app first.')

    const serverRes = await fetch(`${syncUrl}/api/workspace/root`)
    if (serverRes.ok) {
      const { root } = (await serverRes.json()) as { root: string }
      return root
    }
    throw new Error('Save the document first to use workspace features.')
  }

  // File-based: workspace is the directory containing the .pb file
  return dirname(docPath)
}

function penboardDir(workspaceRoot: string): string {
  return join(workspaceRoot, '.penboard')
}

function flowsDir(workspaceRoot: string): string {
  return join(penboardDir(workspaceRoot), 'flows')
}

function docsDir(workspaceRoot: string, category: string): string {
  return join(penboardDir(workspaceRoot), 'docs', category)
}

function manifestPath(workspaceRoot: string): string {
  return join(penboardDir(workspaceRoot), 'manifest.json')
}

// ---------------------------------------------------------------------------
// Manifest helpers
// ---------------------------------------------------------------------------

async function readManifest(workspaceRoot: string): Promise<WorkspaceManifest> {
  try {
    const raw = await readFile(manifestPath(workspaceRoot), 'utf-8')
    return JSON.parse(raw)
  } catch {
    return { version: '1.0.0', flows: [], docs: [] }
  }
}

async function writeManifest(workspaceRoot: string, manifest: WorkspaceManifest): Promise<void> {
  await mkdir(penboardDir(workspaceRoot), { recursive: true })
  await writeFile(manifestPath(workspaceRoot), JSON.stringify(manifest, null, 2), 'utf-8')
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function extractTitle(content: string): string {
  const match = content.match(/^#\s+(.+)/m)
  return match?.[1]?.trim() ?? 'Untitled'
}

/** Ensure the PenDocument has workspace field set (for file-based docs). */
async function ensureWorkspaceField(filePath?: string): Promise<void> {
  const docPath = resolveDocPath(filePath)
  if (docPath === LIVE_CANVAS_PATH) return
  try {
    const doc = await openDocument(docPath)
    if (!doc.workspace) {
      doc.workspace = '.'
      await saveDocument(docPath, doc)
    }
  } catch {
    // Non-critical: workspace field is optional
  }
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export const WORKSPACE_TOOLS = [
  {
    name: 'write_flow',
    description:
      'Create or update a mermaid flow document in .penboard/flows/{name}.md. ' +
      'Content should be full markdown with H1 title, description, and ```mermaid code blocks.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filePath: {
          type: 'string',
          description: 'Path to .pb/.op file, or omit for live canvas',
        },
        name: {
          type: 'string',
          description: 'Flow file name (without .md extension)',
        },
        content: {
          type: 'string',
          description: 'Full markdown content with H1 title, description, and mermaid code blocks',
        },
      },
      required: ['name', 'content'],
    },
  },
  {
    name: 'read_flow',
    description: 'Read a flow document from .penboard/flows/{name}.md.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filePath: {
          type: 'string',
          description: 'Path to .pb/.op file, or omit for live canvas',
        },
        name: {
          type: 'string',
          description: 'Flow file name (without .md extension)',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'list_flows',
    description: 'List all flow documents in .penboard/flows/.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filePath: {
          type: 'string',
          description: 'Path to .pb/.op file, or omit for live canvas',
        },
      },
      required: [],
    },
  },
  {
    name: 'write_doc',
    description:
      'Create or update a context document in .penboard/docs/{category}/{name}.md.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filePath: {
          type: 'string',
          description: 'Path to .pb/.op file, or omit for live canvas',
        },
        category: {
          type: 'string',
          description: 'Document category (e.g. "specs", "guides", "notes")',
        },
        name: {
          type: 'string',
          description: 'Document file name (without .md extension)',
        },
        content: {
          type: 'string',
          description: 'Full markdown content',
        },
      },
      required: ['category', 'name', 'content'],
    },
  },
  {
    name: 'read_doc',
    description: 'Read a context document from .penboard/docs/{category}/{name}.md.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filePath: {
          type: 'string',
          description: 'Path to .pb/.op file, or omit for live canvas',
        },
        category: {
          type: 'string',
          description: 'Document category',
        },
        name: {
          type: 'string',
          description: 'Document file name (without .md extension)',
        },
      },
      required: ['category', 'name'],
    },
  },
]

// ---------------------------------------------------------------------------
// Handler implementations
// ---------------------------------------------------------------------------

export async function handleWriteFlow(params: WriteFlowParams): Promise<{
  success: boolean
  path: string
  title: string
}> {
  if (!params.name) throw new Error('Missing required parameter: name')
  if (!params.content) throw new Error('Missing required parameter: content')

  const root = await resolveWorkspaceRoot(params.filePath)
  await mkdir(flowsDir(root), { recursive: true })

  const fPath = join(flowsDir(root), `${params.name}.md`)
  await writeFile(fPath, params.content, 'utf-8')

  // Update manifest
  const manifest = await readManifest(root)
  const title = extractTitle(params.content)
  const existingIdx = manifest.flows.findIndex((f) => f.name === params.name)
  const entry = { name: params.name, title, updatedAt: new Date().toISOString() }
  if (existingIdx >= 0) {
    manifest.flows[existingIdx] = entry
  } else {
    manifest.flows.push(entry)
  }
  await writeManifest(root, manifest)

  // Ensure workspace field on PenDocument
  await ensureWorkspaceField(params.filePath)

  return { success: true, path: fPath, title }
}

export async function handleReadFlow(params: ReadFlowParams): Promise<{
  name: string
  title: string
  content: string
}> {
  if (!params.name) throw new Error('Missing required parameter: name')

  const root = await resolveWorkspaceRoot(params.filePath)
  const fPath = join(flowsDir(root), `${params.name}.md`)

  let content: string
  try {
    content = await readFile(fPath, 'utf-8')
  } catch {
    throw new Error(
      `Flow "${params.name}" not found at ${fPath}. ` +
      'Use list_flows to see available flows, or write_flow to create one.',
    )
  }

  return { name: params.name, title: extractTitle(content), content }
}

export async function handleListFlows(params: ListFlowsParams): Promise<{
  flows: { name: string; title: string; path: string }[]
}> {
  const root = await resolveWorkspaceRoot(params.filePath)

  let entries: string[]
  try {
    entries = await readdir(flowsDir(root))
  } catch {
    // Directory doesn't exist yet
    return { flows: [] }
  }

  const mdFiles = entries.filter((f) => f.endsWith('.md'))
  const flows = await Promise.all(
    mdFiles.map(async (file) => {
      const content = await readFile(join(flowsDir(root), file), 'utf-8')
      const name = file.replace(/\.md$/, '')
      return { name, title: extractTitle(content), path: join(flowsDir(root), file) }
    }),
  )

  return { flows }
}

export async function handleWriteDoc(params: WriteDocParams): Promise<{
  success: boolean
  path: string
  title: string
}> {
  if (!params.category) throw new Error('Missing required parameter: category')
  if (!params.name) throw new Error('Missing required parameter: name')
  if (!params.content) throw new Error('Missing required parameter: content')

  const root = await resolveWorkspaceRoot(params.filePath)
  await mkdir(docsDir(root, params.category), { recursive: true })

  const fPath = join(docsDir(root, params.category), `${params.name}.md`)
  await writeFile(fPath, params.content, 'utf-8')

  // Update manifest
  const manifest = await readManifest(root)
  const title = extractTitle(params.content)
  const existingIdx = manifest.docs.findIndex(
    (d) => d.category === params.category && d.name === params.name,
  )
  const entry = {
    category: params.category,
    name: params.name,
    title,
    updatedAt: new Date().toISOString(),
  }
  if (existingIdx >= 0) {
    manifest.docs[existingIdx] = entry
  } else {
    manifest.docs.push(entry)
  }
  await writeManifest(root, manifest)

  // Ensure workspace field on PenDocument
  await ensureWorkspaceField(params.filePath)

  return { success: true, path: fPath, title }
}

export async function handleReadDoc(params: ReadDocParams): Promise<{
  category: string
  name: string
  title: string
  content: string
}> {
  if (!params.category) throw new Error('Missing required parameter: category')
  if (!params.name) throw new Error('Missing required parameter: name')

  const root = await resolveWorkspaceRoot(params.filePath)
  const fPath = join(docsDir(root, params.category), `${params.name}.md`)

  let content: string
  try {
    content = await readFile(fPath, 'utf-8')
  } catch {
    throw new Error(
      `Doc "${params.category}/${params.name}" not found at ${fPath}. ` +
      'Use write_doc to create one.',
    )
  }

  return { category: params.category, name: params.name, title: extractTitle(content), content }
}
