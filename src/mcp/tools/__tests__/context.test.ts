import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFile, unlink, mkdir, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { invalidateCache } from '../../document-manager'
import { handleSetContext, handleGetContext } from '../context'

const TMP_DIR = join(tmpdir(), 'penboard-mcp-test-context')
const TEST_FILES: string[] = []

function createTestDoc(overrides: Record<string, unknown> = {}) {
  return {
    version: '1.0.0',
    pages: [{
      id: 'page-1',
      name: 'Home',
      type: 'screen',
      children: [{
        id: 'node-1', type: 'frame', name: 'Frame 1', width: 1200, height: 800,
        children: [
          { id: 'node-2', type: 'rectangle', name: 'Rect 1', width: 100, height: 50, children: [] },
          { id: 'node-3', type: 'text', name: 'Text 1', content: 'Hello', children: [] },
        ],
      }],
    }],
    children: [],
    dataEntities: [],
    connections: [],
    ...overrides,
  }
}

async function writeTestDoc(filename: string, doc: object): Promise<string> {
  const fp = join(TMP_DIR, filename)
  await writeFile(fp, JSON.stringify(doc), 'utf-8')
  TEST_FILES.push(fp)
  return fp
}

beforeEach(async () => {
  await mkdir(TMP_DIR, { recursive: true })
})

afterEach(async () => {
  for (const fp of TEST_FILES) {
    try {
      invalidateCache(fp)
      await unlink(fp)
    } catch {}
  }
  TEST_FILES.length = 0
})

describe('set_context / get_context', () => {
  it('set_context — writes context to node', async () => {
    const fp = await writeTestDoc('set-ctx-node.op', createTestDoc())

    const result = await handleSetContext({
      filePath: fp,
      nodeId: 'node-2',
      pageId: 'page-1',
      context: 'This is a button',
    })

    expect(result.ok).toBe(true)
    expect(result.target).toBe('node-2')

    // Verify persisted
    const raw = JSON.parse(await readFile(fp, 'utf-8'))
    const node2 = raw.pages[0].children[0].children[0]
    expect(node2.context).toBe('This is a button')
  })

  it('set_context — writes context to page', async () => {
    const fp = await writeTestDoc('set-ctx-page.op', createTestDoc())

    const result = await handleSetContext({
      filePath: fp,
      pageId: 'page-1',
      context: 'Homepage',
    })

    expect(result.ok).toBe(true)
    expect(result.target).toBe('page-1')

    // Verify persisted
    const raw = JSON.parse(await readFile(fp, 'utf-8'))
    expect(raw.pages[0].context).toBe('Homepage')
  })

  it('get_context — reads context from node', async () => {
    const fp = await writeTestDoc('get-ctx-node.op', createTestDoc())

    // Set context first
    await handleSetContext({
      filePath: fp,
      nodeId: 'node-2',
      pageId: 'page-1',
      context: 'This is a button',
    })

    invalidateCache(fp)
    const result = await handleGetContext({
      filePath: fp,
      nodeId: 'node-2',
      pageId: 'page-1',
    })

    expect(result.nodeId).toBe('node-2')
    expect(result.context).toBe('This is a button')
  })

  it('get_context — reads context from page', async () => {
    const fp = await writeTestDoc('get-ctx-page.op', createTestDoc())

    // Set context first
    await handleSetContext({
      filePath: fp,
      pageId: 'page-1',
      context: 'Homepage',
    })

    invalidateCache(fp)
    const result = await handleGetContext({
      filePath: fp,
      pageId: 'page-1',
    })

    expect(result.pageId).toBe('page-1')
    expect(result.context).toBe('Homepage')
  })

  it('get_context — returns empty string for node without context', async () => {
    const fp = await writeTestDoc('get-ctx-empty.op', createTestDoc())

    const result = await handleGetContext({
      filePath: fp,
      nodeId: 'node-2',
      pageId: 'page-1',
    })

    expect(result.context).toBe('')
  })

  it('get_context — throws if neither nodeId nor pageId provided', async () => {
    const fp = await writeTestDoc('get-ctx-no-id.op', createTestDoc())

    await expect(
      handleGetContext({ filePath: fp }),
    ).rejects.toThrow('Either nodeId or pageId must be provided')
  })

  it('set_context — throws if neither nodeId nor pageId provided', async () => {
    const fp = await writeTestDoc('set-ctx-no-id.op', createTestDoc())

    await expect(
      handleSetContext({ filePath: fp, context: 'test' }),
    ).rejects.toThrow('Either nodeId or pageId must be provided')
  })
})
