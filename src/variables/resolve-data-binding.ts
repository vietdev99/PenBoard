/**
 * Data binding resolution utilities.
 *
 * Resolves DataBinding configuration on PenNodes against the document's
 * DataEntity array, injecting sample row values into child text nodes
 * for canvas preview rendering.
 *
 * Design constraints:
 * - PURE FUNCTION: never calls set(), never imports stores
 * - Returns the same object reference when no binding or entity missing
 * - Called in skia-engine.ts syncFromDocument BEFORE variable resolution
 *   (per CONTEXT.md: "after argument apply, before variable resolution")
 */

import type { PenNode, TextNode } from '@/types/pen'
import type { DataEntity, DataField, FieldMapping } from '@/types/data-entity'

/** Roles that support data binding in v1.1 */
export const BINDABLE_ROLES = ['table', 'table-row', 'list', 'dropdown', 'select'] as const

/**
 * Resolves a node's DataBinding against the entities array, returning
 * a new node with child text content replaced by sample entity row data.
 *
 * All entity rows are shown (no row count limit -- per user decision).
 *
 * Returns the same node reference when:
 * - node.dataBinding is undefined
 * - the referenced entity does not exist in entities
 * - the entity has no rows
 */
export function resolveDataBinding(node: PenNode, entities: DataEntity[]): PenNode {
  if (!node.dataBinding) return node

  const { entityId, fieldMappings } = node.dataBinding
  const entity = entities.find((e) => e.id === entityId)
  if (!entity || entity.rows.length === 0) return node

  // Show ALL entity rows (no limit -- per user decision)
  const maxRows = entity.rows.length

  // For table-row and list-item roles: inject row values into child text nodes
  if (
    node.role === 'table' ||
    node.role === 'table-row' ||
    node.role === 'list' ||
    node.role === 'dropdown' ||
    node.role === 'select'
  ) {
    return resolveNodeWithRows(node, entity, fieldMappings, maxRows)
  }

  return node
}

/** Inject entity row data into the text children of a bound node. */
function resolveNodeWithRows(
  node: PenNode,
  entity: DataEntity,
  fieldMappings: FieldMapping[],
  maxRows: number,
): PenNode {
  if (!('children' in node) || !node.children || node.children.length === 0) return node

  // For 'table' role: treat direct children as row templates.
  // Replace text content in each child row template using the corresponding entity row.
  const newChildren = node.children.map((child, rowIndex) => {
    if (rowIndex >= maxRows) return child
    const row = entity.rows[rowIndex]
    if (!row) return child
    return injectRowIntoNode(child, row.values, entity.fields, fieldMappings)
  })

  // Check if anything changed (avoid unnecessary new object)
  const changed = newChildren.some((c, i) => c !== node.children![i])
  if (!changed) return node

  return { ...node, children: newChildren } as PenNode
}

/** Recursively inject row values into text nodes within a single row template node. */
function injectRowIntoNode(
  node: PenNode,
  rowValues: Record<string, string | number | boolean | null>,
  fields: DataField[],
  fieldMappings: FieldMapping[],
  slotIndex = { current: 0 },
): PenNode {
  if (node.type === 'text') {
    const textNode = node as TextNode
    // Find value: first check fieldMappings by slotKey matching field position,
    // then fall back to positional match (field[slotIndex] -> text node)
    let resolvedValue: string | undefined

    // Try explicit mapping by slotKey (format: 'col-N' where N = slotIndex.current)
    const slotKey = `col-${slotIndex.current}`
    const mapping = fieldMappings.find((m) => m.slotKey === slotKey)
    const fieldId = mapping?.fieldId ?? fields[slotIndex.current]?.id

    if (fieldId) {
      const raw = rowValues[fieldId]
      resolvedValue = raw != null ? String(raw) : undefined
    }

    slotIndex.current += 1

    if (resolvedValue !== undefined && resolvedValue !== textNode.content) {
      return { ...textNode, content: resolvedValue } as PenNode
    }
    return node
  }

  // Recurse into children
  if ('children' in node && node.children && node.children.length > 0) {
    const newChildren = node.children.map((child) =>
      injectRowIntoNode(child, rowValues, fields, fieldMappings, slotIndex),
    )
    const changed = newChildren.some((c, i) => c !== node.children![i])
    if (!changed) return node
    return { ...node, children: newChildren } as PenNode
  }

  return node
}
