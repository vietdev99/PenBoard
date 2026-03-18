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
 * - RECURSIVE: walks the full tree so nested bound nodes are resolved
 *
 * Table binding rebuilds the full structure:
 * - Header text → entity field names, trimmed to field count
 * - Data rows → one per entity row, extra template rows removed
 * - Columns → trimmed to entity field count
 * - If entity has more rows than template, the first template row is cloned
 */

import type { PenNode, TextNode } from '@/types/pen'
import type { DataEntity, DataField, FieldMapping } from '@/types/data-entity'

/** Roles that support data binding in v1.1 */
export const BINDABLE_ROLES = ['table', 'table-row', 'list', 'dropdown', 'select'] as const

/**
 * Resolves a node's DataBinding against the entities array, returning
 * a new node with child text content replaced by sample entity row data.
 *
 * Recursively walks children so nested bound nodes (e.g. Table inside a Frame)
 * are also resolved.
 *
 * All entity rows are shown (no row count limit -- per user decision).
 *
 * Returns the same node reference when:
 * - node.dataBinding is undefined AND no children have bindings
 * - the referenced entity does not exist in entities
 * - the entity has no rows
 */
export function resolveDataBinding(node: PenNode, entities: DataEntity[]): PenNode {
  // If this node has a binding, resolve it directly
  if (node.dataBinding) {
    const { entityId, fieldMappings } = node.dataBinding
    const entity = entities.find((e) => e.id === entityId)
    if (!entity || entity.rows.length === 0) return node

    if (node.role === 'table') {
      return resolveTableBinding(node, entity, fieldMappings)
    }

    const maxRows = entity.rows.length
    if (
      node.role === 'table-row' ||
      node.role === 'list' ||
      node.role === 'dropdown' ||
      node.role === 'select'
    ) {
      return resolveNodeWithRows(node, entity, fieldMappings, maxRows)
    }
    return node
  }

  // No binding on this node — recurse into children to find nested bound nodes
  if ('children' in node && node.children && node.children.length > 0) {
    const newChildren = node.children.map((child) => resolveDataBinding(child, entities))
    const changed = newChildren.some((c, i) => c !== node.children![i])
    if (changed) return { ...node, children: newChildren } as PenNode
  }

  return node
}

// ---------- Table binding (full structure rebuild) ----------

/**
 * Rebuilds a table node's children to match the bound entity:
 * - Updates header text with entity field names
 * - Creates one data row per entity row (cloning template if needed)
 * - Trims columns to match entity field count
 * - Removes extra template rows
 */
function resolveTableBinding(
  node: PenNode,
  entity: DataEntity,
  fieldMappings: FieldMapping[],
): PenNode {
  if (!('children' in node) || !node.children || node.children.length === 0) return node

  // Determine which field indices are active (checked) via fieldMappings.
  // null means "show all" (backward compat when no mappings exist).
  const activeIndices: Set<number> | null = fieldMappings.length > 0
    ? new Set(fieldMappings.map((m) => parseInt(m.slotKey.replace('col-', ''), 10)))
    : null
  const fieldCount = activeIndices ? activeIndices.size : entity.fields.length
  if (fieldCount === 0) return node

  // Categorize children into header, separators, and data rows
  let headerRow: PenNode | undefined
  const separators: PenNode[] = []
  const dataRows: PenNode[] = []

  for (const child of node.children) {
    if (child.role === 'table-row') {
      dataRows.push(child)
    } else if (
      !headerRow &&
      child.type === 'frame' &&
      'children' in child &&
      child.children?.some((gc) => gc.type === 'text')
    ) {
      headerRow = child
    } else {
      separators.push(child)
    }
  }

  if (dataRows.length === 0) return node

  const newChildren: PenNode[] = []

  // 1. Header row: rename columns to entity field names, keep only active columns
  if (headerRow) {
    newChildren.push(rebuildColumns(headerRow, entity.fields, fieldCount, true, activeIndices))
  }

  // 2. One data row per entity row
  for (let i = 0; i < entity.rows.length; i++) {
    // Add separator before each data row
    if (i < separators.length) {
      newChildren.push(separators[i])
    } else if (separators.length > 0) {
      // Clone first separator for extra rows
      const sep = separators[0]
      newChildren.push({ ...sep, id: `${sep.id}__dr${i}` } as PenNode)
    }

    // Get existing template row or clone the first one
    const baseRow = i < dataRows.length ? dataRows[i] : cloneRow(dataRows[0], i)

    // Inject entity row data into text nodes (all fields positionally)
    const row = entity.rows[i]
    const injected = injectRowIntoNode(baseRow, row.values, entity.fields, fieldMappings)

    // Keep only active columns
    newChildren.push(rebuildColumns(injected, entity.fields, fieldCount, false, activeIndices))
  }

  return { ...node, children: newChildren } as PenNode
}

/**
 * Rebuild a row's text columns:
 * - If isHeader: replace text content with entity field names
 * - Keep only text children at active field indices (or first N if no filter)
 *
 * @param activeIndices - Set of field indices to keep (null = keep first fieldCount)
 */
function rebuildColumns(
  row: PenNode,
  fields: DataField[],
  fieldCount: number,
  isHeader: boolean,
  activeIndices: Set<number> | null,
): PenNode {
  if (!('children' in row) || !row.children) return row

  let textIdx = 0
  const newChildren: PenNode[] = []

  for (const child of row.children) {
    if (child.type === 'text') {
      const shouldKeep = activeIndices ? activeIndices.has(textIdx) : textIdx < fieldCount
      if (shouldKeep) {
        if (isHeader && fields[textIdx]) {
          // Replace header text with entity field name
          newChildren.push({ ...child, content: fields[textIdx].name } as PenNode)
        } else {
          newChildren.push(child)
        }
      }
      textIdx++
    } else {
      newChildren.push(child)
    }
  }

  const changed =
    newChildren.length !== row.children.length ||
    newChildren.some((c, i) => c !== row.children![i])
  if (!changed) return row

  return { ...row, children: newChildren } as PenNode
}

/** Clone a template row with suffixed IDs for additional entity rows. */
function cloneRow(templateRow: PenNode, rowIndex: number): PenNode {
  const suffix = `__dr${rowIndex}`
  const result: Record<string, unknown> = { ...templateRow, id: templateRow.id + suffix }
  if ('children' in result && Array.isArray(result.children)) {
    result.children = (result.children as PenNode[]).map((c) => ({
      ...c,
      id: c.id + suffix,
    }))
  }
  return result as PenNode
}

// ---------- Non-table roles (list, dropdown, select, table-row) ----------

/** Inject entity row data into the text children of a bound node. */
function resolveNodeWithRows(
  node: PenNode,
  entity: DataEntity,
  fieldMappings: FieldMapping[],
  maxRows: number,
): PenNode {
  if (!('children' in node) || !node.children || node.children.length === 0) return node

  const newChildren = node.children.map((child, rowIndex) => {
    if (rowIndex >= maxRows) return child
    const row = entity.rows[rowIndex]
    if (!row) return child
    return injectRowIntoNode(child, row.values, entity.fields, fieldMappings)
  })

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
