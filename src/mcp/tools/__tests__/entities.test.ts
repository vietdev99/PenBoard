import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFile, unlink, mkdir, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { invalidateCache } from '../../document-manager'
import { handleManageEntities } from '../entities'

const TMP_DIR = join(tmpdir(), 'penboard-mcp-test-entities')
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

describe('manage_entities', () => {
  it('add_entity — creates entity with name', async () => {
    const fp = await writeTestDoc('add-entity.op', createTestDoc())

    const result = await handleManageEntities({
      filePath: fp,
      action: 'add_entity',
      name: 'User',
    })

    expect(result.entityId).toBeTruthy()
    expect(result.entityCount).toBe(1)

    // Verify persisted
    const raw = JSON.parse(await readFile(fp, 'utf-8'))
    expect(raw.dataEntities).toHaveLength(1)
    expect(raw.dataEntities[0].name).toBe('User')
  })

  it('list_entities — returns all entities with counts', async () => {
    const fp = await writeTestDoc('list-entities.op', createTestDoc())

    await handleManageEntities({ filePath: fp, action: 'add_entity', name: 'User' })
    invalidateCache(fp)
    await handleManageEntities({ filePath: fp, action: 'add_entity', name: 'Product' })
    invalidateCache(fp)

    const result = await handleManageEntities({ filePath: fp, action: 'list_entities' })
    const entities = result.entities as Array<{ name: string }>
    expect(entities).toHaveLength(2)
    expect(entities.map((e) => e.name).sort()).toEqual(['Product', 'User'])
  })

  it('get_entity — returns full entity', async () => {
    const fp = await writeTestDoc('get-entity.op', createTestDoc())

    const addResult = await handleManageEntities({
      filePath: fp,
      action: 'add_entity',
      name: 'User',
    })
    const entityId = addResult.entityId as string

    // Add a field
    invalidateCache(fp)
    await handleManageEntities({
      filePath: fp,
      action: 'add_field',
      entityId,
      field: { name: 'email', type: 'text' },
    })

    invalidateCache(fp)
    const result = await handleManageEntities({
      filePath: fp,
      action: 'get_entity',
      entityId,
    })

    const entity = result.entity as { name: string; fields: Array<{ name: string }> }
    expect(entity.name).toBe('User')
    expect(entity.fields).toHaveLength(1)
    expect(entity.fields[0].name).toBe('email')
  })

  it('add_field — adds field to entity', async () => {
    const fp = await writeTestDoc('add-field.op', createTestDoc())

    const addResult = await handleManageEntities({
      filePath: fp,
      action: 'add_entity',
      name: 'User',
    })
    const entityId = addResult.entityId as string

    invalidateCache(fp)
    const fieldResult = await handleManageEntities({
      filePath: fp,
      action: 'add_field',
      entityId,
      field: { name: 'email', type: 'text' },
    })

    expect(fieldResult.fieldId).toBeTruthy()
    expect(fieldResult.fieldCount).toBe(1)
  })

  it('remove_field — removes field and cleans row values', async () => {
    const fp = await writeTestDoc('remove-field.op', createTestDoc())

    // Add entity
    const addResult = await handleManageEntities({
      filePath: fp,
      action: 'add_entity',
      name: 'User',
    })
    const entityId = addResult.entityId as string

    // Add field
    invalidateCache(fp)
    const fieldResult = await handleManageEntities({
      filePath: fp,
      action: 'add_field',
      entityId,
      field: { name: 'email', type: 'text' },
    })
    const fieldId = fieldResult.fieldId as string

    // Add row with value for this field
    invalidateCache(fp)
    await handleManageEntities({
      filePath: fp,
      action: 'add_row',
      entityId,
      fieldValues: { [fieldId]: 'user@example.com' },
    })

    // Remove field
    invalidateCache(fp)
    await handleManageEntities({
      filePath: fp,
      action: 'remove_field',
      entityId,
      fieldId,
    })

    // Verify: field gone, row value cleaned
    const raw = JSON.parse(await readFile(fp, 'utf-8'))
    const entity = raw.dataEntities[0]
    expect(entity.fields).toHaveLength(0)
    expect(entity.rows[0].values[fieldId]).toBeUndefined()
  })

  it('add_row — creates row', async () => {
    const fp = await writeTestDoc('add-row.op', createTestDoc())

    const addResult = await handleManageEntities({
      filePath: fp,
      action: 'add_entity',
      name: 'User',
    })
    const entityId = addResult.entityId as string

    invalidateCache(fp)
    const rowResult = await handleManageEntities({
      filePath: fp,
      action: 'add_row',
      entityId,
    })

    expect(rowResult.rowId).toBeTruthy()
    expect(rowResult.rowCount).toBe(1)
  })

  it('update_row — updates row values', async () => {
    const fp = await writeTestDoc('update-row.op', createTestDoc())

    const addResult = await handleManageEntities({
      filePath: fp,
      action: 'add_entity',
      name: 'User',
    })
    const entityId = addResult.entityId as string

    invalidateCache(fp)
    const rowResult = await handleManageEntities({
      filePath: fp,
      action: 'add_row',
      entityId,
    })
    const rowId = rowResult.rowId as string

    invalidateCache(fp)
    await handleManageEntities({
      filePath: fp,
      action: 'update_row',
      entityId,
      rowId,
      fieldValues: { 'field-x': 'hello' },
    })

    // Verify persisted
    const raw = JSON.parse(await readFile(fp, 'utf-8'))
    expect(raw.dataEntities[0].rows[0].values['field-x']).toBe('hello')
  })

  it('remove_entity — cascade cleans bindings', async () => {
    const fp = await writeTestDoc('remove-cascade-binding.op', createTestDoc())

    // Add entity
    const addResult = await handleManageEntities({
      filePath: fp,
      action: 'add_entity',
      name: 'User',
    })
    const entityId = addResult.entityId as string

    // Manually write a binding on node-2 referencing this entity
    invalidateCache(fp)
    const raw = JSON.parse(await readFile(fp, 'utf-8'))
    raw.pages[0].children[0].children[0].dataBinding = {
      entityId,
      fieldMappings: [],
    }
    await writeFile(fp, JSON.stringify(raw), 'utf-8')

    // Remove entity
    invalidateCache(fp)
    const result = await handleManageEntities({
      filePath: fp,
      action: 'remove_entity',
      entityId,
    })

    expect(result.ok).toBe(true)
    expect(result.remainingEntities).toBe(0)

    // Verify binding is gone
    const after = JSON.parse(await readFile(fp, 'utf-8'))
    const node2 = after.pages[0].children[0].children[0]
    expect(node2.dataBinding).toBeUndefined()
  })

  it('remove_entity — cascade cleans relation fields', async () => {
    const fp = await writeTestDoc('remove-cascade-relation.op', createTestDoc())

    // Add entity-A
    const addA = await handleManageEntities({
      filePath: fp,
      action: 'add_entity',
      name: 'EntityA',
    })
    const entityAId = addA.entityId as string

    // Add entity-B
    invalidateCache(fp)
    const addB = await handleManageEntities({
      filePath: fp,
      action: 'add_entity',
      name: 'EntityB',
    })
    const entityBId = addB.entityId as string

    // Add relation field on B pointing to A
    invalidateCache(fp)
    await handleManageEntities({
      filePath: fp,
      action: 'add_field',
      entityId: entityBId,
      field: {
        name: 'linkedA',
        type: 'relation',
        relatedEntityId: entityAId,
        relationCardinality: '1:N',
      },
    })

    // Remove entity-A
    invalidateCache(fp)
    await handleManageEntities({
      filePath: fp,
      action: 'remove_entity',
      entityId: entityAId,
    })

    // Verify: entity-B's relation field is removed
    const raw = JSON.parse(await readFile(fp, 'utf-8'))
    const entityB = raw.dataEntities.find((e: any) => e.id === entityBId)
    expect(entityB.fields).toHaveLength(0)
  })

  it('update_entity — updates entity name', async () => {
    const fp = await writeTestDoc('update-entity.op', createTestDoc())

    const addResult = await handleManageEntities({
      filePath: fp,
      action: 'add_entity',
      name: 'User',
    })
    const entityId = addResult.entityId as string

    invalidateCache(fp)
    await handleManageEntities({
      filePath: fp,
      action: 'update_entity',
      entityId,
      name: 'Customer',
    })

    const raw = JSON.parse(await readFile(fp, 'utf-8'))
    expect(raw.dataEntities[0].name).toBe('Customer')
  })
})
