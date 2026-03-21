import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeHighlight from 'rehype-highlight'
import mermaid from 'mermaid'
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react'

// KaTeX styles for math rendering
import 'katex/dist/katex.min.css'
// Highlight.js theme (github-dark matches our dark UI)
import 'highlight.js/styles/github-dark.min.css'

interface FlowSectionProps {
  name: string
  title: string
  content: string
}

// Module-level render counter for unique mermaid IDs
let renderCounter = 0

/** Zoomable mermaid diagram container */
function MermaidDiagram({ name, code }: { name: string; code: string }) {
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
    <div className="relative bg-card border border-border rounded-lg my-4 overflow-hidden group">
      <div className="absolute top-2 right-2 flex items-center gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => setZoomEnabled((p) => !p)}
          className={`p-1.5 rounded-md text-xs transition-colors ${
            zoomEnabled
              ? 'bg-primary text-primary-foreground'
              : 'bg-card/80 backdrop-blur text-muted-foreground hover:text-foreground border border-border'
          }`}
          title={zoomEnabled ? 'Disable zoom' : 'Enable zoom'}
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

/** Custom code block renderer: handles mermaid as diagrams, rest as highlighted code */
function CodeBlock({ name, children, className }: { name: string; children: ReactNode; className?: string }) {
  const lang = className?.replace('language-', '') ?? ''
  const code = String(children).replace(/\n$/, '')

  if (lang === 'mermaid') {
    return <MermaidDiagram name={name} code={code} />
  }

  return (
    <div className="relative group/code my-2">
      <pre className={`${className ?? ''} rounded-lg overflow-x-auto`}>
        <code className={className}>{children}</code>
      </pre>
      {lang && (
        <span className="absolute top-2 right-2 text-[10px] text-muted-foreground/50 uppercase opacity-0 group-hover/code:opacity-100 transition-opacity">
          {lang}
        </span>
      )}
    </div>
  )
}

export default function FlowSection({ name, title, content }: FlowSectionProps) {
  // Strip H1 title from content (already shown as section header)
  const cleanContent = content.replace(/^#\s+.*/m, '').trim()

  return (
    <section id={`flow-${name}`} className="mb-8 scroll-mt-4">
      <h2 className="text-lg font-semibold text-foreground mb-4 pb-2 border-b border-border">
        {title}
      </h2>

      <div className="prose prose-sm dark:prose-invert max-w-none text-foreground/80
        prose-headings:text-foreground prose-strong:text-foreground
        prose-a:text-primary prose-a:no-underline hover:prose-a:underline
        prose-code:text-foreground/90 prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
        prose-pre:bg-[#0d1117] prose-pre:border prose-pre:border-border
        prose-table:border-border prose-th:border-border prose-td:border-border
        prose-blockquote:border-l-primary/50 prose-blockquote:text-muted-foreground
        prose-img:rounded-lg prose-img:border prose-img:border-border
        prose-hr:border-border">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex, rehypeHighlight]}
          components={{
            code({ className: codeClassName, children, ...props }) {
              // Inline code (no language class) → render normally
              const isBlock = codeClassName?.startsWith('language-')
              if (!isBlock) {
                return <code className={codeClassName} {...props}>{children}</code>
              }
              // Block code → delegate to CodeBlock (handles mermaid + syntax highlight)
              return <CodeBlock name={name} className={codeClassName}>{children}</CodeBlock>
            },
            // Unwrap <pre> since CodeBlock handles its own <pre>
            pre({ children }) {
              return <>{children}</>
            },
          }}
        >
          {cleanContent}
        </ReactMarkdown>
      </div>
    </section>
  )
}
