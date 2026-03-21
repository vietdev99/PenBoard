// ---------------------------------------------------------------------------
// format_flow MCP tool — Auto-arrange root frames as tree layout based on connections
// ---------------------------------------------------------------------------

import { openDocument, saveDocument, resolveDocPath } from '../document-manager'
import { getDocChildren, setDocChildren, findParentInTree } from '../utils/node-operations'
import type { PenDocument, PenNode } from '../../types/pen'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FormatFlowParams {
  filePath?: string
  pageId?: string
  gapX?: number
  gapY?: number
}

// ---------------------------------------------------------------------------
// Tool Definition
// ---------------------------------------------------------------------------

export const FORMAT_FLOW_TOOLS = [
  {
    name: 'format_flow',
    description:
      'Auto-arrange root frames on a page as a tree layout based on screen connections. ' +
      'Frames linked by connections are arranged left-to-right in tree form (parents → children). ' +
      'Unconnected frames are placed in a separate column on the right. ' +
      'Returns the number of frames arranged and their new positions.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filePath: {
          type: 'string',
          description: 'Path to .pb/.op file, or omit to use the live canvas (default)',
        },
        pageId: {
          type: 'string',
          description: 'Target page ID (defaults to first page)',
        },
        gapX: {
          type: 'number',
          description: 'Horizontal gap between columns (default 200)',
        },
        gapY: {
          type: 'number',
          description: 'Vertical gap between rows (default 60)',
        },
      },
      required: [],
    },
  },
]

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/** Find root frame ID for a given node ID by walking up the tree */
function findRootFrameId(children: PenNode[], nodeId: string): string | undefined {
  // Check if it's a root-level node
  for (const node of children) {
    if (node.id === nodeId) return node.id
  }
  // Walk up from child to root
  for (const rootNode of children) {
    if (isDescendant(rootNode, nodeId)) return rootNode.id
  }
  return undefined
}

function isDescendant(node: PenNode, targetId: string): boolean {
  if (!('children' in node) || !node.children) return false
  for (const child of node.children) {
    if (child.id === targetId) return true
    if (isDescendant(child, targetId)) return true
  }
  return false
}

export async function handleFormatFlow(params: FormatFlowParams): Promise<Record<string, unknown>> {
  const filePath = resolveDocPath(params.filePath)
  let doc = await openDocument(filePath)
  doc = structuredClone(doc)

  const connections = doc.connections ?? []
  if (connections.length === 0) {
    return { ok: false, error: 'No connections found in document' }
  }

  const children = getDocChildren(doc, params.pageId)
  const rootFrames = children.filter((n) => n.type === 'frame')
  if (rootFrames.length === 0) {
    return { ok: false, error: 'No root frames found on page' }
  }

  const GAP_X = params.gapX ?? 200
  const GAP_Y = params.gapY ?? 60

  const allRootIds = new Set(rootFrames.map((n) => n.id))
  const frameSizes = new Map<string, { w: number; h: number }>()
  for (const frame of rootFrames) {
    frameSizes.set(frame.id, {
      w: (frame as any).width ?? 300,
      h: (frame as any).height ?? 200,
    })
  }

  // Build directed graph: source root frame → target root frame
  const childrenMap = new Map<string, Set<string>>()
  const parentsMap = new Map<string, Set<string>>()
  for (const fid of allRootIds) {
    childrenMap.set(fid, new Set())
    parentsMap.set(fid, new Set())
  }

  const connectedIds = new Set<string>()
  for (const conn of connections) {
    const srcRoot = findRootFrameId(children, conn.sourceElementId)
    const tgtRoot = conn.targetFrameId
      ? findRootFrameId(children, conn.targetFrameId)
      : undefined

    if (srcRoot && allRootIds.has(srcRoot)) connectedIds.add(srcRoot)
    if (tgtRoot && allRootIds.has(tgtRoot)) connectedIds.add(tgtRoot)

    if (srcRoot && tgtRoot && srcRoot !== tgtRoot && allRootIds.has(srcRoot) && allRootIds.has(tgtRoot)) {
      childrenMap.get(srcRoot)!.add(tgtRoot)
      parentsMap.get(tgtRoot)!.add(srcRoot)
    }
  }

  // Find roots (no incoming edges)
  const roots = Array.from(connectedIds).filter((id) => parentsMap.get(id)!.size === 0)
  if (roots.length === 0 && connectedIds.size > 0) {
    roots.push(Array.from(connectedIds)[0]) // fallback for cycles
  }

  // Starting point: use the topmost-leftmost frame as anchor
  let startX = Infinity
  let startY = Infinity
  for (const frame of rootFrames) {
    startX = Math.min(startX, (frame as any).x ?? 0)
    startY = Math.min(startY, (frame as any).y ?? 0)
  }
  if (!isFinite(startX)) startX = 100
  if (!isFinite(startY)) startY = 100

  // Compute subtree height (total vertical span including gaps)
  const subtreeHeight = (id: string, visited: Set<string>): number => {
    visited.add(id)
    const kids = Array.from(childrenMap.get(id) ?? []).filter((c) => !visited.has(c))
    if (kids.length === 0) return frameSizes.get(id)?.h ?? 200

    let total = 0
    for (const child of kids) {
      if (total > 0) total += GAP_Y
      total += subtreeHeight(child, new Set(visited))
    }
    return Math.max(frameSizes.get(id)?.h ?? 200, total)
  }

  // BFS level assignment for column x-offsets
  const nodeLevel = new Map<string, number>()
  const bfsQueue: string[] = []
  for (const r of roots) {
    nodeLevel.set(r, 0)
    bfsQueue.push(r)
  }
  const bfsVisited = new Set(roots)
  while (bfsQueue.length > 0) {
    const cur = bfsQueue.shift()!
    const curLvl = nodeLevel.get(cur)!
    for (const child of childrenMap.get(cur) ?? []) {
      if (!bfsVisited.has(child)) {
        bfsVisited.add(child)
        nodeLevel.set(child, curLvl + 1)
        bfsQueue.push(child)
      }
    }
  }
  for (const fid of connectedIds) {
    if (!nodeLevel.has(fid)) nodeLevel.set(fid, 0)
  }

  // Column max widths and x-offsets
  const maxLevel = Math.max(0, ...nodeLevel.values())
  const colMaxWidth: number[] = Array(maxLevel + 1).fill(0)
  for (const [fid, lvl] of nodeLevel) {
    colMaxWidth[lvl] = Math.max(colMaxWidth[lvl], frameSizes.get(fid)?.w ?? 300)
  }
  const colX: number[] = [startX]
  for (let i = 1; i <= maxLevel; i++) {
    colX[i] = colX[i - 1] + colMaxWidth[i - 1] + GAP_X
  }

  // Place subtrees recursively, centering children around parent
  const positions = new Map<string, { x: number; y: number }>()
  const placed = new Set<string>()

  const placeSubtree = (id: string, centerY: number, visited: Set<string>) => {
    if (placed.has(id)) return
    placed.add(id)
    visited.add(id)
    const lvl = nodeLevel.get(id) ?? 0
    const size = frameSizes.get(id) ?? { w: 300, h: 200 }
    positions.set(id, { x: colX[lvl], y: centerY - size.h / 2 })

    const kids = Array.from(childrenMap.get(id) ?? []).filter((c) => !visited.has(c) && !placed.has(c))
    if (kids.length === 0) return

    const childHeights = kids.map((c) => subtreeHeight(c, new Set(visited)))
    const totalChildrenH = childHeights.reduce((s, h) => s + h, 0) + GAP_Y * (kids.length - 1)

    let childY = centerY - totalChildrenH / 2
    for (let i = 0; i < kids.length; i++) {
      const childCenterY = childY + childHeights[i] / 2
      placeSubtree(kids[i], childCenterY, new Set(visited))
      childY += childHeights[i] + GAP_Y
    }
  }

  // Place each root tree
  let nextRootY = startY
  for (const rootId of roots) {
    const treeH = subtreeHeight(rootId, new Set())
    const rootSize = frameSizes.get(rootId) ?? { w: 300, h: 200 }
    const centerY = nextRootY + Math.max(treeH, rootSize.h) / 2
    placeSubtree(rootId, centerY, new Set())
    nextRootY += Math.max(treeH, rootSize.h) + GAP_Y * 2
  }

  // Place unconnected frames in last column
  const lastColX = colX.length > 0
    ? colX[colX.length - 1] + colMaxWidth[colMaxWidth.length - 1] + GAP_X
    : startX
  const unconnected = Array.from(allRootIds).filter((id) => !connectedIds.has(id))
  if (unconnected.length > 0) {
    let curY = startY
    for (const fid of unconnected) {
      const size = frameSizes.get(fid) ?? { w: 300, h: 200 }
      positions.set(fid, { x: lastColX, y: curY })
      curY += size.h + GAP_Y
    }
  }

  // Apply positions to document nodes
  const result: Array<{ id: string; name: string; x: number; y: number }> = []
  for (const [fid, pos] of positions) {
    const node = children.find((n) => n.id === fid)
    if (node) {
      ;(node as any).x = pos.x
      ;(node as any).y = pos.y
      result.push({ id: fid, name: node.name ?? fid, x: pos.x, y: pos.y })
    }
  }

  await saveDocument(filePath, doc)

  return {
    ok: true,
    framesArranged: result.length,
    connectedFrames: connectedIds.size,
    unconnectedFrames: unconnected.length,
    positions: result,
  }
}
