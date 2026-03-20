import { defineEventHandler, setResponseHeaders } from 'h3'
import { getSyncFilePath } from '../../utils/mcp-sync-state'
import { dirname, join } from 'node:path'
import { readdir, readFile } from 'node:fs/promises'

/** GET /api/workspace/flows -- Returns all flow files from .penboard/flows/ for the Flow tab UI. */
export default defineEventHandler(async (event) => {
  setResponseHeaders(event, { 'Content-Type': 'application/json' })

  const filePath = getSyncFilePath()
  if (!filePath) {
    return { flows: [], error: 'No file path available' }
  }

  const workspaceRoot = dirname(filePath)
  const flowsPath = join(workspaceRoot, '.penboard', 'flows')

  try {
    const entries = await readdir(flowsPath)
    const mdFiles = entries.filter((f) => f.endsWith('.md'))

    const flows = await Promise.all(
      mdFiles.map(async (file) => {
        const content = await readFile(join(flowsPath, file), 'utf-8')
        const name = file.replace(/\.md$/, '')
        const titleMatch = content.match(/^#\s+(.+)/m)
        const title = titleMatch?.[1]?.trim() ?? name
        return { name, title, content }
      }),
    )

    return { flows }
  } catch {
    // Directory doesn't exist or can't be read
    return { flows: [] }
  }
})
