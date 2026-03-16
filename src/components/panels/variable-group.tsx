import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VariableGroupProps {
  title: string
  count: number
  defaultOpen?: boolean
  children: React.ReactNode
}

export default function VariableGroup({ title, count, defaultOpen = true, children }: VariableGroupProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="mb-1">
      <button
        className="flex items-center gap-1 w-full px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <ChevronRight className={cn('h-3 w-3 transition-transform', isOpen && 'rotate-90')} />
        <span>{title}</span>
        <span className="ml-auto text-[10px] opacity-60">{count}</span>
      </button>
      {isOpen && (
        <div className="pl-1">
          {children}
        </div>
      )}
    </div>
  )
}
