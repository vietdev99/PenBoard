import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { PackagePlus, Copy, Trash2, Lock, EyeOff } from 'lucide-react'
import { useDocumentStore } from '@/stores/document-store'
import { useCanvasStore } from '@/stores/canvas-store'
import { flattenNodes } from '@/stores/document-tree-utils'
import type { PenNode } from '@/types/pen'

interface CanvasContextMenuProps {
  x: number
  y: number
  nodeId: string | null
  isFrame: boolean
  frameId: string | null
  onInsertFromComponents: (targetId: string) => void
  onClose: () => void
}

export default function CanvasContextMenu({
  x,
  y,
  nodeId,
  isFrame,
  frameId,
  onInsertFromComponents,
  onClose,
}: CanvasContextMenuProps) {
  const { t } = useTranslation()
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  // Check if document has any reusable components
  const doc = useDocumentStore.getState().document
  const allPages = doc.pages ?? []
  const allChildren = allPages.flatMap((p) => p.children ?? []).concat(doc.children ?? [])
  const hasComponents = flattenNodes(allChildren).some(
    (n: PenNode) => 'reusable' in n && n.reusable === true,
  )

  const handleDuplicate = () => {
    if (!nodeId) return
    useDocumentStore.getState().duplicateNode(nodeId)
    onClose()
  }

  const handleDelete = () => {
    if (!nodeId) return
    useDocumentStore.getState().removeNode(nodeId)
    useCanvasStore.getState().clearSelection()
    onClose()
  }

  const handleToggleLock = () => {
    if (!nodeId) return
    useDocumentStore.getState().toggleLock(nodeId)
    onClose()
  }

  const handleToggleVisibility = () => {
    if (!nodeId) return
    useDocumentStore.getState().toggleVisibility(nodeId)
    onClose()
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-popover border border-border rounded-md shadow-lg py-1 min-w-[160px]"
      style={{ left: x, top: y }}
    >
      {nodeId && (
        <>
          <button
            type="button"
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-popover-foreground hover:bg-accent hover:text-foreground text-left"
            onClick={handleDuplicate}
          >
            <Copy size={12} />
            {t('common.duplicate')}
          </button>
          <button
            type="button"
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-popover-foreground hover:bg-accent hover:text-foreground text-left"
            onClick={handleDelete}
          >
            <Trash2 size={12} />
            {t('common.delete')}
          </button>
          <button
            type="button"
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-popover-foreground hover:bg-accent hover:text-foreground text-left"
            onClick={handleToggleLock}
          >
            <Lock size={12} />
            {t('layerMenu.toggleLock')}
          </button>
          <button
            type="button"
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-popover-foreground hover:bg-accent hover:text-foreground text-left"
            onClick={handleToggleVisibility}
          >
            <EyeOff size={12} />
            {t('layerMenu.toggleVisibility')}
          </button>
        </>
      )}
      {isFrame && hasComponents && (
        <>
          {nodeId && <div className="my-1 border-t border-border" />}
          <button
            type="button"
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-popover-foreground hover:bg-accent hover:text-foreground text-left"
            onClick={() => {
              if (frameId) onInsertFromComponents(frameId)
            }}
          >
            <PackagePlus size={12} />
            {t('layerMenu.insertFromComponents')}
          </button>
        </>
      )}
    </div>
  )
}
