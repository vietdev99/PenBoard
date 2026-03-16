import { useState, useRef, useEffect } from 'react'
import {
  Type, Hash, Calendar, List, CheckSquare, GitBranch,
  Trash2, Key,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useDocumentStore } from '@/stores/document-store'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { DataField, DataEntity, DataFieldType } from '@/types/data-entity'

const FIELD_TYPE_ICONS: Record<DataFieldType, React.ReactNode> = {
  text: <Type className="w-3.5 h-3.5" />,
  number: <Hash className="w-3.5 h-3.5" />,
  date: <Calendar className="w-3.5 h-3.5" />,
  select: <List className="w-3.5 h-3.5" />,
  boolean: <CheckSquare className="w-3.5 h-3.5" />,
  relation: <GitBranch className="w-3.5 h-3.5" />,
}

const FIELD_TYPES: { value: DataFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Select' },
  { value: 'relation', label: 'Relation' },
]

const CARDINALITIES = [
  { value: '1:1' as const, label: '1:1' },
  { value: '1:N' as const, label: '1:N' },
  { value: 'N:M' as const, label: 'N:M' },
]

interface DataFieldRowProps {
  entityId: string
  field: DataField
  entities: DataEntity[]
}

export default function DataFieldRow({ entityId, field, entities }: DataFieldRowProps) {
  const { t } = useTranslation()
  const updateField = useDocumentStore((s) => s.updateField)
  const removeField = useDocumentStore((s) => s.removeField)

  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(field.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const commitName = () => {
    if (editValue.trim() && editValue.trim() !== field.name) {
      updateField(entityId, field.id, { name: editValue.trim() })
    }
    setEditing(false)
  }

  const handleTypeChange = (newType: DataFieldType) => {
    if (newType === field.type) return
    updateField(entityId, field.id, { type: newType })
  }

  const togglePk = () => {
    updateField(entityId, field.id, { isPrimaryKey: !field.isPrimaryKey })
  }

  const otherEntities = entities.filter((e) => e.id !== entityId)

  return (
    <div className="group flex items-center gap-1.5 h-7 px-2 rounded-md hover:bg-accent/50 transition-colors">
      {/* Field type icon + dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
            {FIELD_TYPE_ICONS[field.type] || <Type className="w-3.5 h-3.5" />}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[120px]">
          {FIELD_TYPES.map((ft) => (
            <DropdownMenuItem
              key={ft.value}
              onClick={() => handleTypeChange(ft.value)}
              className={cn('text-xs', field.type === ft.value && 'font-medium')}
            >
              <span className="mr-2">{FIELD_TYPE_ICONS[ft.value]}</span>
              {ft.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Editable field name */}
      {editing ? (
        <input
          ref={inputRef}
          className="flex-1 bg-transparent outline-none text-xs text-foreground min-w-0"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitName()
            if (e.key === 'Escape') setEditing(false)
          }}
        />
      ) : (
        <span
          className="flex-1 text-xs text-foreground truncate cursor-text min-w-0"
          onClick={() => {
            setEditValue(field.name)
            setEditing(true)
          }}
        >
          {field.name || t('data.fieldNamePlaceholder')}
        </span>
      )}

      {/* Relation target + cardinality */}
      {field.type === 'relation' && (
        <>
          <select
            className="h-5 text-[10px] bg-muted border border-border rounded px-1 text-foreground max-w-[80px]"
            value={field.relatedEntityId ?? ''}
            onChange={(e) =>
              updateField(entityId, field.id, { relatedEntityId: e.target.value || undefined })
            }
          >
            <option value="">Target</option>
            {otherEntities.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
          <select
            className="h-5 text-[10px] bg-muted border border-border rounded px-1 text-foreground w-[42px]"
            value={field.relationCardinality ?? '1:N'}
            onChange={(e) =>
              updateField(entityId, field.id, {
                relationCardinality: e.target.value as '1:1' | '1:N' | 'N:M',
              })
            }
          >
            {CARDINALITIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </>
      )}

      {/* PK badge */}
      <button
        className={cn(
          'shrink-0 transition-colors',
          field.isPrimaryKey
            ? 'text-amber-500'
            : 'text-transparent group-hover:text-muted-foreground/40',
        )}
        onClick={togglePk}
        title="Toggle Primary Key"
      >
        <Key className="w-3 h-3" />
      </button>

      {field.isPrimaryKey && (
        <Badge variant="outline" className="h-4 px-1 text-[9px] font-semibold border-amber-500/50 text-amber-500">
          PK
        </Badge>
      )}

      {field.type === 'relation' && field.relatedEntityId && (
        <Badge variant="outline" className="h-4 px-1 text-[9px] font-semibold border-violet-500/50 text-violet-500">
          FK
        </Badge>
      )}

      {/* Delete button */}
      <button
        className="shrink-0 opacity-0 group-hover:opacity-60 hover:!opacity-100 text-muted-foreground hover:text-destructive transition-all"
        onClick={() => removeField(entityId, field.id)}
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  )
}
