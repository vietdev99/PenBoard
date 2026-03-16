import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDocumentStore } from '@/stores/document-store'
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
import { Plus, Trash2 } from 'lucide-react'

interface ConnectionSectionProps {
  nodeId: string
  pageId: string
}

export default function ConnectionSection({ nodeId, pageId }: ConnectionSectionProps) {
  const { t } = useTranslation()
  const document = useDocumentStore((s) => s.document)
  const addConnection = useDocumentStore((s) => s.addConnection)
  const removeConnection = useDocumentStore((s) => s.removeConnection)
  const updateConnection = useDocumentStore((s) => s.updateConnection)

  const [isAdding, setIsAdding] = useState(false)

  const connections = (document.connections ?? []).filter(
    (c) => c.sourceElementId === nodeId,
  )

  // Available target pages: all pages except current page and ERD pages
  const targetPages = (document.pages ?? []).filter(
    (p) => p.id !== pageId && p.type !== 'erd',
  )

  const handleAddTarget = (targetPageId: string) => {
    addConnection({
      sourceElementId: nodeId,
      sourcePageId: pageId,
      targetPageId,
      triggerEvent: 'click',
      transitionType: 'push',
    })
    setIsAdding(false)
  }

  const getPageName = (pid: string): string => {
    const page = (document.pages ?? []).find((p) => p.id === pid)
    return page?.name ?? t('connection.error.targetDeleted')
  }

  return (
    <div>
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

      <div className="flex flex-col gap-1.5 mt-1">
        {connections.map((conn) => (
          <ConnectionRow
            key={conn.id}
            connection={conn}
            pageName={getPageName(conn.targetPageId)}
            onUpdate={(updates) => updateConnection(conn.id, updates)}
            onRemove={() => removeConnection(conn.id)}
          />
        ))}

        {isAdding && (
          <div className="flex items-center gap-1">
            <Select onValueChange={handleAddTarget}>
              <SelectTrigger className="h-7 text-xs flex-1 min-w-0">
                <SelectValue placeholder={t('connection.selectScreen')} />
              </SelectTrigger>
              <SelectContent>
                {targetPages.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={() => setIsAdding(false)}
            >
              <Trash2 size={14} className="text-muted-foreground" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ConnectionRow — individual connection editor row
// ---------------------------------------------------------------------------

interface ConnectionRowProps {
  connection: ScreenConnection
  pageName: string
  onUpdate: (updates: Partial<ScreenConnection>) => void
  onRemove: () => void
}

function ConnectionRow({ connection, pageName, onUpdate, onRemove }: ConnectionRowProps) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-1 rounded border border-border p-1.5">
      {/* Target page name */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-foreground truncate flex-1">
          {pageName}
        </span>
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
