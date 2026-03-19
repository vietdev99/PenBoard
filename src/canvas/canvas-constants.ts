export const MIN_ZOOM = 0.02
export const MAX_ZOOM = 256
export const ZOOM_STEP = 0.1
export const SNAP_THRESHOLD = 5
export const DEFAULT_FILL = '#d1d5db'
export const DEFAULT_STROKE = '#374151'
export const DEFAULT_STROKE_WIDTH = 1
export const CANVAS_BACKGROUND_LIGHT = '#e5e5e5'
export const CANVAS_BACKGROUND_DARK = '#1a1a1a'

let _bgCache: string | null = null
let _bgCacheTick = 0

export function getCanvasBackground(): string {
  const tick = performance.now()
  if (_bgCache && tick - _bgCacheTick < 1000) return _bgCache
  _bgCacheTick = tick
  if (typeof document === 'undefined') return (_bgCache = CANVAS_BACKGROUND_DARK)
  _bgCache = document.documentElement.classList.contains('light')
    ? CANVAS_BACKGROUND_LIGHT
    : CANVAS_BACKGROUND_DARK
  return _bgCache
}
export const SELECTION_BLUE = '#0d99ff'
export const COMPONENT_COLOR = '#a855f7'
export const INSTANCE_COLOR = '#9281f7'

// Hover / overlay / indicator
export const HOVER_BLUE = '#3b82f6'
export const HOVER_LINE_WIDTH = 1.5
export const HOVER_DASH = [4, 4]
export const INDICATOR_BLUE = '#3B82F6'
export const INDICATOR_LINE_WIDTH = 2
export const INDICATOR_DASH = [6, 4]
export const INDICATOR_ENDPOINT_RADIUS = 3

// Frame labels
export const FRAME_LABEL_FONT_SIZE = 12
export const FRAME_LABEL_OFFSET_Y = 6
export const FRAME_LABEL_COLOR = '#999999'

// Pen tool
export const PEN_ANCHOR_FILL = '#ffffff'
export const PEN_ANCHOR_RADIUS = 4
export const PEN_ANCHOR_FIRST_RADIUS = 5
export const PEN_HANDLE_DOT_RADIUS = 3
export const PEN_HANDLE_LINE_STROKE = '#888888'
export const PEN_RUBBER_BAND_STROKE = 'rgba(13, 153, 255, 0.5)'
export const PEN_RUBBER_BAND_DASH = [4, 4]
export const PEN_CLOSE_HIT_THRESHOLD = 8

// Dimension label
export const DIMENSION_LABEL_OFFSET_Y = 8

// Default node colors
export const DEFAULT_FRAME_FILL = '#ffffff'
export const DEFAULT_TEXT_FILL = '#000000'

// Smart guides
export const GUIDE_COLOR = '#FF6B35'
export const GUIDE_LINE_WIDTH = 1
export const GUIDE_DASH = [3, 3]

// Connection badge
export const CONNECTION_BADGE_COLOR = '#10b981'
export const CONNECTION_BADGE_ICON_COLOR = '#ffffff'

// ERD nodes
export const ERD_NODE_HEADER_BG = '#3b82f6'
export const ERD_NODE_BODY_BG = '#1e293b'
export const ERD_NODE_BODY_BG_LIGHT = '#f8fafc'
export const ERD_NODE_BORDER = '#334155'
export const ERD_NODE_TEXT = '#f1f5f9'
export const ERD_NODE_TEXT_LIGHT = '#1e293b'
export const ERD_RELATION_LINE = '#6366f1'
export const ERD_RELATION_LINE_SELECTED = '#818cf8'
export const ERD_PK_BADGE_COLOR = '#f59e0b'
export const ERD_FK_BADGE_COLOR = '#8b5cf6'
