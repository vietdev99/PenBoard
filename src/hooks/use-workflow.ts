import { useState, useEffect, useCallback, useRef } from 'react'
import { useDocumentStore } from '@/stores/document-store'
import { useCanvasStore } from '@/stores/canvas-store'
import { buildWorkflowGraph, filterGraphByFocus } from '@/services/workflow/graph-builder'
import { generateMermaid } from '@/services/workflow/mermaid-generator'

/**
 * Reactive workflow diagram hook.
 * Subscribes to document changes (connections, entities, pages) and active page.
 * Produces mermaid text with optional focus mode filtering.
 * Debounced at 500ms to avoid excessive regeneration.
 */
export function useWorkflow() {
  const [mermaidText, setMermaidText] = useState('')
  const [focusMode, setFocusMode] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const focusModeRef = useRef(focusMode)
  focusModeRef.current = focusMode

  const regenerate = useCallback(() => {
    setIsLoading(true)

    // Clear previous debounce
    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(() => {
      try {
        const doc = useDocumentStore.getState().document
        if (!doc) {
          setMermaidText('graph LR\n  empty["No document loaded"]')
          setIsLoading(false)
          return
        }

        let graph = buildWorkflowGraph(doc)

        if (focusModeRef.current) {
          const activePageId = useCanvasStore.getState().activePageId
          if (activePageId) {
            graph = filterGraphByFocus(graph, activePageId)
          }
        }

        const text = generateMermaid(graph)
        setMermaidText(text)
      } catch (err) {
        console.error('[useWorkflow] Error generating diagram:', err)
        setMermaidText('graph LR\n  error["Error generating diagram"]')
      }
      setIsLoading(false)
    }, 500)
  }, [])

  // Subscribe to document + page changes
  useEffect(() => {
    regenerate()

    // Subscribe to document store changes
    let prevDocKey = ''
    const unsubDoc = useDocumentStore.subscribe((state) => {
      const doc = state.document
      const key = JSON.stringify({
        conn: doc?.connections?.length ?? 0,
        ent: doc?.dataEntities?.length ?? 0,
        pages: doc?.pages?.map((p) => p.id + p.name).join(',') ?? '',
      })
      if (key !== prevDocKey) {
        prevDocKey = key
        regenerate()
      }
    })

    // Subscribe to active page changes
    let prevPageId = useCanvasStore.getState().activePageId
    const unsubPage = useCanvasStore.subscribe((state) => {
      if (state.activePageId !== prevPageId) {
        prevPageId = state.activePageId
        if (focusModeRef.current) regenerate()
      }
    })

    return () => {
      unsubDoc()
      unsubPage()
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [regenerate])

  // Re-generate when focus mode toggles
  useEffect(() => {
    regenerate()
  }, [focusMode, regenerate])

  const toggleFocus = useCallback(() => setFocusMode((prev) => !prev), [])

  return { mermaidText, focusMode, toggleFocus, isLoading, regenerate }
}
