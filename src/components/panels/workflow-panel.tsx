import { useEffect, useRef, useState, useCallback } from 'react'
import { useCanvasStore } from '@/stores/canvas-store'
import { useDocumentStore } from '@/stores/document-store'
import { useWorkflow } from '@/hooks/use-workflow'
import { exportMermaid, exportSVG, exportPNG } from '@/services/workflow/workflow-export'
import mermaid from 'mermaid'

// Initialize mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  flowchart: { curve: 'basis', padding: 20 },
  securityLevel: 'loose',
})

export default function WorkflowPanel() {
  const { mermaidText, focusMode, toggleFocus, isLoading } = useWorkflow()
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGElement | null>(null)
  const [panelHeight, setPanelHeight] = useState(250)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 })
  const wrapperRef = useRef<HTMLDivElement>(null)
  const renderCounter = useRef(0)

  // Render mermaid diagram and auto-fit
  useEffect(() => {
    if (!containerRef.current || !wrapperRef.current || !mermaidText) return

    const render = async () => {
      try {
        const id = `workflow-${++renderCounter.current}`
        const { svg } = await mermaid.render(id, mermaidText)
        if (containerRef.current) {
          containerRef.current.innerHTML = svg
          const svgEl = containerRef.current.querySelector('svg')
          if (svgEl) {
            svgRef.current = svgEl
            // Let SVG be its natural size for proper fitting
            svgEl.style.maxWidth = 'none'
            svgEl.style.maxHeight = 'none'

            // Auto-fit: compute scale to fit in wrapper
            requestAnimationFrame(() => {
              if (!wrapperRef.current || !svgEl) return
              const wrapperRect = wrapperRef.current.getBoundingClientRect()
              const svgW = svgEl.getBoundingClientRect().width
              const svgH = svgEl.getBoundingClientRect().height
              if (svgW > 0 && svgH > 0) {
                const scaleX = (wrapperRect.width - 32) / svgW
                const scaleY = (wrapperRect.height - 16) / svgH
                const fitScale = Math.min(scaleX, scaleY, 1) // never zoom in beyond 1x
                setZoom(fitScale)
                // Center horizontally
                const scaledW = svgW * fitScale
                const centerX = Math.max(0, (wrapperRect.width - scaledW) / 2)
                setPan({ x: centerX, y: 8 })
              }
            })
          }
        }
      } catch (err) {
        console.error('[WorkflowPanel] Mermaid render error:', err)
        if (containerRef.current) {
          containerRef.current.innerHTML = '<p style="color:#999;padding:16px">Failed to render diagram</p>'
        }
      }
    }

    render()
  }, [mermaidText])

  // Click-to-navigate: click page node → navigate
  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    // Mermaid wraps node content in <g> with class "node"
    const nodeG = target.closest('.node') as SVGGElement | null
    if (!nodeG) return

    const nodeId = nodeG.id?.replace(/^flowchart-/, '').replace(/-\d+$/, '')
    if (!nodeId) return

    // Un-sanitize ID (replace _ back, try to find page)
    const doc = useDocumentStore.getState().document
    if (!doc) return

    // Find matching page
    const page = doc.pages?.find((p) =>
      p.id === nodeId || p.id.replace(/[^a-zA-Z0-9_]/g, '_') === nodeId,
    )
    if (page) {
      useCanvasStore.getState().setActivePageId(page.id)
      return
    }

    // Find matching entity → go to ERD page
    const entity = doc.dataEntities?.find((e) =>
      e.id === nodeId || e.id.replace(/[^a-zA-Z0-9_]/g, '_') === nodeId,
    )
    if (entity) {
      const erdPage = doc.pages?.find((p) => p.type === 'erd')
      if (erdPage) useCanvasStore.getState().setActivePageId(erdPage.id)
    }
  }, [])

  // Zoom: scroll to zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    setZoom((prev) => Math.max(0.1, Math.min(5, prev - e.deltaY * 0.001)))
  }, [])

  // Pan: drag to pan
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    setIsPanning(true)
    panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y }
  }, [pan])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return
    setPan({
      x: panStart.current.panX + (e.clientX - panStart.current.x),
      y: panStart.current.panY + (e.clientY - panStart.current.y),
    })
  }, [isPanning])

  const handleMouseUp = useCallback(() => setIsPanning(false), [])

  // Fit to view
  const fitToView = useCallback(() => {
    if (!wrapperRef.current || !svgRef.current) {
      setZoom(1)
      setPan({ x: 0, y: 0 })
      return
    }
    const wrapperRect = wrapperRef.current.getBoundingClientRect()
    const svgW = svgRef.current.getBoundingClientRect().width / zoom
    const svgH = svgRef.current.getBoundingClientRect().height / zoom
    if (svgW > 0 && svgH > 0) {
      const scaleX = (wrapperRect.width - 32) / svgW
      const scaleY = (wrapperRect.height - 16) / svgH
      const fitScale = Math.min(scaleX, scaleY, 1)
      setZoom(fitScale)
      const scaledW = svgW * fitScale
      const centerX = Math.max(0, (wrapperRect.width - scaledW) / 2)
      setPan({ x: centerX, y: 8 })
    }
  }, [zoom])

  // Resize drag
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startY = e.clientY
    const startH = panelHeight

    const onMove = (ev: MouseEvent) => {
      const newH = Math.max(150, Math.min(window.innerHeight * 0.5, startH - (ev.clientY - startY)))
      setPanelHeight(newH)
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [panelHeight])

  // Export handlers
  const handleExportMermaid = useCallback(async () => {
    await exportMermaid(mermaidText)
  }, [mermaidText])

  const handleExportSVG = useCallback(() => {
    if (svgRef.current) exportSVG(svgRef.current)
  }, [])

  const handleExportPNG = useCallback(async () => {
    if (svgRef.current) await exportPNG(svgRef.current)
  }, [])

  return (
    <div
      className="border-t border-border bg-background flex flex-col"
      style={{ height: panelHeight }}
    >
      {/* Resize handle */}
      <div
        className="h-1 cursor-row-resize hover:bg-primary/30 transition-colors"
        onMouseDown={handleResizeStart}
      />

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border shrink-0">
        <span className="text-xs font-semibold text-foreground">Workflow</span>
        <div className="flex-1" />

        {isLoading && <span className="text-[10px] text-muted-foreground">Updating...</span>}

        <button
          onClick={toggleFocus}
          className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
            focusMode
              ? 'bg-primary/10 border-primary text-primary'
              : 'border-border text-muted-foreground hover:text-foreground'
          }`}
          title={focusMode ? 'Focus: active page + neighbors' : 'Full project view'}
        >
          {focusMode ? 'Focus ✓' : 'Focus'}
        </button>

        <button
          onClick={fitToView}
          className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground transition-colors"
          title="Fit to view"
        >
          Fit
        </button>

        <div className="w-px h-3 bg-border" />

        <button
          onClick={handleExportMermaid}
          className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground transition-colors"
          title="Copy mermaid to clipboard"
        >
          Mermaid
        </button>
        <button
          onClick={handleExportSVG}
          className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground transition-colors"
          title="Download SVG"
        >
          SVG
        </button>
        <button
          onClick={handleExportPNG}
          className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground transition-colors"
          title="Download PNG"
        >
          PNG
        </button>

        <div className="w-px h-3 bg-border" />

        <button
          onClick={() => useCanvasStore.getState().setWorkflowPanelOpen(false)}
          className="text-[10px] text-muted-foreground hover:text-foreground"
          title="Close workflow panel"
        >
          ✕
        </button>
      </div>

      {/* Diagram area */}
      <div
        ref={wrapperRef}
        className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
      >
        <div
          ref={containerRef}
          className="w-full h-full"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'top left',
          }}
        />
      </div>
    </div>
  )
}
