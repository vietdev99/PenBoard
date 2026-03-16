import { useTranslation } from 'react-i18next'
import NumberInput from '@/components/shared/number-input'
import VariablePicker from '@/components/shared/variable-picker'
import { isVariableRef } from '@/variables/resolve-variables'
import type { PenNode } from '@/types/pen'
import { RotateCw } from 'lucide-react'

interface SizeSectionProps {
  node: PenNode
  onUpdate: (updates: Partial<PenNode>) => void
  hasCornerRadius?: boolean
  cornerRadius?: number | [number, number, number, number]
  hideWH?: boolean
}

export default function SizeSection({
  node,
  onUpdate,
  hasCornerRadius,
  cornerRadius,
  hideWH,
}: SizeSectionProps) {
  const { t } = useTranslation()
  const x = node.x ?? 0
  const y = node.y ?? 0
  const rotation = node.rotation ?? 0

  const rawWidth = 'width' in node ? (node as unknown as Record<string, unknown>).width : undefined
  const width = typeof rawWidth === 'number' ? rawWidth : undefined
  const widthIsBound = typeof rawWidth === 'string' && isVariableRef(rawWidth)

  const rawHeight = 'height' in node ? (node as unknown as Record<string, unknown>).height : undefined
  const height = typeof rawHeight === 'number' ? rawHeight : undefined
  const heightIsBound = typeof rawHeight === 'string' && isVariableRef(rawHeight)

  const rawCornerRadius = cornerRadius
  const cornerRadiusValue =
    typeof rawCornerRadius === 'number'
      ? rawCornerRadius
      : Array.isArray(rawCornerRadius)
        ? rawCornerRadius[0]
        : 0

  return (
    <div className="space-y-3">
    <span className=" text-[11px] font-medium text-foreground ">
          {t('size.position')}
      </span>
    <div className="grid grid-cols-2 gap-1">

      <NumberInput
        label="X"
        value={Math.round(x)}
        onChange={(v) => onUpdate({ x: v })}
      />
      <NumberInput
        label="Y"
        value={Math.round(y)}
        onChange={(v) => onUpdate({ y: v })}
      />
      {!hideWH && (width !== undefined || widthIsBound) && (
        <div className="flex items-center gap-0.5">
          <NumberInput
            label="W"
            value={width !== undefined ? Math.round(width) : 0}
            onChange={(v) =>
              onUpdate({ width: v } as Partial<PenNode>)
            }
            min={1}
          />
          <VariablePicker
            type="number"
            currentValue={widthIsBound ? String(rawWidth) : undefined}
            onBind={(ref) => onUpdate({ width: ref } as unknown as Partial<PenNode>)}
            onUnbind={(val) => onUpdate({ width: Number(val) } as Partial<PenNode>)}
          />
        </div>
      )}
      {!hideWH && (height !== undefined || heightIsBound) && (
        <div className="flex items-center gap-0.5">
          <NumberInput
            label="H"
            value={height !== undefined ? Math.round(height) : 0}
            onChange={(v) =>
              onUpdate({ height: v } as Partial<PenNode>)
            }
            min={1}
          />
          <VariablePicker
            type="number"
            currentValue={heightIsBound ? String(rawHeight) : undefined}
            onBind={(ref) => onUpdate({ height: ref } as unknown as Partial<PenNode>)}
            onUnbind={(val) => onUpdate({ height: Number(val) } as Partial<PenNode>)}
          />
        </div>
      )}
      <NumberInput
        icon={<RotateCw />}
        value={Math.round(rotation)}
        onChange={(v) => onUpdate({ rotation: v })}
        suffix="°"
      />
      {hasCornerRadius && (
        <div className="flex items-center gap-0.5">
          <NumberInput
            label="R"
            value={cornerRadiusValue}
            onChange={(v) =>
              onUpdate({ cornerRadius: v } as Partial<PenNode>)
            }
            min={0}
          />
          <VariablePicker
            type="number"
            currentValue={typeof cornerRadius === 'number' ? cornerRadius : undefined}
            onBind={(ref) => onUpdate({ cornerRadius: ref } as unknown as Partial<PenNode>)}
            onUnbind={(val) => onUpdate({ cornerRadius: Number(val) } as Partial<PenNode>)}
          />
        </div>
      )}
    </div>
    </div>
  )
}
