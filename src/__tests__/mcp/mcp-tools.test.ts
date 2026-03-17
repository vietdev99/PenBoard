/**
 * MCP Tool Unit Tests
 *
 * Tests for the four core MCP tool categories:
 *   1. batch-get.ts — batched node retrieval (by pattern + by ID)
 *   2. batch-design.ts — DSL operations: I (insert), U (update), D (delete)
 *   3. snapshot-layout.ts — layout rectangle calculation
 *   4. variables.ts — get/set variable operations
 *
 * document-manager is mocked so no disk I/O occurs.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PenDocument, PenNode } from '@/types/pen'
import type { VariableDefinition } from '@/types/variables'

// ---------------------------------------------------------------------------
// Mock document-manager — all MCP tools depend on this
// ---------------------------------------------------------------------------

let _docs = new Map<string, PenDocument>()

vi.mock('@/mcp/document-manager', () => ({
  resolveDocPath: (p?: string) => p ?? 'test://doc',
  openDocument: async (path: string) => {
    const doc = _docs.get(path)
    if (!doc) throw new Error(`Document not found: ${path}`)
    return doc
  },
  saveDocument: async (path: string, doc: PenDocument) => {
    _docs.set(path, doc)
  },
}))

// Stub out role/icon resolvers used by batch-design post-processing
vi.mock('@/services/ai/role-resolver', () => ({
  resolveTreeRoles: vi.fn(),
  resolveTreePostPass: vi.fn(),
}))

vi.mock('@/services/ai/icon-resolver', () => ({
  applyIconPathResolution: vi.fn(),
  applyNoEmojiIconHeuristic: vi.fn(),
}))

vi.mock('@/services/ai/design-node-sanitization', () => ({
  ensureUniqueNodeIds: vi.fn(),
  sanitizeLayoutChildPositions: vi.fn(),
  sanitizeScreenFrameBounds: vi.fn(),
}))

vi.mock('@/services/ai/role-definitions/index', () => ({}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DOC_PATH = 'test://doc'

function makeDoc(children: PenNode[] = []): PenDocument {
  return {
    version: '1.0.0',
    children: [],
    pages: [
      {
        id: 'page-1',
        name: 'Page 1',
        children,
      },
    ],
  }
}

function frameNode(id: string, name: string, children: PenNode[] = []): PenNode {
  return {
    id,
    type: 'frame',
    name,
    x: 0,
    y: 0,
    width: 200,
    height: 150,
    fill: [{ type: 'solid', color: '#FFFFFF' }],
    children,
  } as PenNode
}

function rectNode(id: string, name: string): PenNode {
  return {
    id,
    type: 'rectangle',
    name,
    x: 10,
    y: 10,
    width: 60,
    height: 40,
    fill: [{ type: 'solid', color: '#FF0000' }],
  } as PenNode
}

// ---------------------------------------------------------------------------
// 1. batch-get tests
// ---------------------------------------------------------------------------

describe('handleBatchGet', () => {
  beforeEach(() => {
    _docs.clear()
    _docs.set(DOC_PATH, makeDoc([
      frameNode('frame-a', 'Header', [rectNode('rect-1', 'Logo')]),
      frameNode('frame-b', 'Footer'),
      rectNode('rect-2', 'Background'),
    ]))
  })

  it('returns all top-level nodes when no patterns or nodeIds given', async () => {
    const { handleBatchGet } = await import('@/mcp/tools/batch-get')
    const result = await handleBatchGet({ filePath: DOC_PATH })
    expect(result.nodes).toHaveLength(3)
  })

  it('returns nodes matching a type pattern', async () => {
    const { handleBatchGet } = await import('@/mcp/tools/batch-get')
    const result = await handleBatchGet({
      filePath: DOC_PATH,
      patterns: [{ type: 'frame' }],
    })
    expect(result.nodes).toHaveLength(2)
    expect((result.nodes[0] as PenNode).type).toBe('frame')
    expect((result.nodes[1] as PenNode).type).toBe('frame')
  })

  it('returns nodes matching a name pattern', async () => {
    const { handleBatchGet } = await import('@/mcp/tools/batch-get')
    const result = await handleBatchGet({
      filePath: DOC_PATH,
      patterns: [{ name: 'Header' }],
    })
    expect(result.nodes).toHaveLength(1)
    expect((result.nodes[0] as PenNode).name).toBe('Header')
  })

  it('returns nodes by explicit ID list', async () => {
    const { handleBatchGet } = await import('@/mcp/tools/batch-get')
    const result = await handleBatchGet({
      filePath: DOC_PATH,
      nodeIds: ['frame-b', 'rect-2'],
    })
    expect(result.nodes).toHaveLength(2)
    const ids = result.nodes.map((n) => (n as PenNode).id)
    expect(ids).toContain('frame-b')
    expect(ids).toContain('rect-2')
  })

  it('returns children of a specific parent', async () => {
    const { handleBatchGet } = await import('@/mcp/tools/batch-get')
    const result = await handleBatchGet({
      filePath: DOC_PATH,
      parentId: 'frame-a',
    })
    expect(result.nodes).toHaveLength(1)
    expect((result.nodes[0] as PenNode).id).toBe('rect-1')
  })

  it('returns empty array for parentId with no children', async () => {
    const { handleBatchGet } = await import('@/mcp/tools/batch-get')
    const result = await handleBatchGet({
      filePath: DOC_PATH,
      parentId: 'frame-b',
    })
    expect(result.nodes).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// 2. batch-design DSL tests
// ---------------------------------------------------------------------------

describe('handleBatchDesign', () => {
  beforeEach(() => {
    _docs.clear()
    _docs.set(DOC_PATH, makeDoc([
      frameNode('existing-frame', 'Existing Frame', [
        rectNode('existing-rect', 'Existing Rect'),
      ]),
    ]))
  })

  it('I operation inserts a new rectangle at root level', async () => {
    const { handleBatchDesign } = await import('@/mcp/tools/batch-design')
    const result = await handleBatchDesign({
      filePath: DOC_PATH,
      operations: `r=I(null, {"type":"rectangle","name":"New Rect","x":0,"y":0,"width":100,"height":80})`,
    })

    expect(result.results).toHaveLength(1)
    expect(result.results[0].binding).toBe('r')

    // Verify node is in the saved doc
    const saved = _docs.get(DOC_PATH)!
    const page = saved.pages![0]
    const newRect = page.children.find(
      (n) => n.name === 'New Rect' && n.type === 'rectangle',
    )
    expect(newRect).toBeDefined()
  })

  it('I operation inserts a child node inside a parent frame', async () => {
    const { handleBatchDesign } = await import('@/mcp/tools/batch-design')
    const result = await handleBatchDesign({
      filePath: DOC_PATH,
      operations: `child=I("existing-frame", {"type":"rectangle","name":"Inner Rect","x":5,"y":5,"width":50,"height":30})`,
    })

    expect(result.results).toHaveLength(1)
    const saved = _docs.get(DOC_PATH)!
    const frame = saved.pages![0].children.find((n) => n.id === 'existing-frame') as typeof frameNode
    expect(frame).toBeDefined()
    const inner = ('children' in frame ? frame.children : [])?.find(
      (n: PenNode) => n.name === 'Inner Rect',
    )
    expect(inner).toBeDefined()
  })

  it('U operation updates an existing node property', async () => {
    const { handleBatchDesign } = await import('@/mcp/tools/batch-design')
    await handleBatchDesign({
      filePath: DOC_PATH,
      operations: `U("existing-rect", {"name":"Updated Rect","width":200})`,
    })

    const saved = _docs.get(DOC_PATH)!
    const page = saved.pages![0]
    // Rect is inside existing-frame
    const frame = page.children.find((n) => n.id === 'existing-frame')
    const rect = ('children' in frame! ? (frame as { children: PenNode[] }).children : []).find(
      (n: PenNode) => n.id === 'existing-rect',
    )
    expect(rect?.name).toBe('Updated Rect')
    expect(rect?.width).toBe(200)
  })

  it('D operation deletes a node', async () => {
    const { handleBatchDesign } = await import('@/mcp/tools/batch-design')
    await handleBatchDesign({
      filePath: DOC_PATH,
      operations: `D("existing-rect")`,
    })

    const saved = _docs.get(DOC_PATH)!
    const page = saved.pages![0]
    const frame = page.children.find((n) => n.id === 'existing-frame')
    const rect = ('children' in frame! ? (frame as { children: PenNode[] }).children : []).find(
      (n: PenNode) => n.id === 'existing-rect',
    )
    expect(rect).toBeUndefined()
  })

  it('multi-operation script executes all ops in sequence', async () => {
    const { handleBatchDesign } = await import('@/mcp/tools/batch-design')
    const result = await handleBatchDesign({
      filePath: DOC_PATH,
      operations: [
        `a=I(null, {"type":"frame","name":"New Frame","x":300,"y":0,"width":400,"height":300})`,
        `b=I(a, {"type":"rectangle","name":"Child Rect","x":10,"y":10,"width":80,"height":60})`,
        `D("existing-rect")`,
      ].join('\n'),
    })

    expect(result.results).toHaveLength(2)

    const saved = _docs.get(DOC_PATH)!
    const page = saved.pages![0]

    // New frame should exist with child
    const newFrame = page.children.find((n) => n.name === 'New Frame')
    expect(newFrame).toBeDefined()
    const child = ('children' in newFrame! ? (newFrame as { children: PenNode[] }).children : []).find(
      (n: PenNode) => n.name === 'Child Rect',
    )
    expect(child).toBeDefined()

    // existing-rect should be gone
    const existingFrame = page.children.find((n) => n.id === 'existing-frame')
    const deletedRect = ('children' in existingFrame! ? (existingFrame as { children: PenNode[] }).children : []).find(
      (n: PenNode) => n.id === 'existing-rect',
    )
    expect(deletedRect).toBeUndefined()
  })

  it('throws on invalid operation syntax', async () => {
    const { handleBatchDesign } = await import('@/mcp/tools/batch-design')
    await expect(
      handleBatchDesign({
        filePath: DOC_PATH,
        operations: `INVALID_SYNTAX`,
      }),
    ).rejects.toThrow()
  })
})

// ---------------------------------------------------------------------------
// 3. snapshot-layout tests
// ---------------------------------------------------------------------------

describe('handleSnapshotLayout', () => {
  beforeEach(() => {
    _docs.clear()
    _docs.set(DOC_PATH, makeDoc([
      frameNode('root-frame', 'Root', [
        rectNode('child-1', 'Child A'),
        rectNode('child-2', 'Child B'),
      ]),
    ]))
  })

  it('returns layout entries for top-level nodes', async () => {
    const { handleSnapshotLayout } = await import('@/mcp/tools/snapshot-layout')
    const result = await handleSnapshotLayout({ filePath: DOC_PATH })

    expect(result.layout).toHaveLength(1)
    const rootEntry = result.layout[0]
    expect(rootEntry.id).toBe('root-frame')
    expect(typeof rootEntry.x).toBe('number')
    expect(typeof rootEntry.y).toBe('number')
    expect(typeof rootEntry.width).toBe('number')
    expect(typeof rootEntry.height).toBe('number')
  })

  it('returns children layout when parentId is specified', async () => {
    const { handleSnapshotLayout } = await import('@/mcp/tools/snapshot-layout')
    const result = await handleSnapshotLayout({
      filePath: DOC_PATH,
      parentId: 'root-frame',
      maxDepth: 1,
    })

    expect(result.layout.length).toBeGreaterThanOrEqual(2)
    const ids = result.layout.map((e) => e.id)
    expect(ids).toContain('child-1')
    expect(ids).toContain('child-2')
  })

  it('throws when parentId does not exist', async () => {
    const { handleSnapshotLayout } = await import('@/mcp/tools/snapshot-layout')
    await expect(
      handleSnapshotLayout({
        filePath: DOC_PATH,
        parentId: 'nonexistent-id',
      }),
    ).rejects.toThrow('Node not found: nonexistent-id')
  })

  it('respects maxDepth parameter', async () => {
    const { handleSnapshotLayout } = await import('@/mcp/tools/snapshot-layout')
    // maxDepth=0 means only the parentId itself (no children listed)
    const result = await handleSnapshotLayout({
      filePath: DOC_PATH,
      maxDepth: 0,
    })
    // At depth 0, only root-frame is included (no children)
    expect(result.layout).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// 4. variables tests
// ---------------------------------------------------------------------------

describe('handleGetVariables / handleSetVariables', () => {
  beforeEach(() => {
    _docs.clear()
    _docs.set(DOC_PATH, {
      ...makeDoc(),
      variables: {
        'primary-color': { type: 'color', value: '#0066CC' },
        'spacing-md': { type: 'number', value: 16 },
      },
      themes: {
        'Color Scheme': ['Light', 'Dark'],
      },
    })
  })

  it('getVariables returns all variables and themes', async () => {
    const { handleGetVariables } = await import('@/mcp/tools/variables')
    const result = await handleGetVariables({ filePath: DOC_PATH })

    expect(result.variables['primary-color']).toEqual({ type: 'color', value: '#0066CC' })
    expect(result.variables['spacing-md']).toEqual({ type: 'number', value: 16 })
    expect(result.themes['Color Scheme']).toEqual(['Light', 'Dark'])
  })

  it('setVariables merges new variables into existing ones by default', async () => {
    const { handleSetVariables } = await import('@/mcp/tools/variables')
    const newVars: Record<string, VariableDefinition> = {
      'font-size-lg': { type: 'number', value: 24 },
    }
    const result = await handleSetVariables({
      filePath: DOC_PATH,
      variables: newVars,
    })

    expect(result.variables['primary-color']).toBeDefined()
    expect(result.variables['spacing-md']).toBeDefined()
    expect(result.variables['font-size-lg']).toEqual({ type: 'number', value: 24 })
  })

  it('setVariables with replace=true replaces all existing variables', async () => {
    const { handleSetVariables } = await import('@/mcp/tools/variables')
    const newVars: Record<string, VariableDefinition> = {
      'brand-color': { type: 'color', value: '#FF5500' },
    }
    const result = await handleSetVariables({
      filePath: DOC_PATH,
      variables: newVars,
      replace: true,
    })

    expect(result.variables['primary-color']).toBeUndefined()
    expect(result.variables['brand-color']).toEqual({ type: 'color', value: '#FF5500' })
  })

  it('setVariables updates existing variable value', async () => {
    const { handleSetVariables } = await import('@/mcp/tools/variables')
    await handleSetVariables({
      filePath: DOC_PATH,
      variables: {
        'primary-color': { type: 'color', value: '#FF0000' },
      },
    })

    const { handleGetVariables } = await import('@/mcp/tools/variables')
    const result = await handleGetVariables({ filePath: DOC_PATH })
    expect(result.variables['primary-color'].value).toBe('#FF0000')
  })

  it('getVariables returns empty objects when doc has no variables/themes', async () => {
    _docs.set(DOC_PATH, makeDoc())
    const { handleGetVariables } = await import('@/mcp/tools/variables')
    const result = await handleGetVariables({ filePath: DOC_PATH })
    expect(result.variables).toEqual({})
    expect(result.themes).toEqual({})
  })
})
