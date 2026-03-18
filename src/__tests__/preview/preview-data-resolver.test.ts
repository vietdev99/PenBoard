import { describe, expect, it } from 'vitest'
import { resolvePageForPreview, expandRefNode } from '@/services/preview/preview-data-resolver'
import type { PenDocument, PenNode, RefNode, FrameNode, TextNode } from '@/types/pen'

/** Helper to build a minimal PenDocument */
function makeDoc(overrides: Partial<PenDocument> = {}): PenDocument {
  return {
    version: '1',
    children: [],
    ...overrides,
  }
}

describe('resolvePageForPreview', () => {
  it('resolves table-bound node with entity field headers and row data', () => {
    const tableNode: PenNode = {
      id: 'tbl-1',
      type: 'frame',
      role: 'table',
      dataBinding: { entityId: 'ent-1', fieldMappings: [] },
      children: [
        // Header row
        {
          id: 'hdr',
          type: 'frame',
          children: [
            { id: 'h1', type: 'text', content: 'Col A' } as TextNode,
            { id: 'h2', type: 'text', content: 'Col B' } as TextNode,
          ],
        } as FrameNode,
        // Template data row
        {
          id: 'dr-1',
          type: 'frame',
          role: 'table-row',
          children: [
            { id: 'd1', type: 'text', content: '' } as TextNode,
            { id: 'd2', type: 'text', content: '' } as TextNode,
          ],
        } as FrameNode,
      ],
    } as FrameNode

    const doc = makeDoc({
      dataEntities: [
        {
          id: 'ent-1',
          name: 'Users',
          fields: [
            { id: 'f1', name: 'Name', type: 'text' },
            { id: 'f2', name: 'Email', type: 'text' },
          ],
          rows: [
            { id: 'r1', values: { f1: 'Alice', f2: 'alice@ex.com' } },
            { id: 'r2', values: { f1: 'Bob', f2: 'bob@ex.com' } },
          ],
          views: [],
        },
      ],
    })

    const result = resolvePageForPreview([tableNode], doc)
    // Table should have resolved header and row data
    expect(result).toHaveLength(1)
    const resolved = result[0] as FrameNode
    // Header text should show entity field names
    const header = resolved.children![0] as FrameNode
    expect((header.children![0] as TextNode).content).toBe('Name')
    expect((header.children![1] as TextNode).content).toBe('Email')
  })

  it('resolves text-bound node content from first entity row', () => {
    // A text node with data binding should get its content from the entity
    const textParent: PenNode = {
      id: 'dp-1',
      type: 'frame',
      role: 'list',
      dataBinding: { entityId: 'ent-1', fieldMappings: [] },
      children: [
        {
          id: 'item-1',
          type: 'frame',
          children: [
            { id: 't1', type: 'text', content: 'placeholder' } as TextNode,
          ],
        } as FrameNode,
      ],
    } as FrameNode

    const doc = makeDoc({
      dataEntities: [
        {
          id: 'ent-1',
          name: 'Products',
          fields: [{ id: 'f1', name: 'Title', type: 'text' }],
          rows: [{ id: 'r1', values: { f1: 'Widget' } }],
          views: [],
        },
      ],
    })

    const result = resolvePageForPreview([textParent], doc)
    const resolved = result[0] as FrameNode
    const item = resolved.children![0] as FrameNode
    expect((item.children![0] as TextNode).content).toBe('Widget')
  })

  it('resolves $variable references to concrete values using default theme', () => {
    const node: PenNode = {
      id: 'n1',
      type: 'text',
      content: 'hello',
      fontSize: 16,
      fill: [{ type: 'solid', color: '$brand-color' }],
    } as TextNode

    const doc = makeDoc({
      variables: {
        'brand-color': { type: 'color', value: '#FF0000' },
      },
    })

    const result = resolvePageForPreview([node], doc)
    const resolved = result[0] as TextNode
    // Fill color should be resolved from $brand-color to #FF0000
    expect(resolved.fill![0].color).toBe('#FF0000')
  })

  it('processes nested children recursively (data-bound child inside unbound parent)', () => {
    const parent: PenNode = {
      id: 'outer',
      type: 'frame',
      children: [
        {
          id: 'inner',
          type: 'frame',
          role: 'list',
          dataBinding: { entityId: 'ent-1', fieldMappings: [] },
          children: [
            {
              id: 'row-1',
              type: 'frame',
              children: [
                { id: 't1', type: 'text', content: '' } as TextNode,
              ],
            } as FrameNode,
          ],
        } as FrameNode,
      ],
    } as FrameNode

    const doc = makeDoc({
      dataEntities: [
        {
          id: 'ent-1',
          name: 'Items',
          fields: [{ id: 'f1', name: 'Name', type: 'text' }],
          rows: [{ id: 'r1', values: { f1: 'Deep Item' } }],
          views: [],
        },
      ],
    })

    const result = resolvePageForPreview([parent], doc)
    const outer = result[0] as FrameNode
    const inner = outer.children![0] as FrameNode
    const row = inner.children![0] as FrameNode
    expect((row.children![0] as TextNode).content).toBe('Deep Item')
  })
})

describe('expandRefNode', () => {
  it('looks up referenced component and returns expanded children as frame node', () => {
    const componentFrame: FrameNode = {
      id: 'comp-1',
      type: 'frame',
      name: 'MyButton',
      reusable: true,
      children: [
        { id: 'btn-text', type: 'text', content: 'Click me' } as TextNode,
      ],
    }

    const refNode: RefNode = {
      id: 'ref-1',
      type: 'ref',
      ref: 'comp-1',
    }

    const doc = makeDoc({
      pages: [
        {
          id: 'p1',
          name: 'Components',
          type: 'component',
          children: [componentFrame],
        },
      ],
    })

    const result = expandRefNode(refNode, doc)
    // Should return a frame node with the component's children
    expect(result.type).toBe('frame')
    expect((result as FrameNode).children).toHaveLength(1)
    expect(((result as FrameNode).children![0] as TextNode).content).toBe('Click me')
  })

  it('returns placeholder text node when referenced component not found', () => {
    const refNode: RefNode = {
      id: 'ref-1',
      type: 'ref',
      ref: 'nonexistent',
    }

    const doc = makeDoc()

    const result = expandRefNode(refNode, doc)
    expect(result.type).toBe('text')
    expect((result as TextNode).content).toBe('[Component not found]')
  })

  it('applies argumentValues to expanded component children', () => {
    const componentFrame: FrameNode = {
      id: 'comp-1',
      type: 'frame',
      name: 'TextCard',
      reusable: true,
      arguments: [
        { id: 'arg-title', name: 'Title', type: 'text', defaultValue: 'Default Title' },
      ],
      argumentBindings: {
        'arg-title': [{ targetNodeId: 'card-title', targetProperty: 'content' }],
      },
      children: [
        { id: 'card-title', type: 'text', content: 'Default Title' } as TextNode,
      ],
    }

    const refNode: RefNode = {
      id: 'ref-1',
      type: 'ref',
      ref: 'comp-1',
      argumentValues: { 'arg-title': 'Custom Title' },
    }

    const doc = makeDoc({
      pages: [
        {
          id: 'p1',
          name: 'Components',
          type: 'component',
          children: [componentFrame],
        },
      ],
    })

    const result = expandRefNode(refNode, doc)
    expect(result.type).toBe('frame')
    const children = (result as FrameNode).children!
    expect((children[0] as TextNode).content).toBe('Custom Title')
  })
})
