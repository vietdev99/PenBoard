import { useDocumentStore } from '@/stores/document-store'
import { useCanvasStore } from '@/stores/canvas-store'
import SectionHeader from '@/components/shared/section-header'
import NumberInput from '@/components/shared/number-input'
import ColorPicker from '@/components/shared/color-picker'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RotateCcw, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { findNodeInTree } from '@/stores/document-tree-utils'
import type { RefNode, FrameNode, ComponentArgument } from '@/types/pen'

interface ArgumentValuesSectionProps {
  instanceNode: RefNode
}

export default function ArgumentValuesSection({ instanceNode }: ArgumentValuesSectionProps) {
  const getNodeById = useDocumentStore((s) => s.getNodeById)
  const setArgumentValue = useDocumentStore((s) => s.setArgumentValue)
  const removeArgumentValue = useDocumentStore((s) => s.removeArgumentValue)
  const pages = useDocumentStore((s) => s.document.pages) ?? []

  // Look up the source component to get argument definitions
  const component = getNodeById(instanceNode.ref) as FrameNode | undefined
  const args = component?.arguments
  // Even if no arguments, we still show the navigate button

  const values = instanceNode.argumentValues ?? {}

  // Navigate to source component page
  const handleNavigateToSource = () => {
    for (const page of pages) {
      const found = findNodeInTree(page.children, instanceNode.ref)
      if (found) {
        useCanvasStore.getState().clearSelection()
        useCanvasStore.getState().exitAllFrames()
        useCanvasStore.getState().setActivePageId(page.id)
        requestAnimationFrame(() => {
          useCanvasStore.getState().setSelection([instanceNode.ref], instanceNode.ref)
        })
        return
      }
    }
  }

  const renderInput = (arg: ComponentArgument) => {
    const currentValue = values[arg.id] ?? arg.defaultValue

    switch (arg.type) {
      case 'text':
        return (
          <Input
            value={String(currentValue)}
            onChange={(e) => setArgumentValue(instanceNode.id, arg.id, e.target.value)}
            className="h-7 text-xs"
            placeholder={String(arg.defaultValue)}
          />
        )
      case 'number':
        return (
          <NumberInput
            value={Number(currentValue)}
            onChange={(v) => setArgumentValue(instanceNode.id, arg.id, v)}
          />
        )
      case 'boolean':
        return (
          <Switch
            checked={Boolean(currentValue)}
            onCheckedChange={(checked) => setArgumentValue(instanceNode.id, arg.id, checked)}
          />
        )
      case 'select':
        return (
          <Select
            value={String(currentValue)}
            onValueChange={(v) => setArgumentValue(instanceNode.id, arg.id, v)}
          >
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(arg.options ?? []).map((opt) => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      case 'color':
        return (
          <ColorPicker
            value={String(currentValue)}
            onChange={(color) => setArgumentValue(instanceNode.id, arg.id, color)}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-2">
      {/* Navigate to source button — per user decision: "Navigate button on instances: Show modal navigate" */}
      <div className="flex items-center gap-2">
        <SectionHeader title={args && args.length > 0 ? 'Arguments' : 'Component Instance'} />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 ml-auto flex-shrink-0"
              onClick={handleNavigateToSource}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Navigate to source component</TooltipContent>
        </Tooltip>
      </div>

      {/* Argument value inputs */}
      {args && args.map((arg) => (
        <div key={arg.id} className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground w-20 truncate flex-shrink-0">
            {arg.name}
          </span>
          <div className="flex-1 min-w-0">
            {renderInput(arg)}
          </div>
          {values[arg.id] !== undefined && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 flex-shrink-0"
              onClick={() => removeArgumentValue(instanceNode.id, arg.id)}
              title="Reset to default"
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          )}
        </div>
      ))}
    </div>
  )
}
