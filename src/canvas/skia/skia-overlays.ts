import type { CanvasKit, Canvas, Image as SkImage } from 'canvaskit-wasm'
import {
  SELECTION_BLUE,
  COMPONENT_COLOR,
  INSTANCE_COLOR,
  FRAME_LABEL_COLOR,
  PEN_ANCHOR_FILL,
  PEN_ANCHOR_RADIUS,
  PEN_ANCHOR_FIRST_RADIUS,
  PEN_HANDLE_DOT_RADIUS,
  PEN_HANDLE_LINE_STROKE,
  PEN_RUBBER_BAND_STROKE,
  PEN_RUBBER_BAND_DASH,
  CONNECTION_BADGE_COLOR,
} from '../canvas-constants'
import { parseColor } from './skia-paint-utils'

// ---------------------------------------------------------------------------
// Canvas 2D text rasterization (CanvasKit null typeface can't render text)
// ---------------------------------------------------------------------------

const OVERLAY_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
const textImageCache = new Map<string, { img: SkImage; w: number; h: number }>()
const textCacheOrder: string[] = []
const TEXT_CACHE_MAX = 200

// Shared canvases for overlay text — avoids document.createElement per call
let _overlayMeasureCtx: CanvasRenderingContext2D | null = null
function getOverlayMeasureCtx(): CanvasRenderingContext2D {
  if (!_overlayMeasureCtx) {
    _overlayMeasureCtx = document.createElement('canvas').getContext('2d')!
  }
  return _overlayMeasureCtx
}

let _overlayRasterCanvas: HTMLCanvasElement | null = null
let _overlayRasterCtx: CanvasRenderingContext2D | null = null
function getOverlayRasterCtx(w: number, h: number): CanvasRenderingContext2D {
  if (!_overlayRasterCtx) {
    _overlayRasterCanvas = document.createElement('canvas')
    _overlayRasterCtx = _overlayRasterCanvas.getContext('2d', { willReadFrequently: true })!
  }
  if (_overlayRasterCanvas!.width < w || _overlayRasterCanvas!.height < h) {
    _overlayRasterCanvas!.width = Math.max(_overlayRasterCanvas!.width, w)
    _overlayRasterCanvas!.height = Math.max(_overlayRasterCanvas!.height, h)
  }
  return _overlayRasterCtx
}

function evictTextCache() {
  while (textCacheOrder.length > TEXT_CACHE_MAX) {
    const key = textCacheOrder.shift()!
    const entry = textImageCache.get(key)
    entry?.img.delete()
    textImageCache.delete(key)
  }
}

/** Measure text width using Canvas 2D (reuses shared canvas). */
export function measureText(text: string, fontSize: number, fontWeight = '500'): number {
  const ctx = getOverlayMeasureCtx()
  ctx.font = `${fontWeight} ${Math.ceil(fontSize)}px ${OVERLAY_FONT}`
  return ctx.measureText(text).width
}

/** Draw text via Canvas 2D rasterization → CanvasKit image. Returns rendered width. */
function drawText2D(
  ck: CanvasKit, canvas: Canvas,
  text: string, x: number, y: number,
  color: string, fontSize: number, fontWeight = '500',
  alpha = 1,
): number {
  const renderSize = Math.ceil(fontSize)
  const cacheKey = `${text}|${color}|${renderSize}|${fontWeight}`

  let entry = textImageCache.get(cacheKey)
  if (!entry) {
    const scale = 2
    const mCtx = getOverlayMeasureCtx()
    mCtx.font = `${fontWeight} ${renderSize}px ${OVERLAY_FONT}`
    const metrics = mCtx.measureText(text)
    const tw = Math.ceil(metrics.width) + 4
    const th = renderSize + 6

    const cw = tw * scale
    const ch = th * scale
    const ctx = getOverlayRasterCtx(cw, ch)
    ctx.clearRect(0, 0, cw, ch)
    ctx.save()
    ctx.scale(scale, scale)
    ctx.font = `${fontWeight} ${renderSize}px ${OVERLAY_FONT}`
    ctx.fillStyle = color
    ctx.textBaseline = 'top'
    ctx.fillText(text, 1, 2)
    ctx.restore()

    const imageData = ctx.getImageData(0, 0, cw, ch)
    const premul = new Uint8Array(imageData.data.length)
    for (let p = 0; p < premul.length; p += 4) {
      const a = imageData.data[p + 3]
      if (a === 255) {
        premul[p] = imageData.data[p]
        premul[p + 1] = imageData.data[p + 1]
        premul[p + 2] = imageData.data[p + 2]
        premul[p + 3] = 255
      } else if (a > 0) {
        const f = a / 255
        premul[p] = Math.round(imageData.data[p] * f)
        premul[p + 1] = Math.round(imageData.data[p + 1] * f)
        premul[p + 2] = Math.round(imageData.data[p + 2] * f)
        premul[p + 3] = a
      }
    }
    const img = ck.MakeImage(
      {
        width: cw, height: ch,
        alphaType: ck.AlphaType.Premul,
        colorType: ck.ColorType.RGBA_8888,
        colorSpace: ck.ColorSpace.SRGB,
      },
      premul, cw * 4,
    )
    if (!img) return 0

    entry = { img, w: tw, h: th }
    textImageCache.set(cacheKey, entry)
    textCacheOrder.push(cacheKey)
    evictTextCache()
  }

  const paint = new ck.Paint()
  paint.setAntiAlias(true)
  if (alpha < 1) paint.setAlphaf(alpha)

  // Draw at scene-space size matching fontSize
  const drawW = entry.w * (fontSize / renderSize)
  const drawH = entry.h * (fontSize / renderSize)
  canvas.drawImageRect(
    entry.img,
    ck.LTRBRect(0, 0, entry.img.width(), entry.img.height()),
    ck.LTRBRect(x, y, x + drawW, y + drawH),
    paint,
  )
  paint.delete()
  return drawW
}

// ---------------------------------------------------------------------------
// Pen tool types
// ---------------------------------------------------------------------------

export interface PenAnchor {
  x: number
  y: number
  handleIn: { x: number; y: number } | null
  handleOut: { x: number; y: number } | null
}

export interface PenPreviewData {
  points: PenAnchor[]
  cursorPos: { x: number; y: number } | null
  isDraggingHandle: boolean
}

/**
 * Draw selection border with corner handles around a rectangle.
 */
export function drawSelectionBorder(
  ck: CanvasKit, canvas: Canvas,
  x: number, y: number, w: number, h: number,
) {
  const paint = new ck.Paint()
  paint.setStyle(ck.PaintStyle.Stroke)
  paint.setAntiAlias(true)
  paint.setStrokeWidth(1.5)
  paint.setColor(parseColor(ck, SELECTION_BLUE))
  canvas.drawRect(ck.LTRBRect(x, y, x + w, y + h), paint)

  // Corner handles
  const handleSize = 6
  const halfHandle = handleSize / 2
  const handlePaint = new ck.Paint()
  handlePaint.setStyle(ck.PaintStyle.Fill)
  handlePaint.setAntiAlias(true)
  handlePaint.setColor(ck.WHITE)

  const handleStrokePaint = new ck.Paint()
  handleStrokePaint.setStyle(ck.PaintStyle.Stroke)
  handleStrokePaint.setAntiAlias(true)
  handleStrokePaint.setStrokeWidth(1)
  handleStrokePaint.setColor(parseColor(ck, SELECTION_BLUE))

  const corners = [
    [x, y], [x + w, y], [x, y + h], [x + w, y + h],
    [x + w / 2, y], [x + w / 2, y + h], [x, y + h / 2], [x + w, y + h / 2],
  ]
  for (const [cx, cy] of corners) {
    const rect = ck.LTRBRect(cx - halfHandle, cy - halfHandle, cx + halfHandle, cy + halfHandle)
    canvas.drawRect(rect, handlePaint)
    canvas.drawRect(rect, handleStrokePaint)
  }

  paint.delete()
  handlePaint.delete()
  handleStrokePaint.delete()
}

/**
 * Draw a frame label above a frame.
 */
export function drawFrameLabel(
  ck: CanvasKit, canvas: Canvas,
  name: string, x: number, y: number,
) {
  drawText2D(ck, canvas, name, x, y - 18, '#999999', 12, '500')
}

/**
 * Draw a dashed hover outline around a node.
 */
export function drawHoverOutline(
  ck: CanvasKit, canvas: Canvas,
  x: number, y: number, w: number, h: number,
) {
  const paint = new ck.Paint()
  paint.setStyle(ck.PaintStyle.Stroke)
  paint.setAntiAlias(true)
  paint.setStrokeWidth(1.5)
  paint.setColor(parseColor(ck, '#3b82f6'))
  const effect = ck.PathEffect.MakeDash([4, 4], 0)
  if (effect) { paint.setPathEffect(effect); effect.delete() }
  canvas.drawRect(ck.LTRBRect(x, y, x + w, y + h), paint)
  paint.delete()
}

/**
 * Draw a selection marquee rectangle.
 */
export function drawSelectionMarquee(
  ck: CanvasKit, canvas: Canvas,
  x1: number, y1: number, x2: number, y2: number,
) {
  const left = Math.min(x1, x2)
  const top = Math.min(y1, y2)
  const right = Math.max(x1, x2)
  const bottom = Math.max(y1, y2)

  const fillPaint = new ck.Paint()
  fillPaint.setStyle(ck.PaintStyle.Fill)
  fillPaint.setColor(parseColor(ck, 'rgba(13, 153, 255, 0.06)'))
  canvas.drawRect(ck.LTRBRect(left, top, right, bottom), fillPaint)
  fillPaint.delete()

  const strokePaint = new ck.Paint()
  strokePaint.setStyle(ck.PaintStyle.Stroke)
  strokePaint.setAntiAlias(true)
  strokePaint.setStrokeWidth(1)
  strokePaint.setColor(parseColor(ck, SELECTION_BLUE))
  canvas.drawRect(ck.LTRBRect(left, top, right, bottom), strokePaint)
  strokePaint.delete()
}

/**
 * Draw a smart alignment guide line.
 */
export function drawGuide(
  ck: CanvasKit, canvas: Canvas,
  x1: number, y1: number, x2: number, y2: number,
  zoom: number,
) {
  const paint = new ck.Paint()
  paint.setStyle(ck.PaintStyle.Stroke)
  paint.setAntiAlias(true)
  paint.setStrokeWidth(1 / zoom)
  paint.setColor(parseColor(ck, '#FF6B35'))
  const dashLen = 3 / zoom
  const effect = ck.PathEffect.MakeDash([dashLen, dashLen], 0)
  if (effect) { paint.setPathEffect(effect); effect.delete() }
  canvas.drawLine(x1, y1, x2, y2, paint)
  paint.delete()
}

// ---------------------------------------------------------------------------
// Pen tool preview
// ---------------------------------------------------------------------------

function buildPenPathSvg(points: PenAnchor[], closed: boolean): string {
  if (points.length === 0) return ''
  const parts: string[] = []
  const first = points[0]
  parts.push(`M ${first.x} ${first.y}`)
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    appendSeg(parts, prev, curr)
  }
  if (closed && points.length > 1) {
    appendSeg(parts, points[points.length - 1], first)
    parts.push('Z')
  }
  return parts.join(' ')
}

function appendSeg(parts: string[], from: PenAnchor, to: PenAnchor) {
  if (!from.handleOut && !to.handleIn) {
    parts.push(`L ${to.x} ${to.y}`)
  } else {
    const cx1 = from.x + (from.handleOut?.x ?? 0)
    const cy1 = from.y + (from.handleOut?.y ?? 0)
    const cx2 = to.x + (to.handleIn?.x ?? 0)
    const cy2 = to.y + (to.handleIn?.y ?? 0)
    parts.push(`C ${cx1} ${cy1} ${cx2} ${cy2} ${to.x} ${to.y}`)
  }
}

/**
 * Draw pen tool preview: constructed path, anchor points, handles, rubber band.
 */
export function drawPenPreview(
  ck: CanvasKit, canvas: Canvas,
  data: PenPreviewData, zoom: number,
) {
  const { points, cursorPos, isDraggingHandle } = data
  if (points.length === 0) return

  const invZ = 1 / zoom // scale visual elements inversely to zoom

  // --- Preview path (segments constructed so far) ---
  if (points.length > 1) {
    const d = buildPenPathSvg(points, false)
    const skPath = ck.Path.MakeFromSVGString(d)
    if (skPath) {
      const paint = new ck.Paint()
      paint.setStyle(ck.PaintStyle.Stroke)
      paint.setAntiAlias(true)
      paint.setStrokeWidth(1.5 * invZ)
      paint.setColor(parseColor(ck, SELECTION_BLUE))
      canvas.drawPath(skPath, paint)
      paint.delete()
      skPath.delete()
    }
  }

  // --- Rubber band line from last point to cursor ---
  const last = points[points.length - 1]
  if (cursorPos && !isDraggingHandle) {
    const paint = new ck.Paint()
    paint.setStyle(ck.PaintStyle.Stroke)
    paint.setAntiAlias(true)
    paint.setStrokeWidth(1 * invZ)
    paint.setColor(parseColor(ck, PEN_RUBBER_BAND_STROKE))
    const dashLen = PEN_RUBBER_BAND_DASH[0] * invZ
    const effect = ck.PathEffect.MakeDash([dashLen, dashLen], 0)
    if (effect) { paint.setPathEffect(effect); effect.delete() }
    canvas.drawLine(last.x, last.y, cursorPos.x, cursorPos.y, paint)
    paint.delete()
  }

  // --- Anchor circles ---
  const anchorStrokePaint = new ck.Paint()
  anchorStrokePaint.setStyle(ck.PaintStyle.Stroke)
  anchorStrokePaint.setAntiAlias(true)
  anchorStrokePaint.setStrokeWidth(1.5 * invZ)
  anchorStrokePaint.setColor(parseColor(ck, SELECTION_BLUE))

  const anchorFillPaint = new ck.Paint()
  anchorFillPaint.setStyle(ck.PaintStyle.Fill)
  anchorFillPaint.setAntiAlias(true)
  anchorFillPaint.setColor(parseColor(ck, PEN_ANCHOR_FILL))

  for (let i = 0; i < points.length; i++) {
    const pt = points[i]
    const r = (i === 0 ? PEN_ANCHOR_FIRST_RADIUS : PEN_ANCHOR_RADIUS) * invZ
    canvas.drawCircle(pt.x, pt.y, r, anchorFillPaint)
    canvas.drawCircle(pt.x, pt.y, r, anchorStrokePaint)
  }

  anchorStrokePaint.delete()
  anchorFillPaint.delete()

  // --- Handle lines and dots ---
  const handleLinePaint = new ck.Paint()
  handleLinePaint.setStyle(ck.PaintStyle.Stroke)
  handleLinePaint.setAntiAlias(true)
  handleLinePaint.setStrokeWidth(1 * invZ)
  handleLinePaint.setColor(parseColor(ck, PEN_HANDLE_LINE_STROKE))

  const handleDotFill = new ck.Paint()
  handleDotFill.setStyle(ck.PaintStyle.Fill)
  handleDotFill.setAntiAlias(true)
  handleDotFill.setColor(parseColor(ck, SELECTION_BLUE))

  const handleDotStroke = new ck.Paint()
  handleDotStroke.setStyle(ck.PaintStyle.Stroke)
  handleDotStroke.setAntiAlias(true)
  handleDotStroke.setStrokeWidth(1 * invZ)
  handleDotStroke.setColor(parseColor(ck, '#ffffff'))

  const dotR = PEN_HANDLE_DOT_RADIUS * invZ

  for (const pt of points) {
    if (pt.handleOut) {
      const hx = pt.x + pt.handleOut.x
      const hy = pt.y + pt.handleOut.y
      canvas.drawLine(pt.x, pt.y, hx, hy, handleLinePaint)
      canvas.drawCircle(hx, hy, dotR, handleDotFill)
      canvas.drawCircle(hx, hy, dotR, handleDotStroke)
    }
    if (pt.handleIn) {
      const hx = pt.x + pt.handleIn.x
      const hy = pt.y + pt.handleIn.y
      canvas.drawLine(pt.x, pt.y, hx, hy, handleLinePaint)
      canvas.drawCircle(hx, hy, dotR, handleDotFill)
      canvas.drawCircle(hx, hy, dotR, handleDotStroke)
    }
  }

  handleLinePaint.delete()
  handleDotFill.delete()
  handleDotStroke.delete()
}

// ---------------------------------------------------------------------------
// Enhanced frame label (with component/instance colors)
// ---------------------------------------------------------------------------

/**
 * Draw a frame label with color based on node type (component, instance, or normal).
 * Font size and offset scale inversely to zoom for constant screen size.
 */
export function drawFrameLabelColored(
  ck: CanvasKit, canvas: Canvas,
  name: string, x: number, y: number,
  isReusable: boolean, isInstance: boolean,
  zoom = 1, _frameW = 0,
) {
  // Guard: skip if coordinates are invalid or name too long (prevents WASM OOM)
  if (!Number.isFinite(x) || !Number.isFinite(y) || !name || name.length > 200) return
  // Skip labels when zoomed out too far — they're unreadable anyway
  if (zoom < 0.05) return
  const color = isReusable ? COMPONENT_COLOR : isInstance ? INSTANCE_COLOR : FRAME_LABEL_COLOR
  // Base: 12px screen-space (12 / zoom in scene-space).
  // When zoomed out (< 0.5), blend toward scene-proportional sizing so labels
  // shrink with frames and don't overlap. Cap min screen size at 6px.
  let rawFontSize: number
  if (zoom >= 0.5) {
    rawFontSize = 12 / zoom // constant 12px on screen
  } else {
    // Blend: at zoom=0.5 → 24 scene-px (12 screen-px); at zoom→0 → approach 14 scene-px
    // This makes labels progressively smaller on screen as you zoom out
    const t = zoom / 0.5 // 0..1
    const fixedSize = 12 / zoom
    const scaledSize = 14 // fixed scene-space size → shrinks on screen with zoom
    rawFontSize = scaledSize + t * (fixedSize - scaledSize)
  }
  rawFontSize = Math.max(4, Math.min(120, rawFontSize))
  // Quantize to 0.5px steps so the drawText2D cache can actually hit during smooth zoom
  // (~232 possible sizes across full zoom range instead of infinite continuous values)
  const fontSize = Math.round(rawFontSize * 2) / 2
  const labelH = (fontSize + 6) // approximate label height
  drawText2D(ck, canvas, name, x, y - labelH, color, fontSize, '500')
}

// ---------------------------------------------------------------------------
// Agent indicators (breathing glow, badge, node borders)
// ---------------------------------------------------------------------------

/**
 * Draw a breathing glow border around an agent-owned frame.
 */
export function drawAgentGlow(
  ck: CanvasKit, canvas: Canvas,
  x: number, y: number, w: number, h: number,
  color: string, breath: number, zoom: number,
) {
  const invZ = 1 / zoom

  // Outer glow (wider, more transparent)
  const outerPaint = new ck.Paint()
  outerPaint.setStyle(ck.PaintStyle.Stroke)
  outerPaint.setAntiAlias(true)
  outerPaint.setStrokeWidth(3 * invZ)
  outerPaint.setColor(parseColor(ck, color))
  outerPaint.setAlphaf(breath * 0.4)
  canvas.drawRect(ck.LTRBRect(x, y, x + w, y + h), outerPaint)
  outerPaint.delete()

  // Inner crisp border
  const innerPaint = new ck.Paint()
  innerPaint.setStyle(ck.PaintStyle.Stroke)
  innerPaint.setAntiAlias(true)
  innerPaint.setStrokeWidth(1.5 * invZ)
  innerPaint.setColor(parseColor(ck, color))
  innerPaint.setAlphaf(breath)
  canvas.drawRect(ck.LTRBRect(x, y, x + w, y + h), innerPaint)
  innerPaint.delete()
}

/**
 * Draw an agent badge (pill with spinning dot + name) above a frame.
 */
export function drawAgentBadge(
  ck: CanvasKit, canvas: Canvas,
  name: string,
  frameX: number, frameY: number, frameW: number,
  color: string, zoom: number, time: number,
) {
  const invZ = 1 / zoom
  const fontSize = 11 * invZ
  const padX = 6 * invZ
  const padY = 3 * invZ
  const radius = 4 * invZ
  const dotR = 3 * invZ
  const labelOffsetY = 6 * invZ

  // Measure text width via Canvas 2D for accurate badge sizing
  const textW = measureText(name, 11, '600') * invZ
  const dotSpace = dotR * 2 + 4 * invZ
  const badgeW = dotSpace + textW + padX * 2
  const badgeH = fontSize + padY * 2
  // Right-align badge to frame's right edge
  const badgeX = frameX + frameW - badgeW
  const badgeY = frameY - labelOffsetY - badgeH

  // Badge background (pill shape)
  const bgPaint = new ck.Paint()
  bgPaint.setStyle(ck.PaintStyle.Fill)
  bgPaint.setAntiAlias(true)
  bgPaint.setColor(parseColor(ck, color))
  bgPaint.setAlphaf(0.9)
  const rrect = ck.RRectXY(
    ck.LTRBRect(badgeX, badgeY, badgeX + badgeW, badgeY + badgeH),
    radius, radius,
  )
  canvas.drawRRect(rrect, bgPaint)
  bgPaint.delete()

  // Spinning dot
  const cx = badgeX + padX + dotR
  const cy = badgeY + badgeH / 2
  const angle = (time / 400) * Math.PI * 2
  const dotPaint = new ck.Paint()
  dotPaint.setStyle(ck.PaintStyle.Fill)
  dotPaint.setAntiAlias(true)
  dotPaint.setColor(ck.WHITE)

  // Trail dots
  for (let d = 0; d < 3; d++) {
    const trailAngle = angle - d * 0.6
    const dx = Math.cos(trailAngle) * dotR * 0.7
    const dy = Math.sin(trailAngle) * dotR * 0.7
    dotPaint.setAlphaf(0.4 - d * 0.12)
    canvas.drawCircle(cx + dx, cy + dy, dotR * 0.8 * (1 - d * 0.2), dotPaint)
  }

  // Main dot
  const mainDx = Math.cos(angle) * dotR * 0.7
  const mainDy = Math.sin(angle) * dotR * 0.7
  dotPaint.setAlphaf(0.95)
  canvas.drawCircle(cx + mainDx, cy + mainDy, dotR * 0.6, dotPaint)
  dotPaint.delete()

  // Agent name text (via Canvas 2D rasterization)
  drawText2D(ck, canvas, name,
    badgeX + padX + dotSpace, badgeY + padY,
    '#FFFFFF', fontSize, '600',
  )
}

/**
 * Draw a breathing dashed border on a node being generated.
 */
export function drawAgentNodeBorder(
  ck: CanvasKit, canvas: Canvas,
  x: number, y: number, w: number, h: number,
  color: string, breath: number, zoom: number,
) {
  const invZ = 1 / zoom
  const paint = new ck.Paint()
  paint.setStyle(ck.PaintStyle.Stroke)
  paint.setAntiAlias(true)
  paint.setStrokeWidth(1.5 * invZ)
  paint.setColor(parseColor(ck, color))
  paint.setAlphaf(breath * 0.7)
  const dashLen = 4 * invZ
  const effect = ck.PathEffect.MakeDash([dashLen, 3 * invZ], 0)
  if (effect) { paint.setPathEffect(effect); effect.delete() }
  canvas.drawRect(ck.LTRBRect(x, y, x + w, y + h), paint)
  paint.delete()
}

/**
 * Draw a preview fill tint on a node that hasn't materialized yet.
 */
export function drawAgentPreviewFill(
  ck: CanvasKit, canvas: Canvas,
  x: number, y: number, w: number, h: number,
  color: string, time: number,
) {
  const alpha = 0.06 + Math.sin((time / 500) * Math.PI * 2) * 0.03
  const paint = new ck.Paint()
  paint.setStyle(ck.PaintStyle.Fill)
  paint.setColor(parseColor(ck, color))
  paint.setAlphaf(alpha)
  canvas.drawRect(ck.LTRBRect(x, y, x + w, y + h), paint)
  paint.delete()
}

// ---------------------------------------------------------------------------
// Connection arrows (storyboard-style arrows between elements)
// ---------------------------------------------------------------------------

/**
 * Draw a connection badge at the top-right corner of an element.
 * Kept for backwards compat but now just draws a small green dot indicator.
 */
export function drawConnectionBadge(
  ck: CanvasKit, canvas: Canvas,
  x: number, y: number, w: number, _h: number,
  zoom: number,
  _connectionCount: number,
  _targetName?: string,
): void {
  // Small green dot at top-right corner as subtle indicator
  const invZ = Math.max(1 / zoom, 0.1)
  const dotR = 4 * invZ
  const paint = new ck.Paint()
  paint.setStyle(ck.PaintStyle.Fill)
  paint.setAntiAlias(true)
  paint.setColor(parseColor(ck, CONNECTION_BADGE_COLOR))
  paint.setAlphaf(0.8)
  canvas.drawCircle(x + w - dotR, y - dotR, dotR, paint)
  paint.delete()
}

// ---------------------------------------------------------------------------
// Reusable CanvasKit objects for connection arrows — avoids per-call allocation
// that fragments WASM heap and causes "table index out of bounds" crashes.
// ---------------------------------------------------------------------------
let _arrowLinePaint: any = null
let _arrowFillPaint: any = null
let _arrowBgPaint: any = null
let _arrowPath: any = null
let _arrowCk: CanvasKit | null = null

function _ensureArrowCache(ck: CanvasKit) {
  if (_arrowCk === ck && _arrowLinePaint) return
  _arrowLinePaint?.delete()
  _arrowFillPaint?.delete()
  _arrowBgPaint?.delete()
  _arrowPath?.delete()
  _arrowLinePaint = new ck.Paint()
  _arrowLinePaint.setStyle(ck.PaintStyle.Stroke)
  _arrowLinePaint.setAntiAlias(true)
  _arrowLinePaint.setStrokeCap(ck.StrokeCap.Round)
  _arrowFillPaint = new ck.Paint()
  _arrowFillPaint.setStyle(ck.PaintStyle.Fill)
  _arrowFillPaint.setAntiAlias(true)
  _arrowBgPaint = new ck.Paint()
  _arrowBgPaint.setStyle(ck.PaintStyle.Fill)
  _arrowBgPaint.setAntiAlias(true)
  _arrowPath = new ck.Path()
  _arrowCk = ck
}
function _getArrowLinePaint(ck: CanvasKit) { _ensureArrowCache(ck); return _arrowLinePaint }
function _getArrowFillPaint(ck: CanvasKit) { _ensureArrowCache(ck); return _arrowFillPaint }
function _getArrowBgPaint(ck: CanvasKit) { _ensureArrowCache(ck); return _arrowBgPaint }
function _getArrowPath(ck: CanvasKit) { _ensureArrowCache(ck); return _arrowPath }

/**
 * Draw a storyboard-style arrow from source element to target element.
 * Finds the best edge pair (closest sides) and draws a curved path with arrowhead.
 */
export function drawStoryboardArrow(
  ck: CanvasKit, canvas: Canvas,
  sx: number, sy: number, sw: number, sh: number,
  tx: number, ty: number, tw: number, th: number,
  zoom: number,
  label?: string,
  alphaOverride?: number,
  /** When set, draw animated dashes with this phase offset (marching ants). */
  dashPhase?: number,
  /** Vertical offset for source anchor (spread multiple outgoing connections). */
  sourceOffset?: number,
  /** Vertical offset for target anchor (spread multiple incoming connections). */
  targetOffset?: number,
): void {
  // Clamp invZ so overlays stay readable at extreme zoom (>1000%)
  const invZ = Math.max(1 / zoom, 0.1)

  // Source and target centers
  const sCx = sx + sw / 2, sCy = sy + sh / 2
  const tCx = tx + tw / 2, tCy = ty + th / 2

  // Pick exit/entry edges: prefer horizontal (right→left) like Xcode
  let x1: number, y1: number, x2: number, y2: number
  if (tCx >= sCx) {
    // Target is to the right: exit right, enter left
    x1 = sx + sw; y1 = sCy + (sourceOffset ?? 0)
    x2 = tx;      y2 = tCy + (targetOffset ?? 0)
  } else {
    // Target is to the left: exit left, enter right
    x1 = sx;      y1 = sCy + (sourceOffset ?? 0)
    x2 = tx + tw; y2 = tCy + (targetOffset ?? 0)
  }

  // Control points for a smooth cubic bezier
  const dx = Math.abs(x2 - x1)
  const cp = Math.max(40 * invZ, dx * 0.4)
  const cpx1 = tCx >= sCx ? x1 + cp : x1 - cp
  const cpx2 = tCx >= sCx ? x2 - cp : x2 + cp

  // Draw the curve — reuse cached paint/path objects to avoid WASM heap fragmentation
  const linePaint = _getArrowLinePaint(ck)
  linePaint.setStrokeWidth((alphaOverride !== undefined && alphaOverride >= 1 ? 3 : 2) * invZ)
  const baseAlpha = alphaOverride ?? 0.85
  linePaint.setColor(parseColor(ck, CONNECTION_BADGE_COLOR))
  linePaint.setAlphaf(baseAlpha)
  // Animated dash for flow highlight
  if (dashPhase !== undefined) {
    const dashLen = 10 * invZ
    const gapLen = 6 * invZ
    const phase = dashPhase * invZ
    if (isFinite(phase)) {
      const effect = ck.PathEffect.MakeDash([dashLen, gapLen], phase)
      if (effect) { linePaint.setPathEffect(effect); effect.delete() }
    }
  } else {
    linePaint.setPathEffect(null)
  }

  const path = _getArrowPath(ck)
  path.reset()
  path.moveTo(x1, y1)
  path.cubicTo(cpx1, y1, cpx2, y2, x2, y2)
  canvas.drawPath(path, linePaint)

  // Arrowhead at target end
  const arrowSize = 8 * invZ
  const dir = tCx >= sCx ? -1 : 1
  const ax = x2, ay = y2

  const arrowPaint = _getArrowFillPaint(ck)
  arrowPaint.setColor(parseColor(ck, CONNECTION_BADGE_COLOR))
  arrowPaint.setAlphaf(baseAlpha)

  path.reset()
  path.moveTo(ax, ay)
  path.lineTo(ax + dir * arrowSize, ay - arrowSize * 0.5)
  path.lineTo(ax + dir * arrowSize, ay + arrowSize * 0.5)
  path.close()
  canvas.drawPath(path, arrowPaint)

  // Label at midpoint of the curve
  if (label) {
    const midX = (x1 + x2) / 2
    const midY = (y1 + y2) / 2 - 10 * invZ
    const fontSize = 10 * invZ
    const padX = 4 * invZ
    const padY = 2 * invZ
    const textW = measureText(label, 10, '500') * invZ
    const bgW = textW + padX * 2
    const bgH = fontSize + padY * 2
    const bgX = midX - bgW / 2
    const bgY = midY - bgH / 2

    const bgPaint = _getArrowBgPaint(ck)
    bgPaint.setColor(parseColor(ck, '#1e293b'))
    bgPaint.setAlphaf(Math.min(baseAlpha, 0.8))
    const r = 3 * invZ
    canvas.drawRRect(ck.RRectXY(ck.LTRBRect(bgX, bgY, bgX + bgW, bgY + bgH), r, r), bgPaint)

    drawText2D(ck, canvas, label, bgX + padX, bgY + padY, '#e2e8f0', fontSize, '500', Math.min(baseAlpha, 1))
  }
}

/**
 * Draw a storyboard arrow that goes off-screen to indicate a cross-page connection.
 * Shows a short arrow from the source element going right, ending with a label pill.
 */
export function drawCrossPageArrow(
  ck: CanvasKit, canvas: Canvas,
  sx: number, sy: number, sw: number, sh: number,
  zoom: number,
  targetName: string,
  index = 0, total = 1,
  alphaOverride?: number,
  dashPhase?: number,
): void {
  // Clamp invZ so overlays stay readable at extreme zoom (>1000%)
  const invZ = Math.max(1 / zoom, 0.1)
  // Offset each arrow vertically when multiple connections from same source
  const rowH = 20 * invZ
  const groupH = total * rowH
  const sCy = sy + sh / 2 - groupH / 2 + rowH / 2 + index * rowH

  // Start from right edge of source
  const x1 = sx + sw
  const y1 = sCy
  const arrowLen = 60 * invZ
  const x2 = x1 + arrowLen
  const y2 = y1

  const baseAlpha = alphaOverride ?? 0.7

  // Dashed line — reuse cached paint (do NOT delete cached objects!)
  const linePaint = _getArrowLinePaint(ck)
  linePaint.setStrokeWidth((alphaOverride !== undefined && alphaOverride >= 1 ? 3 : 2) * invZ)
  linePaint.setColor(parseColor(ck, CONNECTION_BADGE_COLOR))
  linePaint.setAlphaf(baseAlpha)
  const dashLen = dashPhase !== undefined ? 10 * invZ : 6 * invZ
  const gapLen = dashPhase !== undefined ? 6 * invZ : 4 * invZ
  const phase = dashPhase !== undefined ? dashPhase * invZ : 0
  if (isFinite(phase)) {
    const effect = ck.PathEffect.MakeDash([dashLen, gapLen], phase)
    if (effect) { linePaint.setPathEffect(effect); effect.delete() }
  } else {
    linePaint.setPathEffect(null)
  }
  canvas.drawLine(x1, y1, x2, y2, linePaint)

  // Arrowhead — reuse cached objects
  const arrowSize = 7 * invZ
  const arrowPaint = _getArrowFillPaint(ck)
  arrowPaint.setColor(parseColor(ck, CONNECTION_BADGE_COLOR))
  arrowPaint.setAlphaf(baseAlpha)
  const arrowPath = _getArrowPath(ck)
  arrowPath.reset()
  arrowPath.moveTo(x2, y2)
  arrowPath.lineTo(x2 - arrowSize, y2 - arrowSize * 0.5)
  arrowPath.lineTo(x2 - arrowSize, y2 + arrowSize * 0.5)
  arrowPath.close()
  canvas.drawPath(arrowPath, arrowPaint)

  // Target page label pill after arrow
  const fontSize = 10 * invZ
  const padX = 5 * invZ
  const padY = 3 * invZ
  const gap = 4 * invZ
  const textW = measureText(targetName, 10, '500') * invZ
  const pillW = textW + padX * 2
  const pillH = fontSize + padY * 2
  const pillX = x2 + gap
  const pillY = y2 - pillH / 2

  const bgPaint = _getArrowBgPaint(ck)
  bgPaint.setColor(parseColor(ck, CONNECTION_BADGE_COLOR))
  bgPaint.setAlphaf(Math.min(baseAlpha, 0.15))
  const r = 4 * invZ
  canvas.drawRRect(ck.RRectXY(ck.LTRBRect(pillX, pillY, pillX + pillW, pillY + pillH), r, r), bgPaint)

  // Border — reuse line paint
  const borderPaint = _getArrowLinePaint(ck)
  borderPaint.setStrokeWidth(1 * invZ)
  borderPaint.setColor(parseColor(ck, CONNECTION_BADGE_COLOR))
  borderPaint.setAlphaf(0.5)
  borderPaint.setPathEffect(null)
  canvas.drawRRect(ck.RRectXY(ck.LTRBRect(pillX, pillY, pillX + pillW, pillY + pillH), r, r), borderPaint)

  drawText2D(ck, canvas, targetName, pillX + padX, pillY + padY, CONNECTION_BADGE_COLOR, fontSize, '500')
}

/**
 * Draw a small faded diamond badge at the top-left corner of reusable component frames.
 * Per user decision: "small faded badge at corner, low-opacity".
 */
export function drawComponentBadge(
  ck: CanvasKit, canvas: Canvas,
  x: number, y: number, _w: number, _h: number,
  zoom: number,
): void {
  const invZ = 1 / zoom
  const badgeR = 5 * invZ  // diamond radius
  const offsetX = 8 * invZ
  const offsetY = -8 * invZ
  const cx = x + offsetX
  const cy = y + offsetY

  const paint = _getArrowFillPaint(ck)
  // Purple-ish color matching the tab icon, faded per user requirement
  paint.setColor(ck.Color4f(0.6, 0.4, 0.9, 0.4))

  const path = _getArrowPath(ck)
  path.reset()
  path.moveTo(cx, cy - badgeR)       // top
  path.lineTo(cx + badgeR, cy)       // right
  path.lineTo(cx, cy + badgeR)       // bottom
  path.lineTo(cx - badgeR, cy)       // left
  path.close()
  canvas.drawPath(path, paint)
}

// ---------------------------------------------------------------------------
// Highlight mode overlays (Focus+Dim, connection arrows, off-screen indicators)
// ---------------------------------------------------------------------------

/** Reusable dim paint — avoids per-call allocation that fragments WASM heap. */
let _dimPaint: ReturnType<CanvasKit['Paint']['prototype']['constructor']> | null = null
let _dimPaintCk: CanvasKit | null = null

/** Draw a semi-transparent dim overlay on top of a render node (for non-connected elements). */
export function drawDimOverlay(
  ck: CanvasKit, canvas: Canvas,
  x: number, y: number, w: number, h: number,
  opacity: number,
): void {
  // Lazy-init reusable paint (one allocation for all dim overlays)
  if (!_dimPaint || _dimPaintCk !== ck) {
    _dimPaint?.delete()
    _dimPaint = new ck.Paint()
    _dimPaint.setStyle(ck.PaintStyle.Fill)
    _dimPaintCk = ck
  }
  _dimPaint.setColor(ck.Color4f(0, 0, 0, opacity))
  canvas.drawRect(ck.XYWHRect(x, y, w, h), _dimPaint)
}

/** Draw a directional arrow between two render nodes (for connection visualization). */
export function drawConnectionArrow(
  ck: CanvasKit, canvas: Canvas,
  fromX: number, fromY: number, fromW: number, fromH: number,
  toX: number, toY: number, _toW: number, toH: number,
  zoom: number,
): void {
  const invZ = 1 / zoom
  // Arrow from center-right of source to center-left of target
  const x1 = fromX + fromW
  const y1 = fromY + fromH / 2
  const x2 = toX
  const y2 = toY + toH / 2

  // Line
  const linePaint = new ck.Paint()
  linePaint.setStyle(ck.PaintStyle.Stroke)
  linePaint.setStrokeWidth(2 * invZ)
  linePaint.setAntiAlias(true)
  linePaint.setColor(ck.Color4f(0.3, 0.7, 0.4, 0.8))
  canvas.drawLine(x1, y1, x2, y2, linePaint)

  // Arrowhead at target
  const headLen = 10 * invZ
  const angle = Math.atan2(y2 - y1, x2 - x1)
  const a1 = angle + Math.PI * 0.8
  const a2 = angle - Math.PI * 0.8

  const headPaint = new ck.Paint()
  headPaint.setStyle(ck.PaintStyle.Fill)
  headPaint.setAntiAlias(true)
  headPaint.setColor(ck.Color4f(0.3, 0.7, 0.4, 0.8))

  const path = new ck.Path()
  path.moveTo(x2, y2)
  path.lineTo(x2 + headLen * Math.cos(a1), y2 + headLen * Math.sin(a1))
  path.lineTo(x2 + headLen * Math.cos(a2), y2 + headLen * Math.sin(a2))
  path.close()
  canvas.drawPath(path, headPaint)

  path.delete()
  headPaint.delete()
  linePaint.delete()
}

/** Draw an off-screen indicator label for cross-page connections. */
export function drawOffScreenIndicator(
  ck: CanvasKit, canvas: Canvas,
  fromX: number, fromY: number, fromW: number, fromH: number,
  label: string,
  zoom: number,
): void {
  const invZ = 1 / zoom
  const x = fromX + fromW + 8 * invZ
  const y = fromY + fromH / 2

  // Use Canvas 2D rasterization for the label text (consistent with other overlays)
  const fontSize = 11 * invZ
  const padX = 6 * invZ
  const padY = 3 * invZ

  // Measure label text width via Canvas 2D
  const mc = document.createElement('canvas')
  const ctx = mc.getContext('2d')!
  ctx.font = `500 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
  const textWidth = ctx.measureText(label).width * invZ

  // Background pill
  const bgPaint = new ck.Paint()
  bgPaint.setStyle(ck.PaintStyle.Fill)
  bgPaint.setColor(ck.Color4f(0.2, 0.2, 0.3, 0.85))
  const rrect = ck.RRectXY(
    ck.XYWHRect(x - padX, y - padY - fontSize / 2, textWidth + padX * 2, fontSize + padY * 2),
    3 * invZ, 3 * invZ,
  )
  canvas.drawRRect(rrect, bgPaint)
  bgPaint.delete()

  // Arrow indicator line from element edge to label
  const arrowPaint = new ck.Paint()
  arrowPaint.setStyle(ck.PaintStyle.Stroke)
  arrowPaint.setStrokeWidth(1.5 * invZ)
  arrowPaint.setAntiAlias(true)
  arrowPaint.setColor(ck.Color4f(0.3, 0.7, 0.4, 0.6))
  const dashLen = 3 * invZ
  const effect = ck.PathEffect.MakeDash([dashLen, dashLen], 0)
  if (effect) { arrowPaint.setPathEffect(effect); effect.delete() }
  canvas.drawLine(fromX + fromW, y, x - padX, y, arrowPaint)
  arrowPaint.delete()

  // Text via drawText2D (reuse the helper from this file)
  drawText2D(ck, canvas, label, x, y - fontSize / 2, '#e2e8f0', fontSize, '500')
}
