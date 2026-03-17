import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCanvasStore } from '@/stores/canvas-store'
import { useDocumentStore, getActivePageChildren } from '@/stores/document-store'
import type { ScreenConnection } from '@/types/pen'
import SectionHeader from '@/components/shared/section-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2, ArrowUpRight, Link2Off } from 'lucide-react'
import NavigateModal from './navigate-modal'

/**
 * Navigate panel — standalone tab content showing all connections for the selected node.
 * Replaces the ConnectionSection that was embedded inside PropertyPanel.
 */
export default function NavigatePanel() {
  const { t } = useTranslation()
  const activeId = useCanvasStore((s) => s.selection.activeId)
  const activePageId = useCanvasStore((s) => s.activePageId)
  const pages = useDocumentStore((s) => s.document.pages)
  const document = useDocumentStore((s) => s.document)
  const children = useDocumentStore((s) => getActivePageChildren(s.document, activePageId))
  const addConnection = useDocumentStore((s) => s.addConnection)
  const removeConnection = useDocumentStore((s) => s.removeConnection)
  const updateConnection = useDocumentStore((s) => s.updateConnection)
  const [isAdding, setIsAdding] = useState(false)

  // Subscribe so we re-render when nodes change
  void children

  const isErdPage = (pages ?? []).find((p) => p.id === activePageId)?.type === 'erd'

  if (!activeId || !activePageId || isErdPage) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <p className="text-xs text-muted-foreground text-center">
          {isErdPage
            ? t('connection.noConnectionsOnErd', 'Connections are not available on ERD pages')
            : t('connection.selectElement', 'Select an element to manage its connections')
          }
        </p>
      </div>
    )
  }

  const connections = (document.connections ?? []).filter(
    (c) => c.sourceElementId === activeId,
  )

  const handleAddTarget = (targetPageId: string, targetFrameId?: string) => {
    addConnection({
      sourceElementId: activeId,
      sourcePageId: activePageId,
      targetPageId,
      targetFrameId,
      triggerEvent: 'click',
      transitionType: 'push',
    })
    setIsAdding(false)
  }

  const getTargetDisplayName = (conn: ScreenConnection): string => {
    const page = (document.pages ?? []).find((p) => p.id === conn.targetPageId)
    if (!page) return t('connection.error.targetDeleted')
    if (conn.targetFrameId) {
      const frame = (page.children ?? []).find((n) => n.id === conn.targetFrameId)
      const frameName = frame?.name || 'Untitled Frame'
      return `${page.name} > ${frameName}`
    }
    return page.name
  }

  const handleQuickNavigate = (conn: ScreenConnection) => {
    useCanvasStore.getState().clearSelection()
    useCanvasStore.getState().exitAllFrames()
    useCanvasStore.getState().setActivePageId(conn.targetPageId)
    if (conn.targetFrameId) {
      requestAnimationFrame(() => {
        useCanvasStore.getState().setSelection([conn.targetFrameId!], conn.targetFrameId!)
      })
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-3 py-2">
        <SectionHeader
          title={t('connection.navigateTo')}
          actions={
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={() => setIsAdding(true)}
              title={t('connection.add')}
            >
              <Plus size={14} />
            </Button>
          }
        />

        {connections.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
            <Link2Off size={24} className="opacity-40" />
            <p className="text-xs text-center">
              {t('connection.empty', 'No connections yet. Click + to add one.')}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-1.5 mt-1">
          {connections.map((conn) => (
            <ConnectionRow
              key={conn.id}
              connection={conn}
              pageName={getTargetDisplayName(conn)}
              onUpdate={(updates) => updateConnection(conn.id, updates)}
              onRemove={() => removeConnection(conn.id)}
              onNavigate={() => handleQuickNavigate(conn)}
            />
          ))}
        </div>
      </div>

      <NavigateModal
        isOpen={isAdding}
        onClose={() => setIsAdding(false)}
        onSelect={(targetPageId, targetFrameId) => {
          handleAddTarget(targetPageId, targetFrameId)
        }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// ConnectionRow -- individual connection editor row
// ---------------------------------------------------------------------------

interface ConnectionRowProps {
  connection: ScreenConnection
  pageName: string
  onUpdate: (updates: Partial<ScreenConnection>) => void
  onRemove: () => void
  onNavigate: () => void
}

function ConnectionRow({ connection, pageName, onUpdate, onRemove, onNavigate }: ConnectionRowProps) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-1 rounded border border-border p-1.5">
      {/* Target page/frame name */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-foreground truncate flex-1">
          {pageName}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 shrink-0"
          onClick={onNavigate}
          title="Go to target"
        >
          <ArrowUpRight size={14} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          title={t('connection.remove')}
        >
          <Trash2 size={14} />
        </Button>
      </div>

      {/* Trigger + Transition row */}
      <div className="flex items-center gap-1">
        <Select
          value={connection.triggerEvent}
          onValueChange={(v) => onUpdate({ triggerEvent: v as ScreenConnection['triggerEvent'] })}
        >
          <SelectTrigger className="h-7 text-xs flex-1 min-w-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="click" className="text-xs">{t('connection.trigger.click')}</SelectItem>
            <SelectItem value="hover" className="text-xs">{t('connection.trigger.hover')}</SelectItem>
            <SelectItem value="submit" className="text-xs">{t('connection.trigger.submit')}</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={connection.transitionType}
          onValueChange={(v) => onUpdate({ transitionType: v as ScreenConnection['transitionType'] })}
        >
          <SelectTrigger className="h-7 text-xs flex-1 min-w-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="push" className="text-xs">{t('connection.transition.push')}</SelectItem>
            <SelectItem value="modal" className="text-xs">{t('connection.transition.modal')}</SelectItem>
            <SelectItem value="replace" className="text-xs">{t('connection.transition.replace')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Optional label */}
      <Input
        className="h-7 text-xs"
        placeholder={t('connection.labelPlaceholder')}
        value={connection.label ?? ''}
        onChange={(e) => onUpdate({ label: e.target.value || undefined })}
      />
    </div>
  )
}
