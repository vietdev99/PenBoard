import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFile, unlink, mkdir } from 'node:fs/promises'
import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { invalidateCache } from '../../document-manager'
import { handleManageDataBinding } from '../data-binding'

const TMP_DIR = join(tmpdir(), 'penboard-mcp-test-data-binding')
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
    dataEntities: [{
      id: 'entity-1', name: 'User', fields: [], rows: [], views: [],
    }],
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

describe('manage_data_binding', () => {
  it('set_binding — attaches binding to node', async () => {
    const fp = await writeTestDoc('set-binding.op', createTestDoc())

    const result = await handleManageDataBinding({
      filePath: fp,
      action: 'set_binding',
      nodeId: 'node-2',
      entityId: 'entity-1',
      fieldMappings: [{ slotKey: 'col-0', fieldId: 'field-1' }],
      pageId: 'page-1',
    })

    expect(result.ok).toBe(true)
    expect(result.nodeId).toBe('node-2')
    expect(result.entityId).toBe('entity-1')

    // Verify persisted
    const raw = JSON.parse(await readFile(fp, 'utf-8'))
    const node2 = raw.pages[0].children[0].children[0]
    expect(node2.dataBinding.entityId).toBe('entity-1')
    expect(node2.dataBinding.fieldMappings).toEqual([{ slotKey: 'col-0', fieldId: 'field-1' }])
  })

  it('set_binding — throws if node not found', async () => {
    const fp = await writeTestDoc('set-binding-missing.op', createTestDoc())

    await expect(
      handleManageDataBinding({
        filePath: fp,
        action: 'set_binding',
        nodeId: 'nonexistent',
        entityId: 'entity-1',
        pageId: 'page-1',
      }),
    ).rejects.toThrow('Node not found')
  })

  it('set_binding — throws if entity not found', async () => {
    const fp = await writeTestDoc('set-binding-no-entity.op', createTestDoc())

    await expect(
      handleManageDataBinding({
        filePath: fp,
        action: 'set_binding',
        nodeId: 'node-2',
        entityId: 'entity-missing',
        pageId: 'page-1',
      }),
    ).rejects.toThrow('Entity not found')
  })

  it('remove_binding — clears binding from node', async () => {
    const fp = await writeTestDoc('remove-binding.op', createTestDoc())

    // Set binding first
    await handleManageDataBinding({
      filePath: fp,
      action: 'set_binding',
      nodeId: 'node-2',
      entityId: 'entity-1',
      pageId: 'page-1',
    })

    // Remove it
    invalidateCache(fp)
    const result = await handleManageDataBinding({
      filePath: fp,
      action: 'remove_binding',
      nodeId: 'node-2',
      pageId: 'page-1',
    })

    expect(result.ok).toBe(true)

    // Verify persisted
    const raw = JSON.parse(await readFile(fp, 'utf-8'))
    const node2 = raw.pages[0].children[0].children[0]
    expect(node2.dataBinding).toBeUndefined()
  })

  it('list_bindings — returns bound nodes on page', async () => {
    const fp = await writeTestDoc('list-bindings.op', createTestDoc())

    // Set bindings on two nodes
    await handleManageDataBinding({
      filePath: fp,
      action: 'set_binding',
      nodeId: 'node-2',
      entityId: 'entity-1',
      fieldMappings: [{ slotKey: 'col-0', fieldId: 'f1' }],
      pageId: 'page-1',
    })

    invalidateCache(fp)
    await handleManageDataBinding({
      filePath: fp,
      action: 'set_binding',
      nodeId: 'node-3',
      entityId: 'entity-1',
      pageId: 'page-1',
    })

    invalidateCache(fp)
    const result = await handleManageDataBinding({
      filePath: fp,
      action: 'list_bindings',
      pageId: 'page-1',
    })

    const bindings = result.bindings as Array<{ nodeId: string }>
    expect(bindings).toHaveLength(2)
    expect(bindings.map((b) => b.nodeId).sort()).toEqual(['node-2', 'node-3'])
  })

  it('list_bindings — returns empty for page with no bindings', async () => {
    const fp = await writeTestDoc('list-bindings-empty.op', createTestDoc())

    const result = await handleManageDataBinding({
      filePath: fp,
      action: 'list_bindings',
      pageId: 'page-1',
    })

    const bindings = result.bindings as Array<unknown>
    expect(bindings).toHaveLength(0)
  })
})
