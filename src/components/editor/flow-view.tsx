import { useFlowData } from '@/hooks/use-flow-data'
import FlowTOC from './flow-toc'
import FlowSection from './flow-section'
import { RefreshCw, FileText } from 'lucide-react'

export default function FlowView() {
  const { flows, loading, error, refresh } = useFlowData()

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="max-w-4xl mx-auto px-6 py-6">
        {/* Header with refresh button */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-semibold text-foreground">Business Flows</h1>
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
              Use MCP tools (write_flow) to create business flow diagrams. They will appear here as
              rendered mermaid diagrams.
            </p>
          </div>
        )}

        {/* Flow content */}
        {flows.length > 0 && (
          <>
            <FlowTOC items={flows.map((f) => ({ name: f.name, title: f.title }))} />
            {flows.map((flow) => (
              <FlowSection
                key={flow.name}
                name={flow.name}
                title={flow.title}
                content={flow.content}
              />
            ))}
          </>
        )}
      </div>
    </div>
  )
}
