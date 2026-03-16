import { useState, useCallback } from 'react'
import { Plus, Trash2, GripVertical, Unlink } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useDocumentStore } from '@/stores/document-store'
import { useCanvasStore } from '@/stores/canvas-store'
import SectionHeader from '@/components/shared/section-header'
import NumberInput from '@/components/shared/number-input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { FrameNode, ComponentArgument, ArgumentBinding } from '@/types/pen'

/** Allowed binding properties per argument type (whitelist approach) */
export const BINDABLE_PROPERTIES: Record<
  ComponentArgument['type'],
  { value: string; label: string }[]
> = {
  text: [
    { value: 'content', label: 'Text Content' },
    { value: 'name', label: 'Name' },
  ],
  number: [
    { value: 'width', label: 'Width' },
    { value: 'height', label: 'Height' },
    { value: 'opacity', label: 'Opacity' },
    { value: 'fontSize', label: 'Font Size' },
    { value: 'gap', label: 'Gap' },
  ],
  boolean: [{ value: 'visible', label: 'Visible' }],
  select: [{ value: 'variant', label: 'Variant' }],
  color: [
    { value: 'fill.0.color', label: 'Fill Color' },
    { value: 'stroke.fill.0.color', label: 'Stroke Color' },
  ],
}

const ARG_TYPE_OPTIONS: { value: ComponentArgument['type']; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'select', label: 'Select' },
  { value: 'color', label: 'Color' },
]

interface ArgumentSectionProps {
  node: FrameNode
}

export default function ArgumentSection({ node }: ArgumentSectionProps) {
  const { t } = useTranslation()
  const addArgument = useDocumentStore((s) => s.addArgument)
  const removeArgument = useDocumentStore((s) => s.removeArgument)
  const updateArgument = useDocumentStore((s) => s.updateArgument)
  const removeArgumentBinding = useDocumentStore((s) => s.removeArgumentBinding)
  const getNodeById = useDocumentStore((s) => s.getNodeById)
  const setDragConnectState = useCanvasStore((s) => s.setDragConnectState)

  const args = node.arguments ?? []
  const bindings = node.argumentBindings ?? {}

  const handleAdd = useCallback(() => {
    addArgument(node.id, {
      name: `arg${args.length + 1}`,
      type: 'text',
      defaultValue: '',
    })
  }, [addArgument, node.id, args.length])

  return (
    <div className="space-y-1.5">
      <SectionHeader
        title={t('property.componentArguments', 'Component Arguments')}
        actions={
          <Button variant="ghost" size="icon-sm" onClick={handleAdd}>
            <Plus className="w-3.5 h-3.5" />
          </Button>
        }
      />

      {args.length === 0 && (
        <p className="text-[10px] text-muted-foreground italic px-0.5">
          {t('property.noArguments', 'No arguments defined')}
        </p>
      )}

      {args.map((arg) => (
        <ArgumentRow
          key={arg.id}
          arg={arg}
          nodeId={node.id}
          bindings={bindings[arg.id] ?? []}
          updateArgument={updateArgument}
          removeArgument={removeArgument}
          removeArgumentBinding={removeArgumentBinding}
          getNodeById={getNodeById}
          setDragConnectState={setDragConnectState}
        />
      ))}
    </div>
  )
}

// --- Argument Row ---

interface ArgumentRowProps {
  arg: ComponentArgument
  nodeId: string
  bindings: ArgumentBinding[]
  updateArgument: (nodeId: string, argId: string, updates: Partial<ComponentArgument>) => void
  removeArgument: (nodeId: string, argId: string) => void
  removeArgumentBinding: (
    nodeId: string,
    argId: string,
    targetNodeId: string,
    targetProperty: string,
  ) => void
  getNodeById: (id: string) => import('@/types/pen').PenNode | undefined
  setDragConnectState: (state: import('@/stores/canvas-store').DragConnectState | null) => void
}

function ArgumentRow({
  arg,
  nodeId,
  bindings,
  updateArgument,
  removeArgument,
  removeArgumentBinding,
  getNodeById,
  setDragConnectState,
}: ArgumentRowProps) {
  const [editingName, setEditingName] = useState(false)
  const [localName, setLocalName] = useState(arg.name)

  const handleNameBlur = () => {
    setEditingName(false)
    const trimmed = localName.trim()
    if (trimmed && trimmed !== arg.name) {
      updateArgument(nodeId, arg.id, { name: trimmed })
    }
  }

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
    if (e.key === 'Escape') {
      setEditingName(false)
      setLocalName(arg.name)
    }
  }

  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault()
    setDragConnectState({
      sourceNodeId: nodeId,
      argId: arg.id,
      argType: arg.type,
      startX: e.clientX,
      startY: e.clientY,
    })
  }

  return (
    <div className="rounded border border-border/60 bg-secondary/30">
      {/* Main row: drag handle, name, type, delete */}
      <div className="flex items-center gap-0.5 px-1 py-0.5">
        {/* Drag handle for connecting */}
        <button
          type="button"
          className="cursor-grab text-muted-foreground hover:text-purple-400 shrink-0 p-0.5"
          title="Drag to canvas element to bind"
          onMouseDown={handleDragStart}
        >
          <GripVertical className="w-3 h-3" />
        </button>

        {/* Name */}
        {editingName ? (
          <input
            type="text"
            value={localName}
            onChange={(e) => setLocalName(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={handleNameKeyDown}
            className="text-[10px] font-medium w-16 min-w-0 bg-secondary rounded px-1 py-0.5 border border-ring focus:outline-none text-foreground"
            autoFocus
          />
        ) : (
          <span
            className="text-[10px] font-medium truncate cursor-text min-w-0 flex-1 text-foreground"
            onClick={() => {
              setLocalName(arg.name)
              setEditingName(true)
            }}
          >
            {arg.name}
          </span>
        )}

        {/* Type */}
        <Select
          value={arg.type}
          onValueChange={(type) =>
            updateArgument(nodeId, arg.id, {
              type: type as ComponentArgument['type'],
              defaultValue: getDefaultForType(type as ComponentArgument['type']),
            })
          }
        >
          <SelectTrigger className="h-5 text-[10px] w-16 min-w-0 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ARG_TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Delete */}
        <Button
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          onClick={() => removeArgument(nodeId, arg.id)}
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>

      {/* Default value row */}
      <div className="px-1.5 pb-1">
        <DefaultValueEditor
          arg={arg}
          nodeId={nodeId}
          updateArgument={updateArgument}
        />
      </div>

      {/* Bindings */}
      {bindings.length > 0 && (
        <div className="border-t border-border/40 px-1.5 py-0.5 space-y-0.5">
          {bindings.map((binding) => {
            const targetNode = getNodeById(binding.targetNodeId)
            const targetName = targetNode?.name ?? targetNode?.type ?? binding.targetNodeId
            return (
              <div
                key={`${binding.targetNodeId}:${binding.targetProperty}`}
                className="flex items-center gap-1 text-[9px] text-muted-foreground"
              >
                <span className="text-purple-400/70 shrink-0">-&gt;</span>
                <span className="truncate flex-1">
                  {targetName} : {binding.targetProperty}
                </span>
                <button
                  type="button"
                  className="p-0.5 rounded hover:bg-accent/50 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() =>
                    removeArgumentBinding(
                      nodeId,
                      arg.id,
                      binding.targetNodeId,
                      binding.targetProperty,
                    )
                  }
                >
                  <Unlink className="w-2.5 h-2.5" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// --- Default Value Editor ---

interface DefaultValueEditorProps {
  arg: ComponentArgument
  nodeId: string
  updateArgument: (nodeId: string, argId: string, updates: Partial<ComponentArgument>) => void
}

function DefaultValueEditor({ arg, nodeId, updateArgument }: DefaultValueEditorProps) {
  const [localText, setLocalText] = useState(String(arg.defaultValue))

  const handleTextBlur = () => {
    if (localText !== String(arg.defaultValue)) {
      updateArgument(nodeId, arg.id, { defaultValue: localText })
    }
  }

  switch (arg.type) {
    case 'text':
      return (
        <input
          type="text"
          value={localText}
          onChange={(e) => setLocalText(e.target.value)}
          onBlur={handleTextBlur}
          placeholder="Default text"
          className="w-full h-5 text-[10px] bg-secondary rounded px-1.5 border border-transparent hover:border-input focus:border-ring focus:outline-none text-foreground"
        />
      )

    case 'number':
      return (
        <NumberInput
          value={typeof arg.defaultValue === 'number' ? arg.defaultValue : 0}
          onChange={(val) => updateArgument(nodeId, arg.id, { defaultValue: val })}
          className="h-5 text-[10px]"
        />
      )

    case 'boolean':
      return (
        <div className="flex items-center gap-1.5 h-5">
          <span className="text-[9px] text-muted-foreground">Default:</span>
          <Switch
            checked={arg.defaultValue === true}
            onCheckedChange={(checked) =>
              updateArgument(nodeId, arg.id, { defaultValue: checked })
            }
            className="h-3.5 w-7 [&>span]:h-2.5 [&>span]:w-2.5 data-[state=checked]:[&>span]:translate-x-3.5"
          />
        </div>
      )

    case 'select':
      return (
        <input
          type="text"
          value={localText}
          onChange={(e) => setLocalText(e.target.value)}
          onBlur={() => {
            const options = localText.split(',').map((s) => s.trim()).filter(Boolean)
            updateArgument(nodeId, arg.id, {
              defaultValue: options[0] ?? '',
              options,
            })
          }}
          placeholder="option1, option2, ..."
          className="w-full h-5 text-[10px] bg-secondary rounded px-1.5 border border-transparent hover:border-input focus:border-ring focus:outline-none text-foreground"
        />
      )

    case 'color':
      return (
        <div className="flex items-center gap-1 h-5">
          <input
            type="color"
            value={typeof arg.defaultValue === 'string' && arg.defaultValue.startsWith('#') ? arg.defaultValue : '#3b82f6'}
            onChange={(e) => updateArgument(nodeId, arg.id, { defaultValue: e.target.value })}
            className="w-5 h-4 rounded border border-border cursor-pointer p-0"
          />
          <span className="text-[9px] text-muted-foreground font-mono">
            {String(arg.defaultValue) || '#3b82f6'}
          </span>
        </div>
      )

    default:
      return null
  }
}

// --- Helpers ---

function getDefaultForType(type: ComponentArgument['type']): string | number | boolean {
  switch (type) {
    case 'text': return ''
    case 'number': return 0
    case 'boolean': return false
    case 'select': return ''
    case 'color': return '#3b82f6'
  }
}
