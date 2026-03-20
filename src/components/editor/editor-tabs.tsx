import { useCanvasStore, type EditorTab } from '@/stores/canvas-store'
import { cn } from '@/lib/utils'
import { Pen, GitBranch } from 'lucide-react'

const tabs: { id: EditorTab; label: string; icon: typeof Pen }[] = [
  { id: 'canvas', label: 'Canvas', icon: Pen },
  { id: 'flow', label: 'Flow', icon: GitBranch },
]

export default function EditorTabs() {
  const activeTab = useCanvasStore((s) => s.activeEditorTab)
  const setTab = useCanvasStore((s) => s.setActiveEditorTab)

  return (
    <div className="h-8 bg-card border-b border-border flex items-center gap-1 px-3 shrink-0">
      {tabs.map((tab) => {
        const Icon = tab.icon
        return (
          <button
            key={tab.id}
            className={cn(
              'flex items-center gap-1.5 text-xs px-3 py-1 rounded-md transition-colors',
              activeTab === tab.id
                ? 'bg-accent text-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
            )}
            onClick={() => setTab(tab.id)}
          >
            <Icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
