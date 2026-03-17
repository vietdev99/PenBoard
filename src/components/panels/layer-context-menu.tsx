import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Trash2,
  Copy,
  Group,
  Lock,
  EyeOff,
  Component,
  Unlink,
  SquaresUnite,
  SquaresSubtract,
  SquaresIntersect,
  PackagePlus,
  Database,
} from 'lucide-react'

interface LayerContextMenuProps {
  x: number
  y: number
  nodeId: string
  canGroup: boolean
  canBoolean: boolean
  canCreateComponent: boolean
  isReusable: boolean
  isInstance: boolean
  isContainer: boolean
  hasComponents: boolean
  isBindable: boolean
  hasBoundData: boolean
  onAction: (action: string) => void
  onClose: () => void
}

const MENU_ITEMS = [
  { action: 'duplicate', labelKey: 'common.duplicate', icon: Copy },
  { action: 'delete', labelKey: 'common.delete', icon: Trash2 },
  { action: 'group', labelKey: 'layerMenu.groupSelection', icon: Group, requireGroup: true },
  { action: 'boolean-union', labelKey: 'layerMenu.booleanUnion', icon: SquaresUnite, requireBoolean: true },
  { action: 'boolean-subtract', labelKey: 'layerMenu.booleanSubtract', icon: SquaresSubtract, requireBoolean: true },
  { action: 'boolean-intersect', labelKey: 'layerMenu.booleanIntersect', icon: SquaresIntersect, requireBoolean: true },
  { action: 'make-component', labelKey: 'layerMenu.createComponent', icon: Component, requireCreateComponent: true },
  { action: 'insert-instance', labelKey: 'layerMenu.insertInstance', icon: PackagePlus, requireReusable: true },
  { action: 'insert-from-components', labelKey: 'layerMenu.insertFromComponents', icon: PackagePlus, requireContainer: true, requireHasComponents: true },
  { action: 'detach-component', labelKey: 'layerMenu.detachComponent', icon: Unlink, requireReusable: true },
  { action: 'detach-component', labelKey: 'layerMenu.detachInstance', icon: Unlink, requireInstance: true },
  { action: 'bind-data', labelKey: 'layerMenu.bindToData', icon: Database, requireBindable: true },
  { action: 'unbind-data', labelKey: 'layerMenu.removeBinding', icon: Unlink, requireBoundData: true },
  { action: 'lock', labelKey: 'layerMenu.toggleLock', icon: Lock },
  { action: 'hide', labelKey: 'layerMenu.toggleVisibility', icon: EyeOff },
]

export default function LayerContextMenu({
  x,
  y,
  canGroup,
  canBoolean,
  canCreateComponent,
  isReusable,
  isInstance,
  isContainer,
  hasComponents,
  isBindable,
  hasBoundData,
  onAction,
  onClose,
}: LayerContextMenuProps) {
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

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-popover border border-border rounded-md shadow-lg py-1 min-w-[160px]"
      style={{ left: x, top: y }}
    >
      {MENU_ITEMS.filter(
        (item) =>
          (!item.requireGroup || canGroup) &&
          (!('requireBoolean' in item) || canBoolean) &&
          (!('requireCreateComponent' in item) || canCreateComponent) &&
          (!('requireReusable' in item) || isReusable) &&
          (!('requireInstance' in item) || isInstance) &&
          (!('requireContainer' in item) || isContainer) &&
          (!('requireHasComponents' in item) || hasComponents) &&
          (!('requireBindable' in item) || isBindable) &&
          (!('requireBoundData' in item) || hasBoundData),
      ).map((item) => (
        <button
          key={item.action}
          type="button"
          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-popover-foreground hover:bg-accent hover:text-foreground text-left"
          onClick={() => onAction(item.action)}
        >
          <item.icon size={12} />
          {t(item.labelKey)}
        </button>
      ))}
    </div>
  )
}
