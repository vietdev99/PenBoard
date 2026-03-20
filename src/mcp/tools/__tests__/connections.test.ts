import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFile, unlink, mkdir, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { invalidateCache } from '../../document-manager'
import { handleManageConnections } from '../connections'

const TMP_DIR = join(tmpdir(), 'penboard-mcp-test-connections')
const TEST_FILES: string[] = []

function createTestDoc(overrides: Record<string, unknown> = {}) {
  return {
    version: '1.0.0',
    pages: [
      {
        id: 'page-1',
        name: 'Home',
        type: 'screen',
        children: [{
          id: 'node-1', type: 'frame', name: 'Frame 1', width: 1200, height: 800,
          children: [
            { id: 'btn-1', type: 'rectangle', name: 'Button 1', width: 100, height: 50, children: [] },
          ],
        }],
      },
      {
        id: 'page-2',
        name: 'Profile',
        type: 'screen',
        children: [{
          id: 'node-4', type: 'frame', name: 'Frame 2', width: 1200, height: 800, children: [],
        }],
      },
    ],
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

describe('manage_connections', () => {
  it('add_connection — creates connection', async () => {
    const fp = await writeTestDoc('add-conn.op', createTestDoc())

    const result = await handleManageConnections({
      filePath: fp,
      action: 'add_connection',
      sourceElementId: 'btn-1',
      sourcePageId: 'page-1',
      targetPageId: 'page-2',
      triggerEvent: 'click',
      transitionType: 'push',
    })

    expect(result.connectionId).toBeTruthy()
    expect(result.connectionCount).toBe(1)

    // Verify persisted
    const raw = JSON.parse(await readFile(fp, 'utf-8'))
    expect(raw.connections).toHaveLength(1)
    expect(raw.connections[0].sourceElementId).toBe('btn-1')
    expect(raw.connections[0].triggerEvent).toBe('click')
  })

  it('list_connections — returns all connections', async () => {
    const fp = await writeTestDoc('list-conn.op', createTestDoc())

    // Add two connections
    await handleManageConnections({
      filePath: fp,
      action: 'add_connection',
      sourceElementId: 'btn-1',
      sourcePageId: 'page-1',
      targetPageId: 'page-2',
      triggerEvent: 'click',
      transitionType: 'push',
    })

    invalidateCache(fp)
    await handleManageConnections({
      filePath: fp,
      action: 'add_connection',
      sourceElementId: 'btn-1',
      sourcePageId: 'page-1',
      targetPageId: 'page-2',
      triggerEvent: 'hover',
      transitionType: 'modal',
    })

    invalidateCache(fp)
    const result = await handleManageConnections({
      filePath: fp,
      action: 'list_connections',
    })

    const connections = result.connections as Array<unknown>
    expect(connections).toHaveLength(2)
  })

  it('list_connections — filters by pageId', async () => {
    const fp = await writeTestDoc('list-conn-filter.op', createTestDoc({
      pages: [
        {
          id: 'page-1', name: 'Home', type: 'screen',
          children: [{ id: 'node-1', type: 'frame', name: 'Frame 1', width: 1200, height: 800, children: [] }],
        },
        {
          id: 'page-2', name: 'Profile', type: 'screen',
          children: [{ id: 'node-2', type: 'frame', name: 'Frame 2', width: 1200, height: 800, children: [] }],
        },
        {
          id: 'page-3', name: 'Settings', type: 'screen',
          children: [{ id: 'node-3', type: 'frame', name: 'Frame 3', width: 1200, height: 800, children: [] }],
        },
      ],
    }))

    // Connection page-1 -> page-2
    await handleManageConnections({
      filePath: fp,
      action: 'add_connection',
      sourceElementId: 'node-1',
      sourcePageId: 'page-1',
      targetPageId: 'page-2',
      triggerEvent: 'click',
      transitionType: 'push',
    })

    // Connection page-2 -> page-3
    invalidateCache(fp)
    await handleManageConnections({
      filePath: fp,
      action: 'add_connection',
      sourceElementId: 'node-2',
      sourcePageId: 'page-2',
      targetPageId: 'page-3',
      triggerEvent: 'click',
      transitionType: 'push',
    })

    // Filter by page-2: should get both (page-1->page-2 and page-2->page-3)
    invalidateCache(fp)
    const result = await handleManageConnections({
      filePath: fp,
      action: 'list_connections',
      pageId: 'page-2',
    })

    const connections = result.connections as Array<unknown>
    expect(connections).toHaveLength(2)

    // Filter by page-3: should get only page-2->page-3
    invalidateCache(fp)
    const result3 = await handleManageConnections({
      filePath: fp,
      action: 'list_connections',
      pageId: 'page-3',
    })

    expect(result3.connections as Array<unknown>).toHaveLength(1)
  })

  it('update_connection — merges updates', async () => {
    const fp = await writeTestDoc('update-conn.op', createTestDoc())

    const addResult = await handleManageConnections({
      filePath: fp,
      action: 'add_connection',
      sourceElementId: 'btn-1',
      sourcePageId: 'page-1',
      targetPageId: 'page-2',
      triggerEvent: 'click',
      transitionType: 'push',
    })
    const connectionId = addResult.connectionId as string

    invalidateCache(fp)
    await handleManageConnections({
      filePath: fp,
      action: 'update_connection',
      connectionId,
      updates: { label: 'Go to profile', transitionType: 'modal' },
    })

    // Verify persisted
    const raw = JSON.parse(await readFile(fp, 'utf-8'))
    expect(raw.connections[0].label).toBe('Go to profile')
    expect(raw.connections[0].transitionType).toBe('modal')
    // Original fields preserved
    expect(raw.connections[0].sourceElementId).toBe('btn-1')
  })

  it('remove_connection — removes connection', async () => {
    const fp = await writeTestDoc('remove-conn.op', createTestDoc())

    const addResult = await handleManageConnections({
      filePath: fp,
      action: 'add_connection',
      sourceElementId: 'btn-1',
      sourcePageId: 'page-1',
      targetPageId: 'page-2',
      triggerEvent: 'click',
      transitionType: 'push',
    })
    const connectionId = addResult.connectionId as string

    invalidateCache(fp)
    const result = await handleManageConnections({
      filePath: fp,
      action: 'remove_connection',
      connectionId,
    })

    expect(result.ok).toBe(true)
    expect(result.remainingConnections).toBe(0)

    // Verify persisted
    const raw = JSON.parse(await readFile(fp, 'utf-8'))
    expect(raw.connections).toHaveLength(0)
  })

  it('add_connection — throws if missing required fields', async () => {
    const fp = await writeTestDoc('add-conn-missing.op', createTestDoc())

    await expect(
      handleManageConnections({
        filePath: fp,
        action: 'add_connection',
        sourceElementId: 'btn-1',
        sourcePageId: 'page-1',
        targetPageId: 'page-2',
        // Missing triggerEvent and transitionType
      }),
    ).rejects.toThrow('triggerEvent is required')
  })
})
