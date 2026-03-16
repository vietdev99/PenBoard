import { useState, useRef, useCallback, memo } from 'react'
import { useTranslation } from 'react-i18next'
import { useDocumentStore } from '@/stores/document-store'
import { applyFilters, applySorts } from '@/stores/document-store-data'
import type { DataField, DataRow, DataView, DataEntity } from '@/types/data-entity'

interface DataEntityTableProps {
  entityId: string
  fields: DataField[]
  rows: DataRow[]
  activeView?: DataView
  entities: DataEntity[]
}

export default function DataEntityTable({ entityId, fields, rows, activeView, entities }: DataEntityTableProps) {
  const { t } = useTranslation()
  const addRow = useDocumentStore((s) => s.addRow)

  // Apply view filters and sorts
  const displayRows = (() => {
    let result = rows
    if (activeView) {
      if (activeView.filters.length > 0) {
        result = applyFilters(result, activeView.filters, fields)
      }
      if (activeView.sorts.length > 0) {
        result = applySorts(result, activeView.sorts, fields)
      }
    }
    return result
  })()

  if (fields.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <p className="text-xs text-muted-foreground">{t('data.noFields')}</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full border-collapse text-xs">
        {/* Header */}
        <thead>
          <tr className="border-b border-border">
            {fields.map((field) => (
              <th
                key={field.id}
                className="h-8 px-2 text-left font-medium text-muted-foreground whitespace-nowrap border-r border-border last:border-r-0"
                style={{ minWidth: 100 }}
              >
                {field.name || field.id}
              </th>
            ))}
          </tr>
        </thead>

        {/* Body */}
        <tbody>
          {displayRows.length === 0 ? (
            <tr>
              <td colSpan={fields.length} className="h-12 text-center text-muted-foreground">
                {t('data.noRows')}
              </td>
            </tr>
          ) : (
            displayRows.map((row) => (
              <DataRowComponent
                key={row.id}
                entityId={entityId}
                row={row}
                fields={fields}
                entities={entities}
              />
            ))
          )}
        </tbody>
      </table>

      {/* Add row button */}
      <button
        className="w-full h-8 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors text-left px-2"
        onClick={() => addRow(entityId)}
      >
        {t('data.addRow')}
      </button>
    </div>
  )
}

// Memoized row component for performance
const DataRowComponent = memo(function DataRowComponent({
  entityId,
  row,
  fields,
  entities,
}: {
  entityId: string
  row: DataRow
  fields: DataField[]
  entities: DataEntity[]
}) {
  return (
    <tr className="border-b border-border/50 hover:bg-accent/30 transition-colors">
      {fields.map((field) => (
        <DataCell
          key={field.id}
          entityId={entityId}
          rowId={row.id}
          field={field}
          value={row.values[field.id]}
          entities={entities}
        />
      ))}
    </tr>
  )
})

function DataCell({
  entityId,
  rowId,
  field,
  value,
  entities,
}: {
  entityId: string
  rowId: string
  field: DataField
  value: string | number | boolean | null | undefined
  entities: DataEntity[]
}) {
  const updateRowValue = useDocumentStore((s) => s.updateRowValue)
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const commitValue = useCallback(
    (val: string) => {
      let parsed: string | number | boolean | null = val
      if (field.type === 'number') {
        parsed = val === '' ? null : Number(val)
      } else if (field.type === 'boolean') {
        parsed = val === 'true'
      }
      updateRowValue(entityId, rowId, field.id, parsed)
    },
    [entityId, rowId, field.id, field.type, updateRowValue],
  )

  const debouncedCommit = useCallback(
    (val: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => commitValue(val), 300)
    },
    [commitValue],
  )

  const startEditing = () => {
    setEditValue(value != null ? String(value) : '')
    setEditing(true)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const finishEditing = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    commitValue(editValue)
    setEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      finishEditing()
    } else if (e.key === 'Escape') {
      setEditing(false)
    } else if (e.key === 'Tab') {
      finishEditing()
      // Let Tab propagate for natural navigation
    }
  }

  // Checkbox field
  if (field.type === 'boolean') {
    return (
      <td className="h-8 px-2 border-r border-border/50 last:border-r-0">
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => updateRowValue(entityId, rowId, field.id, e.target.checked)}
          className="accent-primary"
        />
      </td>
    )
  }

  // Select field
  if (field.type === 'select' && field.options && field.options.length > 0) {
    return (
      <td className="h-8 px-2 border-r border-border/50 last:border-r-0">
        <select
          className="w-full h-6 text-xs bg-transparent outline-none"
          value={value != null ? String(value) : ''}
          onChange={(e) => updateRowValue(entityId, rowId, field.id, e.target.value || null)}
        >
          <option value="">--</option>
          {field.options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </td>
    )
  }

  // Relation field
  if (field.type === 'relation' && field.relatedEntityId) {
    const relatedEntity = entities.find((e) => e.id === field.relatedEntityId)
    const relatedRows = relatedEntity?.rows ?? []
    const firstTextField = relatedEntity?.fields.find((f) => f.type === 'text')

    return (
      <td className="h-8 px-2 border-r border-border/50 last:border-r-0">
        <select
          className="w-full h-6 text-xs bg-transparent outline-none"
          value={value != null ? String(value) : ''}
          onChange={(e) => updateRowValue(entityId, rowId, field.id, e.target.value || null)}
        >
          <option value="">--</option>
          {relatedRows.map((rr) => {
            const label = firstTextField
              ? rr.values[firstTextField.id] ?? rr.id
              : rr.id
            return (
              <option key={rr.id} value={rr.id}>{String(label)}</option>
            )
          })}
        </select>
      </td>
    )
  }

  // Default: text/number/date editable cell
  if (editing) {
    return (
      <td className="h-8 px-2 border-r border-border/50 last:border-r-0">
        <input
          ref={inputRef}
          type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
          className="w-full h-6 text-xs bg-transparent outline-none"
          value={editValue}
          onChange={(e) => {
            setEditValue(e.target.value)
            debouncedCommit(e.target.value)
          }}
          onBlur={finishEditing}
          onKeyDown={handleKeyDown}
        />
      </td>
    )
  }

  return (
    <td
      className="h-8 px-2 border-r border-border/50 last:border-r-0 cursor-text truncate"
      onClick={startEditing}
    >
      <span className="text-foreground">
        {value != null ? String(value) : ''}
      </span>
    </td>
  )
}
