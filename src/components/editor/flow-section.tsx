import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import mermaid from 'mermaid'

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

export default function FlowSection({ name, title, content }: FlowSectionProps) {
  const containerRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const [renderError, setRenderError] = useState<string | null>(null)
  const { mermaidBlocks, description } = parseFlowContent(content)

  useEffect(() => {
    let cancelled = false

    async function renderAll() {
      for (let i = 0; i < mermaidBlocks.length; i++) {
        const container = containerRefs.current.get(i)
        if (!container || cancelled) continue

        try {
          const id = `flow-${name}-${++renderCounter}`
          const { svg } = await mermaid.render(id, mermaidBlocks[i])
          if (!cancelled && container) {
            container.innerHTML = svg
            // Let SVG be its natural size
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
    }

    renderAll()
    return () => {
      cancelled = true
    }
  }, [mermaidBlocks, name])

  return (
    <section id={`flow-${name}`} className="mb-8 scroll-mt-4">
      {/* Section header */}
      <h2 className="text-lg font-semibold text-foreground mb-4 pb-2 border-b border-border">
        {title}
      </h2>

      {/* Mermaid diagrams */}
      {mermaidBlocks.map((_, i) => (
        <div
          key={`${name}-mermaid-${i}`}
          ref={(el) => {
            if (el) containerRefs.current.set(i, el)
            else containerRefs.current.delete(i)
          }}
          className="bg-card border border-border rounded-lg p-4 mb-4 overflow-x-auto"
        />
      ))}

      {renderError && (
        <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3 mb-4">
          {renderError}
        </div>
      )}

      {/* Description text rendered as markdown */}
      {description && (
        <div className="prose prose-sm dark:prose-invert max-w-none text-foreground/80">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{description}</ReactMarkdown>
        </div>
      )}
    </section>
  )
}
