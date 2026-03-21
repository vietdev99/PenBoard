import { useState, useEffect } from 'react'
import { X, Copy, AlertTriangle } from 'lucide-react'

interface ErrorEntry {
  id: number
  message: string
  source?: string
  timestamp: number
}

let _listeners: ((entries: ErrorEntry[]) => void)[] = []
let _entries: ErrorEntry[] = []
let _nextId = 0

export function pushError(message: string, source?: string) {
  const entry: ErrorEntry = { id: _nextId++, message, source, timestamp: Date.now() }
  _entries = [..._entries, entry].slice(-5)
  _listeners.forEach((fn) => fn([..._entries]))
  setTimeout(() => {
    _entries = _entries.filter((e) => e.id !== entry.id)
    _listeners.forEach((fn) => fn([..._entries]))
  }, 15000)
}

// Install global handlers once
if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => {
    pushError(e.message || 'Unknown error', e.filename ? `${e.filename}:${e.lineno}` : undefined)
  })
  window.addEventListener('unhandledrejection', (e) => {
    const msg = e.reason instanceof Error ? e.reason.message : String(e.reason ?? 'Unhandled promise rejection')
    pushError(msg, 'Promise rejection')
  })
}

export default function ErrorToast() {
  const [entries, setEntries] = useState<ErrorEntry[]>([])

  useEffect(() => {
    const handler = (e: ErrorEntry[]) => setEntries(e)
    _listeners.push(handler)
    return () => { _listeners = _listeners.filter((fn) => fn !== handler) }
  }, [])

  if (entries.length === 0) return null

  return (
    <div className="fixed bottom-12 right-3 z-[99999] flex flex-col gap-2 max-w-[420px] pointer-events-none">
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="pointer-events-auto bg-card border border-destructive/30 rounded-lg shadow-lg p-3 animate-in slide-in-from-right-5 fade-in duration-200"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-destructive truncate">
                {entry.message}
              </p>
              {entry.source && (
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                  {entry.source}
                </p>
              )}
            </div>
            <div className="flex gap-1 shrink-0">
              <button
                onClick={() => navigator.clipboard.writeText(`${entry.message}\n${entry.source ?? ''}`)}
                className="p-1 rounded hover:bg-accent text-muted-foreground"
                title="Copy error"
              >
                <Copy className="w-3 h-3" />
              </button>
              <button
                onClick={() => {
                  _entries = _entries.filter((e) => e.id !== entry.id)
                  _listeners.forEach((fn) => fn([..._entries]))
                }}
                className="p-1 rounded hover:bg-accent text-muted-foreground"
                title="Dismiss"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
