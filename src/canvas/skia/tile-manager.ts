import type { CanvasKit, Image, Surface } from 'canvaskit-wasm'
import type { RenderNode } from './skia-renderer'

// ---------------------------------------------------------------------------
// Multi-resolution zoom levels (Decision 5)
// ---------------------------------------------------------------------------
const ZOOM_LEVELS = [
  { maxZoom: 0.05,  tileSize: 2048 },  // overview
  { maxZoom: 0.25,  tileSize: 1024 },
  { maxZoom: 1.0,   tileSize: 512 },
  { maxZoom: Infinity, tileSize: 256 }, // detail
]

// ---------------------------------------------------------------------------
// Tile entry: cached bitmap + metadata
// ---------------------------------------------------------------------------
export interface TileEntry {
  key: string
  image: Image | null
  dirty: boolean
  lastUsed: number
  sceneX: number
  sceneY: number
  sceneSize: number // tile width/height in scene units (square)
}

// ---------------------------------------------------------------------------
// TileManager: grid math, LRU cache, dirty tracking, node mapping
// ---------------------------------------------------------------------------
export class TileManager {
  private tiles = new Map<string, TileEntry>()
  private maxTiles = 150
  private currentZoomLevel = -1

  // Shared offscreen surface for rendering tiles (reused across tiles)
  tileSurface: Surface | null = null
  tileSurfaceSize = 0

  // -------------------------------------------------------------------------
  // Grid math
  // -------------------------------------------------------------------------

  /** Get tile scene size for a given zoom level */
  getTileSize(zoom: number): number {
    for (const level of ZOOM_LEVELS) {
      if (zoom < level.maxZoom) return level.tileSize
    }
    return 256
  }

  /** Get zoom level index (for detecting zoom level changes) */
  getZoomLevelIndex(zoom: number): number {
    for (let i = 0; i < ZOOM_LEVELS.length; i++) {
      if (zoom < ZOOM_LEVELS[i].maxZoom) return i
    }
    return ZOOM_LEVELS.length - 1
  }

  /** Get all visible tile keys for a viewport region */
  getVisibleTileKeys(
    vpLeft: number, vpTop: number, vpRight: number, vpBottom: number,
    zoom: number,
  ): string[] {
    const tileSize = this.getTileSize(zoom)
    const zoomIdx = this.getZoomLevelIndex(zoom)

    const colStart = Math.floor(vpLeft / tileSize)
    const colEnd = Math.floor(vpRight / tileSize)
    const rowStart = Math.floor(vpTop / tileSize)
    const rowEnd = Math.floor(vpBottom / tileSize)

    const keys: string[] = []
    for (let row = rowStart; row <= rowEnd; row++) {
      for (let col = colStart; col <= colEnd; col++) {
        keys.push(`z${zoomIdx}_${col}_${row}`)
      }
    }
    return keys
  }

  /** Get scene-space rectangle for a tile key */
  getTileSceneRect(key: string): { x: number; y: number; size: number } {
    const parts = key.split('_')
    const zoomIdx = parseInt(parts[0].substring(1))
    const col = parseInt(parts[1])
    const row = parseInt(parts[2])
    const size = ZOOM_LEVELS[zoomIdx]?.tileSize ?? 256
    return { x: col * size, y: row * size, size }
  }

  // -------------------------------------------------------------------------
  // Tile access + LRU
  // -------------------------------------------------------------------------

  /** Get or create a tile entry */
  getOrCreate(key: string): TileEntry {
    let tile = this.tiles.get(key)
    if (!tile) {
      const rect = this.getTileSceneRect(key)
      tile = {
        key,
        image: null,
        dirty: true,
        lastUsed: performance.now(),
        sceneX: rect.x,
        sceneY: rect.y,
        sceneSize: rect.size,
      }
      this.tiles.set(key, tile)
      this.evictLRU()
    }
    return tile
  }

  /** Update lastUsed timestamp */
  touch(key: string) {
    const tile = this.tiles.get(key)
    if (tile) tile.lastUsed = performance.now()
  }

  /** Evict least-recently-used tiles when cache exceeds limit */
  evictLRU() {
    if (this.tiles.size <= this.maxTiles) return

    // Sort by lastUsed ascending (oldest first)
    const entries = [...this.tiles.entries()]
      .sort((a, b) => a[1].lastUsed - b[1].lastUsed)

    const toEvict = this.tiles.size - this.maxTiles
    for (let i = 0; i < toEvict && i < entries.length; i++) {
      const [k, tile] = entries[i]
      tile.image?.delete()
      this.tiles.delete(k)
    }
  }

  // -------------------------------------------------------------------------
  // Dirty tracking
  // -------------------------------------------------------------------------

  /** Mark tiles intersecting a scene-space rect as dirty */
  markDirty(rect: { x: number; y: number; w: number; h: number }, zoom: number) {
    const tileSize = this.getTileSize(zoom)
    const zoomIdx = this.getZoomLevelIndex(zoom)

    const colStart = Math.floor(rect.x / tileSize)
    const colEnd = Math.floor((rect.x + rect.w) / tileSize)
    const rowStart = Math.floor(rect.y / tileSize)
    const rowEnd = Math.floor((rect.y + rect.h) / tileSize)

    for (let row = rowStart; row <= rowEnd; row++) {
      for (let col = colStart; col <= colEnd; col++) {
        const key = `z${zoomIdx}_${col}_${row}`
        const tile = this.tiles.get(key)
        if (tile) tile.dirty = true
      }
    }
  }

  /** Mark ALL cached tiles as dirty (zoom level change, full sync) */
  markAllDirty() {
    for (const tile of this.tiles.values()) {
      tile.dirty = true
    }
  }

  /** Check if zoom level changed (triggers tile resolution switch) */
  checkZoomLevelChange(zoom: number): boolean {
    const newLevel = this.getZoomLevelIndex(zoom)
    if (newLevel !== this.currentZoomLevel) {
      this.currentZoomLevel = newLevel
      return true
    }
    return false
  }

  // -------------------------------------------------------------------------
  // Node-to-tile mapping
  // -------------------------------------------------------------------------

  /** Assign render nodes to tile keys based on bounding box intersection */
  buildNodeMap(renderNodes: RenderNode[], zoom: number): Map<string, RenderNode[]> {
    const tileSize = this.getTileSize(zoom)
    const zoomIdx = this.getZoomLevelIndex(zoom)
    const map = new Map<string, RenderNode[]>()

    for (const rn of renderNodes) {
      const colStart = Math.floor(rn.absX / tileSize)
      const colEnd = Math.floor((rn.absX + rn.absW) / tileSize)
      const rowStart = Math.floor(rn.absY / tileSize)
      const rowEnd = Math.floor((rn.absY + rn.absH) / tileSize)

      for (let row = rowStart; row <= rowEnd; row++) {
        for (let col = colStart; col <= colEnd; col++) {
          const key = `z${zoomIdx}_${col}_${row}`
          let list = map.get(key)
          if (!list) {
            list = []
            map.set(key, list)
          }
          list.push(rn)
        }
      }
    }

    return map
  }

  // -------------------------------------------------------------------------
  // Tile surface management
  // -------------------------------------------------------------------------

  /** Create/resize the shared offscreen surface for tile rendering */
  ensureTileSurface(ck: CanvasKit, pixelSize: number) {
    if (this.tileSurface && this.tileSurfaceSize === pixelSize) return

    this.tileSurface?.delete()
    this.tileSurface = ck.MakeSurface(pixelSize, pixelSize)
    this.tileSurfaceSize = pixelSize
  }

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  /** Delete all cached SkImages and tile surface */
  dispose() {
    for (const tile of this.tiles.values()) {
      tile.image?.delete()
    }
    this.tiles.clear()
    this.tileSurface?.delete()
    this.tileSurface = null
    this.currentZoomLevel = -1
  }
}
