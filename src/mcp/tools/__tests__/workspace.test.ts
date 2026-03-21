import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFile, mkdir, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { invalidateCache } from '../../document-manager'
import {
  handleWriteFlow,
  handleReadFlow,
  handleListFlows,
  handleWriteDoc,
  handleReadDoc,
} from '../workspace'

const TMP_DIR = join(tmpdir(), 'penboard-mcp-test-workspace')
const TEST_PB = join(TMP_DIR, 'test.pb')

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(async () => {
  await mkdir(TMP_DIR, { recursive: true })
  await writeFile(TEST_PB, JSON.stringify({ version: '1.0.0', children: [] }), 'utf-8')
})

afterEach(async () => {
  invalidateCache(TEST_PB)
  await rm(TMP_DIR, { recursive: true, force: true })
})

// ---------------------------------------------------------------------------
// Tests: write_flow
// ---------------------------------------------------------------------------

describe('write_flow', () => {
  it('creates .penboard/flows/general/{name}.md file (default group)', async () => {
    const content = '# Authentication Flow\n\nDescription\n\n```mermaid\nflowchart TD\n  A-->B\n```'
    const result = await handleWriteFlow({ filePath: TEST_PB, name: 'auth', content })

    expect(result.success).toBe(true)
    expect(result.title).toBe('Authentication Flow')
    expect(result.group).toBe('general')

    const fileContent = await readFile(join(TMP_DIR, '.penboard', 'flows', 'general', 'auth.md'), 'utf-8')
    expect(fileContent).toBe(content)
  })

  it('updates manifest.json', async () => {
    const content = '# Authentication Flow\n\nAuth description'
    await handleWriteFlow({ filePath: TEST_PB, name: 'auth', content })

    const manifestRaw = await readFile(join(TMP_DIR, '.penboard', 'manifest.json'), 'utf-8')
    const manifest = JSON.parse(manifestRaw)

    expect(manifest.flows).toHaveLength(1)
    expect(manifest.flows[0].name).toBe('auth')
    expect(manifest.flows[0].title).toBe('Authentication Flow')
    expect(manifest.flows[0].updatedAt).toBeTruthy()
  })

  it('auto-creates directories', async () => {
    const content = '# New Flow\n\nContent'
    await handleWriteFlow({ filePath: TEST_PB, name: 'new-flow', content })

    // Verify the directory was created and file exists (default group = general)
    const fileContent = await readFile(join(TMP_DIR, '.penboard', 'flows', 'general', 'new-flow.md'), 'utf-8')
    expect(fileContent).toBe(content)
  })

  it('upserts manifest entry on update', async () => {
    await handleWriteFlow({ filePath: TEST_PB, name: 'auth', content: '# Auth V1\n\nFirst' })
    await handleWriteFlow({ filePath: TEST_PB, name: 'auth', content: '# Auth V2\n\nUpdated' })

    const manifestRaw = await readFile(join(TMP_DIR, '.penboard', 'manifest.json'), 'utf-8')
    const manifest = JSON.parse(manifestRaw)

    expect(manifest.flows).toHaveLength(1)
    expect(manifest.flows[0].title).toBe('Auth V2')
    expect(manifest.flows[0].group).toBe('general')
  })

  it('creates flow in specified group subdirectory', async () => {
    const content = '# Business Auth\n\nBusiness flow'
    const result = await handleWriteFlow({ filePath: TEST_PB, group: 'business', name: 'auth', content })

    expect(result.success).toBe(true)
    expect(result.group).toBe('business')

    const fileContent = await readFile(join(TMP_DIR, '.penboard', 'flows', 'business', 'auth.md'), 'utf-8')
    expect(fileContent).toBe(content)
  })
})

// ---------------------------------------------------------------------------
// Tests: read_flow
// ---------------------------------------------------------------------------

describe('read_flow', () => {
  it('reads existing flow file from default group', async () => {
    const content = '# Login Flow\n\nLogin description'
    await mkdir(join(TMP_DIR, '.penboard', 'flows', 'general'), { recursive: true })
    await writeFile(join(TMP_DIR, '.penboard', 'flows', 'general', 'login.md'), content, 'utf-8')

    const result = await handleReadFlow({ filePath: TEST_PB, name: 'login' })

    expect(result.name).toBe('login')
    expect(result.title).toBe('Login Flow')
    expect(result.content).toBe(content)
    expect(result.group).toBe('general')
  })

  it('reads flow from specified group', async () => {
    const content = '# Tech Flow\n\nTechnical description'
    await mkdir(join(TMP_DIR, '.penboard', 'flows', 'technical'), { recursive: true })
    await writeFile(join(TMP_DIR, '.penboard', 'flows', 'technical', 'api.md'), content, 'utf-8')

    const result = await handleReadFlow({ filePath: TEST_PB, group: 'technical', name: 'api' })

    expect(result.group).toBe('technical')
    expect(result.name).toBe('api')
    expect(result.content).toBe(content)
  })

  it('throws error for missing flow', async () => {
    await expect(
      handleReadFlow({ filePath: TEST_PB, name: 'nonexistent' }),
    ).rejects.toThrow('not found')
  })
})

// ---------------------------------------------------------------------------
// Tests: list_flows
// ---------------------------------------------------------------------------

describe('list_flows', () => {
  it('lists flows from subdirectories and root (backward compat)', async () => {
    // Root-level file (old format -> "general" group)
    await mkdir(join(TMP_DIR, '.penboard', 'flows'), { recursive: true })
    await writeFile(join(TMP_DIR, '.penboard', 'flows', 'old.md'), '# Old Flow\n\nLegacy', 'utf-8')

    // Grouped file
    await mkdir(join(TMP_DIR, '.penboard', 'flows', 'business'), { recursive: true })
    await writeFile(join(TMP_DIR, '.penboard', 'flows', 'business', 'auth.md'), '# Auth\n\nBiz', 'utf-8')

    const result = await handleListFlows({ filePath: TEST_PB })
    expect(result.flows).toHaveLength(2)

    const oldFlow = result.flows.find((f) => f.name === 'old')
    expect(oldFlow?.group).toBe('general')

    const bizFlow = result.flows.find((f) => f.name === 'auth')
    expect(bizFlow?.group).toBe('business')
  })

  it('returns empty array when no flows dir', async () => {
    const result = await handleListFlows({ filePath: TEST_PB })

    expect(result.flows).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Tests: write_doc
// ---------------------------------------------------------------------------

describe('write_doc', () => {
  it('creates .penboard/docs/{category}/{name}.md', async () => {
    const content = '# API Design\n\nREST endpoints...'
    const result = await handleWriteDoc({
      filePath: TEST_PB,
      category: 'specs',
      name: 'api',
      content,
    })

    expect(result.success).toBe(true)
    expect(result.title).toBe('API Design')

    const fileContent = await readFile(
      join(TMP_DIR, '.penboard', 'docs', 'specs', 'api.md'),
      'utf-8',
    )
    expect(fileContent).toBe(content)
  })

  it('updates manifest.json docs array', async () => {
    const content = '# API Design\n\nREST endpoints...'
    await handleWriteDoc({ filePath: TEST_PB, category: 'specs', name: 'api', content })

    const manifestRaw = await readFile(join(TMP_DIR, '.penboard', 'manifest.json'), 'utf-8')
    const manifest = JSON.parse(manifestRaw)

    expect(manifest.docs).toHaveLength(1)
    expect(manifest.docs[0].category).toBe('specs')
    expect(manifest.docs[0].name).toBe('api')
    expect(manifest.docs[0].title).toBe('API Design')
  })
})

// ---------------------------------------------------------------------------
// Tests: read_doc
// ---------------------------------------------------------------------------

describe('read_doc', () => {
  it('reads existing doc file', async () => {
    const content = '# User Guide\n\nHow to use the app'
    await mkdir(join(TMP_DIR, '.penboard', 'docs', 'guides'), { recursive: true })
    await writeFile(
      join(TMP_DIR, '.penboard', 'docs', 'guides', 'user.md'),
      content,
      'utf-8',
    )

    const result = await handleReadDoc({ filePath: TEST_PB, category: 'guides', name: 'user' })

    expect(result.category).toBe('guides')
    expect(result.name).toBe('user')
    expect(result.title).toBe('User Guide')
    expect(result.content).toBe(content)
  })

  it('throws error for missing doc', async () => {
    await expect(
      handleReadDoc({ filePath: TEST_PB, category: 'specs', name: 'nonexistent' }),
    ).rejects.toThrow('not found')
  })
})

// ---------------------------------------------------------------------------
// Tests: workspace path resolution
// ---------------------------------------------------------------------------

describe('workspace path resolution', () => {
  it('resolves .penboard relative to .pb file', async () => {
    const content = '# Test Flow\n\nTest'
    const result = await handleWriteFlow({ filePath: TEST_PB, name: 'test', content })

    // The file should be under TMP_DIR/.penboard/, not under $HOME/.penboard/
    expect(result.path).toContain(TMP_DIR)
    expect(result.path).toContain('.penboard')
    expect(result.path).toContain('flows')
    expect(result.group).toBe('general')
  })
})
