import { describe, it, expect, vi } from 'vitest'

// Mock document.createElement for measureErdText (Canvas 2D text measurement)
const mockMeasureText = vi.fn().mockReturnValue({ width: 50 })
const mockGetContext = vi.fn().mockReturnValue({
  font: '',
  measureText: mockMeasureText,
  fillStyle: '',
  textBaseline: '',
  fillText: vi.fn(),
  globalAlpha: 1,
  scale: vi.fn(),
  getImageData: vi.fn().mockReturnValue({ data: new Uint8Array(0) }),
})

// We need to mock document.createElement before importing the module
vi.stubGlobal('document', {
  createElement: vi.fn().mockReturnValue({
    getContext: mockGetContext,
    width: 0,
    height: 0,
  }),
  documentElement: {
    classList: {
      contains: vi.fn().mockReturnValue(false),
    },
  },
})

import { erdHitTest, computeAllNodeBounds, computeNodeBounds } from '@/canvas/skia/skia-erd-renderer'
import type { DataEntity } from '@/types/data-entity'

function makeEntity(overrides: Partial<DataEntity> = {}): DataEntity {
  return {
    id: 'ent-1',
    name: 'Users',
    fields: [
      { id: 'f1', name: 'id', type: 'number', isPrimaryKey: true },
      { id: 'f2', name: 'name', type: 'text' },
      { id: 'f3', name: 'email', type: 'text' },
    ],
    rows: [],
    views: [],
    ...overrides,
  }
}

describe('ERD Renderer Pure Functions', () => {
  describe('computeNodeBounds', () => {
    it('calculates minimum width of 200', () => {
      const entity = makeEntity({ fields: [{ id: 'f1', name: 'a', type: 'text' }] })
      const bounds = computeNodeBounds(entity)
      expect(bounds.width).toBeGreaterThanOrEqual(200)
    })

    it('calculates height based on field count: header(32) + fields * 24', () => {
      const entity = makeEntity()
      const bounds = computeNodeBounds(entity)
      // 3 fields
      expect(bounds.height).toBe(32 + 3 * 24)
    })

    it('minimum height is header + 1 row when no fields', () => {
      const entity = makeEntity({ fields: [] })
      const bounds = computeNodeBounds(entity)
      // max(fields.length, 1) = 1
      expect(bounds.height).toBe(32 + 1 * 24)
    })
  })

  describe('computeAllNodeBounds', () => {
    it('uses erdPosition when set', () => {
      const entity = makeEntity({ erdPosition: { x: 500, y: 300 } })
      const bounds = computeAllNodeBounds([entity])
      expect(bounds[0].x).toBe(500)
      expect(bounds[0].y).toBe(300)
    })

    it('auto-layouts entities without erdPosition in grid', () => {
      const entities = [
        makeEntity({ id: 'e1', erdPosition: undefined }),
        makeEntity({ id: 'e2', erdPosition: undefined }),
        makeEntity({ id: 'e3', erdPosition: undefined }),
        makeEntity({ id: 'e4', erdPosition: undefined }),
      ]
      const bounds = computeAllNodeBounds(entities)

      // Grid: 3 per row, 250px h-spacing, 300px v-spacing, origin at 100,100
      // Row 0: e1=(100,100), e2=(350,100), e3=(600,100)
      // Row 1: e4=(100,400)
      expect(bounds[0].x).toBe(100)
      expect(bounds[0].y).toBe(100)
      expect(bounds[1].x).toBe(350) // 100 + 250
      expect(bounds[1].y).toBe(100)
      expect(bounds[2].x).toBe(600) // 100 + 500
      expect(bounds[2].y).toBe(100)
      expect(bounds[3].x).toBe(100)
      expect(bounds[3].y).toBe(400) // 100 + 300
    })

    it('mixes positioned and auto-laid-out entities', () => {
      const entities = [
        makeEntity({ id: 'e1', erdPosition: { x: 800, y: 50 } }),
        makeEntity({ id: 'e2', erdPosition: undefined }),
        makeEntity({ id: 'e3', erdPosition: { x: 200, y: 500 } }),
      ]
      const bounds = computeAllNodeBounds(entities)

      // e1 has explicit position
      expect(bounds[0].x).toBe(800)
      expect(bounds[0].y).toBe(50)

      // e2 is auto-laid out as the first auto entity (index 0)
      expect(bounds[1].x).toBe(100)
      expect(bounds[1].y).toBe(100)

      // e3 has explicit position
      expect(bounds[2].x).toBe(200)
      expect(bounds[2].y).toBe(500)
    })

    it('preserves entityId in bounds', () => {
      const entities = [
        makeEntity({ id: 'alpha' }),
        makeEntity({ id: 'beta' }),
      ]
      const bounds = computeAllNodeBounds(entities)
      expect(bounds[0].entityId).toBe('alpha')
      expect(bounds[1].entityId).toBe('beta')
    })
  })

  describe('erdHitTest', () => {
    it('returns entityId when point is inside a node', () => {
      const entity = makeEntity({ erdPosition: { x: 100, y: 100 } })
      // Node bounds: x=100, y=100, width>=200, height=32+3*24=104
      const result = erdHitTest([entity], 150, 150)
      expect(result).not.toBeNull()
      expect(result!.entityId).toBe('ent-1')
      expect(result!.type).toBe('node')
    })

    it('returns null when point is outside all nodes', () => {
      const entity = makeEntity({ erdPosition: { x: 100, y: 100 } })
      const result = erdHitTest([entity], 0, 0)
      expect(result).toBeNull()
    })

    it('returns null for empty entity list', () => {
      const result = erdHitTest([], 100, 100)
      expect(result).toBeNull()
    })

    it('handles entities without erdPosition (auto-layout)', () => {
      const entity = makeEntity({ id: 'auto-ent', erdPosition: undefined })
      // Auto-layout places first entity at (100, 100)
      const result = erdHitTest([entity], 150, 150)
      expect(result).not.toBeNull()
      expect(result!.entityId).toBe('auto-ent')
    })

    it('returns topmost entity when multiple overlap', () => {
      const entities = [
        makeEntity({ id: 'bottom', erdPosition: { x: 100, y: 100 } }),
        makeEntity({ id: 'top', erdPosition: { x: 100, y: 100 } }),
      ]
      // Both overlap at the same position - last in array = topmost
      const result = erdHitTest(entities, 150, 150)
      expect(result).not.toBeNull()
      expect(result!.entityId).toBe('top')
    })

    it('correctly tests edges of bounding rect', () => {
      const entity = makeEntity({ erdPosition: { x: 100, y: 100 } })
      const bounds = computeAllNodeBounds([entity])
      const b = bounds[0]

      // Top-left corner (exactly on boundary)
      const topLeft = erdHitTest([entity], b.x, b.y)
      expect(topLeft).not.toBeNull()

      // Bottom-right corner (exactly on boundary)
      const bottomRight = erdHitTest([entity], b.x + b.width, b.y + b.height)
      expect(bottomRight).not.toBeNull()

      // Just outside right edge
      const outside = erdHitTest([entity], b.x + b.width + 1, b.y + b.height / 2)
      expect(outside).toBeNull()
    })
  })
})
