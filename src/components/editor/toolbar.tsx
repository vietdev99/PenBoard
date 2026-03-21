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
    for (const conn of connections) {
      const srcRoot = buildNodeToRoot(conn.sourceElementId)
      const tgtRoot = conn.targetFrameId ? buildNodeToRoot(conn.targetFrameId) : undefined
      if (srcRoot && tgtRoot && srcRoot !== tgtRoot && allRootIds.has(srcRoot) && allRootIds.has(tgtRoot)) {
        childrenMap.get(srcRoot)!.add(tgtRoot)
        parentsMap.get(tgtRoot)!.add(srcRoot)
      }
    }

    // Separate: frames with connections vs isolated frames
    const connectedIds = new Set<string>()
    for (const conn of connections) {
      const src = buildNodeToRoot(conn.sourceElementId)
      const tgt = conn.targetFrameId ? buildNodeToRoot(conn.targetFrameId) : undefined
      if (src && allRootIds.has(src)) connectedIds.add(src)
      if (tgt && allRootIds.has(tgt)) connectedIds.add(tgt)
    }

    // Find roots (no incoming edges)
    const roots = Array.from(connectedIds).filter((id) => parentsMap.get(id)!.size === 0)
    if (roots.length === 0 && connectedIds.size > 0) {
      roots.push(Array.from(connectedIds)[0]) // fallback for cycles
    }

    // Layout constants
    const GAP_X = 200
    const GAP_Y = 60

    // Starting point: use the topmost-leftmost frame as anchor
    let startX = Infinity, startY = Infinity
    for (const rn of rootFrames) {
      startX = Math.min(startX, rn.absX)
      startY = Math.min(startY, rn.absY)
    }
    if (!isFinite(startX)) { startX = 100; startY = 100 }

    // Recursive tree layout: compute subtree height, then position
    // Each node's children are centered vertically around the node's center
    const positions = new Map<string, { x: number; y: number }>()
    const placed = new Set<string>()

    // Compute subtree height (total vertical span including gaps)
    const subtreeHeight = (id: string, visited: Set<string>): number => {
      visited.add(id)
      const children = Array.from(childrenMap.get(id) ?? []).filter((c) => !visited.has(c))
      if (children.length === 0) return frameSizes.get(id)?.h ?? 200

      let total = 0
      for (const child of children) {
        if (total > 0) total += GAP_Y
        total += subtreeHeight(child, new Set(visited))
      }
      // Subtree height is max of own height and children's combined height
      return Math.max(frameSizes.get(id)?.h ?? 200, total)
    }

    // Compute max width per column (BFS level) for consistent x-spacing
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
    // Unvisited → level 0
    for (const fid of connectedIds) {
      if (!nodeLevel.has(fid)) nodeLevel.set(fid, 0)
    }

    const maxLevel = Math.max(0, ...nodeLevel.values())
    const colMaxWidth: number[] = Array(maxLevel + 1).fill(0)
    for (const [fid, lvl] of nodeLevel) {
      colMaxWidth[lvl] = Math.max(colMaxWidth[lvl], frameSizes.get(fid)?.w ?? 300)
    }
    // Column x-offsets
    const colX: number[] = [startX]
    for (let i = 1; i <= maxLevel; i++) {
      colX[i] = colX[i - 1] + colMaxWidth[i - 1] + GAP_X
    }

    // Place a subtree rooted at `id` with its center at `centerY`
    const placeSubtree = (id: string, centerY: number, visited: Set<string>) => {
      if (placed.has(id)) return
      placed.add(id)
      visited.add(id)
      const lvl = nodeLevel.get(id) ?? 0
      const size = frameSizes.get(id) ?? { w: 300, h: 200 }
      positions.set(id, { x: colX[lvl], y: centerY - size.h / 2 })

      const children = Array.from(childrenMap.get(id) ?? []).filter((c) => !visited.has(c) && !placed.has(c))
      if (children.length === 0) return

      // Compute each child's subtree height
      const childHeights = children.map((c) => subtreeHeight(c, new Set(visited)))
      const totalChildrenH = childHeights.reduce((s, h) => s + h, 0) + GAP_Y * (children.length - 1)

      // Center children block around parent's center
      let childY = centerY - totalChildrenH / 2
      for (let i = 0; i < children.length; i++) {
        const childCenterY = childY + childHeights[i] / 2
        placeSubtree(children[i], childCenterY, new Set(visited))
        childY += childHeights[i] + GAP_Y
      }
    }

    // Place each root tree, stacking vertically
    let nextRootY = startY
    for (const rootId of roots) {
      const treeH = subtreeHeight(rootId, new Set())
      const rootSize = frameSizes.get(rootId) ?? { w: 300, h: 200 }
      const centerY = nextRootY + Math.max(treeH, rootSize.h) / 2
      placeSubtree(rootId, centerY, new Set())
      nextRootY += Math.max(treeH, rootSize.h) + GAP_Y * 2
    }

    // Place unconnected frames after the last column
    const lastColX = colX.length > 0 ? colX[colX.length - 1] + colMaxWidth[colMaxWidth.length - 1] + GAP_X : startX
    const unconnected = Array.from(allRootIds).filter((id) => !connectedIds.has(id))
    if (unconnected.length > 0) {
      let curY = startY
      for (const fid of unconnected) {
        const size = frameSizes.get(fid) ?? { w: 300, h: 200 }
        positions.set(fid, { x: lastColX, y: curY })
        curY += size.h + GAP_Y
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
