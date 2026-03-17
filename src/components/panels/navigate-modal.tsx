import { useState, useMemo } from 'react'
import { useDocumentStore } from '@/stores/document-store'
import { X, Monitor, Database, Component, Search, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PenPage } from '@/types/pen'

interface NavigateModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (targetPageId: string, targetFrameId?: string) => void
  /** Exclude ERD pages from targets (connections are screen-to-screen) */
  excludeErd?: boolean
}

export default function NavigateModal({ isOpen, onClose, onSelect, excludeErd = true }: NavigateModalProps) {
  const pages = useDocumentStore((s) => s.document.pages) ?? []
  const [activeTab, setActiveTab] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // Filter pages: exclude ERD pages per ERD exclusion rule from Phase 2
  const targetPages = pages.filter(p => {
    if (excludeErd && p.type === 'erd') return false
    return true
  })

  // If no activeTab set, default to first page
  const currentTabId = activeTab ?? targetPages[0]?.id ?? null
  const currentPage = targetPages.find(p => p.id === currentTabId)

  // Get frames from current page, filtered by search
  const frames = useMemo(() => {
    if (!currentPage) return []
    return (currentPage.children ?? [])
      .filter(n => n.type === 'frame')
      .filter(n => !search || (n.name ?? '').toLowerCase().includes(search.toLowerCase()))
  }, [currentPage, search])

  if (!isOpen) return null

  const getPageIcon = (page: PenPage) => {
    if (page.type === 'component') return <Component className="h-3 w-3 text-purple-400" />
    if (page.type === 'erd') return <Database className="h-3 w-3 text-emerald-400" />
    return <Monitor className="h-3 w-3" />
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-lg shadow-xl w-[480px] max-h-[400px] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-sm font-medium">Navigate to...</span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              className="w-full pl-7 pr-3 py-1.5 text-sm bg-background border border-border rounded"
              placeholder="Search frames..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Page tabs (vertical sidebar) */}
          <div className="w-40 border-r border-border overflow-y-auto flex-shrink-0">
            {targetPages.map((page) => (
              <button
                key={page.id}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-accent transition-colors',
                  page.id === currentTabId && 'bg-accent text-accent-foreground',
                )}
                onClick={() => { setActiveTab(page.id); setSearch('') }}
              >
                {getPageIcon(page)}
                <span className="truncate">{page.name}</span>
              </button>
            ))}
          </div>

          {/* Frame list */}
          <div className="flex-1 overflow-y-auto p-2">
            {/* Page-level target (navigate to page without specific frame) */}
            {currentPage && (
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded hover:bg-accent transition-colors mb-1 border border-dashed border-border"
                onClick={() => {
                  onSelect(currentPage.id)
                  onClose()
                }}
              >
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="font-medium">{currentPage.name}</span>
                <span className="text-muted-foreground ml-auto">(whole page)</span>
              </button>
            )}

            {frames.length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-4">
                No frames found
              </div>
            )}

            {frames.map((frame) => (
              <button
                key={frame.id}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded hover:bg-accent transition-colors"
                onClick={() => {
                  onSelect(currentPage!.id, frame.id)
                  onClose()
                }}
              >
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="truncate">{frame.name ?? 'Frame'}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
