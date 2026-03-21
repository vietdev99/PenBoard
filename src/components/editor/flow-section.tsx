import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeHighlight from 'rehype-highlight'
import mermaid from 'mermaid'
import { ZoomIn, ZoomOut, Maximize, Maximize2, Minimize2 } from 'lucide-react'

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
  const [fullscreen, setFullscreen] = useState(false)

  // Close fullscreen on Escape
  useEffect(() => {
    if (!fullscreen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [fullscreen])

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

  const toggleFullscreen = useCallback(() => {
    setFullscreen((p) => !p)
    // Reset zoom when entering fullscreen for clean view
    if (!fullscreen) {
      setScale(1)
      setZoomEnabled(true)
    }
  }, [fullscreen])

  const toolbarBtnClass =
    'p-1.5 rounded-md bg-card/80 backdrop-blur text-muted-foreground hover:text-foreground border border-border transition-colors'

  const toolbar = (
    <div className={`absolute top-2 right-2 flex items-center gap-1 z-10 ${fullscreen ? '' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
      <button
        onClick={() => setZoomEnabled((p) => !p)}
        className={`p-1.5 rounded-md text-xs transition-colors ${
          zoomEnabled
            ? 'bg-primary text-primary-foreground'
            : toolbarBtnClass
        }`}
        title={zoomEnabled ? 'Disable zoom' : 'Enable zoom'}
      >
        <ZoomIn className="w-3.5 h-3.5" />
      </button>
      {zoomEnabled && (
        <>
          <button
            onClick={() => setScale((s) => Math.max(0.2, s - 0.2))}
            className={toolbarBtnClass}
            title="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] text-muted-foreground min-w-[36px] text-center tabular-nums">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={fitToView}
            className={toolbarBtnClass}
            title="Fit to view"
          >
            <Maximize className="w-3.5 h-3.5" />
          </button>
        </>
      )}
      <div className="w-px h-4 bg-border mx-0.5" />
      <button
        onClick={toggleFullscreen}
        className={toolbarBtnClass}
        title={fullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
      >
        {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
      </button>
    </div>
  )

  return (
    <div
      className={
        fullscreen
          ? 'fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col'
          : 'relative bg-card border border-border rounded-lg my-4 overflow-hidden group'
      }
    >
      <div className={fullscreen ? 'relative flex-1 flex flex-col min-h-0' : ''}>
        {toolbar}
        <div
          ref={viewportRef}
          className={`${fullscreen ? 'flex-1 overflow-auto' : ''} p-4 ${zoomEnabled ? 'cursor-grab' : 'overflow-x-auto'}`}
        >
          <div
            ref={containerRef}
            style={{
              transform: `scale(${scale})`,
              transformOrigin: fullscreen ? 'top center' : 'top left',
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
    </div>
  )
}

/** Detect mermaid content by first-line keyword */
const MERMAID_KEYWORDS =
  /^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|mindmap|timeline|journey|gitGraph|sankey|xychart|block-beta|kanban)\b/

function isMermaidContent(code: string): boolean {
  const firstLine = code.trimStart().split('\n')[0].trim()
  return MERMAID_KEYWORDS.test(firstLine)
}

/** Custom code block renderer: handles mermaid as diagrams, rest as highlighted code */
function CodeBlock({ name, children, className }: { name: string; children: ReactNode; className?: string }) {
  const lang = className?.replace(/^.*language-/, '') ?? ''
  const code = String(children).replace(/\n$/, '')

  if (lang === 'mermaid' || isMermaidContent(code)) {
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

/** Wrap bare mermaid blocks (no code fence) in ```mermaid fences */
function wrapBareMermaid(text: string): string {
  const lines = text.split('\n')
  const result: string[] = []
  let inFence = false

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()

    // Track code fence state
    if (trimmed.startsWith('```')) {
      inFence = !inFence
      result.push(lines[i])
      continue
    }

    // If outside code fence and line starts with a mermaid keyword, wrap the block
    if (!inFence && MERMAID_KEYWORDS.test(trimmed)) {
      result.push('```mermaid')
      result.push(lines[i])
      let j = i + 1
      // Collect until blank line, heading, or another code fence
      while (j < lines.length) {
        const next = lines[j].trim()
        if (next === '' || next.startsWith('#') || next.startsWith('```')) break
        result.push(lines[j])
        j++
      }
      result.push('```')
      i = j - 1
      continue
    }

    result.push(lines[i])
  }

  return result.join('\n')
}

export default function FlowSection({ name, title, content }: FlowSectionProps) {
  // Strip H1 title from content (already shown as section header)
  const cleanContent = wrapBareMermaid(content.replace(/^#\s+.*/m, '').trim())

  return (
    <section id={`flow-${name}`} className="mb-8 scroll-mt-4">
      <h2 className="text-lg font-semibold text-foreground mb-4 pb-2 border-b border-border">
        {title}
      </h2>

      <div className="prose prose-sm dark:prose-invert max-w-none text-foreground/80
        prose-headings:text-foreground prose-headings:font-semibold
        prose-h2:text-base prose-h2:border-b prose-h2:border-border prose-h2:pb-2 prose-h2:mb-4
        prose-h3:text-sm prose-h3:mb-2
        prose-strong:text-foreground prose-strong:font-semibold
        prose-a:text-primary prose-a:no-underline hover:prose-a:underline
        prose-code:text-[13px] prose-code:text-foreground/90 prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:font-normal prose-code:before:content-none prose-code:after:content-none
        prose-pre:bg-[#0d1117] prose-pre:border prose-pre:border-border prose-pre:rounded-lg
        prose-table:text-sm
        [&_table]:border [&_table]:border-border [&_table]:rounded-lg [&_table]:overflow-hidden
        [&_thead]:bg-muted/50
        [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:text-foreground [&_th]:border-b [&_th]:border-border
        [&_td]:px-3 [&_td]:py-2 [&_td]:border-b [&_td]:border-border/50 [&_td]:text-foreground/80
        [&_tr:last-child_td]:border-b-0
        [&_tr:hover_td]:bg-muted/30
        prose-blockquote:border-l-primary/50 prose-blockquote:text-muted-foreground prose-blockquote:bg-muted/30 prose-blockquote:rounded-r-lg prose-blockquote:py-1
        prose-li:marker:text-muted-foreground
        prose-img:rounded-lg prose-img:border prose-img:border-border
        prose-hr:border-border">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex, rehypeHighlight]}
          components={{
            code({ className: codeClassName, children, ...props }) {
              // Detect block code: has language- class or hljs class or contains newlines
              const codeStr = String(children)
              const isBlock =
                codeClassName?.includes('language-') ||
                codeClassName?.includes('hljs') ||
                codeStr.includes('\n')
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
