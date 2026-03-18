import { describe, it, expect } from 'vitest'
import type { PenNode, PenPage, FrameNode } from '@/types/pen'
import { cloneNodesWithNewIds } from '@/utils/node-clone'

describe('CTX-03: Context persistence', () => {
  const sampleNode: FrameNode = {
    id: 'test-1',
    type: 'frame',
    name: 'Test Frame',
    context: 'This is a test frame for layout',
    width: 400,
    height: 300,
    children: [
      {
        id: 'child-1',
        type: 'rectangle',
        name: 'Child Rect',
        context: 'Inner element context',
        width: 100,
        height: 50,
      } as PenNode,
    ],
  }

  describe('JSON round-trip (.pb file)', () => {
    it('should preserve context field on PenNode after JSON.stringify + JSON.parse', () => {
      const json = JSON.stringify(sampleNode)
      const parsed = JSON.parse(json) as FrameNode
      expect(parsed.context).toBe('This is a test frame for layout')
      expect((parsed.children![0] as any).context).toBe('Inner element context')
    })

    it('should preserve context field on PenPage after JSON.stringify + JSON.parse', () => {
      const page: PenPage = {
        id: 'page-1',
        name: 'Screen 1',
        type: 'screen',
        context: 'Main landing page',
        children: [sampleNode],
      }
      const json = JSON.stringify(page)
      const parsed = JSON.parse(json) as PenPage
      expect(parsed.context).toBe('Main landing page')
    })
  })

  describe('Copy/paste (structuredClone)', () => {
    it('should preserve context when cloning nodes via structuredClone', () => {
      const cloned = structuredClone(sampleNode)
      expect(cloned.context).toBe('This is a test frame for layout')
      expect((cloned.children![0] as any).context).toBe('Inner element context')
      // Verify it is a deep copy
      cloned.context = 'modified'
      expect(sampleNode.context).toBe('This is a test frame for layout')
    })
  })

  describe('Duplicate (cloneNodesWithNewIds)', () => {
    it('should preserve context when duplicating nodes', () => {
      const duplicated = cloneNodesWithNewIds([sampleNode])
      expect(duplicated[0].id).not.toBe(sampleNode.id) // New ID
      expect((duplicated[0] as FrameNode).context).toBe('This is a test frame for layout')
      const child = (duplicated[0] as FrameNode).children![0]
      expect((child as any).context).toBe('Inner element context')
    })
  })

  describe('Undefined context', () => {
    it('should not add context field when undefined (clean serialization)', () => {
      const nodeWithout: FrameNode = { id: 'no-ctx', type: 'frame', name: 'No Context', width: 100, height: 100 }
      const json = JSON.stringify(nodeWithout)
      expect(json).not.toContain('context')
    })
  })
})
