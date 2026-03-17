import { useState, useEffect, useRef, useMemo } from 'react'
import { Search, Component, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useDocumentStore } from '@/stores/document-store'
import { flattenNodes } from '@/stores/document-tree-utils'
import type { PenNode } from '@/types/pen'

interface ComponentPickerDialogProps {
  open: boolean
  targetNodeId: string
  onClose: () => void
  onInsert: (componentId: string) => void
}

export default function ComponentPickerDialog({
  open,
  targetNodeId,
  onClose,
  onInsert,
}: ComponentPickerDialogProps) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const dialogRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const doc = useDocumentStore((s) => s.document)

  const components = useMemo(() => {
    const allPages = doc.pages ?? []
    const allChildren = allPages.flatMap((p) => p.children ?? []).concat(doc.children ?? [])
    return flattenNodes(allChildren).filter(
      (n: PenNode) => 'reusable' in n && n.reusable === true && n.id !== targetNodeId,
    )
  }, [doc, targetNodeId])

  const filtered = useMemo(() => {
    if (!search.trim()) return components
    const q = search.toLowerCase()
    return components.filter((n) => (n.name ?? n.type).toLowerCase().includes(q))
  }, [components, search])

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const handleClick = (e: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKey)
    document.addEventListener('mousedown', handleClick)
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.removeEventListener('mousedown', handleClick)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        ref={dialogRef}
        className="bg-popover border border-border rounded-lg shadow-xl w-[320px] max-h-[400px] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-sm font-medium text-foreground">
            {t('layerMenu.insertFromComponents')}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground rounded transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-border">
          <div className="flex items-center gap-2 px-2 py-1.5 bg-muted rounded-md">
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              type="text"
              className="flex-1 bg-transparent text-xs text-foreground placeholder-muted-foreground outline-none min-w-0"
              placeholder={t('common.search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Component list */}
        <div className="flex-1 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4 px-3">
              {components.length === 0
                ? t('componentPicker.noComponents')
                : t('componentPicker.noResults')}
            </p>
          ) : (
            filtered.map((node) => (
              <button
                key={node.id}
                type="button"
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-popover-foreground hover:bg-accent transition-colors text-left"
                onClick={() => onInsert(node.id)}
              >
                <Component className="w-3.5 h-3.5 shrink-0 text-purple-400" />
                <span className="truncate">{node.name ?? node.type}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
