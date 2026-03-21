import { readFile, writeFile, access } from 'node:fs/promises'
import { constants } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import type { PenDocument } from '../types/pen'
import { sanitizeObject } from './utils/sanitize'
import { PORT_FILE_DIR_NAME, PORT_FILE_NAME } from '@/constants/app'

const cache = new Map<string, { doc: PenDocument; mtime: number }>()

/** Special path indicating the MCP should operate on the live Electron canvas. */
export const LIVE_CANVAS_PATH = 'live://canvas'

/** Resolve filePath for MCP tools — defaults to live canvas when omitted. */
export function resolveDocPath(filePath?: string): string {
  if (!filePath || filePath === LIVE_CANVAS_PATH) return LIVE_CANVAS_PATH
  return resolve(filePath)
}

const PORT_FILE_PATH = join(homedir(), PORT_FILE_DIR_NAME, PORT_FILE_NAME)

// ---------------------------------------------------------------------------
// Sync URL discovery
// ---------------------------------------------------------------------------

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (err: unknown) {
    return (err as NodeJS.ErrnoException).code === 'EPERM' // process exists but we lack permission
  }
}

/** Cached host after successful probe (reset when PID changes). */
let _cachedSyncHost: string | null = null
let _cachedSyncPid: number | null = null

/** Read the port file and return the Nitro sync base URL, or null if unavailable.
 *  Probes both IPv4 (127.0.0.1) and IPv6 ([::1]) to handle Windows where Vite
 *  may bind only on IPv6. Caches the working host for subsequent calls. */
export async function getSyncUrl(): Promise<string | null> {
  try {
    const raw = await readFile(PORT_FILE_PATH, 'utf-8')
    const { port, pid } = JSON.parse(raw) as { port: number; pid: number }
    if (!isPidAlive(pid)) {
      _cachedSyncHost = null
      _cachedSyncPid = null
      return null
    }

    // Return cached result if PID hasn't changed
    if (_cachedSyncHost && _cachedSyncPid === pid) {
      return `http://${_cachedSyncHost}:${port}`
    }

    // Probe IPv4 then IPv6 — Vite on Windows often binds [::1] only
    for (const host of ['127.0.0.1', '[::1]']) {
      try {
        const res = await fetch(`http://${host}:${port}/`, {
          method: 'HEAD',
          signal: AbortSignal.timeout(1500),
        })
        // Any response (even 404) means the server is reachable
        if (res) {
          _cachedSyncHost = host
          _cachedSyncPid = pid
          return `http://${host}:${port}`
        }
      } catch { /* try next host */ }
    }

    // Fallback: return localhost and let caller handle errors
    return `http://localhost:${port}`
  } catch {
    return null
  }
}

/** Fetch the current document from the live Electron canvas. */
async function fetchLiveDocument(): Promise<PenDocument> {
  const syncUrl = await getSyncUrl()
  if (!syncUrl) {
    throw new Error(
      'No running PenBoard instance found. Start the Electron app or dev server first.',
    )
  }
  const res = await fetch(`${syncUrl}/api/mcp/document`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({} as Record<string, unknown>))
    throw new Error(
      (body as { error?: string }).error ?? `Failed to fetch live document: ${res.status}`,
    )
  }
  const data = (await res.json()) as { document: PenDocument }
  return data.document
}

/** Push document to the live Electron canvas. Fails silently if unavailable. */
async function pushLiveDocument(doc: PenDocument): Promise<void> {
  const syncUrl = await getSyncUrl()
  if (!syncUrl) return
  try {
    await fetch(`${syncUrl}/api/mcp/document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ document: doc }),
    })
  } catch {
    // Network error — Electron might have quit between check and request
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Validate that a parsed object looks like a PenDocument. */
function validate(doc: unknown): doc is PenDocument {
  if (!doc || typeof doc !== 'object') return false
  const d = doc as Record<string, unknown>
  // Accept docs with children array or pages array
  return typeof d.version === 'string' && (Array.isArray(d.children) || Array.isArray(d.pages))
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Read and parse a .op / .pen file, returning a PenDocument. Uses cache. */
export async function openDocument(filePath: string): Promise<PenDocument> {
  // Live canvas mode: always re-fetch from running Electron/dev server
  // to pick up user edits made in the UI since the last MCP call.
  if (filePath === LIVE_CANVAS_PATH) {
    const doc = await fetchLiveDocument()
    cache.set(LIVE_CANVAS_PATH, { doc, mtime: Date.now() })
    return doc
  }

  const cached = cache.get(filePath)
  if (cached) return cached.doc

  await access(filePath, constants.R_OK)
  const text = await readFile(filePath, 'utf-8')
  const raw = JSON.parse(text)
  const sanitized = sanitizeObject(raw)
  if (!validate(sanitized)) {
    throw new Error(`Invalid document format: ${filePath}`)
  }
  cache.set(filePath, { doc: sanitized, mtime: Date.now() })
  return sanitized
}

/** Create a new empty document (not saved to disk yet). */
export function createEmptyDocument(): PenDocument {
  return {
    version: '1.0.0',
    children: [],
  }
}

/** Write a PenDocument to disk and update cache. Also pushes to live canvas if available. */
export async function saveDocument(
  filePath: string,
  doc: PenDocument,
): Promise<void> {
  if (filePath === LIVE_CANVAS_PATH) {
    // Live canvas mode: push to Electron, no disk write
    cache.set(LIVE_CANVAS_PATH, { doc, mtime: Date.now() })
    await pushLiveDocument(doc)
    return
  }

  // File-based: write to disk (no indentation to minimize file size)
  const json = JSON.stringify(doc)
  await writeFile(filePath, json, 'utf-8')
  cache.set(filePath, { doc, mtime: Date.now() })

  // Also push to live canvas (dual-write so canvas updates even for file-based MCP use)
  await pushLiveDocument(doc)
}

/** Get document from cache (for tools that operate on the active doc). */
export function getCachedDocument(
  filePath: string,
): PenDocument | undefined {
  return cache.get(filePath)?.doc
}

/** Update the cached document in-memory (call saveDocument to persist). */
export function setCachedDocument(
  filePath: string,
  doc: PenDocument,
): void {
  cache.set(filePath, { doc, mtime: Date.now() })
}

/** Check if a file exists. */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK)
    return true
  } catch {
    return false
  }
}

/** Fetch the current selection from the live Electron canvas. */
export async function fetchLiveSelection(): Promise<{ selectedIds: string[]; activePageId: string | null }> {
  const syncUrl = await getSyncUrl()
  if (!syncUrl) {
    return { selectedIds: [], activePageId: null }
  }
  try {
    const res = await fetch(`${syncUrl}/api/mcp/selection`)
    if (!res.ok) return { selectedIds: [], activePageId: null }
    return (await res.json()) as { selectedIds: string[]; activePageId: string | null }
  } catch {
    return { selectedIds: [], activePageId: null }
  }
}

/** Get the file path of the currently cached document, if file-based. */
export function getCachedFilePath(): string | undefined {
  for (const [path] of cache) {
    if (path !== LIVE_CANVAS_PATH) return path
  }
  return undefined
}

/** Fetch the file path of the currently open document from the live canvas Nitro server. */
export async function fetchLiveFilePath(): Promise<string | null> {
  const syncUrl = await getSyncUrl()
  if (!syncUrl) return null
  try {
    const res = await fetch(`${syncUrl}/api/mcp/document`)
    if (!res.ok) return null
    const data = (await res.json()) as { filePath?: string | null }
    return data.filePath ?? null
  } catch {
    return null
  }
}

/** Invalidate cache for a file. */
export function invalidateCache(filePath: string): void {
  cache.delete(filePath)
}
