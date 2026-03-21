import type { CanvasKit, Surface, Image as SkImage } from 'canvaskit-wasm'
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
import { measureText as measureOverlayText } from './skia-overlays'
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
  rnMap = new Map<string, { absX: number; absY: number; absW: number; absH: number }>()

  /** Cross-page navigation pill rects — rebuilt each render, used for dblclick hit test. */
  crossPagePills: { x: number; y: number; w: number; h: number; targetPageId: string }[] = []

  /** Connection hit areas — rebuilt each render, used for hover/click hit test on connection lines. */
  connectionHitAreas: {
    connectionId: string
    /** Sampled points along the connection path (scene-space) for proximity hit test. */
    points: { x: number; y: number }[]
    /** Label pill rect (if exists). */
    labelRect?: { x: number; y: number; w: number; h: number }
  }[] = []

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

  // Frame bitmap snapshot cache (zoom <10%): pre-render each root frame to SkImage
  private frameSnapshotCache = new Map<string, { image: SkImage; renderedZoom: number }>()
  private frameSnapshotOrder: string[] = [] // LRU order
  private static SNAPSHOT_CACHE_MAX = 500
  private snapshotSurface: Surface | null = null
  private snapshotSurfaceSize = 0
  // Map: rootFrameId → child renderNodes (built in syncFromDocument)
  private frameChildMap = new Map<string, import('./skia-renderer').RenderNode[]>()

  // Drag suppression — prevents syncFromDocument during drag
  // so the layout engine doesn't override visual positions
  dragSyncSuppressed = false
  // Change detection for syncFromDocument — skip expensive reprocessing when doc hasn't changed
  private lastSyncPageId: string | null = null
  private lastSyncChildrenRef: PenNode[] | null = null

  /** Invalidate sync cache to force a full rebuild on next syncFromDocument(). */
  invalidateSyncCache() {
    this.lastSyncChildrenRef = null
  }

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
    this.invalidateAllSnapshots()
    if (this.canvasEl) this.canvasEl.style.transform = ''
    this.surface?.delete()
    this.surface = null
  }

  // ---------------------------------------------------------------------------
  // Frame bitmap snapshot (zoom <10%): Google Maps-style pre-rendered images
  // ---------------------------------------------------------------------------

  /** Render a single root frame + its children into an offscreen SkImage and cache it */
  private renderFrameSnapshot(
    ck: CanvasKit,
    frameRN: RenderNode,
    selectedIds: Set<string>,
    targetSize: number,
  ) {
    const children = this.frameChildMap.get(frameRN.node.id) ?? [frameRN]
    const fw = frameRN.absW
    const fh = frameRN.absH
    if (fw <= 0 || fh <= 0) return

    // Compute pixel size (fit within targetSize, maintain aspect ratio)
    const aspect = fw / fh
    let pixW: number, pixH: number
    if (aspect >= 1) {
      pixW = targetSize
      pixH = Math.max(1, Math.round(targetSize / aspect))
    } else {
      pixH = targetSize
      pixW = Math.max(1, Math.round(targetSize * aspect))
    }

    // Ensure offscreen surface is big enough
    if (!this.snapshotSurface || this.snapshotSurfaceSize < Math.max(pixW, pixH)) {
      this.snapshotSurface?.delete()
      const size = Math.max(pixW, pixH, 256)
      this.snapshotSurface = ck.MakeSurface(size, size)
      this.snapshotSurfaceSize = size
    }

    if (!this.snapshotSurface) return

    const offCanvas = this.snapshotSurface.getCanvas()
    offCanvas.clear(ck.Color(0, 0, 0, 0))
    offCanvas.save()

    // Scale scene coords to pixel coords
    const scaleX = pixW / fw
    const scaleY = pixH / fh
    offCanvas.scale(scaleX, scaleY)
    offCanvas.translate(-frameRN.absX, -frameRN.absY)

    // Render frame + children
    for (const rn of children) {
      const pw = rn.absW * scaleX
      const ph = rn.absH * scaleY
      if (pw < 0.5 && ph < 0.5) continue
      try {
        this.renderer.drawNode(offCanvas, rn, selectedIds, pw, ph)
      } catch {
        // Skip WASM errors
      }
    }

    offCanvas.restore()

    // Snapshot to SkImage
    const img = this.snapshotSurface.makeImageSnapshot(
      Int32Array.from([0, 0, pixW, pixH]),
    )
    if (!img) return

    // Evict LRU if over limit
    const frameId = frameRN.node.id
    while (this.frameSnapshotOrder.length >= SkiaEngine.SNAPSHOT_CACHE_MAX) {
      const evictId = this.frameSnapshotOrder.shift()!
      const evicted = this.frameSnapshotCache.get(evictId)
      evicted?.image.delete()
      this.frameSnapshotCache.delete(evictId)
    }

    // Cache
    const old = this.frameSnapshotCache.get(frameId)
    old?.image.delete()
    this.frameSnapshotCache.set(frameId, { image: img, renderedZoom: this.zoom })
    const idx = this.frameSnapshotOrder.indexOf(frameId)
    if (idx >= 0) this.frameSnapshotOrder.splice(idx, 1)
    this.frameSnapshotOrder.push(frameId)
  }

  /** Invalidate all cached frame snapshots */
  private invalidateAllSnapshots() {
    for (const [, snap] of this.frameSnapshotCache) {
      snap.image.delete()
    }
    this.frameSnapshotCache.clear()
    this.frameSnapshotOrder = []
    this.snapshotSurface?.delete()
    this.snapshotSurface = null
    this.snapshotSurfaceSize = 0
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
      this.markDirty()
      return
    }

    this.lastSyncPageId = activePageId
    this.lastSyncChildrenRef = pageChildren


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

    // Build frameChildMap: group child renderNodes by parent root frame
    this.frameChildMap.clear()
    let currentFrameId: string | null = null
    let currentFrameChildren: RenderNode[] = []
    for (const rn of this.renderNodes) {
      if (rn.node.type === 'frame' && !rn.clipRect) {
        // New root frame boundary
        if (currentFrameId) {
          this.frameChildMap.set(currentFrameId, currentFrameChildren)
        }
        currentFrameId = rn.node.id
        currentFrameChildren = [rn] // include the frame itself
      } else if (currentFrameId) {
        currentFrameChildren.push(rn)
      }
    }
    if (currentFrameId) {
      this.frameChildMap.set(currentFrameId, currentFrameChildren)
    }

    // Invalidate snapshot cache (content changed)
    this.invalidateAllSnapshots()


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

  /** Monotonic phase counter for animated dash on highlighted connections. */
  flowDashPhase = 0
  private flowAnimating = false

  private startRenderLoop() {
    const loop = () => {
      this.animFrameId = requestAnimationFrame(loop)
      // Keep animating while flow is highlighted (marching ants)
      if (this.flowAnimating) {
        this.flowDashPhase = -(performance.now() / 15) % 1000 // ~66px/s march, negative = forward direction
        this.dirty = true
      }
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

    // ── Render pipeline: bitmap snapshot (<6%) vs direct (≥6%) ──
    const useBitmapSnapshot = this.zoom < 0.06

    if (useBitmapSnapshot) {
      // Bitmap snapshot mode: blit cached SkImages per root frame
      this.visibleRenderNodes = []
      const targetRenderSize = 256 // Max pixel dimension for snapshot render
      let freshRenderBudget = 3   // Max frames to render fresh per frame

      for (const rn of this.rootFrameNodes) {
        // Viewport cull
        if (rn.absX + rn.absW < vpLeft - vpMargin || rn.absX > vpRight + vpMargin ||
            rn.absY + rn.absH < vpTop - vpMargin || rn.absY > vpBottom + vpMargin) continue
        this.visibleRenderNodes.push(rn)

        const frameId = rn.node.id
        const cached = this.frameSnapshotCache.get(frameId)

        if (cached) {
          // Blit cached image (may be scaled = blurry, but instant)
          canvas.drawImageRectOptions(
            cached.image,
            ck.XYWHRect(0, 0, cached.image.width(), cached.image.height()),
            ck.XYWHRect(rn.absX, rn.absY, rn.absW, rn.absH),
            ck.FilterMode.Linear, ck.MipmapMode.None, null,
          )
          // Touch LRU
          const idx = this.frameSnapshotOrder.indexOf(frameId)
          if (idx >= 0) this.frameSnapshotOrder.splice(idx, 1)
          this.frameSnapshotOrder.push(frameId)
        } else if (freshRenderBudget > 0) {
          // Render frame to offscreen surface and cache
          freshRenderBudget--
          this.renderFrameSnapshot(ck, rn, selectedIds, targetRenderSize)
          // Blit just-created snapshot
          const snap = this.frameSnapshotCache.get(frameId)
          if (snap) {
            canvas.drawImageRectOptions(
              snap.image,
              ck.XYWHRect(0, 0, snap.image.width(), snap.image.height()),
              ck.XYWHRect(rn.absX, rn.absY, rn.absW, rn.absH),
              ck.FilterMode.Linear, ck.MipmapMode.None, null,
            )
          }
        } else {
          // Over budget: draw simple filled rect as placeholder
          const fills = 'fill' in rn.node ? (rn.node as any).fill : undefined
          const paint = new ck.Paint()
          if (fills && Array.isArray(fills) && fills.length > 0 && fills[0].type === 'solid') {
            paint.setColor(parseColor(ck, fills[0].color ?? '#ffffff'))
          } else {
            paint.setColor(ck.Color(255, 255, 255, 255))
          }
          canvas.drawRect(ck.XYWHRect(rn.absX, rn.absY, rn.absW, rn.absH), paint)
          paint.delete()
          // Schedule next frame to render remaining
          this.markDirty()
        }
      }
    } else {
      // Direct render: use spatial index for efficient viewport query
      this.visibleRenderNodes = this.spatialIndex.queryViewport(
        vpLeft - vpMargin, vpTop - vpMargin,
        vpRight + vpMargin, vpBottom + vpMargin,
      )

      // Draw visible render nodes with LOD
      for (const rn of this.visibleRenderNodes) {
        const pixelW = rn.absW * this.zoom
        const pixelH = rn.absH * this.zoom

        // Sub-pixel: skip entirely
        if (pixelW < 1 && pixelH < 1) continue

        try {
          this.renderer.drawNode(canvas, rn, selectedIds, pixelW, pixelH)
        } catch {
          // Skip nodes that cause CanvasKit WASM errors
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
          isReusable, false, this.zoom, rn.absW,
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
    const { showConnections, hoveredConnectionId, highlightedFlow } = useCanvasStore.getState()
    this.flowAnimating = !!(highlightedFlow && highlightedFlow.connectionIds.length > 0)
    this.connectionHitAreas = []
    if (connections.length > 0 && showConnections) {
      const activePageId = useCanvasStore.getState().activePageId
      const activePage = (useDocumentStore.getState().document.pages ?? []).find(
        (p) => p.id === activePageId,
      )
      // Skip on ERD pages
      if (activePage?.type !== 'erd') {
        const pages = useDocumentStore.getState().document.pages ?? []

        // Group cross-page connections by source element to offset labels
        const crossPageBySource = new Map<string, { connectionId: string; targetName: string; targetPageId: string }[]>()

        for (const c of connections) {
          if (c.sourcePageId !== activePageId) continue
          const src = this.rnMap.get(c.sourceElementId)
          if (!src) continue

          const isHovered = hoveredConnectionId === c.id
          const isInFlow = highlightedFlow?.connectionIds.includes(c.id) ?? false
          const isDimmed = highlightedFlow && !isInFlow

          const samePage = c.targetPageId === activePageId
          if (samePage) {
            // Same-page: draw arrow to target frame/element
            const targetId = c.targetFrameId || c.targetPageId
            const tgt = this.rnMap.get(targetId)
            if (tgt) {
              const alpha = isDimmed ? 0.15 : isHovered || isInFlow ? 1.0 : undefined
              const dash = isInFlow ? this.flowDashPhase : undefined
              this.renderer.drawStoryboardArrow(
                canvas,
                src.absX, src.absY, src.absW, src.absH,
                tgt.absX, tgt.absY, tgt.absW, tgt.absH,
                this.zoom, c.label, alpha, dash,
              )
              // Build hit area: sample bezier curve points
              const invZ = Math.max(1 / this.zoom, 0.1)
              const sCx = src.absX + src.absW / 2, sCy = src.absY + src.absH / 2
              const tCx = tgt.absX + tgt.absW / 2, tCy = tgt.absY + tgt.absH / 2
              const x1 = tCx >= sCx ? src.absX + src.absW : src.absX
              const y1 = sCy
              const x2 = tCx >= sCx ? tgt.absX : tgt.absX + tgt.absW
              const y2 = tCy
              const dx = Math.abs(x2 - x1)
              const cp = Math.max(40 * invZ, dx * 0.4)
              const cpx1 = tCx >= sCx ? x1 + cp : x1 - cp
              const cpx2 = tCx >= sCx ? x2 - cp : x2 + cp
              const pts: { x: number; y: number }[] = []
              const SAMPLE_STEP = 0.04 // ~25 points for smooth hit detection
              for (let t = 0; t <= 1 + SAMPLE_STEP * 0.5; t += SAMPLE_STEP) {
                const tc = Math.min(t, 1)
                const u = 1 - tc
                pts.push({
                  x: u * u * u * x1 + 3 * u * u * tc * cpx1 + 3 * u * tc * tc * cpx2 + tc * tc * tc * x2,
                  y: u * u * u * y1 + 3 * u * u * tc * y1 + 3 * u * tc * tc * y2 + tc * tc * tc * y2,
                })
              }
              // Label rect at midpoint
              const midX = (x1 + x2) / 2
              const midY = (y1 + y2) / 2 - 10 * invZ
              const labelRect = c.label ? (() => {
                const fs = 10 * invZ, px = 4 * invZ, py = 2 * invZ
                const tw = measureOverlayText(c.label!, 10, '500') * invZ
                const bw = tw + px * 2, bh = fs + py * 2
                return { x: midX - bw / 2, y: midY - bh / 2, w: bw, h: bh }
              })() : undefined
              this.connectionHitAreas.push({ connectionId: c.id, points: pts, labelRect })
            }
          } else {
            // Cross-page: collect for grouped rendering
            const targetPage = pages.find((p) => p.id === c.targetPageId)
            let targetName = targetPage?.name || ''
            if (c.targetFrameId && targetPage) {
              const frame = (targetPage.children ?? []).find((n) => n.id === c.targetFrameId)
              if (frame?.name) targetName = `${targetPage.name} / ${frame.name}`
            }
            if (!crossPageBySource.has(c.sourceElementId)) {
              crossPageBySource.set(c.sourceElementId, [])
            }
            crossPageBySource.get(c.sourceElementId)!.push({ connectionId: c.id, targetName, targetPageId: c.targetPageId })
          }
        }

        // Draw cross-page arrows and build pill hit-test rects + connection hit areas
        this.crossPagePills = []
        for (const [sourceId, targets] of crossPageBySource) {
          const src = this.rnMap.get(sourceId)
          if (!src) continue
          for (let i = 0; i < targets.length; i++) {
            const t = targets[i]
            const isHoveredCross = hoveredConnectionId === t.connectionId
            const isInFlowCross = highlightedFlow?.connectionIds.includes(t.connectionId) ?? false
            const isDimmedCross = highlightedFlow && !isInFlowCross
            const alphaCross = isDimmedCross ? 0.15 : isHoveredCross || isInFlowCross ? 1.0 : undefined
            const dashCross = isInFlowCross ? this.flowDashPhase : undefined

            this.renderer.drawCrossPageArrow(
              canvas,
              src.absX, src.absY, src.absW, src.absH,
              this.zoom, t.targetName,
              i, targets.length,
              alphaCross, dashCross,
            )
            // Compute pill rect in scene-space (mirrors drawCrossPageArrow math)
            const invZ = Math.max(1 / this.zoom, 0.1)
            const rowH = 20 * invZ
            const groupH = targets.length * rowH
            const sCy = src.absY + src.absH / 2 - groupH / 2 + rowH / 2 + i * rowH
            const x1 = src.absX + src.absW
            const x2 = x1 + 60 * invZ
            const fontSize = 10 * invZ
            const padX = 5 * invZ
            const padY = 3 * invZ
            const gap = 4 * invZ
            const textW = measureOverlayText(t.targetName, 10, '500') * invZ
            const pillW = textW + padX * 2
            const pillH = fontSize + padY * 2
            const pillX = x2 + gap
            const pillY = sCy - pillH / 2
            this.crossPagePills.push({
              x: pillX, y: pillY, w: pillW, h: pillH,
              targetPageId: t.targetPageId,
            })
            // Build hit area for cross-page connection line (straight line from x1 to x2)
            this.connectionHitAreas.push({
              connectionId: t.connectionId,
              points: [{ x: x1, y: sCy }, { x: x2, y: sCy }],
              labelRect: { x: pillX, y: pillY, w: pillW, h: pillH },
            })
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

        // Expand selection to include ancestor root frames so child selection
        // inherits parent connections (e.g. selecting a button inside Login Screen
        // should find Login Screen's connections)
        const expandedSelection = new Set<string>(selectedIds)
        for (const id of selectedIds) {
          let current = docState.getParentOf(id)
          while (current) {
            expandedSelection.add(current.id)
            current = docState.getParentOf(current.id)
          }
        }

        // BFS: trace full chain forward (outputs) and backward (inputs) from selected
        const visitedIds = new Set<string>(expandedSelection)
        const chainConns = new Set<typeof allConnections[0]>()
        const queue = [...expandedSelection]
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

    // Dim root frames not in highlighted flow (connection-click highlighting)
    if (highlightedFlow && highlightedFlow.nodeIds.length > 0 && selectedIds.size === 0) {
      const flowSet = new Set(highlightedFlow.nodeIds)
      // Expand: include ancestor root frames of flow nodes (sourceElementId may be a child)
      const docState = useDocumentStore.getState()
      for (const nodeId of highlightedFlow.nodeIds) {
        let current = docState.getParentOf(nodeId)
        while (current) {
          flowSet.add(current.id)
          current = docState.getParentOf(current.id)
        }
      }
      for (const rn of this.rootFrameNodes) {
        if (!flowSet.has(rn.node.id)) {
          this.renderer.drawDimOverlay(canvas, rn.absX, rn.absY, rn.absW, rn.absH, 0.5)
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

    // Track frame time for CSS-transform gesture mode
    const _elapsed = performance.now() - _t0
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

