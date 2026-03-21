import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useFlowData } from '@/hooks/use-flow-data'
import FlowTOC from './flow-toc'
import FlowSection from './flow-section'
import { RefreshCw, FileText } from 'lucide-react'

export default function FlowView() {
  const { flows, loading, error, refresh } = useFlowData()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [activeFlow, setActiveFlow] = useState<string | undefined>()
  const scrollRef = useRef<HTMLDivElement>(null)

  const grouped = useMemo(() => {
    const map = new Map<string, typeof flows>()
    for (const flow of flows) {
      const g = flow.group || 'general'
      if (!map.has(g)) map.set(g, [])
      map.get(g)!.push(flow)
    }
    return new Map(
      [...map.entries()].sort(([a], [b]) => {
        if (a === 'general') return 1
        if (b === 'general') return -1
        return a.localeCompare(b)
      }),
    )
  }, [flows])

  // Track which flow section is visible during scroll
  const handleScroll = useCallback(() => {
    if (!scrollRef.current || flows.length === 0) return
    const container = scrollRef.current
    const containerTop = container.getBoundingClientRect().top

    // Find the last section whose top edge is at or above the container's top + offset
    for (let i = flows.length - 1; i >= 0; i--) {
      const el = document.getElementById(`flow-${flows[i].name}`)
      if (el) {
        const elTop = el.getBoundingClientRect().top - containerTop
        if (elTop <= 80) {
          setActiveFlow(flows[i].name)
          return
        }
      }
    }
    setActiveFlow(flows[0]?.name)
  }, [flows])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => el.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left sidebar TOC */}
      {flows.length > 0 && (
        <FlowTOC
          items={flows.map((f) => ({ group: f.group, name: f.name, title: f.title }))}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((p) => !p)}
          activeFlow={activeFlow}
        />
      )}

      {/* Main content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-background">
        <div className="px-6 py-6">
          {/* Header with refresh button */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-lg font-semibold text-foreground">Flows</h1>
            <button
              onClick={refresh}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              title="Refresh flows from workspace"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Loading state */}
          {loading && flows.length === 0 && (
            <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
              Loading flows...
            </div>
          )}

          {/* Error state */}
          {error && !loading && flows.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <FileText className="w-10 h-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground mb-1">No workspace linked</p>
              <p className="text-xs text-muted-foreground/70 max-w-sm">
                Save this document to disk first, then use MCP tools (write_flow) to create business
                flow diagrams in the .penboard/flows/ directory.
              </p>
            </div>
          )}

          {/* Empty state (no error, no flows) */}
          {!loading && !error && flows.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <FileText className="w-10 h-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground mb-1">No flows yet</p>
              <p className="text-xs text-muted-foreground/70 max-w-sm">
                Use MCP tools (write_flow) to create business flow diagrams. They will appear here
                as rendered mermaid diagrams.
              </p>
            </div>
          )}

          {/* Flow sections */}
          {[...grouped.entries()].map(([groupName, groupFlows]) => (
            <div key={groupName} className="mb-10">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 capitalize">
                {groupName}
              </h2>
              {groupFlows.map((flow) => (
                <FlowSection key={flow.name} name={flow.name} title={flow.title} content={flow.content} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
