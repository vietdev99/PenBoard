import { describe, it, expect, beforeEach } from 'vitest'
import type { PenNode } from '@/types/pen'

describe('CTX-02: Context injection into AI prompts', () => {
  beforeEach(async () => {
    // Reset module state between tests
    const { useDocumentStore } = await import('@/stores/document-store')
    const { useCanvasStore } = await import('@/stores/canvas-store')

    useDocumentStore.setState({
      document: { version: '1', children: [] },
      getNodeById: () => undefined,
      getParentOf: () => undefined,
      getFlatNodes: () => [],
    } as any)

    useCanvasStore.setState({
      selection: { selectedIds: [], activeId: null, hoveredId: null, enteredFrameId: null },
    } as any)
  })

  describe('collectAncestorContext', () => {
    it('should return context strings for ancestors with context', async () => {
      const { collectAncestorContext } = await import('@/components/panels/ai-chat-handlers')
      const { useDocumentStore } = await import('@/stores/document-store')

      const nodes: Record<string, any> = {
        'child-1': { id: 'child-1', type: 'rectangle', name: 'Button', context: 'Primary CTA', width: 120, height: 40 },
        'parent-1': { id: 'parent-1', type: 'frame', name: 'Card', context: 'Product card', width: 300, height: 400 },
        'grandparent-1': { id: 'grandparent-1', type: 'frame', name: 'Section', context: 'Hero section' },
      }

      const parentMap: Record<string, string> = {
        'child-1': 'parent-1',
        'parent-1': 'grandparent-1',
      }

      useDocumentStore.setState({
        document: { version: '1', children: [] },
        getNodeById: (id: string) => nodes[id] as PenNode | undefined,
        getParentOf: (id: string) => {
          const parentId = parentMap[id]
          return parentId ? nodes[parentId] as PenNode : undefined
        },
      } as any)

      const result = collectAncestorContext('child-1')
      expect(result.length).toBeGreaterThan(0)
      // Should contain all three context annotations, ordered root-to-leaf
      const joined = result.join(' > ')
      expect(joined).toContain('Hero section')
      expect(joined).toContain('Product card')
      expect(joined).toContain('Primary CTA')
    })

    it('should return empty array when no ancestors have context', async () => {
      const { collectAncestorContext } = await import('@/components/panels/ai-chat-handlers')
      const { useDocumentStore } = await import('@/stores/document-store')

      useDocumentStore.setState({
        document: { version: '1', children: [] },
        getNodeById: (id: string) => ({ id, type: 'rectangle', name: 'Box' } as PenNode),
        getParentOf: () => undefined,
      } as any)

      const result = collectAncestorContext('node-1')
      expect(result.length).toBe(0)
    })
  })

  describe('context in selected node summary', () => {
    it('should include context in selected node description when present', async () => {
      const { buildContextString } = await import('@/components/panels/ai-chat-handlers')
      const { useCanvasStore } = await import('@/stores/canvas-store')
      const { useDocumentStore } = await import('@/stores/document-store')

      useCanvasStore.setState({
        selection: { selectedIds: ['btn-1'], activeId: 'btn-1', hoveredId: null, enteredFrameId: null },
      } as any)

      useDocumentStore.setState({
        document: { version: '1', children: [] },
        getFlatNodes: () => [{ id: 'btn-1', type: 'rectangle', name: 'Submit', context: 'Purchase action', width: 100, height: 40 }] as PenNode[],
        getNodeById: (id: string) => id === 'btn-1'
          ? { id: 'btn-1', type: 'rectangle', name: 'Submit', context: 'Purchase action', width: 100, height: 40 } as PenNode
          : undefined,
        getParentOf: () => undefined,
      } as any)

      const result = buildContextString()
      expect(result).toContain('Context: Purchase action')
    })
  })
})
