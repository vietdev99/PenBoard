import { useEffect, useRef } from 'react'
import { useDocumentStore } from '@/stores/document-store'
import { syncCanvasPositionsToStore } from '@/canvas/skia-engine-ref'
import { writeToFilePath, writeToFileHandle, isElectron } from '@/utils/file-operations'

const AUTO_SAVE_DELAY = 3000 // 3 seconds after last change

/**
 * Auto-save hook: saves document 3 seconds after the last change.
 * Only saves when a file path or handle exists (won't show "Save As" dialogs).
 */
export function useAutoSave() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const unsub = useDocumentStore.subscribe((state, prevState) => {
      // Only react to actual document content changes
      if (state.document === prevState.document) return
      if (!state.isDirty) return

      // Must have a save target — don't trigger dialogs
      const hasSaveTarget = isElectron()
        ? !!state.filePath
        : !!state.fileHandle
      if (!hasSaveTarget) return

      // Reset debounce timer
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(async () => {
        const { document: doc, filePath, fileHandle, isDirty, markClean } =
          useDocumentStore.getState()
        if (!doc || !isDirty) return

        try {
          syncCanvasPositionsToStore()
        } catch { /* continue */ }

        try {
          if (isElectron() && filePath) {
            await writeToFilePath(filePath, doc)
            markClean()
          } else if (fileHandle) {
            await writeToFileHandle(fileHandle, doc)
            markClean()
          }
        } catch (err) {
          console.error('[AutoSave] Failed:', err)
        }
      }, AUTO_SAVE_DELAY)
    })

    return () => {
      unsub()
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])
}
