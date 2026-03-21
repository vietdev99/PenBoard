import { defineEventHandler, setResponseHeaders } from 'h3'
import { getSyncFilePath } from '../../utils/mcp-sync-state'
import { dirname, join } from 'node:path'
import { readdir, readFile } from 'node:fs/promises'

export default defineEventHandler(async (event) => {
  setResponseHeaders(event, { 'Content-Type': 'application/json' })

  const filePath = getSyncFilePath()
  if (!filePath) {
    return { flows: [], error: 'No file path available' }
  }

  const workspaceRoot = dirname(filePath)
  const flowsPath = join(workspaceRoot, '.penboard', 'flows')

  try {
    const dirents = await readdir(flowsPath, { withFileTypes: true })
    const flows: { group: string; name: string; title: string; content: string }[] = []

    // Root-level .md files → "general" group (backward compat)
    for (const entry of dirents) {
      if (!entry.isDirectory() && entry.name.endsWith('.md')) {
        const content = await readFile(join(flowsPath, entry.name), 'utf-8')
        const name = entry.name.replace(/\.md$/, '')
        const titleMatch = content.match(/^#\s+(.+)/m)
        flows.push({ group: 'general', name, title: titleMatch?.[1]?.trim() ?? name, content })
      }
    }

    // Subdirectories → each is a group
    for (const entry of dirents) {
      if (!entry.isDirectory()) continue
      let subFiles: string[]
      try {
        subFiles = await readdir(join(flowsPath, entry.name))
      } catch {
        continue
      }
      for (const file of subFiles.filter((f) => f.endsWith('.md'))) {
        const content = await readFile(join(flowsPath, entry.name, file), 'utf-8')
        const name = file.replace(/\.md$/, '')
        const titleMatch = content.match(/^#\s+(.+)/m)
        flows.push({ group: entry.name, name, title: titleMatch?.[1]?.trim() ?? name, content })
      }
    }

    return { flows }
  } catch {
    return { flows: [] }
  }
})
