import { useCallback, useRef, useEffect } from 'react'
import { useDocumentStore } from '@/stores/document-store'
import { useCanvasStore } from '@/stores/canvas-store'
import { nanoid } from 'nanoid'

/** Detect Electron environment via preload bridge. */
function isElectronEnv(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!(window as any).electronAPI?.isElectron
  )
}

/**
 * React hook for opening and managing interactive preview tabs.
 *
 * - POSTs the current document data to the Nitro preview endpoint
 * - Opens the preview in a new browser tab (or default browser in Electron)
 * - Subscribes to document changes for hot reload via debounced re-POST (500ms)
 */
export function usePreview() {
  const previewIdRef = useRef<string>(nanoid(8))
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const postPreviewData = useCallback(async () => {
    const doc = useDocumentStore.getState().document
    const { activePageId, selection } = useCanvasStore.getState()
    if (!doc) return

    // Only screen pages are previewable (skip ERD, component pages)
    const activePage = doc.pages?.find((p) => p.id === activePageId)
    if (activePage && activePage.type && activePage.type !== 'screen') return

    // Determine preview scope: selected frame if exactly 1 selected, else null
    const selectedFrameId =
      selection.selectedIds.length === 1 ? selection.selectedIds[0] : null

    const baseUrl = window.location.origin
    try {
      await fetch(`${baseUrl}/api/preview/data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: previewIdRef.current,
          doc,
          activePageId,
          selectedFrameId,
        }),
      })
    } catch (err) {
      console.error('[Preview] Failed to POST preview data:', err)
    }
  }, [])

  const openPreview = useCallback(async () => {
    await postPreviewData()

    const baseUrl = window.location.origin
    const previewUrl = `${baseUrl}/api/preview/${previewIdRef.current}`

    if (isElectronEnv()) {
      ;(window as any).electronAPI?.openExternal?.(previewUrl)
    } else {
      window.open(previewUrl, `preview-${previewIdRef.current}`)
    }
  }, [postPreviewData])

  // Subscribe to document changes for hot reload (debounced 500ms)
  useEffect(() => {
    const unsub = useDocumentStore.subscribe(() => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        postPreviewData()
      }, 500)
    })
    return () => {
      unsub()
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [postPreviewData])

  return { openPreview, previewId: previewIdRef.current }
}
