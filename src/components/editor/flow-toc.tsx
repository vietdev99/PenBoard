import { FileText, PanelLeftClose, PanelLeft } from 'lucide-react'

interface FlowTOCProps {
  items: { name: string; title: string }[]
  collapsed: boolean
  onToggle: () => void
  activeFlow?: string
}

export default function FlowTOC({ items, collapsed, onToggle, activeFlow }: FlowTOCProps) {
  if (items.length === 0) return null

  return (
    <div
      className={`shrink-0 border-r border-border bg-card transition-[width] duration-200 ${collapsed ? 'w-10' : 'w-56'} flex flex-col`}
    >
      {/* Toggle button */}
      <button
        onClick={onToggle}
        className="flex items-center justify-center h-10 hover:bg-accent/50 transition-colors text-muted-foreground hover:text-foreground"
        title={collapsed ? 'Show sidebar' : 'Hide sidebar'}
      >
        {collapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
      </button>

      {/* Content (hidden when collapsed) */}
      {!collapsed && (
        <nav className="flex-1 overflow-y-auto px-2 pb-4">
          <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">
            Flows
          </h2>
          <ul className="space-y-0.5">
            {items.map((item) => (
              <li key={item.name}>
                <a
                  href={`#flow-${item.name}`}
                  className={`flex items-center gap-2 text-[13px] px-2 py-1.5 rounded-md transition-colors ${
                    activeFlow === item.name
                      ? 'bg-accent text-foreground font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  }`}
                  onClick={(e) => {
                    e.preventDefault()
                    const el = document.getElementById(`flow-${item.name}`)
                    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                >
                  <FileText className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{item.title}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  )
}
