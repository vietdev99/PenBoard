import { Filter, ArrowUpDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'
import { useDocumentStore } from '@/stores/document-store'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import type { DataView, DataField, DataFilter, DataSort } from '@/types/data-entity'

interface DataViewControlsProps {
  entityId: string
  view: DataView
  fields: DataField[]
}

const FILTER_OPERATORS = [
  { value: 'eq' as const, label: '=' },
  { value: 'neq' as const, label: '!=' },
  { value: 'contains' as const, label: 'contains' },
  { value: 'gt' as const, label: '>' },
  { value: 'lt' as const, label: '<' },
  { value: 'gte' as const, label: '>=' },
  { value: 'lte' as const, label: '<=' },
  { value: 'isEmpty' as const, label: 'is empty' },
  { value: 'isNotEmpty' as const, label: 'is not empty' },
]

export default function DataViewControls({ entityId, view, fields }: DataViewControlsProps) {
  const { t } = useTranslation()
  const updateView = useDocumentStore((s) => s.updateView)

  const handleAddFilter = () => {
    if (fields.length === 0) return
    const newFilter: DataFilter = {
      fieldId: fields[0].id,
      operator: 'eq',
      value: '',
    }
    updateView(entityId, view.id, {
      filters: [...view.filters, newFilter],
    })
  }

  const handleUpdateFilter = (index: number, updates: Partial<DataFilter>) => {
    const newFilters = view.filters.map((f, i) =>
      i === index ? { ...f, ...updates } : f,
    )
    updateView(entityId, view.id, { filters: newFilters })
  }

  const handleRemoveFilter = (index: number) => {
    updateView(entityId, view.id, {
      filters: view.filters.filter((_, i) => i !== index),
    })
  }

  const handleAddSort = () => {
    if (fields.length === 0) return
    const newSort: DataSort = {
      fieldId: fields[0].id,
      direction: 'asc',
    }
    updateView(entityId, view.id, {
      sorts: [...view.sorts, newSort],
    })
  }

  const handleUpdateSort = (index: number, updates: Partial<DataSort>) => {
    const newSorts = view.sorts.map((s, i) =>
      i === index ? { ...s, ...updates } : s,
    )
    updateView(entityId, view.id, { sorts: newSorts })
  }

  const handleRemoveSort = (index: number) => {
    updateView(entityId, view.id, {
      sorts: view.sorts.filter((_, i) => i !== index),
    })
  }

  const hasActiveFilters = view.filters.length > 0
  const hasActiveSorts = view.sorts.length > 0

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border">
      {/* Filter */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            className={cn(
              'inline-flex items-center gap-1 h-6 px-2 rounded text-[10px] transition-colors',
              hasActiveFilters
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent',
            )}
          >
            <Filter className="w-3 h-3" />
            {t('data.view.filter')}
            {hasActiveFilters && (
              <span className="ml-0.5 bg-primary text-primary-foreground rounded-full w-3.5 h-3.5 flex items-center justify-center text-[8px] font-bold">
                {view.filters.length}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-2" align="start">
          <div className="flex flex-col gap-1.5">
            {view.filters.map((filter, idx) => (
              <div key={idx} className="flex items-center gap-1">
                <select
                  className="h-6 text-[10px] bg-muted border border-border rounded px-1 flex-1 min-w-0"
                  value={filter.fieldId}
                  onChange={(e) => handleUpdateFilter(idx, { fieldId: e.target.value })}
                >
                  {fields.map((f) => (
                    <option key={f.id} value={f.id}>{f.name || f.id}</option>
                  ))}
                </select>
                <select
                  className="h-6 text-[10px] bg-muted border border-border rounded px-1 w-[70px]"
                  value={filter.operator}
                  onChange={(e) => handleUpdateFilter(idx, { operator: e.target.value as DataFilter['operator'] })}
                >
                  {FILTER_OPERATORS.map((op) => (
                    <option key={op.value} value={op.value}>{op.label}</option>
                  ))}
                </select>
                {filter.operator !== 'isEmpty' && filter.operator !== 'isNotEmpty' && (
                  <input
                    className="h-6 text-[10px] bg-muted border border-border rounded px-1 flex-1 min-w-0"
                    value={String(filter.value ?? '')}
                    onChange={(e) => handleUpdateFilter(idx, { value: e.target.value })}
                    placeholder="Value"
                  />
                )}
                <button
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemoveFilter(idx)}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <button
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors text-left px-1"
              onClick={handleAddFilter}
            >
              + Add filter
            </button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Sort */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            className={cn(
              'inline-flex items-center gap-1 h-6 px-2 rounded text-[10px] transition-colors',
              hasActiveSorts
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent',
            )}
          >
            <ArrowUpDown className="w-3 h-3" />
            {t('data.view.sort')}
            {hasActiveSorts && (
              <span className="ml-0.5 bg-primary text-primary-foreground rounded-full w-3.5 h-3.5 flex items-center justify-center text-[8px] font-bold">
                {view.sorts.length}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[260px] p-2" align="start">
          <div className="flex flex-col gap-1.5">
            {view.sorts.map((sort, idx) => (
              <div key={idx} className="flex items-center gap-1">
                <select
                  className="h-6 text-[10px] bg-muted border border-border rounded px-1 flex-1 min-w-0"
                  value={sort.fieldId}
                  onChange={(e) => handleUpdateSort(idx, { fieldId: e.target.value })}
                >
                  {fields.map((f) => (
                    <option key={f.id} value={f.id}>{f.name || f.id}</option>
                  ))}
                </select>
                <select
                  className="h-6 text-[10px] bg-muted border border-border rounded px-1 w-[50px]"
                  value={sort.direction}
                  onChange={(e) => handleUpdateSort(idx, { direction: e.target.value as 'asc' | 'desc' })}
                >
                  <option value="asc">Asc</option>
                  <option value="desc">Desc</option>
                </select>
                <button
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemoveSort(idx)}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <button
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors text-left px-1"
              onClick={handleAddSort}
            >
              + Add sort
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
