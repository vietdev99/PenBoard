// --- Data Binding Resolver ---
// Stub: will be implemented in Plan 05-02.
// Resolves a data-bound node by injecting sample rows from its bound entity.

import type { PenNode } from '@/types/pen'
import type { DataEntity } from '@/types/data-entity'

/**
 * Resolves data binding on a node: clones the node and populates
 * children with sample rows from the bound entity.
 *
 * Returns the original node unchanged if no binding or entity not found.
 *
 * @stub — returns node unchanged until Plan 02 implements resolution logic.
 */
export function resolveDataBinding(
  _node: PenNode,
  _entities: DataEntity[],
): PenNode {
  // TODO: implement in Plan 05-02
  return _node
}
