// ---------------------------------------------------------------------------
// format_flow MCP tool — Auto-arrange root frames as layered graph layout
// ---------------------------------------------------------------------------

import { openDocument, saveDocument, resolveDocPath } from '../document-manager'
import { getDocChildren } from '../utils/node-operations'
import type { PenNode } from '../../types/pen'

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
      'Auto-arrange root frames on a page as a layered graph layout based on screen connections. ' +
      'Frames are organized into columns by depth (BFS level from roots), ' +
      'then compacted vertically within each column to minimize wasted space. ' +
      'Unconnected frames are placed in a separate row below. ' +
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
  for (const node of children) {
    if (node.id === nodeId) return node.id
  }
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
  const frameNames = new Map<string, string>()
  for (const frame of rootFrames) {
    frameSizes.set(frame.id, {
      w: (frame as any).width ?? 300,
      h: (frame as any).height ?? 200,
    })
    frameNames.set(frame.id, frame.name ?? frame.id)
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

  // Find roots (no incoming edges among connected nodes)
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

  // ---------------------------------------------------------------------------
  // Layered graph layout (Sugiyama-style, simplified)
  // ---------------------------------------------------------------------------

  // Step 1: BFS level assignment
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
  // Assign unvisited connected nodes to level 0
  for (const fid of connectedIds) {
    if (!nodeLevel.has(fid)) nodeLevel.set(fid, 0)
  }

  // Step 2: Group frames by level (column)
  const maxLevel = Math.max(0, ...nodeLevel.values())
  const levelFrames: string[][] = Array.from({ length: maxLevel + 1 }, () => [])
  for (const [fid, lvl] of nodeLevel) {
    levelFrames[lvl].push(fid)
  }

  // Step 3: Sort frames within each level to reduce edge crossings
  // Heuristic: order by the average Y position of parents (or by name for roots)
  for (let lvl = 0; lvl <= maxLevel; lvl++) {
    if (lvl === 0) {
      // Sort roots alphabetically by name for predictability
      levelFrames[lvl].sort((a, b) => (frameNames.get(a) ?? '').localeCompare(frameNames.get(b) ?? ''))
    } else {
      // Sort by median position of parents in the previous level
      const prevOrder = new Map<string, number>()
      levelFrames[lvl - 1].forEach((fid, idx) => prevOrder.set(fid, idx))

      levelFrames[lvl].sort((a, b) => {
        const aParents = Array.from(parentsMap.get(a) ?? []).filter((p) => prevOrder.has(p))
        const bParents = Array.from(parentsMap.get(b) ?? []).filter((p) => prevOrder.has(p))
        const aMedian = aParents.length > 0
          ? aParents.reduce((s, p) => s + prevOrder.get(p)!, 0) / aParents.length
          : Infinity
        const bMedian = bParents.length > 0
          ? bParents.reduce((s, p) => s + prevOrder.get(p)!, 0) / bParents.length
          : Infinity
        return aMedian - bMedian
      })
    }
  }

  // Step 4: Compute column X positions (based on max width in each level)
  const colMaxWidth: number[] = Array(maxLevel + 1).fill(0)
  for (const [fid, lvl] of nodeLevel) {
    colMaxWidth[lvl] = Math.max(colMaxWidth[lvl], frameSizes.get(fid)?.w ?? 300)
  }
  const colX: number[] = [startX]
  for (let i = 1; i <= maxLevel; i++) {
    colX[i] = colX[i - 1] + colMaxWidth[i - 1] + GAP_X
  }

  // Step 5: Place frames — compact vertical layout within each column
  const positions = new Map<string, { x: number; y: number }>()

  // First pass: place each level's frames with simple stacking
  for (let lvl = 0; lvl <= maxLevel; lvl++) {
    let curY = startY
    for (const fid of levelFrames[lvl]) {
      const size = frameSizes.get(fid) ?? { w: 300, h: 200 }
      positions.set(fid, { x: colX[lvl], y: curY })
      curY += size.h + GAP_Y
    }
  }

  // Second pass: vertically center children around their parent's center
  // This improves readability by aligning connected frames
  for (let lvl = 1; lvl <= maxLevel; lvl++) {
    // Group frames by their primary parent (first parent in the previous level)
    const groups = new Map<string, string[]>()
    const orphans: string[] = []

    for (const fid of levelFrames[lvl]) {
      const parents = Array.from(parentsMap.get(fid) ?? []).filter((p) => nodeLevel.get(p) === lvl - 1)
      if (parents.length > 0) {
        const primaryParent = parents[0]
        if (!groups.has(primaryParent)) groups.set(primaryParent, [])
        groups.get(primaryParent)!.push(fid)
      } else {
        orphans.push(fid)
      }
    }

    // Place each group centered around its parent
    let nextGroupY = startY
    const parentOrder = levelFrames[lvl - 1]

    for (const parentId of parentOrder) {
      const group = groups.get(parentId)
      if (!group || group.length === 0) continue

      const parentPos = positions.get(parentId)!
      const parentSize = frameSizes.get(parentId) ?? { w: 300, h: 200 }
      const parentCenterY = parentPos.y + parentSize.h / 2

      // Total height of this group
      let groupH = 0
      for (const fid of group) {
        if (groupH > 0) groupH += GAP_Y
        groupH += (frameSizes.get(fid)?.h ?? 200)
      }

      // Center the group around the parent's center, but don't go above nextGroupY
      let groupTopY = Math.max(nextGroupY, parentCenterY - groupH / 2)

      let curY = groupTopY
      for (const fid of group) {
        const size = frameSizes.get(fid) ?? { w: 300, h: 200 }
        positions.set(fid, { x: colX[lvl], y: curY })
        curY += size.h + GAP_Y
      }
      nextGroupY = curY
    }

    // Place orphans (no parent in previous level) after all groups
    for (const fid of orphans) {
      const size = frameSizes.get(fid) ?? { w: 300, h: 200 }
      positions.set(fid, { x: colX[lvl], y: nextGroupY })
      nextGroupY += size.h + GAP_Y
    }
  }

  // Step 6: Place unconnected frames in a row below all connected frames
  const unconnected = Array.from(allRootIds).filter((id) => !connectedIds.has(id))
  if (unconnected.length > 0) {
    // Find the bottom of all placed frames
    let maxBottomY = startY
    for (const [fid, pos] of positions) {
      const size = frameSizes.get(fid) ?? { w: 300, h: 200 }
      maxBottomY = Math.max(maxBottomY, pos.y + size.h)
    }
    const unconnectedY = maxBottomY + GAP_Y * 2

    let curX = startX
    for (const fid of unconnected) {
      const size = frameSizes.get(fid) ?? { w: 300, h: 200 }
      positions.set(fid, { x: curX, y: unconnectedY })
      curX += size.w + GAP_X
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
