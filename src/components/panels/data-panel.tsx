import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { X, Plus, Database } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'
import { useDocumentStore } from '@/stores/document-store'
import { useCanvasStore } from '@/stores/canvas-store'
import DataFieldRow from './data-field-row'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

const MIN_WIDTH = 520
const MIN_HEIGHT = 300
const DEFAULT_WIDTH = 720
const DEFAULT_HEIGHT = 480

export default function DataPanel() {
  const { t } = useTranslation()
  const entities = useDocumentStore((s) => s.document.dataEntities)
  const addEntity = useDocumentStore((s) => s.addEntity)
  const removeEntity = useDocumentStore((s) => s.removeEntity)
  const updateEntity = useDocumentStore((s) => s.updateEntity)
  const addField = useDocumentStore((s) => s.addField)
  const addRow = useDocumentStore((s) => s.addRow)
  const toggleDataPanel = useCanvasStore((s) => s.toggleDataPanel)
  const dataFocusEntityId = useCanvasStore((s) => s.dataFocusEntityId)
  const setDataFocusEntityId = useCanvasStore((s) => s.setDataFocusEntityId)

  // Active entity tab
  const [activeEntityId, setActiveEntityId] = useState<string | null>(null)
  // Panel size
  const [panelWidth, setPanelWidth] = useState(DEFAULT_WIDTH)
  const [panelHeight, setPanelHeight] = useState(DEFAULT_HEIGHT)
  // Rename
  const [editingTabId, setEditingTabId] = useState<string | null>(null)
  const [editTabValue, setEditTabValue] = useState('')
  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  // Context menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; entityId: string } | null>(null)

  const panelRef = useRef<HTMLDivElement>(null)
  const tabInputRef = useRef<HTMLInputElement>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)
  const resizeRef = useRef<{
    edge: 'right' | 'bottom' | 'corner'
    startX: number; startY: number; startW: number; startH: number
  } | null>(null)

  const entityList = useMemo(() => entities ?? [], [entities])

  // Handle dataFocusEntityId from canvas (ERD double-click)
  useEffect(() => {
    if (dataFocusEntityId && entityList.some((e) => e.id === dataFocusEntityId)) {
      setActiveEntityId(dataFocusEntityId)
      setDataFocusEntityId(null)
    }
  }, [dataFocusEntityId, entityList, setDataFocusEntityId])

  // Default to first entity if active is gone
  useEffect(() => {
    if (entityList.length > 0 && (!activeEntityId || !entityList.some((e) => e.id === activeEntityId))) {
      setActiveEntityId(entityList[0].id)
    }
    if (entityList.length === 0) {
      setActiveEntityId(null)
    }
  }, [entityList, activeEntityId])

  // Focus tab rename input
  useEffect(() => {
    if (editingTabId && tabInputRef.current) {
      tabInputRef.current.focus()
      tabInputRef.current.select()
    }
  }, [editingTabId])

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return
    const handler = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [contextMenu])

  // --- Resize ---
  const handleResizeStart = useCallback((edge: 'right' | 'bottom' | 'corner', e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    resizeRef.current = { edge, startX: e.clientX, startY: e.clientY, startW: panelWidth, startH: panelHeight }
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [panelWidth, panelHeight])

  const handleResizeMove = useCallback((e: React.PointerEvent) => {
    if (!resizeRef.current) return
    e.preventDefault()
    const { edge, startX, startY, startW, startH } = resizeRef.current
    const container = panelRef.current?.parentElement
    const maxW = container ? container.clientWidth - 72 : 1400
    const maxH = container ? container.clientHeight - 16 : 900
    if (edge === 'right' || edge === 'corner')
      setPanelWidth(Math.max(MIN_WIDTH, Math.min(maxW, startW + e.clientX - startX)))
    if (edge === 'bottom' || edge === 'corner')
      setPanelHeight(Math.max(MIN_HEIGHT, Math.min(maxH, startH + e.clientY - startY)))
  }, [])

  const handleResizeEnd = useCallback((e: React.PointerEvent) => {
    if (!resizeRef.current) return
    resizeRef.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
  }, [])

  const activeEntity = entityList.find((e) => e.id === activeEntityId)

  const handleAddEntity = () => {
    const id = addEntity(t('data.entityNamePlaceholder'))
    setActiveEntityId(id)
  }

  const handleDoubleClickTab = (entityId: string, name: string) => {
    setEditingTabId(entityId)
    setEditTabValue(name)
  }

  const commitTabRename = () => {
    if (editingTabId && editTabValue.trim()) {
      updateEntity(editingTabId, { name: editTabValue.trim() })
    }
    setEditingTabId(null)
  }

  const handleDeleteConfirm = () => {
    if (deleteConfirmId) {
      removeEntity(deleteConfirmId)
      setDeleteConfirmId(null)
    }
  }

  const deleteConfirmEntity = entityList.find((e) => e.id === deleteConfirmId)

  // Empty state
  if (entityList.length === 0) {
    return (
      <div
        ref={panelRef}
        className="absolute left-14 top-2 z-20 bg-card/95 backdrop-blur-sm rounded-lg shadow-xl border border-border flex flex-col"
        style={{ width: panelWidth, height: panelHeight }}
      >
        {/* Header */}
        <div className="h-9 flex items-center justify-between px-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">{t('data.panelTitle')}</span>
          </div>
          <button
            className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground rounded transition-colors"
            onClick={toggleDataPanel}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        {/* Empty body */}
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
          <Database className="w-10 h-10 text-muted-foreground/40" />
          <h3 className="text-sm font-medium text-foreground">{t('data.empty.heading')}</h3>
          <p className="text-xs text-muted-foreground max-w-[280px]">{t('data.empty.body')}</p>
          <Button size="sm" onClick={handleAddEntity}>
            {t('data.empty.cta')}
          </Button>
        </div>
        {/* Resize handles */}
        <div
          className="absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize"
          onPointerDown={(e) => handleResizeStart('right', e)}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeEnd}
        />
        <div
          className="absolute left-0 right-0 bottom-0 h-1 cursor-ns-resize"
          onPointerDown={(e) => handleResizeStart('bottom', e)}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeEnd}
        />
        <div
          className="absolute right-0 bottom-0 w-3 h-3 cursor-nwse-resize"
          onPointerDown={(e) => handleResizeStart('corner', e)}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeEnd}
        />
      </div>
    )
  }

  return (
    <>
      <div
        ref={panelRef}
        className="absolute left-14 top-2 z-20 bg-card/95 backdrop-blur-sm rounded-lg shadow-xl border border-border flex flex-col"
        style={{ width: panelWidth, height: panelHeight }}
      >
        {/* Header with entity tabs */}
        <div className="h-9 flex items-center gap-0 border-b border-border shrink-0">
          {/* Entity tabs */}
          <div className="flex-1 flex items-center gap-0 overflow-x-auto scrollbar-none px-1 min-w-0">
            {entityList.map((entity) => {
              const isActive = entity.id === activeEntityId
              return (
                <button
                  key={entity.id}
                  className={cn(
                    'shrink-0 h-7 px-2.5 text-xs rounded-md transition-colors select-none',
                    isActive
                      ? 'bg-accent text-foreground font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
                  )}
                  onClick={() => setActiveEntityId(entity.id)}
                  onDoubleClick={() => handleDoubleClickTab(entity.id, entity.name)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setContextMenu({ x: e.clientX, y: e.clientY, entityId: entity.id })
                  }}
                >
                  {editingTabId === entity.id ? (
                    <input
                      ref={tabInputRef}
                      className="bg-transparent outline-none text-xs text-foreground w-[80px]"
                      value={editTabValue}
                      onChange={(e) => setEditTabValue(e.target.value)}
                      onBlur={commitTabRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitTabRename()
                        if (e.key === 'Escape') setEditingTabId(null)
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    entity.name
                  )}
                </button>
              )
            })}
          </div>

          {/* Add entity + Close */}
          <div className="flex items-center gap-0.5 px-1 shrink-0">
            <button
              className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground rounded transition-colors"
              onClick={handleAddEntity}
              title={t('data.addEntity')}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground rounded transition-colors"
              onClick={toggleDataPanel}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Body */}
        {activeEntity && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Fields section */}
            <div className="border-b border-border">
              <div className="px-3 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Fields
              </div>
              <div className="max-h-[200px] overflow-y-auto px-1 pb-1">
                {activeEntity.fields.length === 0 ? (
                  <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                    {t('data.noFields')}
                  </div>
                ) : (
                  activeEntity.fields.map((field) => (
                    <DataFieldRow
                      key={field.id}
                      entityId={activeEntity.id}
                      field={field}
                      entities={entityList}
                    />
                  ))
                )}
              </div>
              <div className="px-2 pb-1.5">
                <button
                  className="w-full text-left px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded transition-colors"
                  onClick={() => addField(activeEntity.id, { name: '', type: 'text' })}
                >
                  + {t('data.addField')}
                </button>
              </div>
            </div>

            {/* Data table section (placeholder - implemented in Task 3) */}
            <div className="flex-1 overflow-auto p-3">
              <div className="text-xs text-muted-foreground text-center py-6">
                {activeEntity.rows.length === 0
                  ? t('data.noRows')
                  : `${activeEntity.rows.length} row(s)`}
              </div>
              <div className="flex justify-center">
                <button
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => addRow(activeEntity.id)}
                >
                  {t('data.addRow')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Resize handles */}
        <div
          className="absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize"
          onPointerDown={(e) => handleResizeStart('right', e)}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeEnd}
        />
        <div
          className="absolute left-0 right-0 bottom-0 h-1 cursor-ns-resize"
          onPointerDown={(e) => handleResizeStart('bottom', e)}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeEnd}
        />
        <div
          className="absolute right-0 bottom-0 w-3 h-3 cursor-nwse-resize"
          onPointerDown={(e) => handleResizeStart('corner', e)}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeEnd}
        />
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 bg-popover border border-border rounded-md shadow-md py-1 min-w-[140px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            className="w-full text-left px-3 py-1.5 text-xs text-popover-foreground hover:bg-accent transition-colors"
            onClick={() => {
              const entity = entityList.find((e) => e.id === contextMenu.entityId)
              if (entity) handleDoubleClickTab(entity.id, entity.name)
              setContextMenu(null)
            }}
          >
            {t('common.rename')}
          </button>
          <button
            className="w-full text-left px-3 py-1.5 text-xs text-destructive hover:bg-accent transition-colors"
            onClick={() => {
              setDeleteConfirmId(contextMenu.entityId)
              setContextMenu(null)
            }}
          >
            {t('common.delete')}
          </button>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent className="max-w-[360px]">
          <DialogHeader>
            <DialogTitle>{t('data.deleteEntity.action')}</DialogTitle>
            <DialogDescription>
              {t('data.deleteEntity.confirm', { name: deleteConfirmEntity?.name ?? '' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirmId(null)}>
              {t('data.deleteEntity.cancel')}
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDeleteConfirm}>
              {t('data.deleteEntity.action')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
