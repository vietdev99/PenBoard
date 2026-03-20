import type { CanvasKit, Canvas } from 'canvaskit-wasm'
import type { DataEntity } from '@/types/data-entity'
import {
  ERD_NODE_HEADER_BG,
  ERD_NODE_BODY_BG,
  ERD_NODE_BODY_BG_LIGHT,
  ERD_NODE_BORDER,
  ERD_NODE_TEXT,
  ERD_NODE_TEXT_LIGHT,
  ERD_RELATION_LINE,
  ERD_RELATION_LINE_SELECTED,
  ERD_PK_BADGE_COLOR,
  ERD_FK_BADGE_COLOR,
  SELECTION_BLUE,
  HOVER_BLUE,
} from '../canvas-constants'
import { parseColor } from './skia-paint-utils'
import { viewportMatrix } from './skia-viewport'

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const HEADER_HEIGHT = 32
const FIELD_ROW_HEIGHT = 24
const MIN_NODE_WIDTH = 200
const NODE_PADDING_X = 12
const NODE_BORDER_RADIUS = 6
const GRID_H_SPACING = 250
const GRID_V_SPACING = 300
const GRID_MAX_PER_ROW = 3
const GRID_ORIGIN_X = 100
const GRID_ORIGIN_Y = 100

// Text rendering via Canvas 2D → CanvasKit Image
// (Same pattern as skia-overlays.ts drawText2D)

const OVERLAY_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
import type { Image as SkImage } from 'canvaskit-wasm'

const erdTextCache = new Map<string, { img: SkImage; w: number; h: number }>()
const erdTextCacheOrder: string[] = []
const ERD_TEXT_CACHE_MAX = 300

function evictErdTextCache() {
  while (erdTextCacheOrder.length > ERD_TEXT_CACHE_MAX) {
    const key = erdTextCacheOrder.shift()!
    const entry = erdTextCache.get(key)
    entry?.img.delete()
    erdTextCache.delete(key)
  }
}

function measureErdText(text: string, fontSize: number, fontWeight = '500'): number {
  const c = document.createElement('canvas')
  const ctx = c.getContext('2d')!
  ctx.font = `${fontWeight} ${Math.ceil(fontSize)}px ${OVERLAY_FONT}`
  return ctx.measureText(text).width
}

function drawErdText(
  ck: CanvasKit, canvas: Canvas,
  text: string, x: number, y: number,
  color: string, fontSize: number, fontWeight = '500',
  alpha = 1,
): number {
  const renderSize = Math.ceil(fontSize)
  const cacheKey = `erd|${text}|${color}|${renderSize}|${fontWeight}|${alpha.toFixed(2)}`

  let entry = erdTextCache.get(cacheKey)
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
    ctx.globalAlpha = alpha
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
    erdTextCache.set(cacheKey, entry)
    erdTextCacheOrder.push(cacheKey)
    evictErdTextCache()
  }

  const paint = new ck.Paint()
  paint.setAntiAlias(true)

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
// Pure helper: compute ERD node bounding rect
// ---------------------------------------------------------------------------

export interface ErdNodeBounds {
  entityId: string
  x: number
  y: number
  width: number
  height: number
}

function isLightTheme(): boolean {
  if (typeof document === 'undefined') return false
  return document.documentElement.classList.contains('light')
}

/**
 * Compute bounding rect for an ERD node (entity table).
 * Width = max(MIN_NODE_WIDTH, widest field name + type + badges + padding).
 * Height = HEADER_HEIGHT + fields.length * FIELD_ROW_HEIGHT.
 */
export function computeNodeBounds(entity: DataEntity): { width: number; height: number } {
  let maxFieldWidth = 0
  for (const field of entity.fields) {
    const nameW = measureErdText(field.name || field.id, 11, '400')
    const typeW = measureErdText(field.type, 11, '400')
    const badgeW = (field.isPrimaryKey ? 24 : 0) + (field.type === 'relation' && field.relatedEntityId ? 24 : 0)
    maxFieldWidth = Math.max(maxFieldWidth, nameW + typeW + badgeW + NODE_PADDING_X * 3)
  }
  const headerW = measureErdText(entity.name, 14, '600') + NODE_PADDING_X * 2
  const width = Math.max(MIN_NODE_WIDTH, maxFieldWidth, headerW)
  const height = HEADER_HEIGHT + Math.max(entity.fields.length, 1) * FIELD_ROW_HEIGHT
  return { width, height }
}

/**
 * Compute the effective position and bounding rect for all entities.
 * Entities without erdPosition are auto-laid out in a grid.
 */
export function computeAllNodeBounds(entities: DataEntity[]): ErdNodeBounds[] {
  let autoIndex = 0
  return entities.map((entity) => {
    const { width, height } = computeNodeBounds(entity)
    let x: number, y: number
    if (entity.erdPosition) {
      x = entity.erdPosition.x
      y = entity.erdPosition.y
    } else {
      const col = autoIndex % GRID_MAX_PER_ROW
      const row = Math.floor(autoIndex / GRID_MAX_PER_ROW)
      x = GRID_ORIGIN_X + col * GRID_H_SPACING
      y = GRID_ORIGIN_Y + row * GRID_V_SPACING
      autoIndex++
    }
    return { entityId: entity.id, x, y, width, height }
  })
}

// ---------------------------------------------------------------------------
// Pure helper: ERD hit test
// ---------------------------------------------------------------------------

/**
 * Hit test for ERD nodes: checks if a scene-space point is inside any entity's
 * bounding rect. Returns the entityId if hit, or null.
 */
export function erdHitTest(
  entities: DataEntity[],
  sceneX: number,
  sceneY: number,
): { entityId: string; type: 'node' | 'edge' } | null {
  const bounds = computeAllNodeBounds(entities)
  // Check in reverse order so topmost (last rendered) is hit first
  for (let i = bounds.length - 1; i >= 0; i--) {
    const b = bounds[i]
    if (
      sceneX >= b.x && sceneX <= b.x + b.width
      && sceneY >= b.y && sceneY <= b.y + b.height
    ) {
      return { entityId: b.entityId, type: 'node' }
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// SkiaErdRenderer
// ---------------------------------------------------------------------------

export class SkiaErdRenderer {
  constructor(private ck: CanvasKit) {}

  renderErd(
    canvas: Canvas,
    entities: DataEntity[],
    zoom: number,
    panX: number,
    panY: number,
    selectedEntityId: string | null,
    hoveredEntityId: string | null,
    dragOffset?: { entityId: string; dx: number; dy: number } | null,
  ): void {
    const ck = this.ck
    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1

    // Clear canvas with appropriate background
    const bgColor = isLightTheme() ? '#e5e5e5' : '#1a1a1a'
    canvas.clear(parseColor(ck, bgColor))

    // Apply viewport transform
    canvas.save()
    canvas.scale(dpr, dpr)
    canvas.concat(viewportMatrix({ zoom, panX, panY }))

    if (entities.length === 0) {
      this.renderEmptyState(canvas, zoom, panX, panY)
      canvas.restore()
      return
    }

    let allBounds = computeAllNodeBounds(entities)

    // Apply drag offset to the dragged entity's bounds
    if (dragOffset) {
      allBounds = allBounds.map((b) =>
        b.entityId === dragOffset.entityId
          ? { ...b, x: b.x + dragOffset.dx, y: b.y + dragOffset.dy }
          : b,
      )
    }

    // 1) Draw relation edges first (behind nodes)
    this.renderRelationEdges(canvas, entities, allBounds, selectedEntityId, zoom)

    // 2) Draw table nodes
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i]
      const bounds = allBounds[i]
      const isSelected = entity.id === selectedEntityId
      const isHovered = entity.id === hoveredEntityId && !isSelected
      this.renderTableNode(canvas, entity, bounds, isSelected, isHovered, zoom)
    }

    canvas.restore()
  }

  private renderEmptyState(canvas: Canvas, zoom: number, panX: number, panY: number): void {
    const ck = this.ck
    // Center the text roughly in the viewport
    const textColor = isLightTheme() ? '#94a3b8' : '#64748b'
    const fontSize = 14 / zoom
    // Approximate viewport center in scene space using window dimensions
    const screenW = typeof window !== 'undefined' ? window.innerWidth : 1200
    const screenH = typeof window !== 'undefined' ? window.innerHeight : 800
    const sceneX = (screenW / 2 - panX) / zoom
    const sceneY = (screenH / 2 - panY) / zoom
    const text = 'No data entities yet. Open the Data panel to create tables.'
    const textW = measureErdText(text, 14, '400') / zoom
    drawErdText(ck, canvas, text, sceneX - textW / 2, sceneY, textColor, fontSize, '400')
  }

  private renderTableNode(
    canvas: Canvas,
    entity: DataEntity,
    bounds: ErdNodeBounds,
    isSelected: boolean,
    isHovered: boolean,
    zoom: number,
  ): void {
    const ck = this.ck
    const { x, y, width, height } = bounds
    const light = isLightTheme()
    const bodyBg = light ? ERD_NODE_BODY_BG_LIGHT : ERD_NODE_BODY_BG
    const textColor = light ? ERD_NODE_TEXT_LIGHT : ERD_NODE_TEXT
    const invZ = 1 / zoom

    // --- Drop shadow ---
    const shadowPaint = new ck.Paint()
    shadowPaint.setStyle(ck.PaintStyle.Fill)
    shadowPaint.setColor(parseColor(ck, '#000000'))
    shadowPaint.setAlphaf(0.3)
    const shadowFilter = ck.MaskFilter.MakeBlur(ck.BlurStyle.Normal, 4 * invZ, true)
    if (shadowFilter) { shadowPaint.setMaskFilter(shadowFilter); shadowFilter.delete() }
    const shadowRRect = ck.RRectXY(
      ck.LTRBRect(x + 2 * invZ, y + 2 * invZ, x + width + 2 * invZ, y + height + 2 * invZ),
      NODE_BORDER_RADIUS, NODE_BORDER_RADIUS,
    )
    canvas.drawRRect(shadowRRect, shadowPaint)
    shadowPaint.delete()

    // --- Body background ---
    const bodyPaint = new ck.Paint()
    bodyPaint.setStyle(ck.PaintStyle.Fill)
    bodyPaint.setColor(parseColor(ck, bodyBg))
    bodyPaint.setAntiAlias(true)
    const bodyRRect = ck.RRectXY(
      ck.LTRBRect(x, y, x + width, y + height),
      NODE_BORDER_RADIUS, NODE_BORDER_RADIUS,
    )
    canvas.drawRRect(bodyRRect, bodyPaint)
    bodyPaint.delete()

    // --- Header background ---
    const headerPaint = new ck.Paint()
    headerPaint.setStyle(ck.PaintStyle.Fill)
    headerPaint.setColor(parseColor(ck, ERD_NODE_HEADER_BG))
    headerPaint.setAntiAlias(true)
    // Draw header with top-rounded corners only by clipping
    canvas.save()
    const clipPath = new ck.Path()
    clipPath.addRRect(bodyRRect)
    canvas.clipPath(clipPath, ck.ClipOp.Intersect, true)
    canvas.drawRect(
      ck.LTRBRect(x, y, x + width, y + HEADER_HEIGHT),
      headerPaint,
    )
    clipPath.delete()
    canvas.restore()
    headerPaint.delete()

    // --- Header text: entity name ---
    drawErdText(
      ck, canvas, entity.name,
      x + NODE_PADDING_X, y + 8,
      '#ffffff', 14, '600',
    )

    // --- Header divider line ---
    const divPaint = new ck.Paint()
    divPaint.setStyle(ck.PaintStyle.Stroke)
    divPaint.setStrokeWidth(1 * invZ)
    divPaint.setColor(parseColor(ck, ERD_NODE_BORDER))
    canvas.drawLine(x, y + HEADER_HEIGHT, x + width, y + HEADER_HEIGHT, divPaint)
    divPaint.delete()

    // --- Field rows ---
    if (entity.fields.length === 0) {
      drawErdText(
        ck, canvas, 'No fields',
        x + NODE_PADDING_X, y + HEADER_HEIGHT + 4,
        textColor, 11, '400', 0.5,
      )
    } else {
      for (let i = 0; i < entity.fields.length; i++) {
        const field = entity.fields[i]
        const rowY = y + HEADER_HEIGHT + i * FIELD_ROW_HEIGHT

        // Field name
        drawErdText(
          ck, canvas, field.name || field.id,
          x + NODE_PADDING_X, rowY + 4,
          textColor, 11, '400',
        )

        // Field type (right-aligned area)
        const typeText = field.type
        const typeW = measureErdText(typeText, 11, '400')
        let rightX = x + width - NODE_PADDING_X

        // Badges (drawn from right to left)
        if (field.type === 'relation' && field.relatedEntityId) {
          rightX -= 22
          this.drawBadge(canvas, 'FK', rightX, rowY + 5, ERD_FK_BADGE_COLOR)
        }
        if (field.isPrimaryKey) {
          rightX -= 22
          this.drawBadge(canvas, 'PK', rightX, rowY + 5, ERD_PK_BADGE_COLOR)
        }

        // Type text
        rightX -= typeW + 8
        drawErdText(
          ck, canvas, typeText,
          rightX, rowY + 4,
          textColor, 11, '400', 0.6,
        )

        // Row separator (subtle line)
        if (i < entity.fields.length - 1) {
          const sepPaint = new ck.Paint()
          sepPaint.setStyle(ck.PaintStyle.Stroke)
          sepPaint.setStrokeWidth(0.5 * invZ)
          sepPaint.setColor(parseColor(ck, ERD_NODE_BORDER))
          sepPaint.setAlphaf(0.3)
          canvas.drawLine(
            x + NODE_PADDING_X, rowY + FIELD_ROW_HEIGHT,
            x + width - NODE_PADDING_X, rowY + FIELD_ROW_HEIGHT,
            sepPaint,
          )
          sepPaint.delete()
        }
      }
    }

    // --- Border ---
    const borderPaint = new ck.Paint()
    borderPaint.setStyle(ck.PaintStyle.Stroke)
    borderPaint.setAntiAlias(true)
    borderPaint.setStrokeWidth(1 * invZ)
    borderPaint.setColor(parseColor(ck, ERD_NODE_BORDER))
    canvas.drawRRect(bodyRRect, borderPaint)
    borderPaint.delete()

    // --- Selection / hover border ---
    if (isSelected) {
      const selPaint = new ck.Paint()
      selPaint.setStyle(ck.PaintStyle.Stroke)
      selPaint.setAntiAlias(true)
      selPaint.setStrokeWidth(2 * invZ)
      selPaint.setColor(parseColor(ck, SELECTION_BLUE))
      canvas.drawRRect(bodyRRect, selPaint)
      selPaint.delete()
    } else if (isHovered) {
      const hoverPaint = new ck.Paint()
      hoverPaint.setStyle(ck.PaintStyle.Stroke)
      hoverPaint.setAntiAlias(true)
      hoverPaint.setStrokeWidth(1.5 * invZ)
      hoverPaint.setColor(parseColor(ck, HOVER_BLUE))
      canvas.drawRRect(bodyRRect, hoverPaint)
      hoverPaint.delete()
    }
  }

  private drawBadge(
    canvas: Canvas,
    label: string,
    x: number, y: number,
    color: string,
  ): void {
    const ck = this.ck

    // Badge background
    const bgPaint = new ck.Paint()
    bgPaint.setStyle(ck.PaintStyle.Fill)
    bgPaint.setColor(parseColor(ck, color))
    bgPaint.setAlphaf(0.2)
    bgPaint.setAntiAlias(true)
    const badgeW = 20
    const badgeH = 14
    const rrect = ck.RRectXY(
      ck.LTRBRect(x, y, x + badgeW, y + badgeH),
      3, 3,
    )
    canvas.drawRRect(rrect, bgPaint)
    bgPaint.delete()

    // Badge text
    drawErdText(ck, canvas, label, x + 3, y + 1, color, 8, '700')
  }

  private renderRelationEdges(
    canvas: Canvas,
    entities: DataEntity[],
    allBounds: ErdNodeBounds[],
    selectedEntityId: string | null,
    zoom: number,
  ): void {
    const ck = this.ck
    const invZ = 1 / zoom
    const boundsMap = new Map<string, ErdNodeBounds>()
    for (const b of allBounds) boundsMap.set(b.entityId, b)

    for (const entity of entities) {
      for (const field of entity.fields) {
        if (field.type !== 'relation' || !field.relatedEntityId) continue

        const sourceBounds = boundsMap.get(entity.id)
        const targetBounds = boundsMap.get(field.relatedEntityId)
        if (!sourceBounds || !targetBounds) continue

        const isEdgeSelected = entity.id === selectedEntityId || field.relatedEntityId === selectedEntityId
        const edgeColor = isEdgeSelected ? ERD_RELATION_LINE_SELECTED : ERD_RELATION_LINE

        // Calculate connection points (center of closest sides)
        const srcCx = sourceBounds.x + sourceBounds.width / 2
        const srcCy = sourceBounds.y + sourceBounds.height / 2
        const tgtCx = targetBounds.x + targetBounds.width / 2
        const tgtCy = targetBounds.y + targetBounds.height / 2

        // Determine which side of each node to connect from
        const dx = tgtCx - srcCx
        const dy = tgtCy - srcCy

        let srcX: number, srcY: number, tgtX: number, tgtY: number

        if (Math.abs(dx) > Math.abs(dy)) {
          // Connect horizontally
          if (dx > 0) {
            srcX = sourceBounds.x + sourceBounds.width
            srcY = srcCy
            tgtX = targetBounds.x
            tgtY = tgtCy
          } else {
            srcX = sourceBounds.x
            srcY = srcCy
            tgtX = targetBounds.x + targetBounds.width
            tgtY = tgtCy
          }
        } else {
          // Connect vertically
          if (dy > 0) {
            srcX = srcCx
            srcY = sourceBounds.y + sourceBounds.height
            tgtX = tgtCx
            tgtY = targetBounds.y
          } else {
            srcX = srcCx
            srcY = sourceBounds.y
            tgtX = tgtCx
            tgtY = targetBounds.y + targetBounds.height
          }
        }

        // Draw Manhattan-routed path
        const midX = (srcX + tgtX) / 2
        const midY = (srcY + tgtY) / 2

        const edgePaint = new ck.Paint()
        edgePaint.setStyle(ck.PaintStyle.Stroke)
        edgePaint.setAntiAlias(true)
        edgePaint.setStrokeWidth(2 * invZ)
        edgePaint.setColor(parseColor(ck, edgeColor))
        edgePaint.setStrokeCap(ck.StrokeCap.Round)
        edgePaint.setStrokeJoin(ck.StrokeJoin.Round)

        const path = new ck.Path()
        path.moveTo(srcX, srcY)

        if (Math.abs(dx) > Math.abs(dy)) {
          // Horizontal routing: src → midX → turn → midX → tgt
          path.lineTo(midX, srcY)
          path.lineTo(midX, tgtY)
          path.lineTo(tgtX, tgtY)
        } else {
          // Vertical routing: src → midY → turn → midY → tgt
          path.lineTo(srcX, midY)
          path.lineTo(tgtX, midY)
          path.lineTo(tgtX, tgtY)
        }

        canvas.drawPath(path, edgePaint)
        path.delete()
        edgePaint.delete()

        // Draw cardinality markers
        const cardinality = field.relationCardinality ?? '1:N'
        const srcLabel = cardinality === 'N:M' ? 'N' : '1'
        const tgtLabel = cardinality === '1:1' ? '1' : cardinality === '1:N' ? 'N' : 'M'
        const markerFontSize = 10 / zoom
        const markerOffset = 14 / zoom
        const markerColor = isLightTheme() ? '#475569' : '#94a3b8'

        // Source marker
        const srcMarkerX = Math.abs(dx) > Math.abs(dy)
          ? (dx > 0 ? srcX + markerOffset : srcX - markerOffset - measureErdText(srcLabel, 10, '600') / zoom)
          : srcX + 4 / zoom
        const srcMarkerY = Math.abs(dx) > Math.abs(dy)
          ? srcY - markerFontSize
          : (dy > 0 ? srcY + markerOffset : srcY - markerOffset - markerFontSize)
        drawErdText(ck, canvas, srcLabel, srcMarkerX, srcMarkerY, markerColor, markerFontSize, '600')

        // Target marker
        const tgtMarkerX = Math.abs(dx) > Math.abs(dy)
          ? (dx > 0 ? tgtX - markerOffset - measureErdText(tgtLabel, 10, '600') / zoom : tgtX + markerOffset)
          : tgtX + 4 / zoom
        const tgtMarkerY = Math.abs(dx) > Math.abs(dy)
          ? tgtY - markerFontSize
          : (dy > 0 ? tgtY - markerOffset - markerFontSize : tgtY + markerOffset)
        drawErdText(ck, canvas, tgtLabel, tgtMarkerX, tgtMarkerY, markerColor, markerFontSize, '600')

        // Crow's foot for "many" end (N or M at target)
        if (tgtLabel === 'N' || tgtLabel === 'M') {
          this.drawCrowsFoot(canvas, tgtX, tgtY, srcX, srcY, zoom, edgeColor)
        }
      }
    }
  }

  private drawCrowsFoot(
    canvas: Canvas,
    endX: number, endY: number,
    fromX: number, fromY: number,
    zoom: number,
    color: string,
  ): void {
    const ck = this.ck
    const invZ = 1 / zoom
    const len = 8 * invZ
    const spread = 6 * invZ

    // Determine direction from the "from" side toward the "end" side
    const dx = endX - fromX
    const dy = endY - fromY
    const dist = Math.hypot(dx, dy)
    if (dist === 0) return

    // Unit vector pointing from end back toward from
    const ux = -dx / dist
    const uy = -dy / dist

    // Perpendicular
    const px = -uy
    const py = ux

    const paint = new ck.Paint()
    paint.setStyle(ck.PaintStyle.Stroke)
    paint.setAntiAlias(true)
    paint.setStrokeWidth(2 * invZ)
    paint.setColor(parseColor(ck, color))
    paint.setStrokeCap(ck.StrokeCap.Round)

    // Three lines fanning out from endX,endY
    canvas.drawLine(endX, endY, endX + ux * len + px * spread, endY + uy * len + py * spread, paint)
    canvas.drawLine(endX, endY, endX + ux * len, endY + uy * len, paint)
    canvas.drawLine(endX, endY, endX + ux * len - px * spread, endY + uy * len - py * spread, paint)

    paint.delete()
  }
}
