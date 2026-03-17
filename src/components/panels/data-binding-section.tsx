import { useState, useEffect } from 'react'
import { useDocumentStore } from '@/stores/document-store'
import { useCanvasStore } from '@/stores/canvas-store'
import SectionHeader from '@/components/shared/section-header'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Database, Unlink, AlertCircle } from 'lucide-react'
import type { PenNode } from '@/types/pen'
import type { DataBinding, FieldMapping } from '@/types/data-entity'
import { BINDABLE_ROLES } from '@/variables/resolve-data-binding'
import { buildAutoFieldMappings } from '@/utils/binding-utils'

interface DataBindingSectionProps {
  node: PenNode
  onUpdate: (updates: Partial<PenNode>) => void
}

export default function DataBindingSection({ node }: DataBindingSectionProps) {
  const [selectorOpen, setSelectorOpen] = useState(false)
  const activeId = useCanvasStore((s) => s.selection.activeId)
  const pendingBindNodeId = useCanvasStore((s) => s.pendingBindNodeId)
  const setPendingBindNodeId = useCanvasStore((s) => s.setPendingBindNodeId)
  const setDataBinding = useDocumentStore((s) => s.setDataBinding)
  const clearDataBinding = useDocumentStore((s) => s.clearDataBinding)
  const dataEntities = useDocumentStore((s) => s.document.dataEntities ?? [])

  const binding = node.dataBinding
  const boundEntity = binding ? dataEntities.find((e) => e.id === binding.entityId) : undefined
  const isEntityMissing = !!binding && !boundEntity

  // Only show this section for bindable roles or if already bound
  const role = node.role ?? ''
  const isBindable = BINDABLE_ROLES.includes(role as (typeof BINDABLE_ROLES)[number]) || !!binding
  if (!isBindable) return null

  // Auto-open entity selector when triggered from context menu
  useEffect(() => {
    if (pendingBindNodeId && pendingBindNodeId === activeId) {
      setSelectorOpen(true)
      setPendingBindNodeId(null)
    }
  }, [pendingBindNodeId, activeId, setPendingBindNodeId])

  const handleBind = (entityId: string) => {
    if (!activeId) return
    const entity = dataEntities.find((e) => e.id === entityId)
    // Auto-map fields on initial bind (per CONTEXT.md: "Auto-map by field name/type on initial bind")
    const autoMappings = entity ? buildAutoFieldMappings(entity, node) : []
    const newBinding: DataBinding = {
      entityId,
      fieldMappings: autoMappings,
    }
    setDataBinding(activeId, newBinding)
    setSelectorOpen(false)
  }

  const handleUnbind = () => {
    if (!activeId) return
    clearDataBinding(activeId)
  }

  const handleFieldMappingChange = (slotKey: string, fieldId: string) => {
    if (!activeId || !binding) return
    const existing = binding.fieldMappings.filter((m) => m.slotKey !== slotKey)
    const updated: FieldMapping[] = fieldId && fieldId !== '__none__'
      ? [...existing, { slotKey, fieldId }]
      : existing
    setDataBinding(activeId, { ...binding, fieldMappings: updated })
  }

  return (
    <div className="space-y-2">
      <SectionHeader title="Data Binding" />

      {/* Entity missing warning */}
      {isEntityMissing && (
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-destructive/10 text-destructive text-[11px]">
          <AlertCircle size={12} className="shrink-0" />
          <span>Entity not found — binding is stale</span>
        </div>
      )}

      {/* Bound state */}
      {binding && boundEntity && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-card border border-border">
            <Database size={12} className="text-muted-foreground shrink-0" />
            <span className="text-[11px] flex-1 truncate font-medium text-foreground">
              {boundEntity.name}
            </span>
            <span className="text-[10px] text-muted-foreground shrink-0">
              {boundEntity.fields.length} fields
            </span>
          </div>

          {/* Field mappings: one row per entity field */}
          {boundEntity.fields.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground px-0.5">Field mappings</p>
              {boundEntity.fields.map((field, idx) => {
                const slotKey = `col-${idx}`
                const currentMapping = binding.fieldMappings.find((m) => m.slotKey === slotKey)
                // Per-field "field not found" warning: check if mapped fieldId exists in entity
                const mappedFieldMissing = currentMapping
                  && !boundEntity.fields.some((f) => f.id === currentMapping.fieldId)
                return (
                  <div key={field.id} className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground w-16 truncate shrink-0">
                      {field.name}
                    </span>
                    <Select
                      value={currentMapping?.fieldId ?? '__none__'}
                      onValueChange={(val) => handleFieldMappingChange(slotKey, val)}
                    >
                      <SelectTrigger className="h-6 text-[11px] flex-1">
                        <SelectValue placeholder="slot..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">-- none --</SelectItem>
                        {boundEntity.fields.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {mappedFieldMissing && (
                      <span title="Field not found — entity field was renamed or deleted" className="shrink-0">
                        <AlertCircle size={12} className="text-destructive" />
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* NO row count selector — per CONTEXT.md: "Show all sample rows from entity (no limit)" */}

          <Button
            variant="outline"
            size="sm"
            className="w-full h-7 text-[11px] gap-1.5 text-muted-foreground"
            onClick={handleUnbind}
          >
            <Unlink size={12} />
            Remove binding
          </Button>
        </div>
      )}

      {/* Unbound state */}
      {!binding && (
        <Button
          variant="outline"
          size="sm"
          className="w-full h-7 text-[11px] gap-1.5"
          onClick={() => setSelectorOpen(true)}
          disabled={dataEntities.length === 0}
        >
          <Database size={12} />
          {dataEntities.length === 0 ? 'No entities available' : 'Bind to data entity...'}
        </Button>
      )}

      {/* Change entity button when already bound */}
      {binding && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full h-6 text-[10px] text-muted-foreground gap-1"
          onClick={() => setSelectorOpen(true)}
        >
          Change entity
        </Button>
      )}

      {/* Entity selector Dialog */}
      <Dialog open={selectorOpen} onOpenChange={setSelectorOpen}>
        <DialogContent className="max-w-[380px]">
          <DialogHeader>
            <DialogTitle className="text-sm">Bind to Data Entity</DialogTitle>
            <DialogDescription className="text-xs">
              Select an entity from your ERD to bind this component
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1 mt-2">
            {dataEntities.length === 0 && (
              <p className="text-xs text-muted-foreground py-4 text-center">
                No data entities in this document. Create entities in the ERD panel first.
              </p>
            )}
            {dataEntities.map((entity) => (
              <button
                key={entity.id}
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2 rounded hover:bg-accent text-left"
                onClick={() => handleBind(entity.id)}
              >
                <Database size={14} className="text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-foreground truncate">{entity.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {entity.fields.length} fields · {entity.rows.length} rows
                  </p>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
