import { useState, useMemo } from 'react'
import { FileText, PanelLeftClose, PanelLeft, ChevronRight } from 'lucide-react'

interface FlowTOCProps {
  items: { group: string; name: string; title: string }[]
  collapsed: boolean
  onToggle: () => void
  activeFlow?: string
}

function groupFlows(items: FlowTOCProps['items']): Map<string, FlowTOCProps['items']> {
  const map = new Map<string, FlowTOCProps['items']>()
  for (const item of items) {
    const group = item.group || 'general'
    if (!map.has(group)) map.set(group, [])
    map.get(group)!.push(item)
  }
  // Sort: alphabetical, "general" last
  return new Map(
    [...map.entries()].sort(([a], [b]) => {
      if (a === 'general') return 1
      if (b === 'general') return -1
      return a.localeCompare(b)
    }),
  )
}

export default function FlowTOC({ items, collapsed, onToggle, activeFlow }: FlowTOCProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  const grouped = useMemo(() => groupFlows(items), [items])

  const toggleGroup = (groupName: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupName)) {
        next.delete(groupName)
      } else {
        next.add(groupName)
      }
      return next
    })
  }

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
          {[...grouped.entries()].map(([groupName, groupItems]) => (
            <div key={groupName} className="mb-2">
              <button
                onClick={() => toggleGroup(groupName)}
                className="flex items-center gap-1.5 w-full px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
              >
                <ChevronRight className={`w-3 h-3 transition-transform ${!collapsedGroups.has(groupName) ? 'rotate-90' : ''}`} />
                <span className="capitalize">{groupName}</span>
                <span className="text-[10px] ml-auto opacity-60">{groupItems.length}</span>
              </button>
              {!collapsedGroups.has(groupName) && (
                <ul className="space-y-0.5 ml-2">
                  {groupItems.map((item) => (
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
              )}
            </div>
          ))}
        </nav>
      )}
    </div>
  )
}
