import { useState, useMemo } from 'react'
import { ChevronDown, ChevronRight, Component } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useDocumentStore } from '@/stores/document-store'
import { useCanvasStore } from '@/stores/canvas-store'
import { flattenNodes } from '@/stores/document-tree-utils'
import type { PenNode } from '@/types/pen'
import { cn } from '@/lib/utils'

/**
 * Shows reusable components from all pages (especially Components pages)
 * in the sidebar when on a screen page. Components are draggable onto the canvas.
 */
export default function ComponentListSection() {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(true)
  const doc = useDocumentStore((s) => s.document)
  const activePageId = useCanvasStore((s) => s.activePageId)

  // Get current page type
  const activePage = doc.pages?.find((p) => p.id === activePageId)
  const isScreenPage = !activePage?.type || activePage.type === 'screen'

  // Collect all reusable components from all pages
  const components = useMemo(() => {
    const allPages = doc.pages ?? []
    const allChildren = allPages.flatMap((p) => p.children ?? []).concat(doc.children ?? [])
    return flattenNodes(allChildren).filter(
      (n: PenNode) => 'reusable' in n && n.reusable === true,
    )
  }, [doc])

  // Only show on screen pages and when components exist
  if (!isScreenPage || components.length === 0) return null

  const handleDragStart = (e: React.DragEvent, componentId: string) => {
    e.dataTransfer.setData(
      'application/x-penboard-component',
      JSON.stringify({ componentId }),
    )
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div className="flex flex-col border-t border-border">
      {/* Header */}
      <button
        type="button"
        className="h-8 flex items-center px-3 gap-1 hover:bg-accent/50 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? (
          <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
        )}
        <span className="text-xs font-medium text-muted-foreground tracking-wider">
          {t('componentList.title')}
        </span>
        <span className="text-[10px] text-muted-foreground/60 ml-auto">
          {components.length}
        </span>
      </button>

      {/* Component list */}
      {expanded && (
        <div className="py-1 px-1">
          {components.map((node) => (
            <div
              key={node.id}
              draggable
              onDragStart={(e) => handleDragStart(e, node.id)}
              className={cn(
                'group w-full flex items-center h-7 px-2 rounded-md text-xs select-none transition-colors cursor-grab active:cursor-grabbing',
                'text-muted-foreground hover:text-foreground hover:bg-accent/50',
              )}
            >
              <Component className="w-3 h-3 shrink-0 mr-1.5 text-purple-400" />
              <span className="flex-1 text-left truncate">{node.name ?? node.type}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
