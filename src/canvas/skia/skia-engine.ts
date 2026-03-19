import type { CanvasKit, Surface } from 'canvaskit-wasm'
import type { PenNode, ContainerProps, FrameNode as FrameNodeType, RefNode as RefNodeType } from '@/types/pen'
import { useCanvasStore } from '@/stores/canvas-store'
import { useDocumentStore, getActivePageChildren, getAllChildren } from '@/stores/document-store'
import { resolveNodeForCanvas, getDefaultTheme } from '@/variables/resolve-variables'
import { resolveDataBinding } from '@/variables/resolve-data-binding'
import { getCanvasBackground, MIN_ZOOM, MAX_ZOOM } from '../canvas-constants'
import {
  resolvePadding,
  isNodeVisible,
  getNodeWidth,
  getNodeHeight,
  computeLayoutPositions,
  inferLayout,
} from '../canvas-layout-engine'
import { parseSizing, defaultLineHeight } from '../canvas-text-measure'
import { SkiaRenderer, type RenderNode } from './skia-renderer'
import { SpatialIndex } from './skia-hit-test'
import { parseColor, wrapLine, cssFontFamily } from './skia-paint-utils'
import { TileManager } from './tile-manager'
import { FPSMonitor } from './fps-monitor'
import {
  viewportMatrix,
  zoomToPoint as vpZoomToPoint,
} from './skia-viewport'
import {
  getActiveAgentIndicators,
  getActiveAgentFrames,
  isPreviewNode,
} from '../agent-indicator'
import { isNodeBorderReady, getNodeRevealTime } from '@/services/ai/design-animation'
import { SkiaErdRenderer } from './skia-erd-renderer'
import { applyPropertyValue as _applyPropertyValue, applyBindingsToTree as _applyBindingsToTree, applyArgumentValues as _applyArgumentValues } from './argument-apply'

// Re-export for use by canvas component
export { screenToScene } from './skia-viewport'
export { SpatialIndex } from './skia-hit-test'

// ---------------------------------------------------------------------------
// Pre-measure text widths using Canvas 2D (browser fonts)
// ---------------------------------------------------------------------------

let _measureCtx: CanvasRenderingContext2D | null = null
function getMeasureCtx(): CanvasRenderingContext2D {
  if (!_measureCtx) {
    const c = document.createElement('canvas')
    _measureCtx = c.getContext('2d')!
  }
  return _measureCtx
}

/**
 * Walk the node tree and fix text HEIGHTS using actual Canvas 2D wrapping.
 *
 * Only targets fixed-width text with auto height — these are the cases where
 * estimateTextHeight may underestimate because its width estimation differs
 * from Canvas 2D's actual text measurement, leading to incorrect wrap counts.
 *
 * IMPORTANT: This function never touches WIDTH or container-relative sizing
 * strings (fill_container / fit_content). Changing widths breaks layout
 * resolution in computeLayoutPositions.
 */
function premeasureTextHeights(nodes: PenNode[]): PenNode[] {
  return nodes.map((node) => {
    let result = node

    if (node.type === 'text') {
      const tNode = node as import('@/types/pen').TextNode
      const hasFixedWidth = typeof tNode.width === 'number' && tNode.width > 0
      const isContainerHeight = typeof tNode.height === 'string'
        && (tNode.height === 'fill_container' || tNode.height === 'fit_content')
      const textGrowth = tNode.textGrowth
      const content = typeof tNode.content === 'string'
        ? tNode.content
        : Array.isArray(tNode.content)
          ? tNode.content.map((s) => s.text ?? '').join('')
          : ''

      // Match Fabric.js wrapping: only premeasure when text actually wraps.
      // textGrowth='auto' means auto-width (no wrapping) regardless of textAlign.
      // textGrowth=undefined with non-left textAlign uses fixed-width for alignment.
      const textAlign = tNode.textAlign
      const isFixedWidthText = textGrowth === 'fixed-width' || textGrowth === 'fixed-width-height'
        || (textGrowth !== 'auto' && textAlign != null && textAlign !== 'left')
      if (content && hasFixedWidth && isFixedWidthText && !isContainerHeight) {
        const fontSize = tNode.fontSize ?? 16
        const fontWeight = tNode.fontWeight ?? '400'
        const fontFamily = tNode.fontFamily ?? 'Inter, -apple-system, "Noto Sans SC", "PingFang SC", system-ui, sans-serif'
        const ctx = getMeasureCtx()
        ctx.font = `${fontWeight} ${fontSize}px ${cssFontFamily(fontFamily)}`

        // Fixed-width text with auto height: wrap and measure actual height
        const wrapWidth = (tNode.width as number) + fontSize * 0.2
        const rawLines = content.split('\n')
        const wrappedLines: string[] = []
        for (const raw of rawLines) {
          if (!raw) { wrappedLines.push(''); continue }
          wrapLine(ctx, raw, wrapWidth, wrappedLines)
        }
        const lineHeightMul = tNode.lineHeight ?? defaultLineHeight(fontSize)
        const lineHeight = lineHeightMul * fontSize
        const glyphH = fontSize * 1.13
        const measuredHeight = Math.ceil(
          wrappedLines.length <= 1
            ? glyphH + 2
            : (wrappedLines.length - 1) * lineHeight + glyphH + 2,
        )
        const currentHeight = typeof tNode.height === 'number' ? tNode.height : 0
        const explicitLineCount = rawLines.length
        const needsHeight = currentHeight <= 0 || wrappedLines.length > explicitLineCount
        if (needsHeight && measuredHeight > currentHeight) {
          result = { ...node, height: measuredHeight } as unknown as PenNode
        }
      }
    }

    // Recurse into children
    if ('children' in result && result.children) {
      const children = result.children
      const measured = premeasureTextHeights(children)
      if (measured !== children) {
        result = { ...result, children: measured } as unknown as PenNode
      }
    }

    return result
  })
}

// ---------------------------------------------------------------------------
// Flatten document tree → absolute-positioned RenderNode list
// ---------------------------------------------------------------------------

interface ClipInfo {
  x: number; y: number; w: number; h: number; rx: number
}

function sizeToNumber(val: number | string | undefined, fallback: number): number {
  if (typeof val === 'number') return val
  if (typeof val === 'string') {
    const m = val.match(/\((\d+(?:\.\d+)?)\)/)
    if (m) return parseFloat(m[1])
    const n = parseFloat(val)
    if (!isNaN(n)) return n
  }
  return fallback
}

function cornerRadiusVal(cr: unknown): number {
  if (cr == null) return 0
  if (typeof cr === 'number') return cr
  if (typeof cr === 'string') { const n = parseFloat(cr); return isNaN(n) ? 0 : n }
  if (Array.isArray(cr)) return typeof cr[0] === 'number' ? cr[0] : 0
  return 0
}

/** Apply argument values from a RefNode instance to the resolved component children.
 * Must run BEFORE remapIds (uses original child IDs) and BEFORE variable resolution.
 * Creates new node objects (never mutates source). */
const applyArgumentValues = _applyArgumentValues
const applyBindingsToTree = _applyBindingsToTree
const applyPropertyValue = _applyPropertyValue

/** Resolve RefNodes inline (same logic as use-canvas-sync.ts). */
function resolveRefs(
  nodes: PenNode[],
  rootNodes: PenNode[],
  findInTree: (nodes: PenNode[], id: string) => PenNode | null,
  visited = new Set<string>(),
): PenNode[] {
  return nodes.flatMap((node) => {
    if (node.type !== 'ref') {
      if ('children' in node && node.children) {
        return [{ ...node, children: resolveRefs(node.children, rootNodes, findInTree, visited) } as PenNode]
      }
      return [node]
    }
    if (visited.has(node.ref)) return []
    const component = findInTree(rootNodes, node.ref)
    if (!component) return []
    visited.add(node.ref)
    const resolved: Record<string, unknown> = { ...component }
    for (const [key, val] of Object.entries(node)) {
      if (key === 'type' || key === 'ref' || key === 'descendants' || key === 'children') continue
      if (val !== undefined) resolved[key] = val
    }
    resolved.type = component.type
    if (!resolved.name) resolved.name = component.name
    delete resolved.reusable
    const resolvedNode = resolved as unknown as PenNode
    if ('children' in component && component.children) {
      const refNode = node as import('@/types/pen').RefNode
      // Apply argument values BEFORE remapIds (uses original child IDs)
      const argApplied = applyArgumentValues(component.children, node, component)
      const remapped = remapIds(argApplied, node.id, refNode.descendants)
      // Recursively resolve nested refs inside component children
      ;(resolvedNode as PenNode & ContainerProps).children = resolveRefs(remapped, rootNodes, findInTree, visited)
    }
    visited.delete(node.ref)
    return [resolvedNode]
  })
}

function remapIds(children: PenNode[], refId: string, overrides?: Record<string, Partial<PenNode>>): PenNode[] {
  return children.map((child) => {
    const virtualId = `${refId}__${child.id}`
    const ov = overrides?.[child.id] ?? {}
    const mapped = { ...child, ...ov, id: virtualId } as PenNode
    if ('children' in mapped && mapped.children) {
      (mapped as PenNode & ContainerProps).children = remapIds(mapped.children, refId, overrides)
    }
    return mapped
  })
}

export function flattenToRenderNodes(
  nodes: PenNode[],
  offsetX = 0,
  offsetY = 0,
  parentAvailW?: number,
  parentAvailH?: number,
  clipCtx?: ClipInfo,
  depth = 0,
): RenderNode[] {
  const result: RenderNode[] = []

  // Reverse order: children[0] = top layer = rendered last (frontmost)
  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i]
    if (!isNodeVisible(node)) continue
    // Skip unresolved ref nodes (component not found)
    if (node.type === 'ref') continue

    // Resolve fill_container / fit_content
    let resolved: PenNode = node
    if (parentAvailW !== undefined || parentAvailH !== undefined) {
      let changed = false
      const r: Record<string, unknown> = { ...node }
      if ('width' in node && typeof node.width !== 'number') {
        const s = parseSizing(node.width)
        if (s === 'fill' && parentAvailW) { r.width = parentAvailW; changed = true }
        else if (s === 'fit') { r.width = getNodeWidth(node, parentAvailW); changed = true }
      }
      if ('height' in node && typeof node.height !== 'number') {
        const s = parseSizing(node.height)
        if (s === 'fill' && parentAvailH) { r.height = parentAvailH; changed = true }
        else if (s === 'fit') { r.height = getNodeHeight(node, parentAvailH, parentAvailW); changed = true }
      }
      if (changed) resolved = r as unknown as PenNode
    }

    // Compute height for frames without explicit numeric height
    if (
      node.type === 'frame'
      && 'children' in node && node.children?.length
      && (!('height' in resolved) || typeof resolved.height !== 'number')
    ) {
      const computedH = getNodeHeight(resolved, parentAvailH, parentAvailW)
      if (computedH > 0) resolved = { ...resolved, height: computedH } as unknown as PenNode
    }

    const absX = (resolved.x ?? 0) + offsetX
    const absY = (resolved.y ?? 0) + offsetY
    const absW = 'width' in resolved ? sizeToNumber(resolved.width, 100) : 100
    const absH = 'height' in resolved ? sizeToNumber(resolved.height, 100) : 100

    result.push({
      node: { ...resolved, x: absX, y: absY } as PenNode,
      absX, absY, absW, absH,
      clipRect: clipCtx,
    })

    // Recurse into children
    const children = 'children' in node ? node.children : undefined
    if (children && children.length > 0) {
      const nodeW = getNodeWidth(resolved, parentAvailW)
      const nodeH = getNodeHeight(resolved, parentAvailH, parentAvailW)
      const pad = resolvePadding('padding' in resolved ? (resolved as PenNode & ContainerProps).padding : undefined)
      const childAvailW = Math.max(0, nodeW - pad.left - pad.right)
      const childAvailH = Math.max(0, nodeH - pad.top - pad.bottom)

      const layout = ('layout' in node ? (node as ContainerProps).layout : undefined) || inferLayout(node)
      const positioned = layout && layout !== 'none'
        ? computeLayoutPositions(resolved, children)
        : children

      // Clipping — only clip for root frames (artboard behavior).
      // Nested frames do NOT clip children, matching Fabric.js behavior.
      // Fabric.js doesn't implement frame-level clipping, so children always overflow.
      // TODO: add proper clipContent support once Fabric.js is fully replaced.
      let childClip = clipCtx
      const isRootFrame = node.type === 'frame' && depth === 0
      if (isRootFrame) {
        const crRaw = 'cornerRadius' in node ? cornerRadiusVal(node.cornerRadius) : 0
        const cr = Math.min(crRaw, nodeH / 2)
        childClip = { x: absX, y: absY, w: nodeW, h: nodeH, rx: cr }
      }

      const childRNs = flattenToRenderNodes(positioned, absX, absY, childAvailW, childAvailH, childClip, depth + 1)

      // Propagate parent flip to children: mirror positions within parent bounds
      // and toggle child flipX/flipY. Must run BEFORE rotation propagation.
      const parentFlipX = node.flipX === true
      const parentFlipY = node.flipY === true
      if (parentFlipX || parentFlipY) {
        const pcx = absX + nodeW / 2
        const pcy = absY + nodeH / 2
        for (const crn of childRNs) {
          const updates: Record<string, unknown> = {}
          if (parentFlipX) {
            const ccx = crn.absX + crn.absW / 2
            crn.absX = 2 * pcx - ccx - crn.absW / 2
            const childFlip = crn.node.flipX === true
            updates.flipX = !childFlip || undefined
          }
          if (parentFlipY) {
            const ccy = crn.absY + crn.absH / 2
            crn.absY = 2 * pcy - ccy - crn.absH / 2
            const childFlip = crn.node.flipY === true
            updates.flipY = !childFlip || undefined
          }
          crn.node = { ...crn.node, x: crn.absX, y: crn.absY, ...updates } as PenNode
        }
      }

      // Propagate parent rotation to children: rotate their positions around
      // the parent's center and accumulate the rotation angle.
      // Children are in the parent's LOCAL (unrotated) coordinate space, so we
      // need to apply the parent's rotation to get correct absolute positions.
      const parentRot = node.rotation ?? 0
      if (parentRot !== 0) {
        const cx = absX + nodeW / 2
        const cy = absY + nodeH / 2
        const rad = parentRot * Math.PI / 180
        const cosA = Math.cos(rad)
        const sinA = Math.sin(rad)

        for (const crn of childRNs) {
          // Rotate child CENTER around parent center
          const ccx = crn.absX + crn.absW / 2
          const ccy = crn.absY + crn.absH / 2
          const dx = ccx - cx
          const dy = ccy - cy
          const newCx = cx + dx * cosA - dy * sinA
          const newCy = cy + dx * sinA + dy * cosA
          crn.absX = newCx - crn.absW / 2
          crn.absY = newCy - crn.absH / 2
          // Accumulate rotation and update node position
          const childRot = crn.node.rotation ?? 0
          crn.node = { ...crn.node, x: crn.absX, y: crn.absY, rotation: childRot + parentRot } as PenNode
        }
      }

      result.push(...childRNs)
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Component / instance ID collection (from raw tree, before ref resolution)
// ---------------------------------------------------------------------------

function collectReusableIds(nodes: PenNode[], result: Set<string>) {
  for (const node of nodes) {
    if (node.type === 'frame' && node.reusable === true) {
      result.add(node.id)
    }
    if ('children' in node && node.children) {
      collectReusableIds(node.children, result)
    }
  }
}

function collectInstanceIds(nodes: PenNode[], result: Set<string>, depth = 0) {
  for (const node of nodes) {
    if (node.type === 'ref') {
      // Only label top-level instances (depth ≤ 1: page children or their direct children)
      // Deeper nested instances inside components don't need labels
      if (depth <= 1) result.add(node.id)
    }
    if ('children' in node && node.children) {
      collectInstanceIds(node.children, result, depth + 1)
    }
  }
}

// ---------------------------------------------------------------------------
// SkiaEngine — ties rendering, viewport, hit testing together
// ---------------------------------------------------------------------------

export class SkiaEngine {
  ck: CanvasKit
  surface: Surface | null = null
  renderer: SkiaRenderer
  spatialIndex = new SpatialIndex()
  private visibleRenderNodes: RenderNode[] = []
  renderNodes: RenderNode[] = []

  // ERD rendering
  private erdRenderer: SkiaErdRenderer
  isErdPage = false
  selectedErdEntityId: string | null = null
  hoveredErdEntityId: string | null = null
  /** Temporary visual offset applied to dragging ERD entity (not committed to store) */
  erdDragOffset: { entityId: string; dx: number; dy: number } | null = null

  // Component/instance IDs for colored frame labels
  private reusableIds = new Set<string>()
  private instanceIds = new Set<string>()

  // Pre-built auxiliary lists (populated in syncFromDocument, used in render)
  private labelNodes: RenderNode[] = []       // Root frames + reusable nodes with names
  private reusableRenderNodes: RenderNode[] = [] // Render nodes for reusable component badges
  private rootFrameNodes: RenderNode[] = []   // Root frames (no clipRect) for dim overlays
  private rnMap = new Map<string, { absX: number; absY: number; absW: number; absH: number }>()

  // Agent animation: track start time so glow only pulses ~2 times
  private agentAnimStart = 0

  private canvasEl: HTMLCanvasElement | null = null
  private animFrameId = 0
  private dirty = true

  // Viewport
  zoom = 1
  panX = 0
  panY = 0
  /** True while user is actively panning/zooming — defers expensive overlays (connections, BFS highlight). */
  isPanning = false
  private panIdleTimer: ReturnType<typeof setTimeout> | null = null

  // CSS-transform gesture mode — during zoom/pan on large documents, applies CSS transform
  // to the canvas element instead of re-rendering. Avoids main-thread blocking from full renders.
  private bitmapEnabled = false
  private lastRenderedViewport: { zoom: number; panX: number; panY: number } | null = null
  private cssTransformActive = false // True while CSS transform is applied to canvas element

  // Tile-based rendering (Phase 07.3)
  tileManager = new TileManager()
  private fpsMonitor = new FPSMonitor()
  private nodeMap = new Map<string, import('./skia-renderer').RenderNode[]>()
  private lastTileSize = 0
  private _lastNodeCount = 0

  // Drag suppression — prevents syncFromDocument during drag
  // so the layout engine doesn't override visual positions
  dragSyncSuppressed = false
  // Change detection for syncFromDocument — skip expensive reprocessing when doc hasn't changed
  private lastSyncPageId: string | null = null
  private lastSyncChildrenRef: PenNode[] | null = null

  // Interaction state
  hoveredNodeId: string | null = null
  marquee: { x1: number; y1: number; x2: number; y2: number } | null = null
  previewShape: {
    type: 'rectangle' | 'ellipse' | 'frame' | 'line'
    x: number; y: number; w: number; h: number
  } | null = null
  penPreview: import('./skia-overlays').PenPreviewData | null = null

  /** Active alignment guide lines to render during drag. Set by canvas event handler. */
  activeGuides: { x1: number; y1: number; x2: number; y2: number }[] = []

  // Connection BFS cache — invalidated when selection or connections change
  private _bfsSelectionKey = ''
  private _bfsConnectionsKey = ''
  private _cachedConnectedIds: Set<string> = new Set()
  private _cachedChainConns: Set<unknown> = new Set()

  constructor(ck: CanvasKit) {
    this.ck = ck
    this.renderer = new SkiaRenderer(ck)
    this.erdRenderer = new SkiaErdRenderer(ck)
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  init(canvasEl: HTMLCanvasElement) {
    this.canvasEl = canvasEl
    const dpr = window.devicePixelRatio || 1
    canvasEl.width = canvasEl.clientWidth * dpr
    canvasEl.height = canvasEl.clientHeight * dpr

    this.surface = this.ck.MakeWebGLCanvasSurface(canvasEl)
    if (!this.surface) {
      // Fallback to software
      this.surface = this.ck.MakeSWCanvasSurface(canvasEl)
    }
    if (!this.surface) {
      console.error('SkiaEngine: Failed to create surface')
      return
    }

    this.renderer.init()
    this.renderer.setRedrawCallback(() => this.markDirty())
    // Re-render when async font loading completes
    ;(this.renderer as any)._onFontLoaded = () => this.markDirty()
    // Pre-load default fonts for vector text rendering.
    // Noto Sans SC is loaded alongside Inter so CJK glyphs are always available
    // in the fallback chain — system CJK fonts (PingFang SC, Microsoft YaHei, etc.)
    // are skipped from Google Fonts, and without Noto Sans SC the fallback chain
    // would only contain Inter which has no CJK coverage, causing tofu.
    this.renderer.fontManager.ensureFont('Inter').then(() => this.markDirty())
    this.renderer.fontManager.ensureFont('Noto Sans SC').then(() => this.markDirty())
    this.startRenderLoop()
  }

  dispose() {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId)
    this.renderer.dispose()
    this.tileManager.dispose()
    if (this.canvasEl) this.canvasEl.style.transform = ''
    this.surface?.delete()
    this.surface = null
  }

  resize(width: number, height: number) {
    if (!this.canvasEl) return
    const dpr = window.devicePixelRatio || 1
    this.canvasEl.width = width * dpr
    this.canvasEl.height = height * dpr

    // Recreate surface
    this.surface?.delete()
    this.surface = this.ck.MakeWebGLCanvasSurface(this.canvasEl)
    if (!this.surface) {
      this.surface = this.ck.MakeSWCanvasSurface(this.canvasEl)
    }
    // Reset CSS transform — surface has been recreated
    if (this.canvasEl) this.canvasEl.style.transform = ''
    this.cssTransformActive = false
    this.lastRenderedViewport = null
    this.markDirty()
  }

  // ---------------------------------------------------------------------------
  // Document sync
  // ---------------------------------------------------------------------------

  syncFromDocument() {
    if (this.dragSyncSuppressed) return
    // Skip during active pan/zoom — setViewportBatch triggers store updates
    // which fire subscriptions, but no document data actually changed
    if (this.isPanning) return
    const docState = useDocumentStore.getState()
    const activePageId = useCanvasStore.getState().activePageId

    // Detect ERD page — skip normal node flattening
    const activePage = (docState.document.pages ?? []).find((p) => p.id === activePageId)
    this.isErdPage = activePage?.type === 'erd'

    if (this.isErdPage) {
      // ERD pages don't use normal render nodes or spatial index
      this.renderNodes = []
      this.spatialIndex.rebuild([])
      this.markDirty()
      return
    }

    const pageChildren = getActivePageChildren(docState.document, activePageId)

    // Skip expensive re-processing if document children haven't changed
    // (e.g., only canvas store state like selection/hover changed)
    if (pageChildren === this.lastSyncChildrenRef && activePageId === this.lastSyncPageId) {
      this.markDirty()
      return
    }

    // FAST PATH: property-only edit (same page, same node count)
    // Skip full rebuild (resolveRefs, layout, flatten, spatial) — just patch node refs
    if (activePageId === this.lastSyncPageId &&
        this.renderNodes.length > 0 &&
        pageChildren.length === (this.lastSyncChildrenRef?.length ?? -1)) {

      // Build flat ID→node map from new tree (much cheaper than full resolve+flatten)
      const newNodeMap = new Map<string, PenNode>()
      const variables = docState.document.variables ?? {}
      const themes = docState.document.themes
      const defaultTheme = getDefaultTheme(themes)
      const hasVars = Object.keys(variables).length > 0

      const walkAndResolve = (nodes: PenNode[]) => {
        for (const n of nodes) {
          // Resolve variables on leaf level
          const resolved = hasVars ? resolveNodeForCanvas(n, variables, defaultTheme) : n
          newNodeMap.set(n.id, resolved)
          if ('children' in n && n.children) walkAndResolve(n.children)
        }
      }
      walkAndResolve(pageChildren)

      // Patch existing renderNodes in-place
      for (const rn of this.renderNodes) {
        const newNode = newNodeMap.get(rn.node.id)
        if (newNode) rn.node = newNode
      }

      this.lastSyncChildrenRef = pageChildren
      this.tileManager.markAllDirty()
      this.markDirty()
      return
    }

    this.lastSyncPageId = activePageId
    this.lastSyncChildrenRef = pageChildren
    this.tileManager.markAllDirty()  // Re-render tiles on page change
    this.fpsMonitor.reset()

    const allNodes = getAllChildren(docState.document)

    // Build id→node lookup map once (O(n)) instead of DFS per ref (O(n×m))
    const nodeMap = new Map<string, PenNode>()
    const buildMap = (nodes: PenNode[]) => {
      for (const n of nodes) {
        nodeMap.set(n.id, n)
        if ('children' in n && n.children) buildMap(n.children)
      }
    }
    buildMap(allNodes)
    const findInTree = (_nodes: PenNode[], id: string): PenNode | null => nodeMap.get(id) ?? null

    // Collect reusable/instance IDs from raw tree (before ref resolution strips them)
    this.reusableIds.clear()
    this.instanceIds.clear()
    collectReusableIds(pageChildren, this.reusableIds)
    collectInstanceIds(pageChildren, this.instanceIds)

    // Resolve refs, variables, then flatten
    const resolved = resolveRefs(pageChildren, allNodes, findInTree)

    // Resolve data bindings FIRST: inject sample entity row data into child text nodes
    // (per CONTEXT.md: "after argument apply, before variable resolution")
    const dataEntities = docState.document.dataEntities ?? []
    const bindingResolved = dataEntities.length > 0
      ? resolved.map((n) => resolveDataBinding(n, dataEntities))
      : resolved

    // Resolve design variables recursively (AFTER data binding resolution)
    const variables = docState.document.variables ?? {}
    const themes = docState.document.themes
    const defaultTheme = getDefaultTheme(themes)
    const resolveVarsDeep = (node: PenNode): PenNode => {
      const resolved = resolveNodeForCanvas(node, variables, defaultTheme)
      if ('children' in resolved && resolved.children) {
        return { ...resolved, children: resolved.children.map(resolveVarsDeep) } as PenNode
      }
      return resolved
    }
    const variableResolved = Object.keys(variables).length > 0
      ? bindingResolved.map(resolveVarsDeep)
      : bindingResolved

    // Only premeasure text HEIGHTS for fixed-width text (where wrapping
    // estimation may differ from Canvas 2D). Never touch widths or
    // container-relative sizing to maintain layout consistency with Fabric.js.
    const measured = premeasureTextHeights(variableResolved)

    this.renderNodes = flattenToRenderNodes(measured)

    // Pre-build auxiliary lists so render() doesn't need to iterate all nodes multiple times
    this.labelNodes = []
    this.reusableRenderNodes = []
    this.rootFrameNodes = []
    this.rnMap.clear()
    for (const rn of this.renderNodes) {
      const isRoot = rn.node.type === 'frame' && !rn.clipRect
      if (isRoot) this.rootFrameNodes.push(rn)
      if (this.reusableIds.has(rn.node.id)) this.reusableRenderNodes.push(rn)
      if (rn.node.name && (isRoot || this.reusableIds.has(rn.node.id))) {
        this.labelNodes.push(rn)
      }
      this.rnMap.set(rn.node.id, { absX: rn.absX, absY: rn.absY, absW: rn.absW, absH: rn.absH })
    }

    this.spatialIndex.rebuild(this.renderNodes)

    // Re-evaluate bitmap mode after document change (node count may have changed)
    this.tileManager.markAllDirty()
    // Only rebuild nodeMap when node count changes (structural edit)
    // Property-only edits (color, text) don't change tile assignments
    if (this.nodeMap.size === 0 || this.renderNodes.length !== this._lastNodeCount) {
      this.nodeMap = this.tileManager.buildNodeMap(this.renderNodes, this.zoom)
      this._lastNodeCount = this.renderNodes.length
    }

    // Invalidate BFS cache khi document thay đổi
    this._bfsSelectionKey = ''
    this._bfsConnectionsKey = ''

    this.markDirty()
  }

  // Async version of syncFromDocument — defers heavy computation via requestIdleCallback
  private _syncAbortController: AbortController | null = null

  syncFromDocumentAsync() {
    // Abort any in-flight async sync
    this._syncAbortController?.abort()
    this._syncAbortController = new AbortController()
    const signal = this._syncAbortController.signal

    if (this.dragSyncSuppressed) return
    const docState = useDocumentStore.getState()
    const activePageId = useCanvasStore.getState().activePageId

    // Detect ERD page — skip normal node flattening
    const activePage = (docState.document.pages ?? []).find((p) => p.id === activePageId)
    this.isErdPage = activePage?.type === 'erd'

    if (this.isErdPage) {
      this.renderNodes = []
      this.spatialIndex.rebuild([])
      this.markDirty()
      return
    }

    const pageChildren = getActivePageChildren(docState.document, activePageId)

    // Phase 1: Change detection (sync, O(1))
    if (pageChildren === this.lastSyncChildrenRef && activePageId === this.lastSyncPageId) {
      this.markDirty()
      return
    }
    this.lastSyncPageId = activePageId
    this.lastSyncChildrenRef = pageChildren
    this.tileManager.markAllDirty()

    // Phase 2: Heavy computation — broken into async stages with yields
    const yieldMain = () => new Promise<void>(r => setTimeout(r, 0))

    const runHeavyPhaseAsync = async () => {
      if (signal.aborted) return

      // Stage 1: Build map + resolve refs
      const allNodes = getAllChildren(docState.document)
      const nodeMap = new Map<string, PenNode>()
      const buildMap = (nodes: PenNode[]) => {
        for (const n of nodes) {
          nodeMap.set(n.id, n)
          if ('children' in n && n.children) buildMap(n.children)
        }
      }
      buildMap(allNodes)
      const findInTree = (_nodes: PenNode[], id: string): PenNode | null => nodeMap.get(id) ?? null

      this.reusableIds.clear()
      this.instanceIds.clear()
      collectReusableIds(pageChildren, this.reusableIds)
      collectInstanceIds(pageChildren, this.instanceIds)

      const resolved = resolveRefs(pageChildren, allNodes, findInTree)

      await yieldMain()
      if (signal.aborted) return

      // Stage 2: Resolve data bindings + variables
      const dataEntities = docState.document.dataEntities ?? []
      const bindingResolved = dataEntities.length > 0
        ? resolved.map((n) => resolveDataBinding(n, dataEntities))
        : resolved

      const variables = docState.document.variables ?? {}
      const themes = docState.document.themes
      const defaultTheme = getDefaultTheme(themes)
      const resolveVarsDeep = (node: PenNode): PenNode => {
        const resolved = resolveNodeForCanvas(node, variables, defaultTheme)
        if ('children' in resolved && resolved.children) {
          return { ...resolved, children: resolved.children.map(resolveVarsDeep) } as PenNode
        }
        return resolved
      }
      const variableResolved = Object.keys(variables).length > 0
        ? bindingResolved.map(resolveVarsDeep)
        : bindingResolved

      await yieldMain()
      if (signal.aborted) return

      // Stage 3: Premeasure text + flatten to render nodes
      const measured = premeasureTextHeights(variableResolved)
      this.renderNodes = flattenToRenderNodes(measured)

      await yieldMain()
      if (signal.aborted) return

      // Stage 4: Build auxiliary lists
      this.labelNodes = []
      this.reusableRenderNodes = []
      this.rootFrameNodes = []
      this.rnMap.clear()
      for (const rn of this.renderNodes) {
        const isRoot = rn.node.type === 'frame' && !rn.clipRect
        if (isRoot) this.rootFrameNodes.push(rn)
        if (this.reusableIds.has(rn.node.id)) this.reusableRenderNodes.push(rn)
        if (rn.node.name && (isRoot || this.reusableIds.has(rn.node.id))) {
          this.labelNodes.push(rn)
        }
        this.rnMap.set(rn.node.id, { absX: rn.absX, absY: rn.absY, absW: rn.absW, absH: rn.absH })
      }

      // Stage 5: Rebuild spatial index (async with yields)
      await this.spatialIndex.rebuildAsync(this.renderNodes, signal)
      if (signal.aborted) return

      this.tileManager.markAllDirty()
      if (this.nodeMap.size === 0 || this.renderNodes.length !== this._lastNodeCount) {
        this.nodeMap = this.tileManager.buildNodeMap(this.renderNodes, this.zoom)
        this._lastNodeCount = this.renderNodes.length
      }
      this._bfsSelectionKey = ''
      this._bfsConnectionsKey = ''
      this.markDirty()
    }

    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => runHeavyPhaseAsync(), { timeout: 500 })
    } else {
      // Fallback for environments without requestIdleCallback
      setTimeout(() => runHeavyPhaseAsync(), 0)
    }
  }

  // ---------------------------------------------------------------------------
  // Render loop
  // ---------------------------------------------------------------------------

  markDirty() {
    this.dirty = true
  }

  private startRenderLoop() {
    const loop = () => {
      this.animFrameId = requestAnimationFrame(loop)
      if (!this.dirty || !this.surface) return
      this.dirty = false
      this.render()
    }
    this.animFrameId = requestAnimationFrame(loop)
  }

  /** Callback fired once after the next render() completes (used for post-load modal dismissal). */
  private _onNextRender: (() => void) | null = null
  onNextRender(cb: () => void) { this._onNextRender = cb; this.markDirty() }

  private render() {
    if (!this.surface || !this.canvasEl) return
    const _t0 = performance.now()

    // Reset CSS transform before full render (set during gesture mode)
    if (this.cssTransformActive) {
      this.canvasEl.style.transform = ''
      this.cssTransformActive = false
    }

    const canvas = this.surface.getCanvas()
    const ck = this.ck

    // ERD page: delegate entirely to ERD renderer
    if (this.isErdPage) {
      this.erdRenderer.renderErd(
        canvas,
        useDocumentStore.getState().document.dataEntities ?? [],
        this.zoom, this.panX, this.panY,
        this.selectedErdEntityId,
        this.hoveredErdEntityId,
        this.erdDragOffset,
      )
      this.surface.flush()
      return
    }

    const dpr = window.devicePixelRatio || 1
    const selectedIds = new Set(useCanvasStore.getState().selection.selectedIds)

    // Clear
    const bgColor = getCanvasBackground()
    canvas.clear(parseColor(ck, bgColor))

    // Apply viewport transform
    canvas.save()
    canvas.scale(dpr, dpr)
    canvas.concat(viewportMatrix({ zoom: this.zoom, panX: this.panX, panY: this.panY }))

    // Pass current zoom to renderer for zoom-aware text rasterization
    this.renderer.zoom = this.zoom

    // Compute visible viewport in scene coordinates for culling
    const canvasW = this.canvasEl.width / dpr
    const canvasH = this.canvasEl.height / dpr
    const vpLeft = -this.panX / this.zoom
    const vpTop = -this.panY / this.zoom
    const vpRight = vpLeft + canvasW / this.zoom
    const vpBottom = vpTop + canvasH / this.zoom
    // Add margin to avoid popping at edges (accounts for strokes, shadows, labels)
    const vpMargin = 100 / this.zoom


    // ── Tile-based render pipeline (Phase 07.3) ──
    const tier = this.fpsMonitor.tier

    if (tier === 'tile') {
      // T2 — Extreme LOD: simple filled rects per root frame
      this.visibleRenderNodes = []
      const fillPaint = new ck.Paint()
      fillPaint.setStyle(ck.PaintStyle.Fill)
      const strokePaint = new ck.Paint()
      strokePaint.setStyle(ck.PaintStyle.Stroke)
      strokePaint.setStrokeWidth(1 / this.zoom)
      strokePaint.setColor(ck.Color(200, 200, 200, 255))

      for (const rn of this.rootFrameNodes) {
        if (rn.absX + rn.absW < vpLeft - vpMargin || rn.absX > vpRight + vpMargin ||
            rn.absY + rn.absH < vpTop - vpMargin || rn.absY > vpBottom + vpMargin) continue
        this.visibleRenderNodes.push(rn)

        const fills = 'fill' in rn.node ? (rn.node as any).fill : undefined
        if (fills && Array.isArray(fills) && fills.length > 0 && fills[0].type === 'solid') {
          fillPaint.setColor(parseColor(ck, fills[0].color ?? '#ffffff'))
        } else {
          fillPaint.setColor(ck.Color(255, 255, 255, 255))
        }
        const rect = ck.XYWHRect(rn.absX, rn.absY, rn.absW, rn.absH)
        canvas.drawRect(rect, fillPaint)
        canvas.drawRect(rect, strokePaint)
      }

      fillPaint.delete()
      strokePaint.delete()
    } else {
      // T0/T1 — Tile-based rendering with progressive dirty updates
      const tileSize = this.tileManager.getTileSize(this.zoom)
      const simplified = tier === 'quick'

      // Check zoom level change → mark all dirty
      if (this.tileManager.checkZoomLevelChange(this.zoom)) {
        this.tileManager.markAllDirty()
        this.nodeMap = this.tileManager.buildNodeMap(this.renderNodes, this.zoom)
        this.lastTileSize = tileSize
      }

      // Rebuild node map if tile size changed (shouldn't happen without zoom level change, but safety)
      if (tileSize !== this.lastTileSize) {
        this.nodeMap = this.tileManager.buildNodeMap(this.renderNodes, this.zoom)
        this.lastTileSize = tileSize
      }

      const visibleKeys = this.tileManager.getVisibleTileKeys(
        vpLeft - vpMargin, vpTop - vpMargin,
        vpRight + vpMargin, vpBottom + vpMargin, this.zoom,
      )

      // Pixel size for tile surface
      const dpr = window.devicePixelRatio || 1
      const tilePixelSize = Math.ceil(tileSize * this.zoom * dpr)
      const safeTilePixelSize = Math.max(64, Math.min(tilePixelSize, 2048))

      // Collect dirty and clean tiles
      const dirtyKeys: string[] = []
      this.visibleRenderNodes = []

      for (const key of visibleKeys) {
        const tile = this.tileManager.getOrCreate(key)
        this.tileManager.touch(key)

        if (!tile.dirty && tile.image) {
          // Blit cached tile image
          canvas.drawImageRectOptions(
            tile.image,
            ck.XYWHRect(0, 0, tile.image.width(), tile.image.height()),
            ck.XYWHRect(tile.sceneX, tile.sceneY, tile.sceneSize, tile.sceneSize),
            ck.FilterMode.Linear, ck.MipmapMode.None, null,
          )
        } else {
          dirtyKeys.push(key)
        }
      }

      // Adaptive dirty tile budget: render all when few (<= 15), throttle when many
      const budget = dirtyKeys.length <= 15 ? dirtyKeys.length : Math.min(5, dirtyKeys.length)

      if (budget > 0) {
        this.tileManager.ensureTileSurface(ck, safeTilePixelSize)
        const tileSurface = this.tileManager.tileSurface

        if (tileSurface) {
          for (let i = 0; i < budget; i++) {
            const key = dirtyKeys[i]
            const tile = this.tileManager.getOrCreate(key)
            const nodes = this.nodeMap.get(key) ?? []

            // Render into offscreen tile surface
            const tileCanvas = tileSurface.getCanvas()
            tileCanvas.clear(ck.Color(0, 0, 0, 0)) // transparent
            tileCanvas.save()
            // Scale to tile pixel size and translate to tile origin
            const scale = safeTilePixelSize / tile.sceneSize
            tileCanvas.scale(scale, scale)
            tileCanvas.translate(-tile.sceneX, -tile.sceneY)

            // Render nodes into tile
            for (const rn of nodes) {
              const nodeRect = ck.XYWHRect(rn.absX, rn.absY, rn.absW, rn.absH)
              if (tileCanvas.quickReject(nodeRect)) continue

              const pixelW = rn.absW * this.zoom
              const pixelH = rn.absH * this.zoom
              if (pixelW < 1 && pixelH < 1) continue

              try {
                this.renderer.drawNode(tileCanvas, rn, selectedIds, pixelW, pixelH, simplified)
              } catch {
                // Skip WASM errors
              }
            }

            tileCanvas.restore()

            // Snapshot and cache
            const img = tileSurface.makeImageSnapshot()
            tile.image?.delete()
            tile.image = img
            tile.dirty = false

            // Blit freshly rendered tile
            canvas.drawImageRectOptions(
              img,
              ck.XYWHRect(0, 0, img.width(), img.height()),
              ck.XYWHRect(tile.sceneX, tile.sceneY, tile.sceneSize, tile.sceneSize),
              ck.FilterMode.Linear, ck.MipmapMode.None, null,
            )
          }
        }
      }

      // Schedule next frame if dirty tiles remain
      if (dirtyKeys.length > budget) {
        this.markDirty()
      }

      // Build visibleRenderNodes for overlays (from all visible tile nodes)
      for (const key of visibleKeys) {
        const nodes = this.nodeMap.get(key)
        if (nodes) {
          for (const rn of nodes) this.visibleRenderNodes.push(rn)
        }
      }
    }

    // Draw frame labels (pre-built list: root frames + reusable components only)
    for (const rn of this.labelNodes) {
      // Viewport cull labels too
      if (rn.absX + rn.absW < vpLeft - vpMargin || rn.absX > vpRight + vpMargin ||
          rn.absY < vpTop - vpMargin - 30 || rn.absY > vpBottom + vpMargin) continue
      const isReusable = this.reusableIds.has(rn.node.id)
      try {
        this.renderer.drawFrameLabelColored(
          canvas, rn.node.name!, rn.absX, rn.absY,
          isReusable, false, this.zoom,
        )
      } catch {
        // Skip labels that cause CanvasKit WASM errors
      }
    }

    // Draw agent indicators (glow, badges, node borders, preview fills)
    const agentIndicators = getActiveAgentIndicators()
    const agentFrames = getActiveAgentFrames()
    const hasAgentOverlays = agentIndicators.size > 0 || agentFrames.size > 0

    if (!hasAgentOverlays) {
      this.agentAnimStart = 0
    }

    if (hasAgentOverlays) {
      const now = Date.now()
      if (this.agentAnimStart === 0) this.agentAnimStart = now
      const elapsed = now - this.agentAnimStart
      // Frame glow: smooth fade-in → fade-out (single bell, ~1.2s)
      const GLOW_DURATION = 1200
      const glowT = Math.min(1, elapsed / GLOW_DURATION)
      const breath = Math.sin(glowT * Math.PI) // 0 → 1 → 0

      // Agent node borders and preview fills (per-element fade-in → fade-out)
      const NODE_FADE_DURATION = 1000
      for (const rn of this.visibleRenderNodes) {
        const indicator = agentIndicators.get(rn.node.id)
        if (!indicator) continue
        if (!isNodeBorderReady(rn.node.id)) continue

        const revealAt = getNodeRevealTime(rn.node.id)
        if (revealAt === undefined) continue
        const nodeElapsed = now - revealAt
        if (nodeElapsed > NODE_FADE_DURATION) continue

        // Smooth bell curve: fade in then fade out
        const nodeT = Math.min(1, nodeElapsed / NODE_FADE_DURATION)
        const nodeBreath = Math.sin(nodeT * Math.PI)

        if (isPreviewNode(rn.node.id)) {
          this.renderer.drawAgentPreviewFill(
            canvas, rn.absX, rn.absY, rn.absW, rn.absH,
            indicator.color, now,
          )
        }

        this.renderer.drawAgentNodeBorder(
          canvas, rn.absX, rn.absY, rn.absW, rn.absH,
          indicator.color, nodeBreath, this.zoom,
        )
      }

      // Agent frame glow and badges
      for (const rn of this.visibleRenderNodes) {
        const frame = agentFrames.get(rn.node.id)
        if (!frame) continue

        this.renderer.drawAgentGlow(
          canvas, rn.absX, rn.absY, rn.absW, rn.absH,
          frame.color, breath, this.zoom,
        )
        this.renderer.drawAgentBadge(
          canvas, frame.name,
          rn.absX, rn.absY, rn.absW,
          frame.color, this.zoom, now,
        )
      }
    }

    // Storyboard-style connection arrows between elements
    // Skip during active pan/zoom for performance — arrows re-appear once pan settles
    const connections = this.isPanning ? [] : (useDocumentStore.getState().document.connections ?? [])
    const { showConnections } = useCanvasStore.getState()
    if (connections.length > 0 && showConnections) {
      const activePageId = useCanvasStore.getState().activePageId
      const activePage = (useDocumentStore.getState().document.pages ?? []).find(
        (p) => p.id === activePageId,
      )
      // Skip on ERD pages
      if (activePage?.type !== 'erd') {
        const pages = useDocumentStore.getState().document.pages ?? []

        for (const c of connections) {
          if (c.sourcePageId !== activePageId) continue
          const src = this.rnMap.get(c.sourceElementId)
          if (!src) continue

          const samePage = c.targetPageId === activePageId
          if (samePage) {
            // Same-page: draw arrow to target frame/element
            const targetId = c.targetFrameId || c.targetPageId
            const tgt = this.rnMap.get(targetId)
            if (tgt) {
              this.renderer.drawStoryboardArrow(
                canvas,
                src.absX, src.absY, src.absW, src.absH,
                tgt.absX, tgt.absY, tgt.absW, tgt.absH,
                this.zoom, c.label,
              )
            }
          } else {
            // Cross-page: dashed arrow going off-screen with page name pill
            const targetPage = pages.find((p) => p.id === c.targetPageId)
            let targetName = targetPage?.name || ''
            if (c.targetFrameId && targetPage) {
              const frame = (targetPage.children ?? []).find((n) => n.id === c.targetFrameId)
              if (frame?.name) targetName = `${targetPage.name} / ${frame.name}`
            }
            this.renderer.drawCrossPageArrow(
              canvas,
              src.absX, src.absY, src.absW, src.absH,
              this.zoom, targetName,
            )
          }
        }
      }
    }

    // Draw component badges for reusable frames (pre-built list, with viewport culling)
    for (const rn of this.reusableRenderNodes) {
      if (rn.absX + rn.absW < vpLeft - vpMargin || rn.absX > vpRight + vpMargin ||
          rn.absY + rn.absH < vpTop - vpMargin || rn.absY > vpBottom + vpMargin) continue
      this.renderer.drawComponentBadge(
        canvas, rn.absX, rn.absY, rn.absW, rn.absH,
        this.zoom,
      )
    }

    // Highlight mode: trace full connection chain from selected element,
    // show bright arrows for connected flow, dim everything else
    // Skip during active pan/zoom — BFS + map building is expensive per frame
    if (showConnections && selectedIds.size > 0 && !this.isPanning) {
      const docState = useDocumentStore.getState()
      const allConnections = docState.document.connections ?? []
      const activePageId = useCanvasStore.getState().activePageId
      const pages = docState.document.pages ?? []

      // Tạo cache key
      const selKey = [...selectedIds].sort().join(',')
      const connKey = String(allConnections.length)

      // Chỉ rebuild khi selection hoặc connections thay đổi
      if (selKey !== this._bfsSelectionKey || connKey !== this._bfsConnectionsKey) {
        this._bfsSelectionKey = selKey
        this._bfsConnectionsKey = connKey

        // Build lookup: which element/frame has connections from/to
        const outMap = new Map<string, typeof allConnections>() // sourceElementId -> connections
        const inMap = new Map<string, typeof allConnections>()  // targetFrameId -> connections
        for (const c of allConnections) {
          const outs = outMap.get(c.sourceElementId) ?? []
          outs.push(c)
          outMap.set(c.sourceElementId, outs)
          if (c.targetFrameId) {
            const ins = inMap.get(c.targetFrameId) ?? []
            ins.push(c)
            inMap.set(c.targetFrameId, ins)
          }
        }

        // BFS: trace full chain forward (outputs) and backward (inputs) from selected
        const visitedIds = new Set<string>(selectedIds)
        const chainConns = new Set<typeof allConnections[0]>()
        const queue = [...selectedIds]
        while (queue.length > 0) {
          const id = queue.shift()!
          // Forward: connections FROM this element
          for (const c of outMap.get(id) ?? []) {
            chainConns.add(c)
            if (c.targetFrameId && !visitedIds.has(c.targetFrameId)) {
              visitedIds.add(c.targetFrameId)
              queue.push(c.targetFrameId)
            }
          }
          // Backward: connections TO this element/frame
          for (const c of inMap.get(id) ?? []) {
            chainConns.add(c)
            if (!visitedIds.has(c.sourceElementId)) {
              visitedIds.add(c.sourceElementId)
              queue.push(c.sourceElementId)
            }
          }
        }

        // Also add parent frames of connected elements to avoid dimming them
        const connectedIds = new Set(visitedIds)
        for (const id of visitedIds) {
          const parent = docState.getParentOf(id)
          if (parent) connectedIds.add(parent.id)
        }

        this._cachedConnectedIds = connectedIds
        this._cachedChainConns = chainConns as Set<unknown>
      }

      // Use cached results
      const connectedIds = this._cachedConnectedIds
      const chainConns = this._cachedChainConns as Set<typeof allConnections[0]>

      // Dim unrelated root-level render nodes (pre-built list: only root frames)
      for (const rn of this.rootFrameNodes) {
        if (!connectedIds.has(rn.node.id)) {
          this.renderer.drawDimOverlay(canvas, rn.absX, rn.absY, rn.absW, rn.absH, 0.5)
        }
      }

      // Draw arrows for all connections in the chain (using pre-built rnMap)
      for (const c of chainConns) {
        const src = this.rnMap.get(c.sourceElementId)
        if (!src) continue

        const samePage = c.sourcePageId === activePageId && (c.targetPageId === activePageId || c.sourcePageId === c.targetPageId)
        if (samePage) {
          const targetId = c.targetFrameId || c.targetPageId
          const tgt = this.rnMap.get(targetId)
          if (tgt) {
            this.renderer.drawStoryboardArrow(
              canvas,
              src.absX, src.absY, src.absW, src.absH,
              tgt.absX, tgt.absY, tgt.absW, tgt.absH,
              this.zoom, c.label,
            )
          }
        } else {
          const targetPage = pages.find(p => p.id === c.targetPageId)
          let targetName = targetPage?.name || ''
          if (c.targetFrameId && targetPage) {
            const frame = (targetPage.children ?? []).find(n => n.id === c.targetFrameId)
            if (frame?.name) targetName = `${targetPage.name} / ${frame.name}`
          }
          this.renderer.drawCrossPageArrow(
            canvas,
            src.absX, src.absY, src.absW, src.absH,
            this.zoom, targetName,
          )
        }
      }
    }

    // Hover outline
    if (this.hoveredNodeId && !selectedIds.has(this.hoveredNodeId)) {
      const hovered = this.spatialIndex.get(this.hoveredNodeId)
      if (hovered) {
        this.renderer.drawHoverOutline(canvas, hovered.absX, hovered.absY, hovered.absW, hovered.absH)
      }
    }

    // Drawing preview shape
    if (this.previewShape) {
      this.renderer.drawPreview(canvas, this.previewShape)
    }

    // Pen tool preview
    if (this.penPreview) {
      this.renderer.drawPenPreview(canvas, this.penPreview, this.zoom)
    }

    // Alignment guides
    for (const g of this.activeGuides) {
      this.renderer.drawGuide(canvas, g.x1, g.y1, g.x2, g.y2, this.zoom)
    }

    // Selection marquee
    if (this.marquee) {
      this.renderer.drawSelectionMarquee(
        canvas,
        this.marquee.x1, this.marquee.y1,
        this.marquee.x2, this.marquee.y2,
      )
    }

    canvas.restore()
    this.surface.flush()

    // FPS-based adaptive LOD: record frame time for tier auto-adjustment
    const _elapsed = performance.now() - _t0
    this.fpsMonitor.recordFrame(_elapsed)
    this.bitmapEnabled = _elapsed > 16

    // Save viewport for CSS transform reference (used during next gesture)
    if (this.bitmapEnabled) {
      this.lastRenderedViewport = { zoom: this.zoom, panX: this.panX, panY: this.panY }
    }

    // Fire one-shot post-render callback (e.g. dismiss loading modal after first paint)
    if (this._onNextRender) {
      const cb = this._onNextRender
      this._onNextRender = null
      cb()
    }

    // Keep animating while agent overlays are active (spinning dot + node flashes)
    if (hasAgentOverlays) {
      this.markDirty()
    }
  }

  // ---------------------------------------------------------------------------
  // Viewport control
  // ---------------------------------------------------------------------------

  setViewport(zoom: number, panX: number, panY: number) {
    this.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom))
    this.panX = panX
    this.panY = panY
    // Single batched Zustand update instead of separate setZoom+setPan
    // to avoid 2 subscriber notifications per pan/zoom frame
    useCanvasStore.getState().setViewportBatch(this.zoom, this.panX, this.panY)
    // Mark as actively panning — defers expensive overlay rendering (connections, BFS highlight)
    this.isPanning = true
    if (this.panIdleTimer) clearTimeout(this.panIdleTimer)
    this.panIdleTimer = setTimeout(() => {
      this.isPanning = false
      this.markDirty() // Re-render with full fidelity (CSS transform reset happens in render())
    }, 150)

    // CSS-transform gesture mode: for large documents (bitmapEnabled), apply a CSS transform
    // to the canvas element instead of re-rendering with CanvasKit. The browser compositor
    // handles the transform efficiently without blocking the main thread.
    if (this.bitmapEnabled && this.lastRenderedViewport && this.canvasEl) {
      const lv = this.lastRenderedViewport
      const scale = this.zoom / lv.zoom
      const dx = this.panX - lv.panX * scale
      const dy = this.panY - lv.panY * scale
      this.canvasEl.style.transformOrigin = '0 0'
      this.canvasEl.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`
      this.cssTransformActive = true
      // Don't markDirty — skip CanvasKit re-render during gesture
    } else {
      this.markDirty()
    }
  }

  zoomToPoint(screenX: number, screenY: number, newZoom: number) {
    if (!this.canvasEl) return
    const rect = this.canvasEl.getBoundingClientRect()
    const vp = vpZoomToPoint(
      { zoom: this.zoom, panX: this.panX, panY: this.panY },
      screenX, screenY, rect, newZoom,
    )
    this.setViewport(vp.zoom, vp.panX, vp.panY)
  }

  pan(dx: number, dy: number) {
    this.setViewport(this.zoom, this.panX + dx, this.panY + dy)
  }

  getCanvasRect(): DOMRect | null {
    return this.canvasEl?.getBoundingClientRect() ?? null
  }

  getCanvasSize(): { width: number; height: number } {
    return {
      width: this.canvasEl?.clientWidth ?? 800,
      height: this.canvasEl?.clientHeight ?? 600,
    }
  }

  zoomToFitContent() {
    if (!this.canvasEl || this.renderNodes.length === 0) return
    const FIT_PADDING = 64
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const rn of this.renderNodes) {
      if (rn.clipRect) continue // skip children, only root bounds
      minX = Math.min(minX, rn.absX)
      minY = Math.min(minY, rn.absY)
      maxX = Math.max(maxX, rn.absX + rn.absW)
      maxY = Math.max(maxY, rn.absY + rn.absH)
    }
    if (!isFinite(minX)) return
    const contentW = maxX - minX
    const contentH = maxY - minY
    const cw = this.canvasEl.clientWidth
    const ch = this.canvasEl.clientHeight
    const scaleX = (cw - FIT_PADDING * 2) / contentW
    const scaleY = (ch - FIT_PADDING * 2) / contentH
    let zoom = Math.min(scaleX, scaleY, 1)
    zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom))
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2
    this.setViewport(
      zoom,
      cw / 2 - centerX * zoom,
      ch / 2 - centerY * zoom,
    )
  }

  /** Pan (and optionally zoom) so a specific node is centered in the viewport. */
  panToNode(nodeId: string) {
    if (!this.canvasEl) return
    const rn = this.renderNodes.find((r) => r.node.id === nodeId)
    if (!rn) return

    const cx = rn.absX + rn.absW / 2
    const cy = rn.absY + rn.absH / 2
    const cw = this.canvasEl.clientWidth
    const ch = this.canvasEl.clientHeight

    // If the node is too large or too small at current zoom, adjust zoom to fit
    const PAD = 80
    const fitZoomX = (cw - PAD * 2) / rn.absW
    const fitZoomY = (ch - PAD * 2) / rn.absH
    const fitZoom = Math.min(fitZoomX, fitZoomY, 1)
    // Only adjust zoom if node doesn't fit at current zoom or is very tiny
    const zoom = (rn.absW * this.zoom > cw - PAD || rn.absH * this.zoom > ch - PAD)
      ? Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, fitZoom))
      : this.zoom

    this.setViewport(
      zoom,
      cw / 2 - cx * zoom,
      ch / 2 - cy * zoom,
    )
  }
}

