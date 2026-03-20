// ---------------------------------------------------------------------------
// MCP Tool: manage_entities
// Full CRUD for data entities, fields, rows, and views.
// Entity removal cascades: cleans dangling data bindings and relation fields.
// ---------------------------------------------------------------------------

import { openDocument, saveDocument, resolveDocPath } from '../document-manager'
import { generateId } from '../utils/id'
import type { PenNode } from '../../types/pen'
import type {
  DataEntity,
  DataField,
  DataRow,
  DataView,
} from '../../types/data-entity'

// ---------------------------------------------------------------------------
// Cascade helper — clears dataBinding from nodes referencing a removed entity
// (Re-implemented from document-store-data.ts which is a Zustand store action)
// ---------------------------------------------------------------------------

function clearDataBindingInTree(nodes: PenNode[], entityId: string): PenNode[] {
  return nodes.map((node) => {
    let cleaned = node
    if (node.dataBinding?.entityId === entityId) {
      const { dataBinding: _removed, ...rest } = node as unknown as Record<string, unknown>
      cleaned = rest as unknown as PenNode
    }
    if ('children' in cleaned && (cleaned as PenNode & { children?: PenNode[] }).children) {
      const newChildren = clearDataBindingInTree(
        (cleaned as PenNode & { children: PenNode[] }).children,
        entityId,
      )
      return { ...cleaned, children: newChildren } as PenNode
    }
    return cleaned
  })
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export interface ManageEntitiesParams {
  filePath?: string
  action: string
  entityId?: string
  name?: string
  fieldId?: string
  field?: Partial<DataField> & { name?: string; type?: DataField['type'] }
  fieldUpdates?: Partial<DataField>
  rowId?: string
  fieldValues?: Record<string, string | number | boolean | null>
  viewId?: string
  viewName?: string
  viewUpdates?: Partial<DataView>
}

export async function handleManageEntities(
  params: ManageEntitiesParams,
): Promise<Record<string, unknown>> {
  const filePath = resolveDocPath(params.filePath)
  let doc = await openDocument(filePath)
  doc = structuredClone(doc)

  // Ensure dataEntities array
  if (!doc.dataEntities) doc.dataEntities = []

  /** Find entity or throw */
  function getEntity(entityId?: string): DataEntity {
    if (!entityId) throw new Error('entityId is required')
    const entity = doc.dataEntities!.find((e) => e.id === entityId)
    if (!entity) throw new Error(`Entity not found: ${entityId}`)
    return entity
  }

  switch (params.action) {
    // ----- Entity CRUD -----

    case 'add_entity': {
      const id = generateId()
      const newEntity: DataEntity = {
        id,
        name: params.name ?? 'Entity',
        fields: [],
        rows: [],
        views: [],
      }
      doc.dataEntities!.push(newEntity)
      await saveDocument(filePath, doc)
      return { entityId: id, entityCount: doc.dataEntities!.length }
    }

    case 'update_entity': {
      const entity = getEntity(params.entityId)
      if (params.name !== undefined) entity.name = params.name
      await saveDocument(filePath, doc)
      return { ok: true }
    }

    case 'remove_entity': {
      const entityId = params.entityId
      if (!entityId) throw new Error('entityId is required')
      const idx = doc.dataEntities!.findIndex((e) => e.id === entityId)
      if (idx === -1) throw new Error(`Entity not found: ${entityId}`)

      // 1. Remove the entity
      doc.dataEntities!.splice(idx, 1)

      // 2. Clean relation fields in other entities
      for (const entity of doc.dataEntities!) {
        entity.fields = entity.fields.filter((f) => f.relatedEntityId !== entityId)
      }

      // 3. Cascade: clear dangling data bindings in ALL node trees
      if (doc.pages) {
        for (const page of doc.pages) {
          page.children = clearDataBindingInTree(page.children, entityId)
        }
      }
      doc.children = clearDataBindingInTree(doc.children, entityId)

      await saveDocument(filePath, doc)
      return { ok: true, remainingEntities: doc.dataEntities!.length }
    }

    // ----- Field CRUD -----

    case 'add_field': {
      const entity = getEntity(params.entityId)
      if (!params.field) throw new Error('field object is required for add_field')
      if (!params.field.name) throw new Error('field.name is required')
      if (!params.field.type) throw new Error('field.type is required')

      const id = generateId()
      const newField: DataField = {
        id,
        name: params.field.name,
        type: params.field.type,
        ...params.field,
      }
      // Ensure id is the generated one (not from params.field)
      newField.id = id
      entity.fields.push(newField)
      await saveDocument(filePath, doc)
      return { fieldId: id, fieldCount: entity.fields.length }
    }

    case 'update_field': {
      const entity = getEntity(params.entityId)
      if (!params.fieldId) throw new Error('fieldId is required for update_field')
      const field = entity.fields.find((f) => f.id === params.fieldId)
      if (!field) throw new Error(`Field not found: ${params.fieldId}`)

      if (params.fieldUpdates) {
        Object.assign(field, params.fieldUpdates)
        field.id = params.fieldId // Protect ID
      }
      await saveDocument(filePath, doc)
      return { ok: true }
    }

    case 'remove_field': {
      const entity = getEntity(params.entityId)
      if (!params.fieldId) throw new Error('fieldId is required for remove_field')

      entity.fields = entity.fields.filter((f) => f.id !== params.fieldId)
      // Clean row values
      for (const row of entity.rows) {
        delete row.values[params.fieldId]
      }
      await saveDocument(filePath, doc)
      return { ok: true }
    }

    // ----- Row CRUD -----

    case 'add_row': {
      const entity = getEntity(params.entityId)
      const id = generateId()
      const newRow: DataRow = {
        id,
        values: params.fieldValues ?? {},
      }
      entity.rows.push(newRow)
      await saveDocument(filePath, doc)
      return { rowId: id, rowCount: entity.rows.length }
    }

    case 'update_row': {
      const entity = getEntity(params.entityId)
      if (!params.rowId) throw new Error('rowId is required for update_row')
      const row = entity.rows.find((r) => r.id === params.rowId)
      if (!row) throw new Error(`Row not found: ${params.rowId}`)

      if (params.fieldValues) {
        Object.assign(row.values, params.fieldValues)
      }
      await saveDocument(filePath, doc)
      return { ok: true }
    }

    case 'remove_row': {
      const entity = getEntity(params.entityId)
      if (!params.rowId) throw new Error('rowId is required for remove_row')
      entity.rows = entity.rows.filter((r) => r.id !== params.rowId)
      await saveDocument(filePath, doc)
      return { ok: true }
    }

    // ----- Query -----

    case 'list_entities': {
      return {
        entities: doc.dataEntities!.map((e) => ({
          id: e.id,
          name: e.name,
          fieldCount: e.fields.length,
          rowCount: e.rows.length,
          viewCount: e.views.length,
        })),
      }
    }

    case 'get_entity': {
      const entity = getEntity(params.entityId)
      return { entity }
    }

    // ----- View CRUD -----

    case 'add_view': {
      const entity = getEntity(params.entityId)
      const id = generateId()
      const newView: DataView = {
        id,
        name: params.viewName ?? 'Default view',
        filters: [],
        sorts: [],
      }
      entity.views.push(newView)
      await saveDocument(filePath, doc)
      return { viewId: id }
    }

    case 'remove_view': {
      const entity = getEntity(params.entityId)
      if (!params.viewId) throw new Error('viewId is required for remove_view')
      entity.views = entity.views.filter((v) => v.id !== params.viewId)
      await saveDocument(filePath, doc)
      return { ok: true }
    }

    case 'update_view': {
      const entity = getEntity(params.entityId)
      if (!params.viewId) throw new Error('viewId is required for update_view')
      const view = entity.views.find((v) => v.id === params.viewId)
      if (!view) throw new Error(`View not found: ${params.viewId}`)

      if (params.viewUpdates) {
        Object.assign(view, params.viewUpdates)
        view.id = params.viewId // Protect ID
      }
      await saveDocument(filePath, doc)
      return { ok: true }
    }

    default:
      throw new Error(`Unknown action: ${params.action}`)
  }
}
