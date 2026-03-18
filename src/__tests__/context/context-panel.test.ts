import { describe, it, expect } from 'vitest'
import type { PenNode, PenPage, FrameNode } from '@/types/pen'
import type { RightPanelTab } from '@/stores/canvas-store'

describe('CTX-01: Context panel types', () => {
  it('should accept context field on PenNode', () => {
    const node: FrameNode = {
      id: 'test',
      type: 'frame',
      name: 'Test',
      context: 'This is a frame for the hero section',
      width: 400,
      height: 300,
    }
    expect(node.context).toBe('This is a frame for the hero section')
  })

  it('should accept context field on PenPage', () => {
    const page: PenPage = {
      id: 'page-1',
      name: 'Home',
      context: 'Landing page',
      children: [],
    }
    expect(page.context).toBe('Landing page')
  })

  it('should include context in RightPanelTab union', () => {
    const tab: RightPanelTab = 'context'
    expect(tab).toBe('context')
  })

  it('should accept undefined context (optional field)', () => {
    const node: FrameNode = {
      id: 'test',
      type: 'frame',
      name: 'Test',
      width: 400,
      height: 300,
    }
    expect(node.context).toBeUndefined()
  })
})
