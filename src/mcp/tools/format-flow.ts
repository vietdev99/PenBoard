// ---------------------------------------------------------------------------
// format_flow MCP tool — Auto-arrange root frames as a vertical tree layout
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
      'Auto-arrange root frames on a page as a vertical tree layout (top-down) based on screen connections. ' +
      'Root frames (no incoming edges) are placed at the top, children below. ' +
      'Each parent\'s children are centered horizontally beneath it. ' +
      'Connection lines flow straight downward, naturally avoiding frame overlap. ' +
      'Unconnected frames are placed in a row below the tree. ' +
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
          description: 'Horizontal gap between sibling frames (default 120)',
        },
        gapY: {
          type: 'number',
          description: 'Vertical gap between tree levels (default 200)',
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

  const GAP_X = params.gapX ?? 120
  const GAP_Y = params.gapY ?? 200

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

  // Find connected components (undirected) — each cluster gets its own root
  const componentOf = new Map<string, number>()
  let componentCount = 0
  for (const startId of connectedIds) {
    if (componentOf.has(startId)) continue
    const compId = componentCount++
    const stack = [startId]
    componentOf.set(startId, compId)
    while (stack.length > 0) {
      const cur = stack.pop()!
      // Follow both directions (undirected)
      for (const neighbor of childrenMap.get(cur) ?? []) {
        if (!componentOf.has(neighbor)) { componentOf.set(neighbor, compId); stack.push(neighbor) }
      }
      for (const neighbor of parentsMap.get(cur) ?? []) {
        if (!componentOf.has(neighbor)) { componentOf.set(neighbor, compId); stack.push(neighbor) }
      }
    }
  }

  // Find root for each component: prefer node with no incoming edges, fallback to first node
  const roots: string[] = []
  for (let comp = 0; comp < componentCount; comp++) {
    const members = Array.from(connectedIds).filter((id) => componentOf.get(id) === comp)
    const compRoot = members.find((id) => parentsMap.get(id)!.size === 0) ?? members[0]
    if (compRoot) roots.push(compRoot)
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
  // Vertical tree layout (top-down)
  // ---------------------------------------------------------------------------

  // Step 1: BFS level assignment (level = row from top)
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

  // Step 2: Group frames by level (row)
  const maxLevel = Math.max(0, ...nodeLevel.values())
  const levelFrames: string[][] = Array.from({ length: maxLevel + 1 }, () => [])
  for (const [fid, lvl] of nodeLevel) {
    levelFrames[lvl].push(fid)
  }

  // Step 3: Sort frames within each level to reduce edge crossings
  for (let lvl = 0; lvl <= maxLevel; lvl++) {
    if (lvl === 0) {
      levelFrames[lvl].sort((a, b) => (frameNames.get(a) ?? '').localeCompare(frameNames.get(b) ?? ''))
    } else {
      // Sort by median X position of parents in the previous level
      // (will be computed after parent positions are assigned — use parent order as proxy)
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

  // Step 4: Compute row Y positions (based on max height in each level)
  const rowMaxHeight: number[] = Array(maxLevel + 1).fill(0)
  for (const [fid, lvl] of nodeLevel) {
    rowMaxHeight[lvl] = Math.max(rowMaxHeight[lvl], frameSizes.get(fid)?.h ?? 200)
  }
  const rowY: number[] = [startY]
  for (let i = 1; i <= maxLevel; i++) {
    rowY[i] = rowY[i - 1] + rowMaxHeight[i - 1] + GAP_Y
  }

  // Step 5: Bottom-up subtree width calculation for proper centering
  // Each node's subtree width = max(own width, sum of children subtree widths + gaps)
  const subtreeWidth = new Map<string, number>()

  function computeSubtreeWidth(nodeId: string): number {
    if (subtreeWidth.has(nodeId)) return subtreeWidth.get(nodeId)!

    const ownW = frameSizes.get(nodeId)?.w ?? 300
    const kids = Array.from(childrenMap.get(nodeId) ?? []).filter((c) => nodeLevel.has(c))

    if (kids.length === 0) {
      subtreeWidth.set(nodeId, ownW)
      return ownW
    }

    let childrenTotalWidth = 0
    for (let i = 0; i < kids.length; i++) {
      if (i > 0) childrenTotalWidth += GAP_X
      childrenTotalWidth += computeSubtreeWidth(kids[i])
    }

    const w = Math.max(ownW, childrenTotalWidth)
    subtreeWidth.set(nodeId, w)
    return w
  }

  for (const r of roots) computeSubtreeWidth(r)
  // Also compute for any connected nodes not reachable from roots (cycles)
  for (const fid of connectedIds) {
    if (!subtreeWidth.has(fid)) computeSubtreeWidth(fid)
  }

  // Step 6: Top-down X placement — each node centered within its allocated subtree width
  const positions = new Map<string, { x: number; y: number }>()

  function placeSubtree(nodeId: string, allocatedX: number, allocatedWidth: number) {
    const ownW = frameSizes.get(nodeId)?.w ?? 300
    const lvl = nodeLevel.get(nodeId) ?? 0

    // Center this node within its allocated width
    const nodeX = allocatedX + (allocatedWidth - ownW) / 2
    positions.set(nodeId, { x: nodeX, y: rowY[lvl] })

    // Place children spread within this node's allocated width
    const kids = Array.from(childrenMap.get(nodeId) ?? []).filter(
      (c) => nodeLevel.has(c) && !positions.has(c),
    )
    if (kids.length === 0) return

    let childrenTotalWidth = 0
    for (let i = 0; i < kids.length; i++) {
      if (i > 0) childrenTotalWidth += GAP_X
      childrenTotalWidth += subtreeWidth.get(kids[i]) ?? (frameSizes.get(kids[i])?.w ?? 300)
    }

    // Center children block under this node
    let childX = allocatedX + (allocatedWidth - childrenTotalWidth) / 2

    for (const kid of kids) {
      const kidW = subtreeWidth.get(kid) ?? (frameSizes.get(kid)?.w ?? 300)
      placeSubtree(kid, childX, kidW)
      childX += kidW + GAP_X
    }
  }

  // Place each root tree side by side
  let rootX = startX
  for (const r of roots) {
    const sw = subtreeWidth.get(r) ?? (frameSizes.get(r)?.w ?? 300)
    placeSubtree(r, rootX, sw)
    rootX += sw + GAP_X * 2 // extra gap between root trees
  }

  // Place any connected nodes that weren't placed (e.g., cycles or orphans within connected set)
  for (const fid of connectedIds) {
    if (!positions.has(fid)) {
      const lvl = nodeLevel.get(fid) ?? 0
      const ownW = frameSizes.get(fid)?.w ?? 300
      positions.set(fid, { x: rootX, y: rowY[lvl] })
      rootX += ownW + GAP_X
    }
  }

  // Step 7-9: Iterative overlap resolution + parent re-centering (max 5 passes)
  for (let pass = 0; pass < 5; pass++) {
    let anyShift = false

    // 7a: Resolve horizontal overlaps within each row (top-down, shift subtrees)
    for (let lvl = 0; lvl <= maxLevel; lvl++) {
      const rowFrames = levelFrames[lvl].filter((f) => positions.has(f))
      rowFrames.sort((a, b) => positions.get(a)!.x - positions.get(b)!.x)
      for (let i = 1; i < rowFrames.length; i++) {
        const prevPos = positions.get(rowFrames[i - 1])!
        const prevW = frameSizes.get(rowFrames[i - 1])?.w ?? 300
        const curPos = positions.get(rowFrames[i])!
        const minX = prevPos.x + prevW + GAP_X
        if (curPos.x < minX) {
          const shift = minX - curPos.x
          shiftSubtreeX(rowFrames[i], shift, childrenMap, nodeLevel, positions)
          anyShift = true
        }
      }
    }

    // 7b: Re-center parents over their children (bottom-up)
    for (let lvl = maxLevel - 1; lvl >= 0; lvl--) {
      for (const parentId of levelFrames[lvl]) {
        const kids = Array.from(childrenMap.get(parentId) ?? []).filter(
          (c) => nodeLevel.get(c) === lvl + 1 && positions.has(c),
        )
        if (kids.length === 0) continue

        const parentW = frameSizes.get(parentId)?.w ?? 300
        const firstKidPos = positions.get(kids[0])!
        const lastKid = kids[kids.length - 1]
        const lastKidPos = positions.get(lastKid)!
        const lastKidW = frameSizes.get(lastKid)?.w ?? 300
        const childrenCenterX = (firstKidPos.x + lastKidPos.x + lastKidW) / 2
        const newX = childrenCenterX - parentW / 2
        const oldX = positions.get(parentId)!.x
        if (Math.abs(newX - oldX) > 1) {
          positions.get(parentId)!.x = newX
          anyShift = true
        }
      }
    }

    if (!anyShift) break
  }

  // Step 9: Final per-row overlap sweep — guarantee no horizontal overlap
  // (only push horizontally to preserve row Y positions from tree layout)
  for (let pass = 0; pass < 3; pass++) {
    let anyFix = false
    for (let lvl = 0; lvl <= maxLevel; lvl++) {
      const rowFrames = levelFrames[lvl].filter((f) => positions.has(f))
      rowFrames.sort((a, b) => positions.get(a)!.x - positions.get(b)!.x)
      for (let i = 1; i < rowFrames.length; i++) {
        const prevPos = positions.get(rowFrames[i - 1])!
        const prevW = frameSizes.get(rowFrames[i - 1])?.w ?? 300
        const curPos = positions.get(rowFrames[i])!
        const minX = prevPos.x + prevW + GAP_X
        if (curPos.x < minX) {
          const shift = minX - curPos.x
          shiftSubtreeX(rowFrames[i], shift, childrenMap, nodeLevel, positions)
          anyFix = true
        }
      }
    }
    if (!anyFix) break
  }

  // Step 10: Place unconnected frames in a row below the tree
  const unconnected = Array.from(allRootIds).filter((id) => !connectedIds.has(id))
  if (unconnected.length > 0) {
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

/** Shift a node and all its descendants rightward */
function shiftSubtreeX(
  nodeId: string,
  dx: number,
  childrenMap: Map<string, Set<string>>,
  nodeLevel: Map<string, number>,
  positions: Map<string, { x: number; y: number }>,
) {
  const pos = positions.get(nodeId)
  if (!pos) return
  pos.x += dx

  const lvl = nodeLevel.get(nodeId) ?? 0
  for (const child of childrenMap.get(nodeId) ?? []) {
    if (nodeLevel.get(child) === lvl + 1 && positions.has(child)) {
      shiftSubtreeX(child, dx, childrenMap, nodeLevel, positions)
    }
  }
}
