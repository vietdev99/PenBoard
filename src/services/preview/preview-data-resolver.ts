/**
 * Pre-generation data resolution pipeline for preview HTML generation.
 *
 * Transforms a PenNode tree into fully resolved nodes by:
 * 1. Expanding RefNodes into actual component content
 * 2. Resolving data bindings against entity sample data
 * 3. Resolving $variable references to concrete values
 *
 * The pipeline runs in this order to ensure data bindings are resolved
 * before variable references (matching canvas rendering order).
 */

import type { PenDocument, PenNode, RefNode, FrameNode, TextNode } from '@/types/pen'
import type { DataEntity } from '@/types/data-entity'
import { resolveDataBinding } from '@/variables/resolve-data-binding'
import { resolveNodeForCanvas, getDefaultTheme } from '@/variables/resolve-variables'
import { applyArgumentValues } from '@/canvas/skia/argument-apply'

/**
 * Expand a RefNode into its actual component content.
 *
 * Searches all pages and top-level children for a reusable FrameNode matching
 * the ref ID. If found, deep-clones its children and applies argumentValues.
 * If not found, returns a placeholder text node.
 */
export function expandRefNode(refNode: RefNode, doc: PenDocument): PenNode {
  // Search for the referenced component across all pages and top-level children
  const component = findReusableComponent(refNode.ref, doc)

  if (!component) {
    return {
      id: refNode.id,
      type: 'text',
      content: '[Component not found]',
    } as TextNode
  }

  // Deep clone the component's children
  let children = deepCloneNodes(component.children ?? [])

  // Apply argument values if present
  if (refNode.argumentValues && Object.keys(refNode.argumentValues).length > 0) {
    children = applyArgumentValues(children, refNode, component)
  }

  // Return a synthetic FrameNode with the ref's layout props + resolved children
  const result: FrameNode = {
    id: refNode.id,
    type: 'frame',
    name: refNode.name ?? component.name,
    x: refNode.x,
    y: refNode.y,
    opacity: refNode.opacity,
    visible: refNode.visible,
    // Inherit layout props from the component
    width: component.width,
    height: component.height,
    layout: component.layout,
    gap: component.gap,
    padding: component.padding,
    justifyContent: component.justifyContent,
    alignItems: component.alignItems,
    clipContent: component.clipContent,
    fill: component.fill,
    stroke: component.stroke,
    effects: component.effects,
    cornerRadius: component.cornerRadius,
    children,
  }

  return result
}

/**
 * Resolve a page's children through the full preview pipeline:
 * 1. Expand RefNodes
 * 2. Resolve data bindings
 * 3. Resolve $variable references
 * 4. Recurse into children
 */
export function resolvePageForPreview(
  children: PenNode[],
  doc: PenDocument,
): PenNode[] {
  const defaultTheme = getDefaultTheme(doc.themes)
  const variables = doc.variables ?? {}
  const entities = doc.dataEntities ?? []

  return children.map((node) => resolveNode(node, doc, variables, defaultTheme, entities))
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function resolveNode(
  node: PenNode,
  doc: PenDocument,
  variables: Record<string, import('@/types/variables').VariableDefinition>,
  defaultTheme: Record<string, string>,
  entities: import('@/types/data-entity').DataEntity[],
): PenNode {
  let resolved = node

  // Step 1: Expand RefNodes
  if (resolved.type === 'ref') {
    resolved = expandRefNode(resolved as RefNode, doc)
  }

  // Step 2: Resolve data bindings
  resolved = resolveDataBinding(resolved, entities)

  // Step 2b: Expand dropdown/select options from entity rows for preview
  // (resolveDataBinding only maps 1:1 children; dropdowns need all rows as options)
  if (
    (resolved.role === 'dropdown' || resolved.role === 'select') &&
    resolved.dataBinding
  ) {
    resolved = expandDropdownOptions(resolved, entities)
  }

  // Step 3: Resolve $variable references
  resolved = resolveNodeForCanvas(resolved, variables, defaultTheme)

  // Step 4: Recurse into children
  if ('children' in resolved && resolved.children && resolved.children.length > 0) {
    const newChildren = resolved.children.map((child) =>
      resolveNode(child, doc, variables, defaultTheme, entities),
    )
    const changed = newChildren.some((c, i) => c !== resolved.children![i])
    if (changed) {
      resolved = { ...resolved, children: newChildren } as PenNode
    }
  }

  return resolved
}

/**
 * Expand dropdown/select children to contain one text node per entity row.
 * The first mapped field (or first entity field) provides option text.
 */
function expandDropdownOptions(node: PenNode, entities: DataEntity[]): PenNode {
  const binding = node.dataBinding
  if (!binding) return node

  const entity = entities.find((e) => e.id === binding.entityId)
  if (!entity || entity.rows.length === 0) return node

  // Determine which field provides option values
  const fieldId =
    binding.fieldMappings[0]?.fieldId ?? entity.fields[0]?.id
  if (!fieldId) return node

  // Create text children for each entity row
  const optionChildren: PenNode[] = entity.rows.map((row, i) => {
    const value = row.values[fieldId]
    return {
      id: `${node.id}__opt${i}`,
      type: 'text' as const,
      content: value != null ? String(value) : '',
    } as TextNode
  })

  return { ...node, children: optionChildren } as PenNode
}

/** Find a reusable component by ID across all pages and top-level children. */
function findReusableComponent(
  refId: string,
  doc: PenDocument,
): FrameNode | undefined {
  // Search in pages
  if (doc.pages) {
    for (const page of doc.pages) {
      const found = findInNodes(refId, page.children)
      if (found) return found
    }
  }

  // Search in top-level children
  return findInNodes(refId, doc.children)
}

/** Recursively search for a reusable FrameNode by ID. */
function findInNodes(
  refId: string,
  nodes: PenNode[],
): FrameNode | undefined {
  for (const node of nodes) {
    if (
      node.id === refId &&
      node.type === 'frame' &&
      (node as FrameNode).reusable
    ) {
      return node as FrameNode
    }
    if ('children' in node && node.children) {
      const found = findInNodes(refId, node.children)
      if (found) return found
    }
  }
  return undefined
}

/** Deep clone an array of PenNodes. */
function deepCloneNodes(nodes: PenNode[]): PenNode[] {
  return nodes.map((node) => {
    const cloned = { ...node } as PenNode
    if ('children' in cloned && cloned.children) {
      (cloned as FrameNode).children = deepCloneNodes(cloned.children)
    }
    return cloned
  })
}
