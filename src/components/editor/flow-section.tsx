import { useEffect, useRef, useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import mermaid from 'mermaid'
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react'

interface FlowSectionProps {
  name: string
  title: string
  content: string
}

// Module-level render counter for unique mermaid IDs
let renderCounter = 0

/**
 * Parse markdown content into mermaid blocks and description text.
 * Extracts ```mermaid ... ``` blocks and keeps everything else as description.
 * Exported for unit testing.
 */
export function parseFlowContent(content: string): {
  mermaidBlocks: string[]
  description: string
} {
  const mermaidBlocks: string[] = []
  let inMermaid = false
  let currentBlock = ''
  const descLines: string[] = []
  const lines = content.split('\n')

  for (const line of lines) {
    if (line.trim() === '```mermaid') {
      inMermaid = true
      currentBlock = ''
    } else if (inMermaid && line.trim() === '```') {
      inMermaid = false
      mermaidBlocks.push(currentBlock.trim())
    } else if (inMermaid) {
      currentBlock += line + '\n'
    } else {
      descLines.push(line)
    }
  }

  // Remove H1 title from description (already shown as section header)
  const description = descLines
    .join('\n')
    .replace(/^#\s+.*/m, '')
    .trim()

  return { mermaidBlocks, description }
}

/** Zoomable mermaid diagram container */
function MermaidDiagram({ name, index, code }: { name: string; index: number; code: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const [renderError, setRenderError] = useState<string | null>(null)
  const [zoomEnabled, setZoomEnabled] = useState(false)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    let cancelled = false
    async function render() {
      const container = containerRef.current
      if (!container) return
      try {
        const id = `flow-${name}-${++renderCounter}`
        const { svg } = await mermaid.render(id, code)
        if (!cancelled && container) {
          container.innerHTML = svg
          const svgEl = container.querySelector('svg')
          if (svgEl) {
            svgEl.style.maxWidth = '100%'
            svgEl.style.height = 'auto'
          }
        }
      } catch (err) {
        if (!cancelled) {
          setRenderError(
            `Failed to render diagram: ${err instanceof Error ? err.message : String(err)}`,
          )
        }
      }
    }
    render()
    return () => { cancelled = true }
  }, [code, name])

  // Use native wheel listener with passive:false so preventDefault actually works
  // (React synthetic onWheel is passive by default → can't prevent page scroll)
  useEffect(() => {
    const el = viewportRef.current
    if (!el || !zoomEnabled) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setScale((prev) => {
        const delta = e.deltaY > 0 ? -0.1 : 0.1
        return Math.min(5, Math.max(0.2, prev + delta))
      })
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [zoomEnabled])

  const fitToView = useCallback(() => {
    setScale(1)
    setZoomEnabled(false)
  }, [])

  return (
    <div className="relative bg-card border border-border rounded-lg mb-4 overflow-hidden group">
      {/* Zoom toolbar */}
      <div className="absolute top-2 right-2 flex items-center gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => setZoomEnabled((p) => !p)}
          className={`p-1.5 rounded-md text-xs transition-colors ${
            zoomEnabled
              ? 'bg-primary text-primary-foreground'
              : 'bg-card/80 backdrop-blur text-muted-foreground hover:text-foreground border border-border'
          }`}
          title={zoomEnabled ? 'Disable zoom (scroll page)' : 'Enable zoom (scroll to zoom)'}
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        {zoomEnabled && (
          <>
            <button
              onClick={() => setScale((s) => Math.max(0.2, s - 0.2))}
              className="p-1.5 rounded-md bg-card/80 backdrop-blur text-muted-foreground hover:text-foreground border border-border transition-colors"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] text-muted-foreground min-w-[36px] text-center tabular-nums">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={fitToView}
              className="p-1.5 rounded-md bg-card/80 backdrop-blur text-muted-foreground hover:text-foreground border border-border transition-colors"
              title="Fit to view"
            >
              <Maximize className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>

      {/* Diagram viewport */}
      <div
        ref={viewportRef}
        className={`p-4 ${zoomEnabled ? 'cursor-grab' : 'overflow-x-auto'}`}
      >
        <div
          ref={containerRef}
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            transition: zoomEnabled ? 'none' : 'transform 0.2s ease',
          }}
        />
      </div>

      {renderError && (
        <div className="text-sm text-destructive bg-destructive/10 p-3 mx-4 mb-4 rounded-lg">
          {renderError}
        </div>
      )}
    </div>
  )
}

export default function FlowSection({ name, title, content }: FlowSectionProps) {
  const { mermaidBlocks, description } = parseFlowContent(content)

  return (
    <section id={`flow-${name}`} className="mb-8 scroll-mt-4">
      {/* Section header */}
      <h2 className="text-lg font-semibold text-foreground mb-4 pb-2 border-b border-border">
        {title}
      </h2>

      {/* Mermaid diagrams */}
      {mermaidBlocks.map((code, i) => (
        <MermaidDiagram key={`${name}-mermaid-${i}`} name={name} index={i} code={code} />
      ))}

      {/* Description text rendered as markdown */}
      {description && (
        <div className="prose prose-sm dark:prose-invert max-w-none text-foreground/80">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{description}</ReactMarkdown>
        </div>
      )}
    </section>
  )
}
