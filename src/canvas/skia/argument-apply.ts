/**
 * Pure argument-value application utilities.
 * Extracted from skia-engine.ts so they can be unit-tested without canvas deps.
 */
import type { PenNode, FrameNode as FrameNodeType, RefNode as RefNodeType } from '@/types/pen'

export function applyPropertyValue(
  node: PenNode,
  property: string,
  value: string | number | boolean,
): PenNode {
  const updated: Record<string, unknown> = { ...(node as unknown as Record<string, unknown>) }

  if (property === 'content' && node.type === 'text') {
    updated.content = String(value)
  } else if (property === 'visible') {
    updated.visible = Boolean(value)
  } else if (property === 'opacity') {
    updated.opacity = Number(value)
  } else if (property === 'width') {
    updated.width = Number(value)
  } else if (property === 'height') {
    updated.height = Number(value)
  } else if (property === 'fontSize' && node.type === 'text') {
    updated.fontSize = Number(value)
  } else if (property === 'gap') {
    updated.gap = Number(value)
  } else if (property === 'name') {
    updated.name = String(value)
  } else if (property === 'fill.0.color') {
    const nodeFill = (node as unknown as Record<string, unknown>).fill
    const fills = Array.isArray(nodeFill) ? [...(nodeFill as unknown[])] : []
    if (fills.length > 0) {
      fills[0] = { ...(fills[0] as Record<string, unknown>), color: String(value) }
      updated.fill = fills
    }
  } else if (property === 'stroke.fill.0.color') {
    const nodeStroke = (node as unknown as Record<string, unknown>).stroke as Record<string, unknown> | undefined
    if (nodeStroke) {
      const stroke = { ...nodeStroke }
      const strokeFill = stroke.fill as unknown[] | undefined
      if (Array.isArray(strokeFill) && strokeFill.length > 0) {
        const newFill = [...strokeFill]
        newFill[0] = { ...(newFill[0] as Record<string, unknown>), color: String(value) }
        stroke.fill = newFill
        updated.stroke = stroke
      }
    }
  }

  return updated as unknown as PenNode
}

export function applyBindingsToTree(
  nodes: PenNode[],
  applications: Array<{ targetNodeId: string; targetProperty: string; value: string | number | boolean }>,
): PenNode[] {
  return nodes.map((node) => {
    let modified = node
    const nodeApps = applications.filter((a) => a.targetNodeId === node.id)
    if (nodeApps.length > 0) {
      modified = { ...node } as PenNode
      for (const app of nodeApps) {
        modified = applyPropertyValue(modified, app.targetProperty, app.value)
      }
    }
    if ('children' in modified && modified.children) {
      const newChildren = applyBindingsToTree(modified.children, applications)
      if (newChildren !== modified.children) {
        modified = { ...modified, children: newChildren } as PenNode
      }
    }
    return modified
  })
}

export function applyArgumentValues(
  children: PenNode[],
  refNode: PenNode,
  component: PenNode,
): PenNode[] {
  const frameComp = component as FrameNodeType
  const ref = refNode as RefNodeType
  const args = frameComp.arguments
  const bindings = frameComp.argumentBindings
  const values = ref.argumentValues

  if (!args || !bindings || !values) return children

  const applications: Array<{ targetNodeId: string; targetProperty: string; value: string | number | boolean }> = []

  for (const arg of args) {
    const value = values[arg.id] ?? arg.defaultValue
    const argBindings = bindings[arg.id]
    if (!argBindings) continue
    for (const binding of argBindings) {
      applications.push({
        targetNodeId: binding.targetNodeId,
        targetProperty: binding.targetProperty,
        value,
      })
    }
  }

  if (applications.length === 0) return children
  return applyBindingsToTree(children, applications)
}
