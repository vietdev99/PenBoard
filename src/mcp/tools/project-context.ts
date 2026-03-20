// ---------------------------------------------------------------------------
// get_project_context MCP tool — One-call full project context for AI agents
// ---------------------------------------------------------------------------

import { resolveDocPath, openDocument, LIVE_CANVAS_PATH, getSyncUrl } from '../document-manager'
import { flattenNodes } from '../../stores/document-tree-utils'
import { buildWorkflowGraph } from '../../services/workflow/graph-builder'
import { generateMermaid } from '../../services/workflow/mermaid-generator'
import { dirname, join } from 'node:path'
import { readFile, readdir } from 'node:fs/promises'
import type { PenDocument, PenNode, PenPage } from '../../types/pen'
import type { DataEntity } from '../../types/data-entity'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GetProjectContextParams {
  filePath?: string
  /** Include full flow markdown content (default true) */
  includeFlowContent?: boolean
  /** Include full doc content (default true) */
  includeDocContent?: boolean
  /** Max depth for node tree summary (default 2) */
  nodeDepth?: number
}

interface PageSummary {
  id: string
  name: string
  type: string
  context?: string
  frames: FrameSummary[]
}

interface FrameSummary {
  id: string
  name: string
  type: string
  role?: string
  context?: string
  size: { width: number | string; height: number | string }
  childCount: number
  children?: NodeBrief[]
}

interface NodeBrief {
  id: string
  name?: string
  type: string
  role?: string
  context?: string
  childCount: number
  children?: NodeBrief[]
}

interface EntitySummary {
  id: string
  name: string
  fields: { name: string; type: string; isPrimaryKey?: boolean; relatedEntity?: string }[]
  rowCount: number
  sampleRow?: Record<string, unknown>
}

interface ConnectionSummary {
  id: string
  from: string // "PageName / FrameName"
  to: string   // "PageName / FrameName"
  label?: string
  trigger: string
  transition: string
}

interface FlowSummary {
  name: string
  title: string
  content?: string
}

interface DocSummary {
  category: string
  name: string
  title: string
  content?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractTitle(content: string): string {
  const match = content.match(/^#\s+(.+)/m)
  return match?.[1]?.trim() ?? 'Untitled'
}

function summarizeNode(node: PenNode, depth: number, maxDepth: number): NodeBrief {
  const children = node.children ?? []
  const brief: NodeBrief = {
    id: node.id,
    name: node.name,
    type: node.type,
    childCount: children.length,
  }
  if (node.role) brief.role = node.role
  if (node.context) brief.context = node.context
  if (depth < maxDepth && children.length > 0) {
    brief.children = children.map(c => summarizeNode(c, depth + 1, maxDepth))
  }
  return brief
}

function summarizeFrame(node: PenNode, maxDepth: number): FrameSummary {
  const children = node.children ?? []
  const frame: FrameSummary = {
    id: node.id,
    name: node.name || 'Unnamed',
    type: node.type,
    size: { width: node.width ?? 0, height: node.height ?? 0 },
    childCount: children.length,
  }
  if (node.role) frame.role = node.role
  if (node.context) frame.context = node.context
  if (maxDepth > 1 && children.length > 0) {
    frame.children = children.map(c => summarizeNode(c, 1, maxDepth))
  }
  return frame
}

function buildEntitySummary(entity: DataEntity): EntitySummary {
  // Build field name lookup for displaying sample row by name
  const fieldNameById = new Map<string, string>()
  for (const f of entity.fields) {
    fieldNameById.set(f.id, f.name)
  }

  const summary: EntitySummary = {
    id: entity.id,
    name: entity.name,
    fields: entity.fields.map(f => {
      const fd: EntitySummary['fields'][0] = { name: f.name, type: f.type }
      if (f.isPrimaryKey) fd.isPrimaryKey = true
      if (f.type === 'relation' && f.relatedEntityId) {
        fd.relatedEntity = f.relatedEntityId
      }
      return fd
    }),
    rowCount: entity.rows.length,
  }

  // Include first row as sample, mapped to field names
  if (entity.rows.length > 0) {
    const row = entity.rows[0]
    const named: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(row.values)) {
      const fieldName = fieldNameById.get(key) ?? key
      named[fieldName] = val
    }
    summary.sampleRow = named
  }

  // Resolve related entity names
  return summary
}

function buildConnectionSummaries(
  doc: PenDocument,
): ConnectionSummary[] {
  const connections = doc.connections ?? []
  const pages = doc.pages ?? []
  const pageMap = new Map<string, PenPage>()
  for (const p of pages) pageMap.set(p.id, p)

  return connections.map(c => {
    const srcPage = pageMap.get(c.sourcePageId)
    const tgtPage = pageMap.get(c.targetPageId)

    // Find source frame name
    let fromLabel = srcPage?.name ?? c.sourcePageId
    if (srcPage) {
      const srcFrame = (srcPage.children ?? []).find(n => n.id === c.sourceElementId)
      if (srcFrame?.name) fromLabel = `${srcPage.name} / ${srcFrame.name}`
      else {
        // Search deeper
        const flat = flattenNodes(srcPage.children ?? [])
        const found = flat.find(n => n.id === c.sourceElementId)
        if (found?.name) fromLabel = `${srcPage.name} / ${found.name}`
      }
    }

    // Find target frame name
    let toLabel = tgtPage?.name ?? c.targetPageId
    if (tgtPage && c.targetFrameId) {
      const tgtFrame = (tgtPage.children ?? []).find(n => n.id === c.targetFrameId)
      if (tgtFrame?.name) toLabel = `${tgtPage.name} / ${tgtFrame.name}`
    }

    return {
      id: c.id,
      from: fromLabel,
      to: toLabel,
      label: c.label,
      trigger: c.triggerEvent || 'click',
      transition: c.transitionType || 'push',
    }
  })
}

async function resolveWorkspaceRoot(filePath?: string): Promise<string | null> {
  const docPath = resolveDocPath(filePath)

  if (docPath === LIVE_CANVAS_PATH) {
    try {
      const syncUrl = await getSyncUrl()
      if (!syncUrl) return null
      const res = await fetch(`${syncUrl}/api/workspace/root`)
      if (res.ok) {
        const { root } = (await res.json()) as { root: string }
        return root
      }
    } catch { /* no workspace */ }
    return null
  }

  return dirname(docPath)
}

async function loadFlows(
  workspaceRoot: string,
  includeContent: boolean,
): Promise<FlowSummary[]> {
  const dir = join(workspaceRoot, '.penboard', 'flows')
  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch {
    return []
  }

  const mdFiles = entries.filter(f => f.endsWith('.md'))
  return Promise.all(
    mdFiles.map(async file => {
      const content = await readFile(join(dir, file), 'utf-8')
      const name = file.replace(/\.md$/, '')
      const flow: FlowSummary = { name, title: extractTitle(content) }
      if (includeContent) flow.content = content
      return flow
    }),
  )
}

async function loadDocs(
  workspaceRoot: string,
  includeContent: boolean,
): Promise<DocSummary[]> {
  const docsRoot = join(workspaceRoot, '.penboard', 'docs')
  let categories: string[]
  try {
    categories = await readdir(docsRoot)
  } catch {
    return []
  }

  const results: DocSummary[] = []
  for (const cat of categories) {
    let files: string[]
    try {
      files = await readdir(join(docsRoot, cat))
    } catch {
      continue
    }
    for (const file of files.filter(f => f.endsWith('.md'))) {
      const content = await readFile(join(docsRoot, cat, file), 'utf-8')
      const name = file.replace(/\.md$/, '')
      const doc: DocSummary = { category: cat, name, title: extractTitle(content) }
      if (includeContent) doc.content = content
      results.push(doc)
    }
  }
  return results
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handleGetProjectContext(params: GetProjectContextParams): Promise<{
  pages: PageSummary[]
  entities: EntitySummary[]
  connections: ConnectionSummary[]
  workflow: string
  flows: FlowSummary[]
  docs: DocSummary[]
  stats: { totalNodes: number; totalPages: number; totalEntities: number; totalConnections: number; totalFlows: number }
}> {
  const includeFlowContent = params.includeFlowContent !== false
  const includeDocContent = params.includeDocContent !== false
  const nodeDepth = params.nodeDepth ?? 2

  const docPath = resolveDocPath(params.filePath)
  const doc = await openDocument(docPath)
  const pages = doc.pages ?? []
  const entities = doc.entities ?? []
  const connections = doc.connections ?? []

  // 1. Pages with frame summaries
  const pageSummaries: PageSummary[] = pages.map(page => ({
    id: page.id,
    name: page.name,
    type: page.type ?? 'screen',
    context: page.context,
    frames: (page.children ?? []).map(child => summarizeFrame(child, nodeDepth)),
  }))

  // 2. Entity summaries with field names resolved
  const entitySummaries = entities.map(e => {
    const summary = buildEntitySummary(e)
    // Resolve relatedEntity ID → name
    for (const f of summary.fields) {
      if (f.relatedEntity) {
        const related = entities.find(en => en.id === f.relatedEntity)
        if (related) f.relatedEntity = related.name
      }
    }
    return summary
  })

  // 3. Connection summaries with human-readable names
  const connectionSummaries = buildConnectionSummaries(doc)

  // 4. Workflow mermaid diagram
  let workflowMermaid = ''
  try {
    const graph = buildWorkflowGraph(doc)
    workflowMermaid = generateMermaid(graph)
  } catch {
    workflowMermaid = '(no workflow data)'
  }

  // 5. Workspace flows & docs
  const workspaceRoot = await resolveWorkspaceRoot(params.filePath)
  let flows: FlowSummary[] = []
  let docs: DocSummary[] = []
  if (workspaceRoot) {
    flows = await loadFlows(workspaceRoot, includeFlowContent)
    docs = await loadDocs(workspaceRoot, includeDocContent)
  }

  // 6. Stats
  let totalNodes = 0
  for (const page of pages) {
    totalNodes += flattenNodes(page.children ?? []).length
  }

  return {
    pages: pageSummaries,
    entities: entitySummaries,
    connections: connectionSummaries,
    workflow: workflowMermaid,
    flows,
    docs,
    stats: {
      totalNodes,
      totalPages: pages.length,
      totalEntities: entities.length,
      totalConnections: connections.length,
      totalFlows: flows.length,
    },
  }
}
