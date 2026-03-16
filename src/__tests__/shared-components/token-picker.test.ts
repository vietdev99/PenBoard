import { describe, it, expect } from 'vitest'
import type { PenNode } from '@/types/pen'
import type { VariableDefinition } from '@/types/variables'
import { resolveNodeForCanvas, resolveVariableRef } from '@/variables/resolve-variables'

type Vars = Record<string, VariableDefinition>

function makeTextNode(overrides: Record<string, unknown> = {}): PenNode {
  return {
    id: 'text-1',
    type: 'text',
    name: 'Label',
    content: 'Hello',
    x: 0, y: 0,
    width: 100, height: 30,
    fontSize: 14,
    ...overrides,
  } as unknown as PenNode
}

function makeRectNode(overrides: Record<string, unknown> = {}): PenNode {
  return {
    id: 'rect-1',
    type: 'rectangle',
    name: 'Box',
    x: 0, y: 0,
    width: 100, height: 50,
    fill: [{ type: 'solid', color: '#FF0000' }],
    ...overrides,
  } as unknown as PenNode
}

describe('resolveVariableRef', () => {
  it('resolves a string $ref to its value', () => {
    const vars: Vars = { 'color-1': { type: 'color', value: '#AABBCC' } }
    expect(resolveVariableRef('$color-1', vars)).toBe('#AABBCC')
  })

  it('resolves a number $ref to its value', () => {
    const vars: Vars = { 'spacing-md': { type: 'number', value: 16 } }
    expect(resolveVariableRef('$spacing-md', vars)).toBe(16)
  })

  it('returns undefined for missing variable ref', () => {
    const vars: Vars = {}
    expect(resolveVariableRef('$nonexistent', vars)).toBeUndefined()
  })

  it('returns undefined for circular reference (value starts with $)', () => {
    const vars: Vars = {
      'a': { type: 'color', value: '$b' },
      'b': { type: 'color', value: '$a' },
    }
    expect(resolveVariableRef('$a', vars)).toBeUndefined()
  })

  it('resolves themed value with matching active theme', () => {
    const vars: Vars = {
      'color-1': {
        type: 'color',
        value: [
          { value: '#FFFFFF', theme: { 'Theme-1': 'Default' } },
          { value: '#000000', theme: { 'Theme-1': 'Dark' } },
        ] as any,
      },
    }
    const result = resolveVariableRef('$color-1', vars, { 'Theme-1': 'Dark' })
    expect(result).toBe('#000000')
  })

  it('resolves themed value with default (first) when no theme match', () => {
    const vars: Vars = {
      'color-1': {
        type: 'color',
        value: [
          { value: '#FFFFFF', theme: { 'Theme-1': 'Default' } },
          { value: '#000000', theme: { 'Theme-1': 'Dark' } },
        ] as any,
      },
    }
    const result = resolveVariableRef('$color-1', vars, { 'Theme-1': 'Light' })
    expect(result).toBe('#FFFFFF')
  })
})

describe('resolveNodeForCanvas', () => {
  it('returns same reference when no variables', () => {
    const node = makeRectNode()
    const result = resolveNodeForCanvas(node, {})
    expect(result).toBe(node)
  })

  it('resolves $ref on width field to number value', () => {
    const vars: Vars = { 'btn-width': { type: 'number', value: 200 } }
    const node = makeRectNode({ width: '$btn-width' })
    const result = resolveNodeForCanvas(node, vars) as any
    expect(result.width).toBe(200)
  })

  it('resolves $ref on fontSize for text nodes', () => {
    const vars: Vars = { 'font-size-lg': { type: 'number', value: 24 } }
    const node = makeTextNode({ fontSize: '$font-size-lg' })
    const result = resolveNodeForCanvas(node, vars) as any
    expect(result.fontSize).toBe(24)
  })

  it('resolves $ref fill color in solid fill', () => {
    const vars: Vars = { 'brand-color': { type: 'color', value: '#0055FF' } }
    const node = makeRectNode({ fill: [{ type: 'solid', color: '$brand-color' }] })
    const result = resolveNodeForCanvas(node, vars) as any
    expect(result.fill[0].color).toBe('#0055FF')
  })

  it('resolves $ref on opacity field', () => {
    const vars: Vars = { 'opacity-dim': { type: 'number', value: 0.5 } }
    const node = makeRectNode({ opacity: '$opacity-dim' })
    const result = resolveNodeForCanvas(node, vars) as any
    expect(result.opacity).toBe(0.5)
  })

  it('preserves non-ref fields unchanged', () => {
    const vars: Vars = { 'btn-width': { type: 'number', value: 200 } }
    const node = makeRectNode({ width: '$btn-width', height: 50 })
    const result = resolveNodeForCanvas(node, vars) as any
    expect(result.height).toBe(50)
    expect(result.id).toBe('rect-1')
    expect(result.type).toBe('rectangle')
  })

  it('returns same reference when no $refs found and no fill', () => {
    const vars: Vars = { 'btn-width': { type: 'number', value: 200 } }
    // Node without fills - no $refs in any resolved field
    const node = { id: 'frame-1', type: 'frame', name: 'F', x: 0, y: 0, width: 100, height: 50 } as unknown as PenNode
    const result = resolveNodeForCanvas(node, vars)
    expect(result).toBe(node)
  })

  it('returns new object when $ref is resolved (does not mutate)', () => {
    const vars: Vars = { 'btn-width': { type: 'number', value: 200 } }
    const node = makeRectNode({ width: '$btn-width' })
    const result = resolveNodeForCanvas(node, vars)
    expect(result).not.toBe(node)
    expect((node as any).width).toBe('$btn-width') // original unchanged
  })

  it('gracefully handles missing variable ref (keeps $ref string, not resolving)', () => {
    const vars: Vars = {}
    const node = makeRectNode({ width: '$nonexistent' })
    const result = resolveNodeForCanvas(node, vars) as any
    // width should not be resolved (no match), stays as-is or unchanged
    expect(result.width).toBe('$nonexistent')
  })
})
