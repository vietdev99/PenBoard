import { describe, it, expect } from 'vitest'
import type { PenNode } from '@/types/pen'
import { applyPropertyValue, applyArgumentValues } from '@/canvas/skia/argument-apply'

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

describe('applyPropertyValue', () => {
  it('sets content on a text node', () => {
    const node = makeTextNode()
    const result = applyPropertyValue(node, 'content', 'World') as any
    expect(result.content).toBe('World')
  })

  it('does not set content on a non-text node', () => {
    const node = makeRectNode()
    const result = applyPropertyValue(node, 'content', 'World') as any
    expect(result.content).toBeUndefined()
  })

  it('sets visible to boolean', () => {
    const node = makeRectNode()
    const result = applyPropertyValue(node, 'visible', false) as any
    expect(result.visible).toBe(false)
    const result2 = applyPropertyValue(node, 'visible', true) as any
    expect(result2.visible).toBe(true)
  })

  it('sets opacity as a number', () => {
    const node = makeRectNode()
    const result = applyPropertyValue(node, 'opacity', 0.5) as any
    expect(result.opacity).toBe(0.5)
  })

  it('sets width and height', () => {
    const node = makeRectNode()
    const r1 = applyPropertyValue(node, 'width', 200) as any
    expect(r1.width).toBe(200)
    const r2 = applyPropertyValue(node, 'height', 80) as any
    expect(r2.height).toBe(80)
  })

  it('sets fontSize on a text node', () => {
    const node = makeTextNode()
    const result = applyPropertyValue(node, 'fontSize', 24) as any
    expect(result.fontSize).toBe(24)
  })

  it('does not set fontSize on a non-text node', () => {
    const node = makeRectNode()
    const result = applyPropertyValue(node, 'fontSize', 24) as any
    expect(result.fontSize).toBeUndefined()
  })

  it('sets fill.0.color when fill array exists', () => {
    const node = makeRectNode({ fill: [{ type: 'solid', color: '#FF0000' }] })
    const result = applyPropertyValue(node, 'fill.0.color', '#00FF00') as any
    expect(result.fill[0].color).toBe('#00FF00')
    expect(result.fill[0].type).toBe('solid') // other fields preserved
  })

  it('does not set fill.0.color when fill array is empty', () => {
    const node = makeRectNode({ fill: [] })
    const result = applyPropertyValue(node, 'fill.0.color', '#00FF00') as any
    expect(result.fill).toHaveLength(0)
  })

  it('ignores unknown properties gracefully (no throw, original fields preserved)', () => {
    const node = makeTextNode({ content: 'Original' })
    const result = applyPropertyValue(node, 'nonExistentProp', 'value') as any
    expect(result.content).toBe('Original')
    expect(result.id).toBe('text-1')
  })

  it('returns a new object (does not mutate original)', () => {
    const node = makeTextNode()
    const result = applyPropertyValue(node, 'content', 'New')
    expect(result).not.toBe(node)
    expect((node as any).content).toBe('Hello') // original unchanged
  })
})

describe('applyArgumentValues', () => {
  const makeComponent = (args: any[], bindings: Record<string, any[]>): PenNode => ({
    id: 'comp-1',
    type: 'frame',
    name: 'Component',
    x: 0, y: 0,
    width: 200, height: 100,
    children: [],
    arguments: args,
    argumentBindings: bindings,
  } as unknown as PenNode)

  const makeRef = (argumentValues: Record<string, any>): PenNode => ({
    id: 'ref-1',
    type: 'ref',
    name: 'Instance',
    ref: 'comp-1',
    x: 0, y: 0,
    argumentValues,
  } as unknown as PenNode)

  it('returns original children when no args/bindings/values', () => {
    const component = makeComponent([], {})
    const ref = makeRef({})
    const children = [makeTextNode()]
    const result = applyArgumentValues(children, ref, component)
    expect(result).toBe(children)
  })

  it('applies argument value to bound child node property', () => {
    const arg = { id: 'arg-1', name: 'label', type: 'text', defaultValue: 'Default' }
    const component = makeComponent([arg], { 'arg-1': [{ targetNodeId: 'text-1', targetProperty: 'content' }] })
    const ref = makeRef({ 'arg-1': 'Resolved Label' })
    const children = [makeTextNode()]
    const result = applyArgumentValues(children, ref, component)
    expect((result[0] as any).content).toBe('Resolved Label')
  })

  it('uses defaultValue when argumentValues does not include arg id', () => {
    const arg = { id: 'arg-1', name: 'label', type: 'text', defaultValue: 'Default Text' }
    const component = makeComponent([arg], { 'arg-1': [{ targetNodeId: 'text-1', targetProperty: 'content' }] })
    const ref = makeRef({}) // no value for arg-1
    const children = [makeTextNode()]
    const result = applyArgumentValues(children, ref, component)
    expect((result[0] as any).content).toBe('Default Text')
  })

  it('applies multiple argument bindings to different properties', () => {
    const arg1 = { id: 'arg-1', name: 'label', type: 'text', defaultValue: 'Default' }
    const arg2 = { id: 'arg-2', name: 'opacity', type: 'number', defaultValue: 1 }
    const component = makeComponent(
      [arg1, arg2],
      {
        'arg-1': [{ targetNodeId: 'text-1', targetProperty: 'content' }],
        'arg-2': [{ targetNodeId: 'text-1', targetProperty: 'opacity' }],
      }
    )
    const ref = makeRef({ 'arg-1': 'Hello', 'arg-2': 0.5 })
    const children = [makeTextNode()]
    const result = applyArgumentValues(children, ref, component)
    expect((result[0] as any).content).toBe('Hello')
    expect((result[0] as any).opacity).toBe(0.5)
  })

  it('returns same reference when no applications needed (no bindings matching)', () => {
    const arg = { id: 'arg-1', name: 'label', type: 'text', defaultValue: 'x' }
    const component = makeComponent([arg], {}) // no bindings
    const ref = makeRef({ 'arg-1': 'value' })
    const children = [makeTextNode()]
    const result = applyArgumentValues(children, ref, component)
    expect(result).toBe(children)
  })

  it('returns same reference when args/bindings/values are all undefined', () => {
    const component = { id: 'comp', type: 'frame', name: 'C', x: 0, y: 0, width: 100, height: 100, children: [] } as unknown as PenNode
    const ref = makeRef({})
    const children = [makeTextNode()]
    const result = applyArgumentValues(children, ref, component)
    expect(result).toBe(children)
  })
})
