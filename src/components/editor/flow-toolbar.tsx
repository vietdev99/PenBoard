import { useCanvasStore } from '@/stores/canvas-store'
import { useDocumentStore } from '@/stores/document-store'
import { getSkiaEngineRef } from '@/canvas/skia-engine-ref'
import { Maximize2, X, Eye, EyeOff } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'

/**
 * Floating toolbar shown when a connection flow is highlighted.
 * Provides zoom-to-fit and focus (hide unrelated views) actions.
 */
export default function FlowToolbar() {
  const highlightedFlow = useCanvasStore((s) => s.highlightedFlow)
  const [focused, setFocused] = useState(false)
  const wasFocusedRef = useRef(false)

  // Clear engine hidden IDs when flow is dismissed externally (click node/empty space)
  useEffect(() => {
    if (!highlightedFlow && wasFocusedRef.current) {
      wasFocusedRef.current = false
      const engine = getSkiaEngineRef()
      if (engine && engine.flowHiddenIds) {
        engine.flowHiddenIds = null
        engine.syncFromDocument()
      }
    }
  }, [highlightedFlow])

  if (!highlightedFlow || highlightedFlow.nodeIds.length === 0) {
    if (focused) setFocused(false)
    return null
  }

  const { nodeIds, connectionIds } = highlightedFlow

  // Count unique root frames in the flow
  const docState = useDocumentStore.getState()
  const rootFrameIds = new Set<string>()
  for (const id of nodeIds) {
    let rootId = id
    let parent = docState.getParentOf(id)
    while (parent) {
      rootId = parent.id
      parent = docState.getParentOf(parent.id)
    }
    rootFrameIds.add(rootId)
  }

  const handleZoomToFit = () => {
    const engine = getSkiaEngineRef()
    if (engine) engine.zoomToFitNodes(nodeIds)
  }

  const handleFocus = () => {
    const next = !focused
    setFocused(next)
    wasFocusedRef.current = next

    const engine = getSkiaEngineRef()
    if (!engine) return

    if (next) {
      // Hide non-flow root frames by setting flowHiddenIds
      const allRootIds = engine.renderNodes
        .filter((rn) => !rn.clipRect)
        .map((rn) => rn.node.id)
      const hiddenIds = allRootIds.filter((id) => !rootFrameIds.has(id))
      engine.flowHiddenIds = new Set(hiddenIds)
      engine.syncFromDocument()
      // Zoom to fit after hiding
      requestAnimationFrame(() => engine.zoomToFitNodes(nodeIds))
    } else {
      engine.flowHiddenIds = null
      engine.syncFromDocument()
    }
  }

  const handleClose = () => {
    useCanvasStore.getState().setHighlightedFlow(null)
    setFocused(false)
    const engine = getSkiaEngineRef()
    if (engine && engine.flowHiddenIds) {
      engine.flowHiddenIds = null
      engine.syncFromDocument()
    }
  }

  return (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
      <div className="flex items-center gap-1.5 bg-card border border-border rounded-lg shadow-lg px-2 py-1 text-xs">
        <span className="text-muted-foreground px-1">
          {rootFrameIds.size} views, {connectionIds.length} connections
        </span>

        <div className="w-px h-4 bg-border" />

        <button
          onClick={handleZoomToFit}
          className="flex items-center gap-1 px-2 py-1 rounded hover:bg-accent text-foreground"
          title="Zoom to fit flow views"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span>Fit</span>
        </button>

        <button
          onClick={handleFocus}
          className={`flex items-center gap-1 px-2 py-1 rounded hover:bg-accent ${focused ? 'text-primary' : 'text-foreground'}`}
          title={focused ? 'Show all views' : 'Focus: hide unrelated views'}
        >
          {focused ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          <span>{focused ? 'Show All' : 'Focus'}</span>
        </button>

        <div className="w-px h-4 bg-border" />

        <button
          onClick={handleClose}
          className="p-1 rounded hover:bg-accent text-muted-foreground"
          title="Close flow view"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
