/**
 * Module-level singleton reference to the active SkiaEngine instance.
 * Set by SkiaCanvas on mount, cleared on unmount.
 * Allows external code (keyboard shortcuts, AI orchestrator, etc.) to call
 * engine methods like zoomToFitContent() without prop-drilling.
 */

import type { SkiaEngine } from './skia/skia-engine'
import { useCanvasStore } from '@/stores/canvas-store'

let _engine: SkiaEngine | null = null

export function setSkiaEngineRef(engine: SkiaEngine | null) {
  _engine = engine
}

export function getSkiaEngineRef(): SkiaEngine | null {
  return _engine
}

/**
 * Zoom and pan so all document content fits in the visible canvas area.
 * Delegates to the active SkiaEngine instance.
 */
export function zoomToFitContent() {
  _engine?.zoomToFitContent()
}

/** Pan (and optionally zoom) so a specific node is centered in the viewport. */
export function panToNode(nodeId: string) {
  _engine?.panToNode(nodeId)
}

/**
 * Returns the canvas element dimensions in CSS pixels.
 * Falls back to 800x600 if no engine is mounted.
 */
export function getCanvasSize(): { width: number; height: number } {
  return _engine?.getCanvasSize() ?? { width: 800, height: 600 }
}

/**
 * No-op — with the Skia engine, document-store is always in sync.
 * Previously needed for Fabric.js where canvas objects held authoritative positions.
 */
export function syncCanvasPositionsToStore() {
  // Skia engine writes positions directly to document-store during interactions.
  // No sync needed before save.
}

/**
 * Load a document with progress UI: shows modal status through each phase
 * (Opening → Processing → Drawing) and waits for the canvas to actually render
 * before dismissing the modal. Used by file-open, drag-drop, Figma import, etc.
 */
export function loadDocumentWithProgress(loadFn: () => void, fileName: string) {
  const setFileLoading = useCanvasStore.getState().setFileLoading
  setFileLoading({ open: true, name: fileName, status: 'Opening file...' })

  // Yield to browser paint so the modal renders before heavy sync work
  setTimeout(() => {
    try {
      setFileLoading({ open: true, name: fileName, status: 'Processing document...' })
      loadFn()
      setFileLoading({ open: true, name: fileName, status: 'Drawing graphics...' })

      // Wait for syncFromDocument to process (triggered by Zustand subscription)
      // then wait for the subsequent render to complete before dismissing modal.
      // Use 2 RAFs: first waits for syncFromDocument, second waits for render.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (_engine) {
            _engine.onNextRender(() => {
              zoomToFitContent()
              requestAnimationFrame(() => useCanvasStore.getState().setFileLoading(null))
            })
            // Force a fresh render cycle in case dirty flag was already consumed
            _engine.markDirty()
          } else {
            requestAnimationFrame(() => {
              zoomToFitContent()
              useCanvasStore.getState().setFileLoading(null)
            })
          }
        })
      })
    } catch (err) {
      console.error('[loadDocumentWithProgress] Error:', err)
      useCanvasStore.getState().setFileLoading(null)
    }
  }, 50)
}

/**
 * Flag to skip depth-resolution on the next selection event.
 * Used by layer panel to programmatically select children without
 * auto-resolving them to their parent group.
 */
let _skipNextDepthResolve = false
export function setSkipNextDepthResolve() {
  _skipNextDepthResolve = true
}
export function consumeSkipNextDepthResolve(): boolean {
  const v = _skipNextDepthResolve
  _skipNextDepthResolve = false
  return v
}
