import { useEffect, useRef, useState } from 'react'

/**
 * Subscribe to a Zustand store with requestIdleCallback scheduling.
 * Panel updates are deferred to idle time, preventing them from competing
 * with canvas rendering for main thread time.
 *
 * Usage:
 * ```tsx
 * const pages = useIdleSelector(useDocumentStore, s => s.document.pages)
 * ```
 */
export function useIdleSelector<S, T>(
  store: { subscribe: (fn: () => void) => () => void; getState: () => S },
  selector: (state: S) => T,
  equalityFn?: (a: T, b: T) => boolean,
): T {
  const [value, setValue] = useState(() => selector(store.getState()))
  const selectorRef = useRef(selector)
  const equalityRef = useRef(equalityFn)
  selectorRef.current = selector
  equalityRef.current = equalityFn

  useEffect(() => {
    let idleHandle: number | null = null
    const unsub = store.subscribe(() => {
      if (idleHandle !== null) return
      idleHandle = requestIdleCallback(() => {
        idleHandle = null
        const next = selectorRef.current(store.getState())
        setValue((prev) => {
          if (equalityRef.current) return equalityRef.current(prev, next) ? prev : next
          return prev === next ? prev : next
        })
      })
    })
    return () => {
      unsub()
      if (idleHandle !== null) cancelIdleCallback(idleHandle)
    }
  }, [store])

  return value
}
