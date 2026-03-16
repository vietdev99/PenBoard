// --- Data Entity Types ---
// Shared types for storyboard data modeling (Notion-like tables).
// Used by both Plan 01 (connections) and Plan 02 (data entity CRUD + ERD).

export type DataFieldType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'date'
  | 'select'
  | 'relation'

export interface DataField {
  id: string
  name: string
  type: DataFieldType
  /** Whether this field is a primary key */
  isPrimaryKey?: boolean
  /** Whether this field is a foreign key */
  isForeignKey?: boolean
  /** For 'select' type: allowed option values */
  options?: string[]
  /** For 'relation' type: target entity id */
  relatedEntityId?: string
  /** For 'relation' type: target field id */
  relatedFieldId?: string
  /** For 'relation' type: cardinality */
  relationCardinality?: '1:1' | '1:N' | 'N:M'
  /** Whether this field is required */
  required?: boolean
  /** Default value for new rows */
  defaultValue?: string | number | boolean
}

export interface DataRow {
  id: string
  /** Field id -> value */
  values: Record<string, string | number | boolean | null>
}

export interface DataFilter {
  fieldId: string
  operator: 'eq' | 'neq' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte' | 'isEmpty' | 'isNotEmpty'
  value?: string | number | boolean
}

export interface DataSort {
  fieldId: string
  direction: 'asc' | 'desc'
}

export interface DataView {
  id: string
  name: string
  filters: DataFilter[]
  sorts: DataSort[]
}

export interface DataEntity {
  id: string
  name: string
  fields: DataField[]
  rows: DataRow[]
  views: DataView[]
  /** Position on the ERD page canvas */
  erdPosition?: { x: number; y: number }
}
