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
  CONNECTION_BADGE_ICON_COLOR,
} from '../canvas-constants'
import { parseColor } from './skia-paint-utils'

// ---------------------------------------------------------------------------
// Canvas 2D text rasterization (CanvasKit null typeface can't render text)
// ---------------------------------------------------------------------------

const OVERLAY_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
const textImageCache = new Map<string, { img: SkImage; w: number; h: number }>()
const textCacheOrder: string[] = []
const TEXT_CACHE_MAX = 200

function evictTextCache() {
  while (textCacheOrder.length > TEXT_CACHE_MAX) {
    const key = textCacheOrder.shift()!
    const entry = textImageCache.get(key)
    entry?.img.delete()
    textImageCache.delete(key)
  }
}

/** Measure text width using Canvas 2D. */
function measureText(text: string, fontSize: number, fontWeight = '500'): number {
  const c = document.createElement('canvas')
  const ctx = c.getContext('2d')!
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
    const mc = document.createElement('canvas')
    const mCtx = mc.getContext('2d')!
    mCtx.font = `${fontWeight} ${renderSize}px ${OVERLAY_FONT}`
    const metrics = mCtx.measureText(text)
    const tw = Math.ceil(metrics.width) + 4
    const th = renderSize + 6

    mc.width = tw * scale
    mc.height = th * scale
    const ctx = mc.getContext('2d')!
    ctx.scale(scale, scale)
    ctx.font = `${fontWeight} ${renderSize}px ${OVERLAY_FONT}`
    ctx.fillStyle = color
    ctx.textBaseline = 'top'
    ctx.fillText(text, 1, 2)

    const imageData = ctx.getImageData(0, 0, mc.width, mc.height)
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
        width: mc.width, height: mc.height,
        alphaType: ck.AlphaType.Premul,
        colorType: ck.ColorType.RGBA_8888,
        colorSpace: ck.ColorSpace.SRGB,
      },
      premul, mc.width * 4,
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
  if (effect) paint.setPathEffect(effect)
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
  if (effect) paint.setPathEffect(effect)
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
    if (effect) paint.setPathEffect(effect)
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
  zoom = 1,
) {
  const color = isReusable ? COMPONENT_COLOR : isInstance ? INSTANCE_COLOR : FRAME_LABEL_COLOR
  const fontSize = 12 / zoom
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
  if (effect) paint.setPathEffect(effect)
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
// Connection badge (green circle at top-right of elements with connections)
// ---------------------------------------------------------------------------

/**
 * Draw a connection badge at the top-right corner of an element.
 * Shows a green circle with an arrow icon. If connectionCount > 1,
 * displays the count.
 */
export function drawConnectionBadge(
  ck: CanvasKit, canvas: Canvas,
  x: number, y: number, w: number, _h: number,
  zoom: number,
  connectionCount: number,
  targetName?: string,
): void {
  const invZ = 1 / zoom
  const badgeR = 8 * invZ // 16px diameter
  const badgeX = x + w - badgeR * 0.5
  const badgeY = y - badgeR * 0.5

  // Green circle background
  const bgPaint = new ck.Paint()
  bgPaint.setStyle(ck.PaintStyle.Fill)
  bgPaint.setAntiAlias(true)
  bgPaint.setColor(parseColor(ck, CONNECTION_BADGE_COLOR))
  canvas.drawCircle(badgeX, badgeY, badgeR, bgPaint)
  bgPaint.delete()

  // Arrow icon (arrow-up-right) inside the circle
  const iconPaint = new ck.Paint()
  iconPaint.setStyle(ck.PaintStyle.Stroke)
  iconPaint.setAntiAlias(true)
  iconPaint.setStrokeWidth(1.5 * invZ)
  iconPaint.setColor(parseColor(ck, CONNECTION_BADGE_ICON_COLOR))
  iconPaint.setStrokeCap(ck.StrokeCap.Round)

  const iconSize = badgeR * 0.7
  const ix = badgeX - iconSize * 0.4
  const iy = badgeY + iconSize * 0.4
  // Arrow shaft: bottom-left to top-right
  canvas.drawLine(ix, iy, ix + iconSize, iy - iconSize, iconPaint)
  // Arrow head: horizontal line from tip
  canvas.drawLine(ix + iconSize * 0.4, iy - iconSize, ix + iconSize, iy - iconSize, iconPaint)
  // Arrow head: vertical line from tip
  canvas.drawLine(ix + iconSize, iy - iconSize + iconSize * 0.6, ix + iconSize, iy - iconSize, iconPaint)
  iconPaint.delete()

  // Count text if > 1
  if (connectionCount > 1) {
    const fontSize = 9 * invZ
    drawText2D(
      ck, canvas, String(connectionCount),
      badgeX + badgeR * 0.3, badgeY + badgeR * 0.1,
      CONNECTION_BADGE_ICON_COLOR, fontSize, '700',
    )
  }

  // Target name label to the right of the badge circle
  if (targetName) {
    const labelFontSize = 10 * invZ
    const labelPadX = 4 * invZ
    const labelPadY = 2 * invZ
    const labelGap = 2 * invZ

    // Measure label text width
    const labelTextW = measureText(targetName, 10, '500') * invZ
    const labelW = labelTextW + labelPadX * 2
    const labelH = labelFontSize + labelPadY * 2

    // Position: to the right of the badge circle
    const labelX = badgeX + badgeR + labelGap
    const labelY = badgeY - labelH / 2

    // Background pill (dark semi-transparent)
    const labelBgPaint = new ck.Paint()
    labelBgPaint.setStyle(ck.PaintStyle.Fill)
    labelBgPaint.setAntiAlias(true)
    labelBgPaint.setColor(parseColor(ck, '#1e293b'))
    labelBgPaint.setAlphaf(0.85)
    const labelRadius = 3 * invZ
    const labelRRect = ck.RRectXY(
      ck.LTRBRect(labelX, labelY, labelX + labelW, labelY + labelH),
      labelRadius, labelRadius,
    )
    canvas.drawRRect(labelRRect, labelBgPaint)
    labelBgPaint.delete()

    // Text
    drawText2D(
      ck, canvas, targetName,
      labelX + labelPadX, labelY + labelPadY,
      '#e2e8f0', labelFontSize, '500',
    )
  }
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

  const paint = new ck.Paint()
  paint.setStyle(ck.PaintStyle.Fill)
  paint.setAntiAlias(true)
  // Purple-ish color matching the tab icon, faded per user requirement
  paint.setColor(ck.Color4f(0.6, 0.4, 0.9, 0.4))

  const path = new ck.Path()
  path.moveTo(cx, cy - badgeR)       // top
  path.lineTo(cx + badgeR, cy)       // right
  path.lineTo(cx, cy + badgeR)       // bottom
  path.lineTo(cx - badgeR, cy)       // left
  path.close()
  canvas.drawPath(path, paint)

  path.delete()
  paint.delete()
}
