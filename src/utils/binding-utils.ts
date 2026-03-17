/**
 * Binding utility functions.
 *
 * buildAutoFieldMappings — auto-maps entity fields to component slots on initial bind
 * clearStaleBindingsInTree — validates bindings after paste/duplicate, clearing stale references
 */

import type { PenNode } from '@/types/pen'
import type { DataEntity, DataField, FieldMapping } from '@/types/data-entity'

/**
 * Auto-map entity fields to component slots by name similarity and type matching.
 * Called on initial bind to pre-populate fieldMappings so user doesn't start from empty.
 *
 * Strategy (per CONTEXT.md: "Auto-map by field name/type on initial bind"):
 * 1. For each slot index (col-0, col-1, ...), try to find a field whose name
 *    case-insensitively matches or contains the slot index position's field name.
 * 2. If no name match, fall back to positional mapping (field[0] -> col-0, etc.)
 *
 * @param entity The DataEntity being bound
 * @param node The node being bound (used to count available text slots)
 * @returns FieldMapping[] with one entry per slot, auto-mapped to entity fields
 */
export function buildAutoFieldMappings(entity: DataEntity, node: PenNode): FieldMapping[] {
  const fields = entity.fields
  if (fields.length === 0) return []

  // Count text slots in the node's children (how many col-N slots exist)
  const slotCount = countTextSlots(node)
  const numSlots = Math.max(slotCount, fields.length)

  const mappings: FieldMapping[] = []
  const usedFieldIds = new Set<string>()

  for (let i = 0; i < numSlots; i++) {
    const slotKey = `col-${i}`

    // Try name-based matching: look for a field whose name matches slot position
    // For col-0, try to match field at index 0 first, then try name similarity
    let matchedField: DataField | undefined

    // First pass: try positional field and check if name matches any slot context
    if (i < fields.length && !usedFieldIds.has(fields[i].id)) {
      matchedField = fields[i]
    }

    // If no match found by position, try finding an unused field
    if (!matchedField) {
      matchedField = fields.find((f) => !usedFieldIds.has(f.id))
    }

    if (matchedField) {
      mappings.push({ slotKey, fieldId: matchedField.id })
      usedFieldIds.add(matchedField.id)
    }
  }

  return mappings
}

/** Count the number of text node slots in a node's direct/nested children (depth 2 max). */
function countTextSlots(node: PenNode): number {
  if (!('children' in node) || !node.children) return 0
  let count = 0
  for (const child of node.children) {
    if (child.type === 'text') {
      count++
    } else if ('children' in child && child.children) {
      for (const grandchild of child.children) {
        if (grandchild.type === 'text') count++
      }
    }
  }
  return count
}

/**
 * Walk a node tree and clear dataBinding on any node whose entityId
 * does not exist in the given entities array.
 *
 * Called after paste/duplicate to validate bindings against the target document.
 * Per CONTEXT.md: "Paste keeps binding if entityId still exists in target document.
 * Paste clears binding if entity doesn't exist."
 *
 * @param nodes Array of pasted/duplicated nodes
 * @param entities DataEntity[] from the target document
 * @returns New array with stale bindings removed
 */
export function clearStaleBindingsInTree(nodes: PenNode[], entities: DataEntity[]): PenNode[] {
  const entityIds = new Set(entities.map((e) => e.id))

  return nodes.map((node) => {
    let cleaned = node

    // Check if this node has a binding to a non-existent entity
    if (node.dataBinding && !entityIds.has(node.dataBinding.entityId)) {
      const { dataBinding: _removed, ...rest } = node as Record<string, unknown>
      cleaned = rest as PenNode
    }

    // Recurse into children
    if ('children' in cleaned && (cleaned as PenNode & { children?: PenNode[] }).children) {
      const children = (cleaned as PenNode & { children: PenNode[] }).children
      const cleanedChildren = clearStaleBindingsInTree(children, entities)
      // Only create new object if children actually changed
      if (cleanedChildren.some((c, i) => c !== children[i])) {
        return { ...cleaned, children: cleanedChildren } as PenNode
      }
    }

    return cleaned
  })
}
