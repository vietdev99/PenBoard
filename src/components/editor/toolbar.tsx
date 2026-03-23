import { useState, useRef, useCallback } from 'react'
import {
  MousePointer2,
  Type,
  Frame,
  Hand,
  Undo2,
  Redo2,
  Braces,
  LayoutGrid,
  Database,
  Cable,
  GitBranch,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import ToolButton from './tool-button'
import ShapeToolDropdown from './shape-tool-dropdown'
import { useCanvasStore } from '@/stores/canvas-store'
import { useDocumentStore, generateId } from '@/stores/document-store'
import { getActivePage } from '@/stores/document-tree-utils'
import { parseSvgToNodes } from '@/utils/svg-parser'
import { getCanvasSize, getSkiaEngineRef } from '@/canvas/skia-engine-ref'
import { useHistoryStore } from '@/stores/history-store'
import { useUIKitStore } from '@/stores/uikit-store'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import IconPickerDialog from '@/components/shared/icon-picker-dialog'

export default function Toolbar() {
  const { t } = useTranslation()
  const canUndo = useHistoryStore((s) => s.undoStack.length > 0)
  const canRedo = useHistoryStore((s) => s.redoStack.length > 0)
  const activePageId = useCanvasStore((s) => s.activePageId)
  const pageType = useDocumentStore((s) => getActivePage(s.document, activePageId)?.type)
  const variablesPanelOpen = useCanvasStore((s) => s.variablesPanelOpen)
  const toggleVariablesPanel = useCanvasStore((s) => s.toggleVariablesPanel)
  const dataPanelOpen = useCanvasStore((s) => s.dataPanelOpen)
  const toggleDataPanel = useCanvasStore((s) => s.toggleDataPanel)
  const showConnections = useCanvasStore((s) => s.showConnections)
  const toggleShowConnections = useCanvasStore((s) => s.toggleShowConnections)
  const browserOpen = useUIKitStore((s) => s.browserOpen)
  const toggleBrowser = useUIKitStore((s) => s.toggleBrowser)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [iconPickerOpen, setIconPickerOpen] = useState(false)

  const handleIconSelect = useCallback((svgText: string, iconName: string) => {
    const nodes = parseSvgToNodes(svgText)
    if (nodes.length === 0) return

    const { viewport } = useCanvasStore.getState()
    const { width: canvasW, height: canvasH } = getCanvasSize()
    const centerX = (-viewport.panX + canvasW / 2) / viewport.zoom
    const centerY = (-viewport.panY + canvasH / 2) / viewport.zoom

    for (const node of nodes) {
      const w = ('width' in node ? (typeof node.width === 'number' ? node.width : 100) : 100)
      const h = ('height' in node ? (typeof node.height === 'number' ? node.height : 100) : 100)
      node.x = centerX - w / 2
      node.y = centerY - h / 2
      node.name = iconName
      if (node.type === 'path') node.iconId = iconName
      useDocumentStore.getState().addNode(null, node)
    }
    setIconPickerOpen(false)
  }, [])

  const handleUndo = () => {
    const currentDoc = useDocumentStore.getState().document
    const prev = useHistoryStore.getState().undo(currentDoc)
    if (prev) {
      useDocumentStore.getState().applyHistoryState(prev)
    }
    useCanvasStore.getState().clearSelection()
  }

  const handleRedo = () => {
    const currentDoc = useDocumentStore.getState().document
    const next = useHistoryStore.getState().redo(currentDoc)
    if (next) {
      useDocumentStore.getState().applyHistoryState(next)
    }
    useCanvasStore.getState().clearSelection()
  }

  const handleAddImage = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Reset input so the same file can be re-selected
    e.target.value = ''

    const isSvg = file.type === 'image/svg+xml'

    if (isSvg) {
      // SVG → parse into editable path/shape nodes
      const reader = new FileReader()
      reader.onload = () => {
        const svgText = reader.result as string
        const nodes = parseSvgToNodes(svgText)
        if (nodes.length === 0) return

        const { viewport } = useCanvasStore.getState()
        const { width: canvasW, height: canvasH } = getCanvasSize()
        const centerX = (-viewport.panX + canvasW / 2) / viewport.zoom
        const centerY = (-viewport.panY + canvasH / 2) / viewport.zoom

        for (const node of nodes) {
          const w = ('width' in node ? (typeof node.width === 'number' ? node.width : 100) : 100)
          const h = ('height' in node ? (typeof node.height === 'number' ? node.height : 100) : 100)
          node.x = centerX - w / 2
          node.y = centerY - h / 2
          node.name = file.name.replace(/\.[^.]+$/, '')
          useDocumentStore.getState().addNode(null, node)
        }
      }
      reader.readAsText(file)
    } else {
      // Raster image → ImageNode with data URL
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        const img = new Image()
        img.onload = () => {
          const { viewport } = useCanvasStore.getState()
          const { width: canvasW, height: canvasH } = getCanvasSize()
          const centerX = (-viewport.panX + canvasW / 2) / viewport.zoom
          const centerY = (-viewport.panY + canvasH / 2) / viewport.zoom

          let w = img.naturalWidth
          let h = img.naturalHeight
          const maxDim = 400
          if (w > maxDim || h > maxDim) {
            const scale = maxDim / Math.max(w, h)
            w = Math.round(w * scale)
            h = Math.round(h * scale)
          }

          useDocumentStore.getState().addNode(null, {
            id: generateId(),
            type: 'image',
            name: file.name.replace(/\.[^.]+$/, ''),
            src: dataUrl,
            x: centerX - w / 2,
            y: centerY - h / 2,
            width: w,
            height: h,
          })
        }
        img.src = dataUrl
      }
      reader.readAsDataURL(file)
    }
  }, [])

  const handleFormatFlow = useCallback(() => {
    const docStore = useDocumentStore.getState()
    const connections = docStore.document.connections ?? []
    const engine = getSkiaEngineRef()
    if (!engine || connections.length === 0) return

    // Collect all root frames on canvas
    const rootFrames = engine.renderNodes.filter((rn) => !rn.clipRect && rn.node.type === 'frame')
    if (rootFrames.length === 0) return

    const allRootIds = new Set(rootFrames.map((rn) => rn.node.id))
    const frameSizes = new Map<string, { w: number; h: number }>()
    for (const rn of rootFrames) {
      frameSizes.set(rn.node.id, { w: rn.absW, h: rn.absH })
    }

    // Build nodeId → root frame mapping (sourceElementId is a child, need its root)
    const nodeToRoot = new Map<string, string>()
    const buildNodeToRoot = (id: string) => {
      if (nodeToRoot.has(id)) return nodeToRoot.get(id)!
      let rootId = id
      let parent = docStore.getParentOf(id)
      while (parent) { rootId = parent.id; parent = docStore.getParentOf(parent.id) }
      nodeToRoot.set(id, rootId)
      return rootId
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
      const srcRoot = buildNodeToRoot(conn.sourceElementId)
      const tgtRoot = conn.targetFrameId ? buildNodeToRoot(conn.targetFrameId) : undefined
      if (srcRoot && allRootIds.has(srcRoot)) connectedIds.add(srcRoot)
      if (tgtRoot && allRootIds.has(tgtRoot)) connectedIds.add(tgtRoot)
      if (srcRoot && tgtRoot && srcRoot !== tgtRoot && allRootIds.has(srcRoot) && allRootIds.has(tgtRoot)) {
        childrenMap.get(srcRoot)!.add(tgtRoot)
        parentsMap.get(tgtRoot)!.add(srcRoot)
      }
    }

    // Find connected components (undirected flood fill) — each cluster gets its own root
    const componentOf = new Map<string, number>()
    let componentCount = 0
    for (const startId of connectedIds) {
      if (componentOf.has(startId)) continue
      const compId = componentCount++
      const stack = [startId]
      componentOf.set(startId, compId)
      while (stack.length > 0) {
        const cur = stack.pop()!
        for (const neighbor of childrenMap.get(cur) ?? []) {
          if (!componentOf.has(neighbor)) { componentOf.set(neighbor, compId); stack.push(neighbor) }
        }
        for (const neighbor of parentsMap.get(cur) ?? []) {
          if (!componentOf.has(neighbor)) { componentOf.set(neighbor, compId); stack.push(neighbor) }
        }
      }
    }

    // Find root for each component: prefer node with no incoming edges, fallback to first
    const roots: string[] = []
    for (let comp = 0; comp < componentCount; comp++) {
      const members = Array.from(connectedIds).filter((id) => componentOf.get(id) === comp)
      const compRoot = members.find((id) => parentsMap.get(id)!.size === 0) ?? members[0]
      if (compRoot) roots.push(compRoot)
    }

    // Layout constants
    const GAP_X = 120
    const GAP_Y = 200

    // Starting point: use the topmost-leftmost frame as anchor
    let startX = Infinity, startY = Infinity
    for (const rn of rootFrames) {
      startX = Math.min(startX, rn.absX)
      startY = Math.min(startY, rn.absY)
    }
    if (!isFinite(startX)) { startX = 100; startY = 100 }

    // --- Vertical tree layout (top-down) ---

    // Step 1: BFS level assignment (level = row from top)
    const nodeLevel = new Map<string, number>()
    const bfsQueue: string[] = []
    for (const r of roots) { nodeLevel.set(r, 0); bfsQueue.push(r) }
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
        levelFrames[lvl].sort((a, b) => (a).localeCompare(b))
      } else {
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

    // Step 5: Bottom-up subtree width (only follow tree edges — ignore back-edges)
    const subtreeWidth = new Map<string, number>()
    const computeSubtreeWidth = (nodeId: string): number => {
      if (subtreeWidth.has(nodeId)) return subtreeWidth.get(nodeId)!
      const ownW = frameSizes.get(nodeId)?.w ?? 300
      const myLevel = nodeLevel.get(nodeId) ?? 0
      const kids = Array.from(childrenMap.get(nodeId) ?? []).filter(
        (c) => nodeLevel.get(c) === myLevel + 1,
      )
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
    for (const fid of connectedIds) {
      if (!subtreeWidth.has(fid)) computeSubtreeWidth(fid)
    }

    // Step 6: Top-down X placement — each node centered within its allocated subtree width
    const positions = new Map<string, { x: number; y: number }>()

    const placeSubtree = (nodeId: string, allocatedX: number, allocatedWidth: number) => {
      const ownW = frameSizes.get(nodeId)?.w ?? 300
      const lvl = nodeLevel.get(nodeId) ?? 0
      const nodeX = allocatedX + (allocatedWidth - ownW) / 2
      positions.set(nodeId, { x: nodeX, y: rowY[lvl] })

      const kids = Array.from(childrenMap.get(nodeId) ?? []).filter(
        (c) => nodeLevel.get(c) === lvl + 1 && !positions.has(c),
      )
      if (kids.length === 0) return

      let childrenTotalWidth = 0
      for (let i = 0; i < kids.length; i++) {
        if (i > 0) childrenTotalWidth += GAP_X
        childrenTotalWidth += subtreeWidth.get(kids[i]) ?? (frameSizes.get(kids[i])?.w ?? 300)
      }

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
      rootX += sw + GAP_X * 2
    }

    // Place any connected nodes that weren't placed (cycles/orphans)
    for (const fid of connectedIds) {
      if (!positions.has(fid)) {
        const lvl = nodeLevel.get(fid) ?? 0
        const ownW = frameSizes.get(fid)?.w ?? 300
        positions.set(fid, { x: rootX, y: rowY[lvl] })
        rootX += ownW + GAP_X
      }
    }

    // Step 7: Iterative overlap resolution + parent re-centering
    const shiftSubtreeX = (nodeId: string, dx: number) => {
      const pos = positions.get(nodeId)
      if (!pos) return
      pos.x += dx
      const lvl = nodeLevel.get(nodeId) ?? 0
      for (const child of childrenMap.get(nodeId) ?? []) {
        if (nodeLevel.get(child) === lvl + 1 && positions.has(child)) {
          shiftSubtreeX(child, dx)
        }
      }
    }

    for (let pass = 0; pass < 5; pass++) {
      let anyShift = false

      // Resolve horizontal overlaps within each row
      for (let lvl = 0; lvl <= maxLevel; lvl++) {
        const rowFrames = levelFrames[lvl].filter((f) => positions.has(f))
        rowFrames.sort((a, b) => positions.get(a)!.x - positions.get(b)!.x)
        for (let i = 1; i < rowFrames.length; i++) {
          const prevPos = positions.get(rowFrames[i - 1])!
          const prevW = frameSizes.get(rowFrames[i - 1])?.w ?? 300
          const curPos = positions.get(rowFrames[i])!
          const minX = prevPos.x + prevW + GAP_X
          if (curPos.x < minX) {
            shiftSubtreeX(rowFrames[i], minX - curPos.x)
            anyShift = true
          }
        }
      }

      // Re-center parents over their children (bottom-up)
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

    // Final per-row overlap sweep
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
            shiftSubtreeX(rowFrames[i], minX - curPos.x)
            anyFix = true
          }
        }
      }
      if (!anyFix) break
    }

    // Place unconnected frames in a row below the tree
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

    // Apply positions via batch update (single undo step)
    useHistoryStore.getState().startBatch(docStore.document)
    for (const [fid, pos] of positions) {
      docStore.updateNode(fid, { x: pos.x, y: pos.y })
    }
    useHistoryStore.getState().endBatch(useDocumentStore.getState().document)

    // Zoom to fit all after layout
    requestAnimationFrame(() => {
      const eng = getSkiaEngineRef()
      if (eng) {
        eng.zoomToFitNodes(Array.from(allRootIds))
      }
    })
  }, [])

  return (
    <div className="absolute top-2 left-2 z-10 w-10 bg-card border border-border rounded-xl flex flex-col items-center py-2 gap-1 shadow-lg">
      <ToolButton
        tool="select"
        icon={<MousePointer2 size={20} strokeWidth={1.5} />}
        label={t('toolbar.select')}
        shortcut="V"
      />
      {pageType !== 'erd' && (
        <>
          <ShapeToolDropdown
            onIconPickerOpen={() => setIconPickerOpen(true)}
            onImageImport={handleAddImage}
          />
          <ToolButton
            tool="text"
            icon={<Type size={20} strokeWidth={1.5} />}
            label={t('toolbar.text')}
            shortcut="T"
          />
          <ToolButton
            tool="frame"
            icon={<Frame size={20} strokeWidth={1.5} />}
            label={t('toolbar.frame')}
            shortcut="F"
          />
        </>
      )}
      <ToolButton
        tool="hand"
        icon={<Hand size={20} strokeWidth={1.5} />}
        label={t('toolbar.hand')}
        shortcut="H"
      />

      <Separator className="my-1 w-8" />

      {/* Undo / Redo */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleUndo}
            disabled={!canUndo}
          >
            <Undo2 size={18} strokeWidth={1.5} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">
          {t('toolbar.undo')}
          <kbd className="ml-1.5 inline-flex h-4 items-center rounded border border-border/50 bg-muted px-1 font-mono text-[10px] text-muted-foreground">
            {'\u2318'}Z
          </kbd>
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleRedo}
            disabled={!canRedo}
          >
            <Redo2 size={18} strokeWidth={1.5} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">
          {t('toolbar.redo')}
          <kbd className="ml-1.5 inline-flex h-4 items-center rounded border border-border/50 bg-muted px-1 font-mono text-[10px] text-muted-foreground">
            {'\u2318\u21e7'}Z
          </kbd>
        </TooltipContent>
      </Tooltip>

      <Separator className="my-1 w-8" />

      {/* Variables — hidden on ERD pages */}
      {pageType !== 'erd' && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={toggleVariablesPanel}
              aria-label={t('toolbar.variables')}
              aria-pressed={variablesPanelOpen}
              className={`inline-flex items-center justify-center h-8 min-w-8 px-1.5 rounded-lg transition-colors [&_svg]:size-5 [&_svg]:shrink-0 ${
                variablesPanelOpen
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Braces size={20} strokeWidth={1.5} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {t('toolbar.variables')}
            <kbd className="ml-1.5 inline-flex h-4 items-center rounded border border-border/50 bg-muted px-1 font-mono text-[10px] text-muted-foreground">
              {'\u2318\u21e7'}V
            </kbd>
          </TooltipContent>
        </Tooltip>
      )}

      {/* Data Entities — only on ERD pages */}
      {pageType === 'erd' && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={toggleDataPanel}
              aria-label={t('data.panelTitle')}
              aria-pressed={dataPanelOpen}
              className={`inline-flex items-center justify-center h-8 min-w-8 px-1.5 rounded-lg transition-colors [&_svg]:size-5 [&_svg]:shrink-0 ${
                dataPanelOpen
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Database size={20} strokeWidth={1.5} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {t('data.panelTitle')}
            <kbd className="ml-1.5 inline-flex h-4 items-center rounded border border-border/50 bg-muted px-1 font-mono text-[10px] text-muted-foreground">
              {'\u2318\u21e7'}D
            </kbd>
          </TooltipContent>
        </Tooltip>
      )}

      {/* Toggle Connections — hidden on ERD pages */}
      {pageType !== 'erd' && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={toggleShowConnections}
              aria-label="Show Connections"
              aria-pressed={showConnections}
              className={`inline-flex items-center justify-center h-8 min-w-8 px-1.5 rounded-lg transition-colors [&_svg]:size-5 [&_svg]:shrink-0 ${
                showConnections
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Cable size={20} strokeWidth={1.5} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            Toggle Connections
          </TooltipContent>
        </Tooltip>
      )}

      {/* Format flow layout — hidden on ERD pages */}
      {pageType !== 'erd' && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handleFormatFlow}
              aria-label="Format Flow"
              className="inline-flex items-center justify-center h-8 min-w-8 px-1.5 rounded-lg transition-colors [&_svg]:size-5 [&_svg]:shrink-0 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <GitBranch size={20} strokeWidth={1.5} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            Format Flow Layout
          </TooltipContent>
        </Tooltip>
      )}

      {/* UIKit Browser — hidden on ERD pages */}
      {pageType !== 'erd' && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={toggleBrowser}
              aria-label={t('toolbar.uikitBrowser')}
              aria-pressed={browserOpen}
              className={`inline-flex items-center justify-center h-8 min-w-8 px-1.5 rounded-lg transition-colors [&_svg]:size-5 [&_svg]:shrink-0 ${
                browserOpen
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <LayoutGrid size={20} strokeWidth={1.5} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {t('toolbar.uikitBrowser')}
            <kbd className="ml-1.5 inline-flex h-4 items-center rounded border border-border/50 bg-muted px-1 font-mono text-[10px] text-muted-foreground">
              {'\u2318\u21e7'}K
            </kbd>
          </TooltipContent>
        </Tooltip>
      )}

      {/* Hidden file input + icon picker dialog */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif"
        className="hidden"
        onChange={handleFileSelected}
      />
      <IconPickerDialog
        open={iconPickerOpen}
        onClose={() => setIconPickerOpen(false)}
        onSelect={handleIconSelect}
      />
    </div>
  )
}
